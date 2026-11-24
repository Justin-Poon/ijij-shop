# Bio link site (itsjustinjapan.com)

Source for the link-in-bio page, hosted on Cloudflare Pages (project `itsjustinjapan`, direct upload).
Deployed as the Worker `itsjustinjapan-bio` by Cloudflare Workers Builds from this repo (root directory `bio`):
every push to main that changes this folder goes live. `wrangler.toml` and this README are not served (`.assetsignore`).

Local check: `npx wrangler dev` in this folder.
Rollback: Cloudflare → Workers & Pages → itsjustinjapan-bio → Deployments.

## Analytics
`worker.ts` counts views of the bio page and taps on each link (links are rewritten to `/go/<label>`, which logs and
redirects; only labels in `LINKS` are allowed). Events go to the shop's D1 (`bio_events`); see the "Bio link" section
of shop.itsjustinjapan.com/admin. Add a new outbound link to `LINKS` so it gets counted.
Story links: `itsjustinjapan.com/?c=<post>` tags the visit (and any tap) with that campaign.
