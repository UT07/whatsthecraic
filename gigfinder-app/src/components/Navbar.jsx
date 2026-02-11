import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getToken, setToken, setUser, getUser } from '../services/apiClient';

const Navbar = ({ setIsAuthenticated }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    navigate('/auth/login');
  };

  const isAuthenticated = Boolean(getToken());
  const user = getUser();
  const isOrganizer = user?.role === 'organizer' || user?.role === 'admin';

  return (
    <nav className="nav-shell">
      <div className="nav-inner">
        <div className="flex items-center gap-8">
          <Link to={isAuthenticated ? '/dashboard' : '/auth/login'} className="brand">
            WhatsTheCraic
          </Link>
          {isAuthenticated && (
            <div className="nav-links">
              <Link to="/dashboard" className="nav-link">Overview</Link>
              <Link to="/discover" className="nav-link">Discover</Link>
              <Link to="/preferences" className="nav-link">Preferences</Link>
              <Link to="/djs" className="nav-link">DJs</Link>
              <Link to="/venues" className="nav-link">Venues</Link>
              {isOrganizer && <Link to="/organizer" className="nav-link">Organizer</Link>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <span className="chip">{user?.name || 'Member'}</span>
              <button onClick={handleLogout} className="btn btn-outline">Logout</button>
            </>
          ) : (
            <>
              <Link to="/auth/login" className="btn btn-ghost">Login</Link>
              <Link to="/auth/signup" className="btn btn-primary">Create Account</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
