const Application = require('../models/Application');
const { buildListFilter } = require('./applicationController');

const COLUMNS = [
  'company',
  'role',
  'status',
  'source',
  'location',
  'jobUrl',
  'salary',
  'appliedDate',
  'interviewDate',
  'followUpDate',
  'offerDeadline',
  'recruiterName',
  'recruiterEmail',
  'tags',
  'notes',
];
const DATE_COLUMNS = new Set(['appliedDate', 'interviewDate', 'followUpDate', 'offerDeadline']);
const MAX_IMPORT_ROWS = 500;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function normaliseHeader(header) {
  const key = header.trim().replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z]/g, '');
  return COLUMNS.find((col) => col.toLowerCase() === key) || null;
}

function rowToDocument(headers, values, userId) {
  const doc = { userId };
  headers.forEach((column, index) => {
    if (!column) return;
    const raw = (values[index] ?? '').trim();
    if (raw === '') return;
    if (column === 'salary') doc.salary = Number(raw);
    else if (column === 'tags') doc.tags = raw.split(/[;|]/);
    else if (DATE_COLUMNS.has(column)) doc[column] = new Date(raw);
    else doc[column] = raw;
  });
  return doc;
}

/**
 * CSV import: rows are validated individually, then written in one
 * insertMany({ ordered: false }) round trip. Rows that hit the
 * unique_active_company_role index are reported as duplicates, not failures.
 */
async function importApplications(req, res) {
  try {
    const text = String(req.body?.csv || '');
    const rows = parseCsv(text);
    if (rows.length < 2) {
      return res.status(400).json({ message: 'The CSV needs a header row and at least one application.' });
    }
    if (rows.length - 1 > MAX_IMPORT_ROWS) {
      return res.status(400).json({ message: `Import up to ${MAX_IMPORT_ROWS} rows at a time.` });
    }

    const headers = rows[0].map(normaliseHeader);
    if (!headers.includes('company') || !headers.includes('role')) {
      return res.status(400).json({ message: 'The CSV must include "company" and "role" columns.' });
    }

    const valid = [];
    const rejected = [];
    rows.slice(1).forEach((values, index) => {
      const doc = new Application(rowToDocument(headers, values, req.user._id));
      const error = doc.validateSync();
      if (error) {
        rejected.push({ row: index + 2, reason: Object.values(error.errors)[0].message });
      } else {
        valid.push({ row: index + 2, doc });
      }
    });

    let insertedCount = 0;
    const duplicates = [];

    if (valid.length) {
      try {
        const inserted = await Application.insertMany(
          valid.map((v) => v.doc),
          { ordered: false }
        );
        insertedCount = inserted.length;
      } catch (err) {
        const writeErrors = err.writeErrors || [];
        if (!writeErrors.length) throw err;
        insertedCount = err.insertedDocs?.length ?? err.result?.insertedCount ?? 0;
        writeErrors.forEach((we) => {
          const source = valid[we.index ?? we.err?.index];
          const entry = {
            row: source?.row,
            company: source?.doc.company,
            role: source?.doc.role,
          };
          if ((we.code ?? we.err?.code) === 11000) duplicates.push(entry);
          else rejected.push({ ...entry, reason: we.errmsg || we.err?.errmsg || 'Write failed' });
        });
      }
    }

    res.status(201).json({
      totalRows: rows.length - 1,
      inserted: insertedCount,
      duplicates,
      rejected,
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not import this CSV.' });
  }
}

/**
 * CSV export streams a MongoDB cursor straight into the response, so memory
 * stays flat however many applications the user has.
 */
async function exportApplications(req, res) {
  try {
    const filter = buildListFilter(req);
    const fields = COLUMNS.join(' ');
    const stamp = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="applications-${stamp}.csv"`);
    res.write(`${COLUMNS.join(',')}\n`);

    const cursor = Application.find(filter).select(fields).sort({ appliedDate: -1 }).lean().cursor();
    for await (const app of cursor) {
      const line = COLUMNS.map((col) =>
        csvCell(col === 'tags' ? (app.tags || []).join(';') : app[col])
      ).join(',');
      res.write(`${line}\n`);
    }
    res.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ message: 'Could not export applications.' });
    else res.end();
  }
}

module.exports = { importApplications, exportApplications, parseCsv, COLUMNS };
