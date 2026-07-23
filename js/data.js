/* ============================================================
 * data.js — 規格 v1 參數 + 本機儲存層
 * 資料層設計成可抽換：現在用 localStorage，之後接雲端只改這一層。
 * ============================================================ */

const SPEC = {
  匯率: 32.5,          // 執行期即時值，開機時由 DB 狀態覆蓋（見 DB._applySpec）→ 可在「賣場設定」改
  空運費_每磅: 150,
  超長備貨加成: 0.03, // 預購才收
  活動日加成: 0.02,   // 訂單成立日=活動日才收
};
// 匯率/空運費的預設值（首次使用或舊資料沒有時用這個；之後以使用者設定為準）
const 參數預設 = { 匯率: 32.5, 空運費_每磅: 150 };

// 賣場預設參數（可在「賣場設定」頁修改，改後存 localStorage）
// 類型：'蝦皮'＝套完整蝦皮費用；'簡易'＝毛利=售價−成本−售價×手續費率−固定費
const 賣場預設 = {
  CC: { 名稱: 'CC（克勞迪亞）', 類型: '蝦皮', 基本: 0.06, 金流: 0.025, 稅: 0.05, 固定費: 60 },
  愛屋: { 名稱: '愛屋', 類型: '蝦皮', 基本: 0.12, 金流: 0.025, 稅: 0.01, 固定費: 0 },
  '711賣貨便': { 名稱: '7-11 賣貨便', 類型: '簡易', 手續費率: 0, 固定費: 0 },
};

// 蝦皮活動日曆（2026，命中 +2%）。之後每月照規律補。
const 活動日預設 = [
  '2026-07-07','2026-07-08','2026-07-18','2026-07-25',
  '2026-08-08','2026-08-09','2026-08-18','2026-08-25',
  '2026-09-09','2026-09-10','2026-09-18','2026-09-25',
  '2026-10-10','2026-10-11','2026-10-18','2026-10-25',
  '2026-11-11','2026-11-12','2026-11-18','2026-11-25',
  '2026-12-12','2026-12-13','2026-12-18','2026-12-25',
];

// 商品種子（好運0720 已驗證品項；僅 NAC 有真實成本，其餘待補）
const 商品種子 = [
  { 貨號:'LE005', 品名:'N-Acetyl-L-Cysteine (NAC)', 進貨USD:6.62, 重量lb:0.19, 屬性:'預購', 品牌:'Life Extension', LEItem:'01534', 售價:480 },
  { 貨號:'LE075', 品名:'L-Arginine Caps',            進貨USD:0, 重量lb:0, 屬性:'預購', 品牌:'Life Extension', LEItem:'01624' },
  { 貨號:'LE020', 品名:'Super Omega-3 Fish Oil',     進貨USD:0, 重量lb:0, 屬性:'預購', 品牌:'Life Extension', LEItem:'01986' },
  { 貨號:'LE116', 品名:'Cognitex Alpha GPC',         進貨USD:0, 重量lb:0, 屬性:'預購', 品牌:'Life Extension', LEItem:'02321' },
  { 貨號:'LE019', 品名:'Bone Restore',               進貨USD:0, 重量lb:0, 屬性:'預購', 品牌:'Life Extension', LEItem:'01726' },
  { 貨號:'LE084', 品名:'Super Ubiquinol CoQ10 100mg',進貨USD:0, 重量lb:0, 屬性:'預購', 品牌:'Life Extension', LEItem:'01426' },
  { 貨號:'LE018', 品名:'Bone Restore Elite w/ K2',   進貨USD:0, 重量lb:0, 屬性:'預購', 品牌:'Life Extension', LEItem:'02416' },
  { 貨號:'LE055', 品名:'MacuGuard Ocular w/ Saffron',進貨USD:0, 重量lb:0, 屬性:'預購', 品牌:'Life Extension', LEItem:'01992' },
  { 貨號:'LE009', 品名:'Super Absorbable Tocotrienols',進貨USD:0, 重量lb:0, 屬性:'預購', 品牌:'Life Extension', LEItem:'01400' },
  { 貨號:'LE014', 品名:'Super Bio-Curcumin Turmeric',進貨USD:0, 重量lb:0, 屬性:'預購', 品牌:'Life Extension', LEItem:'00407' },
];

// 採購批次：起始為空，實際批次由「待確認」確認後產生（模擬機器人讀信流程）
const 採購種子 = [];

// 待確認佇列種子：= 機器人讀好運0720 出貨信解析出的結果（真信實測，21項）
// 正式上線時這裡由 Apps Script 機器人寫入；此為示範，讓你先體驗確認流程。
const 待確認種子 = [
  {
    id: 'p0720',
    來源: 'Life Extension',
    Order: '28620733', Customer: '17115455',
    日期: '2026-07-20', 追蹤碼: '1Z2794930332164100', 運送方式: 'UPS',
    建議批次名: '好運0720',
    收信時間: '2026-07-21',
    品項: [
      { 品名:'N-Acetyl-L-Cysteine (NAC)', Item:'01534', 單價USD:6.75, 數量:12 },
      { 品名:'L-Arginine Caps', Item:'01624', 單價USD:12.15, 數量:1 },
      { 品名:'Super Omega-3 EPA/DHA Fish Oil, Sesame Lignans & Olive Extract', Item:'01986', 單價USD:18.00, 數量:1 },
      { 品名:'Cognitex® Alpha GPC', Item:'02321', 單價USD:14.40, 數量:1 },
      { 品名:'Sea-Iodine™', Item:'01740', 單價USD:3.60, 數量:1 },
      { 品名:'Bone Restore', Item:'01726', 單價USD:9.90, 數量:1 },
      { 品名:'Super Ubiquinol CoQ10 with Enhanced Mitochondrial Support™', Item:'01426', 單價USD:25.20, 數量:2 },
      { 品名:'Bone Restore Elite with Super Potent K2', Item:'02416', 單價USD:23.40, 數量:2 },
      { 品名:'SAMe', Item:'02174', 單價USD:31.50, 數量:3 },
      { 品名:'MacuGuard® Ocular Support with Saffron', Item:'01992', 單價USD:10.80, 數量:6 },
      { 品名:'Super Ubiquinol CoQ10 with PQQ', Item:'01733', 單價USD:20.25, 數量:5 },
      { 品名:'Super Absorbable Tocotrienols', Item:'01400', 單價USD:13.50, 數量:12 },
      { 品名:'Glycemic Guard™', Item:'02122', 單價USD:19.32, 數量:1 },
      { 品名:'Cortisol-Stress Balance', Item:'02312', 單價USD:20.70, 數量:1 },
      { 品名:'PalmettoGuard® Saw Palmetto, Nettle Root and Beta-Sitosterol', Item:'01790', 單價USD:12.60, 數量:13 },
      { 品名:'Super Carnosine', Item:'02020', 單價USD:21.00, 數量:1 },
      { 品名:'Optimized Ashwagandha', Item:'00888', 單價USD:4.99, 數量:2 },
      { 品名:'Rhodiola Extract', Item:'00889', 單價USD:10.13, 數量:1 },
      { 品名:'Testosterone Elite', Item:'02500', 單價USD:23.40, 數量:6 },
      { 品名:'Magnesium Glycinate', Item:'02535', 單價USD:10.58, 數量:24 },
      { 品名:'Super Bio-Curcumin® Turmeric Extract', Item:'00407', 單價USD:15.00, 數量:1 },
    ],
  },
];

// 示範資料版本：改動 seed 時 +1，使用者本機舊資料會自動換新（開發期用；接雲端後以雲端為準）
const STATE_VERSION = 13;

// 品牌下拉選項（可在編輯頁選「其他」自訂新增）
const 品牌選項 = ['Life Extension', 'NusaPure', 'Nutricost', 'Sparkle Wellness',
  'Advantage Nutrition Forte', 'Primaforce', 'Standard Process', 'Now Foods'];

// ---------- 儲存層（唯一對外介面，之後接雲端只改這裡）----------
const DB = {
  KEY: 'shopee_cost_v1',

  _read() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || null; }
    catch (e) { return null; }
  },
  _write(state) { localStorage.setItem(this.KEY, JSON.stringify(state)); },

  // 主資料（不含待確認）＝雲端 A1 儲存的內容
  _mainData() { const s = this.init(); return { 商品: s.商品, 賣場: s.賣場, 活動日: s.活動日, 採購: s.採購, 匯率: s.匯率, 空運費_每磅: s.空運費_每磅 }; },
  // 雲端拉下來時：覆蓋主資料，但保留本機待確認交由 _setPendingLocal 處理
  _overwriteMain(data) {
    const s = this.init();
    if (data.商品) s.商品 = data.商品;
    if (data.賣場) s.賣場 = data.賣場;
    if (data.活動日) s.活動日 = data.活動日;
    if (data.採購) s.採購 = data.採購;
    if (typeof data.匯率 === 'number') s.匯率 = data.匯率;
    if (typeof data.空運費_每磅 === 'number') s.空運費_每磅 = data.空運費_每磅;
    this._normalize(s); // 雲端來的舊資料補上 711／類型／品牌／匯率等新欄位
    this._applySpec(s); // 套用雲端的匯率
    this._write(s);
  },
  _setPendingLocal(list) { const s = this.init(); s.待確認 = list || []; this._write(s); },
  // 主資料變動後推雲端
  _pushMain() { if (typeof Cloud !== 'undefined') Cloud.scheduleOut(this._mainData()); },

  // 初始化：首次使用（或示範資料版本過舊）灌入預設值
  init() {
    let s = this._read();
    let dirty = false;
    if (!s || s._v !== STATE_VERSION) {
      s = {
        _v: STATE_VERSION,
        商品: 商品種子.slice(),
        賣場: JSON.parse(JSON.stringify(賣場預設)),
        活動日: 活動日預設.slice(),
        採購: JSON.parse(JSON.stringify(採購種子)),
        待確認: JSON.parse(JSON.stringify(待確認種子)),
        匯率: 參數預設.匯率,
        空運費_每磅: 參數預設.空運費_每磅,
      };
      dirty = true;
    }
    if (this._normalize(s)) dirty = true;
    this._applySpec(s); // 把匯率/空運費套進 SPEC，讓 calc 立即用最新值
    if (dirty) this._write(s);
    return s;
  },

  // 把狀態裡的匯率/空運費套進 SPEC（執行期即時值）
  _applySpec(s) {
    if (typeof s.匯率 === 'number' && s.匯率 > 0) SPEC.匯率 = s.匯率;
    if (typeof s.空運費_每磅 === 'number' && s.空運費_每磅 >= 0) SPEC.空運費_每磅 = s.空運費_每磅;
  },

  // 相容轉換：舊版/雲端資料補上新欄位（不動既有值），確保 711、賣場類型、品牌等存在
  _normalize(s) {
    let changed = false;
    s.賣場 = s.賣場 || {};
    Object.keys(賣場預設).forEach(k => {
      if (!s.賣場[k]) { s.賣場[k] = JSON.parse(JSON.stringify(賣場預設[k])); changed = true; }      // 補上缺的賣場（如 711）
      else if (!s.賣場[k].類型) { s.賣場[k].類型 = 賣場預設[k].類型 || '蝦皮'; changed = true; }    // 補上類型
    });
    (s.商品 || []).forEach(p => {
      if (p.品牌 === undefined) { p.品牌 = ''; changed = true; }
      if (!p.別名) { p.別名 = []; changed = true; }
    });
    if (!s.待確認) { s.待確認 = []; changed = true; }
    if (typeof s.匯率 !== 'number') { s.匯率 = 參數預設.匯率; changed = true; }            // 舊資料補匯率
    if (typeof s.空運費_每磅 !== 'number') { s.空運費_每磅 = 參數預設.空運費_每磅; changed = true; }
    return changed;
  },

  取商品() { return this.init().商品; },
  存商品(list) { const s = this.init(); s.商品 = list; this._write(s); this._pushMain(); },

  取賣場() { return this.init().賣場; },
  存賣場(obj) { const s = this.init(); s.賣場 = obj; this._write(s); this._pushMain(); },

  取活動日() { return this.init().活動日; },
  存活動日(list) { const s = this.init(); s.活動日 = list; this._write(s); this._pushMain(); },

  // 共用參數：美金匯率（浮動，可隨時改）／空運費。改後套進 SPEC、存檔、推雲端。
  取匯率() { return this.init().匯率; },
  取空運費() { return this.init().空運費_每磅; },
  存參數(obj) {
    const s = this.init();
    if (obj && Number(obj.匯率) > 0) s.匯率 = Number(obj.匯率);
    if (obj && Number(obj.空運費_每磅) >= 0) s.空運費_每磅 = Number(obj.空運費_每磅);
    this._applySpec(s); this._write(s); this._pushMain();
  },

  取採購() { const s = this.init(); return s.採購 || (s.採購 = JSON.parse(JSON.stringify(採購種子)), this._write(s), s.採購); },
  存採購(list) { const s = this.init(); s.採購 = list; this._write(s); this._pushMain(); },

  取待確認() { const s = this.init(); return s.待確認 || (s.待確認 = [], this._write(s), s.待確認); },
  存待確認(list) { const s = this.init(); s.待確認 = list; this._write(s); if (typeof Cloud !== 'undefined') Cloud.setPending(list); },

  // 判斷本機是不是「真實資料」而非剛灌入的預設種子（給雲端初始化上傳當守門員用）。
  // 商品數與種子不同、或已有採購批次，就當作真實資料。
  hasRealData() {
    const s = this.init();
    if ((s.商品 || []).length !== 商品種子.length) return true;
    if ((s.採購 || []).length !== 採購種子.length) return true;
    return false;
  },

  // 匯出 / 匯入（跨裝置搬資料的暫時方案，雲端接上前先用這個）
  匯出() { return JSON.stringify(this.init(), null, 2); },
  匯入(json) { const s = JSON.parse(json); this._write(s); return s; },
  重置() { localStorage.removeItem(this.KEY); return this.init(); },
};

/* ---------- 雲端同步層（用 Google 試算表 + Apps Script Web App 當後端）----------
 * 設計：整包 JSON 同步（單人跨自己裝置，最後寫入者為準）。
 * 沒設定網址時完全不啟用，系統照常用本機資料。
 */
const Cloud = {
  URLKEY: 'shopee_cloud_url',
  status: 'off', // off | ok | error | syncing
  // ⭐ 安全旗標：只有「這台這次確實從雲端同步成功過」才會是 true。
  // 沒同步成功前一律禁止把本機資料推上雲端 → 空的/舊的裝置永遠蓋不掉雲端。
  synced: false,
  _timer: null,

  get url() { return localStorage.getItem(this.URLKEY) || ''; },
  set url(v) { v ? localStorage.setItem(this.URLKEY, v.trim()) : localStorage.removeItem(this.URLKEY); },
  enabled() { return !!this.url; },

  // 開機同步：拉主資料覆蓋本機、拉待確認佇列；雲端若空且本機有真實資料才初始化上傳。
  // 冷啟動（Apps Script 睡著）第一次呼叫會慢，故自動重試數次，避免誤判「連線失敗」。
  async syncIn(retries = 2) {
    if (!this.enabled()) { this.status = 'off'; this.synced = false; return; }
    this.status = 'syncing';
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const r = await fetch(this.url, { method: 'GET' });
        const j = await r.json();
        if (j && j.ok) {
          if (j.data && j.data.商品) {
            DB._overwriteMain(j.data);                       // 雲端有資料 → 覆蓋本機
          } else if (DB.hasRealData()) {
            await this._post('saveData', DB._mainData());    // 雲端空、但本機是真實資料 → 初始化上傳
          }
          // ⚠️ 雲端空且本機只是預設種子 → 什麼都不做（不拿種子去初始化，避免假初始化）
          DB._setPendingLocal(j.pending || []);              // 待確認以雲端為準
          this.status = 'ok';
          this.synced = true;                                // ✅ 這台已與雲端對齊，之後才准推雲端
          return;
        }
      } catch (e) { console.warn(`雲端拉取失敗（第 ${attempt + 1} 次）`, e); }
      if (attempt < retries) await new Promise(res => setTimeout(res, 1200 * (attempt + 1))); // 遞增等待，喚醒冷啟動
    }
    this.status = 'error'; this.synced = false;              // 幾次都失敗 → 維持未同步，禁止推雲端
  },

  // 主資料上傳（防抖）
  scheduleOut(main) {
    if (!this.enabled()) return;
    // ⭐ 核心防護：這台還沒成功同步過雲端，就絕不推上去（避免空的/舊的蓋掉雲端好資料）。
    if (!this.synced) {
      console.warn('尚未與雲端同步成功，暫不上傳本機變更，避免覆蓋雲端資料。');
      this.status = 'error';
      if (typeof App !== 'undefined' && App.updateCloudBadge) App.updateCloudBadge();
      return;
    }
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._post('saveData', main), 800);
  },
  // 待確認佇列上傳（確認/丟棄後即時寫回雲端）
  setPending(list) {
    if (!this.enabled()) return;
    this._post('setPending', list);
  },

  async _post(action, payload) {
    if (!this.enabled()) return;
    this.status = 'syncing'; if (typeof App !== 'undefined' && App.updateCloudBadge) App.updateCloudBadge();
    try {
      // text/plain 避開 CORS 預檢；Apps Script 讀 e.postData.contents 解析
      await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, payload }),
      });
      this.status = 'ok';
    } catch (e) { this.status = 'error'; console.warn('雲端上傳失敗', e); }
    if (typeof App !== 'undefined' && App.updateCloudBadge) App.updateCloudBadge();
  },

  // 手動再抓一次（收信後想立刻看新待確認）
  async refresh() { await this.syncIn(); },

  // 測試連線
  async test(url) {
    try {
      const r = await fetch(url, { method: 'GET' });
      const j = await r.json();
      return !!(j && j.ok);
    } catch (e) { return false; }
  },
};
