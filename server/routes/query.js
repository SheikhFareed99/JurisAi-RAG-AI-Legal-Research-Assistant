const router = require('express').Router();
const axios = require('axios');
const authMiddleware = require('../middleware/auth');
const QueryHistory = require('../models/QueryHistory');
const Document = require('../models/Document');

router.post('/', authMiddleware, async (req, res) => {
    try {
        const { bookName, query, topK = 5 } = req.body;
        if (!bookName || !query)
            return res.status(400).json({ message: 'bookName and query are required' });

        const doc = await Document.findOne({ bookName, uploadedBy: req.user.id });

        const namespace = `${req.user.id}_${bookName}`;
        const fastapiRes = await axios.post(`${process.env.FASTAPI_URL}/query`, {
            book_name: namespace,
            query,
            top_k: topK,
        });

        const { answer, sources } = fastapiRes.data;

        const history = await QueryHistory.create({
            userId: req.user.id,
            bookName,
            documentTitle: doc?.title || bookName,
            query,
            answer,
            sources: sources || [],
            topK,
        });

        res.json({
            id: history._id,
            query,
            answer,
            sources: sources || [],
            documentTitle: doc?.title || bookName,
            bookName,
            createdAt: history.createdAt,
        });
    } catch (err) {
        if (err.response) {
            return res.status(err.response.status).json({
                message: err.response.data?.detail || 'RAG backend error',
            });
        }
        if (err.code === 'ECONNREFUSED') {
            return res.status(503).json({ message: 'AI backend is offline. Please ensure FastAPI is running.' });
        }
        res.status(500).json({ message: err.message });
    }
});

router.get('/stream', authMiddleware, async (req, res) => {
    const { bookName, query, topK = 5 } = req.query;
    if (!bookName || !query)
        return res.status(400).json({ message: 'bookName and query are required' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let fullAnswer = '';
    let sources = [];

    try {
        const doc = await Document.findOne({ bookName, uploadedBy: req.user.id });

        const namespace = `${req.user.id}_${bookName}`;
        const fastapiRes = await axios.post(
            `${process.env.FASTAPI_URL}/query/stream`,
            { book_name: namespace, query, top_k: Number(topK) },
            { responseType: 'stream' }
        );

        fastapiRes.data.on('data', (chunk) => {
            const raw = chunk.toString();
            res.write(raw);

            const lines = raw.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const parsed = JSON.parse(line.slice(6));
                        if (parsed.type === 'token') fullAnswer += parsed.content;
                        if (parsed.type === 'sources') sources = parsed.sources;
                    } catch { }
                }
            }
        });

        fastapiRes.data.on('end', async () => {
            try {
                if (fullAnswer) {
                    await QueryHistory.create({
                        userId: req.user.id,
                        bookName,
                        documentTitle: doc?.title || bookName,
                        query,
                        answer: fullAnswer,
                        sources,
                        topK: Number(topK),
                    });
                }
            } catch (e) {
                console.error('History save error:', e.message);
            }
            res.end();
        });

        fastapiRes.data.on('error', (err) => {
            res.write(`data: ${JSON.stringify({ type: 'error', content: err.message })}\n\n`);
            res.end();
        });

        req.on('close', () => fastapiRes.data.destroy());

    } catch (err) {
        const msg = err.code === 'ECONNREFUSED' ? 'AI backend is offline.' : err.message;
        res.write(`data: ${JSON.stringify({ type: 'error', content: msg })}\n\n`);
        res.end();
    }
});

module.exports = router;
