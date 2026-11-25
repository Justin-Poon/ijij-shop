import json, sys
F = {
 "02-planner": dict(kicker="Included", title="A <em>14-day</em> plan,<br>ready to go",
   pts=[("Day by day","Hotels, food and things to do, mapped out"),
        ("Yours to change","A Canva template: swap days, cities and activities"),
        ("Or keep it loose","How to split 7, 10 or 14 days if you'd rather wing it")],
   pages=["p6-006-b.png","p96-096-b.png"]),
 "03-tokyo": dict(kicker="Where to go", title="Every<br><em>neighbourhood</em><br>explained",
   pts=[("Tokyo, area by area","What each area is like and what to do"),
        ("Six more places","Hakone, Kyoto, Osaka, Nara and more"),
        ("My favourite spots","The places I'd send a friend, from my own trips")],
   pages=["p76-076-b.png","p77-077-b.png"]),
 "04-book": dict(kicker="Before you go", title="What to <em>book</em><br>and when",
   pts=[("Sell-out list","Nintendo Museum, PokéPark, Ghibli and more"),
        ("When it opens","Release dates and how hard each one is to get"),
        ("Visas, apps, SIMs","Everything to sort before you fly")],
   pages=["p19-019-b.png","p20-020-b.png"]),
 "05-mistakes": dict(kicker="Practical stuff", title="Skip the <em>mistakes</em><br>I made",
   pts=[("Top 9 mistakes","From where not to stay to shops that open late"),
        ("Etiquette, simply","Onsen, ryokan, trains and toilets"),
        ("Eat like a local","Ticket machines, izakaya, konbini and phrases")],
   pages=["p95-095-b.png","p68-068-b.png"]),
}
CSS = open("feat.css").read()
for name, f in F.items():
    pts = "".join(f'<li><span class="n">{i+1}</span><div><b>{h}</b><span>{d}</span></div></li>' for i,(h,d) in enumerate(f["pts"]))
    a, b = f["pages"]
    html = f'''<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<div class="bg"></div><div class="warm"></div>
<div class="head"><h1>{f["title"]}</h1><div class="line"></div><ol>{pts}</ol></div>
<div class="pg back"><img src="{b}"></div><div class="pg front"><img src="{a}"></div>
<div class="brand">itsjustinjapan’s guide to Japan</div></body></html>'''
    open(f"{name}.html","w").write(html)
print(list(F))
