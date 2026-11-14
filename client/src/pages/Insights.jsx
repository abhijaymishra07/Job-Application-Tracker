import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../api';
import { useTheme } from '../context/ThemeContext';
import { StatusBadge, formatDate, useLiveRefresh } from '../components/ui';

const THRESHOLDS = [14, 21, 30];

export default function Insights() {
  const [days, setDays] = useState(21);
  const { chart } = useTheme();
  const [ghost, setGhost] = useState(null);
  const [trend, setTrend] = useState(null);

  async function load(threshold = days) {
    const [g, t] = await Promise.all([
      api.get('/insights/ghosting', { params: { days: threshold } }),
      api.get('/insights/trend', { params: { months: 12 } }),
    ]);
    setGhost(g.data);
    setTrend(t.data);
  }

  useEffect(() => {
    load(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  useLiveRefresh(() => load(days));

  async function snoozeFollowUp(app) {
    const next = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    await api.patch(`/applications/${app._id}`, { followUpDate: next });
    await load(days);
  }

  if (!ghost || !trend) return <p className="empty">Loading response tracker…</p>;

  const fastest = ghost.responseBySource.find((s) => s.speedRank === 1);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Response tracker</h1>
          <p>Spot companies that have gone quiet, and learn which sources actually reply.</p>
        </div>
      </div>

      <div className="grid-stats">
        <div className="stat-card">
          <span>Waiting on a reply</span>
          <strong>{ghost.waiting.length}</strong>
        </div>
        <div className="stat-card warn">
          <span>Ghosted ({ghost.threshold}+ days silent)</span>
          <strong>{ghost.ghostedCount}</strong>
        </div>
        <div className="stat-card">
          <span>Fastest replying source</span>
          <strong>{fastest ? fastest.source : '—'}</strong>
          {fastest ? <small className="muted">{fastest.avgResponseDays} days on average</small> : null}
        </div>
        <div className="stat-card">
          <span>Empty months in the last year</span>
          <strong>{trend.emptyMonths}</strong>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h2>Still waiting</h2>
          <div className="toolbar compact">
            <span className="muted">Call it ghosted after</span>
            {THRESHOLDS.map((n) => (
              <button
                key={n}
                type="button"
                className={n === days ? 'btn small' : 'btn secondary small'}
                onClick={() => setDays(n)}
              >
                {n} days
              </button>
            ))}
          </div>
        </div>
        {ghost.waiting.length === 0 ? (
          <p className="empty">Nothing is waiting on a reply right now.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Stage</th>
                <th>Source</th>
                <th>Silent for</th>
                <th>Rank in source</th>
                <th>Source average</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ghost.waiting.map((app) => (
                <tr key={app._id} className={app.ghosted ? 'row-ghosted' : ''}>
                  <td>
                    <Link to={`/applications/${app._id}`}>
                      <b>{app.company}</b>
                    </Link>
                    <div className="muted small">{app.role}</div>
                  </td>
                  <td>
                    <StatusBadge status={app.status} />
                  </td>
                  <td>{app.source}</td>
                  <td>
                    <b>{app.daysWaiting} days</b>
                    <div className="muted small">
                      {app.hasUpcoming
                        ? `Scheduled ${formatDate(app.interviewDate)}`
                        : `since ${formatDate(app.lastMove)}`}
                    </div>
                  </td>
                  <td>
                    #{app.rankInSource} of {app.waitingInSource}
                  </td>
                  <td>{app.sourceAvgWait} days</td>
                  <td>
                    {app.ghosted ? (
                      <div className="ghost-actions">
                        <span className="pill red">Ghosted</span>
                        {app.recruiterEmail ? (
                          <a
                            className="btn secondary small"
                            href={`mailto:${app.recruiterEmail}?subject=${encodeURIComponent(
                              `Following up on my ${app.role} application`
                            )}`}
                          >
                            Email recruiter
                          </a>
                        ) : null}
                        <button className="btn secondary small" type="button" onClick={() => snoozeFollowUp(app)}>
                          Remind me in 3 days
                        </button>
                      </div>
                    ) : app.hasUpcoming ? (
                      <span className="pill">Round booked</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="charts">
        <div className="card">
          <h2>Reply speed by source</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Source</th>
                <th>Applications</th>
                <th>Reply rate</th>
                <th>Avg days to reply</th>
              </tr>
            </thead>
            <tbody>
              {ghost.responseBySource.map((s) => (
                <tr key={s.source}>
                  <td>{s.speedRank ? `#${s.speedRank}` : '—'}</td>
                  <td>{s.source}</td>
                  <td>{s.applications}</td>
                  <td>{s.responseRate}%</td>
                  <td>{s.avgResponseDays ?? 'No replies yet'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Applications per month</h2>
          <p className="muted small">
            Months with no applications appear as zero instead of being skipped, so gaps in your search are visible.
            The line is a 3-month rolling average.
          </p>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend.series} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                <XAxis dataKey="label" stroke={chart.axis} fontSize={11} />
                <YAxis allowDecimals={false} stroke={chart.axis} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" name="Applications" fill={chart.blue} radius={[6, 6, 0, 0]}>
                  {trend.series.map((point) => (
                    <Cell key={point.label} fill={point.filled ? chart.faded : chart.blue} />
                  ))}
                </Bar>
                <Line type="monotone" dataKey="rollingAvg" name="3-month average" stroke={chart.accent} strokeWidth={3} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
