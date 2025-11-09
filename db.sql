BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT,
  role TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  token TEXT
);

INSERT OR IGNORE INTO users (username, password, role) VALUES ('admin', 'admin123', 'admin');
INSERT OR IGNORE INTO users (username, password, role) VALUES ('user', 'user123', 'user');

COMMIT;