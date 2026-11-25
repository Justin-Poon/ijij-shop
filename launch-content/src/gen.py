import json
CSS='''@font-face{font-family:IS;src:url(instrument-serif.woff2)}
@font-face{font-family:IS;font-style:italic;src:url(instrument-serif-italic.woff2)}
@font-face{font-family:Outfit;src:url(outfit.woff2);font-weight:100 900}
*{box-sizing:border-box;margin:0}
body{width:W px;height:H px;overflow:hidden;position:relative;font-family:Outfit;color:#2b1a1e;background:#efe6da}
.bg{position:absolute;inset:-60px;background:url(shoji.jpg) center/cover;filter:blur(26px) saturate(.85) brightness(1.02)}
.warm{position:absolute;inset:0;background:linear-gradient(180deg,rgba(250,245,237,.95) 0%,rgba(250,245,237,.9) 38%,rgba(250,245,237,.25) 62%,rgba(250,245,237,0) 80%)}
.head{position:absolute;left:80px;right:80px;top:TOPpx;text-align:center}
h1{font-family:IS;font-weight:400;font-size:FSpx;line-height:.95;letter-spacing:-.015em}
h1 em{color:#6b1234}
.sub{margin-top:26px;font-size:36px;line-height:1.35;color:#2b1a1e}
.line{width:90px;height:3px;background:#6b1234;margin:34px auto 30px}
ol{list-style:none;padding:0;display:grid;gap:22px;text-align:left;max-width:860px;margin:0 auto}
li{display:flex;gap:22px;align-items:center}
.n{flex:none;width:58px;height:58px;border:2.5px solid #6b1234;border-radius:50%;display:grid;place-items:center;font-family:IS;font-size:34px;color:#6b1234}
li span:last-child{font-size:36px;line-height:1.25}
.pg{position:absolute;background:#fff;border-radius:3px;overflow:hidden}
.pg img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
.brand{position:absolute;left:0;right:0;bottom:BRpx;text-align:center;font-family:IS;font-style:italic;font-size:34px;color:#5e4a40}
.cta{display:inline-block;margin-top:40px;background:#6b1234;color:#fff;border-radius:999px;padding:22px 48px;font-size:34px;letter-spacing:.06em}
'''
def page(w,h,top,feat,two=True,pw=500):
    ph=int(pw*1.414); cx=w//2
    imgs=feat
    if len(imgs)==1:
        return f'<div class="pg" style="left:{cx-pw//2}px;top:{top}px;width:{pw}px;height:{ph}px;transform:rotate(3deg);box-shadow:-30px 50px 80px rgba(70,45,25,.30)"><img src="{imgs[0]}"></div>'
    a,b=imgs
    return (f'<div class="pg" style="left:{cx-pw+40}px;top:{top}px;width:{pw}px;height:{ph}px;transform:rotate(-6deg);box-shadow:-20px 40px 60px rgba(70,45,25,.22)"><img src="{b}"></div>'
            f'<div class="pg" style="left:{cx-60}px;top:{top+60}px;width:{pw}px;height:{ph}px;transform:rotate(4deg);box-shadow:-30px 50px 80px rgba(70,45,25,.30)"><img src="{a}"></div>')
def make(name,w,h,title,fs,top,pts=None,sub=None,pages=None,ptop=700,pw=500,cta=None,br=60,extra=""):
    css=CSS.replace("W px",f"{w}px").replace("H px",f"{h}px").replace("TOP",str(top)).replace("FS",str(fs)).replace("BR",str(br))
    body=f'<h1>{title}</h1>'
    if sub: body+=f'<div class="sub">{sub}</div>'
    if pts: body+='<div class="line"></div><ol>'+"".join(f'<li><span class="n">{i+1}</span><span>{p}</span></li>' for i,p in enumerate(pts))+'</ol>'
    if cta: body+=f'<div class="cta">{cta}</div>'
    pg=page(w,h,ptop,pages,pw=pw) if pages else ""
    open(f"{name}.html","w").write(f'<!doctype html><html><head><meta charset="utf-8"><style>{css}</style></head><body><div class="bg"></div><div class="warm"></div>{pg}<div class="head">{body}</div>{extra}</body></html>')
FEATS=[("A <em>14-day</em> plan,<br>ready to go",["Hotels, food and things to do, mapped out","A Canva template you can change","Or how to split 7, 10 or 14 days"],["p6-006-b.png","p96-096-b.png"]),
 ("Every <em>neighbourhood</em><br>explained",["Tokyo, area by area","Hakone, Kyoto, Osaka, Nara and more","The places I'd send a friend"],["p76-076-b.png","p77-077-b.png"]),
 ("What to <em>book</em><br>and when",["The sell-out list","When each one opens","Visas, apps and SIMs"],["p19-019-b.png","p20-020-b.png"]),
 ("Skip the <em>mistakes</em><br>I made",["The top 9 mistakes","Etiquette, simply","Bins, late trains and more"],["p95-095-b.png","p68-068-b.png"]),
 ("Spend <em>smarter</em>",["What to budget per day","The new 2026 tax-free rules","What's worth the suitcase space"],["p32-032-b.png","p26-026-b.png"]),
 ("Eat like a <em>local</em>",["How to order anywhere","Konbini favourites","Special diets"],["p70-070-b.png","p72-072-b.png"])]
# ---- Pinned carousel 1080x1350
make("c01",1080,1350,"The <em>complete</em><br>guide to Japan",128,110,sub="I rewrote my Japan guide from scratch.<br>Here's what's inside 👉",pages=["p1-001.png"],ptop=560,pw=480)
for i,(t,p,pg) in enumerate(FEATS):
    make(f"c{i+2:02d}",1080,1350,t,104,90,pts=p,pages=pg,ptop=720,pw=430)
make("c08",1080,1350,"102 pages,<br>made for <em>your</em> trip",112,170,sub="Guide + 14-day planner<br>Instant download · phone or print",cta="Link in bio",pages=["p1-001.png"],ptop=760,pw=380)
# ---- Story pack 1080x1920 (leave the lower third clear for a link sticker)
make("s01-teaser",1080,1920,"Something<br>I've been <em>working on</em> 👀",120,260,sub="My Japan guide, rewritten from scratch.<br>More soon.",pages=["p76-076-b.png","p96-096-b.png"],ptop=920,pw=470,br=90)
make("s02-live",1080,1920,"It's <em>here</em>",170,220,sub="The complete guide to Japan<br>+ 14-day planner",pages=["p1-001.png"],ptop=720,pw=560,br=90)
for i,(t,p,pg) in enumerate(FEATS[:4]):
    make(f"s{i+3:02d}-feature",1080,1920,t,120,200,pts=p,pages=pg,ptop=900,pw=470,br=90)
make("s07-waitlist",1080,1920,"On the <em>waitlist</em>?",140,300,sub="Your launch-day thank-you is in your inbox.<br>Check your email (and spam) 💌",pages=["p1-001.png"],ptop=820,pw=460,br=90)
make("s08-objections",1080,1920,"“Is it <em>worth it</em> if I've<br>already planned?”",104,260,sub="Yes. Most of the guide is the stuff<br>you only learn once you're there:<br>how to order, what to book, where not to stay.",pages=["p95-095-b.png","p70-070-b.png"],ptop=1000,pw=440,br=90)
print("ok")
