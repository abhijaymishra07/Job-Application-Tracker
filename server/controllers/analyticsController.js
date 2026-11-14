const Application = require('../models/Application');

/**
 * NoSQL Functionality 5 — Aggregation pipeline
 * All dashboard numbers are computed on MongoDB, not in Node after a full scan.
 */
async function getAnalytics(req, res) {
  try {
    const userId = req.user._id;
    const matchUser = { $match: { userId } };

    const [statusDistribution, monthlyVolume, conversion, totals] = await Promise.all([
      Application.aggregate([
        matchUser,
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { _id: 0, status: '$_id', count: 1 } },
      ]),

      Application.aggregate([
        matchUser,
        {
          $group: {
            _id: {
              year: { $year: '$appliedDate' },
              month: { $month: '$appliedDate' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        {
          $project: {
            _id: 0,
            year: '$_id.year',
            month: '$_id.month',
            count: 1,
            label: {
              $concat: [
                { $toString: '$_id.year' },
                '-',
                {
                  $cond: [
                    { $lt: ['$_id.month', 10] },
                    { $concat: ['0', { $toString: '$_id.month' }] },
                    { $toString: '$_id.month' },
                  ],
                },
              ],
            },
          },
        },
      ]),

      Application.aggregate([
        matchUser,
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            applied: {
              $sum: {
                $cond: [{ $in: ['$status', ['Applied', 'OA', 'Interview', 'Offer', 'Rejected']] }, 1, 0],
              },
            },
            interviews: {
              $sum: { $cond: [{ $in: ['$status', ['Interview', 'Offer']] }, 1, 0] },
            },
            offers: {
              $sum: { $cond: [{ $eq: ['$status', 'Offer'] }, 1, 0] },
            },
            rejected: {
              $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] },
            },
            oa: {
              $sum: { $cond: [{ $eq: ['$status', 'OA'] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            _id: 0,
            total: 1,
            applied: 1,
            interviews: 1,
            offers: 1,
            rejected: 1,
            oa: 1,
            interviewConversion: {
              $cond: [
                { $eq: ['$applied', 0] },
                0,
                { $round: [{ $multiply: [{ $divide: ['$interviews', '$applied'] }, 100] }, 1] },
              ],
            },
            offerConversion: {
              $cond: [
                { $eq: ['$interviews', 0] },
                0,
                { $round: [{ $multiply: [{ $divide: ['$offers', '$interviews'] }, 100] }, 1] },
              ],
            },
            responseRate: {
              $cond: [
                { $eq: ['$applied', 0] },
                0,
                {
                  $round: [
                    {
                      $multiply: [
                        {
                          $divide: [
                            { $add: ['$interviews', '$offers', '$rejected', '$oa'] },
                            '$applied',
                          ],
                        },
                        100,
                      ],
                    },
                    1,
                  ],
                },
              ],
            },
          },
        },
      ]),

      Application.aggregate([
        matchUser,
        { $count: 'total' },
      ]),
    ]);

    const summary = conversion[0] || {
      total: 0,
      applied: 0,
      interviews: 0,
      offers: 0,
      rejected: 0,
      oa: 0,
      interviewConversion: 0,
      offerConversion: 0,
      responseRate: 0,
    };

    res.json({
      summary,
      statusDistribution,
      monthlyVolume,
      totalDocuments: totals[0]?.total || 0,
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not compute analytics.' });
  }
}

module.exports = { getAnalytics };
