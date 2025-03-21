import React from 'react';
import { Link } from 'react-router-dom';

const Sidebar = () => {
  return (
    <aside className="bg-gray-800 p-4 w-64">
      <nav>
        <ul>
          <li><Link to="/dashboard">Dashboard</Link></li>
          <li><Link to="/djs">DJs</Link></li>
          <li><Link to="/venues">Venues</Link></li>
          <li><Link to="/gigs">Gigs</Link></li>
          <li><Link to="/discover">Discover</Link></li>
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
