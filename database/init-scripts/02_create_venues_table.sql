-- 02_create_venues_table.sql
USE gigsdb;

CREATE TABLE IF NOT EXISTS venues (
  id INT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,
  capacity INT DEFAULT 100,
  genreFocus VARCHAR(100) DEFAULT 'Various',
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS venue_availability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  venue_id INT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  status VARCHAR(32) DEFAULT 'available',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY venue_availability_venue_idx (venue_id),
  CONSTRAINT fk_venue_availability_venue FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE
);
