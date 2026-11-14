const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function userFromToken(token) {
  if (!token) return null;
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return User.findById(decoded.id).select('-password');
}

const DEMO_EMAIL = process.env.DEMO_EMAIL || 'abhijaymishra07@gmail.com';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const DEMO_ALLOWED_WRITES = new Set(['/api/notifications/read']);

function isReadOnlyDemo(user, req) {
  return (
    process.env.DEMO_READ_ONLY === 'true' &&
    user.email === DEMO_EMAIL &&
    !SAFE_METHODS.has(req.method) &&
    !DEMO_ALLOWED_WRITES.has(req.originalUrl.split('?')[0])
  );
}

async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Not authorized. Please log in.' });
    }

    const user = await userFromToken(token);

    if (!user) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }

    if (isReadOnlyDemo(user, req)) {
      return res.status(403).json({
        message: 'The demo account is read-only. Sign up for a free account to add your own applications.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired session. Please log in again.' });
  }
}

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

module.exports = { protect, signToken, userFromToken };
