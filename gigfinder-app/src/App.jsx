// src/App.jsx
import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import DJs from './pages/DJs';
import Venues from './pages/Venues';
import CombinedGigs from './pages/CombinedGigs';
import Organizer from './pages/Organizer';
import Preferences from './pages/Preferences';
import AdminML from './pages/AdminML';
import Login from './pages/Auth/Login';
import Signup from './pages/Auth/Signup';
import ForgotPassword from './pages/Auth/ForgotPassword';
import { getToken, getUser } from './services/apiClient';

const getCurrentUser = () => getToken();

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = getCurrentUser();
    const user = getUser();
    setIsAuthenticated(!!token);
    setIsAdmin(user?.role === 'admin');
    setAuthChecked(true);
  }, []);

  return (
    <div className="app-shell">
      <div className="site-bg" aria-hidden="true" />
      <Navbar setIsAuthenticated={setIsAuthenticated} />
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="app-content"
      >
        {!authChecked ? (
          <div className="card max-w-md mx-auto text-center">
            <p className="text-muted">Loading your experience...</p>
          </div>
        ) : (
          <Routes>
            <Route path="/auth/login" element={<Login setIsAuthenticated={setIsAuthenticated} />} />
            <Route path="/auth/signup" element={<Signup />} />
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            {isAuthenticated ? (
              <>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/djs" element={<DJs />} />
                <Route path="/venues" element={<Venues />} />
                <Route path="/discover" element={<CombinedGigs />} />
                <Route path="/organizer" element={<Organizer />} />
                <Route path="/preferences" element={<Preferences />} />
                {isAdmin && <Route path="/admin/ml" element={<AdminML />} />}
                <Route path="*" element={<Navigate to="/dashboard" />} />
              </>
            ) : (
              <Route path="*" element={<Navigate to="/auth/login" />} />
            )}
          </Routes>
        )}
      </motion.main>
    </div>
  );
};

export default App;
