-- Waitlist for the next guide. Emails are only used to tell people about the launch (they ticked consent).
CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  travel_month TEXT,          -- YYYY-MM, optional
  source TEXT,                -- e.g. 'bio', 'shop', ?src=… from a post
  consent INTEGER NOT NULL DEFAULT 1,
  unsubscribed_at TEXT
);
