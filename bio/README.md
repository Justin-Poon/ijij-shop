# Bio link site (itsjustinjapan.com)

Source for the link-in-bio page, hosted on Cloudflare Pages (project `itsjustinjapan`, direct upload).
This folder is a copy of the live site taken 23 Nov 2026, plus the waitlist banner. Deploy with:

    npx wrangler pages deploy bio --project-name itsjustinjapan           # production
    npx wrangler pages deploy bio --project-name itsjustinjapan --branch preview   # preview first

(Needs an API token with Account → Cloudflare Pages → Edit.) Previous versions can be rolled back in the
Cloudflare dashboard: Workers & Pages → itsjustinjapan → Deployments.
