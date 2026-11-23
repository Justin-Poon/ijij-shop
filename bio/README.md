# Bio link site (itsjustinjapan.com)

Source for the link-in-bio page, hosted on Cloudflare Pages (project `itsjustinjapan`, direct upload).
Deployed as the Worker `itsjustinjapan-bio` by Cloudflare Workers Builds from this repo (root directory `bio`):
every push to main that changes this folder goes live. `wrangler.toml` and this README are not served (`.assetsignore`).

Local check: `npx wrangler dev` in this folder.
Rollback: Cloudflare → Workers & Pages → itsjustinjapan-bio → Deployments.
