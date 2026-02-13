import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getToken, setToken, setUser, getUser } from '../services/apiClient';

const Navbar = ({ setIsAuthenticated }) => {
  const navigate = useNavigate();
  const location = useLocation();
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
  const isAdmin = user?.role === 'admin';

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { to: '/dashboard', label: 'Home' },
    { to: '/discover', label: 'Discover' },
    { to: '/djs', label: 'Artists' },
    { to: '/venues', label: 'Venues' },
    { to: '/preferences', label: 'Taste' },
  ];

  if (isOrganizer) navItems.push({ to: '/organizer', label: 'Organizer' });

  return (
    <nav className="nav-shell">
      <div className="nav-inner">
        <div className="flex items-center gap-8">
          <Link to={isAuthenticated ? '/dashboard' : '/auth/login'} className="brand">
            <div className="brand-icon">W</div>
            <span>WhatsTheCraic</span>
          </Link>
          {isAuthenticated && (
            <div className="hidden md:flex nav-links">
              {navItems.map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`nav-link ${isActive(item.to) ? 'active' : ''}`}
                  style={isActive(item.to) ? { color: 'var(--ink)', background: 'rgba(255,255,255,0.06)' } : {}}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <div className="hidden sm:flex items-center gap-3">
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.35rem 0.7rem 0.35rem 0.4rem',
                  borderRadius: 8, background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--line)'
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 7,
                    background: 'var(--emerald-dim)', color: 'var(--emerald)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 700
                  }}>
                    {(user?.name || 'U')[0].toUpperCase()}
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--ink-2)' }}>
                    {user?.name || 'Member'}
                  </span>
                  {(isAdmin || isOrganizer) && (
                    <span style={{
                      fontSize: '0.58rem', fontWeight: 700, padding: '0.1rem 0.35rem',
                      borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em',
                      background: isAdmin ? 'rgba(255,92,92,0.15)' : 'rgba(0,214,125,0.15)',
                      color: isAdmin ? '#ff5c5c' : 'var(--emerald)'
                    }}>
                      {user?.role}
                    </span>
                  )}
                </div>
                <button onClick={handleLogout} className="btn btn-ghost btn-sm">
                  Sign out
                </button>
              </div>
              <div className="md:hidden">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="btn btn-ghost btn-icon"
                  style={{ fontSize: '1.2rem' }}
                >
                  {menuOpen ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/auth/login" className="btn btn-ghost btn-sm hidden sm:inline-flex">Sign in</Link>
              <Link to="/auth/signup" className="btn btn-primary btn-sm">Get started</Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && isAuthenticated && (
        <div style={{
          borderTop: '1px solid var(--line)',
          padding: '0.75rem 1rem',
          background: 'rgba(10, 10, 10, 0.95)'
        }}>
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className="nav-link"
              style={{
                display: 'block',
                padding: '0.65rem 0.75rem',
                borderRadius: 8,
                ...(isActive(item.to) ? { color: 'var(--ink)', background: 'rgba(255,255,255,0.06)' } : {})
              }}
            >
              {item.label}
            </Link>
          ))}
          <div style={{ borderTop: '1px solid var(--line)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
            <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }}>
              Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
