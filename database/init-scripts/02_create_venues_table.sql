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
