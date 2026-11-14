const mongoose = require('mongoose');
const Application = require('../models/Application');
const Notification = require('../models/Notification');

const clients = new Map();
const state = { enabled: false, reason: 'Change stream not started' };
let stream = null;

function addClient(userId, res) {
  const key = String(userId);
  if (!clients.has(key)) clients.set(key, new Set());
  clients.get(key).add(res);
}

function removeClient(userId, res) {
  const key = String(userId);
  const set = clients.get(key);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clients.delete(key);
}

function publish(userId, event, payload) {
  const set = clients.get(String(userId));
  if (!set) return;
  const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  set.forEach((res) => res.write(frame));
}

function describe(change) {
  const doc = change.fullDocument || change.fullDocumentBeforeChange || {};
  const company = doc.company || 'An application';

  if (change.operationType === 'insert') {
    return { kind: 'created', message: `Added ${company} — ${doc.role}` };
  }
  if (change.operationType === 'delete') {
    return { kind: 'deleted', message: `Deleted ${company}${doc.role ? ` — ${doc.role}` : ''}` };
  }
  if (change.operationType === 'replace') {
    return { kind: 'updated', message: `${company} was updated` };
  }

  const keys = Object.keys(change.updateDescription?.updatedFields || {}).concat(
    change.updateDescription?.removedFields || []
  );
  const meaningful = keys.filter((key) => key !== 'updatedAt');
  if (meaningful.length === 0) return null;

  if (meaningful.includes('status')) {
    return { kind: 'status', message: `${company} moved to ${doc.status}` };
  }
  if (meaningful.some((key) => key.startsWith('rounds'))) {
    return { kind: 'round', message: `Interview rounds updated for ${company}` };
  }
  if (meaningful.some((key) => /^(resume|coverLetter)/.test(key))) {
    return { kind: 'document', message: `Documents changed for ${company}` };
  }
  return { kind: 'updated', message: `${company} details edited` };
}

async function handleChange(change) {
  const doc = change.fullDocument || change.fullDocumentBeforeChange;
  if (!doc?.userId) return;

  const summary = describe(change);
  if (!summary) return;

  const notification = await Notification.create({
    userId: doc.userId,
    applicationId: change.documentKey?._id || null,
    company: doc.company || '',
    ...summary,
  });

  publish(doc.userId, 'activity', {
    notification: notification.toObject(),
    operation: change.operationType,
    applicationId: change.documentKey?._id,
  });
}

/**
 * Review 2 · MongoDB 5 — Change Streams.
 * The server subscribes to the applications collection's oplog-backed change
 * stream and pushes every insert / update / delete to that user's open tabs.
 * Pre-images let delete events still report which company was removed.
 */
async function startChangeStream() {
  const db = mongoose.connection.db;
  const hello = await db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    state.enabled = false;
    state.reason = 'MongoDB is running standalone; change streams need a replica set (Atlas or rs.initiate()).';
    console.log(`Live updates off: ${state.reason}`);
    return state;
  }

  try {
    await Application.createCollection();
    await db.command({
      collMod: Application.collection.collectionName,
      changeStreamPreAndPostImages: { enabled: true },
    });
  } catch (err) {
    console.log(`Change stream pre-images unavailable: ${err.message}`);
  }

  stream = Application.watch(
    [{ $match: { operationType: { $in: ['insert', 'update', 'replace', 'delete'] } } }],
    { fullDocument: 'updateLookup', fullDocumentBeforeChange: 'whenAvailable' }
  );

  stream.on('change', (change) => {
    handleChange(change).catch((err) => console.error('Change stream handler failed:', err.message));
  });
  stream.on('error', (err) => {
    state.enabled = false;
    state.reason = err.message;
    console.error('Change stream stopped:', err.message);
  });

  state.enabled = true;
  state.reason = `Watching ${Application.collection.collectionName} on replica set ${hello.setName || 'mongos'}`;
  console.log(`Live updates on: ${state.reason}`);
  return state;
}

function getState() {
  return { ...state, clients: [...clients.values()].reduce((n, set) => n + set.size, 0) };
}

module.exports = { startChangeStream, addClient, removeClient, publish, getState };
