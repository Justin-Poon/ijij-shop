-- Customer reviews left on /review. Nothing is shown on the shop until the owner approves it.
CREATE TABLE reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT NOT NULL,
  name        TEXT NOT NULL,              -- shown publicly (first name, or first name + initial)
  stars       INTEGER NOT NULL,           -- 1 to 5
  text        TEXT NOT NULL,
  email       TEXT,                       -- private: only used to check it's a real buyer
  order_id    TEXT,                       -- set when the email matches an order
  verified    INTEGER NOT NULL DEFAULT 0, -- 1 = matched a paid, unrefunded order
  consent     INTEGER NOT NULL DEFAULT 0, -- 1 = OK to show on the site
  status      TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'hidden'
  decided_at  TEXT
);
CREATE INDEX reviews_status ON reviews (status, created_at);
