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
.tag{font-family:IS;font-style:italic;font-size:50px;color:#6b1234;margin-top:18px}

.stars{color:#6b1234;font-size:46px;letter-spacing:6px;margin-top:6px}
.quote{font-family:IS;font-style:italic;font-size:64px;line-height:1.08;color:#2b1a1e;margin-top:20px}
.who{margin-top:16px;font-size:34px;color:#5e4a40}
.small{margin-top:26px;font-size:38px;line-height:1.3;color:#2b1a1e}
.tabs{display:flex;gap:6px;justify-content:center;margin:26px auto 0;flex-wrap:wrap;max-width:820px}
.tab{background:#fff;border:1.5px solid #d8c9bc;border-radius:12px 12px 0 0;padding:10px 18px;font-size:32px;color:#6b5a50}
.tab.x{text-decoration:line-through}
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
def make(name,w,h,title,fs,top,pts=None,sub=None,pages=None,ptop=700,pw=500,cta=None,br=60,extra="",tag=None):
    css=CSS.replace("W px",f"{w}px").replace("H px",f"{h}px").replace("TOP",str(top)).replace("FS",str(fs)).replace("BR",str(br))
    body=f'<h1>{title}</h1>'
    if tag: body+=f'<div class="tag">{tag}</div>'
    if sub: body+=f'<div class="sub">{sub}</div>'
    if pts: body+='<div class="line"></div><ol>'+"".join(f'<li><span class="n">{i+1}</span><span>{p}</span></li>' for i,p in enumerate(pts))+'</ol>'
    if cta: body+=f'<div class="cta">{cta}</div>'
    pg=page(w,h,ptop,pages,pw=pw) if pages else ""
    open(f"{name}.html","w").write(f'<!doctype html><html><head><meta charset="utf-8"><style>{css}</style></head><body><div class="bg"></div><div class="warm"></div>{pg}<div class="head">{body}</div>{extra}</body></html>')

# ---- Feed ads 1080x1350
make("ad1-tabs",1080,1350,"Planning Japan with<br>40 tabs <em>open?</em>",104,90,
  sub='<div class="tabs"><span class="tab x">best itinerary japan</span><span class="tab x">tokyo or kyoto first</span><span class="tab x">which suica</span><span class="tab x">jr pass worth it</span></div><div class="small">I&#39;ve done the planning for you 🫶</div>',
  pages=["p1-001.png"],ptop=640,pw=420)
make("ad2-review",1080,1350,"“Made my Japan trip<br>planning <em>100x easier</em>”",96,110,
  sub='<div class="stars">★★★★★</div><div class="who">Helen, on my last guide · 5,000+ people have used it</div>',
  pages=["p1-001.png"],ptop=640,pw=420)
make("ad3-inside",1080,1350,"Everything I'd tell<br>a <em>friend</em> going to Japan",96,80,
  pts=["My 14-day trip, day by day","Where I'd go, area by area","What to book before you go","The mistakes I made, so you don't"],
  pages=["p76-076-b.png","p95-095-b.png"],ptop=800,pw=400)
make("ad4-reviews",1080,1350,"What people said<br>about my <em>last</em> guide",100,90,
  sub='<div class="stars">★★★★★</div><div class="quote" style="font-size:44px">“Allowed me to deviate because there were so many alternative suggestions”</div><div class="who">Saul</div><div class="quote" style="font-size:44px">“Really love having this as a starting point”</div><div class="who">Karina S.</div><div class="small">The new 2027 guide is even better. Honestly.</div>',
  pages=["p1-001.png"],ptop=820,pw=330)
# ---- Story ads 1080x1920 (bottom third clear for a link sticker)
make("st1-tabs",1080,1920,"Planning Japan with<br>40 tabs <em>open?</em>",112,240,
  sub='<div class="tabs"><span class="tab x">best itinerary japan</span><span class="tab x">tokyo or kyoto first</span><span class="tab x">which suica</span><span class="tab x">jr pass worth it</span></div><div class="small">I&#39;ve done the planning for you 🫶</div>',
  pages=["p1-001.png"],ptop=860,pw=440,br=90)
make("st2-review",1080,1920,"“Made my Japan trip<br>planning <em>100x easier</em>”",104,260,
  sub='<div class="stars">★★★★★</div><div class="who">Helen, on my last guide</div><div class="small">5,000+ people have used it.<br>The new 2027 one is out now.</div>',
  pages=["p1-001.png"],ptop=900,pw=440,br=90)
