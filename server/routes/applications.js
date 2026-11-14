const express = require('express');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  createApplication,
  listApplications,
  getApplication,
  updateApplication,
  deleteApplication,
  upcomingInterviews,
  pipelineBoard,
  findDuplicate,
  addRound,
  updateRound,
  deleteRound,
  explainQuery,
  listTags,
} = require('../controllers/applicationController');
const { attachFile, downloadFile, removeFile } = require('../controllers/fileController');
const { importApplications, exportApplications } = require('../controllers/transferController');

const router = express.Router();

router.use(protect);

router.get('/', listApplications);
router.post('/', createApplication);
router.get('/pipeline', pipelineBoard);
router.get('/upcoming', upcomingInterviews);
router.get('/duplicates', findDuplicate);
router.get('/explain', explainQuery);
router.get('/tags', listTags);
router.get('/export', exportApplications);
router.post('/import', importApplications);
router.get('/:id', getApplication);
router.patch('/:id', updateApplication);
router.delete('/:id', deleteApplication);

router.post('/:id/rounds', addRound);
router.patch('/:id/rounds/:roundId', updateRound);
router.delete('/:id/rounds/:roundId', deleteRound);

router.post('/:id/files/:kind', upload.single('file'), attachFile);
router.get('/:id/files/:kind', downloadFile);
router.delete('/:id/files/:kind', removeFile);

module.exports = router;
