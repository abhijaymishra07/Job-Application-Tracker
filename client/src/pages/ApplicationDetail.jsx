import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { downloadApplicationFile } from '../api';
import {
  ROUND_RESULTS,
  ROUND_TYPES,
  STATUSES,
  StatusBadge,
  TagList,
  formatDate,
  formatDateTime,
  formatMoney,
  useLiveRefresh,
} from '../components/ui';

function FileSlot({ title, kind, app, onChanged }) {
  const [busy, setBusy] = useState(false);
  const filename = kind === 'resume' ? app.resumeFilename : app.coverLetterFilename;
  const hasFile = kind === 'resume' ? app.resumeFileId : app.coverLetterFileId;

  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const form = new FormData();
    form.append('file', file);
    await api.post(`/applications/${app._id}/files/${kind}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    setBusy(false);
    onChanged();
  }

  async function remove() {
    setBusy(true);
    await api.delete(`/applications/${app._id}/files/${kind}`);
    setBusy(false);
    onChanged();
  }

  return (
    <div className="file-box">
      <h3>{title}</h3>
      <p className="empty">{filename || 'Nothing attached yet. PDF / DOC / TXT, max 5 MB.'}</p>
      <input type="file" onChange={upload} disabled={busy} />
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        {hasFile ? (
          <>
            <button
              className="btn secondary"
              type="button"
              onClick={() => downloadApplicationFile(app._id, kind, filename)}
            >
              Download
            </button>
            <button className="btn danger" type="button" onClick={remove} disabled={busy}>
              Remove
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

const emptyRound = { name: '', type: 'Technical', scheduledAt: '', result: 'Pending', feedback: '' };

function RoundsTimeline({ app, onChange }) {
  const [draft, setDraft] = useState(emptyRound);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  async function run(request) {
    setError('');
    try {
      const { data } = await request;
      onChange(data.application);
      return true;
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save this round.');
      return false;
    }
  }

  async function addRound(e) {
    e.preventDefault();
    const ok = await run(
      api.post(`/applications/${app._id}/rounds`, {
        ...draft,
        scheduledAt: draft.scheduledAt || null,
      })
    );
    if (ok) {
      setDraft(emptyRound);
      setAdding(false);
    }
  }

  function setResult(round, result) {
    run(api.patch(`/applications/${app._id}/rounds/${round._id}`, { result }));
  }

  function removeRound(round) {
    if (!window.confirm(`Remove "${round.name}"?`)) return;
    run(api.delete(`/applications/${app._id}/rounds/${round._id}`));
  }

  const passed = app.rounds.filter((r) => r.result === 'Passed').length;

  return (
    <div className="card">
      <div className="card-head">
        <h2>Interview rounds</h2>
        <span className="muted">
          {app.rounds.length ? `${passed} of ${app.rounds.length} cleared` : 'No rounds yet'}
        </span>
      </div>
      {error ? <div className="error">{error}</div> : null}

      {app.rounds.length === 0 && !adding ? (
        <p className="empty">Track every OA, technical, and HR round with its result and feedback.</p>
      ) : (
        <ol className="timeline">
          {app.rounds.map((round) => (
            <li key={round._id} className={`timeline-item ${round.result}`}>
              <div className="timeline-dot" />
              <div className="timeline-body">
                <div className="timeline-top">
                  <b>{round.name}</b>
                  <span className="muted">
                    {round.type} · {round.scheduledAt ? formatDateTime(round.scheduledAt) : 'Date not set'}
                  </span>
                </div>
                {round.feedback ? <p className="timeline-note">{round.feedback}</p> : null}
                <div className="timeline-actions">
                  {ROUND_RESULTS.map((result) => (
                    <button
                      key={result}
                      type="button"
                      className={`chip ${round.result === result ? `active ${result}` : ''}`}
                      onClick={() => setResult(round, result)}
                    >
                      {result}
                    </button>
                  ))}
                  <button className="btn ghost small" type="button" onClick={() => removeRound(round)}>
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {adding ? (
        <form className="round-form" onSubmit={addRound}>
          <input
            placeholder="Round name, e.g. Technical interview 1"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            required
          />
          <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
            {ROUND_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input
            type="datetime-local"
            value={draft.scheduledAt}
            onChange={(e) => setDraft({ ...draft, scheduledAt: e.target.value })}
          />
          <select value={draft.result} onChange={(e) => setDraft({ ...draft, result: e.target.value })}>
            {ROUND_RESULTS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <textarea
            rows="2"
            placeholder="Feedback or topics asked (optional)"
            value={draft.feedback}
            onChange={(e) => setDraft({ ...draft, feedback: e.target.value })}
          />
          <div className="round-form-actions">
            <button className="btn" type="submit">
              Save round
            </button>
            <button className="btn ghost" type="button" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button className="btn secondary" type="button" onClick={() => setAdding(true)}>
          Add round
        </button>
      )}
    </div>
  );
}

function StatusHistory({ history }) {
  if (!history?.length) return null;
  return (
    <div className="card">
      <h2>Status history</h2>
      <ol className="history">
        {[...history].reverse().map((event, index) => (
          <li key={`${event.status}-${event.changedAt}-${index}`}>
            <StatusBadge status={event.status} />
            <span className="muted">{formatDateTime(event.changedAt)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [missing, setMissing] = useState(false);

  async function load() {
    try {
      const { data } = await api.get(`/applications/${id}`);
      setApp(data.application);
    } catch (err) {
      if (err.response?.status === 404) setMissing(true);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useLiveRefresh(load);

  async function changeStatus(status) {
    const { data } = await api.patch(`/applications/${id}`, { status });
    setApp(data.application);
  }

  async function remove() {
    if (!window.confirm('Delete this application and its attached files?')) return;
    await api.delete(`/applications/${id}`);
    navigate('/applications');
  }

  if (missing) {
    return (
      <p className="empty">
        This application no longer exists. <Link to="/applications">Back to applications</Link>
      </p>
    );
  }
  if (!app) return <p className="empty">Loading application…</p>;

  const fields = Object.entries(app.customFields || {});

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{app.company}</h1>
          <p>
            {app.role} · {app.location || 'Location not set'} · <StatusBadge status={app.status} />{' '}
            <TagList tags={app.tags} onPick={(tag) => navigate(`/applications?tag=${encodeURIComponent(tag)}`)} />
          </p>
        </div>
        <div>
          <Link className="btn secondary" to={`/applications/${id}/edit`}>
            Edit
          </Link>{' '}
          <button className="btn danger" type="button" onClick={remove}>
            Delete
          </button>
        </div>
      </div>

      <div className="split">
        <div className="stack">
          <div className="card">
            <h2>Status</h2>
            <select value={app.status} onChange={(e) => changeStatus(e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <p>
              Applied {formatDate(app.appliedDate)} · Interview {formatDate(app.interviewDate)}
              {app.offerDeadline ? ` · Offer deadline ${formatDate(app.offerDeadline)}` : ''}
            </p>
            <p>
              Recruiter: {app.recruiterName || '—'} {app.recruiterEmail ? `<${app.recruiterEmail}>` : ''}
            </p>
            <p>
              Source: {app.source} · Stipend {formatMoney(app.salary)}
              {app.jobUrl ? (
                <>
                  {' '}
                  · <a href={app.jobUrl} target="_blank" rel="noreferrer">Job link</a>
                </>
              ) : null}
            </p>
            {fields.length ? (
              <>
                <h2>Custom fields</h2>
                <dl className="field-grid">
                  {fields.map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : null}
            <h2>Notes</h2>
            <p>{app.notes || 'No notes yet.'}</p>
          </div>
          <RoundsTimeline app={app} onChange={setApp} />
        </div>
        <div className="stack">
          <div className="card">
            <h2>Documents</h2>
            <p className="empty">Attach a tailored resume or cover letter for this role.</p>
            <div className="files" style={{ gridTemplateColumns: '1fr' }}>
              <FileSlot title="Resume" kind="resume" app={app} onChanged={load} />
              <FileSlot title="Cover letter" kind="coverLetter" app={app} onChanged={load} />
            </div>
          </div>
          <StatusHistory history={app.statusHistory} />
        </div>
      </div>
    </div>
  );
}
