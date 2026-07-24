// client/src/pages/LoginPage.jsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

const MODE = { LOGIN: 'login', REGISTER: 'register' };

function extractError(err) {
  return (
    err?.response?.data?.error ||
    err?.message ||
    'Something went wrong. Please try again.'
  );
}

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState(MODE.LOGIN);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === MODE.REGISTER;

  const switchMode = (next) => {
    setMode(next);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isRegister) {
        await register(name.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
    } catch (err) {
      setError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-orb auth-orb-teal" aria-hidden="true" />
      <div className="auth-orb auth-orb-coral" aria-hidden="true" />
      <div className="auth-grid" aria-hidden="true" />

      <div className="auth-layout">
        {/* Signature panel — a small live rate-limiter visual */}
        <aside className="auth-signature" aria-hidden="true">
          <div className="sig-badge">
            <span className="sig-dot" />
            rate limiter · live
          </div>
          <h2 className="sig-title">
            Every request
            <br />
            meets the gate.
          </h2>
          <p className="sig-copy">
            Token buckets, sliding windows, fixed windows — watch traffic
            get shaped in real time.
          </p>

          <div className="bucket-scene">
            <div className="bucket">
              <div className="bucket-fill" />
              <span className="bucket-label mono">bucket</span>
            </div>
            <div className="gate-track">
              <span className="packet packet-1" />
              <span className="packet packet-2" />
              <span className="packet packet-3" />
              <span className="packet packet-4" />
              <div className="gate" />
            </div>
            <div className="outcomes">
              <span className="outcome outcome-pass mono">200 OK</span>
              <span className="outcome outcome-block mono">429</span>
            </div>
          </div>
        </aside>

        {/* Glass auth card */}
        <main className="auth-card">
          <div className="auth-card-inner">
            <div className="auth-brand">
              <span className="auth-brand-mark">⧉</span>
              <div>
                <div className="auth-brand-name">API Rate Limiter</div>
                <div className="auth-brand-sub">admin dashboard</div>
              </div>
            </div>

            <h1 className="auth-heading">
              {isRegister ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="auth-subheading">
              {isRegister
                ? 'Set up admin access to manage keys, limits and traffic.'
                : 'Sign in to manage keys, limits and live traffic.'}
            </p>

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              {isRegister && (
                <label className="field">
                  <span className="field-label">Full name</span>
                  <input
                    type="text"
                    autoComplete="name"
                    placeholder="Ada Lovelace"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </label>
              )}

              <label className="field">
                <span className="field-label">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>

              <label className="field">
                <span className="field-label">Password</span>
                <div className="password-row">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    placeholder={isRegister ? 'At least 8 characters' : '••••••••'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={isRegister ? 8 : undefined}
                    required
                  />
                  <button
                    type="button"
                    className="ghost-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              {error && (
                <div className="auth-error" role="alert">
                  {error}
                </div>
              )}

              <button className="auth-submit" type="submit" disabled={submitting}>
                {submitting ? (
                  <span className="spinner" aria-hidden="true" />
                ) : isRegister ? (
                  'Create account'
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <div className="auth-switch">
              {isRegister ? (
                <>
                  Already have an account?{' '}
                  <button type="button" onClick={() => switchMode(MODE.LOGIN)}>
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  Need admin access?{' '}
                  <button type="button" onClick={() => switchMode(MODE.REGISTER)}>
                    Create an account
                  </button>
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
