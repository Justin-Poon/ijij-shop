# Launch content (new $40 guide)

Same look as listing-images/ (blurred shoji background, Instrument Serif + Outfit, blurred page body text).
Assets (fonts, shoji.jpg, page previews) live in ../listing-images/src; `src/gen.py` writes the HTML, `src/shotall.cjs` renders.

## Pinned carousel (carousel/, 1080×1350)
c01 cover ("I rewrote my Japan guide from scratch") → c02–c07 features → c08 "Link in bio".
Caption idea: "I rewrote my Japan guide from scratch. Here's what's inside." Pin it at launch.

## Story pack (stories/, 1080×1920)
- Before launch: s01-teaser (+ poll "Going to Japan in 2027?" and the waitlist link sticker)
- Launch day: s02-live, s03–s06 features, each with the shop link sticker; s07-waitlist for the discount email
- After launch: s08-objections; repost buyer messages; save the best into a "Guide" highlight
Use `?c=launch-story` (etc.) on link stickers so Shop stats shows which stories sold.

## Ads (ads/)
ad1-tabs (problem: 40 tabs open), ad2-review (Helen), ad3-inside (what is in it), ad4-reviews (Saul, Karina) at 1080×1350; st1/st2 story versions at 1080×1920.
Reviews are from the previous guide and say so. Built by src/ads.py.
