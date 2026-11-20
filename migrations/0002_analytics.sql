-- Funnel analytics: page views and checkout starts, attributed to a traffic source.
-- No personal data: `visitor` is a random id the browser makes up.
CREATE TABLE events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        TEXT NOT NULL,             -- ISO time
  day       TEXT NOT NULL,             -- YYYY-MM-DD (Melbourne time), for daily rollups
  event     TEXT NOT NULL,             -- 'view' | 'checkout'
  source    TEXT NOT NULL,             -- 'tiktok' | 'instagram' | 'direct' | 'other:<host>' | src param
  visitor   TEXT,
  campaign  TEXT                       -- optional utm_campaign / ?c=
);
CREATE INDEX events_day ON events (day, event, source);

-- Which source each order came from.
ALTER TABLE orders ADD COLUMN source TEXT;
ALTER TABLE orders ADD COLUMN visitor TEXT;
ALTER TABLE orders ADD COLUMN campaign TEXT;
