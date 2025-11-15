// backend/index.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');

const app = express();
app.use(express.json());

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));

app.use(rateLimit({ windowMs: 60 * 1000, max: 200 }));

app.use('/auth', authRoutes);

// optional test route
app.get('/', (req, res) => res.json({ message: 'OTP auth backend running' }));

const PORT = process.env.PORT || 4000;
const MONGO = process.env.MONGO_URI;

if (MONGO) {
  mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
      console.log('MongoDB connected');
      app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
    })
    .catch(err => {
      console.error('Mongo connection error', err);
      process.exit(1);
    });
} else {
  app.listen(PORT, () => console.log(`Server listening on ${PORT} (no Mongo configured)`));
}
