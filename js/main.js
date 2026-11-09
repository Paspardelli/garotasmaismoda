/* =========================================================
   Garota Mais — vitrine (index.html)
   Lista de produtos, filtros e categorias. Cada produto abre
   na própria página (produto.html). Sacola e cabeçalho: shop.js
   ========================================================= */
(function () {
  'use strict';

  const GM = window.GM;
  const S = window.GMShop;
  const { esc, discount, totalStock, sizeAvailable } = GM;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const GRADS = [
    ['#b79a9e', '#7a2e3b'], ['#8b2b3d', '#4a1620'], ['#5b6b8c', '#2c3552'],
    ['#d3a9ae', '#9c5560'], ['#c9a35d', '#7a2e3b'], ['#6e4a3a', '#2a1a1d']
  ];

  const state = { cat: 'todos', size: '', sort: 'relevancia', q: '', saleOnly: false, favOnly: false };
  let DATA = { categories: [], products: [], settings: {} };

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
    if (S.favCount()) chips.push({ slug: '__fav', name: '♥ Favoritos' });
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
      if (state.favOnly && !S.isFav(p.id)) return false;
      if (state.size && !sizeAvailable(p, state.size, '')) return false;
      if (state.saleOnly && discount(p) < 20) return false;
      if (q && !(p.name.toLowerCase().includes(q) || S.catName(p.category_slug).toLowerCase().includes(q))) return false;
      return true;
    });
    if (state.sort === 'menor') list.sort((a, b) => a.price - b.price);
    else if (state.sort === 'maior') list.sort((a, b) => b.price - a.price);
    else if (state.sort === 'desconto') list.sort((a, b) => discount(b) - discount(a));
    else list.sort((a, b) => (Number(b.featured) - Number(a.featured)) || (Number(b.is_new) - Number(a.is_new)));
    return list.sort((a, b) => (totalStock(a) === 0) - (totalStock(b) === 0)); // esgotados por último
  }

  function renderProducts() {
    const list = filtered();
    $('#productGrid').innerHTML = list.map(S.cardHtml).join('');
    $('#emptyState').hidden = list.length > 0;
    $('#resultsInfo').textContent = `${list.length} ${list.length === 1 ? 'peça encontrada' : 'peças encontradas'}`;
  }

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
    S.setData(DATA);
    S.sanitizeCart();
    S.applySettings();
    renderCats();
    renderChips();
    renderProducts();
    S.renderCart();
  }

  /* ---------- eventos ---------- */
  function init() {
    // busca pela URL (vinda da página do produto): index.html?q=vestido
    const qs = new URLSearchParams(location.search);
    const q0 = qs.get('q');
    if (q0) { state.q = q0.trim(); $('#searchInput').value = state.q; $('#searchbar').classList.add('open'); }
    const c0 = qs.get('cat'); // index.html?cat=vestidos (vem do caminho de navegação do produto)
    if (c0) state.cat = c0;

    S.initChrome({
      onSearch: q => {
        state.q = q;
        renderProducts();
        if (q) $('#catalogo').scrollIntoView({ behavior: 'smooth' });
      }
    });
    load();

    // favoritos (o resto do cartão é um link para a página do produto)
    $('#productGrid').addEventListener('click', e => {
      const fav = e.target.closest('[data-fav]');
      if (!fav) return;
      S.toggleFav(fav.dataset.fav);
      if (state.favOnly && !S.favCount()) state.favOnly = false;
      renderChips();
      if (state.favOnly) renderProducts();
    });

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

    $('#contactForm').addEventListener('submit', e => {
      e.preventDefault();
      window.open(S.waLink(`Olá! Meu nome é ${$('#cfName').value.trim()}.\n${$('#cfMsg').value.trim()}`), '_blank', 'noopener');
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
