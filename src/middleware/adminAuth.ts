import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual, createHash } from 'crypto';

const sha = (s: string) => createHash('sha256').update(s).digest();

/** Admin sederhana: header `x-admin-key` harus sama dengan env ADMIN_KEY. */
export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    return res.status(503).json({ success: false, message: 'ADMIN_KEY belum diatur di server.' });
  }
  const given = String(req.header('x-admin-key') ?? '');
  if (!timingSafeEqual(sha(given), sha(expected))) {
    return res.status(401).json({ success: false, message: 'Kunci admin salah.' });
  }
  next();
}
