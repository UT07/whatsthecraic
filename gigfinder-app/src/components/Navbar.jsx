import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = ({ setIsAuthenticated }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('dummyToken');
    setIsAuthenticated(false);
    navigate('/auth/login');
  };

  const isAuthenticated = localStorage.getItem('dummyToken') ? true : false;

  return (
    <nav className="bg-gray-900 p-4 flex justify-between items-center">
      <div className="flex space-x-4">
        <span className="text-green-400 font-bold text-xl mr-6">WhatstheCraic</span>
        {isAuthenticated && (
          <>
            <Link to="/dashboard" className="hover:text-green-300">Dashboard</Link>
            <Link to="/djs" className="hover:text-green-300">DJs</Link>
            <Link to="/venues" className="hover:text-green-300">Venues</Link>
            <Link to="/discover" className="hover:text-green-300">Discover</Link>
          </>
        )}
      </div>
      <div className="flex items-center space-x-4">
        <input
          type="text"
          placeholder="Search..."
          className="px-2 py-1 rounded bg-gray-800 text-green-400 placeholder-green-400"
        />
        {isAuthenticated ? (
          <button onClick={handleLogout} className="hover:text-green-300">Logout</button>
        ) : (
          <>
            <Link to="/auth/login" className="hover:text-green-300">Login</Link>
            <Link to="/auth/signup" className="hover:text-green-300">Signup</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
