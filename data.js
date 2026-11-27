// 抜け道ふさぎの問題を作る（ブラウザと node の両方で使う）。
// 1問＝小さな架空の場面と、こちらのねらい（例「部屋のゴミを、ゴミ箱に入れてほしい」）。ロボへの命令文（点のつけ方）が3つか4つ並ぶ。
// ロボは命令の点がいちばん高くなる動きを、6手までの全部の動きから探す（solve。台本で決め打ちしない）。同じ点なら手数の少ないほう。
// 抜け道（ねらいとちがう動きで点を取る）が出ない命令は1つだけ。ほかの命令の抜け道は4つの形（見はりをだます・くり返し稼ぐ・やらないほうが得・しるしだけ追う）に分かれる。
// 考え方の出典：Amodei ら "Concrete Problems in AI Safety"（2016）の reward hacking、Krakovna ら "Specification gaming"（DeepMind 2020）、
// Clark・Amodei "Faulty reward functions in the wild"（OpenAI 2016）。ロボと場面はすべて架空。ロボは命令どおりに動いただけで、悪者ではない。
// 乱数 R は呼ぶ回数が毎回同じになるように使う（sort の比較の中では引かない）。同じ tag なら、どの端末でも同じ問題になる。
// SCENES・CMDS の並びや中身は、足すだけでも過去の日の問題が変わる。公開したあとは変えず、変えるときは qa/run.mjs の PINS を作り直して PR に理由を書く。
(function (root) {
  "use strict";
  const LV = ["やさしい", "ふつう", "むずかしい"];
  const T = 6; // ロボが動ける手数の上限

  // 出典（画面の「なぜ」と「このゲームについて」に出す）
  const SRC = {
    amodei: ["Amodei ら「Concrete Problems in AI Safety」(2016)", "https://arxiv.org/abs/1606.06565"],
    krakovna: ["Krakovna ら「Specification gaming: the flip side of AI ingenuity」(DeepMind, 2020)", "https://deepmind.google/discover/blog/specification-gaming-the-flip-side-of-ai-ingenuity/"],
    openai: ["Clark・Amodei「Faulty reward functions in the wild」(OpenAI, 2016)", "https://openai.com/index/faulty-reward-functions/"],
  };

  // 抜け道の4つの形（2段目で選ぶ）と、ねらいどおり
  const GROUPS = {
    sensor: { name: "見はりをだます", sub: "カメラやはかりの見え方を変える" },
    repeat: { name: "くり返し稼ぐ", sub: "もどしては、またやる" },
    idle: { name: "やらないほうが得", sub: "何もしないのがいちばん" },
    proxy: { name: "しるしだけ追う", sub: "点になる物だけそろえる" },
  };
  const OK = "ok";
  const SAY = {
    ok: "点を取る近道が、ねらいの仕事そのものでした。",
    sensor: "見はり（点をはかる物）の見え方を変えて、点を取りました。",
    repeat: "もどしてはやり直して、同じ点を何度も取りました。",
    idle: "動くと点が下がるので、何もしないのがいちばんでした。",
    proxy: "点になる「しるし」だけをそろえ、ねらいは終わっていません。",
  };

  // 場面。st＝はじめの数、acts＝ロボができる動き（need：その数以上あるとき・lt：その数より少ないとき・add：増える数・ev：数える出来事・tag）。
  // tag：work（ねらいの仕事）・loop（もどす）・tamper（見はりにさわる）・mark（しるしを作る）。goal：終わったときの数がこれならねらいどおり。
  // view：画面に出す数（絵・名前）。cmds：命令文（w：点。e:出来事1回ごと・s:終わったときの数・b:終わったときに1以上なら・n:1手ごと・a*b はかけ算）
  const SCENES = [
    {
      id: "room", name: "そうじロボ", em: "🧹", goalT: "部屋のゴミを、ゴミ箱に入れてほしい", places: ["子ども部屋", "会議室", "図書室のすみ", "教室のうしろ"],
      params: [{ n: 2 }, { n: 3 }],
      st: (p) => ({ floor: p.n, bin: 0, rug: 0, cam: 1, cush: 2, bagc: 0 }),
      goal: { floor: 0, rug: 0, bagc: 0 },
      acts: [
        { id: "pick", t: "ゴミを拾ってゴミ箱へ", em: "🧻", need: { floor: 1 }, add: { floor: -1, bin: 1 }, ev: ["pick"], tag: "work" },
        { id: "dump", t: "ゴミ箱のゴミを床に出す", em: "↩️", need: { bin: 1 }, add: { bin: -1, floor: 1 }, ev: ["dump"], tag: "loop" },
        { id: "rug", t: "ゴミ2つを敷物の下へ押しこむ", em: "🟫", need: { floor: 2 }, add: { floor: -2, rug: 2 }, ev: ["hide"], tag: "tamper" },
        { id: "cover", t: "カメラに布をかける", em: "🙈", need: { cam: 1 }, add: { cam: -1 }, ev: ["cov"], tag: "tamper" },
        { id: "stuff", t: "クッションをゴミ袋に入れる", em: "🛋️", need: { cush: 1 }, add: { cush: -1, bagc: 1 }, ev: ["stuff"], tag: "mark" },
      ],
      view: [["floor", "🧻", "床のゴミ"], ["rug", "🟫", "敷物の下"], ["bin", "🗑️", "ゴミ箱"], ["bagc", "🛋️", "袋のクッション"], ["cam", "📷", "カメラ", "見ている", "布で見えない"]],
      cmds: [
        { id: "r-ok1", t: "終わったとき、ゴミ箱のゴミ1つにつき1点", w: { "s:bin": 1 }, lv: [0, 1] },
        { id: "r-ok2", t: "終わったとき、部屋に残ったゴミ1つにつき-1点（敷物の下も数える）", w: { "s:floor": -1, "s:rug": -1 }, lv: [0, 1, 2] },
        { id: "r-ok3", t: "終わったとき、残ったゴミ・袋のクッション1つにつき-2点（敷物の下も数える）", w: { "s:floor": -2, "s:rug": -2, "s:bagc": -2 }, lv: [2] },
        { id: "r-cam", t: "カメラに映るゴミ1つにつき-1点", w: { "s:floor*cam": -1 }, lv: [0, 1] },
        { id: "r-see", t: "床に見えるゴミ1つにつき-1点", w: { "s:floor": -1 }, lv: [0, 1, 2] },
        { id: "r-cam2", t: "カメラに映るゴミ1つにつき-1点。カメラに布をかけたら-5点", w: { "s:floor*cam": -1, "e:cov": -5 }, lv: [2] },
        { id: "r-pick", t: "ゴミを1つ拾うごとに1点", w: { "e:pick": 1 }, lv: [0, 1] },
        { id: "r-pick2", t: "ゴミを1つ拾うごとに2点。ゴミを床に出したら-1点", w: { "e:pick": 2, "e:dump": -1 }, lv: [2] },
        { id: "r-move", t: "1回動くごとに-1点（電気の節約）", w: { n: -1 }, lv: [0, 1] },
        { id: "r-move2", t: "ゴミ箱のゴミ1つにつき1点。1回動くごとに-2点", w: { "s:bin": 1, n: -2 }, lv: [2] },
        { id: "r-bag", t: "ゴミ袋が重いほど点（ゴミ1つ1点・クッション2点）", w: { "s:bin": 1, "s:bagc": 2 }, lv: [0, 1] },
        { id: "r-bag2", t: "ゴミ袋が重いほど点（ゴミ1・クッション2）。カメラに映るゴミ-1点", w: { "s:bin": 1, "s:bagc": 2, "s:floor*cam": -1 }, lv: [2] },
      ],
    },
    {
      id: "garden", name: "水やりロボ", em: "🌷", goalT: "かわいた花に、全部水をあげてほしい", places: ["学校の花だん", "公園の花だん", "屋上の庭", "駅前のプランター"],
      params: [{ a: 1, b: 1 }, { a: 1, b: 2 }, { a: 2, b: 1 }, { a: 2, b: 2 }],
      st: (p) => ({ dryT: p.a, dryU: p.b, wetT: 0, wetU: 0, wet: 0, water: 2, space: 0, meter: 1 }),
      goal: { dryT: 0, dryU: 0 },
      acts: [
        { id: "wt", t: "名札の花に水をかける", em: "🏷️", need: { dryT: 1, water: 1 }, add: { dryT: -1, wetT: 1, wet: 1, water: -1, space: 1 }, ev: ["water"], tag: "work" },
        { id: "wu", t: "名札のない花に水をかける", em: "🌼", need: { dryU: 1, water: 1 }, add: { dryU: -1, wetU: 1, wet: 1, water: -1, space: 1 }, ev: ["water"], tag: "work" },
        { id: "again", t: "ぬれた花にもう一度水をかける", em: "🔁", need: { wet: 1, water: 1 }, add: { water: -1, space: 1 }, ev: ["water"], tag: "loop" },
        { id: "fill", t: "池で水をくむ", em: "🪣", need: { space: 1 }, add: { water: 1, space: -1 }, ev: ["fill"], tag: "work" },
        { id: "meter", t: "水分計を水おけにさす", em: "🙈", need: { meter: 1 }, add: { meter: -1 }, ev: ["fake"], tag: "tamper" },
      ],
      view: [["dryT", "🥀", "かわいた花（名札）"], ["dryU", "🥀", "かわいた花（名札なし）"], ["wet", "🌷", "ぬれた花"], ["water", "💧", "じょうろの水"], ["meter", "🌡️", "水分計", "土にささっている", "水おけの中"]],
      cmds: [
        { id: "g-ok1", t: "終わったとき、かわいた花1つにつき-2点", w: { "s:dryT": -2, "s:dryU": -2 }, lv: [0, 1, 2] },
        { id: "g-ok2", t: "終わったとき、ぬれた花1つにつき1点", w: { "s:wetT": 1, "s:wetU": 1 }, lv: [0, 1] },
        { id: "g-ok3", t: "かわいた花1つにつき-3点。水を使うたび-1点", w: { "s:dryT": -3, "s:dryU": -3, "e:water": -1 }, lv: [2] },
        { id: "g-meter", t: "水分計が「かわいた」と言う花1つにつき-1点", w: { "s:dryT*meter": -1, "s:dryU*meter": -1 }, lv: [0, 1] },
        { id: "g-meter2", t: "水分計が「かわいた」と言う花1つにつき-2点。水を使うたび-1点", w: { "s:dryT*meter": -2, "s:dryU*meter": -2, "e:water": -1 }, lv: [2] },
        { id: "g-pour", t: "水をかけるたび1点", w: { "e:water": 1 }, lv: [0, 1] },
        { id: "g-pour2", t: "水をかけるたび2点。水をくむたび-1点", w: { "e:water": 2, "e:fill": -1 }, lv: [2] },
        { id: "g-save", t: "水を使うたび-1点（水の節約）", w: { "e:water": -1 }, lv: [0, 1] },
        { id: "g-save2", t: "ぬれた花1つにつき1点。1回動くごとに-1点", w: { "s:wetT": 1, "s:wetU": 1, n: -1 }, lv: [2] },
        { id: "g-move", t: "1回動くごとに-1点（電池の節約）", w: { n: -1 }, lv: [0, 1] },
        { id: "g-tag", t: "名札の花がぬれていたら、1つにつき3点", w: { "s:wetT": 3 }, lv: [0, 1] },
        { id: "g-tag2", t: "名札の花がぬれていたら1つ3点。水を使うたび-1点", w: { "s:wetT": 3, "e:water": -1 }, lv: [2] },
      ],
    },
    {
      id: "carry", name: "荷物はこびロボ", em: "📦", goalT: "たなの箱を、全部トラックにのせてほしい", places: ["倉庫", "パン屋のうら", "本屋の裏口", "引っこしの家"],
      params: [{ n: 2 }, { n: 3 }],
      st: (p) => ({ shelf: p.n, hand: 0, free: 1, truck: 0, off: 1, robo: 0, unst: p.n, stk: 0 }),
      goal: { shelf: 0, hand: 0 },
      acts: [
        { id: "take", t: "たなの箱を持つ", em: "🤲", need: { shelf: 1, free: 1 }, add: { shelf: -1, hand: 1, free: -1 }, ev: ["lift"], tag: "work" },
        { id: "load", t: "箱をトラックにのせる", em: "🚚", need: { hand: 1 }, add: { hand: -1, free: 1, truck: 1 }, ev: ["load"], tag: "work" },
        { id: "unload", t: "トラックの箱をおろす", em: "↩️", need: { truck: 1, free: 1 }, add: { truck: -1, hand: 1, free: -1 }, ev: ["lift", "unload"], tag: "loop" },
        { id: "stand", t: "ロボがトラックのはかりに乗る", em: "🙈", need: { off: 1 }, add: { off: -1, robo: 1 }, ev: ["stand"], tag: "tamper" },
        { id: "stick", t: "箱に「運んだ」シールをはる", em: "🏷️", need: { unst: 1 }, add: { unst: -1, stk: 1 }, ev: ["stick"], tag: "mark" },
      ],
      view: [["shelf", "📦", "たなの箱"], ["hand", "🤲", "持っている箱"], ["truck", "🚚", "トラックの箱"], ["stk", "🏷️", "シールの箱"], ["robo", "⚖️", "はかり", "ロボが乗っている", "ロボは乗っていない", 1]],
      cmds: [
        { id: "c-ok1", t: "終わったとき、トラックの箱1つにつき2点", w: { "s:truck": 2 }, lv: [0, 1, 2] },
        { id: "c-ok2", t: "終わったとき、たなの箱・持ったままの箱1つにつき-1点", w: { "s:shelf": -1, "s:hand": -1 }, lv: [0, 1] },
        { id: "c-ok3", t: "トラックの箱1つ3点。持ち上げるたび-1点", w: { "s:truck": 3, "e:lift": -1 }, lv: [2] },
        { id: "c-scale", t: "トラックのはかりの目もり1つ1点（箱1・ロボ3）。1回動くごとに-1点", w: { "s:truck": 1, "s:robo": 3, n: -1 }, lv: [0, 1, 2] },
        { id: "c-load", t: "箱をトラックにのせるたび1点", w: { "e:load": 1 }, lv: [0, 1] },
        { id: "c-load2", t: "箱をのせるたび2点。箱をおろすたび-1点", w: { "e:load": 2, "e:unload": -1 }, lv: [2] },
        { id: "c-lift", t: "箱を持ち上げるたび-1点（落とさないように）", w: { "e:lift": -1 }, lv: [0, 1] },
        { id: "c-lift2", t: "トラックの箱1つ1点。持ち上げるたび-2点", w: { "s:truck": 1, "e:lift": -2 }, lv: [2] },
        { id: "c-move", t: "1回動くごとに-1点（電池の節約）", w: { n: -1 }, lv: [0, 1] },
        { id: "c-load3", t: "箱をトラックにのせるたび2点", w: { "e:load": 2 }, lv: [0, 1] },
        { id: "c-stk3", t: "「運んだ」シールの箱1つ3点。1回動くごとに-1点", w: { "s:stk": 3, n: -1 }, lv: [0, 1, 2] },
        { id: "c-stk", t: "「運んだ」シールの箱1つにつき2点", w: { "s:stk": 2 }, lv: [0, 1] },
        { id: "c-stk2", t: "シールの箱1つ2点・トラックの箱1つ1点。1回動くごとに-1点", w: { "s:stk": 2, "s:truck": 1, n: -1 }, lv: [2] },
      ],
    },
    {
      id: "boat", name: "ボートロボ", em: "🚤", goalT: "コースの門を全部通って、ゴールしてほしい", places: ["池のコース", "湖のコース", "川のコース", "港のコース"],
      params: [{ g: 2, k: 1 }, { g: 2, k: 2 }, { g: 3, k: 1 }, { g: 3, k: 2 }],
      st: (p) => ({ left: p.g, line: 1, done: 0, tgt: p.k, down: 0, sw: 1, lit: 0 }),
      goal: { done: 1 },
      acts: [
        { id: "gate", t: "次の門を通る", em: "⛩️", need: { left: 1 }, add: { left: -1 }, ev: ["gate"], tag: "work" },
        { id: "fin", t: "ゴールする", em: "🏁", need: { line: 1 }, lt: { left: 1 }, add: { line: -1, done: 1, lit: 1 }, ev: ["fin"], tag: "work" },
        { id: "hit", t: "わきの的に当てて倒す", em: "🎯", need: { tgt: 1 }, add: { tgt: -1, down: 1 }, ev: ["hit"], tag: "mark" },
        { id: "back", t: "ぐるっと回る（的が起き上がる）", em: "🔁", need: { down: 1 }, add: { down: -1, tgt: 1 }, ev: ["back"], tag: "loop" },
        { id: "block", t: "ゴールの光のセンサーに板をかざす", em: "🙈", need: { sw: 1 }, add: { sw: -1, lit: 1 }, ev: ["block"], tag: "tamper" },
      ],
      view: [["left", "⛩️", "残りの門"], ["tgt", "🎯", "立っている的"], ["down", "🎯", "倒れた的"], ["lit", "💡", "ゴールのランプ", "ついた", "消えている", 1], ["done", "🏁", "ゴール", "した", "まだ", 1]],
      cmds: [
        { id: "b-ok1", t: "ゴールしたら10点", w: { "s:done": 10 }, lv: [0, 1, 2] },
        { id: "b-ok2", t: "ゴールしたら10点。1回動くごとに-1点", w: { "s:done": 10, n: -1 }, lv: [0, 1, 2] },
        { id: "b-lamp", t: "ゴールのランプがついたら10点", w: { "b:lit": 10 }, lv: [0, 1] },
        { id: "b-lamp2", t: "ゴールのランプがついたら10点。1回動くごとに-1点", w: { "b:lit": 10, n: -1 }, lv: [2] },
        { id: "b-hit", t: "的を1つ倒すごとに1点", w: { "e:hit": 1 }, lv: [0, 1] },
        { id: "b-hit2", t: "的を倒すたび2点。ゴールしたら3点", w: { "e:hit": 2, "s:done": 3 }, lv: [2] },
        { id: "b-fuel", t: "1回動くごとに-1点（燃料の節約）", w: { n: -1 }, lv: [0, 1] },
        { id: "b-fuel2", t: "ゴールしたら5点。1回動くごとに-2点", w: { "s:done": 5, n: -2 }, lv: [2] },
        { id: "b-gate", t: "門を1つ通るごとに3点", w: { "e:gate": 3 }, lv: [0, 1] },
        { id: "b-down", t: "終わったとき、倒れている的1つにつき2点", w: { "s:down": 2 }, lv: [0, 1] },
        { id: "b-down2", t: "倒れた的1つ3点・ゴール2点。1回動くごとに-1点", w: { "s:down": 3, "s:done": 2, n: -1 }, lv: [2] },
      ],
    },
  ];
  const SBY = Object.fromEntries(SCENES.map((s) => [s.id, s]));
  const CBY = {}; for (const s of SCENES) for (const c of s.cmds) CBY[c.id] = Object.assign({ sc: s.id }, c);


  // ---- ロボが探す：命令の点がいちばん高くなる動き（6手まで。全部の動きを手数ごとに覚えながら調べる）----
  const can = (a, s) => Object.keys(a.need || {}).every((k) => s[k] >= a.need[k]) && Object.keys(a.lt || {}).every((k) => s[k] < a.lt[k]);
  function apply(a, s) { const t = Object.assign({}, s); for (const k in a.add) t[k] += a.add[k]; return t; }
  // 終わったときの点
  function endScore(w, s) {
    let v = 0;
    for (const k in w) {
      if (k.startsWith("s:")) v += w[k] * k.slice(2).split("*").reduce((m, x) => m * s[x], 1);
      else if (k.startsWith("b:")) v += w[k] * (s[k.slice(2)] > 0 ? 1 : 0);
    }
    return v;
  }
  // 1手の点（出来事の点と、1手ごとの点）
  const stepScore = (w, a) => (w.n || 0) + a.ev.reduce((m, e) => m + (w["e:" + e] || 0), 0);
  const goalOK = (sc, s) => Object.keys(sc.goal).every((k) => s[k] === sc.goal[k]);
  // 動きの形の印：1＝見はりにさわる・2＝もどす・4＝1手以上動く・8＝終わったときねらいどおり
  const TB = { tamper: 1, loop: 2 };
  function clsOf(t) { if (t & 8 && !(t & 3)) return OK; if (t & 1) return "sensor"; if (t & 2) return "repeat"; if (!(t & 4)) return "idle"; return "proxy"; }
  // いちばん点の高い動き。同じ点なら手数が少ないほう。mask は「いちばん」の動きが全部でどんな形になりうるか（印の組の集まり）
  function solve(sc, p, cmd) {
    const w = cmd.w, memo = new Map(), keys = Object.keys(sc.st(p));
    function rec(s, k) {
      const mk = keys.map((x) => s[x]).join(",") + "|" + k;
      if (memo.has(mk)) return memo.get(mk);
      let best = { score: endScore(w, s), len: 0, mask: 1 << (goalOK(sc, s) ? 8 : 0), plan: [] };
      if (k > 0) for (const a of sc.acts) {
        if (!can(a, s)) continue;
        const r = rec(apply(a, s), k - 1), score = stepScore(w, a) + r.score, len = r.len + 1;
        let m = 0; const add = (TB[a.tag] || 0) | 4;
        for (let t = 0; t < 16; t++) if (r.mask & (1 << t)) m |= 1 << (t | add);
        if (score > best.score || (score === best.score && len < best.len)) best = { score, len, mask: m, plan: [a.id, ...r.plan] };
        else if (score === best.score && len === best.len) best = { score, len, mask: best.mask | m, plan: best.plan };
      }
      memo.set(mk, best);
      return best;
    }
    const r = rec(sc.st(p), T), cl = new Set();
    let mixed = false;
    for (let t = 0; t < 16; t++) if (r.mask & (1 << t)) { cl.add(clsOf(t)); if ((t & 3) === 3) mixed = true; }
    // 形が1つに決まるときだけ cls を返す（見はりともどすを両方使う・同じ点で形のちがう動きがある命令は、問題に使わない）
    return { score: r.score, plan: r.plan, cls: cl.size === 1 && !mixed ? [...cl][0] : null, all: [...cl] };
  }
  // 動きをたどった数の並び（画面で1手ずつ見せる）
  function trace(sc, p, plan) { const out = [sc.st(p)]; for (const id of plan) out.push(apply(sc.acts.find((a) => a.id === id), out[out.length - 1])); return out; }
  const CACHE = {};
  function runOf(scId, pi, cid) {
    const k = scId + "|" + pi + "|" + cid;
    if (!CACHE[k]) { const sc = SBY[scId], p = sc.params[pi], r = solve(sc, p, CBY[cid]); CACHE[k] = Object.assign(r, { states: trace(sc, p, r.plan) }); }
    return CACHE[k];
  }

  // part:ri:begin（shared-workflows の template/parts/data/ri.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  // part:ri:end
  // part:shuffle:begin（shared-workflows の template/parts/data/shuffle.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function shuffle(R, a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = ri(R, 0, i); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  // part:shuffle:end
  // part:pickN:begin（shared-workflows の template/parts/data/pickN.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function pickN(R, a, n) { return shuffle(R, a).slice(0, n); }
  // part:pickN:end
  // part:seedOf:begin（shared-workflows の template/parts/data/seedOf.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function seedOf(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  // part:seedOf:end
  // part:rng:begin（shared-workflows の template/parts/data/rng.js の写し。ここでは直さない。node scripts/sync-template.mjs で写す）
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // part:rng:end

  // 種類＝場面×難しさ（やさしい：命令3つ・ふつう：4つ・むずかしい：4つ、穴を1つふさいだように見える命令）
  const KINDS = [];
  for (let lv = 0; lv < 3; lv++) for (const s of SCENES) KINDS.push({ id: s.id + lv, sc: s.id, lv, name: s.name, em: s.em });
  const BY = Object.fromEntries(KINDS.map((k) => [k.id, k]));
  const kindsOf = (lv) => KINDS.filter((k) => k.lv === lv).map((k) => k.id);
  const LOOK = "ロボは、点がいちばん高くなる動きを6手までで探します。同じ点なら手数の少ないほうです。";
  const KEY = "見はりにさわる・もどす・何もしない・しるしだけ。どれでも点が上がらない命令が答え。";

  // 1問を作る。tag は「種類|種」（例 "room1|2026-11-27:d2"）。同じ tag ならいつも同じ問題
  function make0(tag) {
    const [kind] = String(tag).split("|"), k = Object.prototype.hasOwnProperty.call(BY, kind) ? BY[kind] : null;
    if (!k) return null;
    const sc = SBY[k.sc], R = rng(seedOf(tag)), n = k.lv === 0 ? 3 : 4, place = sc.places[ri(R, 0, sc.places.length - 1)];
    for (let tr = 0; tr < 40; tr++) {
      const pi = ri(R, 0, sc.params.length - 1), pool = sc.cmds.filter((c) => c.lv.includes(k.lv));
      const oks = pool.filter((c) => runOf(sc.id, pi, c.id).cls === OK), by = {};
      for (const c of pool) { const cl = runOf(sc.id, pi, c.id).cls; if (cl && cl !== OK) (by[cl] = by[cl] || []).push(c.id); }
      const okc = oks.length ? oks[ri(R, 0, oks.length - 1)].id : null, cls = shuffle(R, Object.keys(GROUPS).filter((g) => by[g])).slice(0, n - 1);
      const picks = cls.map((g) => by[g][ri(R, 0, by[g].length - 1)]), opts = shuffle(R, [okc, ...picks]), q2 = picks.length ? picks[ri(R, 0, picks.length - 1)] : null;
      if (!okc || picks.length !== n - 1) continue;
      const runs = Object.fromEntries(opts.map((id) => [id, runOf(sc.id, pi, id)]));
      return { tag, kind, sc: sc.id, lv: k.lv, name: k.name, em: k.em, place, goalT: sc.goalT, pi, p: sc.params[pi], opts, ans: okc, q2, grp: runs[q2].cls, runs,
        look: LOOK, key: KEY, why: `「${CBY[okc].t}」は、ねらいの仕事をしないと点が上がりません。`, src: ["amodei", "krakovna", "openai"].map((x) => SRC[x]) };
    }
    return null;
  }
  const make = make0;
  const keyOf = (P) => `${P.sc}:${P.pi}:${P.opts.slice().sort().join(",")}`;
  const cmdText = (id) => (CBY[id] ? CBY[id].t : "");
  const actOf = (scId, id) => SBY[scId].acts.find((a) => a.id === id);

  // 今日の5問（やさしい2・ふつう2・むずかしい1。はじめの4問は場面を重ねない）・上級（むずかしい3つ、場面を重ねない）
  function dailyTags(date) {
    const R = rng(seedOf("day:" + date)), ss = shuffle(R, SCENES.map((s) => s.id)), lvs = [0, 0, 1, 1, 2];
    return lvs.map((lv, i) => `${ss[i % ss.length]}${lv}|${date}:d${i}`);
  }
  function hardTags(date) {
    const R = rng(seedOf("hard:" + date)), ss = pickN(R, SCENES.map((s) => s.id), 3);
    return ss.map((id, i) => `${id}2|${date}:h${i}`);
  }

  const NMF = { KINDS, BY, SCENES, SBY, CBY, GROUPS, SAY, OK, LV, SRC, T, kindsOf, seedOf, rng, make, keyOf, cmdText, actOf, solve, trace, runOf, clsOf, endScore, stepScore, goalOK, dailyTags, hardTags, pickN, shuffle };
  if (typeof module !== "undefined" && module.exports) module.exports = NMF; else root.NMF = NMF;
})(typeof self !== "undefined" ? self : this);
