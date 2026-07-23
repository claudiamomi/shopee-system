/* ============================================================
 * app.js — 介面與路由（毛利試算機 / 商品成本表 / 賣場設定）
 * ============================================================ */

const App = {
  view: 'calc',
  cart: [], // 訂單試算的品項

  async start() {
    DB.init();
    this.bindNav();
    const el = document.getElementById('content');
    if (Cloud.enabled()) {
      el.innerHTML = '<div class="empty">☁️ 雲端同步中…</div>';
      await Cloud.syncIn();
    }
    this.go('calc');
    this.updateCloudBadge();
  },

  updateCloudBadge() {
    const el = document.getElementById('cloud-badge');
    if (!el) return;
    const map = { off:'💾 本機', ok:'☁️ 已同步', syncing:'⏳ 同步中', error:'⚠️ 雲端失敗' };
    el.textContent = map[Cloud.status] || '💾 本機';
  },

  bindNav() {
    document.querySelectorAll('[data-view]').forEach(el => {
      el.addEventListener('click', e => { e.preventDefault(); this.go(el.dataset.view); this.closeNav(); });
    });
    document.getElementById('hamburger').addEventListener('click', () => this.toggleNav());
    document.getElementById('backdrop').addEventListener('click', () => this.closeNav());
  },
  toggleNav() { document.getElementById('app').classList.toggle('nav-open'); },
  closeNav() { document.getElementById('app').classList.remove('nav-open'); },

  go(view) {
    this.view = view;
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
    const el = document.getElementById('content');
    if (view === 'calc') el.innerHTML = this.renderCalc(), this.afterCalc();
    else if (view === 'purchases') el.innerHTML = this.renderPurchases(), this.afterPurchases();
    else if (view === 'products') el.innerHTML = this.renderProducts(), this.afterProducts();
    else if (view === 'stores') el.innerHTML = this.renderStores(), this.afterStores();
    else if (view === 'data') el.innerHTML = this.renderData(), this.afterData();
    window.scrollTo(0, 0);
  },

  /* ================= 毛利試算機 ================= */
  renderCalc() {
    const 賣場 = DB.取賣場();
    const opts = Object.keys(賣場).map(k => `<option value="${k}">${賣場[k].名稱}</option>`).join('');
    return `
    <div class="page-head"><h1>毛利試算機</h1>
      <p>選商品、賣場、售價，系統依規格自動算手續費與毛利。可加多筆湊成一張訂單（CC 每筆訂單會扣一次 $60 固定費）。</p></div>

    <div class="card">
      <h2>➕ 加入試算品項</h2>
      <div class="grid grid-4">
        <div class="field"><label>賣場</label><select id="c-store">${opts}</select></div>
        <div class="field"><label>商品</label><select id="c-prod"></select></div>
        <div class="field"><label>售價（每件）</label><input id="c-price" type="number" min="0" placeholder="例：480"></div>
        <div class="field"><label>數量</label><input id="c-qty" type="number" min="1" value="1"></div>
      </div>
      <div class="grid grid-4">
        <div class="field"><label>訂單成立日（判斷活動日 +2%）</label><input id="c-date" type="date"></div>
        <div class="field" style="align-self:end"><label>&nbsp;</label>
          <div id="c-preview" class="muted">選好商品後這裡即時預覽單件毛利…</div></div>
        <div class="field" style="align-self:end"><label>&nbsp;</label>
          <button class="btn btn-primary" id="c-add">加入訂單</button></div>
      </div>
    </div>

    <div class="card">
      <h2>🧾 本次訂單</h2>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>商品</th><th>屬性</th><th class="num">售價</th><th class="num">數量</th>
          <th class="num">成本</th><th class="num">費率</th><th class="num">手續費</th><th class="num">毛利</th><th></th>
        </tr></thead>
        <tbody id="cart-body"></tbody>
      </table></div>
      <div id="order-summary"></div>
    </div>`;
  },

  afterCalc() {
    const fillProds = () => {
      const list = DB.取商品();
      document.getElementById('c-prod').innerHTML =
        list.map((p,i) => `<option value="${i}">${p.貨號}｜${p.品牌?p.品牌+' ':''}${p.品名}</option>`).join('');
    };
    fillProds();
    const preview = () => {
      const store = DB.取賣場()[document.getElementById('c-store').value];
      const p = DB.取商品()[+document.getElementById('c-prod').value];
      const price = +document.getElementById('c-price').value;
      const date = document.getElementById('c-date').value;
      if (!p || !price) { document.getElementById('c-preview').innerHTML = '選好商品與售價後即時預覽…'; return; }
      const r = 算單件(p, store, price, { 是否活動日: 是活動日(date, DB.取活動日()) });
      const cls = r.毛利 >= 0 ? 'good' : 'bad';
      document.getElementById('c-preview').innerHTML =
        `單件毛利 <b class="${cls}">${錢(r.毛利)}</b>（費率 ${百分(r.費率)}）`;
    };
    ['c-store','c-prod','c-price','c-date'].forEach(id => {
      document.getElementById(id).addEventListener('input', preview);
    });
    document.getElementById('c-add').addEventListener('click', () => {
      const p = DB.取商品()[+document.getElementById('c-prod').value];
      const price = +document.getElementById('c-price').value;
      const qty = +document.getElementById('c-qty').value || 1;
      if (!p) return alert('請先在「商品成本表」建立商品');
      if (!price) return alert('請輸入售價');
      this.cart.push({ 商品: p, 售價: price, 數量: qty,
        store: document.getElementById('c-store').value,
        date: document.getElementById('c-date').value });
      document.getElementById('c-price').value = '';
      document.getElementById('c-qty').value = '1';
      this.renderCart();
    });
    this.renderCart();
  },

  renderCart() {
    const body = document.getElementById('cart-body');
    const sum = document.getElementById('order-summary');
    if (!this.cart.length) {
      body.innerHTML = `<tr><td colspan="9" class="empty">還沒有品項，從上方加入。</td></tr>`;
      sum.innerHTML = ''; return;
    }
    // 以第一筆的賣場/日期作為整張訂單（同一訂單同賣場同日）
    const storeKey = this.cart[0].store, date = this.cart[0].date;
    const store = DB.取賣場()[storeKey];
    const 明細 = this.cart.map(c => ({ 商品: c.商品, 售價: c.售價, 數量: c.數量 }));
    const o = 算訂單(明細, store, { 是否活動日: 是活動日(date, DB.取活動日()) });

    body.innerHTML = o.列.map((r,i) => {
      const c = this.cart[i];
      const cls = r.件毛利 >= 0 ? 'good' : 'bad';
      const pill = c.商品.屬性 === '預購' ? '<span class="pill pre">預購</span>' : '<span class="pill stock">現貨</span>';
      return `<tr>
        <td>${c.商品.貨號}｜${c.商品.品名}</td>
        <td>${pill}</td>
        <td class="num">${錢(c.售價)}</td>
        <td class="num">×${r.數量}</td>
        <td class="num">${錢(r.件成本)}</td>
        <td class="num">${百分(r.費率)}</td>
        <td class="num">${錢(r.件手續費)}</td>
        <td class="num ${cls}"><b>${錢(r.件毛利)}</b></td>
        <td><button class="btn btn-sm btn-danger" data-del="${i}">刪</button></td>
      </tr>`;
    }).join('');
    body.querySelectorAll('[data-del]').forEach(b =>
      b.addEventListener('click', () => { this.cart.splice(+b.dataset.del,1); this.renderCart(); }));

    const mcls = o.訂單毛利 >= 0 ? 'good' : 'bad';
    const 活 = 是活動日(date, DB.取活動日());
    sum.innerHTML = `
      <div class="kpis" style="margin-top:16px">
        <div class="kpi"><div class="label">訂單總售價</div><div class="value">${錢(o.總售價)}</div>
          <div class="sub">${store.名稱}${活 ? '｜活動日 +2%' : ''}</div></div>
        <div class="kpi"><div class="label">總成本</div><div class="value">${錢(o.總成本)}</div></div>
        <div class="kpi"><div class="label">總手續費</div><div class="value">${錢(o.總手續費)}</div>
          <div class="sub">固定費 ${錢(o.固定費)}（每單一次）</div></div>
        <div class="kpi"><div class="label">訂單淨毛利</div><div class="value ${mcls}">${錢(o.訂單毛利)}</div>
          <div class="sub">小計 ${錢(o.小計毛利)} − 固定費 ${錢(o.固定費)}</div></div>
      </div>`;
  },

  /* ================= 採購批次（好運XXXX）================= */
  // 算一批的總金額（USD）與總進貨成本（NTD，含空運）
  batchTotals(batch) {
    const prods = DB.取商品();
    const find = h => prods.find(p => p.貨號 === h);
    let usd = 0, ntd = 0, 件數 = 0;
    batch.品項.forEach(it => {
      const p = find(it.貨號) || {};
      const 單價 = Number(it.單價USD) || Number(p.進貨USD) || 0;
      const qty = Number(it.數量) || 0;
      usd += 單價 * qty;
      ntd += (單價 * SPEC.匯率 + (Number(p.重量lb)||0) * SPEC.空運費_每磅) * qty;
      件數 += qty;
    });
    return { usd, ntd, 件數, 品項數: batch.品項.length };
  },

  renderPurchases() {
    const list = DB.取採購();
    const rows = list.slice().sort((a,b)=> (b.日期||'').localeCompare(a.日期||'')).map(b => {
      const t = this.batchTotals(b);
      return `<tr>
        <td><b>${b.名稱}</b></td>
        <td class="muted">${b.日期||''}</td>
        <td>${b.來源||''}</td>
        <td class="num">${t.品項數}</td>
        <td class="num">${t.件數}</td>
        <td class="num">$${t.usd.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
        <td class="num">${錢(t.ntd)}</td>
        <td><div class="row-actions">
          <button class="btn btn-sm" data-open="${b.id}">明細</button>
          <button class="btn btn-sm btn-danger" data-delb="${b.id}">刪</button>
        </div></td></tr>`;
    }).join('');
    const pend = DB.取待確認();
    const pendBanner = pend.length ? `
      <div class="hint" style="display:flex;align-items:center;gap:12px">
        <span style="font-size:18px">🔔</span>
        <div style="flex:1"><b>${pend.length} 筆採購待確認</b>　機器人讀到新的出貨信，核對後即可匯入。</div>
        <button class="btn btn-primary btn-sm" id="p-review">前往確認</button>
      </div>` : '';
    return `
      <div class="page-head"><h1>採購批次</h1>
        <p>每一週的進貨批次（對應舊表的「好運XXXX」）。點「明細」看這批買了什麼、各幾件、總成本。</p></div>
      ${pendBanner}
      <div class="card">
        <div class="toolbar"><div class="spacer"></div>
          ${Cloud.enabled() ? '<button class="btn" id="b-refresh">🔄 重新整理（收信）</button>' : ''}
          <button class="btn btn-primary" id="b-add">➕ 新增批次</button></div>
        <div class="table-wrap"><table>
          <thead><tr><th>批次</th><th>日期</th><th>來源訂單</th><th class="num">品項</th>
            <th class="num">總件數</th><th class="num">總金額USD</th><th class="num">總成本NTD</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="8" class="empty">還沒有採購批次</td></tr>`}</tbody>
        </table></div>
      </div>`;
  },
  afterPurchases() {
    const rev = document.getElementById('p-review');
    if (rev) rev.addEventListener('click', () => this.reviewPending(DB.取待確認()[0].id));
    const rf = document.getElementById('b-refresh');
    if (rf) rf.addEventListener('click', async () => {
      rf.textContent = '⏳ 收信中…';
      await Cloud.refresh(); this.updateCloudBadge(); this.go('purchases');
    });
    document.getElementById('b-add').addEventListener('click', () => this.editBatch(null));
    document.querySelectorAll('[data-open]').forEach(b =>
      b.addEventListener('click', () => this.batchDetail(b.dataset.open)));
    document.querySelectorAll('[data-delb]').forEach(b =>
      b.addEventListener('click', () => {
        if (!confirm('確定刪除此批次？')) return;
        DB.存採購(DB.取採購().filter(x => x.id !== b.dataset.delb));
        this.go('purchases');
      }));
  },

  // 批次明細（品項清單 + 加減品項）
  batchDetail(id) {
    const list = DB.取採購();
    const batch = list.find(b => b.id === id);
    if (!batch) return this.go('purchases');
    const prods = DB.取商品();
    const t = this.batchTotals(batch);
    const rows = batch.品項.map((it,i) => {
      const p = prods.find(x => x.貨號 === it.貨號) || { 品名:'（主檔找不到）' };
      const 單價 = Number(it.單價USD) || Number(p.進貨USD) || 0;
      return `<tr>
        <td><b>${it.貨號}</b></td><td>${p.品名}</td>
        <td class="num">${it.數量}</td>
        <td class="num">$${單價.toFixed(2)}</td>
        <td class="num">$${(單價*it.數量).toFixed(2)}</td>
        <td><button class="btn btn-sm btn-danger" data-rm="${i}">移除</button></td></tr>`;
    }).join('');
    const prodOpts = prods.map(p=>`<option value="${p.貨號}">${p.貨號}｜${p.品名}</option>`).join('');
    document.getElementById('content').innerHTML = `
      <div class="page-head"><h1>${batch.名稱}</h1>
        <p>${batch.日期||''}　${batch.來源||''}${batch.追蹤碼?'　追蹤 '+batch.追蹤碼:''}</p></div>
      <div class="kpis" style="margin-bottom:18px">
        <div class="kpi"><div class="label">品項數</div><div class="value">${t.品項數}</div></div>
        <div class="kpi"><div class="label">總件數</div><div class="value">${t.件數}</div></div>
        <div class="kpi"><div class="label">總金額 USD</div><div class="value">$${t.usd.toFixed(2)}</div></div>
        <div class="kpi"><div class="label">總成本 NTD</div><div class="value">${錢(t.ntd)}</div><div class="sub">含空運，匯率 ${SPEC.匯率}</div></div>
      </div>
      <div class="card">
        <h2>➕ 加入品項</h2>
        <div class="grid grid-3">
          <div class="field"><label>商品</label><select id="bi-prod">${prodOpts}</select></div>
          <div class="field"><label>數量</label><input id="bi-qty" type="number" min="1" value="1"></div>
          <div class="field"><label>單價USD（空白=用主檔成本）</label><input id="bi-price" type="number" min="0" placeholder="留空自動帶"></div>
        </div>
        <button class="btn btn-primary" id="bi-add">加入</button>
      </div>
      <div class="card">
        <h2>🧾 批次品項</h2>
        <div class="table-wrap"><table>
          <thead><tr><th>貨號</th><th>品名</th><th class="num">數量</th><th class="num">單價USD</th><th class="num">小計USD</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="6" class="empty">尚無品項</td></tr>`}</tbody>
        </table></div>
      </div>
      <div class="toolbar"><button class="btn" id="b-back">← 回批次列表</button></div>`;

    document.getElementById('b-back').addEventListener('click',()=>this.go('purchases'));
    document.getElementById('bi-add').addEventListener('click',()=>{
      const 貨號 = document.getElementById('bi-prod').value;
      const 數量 = +document.getElementById('bi-qty').value || 1;
      const priceRaw = document.getElementById('bi-price').value;
      batch.品項.push({ 貨號, 數量, 單價USD: priceRaw===''?0:(+priceRaw||0) });
      DB.存採購(list); this.batchDetail(id);
    });
    document.querySelectorAll('[data-rm]').forEach(b=>b.addEventListener('click',()=>{
      batch.品項.splice(+b.dataset.rm,1); DB.存採購(list); this.batchDetail(id);
    }));
  },

  // 新增/編輯批次基本資料
  editBatch(id) {
    const list = DB.取採購();
    const b = id ? list.find(x=>x.id===id) : { id:'b'+Date.now(), 名稱:'', 日期:new Date().toISOString().slice(0,10), 來源:'', 追蹤碼:'', 品項:[] };
    const g=(l,v,a)=>`<div class="field"><label>${l}</label><input id="nb-${a}" value="${v||''}"></div>`;
    document.getElementById('content').innerHTML = `
      <div class="page-head"><h1>${id?'編輯批次':'新增採購批次'}</h1></div>
      <div class="card" style="max-width:560px">
        ${g('批次名稱（如 好運0727）', b.名稱, '名稱')}
        <div class="field"><label>採購日期</label><input id="nb-日期" type="date" value="${b.日期||''}"></div>
        ${g('來源訂單（品牌／Order#）', b.來源, '來源')}
        ${g('追蹤碼（選填）', b.追蹤碼, '追蹤碼')}
        <div class="toolbar" style="margin-top:8px">
          <button class="btn btn-primary" id="nb-save">儲存</button>
          <button class="btn" id="nb-cancel">取消</button>
        </div>
      </div>`;
    document.getElementById('nb-cancel').addEventListener('click',()=>this.go('purchases'));
    document.getElementById('nb-save').addEventListener('click',()=>{
      const v=id2=>document.getElementById('nb-'+id2).value;
      const obj={ id:b.id, 名稱:v('名稱').trim(), 日期:v('日期'), 來源:v('來源').trim(), 追蹤碼:v('追蹤碼').trim(), 品項:b.品項||[] };
      if(!obj.名稱) return alert('請填批次名稱');
      if(id){ const i=list.findIndex(x=>x.id===id); list[i]=obj; } else list.push(obj);
      DB.存採購(list); this.batchDetail(obj.id);
    });
  },

  /* ---- 待確認採購：核對機器人讀到的信，對貨號後匯入 ---- */
  reviewPending(id) {
    const pend = DB.取待確認();
    const P = pend.find(x => x.id === id);
    if (!P) return this.go('purchases');
    const matched = matchLEItems(P, DB.取商品());
    const prods = DB.取商品();
    const opts = prods.map(p => `<option value="${p.貨號}">${p.貨號}｜${p.品名}</option>`).join('');

    const rows = matched.map((it, i) => {
      const 小計 = (it.單價USD * it.數量).toFixed(2);
      let 對應欄;
      if (it.已對應) {
        對應欄 = `<span class="pill stock">✅ ${it.貨號}</span>
          <input type="hidden" class="map" data-i="${i}" value="${it.貨號}">`;
      } else {
        對應欄 = `<select class="map" data-i="${i}" style="min-width:180px">
            <option value="">— 請選對應商品 —</option>
            ${opts}
            <option value="__new__">➕ 建立新商品（用信上資料）</option>
            <option value="__skip__">✖ 此項不匯入</option>
          </select>`;
      }
      return `<tr class="${it.已對應?'':'need-map'}">
        <td>${it.品名}</td>
        <td class="muted">${it.Item}</td>
        <td class="num">${it.數量}</td>
        <td class="num">$${it.單價USD.toFixed(2)}</td>
        <td class="num">$${小計}</td>
        <td>${對應欄}</td></tr>`;
    }).join('');

    const 未對應數 = matched.filter(x => !x.已對應).length;
    document.getElementById('content').innerHTML = `
      <div class="page-head"><h1>確認採購：${P.建議批次名}</h1>
        <p>機器人讀到的出貨信。核對品項、對好貨號後按「確認匯入」。對不到的請選一次（之後會記住）。</p></div>
      <div class="card">
        <div class="grid grid-4">
          <div class="field"><label>批次名稱</label><input id="rv-name" value="${P.建議批次名}"></div>
          <div class="field"><label>採購日期</label><input id="rv-date" type="date" value="${P.日期}"></div>
          <div class="field"><label>來源訂單</label><input id="rv-order" value="Life Extension｜Order# ${P.Order}"></div>
          <div class="field"><label>追蹤碼</label><input id="rv-track" value="${P.追蹤碼}"></div>
        </div>
      </div>
      ${未對應數 ? `<div class="hint">還有 <b>${未對應數}</b> 項對不到貨號（紅底列）。選「建立新商品」會用信上的品名＋Item#＋單價自動建檔。</div>` : ''}
      <div class="card">
        <h2>🧾 品項（共 ${matched.length} 項）</h2>
        <div class="table-wrap"><table>
          <thead><tr><th>LE 品名</th><th>Item#</th><th class="num">數量</th><th class="num">單價USD</th><th class="num">小計</th><th>對應你的貨號</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>
      <div class="toolbar">
        <button class="btn btn-primary" id="rv-confirm">✅ 確認匯入成採購批次</button>
        <button class="btn" id="rv-cancel">取消</button>
        <span class="spacer"></span>
        <button class="btn btn-danger" id="rv-discard">丟棄這封信</button>
      </div>`;

    // 「建立新商品」需要一個貨號：即時 prompt 一次，存回 select
    document.querySelectorAll('select.map').forEach(sel => {
      sel.addEventListener('change', () => {
        if (sel.value === '__new__') {
          const it = matched[+sel.dataset.i];
          const 貨號 = (prompt(`為「${it.品名}」設定你的貨號（例：LE123）：`) || '').trim();
          if (!貨號) { sel.value = ''; return; }
          sel.dataset.new貨號 = 貨號;
          // 動態加一個 option 顯示
          const o = document.createElement('option');
          o.value = '__new__'; o.textContent = `➕ 新商品：${貨號}`; o.selected = true;
          sel.appendChild(o);
        }
      });
    });

    document.getElementById('rv-cancel').addEventListener('click', () => this.go('purchases'));
    document.getElementById('rv-discard').addEventListener('click', () => {
      if (!confirm('丟棄這封信的待確認資料？')) return;
      DB.存待確認(DB.取待確認().filter(x => x.id !== id));
      this.go('purchases');
    });
    document.getElementById('rv-confirm').addEventListener('click', () => this.confirmPending(id, matched));
  },

  confirmPending(id, matched) {
    const P = DB.取待確認().find(x => x.id === id) || {};
    const 來源品牌 = P.來源 || '';
    const prods = DB.取商品();
    const byHao = {}; prods.forEach(p => byHao[p.貨號] = p);
    const 品項 = [];

    document.querySelectorAll('.map').forEach(el => {
      const it = matched[+el.dataset.i];
      let 貨號 = el.value;
      if (貨號 === '__skip__' || 貨號 === '') return; // 不匯入
      if (貨號 === '__new__') {
        貨號 = el.dataset.new貨號;
        if (!貨號) return;
        if (!byHao[貨號]) { // 建新商品，帶入信上的資料
          const np = { 貨號, 品名: it.品名, 品牌: 來源品牌, 進貨USD: Number(it.單價USD) || 0, 重量lb: 0, 屬性: '預購',
            LEItem: it.Item || '', 別名: it.品名 ? [it.品名] : [], 售價: 0 };
          prods.push(np); byHao[貨號] = np;
        }
      } else {
        // 對到既有商品：記住這次的對應鑰匙（料號＋來源品名），日後自動對上
        const p = byHao[貨號];
        if (p) {
          if (it.Item && !p.LEItem) p.LEItem = it.Item;
          if (it.品名 && it.品名 !== p.品名) { p.別名 = p.別名 || []; if (p.別名.indexOf(it.品名) < 0) p.別名.push(it.品名); }
          if (Number(it.單價USD) > 0) p.進貨USD = Number(it.單價USD); // 有金額才更新，避免出貨信的 0 蓋掉成本
        }
      }
      品項.push({ 貨號, 數量: it.數量, 單價USD: it.單價USD });
    });

    if (!品項.length) return alert('沒有任何品項被對應，無法匯入');

    DB.存商品(prods); // 先存主檔（新商品＋更新單價）

    const batch = {
      id: 'b' + Date.now(),
      名稱: document.getElementById('rv-name').value.trim() || '未命名批次',
      日期: document.getElementById('rv-date').value,
      來源: document.getElementById('rv-order').value.trim(),
      追蹤碼: document.getElementById('rv-track').value.trim(),
      品項,
    };
    const 採購 = DB.取採購(); 採購.push(batch); DB.存採購(採購);
    DB.存待確認(DB.取待確認().filter(x => x.id !== id));
    alert(`已匯入「${batch.名稱}」：${品項.length} 項。主檔已同步更新進貨單價。`);
    this.batchDetail(batch.id);
  },

  /* ================= 商品成本表 ================= */
  // 品牌篩選下拉的選項（依實際商品動態產生，含各品牌數量與未分類）
  _brandFilterOptions() {
    const list = DB.取商品();
    const counts = {};
    list.forEach(p => { const b = (p.品牌 || '').trim() || '（未分類）'; counts[b] = (counts[b]||0)+1; });
    const names = Object.keys(counts).sort((a,b) => a==='（未分類）'?1:b==='（未分類）'?-1:a.localeCompare(b));
    const opts = names.map(b => `<option value="${b}">${b}（${counts[b]}）</option>`).join('');
    return `<option value="">全部品牌（${list.length}）</option>${opts}`;
  },
  renderProducts() {
    return `
    <div class="page-head"><h1>商品成本表</h1>
      <p>所有品項的主檔（CC、愛屋 共用一份）。改成本只改這裡，兩個賣場同步。毛利以「平日、非活動日」計算；紅字＝賠錢。</p></div>
    <div class="hint">目前為示範資料：僅 NAC 有真實成本與售價，其餘待補。填了售價才會算毛利。</div>
    <div class="card">
      <div class="toolbar">
        <input class="search" id="p-search" placeholder="搜尋貨號或品名…">
        <select id="p-brand" class="search" style="max-width:200px;flex:0 0 auto">${this._brandFilterOptions()}</select>
        <div class="spacer"></div>
        <button class="btn btn-danger" id="p-delsel" disabled>🗑 刪除選取</button>
        <button class="btn btn-primary" id="p-add">➕ 新增商品</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th style="width:32px"><input type="checkbox" id="p-all" title="全選（目前顯示的）"></th>
          <th>貨號</th><th>品名</th>
          <th class="num">單件成本</th><th class="num">售價</th>
          <th class="num">CC 毛利</th><th class="num">愛屋 毛利</th><th></th>
        </tr></thead>
        <tbody id="p-body"></tbody>
      </table></div>
    </div>`;
  },
  afterProducts() {
    const draw = (kw='', brand='') => {
      const list = DB.取商品();
      const 賣場 = DB.取賣場();
      const body = document.getElementById('p-body');
      const rows = list.map((p,i)=>({p,i})).filter(({p}) =>
        (!kw || (p.貨號+p.品名).toLowerCase().includes(kw.toLowerCase())) &&
        (!brand || ((p.品牌||'').trim() || '（未分類）') === brand));
      if (!rows.length) { body.innerHTML = `<tr><td colspan="8" class="empty">找不到符合的商品</td></tr>`; updateSel(); return; }
      body.innerHTML = rows.map(({p,i}) => {
        const 空運費 = (Number(p.重量lb)||0)*SPEC.空運費_每磅;
        const 成本 = (Number(p.進貨USD)||0)*SPEC.匯率 + 空運費;
        const 售價 = Number(p.售價)||0;
        const marginCell = (storeKey) => {
          if (!售價) return '<td class="num"><span class="muted">—</span></td>';
          const m = 算單件(p, 賣場[storeKey], 售價, {}).毛利;
          const cls = m < 200 ? 'bad' : 'good'; // 毛利低於 200 反紅（含賠錢）
          return `<td class="num ${cls}"><b>${錢(m)}</b></td>`;
        };
        const brandTag = p.品牌 ? `<span class="brandtag">${p.品牌}</span> ` : '';
        return `<tr>
          <td><input type="checkbox" class="p-chk" data-i="${i}"></td>
          <td><b>${p.貨號}</b></td><td class="pname">${brandTag}${p.品名}</td>
          <td class="num">${錢(成本)}</td>
          <td class="num">${售價?錢(售價):'<span class="muted">—</span>'}</td>
          ${marginCell('CC')}${marginCell('愛屋')}
          <td><div class="row-actions">
            <button class="btn btn-sm" data-edit="${i}">編輯</button>
            <button class="btn btn-sm btn-danger" data-del="${i}">刪</button>
          </div></td></tr>`;
      }).join('');
      body.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click',()=>this.editProduct(+b.dataset.edit)));
      body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click',()=>{
        if (!confirm('確定刪除此商品？')) return;
        const l = DB.取商品(); l.splice(+b.dataset.del,1); DB.存商品(l); redraw();
      }));
      body.querySelectorAll('.p-chk').forEach(c => c.addEventListener('change', updateSel));
      if (allBox) allBox.checked = false;
      updateSel();
    };
    // 多選：更新「刪除選取」鈕的數量與可用狀態
    const updateSel = () => {
      const n = document.querySelectorAll('.p-chk:checked').length;
      if (delBtn) { delBtn.disabled = !n; delBtn.textContent = n ? `🗑 刪除選取（${n}）` : '🗑 刪除選取'; }
    };
    const search = document.getElementById('p-search');
    const brandSel = document.getElementById('p-brand');
    const allBox = document.getElementById('p-all');
    const delBtn = document.getElementById('p-delsel');
    const redraw = () => draw(search.value, brandSel.value);
    search.addEventListener('input', redraw);
    brandSel.addEventListener('change', redraw);
    // 全選：勾選目前顯示的所有列
    allBox.addEventListener('change', () => {
      document.querySelectorAll('.p-chk').forEach(c => c.checked = allBox.checked);
      updateSel();
    });
    // 刪除選取：一次刪掉所有勾選的（依索引由大到小刪，避免位移）
    delBtn.addEventListener('click', () => {
      const idxs = [...document.querySelectorAll('.p-chk:checked')].map(c => +c.dataset.i);
      if (!idxs.length) return;
      if (!confirm(`確定刪除選取的 ${idxs.length} 個商品？此動作無法復原。`)) return;
      const l = DB.取商品();
      idxs.sort((a,b) => b-a).forEach(i => l.splice(i,1));
      DB.存商品(l);
      redraw();
    });
    document.getElementById('p-add').addEventListener('click', () => this.editProduct(-1));
    // 還原上次的檢視（編輯商品後回來，保留搜尋字／品牌篩選／捲動位置）
    if (this._pView) {
      search.value = this._pView.kw || '';
      brandSel.value = this._pView.brand || '';
    }
    draw(search.value, brandSel.value);
    if (this._pView) { window.scrollTo(0, this._pView.scroll || 0); this._pView = null; }
  },
  editProduct(idx) {
    // 進編輯前記住目前清單的搜尋／篩選／捲動，儲存後回來才停在原處
    const _s = document.getElementById('p-search'), _b = document.getElementById('p-brand');
    if (_s && _b) this._pView = { kw: _s.value, brand: _b.value, scroll: window.scrollY };
    const list = DB.取商品();
    const p = idx>=0 ? list[idx] : { 貨號:'', 品名:'', 進貨USD:0, 重量lb:0, 屬性:'預購', 品牌:'', LEItem:'', 售價:0 };
    const g = (label,val,attr) => `<div class="field"><label>${label}</label><input id="e-${attr}" value="${val}"></div>`;
    // 品牌下拉：內建清單 + 目前值（若不在清單）+ 其他自訂
    const brandList = 品牌選項.slice();
    if (p.品牌 && brandList.indexOf(p.品牌) < 0) brandList.unshift(p.品牌);
    const brandOpts = brandList.map(b => `<option ${p.品牌===b?'selected':''}>${b}</option>`).join('');
    const html = `
      <div class="page-head"><h1>${idx>=0?'編輯商品':'新增商品'}</h1></div>
      <div class="card" style="max-width:560px">
        ${g('貨號', p.貨號, '貨號')}
        <div class="field"><label>品牌</label>
          <select id="e-品牌">
            <option value="">— 選擇品牌 —</option>
            ${brandOpts}
            <option value="__new__">➕ 其他（自訂）</option>
          </select></div>
        ${g('品名', p.品名, '品名')}
        <div class="grid grid-2">
          ${g('進貨成本 USD', p.進貨USD, '進貨USD')}
          ${g('重量 lb', p.重量lb, '重量lb')}
        </div>
        <div class="field"><label>屬性</label>
          <select id="e-屬性">
            <option ${p.屬性==='現貨'?'selected':''}>現貨</option>
            <option ${p.屬性==='預購'?'selected':''}>預購</option>
          </select></div>
        ${g('蝦皮售價 NT$（填了才算毛利，CC/愛屋 共用此售價）', p.售價||0, '售價')}
        ${g('LE Item#（選填）', p.LEItem||'', 'LEItem')}
        <div class="toolbar" style="margin-top:8px">
          <button class="btn btn-primary" id="e-save">儲存</button>
          <button class="btn" id="e-cancel">取消</button>
        </div>
      </div>`;
    document.getElementById('content').innerHTML = html;
    // 品牌選「其他」→ 即時輸入自訂品牌
    const brandSel = document.getElementById('e-品牌');
    brandSel.addEventListener('change', () => {
      if (brandSel.value === '__new__') {
        const nb = (prompt('輸入品牌名稱：') || '').trim();
        if (!nb) { brandSel.value = ''; return; }
        const o = document.createElement('option');
        o.value = nb; o.textContent = nb; o.selected = true;
        brandSel.insertBefore(o, brandSel.firstChild);
      }
    });
    document.getElementById('e-cancel').addEventListener('click',()=>this.go('products'));
    document.getElementById('e-save').addEventListener('click',()=>{
      const v = id => document.getElementById('e-'+id).value;
      const 品牌 = brandSel.value === '__new__' ? '' : brandSel.value;
      const obj = { 貨號:v('貨號').trim(), 品名:v('品名').trim(), 品牌,
        進貨USD:+v('進貨USD')||0, 重量lb:+v('重量lb')||0, 屬性:v('屬性'),
        售價:+v('售價')||0, LEItem:v('LEItem').trim(), 別名:(idx>=0?(list[idx].別名||[]):[]) };
      if (!obj.貨號 || !obj.品名) return alert('貨號與品名必填');
      const l = DB.取商品();
      if (idx>=0) l[idx]=obj; else l.push(obj);
      DB.存商品(l); this.go('products');
    });
  },

  /* ================= 賣場設定 ================= */
  renderStores() {
    const 賣場 = DB.取賣場();
    const cards = Object.keys(賣場).map(k => {
      const s = 賣場[k];
      if (s.類型 === '簡易') {
        return `<div class="card">
          <h2>🏪 ${s.名稱} <span class="brandtag">簡易</span></h2>
          <div class="grid grid-2">
            <div class="field"><label>手續費率（例 0.03＝3%；不收填 0）</label><input id="s-${k}-手續費率" type="number" step="0.001" value="${s.手續費率||0}"></div>
            <div class="field"><label>每筆固定費（NT$）</label><input id="s-${k}-固定費" type="number" value="${s.固定費||0}"></div>
          </div>
          <div class="muted">毛利 = 售價 − 成本 − 售價×手續費率 − 固定費（不套蝦皮那套費用、無預購/活動日加成）</div>
        </div>`;
      }
      const base = 基礎手續費率(s);
      return `<div class="card">
        <h2>🏪 ${s.名稱}</h2>
        <div class="grid grid-2">
          <div class="field"><label>基本服務費</label><input id="s-${k}-基本" type="number" step="0.001" value="${s.基本}"></div>
          <div class="field"><label>金流與系統</label><input id="s-${k}-金流" type="number" step="0.001" value="${s.金流}"></div>
          <div class="field"><label>營業稅</label><input id="s-${k}-稅" type="number" step="0.001" value="${s.稅}"></div>
          <div class="field"><label>每筆固定費（NT$）</label><input id="s-${k}-固定費" type="number" value="${s.固定費}"></div>
        </div>
        <div class="muted">基礎手續費率 = 基本+金流+稅 = <b>${百分(base)}</b>（另：預購 +3%、活動日 +2%）</div>
      </div>`;
    }).join('');
    return `
      <div class="page-head"><h1>賣場設定</h1><p>兩個賣場的費率參數。用小數輸入，例如 6% 填 0.06。</p></div>
      ${cards}
      <div class="card">
        <div class="muted">共用參數：美金匯率 <b>${SPEC.匯率}</b>、空運費 <b>${錢(SPEC.空運費_每磅)}/磅</b>、預購加成 <b>+3%</b>、活動日加成 <b>+2%</b>（活動日共 ${DB.取活動日().length} 天）</div>
      </div>
      <div class="toolbar"><button class="btn btn-primary" id="s-save">儲存設定</button></div>`;
  },
  afterStores() {
    document.getElementById('s-save').addEventListener('click',()=>{
      const 賣場 = DB.取賣場();
      Object.keys(賣場).forEach(k=>{
        const fields = 賣場[k].類型 === '簡易' ? ['手續費率','固定費'] : ['基本','金流','稅','固定費'];
        fields.forEach(f=>{
          const el = document.getElementById(`s-${k}-${f}`);
          if (el) 賣場[k][f] = +el.value || 0;
        });
      });
      DB.存賣場(賣場); alert('已儲存'); this.go('stores');
    });
  },

  /* ================= 資料（匯出/匯入/重置） ================= */
  renderData() {
    const url = Cloud.url;
    return `
      <div class="page-head"><h1>資料 / 雲端同步</h1><p>設定雲端後，手機、電腦、國外都會看到同一份資料。沒設定時資料只存在這台裝置。</p></div>
      <div class="card">
        <h2>☁️ 雲端同步</h2>
        <p class="muted" style="margin-bottom:10px">貼上你的 Google Apps Script 網址（安裝步驟見「雲端同步_安裝說明.md」）。設定後任何裝置貼同一組網址即可同步。</p>
        <div class="field"><label>雲端網址（Apps Script Web App URL）</label>
          <input id="cloud-url" value="${url}" placeholder="https://script.google.com/macros/s/.../exec"></div>
        <div class="toolbar">
          <button class="btn btn-primary" id="cloud-save">儲存並連線</button>
          <button class="btn" id="cloud-test">測試連線</button>
          <button class="btn btn-danger" id="cloud-off">關閉雲端</button>
          <span class="spacer"></span>
          <span class="muted" id="cloud-state"></span>
        </div>
      </div>
      ${typeof CC商品目錄 !== 'undefined' ? `
      <div class="card">
        <h2>📥 匯入 CC 商品目錄</h2>
        <p class="muted" style="margin-bottom:10px">從「商品成本-CC」試算表一次帶進 <b>${CC商品目錄.length}</b> 個品項（貨號／品名／進貨USD／售價／重量／品牌）。<b>以貨號為鍵合併，不會覆蓋你已有的商品</b>，只補進缺的。缺的資料（成本、售價等）可日後手動補。</p>
        <p class="muted" style="margin-bottom:10px">⚠️ 若有用雲端，請先確認左下角已顯示「☁️ 已連線」再匯入，匯入後會自動同步回雲端。</p>
        <div class="toolbar"><button class="btn btn-primary" id="d-catalog">匯入 CC 商品目錄</button></div>
      </div>` : ''}
      <div class="card">
        <h2>⬇️ 匯出備份</h2>
        <p class="muted" style="margin-bottom:10px">把所有商品與設定存成一段文字，貼到別的裝置匯入。</p>
        <textarea id="d-out" style="width:100%;height:160px;font-family:monospace;font-size:12px" readonly></textarea>
        <div class="toolbar" style="margin-top:10px"><button class="btn" id="d-copy">複製</button></div>
      </div>
      <div class="card">
        <h2>⬆️ 匯入 / 還原</h2>
        <textarea id="d-in" style="width:100%;height:120px;font-family:monospace;font-size:12px" placeholder="貼上備份文字…"></textarea>
        <div class="toolbar" style="margin-top:10px">
          <button class="btn btn-primary" id="d-import">匯入</button>
          <button class="btn btn-danger" id="d-reset">全部重置為預設</button>
        </div>
      </div>`;
  },
  afterData() {
    const state = document.getElementById('cloud-state');
    document.getElementById('cloud-save').addEventListener('click', async () => {
      Cloud.url = document.getElementById('cloud-url').value;
      if (!Cloud.enabled()) { state.textContent = '請先填網址'; return; }
      state.textContent = '連線中…';
      await Cloud.syncIn(); this.updateCloudBadge();
      state.textContent = Cloud.status === 'ok' ? '✅ 已連線並同步' : '⚠️ 連線失敗，請確認網址';
      if (Cloud.status === 'ok') this.go('calc');
    });
    document.getElementById('cloud-test').addEventListener('click', async () => {
      const u = document.getElementById('cloud-url').value.trim();
      if (!u) { state.textContent = '請先填網址'; return; }
      state.textContent = '測試中…';
      state.textContent = (await Cloud.test(u)) ? '✅ 連線成功' : '⚠️ 連不上，請確認網址與部署權限';
    });
    document.getElementById('cloud-off').addEventListener('click', () => {
      Cloud.url = ''; Cloud.status = 'off'; this.updateCloudBadge();
      state.textContent = '已關閉雲端，改用本機資料';
    });
    const catBtn = document.getElementById('d-catalog');
    if (catBtn) catBtn.addEventListener('click', () => {
      if (typeof CC商品目錄 === 'undefined') { alert('目錄檔未載入，請重新整理頁面'); return; }
      const list = DB.取商品();
      // 只跟「現有商品」比對去重（凍結快照）：既有的保留，表內不同品項全帶進來。
      // 用貨號＋品名雙鍵，避免重複點擊時重覆匯入。
      const codes = new Set(list.map(p => p.貨號).filter(Boolean));
      const names = new Set(list.map(p => (p.品名 || '').trim()));
      let added = 0, skipped = 0;
      CC商品目錄.forEach(c => {
        const dup = (c.貨號 && codes.has(c.貨號)) || names.has((c.品名 || '').trim());
        if (dup) { skipped++; return; }
        list.push({ 貨號: c.貨號 || '', 品名: c.品名, 進貨USD: c.進貨USD || 0,
          重量lb: c.重量lb || 0, 屬性: c.屬性 || '預購', 品牌: c.品牌 || '',
          售價: c.售價 || 0, 別名: [] });
        added++;
      });
      if (!confirm(`將新增 ${added} 個商品（略過已存在 ${skipped} 個）。確定匯入？`)) return;
      DB.存商品(list);
      alert(`✅ 匯入完成：新增 ${added} 項，略過已存在 ${skipped} 項。` +
            (Cloud.enabled() ? '\n已同步回雲端。' : '\n（目前未連雲端，資料存在本機）'));
      this.go('products');
    });
    document.getElementById('d-out').value = DB.匯出();
    document.getElementById('d-copy').addEventListener('click',()=>{
      navigator.clipboard.writeText(DB.匯出()).then(()=>alert('已複製'));
    });
    document.getElementById('d-import').addEventListener('click',()=>{
      try { DB.匯入(document.getElementById('d-in').value); alert('匯入成功'); this.go('calc'); }
      catch(e){ alert('格式錯誤，無法匯入'); }
    });
    document.getElementById('d-reset').addEventListener('click',()=>{
      if (!confirm('確定清空並還原成預設資料？此動作無法復原。')) return;
      DB.重置(); alert('已重置'); this.go('calc');
    });
  },
};

document.addEventListener('DOMContentLoaded', () => App.start());
