// src/App.jsx
import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import DJs from './pages/DJs';
import Venues from './pages/Venues';
import CombinedGigs from './pages/CombinedGigs';
import Login from './pages/Auth/Login';
import Signup from './pages/Auth/Signup';

const getCurrentUser = () => localStorage.getItem('dummyToken');

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = getCurrentUser();
    setIsAuthenticated(!!token);
    setAuthChecked(true);
  }, []);

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center text-green-400 bg-black">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-black text-green-400 min-h-screen">
      <Navbar setIsAuthenticated={setIsAuthenticated} />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="container mx-auto p-4"
      >
        <Routes>
          <Route path="/auth/login" element={<Login setIsAuthenticated={setIsAuthenticated} />} />
          <Route path="/auth/signup" element={<Signup />} />
          {isAuthenticated ? (
            <>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/djs" element={<DJs />} />
              <Route path="/venues" element={<Venues />} />
              <Route path="/discover" element={<CombinedGigs />} />
              <Route path="*" element={<Navigate to="/dashboard" />} />
            </>
          ) : (
            <Route path="*" element={<Navigate to="/auth/login" />} />
          )}
        </Routes>
      </motion.div>
    </div>
  );
};

export default App;
