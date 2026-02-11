# Database Migration Plan

## Purpose
Track schema changes required for the Phase 0 stabilization.

## Migration 001 — Auth Users Table
Add a `users` table for `auth-service`:
```
CREATE TABLE users (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Migration 002 — DJ Currency Column
Add a currency column for fee normalization:
```
ALTER TABLE djs ADD COLUMN currency VARCHAR(10) DEFAULT 'EUR';
```

## Migration 003 — Canonical Events Tables
Create canonical events and source mapping:
```
CREATE TABLE events (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  dedupe_key CHAR(40) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  city VARCHAR(100),
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  venue_name VARCHAR(255),
  ticket_url VARCHAR(500),
  age_restriction VARCHAR(50),
  price_min DECIMAL(10,2),
  price_max DECIMAL(10,2),
  currency VARCHAR(10),
  genres JSON,
  tags JSON,
  images JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE source_events (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  source_id VARCHAR(255) NOT NULL,
  event_id INT NOT NULL,
  raw_payload JSON,
  last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY source_events_unique (source, source_id),
  INDEX source_events_event (event_id),
  CONSTRAINT fk_source_events_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
```

## Migration 004 — Ingest State + Saved Events
```
CREATE TABLE ingest_state (
  source VARCHAR(50) NOT NULL,
  city VARCHAR(100) NOT NULL,
  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  window_start DATETIME,
  window_end DATETIME,
  PRIMARY KEY (source, city)
);

CREATE TABLE user_saved_events (
  user_id INT NOT NULL,
  event_id INT NOT NULL,
  saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, event_id),
  CONSTRAINT fk_saved_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_saved_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
```

## Migration 005 — Spotify + Preferences
```
CREATE TABLE user_preferences (
  user_id INT NOT NULL,
  preferred_genres JSON,
  preferred_artists JSON,
  preferred_cities JSON,
  preferred_venues JSON,
  preferred_djs JSON,
  budget_max DECIMAL(10,2),
  radius_km INT,
  night_preferences JSON,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_user_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE user_spotify (
  user_id INT NOT NULL,
  spotify_user_id VARCHAR(128) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type VARCHAR(32) DEFAULT 'Bearer',
  scope VARCHAR(255),
  expires_at DATETIME NOT NULL,
  top_artists JSON,
  top_genres JSON,
  last_synced_at TIMESTAMP NULL DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY user_spotify_spotify_user_id_unique (spotify_user_id),
  CONSTRAINT fk_user_spotify_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## Migration 006 — Extend Preferences (Existing DBs)
```
ALTER TABLE user_preferences
  ADD COLUMN preferred_cities JSON,
  ADD COLUMN preferred_venues JSON,
  ADD COLUMN preferred_djs JSON,
  ADD COLUMN budget_max DECIMAL(10,2),
  ADD COLUMN radius_km INT,
  ADD COLUMN night_preferences JSON;
```

## Migration 007 — Organizer Marketplace Tables
```
CREATE TABLE event_plans (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  city VARCHAR(100),
  start_date DATETIME,
  end_date DATETIME,
  capacity INT,
  budget_min DECIMAL(10,2),
  budget_max DECIMAL(10,2),
  genres JSON,
  gear_needs JSON,
  vibe_tags JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_event_plans_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE event_plan_shortlists (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  plan_id INT NOT NULL,
  item_type VARCHAR(16) NOT NULL,
  item_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_plan_item (plan_id, item_type, item_id),
  CONSTRAINT fk_plan_shortlist_plan FOREIGN KEY (plan_id) REFERENCES event_plans(id) ON DELETE CASCADE
);

CREATE TABLE contact_requests (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  plan_id INT DEFAULT NULL,
  item_type VARCHAR(16) NOT NULL,
  item_id INT NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(32) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_contact_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_contact_plan FOREIGN KEY (plan_id) REFERENCES event_plans(id) ON DELETE SET NULL
);
```

## Migration 008 — User Role (RBAC)
```
ALTER TABLE users ADD COLUMN role VARCHAR(32) DEFAULT 'user';
```

## Migration 009 — Alerts + Venue Availability
```
CREATE TABLE user_alerts (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  artist_name VARCHAR(255) NOT NULL,
  city VARCHAR(100),
  radius_km INT,
  last_notified_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX user_alerts_user_idx (user_id),
  CONSTRAINT fk_user_alerts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE venue_availability (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  venue_id INT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  status VARCHAR(32) DEFAULT 'available',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX venue_availability_venue_idx (venue_id),
  CONSTRAINT fk_venue_availability_venue FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE
);
```

## Migration 010 — Hidden Events
```
CREATE TABLE user_hidden_events (
  user_id INT NOT NULL,
  event_id INT NOT NULL,
  hidden_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, event_id),
  INDEX user_hidden_events_event_idx (event_id),
  CONSTRAINT fk_hidden_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_hidden_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
```

## Local Dev
`init-gigsdb.sql` includes both changes for local bootstrapping.

## Production
Apply the migrations in order against production DB before deploying new service versions.
