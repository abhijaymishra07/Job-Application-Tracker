const express = require('express');
const { protect } = require('../middleware/auth');
const { ghosting, trend, offers } = require('../controllers/insightsController');

const router = express.Router();
router.use(protect);

router.get('/ghosting', ghosting);
router.get('/trend', trend);
router.get('/offers', offers);

module.exports = router;
