/**
 * Common types shared across WhatsTheCraic microservices
 */

/**
 * User type representing an authenticated user
 */
export interface User {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'user' | 'organizer' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Event type representing a music/entertainment event
 */
export interface Event {
  id: string;
  title: string;
  description?: string;
  artistName: string;
  venueName: string;
  city: string;
  country: string;
  date: Date;
  price?: number;
  genre?: string;
  imageUrl?: string;
  source: string;
  sourceEventId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Venue type representing a performance venue
 */
export interface Venue {
  id: string;
  name: string;
  city: string;
  country: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  capacity?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DJ type representing a performer/DJ
 */
export interface DJ {
  id: string;
  name: string;
  genre: string;
  bio?: string;
  imageUrl?: string;
  socialLinks?: Record<string, string>;
  city?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * JWT payload structure for authentication
 */
export interface JwtPayload {
  userId: string;
  email: string;
  role: 'user' | 'organizer' | 'admin';
  scopes: string[];
  iat: number;
  exp: number;
}

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    context?: Record<string, unknown>;
  };
  meta?: {
    requestId?: string;
    timestamp?: string;
  };
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationMeta;
}
