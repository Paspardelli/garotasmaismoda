/* =========================================================
   Garota Mais — main.js
   Catálogo, filtros, sacola e pedido via WhatsApp
   ========================================================= */

/* ---------- CONFIGURAÇÃO (edite aqui) ---------- */
const CONFIG = {
  // Número com DDI + DDD, só dígitos. Ex.: 5519999999999
  whatsapp: '5519999999999',
  // Link do Grupo VIP do WhatsApp (cole o convite do grupo)
  vipLink: '',
  storeName: 'Garota Mais'
};

const SIZES = ['P', 'M', 'G', 'G1', 'G2'];

const CATEGORIES = [
  { id: 'vestidos',  name: 'Vestidos',  grad: ['#b79a9e', '#7a2e3b'] },
  { id: 'conjuntos', name: 'Conjuntos', grad: ['#8b2b3d', '#4a1620'] },
  { id: 'calcas',    name: 'Calças e Jeans', grad: ['#5b6b8c', '#2c3552'] },
  { id: 'blusas',    name: 'Blusas',    grad: ['#d3a9ae', '#9c5560'] },
  { id: 'festa',     name: 'Festa e Casamento', grad: ['#c9a35d', '#7a2e3b'] },
  { id: 'bolsas',    name: 'Bolsas e Acessórios', grad: ['#6e4a3a', '#2a1a1d'] }
];

/*
  Produtos de exemplo. Para usar fotos reais, coloque os arquivos em /img
  e informe o caminho em "img" (ex.: img: 'img/vestido-linho.jpg').
  "old" = preço antes do desconto (opcional). "isNew" = selo "Novo".
*/
const PRODUCTS = [
  { id: 1,  name: 'Vestido Midi Branco com Cinto', cat: 'vestidos',  price: 189.90, old: 379.80, sizes: ['M','G','G1','G2'], isNew: true,  desc: 'Vestido midi com cinto marcando a cintura, tecido com leve elasticidade e caimento elegante.' },
  { id: 2,  name: 'Vestido Longo Floral',          cat: 'vestidos',  price: 159.90, old: 319.80, sizes: ['P','M','G','G1'], isNew: false, desc: 'Longo fluido com estampa floral, ideal para passeios e eventos de dia.' },
  { id: 3,  name: 'Vestido Slim Preto Clássico',   cat: 'vestidos',  price: 139.90, old: 199.90, sizes: ['M','G','G1','G2'], isNew: false, desc: 'O preto básico que não pode faltar: versátil, confortável e elegante.' },
  { id: 4,  name: 'Conjunto Alfaiataria Rosé',     cat: 'conjuntos', price: 219.90, old: 439.80, sizes: ['P','M','G','G1','G2'], isNew: true, desc: 'Blazer e calça em alfaiataria leve na cor rosé. Pronto para o trabalho e para o happy hour.' },
  { id: 5,  name: 'Conjunto Cropped e Saia Midi',  cat: 'conjuntos', price: 179.90, old: 259.90, sizes: ['M','G','G1'], isNew: false, desc: 'Duas peças com caimento fluido e tecido macio.' },
  { id: 6,  name: 'Calça Jeans Cintura Alta',      cat: 'calcas',    price: 149.90, old: 189.90, sizes: ['P','M','G','G1','G2'], isNew: false, desc: 'Jeans com elastano, cintura alta e conforto o dia todo. Esquenta Black Friday: 20% OFF em jeans.' },
  { id: 7,  name: 'Calça Pantalona Linho',         cat: 'calcas',    price: 129.90, old: 229.90, sizes: ['M','G','G1','G2'], isNew: false, desc: 'Pantalona em tecido leve tipo linho, cós com elástico e bolsos.' },
  { id: 8,  name: 'Jeans Wide Leg Premium',        cat: 'calcas',    price: 169.90, old: 249.90, sizes: ['P','M','G','G1'], isNew: true, desc: 'Modelagem wide leg moderna com lavagem média e ótimo caimento.' },
  { id: 9,  name: 'Blusa Manga Bufante',           cat: 'blusas',    price: 79.90,  old: 129.90, sizes: ['P','M','G','G1','G2'], isNew: false, desc: 'Blusa com mangas bufantes e decote suave. Combina com tudo.' },
  { id: 10, name: 'Camisa Social Feminina',        cat: 'blusas',    price: 99.90,  old: 159.90, sizes: ['M','G','G1','G2'], isNew: false, desc: 'Camisa social com corte alongado e tecido que não amassa fácil.' },
  { id: 11, name: 'Blusa Cetim Nude',              cat: 'blusas',    price: 89.90,  old: null,   sizes: ['P','M','G','G1'], isNew: true, desc: 'Cetim fluido com brilho discreto, para looks sofisticados.' },
  { id: 12, name: 'Vestido Convidada Marsala',     cat: 'festa',     price: 259.90, old: 519.80, sizes: ['M','G','G1','G2'], isNew: true, desc: 'Vestido para casamentos e formaturas, com modelagem que valoriza a silhueta.' },
  { id: 13, name: 'Vestido Longo Evasê Azul',      cat: 'festa',     price: 289.90, old: 449.90, sizes: ['P','M','G','G1','G2'], isNew: false, desc: 'Longo evasê em tecido nobre com forro, para ocasiões especiais.' },
  { id: 14, name: 'Bolsa Transversal Preta',       cat: 'bolsas',    price: 119.90, old: 179.90, sizes: ['Único'], isNew: false, desc: 'Bolsa estruturada com alça removível, cabe o essencial do dia.' },
  { id: 15, name: 'Bolsa Caramelo Média',          cat: 'bolsas',    price: 139.90, old: 219.90, sizes: ['Único'], isNew: true, desc: 'Bolsa média na cor caramelo com ferragem dourada.' },
  { id: 16, name: 'Bolsa Off-White Clutch',        cat: 'bolsas',    price: 99.90,  old: 149.90, sizes: ['Único'], isNew: false, desc: 'Clutch off-white que acompanha de looks casuais a festas.' }
];

/* ---------- Utilidades ---------- */
const $  = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const brl = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const catById = id => CATEGORIES.find(c => c.id === id);
const discount = p => (p.old ? Math.round((1 - p.price / p.old) * 100) : 0);
const gradient = p => {
  const g = catById(p.cat).grad;
  return `linear-gradient(160deg, ${g[0]}, ${g[1]})`;
};
const waLink = text => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- Estado ---------- */
const state = { cat: 'todos', size: '', sort: 'relevancia', q: '', saleOnly: false };
let cart = [];
try { cart = JSON.parse(localStorage.getItem('gm_cart') || '[]'); } catch (e) { cart = []; }
const saveCart = () => { try { localStorage.setItem('gm_cart', JSON.stringify(cart)); } catch (e) {} };

/* ---------- Imagem do produto (foto ou gradiente) ---------- */
function imgBlock(p, label = true) {
  const photo = p.img ? `<img src="${esc(p.img)}" alt="${esc(p.name)}" loading="lazy">` : '';
  return photo + (p.img || !label ? '' : `<span>${esc(p.name)}</span>`);
}

/* ---------- Categorias ---------- */
function renderCats() {
  $('#catsGrid').innerHTML = CATEGORIES.map(c => {
    const n = PRODUCTS.filter(p => p.cat === c.id).length;
    return `<a href="#catalogo" class="cat" data-cat="${c.id}" style="background:linear-gradient(160deg,${c.grad[0]},${c.grad[1]})">
      <div><span>${c.name}</span><small>${n} peças</small></div></a>`;
  }).join('');
  $$('.cat').forEach(el => el.addEventListener('click', () => setCat(el.dataset.cat)));
}

function renderChips() {
  const chips = [{ id: 'todos', name: 'Todos' }, ...CATEGORIES];
  $('#catChips').innerHTML = chips.map(c =>
    `<button class="chip ${state.cat === c.id ? 'active' : ''}" data-cat="${c.id}">${c.name}</button>`).join('');
  $$('.chip').forEach(b => b.addEventListener('click', () => setCat(b.dataset.cat)));
}

function setCat(id) {
  state.cat = id;
  state.saleOnly = false;
  renderChips();
  renderProducts();
}

/* ---------- Produtos ---------- */
function filtered() {
  let list = PRODUCTS.filter(p => {
    if (state.cat !== 'todos' && p.cat !== state.cat) return false;
    if (state.size && !p.sizes.includes(state.size)) return false;
    if (state.saleOnly && discount(p) < 20) return false;
    if (state.q) {
      const q = state.q.toLowerCase();
      if (!(p.name.toLowerCase().includes(q) || catById(p.cat).name.toLowerCase().includes(q))) return false;
    }
    return true;
  });
  if (state.sort === 'menor') list.sort((a, b) => a.price - b.price);
  if (state.sort === 'maior') list.sort((a, b) => b.price - a.price);
  if (state.sort === 'desconto') list.sort((a, b) => discount(b) - discount(a));
  return list;
}

function renderProducts() {
  const list = filtered();
  $('#productGrid').innerHTML = list.map(p => {
    const d = discount(p);
    return `<article class="card" data-id="${p.id}">
      <div class="card__img" style="background:${gradient(p)}">
        ${d ? `<span class="tag">-${d}%</span>` : ''}
        ${p.isNew ? `<span class="tag tag--new">Novo</span>` : ''}
        ${imgBlock(p)}
        <span class="card__quick">Ver detalhes</span>
      </div>
      <div class="card__body">
        <div class="card__cat">${catById(p.cat).name}</div>
        <h3 class="card__name">${esc(p.name)}</h3>
        <div class="price"><strong>${brl(p.price)}</strong>${p.old ? `<s>${brl(p.old)}</s>` : ''}
          <small>ou 3x de ${brl(p.price / 3)} sem juros</small></div>
      </div>
    </article>`;
  }).join('');
  $('#emptyState').hidden = list.length > 0;
  $('#resultsInfo').textContent = `${list.length} ${list.length === 1 ? 'peça encontrada' : 'peças encontradas'}`;
  $$('.card').forEach(c => c.addEventListener('click', () => openModal(+c.dataset.id)));
}

/* ---------- Modal ---------- */
let current = null, chosenSize = '';
function openModal(id) {
  current = PRODUCTS.find(p => p.id === id);
  chosenSize = current.sizes.length === 1 ? current.sizes[0] : '';
  const p = current, d = discount(p);
  const img = $('#modalImg');
  img.style.background = gradient(p);
  img.innerHTML = imgBlock(p);
  $('#modalCat').textContent = catById(p.cat).name;
  $('#modalName').textContent = p.name;
  $('#modalPrice').innerHTML = `<strong>${brl(p.price)}</strong>${p.old ? `<s>${brl(p.old)}</s>` : ''}${d ? `<small>${d}% OFF · 3x de ${brl(p.price / 3)} sem juros</small>` : `<small>3x de ${brl(p.price / 3)} sem juros</small>`}`;
  $('#modalDesc').textContent = p.desc;
  $('#modalErr').hidden = true;
  $('#modalSizes').innerHTML = p.sizes.map(s =>
    `<button class="size ${s === chosenSize ? 'active' : ''}" data-s="${s}">${s}</button>`).join('');
  $$('.size').forEach(b => b.addEventListener('click', () => {
    chosenSize = b.dataset.s;
    $$('.size').forEach(x => x.classList.toggle('active', x === b));
    $('#modalErr').hidden = true;
  }));
  $('#modal').classList.add('open');
  $('#modal').setAttribute('aria-hidden', 'false');
}
function closeModal() {
  $('#modal').classList.remove('open');
  $('#modal').setAttribute('aria-hidden', 'true');
}

/* ---------- Sacola ---------- */
function addToCart(p, size) {
  const found = cart.find(i => i.id === p.id && i.size === size);
  if (found) found.qty++;
  else cart.push({ id: p.id, size, qty: 1 });
  saveCart(); renderCart();
}

function renderCart() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  $('#cartCount').textContent = count;
  $('#cartCount').style.display = count ? 'grid' : 'none';
  const body = $('#cartItems');
  if (!cart.length) {
    body.innerHTML = '<div class="cart-empty">Sua sacola está vazia.<br>Que tal conhecer nossas peças?</div>';
    $('#cartFoot').hidden = true;
    return;
  }
  $('#cartFoot').hidden = false;
  let total = 0;
  body.innerHTML = cart.map((it, idx) => {
    const p = PRODUCTS.find(x => x.id === it.id);
    if (!p) return '';
    total += p.price * it.qty;
    return `<div class="item">
      <div class="item__img card__img" style="background:${gradient(p)};padding:0;font-size:0">${p.img ? `<img src="${esc(p.img)}" alt="">` : ''}</div>
      <div>
        <div class="item__name">${esc(p.name)}</div>
        <div class="item__meta">Tamanho: ${it.size}</div>
        <div class="qty">
          <button data-act="minus" data-i="${idx}" aria-label="Diminuir">−</button>
          <span>${it.qty}</span>
          <button data-act="plus" data-i="${idx}" aria-label="Aumentar">+</button>
        </div>
      </div>
      <div class="item__right">${brl(p.price * it.qty)}
        <button class="item__rm" data-act="rm" data-i="${idx}">remover</button></div>
    </div>`;
  }).join('');
  $('#cartTotal').textContent = brl(total);
}

function cartAction(act, i) {
  const it = cart[i];
  if (!it) return;
  if (act === 'plus') it.qty++;
  if (act === 'minus') it.qty = Math.max(1, it.qty - 1);
  if (act === 'rm') cart.splice(i, 1);
  saveCart(); renderCart();
}

function openCart() { $('#drawer').classList.add('open'); $('#overlay').classList.add('show'); }
function closeCart() { $('#drawer').classList.remove('open'); $('#overlay').classList.remove('show'); }

function checkout() {
  if (!cart.length) return;
  const name = $('#custName').value.trim();
  const delivery = $('#custDelivery').value;
  let total = 0;
  const lines = cart.map(it => {
    const p = PRODUCTS.find(x => x.id === it.id);
    const sub = p.price * it.qty;
    total += sub;
    return `• ${it.qty}x ${p.name} (Tam. ${it.size}) - ${brl(sub)}`;
  });
  const msg = [
    `Olá, ${CONFIG.storeName}! Gostaria de fazer um pedido:`,
    '',
    ...lines,
    '',
    `*Total: ${brl(total)}*`,
    `Entrega: ${delivery}`,
    name ? `Nome: ${name}` : ''
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
  window.open(waLink(msg), '_blank', 'noopener');
}

/* ---------- Eventos ---------- */
function init() {
  renderCats();
  renderChips();
  renderProducts();
  renderCart();

  // Links de WhatsApp
  const hello = waLink('Olá! Vim pelo site da Garota Mais e gostaria de atendimento.');
  ['whatsFloat', 'contactWhats', 'footerWhats'].forEach(id => { const a = $('#' + id); if (a) a.href = hello; });
  const vip = $('#vipLink');
  vip.href = CONFIG.vipLink || waLink('Olá! Quero entrar no Grupo VIP da Garota Mais.');

  $('#year').textContent = new Date().getFullYear();

  // Filtros
  $('#sizeFilter').addEventListener('change', e => { state.size = e.target.value; renderProducts(); });
  $('#sortFilter').addEventListener('change', e => { state.sort = e.target.value; renderProducts(); });
  $('#clearFilters').addEventListener('click', () => {
    Object.assign(state, { cat: 'todos', size: '', sort: 'relevancia', q: '', saleOnly: false });
    $('#sizeFilter').value = ''; $('#sortFilter').value = 'relevancia'; $('#searchInput').value = '';
    renderChips(); renderProducts();
  });
  $('[data-filter-sale]').addEventListener('click', () => {
    Object.assign(state, { cat: 'todos', saleOnly: true, sort: 'desconto' });
    $('#sortFilter').value = 'desconto';
    renderChips(); renderProducts();
  });

  // Busca
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

  // Menu mobile
  const nav = $('#nav');
  $('#menuToggle').addEventListener('click', () => { nav.classList.toggle('open'); $('#overlay').classList.toggle('show', nav.classList.contains('open')); });
  $$('#nav a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('open'); $('#overlay').classList.remove('show'); }));

  // Sacola
  $('#cartToggle').addEventListener('click', openCart);
  $('#cartClose').addEventListener('click', closeCart);
  $('#overlay').addEventListener('click', () => { closeCart(); nav.classList.remove('open'); $('#overlay').classList.remove('show'); });
  $('#cartItems').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b) cartAction(b.dataset.act, +b.dataset.i);
  });
  $('#clearCart').addEventListener('click', () => { cart = []; saveCart(); renderCart(); });
  $('#checkoutBtn').addEventListener('click', checkout);

  // Modal
  $('#modalClose').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  $('#modalAdd').addEventListener('click', () => {
    if (!chosenSize) { $('#modalErr').hidden = false; return; }
    addToCart(current, chosenSize);
    closeModal();
    toast('Adicionado à sacola');
    openCart();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeCart(); } });

  // Formulário de contato
  $('#contactForm').addEventListener('submit', e => {
    e.preventDefault();
    const msg = `Olá! Meu nome é ${$('#cfName').value.trim()}.\n${$('#cfMsg').value.trim()}`;
    window.open(waLink(msg), '_blank', 'noopener');
  });

  // Header com sombra ao rolar
  window.addEventListener('scroll', () => {
    $('#header').style.boxShadow = window.scrollY > 10 ? '0 4px 20px rgba(74,22,32,.08)' : 'none';
  }, { passive: true });
}

document.addEventListener('DOMContentLoaded', init);
