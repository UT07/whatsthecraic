import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import eventsAPI from '../../services/eventsAPI';
import BetterHeatMap from '../BetterHeatMap';

/**
 * EventDensityHeatMap - Shows event density by day of week
 * Uses BetterHeatMap component with real event data
 */
const EventDensityHeatMap = ({ genre = null, city = null }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEvents = async () => {
      setLoading(true);
      try {
        const filters = { limit: 500 };
        if (genre) filters.genres = genre;
        if (city) filters.city = city;

        const result = await eventsAPI.searchEvents(filters);
        setEvents(result.events || []);
      } catch (error) {
        console.error('Event density load error:', error);
      } finally {
        setLoading(false);
      }
    };
    loadEvents();
  }, [genre, city]);

  if (loading) {
    return (
      <div className="card" style={{ padding: '1.5rem' }}>
        <div className="skeleton" style={{ height: 150, borderRadius: 12 }} />
      </div>
    );
  }

  // Group events by day of week
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const eventsByDay = daysOfWeek.map(() => 0);

  events.forEach(event => {
    if (!event.start_time) return;
    const date = new Date(event.start_time);
    if (isNaN(date.getTime())) return;

    // Convert to Monday=0, Sunday=6
    let dayIndex = date.getDay() - 1;
    if (dayIndex < 0) dayIndex = 6; // Sunday becomes 6

    eventsByDay[dayIndex]++;
  });

  const maxEvents = Math.max(...eventsByDay);

  if (maxEvents === 0) {
    return (
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: '2rem',
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(245, 166, 35, 0.06) 0%, rgba(0, 0, 0, 0) 100%)',
          borderColor: 'rgba(245, 166, 35, 0.15)'
        }}
      >
        <p style={{ color: '#a0a0a0', fontSize: '0.9rem' }}>
          No event data available for the selected filters.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: '1.5rem',
        background: 'linear-gradient(135deg, rgba(245, 166, 35, 0.06) 0%, rgba(0, 0, 0, 0) 100%)',
        borderColor: 'rgba(245, 166, 35, 0.15)'
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'rgba(245, 166, 35, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f5a623',
            flexShrink: 0
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.1rem' }}>
              Event Density
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#a0a0a0' }}>
              {genre ? `${genre} events` : 'All genres'} by day of week
            </p>
          </div>
          <div style={{
            padding: '0.3rem 0.7rem',
            background: 'rgba(245, 166, 35, 0.15)',
            color: '#f5a623',
            borderRadius: 6,
            fontSize: '0.7rem',
            fontWeight: 700
          }}>
            {events.length} events
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div style={{ marginBottom: '1rem' }}>
        <BetterHeatMap
          data={eventsByDay}
          xLabels={daysOfWeek}
          width={600}
          height={150}
        />
      </div>

      {/* Summary */}
      <div style={{
        padding: '1rem',
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: 8,
        fontSize: '0.85rem',
        color: '#f5f5f5'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Busiest day:</span>
          <span style={{ fontWeight: 700, color: '#f5a623' }}>
            {daysOfWeek[eventsByDay.indexOf(maxEvents)]} ({maxEvents} events)
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default EventDensityHeatMap;
