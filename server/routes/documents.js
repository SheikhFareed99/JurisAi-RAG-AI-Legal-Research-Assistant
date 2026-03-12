const router = require('express').Router();
const axios = require('axios');
const multer = require('multer');
const { BlobServiceClient } = require('@azure/storage-blob');
const path = require('path');
const authMiddleware = require('../middleware/auth');
const Document = require('../models/Document');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.docx', '.doc', '.txt', '.pptx'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error('Only PDF, DOCX, DOC, TXT, PPTX files are allowed'));
    },
});

async function uploadToAzure(buffer, originalName) {
    const blobServiceClient = BlobServiceClient.fromConnectionString(
        process.env.AZURE_CONNECTION_STRING
    );
    const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_CONTAINER);

    const ext = path.extname(originalName).toLowerCase();
    const blobName = `lexai-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: { blobContentType: 'application/pdf' },
    });

    return blockBlobClient.url;
}

router.get('/', authMiddleware, async (req, res) => {
    try {
        const docs = await Document.find({ uploadedBy: req.user.id }).sort({ createdAt: -1 });
        res.json(docs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        const { title, category, bookName } = req.body;

        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
        if (!title || !bookName) return res.status(400).json({ message: 'title and bookName are required' });

        const azureUrl = await uploadToAzure(req.file.buffer, req.file.originalname);
        const doc = await Document.create({
            title,
            bookName,
            azureUrl,
            category: category || 'Other',
            uploadedBy: req.user.id,
            ingested: false,
        });
        const namespace = `${req.user.id}_${bookName}`;
        axios
            .post(`${process.env.FASTAPI_URL}/ingest`, { url: azureUrl, book_name: namespace })
            .then(async (fastapiRes) => {
                const chunks = fastapiRes.data?.total_chunks || fastapiRes.data?.chunks_stored || 0;
                await Document.findByIdAndUpdate(doc._id, {
                    ingested: true,
                    chunkCount: chunks,
                    summary: `Ingested ${chunks} chunks successfully`,
                });
            })
            .catch((err) => {
                console.error('FastAPI ingestion error:', err.message);
            });

        res.status(201).json({ ...doc.toObject(), message: 'Uploaded and queued for indexing' });
    } catch (err) {
        if (err.code === 11000)
            return res.status(409).json({ message: 'A document with this book name already exists' });
        res.status(500).json({ message: err.message });
    }
});

router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const doc = await Document.findOneAndDelete({ _id: req.params.id, uploadedBy: req.user.id });
        if (!doc) return res.status(404).json({ message: 'Document not found' });
        res.json({ message: 'Document deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/stats', authMiddleware, async (req, res) => {
    try {
        const total = await Document.countDocuments({ uploadedBy: req.user.id });
        const ingested = await Document.countDocuments({ uploadedBy: req.user.id, ingested: true });
        const byCategory = await Document.aggregate([
            { $match: { uploadedBy: req.user.id } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
        ]);
        res.json({ total, ingested, byCategory });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
