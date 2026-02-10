import React from "react";
import { Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import DJs from "./pages/DJs";
import Venues from "./pages/Venues";
import Events from "./pages/Events";
import Discover from "./pages/Discover";
import Login from "./pages/Auth/Login";
import Signup from "./pages/Auth/Signup";

const App = () => {
  return (
    <div className="flex bg-black text-green-400 min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <Navbar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/djs" element={<DJs />} />
          <Route path="/venues" element={<Venues />} />
          <Route path="/gigs" element={<Events />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/signup" element={<Signup />} />
        </Routes>
      </div>
    </div>
  );
};

export default App;
