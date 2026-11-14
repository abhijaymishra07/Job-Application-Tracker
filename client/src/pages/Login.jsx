import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import ThemeToggle from '../components/ThemeToggle';

export default function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [apiUp, setApiUp] = useState(null);
  const [demoReadOnly, setDemoReadOnly] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: 'abhijaymishra07@gmail.com',
    password: 'Demo@123',
    university: '',
  });

  useEffect(() => {
    api
      .get('/health')
      .then((res) => {
        setApiUp(true);
        setDemoReadOnly(Boolean(res.data.demoReadOnly));
      })
      .catch(() => setApiUp(false));
  }, []);

  function update(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'login') {
        await login(form.email.trim(), form.password);
      } else {
        await register({ ...form, email: form.email.trim() });
      }
    } catch (err) {
      if (!err.response) {
        setError('Unable to reach JobTrack. Please try again in a moment.');
      } else {
        setError(err.response.data?.message || 'Could not sign in.');
      }
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-theme">
        <ThemeToggle />
      </div>
      <div className="auth-card">
        <div className="brand">
          <div className="brand-mark">JT</div>
          <div>
            <b>JobTrack</b>
            <small>Track every application</small>
          </div>
        </div>
        <h1>{mode === 'login' ? 'Welcome back' : 'Create your workspace'}</h1>
        <p>Keep applications, interviews, notes, and documents in one place.</p>
        {mode === 'login' && demoReadOnly ? (
          <small style={{ display: 'block', marginBottom: 12, opacity: 0.75 }}>
            The pre-filled demo account is view-only. Create an account to add your own applications.
          </small>
        ) : null}
        {apiUp === false ? (
          <div className="error">JobTrack is temporarily unavailable. Please try again.</div>
        ) : null}
        {error ? <div className="error">{error}</div> : null}
        <form onSubmit={onSubmit}>
          {mode === 'register' ? (
            <>
              <input name="name" placeholder="Full name" value={form.name} onChange={update} required />
              <input
                name="university"
                placeholder="University or school (optional)"
                value={form.university}
                onChange={update}
              />
            </>
          ) : null}
          <input
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={update}
            required
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={update}
            required
          />
          <button className="btn" type="submit" disabled={apiUp === false}>
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <button
          className="btn ghost"
          type="button"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'Need an account? Register' : 'Already registered? Sign in'}
        </button>
      </div>
    </div>
  );
}
