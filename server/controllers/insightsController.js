const Application = require('../models/Application');

const WAITING_STATUSES = ['Applied', 'OA'];
const RESPONSE_STATUSES = ['OA', 'Interview', 'Offer', 'Rejected'];

function monthStartUTC(date, offsetMonths = 0) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offsetMonths, 1));
}

/**
 * Review 2 · MongoDB 2 — $dateDiff + $setWindowFields.
 * Days waiting since the last status move, ranked inside each source, with
 * the source's average wait computed over the whole partition.
 */
async function ghosting(req, res) {
  try {
    const threshold = Math.min(90, Math.max(3, parseInt(req.query.days, 10) || 21));
    const userId = req.user._id;

    const [waiting, responseBySource] = await Promise.all([
      Application.aggregate([
        { $match: { userId, status: { $in: WAITING_STATUSES } } },
        {
          $addFields: {
            lastMove: { $ifNull: [{ $max: '$statusHistory.changedAt' }, '$appliedDate'] },
          },
        },
        {
          $addFields: {
            daysWaiting: { $dateDiff: { startDate: '$lastMove', endDate: '$$NOW', unit: 'day' } },
            daysSinceApplied: {
              $dateDiff: { startDate: '$appliedDate', endDate: '$$NOW', unit: 'day' },
            },
          },
        },
        {
          $setWindowFields: {
            partitionBy: '$source',
            sortBy: { daysWaiting: -1 },
            output: {
              rankInSource: { $rank: {} },
              sourceAvgWait: {
                $avg: '$daysWaiting',
                window: { documents: ['unbounded', 'unbounded'] },
              },
              waitingInSource: {
                $count: {},
                window: { documents: ['unbounded', 'unbounded'] },
              },
            },
          },
        },
        {
          $addFields: {
            hasUpcoming: { $gt: [{ $ifNull: ['$interviewDate', null] }, '$$NOW'] },
          },
        },
        {
          $addFields: {
            ghosted: { $and: [{ $gte: ['$daysWaiting', threshold] }, { $not: ['$hasUpcoming'] }] },
          },
        },
        { $sort: { daysWaiting: -1 } },
        {
          $project: {
            company: 1,
            role: 1,
            status: 1,
            source: 1,
            appliedDate: 1,
            followUpDate: 1,
            interviewDate: 1,
            hasUpcoming: 1,
            recruiterName: 1,
            recruiterEmail: 1,
            lastMove: 1,
            daysWaiting: 1,
            daysSinceApplied: 1,
            rankInSource: 1,
            waitingInSource: 1,
            sourceAvgWait: { $round: ['$sourceAvgWait', 1] },
            ghosted: 1,
          },
        },
      ]),

      Application.aggregate([
        { $match: { userId, status: { $ne: 'Saved' } } },
        {
          $addFields: {
            firstResponse: {
              $first: {
                $filter: {
                  input: '$statusHistory',
                  as: 'event',
                  cond: { $in: ['$$event.status', RESPONSE_STATUSES] },
                },
              },
            },
          },
        },
        {
          $addFields: {
            responseDays: {
              $cond: [
                { $ifNull: ['$firstResponse', false] },
                {
                  $dateDiff: {
                    startDate: '$appliedDate',
                    endDate: '$firstResponse.changedAt',
                    unit: 'day',
                  },
                },
                null,
              ],
            },
          },
        },
        {
          $group: {
            _id: '$source',
            applications: { $sum: 1 },
            responded: { $sum: { $cond: [{ $ne: ['$responseDays', null] }, 1, 0] } },
            avgResponseDays: { $avg: '$responseDays' },
          },
        },
        // sources with no replies yet sort last instead of first
        { $addFields: { sortKey: { $ifNull: ['$avgResponseDays', Number.MAX_SAFE_INTEGER] } } },
        {
          $setWindowFields: {
            sortBy: { sortKey: 1 },
            output: { speedRank: { $denseRank: {} } },
          },
        },
        {
          $project: {
            _id: 0,
            source: '$_id',
            applications: 1,
            responded: 1,
            responseRate: {
              $round: [{ $multiply: [{ $divide: ['$responded', '$applications'] }, 100] }, 0],
            },
            avgResponseDays: { $round: ['$avgResponseDays', 1] },
            speedRank: {
              $cond: [{ $eq: ['$avgResponseDays', null] }, null, '$speedRank'],
            },
            sortKey: 1,
          },
        },
        { $sort: { sortKey: 1, applications: -1 } },
        { $project: { sortKey: 0 } },
      ]),
    ]);

    res.json({
      threshold,
      waiting,
      ghostedCount: waiting.filter((w) => w.ghosted).length,
      responseBySource,
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not compute response times.' });
  }
}

/**
 * Review 2 · MongoDB 6 — $densify + $fill.
 * $group alone skips months with no applications; $densify inserts them and
 * $fill sets their counts to 0 so the trend line and rolling average are honest.
 */
async function trend(req, res) {
  try {
    const months = Math.min(24, Math.max(3, parseInt(req.query.months, 10) || 12));
    const now = new Date();
    const lower = monthStartUTC(now, -(months - 1));
    const upper = monthStartUTC(now, 1);

    const series = await Application.aggregate([
      {
        $match: {
          userId: req.user._id,
          status: { $ne: 'Saved' },
          appliedDate: { $gte: lower, $lt: upper },
        },
      },
      {
        $group: {
          _id: { $dateTrunc: { date: '$appliedDate', unit: 'month' } },
          count: { $sum: 1 },
          offers: { $sum: { $cond: [{ $eq: ['$status', 'Offer'] }, 1, 0] } },
        },
      },
      { $project: { _id: 0, month: '$_id', count: 1, offers: 1 } },
      {
        $densify: {
          field: 'month',
          range: { step: 1, unit: 'month', bounds: [lower, upper] },
        },
      },
      { $addFields: { filled: { $eq: [{ $ifNull: ['$count', null] }, null] } } },
      { $fill: { output: { count: { value: 0 }, offers: { value: 0 } } } },
      {
        $setWindowFields: {
          sortBy: { month: 1 },
          output: {
            rollingAvg: { $avg: '$count', window: { documents: [-2, 'current'] } },
            cumulative: { $sum: '$count', window: { documents: ['unbounded', 'current'] } },
          },
        },
      },
      {
        $project: {
          month: 1,
          label: { $dateToString: { date: '$month', format: '%Y-%m' } },
          count: 1,
          offers: 1,
          filled: 1,
          rollingAvg: { $round: ['$rollingAvg', 1] },
          cumulative: 1,
        },
      },
    ]);

    res.json({
      months,
      series,
      emptyMonths: series.filter((point) => point.filled).length,
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not compute the application trend.' });
  }
}

/**
 * Offer comparison — $setWindowFields $rank over stipend plus $dateDiff to
 * the reply deadline, so the student sees the trade-off in one table.
 */
async function offers(req, res) {
  try {
    const rows = await Application.aggregate([
      { $match: { userId: req.user._id, status: 'Offer' } },
      {
        $addFields: {
          stipend: { $ifNull: ['$salary', 0] },
          offerEvent: {
            $first: {
              $filter: {
                input: '$statusHistory',
                as: 'event',
                cond: { $eq: ['$$event.status', 'Offer'] },
              },
            },
          },
          roundsPassed: {
            $size: {
              $filter: {
                input: { $ifNull: ['$rounds', []] },
                as: 'round',
                cond: { $eq: ['$$round.result', 'Passed'] },
              },
            },
          },
          roundsTotal: { $size: { $ifNull: ['$rounds', []] } },
        },
      },
      {
        $addFields: {
          daysToDecide: {
            $cond: [
              { $ifNull: ['$offerDeadline', false] },
              { $dateDiff: { startDate: '$$NOW', endDate: '$offerDeadline', unit: 'day' } },
              null,
            ],
          },
          daysToOffer: {
            $cond: [
              { $ifNull: ['$offerEvent', false] },
              { $dateDiff: { startDate: '$appliedDate', endDate: '$offerEvent.changedAt', unit: 'day' } },
              null,
            ],
          },
        },
      },
      {
        $setWindowFields: {
          sortBy: { stipend: -1 },
          output: {
            stipendRank: { $rank: {} },
            bestStipend: { $max: '$stipend', window: { documents: ['unbounded', 'unbounded'] } },
          },
        },
      },
      {
        $project: {
          company: 1,
          role: 1,
          location: 1,
          source: 1,
          stipend: 1,
          stipendRank: 1,
          gapToBest: { $subtract: ['$bestStipend', '$stipend'] },
          offerDeadline: 1,
          daysToDecide: 1,
          daysToOffer: 1,
          roundsPassed: 1,
          roundsTotal: 1,
          tags: 1,
          customFields: 1,
        },
      },
    ]);

    const fieldNames = [
      ...new Set(rows.flatMap((row) => Object.keys(row.customFields || {}))),
    ].sort();

    res.json({ offers: rows, fieldNames });
  } catch (err) {
    res.status(500).json({ message: 'Could not compare offers.' });
  }
}

module.exports = { ghosting, trend, offers };
