// server/src/routes/stats.js
import express from 'express';
import RequestLog from '../models/RequestLog.js';

const router = express.Router();

// Traffic for one key, bucketed by minute, for the last N minutes.
// GET /stats/traffic/:apiKey?minutes=15
router.get('/traffic/:apiKey', async (req, res) => {
  try {
    const { apiKey } = req.params;
    const minutes = Math.min(Number(req.query.minutes) || 15, 120);
    const since = new Date(Date.now() - minutes * 60 * 1000);

    const rows = await RequestLog.aggregate([
      { $match: { apiKey, timestamp: { $gte: since } } },
      {
        $group: {
          _id: {
            minute: {
              $dateTrunc: { date: '$timestamp', unit: 'minute' },
            },
          },
          allowed: {
            $sum: { $cond: [{ $eq: ['$allowed', true] }, 1, 0] },
          },
          rejected: {
            $sum: { $cond: [{ $eq: ['$allowed', false] }, 1, 0] },
          },
        },
      },
      { $sort: { '_id.minute': 1 } },
    ]);

    const data = rows.map((r) => ({
      time: r._id.minute,
      allowed: r.allowed,
      rejected: r.rejected,
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simple totals across all keys, for a top-of-dashboard summary.
// GET /stats/summary
router.get('/summary', async (req, res) => {
  try {
    const since = new Date(Date.now() - 60 * 60 * 1000); // last hour

    const rows = await RequestLog.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: null,
          allowed: { $sum: { $cond: [{ $eq: ['$allowed', true] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$allowed', false] }, 1, 0] } },
        },
      },
    ]);

    const result = rows[0] || { allowed: 0, rejected: 0 };
    res.json({ allowed: result.allowed, rejected: result.rejected });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;