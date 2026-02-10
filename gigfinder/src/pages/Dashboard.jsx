import React from "react";
import BarChart from "../components/Charts/BarChart";
import PieChart from "../components/Charts/PieChart";

const Dashboard = () => {
  return (
    <div className="p-5">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-5 mt-5">
        <BarChart />
        <PieChart />
      </div>
    </div>
  );
};

export default Dashboard;
