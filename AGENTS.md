# AGENTS.md

抜け道ふさぎ：ロボへの命令（点のつけ方）を3つか4つから選ぶと、ロボは点がいちばん高くなる動きを6手までの全部から探して動く。抜け道（ねらいとちがう動きで点を取ること）が出ない命令を探す1日5問のゲーム。正解したら2段目で、ほかの命令でロボが使った抜け道の形（見はりをだます・くり返し稼ぐ・やらないほうが得・しるしだけ追う）を選ぶ。`index.html` と `data.js`（場面・命令・ロボの探し方）を GitHub Pages で公開する。

## 準備（最初に一度）

```bash
bash scripts/setup.sh   # Node.js（版は .nvmrc）を確かめ、検査の依存とブラウザを入れる。何度実行してもよい
```

Claude Code のクラウドセッションでは `.claude/settings.json` のフックが自動で実行する。

## push する前の確認

```bash
node qa/run.mjs   # 問題（場面×命令×数の組を、data.js とは別に書いた総当たりで解き直す：ねらいどおりの命令は1つだけ・抜け道の形・2段目の答え・出典）・今日の5問と上級（3年分）・とことん・通しで遊ぶ・2段目・復習・幅320px・PWA・引き継ぎ・見やすさ（CI の QA と同じ）
```

## このリポジトリの決まり

- 中身：考え方は Amodei ら "Concrete Problems in AI Safety"（2016）の reward hacking、Krakovna ら "Specification gaming"（DeepMind 2020）、Clark・Amodei "Faulty reward functions in the wild"（OpenAI 2016）。出典メモは共有フォルダ `games/nukemichi-fusagi-research.md`。実在の例（そうじロボのたとえ話・ボートのゲーム）は「このゲームについて」で出典どおりに書き、ゲームの場面・ロボ・点はすべて架空にする。
- 言い方：ロボを悪者・ずるいと言わない（命令どおりに動いただけ）。どんな命令なら安全かを言い切らない（この小さな場面の中のことだけ）。遊び方・「このゲームについて」・README に、場面が架空であることを置く（QA が見る）。
- ロボの動き：`G.solve` が命令の点（`w`）がいちばん高い動きを6手まで全部調べて決める（同じ点なら手数の少ないほう）。台本で動きを書かない。答えの命令は `cls === "ok"`（終わったときねらいどおりで、見はりにさわらず、もどさない）。同じ点で形のちがう動きがある命令・見はりともどすを両方使う命令は問題に使わない。QA は data.js とは別に書いた総当たりで、全部の場面と数の組・全部の命令を解き直して照らす。
- 今日の5問（やさしい2・ふつう2・むずかしい1）・上級（むずかしい3）は日本時間の日付の種で決まり、だれでも同じ。`Math.random()` は練習・とことんの種だけ。乱数は `sort` の比較の中で引かない。`SCENES`・命令の並び・乱数を引く順番は、変えると過去の日の問題が変わる。公開後は変えず、変えるときは QA の `PINS` を作り直して理由を PR に書く。`data.js` を変える PR は自動ではマージされない（`hold_paths`）。
- ★はまちがい＋ヒントの数（0で★3・1で★2・2以上で★1）。ヒントは1回目が見るところ、2回目がまちがいを消して2つにしぼる。上級はヒントなし。時間制限なし。
- 好きなだけ遊べる：チケット・ライフ・回数制限・🔒で開くモードを入れない（shared-workflows `routines/game-dev.md` F1〜F7。QA が見る）。とことん（`runs.e`）はまちがえても続き、「ここで降りる」で終わる。
- 1問を深くする：`depth.js` と `qa/depth-check.mjs` は shared-workflows `template/` の写しで、ここでは直さない。自信あり・2段目・復習（1→3→7日後）。記録 `nmf-v1`・文字 `nmf-fs`・復習 `nmf-depth`。
- 共有は遊ぶ人が押したときに開くリンクだけ。シェアの文に答えを出さない。感想は Issue フォーム（`.github/ISSUE_TEMPLATE/feedback.yml`）を開くだけ。応援は Ko-fi へのただのリンクだけ。
- 外へ通信しない（CSP の `connect-src 'self'` を広げない）。見やすさ（`<!-- a11y:begin -->`〜`end`・`qa/a11y.mjs`）と引き継ぎ（`transfer.js`・`qa/transfer-check.mjs`）・保存の読み直し（GameStore）・game-core・kiroku は shared-workflows `template/` の写しで、ここでは直さない（`node scripts/sync-template.mjs` で写す）。
- 画面の土台は屋台の値下げ合戦（yatai-negasen）から写した。写し元の言葉が残っていないかを QA が見る。
- PWA：画面のファイルを足したら `sw.js` の `SHELL` にも足し、中身を大きく変えたら `CACHE` の版を上げる。アイコンは `node tools/make-icons.cjs`、`og.png` は `node tools/make-og.cjs`（答えは入れない）。
- 公開リポジトリなので、個人情報・鍵を入れない。

## 公開

- GitHub Pages は `main` のルート（`/`）を公開する。PR の QA と Secret scan が ✅ になると `automerge.yml` が自動でマージする。止めたいときは下書きにするか、ラベル「自動マージしない」を付ける。
- `sw.js`・`manifest.webmanifest`・`data.js` を変える PR は自動ではマージされない（`hold_paths`）。CodeRabbit のレビューを読み、手でマージする直前に今の head へのレビューを読み直す。CodeRabbit は PR に `@coderabbitai review` とコメントして頼む。

## 共通のきまり

- PR の作り方・マージの仕方は satou-aaaaa/shared-workflows の `routines/pr.md`、全体のきまりは `routines/common.md` に従う。
- CI の部品は shared-workflows の共通部品を呼ぶ。リポジトリ側の .github/workflows には呼び出しと設定値だけを書く。
- 画面は `Core.screens` で # の画面に分ける（`routines/ui-rules.md` U10〜U12）。
- Claude 以外の AI・人が作業するときは、shared-workflows の `routines/tool-map.md` と `routines/without-claude.md` を読む。
