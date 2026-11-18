-- One row per paid Stripe Checkout session.
CREATE TABLE orders (
  id            TEXT PRIMARY KEY,          -- Stripe Checkout session id (cs_...)
  email         TEXT NOT NULL,
  name          TEXT,
  has_21        INTEGER NOT NULL DEFAULT 0, -- bought the 21-day upgrade
  amount_total  INTEGER NOT NULL,           -- in the smallest currency unit
  currency      TEXT NOT NULL,
  discount      INTEGER NOT NULL DEFAULT 0,
  payment_intent TEXT,
  created_at    TEXT NOT NULL,
  emailed_at    TEXT,                       -- set once the delivery email is sent
  refunded_at   TEXT
);
CREATE INDEX orders_email ON orders (email);

-- Download links for the guide PDF. A new one can be issued for a resend.
CREATE TABLE download_tokens (
  token         TEXT PRIMARY KEY,
  order_id      TEXT NOT NULL REFERENCES orders (id),
  file_key      TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  downloads     INTEGER NOT NULL DEFAULT 0,
  max_downloads INTEGER NOT NULL,
  created_at    TEXT NOT NULL
);
CREATE INDEX download_tokens_order ON download_tokens (order_id);
