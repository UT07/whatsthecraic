"""
Metrics collection and monitoring using CloudWatch (free tier)
Lightweight observability without Prometheus/Grafana costs
"""
import logging
from typing import Dict, List, Optional
from datetime import datetime
from collections import defaultdict
import boto3
from botocore.exceptions import ClientError

from .config import settings

logger = logging.getLogger(__name__)

class MetricsCollector:
    """
    Collect and publish metrics to CloudWatch
    Uses AWS Free Tier for cost-effective monitoring
    """

    def __init__(self):
        self.cloudwatch = None
        self.local_metrics = defaultdict(list)
        self.request_count = 0
        self.error_count = 0
        self.prediction_count = 0
        self.total_latency_ms = 0.0

        # Initialize CloudWatch client
        if settings.enable_cloudwatch:
            try:
                self.cloudwatch = boto3.client(
                    'cloudwatch',
                    region_name=settings.aws_region
                )
                logger.info("CloudWatch metrics enabled")
            except Exception as e:
                logger.warning(f"CloudWatch initialization failed: {e}. Using local metrics only.")
                self.cloudwatch = None

    def initialize(self):
        """Initialize metrics collection"""
        logger.info("Metrics collector initialized")

    def record_request(self, endpoint: str, method: str, status_code: int, duration_ms: float):
        """Record HTTP request metrics"""
        self.request_count += 1

        # Store locally
        self.local_metrics['requests'].append({
            'endpoint': endpoint,
            'method': method,
            'status_code': status_code,
            'duration_ms': duration_ms,
            'timestamp': datetime.utcnow().isoformat()
        })

        # Publish to CloudWatch
        if self.cloudwatch:
            try:
                self.cloudwatch.put_metric_data(
                    Namespace=settings.cloudwatch_namespace,
                    MetricData=[
                        {
                            'MetricName': 'RequestCount',
                            'Value': 1,
                            'Unit': 'Count',
                            'Timestamp': datetime.utcnow(),
                            'Dimensions': [
                                {'Name': 'Endpoint', 'Value': endpoint},
                                {'Name': 'StatusCode', 'Value': str(status_code)}
                            ]
                        },
                        {
                            'MetricName': 'RequestLatency',
                            'Value': duration_ms,
                            'Unit': 'Milliseconds',
                            'Timestamp': datetime.utcnow(),
                            'Dimensions': [
                                {'Name': 'Endpoint', 'Value': endpoint}
                            ]
                        }
                    ]
                )
            except Exception as e:
                logger.error(f"Error publishing request metrics to CloudWatch: {e}")

    def record_prediction(self, user_id: str, variant: str, latency_ms: float, num_recommendations: int):
        """Record ML prediction metrics"""
        self.prediction_count += 1
        self.total_latency_ms += latency_ms

        # Store locally
        self.local_metrics['predictions'].append({
            'user_id': user_id,
            'variant': variant,
            'latency_ms': latency_ms,
            'num_recommendations': num_recommendations,
            'timestamp': datetime.utcnow().isoformat()
        })

        # Publish to CloudWatch
        if self.cloudwatch:
            try:
                self.cloudwatch.put_metric_data(
                    Namespace=settings.cloudwatch_namespace,
                    MetricData=[
                        {
                            'MetricName': 'PredictionCount',
                            'Value': 1,
                            'Unit': 'Count',
                            'Timestamp': datetime.utcnow(),
                            'Dimensions': [
                                {'Name': 'Variant', 'Value': variant}
                            ]
                        },
                        {
                            'MetricName': 'PredictionLatency',
                            'Value': latency_ms,
                            'Unit': 'Milliseconds',
                            'Timestamp': datetime.utcnow(),
                            'Dimensions': [
                                {'Name': 'Variant', 'Value': variant}
                            ]
                        },
                        {
                            'MetricName': 'RecommendationCount',
                            'Value': num_recommendations,
                            'Unit': 'Count',
                            'Timestamp': datetime.utcnow()
                        }
                    ]
                )
            except Exception as e:
                logger.error(f"Error publishing prediction metrics to CloudWatch: {e}")

    def record_feedback(self, action: str):
        """Record user feedback metrics"""
        # Store locally
        self.local_metrics['feedback'].append({
            'action': action,
            'timestamp': datetime.utcnow().isoformat()
        })

        # Publish to CloudWatch
        if self.cloudwatch:
            try:
                self.cloudwatch.put_metric_data(
                    Namespace=settings.cloudwatch_namespace,
                    MetricData=[
                        {
                            'MetricName': 'UserFeedback',
                            'Value': 1,
                            'Unit': 'Count',
                            'Timestamp': datetime.utcnow(),
                            'Dimensions': [
                                {'Name': 'Action', 'Value': action}
                            ]
                        }
                    ]
                )
            except Exception as e:
                logger.error(f"Error publishing feedback metrics to CloudWatch: {e}")

    def record_error(self, error_type: str):
        """Record error metrics"""
        self.error_count += 1

        # Store locally
        self.local_metrics['errors'].append({
            'error_type': error_type,
            'timestamp': datetime.utcnow().isoformat()
        })

        # Publish to CloudWatch
        if self.cloudwatch:
            try:
                self.cloudwatch.put_metric_data(
                    Namespace=settings.cloudwatch_namespace,
                    MetricData=[
                        {
                            'MetricName': 'ErrorCount',
                            'Value': 1,
                            'Unit': 'Count',
                            'Timestamp': datetime.utcnow(),
                            'Dimensions': [
                                {'Name': 'ErrorType', 'Value': error_type}
                            ]
                        }
                    ]
                )
            except Exception as e:
                logger.error(f"Error publishing error metrics to CloudWatch: {e}")

    def get_prometheus_metrics(self) -> str:
        """
        Generate Prometheus-compatible metrics
        For compatibility with existing monitoring stack
        """
        avg_latency = self.total_latency_ms / max(self.prediction_count, 1)

        metrics = f"""# HELP ml_requests_total Total number of requests
# TYPE ml_requests_total counter
ml_requests_total {self.request_count}

# HELP ml_predictions_total Total number of predictions
# TYPE ml_predictions_total counter
ml_predictions_total {self.prediction_count}

# HELP ml_errors_total Total number of errors
# TYPE ml_errors_total counter
ml_errors_total {self.error_count}

# HELP ml_prediction_latency_ms Average prediction latency in milliseconds
# TYPE ml_prediction_latency_ms gauge
ml_prediction_latency_ms {avg_latency:.2f}
"""
        return metrics

    def get_summary(self) -> Dict:
        """Get summary of collected metrics"""
        avg_latency = self.total_latency_ms / max(self.prediction_count, 1)

        return {
            'request_count': self.request_count,
            'prediction_count': self.prediction_count,
            'error_count': self.error_count,
            'avg_latency_ms': avg_latency,
            'cloudwatch_enabled': self.cloudwatch is not None
        }

    def publish_model_metrics(self, model_version: str, metrics: Dict):
        """
        Publish model performance metrics to CloudWatch
        Used after model retraining
        """
        if not self.cloudwatch:
            return

        try:
            metric_data = []

            # Publish validation metrics
            for metric_name, metric_value in metrics.items():
                if isinstance(metric_value, (int, float)):
                    metric_data.append({
                        'MetricName': f'Model{metric_name.title()}',
                        'Value': float(metric_value),
                        'Unit': 'None',
                        'Timestamp': datetime.utcnow(),
                        'Dimensions': [
                            {'Name': 'ModelVersion', 'Value': model_version}
                        ]
                    })

            if metric_data:
                self.cloudwatch.put_metric_data(
                    Namespace=settings.cloudwatch_namespace,
                    MetricData=metric_data
                )

                logger.info(f"Published model metrics for version {model_version}")

        except Exception as e:
            logger.error(f"Error publishing model metrics: {e}")
