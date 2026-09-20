import jwt from 'jsonwebtoken';
import env from '../config/env.js';

export const requireAuth = async (req, res, next) => {
  const token = req.cookies?.tv3d_token;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.userId   = payload.userId;
    req.userRole = payload.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export default requireAuth;
