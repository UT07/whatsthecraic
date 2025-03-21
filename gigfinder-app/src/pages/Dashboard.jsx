// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Doughnut, Bar, Scatter, Bubble } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import eventsAPI from '../services/eventsAPI';
import djAPI from '../services/djAPI';
import aggregatorAPI from '../services/aggregatorAPI';
import venueAPI from '../services/venueAPI';

Chart.register(...registerables);

// Common options for Chart.js charts
const commonOptions = {
  plugins: {
    legend: {
      labels: { font: { size: 16 } },
    },
    tooltip: {
      bodyFont: { size: 16 },
      titleFont: { size: 18 },
    },
  },
  layout: { padding: 20 },
};

// Helper: Compute events by city for Doughnut chart
const computeEventsByCity = (events = []) => {
  const cityCount = {};
  events.forEach(event => {
    if (event.city) {
      const city = event.city.trim();
      cityCount[city] = (cityCount[city] || 0) + 1;
    }
  });
  const labels = Object.keys(cityCount);
  const data = labels.map(city => cityCount[city]);
  const palette = [
    'rgba(255, 99, 132, 0.8)',
    'rgba(54, 162, 235, 0.8)',
    'rgba(255, 206, 86, 0.8)',
    'rgba(75, 192, 192, 0.8)',
    'rgba(153, 102, 255, 0.8)',
    'rgba(255, 159, 64, 0.8)',
    'rgba(199, 21, 133, 0.8)',
    'rgba(100, 149, 237, 0.8)'
  ];
  const backgroundColor = labels.map((_, i) => palette[i % palette.length]);
  return {
    labels,
    datasets: [{ label: 'Events by City', data, backgroundColor }],
  };
};

// Helper: Compute top DJs by fee for Bar chart
const computeTopDJsByFee = (djs = []) => {
  const sorted = djs
    .filter(dj => dj.numeric_fee !== null && dj.numeric_fee !== undefined)
    .sort((a, b) => parseFloat(b.numeric_fee) - parseFloat(a.numeric_fee))
    .slice(0, 5);
  const labels = sorted.map(dj => dj.dj_name);
  const data = sorted.map(dj => parseFloat(dj.numeric_fee));
  const colors = [
    'rgba(255, 99, 132, 0.8)',
    'rgba(54, 162, 235, 0.8)',
    'rgba(255, 206, 86, 0.8)',
    'rgba(75, 192, 192, 0.8)',
    'rgba(153, 102, 255, 0.8)',
  ];
  return {
    labels,
    datasets: [{ label: 'Top DJs by Fee', data, backgroundColor: colors.slice(0, data.length) }],
  };
};

// Helper: Compute DJ genre distribution for Scatter Plot
const computeDJGenresForScatter = (djs = []) => {
  const genreCount = {};
  djs.forEach(dj => {
    if (dj.genres) {
      dj.genres.split(',').forEach(g => {
        const genre = g.trim();
        if (genre) {
          genreCount[genre] = (genreCount[genre] || 0) + 1;
        }
      });
    }
  });
  const genres = Object.keys(genreCount);
  const scatterData = genres.map(genre => ({ x: genre, y: genreCount[genre] }));
  return {
    datasets: [{
      label: 'DJ Genre Distribution',
      data: scatterData,
      backgroundColor: 'rgba(75,192,192,1)',
      borderColor: 'rgba(75,192,192,0.5)',
      pointRadius: 6,
    }],
  };
};

// Helper: Compute event count per venue
const computeEventCountByVenue = (events = [], aggregatorEvents, venues = []) => {
  // Ensure aggregatorEvents is an array; if not, default to an empty array.
  const aggregatorArr = Array.isArray(aggregatorEvents) ? aggregatorEvents : [];
  // Merge events from eventsAPI and aggregatorAPI
  const allEvents = [...events, ...aggregatorArr];
  // Count events per venue (using case-insensitive keys)
  const venueEventCount = {};
  allEvents.forEach(event => {
    if (event.venue_name) {
      const venueName = event.venue_name.trim().toLowerCase();
      venueEventCount[venueName] = (venueEventCount[venueName] || 0) + 1;
    }
  });
  // For each venue from venueAPI, get the count (default 0 if none)
  const labels = venues.map(venue => venue.name);
  const data = labels.map(label => {
    const key = label.trim().toLowerCase();
    return venueEventCount[key] || 0;
  });
  // Use a palette for bars
  const palette = [
    'rgba(255, 99, 132, 0.8)',
    'rgba(54, 162, 235, 0.8)',
    'rgba(255, 206, 86, 0.8)',
    'rgba(75, 192, 192, 0.8)',
    'rgba(153, 102, 255, 0.8)',
    'rgba(255, 159, 64, 0.8)',
    'rgba(199, 21, 133, 0.8)',
    'rgba(100, 149, 237, 0.8)'
  ];
  const backgroundColor = labels.map((_, i) => palette[i % palette.length]);
  return { labels, data, backgroundColor };
};

const Dashboard = () => {
  const [graphs, setGraphs] = useState(null);
  const [scatterData, setScatterData] = useState(null);
  const [venueData, setVenueData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      eventsAPI.getAllEvents(),
      aggregatorAPI.searchEvents({}),
      djAPI.getAllDJs(),
      venueAPI.getAllVenues()
    ])
      .then(([events, aggregatorEvents, djs, venues]) => {
        const cityData = computeEventsByCity(events);
        const topDJsData = computeTopDJsByFee(djs);
        const djGenreScatter = computeDJGenresForScatter(djs);
        const venueCountData = computeEventCountByVenue(events, aggregatorEvents, venues);
        setGraphs({ cityData, topDJsData });
        setScatterData(djGenreScatter);
        setVenueData(venueCountData);
        setLoading(false);
      })
      .catch(error => {
        console.error("Error fetching dashboard data:", error);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="text-green-400">Loading Dashboard...</p>;
  if (!graphs || !scatterData || !venueData) return <p className="text-green-400">No data available</p>;

  // Build dataset for Venue Event Count chart (Bar chart)
  const venueChartData = {
    labels: venueData.labels,
    datasets: [{
      label: 'Number of Events',
      data: venueData.data,
      backgroundColor: venueData.backgroundColor,
    }],
  };

  return (
    <div className="grid gap-6">
      {/* Doughnut Chart for Events by City */}
      <div className="bg-gray-800 p-4 rounded">
        <h2 className="text-2xl mb-2">Events by City</h2>
        <Doughnut data={graphs.cityData} options={commonOptions} />
      </div>
      {/* Bar Chart for Top DJs by Fee */}
      <div className="bg-gray-800 p-4 rounded">
        <h2 className="text-2xl mb-2">Top DJs by Fee</h2>
        <Bar data={graphs.topDJsData} options={commonOptions} />
      </div>
      {/* Bar Chart for Event Count by Venue */}
      <div className="bg-gray-800 p-4 rounded">
        <h2 className="text-2xl mb-2">Event Count by Venue</h2>
        <Bar data={venueChartData} options={commonOptions} />
      </div>
      {/* Scatter Plot for DJ Genre Distribution */}
      <div className="bg-gray-800 p-4 rounded">
        <h2 className="text-2xl mb-2">DJ Genre Distribution (Scatter Plot)</h2>
        <Scatter 
          data={scatterData} 
          options={{
            ...commonOptions,
            scales: {
              x: {
                type: 'category',
                labels: scatterData.datasets[0].data.map(point => point.x),
                title: {
                  display: true,
                  text: 'Genre',
                  font: { size: 18 },
                },
                ticks: { font: { size: 16 } }
              },
              y: {
                title: {
                  display: true,
                  text: 'Frequency',
                  font: { size: 18 },
                },
                ticks: { font: { size: 16 } }
              }
            }
          }} 
        />
      </div>
    </div>
  );
};

export default Dashboard;
