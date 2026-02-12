"""
A/B Testing Manager using DynamoDB for cost-effective experiment tracking
Uses on-demand pricing ~$1-2/month for low traffic
"""
import logging
import hashlib
from typing import Dict, List, Optional
from datetime import datetime
import boto3
from botocore.exceptions import ClientError

from .config import settings

logger = logging.getLogger(__name__)

class ABTestManager:
    """Manage A/B experiments using DynamoDB"""

    def __init__(self):
        self.experiments = {}
        self.dynamodb = None
        self.experiments_table = None
        self.assignments_table = None

        # Initialize DynamoDB client
        if not settings.use_local_dynamodb:
            try:
                self.dynamodb = boto3.resource(
                    'dynamodb',
                    region_name=settings.aws_region
                )
                self._ensure_tables()
            except Exception as e:
                logger.warning(f"DynamoDB initialization failed: {e}. Using in-memory fallback.")
                self.dynamodb = None

    def _ensure_tables(self):
        """Ensure DynamoDB tables exist"""
        try:
            # Check if experiments table exists
            try:
                self.experiments_table = self.dynamodb.Table(settings.dynamodb_table_experiments)
                self.experiments_table.load()
            except ClientError:
                logger.info(f"Creating experiments table: {settings.dynamodb_table_experiments}")
                self._create_experiments_table()

            # Check if assignments table exists
            try:
                self.assignments_table = self.dynamodb.Table(settings.dynamodb_table_assignments)
                self.assignments_table.load()
            except ClientError:
                logger.info(f"Creating assignments table: {settings.dynamodb_table_assignments}")
                self._create_assignments_table()

        except Exception as e:
            logger.error(f"Error ensuring DynamoDB tables: {e}")

    def _create_experiments_table(self):
        """Create experiments table in DynamoDB"""
        try:
            table = self.dynamodb.create_table(
                TableName=settings.dynamodb_table_experiments,
                KeySchema=[
                    {'AttributeName': 'experiment_id', 'KeyType': 'HASH'}
                ],
                AttributeDefinitions=[
                    {'AttributeName': 'experiment_id', 'AttributeType': 'S'}
                ],
                BillingMode='PAY_PER_REQUEST'  # On-demand pricing
            )
            table.wait_until_exists()
            self.experiments_table = table
            logger.info("Experiments table created successfully")

        except Exception as e:
            logger.error(f"Error creating experiments table: {e}")

    def _create_assignments_table(self):
        """Create assignments table in DynamoDB"""
        try:
            table = self.dynamodb.create_table(
                TableName=settings.dynamodb_table_assignments,
                KeySchema=[
                    {'AttributeName': 'user_id', 'KeyType': 'HASH'},
                    {'AttributeName': 'experiment_id', 'KeyType': 'RANGE'}
                ],
                AttributeDefinitions=[
                    {'AttributeName': 'user_id', 'AttributeType': 'S'},
                    {'AttributeName': 'experiment_id', 'AttributeType': 'S'}
                ],
                BillingMode='PAY_PER_REQUEST'  # On-demand pricing
            )
            table.wait_until_exists()
            self.assignments_table = table
            logger.info("Assignments table created successfully")

        except Exception as e:
            logger.error(f"Error creating assignments table: {e}")

    def load_experiments(self):
        """Load active experiments from DynamoDB or use default"""
        try:
            if self.experiments_table:
                response = self.experiments_table.scan()
                for item in response.get('Items', []):
                    if item.get('status') == 'active':
                        self.experiments[item['experiment_id']] = item
            else:
                # Fallback: use default experiment
                self._load_default_experiment()

            logger.info(f"Loaded {len(self.experiments)} active experiments")

        except Exception as e:
            logger.error(f"Error loading experiments: {e}")
            self._load_default_experiment()

    def _load_default_experiment(self):
        """Load default experiment for A/B testing"""
        default_experiment = {
            'experiment_id': settings.default_experiment_id,
            'name': 'Recommendation Algorithm Test',
            'status': 'active',
            'variants': [
                {'variant_id': 'control', 'weight': 0.25, 'description': 'Popularity-based'},
                {'variant_id': 'collaborative_filtering', 'weight': 0.25, 'description': 'Collaborative Filtering'},
                {'variant_id': 'content_based', 'weight': 0.25, 'description': 'Content-Based'},
                {'variant_id': 'hybrid', 'weight': 0.25', 'description': 'Hybrid Model'}
            ],
            'created_at': datetime.utcnow().isoformat()
        }
        self.experiments[settings.default_experiment_id] = default_experiment

    def assign_experiment(self, user_id: str) -> Dict:
        """
        Assign user to an experiment variant
        Uses consistent hashing for deterministic assignment
        """
        try:
            experiment_id = settings.default_experiment_id
            experiment = self.experiments.get(experiment_id)

            if not experiment:
                logger.warning(f"Experiment {experiment_id} not found")
                return {}

            # Check if user already assigned
            if self.assignments_table:
                try:
                    response = self.assignments_table.get_item(
                        Key={
                            'user_id': user_id,
                            'experiment_id': experiment_id
                        }
                    )
                    if 'Item' in response:
                        return {
                            'experiment_id': experiment_id,
                            'variant': response['Item']['variant']
                        }
                except ClientError:
                    pass

            # Assign new variant using consistent hashing
            variant = self._hash_assign_variant(user_id, experiment['variants'])

            # Store assignment
            if self.assignments_table:
                try:
                    self.assignments_table.put_item(
                        Item={
                            'user_id': user_id,
                            'experiment_id': experiment_id,
                            'variant': variant,
                            'assigned_at': datetime.utcnow().isoformat()
                        }
                    )
                except Exception as e:
                    logger.error(f"Error storing assignment: {e}")

            return {
                'experiment_id': experiment_id,
                'variant': variant
            }

        except Exception as e:
            logger.error(f"Error assigning experiment: {e}")
            return {}

    def _hash_assign_variant(self, user_id: str, variants: List[Dict]) -> str:
        """
        Use consistent hashing to assign variant
        Ensures same user always gets same variant
        """
        # Hash user_id to get a number between 0 and 1
        hash_value = int(hashlib.md5(user_id.encode()).hexdigest(), 16)
        hash_fraction = (hash_value % 10000) / 10000.0

        # Assign based on variant weights
        cumulative_weight = 0.0
        for variant in variants:
            cumulative_weight += variant['weight']
            if hash_fraction <= cumulative_weight:
                return variant['variant_id']

        # Fallback to control
        return settings.control_variant

    def record_conversion(self, user_id: str, event_id: str, action: str):
        """
        Record conversion event for A/B test analysis
        """
        try:
            if not self.assignments_table:
                return

            experiment_id = settings.default_experiment_id

            # Get user's variant
            response = self.assignments_table.get_item(
                Key={
                    'user_id': user_id,
                    'experiment_id': experiment_id
                }
            )

            if 'Item' not in response:
                logger.warning(f"No assignment found for user {user_id}")
                return

            variant = response['Item']['variant']

            # Update conversion count
            self.assignments_table.update_item(
                Key={
                    'user_id': user_id,
                    'experiment_id': experiment_id
                },
                UpdateExpression='SET conversions = if_not_exists(conversions, :zero) + :one, last_conversion = :now',
                ExpressionAttributeValues={
                    ':one': 1,
                    ':zero': 0,
                    ':now': datetime.utcnow().isoformat()
                }
            )

            logger.info(f"Conversion recorded: user={user_id}, variant={variant}, action={action}")

        except Exception as e:
            logger.error(f"Error recording conversion: {e}")

    def get_active_experiments(self) -> List[Dict]:
        """Get list of active experiments"""
        return [
            {
                'experiment_id': exp_id,
                'name': exp.get('name'),
                'status': exp.get('status'),
                'variants': exp.get('variants', [])
            }
            for exp_id, exp in self.experiments.items()
            if exp.get('status') == 'active'
        ]

    def get_experiment_results(self, experiment_id: str) -> Dict:
        """
        Get A/B test results for an experiment
        Calculates conversion rates by variant
        """
        try:
            if not self.assignments_table:
                return {'error': 'DynamoDB not available'}

            # Scan assignments for this experiment
            response = self.assignments_table.query(
                IndexName='experiment-index',  # Note: requires GSI
                KeyConditionExpression='experiment_id = :exp_id',
                ExpressionAttributeValues={
                    ':exp_id': experiment_id
                }
            )

            # Aggregate results by variant
            variant_stats = {}

            for item in response.get('Items', []):
                variant = item['variant']
                if variant not in variant_stats:
                    variant_stats[variant] = {
                        'variant': variant,
                        'users': 0,
                        'conversions': 0,
                        'conversion_rate': 0.0
                    }

                variant_stats[variant]['users'] += 1
                variant_stats[variant]['conversions'] += item.get('conversions', 0)

            # Calculate conversion rates
            for variant in variant_stats.values():
                if variant['users'] > 0:
                    variant['conversion_rate'] = variant['conversions'] / variant['users']

            return {
                'experiment_id': experiment_id,
                'status': 'active',
                'variants': list(variant_stats.values()),
                'total_users': sum(v['users'] for v in variant_stats.values())
            }

        except Exception as e:
            logger.error(f"Error getting experiment results: {e}")
            return {
                'error': str(e),
                'note': 'Ensure GSI experiment-index exists on assignments table'
            }
