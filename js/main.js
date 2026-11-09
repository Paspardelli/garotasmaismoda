/* =========================================================
   Garota Mais — vitrine (index.html)
   Catálogo, estoque por tamanho, favoritos e sacola.
   O pedido é finalizado em checkout.html.
   ========================================================= */
(function () {
  'use strict';

  const GM = window.GM;
  const { brl, esc, sizesOf, totalStock, discount } = GM;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const GRADS = [
    ['#b79a9e', '#7a2e3b'], ['#8b2b3d', '#4a1620'], ['#5b6b8c', '#2c3552'],
    ['#d3a9ae', '#9c5560'], ['#c9a35d', '#7a2e3b'], ['#6e4a3a', '#2a1a1d']
  ];

  const state = { cat: 'todos', size: '', sort: 'relevancia', q: '', saleOnly: false, favOnly: false };
  let DATA = { categories: [], products: [], settings: {} };
  let cart = GM.ls.get('gm_cart', []);
  let favs = new Set(GM.ls.get('gm_favs', []));
  let current = null;
  let chosenSize = '';

  /* ---------- helpers ---------- */
  const byId = id => DATA.products.find(p => p.id === id);
  const catName = slug => (DATA.categories.find(c => c.slug === slug) || {}).name || '';
  const gradient = p => {
    const i = DATA.categories.findIndex(c => c.slug === p.category_slug);
    const g = GRADS[(i < 0 ? 0 : i) % GRADS.length];
    return `linear-gradient(160deg, ${g[0]}, ${g[1]})`;
  };
  const waDigits = () => String(DATA.settings.whatsapp || GM.C.WHATSAPP || '').replace(/\D/g, '');
  const waLink = text => `https://wa.me/${waDigits()}?text=${encodeURIComponent(text)}`;

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }
  const saveCart = () => GM.ls.set('gm_cart', cart);
  const saveFavs = () => GM.ls.set('gm_favs', [...favs]);

  function sanitizeCart() {
    cart = cart.filter(it => {
      const p = byId(it.id);
      if (!p) return false;
      const max = Number(p.stock[it.size] || 0);
      if (max <= 0) return false;
      it.qty = Math.min(it.qty, max);
      return it.qty > 0;
    });
    saveCart();
  }

  function media(p, i = 0, withLabel = true) {
    const src = p.images && p.images[i];
    if (src) return `<img src="${esc(src)}" alt="${esc(p.name)}" loading="lazy" decoding="async">`;
    return withLabel ? `<span>${esc(p.name)}</span>` : '';
  }

  /* ---------- categorias e filtros ---------- */
  function renderCats() {
    $('#catsGrid').innerHTML = DATA.categories.map((c, i) => {
      const n = DATA.products.filter(p => p.category_slug === c.slug).length;
      const g = GRADS[i % GRADS.length];
      return `<a href="#catalogo" class="cat" data-cat="${esc(c.slug)}" style="background:linear-gradient(160deg,${g[0]},${g[1]})">
        <div><span>${esc(c.name)}</span><small>${n} ${n === 1 ? 'peça' : 'peças'}</small></div></a>`;
    }).join('');
    $$('.cat').forEach(el => el.addEventListener('click', () => setCat(el.dataset.cat)));
  }

  function renderChips() {
    const chips = [{ slug: 'todos', name: 'Todos' }, ...DATA.categories];
    if (favs.size) chips.push({ slug: '__fav', name: '♥ Favoritos' });
    const active = state.favOnly ? '__fav' : state.cat;
    $('#catChips').innerHTML = chips.map(c =>
      `<button class="chip ${active === c.slug ? 'active' : ''}" data-cat="${esc(c.slug)}">${esc(c.name)}</button>`).join('');
    $$('.chip').forEach(b => b.addEventListener('click', () => setCat(b.dataset.cat)));
  }

  function setCat(slug) {
    state.saleOnly = false;
    state.favOnly = slug === '__fav';
    state.cat = state.favOnly ? 'todos' : slug;
    renderChips();
    renderProducts();
  }

  /* ---------- produtos ---------- */
  function filtered() {
    const q = state.q.toLowerCase();
    const list = DATA.products.filter(p => {
      if (state.cat !== 'todos' && p.category_slug !== state.cat) return false;
      if (state.favOnly && !favs.has(p.id)) return false;
      if (state.size && !(Number(p.stock[state.size]) > 0)) return false;
      if (state.saleOnly && discount(p) < 20) return false;
      if (q && !(p.name.toLowerCase().includes(q) || catName(p.category_slug).toLowerCase().includes(q))) return false;
      return true;
    });
    if (state.sort === 'menor') list.sort((a, b) => a.price - b.price);
    else if (state.sort === 'maior') list.sort((a, b) => b.price - a.price);
    else if (state.sort === 'desconto') list.sort((a, b) => discount(b) - discount(a));
    else list.sort((a, b) => (Number(b.featured) - Number(a.featured)) || (Number(b.is_new) - Number(a.is_new)));
    // esgotados sempre por último
    return list.sort((a, b) => (totalStock(a) === 0) - (totalStock(b) === 0));
  }

  function cardHtml(p) {
    const d = discount(p);
    const out = totalStock(p) === 0;
    return `<article class="card" data-id="${esc(p.id)}">
      <div class="card__img ${out ? 'is-out' : ''}" style="background:${gradient(p)}">
        ${out ? '<span class="tag tag--out">Esgotado</span>' : (d ? `<span class="tag">-${d}%</span>` : '')}
        ${p.is_new && !out ? '<span class="tag tag--new">Novo</span>' : ''}
        ${media(p)}
        <button class="fav-btn fav-btn--card ${favs.has(p.id) ? 'on' : ''}" data-fav="${esc(p.id)}" aria-label="Favoritar">${favs.has(p.id) ? '♥' : '♡'}</button>
        <span class="card__quick">Ver detalhes</span>
      </div>
      <div class="card__body">
        <div class="card__cat">${esc(catName(p.category_slug))}</div>
        <h3 class="card__name">${esc(p.name)}</h3>
        <div class="price"><strong>${brl(p.price)}</strong>${p.old_price ? `<s>${brl(p.old_price)}</s>` : ''}
          <small>ou 3x de ${brl(p.price / 3)} sem juros</small></div>
      </div>
    </article>`;
  }

  function renderProducts() {
    const list = filtered();
    $('#productGrid').innerHTML = list.map(cardHtml).join('');
    $('#emptyState').hidden = list.length > 0;
    $('#resultsInfo').textContent = `${list.length} ${list.length === 1 ? 'peça encontrada' : 'peças encontradas'}`;
  }

  /* ---------- favoritos ---------- */
  function toggleFav(id) {
    if (favs.has(id)) favs.delete(id); else favs.add(id);
    saveFavs();
    if (state.favOnly && !favs.size) { state.favOnly = false; }
    renderChips();
    renderProducts();
    if (current && current.id === id) updateModalFav();
  }
  function updateModalFav() {
    const on = favs.has(current.id);
    const b = $('#modalFav');
    b.classList.toggle('on', on);
    b.textContent = on ? '♥' : '♡';
  }

  /* ---------- modal do produto ---------- */
  function openModal(id) {
    const p = byId(id);
    if (!p) return;
    current = p;
    const sizes = sizesOf(p);
    const available = sizes.filter(s => Number(p.stock[s]) > 0);
    chosenSize = available.length === 1 && sizes.length === 1 ? available[0] : '';

    const d = discount(p);
    $('#modalCat').textContent = catName(p.category_slug);
    $('#modalName').textContent = p.name;
    $('#modalPrice').innerHTML = `<strong>${brl(p.price)}</strong>${p.old_price ? `<s>${brl(p.old_price)}</s>` : ''}<small>${d ? d + '% OFF · ' : ''}3x de ${brl(p.price / 3)} sem juros</small>`;
    $('#modalDesc').textContent = p.description || '';
    $('#modalErr').hidden = true;
    $('#modalStock').textContent = '';

    setGallery(0);
    const th = $('#modalThumbs');
    th.innerHTML = p.images.length > 1
      ? p.images.map((src, i) => `<button class="thumb ${i === 0 ? 'on' : ''}" data-i="${i}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join('')
      : '';

    $('#modalSizes').innerHTML = sizes.map(s => {
      const q = Number(p.stock[s]) || 0;
      return `<button class="size ${q === 0 ? 'out' : ''} ${s === chosenSize ? 'active' : ''}" data-s="${esc(s)}" ${q === 0 ? 'disabled' : ''}>${esc(s)}</button>`;
    }).join('');
    if (chosenSize) showStockHint();

    const add = $('#modalAdd');
    add.disabled = available.length === 0;
    add.textContent = available.length === 0 ? 'Esgotado' : 'Adicionar à sacola';
    updateModalFav();

    // sugestões da mesma categoria
    const sug = DATA.products.filter(x => x.id !== p.id && x.category_slug === p.category_slug && totalStock(x) > 0).slice(0, 4);
    $('#modalSuggestWrap').hidden = sug.length === 0;
    $('#modalSuggest').innerHTML = sug.map(x => `<button class="mini" data-id="${esc(x.id)}">
      <span class="mini__img" style="background:${gradient(x)}">${x.images[0] ? `<img src="${esc(x.images[0])}" alt="" loading="lazy">` : ''}</span>
      <span class="mini__name">${esc(x.name)}</span><span class="mini__price">${brl(x.price)}</span></button>`).join('');

    $('#modal').classList.add('open');
    $('#modal').setAttribute('aria-hidden', 'false');
    $('.modal__box').scrollTop = 0;
  }
  function setGallery(i) {
    const p = current;
    const box = $('#modalImg');
    box.style.background = gradient(p);
    box.innerHTML = p.images[i] ? `<img src="${esc(p.images[i])}" alt="${esc(p.name)}">` : `<span>${esc(p.name)}</span>`;
  }
  function showStockHint() {
    const q = Number(current.stock[chosenSize]) || 0;
    $('#modalStock').textContent = q > 0 && q <= 3 ? (q === 1 ? 'Última unidade neste tamanho!' : `Restam apenas ${q} neste tamanho.`) : '';
  }
  function closeModal() {
    $('#modal').classList.remove('open');
    $('#modal').setAttribute('aria-hidden', 'true');
  }

  /* ---------- sacola ---------- */
  function cartQty(id, size) {
    const it = cart.find(i => i.id === id && i.size === size);
    return it ? it.qty : 0;
  }
  function addToCart(p, size) {
    const max = Number(p.stock[size]) || 0;
    if (cartQty(p.id, size) >= max) return false;
    const found = cart.find(i => i.id === p.id && i.size === size);
    if (found) found.qty++; else cart.push({ id: p.id, size, qty: 1 });
    saveCart(); renderCart();
    return true;
  }

  function renderCart() {
    const count = cart.reduce((s, i) => s + i.qty, 0);
    const badge = $('#cartCount');
    badge.textContent = count;
    badge.style.display = count ? 'grid' : 'none';

    const body = $('#cartItems');
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
      const max = Number(p.stock[it.size]) || 0;
      return `<div class="item">
        <div class="item__img card__img" style="background:${gradient(p)};padding:0;font-size:0">${p.images[0] ? `<img src="${esc(p.images[0])}" alt="">` : ''}</div>
        <div>
          <div class="item__name">${esc(p.name)}</div>
          <div class="item__meta">Tamanho: ${esc(it.size)}</div>
          <div class="qty">
            <button data-act="minus" data-i="${idx}" aria-label="Diminuir">−</button>
            <span>${it.qty}</span>
            <button data-act="plus" data-i="${idx}" aria-label="Aumentar" ${it.qty >= max ? 'disabled' : ''}>+</button>
          </div>
        </div>
        <div class="item__right">${brl(p.price * it.qty)}
          <button class="item__rm" data-act="rm" data-i="${idx}">remover</button></div>
      </div>`;
    }).join('');
    $('#cartTotal').textContent = brl(total);

    // barra de frete grátis (entrega)
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
    const p = byId(it.id);
    const max = p ? Number(p.stock[it.size]) || 0 : 0;
    if (act === 'plus' && it.qty < max) it.qty++;
    if (act === 'minus') it.qty = Math.max(1, it.qty - 1);
    if (act === 'rm') cart.splice(i, 1);
    saveCart(); renderCart();
  }
  function openCart() { $('#drawer').classList.add('open'); $('#overlay').classList.add('show'); }
  function closeCart() { $('#drawer').classList.remove('open'); $('#overlay').classList.remove('show'); }

  /* ---------- configurações da loja ---------- */
  function applySettings() {
    const s = DATA.settings;
    if (s.topbar_text) $('#topbarMain').textContent = s.topbar_text;
    const hello = waLink('Olá! Vim pelo site da Garota Mais e gostaria de atendimento.');
    ['whatsFloat', 'contactWhats', 'footerWhats'].forEach(id => { const a = $('#' + id); if (a) a.href = hello; });
    $('#vipLink').href = s.vip_link || waLink('Olá! Quero entrar no Grupo VIP da Garota Mais.');
  }

  /* ---------- carregamento ---------- */
  function skeleton() {
    $('#productGrid').innerHTML = Array.from({ length: 8 }, () =>
      '<div class="card skeleton"><div class="card__img"></div><div class="card__body"><i></i><i></i></div></div>').join('');
  }
  async function load() {
    skeleton();
    try {
      DATA = await GM.getCatalog();
    } catch (err) {
      $('#productGrid').innerHTML = '';
      $('#resultsInfo').textContent = '';
      const e = $('#emptyState');
      e.hidden = false;
      e.querySelector('p').textContent = 'Não foi possível carregar os produtos agora.';
      const btn = $('#clearFilters');
      btn.textContent = 'Tentar de novo';
      btn.onclick = () => location.reload();
      return;
    }
    sanitizeCart();
    applySettings();
    renderCats();
    renderChips();
    renderProducts();
    renderCart();
  }

  /* ---------- eventos ---------- */
  function init() {
    $('#year').textContent = new Date().getFullYear();
    renderCart();
    load();

    // cartões (delegação)
    $('#productGrid').addEventListener('click', e => {
      const fav = e.target.closest('[data-fav]');
      if (fav) { e.stopPropagation(); toggleFav(fav.dataset.fav); return; }
      const card = e.target.closest('.card[data-id]');
      if (card) openModal(card.dataset.id);
    });

    // filtros
    $('#sizeFilter').addEventListener('change', e => { state.size = e.target.value; renderProducts(); });
    $('#sortFilter').addEventListener('change', e => { state.sort = e.target.value; renderProducts(); });
    $('#clearFilters').addEventListener('click', () => {
      Object.assign(state, { cat: 'todos', size: '', sort: 'relevancia', q: '', saleOnly: false, favOnly: false });
      $('#sizeFilter').value = ''; $('#sortFilter').value = 'relevancia'; $('#searchInput').value = '';
      renderChips(); renderProducts();
    });
    $('[data-filter-sale]').addEventListener('click', () => {
      Object.assign(state, { cat: 'todos', saleOnly: true, favOnly: false, sort: 'desconto' });
      $('#sortFilter').value = 'desconto';
      renderChips(); renderProducts();
    });

    // busca
    $('#searchToggle').addEventListener('click', () => {
      const bar = $('#searchbar');
      bar.classList.toggle('open');
      if (bar.classList.contains('open')) $('#searchInput').focus();
    });
    $('#searchInput').addEventListener('input', e => {
      state.q = e.target.value.trim();
      renderProducts();
      if (state.q) $('#catalogo').scrollIntoView({ behavior: 'smooth' });
    });

    // menu mobile
    const nav = $('#nav');
    $('#menuToggle').addEventListener('click', () => {
      nav.classList.toggle('open');
      $('#overlay').classList.toggle('show', nav.classList.contains('open'));
    });
    $$('#nav a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('open'); $('#overlay').classList.remove('show'); }));

    // sacola
    $('#cartToggle').addEventListener('click', openCart);
    $('#cartClose').addEventListener('click', closeCart);
    $('#overlay').addEventListener('click', () => { closeCart(); nav.classList.remove('open'); $('#overlay').classList.remove('show'); });
    $('#cartItems').addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (b) cartAction(b.dataset.act, +b.dataset.i);
    });
    $('#clearCart').addEventListener('click', () => { cart = []; saveCart(); renderCart(); });

    // modal
    $('#modalClose').addEventListener('click', closeModal);
    $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
    $('#modalFav').addEventListener('click', () => current && toggleFav(current.id));
    $('#modalThumbs').addEventListener('click', e => {
      const b = e.target.closest('.thumb');
      if (!b) return;
      $$('.thumb').forEach(x => x.classList.toggle('on', x === b));
      setGallery(+b.dataset.i);
    });
    $('#modalSizes').addEventListener('click', e => {
      const b = e.target.closest('.size');
      if (!b || b.disabled) return;
      chosenSize = b.dataset.s;
      $$('.size').forEach(x => x.classList.toggle('active', x === b));
      $('#modalErr').hidden = true;
      showStockHint();
    });
    $('#modalSuggest').addEventListener('click', e => {
      const b = e.target.closest('.mini');
      if (b) openModal(b.dataset.id);
    });
    $('#modalAdd').addEventListener('click', () => {
      if (!chosenSize) { $('#modalErr').hidden = false; return; }
      if (!addToCart(current, chosenSize)) {
        toast('Você já adicionou todas as unidades disponíveis');
        return;
      }
      closeModal();
      toast('Adicionado à sacola');
      openCart();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeCart(); } });

    // contato
    $('#contactForm').addEventListener('submit', e => {
      e.preventDefault();
      window.open(waLink(`Olá! Meu nome é ${$('#cfName').value.trim()}.\n${$('#cfMsg').value.trim()}`), '_blank', 'noopener');
    });

    // sincroniza a sacola com outras abas / ao voltar do checkout
    const syncCart = () => { cart = GM.ls.get('gm_cart', []); if (DATA.products.length) sanitizeCart(); renderCart(); };
    window.addEventListener('storage', e => { if (e.key === 'gm_cart') syncCart(); });
    window.addEventListener('pageshow', e => { if (e.persisted) syncCart(); });

    window.addEventListener('scroll', () => {
      $('#header').style.boxShadow = window.scrollY > 10 ? '0 4px 20px rgba(74,22,32,.08)' : 'none';
    }, { passive: true });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
