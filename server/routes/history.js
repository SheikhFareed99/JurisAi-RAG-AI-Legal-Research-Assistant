const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const QueryHistory = require('../models/QueryHistory');
const Document = require('../models/Document');
const mongoose = require('mongoose');

router.get('/', authMiddleware, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            QueryHistory.find({ userId: req.user.id })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            QueryHistory.countDocuments({ userId: req.user.id }),
        ]);

        res.json({ items, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/analytics/summary', authMiddleware, async (req, res) => {
    try {
        const userId = mongoose.Types.ObjectId.createFromHexString(req.user.id);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const [
            totalQueries,
            totalDocs,
            queriesPerDay,
            topDocuments,
            docsByCategory,
            recentActivity,
        ] = await Promise.all([
            QueryHistory.countDocuments({ userId: req.user.id }),

            Document.countDocuments({ uploadedBy: req.user.id }),

            QueryHistory.aggregate([
                { $match: { userId, createdAt: { $gte: thirtyDaysAgo } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]),

            QueryHistory.aggregate([
                { $match: { userId } },
                { $group: { _id: '$documentTitle', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 },
            ]),

            Document.aggregate([
                { $match: { uploadedBy: mongoose.Types.ObjectId.createFromHexString(req.user.id) } },
                { $group: { _id: '$category', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),

            QueryHistory.find({ userId: req.user.id })
                .sort({ createdAt: -1 })
                .limit(5)
                .select('query documentTitle createdAt'),
        ]);

        const estimatedTimeSaved = Math.round(totalQueries * 45);

        const queriesThisWeek = await QueryHistory.countDocuments({
            userId: req.user.id,
            createdAt: { $gte: sevenDaysAgo },
        });

        res.json({
            totalQueries,
            totalDocs,
            queriesPerDay,
            topDocuments,
            docsByCategory,
            recentActivity,
            estimatedTimeSaved,
            queriesThisWeek,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const entry = await QueryHistory.findOne({ _id: req.params.id, userId: req.user.id });
        if (!entry) return res.status(404).json({ message: 'Not found' });
        res.json(entry);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
