-- db_full.sql
CREATE DATABASE IF NOT EXISTS tg_game CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE tg_game;

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  telegram_id BIGINT NOT NULL UNIQUE,
  username VARCHAR(255),
  name VARCHAR(255),
  email VARCHAR(255),
  points INT DEFAULT 0,
  role ENUM('user','admin','superadmin') DEFAULT 'user',
  banned TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GAMES (configurable games)
CREATE TABLE IF NOT EXISTS games (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(100) UNIQUE,
  title VARCHAR(255),
  description TEXT,
  config JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AD SESSIONS (ad_token usage)
CREATE TABLE IF NOT EXISTS ad_sessions (
  token VARCHAR(64) PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  used TINYINT(1) DEFAULT 0,
  INDEX (telegram_id)
);

-- AD VIEWS log
CREATE TABLE IF NOT EXISTS ad_views (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- CHECKINS
CREATE TABLE IF NOT EXISTS checkins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  checkin_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- WITHDRAWS
CREATE TABLE IF NOT EXISTS withdraws (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  amount INT NOT NULL,
  method VARCHAR(50),
  account VARCHAR(100),
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  admin_note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- REDEEMS
CREATE TABLE IF NOT EXISTS redeems (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  amount INT NOT NULL,
  status ENUM('pending','approved','declined') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- FINANCE LOG
CREATE TABLE IF NOT EXISTS finance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('revenue','expense') NOT NULL,
  amount INT NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SETTINGS
CREATE TABLE IF NOT EXISTS settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) UNIQUE,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- LOGS / AUDIT
CREATE TABLE IF NOT EXISTS logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  level ENUM('info','warn','error','audit') DEFAULT 'info',
  message TEXT,
  meta JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API KEYS (for external services)
CREATE TABLE IF NOT EXISTS api_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100),
  key_value TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- default settings entries
INSERT INTO settings (name, value) VALUES ('ads_provider','adsterra') ON DUPLICATE KEY UPDATE value=value;
INSERT INTO settings (name, value) VALUES ('ads_script','<!-- PASTE_ADSTERRA_SCRIPT_HERE -->') ON DUPLICATE KEY UPDATE value=value;
INSERT INTO settings (name, value) VALUES ('point_value_rupiah','1000:100') ON DUPLICATE KEY UPDATE value=value;
INSERT INTO settings (name, value) VALUES ('min_withdraw_points','25000') ON DUPLICATE KEY UPDATE value=value;
