import { Response, NextFunction } from "express";
import { AuthenticatedRequest, verifyAndExtractUser } from "../firebase/authMiddleware";
import { getAdminDb } from "../firebase/admin";
import { AppRole, SourceCapabilities, computeSourceCapabilities, createAuditEvent } from "./authContext";

async function resolveAuthenticatedUser(req: AuthenticatedRequest) {
  if (req.user?.uid) return req.user;
  return await verifyAndExtractUser(req);
}

// Standard Error Payloads
export function sendUnauthenticated(res: Response, message = "Authentication is required.") {
  return res.status(401).json({
    ok: false,
    code: "UNAUTHENTICATED",
    message,
    requestId: res.getHeader("x-request-id") || Math.random().toString(36).substring(7)
  });
}

export function sendForbidden(res: Response, message = "You do not have permission to perform this action.") {
  return res.status(403).json({
    ok: false,
    code: "FORBIDDEN",
    message,
    requestId: res.getHeader("x-request-id") || Math.random().toString(36).substring(7)
  });
}

export function requireAuth() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = await resolveAuthenticatedUser(req);
      if (!user) {
        return sendUnauthenticated(res);
      }
      req.user = user;
      req.authContext = user.authContext;
      next();
    } catch (err: any) {
      return sendUnauthenticated(res);
    }
  };
}

export function requireNonAnonymous() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = await resolveAuthenticatedUser(req);
      if (!user || user.isAnonymous) {
        return sendUnauthenticated(res, "මෙම ක්‍රියාව සිදු කිරීම සඳහා කරුණාකර ඔබගේ ගිණුමට ලොග් වන්න. (Non-anonymous sign-in required)");
      }
      req.user = user;
      req.authContext = user.authContext;
      next();
    } catch (err: any) {
      return sendUnauthenticated(res);
    }
  };
}

export function requireRole(...allowedRoles: AppRole[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = await resolveAuthenticatedUser(req);
      if (!user) {
        return sendUnauthenticated(res);
      }
      req.user = user;
      req.authContext = user.authContext;

      if (!req.authContext) {
        return sendUnauthenticated(res);
      }

      const hasRole = req.authContext.roles.some((r: AppRole) => allowedRoles.includes(r));
      if (!hasRole) {
        await createAuditEvent({
          actorUid: req.authContext.uid,
          actorRoles: req.authContext.roles,
          operation: "unauthorized_role_attempt",
          targetType: "role_guard",
          targetId: allowedRoles.join(","),
          reason: `Requires one of: ${allowedRoles.join(",")}`,
          result: "failure"
        });
        return sendForbidden(res);
      }
      next();
    } catch (err: any) {
      return sendUnauthenticated(res);
    }
  };
}

export function requireCapability(capName: keyof SourceCapabilities) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = await resolveAuthenticatedUser(req);
      if (!user) {
        return sendUnauthenticated(res);
      }
      req.user = user;
      req.authContext = user.authContext;

      if (!req.authContext) {
        return sendUnauthenticated(res);
      }

      // Check if user has global capability derived from role
      // For global capabilities (not tied to a specific source, e.g. review cache),
      // we can pass a dummy/empty source.
      const caps = computeSourceCapabilities(req.authContext, {});
      if (!caps[capName]) {
        await createAuditEvent({
          actorUid: req.authContext.uid,
          actorRoles: req.authContext.roles,
          operation: "unauthorized_global_capability_attempt",
          targetType: "capability_guard",
          targetId: String(capName),
          reason: `Requires global capability ${capName}`,
          result: "failure"
        });
        return sendForbidden(res);
      }
      next();
    } catch (err: any) {
      return sendUnauthenticated(res);
    }
  };
}

export function requireSourceAccess(capName: keyof SourceCapabilities, sourceIdParamName = "sourceId") {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = await resolveAuthenticatedUser(req);
      if (!user) {
        return sendUnauthenticated(res);
      }
      req.user = user;
      req.authContext = user.authContext;

      if (!req.authContext) {
        return sendUnauthenticated(res);
      }

      const sourceId = req.params[sourceIdParamName] || req.query[sourceIdParamName] || req.body[sourceIdParamName];
      if (!sourceId) {
        return res.status(400).json({ ok: false, error: "Missing source identifier." });
      }

      const db = getAdminDb();
      let sourceRecord: any = null;

      // 1. Check rag_sources
      const ragDoc = await db.collection("rag_sources").doc(sourceId).get();
      if (ragDoc.exists) {
        sourceRecord = ragDoc.data();
      } else {
        // 2. Check past_papers
        const ppDoc = await db.collection("past_papers").doc(sourceId).get();
        if (ppDoc.exists) {
          sourceRecord = ppDoc.data();
        } else {
          // 3. Check syllabus_resources if exists in user collection
          const sylDoc = await db.collection("users").doc(req.authContext.uid).collection("syllabus_resources").doc(sourceId).get();
          if (sylDoc.exists) {
            sourceRecord = sylDoc.data();
          }
        }
      }

      if (!sourceRecord) {
        // Obfuscated error response to protect private existence details
        return sendForbidden(res, "Source not found or access denied.");
      }

      const caps = computeSourceCapabilities(req.authContext, sourceRecord);
      if (!caps[capName]) {
        await createAuditEvent({
          actorUid: req.authContext.uid,
          actorRoles: req.authContext.roles,
          operation: "unauthorized_source_capability_attempt",
          targetType: "source",
          targetId: String(sourceId),
          reason: `Requires capability ${capName} on source`,
          result: "failure"
        });
        return sendForbidden(res, "Access denied to this source operation.");
      }

      // Attach resolved source to request for downstream handlers
      (req as any).resolvedSource = sourceRecord;
      next();
    } catch (err: any) {
      return sendUnauthenticated(res);
    }
  };
}

export function requireSourceOwnerOrRole(sourceIdParamName = "sourceId", ...allowedRoles: AppRole[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = await resolveAuthenticatedUser(req);
      if (!user) {
        return sendUnauthenticated(res);
      }
      req.user = user;
      req.authContext = user.authContext;

      if (!req.authContext) {
        return sendUnauthenticated(res);
      }

      const sourceId = req.params[sourceIdParamName] || req.query[sourceIdParamName] || req.body[sourceIdParamName];
      if (!sourceId) {
        return res.status(400).json({ ok: false, error: "Missing source identifier." });
      }

      const db = getAdminDb();
      let sourceRecord: any = null;

      const ragDoc = await db.collection("rag_sources").doc(sourceId).get();
      if (ragDoc.exists) {
        sourceRecord = ragDoc.data();
      } else {
        const ppDoc = await db.collection("past_papers").doc(sourceId).get();
        if (ppDoc.exists) {
          sourceRecord = ppDoc.data();
        }
      }

      if (!sourceRecord) {
        return sendForbidden(res, "Source not found or access denied.");
      }

      const isOwner = sourceRecord.ownerUid === req.authContext.uid;
      const hasRole = req.authContext.roles.some((r: AppRole) => allowedRoles.includes(r));

      if (!isOwner && !hasRole) {
        return sendForbidden(res, "Access denied.");
      }

      (req as any).resolvedSource = sourceRecord;
      next();
    } catch (err: any) {
      return sendUnauthenticated(res);
    }
  };
}
