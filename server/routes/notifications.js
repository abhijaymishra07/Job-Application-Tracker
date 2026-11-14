const express = require('express');
const { protect } = require('../middleware/auth');
const { listNotifications, markAllRead, stream } = require('../controllers/notificationController');

const router = express.Router();

router.get('/stream', stream);
router.get('/', protect, listNotifications);
router.post('/read', protect, markAllRead);

module.exports = router;
