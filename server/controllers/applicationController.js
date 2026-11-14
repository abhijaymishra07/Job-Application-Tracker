const mongoose = require('mongoose');
const Application = require('../models/Application');
const { deleteFile } = require('../config/gridfs');

const PROTECTED_FIELDS = [
  'userId',
  '_id',
  'resumeFileId',
  'coverLetterFileId',
  'rounds',
  'statusHistory',
  'createdAt',
  'updatedAt',
];

function ownerFilter(userId) {
  return { userId };
}

function parsePagination(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  return { page, limit, skip: (page - 1) * limit };
}

function stripProtected(body) {
  const clean = { ...body };
  PROTECTED_FIELDS.forEach((key) => delete clean[key]);
  return clean;
}

function coerceFieldValue(raw) {
  const value = String(raw).trim();
  if (value === 'true' || value === 'yes') return true;
  if (value === 'false' || value === 'no') return false;
  if (value !== '' && !Number.isNaN(Number(value))) return Number(value);
  return value;
}

function sendError(res, err, fallback) {
  if (err.name === 'ValidationError') {
    const first = Object.values(err.errors)[0];
    return res.status(400).json({ message: first.message });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid value for ${err.path}.` });
  }
  if (err.code === 11000) {
    return res.status(409).json({
      code: 'DUPLICATE_APPLICATION',
      message: 'You already have an active application for this company and role.',
    });
  }
  return res.status(500).json({ message: fallback });
}

/**
 * Shared filter for the list, export, and explain endpoints so the query plan
 * shown in the UI is the plan of the exact query the board runs.
 */
function buildListFilter(req) {
  const { status, q, tag, field, value } = req.query;
  const filter = ownerFilter(req.user._id);

  if (status && status !== 'All') filter.status = status;
  if (tag && tag.trim()) filter.tags = tag.trim().toLowerCase();
  if (field && /^[A-Za-z][A-Za-z0-9 _-]{0,39}$/.test(field)) {
    filter[`customFields.${field}`] =
      value === undefined || value === '' ? { $exists: true } : coerceFieldValue(value);
  }
  if (q && q.trim()) filter.$text = { $search: q.trim() };

  return filter;
}

// NoSQL Functionality 3 — CREATE
async function createApplication(req, res) {
  try {
    const payload = { ...stripProtected(req.body), userId: req.user._id };
    const application = await Application.create(payload);
    res.status(201).json({ application });
  } catch (err) {
    sendError(res, err, 'Could not create application.');
  }
}

// NoSQL Functionality 3 — READ (list) + pagination + status/tag/custom-field filter + text search
async function listApplications(req, res) {
  try {
    const { page, limit, skip } = parsePagination(req);
    const { sort = '-appliedDate' } = req.query;
    const filter = buildListFilter(req);

    let query;
    let sortSpec;

    if (filter.$text) {
      // NoSQL Functionality 6 — $text search across company, role, notes
      query = Application.find(filter, { score: { $meta: 'textScore' } });
      sortSpec = { score: { $meta: 'textScore' } };
    } else {
      query = Application.find(filter);
      sortSpec = sort;
    }

    const [applications, total] = await Promise.all([
      query.sort(sortSpec).skip(skip).limit(limit).lean(),
      Application.countDocuments(filter),
    ]);

    res.json({
      applications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    sendError(res, err, 'Could not load applications.');
  }
}

// NoSQL Functionality 3 — READ (one)
async function getApplication(req, res) {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      ...ownerFilter(req.user._id),
    });

    if (!application) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    res.json({ application });
  } catch (err) {
    sendError(res, err, 'Could not load application.');
  }
}

// NoSQL Functionality 3 — UPDATE (+ status history on every status change)
async function updateApplication(req, res) {
  try {
    const changes = stripProtected(req.body);
    const filter = { _id: req.params.id, ...ownerFilter(req.user._id) };

    const current = await Application.findOne(filter).select('status').lean();
    if (!current) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    const update = { $set: changes };
    if (changes.status && changes.status !== current.status) {
      update.$push = {
        statusHistory: {
          $each: [{ status: changes.status, changedAt: new Date() }],
          $slice: -50,
        },
      };
    }

    const application = await Application.findOneAndUpdate(filter, update, {
      new: true,
      runValidators: true,
    });

    res.json({ application });
  } catch (err) {
    sendError(res, err, 'Could not update application.');
  }
}

// NoSQL Functionality 3 — DELETE
async function deleteApplication(req, res) {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      ...ownerFilter(req.user._id),
    });

    if (!application) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    if (application.resumeFileId) await deleteFile(application.resumeFileId);
    if (application.coverLetterFileId) await deleteFile(application.coverLetterFileId);

    await application.deleteOne();
    res.json({ message: 'Application deleted.' });
  } catch (err) {
    sendError(res, err, 'Could not delete application.');
  }
}

/**
 * Date & time querying — interviews whose interviewDate falls in [now, now+days].
 * Uses the compound index { userId: 1, interviewDate: 1 }.
 */
async function upcomingInterviews(req, res) {
  try {
    const days = Math.min(30, Math.max(1, parseInt(req.query.days, 10) || 7));
    const now = new Date();
    const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const interviews = await Application.find({
      userId: req.user._id,
      interviewDate: { $gte: now, $lte: until },
      status: { $in: ['OA', 'Interview'] },
    })
      .sort({ interviewDate: 1 })
      .lean();

    res.json({ days, from: now, until, interviews });
  } catch (err) {
    res.status(500).json({ message: 'Could not load upcoming interviews.' });
  }
}

async function pipelineBoard(req, res) {
  try {
    const applications = await Application.find(ownerFilter(req.user._id))
      .sort({ updatedAt: -1 })
      .lean();

    const columns = {};
    Application.STATUSES.forEach((status) => {
      columns[status] = [];
    });
    applications.forEach((app) => {
      if (columns[app.status]) columns[app.status].push(app);
    });

    res.json({ columns, statuses: Application.STATUSES });
  } catch (err) {
    res.status(500).json({ message: 'Could not load pipeline.' });
  }
}

/**
 * Review 2 · MongoDB 3 — duplicate lookup served by the collation-aware
 * unique index, so "google / sde intern" finds "Google / SDE Intern".
 */
async function findDuplicate(req, res) {
  try {
    const company = String(req.query.company || '').trim();
    const role = String(req.query.role || '').trim();
    if (company.length < 2 || !role) return res.json({ duplicate: null });

    const filter = {
      userId: req.user._id,
      company,
      role,
      status: { $in: Application.ACTIVE_STATUSES },
    };
    if (req.query.excludeId && isValidId(req.query.excludeId)) {
      filter._id = { $ne: req.query.excludeId };
    }

    const duplicate = await Application.findOne(filter)
      .collation(Application.DUPLICATE_COLLATION)
      .select('company role status appliedDate')
      .lean();

    res.json({ duplicate });
  } catch (err) {
    res.status(500).json({ message: 'Could not check for duplicates.' });
  }
}

/**
 * Review 2 · MongoDB 1 — embedded interview rounds updated in place with
 * $push ($each + $sort), arrayFilters, and $pull.
 */
async function addRound(req, res) {
  try {
    const { name, type, scheduledAt, result, feedback } = req.body;
    const round = { name, type, scheduledAt: scheduledAt || null, result, feedback };

    const application = await Application.findOneAndUpdate(
      { _id: req.params.id, ...ownerFilter(req.user._id) },
      { $push: { rounds: { $each: [round], $sort: { scheduledAt: 1 } } } },
      { new: true, runValidators: true }
    );

    if (!application) return res.status(404).json({ message: 'Application not found.' });
    res.status(201).json({ application });
  } catch (err) {
    sendError(res, err, 'Could not add interview round.');
  }
}

async function updateRound(req, res) {
  try {
    if (!isValidId(req.params.roundId)) {
      return res.status(400).json({ message: 'Invalid round id.' });
    }

    const allowed = ['name', 'type', 'scheduledAt', 'result', 'feedback'];
    const $set = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) $set[`rounds.$[round].${key}`] = req.body[key];
    });
    if (Object.keys($set).length === 0) {
      return res.status(400).json({ message: 'Nothing to update.' });
    }
    $set['rounds.$[round].updatedAt'] = new Date();

    const application = await Application.findOneAndUpdate(
      {
        _id: req.params.id,
        ...ownerFilter(req.user._id),
        'rounds._id': req.params.roundId,
      },
      { $set },
      {
        new: true,
        runValidators: true,
        arrayFilters: [{ 'round._id': new mongoose.Types.ObjectId(req.params.roundId) }],
      }
    );

    if (!application) return res.status(404).json({ message: 'Round not found.' });
    res.json({ application });
  } catch (err) {
    sendError(res, err, 'Could not update interview round.');
  }
}

async function deleteRound(req, res) {
  try {
    if (!isValidId(req.params.roundId)) {
      return res.status(400).json({ message: 'Invalid round id.' });
    }

    const application = await Application.findOneAndUpdate(
      {
        _id: req.params.id,
        ...ownerFilter(req.user._id),
        'rounds._id': req.params.roundId,
      },
      { $pull: { rounds: { _id: req.params.roundId } } },
      { new: true }
    );

    if (!application) return res.status(404).json({ message: 'Round not found.' });
    res.json({ application });
  } catch (err) {
    sendError(res, err, 'Could not delete interview round.');
  }
}

function summarizePlan(explained) {
  const stats = explained.executionStats || {};
  const stages = [];
  let indexName = null;

  (function walk(stage) {
    if (!stage) return;
    stages.push(stage.stage);
    if (stage.indexName && !indexName) indexName = stage.indexName;
    if (stage.inputStage) walk(stage.inputStage);
    (stage.inputStages || []).forEach(walk);
  })(explained.queryPlanner?.winningPlan?.queryPlan || explained.queryPlanner?.winningPlan);

  return {
    stages,
    indexName,
    usesIndex: stages.includes('IXSCAN') || stages.includes('TEXT_MATCH') || stages.includes('TEXT'),
    nReturned: stats.nReturned ?? 0,
    totalKeysExamined: stats.totalKeysExamined ?? 0,
    totalDocsExamined: stats.totalDocsExamined ?? 0,
    executionTimeMillis: stats.executionTimeMillis ?? 0,
  };
}

/**
 * Review 2 · MongoDB 7 — explain("executionStats") for the board's current
 * query, next to the same query forced into a collection scan.
 */
async function explainQuery(req, res) {
  try {
    const filter = buildListFilter(req);

    const indexed = await Application.find(filter).explain('executionStats');
    const plan = summarizePlan(Array.isArray(indexed) ? indexed[0] : indexed);

    let collectionScan = null;
    if (!filter.$text) {
      const scanned = await Application.find(filter).hint({ $natural: 1 }).explain('executionStats');
      collectionScan = summarizePlan(Array.isArray(scanned) ? scanned[0] : scanned);
    }

    const shownFilter = JSON.parse(JSON.stringify(filter));
    shownFilter.userId = '<you>';

    res.json({ filter: shownFilter, plan, collectionScan });
  } catch (err) {
    sendError(res, err, 'Could not explain this query.');
  }
}

async function listTags(req, res) {
  try {
    const [tags, fields] = await Promise.all([
      Application.distinct('tags', ownerFilter(req.user._id)),
      Application.aggregate([
        { $match: ownerFilter(req.user._id) },
        { $project: { kv: { $objectToArray: { $ifNull: ['$customFields', {}] } } } },
        { $unwind: '$kv' },
        { $group: { _id: '$kv.k' } },
        { $sort: { _id: 1 } },
      ]),
    ]);
    res.json({ tags: tags.sort(), fields: fields.map((f) => f._id) });
  } catch (err) {
    res.status(500).json({ message: 'Could not load tags.' });
  }
}

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

module.exports = {
  createApplication,
  listApplications,
  getApplication,
  updateApplication,
  deleteApplication,
  upcomingInterviews,
  pipelineBoard,
  findDuplicate,
  addRound,
  updateRound,
  deleteRound,
  explainQuery,
  listTags,
  buildListFilter,
  isValidId,
};
