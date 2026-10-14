'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

function sign(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function verify(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Express middleware — rejects requests without a valid Bearer token.
 * Attaches decoded payload to req.admin on success.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    req.admin = verify(token);
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Session expired, please log in again'
      : 'Invalid token';
    return res.status(401).json({ success: false, error: msg });
  }
}

module.exports = { sign, verify, requireAuth };