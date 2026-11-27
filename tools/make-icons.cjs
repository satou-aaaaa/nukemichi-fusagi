// アプリのアイコン（icon-192.png・icon-512.png）を作る。紺の地に、四角いロボの顔と、ふさいだ穴（板）。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#123554"/>
      <path d="M50 12 V22" stroke="#c9a46a" stroke-width="4"/><circle cx="50" cy="11" r="5" fill="#b23a24"/>
      <rect x="22" y="22" width="56" height="44" rx="10" fill="#fffdf7"/>
      <circle cx="38" cy="42" r="6" fill="#123554"/><circle cx="62" cy="42" r="6" fill="#123554"/><rect x="38" y="54" width="24" height="5" rx="2" fill="#123554"/>
      <rect x="18" y="74" width="64" height="14" rx="3" fill="#b23a24"/><g fill="#83261a"><circle cx="26" cy="81" r="2"/><circle cx="74" cy="81" r="2"/></g></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", `icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();
