/* ============================================================
 * calc.js — 費用/毛利計算引擎（規格 v1）
 * 純函式，不碰畫面，方便日後測試與對帳重用。
 * ============================================================ */

// 基礎手續費率 = 基本 + 金流 + 稅
function 基礎手續費率(賣場參數) {
  return (Number(賣場參數.基本) || 0) + (Number(賣場參數.金流) || 0) + (Number(賣場參數.稅) || 0);
}

// 判斷某日期字串(YYYY-MM-DD)是否命中活動日
function 是活動日(dateStr, 活動日清單) {
  if (!dateStr) return false;
  return 活動日清單.indexOf(dateStr) !== -1;
}

/**
 * 單件試算
 * @param 商品 {進貨USD, 重量lb, 屬性:'現貨'|'預購'}
 * @param 賣場參數 {基本,金流,稅,固定費}
 * @param 售價 number
 * @param opt { 是否活動日:bool }
 * @return {成本, 費率, 手續費, 毛利, 毛利率}
 */
function 算單件(商品, 賣場參數, 售價, opt) {
  opt = opt || {};
  const 成本 = (Number(商品.進貨USD) || 0) * SPEC.匯率
             + (Number(商品.重量lb) || 0) * SPEC.空運費_每磅;
  let 費率;
  if (賣場參數.類型 === '簡易') {
    // 711 賣貨便等：不套蝦皮費用，只收自訂手續費率（預設 0）
    費率 = Number(賣場參數.手續費率) || 0;
  } else {
    費率 = 基礎手續費率(賣場參數);
    if (商品.屬性 === '預購') 費率 += SPEC.超長備貨加成;
    if (opt.是否活動日) 費率 += SPEC.活動日加成;
  }
  const 手續費 = (Number(售價) || 0) * 費率;
  const 毛利 = (Number(售價) || 0) - 成本 - 手續費;
  const 毛利率 = 售價 ? 毛利 / 售價 : 0;
  return { 成本, 費率, 手續費, 毛利, 毛利率 };
}

/**
 * 整筆訂單試算（多品項 + 每筆固定費 $60 一次）
 * @param 明細 [{商品, 售價, 數量}]
 * @param 賣場參數
 * @param opt {是否活動日}
 * @return {列:[...每項結果], 小計毛利, 固定費, 訂單毛利, 總售價, 總成本, 總手續費}
 */
function 算訂單(明細, 賣場參數, opt) {
  let 小計毛利 = 0, 總售價 = 0, 總成本 = 0, 總手續費 = 0;
  const 列 = 明細.map(function(d) {
    const 數量 = Number(d.數量) || 1;
    const r = 算單件(d.商品, 賣場參數, d.售價, opt);
    const 件成本 = r.成本 * 數量;
    const 件手續費 = r.手續費 * 數量;
    const 件售價 = (Number(d.售價) || 0) * 數量;
    const 件毛利 = r.毛利 * 數量;
    小計毛利 += 件毛利; 總售價 += 件售價; 總成本 += 件成本; 總手續費 += 件手續費;
    return Object.assign({}, r, { 數量, 件售價, 件成本, 件手續費, 件毛利 });
  });
  const 固定費 = Number(賣場參數.固定費) || 0;
  const 訂單毛利 = 小計毛利 - 固定費;
  return { 列, 小計毛利, 固定費, 訂單毛利, 總售價, 總成本, 總手續費 };
}

// 金額/百分比格式化
function 錢(n) {
  return 'NT$' + Math.round(Number(n) || 0).toLocaleString('en-US');
}
function 錢2(n) {
  return 'NT$' + (Number(n) || 0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
}
function 百分(n) {
  return ((Number(n) || 0) * 100).toFixed(1) + '%';
}

/**
 * 客製代購反推售價（客人指定、主檔沒有的商品）
 * 輸入「代購金額、重量、想賺的利潤」→ 反推要報給客人的售價，並列出所有手續費。
 * 售價 = (數量×(成本+利潤) + 固定費) ÷ (數量×(1−費率))，無條件進位到整數元。
 * @param o { 賣場參數, 金額, 幣別:'USD'|'NTD', 重量lb, 利潤(每件), 數量, 預購:bool, 是否活動日:bool, 含固定費:bool }
 * @return {錯誤?} 或 {品價, 空運費, 成本, 項目:[{名稱,率,金額}], 費率, 固定費, 售價, 每件手續費, 總手續費, 每件毛利, 總毛利, 總售價, 數量}
 */
function 算客製(o) {
  const 賣場 = o.賣場參數;
  const 數量 = Math.max(1, Math.floor(Number(o.數量)) || 1);
  const 金額 = Number(o.金額) || 0;
  const 品價 = o.幣別 === 'NTD' ? 金額 : 金額 * SPEC.匯率;
  const 空運費 = (Number(o.重量lb) || 0) * SPEC.空運費_每磅;
  const 成本 = 品價 + 空運費;
  const 利潤 = Number(o.利潤) || 0;

  const 項目 = [];
  if (賣場.類型 === '簡易') {
    項目.push({ 名稱: '手續費', 率: Number(賣場.手續費率) || 0 });
  } else {
    項目.push({ 名稱: '基本服務費', 率: Number(賣場.基本) || 0 });
    項目.push({ 名稱: '金流與系統處理費', 率: Number(賣場.金流) || 0 });
    項目.push({ 名稱: '營業稅', 率: Number(賣場.稅) || 0 });
    if (o.預購) 項目.push({ 名稱: '超長備貨（預購）', 率: SPEC.超長備貨加成 });
    if (o.是否活動日) 項目.push({ 名稱: '活動日加收', 率: SPEC.活動日加成 });
  }
  const 費率 = 項目.reduce((s, x) => s + x.率, 0);
  if (費率 >= 1) return { 錯誤: '手續費率已達 100% 以上，無法試算' };
  const 固定費 = o.含固定費 ? (Number(賣場.固定費) || 0) : 0;

  const 售價 = Math.ceil((數量 * (成本 + 利潤) + 固定費) / (數量 * (1 - 費率)) - 1e-9);
  項目.forEach(x => { x.金額 = 售價 * 數量 * x.率; });
  const 總售價 = 售價 * 數量;
  const 總手續費 = 項目.reduce((s, x) => s + x.金額, 0) + 固定費;
  const 總毛利 = 總售價 - 成本 * 數量 - 總手續費;
  return { 數量, 品價, 空運費, 成本, 項目, 費率, 固定費, 售價, 總售價,
           每件手續費: 總手續費 / 數量, 總手續費, 每件毛利: 總毛利 / 數量, 總毛利 };
}
