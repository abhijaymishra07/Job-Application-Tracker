const Application = require('../models/Application');
const Notification = require('../models/Notification');
const { userFromToken } = require('../middleware/auth');
const realtime = require('../config/realtime');

const DAY = 24 * 60 * 60 * 1000;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function buildReminders(userId) {
  const now = new Date();
  const today = startOfToday();
  const inTwoDays = new Date(now.getTime() + 2 * DAY);
  const inFiveDays = new Date(now.getTime() + 5 * DAY);

  const apps = await Application.find({
    userId,
    status: { $in: Application.ACTIVE_STATUSES },
    $or: [
      { followUpDate: { $ne: null, $lte: inTwoDays } },
      { interviewDate: { $gte: now, $lte: inTwoDays } },
      { offerDeadline: { $gte: today, $lte: inFiveDays } },
    ],
  })
    .select('company role status followUpDate interviewDate offerDeadline')
    .lean();

  const reminders = [];
  apps.forEach((app) => {
    if (app.followUpDate && app.followUpDate <= inTwoDays && app.status !== 'Offer') {
      const overdue = app.followUpDate < today;
      reminders.push({
        id: `${app._id}-followup`,
        applicationId: app._id,
        kind: overdue ? 'overdue' : 'followup',
        company: app.company,
        message: overdue
          ? `Follow-up with ${app.company} is overdue`
          : `Follow up with ${app.company} (${app.role})`,
        due: app.followUpDate,
      });
    }
    if (app.interviewDate && app.interviewDate >= now && app.interviewDate <= inTwoDays) {
      reminders.push({
        id: `${app._id}-interview`,
        applicationId: app._id,
        kind: 'interview',
        company: app.company,
        message: `${app.status === 'OA' ? 'Assessment' : 'Interview'} with ${app.company} is coming up`,
        due: app.interviewDate,
      });
    }
    if (app.offerDeadline && app.offerDeadline >= today && app.offerDeadline <= inFiveDays) {
      reminders.push({
        id: `${app._id}-offer`,
        applicationId: app._id,
        kind: 'offer',
        company: app.company,
        message: `Reply to the ${app.company} offer before the deadline`,
        due: app.offerDeadline,
      });
    }
  });

  return reminders.sort((a, b) => new Date(a.due) - new Date(b.due));
}

async function listNotifications(req, res) {
  try {
    const [reminders, activity, unread] = await Promise.all([
      buildReminders(req.user._id),
      Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(30).lean(),
      Notification.countDocuments({ userId: req.user._id, read: false }),
    ]);

    res.json({ reminders, activity, unread, live: realtime.getState() });
  } catch (err) {
    res.status(500).json({ message: 'Could not load notifications.' });
  }
}

async function markAllRead(req, res) {
  try {
    await Notification.updateMany({ userId: req.user._id, read: false }, { $set: { read: true } });
    res.json({ unread: 0 });
  } catch (err) {
    res.status(500).json({ message: 'Could not update notifications.' });
  }
}

/**
 * Server-sent events: EventSource cannot set an Authorization header, so the
 * JWT arrives as a query parameter on this one route.
 */
async function stream(req, res) {
  let user;
  try {
    user = await userFromToken(String(req.query.token || ''));
  } catch (_err) {
    user = null;
  }
  if (!user) return res.status(401).json({ message: 'Not authorized.' });

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write(`event: ready\ndata: ${JSON.stringify(realtime.getState())}\n\n`);

  realtime.addClient(user._id, res);
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    realtime.removeClient(user._id, res);
  });
}

module.exports = { listNotifications, markAllRead, stream };
