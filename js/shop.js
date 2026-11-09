/* =========================================================
   Garota Mais — peças compartilhadas da loja (window.GMShop)
   Usado pela vitrine (index.html) e pela página do produto:
   cartões de produto, favoritos, sacola (gaveta), cabeçalho.
   ========================================================= */
(function () {
  'use strict';

  const GM = window.GM;
  const { brl, esc, discount, totalStock, colorsOf, stockOf, colorImage } = GM;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const GRADS = [
    ['#b79a9e', '#7a2e3b'], ['#8b2b3d', '#4a1620'], ['#5b6b8c', '#2c3552'],
    ['#d3a9ae', '#9c5560'], ['#c9a35d', '#7a2e3b'], ['#6e4a3a', '#2a1a1d']
  ];

  let DATA = { categories: [], products: [], settings: {} };
  let cart = GM.ls.get('gm_cart', []);
  let favs = new Set(GM.ls.get('gm_favs', []));

  /* ---------- dados ---------- */
  const setData = d => { DATA = d; };
  const getData = () => DATA;
  const byId = id => DATA.products.find(p => p.id === id);
  const catName = slug => (DATA.categories.find(c => c.slug === slug) || {}).name || '';
  const productUrl = id => 'produto.html?id=' + encodeURIComponent(id);
  const safeHex = h => (/^#[0-9a-f]{3,8}$/i.test(h || '') ? h : '#cccccc');
  function gradient(p) {
    const i = DATA.categories.findIndex(c => c.slug === p.category_slug);
    const g = GRADS[(i < 0 ? 0 : i) % GRADS.length];
    return `linear-gradient(160deg, ${g[0]}, ${g[1]})`;
  }
  function media(p, src, withLabel = true) {
    src = src === undefined ? (p.images[0] || '') : src;
    if (src) return `<img src="${esc(src)}" alt="${esc(p.name)}" loading="lazy" decoding="async">`;
    return withLabel ? `<span>${esc(p.name)}</span>` : '';
  }
  const waDigits = () => String(DATA.settings.whatsapp || GM.C.WHATSAPP || '').replace(/\D/g, '');
  const waLink = text => `https://wa.me/${waDigits()}?text=${encodeURIComponent(text)}`;

  function toast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2400);
  }

  /* ---------- favoritos ---------- */
  const isFav = id => favs.has(id);
  const favCount = () => favs.size;
  function syncFavButtons() {
    $$('[data-fav]').forEach(b => {
      const on = favs.has(b.dataset.fav);
      b.classList.toggle('on', on);
      b.textContent = on ? '♥' : '♡';
    });
  }
  function toggleFav(id) {
    if (favs.has(id)) favs.delete(id); else favs.add(id);
    GM.ls.set('gm_favs', [...favs]);
    syncFavButtons();
    return favs.has(id);
  }

  /* ---------- cartão de produto ---------- */
  function cardHtml(p) {
    const d = discount(p);
    const out = totalStock(p) === 0;
    const cols = colorsOf(p);
    const dots = cols.length
      ? `<div class="card__colors">${cols.slice(0, 5).map(c => `<i style="background:${safeHex(c.hex)}" title="${esc(c.name)}"></i>`).join('')}${cols.length > 5 ? `<small>+${cols.length - 5}</small>` : ''}</div>`
      : '';
    const fav = favs.has(p.id);
    return `<article class="card">
      <a class="card__a" href="${productUrl(p.id)}" aria-label="${esc(p.name)}">
        <div class="card__img ${out ? 'is-out' : ''}" style="background:${gradient(p)}">
          ${out ? '<span class="tag tag--out">Esgotado</span>' : (d ? `<span class="tag">-${d}%</span>` : '')}
          ${p.is_new && !out ? '<span class="tag tag--new">Novo</span>' : ''}
          ${media(p)}
          <span class="card__quick">Ver produto</span>
        </div>
        <div class="card__body">
          <div class="card__cat">${esc(catName(p.category_slug))}</div>
          <h3 class="card__name">${esc(p.name)}</h3>
          ${dots}
          <div class="price"><strong>${brl(p.price)}</strong>${p.old_price ? `<s>${brl(p.old_price)}</s>` : ''}
            <small>ou 3x de ${brl(p.price / 3)} sem juros</small></div>
        </div>
      </a>
      <button class="fav-btn fav-btn--card ${fav ? 'on' : ''}" data-fav="${esc(p.id)}" aria-label="Favoritar">${fav ? '♥' : '♡'}</button>
    </article>`;
  }

  /* ---------- sacola ---------- */
  const saveCart = () => GM.ls.set('gm_cart', cart);
  const maxFor = it => { const p = byId(it.id); return p ? stockOf(p, it.color || '', it.size) : 0; };

  function sanitizeCart() {
    cart = cart.filter(it => {
      const p = byId(it.id);
      if (!p) return false;
      const cols = colorsOf(p);
      if (cols.length && !cols.some(c => c.name === it.color)) return false;
      const max = maxFor(it);
      if (max <= 0) return false;
      it.qty = Math.min(it.qty, max);
      return it.qty > 0;
    });
    saveCart();
  }
  function addToCart(p, color, size, qty) {
    color = color || '';
    qty = qty || 1;
    const max = stockOf(p, color, size);
    const found = cart.find(i => i.id === p.id && (i.color || '') === color && i.size === size);
    const have = found ? found.qty : 0;
    if (have >= max) return { ok: false };
    const add = Math.min(qty, max - have);
    if (found) found.qty += add; else cart.push({ id: p.id, color, size, qty: add });
    saveCart();
    renderCart();
    return { ok: true, capped: add < qty };
  }

  function renderCart() {
    const count = cart.reduce((s, i) => s + i.qty, 0);
    const badge = $('#cartCount');
    if (badge) { badge.textContent = count; badge.style.display = count ? 'grid' : 'none'; }
    const body = $('#cartItems');
    if (!body) return;
    if (!cart.length) {
      body.innerHTML = '<div class="cart-empty">Sua sacola está vazia.<br>Que tal conhecer nossas peças?</div>';
      $('#cartFoot').hidden = true;
      return;
    }
    $('#cartFoot').hidden = false;
    let total = 0;
    body.innerHTML = cart.map((it, idx) => {
      const p = byId(it.id);
      if (!p) return '';
      total += p.price * it.qty;
      const img = colorImage(p, it.color || '');
      return `<div class="item">
        <a class="item__img card__img" href="${productUrl(p.id)}" style="background:${gradient(p)};padding:0;font-size:0">${img ? `<img src="${esc(img)}" alt="">` : ''}</a>
        <div>
          <div class="item__name">${esc(p.name)}</div>
          <div class="item__meta">${it.color ? esc(it.color) + ' · ' : ''}Tam. ${esc(it.size)}</div>
          <div class="qty">
            <button data-act="minus" data-i="${idx}" aria-label="Diminuir">−</button>
            <span>${it.qty}</span>
            <button data-act="plus" data-i="${idx}" aria-label="Aumentar" ${it.qty >= maxFor(it) ? 'disabled' : ''}>+</button>
          </div>
        </div>
        <div class="item__right">${brl(p.price * it.qty)}
          <button class="item__rm" data-act="rm" data-i="${idx}">remover</button></div>
      </div>`;
    }).join('');
    $('#cartTotal').textContent = brl(total);

    const free = Number(DATA.settings.free_shipping_from) || 0;
    const bar = $('#shipBar');
    if (free > 0) {
      const pct = Math.min(100, Math.round((total / free) * 100));
      bar.innerHTML = total >= free
        ? '<p>🎉 Você ganhou <strong>frete grátis</strong> na entrega!</p>'
        : `<p>Faltam <strong>${brl(free - total)}</strong> para frete grátis na entrega</p><div class="shipbar__track"><i style="width:${pct}%"></i></div>`;
      bar.hidden = false;
    } else bar.hidden = true;
  }
  function cartAction(act, i) {
    const it = cart[i];
    if (!it) return;
    if (act === 'plus' && it.qty < maxFor(it)) it.qty++;
    if (act === 'minus') it.qty = Math.max(1, it.qty - 1);
    if (act === 'rm') cart.splice(i, 1);
    saveCart();
    renderCart();
  }
  const openCart = () => { $('#drawer').classList.add('open'); $('#overlay').classList.add('show'); };
  const closeCart = () => { $('#drawer').classList.remove('open'); $('#overlay').classList.remove('show'); };

  /* ---------- configurações da loja ---------- */
  function applySettings() {
    const s = DATA.settings;
    const top = $('#topbarMain');
    if (top && s.topbar_text) top.textContent = s.topbar_text;
    const hello = waLink('Olá! Vim pelo site da Garota Mais e gostaria de atendimento.');
    ['whatsFloat', 'contactWhats', 'footerWhats'].forEach(id => { const a = document.getElementById(id); if (a) a.href = hello; });
    const vip = $('#vipLink');
    if (vip) vip.href = s.vip_link || waLink('Olá! Quero entrar no Grupo VIP da Garota Mais.');
  }

  /* ---------- cabeçalho, busca e gaveta da sacola ---------- */
  function initChrome(opts) {
    opts = opts || {};
    const y = $('#year');
    if (y) y.textContent = new Date().getFullYear();
    renderCart();

    const nav = $('#nav');
    const closeNav = () => { nav.classList.remove('open'); $('#overlay').classList.remove('show'); };
    $('#menuToggle').addEventListener('click', () => {
      nav.classList.toggle('open');
      $('#overlay').classList.toggle('show', nav.classList.contains('open'));
    });
    $$('#nav a').forEach(a => a.addEventListener('click', closeNav));

    const bar = $('#searchbar');
    const inp = $('#searchInput');
    $('#searchToggle').addEventListener('click', () => {
      bar.classList.toggle('open');
      if (bar.classList.contains('open')) inp.focus();
    });
    if (opts.onSearch) {
      inp.addEventListener('input', e => opts.onSearch(e.target.value.trim()));
    } else {
      inp.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        const q = inp.value.trim();
        if (q) location.href = 'index.html?q=' + encodeURIComponent(q) + '#catalogo';
      });
    }

    $('#cartToggle').addEventListener('click', openCart);
    $('#cartClose').addEventListener('click', closeCart);
    $('#overlay').addEventListener('click', () => { closeCart(); closeNav(); });
    $('#cartItems').addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (b) cartAction(b.dataset.act, +b.dataset.i);
    });
    $('#clearCart').addEventListener('click', () => { cart = []; saveCart(); renderCart(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });

    const syncCart = () => { cart = GM.ls.get('gm_cart', []); if (DATA.products.length) sanitizeCart(); renderCart(); };
    window.addEventListener('storage', e => { if (e.key === 'gm_cart') syncCart(); });
    window.addEventListener('pageshow', e => { if (e.persisted) syncCart(); });

    const header = $('#header');
    window.addEventListener('scroll', () => {
      header.style.boxShadow = window.scrollY > 10 ? '0 4px 20px rgba(74,22,32,.08)' : 'none';
    }, { passive: true });
  }

  window.GMShop = {
    setData, getData, byId, catName, gradient, media, cardHtml, productUrl, safeHex, waLink,
    isFav, favCount, toggleFav, syncFavButtons, toast,
    sanitizeCart, addToCart, renderCart, openCart, closeCart, applySettings, initChrome
  };
})();
