# クラつく — notes for working on this repo

片手で遊べるJ1クラブ経営シミュレーション。GitHub Pages で公開: https://yuthy8345.github.io/kuratsuku/
同じゲームは Claude のアーティファクトとしても公開している（`dev/dist/touchline.html` を publish、URL https://claude.ai/artifact/4Jd2aRS9rhaZUvATXRBqVD）。

## Layout
- repo root = 公開サイト（`index.html`, `manifest.webmanifest`, `sw.js`, アイコン, `lz-string.min.js`）。**手で編集しない**。`dev/build.js` が生成する。
- `dev/src/engine.js` — ゲームロジック（DOMなし）。`dev/src/app.js` — UI。`dev/src/template.html` — CSSとページ骨格。
- `dev/src/match2d.js` — 試合の2D表示（見た目だけ。結果は engine の stepMatch が決め、シュート場面は演出が終わるまで時計を止める）。
- `dev/raw/*.txt` — 2026/27 J1 登録選手（Jリーグ公式/クラブ公式から取得）。`dev/build_data.js` が能力値・格・本職を付けて `dev/data.json` を作る。`dev/raw/` には選手ファイル以外の .txt を置かない（全部クラブとして読まれる）。
- ポジション: 登録は GK/DF/MF/FW（能力の重み用、`p.pos`）。細分化した本職 `p.pp`（CB SB / DMF CMF OMF SH / CF ST WG、STはセカンドトップ・シャドー）と、他ポジションの適性 `p.ap`（0〜100、無ければ `DP_SIM` の初期値）。本職は `dev/positions_footballlab.txt`（Football LAB の2026/27先発位置）＋ `build_data.js` の `PP_KNOWN`、どちらも無い選手はクラブの不足ポジションで補完。各クラブの基本フォーメーションは `FORM`。
- メンバー: 自クラブの先発・ベンチは自動で入れ替えない（`validateLineup` はクラブを離れた選手を外すだけ）。負傷・出場停止の選手はそのまま残し、`lineupIssues` が block のあいだは試合に進めない。AIクラブは従来どおり自動。
- 戦術の保存: クラブごとに `c.presets`（最大 `PRESET_MAX`=5、フォーメーション・進め方・プレス・先発・ベンチ）。`loadPreset` は保存したとおりに戻し、負傷・出場停止の選手もそのまま（入れ替えは監督が行う）。移籍した選手の枠だけ空く。
- 引退: シーズン終了時（`endSeason` → `decideRetirements`）に決まり、自クラブの引退選手は `S.seasonEnd.ret` のカードで、「次のシーズンへ」を押したときに1人ずつポップアップ表示（セレモニーの代わり）。そのあと `rollover` でクラブから外れる。
- カップ戦: `S.cups`（天皇杯 `ec` = J1 20 + J2 12、Lカップ `lc` = J1 20）。試合は `S.fixtures` に `cup`/`cr` 付きで入る（リーグ表・節表示は `cup` を除外）。一発勝負、同点はPK（`M.pk`→`f.pk`）。ラウンド終了の翌朝 `progressCups` が次の組み合わせを作る。弱いクラブがホーム、決勝は国立。J2クラブは `S.order` に入らない `S.clubs` として選手を持つ（降格クラブも同じ。旧 `J2:` 付きは移行済み）。
- 大一番: `hypeMatch` がダービー（`RIVALRY` の名前付きカード → 同じ都道府県 → 同じ地方（`REGION`：関西・東海・九州）→ オリジナル10対決 の順で判定）・上位/残留の直接対決・カップ戦・リベンジ・古巣対決を判定し、試合当日だけ `p.hot`（+12）を付ける。格下ほど起きやすい。攻撃の姿勢 `tac.ment`（def/bal/att）とは別に `tac.ctr`（カウンターを狙う）。カウンターはチャンス数が減る代わりに決定率が上がり、相手の保持率が高いほど・相手が攻撃的なほど効く（`counterQ`）。AIは格上相手に守備的＋カウンターなど（`aiMentality`）。
- スカウト: `sendScout` → 期日に FA の若手3人（`p.found`）＋ inbox `type:'scout'`。30日で期限切れ。施設 `fac.scout` で伸びしろが上がる。成長は出場時間の割合（`playShare`）で伸び、23歳以下ほど大きい。
- `dev/icons/real.py` — アプリアイコン（SVG生成）。PNGはリポジトリ直下。

## Build & deploy
```
cd dev && node build_data.js && node build.js   # data.json → index.html / sw.js / manifest をリポジトリ直下に生成
git add -A && git commit && git push             # Pages が1分ほどで反映
```
- `sw.js` のキャッシュ名はビルドごとに変わる。index.html はネットワーク優先なので、修正はオンラインなら次回起動で反映。
- セーブは localStorage キー `touchline.j1.save`（変えない）。端末間の移動は「引き継ぎコード」（`KTK1.` + lz圧縮JSON）。
- 既存セーブの互換: `Engine.migrate(S, DATA)` で能力値・格・生年月日・本職の更新を流し込む（`S.v` 3 で細分化ポジション。旧 `pos2`/`learn` のカテゴリ習得は適性に変換）。格の計算式を変えたら `PRES_BASE` に旧値を残して `presV` を上げる。

## Checks
- `node dev/test/sim.js 2 <clubId>` — シーズン自動シミュ（1試合平均2.4〜2.6点、優勝勝点70〜85程度が目安）
- `python3 dev/test/dev_ui.py` — ブラウザ回帰テスト（スクロール固定、育成画面、旧セーブ移行）
- `node dev/test/viz.js 5` — 2D表示を通しで回し、全チャンスが解決し表示スコアが結果と一致するか確認
- `python3 dev/test/bench.py` / `python3 dev/test/match2d.py` — ベンチ入れ替え／試合画面の通し再生
- `python3 dev/test/positions.py` — 適性グリッド・ポジション習得・旧セーブ（v2）からの移行
- `python3 dev/test/suspend.py` — 出場停止・負傷の選手がいると試合に進めず、復帰しても勝手にメンバーに戻らないこと
- `python3 dev/test/retire.py` — 引退選手のポップアップ（ライト/ダーク）とシーズン移行
- `python3 dev/test/presets.py` — 戦術の保存・読み込み（出場停止の選手が入ったまま読み込まれ、試合に進めないこと）
- `python3 dev/test/cups.py` — カップ戦の表示・PK・大一番（燃えている選手）・カウンター・スカウト
- 番狂わせの目安（4〜6シーズン回す）: 下位5クラブの上位5クラブ相手の勝率 18〜22%、1試合2.4〜2.6点、優勝勝点 74〜88
