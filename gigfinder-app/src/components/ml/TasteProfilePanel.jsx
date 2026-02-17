import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Radar, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
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
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const normalizeToken = (value) => (value || '').toString().toLowerCase().trim();

const toGenreCountMap = (items) => {
  const map = new Map();
  (Array.isArray(items) ? items : []).forEach((item, index) => {
    const genre = normalizeToken(typeof item === 'string' ? item : item?.genre || item?.name || '');
    if (!genre) return;
    const count = Number(typeof item === 'object' ? item?.count : null) || Math.max((items.length - index), 1);
    map.set(genre, (map.get(genre) || 0) + count);
  });
  return map;
};

const sumMapValues = (map) => {
  let total = 0;
  map.forEach((value) => {
    total += Number(value || 0);
  });
  return total;
};

const normalizePercent = (value, max) => {
  if (!max || max <= 0) return 0;
  return Math.round((Number(value || 0) / max) * 100);
};

const TasteProfilePanel = () => {
  const [spotifyProfile, setSpotifyProfile] = useState(null);
  const [soundcloudProfile, setSoundcloudProfile] = useState(null);
  const [savedEvents, setSavedEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [spotifyData, soundcloudData, saved] = await Promise.all([
          authAPI.getSpotifyProfile().catch(() => null),
          authAPI.getSoundCloudProfile().catch(() => null),
          eventsAPI.getSavedEvents().catch(() => [])
        ]);
        setSpotifyProfile(spotifyData);
        setSoundcloudProfile(soundcloudData);
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

  const spotifyGenreMap = toGenreCountMap(spotifyProfile?.top_genres || []);
  const soundcloudGenreMap = toGenreCountMap(soundcloudProfile?.top_genres || []);
  const savedGenreMap = (() => {
    const map = new Map();
    savedEvents.forEach((event) => {
      const genres = Array.isArray(event?.genres) ? event.genres : [];
      genres.forEach((genre) => {
        const token = normalizeToken(genre);
        if (!token) return;
        map.set(token, (map.get(token) || 0) + 1);
      });
    });
    return map;
  })();

  const combinedGenreMap = (() => {
    const map = new Map();
    spotifyGenreMap.forEach((value, genre) => {
      map.set(genre, (map.get(genre) || 0) + (value * 2));
    });
    soundcloudGenreMap.forEach((value, genre) => {
      map.set(genre, (map.get(genre) || 0) + Math.round(value * 1.8));
    });
    savedGenreMap.forEach((value, genre) => {
      map.set(genre, (map.get(genre) || 0) + value);
    });
    return map;
  })();

  const topGenres = Array.from(combinedGenreMap.entries())
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
          Connect Spotify or SoundCloud and save events to see your musical preferences visualized
        </p>
      </motion.div>
    );
  }

  const maxCount = Math.max(...topGenres.map(g => g.count));
  const normalizedData = topGenres.map(g => Math.round((g.count / maxCount) * 100));

  const radarData = {
    labels: topGenres.map(g => g.genre),
    datasets: [{
      label: 'Combined Taste Affinity',
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

  const radarOptions = {
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

  const compareLabels = topGenres.slice(0, 6).map((item) => item.genre);
  const spotifyMax = Math.max(sumMapValues(spotifyGenreMap) > 0 ? Math.max(...Array.from(spotifyGenreMap.values())) : 0, 1);
  const soundcloudMax = Math.max(sumMapValues(soundcloudGenreMap) > 0 ? Math.max(...Array.from(soundcloudGenreMap.values())) : 0, 1);
  const compareData = {
    labels: compareLabels,
    datasets: [
      {
        label: 'Spotify',
        data: compareLabels.map((genre) => normalizePercent(spotifyGenreMap.get(genre), spotifyMax)),
        backgroundColor: 'rgba(29,185,84,0.45)',
        borderColor: '#1DB954',
        borderWidth: 1
      },
      {
        label: 'SoundCloud',
        data: compareLabels.map((genre) => normalizePercent(soundcloudGenreMap.get(genre), soundcloudMax)),
        backgroundColor: 'rgba(255,140,66,0.45)',
        borderColor: '#ff8c42',
        borderWidth: 1
      }
    ]
  };

  const compareOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        min: 0,
        max: 100,
        ticks: { color: '#a0a0a0' },
        grid: { color: 'rgba(255,255,255,0.08)' }
      },
      x: {
        ticks: { color: '#d0d0d0' },
        grid: { color: 'rgba(255,255,255,0.03)' }
      }
    },
    plugins: {
      legend: {
        labels: {
          color: '#f5f5f5',
          boxWidth: 12
        }
      }
    }
  };

  const spotifyTotal = sumMapValues(spotifyGenreMap);
  const soundcloudTotal = sumMapValues(soundcloudGenreMap);
  const savedTotal = sumMapValues(savedGenreMap);
  const sourceData = {
    labels: ['Spotify', 'SoundCloud', 'Saved Events'],
    datasets: [{
      data: [spotifyTotal, soundcloudTotal, savedTotal],
      backgroundColor: ['#1DB954', '#ff8c42', '#4fc3f7'],
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)'
    }]
  };

  const sourceOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#d0d0d0', boxWidth: 12, padding: 12 }
      }
    }
  };

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
              Built from Spotify, SoundCloud, and {savedEvents.length} saved events
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

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginBottom: '1rem' }}>
        <div style={{ height: 280 }}>
          <Radar data={radarData} options={radarOptions} />
        </div>
        <div style={{ height: 280 }}>
          <Bar data={compareData} options={compareOptions} />
        </div>
        <div style={{ height: 280 }}>
          <Doughnut data={sourceData} options={sourceOptions} />
        </div>
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
