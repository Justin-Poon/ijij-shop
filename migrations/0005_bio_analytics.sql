-- Bio link analytics (itsjustinjapan.com): page views and outbound link clicks, plus the dates posts went out.
-- No personal data: `visitor` is a hash of IP + browser + a random salt that changes every day (salts are kept
-- only so the same visitor counts once per day; the IP itself is never stored).
CREATE TABLE bio_events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        TEXT NOT NULL,
  day       TEXT NOT NULL,             -- YYYY-MM-DD, Melbourne time
  kind      TEXT NOT NULL,             -- 'view' | 'click'
  target    TEXT,                      -- clicks: which link ('etsy-14', 'gumroad-notion', 'waitlist', …)
  source    TEXT NOT NULL,             -- 'instagram' | 'tiktok' | 'direct' | ?src= value …
  campaign  TEXT,                      -- ?c= (e.g. a story link for one post)
  visitor   TEXT,
  country   TEXT
);
CREATE INDEX bio_events_day ON bio_events (day, kind, target);

CREATE TABLE bio_salts (day TEXT PRIMARY KEY, salt TEXT NOT NULL);

-- When each post went out, so the dashboard can show the traffic it drove.
CREATE TABLE bio_posts (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  day       TEXT NOT NULL,             -- YYYY-MM-DD the post went live
  title     TEXT NOT NULL,
  platform  TEXT,                      -- 'instagram' | 'tiktok'
  views     INTEGER,                   -- optional: views from the app's insights
  created_at TEXT NOT NULL
);
