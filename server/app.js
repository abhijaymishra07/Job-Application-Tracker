require('dotenv').config();

const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const applicationRoutes = require('./routes/applications');
const analyticsRoutes = require('./routes/analytics');
const metaRoutes = require('./routes/meta');
const insightsRoutes = require('./routes/insights');
const notificationRoutes = require('./routes/notifications');
const realtime = require('./config/realtime');

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: '4mb' }));

app.get('/api/health', (_req, res) => {
  const live = realtime.getState();
  res.json({
    ok: true,
    service: 'Job Application Tracker API',
    mongodb: 'connected',
    changeStreams: live.enabled,
    team: ['24BCE0768', '24BCE2016'],
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File is larger than 5 MB.' });
  }
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

module.exports = app;
