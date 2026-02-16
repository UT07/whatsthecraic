import React, { useState } from 'react';
import { motion } from 'framer-motion';
import mlAPI from '../../services/mlAPI';

/**
 * FeedbackButtons - Thumbs up/down buttons for event recommendations
 * Sends feedback to ML service to improve future recommendations
 */
const FeedbackButtons = ({ eventId, context = {}, size = 'md', onFeedback }) => {
  const [feedback, setFeedback] = useState(null); // 'thumbs_up' or 'thumbs_down'
  const [loading, setLoading] = useState(false);

  const handleFeedback = async (action) => {
    if (loading || feedback === action) return;

    setLoading(true);
    try {
      await mlAPI.sendFeedback({
        eventId,
        action,
        context: {
          ...context,
          previous_feedback: feedback
        }
      });
      setFeedback(action);
      if (onFeedback) {
        onFeedback(action);
      }
    } catch (error) {
      console.error('Feedback error:', error);
    } finally {
      setLoading(false);
    }
  };

  const buttonSize = size === 'sm' ? {
    width: 28,
    height: 28,
    iconSize: 14
  } : size === 'lg' ? {
    width: 40,
    height: 40,
    iconSize: 20
  } : {
    width: 32,
    height: 32,
    iconSize: 16
  };

  return (
    <div style={{
      display: 'flex',
      gap: '0.4rem',
      alignItems: 'center'
    }}>
      {/* Thumbs Up */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => handleFeedback('thumbs_up')}
        disabled={loading}
        style={{
          width: buttonSize.width,
          height: buttonSize.height,
          borderRadius: 8,
          border: 'none',
          background: feedback === 'thumbs_up'
            ? 'rgba(0, 214, 125, 0.2)'
            : 'rgba(255, 255, 255, 0.08)',
          color: feedback === 'thumbs_up' ? '#00d67d' : '#a0a0a0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          opacity: loading ? 0.5 : 1
        }}
        title="This recommendation is helpful"
      >
        <svg
          width={buttonSize.iconSize}
          height={buttonSize.iconSize}
          viewBox="0 0 24 24"
          fill={feedback === 'thumbs_up' ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </svg>
      </motion.button>

      {/* Thumbs Down */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => handleFeedback('thumbs_down')}
        disabled={loading}
        style={{
          width: buttonSize.width,
          height: buttonSize.height,
          borderRadius: 8,
          border: 'none',
          background: feedback === 'thumbs_down'
            ? 'rgba(255, 71, 87, 0.2)'
            : 'rgba(255, 255, 255, 0.08)',
          color: feedback === 'thumbs_down' ? '#ff4757' : '#a0a0a0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          opacity: loading ? 0.5 : 1
        }}
        title="This recommendation is not helpful"
      >
        <svg
          width={buttonSize.iconSize}
          height={buttonSize.iconSize}
          viewBox="0 0 24 24"
          fill={feedback === 'thumbs_down' ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
        </svg>
      </motion.button>
    </div>
  );
};

export default FeedbackButtons;
