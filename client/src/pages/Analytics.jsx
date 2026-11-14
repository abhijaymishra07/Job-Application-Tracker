import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../api';
import { useTheme } from '../context/ThemeContext';

export default function Analytics() {
  const [data, setData] = useState(null);
  const { chart } = useTheme();

  useEffect(() => {
    api.get('/analytics').then((res) => setData(res.data));
  }, []);

  if (!data) return <p className="empty">Loading analytics…</p>;

  const { summary, statusDistribution, monthlyVolume } = data;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Analytics</h1>
          <p>See conversion rates, pipeline mix, and how many applications you send each month.</p>
        </div>
      </div>

      <div className="grid-stats">
        <div className="stat-card">
          <span>Interview conversion</span>
          <strong>{summary.interviewConversion}%</strong>
        </div>
        <div className="stat-card">
          <span>Offer conversion</span>
          <strong>{summary.offerConversion}%</strong>
        </div>
        <div className="stat-card">
          <span>Response rate</span>
          <strong>{summary.responseRate}%</strong>
        </div>
        <div className="stat-card">
          <span>This month</span>
          <strong>{monthlyVolume.at(-1)?.count ?? 0}</strong>
        </div>
      </div>

      <div className="charts">
        <div className="card">
          <h2>Status distribution</h2>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                <XAxis dataKey="status" stroke={chart.axis} />
                <YAxis allowDecimals={false} stroke={chart.axis} />
                <Tooltip />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {statusDistribution.map((entry) => (
                    <Cell key={entry.status} fill={chart.status[entry.status] || chart.blue} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h2>Monthly application volume</h2>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                <XAxis dataKey="label" stroke={chart.axis} />
                <YAxis allowDecimals={false} stroke={chart.axis} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="count" stroke={chart.accent} strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
