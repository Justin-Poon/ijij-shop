# Listing images (new $40 guide, launch)

Premium set for the shop / Etsy listing, to A/B test against the current images. 2000×1500 (4:3).
Look (v2, after Justin found v1 cluttered): **restraint**. A real photographed plaster wall with leaf shadows (Unsplash, Sergey Kotenev),
the title left in Instrument Serif with one maroon (#6b1234) italic word, a thin rule, three quiet lines of Outfit, and the guide
as large printed pages on the right. No pills, arrows, devices or stamp. One idea per image.

Build: edit `src/*.html` (pages come from japan-the-complete-guide.pdf via `pdftoppm -r 130`), then
`node src/shot.cjs $PWD/src/heroA.html out.png` (hero.html is the rejected v1).

Planned set: 01 hero · 02 day-by-day itinerary · 03 food & activity picks · 04 areas & where to stay ·
05 the Canva planner · 06 tips you only learn the hard way · 07 proof (5,000+ travellers, reviews) · 08 what you get.
