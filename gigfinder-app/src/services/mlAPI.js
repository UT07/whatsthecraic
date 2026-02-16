import { apiClient, getUser } from './apiClient';

/**
 * ML Service API Client
 * Connects to ml-service endpoints via aggregator for personalized recommendations,
 * feedback tracking, model information, and A/B experiment management.
 */

const mlAPI = {
  /**
   * Get personalized event recommendations from the ML service
   * @param {Object} options - Recommendation parameters
   * @param {string} options.userId - User ID (defaults to logged in user)
   * @param {string} options.city - Filter by city
   * @param {number} options.limit - Maximum number of recommendations (default 20)
   * @param {Object} options.context - Additional context for recommendation
   * @returns {Promise<Object>} { recommendations: [...], model_version, ab_experiment }
   */
  getRecommendations: async ({ userId, city, limit = 20, context = {} } = {}) => {
    try {
      const user = getUser();
      const payload = {
        user_id: userId || user?.id || user?.user_id,
        city,
        limit,
        context
      };

      const response = await apiClient.post('/v1/recommendations', payload);
      return response.data;
    } catch (error) {
      console.error('ML recommendations error:', error);
      // Return empty recommendations on error to degrade gracefully
      return {
        recommendations: [],
        model_version: 'unavailable',
        ab_experiment: null,
        error: error.message
      };
    }
  },

  /**
   * Send user feedback/interaction to the ML service
   * @param {Object} feedback - Feedback data
   * @param {string} feedback.userId - User ID
   * @param {string} feedback.eventId - Event ID
   * @param {string} feedback.action - Action type: 'save', 'hide', 'click', 'skip', 'thumbs_up', 'thumbs_down'
   * @param {Object} feedback.context - Additional context (page, position, timestamp, etc.)
   * @returns {Promise<Object>} Success response
   */
  sendFeedback: async ({ userId, eventId, action, context = {} } = {}) => {
    try {
      const user = getUser();
      const payload = {
        user_id: userId || user?.id || user?.user_id,
        event_id: eventId,
        action,
        context: {
          ...context,
          timestamp: new Date().toISOString(),
          client: 'web'
        }
      };

      const response = await apiClient.post('/v1/feedback', payload);
      return response.data;
    } catch (error) {
      console.error('ML feedback error:', error);
      // Silently fail feedback to not disrupt UX
      return { success: false, error: error.message };
    }
  },

  /**
   * Get ML model information and health status
   * @returns {Promise<Object>} Model metadata (version, training info, metrics)
   */
  getModelInfo: async () => {
    try {
      const response = await apiClient.get('/v1/model/info');
      return response.data;
    } catch (error) {
      console.error('ML model info error:', error);
      return {
        model_version: 'unknown',
        last_trained: null,
        training_samples: 0,
        validation_metrics: {},
        prediction_count: 0,
        avg_latency: null,
        error: error.message
      };
    }
  },

  /**
   * Trigger ML model retraining (admin only)
   * @returns {Promise<Object>} Retraining results with new metrics
   */
  triggerRetrain: async () => {
    try {
      const response = await apiClient.post('/v1/model/retrain');
      return response.data;
    } catch (error) {
      console.error('ML retrain error:', error);
      throw error;
    }
  },

  /**
   * Get active A/B experiments
   * @returns {Promise<Array>} List of experiments with variants
   */
  getExperiments: async () => {
    try {
      const response = await apiClient.get('/v1/experiments');
      return response.data;
    } catch (error) {
      console.error('ML experiments error:', error);
      return [];
    }
  },

  /**
   * Get A/B experiment results for a specific experiment
   * @param {string} experimentId - Experiment ID
   * @returns {Promise<Object>} Per-variant metrics (conversion rates, user counts)
   */
  getExperimentResults: async (experimentId) => {
    try {
      const response = await apiClient.get(`/v1/experiments/${experimentId}/results`);
      return response.data;
    } catch (error) {
      console.error('ML experiment results error:', error);
      return {
        experiment_id: experimentId,
        variants: [],
        error: error.message
      };
    }
  },

  /**
   * Get ML health status
   * @returns {Promise<Object>} Health check with model status
   */
  getHealth: async () => {
    try {
      const response = await apiClient.get('/health');
      return response.data;
    } catch (error) {
      console.error('ML health check error:', error);
      return {
        model_loaded: false,
        status: 'error',
        error: error.message
      };
    }
  }
};

export default mlAPI;
