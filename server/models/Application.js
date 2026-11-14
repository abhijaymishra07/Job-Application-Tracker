const mongoose = require('mongoose');

const STATUSES = ['Saved', 'Applied', 'OA', 'Interview', 'Offer', 'Rejected'];
const ACTIVE_STATUSES = ['Saved', 'Applied', 'OA', 'Interview', 'Offer'];
const SOURCES = ['LinkedIn', 'Naukri', 'Company Site', 'Referral', 'Campus', 'Other'];
const ROUND_TYPES = ['OA', 'Technical', 'Managerial', 'HR', 'Group Discussion', 'Other'];
const ROUND_RESULTS = ['Pending', 'Passed', 'Failed'];
const CUSTOM_FIELD_LIMIT = 20;

// Review 2 · MongoDB 1 — Embedded sub-documents (interview rounds live inside the application)
const roundSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Round name is required'],
      trim: true,
      maxlength: [80, 'Round name cannot exceed 80 characters'],
    },
    type: {
      type: String,
      enum: { values: ROUND_TYPES, message: `Round type must be one of: ${ROUND_TYPES.join(', ')}` },
      default: 'Technical',
    },
    scheduledAt: { type: Date, default: null },
    result: {
      type: String,
      enum: { values: ROUND_RESULTS, message: 'Round result must be Pending, Passed, or Failed' },
      default: 'Pending',
    },
    feedback: {
      type: String,
      trim: true,
      maxlength: [1000, 'Feedback cannot exceed 1000 characters'],
      default: '',
    },
  },
  { _id: true, timestamps: true }
);

const statusEventSchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUSES, required: true },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    // NoSQL Functionality 1 — Data modeling & referencing
    // Each application document stores a userId that references the Users collection.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Every application must belong to a user'],
      index: true,
    },
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      minlength: [2, 'Company name must be at least 2 characters'],
      maxlength: [120, 'Company name cannot exceed 120 characters'],
    },
    role: {
      type: String,
      required: [true, 'Role / position is required'],
      trim: true,
      maxlength: [120, 'Role cannot exceed 120 characters'],
    },
    // NoSQL Functionality 2 — Schema validation (enum + required + format)
    status: {
      type: String,
      enum: {
        values: STATUSES,
        message: 'Status must be one of: Saved, Applied, OA, Interview, Offer, Rejected',
      },
      default: 'Applied',
    },
    source: {
      type: String,
      enum: SOURCES,
      default: 'Other',
    },
    location: {
      type: String,
      trim: true,
      default: '',
    },
    jobUrl: {
      type: String,
      trim: true,
      validate: {
        validator(value) {
          if (!value) return true;
          return /^https?:\/\/.+/i.test(value);
        },
        message: 'Job URL must start with http:// or https://',
      },
    },
    salary: {
      type: Number,
      min: [0, 'Salary cannot be negative'],
      default: null,
    },
    appliedDate: {
      type: Date,
      default: Date.now,
    },
    interviewDate: {
      type: Date,
      default: null,
    },
    followUpDate: {
      type: Date,
      default: null,
    },
    recruiterName: {
      type: String,
      trim: true,
      default: '',
    },
    recruiterEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      validate: {
        validator(value) {
          if (!value) return true;
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        },
        message: 'Recruiter email is not valid',
      },
    },
    notes: {
      type: String,
      maxlength: [4000, 'Notes cannot exceed 4000 characters'],
      default: '',
    },
    resumeFileId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    resumeFilename: {
      type: String,
      default: '',
    },
    coverLetterFileId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    coverLetterFilename: {
      type: String,
      default: '',
    },
    offerDeadline: {
      type: Date,
      default: null,
    },
    rounds: {
      type: [roundSchema],
      default: [],
    },
    statusHistory: {
      type: [statusEventSchema],
      default: [],
    },
    // Review 2 · MongoDB 4 — Flexible schema: tags (multikey) + free-form custom fields (wildcard)
    tags: {
      type: [String],
      default: [],
      set: (values) =>
        [...new Set((values || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean))],
      validate: {
        validator: (values) => values.length <= 15 && values.every((t) => t.length <= 30),
        message: 'Use at most 15 tags, each up to 30 characters',
      },
    },
    customFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      validate: {
        validator(value) {
          if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
          const entries = Object.entries(value);
          if (entries.length > CUSTOM_FIELD_LIMIT) return false;
          return entries.every(
            ([key, v]) =>
              /^[A-Za-z][A-Za-z0-9 _-]{0,39}$/.test(key) &&
              ['string', 'number', 'boolean'].includes(typeof v) &&
              String(v).length <= 200
          );
        },
        message: `Custom fields: up to ${CUSTOM_FIELD_LIMIT} entries, names start with a letter (no "." or "$"), values are text, numbers, or yes/no`,
      },
    },
  },
  { timestamps: true, minimize: false }
);

applicationSchema.pre('validate', function seedHistory(next) {
  if (this.isNew && this.statusHistory.length === 0) {
    this.statusHistory = [{ status: this.status, changedAt: this.appliedDate || new Date() }];
  }
  next();
});

// NoSQL Functionality 4 — Single & compound indexes
applicationSchema.index({ userId: 1, status: 1 });
applicationSchema.index({ userId: 1, appliedDate: -1 });
applicationSchema.index({ userId: 1, interviewDate: 1 });

// NoSQL Functionality 6 — Text index for $text search on company + notes (+ role)
applicationSchema.index(
  { company: 'text', role: 'text', notes: 'text', recruiterName: 'text' },
  {
    name: 'application_text_search',
    weights: { company: 10, role: 5, recruiterName: 3, notes: 1 },
  }
);

// Review 2 · MongoDB 3 — Case-insensitive uniqueness for active applications
// strength 2 collation treats "google" and "Google" as equal; rejected rows are excluded.
applicationSchema.index(
  { userId: 1, company: 1, role: 1 },
  {
    name: 'unique_active_company_role',
    unique: true,
    collation: { locale: 'en', strength: 2 },
    partialFilterExpression: { status: { $in: ACTIVE_STATUSES } },
  }
);

// Review 2 · MongoDB 4 — Multikey index on the tags array, compound wildcard index on customFields
applicationSchema.index({ userId: 1, tags: 1 }, { name: 'user_tags_multikey' });
applicationSchema.index({ userId: 1, 'customFields.$**': 1 }, { name: 'user_custom_fields_wildcard' });

applicationSchema.statics.STATUSES = STATUSES;
applicationSchema.statics.ACTIVE_STATUSES = ACTIVE_STATUSES;
applicationSchema.statics.SOURCES = SOURCES;
applicationSchema.statics.ROUND_TYPES = ROUND_TYPES;
applicationSchema.statics.ROUND_RESULTS = ROUND_RESULTS;
applicationSchema.statics.DUPLICATE_COLLATION = { locale: 'en', strength: 2 };

module.exports = mongoose.model('Application', applicationSchema);
