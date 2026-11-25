const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const n of process.argv.slice(2)) {
    const [w, h] = n.startsWith('c') ? [1080, 1350] : [1080, 1920];
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto('file:///tmp/claude-0/promo/' + n + '.html'); await p.waitForTimeout(500);
    await p.screenshot({ path: '/tmp/claude-0/promo/' + n + '.png' }); await p.close();
  }
  await b.close();
})();
