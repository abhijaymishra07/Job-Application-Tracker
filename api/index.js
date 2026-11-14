require('dotenv').config({ path: require('path').join(__dirname, '../server/.env') });

const app = require('../server/app');
const connectDB = require('../server/config/db');

let ready;

module.exports = async (req, res) => {
  try {
    ready = ready || connectDB();
    await ready;
    return app(req, res);
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        message:
          err.message ||
          'API failed to start. Set MONGO_URI (Atlas) and JWT_SECRET in the Vercel project env vars.',
      })
    );
  }
};
