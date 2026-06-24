import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { getFirebaseAdminAuth } from './firebaseAdmin';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const verifyFirebaseToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Missing or invalid Authorization header' });
  }

  const idToken = authHeader.split('Bearer ')[1]?.trim();
  if (!idToken || idToken === 'null' || idToken === 'undefined' || idToken.split('.').length !== 3) {
    return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Missing or malformed token' });
  }

  try {
    const decodedToken = await getFirebaseAdminAuth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Invalid or expired token' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.admin) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Requires admin privileges' });
  }
  next();
};

export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.split('Bearer ')[1]?.trim();
    if (idToken && idToken !== 'null' && idToken !== 'undefined' && idToken.split('.').length === 3) {
      try {
        const decodedToken = await getFirebaseAdminAuth().verifyIdToken(idToken);
        req.user = decodedToken;
      } catch (error) {
        console.error('Error verifying optional Firebase ID token:', error);
      }
    }
  }
  next();
};
