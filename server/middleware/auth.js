const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function userFromToken(token) {
  if (!token) return null;
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return User.findById(decoded.id).select('-password');
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
