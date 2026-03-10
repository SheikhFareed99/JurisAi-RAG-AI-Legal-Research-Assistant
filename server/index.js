const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const queryRoutes = require('./routes/query');
const historyRoutes = require('./routes/history');

const app = express();

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'], credentials: true }));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/history', historyRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'LexAI Server' }));

// Connect to MongoDB and start server
mongoose
  .connect(process.env.MONGO_URI, { dbName: 'lexai' })
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(process.env.PORT || 5000, () =>
      console.log(`🚀 LexAI server running on port ${process.env.PORT || 5000}`)
    );
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
