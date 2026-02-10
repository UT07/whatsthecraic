import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const Sidebar = () => {
  return (
    <motion.aside
      initial={{ x: -200 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.5 }}
      className="w-64 bg-gray-900 p-5 min-h-screen"
    >
      <h1 className="text-xl font-bold text-green-400">🎵 GigFinder</h1>
      <nav className="mt-5">
        <ul className="space-y-3">
          <li><Link to="/" className="text-green-400">Dashboard</Link></li>
          <li><Link to="/djs" className="text-green-400">DJs</Link></li>
          <li><Link to="/venues" className="text-green-400">Venues</Link></li>
          <li><Link to="/gigs" className="text-green-400">Events</Link></li>
          <li><Link to="/discover" className="text-green-400">Discover</Link></li>
        </ul>
      </nav>
    </motion.aside>
  );
};

export default Sidebar;
