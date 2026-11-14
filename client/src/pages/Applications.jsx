import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { downloadApplicationsCsv } from '../api';
import { STATUSES, StatusBadge, TagList, formatDate, useLiveRefresh } from '../components/ui';

function PlanColumn({ title, plan }) {
  if (!plan) return null;
  return (
    <div className={`plan-col ${plan.usesIndex ? 'good' : 'bad'}`}>
      <h3>{title}</h3>
      <p className="plan-stages">{plan.stages.join(' → ')}</p>
      <dl>
        <div>
          <dt>Index</dt>
          <dd>{plan.indexName || 'none'}</dd>
        </div>
        <div>
          <dt>Keys examined</dt>
          <dd>{plan.totalKeysExamined}</dd>
        </div>
        <div>
          <dt>Documents examined</dt>
          <dd>{plan.totalDocsExamined}</dd>
        </div>
        <div>
          <dt>Returned</dt>
          <dd>{plan.nReturned}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{plan.executionTimeMillis} ms</dd>
        </div>
      </dl>
    </div>
  );
}

function ImportPanel({ onDone, onClose }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  async function importFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const csv = await file.text();
      const { data } = await api.post('/applications/import', { csv });
      setResult(data);
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not import this file.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="card import-panel">
      <div className="card-head">
        <h2>Import from a spreadsheet</h2>
        <button className="btn ghost" type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="muted">
        Save your sheet as CSV. Required columns: <code>company</code>, <code>role</code>. Optional:{' '}
        <code>status, source, location, jobUrl, salary, appliedDate, interviewDate, followUpDate,
        offerDeadline, recruiterName, recruiterEmail, tags</code> (separate tags with <code>;</code>),{' '}
        <code>notes</code>.
      </p>
      <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={importFile} disabled={busy} />
      {busy ? <p className="muted">Importing…</p> : null}
      {error ? <div className="error">{error}</div> : null}
      {result ? (
        <div className="import-result">
          <p>
            <b>{result.inserted}</b> of {result.totalRows} rows imported.
            {result.duplicates.length ? ` ${result.duplicates.length} skipped as duplicates.` : ''}
            {result.rejected.length ? ` ${result.rejected.length} had errors.` : ''}
          </p>
          {result.duplicates.length ? (
            <ul>
              {result.duplicates.map((d) => (
                <li key={`d${d.row}`}>
                  Row {d.row}: {d.company} — {d.role} is already in your list
                </li>
              ))}
            </ul>
          ) : null}
          {result.rejected.length ? (
            <ul className="bad">
              {result.rejected.map((r) => (
                <li key={`r${r.row}`}>
                  Row {r.row}: {r.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function Applications() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const [tag, setTag] = useState(searchParams.get('tag') || '');
  const [field, setField] = useState('');
  const [fieldValue, setFieldValue] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ applications: [], pagination: { pages: 1, total: 0 } });
  const [facets, setFacets] = useState({ tags: [], fields: [] });
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null);
  const [showPlan, setShowPlan] = useState(false);
  const [showImport, setShowImport] = useState(false);

  function filterParams(overrides = {}) {
    const merged = { q, status, tag, field, value: fieldValue, ...overrides };
    return {
      q: merged.q || undefined,
      status: merged.status,
      tag: merged.tag || undefined,
      field: merged.field || undefined,
      value: merged.field ? merged.value : undefined,
    };
  }

  async function load(nextPage = page, overrides = {}) {
    setLoading(true);
    const params = filterParams(overrides);
    const { data: res } = await api.get('/applications', {
      params: { ...params, page: nextPage, limit: 8 },
    });
    setData(res);
    setLoading(false);
    if (showPlan) loadPlan(params);
  }

  async function loadPlan(params = filterParams()) {
    const { data: res } = await api.get('/applications/explain', { params });
    setPlan(res);
  }

  function loadFacets() {
    api.get('/applications/tags').then(({ data: res }) => setFacets(res));
  }

  useEffect(() => {
    loadFacets();
  }, []);

  useEffect(() => {
    setPage(1);
    load(1);
    if (tag) setSearchParams({ tag }, { replace: true });
    else setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, tag]);

  useLiveRefresh(() => {
    load(page);
    loadFacets();
  });

  async function search(e) {
    e.preventDefault();
    setPage(1);
    await load(1);
  }

  async function togglePlan() {
    const next = !showPlan;
    setShowPlan(next);
    if (next) await loadPlan();
  }

  async function changeStatus(id, next) {
    await api.patch(`/applications/${id}`, { status: next });
    await load(page);
  }

  async function remove(id) {
    if (!window.confirm('Delete this application?')) return;
    await api.delete(`/applications/${id}`);
    await load(page);
  }

  function clearFilters() {
    setQ('');
    setField('');
    setFieldValue('');
    setStatus('All');
    setTag('');
    load(1, { q: '', field: '', value: '', status: 'All', tag: '' });
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Applications</h1>
          <p>Search, filter by status, tag, or your own custom fields, and move data in and out as CSV.</p>
        </div>
        <div className="head-actions">
          <button className="btn secondary" type="button" onClick={() => setShowImport((v) => !v)}>
            Import CSV
          </button>
          <button className="btn secondary" type="button" onClick={() => downloadApplicationsCsv(filterParams())}>
            Export CSV
          </button>
          <Link className="btn" to="/applications/new">
            Add application
          </Link>
        </div>
      </div>

      {showImport ? (
        <ImportPanel
          onClose={() => setShowImport(false)}
          onDone={() => {
            load(1);
            loadFacets();
          }}
        />
      ) : null}

      <form className="toolbar" onSubmit={search}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search company, role, recruiter, or notes…"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option>All</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">All tags</option>
          {facets.tags.map((t) => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
        </select>
        <select value={field} onChange={(e) => setField(e.target.value)}>
          <option value="">Any custom field</option>
          {facets.fields.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
        {field ? (
          <input
            className="narrow"
            value={fieldValue}
            onChange={(e) => setFieldValue(e.target.value)}
            placeholder="equals… (blank = has field)"
          />
        ) : null}
        <button className="btn" type="submit">
          Search
        </button>
        <button className="btn ghost" type="button" onClick={clearFilters}>
          Clear
        </button>
        <button className={`btn ${showPlan ? '' : 'secondary'}`} type="button" onClick={togglePlan}>
          Query plan
        </button>
      </form>

      {showPlan && plan ? (
        <div className="card plan-card">
          <div className="card-head">
            <h2>How MongoDB ran this search</h2>
            <code className="plan-filter">{JSON.stringify(plan.filter)}</code>
          </div>
          <div className="plan-grid">
            <PlanColumn title="With indexes (actual plan)" plan={plan.plan} />
            {plan.collectionScan ? (
              <PlanColumn title="Forced collection scan" plan={plan.collectionScan} />
            ) : (
              <p className="muted">Text search always runs through the text index, so there is no scan to compare.</p>
            )}
          </div>
        </div>
      ) : null}

      <div className="card">
        {loading ? (
          <p className="empty">Loading…</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Role</th>
                <th>Status</th>
                <th>Applied</th>
                <th>Tags</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.applications.map((app) => (
                <tr key={app._id}>
                  <td>
                    <Link to={`/applications/${app._id}`}>
                      <b>{app.company}</b>
                    </Link>
                  </td>
                  <td>{app.role}</td>
                  <td>
                    <select
                      value={app.status}
                      onChange={(e) => changeStatus(app._id, e.target.value)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td>{formatDate(app.appliedDate)}</td>
                  <td>
                    <TagList tags={app.tags} onPick={setTag} />
                  </td>
                  <td>
                    <StatusBadge status={app.status} />{' '}
                    <button className="btn ghost" type="button" onClick={() => remove(app._id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && data.applications.length === 0 ? (
          <p className="empty">No applications match this search.</p>
        ) : null}
        <div className="pager">
          <span>
            {data.pagination.total} {data.pagination.total === 1 ? 'record' : 'records'} · page {data.pagination.page} of {data.pagination.pages}
          </span>
          <div>
            <button
              className="btn secondary"
              type="button"
              disabled={page <= 1}
              onClick={() => {
                const next = page - 1;
                setPage(next);
                load(next);
              }}
            >
              Prev
            </button>{' '}
            <button
              className="btn secondary"
              type="button"
              disabled={page >= data.pagination.pages}
              onClick={() => {
                const next = page + 1;
                setPage(next);
                load(next);
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
