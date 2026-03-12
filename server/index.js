const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const queryRoutes = require('./routes/query');
const historyRoutes = require('./routes/history');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/history', historyRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'LexAI Server' }));

mongoose
  .connect(process.env.MONGO_URI, { dbName: 'lexai' })
  .then(async () => {
    console.log(' MongoDB connected');
    try {
      const col = mongoose.connection.collection('documents');
      const indexes = await col.indexes();
      const oldIdx = indexes.find(i => i.key?.bookName && !i.key?.uploadedBy);
      if (oldIdx) {
        await col.dropIndex(oldIdx.name);
        console.log(' Dropped old global bookName index');
      }
    } catch (e) {}

    app.listen(process.env.PORT || 5000, () =>
      console.log(`Server running on port ${process.env.PORT || 5000}`)
    );
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
