# 抜け道ふさぎ（nukemichi-fusagi）

ロボへの命令（点のつけ方）を選ぶと、ロボは点がいちばん高くなる動きを探して、文字どおりの抜け道で点を取ります。抜け道が出ない命令を探す1日5問のゲーム。正解したら、ほかの命令でロボが使った抜け道の形も選びます。

遊ぶ: <https://satou-aaaaa.github.io/nukemichi-fusagi/>

- 考え方は AI の安全の研究の「報酬ハッキング」「仕様ゲーミング」から。出典は Amodei ら "Concrete Problems in AI Safety"（2016） <https://arxiv.org/abs/1606.06565> 、Krakovna ら "Specification gaming: the flip side of AI ingenuity"（DeepMind, 2020） <https://deepmind.google/discover/blog/specification-gaming-the-flip-side-of-ai-ingenuity/> 、Clark・Amodei "Faulty reward functions in the wild"（OpenAI, 2016） <https://openai.com/index/faulty-reward-functions/> 。
- ゲームの場面・ロボ・点はすべて架空です。ロボは命令どおりに動いただけで、悪者ではありません。
- 記録は遊ぶ人のブラウザだけに残り、外へ送りません。結果の「共有」を押したときだけ、その日の回の番号と各問の○×の並びが、選んだサービス（X・LINE など）に渡ります。

作業の決まりは [AGENTS.md](AGENTS.md)。
