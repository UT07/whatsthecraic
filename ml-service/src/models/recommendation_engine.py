"""
Collaborative Filtering Recommendation Engine
Uses scikit-learn for cost-effective recommendations without SageMaker
"""
import logging
import os
import joblib
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Set
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler
from scipy.sparse import csr_matrix
import pymysql

from ..config import settings

logger = logging.getLogger(__name__)

class RecommendationEngine:
    """
    Collaborative filtering recommendation engine
    Lightweight implementation running on EC2 without SageMaker
    """

    def __init__(self):
        self.model = None
        self.user_features = None
        self.event_features = None
        self.scaler = StandardScaler()
        self.model_version = settings.model_version
        self.last_trained = None
        self.is_model_loaded = False

    def get_db_connection(self):
        """Get MySQL database connection"""
        return pymysql.connect(
            host=settings.db_host,
            port=settings.db_port,
            user=settings.db_user,
            password=settings.db_password,
            database=settings.db_name,
            cursorclass=pymysql.cursors.DictCursor
        )

    def load_model(self) -> bool:
        """Load the trained model from disk"""
        try:
            model_path = os.path.join(settings.model_dir, 'recommendation_model.joblib')

            if os.path.exists(model_path):
                model_data = joblib.load(model_path)
                self.model = model_data.get('model')
                self.user_features = model_data.get('user_features')
                self.event_features = model_data.get('event_features')
                self.scaler = model_data.get('scaler', StandardScaler())
                self.model_version = model_data.get('version', settings.model_version)
                self.last_trained = model_data.get('last_trained')

                self.is_model_loaded = True
                logger.info(f"Model loaded successfully: version {self.model_version}")
                return True
            else:
                logger.warning("No trained model found. Training initial model...")
                # Train initial model if none exists
                self.retrain_model()
                return self.load_model()

        except Exception as e:
            logger.error(f"Error loading model: {e}")
            self.is_model_loaded = False
            return False

    def is_loaded(self) -> bool:
        """Check if model is loaded"""
        return self.is_model_loaded

    def fetch_training_data(self) -> pd.DataFrame:
        """
        Fetch user interaction data from database for training
        Includes: saved events, hidden events, clicks, Spotify preferences
        """
        conn = self.get_db_connection()
        try:
            # Get user-event interactions
            query = """
            SELECT
                se.user_id,
                se.event_id,
                1.0 as interaction_score,
                'save' as interaction_type,
                se.saved_at as created_at
            FROM user_saved_events se
            UNION ALL
            SELECT
                he.user_id,
                he.event_id,
                -0.5 as interaction_score,
                'hide' as interaction_type,
                he.hidden_at as created_at
            FROM user_hidden_events he
            """

            interactions_df = pd.read_sql(query, conn)

            # Get event features
            events_query = """
            SELECT
                id as event_id,
                title,
                city,
                start_time as date,
                price_min as price,
                genres as genre,
                venue_name,
                title as artist_name
            FROM events
            WHERE start_time >= NOW()
            """

            events_df = pd.read_sql(events_query, conn)

            # Get user preferences
            prefs_query = """
            SELECT
                user_id,
                preferred_genres,
                preferred_artists,
                preferred_cities,
                budget_max
            FROM user_preferences
            """

            prefs_df = pd.read_sql(prefs_query, conn)

            # Merge data
            training_data = interactions_df.merge(events_df, on='event_id', how='left')
            training_data = training_data.merge(prefs_df, on='user_id', how='left')

            logger.info(f"Fetched {len(training_data)} training samples")
            return training_data

        except Exception as e:
            logger.error(f"Error fetching training data: {e}")
            return pd.DataFrame()
        finally:
            conn.close()

    def build_user_item_matrix(self, interactions_df: pd.DataFrame) -> tuple:
        """Build user-item interaction matrix for collaborative filtering"""
        try:
            # Create user-event matrix
            user_ids = interactions_df['user_id'].unique()
            event_ids = interactions_df['event_id'].unique()

            user_idx = {uid: idx for idx, uid in enumerate(user_ids)}
            event_idx = {eid: idx for idx, eid in enumerate(event_ids)}

            # Build sparse matrix
            rows = [user_idx[uid] for uid in interactions_df['user_id']]
            cols = [event_idx[eid] for eid in interactions_df['event_id']]
            data = interactions_df['interaction_score'].values

            matrix = csr_matrix(
                (data, (rows, cols)),
                shape=(len(user_ids), len(event_ids))
            )

            return matrix, user_idx, event_idx, user_ids, event_ids

        except Exception as e:
            logger.error(f"Error building user-item matrix: {e}")
            return None, None, None, None, None

    def train_collaborative_filtering(self, training_data: pd.DataFrame) -> Dict[str, Any]:
        """
        Train collaborative filtering model using cosine similarity
        Lightweight approach without matrix factorization for cost savings
        """
        try:
            if len(training_data) < settings.min_training_samples:
                raise ValueError(f"Insufficient training data: {len(training_data)} < {settings.min_training_samples}")

            # Build user-item matrix
            matrix, user_idx, event_idx, user_ids, event_ids = self.build_user_item_matrix(training_data)

            if matrix is None:
                raise ValueError("Failed to build user-item matrix")

            # Compute user-user similarity matrix
            user_similarity = cosine_similarity(matrix, dense_output=False)

            # Store model components
            self.model = {
                'user_similarity': user_similarity,
                'interaction_matrix': matrix,
                'user_idx': user_idx,
                'event_idx': event_idx,
                'user_ids': user_ids,
                'event_ids': event_ids
            }

            # Compute validation metrics
            validation_metrics = self._compute_validation_metrics(matrix, user_similarity)

            logger.info(f"Model trained successfully with {len(user_ids)} users and {len(event_ids)} events")

            return validation_metrics

        except Exception as e:
            logger.error(f"Error training model: {e}")
            raise

    def _compute_validation_metrics(self, matrix, user_similarity) -> Dict[str, float]:
        """Compute validation metrics for the model"""
        try:
            # Simple metrics: coverage and sparsity
            coverage = (matrix.nnz / (matrix.shape[0] * matrix.shape[1])) * 100
            avg_similarity = user_similarity.mean()

            return {
                'coverage_percent': float(coverage),
                'avg_user_similarity': float(avg_similarity),
                'num_users': int(matrix.shape[0]),
                'num_events': int(matrix.shape[1])
            }
        except Exception as e:
            logger.error(f"Error computing validation metrics: {e}")
            return {}

    def retrain_model(self) -> Dict[str, Any]:
        """
        Retrain the recommendation model
        Called by cron job or manual trigger
        """
        try:
            logger.info("Starting model retraining...")

            # Fetch latest training data
            training_data = self.fetch_training_data()

            if training_data.empty:
                raise ValueError("No training data available")

            # Train model
            validation_metrics = self.train_collaborative_filtering(training_data)

            # Save model
            self.last_trained = datetime.utcnow().isoformat()
            model_data = {
                'model': self.model,
                'user_features': self.user_features,
                'event_features': self.event_features,
                'scaler': self.scaler,
                'version': self.model_version,
                'last_trained': self.last_trained,
                'validation_metrics': validation_metrics
            }

            model_path = os.path.join(settings.model_dir, 'recommendation_model.joblib')
            os.makedirs(settings.model_dir, exist_ok=True)
            joblib.dump(model_data, model_path)

            logger.info(f"Model saved to {model_path}")

            return {
                'status': 'success',
                'version': self.model_version,
                'last_trained': self.last_trained,
                'training_samples': len(training_data),
                'validation_metrics': validation_metrics
            }

        except Exception as e:
            logger.error(f"Error retraining model: {e}")
            raise

    def predict(
        self,
        user_id: str,
        city: Optional[str] = None,
        limit: int = 20,
        variant: str = 'control',
        context: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate personalized event recommendations for a user
        Supports multiple algorithm variants for A/B testing
        """
        try:
            if not self.is_model_loaded or self.model is None:
                logger.warning("Model not loaded, returning fallback recommendations")
                fallback = self._get_fallback_recommendations(user_id, city, limit)
                return self._apply_context_boost(fallback, context)

            # Select algorithm based on A/B test variant
            if variant == 'collaborative_filtering':
                recommendations = self._collaborative_filtering_recommendations(user_id, city, limit)
            elif variant == 'content_based':
                recommendations = self._content_based_recommendations(user_id, city, limit)
            elif variant == 'hybrid':
                recommendations = self._hybrid_recommendations(user_id, city, limit)
            else:
                # Control: simple popularity-based
                recommendations = self._popularity_recommendations(city, limit)

            recommendations = self._apply_context_boost(recommendations, context)
            return recommendations

        except Exception as e:
            logger.error(f"Error generating recommendations: {e}")
            fallback = self._get_fallback_recommendations(user_id, city, limit)
            return self._apply_context_boost(fallback, context)

    def _normalize_token(self, value: Any) -> str:
        return str(value or '').lower().strip()

    def _tokenize(self, value: Any) -> List[str]:
        if value is None:
            return []

        if isinstance(value, list):
            tokens: List[str] = []
            for item in value:
                tokens.extend(self._tokenize(item))
            return tokens

        if isinstance(value, dict):
            # Support context shapes like {name: "..."} or {genre: "..."}.
            if 'name' in value:
                return self._tokenize(value.get('name'))
            if 'genre' in value:
                return self._tokenize(value.get('genre'))
            return []

        text = self._normalize_token(value)
        if not text:
            return []

        text = text.replace('|', ',').replace('/', ',').replace(';', ',')
        return [part.strip() for part in text.split(',') if part.strip()]

    def _extract_context_tokens(self, context: Optional[Dict[str, Any]]) -> tuple[Set[str], Set[str]]:
        if not context or not isinstance(context, dict):
            return set(), set()

        genre_keys = ['spotify_genres', 'soundcloud_genres', 'preferred_genres', 'top_genres']
        artist_keys = ['spotify_artists', 'soundcloud_artists', 'preferred_artists', 'top_artists']

        genre_tokens: Set[str] = set()
        for key in genre_keys:
            for token in self._tokenize(context.get(key)):
                if token:
                    genre_tokens.add(token)

        artist_tokens: Set[str] = set()
        for key in artist_keys:
            for token in self._tokenize(context.get(key)):
                if token:
                    artist_tokens.add(token)

        return genre_tokens, artist_tokens

    def _apply_context_boost(
        self,
        recommendations: List[Dict[str, Any]],
        context: Optional[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        if not recommendations:
            return recommendations

        genre_tokens, artist_tokens = self._extract_context_tokens(context)
        if not genre_tokens and not artist_tokens:
            return recommendations

        boosted: List[Dict[str, Any]] = []
        for recommendation in recommendations:
            row = dict(recommendation)
            base_score = float(row.get('score') or 0.0)
            reasons = row.get('context_reasons', [])
            if not isinstance(reasons, list):
                reasons = []

            title_blob = self._normalize_token(
                f"{row.get('title', '')} {row.get('artist_name', '')}"
            )
            rec_genres = set(self._tokenize(row.get('genre') or row.get('genres')))
            genre_match_count = 0
            for token in genre_tokens:
                if any(token in genre or genre in token for genre in rec_genres):
                    genre_match_count += 1
            if genre_match_count > 0:
                base_score += min(genre_match_count, 3) * 0.15
                reasons.append('taste_genre_match')

            artist_match_count = 0
            for token in artist_tokens:
                if token and token in title_blob:
                    artist_match_count += 1
            if artist_match_count > 0:
                base_score += min(artist_match_count, 2) * 0.25
                reasons.append('taste_artist_match')

            row['score'] = float(round(base_score, 4))
            if reasons:
                row['context_reasons'] = list(dict.fromkeys(reasons))
            boosted.append(row)

        boosted.sort(key=lambda item: float(item.get('score') or 0.0), reverse=True)
        return boosted

    def _collaborative_filtering_recommendations(
        self,
        user_id: str,
        city: Optional[str],
        limit: int
    ) -> List[Dict[str, Any]]:
        """Generate recommendations using collaborative filtering"""
        try:
            user_idx = self.model['user_idx'].get(user_id)

            if user_idx is None:
                # New user: cold start with popularity
                return self._popularity_recommendations(city, limit)

            # Get similar users
            user_similarity = self.model['user_similarity'][user_idx].toarray().flatten()
            similar_users_idx = np.argsort(user_similarity)[::-1][1:11]  # Top 10 similar users

            # Get events liked by similar users
            interaction_matrix = self.model['interaction_matrix']
            recommended_scores = np.zeros(interaction_matrix.shape[1])

            for sim_user_idx in similar_users_idx:
                sim_score = user_similarity[sim_user_idx]
                recommended_scores += sim_score * interaction_matrix[sim_user_idx].toarray().flatten()

            # Get user's already interacted events
            user_events = interaction_matrix[user_idx].toarray().flatten()

            # Filter out already interacted events
            recommended_scores[user_events > 0] = -np.inf

            # Get top recommendations
            top_event_indices = np.argsort(recommended_scores)[::-1][:limit]

            event_idx_reverse = {idx: eid for eid, idx in self.model['event_idx'].items()}
            recommended_event_ids = [event_idx_reverse[idx] for idx in top_event_indices if recommended_scores[idx] > 0]

            # Fetch event details
            recommendations = self._fetch_event_details(recommended_event_ids, city)

            return recommendations

        except Exception as e:
            logger.error(f"Error in collaborative filtering: {e}")
            return []

    def _content_based_recommendations(
        self,
        user_id: str,
        city: Optional[str],
        limit: int
    ) -> List[Dict[str, Any]]:
        """Generate recommendations using content-based filtering"""
        # Simplified content-based (genre/artist matching)
        conn = self.get_db_connection()
        try:
            query = """
            SELECT e.id, e.title, e.title as artist_name, e.genres as genre, e.city,
                   e.start_time as date, e.price_min as price, e.venue_name,
                   0.5 as score
            FROM events e
            WHERE e.start_time >= NOW()
            """

            params = []

            if city:
                query += " AND LOWER(e.city) = LOWER(%s)"
                params.append(city)

            query += " ORDER BY e.start_time ASC LIMIT %s"
            params.append(limit)

            cursor = conn.cursor()
            cursor.execute(query, params)
            results = cursor.fetchall()

            return [{
                'event_id': r['id'],
                'title': r['title'],
                'artist_name': r['artist_name'],
                'genre': r['genre'],
                'city': r['city'],
                'date': r['date'].isoformat() if r['date'] else None,
                'price': float(r['price']) if r['price'] else None,
                'venue_name': r['venue_name'],
                'score': float(r['score']),
                'algorithm': 'content_based'
            } for r in results]

        except Exception as e:
            logger.error(f"Error in content-based recommendations: {e}")
            return []
        finally:
            conn.close()

    def _hybrid_recommendations(
        self,
        user_id: str,
        city: Optional[str],
        limit: int
    ) -> List[Dict[str, Any]]:
        """Hybrid approach: combine collaborative and content-based"""
        # Get both types of recommendations
        cf_recs = self._collaborative_filtering_recommendations(user_id, city, limit)
        cb_recs = self._content_based_recommendations(user_id, city, limit)

        # Merge and deduplicate
        all_recs = {}
        for rec in cf_recs:
            all_recs[rec['event_id']] = {**rec, 'score': rec.get('score', 0.5) * 0.6}

        for rec in cb_recs:
            if rec['event_id'] in all_recs:
                all_recs[rec['event_id']]['score'] += rec.get('score', 0.5) * 0.4
            else:
                all_recs[rec['event_id']] = {**rec, 'score': rec.get('score', 0.5) * 0.4}

        # Sort by combined score
        sorted_recs = sorted(all_recs.values(), key=lambda x: x['score'], reverse=True)

        return sorted_recs[:limit]

    def _popularity_recommendations(self, city: Optional[str], limit: int) -> List[Dict[str, Any]]:
        """Fallback: popularity-based recommendations"""
        conn = self.get_db_connection()
        try:
            query = """
            SELECT e.id, e.title, e.title as artist_name, e.genres as genre, e.city,
                   e.start_time as date, e.price_min as price, e.venue_name,
                   COUNT(se.event_id) as save_count
            FROM events e
            LEFT JOIN user_saved_events se ON e.id = se.event_id
            WHERE e.start_time >= NOW()
            """

            params = []
            if city:
                query += " AND LOWER(e.city) = LOWER(%s)"
                params.append(city)

            query += " GROUP BY e.id ORDER BY save_count DESC, e.start_time ASC LIMIT %s"
            params.append(limit)

            cursor = conn.cursor()
            cursor.execute(query, params)
            results = cursor.fetchall()

            return [{
                'event_id': r['id'],
                'title': r['title'],
                'artist_name': r['artist_name'],
                'genre': r['genre'],
                'city': r['city'],
                'date': r['date'].isoformat() if r['date'] else None,
                'price': float(r['price']) if r['price'] else None,
                'venue_name': r['venue_name'],
                'score': float(r['save_count'] or 0),
                'algorithm': 'popularity'
            } for r in results]

        except Exception as e:
            logger.error(f"Error in popularity recommendations: {e}")
            return []
        finally:
            conn.close()

    def _fetch_event_details(self, event_ids: List[str], city: Optional[str] = None) -> List[Dict[str, Any]]:
        """Fetch full event details from database"""
        if not event_ids:
            return []

        conn = self.get_db_connection()
        try:
            placeholders = ','.join(['%s'] * len(event_ids))
            query = f"""
            SELECT id, title, title as artist_name, genres as genre, city,
                   start_time as date, price_min as price, venue_name
            FROM events
            WHERE id IN ({placeholders})
            AND start_time >= NOW()
            """

            params = event_ids

            if city:
                query += " AND city = %s"
                params.append(city)

            cursor = conn.cursor()
            cursor.execute(query, params)
            results = cursor.fetchall()

            return [{
                'event_id': r['id'],
                'title': r['title'],
                'artist_name': r['artist_name'],
                'genre': r['genre'],
                'city': r['city'],
                'date': r['date'].isoformat() if r['date'] else None,
                'price': float(r['price']) if r['price'] else None,
                'venue_name': r['venue_name'],
                'algorithm': 'collaborative_filtering'
            } for r in results]

        except Exception as e:
            logger.error(f"Error fetching event details: {e}")
            return []
        finally:
            conn.close()

    def _get_fallback_recommendations(
        self,
        user_id: str,
        city: Optional[str],
        limit: int
    ) -> List[Dict[str, Any]]:
        """Fallback when model is not available"""
        return self._popularity_recommendations(city, limit)

    def record_feedback(
        self,
        user_id: str,
        event_id: str,
        action: str,
        context: Optional[Dict[str, Any]] = None
    ):
        """Record user feedback for future model training"""
        conn = self.get_db_connection()
        try:
            # Store feedback in database for next retraining cycle
            query = """
            INSERT INTO ml_feedback (user_id, event_id, action, context, created_at)
            VALUES (%s, %s, %s, %s, NOW())
            """

            cursor = conn.cursor()
            cursor.execute(query, (user_id, event_id, action, str(context or {})))
            conn.commit()

            logger.info(f"Feedback recorded: user={user_id}, event={event_id}, action={action}")

        except Exception as e:
            logger.error(f"Error recording feedback: {e}")
        finally:
            conn.close()

    def get_model_metrics(self) -> Dict[str, Any]:
        """Get current model performance metrics"""
        return {
            'version': self.model_version,
            'last_trained': self.last_trained or 'never',
            'training_samples': len(self.model.get('user_ids', [])) if self.model else 0,
            'validation_metrics': self._compute_validation_metrics(
                self.model['interaction_matrix'],
                self.model['user_similarity']
            ) if self.model else {}
        }
