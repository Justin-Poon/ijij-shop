# Listing images (new $40 guide, launch)

Premium set for the shop / Etsy listing, to A/B test against the current images. 2000×1500 (4:3).
Look (v2, after Justin found v1 cluttered): **restraint**. A real photographed plaster wall with leaf shadows (Unsplash, Sergey Kotenev),
the title left in Instrument Serif with one maroon (#6b1234) italic word, a thin rule, three quiet lines of Outfit, and the guide
as large printed pages on the right. No pills, arrows, devices or stamp. One idea per image.

Chosen look: blurred shoji background (src/hero-shoji.html + feat.css), large dark text on a cream fade for readability at thumbnail size.
Build: edit `src/*.html` (pages come from japan-the-complete-guide.pdf via `pdftoppm -r 130`), then
`node src/shot.cjs $PWD/src/heroA.html out.png` (hero.html is the rejected v1).

Feature images (calm look + feature-led, like the reference): `python3 src/feat.py` writes 02–05 HTML; render each with shot.cjs.
Done: 01 hero · 02 planner · 03 neighbourhoods · 04 what to book · 05 mistakes. Still to do: 06 proof (reviews) · 07 what you get.
05 the Canva planner · 06 tips you only learn the hard way · 07 proof (5,000+ travellers, reviews) · 08 what you get.

Background options (blurred Japanese photos, Unsplash): shoji = De An Sun, tatami = Yosuke Ota, kyoto = Fabrizio Chiagano. See options/.

Previews blur page body text below each page heading (src/*-b.png, Gaussian 7px) so the listing shows layout, not content. No eyebrow labels above titles.
