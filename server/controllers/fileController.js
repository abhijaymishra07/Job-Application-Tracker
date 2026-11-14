const Application = require('../models/Application');
const { uploadBuffer, deleteFile, openDownloadStream, findFile } = require('../config/gridfs');

const KINDS = new Set(['resume', 'coverLetter']);

async function attachFile(req, res) {
  try {
    const { kind } = req.params;
    if (!KINDS.has(kind)) {
      return res.status(400).json({ message: 'kind must be resume or coverLetter' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const application = await Application.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!application) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    const fileId = await uploadBuffer({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      contentType: req.file.mimetype,
      metadata: {
        userId: req.user._id,
        applicationId: application._id,
        kind,
      },
    });

    if (kind === 'resume') {
      if (application.resumeFileId) await deleteFile(application.resumeFileId);
      application.resumeFileId = fileId;
      application.resumeFilename = req.file.originalname;
    } else {
      if (application.coverLetterFileId) await deleteFile(application.coverLetterFileId);
      application.coverLetterFileId = fileId;
      application.coverLetterFilename = req.file.originalname;
    }

    await application.save();
    res.status(201).json({ application, fileId });
  } catch (err) {
    res.status(500).json({ message: err.message || 'File upload failed.' });
  }
}

async function downloadFile(req, res) {
  try {
    const { kind } = req.params;
    if (!KINDS.has(kind)) {
      return res.status(400).json({ message: 'kind must be resume or coverLetter' });
    }

    const application = await Application.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!application) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    const fileId = kind === 'resume' ? application.resumeFileId : application.coverLetterFileId;
    const filename =
      kind === 'resume' ? application.resumeFilename : application.coverLetterFilename;

    if (!fileId) {
      return res.status(404).json({ message: 'No file attached for this slot.' });
    }

    const file = await findFile(fileId);
    if (!file) {
      return res.status(404).json({ message: 'File is missing from GridFS.' });
    }

    res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename || file.filename}"`);

    const stream = openDownloadStream(fileId);
    stream.on('error', () => {
      if (!res.headersSent) res.status(500).json({ message: 'Download failed.' });
    });
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ message: 'Download failed.' });
  }
}

async function removeFile(req, res) {
  try {
    const { kind } = req.params;
    if (!KINDS.has(kind)) {
      return res.status(400).json({ message: 'kind must be resume or coverLetter' });
    }

    const application = await Application.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!application) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    if (kind === 'resume' && application.resumeFileId) {
      await deleteFile(application.resumeFileId);
      application.resumeFileId = null;
      application.resumeFilename = '';
    }

    if (kind === 'coverLetter' && application.coverLetterFileId) {
      await deleteFile(application.coverLetterFileId);
      application.coverLetterFileId = null;
      application.coverLetterFilename = '';
    }

    await application.save();
    res.json({ application });
  } catch (err) {
    res.status(500).json({ message: 'Could not remove file.' });
  }
}

module.exports = { attachFile, downloadFile, removeFile };
