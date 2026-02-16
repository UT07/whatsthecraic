import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import authAPI from '../../services/authAPI';
import eventsAPI from '../../services/eventsAPI';

// Register Chart.js components
ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

/**
 * TasteProfilePanel - Displays user's musical taste profile
 * Shows a radar chart of genre affinities based on Spotify data and saved events
 */
const TasteProfilePanel = () => {
  const [profile, setProfile] = useState(null);
  const [savedEvents, setSavedEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [spotifyProfile, saved] = await Promise.all([
          authAPI.getSpotifyProfile().catch(() => null),
          eventsAPI.getSavedEvents().catch(() => [])
        ]);
        setProfile(spotifyProfile);
        setSavedEvents(Array.isArray(saved) ? saved : saved?.events || []);
      } catch (error) {
        console.error('Taste profile load error:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="card" style={{ padding: '2rem' }}>
        <div className="skeleton" style={{ height: 250, borderRadius: 12 }} />
      </div>
    );
  }

  // Build genre affinity map from Spotify and saved events
  const genreMap = {};

  // Add Spotify genres (higher weight)
  const spotifyGenres = profile?.top_genres || [];
  spotifyGenres.forEach((g, index) => {
    const genre = typeof g === 'object' ? g.genre : g;
    const count = typeof g === 'object' ? g.count : spotifyGenres.length - index;
    genreMap[genre] = (genreMap[genre] || 0) + (count * 2);
  });

  // Add saved event genres
  savedEvents.forEach(event => {
    const genres = event.genres || [];
    genres.forEach(genre => {
      genreMap[genre] = (genreMap[genre] || 0) + 1;
    });
  });

  // Get top 6-8 genres
  const topGenres = Object.entries(genreMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([genre, count]) => ({ genre, count }));

  if (topGenres.length === 0) {
    return (
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: '2rem',
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.06) 0%, rgba(0, 0, 0, 0) 100%)',
          borderColor: 'rgba(167, 139, 250, 0.15)'
        }}
      >
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: 'rgba(167, 139, 250, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1rem',
          color: '#a78bfa'
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
          </svg>
        </div>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Build your taste profile
        </h3>
        <p style={{ fontSize: '0.85rem', color: '#a0a0a0', marginBottom: '1.25rem' }}>
          Connect Spotify and save events to see your musical preferences visualized
        </p>
      </motion.div>
    );
  }

  // Normalize counts to 0-100 scale
  const maxCount = Math.max(...topGenres.map(g => g.count));
  const normalizedData = topGenres.map(g => Math.round((g.count / maxCount) * 100));

  const chartData = {
    labels: topGenres.map(g => g.genre),
    datasets: [{
      label: 'Genre Affinity',
      data: normalizedData,
      backgroundColor: 'rgba(167, 139, 250, 0.15)',
      borderColor: '#a78bfa',
      borderWidth: 2,
      pointBackgroundColor: '#a78bfa',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: '#a78bfa',
      pointRadius: 4,
      pointHoverRadius: 6
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#a78bfa',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (context) => `Affinity: ${context.parsed.r}%`
        }
      }
    },
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: {
          stepSize: 25,
          color: '#a0a0a0',
          backdropColor: 'transparent',
          font: {
            size: 10
          }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.08)'
        },
        pointLabels: {
          color: '#f5f5f5',
          font: {
            size: 12,
            weight: 600
          }
        }
      }
    }
  };

  // Calculate diversity score (how evenly distributed)
  const diversity = topGenres.length >= 5 ? 'High' : topGenres.length >= 3 ? 'Medium' : 'Focused';
  const diversityColor = diversity === 'High' ? '#00d67d' : diversity === 'Medium' ? '#f5a623' : '#4fc3f7';

  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: '1.5rem',
        background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.06) 0%, rgba(0, 0, 0, 0) 100%)',
        borderColor: 'rgba(167, 139, 250, 0.15)'
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'rgba(167, 139, 250, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#a78bfa',
            flexShrink: 0
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14 2 9.27l6.91-1.01z"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.1rem' }}>
              Your Taste Profile
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#a0a0a0' }}>
              Based on {spotifyGenres.length > 0 ? 'Spotify + ' : ''}{savedEvents.length} saved events
            </p>
          </div>
          <div style={{
            padding: '0.3rem 0.7rem',
            background: `${diversityColor}22`,
            color: diversityColor,
            borderRadius: 6,
            fontSize: '0.7rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {diversity} diversity
          </div>
        </div>
      </div>

      {/* Radar Chart */}
      <div style={{ height: 280, marginBottom: '1rem' }}>
        <Radar data={chartData} options={chartOptions} />
      </div>

      {/* Genre List */}
      <div>
        <div style={{
          fontSize: '0.72rem',
          color: '#a0a0a0',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '0.6rem'
        }}>
          Top Genres
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {topGenres.slice(0, 6).map((g, i) => (
            <span
              key={g.genre}
              className="chip"
              style={{
                fontSize: '0.72rem',
                padding: '0.25rem 0.6rem',
                background: i < 3 ? 'rgba(167, 139, 250, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                borderColor: i < 3 ? 'rgba(167, 139, 250, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                color: i < 3 ? '#a78bfa' : '#f5f5f5'
              }}
            >
              {g.genre}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default TasteProfilePanel;
