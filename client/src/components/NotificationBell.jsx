import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import api, { liveStreamUrl } from '../api';
import { daysUntil, formatDate, timeAgo } from './ui';

const REMINDER_LABEL = {
  overdue: 'Overdue',
  followup: 'Follow up',
  interview: 'Coming up',
  offer: 'Offer deadline',
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ reminders: [], activity: [], unread: 0 });
  const [connected, setConnected] = useState(false);
  const [flash, setFlash] = useState(null);
  const panelRef = useRef(null);

  const load = useCallback(async () => {
    const { data: res } = await api.get('/notifications');
    setData(res);
  }, []);

  useEffect(() => {
    load();
    const source = new EventSource(liveStreamUrl());

    source.addEventListener('ready', (e) => {
      setConnected(JSON.parse(e.data).enabled);
    });
    source.addEventListener('activity', (e) => {
      const payload = JSON.parse(e.data);
      setData((prev) => ({
        ...prev,
        unread: prev.unread + 1,
        activity: [payload.notification, ...prev.activity].slice(0, 30),
      }));
      setFlash(payload.notification.message);
      window.dispatchEvent(new CustomEvent('jobtrack:activity', { detail: payload }));
    });
    source.onerror = () => setConnected(false);
    source.onopen = () => setConnected(true);

    // a page kept in the back/forward cache would otherwise hold one of the
    // browser's six connections per host open indefinitely
    const closeOnHide = () => source.close();
    window.addEventListener('pagehide', closeOnHide);

    return () => {
      window.removeEventListener('pagehide', closeOnHide);
      source.close();
    };
  }, [load]);

  useEffect(() => {
    if (!flash) return undefined;
    const timer = setTimeout(() => setFlash(null), 3500);
    return () => clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    if (!open) return undefined;
    function close(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) await load();
  }

  async function markRead() {
    await api.post('/notifications/read');
    setData((prev) => ({
      ...prev,
      unread: 0,
      activity: prev.activity.map((a) => ({ ...a, read: true })),
    }));
  }

  const count = data.unread + data.reminders.length;

  return (
    <div className="bell-wrap" ref={panelRef}>
      <button className="bell" type="button" onClick={toggle} aria-label="Notifications">
        <span aria-hidden="true">🔔</span>
        <span>Notifications</span>
        {count > 0 ? <span className="bell-count">{count}</span> : null}
      </button>
      <div className={`live-dot ${connected ? 'on' : ''}`}>
        {connected ? 'Live updates on' : 'Live updates off'}
      </div>

      {flash ? createPortal(<div className="toast">{flash}</div>, document.body) : null}

      {open ? (
        <div className="bell-panel">
          <div className="bell-head">
            <b>Reminders</b>
            <span>{data.reminders.length}</span>
          </div>
          {data.reminders.length === 0 ? (
            <p className="empty small">Nothing due in the next few days.</p>
          ) : (
            data.reminders.map((r) => (
              <Link
                key={r.id}
                className={`bell-item reminder ${r.kind}`}
                to={`/applications/${r.applicationId}`}
                onClick={() => setOpen(false)}
              >
                <span className="bell-kind">{REMINDER_LABEL[r.kind]}</span>
                <span>{r.message}</span>
                <small>
                  {daysUntil(r.due)} · {formatDate(r.due)}
                </small>
              </Link>
            ))
          )}

          <div className="bell-head">
            <b>Activity</b>
            {data.unread > 0 ? (
              <button className="btn ghost small" type="button" onClick={markRead}>
                Mark all read
              </button>
            ) : null}
          </div>
          {data.activity.length === 0 ? (
            <p className="empty small">Changes to your applications will appear here instantly.</p>
          ) : (
            data.activity.map((a) =>
              a.applicationId && a.kind !== 'deleted' ? (
                <Link
                  key={a._id}
                  className={`bell-item ${a.read ? '' : 'unread'}`}
                  to={`/applications/${a.applicationId}`}
                  onClick={() => setOpen(false)}
                >
                  <span>{a.message}</span>
                  <small>{timeAgo(a.createdAt)}</small>
                </Link>
              ) : (
                <div key={a._id} className={`bell-item ${a.read ? '' : 'unread'}`}>
                  <span>{a.message}</span>
                  <small>{timeAgo(a.createdAt)}</small>
                </div>
              )
            )
          )}
        </div>
      ) : null}
    </div>
  );
}
