# クラつく — notes for working on this repo

片手で遊べるJ1クラブ経営シミュレーション。GitHub Pages で公開: https://yuthy8345.github.io/kuratsuku/
同じゲームは Claude のアーティファクトとしても公開している（`dev/dist/touchline.html` を publish、URL https://claude.ai/artifact/4Jd2aRS9rhaZUvATXRBqVD）。
進め方・ユーザーの好み・経緯・やり残しは `HANDOFF.md`（Claude のプロジェクト機能へ引き継ぐときのメモ）。

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
- 大一番: `hypeMatch` がダービー（`RIVALRY` の名前付きカード → 同じ都道府県 → 同じ地方（`REGION`：関西・東海・九州）→ オリジナル10対決 の順で判定）・上位/残留の直接対決・カップ戦・リベンジ・古巣対決を判定し、試合当日だけ `p.hot`（+10）を付ける。格下ほど起きやすい。確率と人数は `HYPE`（2026-10-12 から案D「お祭り」: 大一番で燃えやすく最大3人、相手が4以上強いと「格上挑戦」、普段の試合にも少しチャンス。上がり幅 `boost` 10、燃えた選手がいる間のチーム全体の上乗せ `team` 1.5）。攻撃の姿勢 `tac.ment`（def/bal/att）とは別に `tac.ctr`（カウンターを狙う）。カウンターはチャンス数が減る代わりに決定率が上がり、相手の保持率が高いほど・相手が攻撃的なほど効く（`counterQ`）。AIは格上相手に守備的＋カウンターなど（`aiMentality`）。
- スカウト: `sendScout` → 期日に FA の若手3人（`p.found`）＋ inbox `type:'scout'`。30日で期限切れ。施設 `fac.scout` で伸びしろが上がる。成長は出場時間の割合（`playShare`）で伸び、23歳以下ほど大きい。
- 育成（2026-10-12〜）: `devWeek` の成長 = min(伸びしろ×年齢係数×練習場, `GROW.gMax`) × 出場時間 × チーム練習 × 強度。出場時間は `shareFor`（`playShare`、期限付き移籍中は `p.loan.share`、見込み計算は `p._share`）で、23歳以下は `youngBase + share×youngPlay`（ベンチ0.9倍〜主力約2倍）、それ以上は `oldBase + share×oldPlay`。`gMax` があるので16歳の大物（伸びしろ18）でも主力で1季+8前後、数季かけて伸びる。開花: 23歳以下が出場25%以上でよく活躍すると `p.pot` 自体が上がる（`p.bloom` 累計、上限 `bloomMax`・`potMax`、AIクラブは `bloomAI` 倍）。シーズン開始時の伸びしろ `p.pot0` と比べて「開花」チップ。チーム練習「若手育成」`TRAINING.youth`（23歳以下 ×1.4、ほか ×0.85）。
- 期限付き移籍: 23歳以下を J2（`S.order` に無い J2 クラブ）へシーズン終了まで（移籍期間中のみ、同時に `LOAN.max`=6人）。期間中は `p.club` = 貸し出し先、`p.loan = {from,to,since,share,ovr0,pot0}`。自クラブの登録・年俸・先発から外れ、市場・オファーの対象外、カップ戦で親クラブとは対戦しない。出場機会 `loanShare` は選手の実力と貸し出し先の強さで決まる。`rollover` で `loanSeason`（J2成績を作って hist へ）→ `loanReturn`。UIは選手シート →「期限付き移籍（J2）を検討する」（3クラブとシーズン終了時の見込み `growthOutlook`）、選手一覧・育成に「期限付き移籍中」。
- 成長の見える化: 自クラブの選手（とレンタル中）は毎月1日に `p.trk`（[YYYY-MM, ovr, pot]、最大48）を記録し、選手シートの「成長の記録」にグラフ（総合力・伸びしろ・主力級＝自クラブ上位14人平均）と「主力級まで 今のペースで約X年・主力で使えば約Y年」（`yearsTo`）。月初に inbox `type:'youth'`（`seen:true` なので止まらない、最新1件だけ）→ ホームの「若手の成長レポート」。他クラブへ移ると `trk` は消える。旧セーブは `S.v` 7 で記録を始める。
- ユースの逸材: 毎シーズンのユース昇格で、自クラブは `GEM.base + GEM.lv × ユースLv`（Lv2 16%・Lv5 31%）、他クラブは `GEM.ai` の確率で16〜17歳・伸びしろ80以上の選手（`p.gem`）が出る。
- 実在の若手の補正: `build_data.js` の `YOUTH`（[総合力, 伸びしろ]、例: 三井寺眞 16歳 70/88）と `STYLE`（プレースタイル。`tech`/`phys`/`speed` で能力の配分を傾ける、`p.sty`）。23歳以下は Football LAB の先発数から下限を付ける。補正は `DATA_REV`（`data.rev`）と各選手の `fix = {r, d}` で旧セーブにも流れる（`migrate` が上げ幅 d を能力に足し、それまでの成長は残す。`pot0` も同じだけずらすので開花扱いにならない）。補正を足すときは `DATA_REV` を上げる。
- 転生選手（2026-10-12〜）: 自クラブのレジェンドが16〜17歳で入団する。`engine.js` の `LEGENDS`（クラブごと、J1全20クラブ＋一部J2。名前は実名をもじった架空の名前（例: 中村俊輔→外町俊之輔）、本職 `pp`・スタイル `sty`・象徴の背番号 `num`（不確かなら null）・在籍 `era`・異名 `epi`・紹介 `line`・伸びしろ `pot`。引退済みの選手だけで、亡くなった選手はユーザーの希望があるときだけ（横浜FMの梅田直輝＝松田直樹）、現役（data.json にいる選手）は入れない）。`rollover` で `rebornCheck`: そのクラブで2シーズン目以降、毎シーズン `REBORN.base`、前季に目標達成で +`met`、タイトル1つごとに +`title`、`pity` 回外れると次は確定（4シーズン目までに必ず1人）。各レジェンドは1セーブ1回（`S.reborn.used`）、クラブが変わると待ち回数はリセット。総合力 `REBORN.ovr`、伸びしろはレジェンドの `pot`。`p.reborn` = レジェンドid、大舞台に強い（`bigGame`）、他クラブからの勝手なオファーは来ない、売ると信頼 −10、在籍中はホームの観客 +5%。入団時は `S.reborn.show` が立ち、`sheetReborn`（金の光線・昔の背番号のゴースト・マグネット・朱色の「転生」印）。象徴の背番号が使われていれば「背番号Xを託す」で入れ替え（`rebornNum`）。
- フロントの信頼（2026-10-12〜）: `S.settings.boardLv`（`BOARD_LV` の easy/mid/hard＝やさしい・ふつう・きびしい、無ければ mid）。試合ごとに（勝点 − 戦力からの期待勝点）× `match`（カップ戦は半分）、シーズン終了時に目標との差（met +20、nearBand 以内 `near`、それ以上は1つ下回るごとに `perPos`、最大 `missMax`）。新シーズンは 55 + (信頼 − 55) × `keep` から。シーズン終了の解任は `fireEnd` 未満かつ就任 `grace` シーズン目より後（`tenure`）、途中解任は `fireMid` 以下・リーグ `fireAfter` 試合以降・下位 `zone` 位以内のときだけ。J2降格はどの段階でも解任。`warn` の値まで下がると news と停止メモ（`S._stopNote`）、ホームのカードにも警告。hard が以前のルール（横浜FMを自動采配で4季回すと 16回中14回解任、平均1.4季）。mid は 16回中7回（うち降格3）・平均3.3季、easy は降格のときだけ。UI はクラブ → 経営の「フロントの厳しさ」。
- 交代はおまかせ: `S.settings.autoSubs` がオンのとき、自クラブは `S.settings.subRate`（`SUB_RATE` の low/mid/high＝少なめ・ふつう・多め、無ければ mid）の頻度で `aiSubs` が交代する。1試合あたり 少なめ 約1.5人（70分〜）・ふつう 約3.4人（60分〜）・多め ほぼ5人（55分〜）。AIクラブは以前の交代のまま（`SUB_RATE.ai`）なのでリーグのバランスは変わらない。試合中の体力は90分で92→84程度しか落ちないので、交代の時間は主に `late`（その分以降は体力に関係なく交代候補）で決まる。UIは戦術画面と試合中の采配シート（おまかせがオンのときだけ表示）。
- ショートリスト: 入札した選手は `bid` の中で `noteBid` が `S.shortlist`（`{pid, since, last, n, fee, res, guide, club}`、res は club/player/thin/funds/full）に入れる。獲得は `moveP` で自クラブに来たとき `unshort`、引退（club が RET）は `shortlist()` が外す。他クラブへ移った選手は残る（入札時のクラブを `club` に保持）。本人に断られた期間は `bidBlock` で入札ボタンを出さない。UI はクラブ → 移籍市場 の「ショートリスト」。`S.v` 6 で旧セーブの `S._bids` から作る。
- デザイン: 「作戦ボード」。既定は緑の黒板、クラブ → ボードの見た目 でホワイトボード（`<html data-board="white">`、端末ごとの localStorage `kuratsuku.board`、セーブとは別）。色は `template.html` の `:root` と `:root[data-board="white"]` のトークンで、OSのダークモードには追従しない。クラブ・選手は丸いマグネット、ボタンはマグネットプレート。フォントは見出し Dela Gothic One、ラベル（`.eyebrow`）Yusei Magic（チョーク）、本文 Zen Kaku Gothic New、試合のスコアボードだけ DotGothic16。
- タイトル: 常に黒板で、ボード全体がピッチ。相手（黄・4-4-2）と味方（青・4-2-3-1）のマグネットが11個ずつ実際の位置に並び、両チームのチョークの指示線（`TB_ARROWS`、白=味方・黄=相手）がある。座標は 362×816 の設計ボード基準（`TB_OPP`/`TB_OWN`、%に換算）。ボードは `.tb-dim` で暗くして、ロゴとボタンを前面に置く（ボタンの裏のマグネットは隠れてよい）。「つづきから」の丸は自クラブの色、「新しく始める」は青い NEW マグネット。
- `dev/icons/real.py` — アプリアイコン（SVG生成）。PNGはリポジトリ直下。

## Build & deploy
```
cd dev && node build_data.js && node build.js   # data.json → index.html / sw.js / manifest をリポジトリ直下に生成
git add -A && git commit && git push             # Pages が1分ほどで反映
```
- `sw.js` のキャッシュ名はビルドごとに変わる。index.html はネットワーク優先なので、修正はオンラインなら次回起動で反映。
- 安全領域: PWA の index.html は `:root` をノッチ・ホームバー分（`env(safe-area-inset-*)`）だけ上下に詰めている。画面側で同じ値を足すと二重になって1画面からはみ出す。また iOS のホーム画面アプリでは起動直後の `vh`/`dvh` がノッチ分だけ短く、スクロールすると直る（WebKit bug 254868）ので、1画面ぴったりの画面（タイトル `.tb-wrap`、試合、シート）は `position: fixed` で画面に貼り、余白は `--sat`/`--sab` で付ける。`vh`/`dvh` は使わない。さらに iOS 26/27 のホーム画面アプリでは起動直後に表示域がステータスバー分だけ短く、その下には何も描かれない（WebKit bug 301994）。実機の録画から、ページが表示域より高いあいだは正しい高さになり、低くなるとまた短く戻ることが分かっている。そこでホーム画面アプリ（`navigator.standalone`）では `html.ios-app` を付け、タイトルを常に本当の画面の高さ＋1px（`--apph`、回転したときだけ更新）でページ上に置く。表示域の差を見て切り替えると、iOSと互いに反応し合ってチカチカする（1秒に約12回）ので切り替えない。差は測るだけで「このゲームについて」に表示。テストは iphones.py の launch モード（この iOS の振る舞いを再現し、行ったり来たりせず1回で落ち着くことを確認）。
- セーブは localStorage キー `touchline.j1.save`（変えない）。端末間の移動は「引き継ぎコード」（`KTK1.` + lz圧縮JSON）。
- 既存セーブの互換: `Engine.migrate(S, DATA)` で能力値・格・生年月日・本職の更新を流し込む（`S.v` 3 で細分化ポジション。旧 `pos2`/`learn` のカテゴリ習得は適性に変換）。格の計算式を変えたら `PRES_BASE` に旧値を残して `presV` を上げる。

## Checks
- `node dev/test/sim.js 2 <clubId>` — シーズン自動シミュ（1試合平均2.4〜2.6点、優勝勝点70〜85程度が目安）
- `python3 dev/test/dev_ui.py` — ブラウザ回帰テスト（スクロール固定、育成画面、旧セーブ移行）
- `node dev/test/viz.js 5` — 2D表示を通しで回し、全チャンスが解決し表示スコアが結果と一致するか確認
- `python3 dev/test/bench.py` / `python3 dev/test/match2d.py` — ベンチ入れ替え／試合画面の通し再生
- `python3 dev/test/positions.py` — 適性グリッド・ポジション習得・旧セーブ（v2）からの移行
- `python3 dev/test/suspend.py` — 出場停止・負傷の選手がいると試合に進めず、復帰しても勝手にメンバーに戻らないこと
- `python3 dev/test/retire.py` — 引退選手のポップアップ（黒板/ホワイトボード）とシーズン移行
- `python3 dev/test/iphones.py` — タイトルとクラブ画面が現行の全iPhone（SE〜Pro Max、ホーム画面アプリとSafari）で1画面に収まり、ノッチ・ホームバーに掛からないこと（安全領域は px で再現。`KTK_FONTS` に @fontsource を指すと本物の書体でスクショ）
- `node dev/test/shortlist.js` / `python3 dev/test/shortlist.py` — ショートリスト（入札で入る・獲得と引退で外れる・移籍しても残る・旧セーブ移行／画面・保存・外す）
- `node dev/test/youth.js` / `node dev/test/loan.js` / `python3 dev/test/youth.py` — 育成（出場時間の効果・大物の伸び方・開花・若手育成・月次レポート・逸材の確率・データ補正の旧セーブ反映／期限付き移籍の出し入れ・J2成績・復帰／成長グラフ・レンタル画面・レポート・旧セーブ v6）
- 育成のバランスの目安: 6シーズン回してリーグ上位14人平均が 71〜72 で横ばい、ベンチの若手（出場15%未満）が1季 +3前後、主力の若手 +7〜8
- `python3 dev/test/manager.py` — 監督名（クラブの「◯◯で始める」→ 名札のポップアップ `sheetName`。入力欄に自動でフォーカスしない、Enter はキーボードを閉じるだけ、就任はボタンで、戻る、空欄は「あなた」）。テストで新しく始めるときは `nameClub` → `#sheet [data-act="startClub"]` の2段
- `node dev/test/reborn.js` / `python3 dev/test/reborn.py` — 転生選手（1年目は来ない・確率・確定・各1回・クラブ移動でリセット・背番号・特徴・シーズン移行で入団／ポップアップ・背番号を託す・閉じたら出ない・選手シート）
- `node dev/test/board.js` / `python3 dev/test/board.py` — フロントの厳しさ（1年目の猶予・2年続けて目標を大きく下回ると解任・降格・途中解任は下位のときだけ・警告／クラブ画面の切り替え・旧セーブはふつう・ホームの警告）
- `node dev/test/tenure.js <club> <回数> <シーズン数> <easy|mid|hard>` — 自動采配で何シーズン続けられるか（解任の理由別）。1シーズン約5秒
- `node dev/test/subrate.js` / `python3 dev/test/subrate.py` — 交代の頻度（段階ごとの交代人数・タイミング、AIは変わらない／戦術画面と采配シートの切り替え・保存・旧セーブ）
- `python3 dev/test/presets.py` — 戦術の保存・読み込み（出場停止の選手が入ったまま読み込まれ、試合に進めないこと）
- `python3 dev/test/cups.py` — カップ戦の表示・PK・大一番（燃えている選手）・カウンター・スカウト
- `node dev/test/hype.js <now|A|B|C|D> <シーズン数>` — ビッグプレーヤー（燃える選手）の発動の比較。確率・人数・上がり幅は `Engine.HYPE`（k・cap・maxN・more・decay・upTag・floor・former・boost・team）で決まり、パターンはその上書き。番狂わせ率は40シーズンでも±2ポイントほどぶれるので、比べるときは100シーズン以上回す
- 番狂わせの目安: 下位5クラブの上位5クラブ相手の勝率 23〜26%（案D・上がり幅+10 で100シーズン平均 24.5%。以前の設定は 22.1%）、1試合2.4〜2.6点、優勝勝点 74〜88。番狂わせ率は数シーズンでは大きくぶれるので `dev/test/hype.js` で100シーズン以上回して比べる
