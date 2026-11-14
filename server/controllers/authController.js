const User = require('../models/User');
const Application = require('../models/Application');
const Notification = require('../models/Notification');
const { signToken } = require('../middleware/auth');
const { deleteFile } = require('../config/gridfs');
const mongoose = require('mongoose');

async function register(req, res) {
  try {
    const { name, email, password, university } = req.body;

    const exists = await User.findOne({ email: email?.toLowerCase() });
    if (exists) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const user = await User.create({ name, email, password, university });
    const token = signToken(user._id);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        university: user.university,
      },
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const first = Object.values(err.errors)[0];
      return res.status(400).json({ message: first.message });
    }
    res.status(500).json({ message: 'Registration failed. Try again.' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = signToken(user._id);
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        university: user.university,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed. Try again.' });
  }
}

async function me(req, res) {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      university: req.user.university,
    },
  });
}

async function wipeUserData(userId, session) {
  const query = Application.find({ userId });
  const applications = session ? await query.session(session) : await query;

  for (const app of applications) {
    if (app.resumeFileId) await deleteFile(app.resumeFileId);
    if (app.coverLetterFileId) await deleteFile(app.coverLetterFileId);
  }

  const apps = Application.deleteMany({ userId });
  const notifications = Notification.deleteMany({ userId });
  const user = User.deleteOne({ _id: userId });
  if (session) {
    await apps.session(session);
    await notifications.session(session);
    await user.session(session);
  } else {
    await apps;
    await notifications;
    await user;
  }
}

/**
 * Account deletion uses a MongoDB multi-document transaction so applications
 * and GridFS files are removed together — or not at all (ACID).
 * Atlas / replica-set deployments use the transactional path. A standalone
 * local mongod falls back to the same deletes without a session.
 */
async function deleteAccount(req, res) {
  const userId = req.user._id;
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    await wipeUserData(userId, session);
    await session.commitTransaction();
    res.json({ message: 'Account and all linked applications were deleted.' });
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (_abortErr) {
      /* standalone mongod cannot abort a transaction that never started */
    }

    const standalone =
      /replica set|illegaloperation|transaction numbers/i.test(err.message || '') ||
      err.codeName === 'IllegalOperation';

    if (standalone) {
      try {
        await wipeUserData(userId);
        return res.json({ message: 'Account and all linked applications were deleted.' });
      } catch (_fallbackErr) {
        return res.status(500).json({ message: 'Account deletion failed. Nothing was removed.' });
      }
    }

    res.status(500).json({ message: 'Account deletion failed. Nothing was removed.' });
  } finally {
    session.endSession();
  }
}

module.exports = { register, login, me, deleteAccount };
