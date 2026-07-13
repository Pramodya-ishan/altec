import { 
  getAdminDb 
} from "../firebase/admin";
import { Filter, Query } from "firebase-admin/firestore";
import { 
  SourceRecord, 
  SourceRecordSchema, 
  SourceVisibility,
  ProcessingStatus,
  MediaKind,
  ResourceRole
} from "../../src/shared/source-registry";
import { 
  AuthContext, 
  AppRole,
  createAuditEvent 
} from "../utils/authContext";
import { v4 as uuidv4 } from "uuid";

/**
 * Supported Source Operations for Authorization
 */
export type SourceOperation = 
  | "view" 
  | "download" 
  | "ask_ai" 
  | "edit_metadata" 
  | "change_visibility" 
  | "delete" 
  | "reprocess" 
  | "reindex" 
  | "run_ocr" 
  | "view_ocr_text" 
  | "repair";

/**
 * Source Repository Result Types
 */
export interface SourceQueryResult {
  items: SourceRecord[];
  nextCursor?: string;
  totalCount?: number;
}

/**
 * Legacy Source Converters
 * These normalize old data schemas into the canonical SourceRecord format for read-compatibility.
 */
export class SourceRepository {
  private static COLLECTION = "sources";

  /**
   * Legacy Source Converters
   * These normalize old data schemas into the canonical SourceRecord format for read-compatibility.
   */
  private static legacyConverters = {
    rag_sources: (id: string, data: any): Partial<SourceRecord> => ({
      sourceId: id,
      displayTitle: data.name || data.fileName || "Untitled Source",
      originalFileName: data.fileName || data.name || "unknown",
      ownerUid: data.uploadedByUid || "legacy_system",
      visibility: (data.isPublic ? "public" : "private") as SourceVisibility,
      storagePath: data.url || "",
      processingStatus: (data.status || "ready") as ProcessingStatus,
      mediaKind: "pdf" as MediaKind, // Defaulting for RAG
      resourceRole: "student_note" as ResourceRole,
      sha256: data.hash || "legacy_pending",
      createdAt: data.createdAt || Date.now(),
      updatedAt: data.updatedAt || Date.now(),
    }),
    past_papers: (id: string, data: any): Partial<SourceRecord> => ({
      sourceId: id,
      displayTitle: data.title || `${data.subject} ${data.year}`,
      originalFileName: data.fileName || "unknown",
      ownerUid: data.ownerUid || "official_curriculum",
      visibility: "public" as SourceVisibility,
      storagePath: data.storagePath || data.url || "",
      processingStatus: "ready" as ProcessingStatus,
      mediaKind: "pdf" as MediaKind,
      resourceRole: "past_paper" as ResourceRole,
      subject: data.subject,
      year: data.year,
      medium: data.medium,
      sha256: data.sha256 || "legacy_pending",
      createdAt: data.createdAt || Date.now(),
      updatedAt: data.updatedAt || Date.now(),
    })
  };

  /**
   * Internal helper to check if a user is authorized for an operation on a source
   */
  private static isAuthorized(auth: AuthContext, source: SourceRecord, operation: SourceOperation): boolean {
    const isAdmin = auth.roles.includes("admin");
    const isOwner = source.ownerUid === auth.uid;

    // Admin has global access to non-private operations
    if (isAdmin) return true;

    switch (operation) {
      case "view":
      case "ask_ai":
        return isOwner || source.visibility === "public" || source.visibility === "institution";
      
      case "download":
        return isOwner || (source.visibility === "public" && auth.roles.includes("student"));

      case "edit_metadata":
      case "change_visibility":
      case "delete":
        return isOwner; // Only owner can modify these (or admin handled above)

      case "reprocess":
      case "reindex":
      case "run_ocr":
      case "repair":
        return isOwner || auth.roles.includes("ops");

      case "view_ocr_text":
        return isOwner || auth.roles.includes("ops") || source.visibility === "public";

      default:
        return false;
    }
  }

  /**
   * Create a new canonical source record
   */
  static async createSource(auth: AuthContext, input: any): Promise<SourceRecord> {
    const sourceId = uuidv4();
    const originalFileName = String(input.originalFileName || "untitled");
    const normalizedName = String(input.normalizedName || originalFileName)
      .normalize("NFKC")
      .trim()
      .toLowerCase();
    const normalizedStem = String(input.normalizedStem || normalizedName.replace(/\.[^.]+$/, ""));
    const sha256 = typeof input.sha256 === "string" && /^[a-f0-9]{64}$/i.test(input.sha256)
      ? input.sha256
      : "0".repeat(64);
    
    const record: SourceRecord = {
      sourceId,
      ownerUid: auth.uid, // Forced from auth
      notebookIds: input.notebookIds || [],
      visibility: input.visibility || "private",
      displayTitle: input.displayTitle || originalFileName,
      originalFileName,
      normalizedName,
      normalizedStem,
      aliases: input.aliases || [],
      sha256,
      sourceVersion: 1,
      processingVersion: 1,
      mimeType: input.mimeType || "application/pdf",
      mediaKind: input.mediaKind || "pdf",
      resourceRole: input.resourceRole || "student_note",
      sizeBytes: input.sizeBytes || 0,
      storagePath: input.storagePath,
      processingStatus: "uploaded",
      chunkCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Validate with shared schema
    const validated = SourceRecordSchema.parse(record);
    
    await getAdminDb().collection(this.COLLECTION).doc(sourceId).set(validated);

    await createAuditEvent({
      actorUid: auth.uid,
      actorRoles: auth.roles,
      operation: "source_create",
      targetType: "source",
      targetId: sourceId,
      reason: "User uploaded new source",
      result: "success"
    });

    return validated as SourceRecord;
  }

  /**
   * Fetch a source by ID with authorization and legacy fallback
   */
  static async getSourceById(auth: AuthContext, sourceId: string, operation: SourceOperation): Promise<SourceRecord> {
    // 1. Check canonical collection
    let doc = await getAdminDb().collection(this.COLLECTION).doc(sourceId).get();
    let record: SourceRecord | null = null;

    if (doc.exists) {
      record = doc.data() as SourceRecord;
    } else {
      // 2. Legacy fallbacks
      // We check common legacy collections
      const legacyCollections = ["rag_sources", "past_papers"];
      for (const coll of legacyCollections) {
        const legacyDoc = await getAdminDb().collection(coll).doc(sourceId).get();
        if (legacyDoc.exists) {
          const converter = (SourceRepository.legacyConverters as any)[coll];
          if (converter) {
            record = converter(sourceId, legacyDoc.data()) as SourceRecord;
            break;
          }
        }
      }
    }

    if (!record) {
      throw new Error("SOURCE_NOT_FOUND");
    }

    // 3. Authorize
    if (!this.isAuthorized(auth, record, operation)) {
      throw new Error("SOURCE_FORBIDDEN");
    }

    return record;
  }

  /**
   * Update a source record
   */
  static async updateSource(auth: AuthContext, sourceId: string, input: any): Promise<SourceRecord> {
    const docRef = getAdminDb().collection(this.COLLECTION).doc(sourceId);
    const doc = await docRef.get();
    
    if (!doc.exists) throw new Error("SOURCE_NOT_FOUND");
    
    const current = doc.data() as SourceRecord;
    
    if (!this.isAuthorized(auth, current, "edit_metadata")) {
      throw new Error("SOURCE_FORBIDDEN");
    }

    // Only allow specific fields
    const updates: any = {};
    const allowed = ["displayTitle", "aliases", "notebookIds", "visibility", "subject", "year", "medium", "paperType", "paperPart"];
    
    for (const key of allowed) {
      if (input[key] !== undefined) {
        updates[key] = input[key];
      }
    }

    updates.updatedAt = Date.now();
    
    await docRef.update(updates);
    
    if (input.visibility && input.visibility !== current.visibility) {
      await createAuditEvent({
        actorUid: auth.uid,
        actorRoles: auth.roles,
        operation: "source_visibility_change",
        targetType: "source",
        targetId: sourceId,
        reason: `Changed visibility from ${current.visibility} to ${input.visibility}`,
        result: "success"
      });
    }

    return { ...current, ...updates };
  }

  /**
   * List sources with authorization and pagination
   */
  static async listSources(auth: AuthContext, query: any): Promise<SourceQueryResult> {
    let q = getAdminDb().collection(this.COLLECTION) as unknown as Query;

    // Filters
    if (!auth.roles.includes("admin")) {
      // Normal users see their own or public/institution shared
      // Firestore OR queries are limited, so we often do multiple queries or rely on visibility + owner
      // For now, let's filter by owner or public
      q = q.where("visibility", "in", ["public", "institution"]);
      // Note: This needs complex index or multiple queries to show (owned OR public)
      // For simplicity in this part, we filter by owner if requested, else we show public
    }

    if (query.ownerUid) {
      q = q.where("ownerUid", "==", query.ownerUid);
    }
    
    if (query.visibility) {
      q = q.where("visibility", "==", query.visibility);
    }

    if (query.subject) {
      q = q.where("subject", "==", query.subject);
    }

    // Pagination
    const limit = Math.min(query.limit || 20, 100);
    q = q.orderBy("createdAt", "desc").limit(limit);

    if (query.cursor) {
      const cursorDoc = await getAdminDb().collection(this.COLLECTION).doc(query.cursor).get();
      if (cursorDoc.exists) {
        q = q.startAfter(cursorDoc);
      }
    }

    const snapshot = await q.get();
    const items = snapshot.docs.map(d => d.data() as SourceRecord);
    
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    const nextCursor = lastDoc ? lastDoc.id : undefined;

    return {
      items,
      nextCursor
    };
  }
}
