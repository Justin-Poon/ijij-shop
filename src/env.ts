export interface Env {
  DB: D1Database;
  FILES: R2Bucket;

  SITE_URL: string;
  EMAIL_FROM: string;
  DOWNLOAD_DAYS: string;
  DOWNLOAD_MAX: string;
  GUIDE_KEY: string;

  // Secrets (set with `wrangler pages secret put` or in .dev.vars)
  STRIPE_SECRET_KEY: string;
  STRIPE_PUBLISHABLE_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_BUNDLE: string;
  STRIPE_PRICE_UPGRADE: string;
  PLANNER_14_URL: string;
  PLANNER_21_URL: string;
  RESEND_API_KEY?: string;
  ADMIN_TOKEN?: string;

  // Bot protection (optional: everything still works without them)
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET?: string;
  CHECKOUT_LIMITER?: RateLimit;
  TRACK_LIMITER?: RateLimit;

  // Testing only: point Stripe calls at a mock server.
  STRIPE_API_BASE?: string;
}
