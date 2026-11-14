const mongoose = require('mongoose');

const KINDS = ['created', 'status', 'round', 'document', 'updated', 'deleted'];

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    applicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      default: null,
    },
    kind: { type: String, enum: KINDS, required: true },
    company: { type: String, default: '' },
    message: { type: String, required: true, maxlength: 300 },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
