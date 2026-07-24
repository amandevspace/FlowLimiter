// client/src/pages/ComparePage.jsx
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
import { listKeys, runCompare } from '../api/client';
import './ComparePage.css';

const ALGO_LABELS = {
  fixed_window: 'Fixed window',
  token_bucket: 'Token bucket',
  sliding_window_counter: 'Sliding window',
};

// Turn a timeline of {n, allowed} into a cumulative allowed/rejected count
// per request index — this is what makes the "cliff" vs "trickle" shapes
// visually obvious on a chart.
const toCumulative = (timeline) => {
  let allowed = 0;
  let rejected = 0;
  return timeline.map((t) => {
    if (t.allowed) allowed += 1;
    else rejected += 1;
    return { n: t.n, allowed, rejected };
  });
};

function MiniChart({ title, algorithm, timeline }) {
  const data = toCumulative(timeline);
  const totalAllowed = data.length ? data[data.length - 1].allowed : 0;
  const totalRejected = data.length ? data[data.length - 1].rejected : 0;

  return (
    <div className="mini-chart">
      <div className="mini-chart-header">
        <span className="mini-chart-title">{title}</span>
        <span className="mini-chart-algo">{ALGO_LABELS[algorithm] || algorithm}</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id={`allowed-${title}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3fb8af" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#3fb8af" stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`rejected-${title}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e8735f" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#e8735f" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#2a2f35" vertical={false} />
          <XAxis dataKey="n" stroke="#8b9096" fontSize={11} tickLine={false} />
          <YAxis stroke="#8b9096" fontSize={11} tickLine={false} allowDecimals={false} />
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
            fill={`url(#allowed-${title})`}
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="rejected"
            stroke="#e8735f"
            fill={`url(#rejected-${title})`}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mini-chart-totals">
        <span className="totals-allowed">{totalAllowed} allowed</span>
        <span className="totals-rejected">{totalRejected} rejected</span>
      </div>
    </div>
  );
}

function ComparePage() {
  const [keys, setKeys] = useState([]);
  const [keyAId, setKeyAId] = useState('');
  const [keyBId, setKeyBId] = useState('');
  const [totalRequests, setTotalRequests] = useState(20);
  const [intervalMs, setIntervalMs] = useState(150);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    listKeys()
      .then((data) => setKeys(data.filter((k) => k.active)))
      .catch(() => setError('Could not load keys.'));
  }, []);

  const handleRun = async (e) => {
    e.preventDefault();
    setError(null);

    const keyA = keys.find((k) => k._id === keyAId);
    const keyB = keys.find((k) => k._id === keyBId);

    if (!keyA || !keyB) {
      setError('Pick two keys to compare.');
      return;
    }
    if (keyAId === keyBId) {
      setError('Pick two different keys — comparing a key to itself won\u2019t show anything.');
      return;
    }

    setRunning(true);
    setResult(null);
    try {
      const data = await runCompare({
        keyA: keyA.key,
        keyB: keyB.key,
        totalRequests: Number(totalRequests),
        intervalMs: Number(intervalMs),
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Simulation failed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="compare-page">
      <section className="panel">
        <h2>Run comparison</h2>
        <form onSubmit={handleRun} className="compare-form">
          <label>
            Key A
            <select value={keyAId} onChange={(e) => setKeyAId(e.target.value)} required>
              <option value="" disabled>Select a key</option>
              {keys.map((k) => (
                <option key={k._id} value={k._id}>
                  {k.owner} — {ALGO_LABELS[k.algorithm]}
                </option>
              ))}
            </select>
          </label>

          <label>
            Key B
            <select value={keyBId} onChange={(e) => setKeyBId(e.target.value)} required>
              <option value="" disabled>Select a key</option>
              {keys.map((k) => (
                <option key={k._id} value={k._id}>
                  {k.owner} — {ALGO_LABELS[k.algorithm]}
                </option>
              ))}
            </select>
          </label>

          <label>
            Requests
            <input
              type="number"
              min="1"
              max="60"
              value={totalRequests}
              onChange={(e) => setTotalRequests(e.target.value)}
            />
          </label>

          <label>
            Interval (ms)
            <input
              type="number"
              min="50"
              value={intervalMs}
              onChange={(e) => setIntervalMs(e.target.value)}
            />
          </label>

          <button type="submit" className="btn-primary" disabled={running}>
            {running ? 'Running…' : 'Run comparison'}
          </button>
        </form>

        {error && <p className="error-text">{error}</p>}
        {keys.length < 2 && (
          <p className="text-dim">
            You need at least two active keys to compare. Create them on the Keys tab.
          </p>
        )}
      </section>

      {result && (
        <section className="panel">
          <h2>Result</h2>
          <div className="compare-grid">
            <MiniChart title="Key A" algorithm={result.keyA.algorithm} timeline={result.keyA.timeline} />
            <MiniChart title="Key B" algorithm={result.keyB.algorithm} timeline={result.keyB.timeline} />
          </div>
        </section>
      )}
    </div>
  );
}

export default ComparePage;