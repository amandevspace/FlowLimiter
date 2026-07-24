// server/src/middleware/authGuard.js
// Standalone JWT auth guard. Additive only — not wired into any existing
// route so current rate-limiter behavior is untouched. Available for the
// new /auth routes (e.g. /auth/me) and for anyone who wants to protect
// additional routes later.
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_insecure_secret_change_me';

export const authGuard = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export { JWT_SECRET };
export default authGuard;
