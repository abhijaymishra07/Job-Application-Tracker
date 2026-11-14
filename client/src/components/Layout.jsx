import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/applications', label: 'Applications', end: true },
  { to: '/applications/new', label: 'Add application' },
  { to: '/upcoming', label: 'Upcoming' },
  { to: '/insights', label: 'Response tracker' },
  { to: '/offers', label: 'Compare offers' },
  { to: '/analytics', label: 'Analytics' },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">JT</div>
          <div>
            <b>JobTrack</b>
            <small>Your job hunt, in one place</small>
          </div>
        </div>
        <NotificationBell />
        <nav className="nav-links">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <ThemeToggle />
          <p>
            {user?.name}
            <br />
            {user?.email}
          </p>
          <button className="btn secondary" type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
