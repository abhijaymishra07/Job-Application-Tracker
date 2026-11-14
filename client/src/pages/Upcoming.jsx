import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { StatusBadge, daysUntil, formatDate } from '../components/ui';

export default function Upcoming() {
  const [days, setDays] = useState(7);
  const [payload, setPayload] = useState({ interviews: [] });

  useEffect(() => {
    api.get(`/applications/upcoming?days=${days}`).then((res) => setPayload(res.data));
  }, [days]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Upcoming</h1>
          <p>Online assessments and interviews in the next {days} days.</p>
        </div>
      </div>

      <div className="toolbar">
        {[3, 7, 14].map((n) => (
          <button
            key={n}
            type="button"
            className={n === days ? 'btn' : 'btn secondary'}
            onClick={() => setDays(n)}
          >
            Next {n} days
          </button>
        ))}
      </div>

      <div className="card">
        {payload.interviews.length === 0 ? (
          <p className="empty">No interviews or assessments in this window.</p>
        ) : (
          payload.interviews.map((item) => (
            <Link className="alert-row" key={item._id} to={`/applications/${item._id}`}>
              <div>
                <b>{item.company}</b>
                <div style={{ color: 'var(--muted)' }}>
                  {item.role} · <StatusBadge status={item.status} /> · {item.recruiterName || 'No recruiter noted'}
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
    </div>
  );
}
