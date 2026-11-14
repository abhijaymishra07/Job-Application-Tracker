const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

const BUCKET_NAME = 'documents';

function getBucket() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB is not connected');
  }
  return new GridFSBucket(mongoose.connection.db, { bucketName: BUCKET_NAME });
}

function uploadBuffer({ buffer, filename, contentType, metadata }) {
  const bucket = getBucket();

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      contentType,
      metadata,
    });

    uploadStream.on('error', reject);
    uploadStream.on('finish', () => resolve(uploadStream.id));
    uploadStream.end(buffer);
  });
}

async function deleteFile(fileId) {
  if (!fileId) return;
  const bucket = getBucket();
  try {
    await bucket.delete(fileId);
  } catch (err) {
    if (err.code !== 'ENOENT' && err.message !== 'File not found') {
      throw err;
    }
  }
}

function openDownloadStream(fileId) {
  return getBucket().openDownloadStream(fileId);
}

async function findFile(fileId) {
  const bucket = getBucket();
  const files = await bucket.find({ _id: fileId }).toArray();
  return files[0] || null;
}

module.exports = {
  BUCKET_NAME,
  getBucket,
  uploadBuffer,
  deleteFile,
  openDownloadStream,
  findFile,
};
