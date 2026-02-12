"""Configuration management for ML service"""
from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    # Service configuration
    service_name: str = "ml-service"
    service_port: int = 4004
    environment: str = os.getenv("ENVIRONMENT", "development")

    # CORS
    cors_origins: List[str] = ["*"]

    # Database
    db_host: str = os.getenv("DB_HOST", "db")
    db_port: int = int(os.getenv("DB_PORT", "3306"))
    db_user: str = os.getenv("DB_USER", "app")
    db_password: str = os.getenv("DB_PASSWORD", "app")
    db_name: str = os.getenv("DB_NAME", "gigsdb")

    # Model configuration
    model_dir: str = "/app/models"
    model_version: str = "v1.0.0"
    min_training_samples: int = 100
    retrain_threshold_days: int = 7

    # AWS DynamoDB for A/B testing (on-demand pricing)
    aws_region: str = os.getenv("AWS_REGION", "eu-west-1")
    dynamodb_table_experiments: str = "whatsthecraic-experiments"
    dynamodb_table_assignments: str = "whatsthecraic-ab-assignments"
    use_local_dynamodb: bool = os.getenv("USE_LOCAL_DYNAMODB", "false").lower() == "true"

    # CloudWatch metrics
    cloudwatch_namespace: str = "WhatsTheCraic/ML"
    enable_cloudwatch: bool = os.getenv("ENABLE_CLOUDWATCH", "true").lower() == "true"

    # Recommendation settings
    default_recommendation_count: int = 20
    max_recommendation_count: int = 100
    min_similarity_score: float = 0.1

    # A/B testing
    default_experiment_id: str = "rec_algorithm_v1"
    control_variant: str = "control"
    treatment_variants: List[str] = ["collaborative_filtering", "content_based", "hybrid"]

    # Redis cache (optional)
    redis_host: str = os.getenv("REDIS_HOST", "")
    redis_port: int = int(os.getenv("REDIS_PORT", "6379"))
    redis_enabled: bool = os.getenv("REDIS_ENABLED", "false").lower() == "true"
    cache_ttl_seconds: int = 3600

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
