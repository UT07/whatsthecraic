"""
ML Recommendation Service for WhatsTheCraic
Cost-effective ML service running on EC2 with scikit-learn
Features: Collaborative filtering, A/B testing, model monitoring
"""
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
import time
from datetime import datetime
import os
import base64
import json

from .models.recommendation_engine import RecommendationEngine
from .ab_testing import ABTestManager
from .monitoring import MetricsCollector
from .config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="WhatsTheCraic ML Service",
    description="Cost-effective ML recommendation engine with A/B testing and monitoring",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize ML components
recommendation_engine = RecommendationEngine()
ab_test_manager = ABTestManager()
metrics_collector = MetricsCollector()

def decode_jwt_payload(token: str) -> Optional[Dict[str, Any]]:
    """Decode JWT payload without signature verification."""
    try:
        parts = token.split('.')
        if len(parts) < 2:
            return None

        payload = parts[1].replace('-', '+').replace('_', '/')
        padding = '=' * (-len(payload) % 4)
        decoded = base64.b64decode((payload + padding).encode('utf-8'))
        data = json.loads(decoded.decode('utf-8'))
        return data if isinstance(data, dict) else None
    except Exception:
        return None

def resolve_user_id(request_user_id: Optional[str], authorization: Optional[str]) -> Optional[str]:
    if request_user_id is not None and str(request_user_id).strip() != '':
        return str(request_user_id)

    if not authorization or not authorization.startswith('Bearer '):
        return None

    token = authorization.split(' ', 1)[1].strip()
    payload = decode_jwt_payload(token)
    if not payload:
        return None

    for key in ('user_id', 'id', 'sub'):
        value = payload.get(key)
        if value is not None and str(value).strip() != '':
            return str(value)

    return None

# Request/Response Models
class RecommendationRequest(BaseModel):
    user_id: Optional[str] = None
    city: Optional[str] = None
    limit: int = 20
    context: Optional[Dict[str, Any]] = None

class RecommendationResponse(BaseModel):
    user_id: str
    recommendations: List[Dict[str, Any]]
    model_version: str
    ab_experiment: Optional[str] = None
    latency_ms: float

class FeedbackRequest(BaseModel):
    user_id: Optional[str] = None
    event_id: str
    action: str  # 'save', 'hide', 'click', 'skip'
    context: Optional[Dict[str, Any]] = None

class ModelMetrics(BaseModel):
    model_version: str
    last_trained: str
    training_samples: int
    validation_metrics: Dict[str, float]
    prediction_count: int
    avg_latency_ms: float

# Middleware for request timing and logging
@app.middleware("http")
async def log_requests(request, call_next):
    start_time = time.time()

    response = await call_next(request)

    duration_ms = (time.time() - start_time) * 1000
    metrics_collector.record_request(
        endpoint=request.url.path,
        method=request.method,
        status_code=response.status_code,
        duration_ms=duration_ms
    )

    logger.info(
        f"{request.method} {request.url.path} - "
        f"Status: {response.status_code} - "
        f"Duration: {duration_ms:.2f}ms"
    )

    return response

@app.on_event("startup")
async def startup_event():
    """Initialize ML models and connections on startup"""
    logger.info("Starting ML Recommendation Service...")

    try:
        # Load recommendation model
        recommendation_engine.load_model()
        logger.info(f"Loaded model version: {recommendation_engine.model_version}")

        # Initialize A/B testing
        ab_test_manager.load_experiments()
        logger.info("A/B testing initialized")

        # Initialize metrics
        metrics_collector.initialize()
        logger.info("Metrics collector initialized")

    except Exception as e:
        logger.error(f"Error during startup: {e}")
        raise

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ml-service",
        "model_version": recommendation_engine.model_version,
        "model_loaded": recommendation_engine.is_loaded(),
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/metrics")
async def get_metrics():
    """Prometheus-compatible metrics endpoint"""
    metrics = metrics_collector.get_prometheus_metrics()
    return metrics

@app.post("/v1/recommendations", response_model=RecommendationResponse)
async def get_recommendations(
    request: RecommendationRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Get personalized event recommendations for a user
    Includes A/B testing for different recommendation algorithms
    """
    start_time = time.time()

    resolved_user_id = resolve_user_id(request.user_id, authorization)

    if not resolved_user_id:
        raise HTTPException(status_code=400, detail="user_id is required")

    try:
        # A/B test assignment
        experiment = ab_test_manager.assign_experiment(resolved_user_id)

        # Get recommendations based on experiment variant
        recommendations = recommendation_engine.predict(
            user_id=resolved_user_id,
            city=request.city,
            limit=request.limit,
            variant=experiment.get('variant', 'control'),
            context=request.context
        )

        # Record prediction
        latency_ms = (time.time() - start_time) * 1000
        metrics_collector.record_prediction(
            user_id=resolved_user_id,
            variant=experiment.get('variant', 'control'),
            latency_ms=latency_ms,
            num_recommendations=len(recommendations)
        )

        return RecommendationResponse(
            user_id=resolved_user_id,
            recommendations=recommendations,
            model_version=recommendation_engine.model_version,
            ab_experiment=experiment.get('experiment_id'),
            latency_ms=latency_ms
        )

    except Exception as e:
        logger.error(f"Error getting recommendations for user {resolved_user_id}: {e}")
        metrics_collector.record_error('recommendation_error')
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/feedback")
async def record_feedback(
    request: FeedbackRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Record user feedback for model improvement
    Used for online learning and model retraining
    """
    try:
        # Store feedback for model retraining
        resolved_user_id = resolve_user_id(request.user_id, authorization)
        if not resolved_user_id:
            raise HTTPException(status_code=400, detail="user_id is required")

        recommendation_engine.record_feedback(
            user_id=resolved_user_id,
            event_id=request.event_id,
            action=request.action,
            context=request.context
        )

        # Track A/B test conversion
        if request.action in ['save', 'click']:
            ab_test_manager.record_conversion(
                user_id=resolved_user_id,
                event_id=request.event_id,
                action=request.action
            )

        metrics_collector.record_feedback(request.action)

        return {
            "status": "success",
            "message": "Feedback recorded"
        }

    except Exception as e:
        logger.error(f"Error recording feedback: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/v1/model/info", response_model=ModelMetrics)
async def get_model_info():
    """Get current model metrics and performance"""
    try:
        metrics = recommendation_engine.get_model_metrics()
        request_metrics = metrics_collector.get_summary()

        return ModelMetrics(
            model_version=metrics.get('version', 'unknown'),
            last_trained=metrics.get('last_trained', 'unknown'),
            training_samples=metrics.get('training_samples', 0),
            validation_metrics=metrics.get('validation_metrics', {}),
            prediction_count=request_metrics.get('prediction_count', 0),
            avg_latency_ms=request_metrics.get('avg_latency_ms', 0.0)
        )

    except Exception as e:
        logger.error(f"Error getting model info: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/model/retrain")
async def trigger_retrain():
    """
    Trigger model retraining
    Usually called by scheduled cron job
    """
    try:
        logger.info("Starting model retraining...")

        # Train new model
        metrics = recommendation_engine.retrain_model()

        # Reload model
        recommendation_engine.load_model()

        logger.info(f"Model retrained successfully. New version: {recommendation_engine.model_version}")

        return {
            "status": "success",
            "model_version": recommendation_engine.model_version,
            "metrics": metrics
        }

    except Exception as e:
        logger.error(f"Error retraining model: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/v1/experiments")
async def list_experiments():
    """List active A/B experiments"""
    try:
        experiments = ab_test_manager.get_active_experiments()
        return {
            "experiments": experiments,
            "count": len(experiments)
        }
    except Exception as e:
        logger.error(f"Error listing experiments: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/v1/experiments/{experiment_id}/results")
async def get_experiment_results(experiment_id: str):
    """Get A/B test results for an experiment"""
    try:
        results = ab_test_manager.get_experiment_results(experiment_id)
        return results
    except Exception as e:
        logger.error(f"Error getting experiment results: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=4004)
