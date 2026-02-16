import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

/**
 * ExplainabilityModal - Shows why an event was recommended
 * Displays rank_reasons as a visual bar chart showing which factors contributed
 * to the recommendation score.
 */
const ExplainabilityModal = ({ isOpen, onClose, event }) => {
  if (!isOpen || !event) return null;

  // Parse rank_reasons - could be array of strings or objects
  const reasons = typeof event.rank_reasons === 'string'
    ? event.rank_reasons.split(',').map(r => r.trim())
    : (event.rank_reasons || []);

  // Map reason strings to human-readable labels and weights
  const reasonWeights = {
    'artist_match': { label: 'Artist Match', weight: 5, color: '#1DB954' },
    'venue_match': { label: 'Favorite Venue', weight: 4, color: '#4fc3f7' },
    'spotify_artist': { label: 'Spotify Artist', weight: 4, color: '#1DB954' },
    'genre_match': { label: 'Genre Match', weight: 3, color: '#a78bfa' },
    'spotify_genre': { label: 'Spotify Genre', weight: 2, color: '#9b59b6' },
    'city_match': { label: 'Your City', weight: 2, color: '#00d67d' },
    'collaborative': { label: 'Fans Like You', weight: 3, color: '#4fc3f7' },
    'popularity': { label: 'Trending', weight: 2, color: '#f5a623' },
    'budget_match': { label: 'Budget Match', weight: 1, color: '#95a5a6' },
    'recency': { label: 'Recent Event', weight: 1, color: '#e67e22' },
    'day_match': { label: 'Preferred Day', weight: 1, color: '#3498db' }
  };

  // Build chart data from reasons
  const chartData = reasons
    .map(reason => {
      const key = typeof reason === 'object' ? reason.type : reason;
      const weight = typeof reason === 'object' ? reason.weight : reasonWeights[key]?.weight || 1;
      const config = reasonWeights[key];

      if (!config) return null;

      return {
        label: config.label,
        weight: weight,
        color: config.color
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.weight - a.weight);

  const chartConfig = {
    labels: chartData.map(d => d.label),
    datasets: [{
      label: 'Match Score Contribution',
      data: chartData.map(d => d.weight),
      backgroundColor: chartData.map(d => `${d.color}88`),
      borderColor: chartData.map(d => d.color),
      borderWidth: 2,
      borderRadius: 6
    }]
  };

  const chartOptions = {
    indexAxis: 'y',
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
        borderColor: '#00d67d',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (context) => `Score: +${context.parsed.x}`
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)'
        },
        ticks: {
          color: '#a0a0a0'
        }
      },
      y: {
        grid: {
          display: false
        },
        ticks: {
          color: '#f5f5f5',
          font: {
            size: 13,
            weight: 600
          }
        }
      }
    }
  };

  const totalScore = chartData.reduce((sum, d) => sum + d.weight, 0);
  const matchPercentage = event.rank_score
    ? Math.round(event.rank_score * 100)
    : Math.min(Math.round((totalScore / 15) * 100), 100);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(4px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}
          >
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="card"
              style={{
                maxWidth: 600,
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: '2rem',
                background: '#111',
                borderColor: '#00d67d33'
              }}
            >
              {/* Header */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.3rem 0.7rem',
                      background: matchPercentage > 70 ? '#00d67d22' : matchPercentage > 40 ? '#f5a62322' : '#ffffff11',
                      color: matchPercentage > 70 ? '#00d67d' : matchPercentage > 40 ? '#f5a623' : '#a0a0a0',
                      borderRadius: 8,
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      marginBottom: '0.5rem'
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14 2 9.27l6.91-1.01z"/>
                      </svg>
                      {matchPercentage}% Match
                    </div>
                    <h2 style={{
                      fontSize: '1.3rem',
                      fontWeight: 800,
                      lineHeight: 1.25,
                      marginBottom: '0.25rem'
                    }}>
                      Why this event?
                    </h2>
                    <p style={{ fontSize: '0.9rem', color: '#a0a0a0' }}>
                      {event.title}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="btn btn-ghost"
                    style={{
                      padding: '0.5rem',
                      minWidth: 'auto',
                      fontSize: '1.2rem',
                      lineHeight: 1
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Chart */}
              {chartData.length > 0 ? (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#a0a0a0',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '1rem'
                  }}>
                    Match Factors
                  </div>
                  <div style={{ height: Math.max(chartData.length * 50, 200) }}>
                    <Bar data={chartConfig} options={chartOptions} />
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '2rem',
                  textAlign: 'center',
                  background: '#0a0a0a',
                  borderRadius: 12,
                  marginBottom: '1.5rem'
                }}>
                  <p style={{ color: '#a0a0a0', fontSize: '0.9rem' }}>
                    This event was recommended based on general popularity and availability.
                  </p>
                </div>
              )}

              {/* Summary */}
              <div style={{
                padding: '1.25rem',
                background: 'linear-gradient(135deg, rgba(0, 214, 125, 0.06) 0%, rgba(0, 0, 0, 0) 100%)',
                border: '1px solid rgba(0, 214, 125, 0.15)',
                borderRadius: 12
              }}>
                <h3 style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  marginBottom: '0.5rem',
                  color: '#00d67d'
                }}>
                  What does this mean?
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#f5f5f5', lineHeight: 1.6 }}>
                  Our AI analyzes your Spotify listening habits, saved events, and preferences to find
                  events that match your taste. The higher the match score, the more confident we are
                  that you'll enjoy this event.
                </p>
              </div>

              {/* Close button */}
              <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <button onClick={onClose} className="btn btn-outline" style={{ minWidth: 120 }}>
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ExplainabilityModal;
