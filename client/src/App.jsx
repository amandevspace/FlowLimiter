// client/src/App.jsx
import { useState } from 'react';
import KeysPage from './pages/KeysPage';
import ComparePage from './pages/ComparePage';
import LoginPage from './pages/LoginPage';
import { useAuth } from './context/AuthContext';
import './App.css';

function App() {
  const [tab, setTab] = useState('keys');
  const { isAuthenticated, checking, user, logout } = useAuth();

  if (checking) {
    return <div className="auth-check-splash">Loading…</div>;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <>
      <header className="app-header">
        <span className="app-title">API Rate Limiter</span>
        <span className="app-subtitle">admin dashboard</span>
        <nav className="app-tabs">
          <button
            className={tab === 'keys' ? 'tab-active' : ''}
            onClick={() => setTab('keys')}
          >
            Keys
          </button>
          <button
            className={tab === 'compare' ? 'tab-active' : ''}
            onClick={() => setTab('compare')}
          >
            Compare
          </button>
        </nav>
        <div className="app-account">
          {user?.name && <span className="app-account-name">{user.name}</span>}
          <button className="app-logout" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      {tab === 'keys' ? <KeysPage /> : <ComparePage />}
    </>
  );
}

export default App;