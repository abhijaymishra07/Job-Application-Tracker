require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');
const { startChangeStream } = require('./config/realtime');

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() =>
    startChangeStream().catch((err) => console.error('Live updates unavailable:', err.message))
  )
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
