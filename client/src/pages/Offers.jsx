import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { TagList, formatDate, formatMoney, useLiveRefresh } from '../components/ui';

function deadlineText(days) {
  if (days === null || days === undefined) return 'No deadline set';
  const plural = (n) => `${n} day${n === 1 ? '' : 's'}`;
  if (days < 0) return `Expired ${plural(Math.abs(days))} ago`;
  if (days === 0) return 'Due today';
  return `${plural(days)} left`;
}

function displayValue(value) {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export default function Offers() {
  const [data, setData] = useState(null);

  function load() {
    api.get('/insights/offers').then(({ data: res }) => setData(res));
  }

  useEffect(load, []);
  useLiveRefresh(load);

  if (!data) return <p className="empty">Loading offers…</p>;

  const { offers, fieldNames } = data;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Compare offers</h1>
          <p>Every offer side by side: stipend, reply deadline, how hard it was to get, and the details you track.</p>
        </div>
      </div>

      {offers.length === 0 ? (
        <div className="card">
          <p className="empty">
            No offers yet. When an application moves to <b>Offer</b>, it shows up here.
          </p>
        </div>
      ) : (
        <>
          <div className="offer-grid">
            {offers.map((offer) => (
              <div key={offer._id} className={`card offer-card ${offer.stipendRank === 1 ? 'best' : ''}`}>
                <div className="offer-top">
                  <span className="offer-rank">#{offer.stipendRank}</span>
                  {offer.stipendRank === 1 ? <span className="pill green">Highest stipend</span> : null}
                </div>
                <h2>
                  <Link to={`/applications/${offer._id}`}>{offer.company}</Link>
                </h2>
                <p className="muted">
                  {offer.role} · {offer.location || 'Location not set'}
                </p>
                <div className="offer-money">{formatMoney(offer.stipend)}</div>
                <p className="muted small">
                  {offer.gapToBest > 0 ? `${formatMoney(offer.gapToBest)} below the best offer` : 'Best offer on the table'}
                </p>
                <div
                  className={`offer-deadline ${
                    offer.daysToDecide !== null && offer.daysToDecide <= 3 ? 'urgent' : ''
                  }`}
                >
                  {deadlineText(offer.daysToDecide)}
                  {offer.offerDeadline ? <small> · {formatDate(offer.offerDeadline)}</small> : null}
                </div>
                <TagList tags={offer.tags} />
              </div>
            ))}
          </div>

          <div className="card">
            <h2>Side by side</h2>
            <div className="table-scroll">
              <table className="table compare">
                <thead>
                  <tr>
                    <th></th>
                    {offers.map((offer) => (
                      <th key={offer._id}>{offer.company}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Monthly stipend</td>
                    {offers.map((o) => (
                      <td key={o._id} className={o.stipendRank === 1 ? 'win' : ''}>
                        {formatMoney(o.stipend)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>Reply deadline</td>
                    {offers.map((o) => (
                      <td key={o._id}>{deadlineText(o.daysToDecide)}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>Days from applying to offer</td>
                    {offers.map((o) => (
                      <td key={o._id}>{o.daysToOffer ?? '—'}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>Rounds cleared</td>
                    {offers.map((o) => (
                      <td key={o._id}>{o.roundsTotal ? `${o.roundsPassed} / ${o.roundsTotal}` : '—'}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>Source</td>
                    {offers.map((o) => (
                      <td key={o._id}>{o.source}</td>
                    ))}
                  </tr>
                  {fieldNames.map((name) => (
                    <tr key={name}>
                      <td>{name}</td>
                      {offers.map((o) => (
                        <td key={o._id}>{displayValue(o.customFields?.[name])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small">
              Add rows to this table by giving offers custom fields such as Bond months, PPO chance, or Work mode.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
