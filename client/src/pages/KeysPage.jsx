// client/src/pages/KeysPage.jsx
import { useEffect, useState } from 'react';
import { listKeys, createKey, deactivateKey } from '../api/client';
import TrafficChart from './TrafficChart';
import './KeysPage.css';

const ALGORITHMS = [
  { value: 'fixed_window', label: 'Fixed window' },
  { value: 'token_bucket', label: 'Token bucket' },
  { value: 'sliding_window_counter', label: 'Sliding window' },
];

const DEFAULT_FORM = {
  owner: '',
  algorithm: 'fixed_window',
  limit: 100,
  windowSizeInSeconds: 60,
  capacity: 100,
  refillRatePerSec: 1,
};

function KeysPage() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [copied, setCopied] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listKeys();
      setKeys(data);
    } catch (err) {
      setError('Could not reach the server. Is it running on :5000?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const payload = { owner: form.owner, algorithm: form.algorithm };
      if (form.algorithm === 'token_bucket') {
        payload.capacity = Number(form.capacity);
        payload.refillRatePerSec = Number(form.refillRatePerSec);
      } else {
        payload.limit = Number(form.limit);
        payload.windowSizeInSeconds = Number(form.windowSizeInSeconds);
      }
      const created = await createKey(payload);
      setJustCreated(created.key);
      setForm(DEFAULT_FORM);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create the key.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async (id) => {
    try {
      await deactivateKey(id);
      await refresh();
    } catch (err) {
      setError('Could not deactivate that key.');
    }
  };

  const handleCopy = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch (err) {
    setError('Could not copy — your browser may be blocking clipboard access.');
  }
};
  return (
    <div className="keys-page">
      <section className="panel">
        <h2>New key</h2>
        <form onSubmit={handleSubmit} className="key-form">
          <label>
            Owner
            <input
              type="text"
              required
              value={form.owner}
              onChange={(e) => setForm({ ...form, owner: e.target.value })}
              placeholder="e.g. nikhil, mobile-app, partner-x"
            />
          </label>

          <label>
            Algorithm
            <select
              value={form.algorithm}
              onChange={(e) => setForm({ ...form, algorithm: e.target.value })}
            >
              {ALGORITHMS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>

          {form.algorithm === 'token_bucket' ? (
            <>
              <label>
                Capacity
                <input
                  type="number"
                  min="1"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                />
              </label>
              <label>
                Refill rate (tokens/sec)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.refillRatePerSec}
                  onChange={(e) => setForm({ ...form, refillRatePerSec: e.target.value })}
                />
              </label>
            </>
          ) : (
            <>
              <label>
                Limit (requests)
                <input
                  type="number"
                  min="1"
                  value={form.limit}
                  onChange={(e) => setForm({ ...form, limit: e.target.value })}
                />
              </label>
              <label>
                Window (seconds)
                <input
                  type="number"
                  min="1"
                  value={form.windowSizeInSeconds}
                  onChange={(e) => setForm({ ...form, windowSizeInSeconds: e.target.value })}
                />
              </label>
            </>
          )}

          <button type="submit" className="btn-primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create key'}
          </button>
        </form>

        {justCreated && (
  <div className="new-key-banner">
    <span>Key created — copy it now, it won't be shown again in full elsewhere:</span>
    <div className="new-key-row">
      <code className="mono">{justCreated}</code>
      <button
        type="button"
        className="btn-secondary btn-copy"
        onClick={() => handleCopy(justCreated)}
      >
        {copied ? 'Copied ✓' : 'Copy'}
      </button>
    </div>
  </div>
)}
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Keys</h2>
          <button className="btn-secondary" onClick={refresh}>Refresh</button>
        </div>

        {error && <p className="error-text">{error}</p>}
        {loading ? (
          <p className="text-dim">Loading…</p>
        ) : keys.length === 0 ? (
          <p className="text-dim">No keys yet — create one above to get started.</p>
        ) : (
          <table className="keys-table">
            <thead>
              <tr>
                <th>Owner</th>
                <th>Key</th>
                <th>Algorithm</th>
                <th>Limits</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr
                  key={k._id}
                  className={selectedKey?._id === k._id ? 'row-selected' : ''}
                  onClick={() => setSelectedKey(k)}
                >
                  <td>{k.owner}</td>
                  <td className="mono key-cell">{k.key}</td>
                  <td>{ALGORITHMS.find((a) => a.value === k.algorithm)?.label || k.algorithm}</td>
                  <td className="mono">
                    {k.algorithm === 'token_bucket'
                      ? `${k.capacity} cap / ${k.refillRatePerSec}/s`
                      : `${k.limit} / ${k.windowSizeInSeconds}s`}
                  </td>
                  <td>
                    <span className={`status-pill ${k.active ? 'active' : 'inactive'}`}>
                      {k.active ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td>
                    {k.active && (
                      <button
                        className="btn-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeactivate(k._id);
                        }}
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <TrafficChart
          apiKey={selectedKey?.key}
          keyLabel={selectedKey ? `${selectedKey.owner} — ${selectedKey.key.slice(0, 16)}…` : ''}
        />
      </section>
    </div>
  );
}

export default KeysPage;