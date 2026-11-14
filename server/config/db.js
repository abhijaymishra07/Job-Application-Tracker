const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

let memoryServer;
let connecting;

function findCachedMongod() {
  const roots = [
    path.join(__dirname, '../../node_modules/.cache/mongodb-memory-server'),
    path.join(__dirname, '../node_modules/.cache/mongodb-memory-server'),
  ];

  for (const dir of roots) {
    if (!fs.existsSync(dir)) continue;
    const match = fs
      .readdirSync(dir)
      .find((name) => name.startsWith('mongod') && !name.endsWith('.downloading') && !name.endsWith('.tgz') && !name.endsWith('.lock'));
    if (match) return path.join(dir, match);
  }
  return null;
}

async function connectWithUri(uri, timeoutMs) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: timeoutMs });
}

// Single-node replica set: change streams and transactions do not run on a standalone mongod.
async function startEmbeddedMongo() {
  const { MongoMemoryReplSet } = require('mongodb-memory-server');
  console.log('No MongoDB on MONGO_URI — starting embedded MongoDB for local demo…');

  const cached = findCachedMongod();
  if (cached) {
    process.env.MONGOMS_SYSTEM_BINARY = cached;
    console.log(`Using cached mongod at ${cached}`);
  } else {
    console.log('(First run may download a MongoDB binary. Atlas/local mongod is still preferred for the viva.)');
  }

  memoryServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, dbName: 'job-tracker', storageEngine: 'wiredTiger' },
  });

  await connectWithUri(memoryServer.getUri('job-tracker'), 20000);
}

async function connectDB() {
  if (mongoose.connection.readyState === 1) return;
  if (connecting) return connecting;

  connecting = (async () => {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      throw new Error('MONGO_URI is not set. Copy server/.env.example to server/.env');
    }

    mongoose.set('strictQuery', true);

    const onVercel = Boolean(process.env.VERCEL);
    try {
      await connectWithUri(uri, onVercel ? 15000 : 2500);
    } catch (err) {
      if (onVercel) {
        throw new Error(
          'Could not connect to MongoDB Atlas. Check MONGO_URI and allow 0.0.0.0/0 in Atlas Network Access.'
        );
      }
      await startEmbeddedMongo();
    }

    const { host, name } = mongoose.connection;
    console.log(`MongoDB connected → ${host}/${name}`);

    const User = require('../models/User');
    const Application = require('../models/Application');
    const Notification = require('../models/Notification');
    await Promise.all([User.init(), Application.init(), Notification.init()]);

    const existing = await User.countDocuments();
    if (existing === 0) {
      const { seedDatabase } = require('../seed/seed');
      await seedDatabase();
    }
  })();

  try {
    await connecting;
  } finally {
    connecting = null;
  }
}

module.exports = connectDB;
