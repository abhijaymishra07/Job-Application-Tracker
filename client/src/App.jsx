import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Applications from './pages/Applications';
import ApplicationForm from './pages/ApplicationForm';
import ApplicationDetail from './pages/ApplicationDetail';
import Analytics from './pages/Analytics';
import Upcoming from './pages/Upcoming';
import Insights from './pages/Insights';
import Offers from './pages/Offers';

function Private({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="main">Loading workspace…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user, ready } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={ready && user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <Private>
            <Layout />
          </Private>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="applications" element={<Applications />} />
        <Route path="applications/new" element={<ApplicationForm />} />
        <Route path="applications/:id" element={<ApplicationDetail />} />
        <Route path="applications/:id/edit" element={<ApplicationForm />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="upcoming" element={<Upcoming />} />
        <Route path="insights" element={<Insights />} />
        <Route path="offers" element={<Offers />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
