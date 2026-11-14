// Run: NODE_PATH=server/node_modules node report/review3/mongo_evidence.js
// Starts its own embedded replica set (same code path as the API), seeds the
// demo data, and records real MongoDB output for each Review 3 feature.
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/unused';
process.env.JWT_SECRET = 'evidence';

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../../server/config/db');
const Application = require('../../server/models/Application');
const User = require('../../server/models/User');

const OUT = path.join(__dirname, 'evidence.json');
const evidence = {};

function record(key, title, blocks) {
  evidence[key] = { title, blocks };
}

const pretty = (v) => JSON.stringify(v, null, 2);

(async () => {
  await connectDB();
  const db = mongoose.connection.db;
  const user = await User.findOne({ email: 'abhijaymishra07@gmail.com' });
  const userId = user._id;
  const apps = db.collection('applications');

  // 2.1 Embedded documents + array operators
  const amazon = await apps.findOne({ userId, company: 'Amazon' });
  const pushRes = await apps.updateOne(
    { _id: amazon._id },
    {
      $push: {
        rounds: {
          $each: [
            { _id: new mongoose.Types.ObjectId(), name: 'Online assessment', type: 'OA', scheduledAt: new Date(Date.now() + 4 * 864e5), result: 'Pending', feedback: '' },
            { _id: new mongoose.Types.ObjectId(), name: 'Recruiter call', type: 'HR', scheduledAt: new Date(Date.now() + 1 * 864e5), result: 'Pending', feedback: '' },
          ],
          $sort: { scheduledAt: 1 },
        },
      },
    }
  );
  const roundDoc = await apps.findOne({ _id: amazon._id });
  const setRes = await apps.updateOne(
    { _id: amazon._id },
    { $set: { 'rounds.$[r].result': 'Passed', 'rounds.$[r].feedback': 'Shortlisted for OA' } },
    { arrayFilters: [{ 'r._id': roundDoc.rounds[0]._id }] }
  );
  const historyRes = await apps.updateOne(
    { _id: amazon._id },
    { $push: { statusHistory: { $each: [{ status: 'OA', changedAt: new Date() }], $slice: -50 } }, $set: { status: 'OA' } }
  );
  const afterSet = await apps.findOne(
    { _id: amazon._id },
    { projection: { _id: 0, company: 1, status: 1, rounds: { name: 1, type: 1, result: 1, feedback: 1 }, statusHistory: 1 } }
  );
  record('embedded', 'Embedded rounds — $push ($each + $sort), arrayFilters, statusHistory', [
    ['db.applications.updateOne({ company: "Amazon" }, { $push: { rounds: { $each: [ { name: "Online assessment", scheduledAt: <in 4 days> }, { name: "Recruiter call", scheduledAt: <in 1 day> } ], $sort: { scheduledAt: 1 } } } })', pretty({ acknowledged: true, matchedCount: pushRes.matchedCount, modifiedCount: pushRes.modifiedCount })],
    ['db.applications.updateOne({ company: "Amazon" }, { $set: { "rounds.$[r].result": "Passed", "rounds.$[r].feedback": "Shortlisted for OA" } }, { arrayFilters: [ { "r._id": <recruiter call id> } ] })', pretty({ acknowledged: true, matchedCount: setRes.matchedCount, modifiedCount: setRes.modifiedCount })],
    ['db.applications.updateOne({ company: "Amazon" }, { $set: { status: "OA" }, $push: { statusHistory: { $each: [ { status: "OA", changedAt: new Date() } ], $slice: -50 } } })', pretty({ acknowledged: true, matchedCount: historyRes.matchedCount, modifiedCount: historyRes.modifiedCount })],
    ['db.applications.findOne({ company: "Amazon" }, { company: 1, status: 1, rounds: 1, statusHistory: 1 })', pretty(afterSet)],
  ]);

  // 2.2 $setWindowFields + $dateDiff
  const ghost = await apps.aggregate([
    { $match: { userId, status: { $in: ['Applied', 'OA'] } } },
    { $addFields: { lastMove: { $ifNull: [{ $max: '$statusHistory.changedAt' }, '$appliedDate'] } } },
    { $addFields: { daysWaiting: { $dateDiff: { startDate: '$lastMove', endDate: '$$NOW', unit: 'day' } } } },
    {
      $setWindowFields: {
        partitionBy: '$source',
        sortBy: { daysWaiting: -1 },
        output: {
          rankInSource: { $rank: {} },
          sourceAvgWait: { $avg: '$daysWaiting', window: { documents: ['unbounded', 'unbounded'] } },
        },
      },
    },
    { $sort: { daysWaiting: -1 } },
    { $project: { _id: 0, company: 1, status: 1, source: 1, daysWaiting: 1, rankInSource: 1, sourceAvgWait: { $round: ['$sourceAvgWait', 1] } } },
  ]).toArray();
  record('window', 'Window functions — $dateDiff + $setWindowFields ($rank, $avg per source)', [
    [`db.applications.aggregate([
  { $match: { status: { $in: ["Applied", "OA"] } } },
  { $addFields: { daysWaiting: { $dateDiff: { startDate: "$lastMove", endDate: "$$NOW", unit: "day" } } } },
  { $setWindowFields: { partitionBy: "$source", sortBy: { daysWaiting: -1 },
      output: { rankInSource: { $rank: {} },
                sourceAvgWait: { $avg: "$daysWaiting", window: { documents: ["unbounded", "unbounded"] } } } } },
  { $sort: { daysWaiting: -1 } }
])`, pretty(ghost)],
  ]);

  // 2.3 Collation-aware partial unique index
  const indexes = await apps.indexes();
  const uniqueIdx = indexes.find((i) => i.name === 'unique_active_company_role');
  let dupError;
  try {
    await apps.insertOne({ userId, company: 'GOOGLE', role: 'software engineer intern', status: 'Applied', appliedDate: new Date() });
  } catch (err) {
    dupError = `MongoServerError: ${err.message}`;
  }
  const allowed = await apps.insertOne({ userId, company: 'flipkart', role: 'sde intern', status: 'Applied', appliedDate: new Date() });
  const found = await apps
    .find({ userId, company: 'google', role: 'software engineer intern' }, { projection: { _id: 0, company: 1, role: 1, status: 1 } })
    .collation({ locale: 'en', strength: 2 })
    .toArray();
  await apps.deleteOne({ _id: allowed.insertedId });
  record('unique', 'Collation-aware partial unique index — unique_active_company_role', [
    ['db.applications.getIndexes().find(i => i.name === "unique_active_company_role")', pretty({ name: uniqueIdx.name, key: uniqueIdx.key, unique: uniqueIdx.unique, collation: { locale: uniqueIdx.collation.locale, strength: uniqueIdx.collation.strength }, partialFilterExpression: uniqueIdx.partialFilterExpression })],
    ['db.applications.insertOne({ company: "GOOGLE", role: "software engineer intern", status: "Applied" })', dupError],
    ['db.applications.insertOne({ company: "flipkart", role: "sde intern", status: "Applied" })   // earlier Flipkart row is Rejected', pretty({ acknowledged: allowed.acknowledged, insertedId: `ObjectId('${allowed.insertedId}')` })],
    ['db.applications.find({ company: "google", role: "software engineer intern" }).collation({ locale: "en", strength: 2 })', pretty(found)],
  ]);

  // 2.4 Multikey + wildcard
  const flexIdx = indexes
    .filter((i) => ['user_tags_multikey', 'user_custom_fields_wildcard'].includes(i.name))
    .map((i) => ({ name: i.name, key: i.key }));
  const byTag = await apps.find({ userId, tags: 'fintech' }, { projection: { _id: 0, company: 1, tags: 1 } }).toArray();
  const byField = await apps
    .find({ userId, 'customFields.CGPA cutoff': { $gte: 8 } }, { projection: { _id: 0, company: 1, customFields: 1 } })
    .toArray();
  const tagPlan = await apps.find({ userId, tags: 'fintech' }).explain('queryPlanner');
  const fieldPlan = await apps.find({ userId, 'customFields.CGPA cutoff': { $gte: 8 } }).explain('queryPlanner');
  const ix = (plan) => {
    let s = plan.queryPlanner.winningPlan.queryPlan || plan.queryPlanner.winningPlan;
    while (s && !s.indexName) s = s.inputStage;
    return { stage: s.stage, indexName: s.indexName, isMultiKey: s.isMultiKey };
  };
  record('flexible', 'Flexible schema — multikey index on tags, compound wildcard index on customFields', [
    ['db.applications.getIndexes()   // Review 3 flexible-schema indexes', pretty(flexIdx)],
    ['db.applications.find({ tags: "fintech" }, { company: 1, tags: 1 })', pretty(byTag)],
    ['db.applications.find({ "customFields.CGPA cutoff": { $gte: 8 } }, { company: 1, customFields: 1 })', pretty(byField)],
    ['.explain("queryPlanner") — index chosen for each query', pretty({ tagsQuery: ix(tagPlan), customFieldQuery: ix(fieldPlan) })],
  ]);

  // 2.5 Change streams
  const hello = await db.admin().command({ hello: 1 });
  await db.command({ collMod: 'applications', changeStreamPreAndPostImages: { enabled: true } });
  const collInfo = await db.listCollections({ name: 'applications' }).toArray();
  const stream = apps.watch([{ $match: { operationType: { $in: ['insert', 'update', 'delete'] } } }], {
    fullDocument: 'updateLookup',
    fullDocumentBeforeChange: 'whenAvailable',
  });
  const events = [];
  stream.on('change', (c) => events.push(c));
  await new Promise((r) => setTimeout(r, 600));
  const cred = await apps.findOne({ userId, company: 'CRED' });
  await apps.updateOne({ _id: cred._id }, { $set: { status: 'OA', updatedAt: new Date() } });
  const temp = await apps.insertOne({ userId, company: 'Notion', role: 'Product Engineer Intern', status: 'Applied', appliedDate: new Date() });
  await apps.deleteOne({ _id: temp.insertedId });
  await new Promise((r) => setTimeout(r, 1500));
  await stream.close();
  const summary = events.map((c) => {
    const base = { operationType: c.operationType, documentKey: { _id: `ObjectId('${c.documentKey._id}')` } };
    if (c.operationType === 'update') base.updateDescription = { updatedFields: Object.keys(c.updateDescription.updatedFields) };
    if (c.fullDocument) base.fullDocument = { company: c.fullDocument.company, status: c.fullDocument.status };
    if (c.fullDocumentBeforeChange) base.fullDocumentBeforeChange = { company: c.fullDocumentBeforeChange.company, status: c.fullDocumentBeforeChange.status };
    return base;
  });
  record('changestream', 'Change Streams — replica set, pre-images, live events', [
    ['db.hello()   // change streams require a replica set', pretty({ setName: hello.setName, isWritablePrimary: hello.isWritablePrimary, hosts: hello.hosts })],
    ['db.runCommand({ collMod: "applications", changeStreamPreAndPostImages: { enabled: true } })', pretty({ options: collInfo[0].options })],
    [`const cs = db.applications.watch([ { $match: { operationType: { $in: ["insert", "update", "delete"] } } } ],
  { fullDocument: "updateLookup", fullDocumentBeforeChange: "whenAvailable" })
// then: CRED status -> OA, insert Notion, delete Notion`, pretty(summary)],
  ]);
  await apps.updateOne({ _id: cred._id }, { $set: { status: 'Applied' } });

  // 2.6 $densify + $fill
  const now = new Date();
  const lower = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const upper = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const grouped = await apps.aggregate([
    { $match: { userId, status: { $ne: 'Saved' }, appliedDate: { $gte: lower, $lt: upper } } },
    { $group: { _id: { $dateToString: { date: { $dateTrunc: { date: '$appliedDate', unit: 'month' } }, format: '%Y-%m' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).toArray();
  const dense = await apps.aggregate([
    { $match: { userId, status: { $ne: 'Saved' }, appliedDate: { $gte: lower, $lt: upper } } },
    { $group: { _id: { $dateTrunc: { date: '$appliedDate', unit: 'month' } }, count: { $sum: 1 } } },
    { $project: { _id: 0, month: '$_id', count: 1 } },
    { $densify: { field: 'month', range: { step: 1, unit: 'month', bounds: [lower, upper] } } },
    { $addFields: { filled: { $eq: [{ $ifNull: ['$count', null] }, null] } } },
    { $fill: { output: { count: { value: 0 } } } },
    { $setWindowFields: { sortBy: { month: 1 }, output: { rollingAvg: { $avg: '$count', window: { documents: [-2, 'current'] } } } } },
    { $project: { month: { $dateToString: { date: '$month', format: '%Y-%m' } }, count: 1, filled: 1, rollingAvg: { $round: ['$rollingAvg', 1] } } },
  ]).toArray();
  record('densify', '$densify + $fill — empty months become explicit zeros', [
    ['db.applications.aggregate([ { $group: { _id: <month>, count: { $sum: 1 } } } ])   // $group alone skips empty months', grouped.map((g) => `{ _id: "${g._id}", count: ${g.count} }`).join('\n')],
    [`db.applications.aggregate([
  { $group: { _id: { $dateTrunc: { date: "$appliedDate", unit: "month" } }, count: { $sum: 1 } } },
  { $densify: { field: "month", range: { step: 1, unit: "month", bounds: [ <11 months ago>, <next month> ] } } },
  { $fill: { output: { count: { value: 0 } } } },
  { $setWindowFields: { sortBy: { month: 1 }, output: { rollingAvg: { $avg: "$count", window: { documents: [-2, "current"] } } } } }
])`, dense.map((d) => `{ month: "${d.month}", count: ${d.count}, filled: ${d.filled}, rollingAvg: ${d.rollingAvg} }`).join('\n')],
  ]);

  // 2.7 explain executionStats
  const stats = (e) => {
    const s = e.executionStats;
    let stage = e.queryPlanner.winningPlan.queryPlan || e.queryPlanner.winningPlan;
    const stages = [];
    let indexName = null;
    while (stage) {
      stages.push(stage.stage);
      if (stage.indexName) indexName = stage.indexName;
      stage = stage.inputStage;
    }
    return { winningPlan: stages.join(' -> '), indexName, nReturned: s.nReturned, totalKeysExamined: s.totalKeysExamined, totalDocsExamined: s.totalDocsExamined, executionTimeMillis: s.executionTimeMillis };
  };
  const withIndex = await apps.find({ userId, tags: 'fintech' }).explain('executionStats');
  const forcedScan = await apps.find({ userId, tags: 'fintech' }).hint({ $natural: 1 }).explain('executionStats');
  const dupIndex = await apps
    .find({ userId, company: 'google', role: 'software engineer intern', status: { $in: ['Saved', 'Applied', 'OA', 'Interview', 'Offer'] } })
    .collation({ locale: 'en', strength: 2 })
    .explain('executionStats');
  record('explain', 'explain("executionStats") — IXSCAN vs forced COLLSCAN', [
    ['db.applications.find({ userId: <me>, tags: "fintech" }).explain("executionStats")', pretty(stats(withIndex))],
    ['db.applications.find({ userId: <me>, tags: "fintech" }).hint({ $natural: 1 }).explain("executionStats")', pretty(stats(forcedScan))],
    ['db.applications.find({ company: "google", role: "software engineer intern", status: { $in: [active] } }).collation({ locale: "en", strength: 2 }).explain("executionStats")', pretty(stats(dupIndex))],
  ]);

  // Part 3
  const collections = (await db.listCollections().toArray()).map((c) => c.name).sort();
  const health = await (await fetch('http://127.0.0.1:5000/api/health').catch(() => null))?.json?.();
  record('stack', 'Local stack — replica set, collections, API health', [
    ['db.getCollectionNames()', pretty(collections)],
    ['db.hello().setName', JSON.stringify(hello.setName)],
    ['GET http://localhost:5000/api/health', pretty(health || { note: 'API not running' })],
  ]);

  fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2));
  console.log('wrote', OUT, Object.keys(evidence));
  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
