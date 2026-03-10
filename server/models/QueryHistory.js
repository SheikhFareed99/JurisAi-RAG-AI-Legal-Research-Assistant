const mongoose = require('mongoose');

const sourceSchema = new mongoose.Schema({
    id: String,
    score: Number,
    text: String,
});

const queryHistorySchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        bookName: { type: String, required: true },
        documentTitle: { type: String, default: '' },
        query: { type: String, required: true },
        answer: { type: String, required: true },
        sources: [sourceSchema],
        topK: { type: Number, default: 5 },
    },
    { timestamps: true }
);

module.exports = mongoose.model('QueryHistory', queryHistorySchema);
