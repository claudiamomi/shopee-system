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
