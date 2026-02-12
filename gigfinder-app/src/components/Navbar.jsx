import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getToken, setToken, setUser, getUser } from '../services/apiClient';

const Navbar = ({ setIsAuthenticated }) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

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
        <div className="flex items-center gap-12">
          <Link to={isAuthenticated ? '/dashboard' : '/auth/login'} className="brand">
            🎵 WhatsTheCraic
          </Link>
          {isAuthenticated && (
            <div className="hidden md:flex nav-links">
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
              <div className="hidden sm:flex items-center gap-3">
                <span className="chip">{user?.name || 'Member'}</span>
                <button
                  onClick={handleLogout}
                  className="btn btn-outline"
                >
                  Sign out
                </button>
              </div>
              <div className="md:hidden">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="btn btn-ghost"
                >
                  ☰
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/auth/login" className="btn btn-ghost hidden sm:inline-flex">Sign in</Link>
              <Link to="/auth/signup" className="btn btn-primary">Get started</Link>
            </>
          )}
        </div>
      </div>

      {menuOpen && isAuthenticated && (
        <div className="md:hidden border-t border-line px-4 py-4 space-y-2">
          <Link to="/dashboard" className="block py-2 text-sm font-medium text-muted hover:text-ink transition-colors">Overview</Link>
          <Link to="/discover" className="block py-2 text-sm font-medium text-muted hover:text-ink transition-colors">Discover</Link>
          <Link to="/preferences" className="block py-2 text-sm font-medium text-muted hover:text-ink transition-colors">Preferences</Link>
          <Link to="/djs" className="block py-2 text-sm font-medium text-muted hover:text-ink transition-colors">DJs</Link>
          <Link to="/venues" className="block py-2 text-sm font-medium text-muted hover:text-ink transition-colors">Venues</Link>
          {isOrganizer && <Link to="/organizer" className="block py-2 text-sm font-medium text-muted hover:text-ink transition-colors">Organizer</Link>}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
