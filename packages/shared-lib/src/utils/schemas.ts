/**
 * Common Zod validation schemas shared across services
 */

import { z } from 'zod';

/**
 * Pagination schema
 */
export const PaginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export type Pagination = z.infer<typeof PaginationSchema>;

/**
 * City filter schema
 */
export const CityFilterSchema = z.object({
  city: z.string().optional(),
});

export type CityFilter = z.infer<typeof CityFilterSchema>;

/**
 * Event search schema
 */
export const EventSearchSchema = z.object({
  city: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  genres: z.string().optional(),
  q: z.string().optional(),
}).merge(PaginationSchema);

export type EventSearch = z.infer<typeof EventSearchSchema>;

/**
 * DJ search schema
 */
export const DJSearchSchema = z.object({
  city: z.string().optional(),
  genre: z.string().optional(),
  q: z.string().optional(),
}).merge(PaginationSchema);

export type DJSearch = z.infer<typeof DJSearchSchema>;

/**
 * Venue search schema
 */
export const VenueSearchSchema = z.object({
  city: z.string().optional(),
  q: z.string().optional(),
}).merge(PaginationSchema);

export type VenueSearch = z.infer<typeof VenueSearchSchema>;

/**
 * User login schema
 */
export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type Login = z.infer<typeof LoginSchema>;

/**
 * User signup schema
 */
export const SignupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
});

export type Signup = z.infer<typeof SignupSchema>;

/**
 * ID parameter schema
 */
export const IdParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export type IdParam = z.infer<typeof IdParamSchema>;
