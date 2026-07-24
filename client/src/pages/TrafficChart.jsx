// client/src/pages/TrafficChart.jsx
import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getTraffic } from '../api/client';
import './TrafficChart.css';

const REFRESH_MS = 5000;

const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function TrafficChart({ apiKey, keyLabel }) {
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!apiKey) return;

    let cancelled = false;

    const fetchData = async () => {
      try {
        const raw = await getTraffic(apiKey, 15);
        if (!cancelled) {
          setData(raw.map((d) => ({ ...d, label: formatTime(d.time) })));
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError('Could not load traffic data.');
      }
    };

    fetchData();
    const interval = setInterval(fetchData, REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [apiKey]);

  if (!apiKey) {
    return <p className="text-dim">Select a key above to see its traffic.</p>;
  }

  return (
    <div className="traffic-chart">
      <div className="chart-header">
        <span>Traffic — last 15 min</span>
        <span className="chart-key mono">{keyLabel}</span>
      </div>

      {error && <p className="error-text">{error}</p>}

      {data.length === 0 ? (
        <p className="text-dim">No traffic in the last 15 minutes yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="allowedFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3fb8af" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#3fb8af" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="rejectedFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e8735f" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#e8735f" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#2a2f35" vertical={false} />
            <XAxis dataKey="label" stroke="#8b9096" fontSize={12} tickLine={false} />
            <YAxis stroke="#8b9096" fontSize={12} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: '#1b1f23',
                border: '1px solid #2a2f35',
                borderRadius: 6,
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="allowed"
              stroke="#3fb8af"
              fill="url(#allowedFill)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="rejected"
              stroke="#e8735f"
              fill="url(#rejectedFill)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default TrafficChart;