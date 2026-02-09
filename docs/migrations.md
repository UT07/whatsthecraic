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

## Local Dev
`init-gigsdb.sql` includes both changes for local bootstrapping.

## Production
Apply the migrations in order against production DB before deploying new service versions.
