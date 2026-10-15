// Build game data (clubs + players with ratings) from raw/*.txt
// Run: node build_data.js  -> data.json
const fs = require('fs');
const path = require('path');
const RAW = path.join(__dirname, 'raw');

// short name, colors, finance tier(1-5), fanbase(1-5), squad base level
const META = {
  kashima:   { short: '鹿島',   c1: '#A6192E', c2: '#14234B', tier: 4, fan: 4, base: 72, abbr: 'KAS', area: '茨城' },
  yokohamafm:{ short: '横浜FM', c1: '#0B3B8C', c2: '#E5E9F0', tier: 4, fan: 4, base: 69, abbr: 'YFM', area: '神奈川' },
  kashiwa:   { short: '柏',     c1: '#F2CC0C', c2: '#1A1A1A', tier: 3, fan: 3, base: 71, abbr: 'KSW', area: '千葉' },
  kawasakif: { short: '川崎F',  c1: '#2A8AD8', c2: '#111111', tier: 4, fan: 4, base: 70, abbr: 'KAW', area: '神奈川' },
  urawa:     { short: '浦和',   c1: '#D7000F', c2: '#111111', tier: 5, fan: 5, base: 70, abbr: 'URA', area: '埼玉' },
  machida:   { short: '町田',   c1: '#0A3D91', c2: '#C9A227', tier: 4, fan: 2, base: 71, abbr: 'MCD', area: '東京' },
  tokyov:    { short: '東京V',  c1: '#00843D', c2: '#F3F3F3', tier: 2, fan: 2, base: 68, abbr: 'TKV', area: '東京' },
  fctokyo:   { short: 'FC東京', c1: '#123E8C', c2: '#C8102E', tier: 4, fan: 4, base: 70, abbr: 'FCT', area: '東京' },
  mito:      { short: '水戸',   c1: '#1D4FA0', c2: '#F2F2F2', tier: 1, fan: 1, base: 65, abbr: 'MIT', area: '茨城' },
  chiba:     { short: '千葉',   c1: '#F7D117', c2: '#00753A', tier: 2, fan: 3, base: 66, abbr: 'CHI', area: '千葉' },
  shimizu:   { short: '清水',   c1: '#F28A00', c2: '#123A7A', tier: 3, fan: 3, base: 68, abbr: 'SHI', area: '静岡' },
  nagoya:    { short: '名古屋', c1: '#D6271C', c2: '#F2A900', tier: 4, fan: 4, base: 69, abbr: 'NAG', area: '愛知' },
  kyoto:     { short: '京都',   c1: '#6B2A8F', c2: '#E8E3EE', tier: 3, fan: 3, base: 70, abbr: 'KYO', area: '京都' },
  gosaka:    { short: 'G大阪',  c1: '#0A4AA6', c2: '#111111', tier: 4, fan: 4, base: 70, abbr: 'GOS', area: '大阪' },
  cosaka:    { short: 'C大阪',  c1: '#E2187A', c2: '#1B2A4A', tier: 3, fan: 3, base: 69, abbr: 'COS', area: '大阪' },
  kobe:      { short: '神戸',   c1: '#8E1B2E', c2: '#111111', tier: 5, fan: 3, base: 72, abbr: 'KOB', area: '兵庫' },
  okayama:   { short: '岡山',   c1: '#8C1D3A', c2: '#E8D8DC', tier: 2, fan: 3, base: 67, abbr: 'OKA', area: '岡山' },
  hiroshima: { short: '広島',   c1: '#5A2D91', c2: '#F2F2F2', tier: 4, fan: 4, base: 72, abbr: 'HIR', area: '広島' },
  fukuoka:   { short: '福岡',   c1: '#0D2C6C', c2: '#B8BEC9', tier: 3, fan: 3, base: 68, abbr: 'FUK', area: '福岡' },
  nagasaki:  { short: '長崎',   c1: '#0F4C9C', c2: '#F39800', tier: 3, fan: 3, base: 67, abbr: 'NGS', area: '長崎' },
};

// the shape each club mostly plays in 2026/27 (from the Football LAB formation pages)
const FORM = { machida: '3-4-2-1', hiroshima: '3-4-2-1', tokyov: '3-4-2-1', fukuoka: '3-4-2-1', okayama: '3-4-2-1', nagasaki: '3-4-2-1', kashiwa: '3-4-2-1', nagoya: '3-4-2-1', cosaka: '3-4-2-1',
  kawasakif: '4-2-3-1', yokohamafm: '4-2-3-1', gosaka: '4-2-3-1', urawa: '4-2-3-1', kobe: '4-3-3', kyoto: '4-3-3',
  kashima: '4-4-2', mito: '4-4-2', chiba: '4-4-2', shimizu: '4-4-2', fctokyo: '4-4-2' };

// Club history through the 2025 season. Sources: Wikipedia "J1 League", "J.League Cup", "Emperor's Cup" (titles by club); AFC club titles.
// j1: J1 titles, lc: J.League Cup, ec: Emperor's Cup in the J.League era (1993-), ecOld: Emperor's Cup as the predecessor company team,
// acl: Asian club titles (incl. Asian Club Championship, predecessor era included), o10: J.League founding member, sea: J1 seasons 1993-2025.
// rJ1 / rCup / rAcl: titles in the last 15 seasons (2011-2025), weighted on top of the all-time counts.
const HISTORY = {
  kashima:    { j1: 9, lc: 6, ec: 5, ecOld: 0, acl: 1, o10: 1, sea: 33 , rJ1: 2, rCup: 4, rAcl: 1 },
  yokohamafm: { j1: 5, lc: 1, ec: 1, ecOld: 6, acl: 0, o10: 1, sea: 33 , rJ1: 2, rCup: 1, rAcl: 0 },
  kawasakif:  { j1: 4, lc: 1, ec: 2, ecOld: 0, acl: 0, o10: 0, sea: 22 , rJ1: 4, rCup: 3, rAcl: 0 },
  urawa:      { j1: 1, lc: 2, ec: 4, ecOld: 4, acl: 3, o10: 1, sea: 32 , rJ1: 0, rCup: 3, rAcl: 2 },
  gosaka:     { j1: 2, lc: 2, ec: 4, ecOld: 1, acl: 1, o10: 1, sea: 32 , rJ1: 1, rCup: 3, rAcl: 0 },
  hiroshima:  { j1: 3, lc: 2, ec: 0, ecOld: 3, acl: 0, o10: 1, sea: 31 , rJ1: 3, rCup: 2, rAcl: 0 },
  kobe:       { j1: 2, lc: 0, ec: 2, ecOld: 0, acl: 0, o10: 0, sea: 27 , rJ1: 2, rCup: 2, rAcl: 0 },
  nagoya:     { j1: 1, lc: 2, ec: 2, ecOld: 0, acl: 0, o10: 1, sea: 32 , rJ1: 0, rCup: 2, rAcl: 0 },
  kashiwa:    { j1: 1, lc: 2, ec: 1, ecOld: 2, acl: 0, o10: 0, sea: 28 , rJ1: 1, rCup: 2, rAcl: 0 },
  tokyov:     { j1: 2, lc: 3, ec: 2, ecOld: 3, acl: 1, o10: 1, sea: 16 , rJ1: 0, rCup: 0, rAcl: 0 },
  chiba:      { j1: 0, lc: 2, ec: 0, ecOld: 4, acl: 1, o10: 1, sea: 17 , rJ1: 0, rCup: 0, rAcl: 0 },
  fctokyo:    { j1: 0, lc: 3, ec: 1, ecOld: 0, acl: 0, o10: 0, sea: 25 , rJ1: 0, rCup: 2, rAcl: 0 },
  cosaka:     { j1: 0, lc: 1, ec: 1, ecOld: 3, acl: 0, o10: 0, sea: 25 , rJ1: 0, rCup: 2, rAcl: 0 },
  shimizu:    { j1: 0, lc: 1, ec: 1, ecOld: 0, acl: 0, o10: 1, sea: 30 , rJ1: 0, rCup: 0, rAcl: 0 },
  kyoto:      { j1: 0, lc: 0, ec: 1, ecOld: 0, acl: 0, o10: 0, sea: 15 , rJ1: 0, rCup: 0, rAcl: 0 },
  fukuoka:    { j1: 0, lc: 1, ec: 0, ecOld: 0, acl: 0, o10: 0, sea: 14 , rJ1: 0, rCup: 1, rAcl: 0 },
  machida:    { j1: 0, lc: 0, ec: 1, ecOld: 0, acl: 0, o10: 0, sea: 2 , rJ1: 0, rCup: 1, rAcl: 0 },
  nagasaki:   { j1: 0, lc: 0, ec: 0, ecOld: 0, acl: 0, o10: 0, sea: 1 , rJ1: 0, rCup: 0, rAcl: 0 },
  okayama:    { j1: 0, lc: 0, ec: 0, ecOld: 0, acl: 0, o10: 0, sea: 1 , rJ1: 0, rCup: 0, rAcl: 0 },
  mito:       { j1: 0, lc: 0, ec: 0, ecOld: 0, acl: 0, o10: 0, sea: 0 , rJ1: 0, rCup: 0, rAcl: 0 },
};
// J2 clubs that can be promoted later (same rules)
const HISTORY_J2 = {
  sapporo:    { j1: 0, lc: 0, ec: 0, ecOld: 0, acl: 0, o10: 0, sea: 13 , rJ1: 0, rCup: 0, rAcl: 0 },
  yokohamafc: { j1: 0, lc: 0, ec: 0, ecOld: 0, acl: 0, o10: 0, sea: 5 , rJ1: 0, rCup: 0, rAcl: 0 },
  shonan:     { j1: 0, lc: 1, ec: 1, ecOld: 2, acl: 0, o10: 0, sea: 18 , rJ1: 0, rCup: 1, rAcl: 0 },
  niigata:    { j1: 0, lc: 0, ec: 0, ecOld: 0, acl: 0, o10: 0, sea: 17 , rJ1: 0, rCup: 0, rAcl: 0 },
  iwata:      { j1: 3, lc: 2, ec: 1, ecOld: 1, acl: 1, o10: 0, sea: 26 , rJ1: 0, rCup: 0, rAcl: 0 },
  tosu:       { j1: 0, lc: 0, ec: 0, ecOld: 0, acl: 0, o10: 0, sea: 13 , rJ1: 0, rCup: 0, rAcl: 0 },
  omiya:      { j1: 0, lc: 0, ec: 0, ecOld: 0, acl: 0, o10: 0, sea: 12 , rJ1: 0, rCup: 0, rAcl: 0 },
  sendai:     { j1: 0, lc: 0, ec: 0, ecOld: 0, acl: 0, o10: 0, sea: 14 , rJ1: 0, rCup: 0, rAcl: 0 },
  tokushima:  { j1: 0, lc: 0, ec: 0, ecOld: 0, acl: 0, o10: 0, sea: 2 , rJ1: 0, rCup: 0, rAcl: 0 },
  oita:       { j1: 0, lc: 1, ec: 0, ecOld: 0, acl: 0, o10: 0, sea: 11 , rJ1: 0, rCup: 0, rAcl: 0 },
  kofu:       { j1: 0, lc: 0, ec: 1, ecOld: 0, acl: 0, o10: 0, sea: 8 , rJ1: 0, rCup: 1, rAcl: 0 },
  yamagata:   { j1: 0, lc: 0, ec: 0, ecOld: 0, acl: 0, o10: 0, sea: 4 , rJ1: 0, rCup: 0, rAcl: 0 },
  iwaki:      { j1: 0, lc: 0, ec: 0, ecOld: 0, acl: 0, o10: 0, sea: 0 , rJ1: 0, rCup: 0, rAcl: 0 },
  imabari:    { j1: 0, lc: 0, ec: 0, ecOld: 0, acl: 0, o10: 0, sea: 0 , rJ1: 0, rCup: 0, rAcl: 0 },
};
function prestigeScore(h) {
  return h.j1 * 3 + h.acl * 3 + h.lc + h.ec + h.ecOld * 0.5 + h.sea * 0.12 + h.o10 * 1.5
    + h.rJ1 * 2 + h.rAcl * 2 + h.rCup * 0.5;
}
const PMAX = Math.max(...Object.values(HISTORY).map(prestigeScore));
const presFrom = h => Math.round((1 + 4 * Math.sqrt(prestigeScore(h) / PMAX)) * 100) / 100;
const prestigeOf = id => presFrom(HISTORY[id]);

// Ability estimates (ソーイの主観). Keys: name with spaces removed.
const OVR = {
  kashima: { 早川友基:78, 植田直通:74, 関川郁万:72, キムテヒョン:71, 三竿健斗:73, 柴崎岳:74, 樋口雄太:72, 松村優太:72, レオセアラ:80, 鈴木優磨:79, チャヴリッチ:75, エウベル:72, 小川諒也:71, 安西幸輝:72, 小池龍太:70, 広瀬陸斗:70, 千田海人:68, マテウスブエノ:71, ヤンマテウス:70, 田川亨介:69, 林晴己:68, 津久井佳祐:68, 大森渚生:68, 徳田誉:66, 吉田湊海:63, 梶川裕嗣:66 },
  yokohamafm: { 朴一圭:72, トーマスデン:74, ジェイソンキニョーネス:72, 角田涼太朗:71, 喜田拓也:72, 天野純:71, 遠野大弥:74, 谷村海那:72, ジョルディクルークス:75, ディーンデイビッド:73, ユーリアラウージョ:72, 宮市亮:68, 近藤友喜:71, 山根陸:72, 木村卓斗:70, 松原健:69, 鈴木冬一:69, 渡邊泰基:68, 井上太聖:68, 諏訪間幸成:68, 知念慶:69, オナイウ情滋:69, ルベンブランコ:68, 飯倉大樹:64, テヴィス:66 },
  kashiwa: { 小島亨介:74, 古賀太陽:74, 原田亘:72, 杉岡大暉:70, 犬飼智也:70, 小泉佳穂:75, 中川敦瑛:72, 久保藤次郎:72, 細谷真大:76, 垣田裕暉:70, 満田誠:72, 山田雄士:70, 手塚康平:71, 小西雄大:70, 渡井理己:70, 熊坂光希:71, 瀬川祐輔:71, 馬場晴也:72, 山内日向汰:71, 戸嶋祥郎:69, 三丸拡:68, 藤尾翔太:70, 大久保智明:70, 汰木康也:69, 原川力:69, 仲間隼斗:68, 遠藤渓太:70, 山之内佑成:69 },
  kawasakif: { 山口瑠伊:72, スベンドブローダーセン:72, フィリップウレモヴィッチ:72, 佐々木旭:72, 三浦颯太:72, 丸山祐市:69, 山原怜音:69, 山本悠樹:73, 橘田健人:72, 大島僚太:72, 脇坂泰斗:75, 大関友翔:71, 紺野和也:71, 河原創:70, 家長昭博:72, ラザルロマニッチ:74, 小林悠:68, 伊藤達哉:75, マルシーニョ:75, 宮城天:70, デリキラセルダ:70, 谷口栄斗:71, ペドロホマーノ:71, 松長根悠仁:67, 山市秀翔:67, 由井航太:66, 早坂勇希:66 },
  urawa: { 西川周作:74, ダニーロボザ:73, 根本健太:70, 宮本優太:70, 山根視来:71, 林幸多郎:68, 金子拓郎:74, マテウスサヴィオ:77, サミュエルグスタフソン:75, 渡邊凌磨:74, 安居海渡:73, 早川隼平:70, 長沼洋一:71, 小森飛絢:72, オナイウ阿道:71, 瀬古樹:71, 水沼宏太:68, 片山瑛一:67, 工藤孝太:67, 肥田野蓮治:68, 植木颯:66, 福井光輝:65 },
  machida: { 谷晃生:74, 昌子源:73, ドレシェヴィッチ:74, 望月ヘンリー海輝:73, 岡村大八:72, 菊池ダビド流帆:70, 前寛之:72, 下田北斗:70, 仙頭啓矢:71, 白崎凌兵:70, 相馬勇紀:77, 西村拓真:73, ミッチェルデューク:71, テテイェンギ:72, 小川航基:74, 松尾佑介:72, 明本考浩:72, ネタラヴィ:72, トーマスアウエヤン:70, キムミンテ:69, 中村帆高:70, 守田達弥:65, 西川楓人:66 },
  tokyov: { マテウス:72, 林尚輝:71, 宮原和也:70, 鈴木海音:71, 森田晃樹:72, 齋藤功佑:71, 福田湧矢:70, 平川怜:70, 染野唯月:71, 山見大登:71, 柴戸海:71, 松橋優安:69, 熊取谷一星:70, 新井悠太:70, 白井亮丞:66, 井上竜太:68, 田邉秀斗:68, 内田陽介:68, 松田陸:68, 吉田泰授:67, チョユミン:70, 藤本寛也:70, 食野壮磨:68, 山田剛綺:67, キムヒョンウ:68, 一美和成:68, 寺沼星文:68, 長沢祐弥:65 },
  fctokyo: { 田中颯:69, キムスンギュ:72, 室屋成:72, 森重真人:69, 稲村隼翔:70, 長友佑都:69, バングーナガンデ佳史扶:71, 大森理生:68, 石原広教:69, アレクサンダーショルツ:74, 橋本健人:69, 安斎颯馬:70, 高宇洋:72, ニコライヴァリス:71, 橋本拳人:72, 本間至恩:70, 常盤亨太:69, 俵積田晃太:72, 山田楓喜:71, マルセロヒアン:73, 佐藤恵允:72, 小湊絆:68, 長倉幹樹:71, 仲川輝人:69, ダニゴメス:70 },
  mito: { ヤクブスウォビィク:70, 家泉怜依:67, 大崎航詩:66, 渡邉新太:68, 新井瑞希:68, 鳥海芳樹:67, 根本凌:67, 内野航太郎:66, 谷口海斗:68, 真瀬拓海:67, 加藤千尋:66, 山本隼大:66, 木本恭生:67, 河面旺成:67, 仙波大志:66, 山下優人:66, パトリッキ:67, 松原修平:62, フォファナマリック:65, 岡本一真:64 },
  chiba: { ホセスアレス:69, 鈴木大輔:67, ンドカボニフェイス:68, 田口泰士:68, エドゥアルド:68, 椿直起:67, 杉山直宏:67, 品田愛斗:67, イサカゼイン:68, 呉屋大翔:67, 石川大地:67, エリソン:68, 田中和樹:66, ホシャ:67, 久保庭良太:67, 日高大:66, ダニエルホール:66, 小林祐介:66, マテウスインディオ:66, 天笠泰輝:66, 鳥海晃司:66, 安井拓也:66, 飯田貴敬:65, 矢村健:66 },
  shimizu: { 沖悠哉:70, 蓮川壮大:69, 住吉ジェラニレショーン:69, 高橋祐治:69, パクスンウク:69, 北川航也:72, カピシャーバ:72, 小塚和季:71, 松崎快:69, ディエギーニョ:69, ウォンドゥジェ:70, 吉田豊:68, 小泉慶:70, 弓場将輝:69, オセフン:70, ジャーメイン良:72, 須貝英大:68, 平戸太貴:68, 井上健太:69, マテウスブルネッティ:68, 本多勇喜:67, 木下康介:67, 藤井智也:68, 嶋本悠大:67, 梅田透吾:65 },
  nagoya: { シュミットダニエル:73, 佐藤瑶大:70, 藤井陽也:70, 原輝綺:70, 徳元悠平:70, 稲垣祥:73, 和泉竜司:71, 森島司:72, 高嶺朋樹:72, 浅野雄也:71, 中山克広:70, 内田宅哉:70, 菊地泰智:70, マテウスカストロ:76, 山岸祐也:72, 永井謙佑:69, 木村勇大:70, マルクスヴィニシウス:70, 野上結貴:68, 小屋松知哉:70, 小野雅史:68, 甲田英將:67, 武田洋平:63, ピサノアレックス幸冬堀尾:67 },
  kyoto: { 太田岳志:70, 鈴木義宜:71, アピアタウィア久:70, エンリケトレヴィザン:70, 佐藤響:70, 福岡慎平:72, 米本拓司:69, 松田天馬:70, 齊藤未月:71, 奥川雅也:71, ジョアンペドロ:70, ラファエルエリアス:79, マルコトゥーリオ:74, 長沢駿:67, 山中亮輔:69, 平賀大空:68, 新井晴樹:70, 志知孝明:68, アレックスソウザ:70, 諸岡裕人:67, 永田倖大:67, 加藤蓮:67, 本田風智:68, チアゴ:67, 加藤拓己:67, ハウス:66 },
  gosaka: { 一森純:73, 東口順昭:68, 中谷進之介:73, 三浦弦太:71, 半田陸:72, 福岡将太:70, 岸本武流:69, 初瀬亮:71, 中野伸哉:70, 鈴木徳真:72, 安部柊斗:71, 美藤倫:71, 倉田秋:68, 宇佐美貴史:75, デニスヒュメット:73, イッサムジェバリ:72, 山下諒也:72, ウェルトン:74, 食野亮太郎:71, 林大地:71, 植中朝日:70, 奥抜侃志:70, 小柏剛:69, フアンペ:70, 藤原奏哉:69, イーライアダムス:68, アリカマラ:68, 佐々木翔悟:67, 池谷銀姿郎:67, 角昂志郎:68 },
  cosaka: { 中村航輔:72, 上林豪:66, 畠中槙之輔:72, 井上黎生人:69, 登里享平:68, 奥田勇斗:71, ハビエルナンデス:70, 大畑歩夢:70, 香川真司:72, 田中駿汰:73, 上門知樹:71, 阪田澪哉:70, 横山夢樹:70, ジャクソンアーバイン:71, ルーカスフェルナンデス:75, チアゴアンドラーデ:71, 櫻川ソロモン:70, パブロサバック:71, 柴山昌也:70, ディオンクールズ:69, 中村拓海:68, 鷹啄トラビス:67, 小見洋太:68, 岡澤昂星:66, 阿部航斗:65 },
  kobe: { 前川黛也:73, 権田修一:70, マテウストゥーレル:73, 山川哲史:73, 酒井高徳:73, 岩波拓也:70, 永戸勝也:72, カエターノ:71, ジエゴ:70, 扇原貴宏:72, 井手口陽介:72, 郷家友太:72, 鍬先祐弥:71, 渡辺皓太:71, 井出遥也:70, 飯野七聖:70, 大迫勇也:76, 武藤嘉紀:77, エリキ:76, 佐々木大樹:73, ジェアンパトリッキ:72, 小松蓮:69, アンデルソンロペス:77, 髙橋壱晟:70, 日髙光揮:68, 本間ジャスティン:66, 冨永虹七:66, 新井章太:63 },
  okayama: { レナートモーザー:68, ケヴィンシルバ:66, 立田悠悟:70, 田上大地:69, 鈴木喜丈:68, 本山遥:66, 竹内涼:68, 江坂任:71, 田部井涼:68, 末吉塁:67, 藤田息吹:68, 木村太哉:68, 松本昌也:68, 神谷優太:69, 西川潤:68, ブラウンノア賢信:67, 宮本英治:67, 佐藤凌我:68, ルカオ:70, ナサンホ:71, レオガウショ:69, 白井康介:67, オベルダン:68, 山根永遠:66, 大森博:66, 川浪吾郎:64, 河野孝汰:65 },
  hiroshima: { 大迫敬介:76, 荒木隼人:74, 佐々木翔:72, 塩谷司:71, 中野就斗:72, 新井直人:70, キムジュソン:72, 山﨑大地:69, 川辺駿:74, 東俊希:72, 川村拓夢:73, 松本泰志:72, 菅大輝:72, 中島洋太朗:72, 越道草太:68, クシニイェンギ:72, 鈴木章斗:70, 加藤陸次樹:73, セバスティアンアレー:77, 鮎川峻:68, 浅野拓磨:74, 前田直輝:71, 田中雄大:64, 大内一生:65 },
  fukuoka: { 永石拓海:70, 上島拓巳:70, 田代雅也:68, 三國ケネディエブス:71, 湯澤聖人:68, 宮大樹:68, 前嶋洋太:69, 奥野耕平:69, 見木友哉:70, 名古新太郎:70, 秋野央樹:68, 重見柾斗:70, 北島祐二:68, 椎橋慧也:68, オリオールロメウ:71, ウェリックポポ:71, 碓井聖生:68, 城後寿:64, 藤本一輝:69, 鶴野怜樹:68, 師岡柊生:68, 辻岡佑真:67, 岡哲平:67, 深澤大輝:67, 山脇樺織:66, 前田快:66, 小畑裕馬:65, オビパウエルオビンナ:66 },
  nagasaki: { 後藤雅明:68, 波多野豪:69, エドゥアルド:70, 江川湧清:68, 米田隼也:68, 大南拓磨:70, 新井一耀:68, 山口蛍:72, マテウスジェズス:73, 岩崎悠人:70, 名倉巧:69, エメルソン:68, 澤田崇:67, 中村慶太:67, ディエゴピトゥカ:73, 翁長聖:68, 山田陸:68, 増山朝陽:67, チアゴサンタナ:73, ノーマンキャンベル:70, 山﨑凌吾:67, ジョナタンジュニオール:70, 高畑奎汰:67, 進藤亮佑:67, 長谷川元希:68, 松本天夢:66, 保田堅心:66 },
};

// Hand-picked prospects (potential override)
const POT = { 徳田誉: 80, 吉田湊海: 78, 中島洋太朗: 80, 俵積田晃太: 79, 大関友翔: 78, 早川隼平: 77, 横山夢樹: 76, 本間ジャスティン: 74, 熊坂光希: 76, 山根陸: 77, 稲村隼翔: 76, 大川佑梧: 74, 元砂晏翔仁ウデンバ: 74, 佐藤桜久: 72, ピサノアレックス幸冬堀尾: 76, 小森飛絢: 75, 鈴木章斗: 75, 中川敦瑛: 76, 美藤倫: 75, 阪田澪哉: 75, 越道草太: 73 };

const NAT = { // birthplace -> nationality code
  '大韓民国': 'KOR', 'ブラジル': 'BRA', 'セルビア': 'SRB', 'スペイン': 'ESP', 'コロンビア': 'COL', 'オーストラリア': 'AUS', 'カナダ': 'CAN',
  'ベルギー': 'BEL', 'イスラエル': 'ISR', 'ドイツ': 'GER', 'クロアチア': 'CRO', '中国': 'CHN', 'スウェーデン': 'SWE', 'オランダ': 'NED',
  'フィリピン': 'PHI', 'ポーランド': 'POL', 'ポルトガル': 'POR', 'アメリカ合衆国': 'USA', 'コートジボワール': 'CIV', 'チュニジア': 'TUN',
  'マレーシア': 'MAS', 'シリア': 'SYR', 'ナイジェリア': 'NGA', 'イタリア': 'ITA', 'フランス': 'FRA', 'デンマーク': 'DEN', 'ジャマイカ': 'JAM',
};
// Players born abroad but Japanese (birthplace isn't nationality)
const JP_BORN_ABROAD = new Set(['シュミットダニエル', '平野遼', '大内一生', '三國ケネディエブス', '住吉ジェラニレショーン', 'コッホアキ', 'ルカディドゥリカ']);
// Actually foreign though born in Japan is rare; keep all prefecture-born as JP.

function hash(str) { let h = 2166136261; for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rnd(seed) { let x = seed || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }

const SEASON_START = new Date('2026-08-07');
function ageAt(birth) {
  const [y, m, d] = birth.split('/').map(Number);
  let a = SEASON_START.getFullYear() - y;
  if (SEASON_START.getMonth() + 1 < m || (SEASON_START.getMonth() + 1 === m && SEASON_START.getDate() < d)) a--;
  return a;
}

const clubs = []; const players = [];
let pid = 1;
for (const file of fs.readdirSync(RAW).filter(f => f.endsWith('.txt')).sort()) {
  const lines = fs.readFileSync(path.join(RAW, file), 'utf8').split('\n').filter(Boolean);
  const head = lines[0].replace('#club ', '').split('|');
  const [id, name, coach, stadium, cap] = head;
  const m = META[id];
  if (!m) throw new Error('no meta ' + id);
  const h = HISTORY[id];
  clubs.push({ id, name, coach, stadium, cap: Number(cap), ...m, form: FORM[id] || '4-4-2', pres: prestigeOf(id), titles: { j1: h.j1, lc: h.lc, ec: h.ec + h.ecOld, acl: h.acl }, o10: !!h.o10 });
  const ov = OVR[id] || {};
  const used = new Set();
  for (const line of lines.slice(1)) {
    const t = line.trim().split(/\s+/);
    const pos = t[0], num = Number(t[1]);
    const birth = t[t.length - 2], origin = t[t.length - 1];
    const nameParts = t.slice(2, t.length - 2);
    const full = nameParts.join(' ');
    const key = nameParts.join('');
    let nat = 'JPN';
    if (NAT[origin]) nat = NAT[origin];
    else if (/^[A-Z]{3}$/.test(origin)) nat = origin;  // some club files give the country code (kashima: BRA / SRB / KOR); JP = Japanese
    if (JP_BORN_ABROAD.has(key)) nat = 'JPN';
    const age = ageAt(birth);
    const r = rnd(hash(id + key));
    let ovr;
    if (ov[key] != null) { ovr = ov[key]; used.add(key); }
    else {
      const b = m.base;
      let o;
      if (age <= 17) o = b - 15;
      else if (age <= 19) o = b - 11;
      else if (age <= 21) o = b - 8;
      else if (age >= 34) o = b - 7;
      else o = b - 5;
      if (pos === 'GK') o -= 2;
      ovr = Math.round(o + (r() * 6 - 3));
    }
    let pot;
    if (POT[key]) pot = POT[key];
    else {
      let g;
      if (age <= 17) g = 10 + r() * 10;
      else if (age <= 19) g = 8 + r() * 9;
      else if (age <= 21) g = 5 + r() * 8;
      else if (age <= 23) g = 2 + r() * 6;
      else if (age <= 26) g = r() * 3;
      else g = 0;
      pot = Math.min(88, Math.round(ovr + g));
    }
    if (pot < ovr) pot = ovr;
    // Short display name
    let short;
    if (nat === 'KOR' || nat === 'CHN') short = nameParts.join('');
    else if (nat === 'JPN') short = nameParts[0];
    else short = nameParts[nameParts.length - 1];
    // birthplace prefecture (2026-10-15, 地元の星 combo): 「神奈川県」→「神奈川」, as the clubs' area; players born abroad have none
    const bp = /^(北海道|.+[都府県])$/.test(origin) ? origin.replace(/[都府県]$/, '') : null;
    players.push({ id: pid++, club: id, pos, num, name: full, short, birth: birth.split('/').map((v, i) => i ? String(v).padStart(2, '0') : v).join('-'), nat, ovr, pot, ...(bp ? { bp } : {}) });
  }
  const missing = Object.keys(ov).filter(k => !used.has(k));
  if (missing.length) console.warn('[' + id + '] override not matched:', missing.join(','));
}

// disambiguate duplicate short names inside a club (e.g. two 田中)
const byClub = {};
for (const p of players) (byClub[p.club] ||= []).push(p);
for (const list of Object.values(byClub)) {
  const cnt = {};
  for (const p of list) cnt[p.short] = (cnt[p.short] || 0) + 1;
  for (const p of list) if (cnt[p.short] > 1 && p.nat === 'JPN') { const given = p.name.split(' ')[1]; if (given) p.short = p.short + given[0]; }
}

// ---------- young players: what they really do now (data revision 2, 2026-10-12) ----------
// The age rule above rates every teenager about 15 below the club, which badly undersells the ones already playing.
// 1) Starts: a 23-or-under player with starting appearances in 2026/27 (Football LAB, as of 2026-09-21) is rated at
//    least club base - 6 + 0.9 per start (up to 8), and keeps an age-fitting growth margin above that.
// 2) Youth internationals and stand-outs (ソーイの評価, from match reports and the 2026 squads):
//    アジア競技大会2026（U-21）: ピサノ・荒木・永野・森・大関・保田・中島・嶋本・横山 / U-17（AFC U17アジアカップ2026・リモージュ国際大会）: 元砂・長南・和田・エゼモクェ
//    三井寺眞（横浜FM・16歳）: J1開幕戦で史上最年少先発・先制点を含む3得点に関与、第6節まで全試合出場（5先発）2得点。技術と視野は抜群、球際とフィジカルが課題。
const YOUTH = {
  三井寺眞: [70, 88], 嶋本悠大: [69, 81], 中島洋太朗: [73, 83], 横山夢樹: [71, 80], 大関友翔: [72, 80], 保田堅心: [68, 78],
  ピサノアレックス幸冬堀尾: [69, 80], 永野修都: [65, 78], 森壮一朗: [63, 77], 荒木琉偉: [62, 79],
  元砂晏翔仁ウデンバ: [60, 78], 長南開史: [58, 78], 和田武士: [58, 77], エゼモクェチメヅェ海: [57, 77],
};
// playing style (ability split; see STYLE in engine.js)
const STYLE = { 三井寺眞: 'tech' };
// players whose ceiling may pass the usual 90 (engine GROW.potMax): 三井寺 keeps his 88 → 開花 up to 93 as before
const CAP = { 三井寺眞: 93 };
const DATA_REV = 3;
const FLA = {};
for (const l of fs.readFileSync(path.join(__dirname, 'positions_footballlab.txt'), 'utf8').split('\n')) {
  if (!l || l[0] === '#') continue;
  const [club, , list] = l.split('|');
  for (const e of list.split(', ')) { const mm = e.match(/^(.*) (\d+)$/); const k = club + ':' + mm[1].replace(/\s/g, ''); FLA[k] = (FLA[k] || 0) + Number(mm[2]); }
}
const youthStat = { starts: 0, picked: 0 };
const baseOf = Object.fromEntries(clubs.map(c => [c.id, c.base]));
for (const p of players) {
  const key = p.name.replace(/\s/g, '');
  const a = ageAt(p.birth.replace(/-/g, '/'));
  if (a > 23) continue;
  const old = { ovr: p.ovr, pot: p.pot };
  const st = FLA[p.club + ':' + key] || 0;
  if (st) { const floor = Math.round(baseOf[p.club] - 6 + Math.min(st, 8) * 0.9); if (floor > p.ovr) { p.ovr = floor; youthStat.starts++; } }
  if (YOUTH[key]) { [p.ovr, p.pot] = YOUTH[key]; youthStat.picked++; }
  const margin = a <= 17 ? 14 : a <= 19 ? 10 : a <= 21 ? 7 : a <= 22 ? 4 : 2;
  p.pot = Math.max(p.pot, p.ovr + (p.ovr > old.ovr ? margin : 0), p.ovr);
  if (STYLE[key]) p.sty = STYLE[key];
  if (p.ovr !== old.ovr || p.pot !== old.pot || p.sty) p.fix = { r: 2, d: p.ovr - old.ovr };
}
console.log('young players re-rated', youthStat, 'changed', players.filter(p => p.fix).length);

// ---------- data revision 3 (2026-10-13): real players' ceilings ----------
// Most players over 26 had a ceiling equal to their rating (no room at all), so after a few seasons the academy
// graduates pushed every real player out of the side. Now each one keeps some room by age (a little more for the
// best), up to 90. 21 or under keep the room they already had. Old saves get it through fix (r 3, the rating change
// of revision 2 stays tagged dr 2).
const room3 = (a, r) => a <= 21 ? 0 : a <= 23 ? 5 + r * 4 : a <= 26 ? 4 + r * 4 : a <= 29 ? 3 + r * 3 : a <= 31 ? 2 + r * 2 : a <= 33 ? 1 + r * 2 : r * 1.5;
const rev3 = { raised: 0, sum: 0 };
for (const p of players) {
  const key = p.name.replace(/\s/g, '');
  if (CAP[key]) { p.cap = CAP[key]; p.fix = p.fix ? { r: 3, d: p.fix.d, dr: 2 } : { r: 3, d: 0 }; continue; }
  const a = ageAt(p.birth.replace(/-/g, '/'));
  const r = rnd(hash('rev3' + p.club + key))();
  const want = Math.min(90, Math.round(p.ovr + room3(a, r) + (p.ovr >= 76 ? 1 : 0)));
  if (want <= p.pot) continue;
  rev3.raised++; rev3.sum += want - p.pot;
  p.pot = want;
  p.fix = p.fix ? { r: 3, d: p.fix.d, dr: 2 } : { r: 3, d: 0 };
}
console.log('rev3 ceilings raised', rev3.raised, 'avg +' + (rev3.sum / Math.max(1, rev3.raised)).toFixed(1));

// ---------- detailed positions: 本職 (pp) and extra aptitude (ap) ----------
// CB SB / DMF CMF OMF SH / CF ST(セカンドトップ・シャドー) WG
// Source 1: Football LAB formation pages (2026/27 starting slots per player, positions_footballlab.txt).
// Source 2: ソーイの知識 (PP_KNOWN). Players with neither are spread over what the squad lacks.
const FL = {};
for (const l of fs.readFileSync(path.join(__dirname, 'positions_footballlab.txt'), 'utf8').split('\n')) {
  if (!l || l[0] === '#') continue;
  const [, slot, list] = l.split('|');
  for (const e of list.split(', ')) {
    const mm = e.match(/^(.*) (\d+)$/); const k = mm[1].replace(/\s/g, '');
    FL[k] = FL[k] || {}; FL[k][slot] = (FL[k][slot] || 0) + Number(mm[2]);
  }
}
const DP_CAT = { GK: 'GK', CB: 'DF', SB: 'DF', DMF: 'MF', CMF: 'MF', OMF: 'MF', SH: 'MF', CF: 'FW', ST: 'FW', WG: 'FW' };
const DMF_KNOWN = new Set('マテウスブエノ 三竿健斗 舩橋佑 小林祐介 田口泰士 喜田陽 熊坂光希 高宇洋 常盤亨太 橋本拳人 前寛之 ネタラヴィ 橘田健人 知念慶 嶋本悠大 弓場将輝 ウォンドゥジェ 高嶺朋樹 ジョアンペドロ 尹星俊 鈴木徳真 美藤倫 田中駿汰 井手口陽介 鍬先祐弥 宮本英治 オベルダン 藤田息吹 前田快 椎橋慧也 山口蛍'.split(' '));
// key: name without spaces, or club:name when two players share a name
const PP_KNOWN = {
  'chiba:エドゥアルド': 'CMF', ンドカボニフェイス: 'CB', 久保庭良太: 'CB', 鈴木大輔: 'CB', 前貴之: 'SB', 米倉恒貴: 'SH', 椿直起: 'SH', 天笠泰輝: 'DMF', 安井拓也: 'CMF', イサカゼイン: 'SH', 品田愛斗: 'CMF', 呉屋大翔: 'CF', ホシャ: 'CF',
  登里享平: 'SB', 鷹啄トラビス: 'CB', 上門知樹: 'OMF', 阪田澪哉: 'SH', 柴山昌也: 'SH', パブロサバック: 'CF',
  大森理生: 'CB', 永野修都: 'CB', 山田楓喜: 'SH', 小湊絆: 'ST', 仲川輝人: 'WG', 尾谷ディヴァインチネドゥ: 'CF', ダニゴメス: 'CF',
  湯澤聖人: 'SB', 上島拓巳: 'CB', 宮大樹: 'CB', 奥野耕平: 'DMF', 秋野央樹: 'CMF', オリオールロメウ: 'DMF', 城後寿: 'ST', 鶴野怜樹: 'CF',
  半田陸: 'SB', 三浦弦太: 'CB', 奥抜侃志: 'SH', フアンペ: 'DMF', 倉田秋: 'OMF', 林大地: 'CF', 小柏剛: 'WG', ウェルトン: 'WG',
  山﨑大地: 'CB', キムジュソン: 'CB', 菅大輝: 'SH', クシニイェンギ: 'CF', 浅野拓磨: 'ST',
  安西幸輝: 'SB', 千田海人: 'CB', 大川佑梧: 'CB', 元砂晏翔仁ウデンバ: 'CB', 樋口雄太: 'CMF', 田川亨介: 'CF',
  麻田将吾: 'CB', 犬飼智也: 'CB', 山之内佑成: 'SB', 常藤奏: 'SB', 山田雄士: 'SH', 大久保智明: 'SH', 汰木康也: 'SH', 手塚康平: 'CMF', 仲間隼斗: 'SH', 瀬川祐輔: 'SH', 戸嶋祥郎: 'CMF', 原川力: 'CMF', 細谷真大: 'CF', 満田誠: 'ST',
  松長根悠仁: 'CB', 大島僚太: 'CMF', 大関友翔: 'OMF', 河原創: 'DMF', 家長昭博: 'SH', 小林悠: 'CF', 宮城天: 'WG',
  カエターノ: 'CB', 酒井高徳: 'SB', 本間ジャスティン: 'SB', 扇原貴宏: 'DMF', 井出遥也: 'OMF', 渡辺皓太: 'CMF', アンデルソンロペス: 'CF', 佐々木大樹: 'ST', エリキ: 'WG',
  山中亮輔: 'SB', 志知孝明: 'SB', 奥川雅也: 'SH', 米本拓司: 'DMF', 齊藤未月: 'DMF', マルコトゥーリオ: 'WG', 加藤拓己: 'CF', 平賀大空: 'WG', 長沢駿: 'CF',
  トーマスアウエヤン: 'SB', キムミンテ: 'CB', 仙頭啓矢: 'OMF', 松尾佑介: 'SH',
  新井瑞希: 'SH',
  'nagasaki:エドゥアルド': 'CB', 名倉巧: 'OMF', 澤田崇: 'SH', 中村慶太: 'CMF', 増山朝陽: 'SH', ノーマンキャンベル: 'CF',
  ダニーロボザ: 'CB', 佐藤瑶大: 'CB', 菊地泰智: 'SH', 小野雅史: 'CMF', 小屋松知哉: 'SH', 森島司: 'OMF',
  田上大地: 'CB', 竹内涼: 'DMF', 田部井涼: 'CMF', 末吉塁: 'SH', 木村太哉: 'SH', 神谷優太: 'OMF', 西川潤: 'OMF', 佐藤凌我: 'ST',
  蓮川壮大: 'CB', カピシャーバ: 'SH', 小泉慶: 'DMF', 小塚和季: 'OMF',
  田邉秀斗: 'CB', 松田陸: 'SB', チョユミン: 'CB', 柴戸海: 'DMF', 藤本寛也: 'CMF', 山見大登: 'ST', 一美和成: 'CF', 寺沼星文: 'CF',
  片山瑛一: 'SB', サミュエルグスタフソン: 'DMF', 早川隼平: 'OMF', 肥田野蓮治: 'CF',
  渡邊泰基: 'SB', 松原健: 'SB', トーマスデン: 'CB', 喜田拓也: 'DMF', 遠野大弥: 'ST', ジョルディクルークス: 'WG', オナイウ情滋: 'WG', ディーンデイビッド: 'CF', ユーリアラウージョ: 'WG',
};
// where a Football LAB slot puts a player of a given registered category
function slotDP(slot, cat, key) {
  if (cat === 'DF') return slot === 'CB' || slot === 'CH' || slot === 'CF' ? 'CB' : 'SB';
  if (cat === 'MF') return slot === 'CB' ? 'DMF' : slot === 'CH' ? (DMF_KNOWN.has(key) ? 'DMF' : 'CMF') : slot === 'OH' || slot === 'CF' ? 'OMF' : 'SH';
  return slot === 'CF' || slot === 'CB' ? 'CF' : slot === 'OH' || slot === 'CH' ? 'ST' : 'WG';
}
// positions a slot proves the player can play (second one a little lower)
const SLOT_REAL = { CB: ['CB'], LSB: ['SB'], RSB: ['SB'], LWB: ['SB', 'SH'], RWB: ['SB', 'SH'], CH: ['DMF', 'CMF'], OH: ['OMF', 'ST'], LSH: ['SH', 'WG'], RSH: ['SH', 'WG'], CF: ['CF'] };
const ppStat = { fl: 0, known: 0, fill: 0 };
for (const p of players) {
  const key = p.name.replace(/\s/g, '');
  if (p.pos === 'GK') { p.pp = 'GK'; continue; }
  const fl = FL[key]; const known = PP_KNOWN[p.club + ':' + key] || PP_KNOWN[key];
  const ap = {};
  if (fl) {
    const bucket = {};
    for (const [slot, n] of Object.entries(fl)) { const dp = slotDP(slot, p.pos, key); bucket[dp] = (bucket[dp] || 0) + n; }
    let pp = null, bv = -1;
    for (const [dp, n] of Object.entries(bucket)) if (n > bv || (n === bv && dp === 'ST')) { bv = n; pp = dp; }
    // a forward used both up front and behind/wide is a second striker
    if (p.pos === 'FW' && bucket.CF >= 2 && (bucket.ST || 0) + (bucket.WG || 0) >= 2) {
      const o = (bucket.ST || 0) + (bucket.WG || 0);
      if (Math.min(o, bucket.CF) / Math.max(o, bucket.CF) >= 0.5) pp = 'ST';
    }
    p.pp = pp; ppStat.fl++;
    for (const [slot, n] of Object.entries(fl)) SLOT_REAL[slot].forEach((dp, i) => {
      const v = (n >= 4 ? 92 : n >= 2 ? 88 : 82) - i * 4;
      if (v > (ap[dp] || 0)) ap[dp] = v;
    });
  }
  if (known) { if (!fl) ppStat.known++; p.pp = known; }
  if (p.pp) { delete ap[p.pp]; if (Object.keys(ap).length) p.ap = ap; }
  if (p.pp && DP_CAT[p.pp] !== p.pos) console.warn('pp outside registered category:', p.club, p.name, p.pos, p.pp);
}
// the rest: fill what each squad is short of (best players first)
const DP_TARGET = { DF: { CB: 5, SB: 4 }, MF: { DMF: 3, CMF: 3, OMF: 2, SH: 3 }, FW: { CF: 3, ST: 1.5, WG: 2 } };
for (const list of Object.values(byClub)) {
  const have = {}; for (const p of list) if (p.pp) have[p.pp] = (have[p.pp] || 0) + 1;
  for (const p of list.filter(q => !q.pp).sort((a, b) => b.ovr - a.ovr)) {
    const t = DP_TARGET[p.pos]; let best = null, bv = -1e9;
    for (const [dp, want] of Object.entries(t)) { const v = (want - (have[dp] || 0)) / want; if (v > bv) { bv = v; best = dp; } }
    p.pp = best; have[best] = (have[best] || 0) + 1; ppStat.fill++;
  }
}
console.log('positions', ppStat);

// Real opening round (2026/27 J1 第1節)
const round1 = [['yokohamafm', 'kashima'], ['kashiwa', 'mito'], ['fctokyo', 'machida'], ['tokyov', 'kawasakif'], ['nagoya', 'shimizu'], ['gosaka', 'urawa'], ['cosaka', 'okayama'], ['hiroshima', 'chiba'], ['fukuoka', 'kobe'], ['nagasaki', 'kyoto']];

const j2 = Object.fromEntries(Object.entries(HISTORY_J2).map(([id, h]) => [id, { pres: presFrom(h), titles: { j1: h.j1, lc: h.lc, ec: h.ec + h.ecOld, acl: h.acl } }]));

// ---------- 海外組 (2026-10-13): Japanese players at clubs in Europe and the USA, see abroad.js ----------
// ids from 5001 (the J1 players are 1〜800, generated players 100000+). Shirt numbers aren't known for most of them:
// one is picked per player (stable), and he can change it once he joins.
const AB = require('./abroad.js');
const inJ1 = new Set(players.map(p => p.name.replace(/\s/g, '')));
const abroad = { clubs: Object.entries(AB.CLUBS).map(([id, [name, short, cc, lg, lv, c1, c2]]) => ({ id, name, short, abbr: id.toUpperCase().slice(0, 3), cc, lg, lv, c1, c2, area: cc })), players: [] };
{
  let id = 5001; const usedNum = {};
  for (const [club, name, birth, pos, pp, ovr, pot, ap, short] of AB.PLAYERS) {
    if (!AB.CLUBS[club]) throw new Error('abroad: no club ' + club);
    if (inJ1.has(name.replace(/\s/g, ''))) { console.warn('abroad: already in J1 data, skipped', name); continue; }
    if (DP_CAT[pp] !== pos) throw new Error('abroad: pp outside the registered category ' + name);
    const used = usedNum[club] || (usedNum[club] = new Set());
    let num = 2 + hash('num' + name) % 40; while (used.has(num)) num++; used.add(num);
    // the same room to grow as the J1 players get (data revision 3), unless the given ceiling is higher
    const a = ageAt(birth.replace(/-/g, '/')), r = rnd(hash('rev3' + club + name.replace(/\s/g, '')))();
    const room = Math.min(90, Math.round(ovr + room3(a, r) + (ovr >= 76 ? 1 : 0)));
    const p = { id: id++, club, pos, num, name, short: short || name.split(' ')[0], birth, nat: 'JPN', ovr, pot: Math.min(90, Math.max(pot, ovr, room)), pp };
    if (ap) p.ap = ap;
    abroad.players.push(p);
  }
}
console.log('abroad clubs', abroad.clubs.length, 'players', abroad.players.length);
const out = { season: '2026/27', start: '2026-08-07', round1, clubs, players, j2, abroad, presV: 4, rev: DATA_REV };
fs.writeFileSync(path.join(__dirname, 'data.json'), JSON.stringify(out));
console.log('clubs', clubs.length, 'players', players.length, 'bytes', JSON.stringify(out).length);
const avg = {};
for (const c of clubs) { const top = byClub[c.id].map(p => p.ovr).sort((a, b) => b - a).slice(0, 14); avg[c.short] = (top.reduce((a, b) => a + b, 0) / top.length).toFixed(1); }
console.log(avg);
