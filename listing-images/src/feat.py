import json, sys
F = {
 "02-planner": dict(kicker="", title="My <em>14-day</em> trip,<br>all planned for you",
   pts=[("Day by day","Where I'd stay, eat and go"),
        ("Make it yours","Swap anything around in Canva"),
        ("Or keep it loose","How I'd split 7, 10 or 14 days")],
   pages=["p6-006-b.png","p96-096-b.png"]),
 "03-tokyo": dict(kicker="", title="Where I'd go,<br><em>area</em> by area",
   pts=[("Tokyo first","What each neighbourhood is like"),
        ("Then the rest","Hakone, Kyoto, Osaka, Nara and more"),
        ("My favourite spots","The ones I'd tell a friend about")],
   pages=["p76-076-b.png","p77-077-b.png"]),
 "04-book": dict(kicker="", title="What to <em>book</em><br>before you go",
   pts=[("The sell-outs","Nintendo Museum, PokéPark, Ghibli"),
        ("When they open","And how hard I've found each one"),
        ("The boring bits","Visas, apps and SIMs, sorted early")],
   pages=["p19-019-b.png","p20-020-b.png"]),
 "05-mistakes": dict(kicker="", title="Learn from<br>my <em>mistakes</em>",
   pts=[("The big nine","My top 9 to avoid"),
        ("Etiquette, minus the stress","Onsen, ryokan, trains and toilets"),
        ("The little things","Bins, late trains and more")],
   pages=["p95-095-b.png","p68-068-b.png"]),
 "06-money": dict(kicker="", title="What Japan<br><em>actually</em> costs",
   pts=[("A day's budget","Food, transport and activities"),
        ("Tax-free, honestly","The new 2026 rules, step by step"),
        ("Worth the suitcase","What I always make room for")],
   pages=["p32-032-b.png","p26-026-b.png"]),
 "07-transport": dict(kicker="", title="How I get <em>around</em>",
   pts=[("Which IC card","Suica, PASMO or ICOCA, and why"),
        ("From the airport","The train I'd take into town"),
        ("Travelling light","Trains, lockers and luggage")],
   pages=["p41-041-b.png","p45-045-b.png"]),
 "08-stay": dict(kicker="", title="Where I'd <em>stay</em>",
   pts=[("Hotels to capsules","What each is like, and the cost"),
        ("One ryokan night","Why I think it's worth it"),
        ("Jetlag","What I do in the first 48 hours")],
   pages=["p53-053-b.png","p63-063-b.png"]),
 "09-food": dict(kicker="", title="How I <em>eat</em><br>in Japan",
   pts=[("Ordering","Ticket machines and izakaya, explained"),
        ("Konbini","My go-tos at each of the big three"),
        ("Special diets","Vegetarian, vegan and allergy tips")],
   pages=["p70-070-b.png","p72-072-b.png"]),
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
