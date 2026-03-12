const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        bookName: { type: String, required: true, trim: true },
        azureUrl: { type: String, required: true },
        category: {
            type: String,
            enum: ['Case Law', 'Statute', 'Contract', 'Regulation', 'Legal Opinion', 'Other'],
            default: 'Other',
        },
        summary: { type: String, default: '' },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        ingested: { type: Boolean, default: false },
        chunkCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

documentSchema.index({ bookName: 1, uploadedBy: 1 }, { unique: true });

module.exports = mongoose.model('Document', documentSchema);
