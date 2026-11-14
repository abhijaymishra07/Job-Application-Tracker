import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import { SOURCES, STATUSES, StatusBadge, formatDate } from '../components/ui';

const empty = {
  company: '',
  role: '',
  status: 'Applied',
  source: 'Other',
  location: '',
  jobUrl: '',
  salary: '',
  appliedDate: new Date().toISOString().slice(0, 10),
  interviewDate: '',
  followUpDate: '',
  offerDeadline: '',
  recruiterName: '',
  recruiterEmail: '',
  notes: '',
  tags: '',
};

const FIELD_SUGGESTIONS = ['CGPA cutoff', 'Bond months', 'Work mode', 'PPO chance', 'Stack'];

function toDateInput(value) {
  return value ? value.slice(0, 10) : '';
}

function toFieldRows(customFields) {
  return Object.entries(customFields || {}).map(([key, value]) => ({ key, value: String(value) }));
}

function fromFieldRows(rows) {
  const out = {};
  rows.forEach(({ key, value }) => {
    const name = key.trim();
    if (!name) return;
    const text = value.trim();
    if (text === 'yes' || text === 'true') out[name] = true;
    else if (text === 'no' || text === 'false') out[name] = false;
    else if (text !== '' && !Number.isNaN(Number(text))) out[name] = Number(text);
    else out[name] = text;
  });
  return out;
}

export default function ApplicationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [fields, setFields] = useState([]);
  const [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState(null);
  const editing = Boolean(id);

  useEffect(() => {
    if (!editing) return;
    api.get(`/applications/${id}`).then(({ data }) => {
      const app = data.application;
      setForm({
        ...empty,
        ...app,
        salary: app.salary ?? '',
        appliedDate: toDateInput(app.appliedDate),
        interviewDate: toDateInput(app.interviewDate),
        followUpDate: toDateInput(app.followUpDate),
        offerDeadline: toDateInput(app.offerDeadline),
        tags: (app.tags || []).join(', '),
      });
      setFields(toFieldRows(app.customFields));
    });
  }, [editing, id]);

  useEffect(() => {
    const company = form.company.trim();
    const role = form.role.trim();
    if (company.length < 2 || !role || form.status === 'Rejected') {
      setDuplicate(null);
      return undefined;
    }
    const timer = setTimeout(async () => {
      const { data } = await api.get('/applications/duplicates', {
        params: { company, role, excludeId: id },
      });
      setDuplicate(data.duplicate);
    }, 350);
    return () => clearTimeout(timer);
  }, [form.company, form.role, form.status, id]);

  function update(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function updateField(index, key, value) {
    setFields((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    const payload = {
      ...form,
      salary: form.salary === '' ? null : Number(form.salary),
      interviewDate: form.interviewDate || null,
      followUpDate: form.followUpDate || null,
      offerDeadline: form.offerDeadline || null,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      customFields: fromFieldRows(fields),
    };

    try {
      if (editing) {
        await api.patch(`/applications/${id}`, payload);
        navigate(`/applications/${id}`);
      } else {
        const { data } = await api.post('/applications', payload);
        navigate(`/applications/${data.application._id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save this application. Check required fields and try again.');
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{editing ? 'Edit application' : 'New application'}</h1>
          <p>Add the company, role, and where you are in the process. You can update this anytime.</p>
        </div>
      </div>

      <form className="card form" onSubmit={onSubmit}>
        {error ? <div className="error full">{error}</div> : null}
        {duplicate ? (
          <div className="warning full">
            <b>You already applied here.</b> {duplicate.company} — {duplicate.role} is{' '}
            <StatusBadge status={duplicate.status} /> since {formatDate(duplicate.appliedDate)}.{' '}
            <Link to={`/applications/${duplicate._id}`}>Open the existing application</Link>
          </div>
        ) : null}
        <div>
          <label>Company *</label>
          <input name="company" value={form.company} onChange={update} required />
        </div>
        <div>
          <label>Role *</label>
          <input name="role" value={form.role} onChange={update} required />
        </div>
        <div>
          <label>Status</label>
          <select name="status" value={form.status} onChange={update}>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Source</label>
          <select name="source" value={form.source} onChange={update}>
            {SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Location</label>
          <input name="location" value={form.location} onChange={update} />
        </div>
        <div>
          <label>Job URL</label>
          <input name="jobUrl" value={form.jobUrl} onChange={update} placeholder="https://" />
        </div>
        <div>
          <label>Applied date</label>
          <input type="date" name="appliedDate" value={form.appliedDate} onChange={update} />
        </div>
        <div>
          <label>Interview / OA date</label>
          <input type="date" name="interviewDate" value={form.interviewDate} onChange={update} />
        </div>
        <div>
          <label>Follow-up date</label>
          <input type="date" name="followUpDate" value={form.followUpDate} onChange={update} />
        </div>
        <div>
          <label>Offer reply deadline</label>
          <input type="date" name="offerDeadline" value={form.offerDeadline} onChange={update} />
        </div>
        <div>
          <label>Salary (monthly intern stipend)</label>
          <input type="number" name="salary" value={form.salary} onChange={update} />
        </div>
        <div>
          <label>Tags (comma separated)</label>
          <input name="tags" value={form.tags} onChange={update} placeholder="dream, referral, remote" />
        </div>
        <div>
          <label>Recruiter name</label>
          <input name="recruiterName" value={form.recruiterName} onChange={update} />
        </div>
        <div>
          <label>Recruiter email</label>
          <input name="recruiterEmail" value={form.recruiterEmail} onChange={update} />
        </div>

        <div className="full custom-fields">
          <label>Custom fields — anything this company asks for</label>
          {fields.map((row, index) => (
            <div className="field-row" key={index}>
              <input
                list="field-suggestions"
                placeholder="Field name, e.g. CGPA cutoff"
                value={row.key}
                onChange={(e) => updateField(index, 'key', e.target.value)}
              />
              <input
                placeholder="Value, e.g. 8.0"
                value={row.value}
                onChange={(e) => updateField(index, 'value', e.target.value)}
              />
              <button
                className="btn ghost"
                type="button"
                onClick={() => setFields((prev) => prev.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          ))}
          <datalist id="field-suggestions">
            {FIELD_SUGGESTIONS.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <button
            className="btn secondary"
            type="button"
            onClick={() => setFields((prev) => [...prev, { key: '', value: '' }])}
          >
            Add custom field
          </button>
        </div>

        <div className="full">
          <label>Notes</label>
          <textarea name="notes" rows="4" value={form.notes} onChange={update} />
        </div>
        <div className="full">
          <button className="btn" type="submit">
            {editing ? 'Save changes' : 'Create application'}
          </button>
        </div>
      </form>
    </div>
  );
}
