/* =========================================================
   Garota Mais — página do produto (produto.html?id=...)
   Galeria, cores, tamanhos, quantidade e peças sugeridas.
   ========================================================= */
(function () {
  'use strict';

  const GM = window.GM;
  const S = window.GMShop;
  const { brl, esc, discount, totalStock, colorsOf, stockOf, colorStock, sizesOf, sizeAvailable } = GM;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const root = () => $('#pdpRoot');
  const id = new URLSearchParams(location.search).get('id');

  let DATA = { categories: [], products: [], settings: {} };
  let P = null;
  const sel = { color: '', size: '', qty: 1, idx: 0 };
  let gotoImg = () => {};

  /* ---------- estados ---------- */
  function notFound(msg) {
    document.title = 'Produto não encontrado | Garota Mais';
    root().innerHTML = `<div class="pdp-empty">
      <h1>${esc(msg || 'Produto não encontrado')}</h1>
      <p>Essa peça pode ter saído da loja. Veja o que temos de novo:</p>
      <a class="btn btn--primary" href="index.html#catalogo">Ver produtos</a></div>`;
  }

  /* ---------- seleção ---------- */
  function currentMax() {
    if (!sel.size) return 0;
    if (colorsOf(P).length && !sel.color) return 0;
    return stockOf(P, sel.color, sel.size);
  }

  function refreshOptions() {
    // cores
    $$('.swatch').forEach(b => {
      const out = colorStock(P, b.dataset.color) === 0;
      b.classList.toggle('on', b.dataset.color === sel.color);
      b.classList.toggle('out', out);
      b.disabled = out;
    });
    const cn = $('#colorName');
    if (cn) cn.textContent = sel.color || 'selecione';

    // tamanhos (conforme a cor escolhida)
    if (sel.size && !sizeAvailable(P, sel.size, sel.color)) sel.size = '';
    $$('.size').forEach(b => {
      const ok = sizeAvailable(P, b.dataset.size, sel.color);
      b.classList.toggle('out', !ok);
      b.disabled = !ok;
      b.classList.toggle('active', b.dataset.size === sel.size);
    });
    $('#sizeName').textContent = sel.size || 'selecione';

    // dica de estoque e quantidade
    const max = currentMax();
    const hint = $('#hint');
    hint.textContent = max > 0 && max <= 3 ? (max === 1 ? 'Última unidade!' : `Restam apenas ${max} unidades`) : '';
    sel.qty = Math.max(1, Math.min(sel.qty, Math.min(10, max || 10)));
    $('#qtyVal').textContent = sel.qty;
    $('#qtyPlus').disabled = max > 0 && sel.qty >= Math.min(10, max);
    $('#qtyMinus').disabled = sel.qty <= 1;
    $('#selErr').hidden = true;
  }

  function validate() {
    if (colorsOf(P).length && !sel.color) return 'Escolha a cor.';
    if (!sel.size) return 'Escolha o tamanho.';
    return '';
  }

  function add(buyNow) {
    const err = validate();
    if (err) {
      const e = $('#selErr');
      e.textContent = err;
      e.hidden = false;
      $('#optBlock').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const r = S.addToCart(P, sel.color, sel.size, sel.qty);
    if (buyNow) { location.href = 'checkout.html'; return; }
    if (!r.ok) { S.toast('Você já tem todas as unidades disponíveis na sacola'); S.openCart(); return; }
    S.toast(r.capped ? 'Adicionamos as unidades disponíveis' : 'Adicionado à sacola');
    S.openCart();
  }

  /* ---------- galeria ---------- */
  function setActive(i) {
    sel.idx = i;
    $$('.pdp__thumb').forEach((t, k) => t.classList.toggle('on', k === i));
    $$('#dots i').forEach((d, k) => d.classList.toggle('on', k === i));
  }
  function bindGallery() {
    const track = $('#track');
    const n = P.images.length;
    if (!track || !n) return;
    gotoImg = i => {
      i = Math.max(0, Math.min(n - 1, i));
      track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
      setActive(i);
    };
    track.addEventListener('scroll', () => {
      const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      if (i !== sel.idx) setActive(i);
    }, { passive: true });
    track.addEventListener('click', e => {
      const img = e.target.closest('.pdp__slide img');
      if (!img) return;
      $('#lbImg').src = img.src;
      $('#lightbox').hidden = false;
    });
  }

  /* ---------- montagem da página ---------- */
  function galleryHtml() {
    const imgs = P.images;
    const d = discount(P);
    const out = totalStock(P) === 0;
    const slides = imgs.length
      ? imgs.map((src, i) => `<div class="pdp__slide"><img src="${esc(src)}" alt="${esc(P.name)} - foto ${i + 1}" ${i ? 'loading="lazy"' : ''}></div>`).join('')
      : `<div class="pdp__slide pdp__slide--ph" style="background:${S.gradient(P)}"><span>${esc(P.name)}</span></div>`;
    const multi = imgs.length > 1;
    return `<div class="pdp__gallery">
      <div class="pdp__thumbs">${multi ? imgs.map((src, i) => `<button class="pdp__thumb ${i === 0 ? 'on' : ''}" data-thumb="${i}" aria-label="Foto ${i + 1}"><img src="${esc(src)}" alt=""></button>`).join('') : ''}</div>
      <div class="pdp__stage">
        <div class="pdp__badges">
          ${out ? '<span class="tag tag--out">Esgotado</span>' : (d ? `<span class="tag">-${d}%</span>` : '')}
          ${P.is_new && !out ? '<span class="tag tag--new">Novo</span>' : ''}
        </div>
        <div class="pdp__track" id="track">${slides}</div>
        ${multi ? '<button class="pdp__nav pdp__nav--prev" data-nav="-1" aria-label="Foto anterior">‹</button><button class="pdp__nav pdp__nav--next" data-nav="1" aria-label="Próxima foto">›</button>' : ''}
        <div class="pdp__dots" id="dots">${multi ? imgs.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('') : ''}</div>
      </div>
    </div>`;
  }

  function infoHtml() {
    const p = P;
    const cols = colorsOf(p);
    const sizes = sizesOf(p);
    const d = discount(p);
    const out = totalStock(p) === 0;
    const s = DATA.settings;
    const fee = Number(s.shipping_fee) || 0;
    const free = Number(s.free_shipping_from) || 0;
    const fav = S.isFav(p.id);

    return `<div class="pdp__info">
      <div class="pdp__eyebrow">${esc(S.catName(p.category_slug))}</div>
      <div class="pdp__titlebar">
        <h1>${esc(p.name)}</h1>
        <button class="fav-btn" data-fav="${esc(p.id)}" aria-label="Favoritar">${fav ? '♥' : '♡'}</button>
      </div>
      <div class="pdp__price">
        <strong>${brl(p.price)}</strong>${p.old_price ? `<s>${brl(p.old_price)}</s>` : ''}${d ? `<span class="pdp__off">${d}% OFF</span>` : ''}
      </div>
      <p class="pdp__inst">ou <strong>3x de ${brl(p.price / 3)}</strong> sem juros no cartão</p>

      <div id="optBlock">
        ${cols.length ? `<div class="pdp__opt">
          <div class="pdp__optlabel">Cor: <strong id="colorName">selecione</strong></div>
          <div class="swatches" id="swatches">${cols.map(c => `<button class="swatch" data-color="${esc(c.name)}" title="${esc(c.name)}" aria-label="${esc(c.name)}" style="--c:${S.safeHex(c.hex)}"><i></i></button>`).join('')}</div>
        </div>` : ''}
        <div class="pdp__opt">
          <div class="pdp__optlabel">Tamanho: <strong id="sizeName">selecione</strong></div>
          <div class="sizes" id="sizes">${sizes.map(z => `<button class="size" data-size="${esc(z)}">${esc(z)}</button>`).join('')}</div>
          <p class="pdp__hint" id="hint"></p>
          <p class="modal__err" id="selErr" hidden></p>
        </div>
      </div>

      <div class="pdp__buy">
        <div class="qty qty--lg" aria-label="Quantidade">
          <button type="button" id="qtyMinus" aria-label="Diminuir">−</button>
          <span id="qtyVal">1</span>
          <button type="button" id="qtyPlus" aria-label="Aumentar">+</button>
        </div>
        <button class="btn btn--primary btn--lg" id="addBtn" ${out ? 'disabled' : ''}>${out ? 'Esgotado' : 'Adicionar à sacola'}</button>
      </div>
      ${out ? '' : '<button class="btn btn--ghost btn--block btn--lg" id="buyNow">Comprar agora</button>'}
      <a class="pdp__wa" target="_blank" rel="noopener" href="${S.waLink(out ? `Olá! A peça "${p.name}" vai voltar ao estoque?` : `Olá! Tenho uma dúvida sobre a peça "${p.name}": ${location.href}`)}">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/></svg>
        ${out ? 'Perguntar sobre reposição no WhatsApp' : 'Tirar dúvidas no WhatsApp'}
      </a>

      <ul class="pdp__perks">
        <li><span>📍</span><div><strong>Retire grátis na loja</strong><small>${esc(s.pickup_address || 'Pátio 330 · Americana-SP')}</small></div></li>
        <li><span>🔒</span><div><strong>Pagamento seguro</strong><small>Pix ou cartão pelo Mercado Pago</small></div></li>
        <li><span>💬</span><div><strong>Atendimento no WhatsApp</strong><small>Dúvidas sobre medidas e caimento</small></div></li>
      </ul>

      <details class="acc" open>
        <summary>Descrição</summary>
        <p>${p.description ? esc(p.description) : 'Peça da coleção Garota Mais.'}</p>
      </details>
      <details class="acc">
        <summary>Pagamento e entrega</summary>
        <ul>
          <li>Retirada na loja: <strong>grátis</strong>.</li>
          <li>Entrega: ${brl(fee)}${free > 0 ? `, grátis em compras acima de ${brl(free)}` : ''}.</li>
          <li>Pagamento por Pix ou cartão de crédito, no ambiente seguro do Mercado Pago.</li>
        </ul>
      </details>
      <button class="linklike" id="shareBtn" type="button">Compartilhar esta peça</button>
    </div>`;
  }

  function relatedSections() {
    const avail = DATA.products.filter(x => x.id !== P.id && totalStock(x) > 0);
    const sameCat = avail.filter(x => x.category_slug === P.category_slug);
    const others = avail.filter(x => x.category_slug !== P.category_slug)
      .sort((a, b) => (Number(b.is_new) - Number(a.is_new)) || (Number(b.featured) - Number(a.featured)));

    // 1) você também pode gostar (mesma categoria; completa com outras)
    const rel = [...sameCat, ...others].slice(0, 4);
    const shown = new Set(rel.map(x => x.id));
    // 2) mais peças
    const more = avail.filter(x => !shown.has(x.id))
      .sort((a, b) => (Number(b.is_new) - Number(a.is_new)) || (Number(b.featured) - Number(a.featured))).slice(0, 8);
    more.forEach(x => shown.add(x.id));
    // 3) vistos recentemente
    const recent = GM.ls.get('gm_recent_prev', []).map(i => DATA.products.find(x => x.id === i)).filter(x => x && x.id !== P.id).slice(0, 4);

    const sec = (eyebrow, title, list) => list.length ? `<section class="related">
      <div class="section__head"><span class="eyebrow">${eyebrow}</span><h2>${title}</h2></div>
      <div class="grid">${list.map(S.cardHtml).join('')}</div></section>` : '';

    return sec('Combine com', 'Você também pode gostar', rel)
      + sec('Continue olhando', 'Mais peças para você', more)
      + sec('Para rever', 'Vistos recentemente', recent);
  }

  function render() {
    const cat = DATA.categories.find(c => c.slug === P.category_slug);
    document.title = `${P.name} | Garota Mais`;
    const meta = $('meta[name="description"]');
    if (meta) meta.content = `${P.name} por ${brl(P.price)}. ${P.description || ''}`.trim().slice(0, 160);

    root().innerHTML = `
      <nav class="crumbs" aria-label="Você está em">
        <a href="index.html">Início</a><span>›</span>
        ${cat ? `<a href="index.html?cat=${encodeURIComponent(cat.slug)}#catalogo">${esc(cat.name)}</a><span>›</span>` : ''}
        <strong>${esc(P.name)}</strong>
      </nav>
      <div class="pdp">${galleryHtml()}${infoHtml()}</div>
      ${relatedSections()}
      <div class="pdp__bar" id="bar">
        <div><small>${P.old_price ? brl(P.old_price) : ''}</small><strong>${brl(P.price)}</strong></div>
        <button class="btn btn--primary" id="barAdd" ${totalStock(P) === 0 ? 'disabled' : ''}>${totalStock(P) === 0 ? 'Esgotado' : 'Adicionar à sacola'}</button>
      </div>`;

    // pré-seleção quando só existe uma opção
    const cols = colorsOf(P);
    if (cols.length === 1 && colorStock(P, cols[0].name) > 0) sel.color = cols[0].name;
    const sizes = sizesOf(P);
    if (sizes.length === 1 && sizeAvailable(P, sizes[0], sel.color)) sel.size = sizes[0];

    bindGallery();
    refreshOptions();
  }

  /* ---------- eventos ---------- */
  function bindEvents() {
    root().addEventListener('click', e => {
      const t = e.target;
      let el;
      if ((el = t.closest('[data-fav]'))) { S.toggleFav(el.dataset.fav); return; }
      if ((el = t.closest('.swatch'))) {
        if (el.disabled) return;
        sel.color = el.dataset.color;
        const c = colorsOf(P).find(x => x.name === sel.color);
        if (c && Number.isInteger(c.img) && P.images[c.img]) gotoImg(c.img);
        refreshOptions();
        return;
      }
      if ((el = t.closest('.size'))) {
        if (el.disabled) return;
        sel.size = el.dataset.size;
        refreshOptions();
        return;
      }
      if (t.closest('#qtyPlus')) { sel.qty++; refreshOptions(); return; }
      if (t.closest('#qtyMinus')) { sel.qty--; refreshOptions(); return; }
      if (t.closest('#addBtn') || t.closest('#barAdd')) { add(false); return; }
      if (t.closest('#buyNow')) { add(true); return; }
      if ((el = t.closest('[data-thumb]'))) { gotoImg(+el.dataset.thumb); return; }
      if ((el = t.closest('[data-nav]'))) { gotoImg(sel.idx + (+el.dataset.nav)); return; }
      if (t.closest('#shareBtn')) {
        const url = location.href;
        if (navigator.share) navigator.share({ title: P.name, url }).catch(() => {});
        else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => S.toast('Link copiado'));
      }
    });

    const lb = $('#lightbox');
    lb.addEventListener('click', () => { lb.hidden = true; });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') lb.hidden = true;
      if (!P || !P.images.length || document.activeElement.matches('input,textarea,select')) return;
      if (e.key === 'ArrowRight') gotoImg(sel.idx + 1);
      if (e.key === 'ArrowLeft') gotoImg(sel.idx - 1);
    });
  }

  /* ---------- início ---------- */
  async function init() {
    S.initChrome({});
    bindEvents();
    if (!id) { notFound(); return; }
    try {
      DATA = await GM.getCatalog();
    } catch (err) {
      notFound('Não foi possível carregar o produto');
      return;
    }
    S.setData(DATA);
    S.sanitizeCart();
    S.applySettings();
    S.renderCart();

    P = DATA.products.find(x => x.id === id);
    if (!P) { notFound(); return; }

    // "vistos recentemente": guarda a lista anterior para exibir e atualiza a nova
    const prev = GM.ls.get('gm_recent', []).filter(x => x !== P.id);
    GM.ls.set('gm_recent_prev', prev);
    GM.ls.set('gm_recent', [P.id, ...prev].slice(0, 12));

    render();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
