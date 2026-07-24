/* ============================================================
 * le-parser.js — Life Extension 出貨信解析（純函式，可移植到 Apps Script）
 * 輸入：出貨信的純文字內容（Gmail getPlainBody / 使用者貼上皆可）
 * 輸出：{ 來源, Order, Customer, 日期(YYYY-MM-DD), 追蹤碼, 運送方式, 建議批次名, 品項:[...] }
 * 不依賴 DOM / localStorage，Apps Script 可直接複製這兩個函式使用。
 * ============================================================ */

function parseLEShipping(text) {
  text = String(text || '').replace(/\r/g, '');
  const out = { 來源: 'Life Extension', Order: '', Customer: '', 日期: '', 追蹤碼: '', 運送方式: '', 建議批次名: '', 品項: [] };

  // Order Summary：三個標籤後接三個值（日期 客戶# 訂單#）
  const sum = text.match(/Order Summary[\s\S]{0,260}?(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d+)\s+(\d+)/);
  if (sum) {
    out.日期 = _toISO(sum[1]);
    out.Customer = sum[2];
    out.Order = sum[3];
  }
  // 追蹤碼與運送方式
  const track = text.match(/Tracking:\s*([A-Za-z0-9]+)/);
  if (track) out.追蹤碼 = track[1];
  const ship = text.match(/Shipping Method:\*?\s*\n+\s*([A-Za-z ]+)/);
  if (ship) out.運送方式 = ship[1].trim();

  // 品項：以「品名 … Item: … UPC: … $單價 | Qty: 數量」為錨點
  // 相容轉寄信（品名/金額外包 *星號*、$緊接數字）與原始直寄信（品名無星號、"$ 6.75" $後有空格、段間空行）
  const re = /(?:^|\n)[ \t]*\*?[ \t]*([^\s*][^\n]*?)[ \t]*\*?[ \t]*\n\s*Item:\s*(\d+)\s*\n\s*UPC:\s*(\d+)\s*\n\s*\*?\$\s*([\d.,]+)\s*\|\s*Qty:\s*(\d+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.品項.push({
      品名: m[1].trim(),
      Item: m[2],
      UPC: m[3],
      單價USD: parseFloat(m[4].replace(/,/g, '')) || 0,
      數量: parseInt(m[5], 10) || 0,
    });
  }

  // 建議批次名：好運 + MMDD（依你的命名慣例）
  if (out.日期) {
    const p = out.日期.split('-'); // YYYY-MM-DD
    out.建議批次名 = '好運' + p[1] + p[2];
  }
  return out;
}

// 把解析出的品項對到你的貨號。
// 對應鑰匙：先用料號（LE Item#），沒有再用品名／別名（Shopify 等無 SKU 的品牌）。
function matchLEItems(parsed, 商品清單) {
  const bySku = {}, byName = {};
  (商品清單 || []).forEach(p => {
    if (p.LEItem) bySku[String(p.LEItem)] = p;
    if (p.品名) byName[p.品名.trim().toLowerCase()] = p;
    (p.別名 || []).forEach(a => { if (a) byName[String(a).trim().toLowerCase()] = p; });
  });
  return parsed.品項.map(it => {
    const p = (it.Item && bySku[String(it.Item)]) ||
              byName[String(it.品名 || '').trim().toLowerCase()] || null;
    return Object.assign({}, it, {
      貨號: p ? p.貨號 : '',
      已對應: !!p,
      主檔品名: p ? p.品名 : '',
    });
  });
}

// 07/20/2026 → 2026-07-20
function _toISO(mdy) {
  const p = mdy.split('/');
  if (p.length !== 3) return '';
  const mm = ('0' + p[0]).slice(-2), dd = ('0' + p[1]).slice(-2);
  return p[2] + '-' + mm + '-' + dd;
}

// 供 Node/Apps Script 匯出（瀏覽器忽略）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseLEShipping, matchLEItems };
}
