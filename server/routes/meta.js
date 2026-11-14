const mongoose = require('mongoose');
const express = require('express');
const { protect } = require('../middleware/auth');
const Application = require('../models/Application');
const { BUCKET_NAME } = require('../config/gridfs');

const router = express.Router();
router.use(protect);

router.get('/', async (_req, res) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const applicationIndexes = await Application.collection.indexes();
    const gridFsCollections = collections
      .map((c) => c.name)
      .filter((name) => name.startsWith(BUCKET_NAME));

    res.json({
      database: mongoose.connection.name,
      collections: collections.map((c) => c.name),
      applicationIndexes,
      gridFs: {
        bucketName: BUCKET_NAME,
        collections: gridFsCollections,
      },
      modeling: {
        usersCollection: 'users',
        applicationsCollection: 'applications',
        referenceField: 'userId',
        referenceType: 'ObjectId',
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not inspect MongoDB metadata.' });
  }
});

module.exports = router;
