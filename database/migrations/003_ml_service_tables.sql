-- ML Service Database Migration
-- Adds tables for ML feedback and model versioning

-- ML Feedback table for storing user interactions
CREATE TABLE IF NOT EXISTS ml_feedback (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(255) NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,  -- 'save', 'hide', 'click', 'skip'
    context TEXT,  -- JSON context data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_event_id (event_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Model versions table for tracking model deployments
CREATE TABLE IF NOT EXISTS model_versions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    version VARCHAR(50) NOT NULL UNIQUE,
    model_type VARCHAR(100) NOT NULL,  -- 'collaborative_filtering', 'content_based', 'hybrid'
    training_samples INT NOT NULL,
    validation_metrics JSON,
    trained_at TIMESTAMP NOT NULL,
    deployed_at TIMESTAMP,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_version (version),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Model predictions log (optional, for monitoring)
CREATE TABLE IF NOT EXISTS model_predictions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(255) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    variant VARCHAR(50),  -- A/B test variant
    num_recommendations INT,
    latency_ms FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_model_version (model_version),
    INDEX idx_variant (variant),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Recommendation cache (optional, for performance)
CREATE TABLE IF NOT EXISTS recommendation_cache (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    cache_key VARCHAR(255) NOT NULL UNIQUE,
    user_id VARCHAR(255) NOT NULL,
    recommendations JSON NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_cache_key (cache_key),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert initial model version
INSERT INTO model_versions (version, model_type, training_samples, validation_metrics, trained_at, is_active)
VALUES ('v1.0.0', 'collaborative_filtering', 0, '{}', NOW(), TRUE)
ON DUPLICATE KEY UPDATE version = version;
