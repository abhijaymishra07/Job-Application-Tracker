import { useEffect, useRef } from 'react';

export const STATUSES = ['Saved', 'Applied', 'OA', 'Interview', 'Offer', 'Rejected'];
export const SOURCES = ['LinkedIn', 'Naukri', 'Company Site', 'Referral', 'Campus', 'Other'];
export const ROUND_TYPES = ['OA', 'Technical', 'Managerial', 'HR', 'Group Discussion', 'Other'];
export const ROUND_RESULTS = ['Pending', 'Passed', 'Failed'];

export function StatusBadge({ status }) {
  return <span className={`badge ${status}`}>{status}</span>;
}

export function TagList({ tags, onPick }) {
  if (!tags?.length) return null;
  return (
    <span className="tag-list">
      {tags.map((tag) =>
        onPick ? (
          <button key={tag} type="button" className="tag" onClick={() => onPick(tag)}>
            #{tag}
          </button>
        ) : (
          <span key={tag} className="tag">
            #{tag}
          </span>
        )
      )}
    </span>
  );
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(value) {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return formatDate(value);
}

export function daysUntil(value) {
  const ms = new Date(value).getTime() - Date.now();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days < 0) return `${Math.abs(days)} days ago`;
  return `In ${days} days`;
}

export function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—';
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

/** Re-runs `callback` whenever the live change-stream feed reports a change. */
export function useLiveRefresh(callback) {
  const ref = useRef(callback);
  ref.current = callback;

  useEffect(() => {
    const handler = () => ref.current();
    window.addEventListener('jobtrack:activity', handler);
    return () => window.removeEventListener('jobtrack:activity', handler);
  }, []);
}
