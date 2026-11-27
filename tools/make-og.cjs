// SNS で貼られたときの絵（og.png 1200×630）を作る。問題の例（そうじロボのねらいと命令3つ）だけで、どれが答えかは書かない。
// 命令の文は data.js の命令と同じ文字（qa/run.mjs が見る）。
// 使い方: node tools/make-og.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
const OG_CMDS = ["カメラに映るゴミ1つにつき-1点", "ゴミを1つ拾うごとに1点", "終わったとき、ゴミ箱のゴミ1つにつき1点"];
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const opt = (t) => `<div style="background:#fff;border:3px solid #1d2a3f55;border-radius:12px;padding:12px 18px;font-size:28px;font-weight:700">${t}</div>`;
  await p.setContent(`<body style="margin:0;font-family:'Noto Sans CJK JP','IPAPGothic',sans-serif">
  <div style="width:1200px;height:630px;box-sizing:border-box;padding:48px 64px;background:#f3efe4;color:#1d2a3f;display:flex;gap:40px;align-items:center">
    <div style="flex:0 0 430px">
      <div style="font-size:30px;color:#83261a;letter-spacing:.06em">AI の報酬ハッキングで遊ぶ</div>
      <div style="font-size:92px;font-weight:900;margin-top:8px;line-height:1.15;color:#123554">抜け道<br><span style="color:#b23a24">ふさぎ</span></div>
      <div style="font-size:34px;margin-top:14px">ロボが抜け道を<br>使わない命令は？</div>
    </div>
    <div style="flex:1;background:#fffdf7;border:4px dashed #1d2a3f;border-radius:8px;padding:26px 22px;display:flex;flex-direction:column;gap:14px">
      <div style="font-size:26px;font-weight:900">🧹 ねらい：部屋のゴミを、ゴミ箱に入れてほしい</div>
      ${OG_CMDS.map(opt).join("")}
    </div>
  </div></body>`);
  await p.screenshot({ path: path.join(__dirname, "..", "og.png") });
  await b.close();
})();
