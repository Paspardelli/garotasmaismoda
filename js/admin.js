/* =========================================================
   Garota Mais — painel administrativo (admin/index.html)
   Resumo, pedidos, produtos (estoque por tamanho + fotos),
   categorias e ajustes da loja.
   ========================================================= */
(function () {
  'use strict';

  const GM = window.GM;
  const { brl, esc } = GM;
  const STATUS = GM.ORDER_STATUS;
  const PAID = GM.PAID_STATUSES;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const NAV = [
    ['resumo', 'Resumo', '📊'],
    ['pedidos', 'Pedidos', '🧾'],
    ['produtos', 'Produtos', '👗'],
    ['categorias', 'Categorias', '🏷️'],
    ['ajustes', 'Ajustes', '⚙️']
  ];
  const S = { view: 'resumo', products: [], cats: [], orders: [], settings: {}, oFilter: 'todos', oQ: '', pQ: '' };

  /* ---------- helpers ---------- */
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }
  const fmtDate = iso => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const badge = s => `<span class="badge b-${esc(s)}">${esc(STATUS[s] || s)}</span>`;
  const catName = slug => (S.cats.find(c => c.slug === slug) || {}).name || 'Sem categoria';
  const digits = s => String(s || '').replace(/\D/g, '');
  function waUrl(phone, text) {
    let d = digits(phone);
    if (d.length <= 11) d = '55' + d;
    return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
  }
  function parseMoney(v) {
    let s = String(v || '').trim();
    if (!s) return NaN;
    s = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
    return Number(s);
  }
  const moneyInput = n => (n == null || n === '' ? '' : String(n).replace('.', ','));
  const stockSummary = p => {
    const t = GM.totalStock(p);
    if (t === 0) return '<span class="low">Esgotado</span>';
    const txt = GM.sizesOf(p).map(s => `${esc(s)}:${Number(p.stock[s]) || 0}`).join(' · ');
    return t <= 2 ? `<span class="low">${txt}</span>` : txt;
  };
  const toPrepare = () => S.orders.filter(o => ['pago', 'em_separacao'].includes(o.status));

  /* ---------- folha (modal) ---------- */
  function openSheet(html) {
    $('#sheetBox').innerHTML = html;
    $('#sheet').classList.add('open');
    $('#sheet').setAttribute('aria-hidden', 'false');
    $('#sheetBox').scrollTop = 0;
  }
  function closeSheet() {
    $('#sheet').classList.remove('open');
    $('#sheet').setAttribute('aria-hidden', 'true');
  }

  /* ---------- carregamento ---------- */
  async function loadAll() {
    const [products, cats, orders, settings] = await Promise.all([
      GM.admin.products(), GM.admin.categories(), GM.admin.orders(), GM.admin.settings()
    ]);
    Object.assign(S, { products, cats, orders, settings });
  }
  function updateBadges() {
    const n = toPrepare().length;
    $$('.dot').forEach(d => d.remove());
    if (!n) return;
    $$('[data-view="pedidos"]').forEach(b => b.insertAdjacentHTML('beforeend', `<i class="dot">${n}</i>`));
  }
  async function refresh() {
    $('#view').innerHTML = '<div class="loading">Carregando…</div>';
    try {
      await loadAll();
    } catch (err) {
      if (/Sess[aã]o/i.test(err.message)) { showLogin(); return; }
      $('#view').innerHTML = `<div class="panel"><p class="err">${esc(err.message)}</p></div>`;
      return;
    }
    updateBadges();
    render();
  }

  /* ---------- navegação ---------- */
  function buildNav() {
    $('#sideNav').innerHTML = NAV.map(n => `<button data-view="${n[0]}"><span>${n[2]}</span>${n[1]}</button>`).join('');
    $('#bottomNav').innerHTML = NAV.map(n => `<button data-view="${n[0]}"><span>${n[2]}</span>${n[1]}</button>`).join('');
  }
  function go(view) {
    S.view = view;
    $$('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === view));
    $('#viewTitle').textContent = NAV.find(n => n[0] === view)[1];
    render();
    window.scrollTo(0, 0);
  }
  function render() {
    $$('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === S.view));
    $('#viewTitle').textContent = NAV.find(n => n[0] === S.view)[1];
    ({ resumo: viewResumo, pedidos: viewPedidos, produtos: viewProdutos, categorias: viewCategorias, ajustes: viewAjustes })[S.view]();
  }

  /* =========================================================
     RESUMO
     ========================================================= */
  function viewResumo() {
    const now = new Date();
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const month = new Date(now.getFullYear(), now.getMonth(), 1);
    const paid = S.orders.filter(o => PAID.includes(o.status));
    const sum = arr => arr.reduce((s, o) => s + Number(o.total), 0);
    const today = paid.filter(o => new Date(o.created_at) >= day);
    const inMonth = paid.filter(o => new Date(o.created_at) >= month);
    const awaiting = S.orders.filter(o => o.status === 'aguardando_pagamento').length;
    const low = S.products.filter(p => p.active && GM.totalStock(p) <= 2)
      .sort((a, b) => GM.totalStock(a) - GM.totalStock(b)).slice(0, 8);
    const recent = S.orders.slice(0, 5);

    $('#view').innerHTML = `
      <div class="cards">
        <div class="stat"><small>Vendas hoje</small><strong>${brl(sum(today))}</strong><small>${today.length} pedido(s)</small></div>
        <div class="stat"><small>Vendas no mês</small><strong>${brl(sum(inMonth))}</strong><small>${inMonth.length} pedido(s)</small></div>
        <button class="stat stat--click" data-go="pedidos" data-ofilter="pago"><small>Para preparar</small><strong>${toPrepare().length}</strong><small>pagos, aguardando você</small></button>
        <button class="stat stat--click" data-go="pedidos" data-ofilter="aguardando_pagamento"><small>Aguardando pagamento</small><strong>${awaiting}</strong><small>ainda não pagaram</small></button>
      </div>

      <div class="panel">
        <h2>Últimos pedidos</h2>
        ${recent.length ? recent.map(orderRowHtml).join('') : '<p class="empty">Nenhum pedido ainda.</p>'}
      </div>

      <div class="panel">
        <h2>Estoque baixo (2 ou menos)</h2>
        ${low.length ? low.map(p => `<button class="row-card" data-edit="${esc(p.id)}"><span><b>${esc(p.name)}</b><br><small>${stockSummary(p)}</small></span><span class="tot">Editar</span></button>`).join('') : '<p class="empty">Tudo certo com o estoque.</p>'}
      </div>`;
  }

  function orderRowHtml(o) {
    return `<button class="row-card" data-order="${esc(o.id)}">
      <span><b>${esc(o.customer_name)}</b><br><small>${esc(o.code)} · ${fmtDate(o.created_at)}</small></span>
      <span class="tot">${brl(o.total)}<br>${badge(o.status)}</span></button>`;
  }

  /* =========================================================
     PEDIDOS
     ========================================================= */
  function viewPedidos() {
    const counts = {};
    S.orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
    const chips = [['todos', 'Todos', S.orders.length], ...Object.keys(STATUS).map(k => [k, STATUS[k], counts[k] || 0])];
    $('#view').innerHTML = `
      <div class="chips">${chips.map(c => `<button class="chip ${S.oFilter === c[0] ? 'on' : ''}" data-ofilter="${c[0]}">${esc(c[1])} (${c[2]})</button>`).join('')}</div>
      <div class="toolbar"><input type="search" id="oSearch" placeholder="Buscar por nome, código ou telefone" value="${esc(S.oQ)}"></div>
      <div class="list" id="oList"></div>`;
    renderOList();
    $('#oSearch').addEventListener('input', e => { S.oQ = e.target.value; renderOList(); });
  }
  function renderOList() {
    const q = S.oQ.trim().toLowerCase();
    const list = S.orders.filter(o => {
      if (S.oFilter !== 'todos' && o.status !== S.oFilter) return false;
      if (!q) return true;
      return o.customer_name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q) || digits(o.phone).includes(digits(q) || '§');
    });
    $('#oList').innerHTML = list.length ? list.map(orderRowHtml).join('') : '<p class="empty">Nenhum pedido encontrado.</p>';
  }

  function nextStatus(o) {
    return ({ pago: 'em_separacao', em_separacao: o.delivery_type === 'retirada' ? 'pronto_retirada' : 'enviado', pronto_retirada: 'entregue', enviado: 'entregue' })[o.status] || null;
  }

  async function adjustStock(o, sign) {
    const fresh = await GM.admin.products();
    for (const it of o.items) {
      const p = fresh.find(x => x.id === it.id);
      if (!p) continue;
      const cur = Number(p.stock[it.size]) || 0;
      p.stock[it.size] = Math.max(0, cur + sign * it.qty);
      await GM.admin.saveProduct(p);
    }
  }

  async function changeStatus(o, status) {
    if (status === o.status) return false;
    const patch = { status };
    if (PAID.includes(status) && o.status === 'aguardando_pagamento' && !o.stock_applied) {
      if (!confirm('Marcar como pago e dar baixa no estoque das peças?')) return false;
      await adjustStock(o, -1);
      patch.stock_applied = true;
    }
    if (status === 'cancelado' && o.stock_applied) {
      if (confirm('Devolver as peças ao estoque?')) { await adjustStock(o, +1); patch.stock_applied = false; }
    }
    await GM.admin.updateOrder(o.id, patch);
    Object.assign(o, patch);
    return true;
  }

  function openOrder(id) {
    const o = S.orders.find(x => x.id === id);
    if (!o) return;
    const a = o.address;
    const where = o.delivery_type === 'retirada'
      ? 'Retirada na loja'
      : (a ? `${esc(a.street)}, ${esc(a.number)}${a.complement ? ' - ' + esc(a.complement) : ''}<br>${esc(a.district)} · ${esc(a.city)}/${esc(a.state)} · CEP ${esc(a.cep)}` : '—');
    const first = o.customer_name.split(' ')[0];
    const next = nextStatus(o);
    const msg = o.status === 'pronto_retirada'
      ? `Olá, ${first}! Seu pedido ${o.code} está pronto para retirada na Garota Mais. 💗`
      : `Olá, ${first}! Aqui é da Garota Mais, sobre o seu pedido ${o.code}.`;

    openSheet(`
      <div class="sheet__head"><h2>${esc(o.code)}</h2><button class="x" data-close aria-label="Fechar">✕</button></div>
      <p style="margin-bottom:1rem">${badge(o.status)} <small style="color:var(--muted)">${fmtDate(o.created_at)} · pagamento: ${esc(o.payment_status)}</small></p>

      <div class="kv"><b>Cliente</b><span>${esc(o.customer_name)}</span></div>
      <div class="kv"><b>Contato</b><span>${esc(o.phone)} · <a href="mailto:${esc(o.email)}">${esc(o.email)}</a></span></div>
      <div class="kv"><b>${o.delivery_type === 'retirada' ? 'Entrega' : 'Endereço'}</b><span>${where}</span></div>
      ${o.notes ? `<div class="kv"><b>Observações</b><span>${esc(o.notes)}</span></div>` : ''}

      <div class="kv"><b>Itens</b></div>
      ${o.items.map(i => `<div class="oitem"><span>${i.qty}x ${esc(i.name)} <small style="color:var(--muted)">(Tam. ${esc(i.size)})</small></span><span>${brl(i.price * i.qty)}</span></div>`).join('')}
      <div class="otot"><span>Subtotal</span><span>${brl(o.subtotal)}</span></div>
      <div class="otot"><span>Frete</span><span>${brl(o.shipping)}</span></div>
      <div class="otot final"><span>Total</span><span>${brl(o.total)}</span></div>

      <div class="form" style="margin-top:1.2rem">
        <label>Status do pedido
          <select id="oStatus">${Object.keys(STATUS).map(k => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${esc(STATUS[k])}</option>`).join('')}</select>
        </label>
      </div>
      <div class="sheet__foot">
        ${next ? `<button class="btn" id="oNext">Avançar: ${esc(STATUS[next])}</button>` : ''}
        <button class="btn btn--ghost" id="oSave">Salvar status</button>
        <a class="btn btn--wa" target="_blank" rel="noopener" href="${waUrl(o.phone, msg)}">WhatsApp da cliente</a>
      </div>`);

    const apply = async status => {
      try {
        const changed = await changeStatus(o, status);
        if (!changed) return;
        toast('Pedido atualizado');
        closeSheet();
        await loadAll();
        updateBadges();
        render();
      } catch (err) { toast(err.message); }
    };
    $('#oSave').addEventListener('click', () => apply($('#oStatus').value));
    const nb = $('#oNext');
    if (nb) nb.addEventListener('click', () => apply(next));
  }

  /* =========================================================
     PRODUTOS
     ========================================================= */
  function viewProdutos() {
    $('#view').innerHTML = `
      <div class="toolbar">
        <input type="search" id="pSearch" placeholder="Buscar produto" value="${esc(S.pQ)}">
        <button class="btn" data-newprod>+ Novo produto</button>
      </div>
      <div class="list" id="pList"></div>`;
    renderPList();
    $('#pSearch').addEventListener('input', e => { S.pQ = e.target.value; renderPList(); });
  }
  function renderPList() {
    const q = S.pQ.trim().toLowerCase();
    const list = S.products.filter(p => !q || p.name.toLowerCase().includes(q) || catName(p.category_slug).toLowerCase().includes(q));
    $('#pList').innerHTML = list.length ? list.map(p => `
      <div class="prod">
        <button class="prod__main" data-edit="${esc(p.id)}">
          <span class="prod__img">${p.images[0] ? `<img src="${esc(p.images[0])}" alt="" loading="lazy">` : ''}</span>
          <span>
            <span class="prod__name">${esc(p.name)}</span><br>
            <span class="prod__meta">${esc(catName(p.category_slug))} · ${stockSummary(p)}</span><br>
            <span class="prod__price">${brl(p.price)}${p.old_price ? `<s>${brl(p.old_price)}</s>` : ''}</span>
          </span>
        </button>
        <label class="switch" title="Ativo na loja"><input type="checkbox" data-toggle="${esc(p.id)}" ${p.active ? 'checked' : ''}><i></i></label>
      </div>`).join('') : '<p class="empty">Nenhum produto. Toque em “+ Novo produto”.</p>';
  }

  function openProduct(id) {
    const p = id ? S.products.find(x => x.id === id) : null;
    const F = { images: p ? [...p.images] : [] };
    const stock = p ? p.stock : {};

    openSheet(`
      <div class="sheet__head"><h2>${p ? 'Editar produto' : 'Novo produto'}</h2><button class="x" data-close aria-label="Fechar">✕</button></div>
      <form class="form" id="pForm" novalidate>
        <label>Nome
          <input type="text" id="pName" value="${esc(p ? p.name : '')}" placeholder="Ex.: Vestido Midi Rosé" required>
        </label>
        <label>Descrição
          <textarea id="pDesc" rows="3" placeholder="Tecido, caimento, medidas…">${esc(p ? p.description : '')}</textarea>
        </label>
        <label>Categoria
          <select id="pCat">
            <option value="">Sem categoria</option>
            ${S.cats.map(c => `<option value="${esc(c.slug)}" ${p && p.category_slug === c.slug ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
        </label>
        <div class="grid2">
          <label>Preço (R$)<input type="text" id="pPrice" inputmode="decimal" value="${moneyInput(p ? p.price : '')}" placeholder="189,90"></label>
          <label>Preço antigo <small>(opcional)</small><input type="text" id="pOld" inputmode="decimal" value="${moneyInput(p ? p.old_price : '')}" placeholder="379,80"></label>
        </div>
        <fieldset>
          <legend>Estoque por tamanho</legend>
          <p class="hint">Deixe em branco os tamanhos que a peça não tem. Zero = esgotado.</p>
          <div class="sizes-grid">
            ${GM.SIZE_ORDER.map(s => `<label><span>${esc(s)}</span><input type="number" min="0" inputmode="numeric" data-size="${esc(s)}" value="${stock[s] != null ? Number(stock[s]) : ''}"></label>`).join('')}
          </div>
        </fieldset>
        <div>
          <div class="lbl">Fotos <span class="hint">(a primeira é a capa)</span></div>
          <div class="photos" id="pPhotos"></div>
          <input type="file" id="pFile" accept="image/*" multiple hidden>
          <button type="button" class="btn btn--ghost btn--sm" id="pAddPhoto">+ Adicionar fotos</button>
        </div>
        <div class="toggles">
          <label class="toggle">Ativo na loja <span class="switch"><input type="checkbox" id="pActive" ${!p || p.active ? 'checked' : ''}><i></i></span></label>
          <label class="toggle">Destaque (aparece primeiro) <span class="switch"><input type="checkbox" id="pFeat" ${p && p.featured ? 'checked' : ''}><i></i></span></label>
          <label class="toggle">Selo “Novo” <span class="switch"><input type="checkbox" id="pNew" ${p && p.is_new ? 'checked' : ''}><i></i></span></label>
        </div>
        <div class="sheet__foot">
          <button type="submit" class="btn" id="pSave">Salvar</button>
          ${p ? '<button type="button" class="btn btn--danger" id="pDelete">Excluir</button>' : ''}
        </div>
      </form>`);

    const renderPhotos = () => {
      $('#pPhotos').innerHTML = F.images.map((src, i) => `
        <div class="ph">
          <img src="${esc(src)}" alt="">
          ${i === 0 ? '<em>Capa</em>' : ''}
          <div class="ph__act">
            ${i > 0 ? `<button type="button" data-ph="left" data-i="${i}" aria-label="Mover">←</button>` : '<span style="width:50%"></span>'}
            <button type="button" data-ph="del" data-i="${i}" aria-label="Remover">✕</button>
          </div>
        </div>`).join('');
    };
    renderPhotos();

    $('#pPhotos').addEventListener('click', e => {
      const b = e.target.closest('[data-ph]');
      if (!b) return;
      const i = +b.dataset.i;
      if (b.dataset.ph === 'del') F.images.splice(i, 1);
      if (b.dataset.ph === 'left' && i > 0) [F.images[i - 1], F.images[i]] = [F.images[i], F.images[i - 1]];
      renderPhotos();
    });
    $('#pAddPhoto').addEventListener('click', () => $('#pFile').click());
    $('#pFile').addEventListener('change', async e => {
      const files = [...e.target.files];
      e.target.value = '';
      const btn = $('#pAddPhoto');
      for (let i = 0; i < files.length; i++) {
        btn.disabled = true;
        btn.textContent = `Enviando ${i + 1}/${files.length}…`;
        try { F.images.push(await GM.uploadImage(files[i])); renderPhotos(); }
        catch (err) { toast(err.message); }
      }
      btn.disabled = false;
      btn.textContent = '+ Adicionar fotos';
    });

    $('#pForm').addEventListener('submit', async e => {
      e.preventDefault();
      const name = $('#pName').value.trim();
      const price = parseMoney($('#pPrice').value);
      const old = parseMoney($('#pOld').value);
      if (!name) return toast('Informe o nome do produto.');
      if (!(price > 0)) return toast('Informe um preço válido.');
      if (!isNaN(old) && old <= price) return toast('O preço antigo deve ser maior que o preço.');
      const st = {};
      $$('[data-size]').forEach(inp => {
        if (inp.value !== '') st[inp.dataset.size] = Math.max(0, parseInt(inp.value, 10) || 0);
      });
      if (!Object.keys(st).length) return toast('Informe o estoque de pelo menos um tamanho.');

      const btn = $('#pSave');
      btn.disabled = true; btn.textContent = 'Salvando…';
      try {
        await GM.admin.saveProduct({
          id: p ? p.id : undefined, name,
          description: $('#pDesc').value.trim(),
          category_slug: $('#pCat').value || null,
          price, old_price: isNaN(old) ? null : old,
          images: F.images, stock: st,
          active: $('#pActive').checked, featured: $('#pFeat').checked, is_new: $('#pNew').checked
        });
        toast('Produto salvo');
        closeSheet();
        await loadAll();
        updateBadges();
        render();
      } catch (err) {
        toast(err.message);
        btn.disabled = false; btn.textContent = 'Salvar';
      }
    });

    const del = $('#pDelete');
    if (del) del.addEventListener('click', async () => {
      if (!confirm('Excluir este produto? Os pedidos antigos continuam salvos.')) return;
      try {
        await GM.admin.deleteProduct(p.id);
        toast('Produto excluído');
        closeSheet();
        await loadAll();
        render();
      } catch (err) { toast(err.message); }
    });
  }

  /* =========================================================
     CATEGORIAS
     ========================================================= */
  function viewCategorias() {
    $('#view').innerHTML = `
      <form class="toolbar" id="cForm">
        <input type="search" id="cName" placeholder="Nova categoria (ex.: Moda Praia)" required>
        <button class="btn" type="submit">Adicionar</button>
      </form>
      <div class="list">
        ${S.cats.map(c => {
          const n = S.products.filter(p => p.category_slug === c.slug).length;
          return `<div class="row-card"><span><b>${esc(c.name)}</b><br><small>${n} produto(s)</small></span>
            <span><button class="btn btn--sm btn--ghost" data-catren="${esc(c.id)}">Renomear</button>
            <button class="btn btn--sm btn--danger" data-catdel="${esc(c.id)}">Excluir</button></span></div>`;
        }).join('') || '<p class="empty">Nenhuma categoria.</p>'}
      </div>`;
    $('#cForm').addEventListener('submit', async e => {
      e.preventDefault();
      const name = $('#cName').value.trim();
      if (!name) return;
      try { await GM.admin.saveCategory({ name }); toast('Categoria criada'); await loadAll(); render(); }
      catch (err) { toast(err.message.includes('duplicate') ? 'Essa categoria já existe.' : err.message); }
    });
  }

  /* =========================================================
     AJUSTES
     ========================================================= */
  function viewAjustes() {
    const s = S.settings;
    $('#view').innerHTML = `
      <form class="panel form" id="sForm">
        <h2>Loja</h2>
        <label>WhatsApp da loja <small>(com DDD, só números)</small>
          <input type="tel" id="sWhats" inputmode="numeric" value="${esc(s.whatsapp || '')}" placeholder="5519999999999">
        </label>
        <label>Link do Grupo VIP do WhatsApp
          <input type="text" id="sVip" value="${esc(s.vip_link || '')}" placeholder="https://chat.whatsapp.com/…">
        </label>
        <label>Texto da barra do topo
          <input type="text" id="sTop" value="${esc(s.topbar_text || '')}">
        </label>
        <label>Endereço para retirada
          <input type="text" id="sPickup" value="${esc(s.pickup_address || '')}">
        </label>
        <h2 style="margin-top:.6rem">Frete</h2>
        <div class="grid2">
          <label>Valor do frete (R$)<input type="text" id="sFee" inputmode="decimal" value="${moneyInput(s.shipping_fee)}"></label>
          <label>Frete grátis acima de (R$)<input type="text" id="sFree" inputmode="decimal" value="${moneyInput(s.free_shipping_from)}"></label>
        </div>
        <p class="hint">Use 0 em “frete grátis acima de” para desligar. A retirada na loja é sempre grátis.</p>
        <button class="btn" type="submit">Salvar ajustes</button>
      </form>

      <div class="panel">
        <h2>Conta</h2>
        <p class="hint" style="margin-bottom:.8rem">${GM.LIVE ? 'Para trocar a senha, use Supabase > Authentication > Users.' : 'Modo demonstração: dados salvos só neste navegador.'}</p>
        <div class="sheet__foot" style="margin-top:0">
          <button class="btn btn--ghost" id="sLogout">Sair do painel</button>
          ${GM.LIVE ? '' : '<button class="btn btn--danger" id="sReset">Restaurar dados de demonstração</button>'}
        </div>
      </div>`;

    $('#sForm').addEventListener('submit', async e => {
      e.preventDefault();
      const fee = parseMoney($('#sFee').value);
      const free = parseMoney($('#sFree').value);
      const next = {
        whatsapp: digits($('#sWhats').value),
        vip_link: $('#sVip').value.trim(),
        topbar_text: $('#sTop').value.trim(),
        pickup_address: $('#sPickup').value.trim(),
        shipping_fee: isNaN(fee) ? 0 : fee,
        free_shipping_from: isNaN(free) ? 0 : free
      };
      try { await GM.admin.saveSettings(next); S.settings = { ...S.settings, ...next }; toast('Ajustes salvos'); }
      catch (err) { toast(err.message); }
    });
    $('#sLogout').addEventListener('click', logout);
    const rs = $('#sReset');
    if (rs) rs.addEventListener('click', async () => {
      if (!confirm('Apagar os dados de demonstração e recomeçar?')) return;
      GM.admin.resetDemo(); await loadAll(); render(); toast('Dados restaurados');
    });
  }

  /* =========================================================
     LOGIN / INÍCIO
     ========================================================= */
  function showLogin() {
    $('#app').hidden = true;
    $('#login').hidden = false;
  }
  function logout() { GM.auth.logout(); showLogin(); }

  async function startApp() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    $('#demoBanner').hidden = GM.LIVE;
    S.view = 'resumo';
    await refresh();
  }

  function init() {
    buildNav();

    // cliques gerais (delegação)
    document.addEventListener('click', e => {
      const t = e.target;
      let el;
      if ((el = t.closest('[data-view]'))) return go(el.dataset.view);
      if (t.closest('[data-close]') || t.id === 'sheet') return closeSheet();
      if ((el = t.closest('[data-go]'))) {
        if (el.dataset.ofilter) S.oFilter = el.dataset.ofilter;
        return go(el.dataset.go);
      }
      if ((el = t.closest('[data-ofilter]'))) { S.oFilter = el.dataset.ofilter; return viewPedidos(); }
      if ((el = t.closest('[data-order]'))) return openOrder(el.dataset.order);
      if ((el = t.closest('[data-edit]'))) return openProduct(el.dataset.edit);
      if (t.closest('[data-newprod]')) return openProduct(null);
      if ((el = t.closest('[data-catren]'))) {
        const c = S.cats.find(x => x.id === el.dataset.catren);
        const name = prompt('Novo nome da categoria:', c ? c.name : '');
        if (name && name.trim()) {
          GM.admin.saveCategory({ id: c.id, name: name.trim() })
            .then(() => loadAll()).then(render).then(() => toast('Categoria renomeada'))
            .catch(err => toast(err.message));
        }
        return;
      }
      if ((el = t.closest('[data-catdel]'))) {
        const c = S.cats.find(x => x.id === el.dataset.catdel);
        if (!c) return;
        if (S.products.some(p => p.category_slug === c.slug)) return toast('Mova ou exclua os produtos desta categoria antes.');
        if (!confirm(`Excluir a categoria “${c.name}”?`)) return;
        GM.admin.deleteCategory(c.id)
          .then(() => loadAll()).then(render).then(() => toast('Categoria excluída'))
          .catch(err => toast(err.message));
      }
    });

    // liga/desliga produto direto da lista
    document.addEventListener('change', async e => {
      const el = e.target.closest('[data-toggle]');
      if (!el) return;
      const p = S.products.find(x => x.id === el.dataset.toggle);
      if (!p) return;
      try {
        await GM.admin.saveProduct({ ...p, active: el.checked });
        p.active = el.checked;
        toast(el.checked ? 'Produto ativado' : 'Produto escondido da loja');
      } catch (err) { el.checked = !el.checked; toast(err.message); }
    });

    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
    $('#refresh').addEventListener('click', refresh);
    $('#logout').addEventListener('click', logout);

    $('#loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = $('#lBtn');
      const err = $('#lErr');
      err.hidden = true;
      btn.disabled = true; btn.textContent = 'Entrando…';
      try {
        await GM.auth.login($('#lEmail').value.trim(), $('#lPass').value);
        $('#lPass').value = '';
        await startApp();
      } catch (ex) {
        err.textContent = /invalid/i.test(ex.message) ? 'E-mail ou senha incorretos.' : ex.message;
        err.hidden = false;
      }
      btn.disabled = false; btn.textContent = 'Entrar';
    });

    GM.auth.session().then(s => (s ? startApp() : showLogin()));
  }

  document.addEventListener('DOMContentLoaded', init);
})();
