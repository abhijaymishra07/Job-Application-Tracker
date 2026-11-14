import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, daysUntil, formatDate } from '../components/ui';

export default function Dashboard() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [upcoming, setUpcoming] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/analytics'),
      api.get('/applications/pipeline'),
      api.get('/applications/upcoming?days=7'),
    ]).then(([a, p, u]) => {
      setAnalytics(a.data);
      setPipeline(p.data);
      setUpcoming(u.data.interviews);
    });
  }, []);

  const summary = analytics?.summary;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}. Here’s where every application stands.</p>
        </div>
        <Link className="btn" to="/applications/new">
          Add application
        </Link>
      </div>

      <div className="grid-stats">
        <div className="stat-card">
          <span>Total applications</span>
          <strong>{summary?.total ?? '—'}</strong>
        </div>
        <div className="stat-card">
          <span>Interview conversion</span>
          <strong>{summary?.interviewConversion ?? 0}%</strong>
        </div>
        <div className="stat-card">
          <span>Offers</span>
          <strong>{summary?.offers ?? 0}</strong>
        </div>
        <div className="stat-card">
          <span>Interviews in 7 days</span>
          <strong>{upcoming.length}</strong>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Pipeline</h2>
        <p className="empty" style={{ paddingTop: 0, marginTop: -8 }}>
          Each column is a stage. Click a card to open that application.
        </p>
        <div className="pipeline">
          {(pipeline?.statuses || []).map((status) => {
            const items = pipeline.columns[status] || [];
            return (
              <div className="pipeline-col" key={status}>
                <header>
                  <span className="col-title">{status}</span>
                  <span className={`count badge ${status}`}>{items.length}</span>
                </header>
                <div className="pipeline-col-body">
                  {items.length === 0 ? (
                    <p className="pipe-empty">No applications</p>
                  ) : (
                    items.map((app) => (
                      <Link className="pipe-card" key={app._id} to={`/applications/${app._id}`}>
                        <span className="company">{app.company}</span>
                        <span className="role">{app.role}</span>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="split">
        <div className="card">
          <h2>Needs attention next</h2>
          {upcoming.length === 0 ? (
            <p className="empty">No OA/interviews in the next 7 days.</p>
          ) : (
            upcoming.map((item) => (
              <Link className="alert-row" key={item._id} to={`/applications/${item._id}`}>
                <div>
                  <b>{item.company}</b>
                  <div style={{ color: 'var(--muted)' }}>
                    {item.role} · <StatusBadge status={item.status} />
                  </div>
                </div>
                <div className="when">
                  {daysUntil(item.interviewDate)}
                  <div style={{ fontWeight: 500 }}>{formatDate(item.interviewDate)}</div>
                </div>
              </Link>
            ))
          )}
        </div>
        <div className="card">
          <h2>Insights</h2>
          <p className="empty">
            Interview conversion is {summary?.interviewConversion ?? 0}% and response rate is{' '}
            {summary?.responseRate ?? 0}%. Open analytics for trends over time.
          </p>
          <Link className="btn secondary" to="/analytics">
            View analytics
          </Link>
        </div>
      </div>
    </div>
  );
}
