/* =========================================================
   Garota Mais — checkout (checkout.html)
   Os preços e o estoque são conferidos de novo no servidor.
   ========================================================= */
(function () {
  'use strict';

  const GM = window.GM;
  const { brl, esc } = GM;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const GRADS = [
    ['#b79a9e', '#7a2e3b'], ['#8b2b3d', '#4a1620'], ['#5b6b8c', '#2c3552'],
    ['#d3a9ae', '#9c5560'], ['#c9a35d', '#7a2e3b'], ['#6e4a3a', '#2a1a1d']
  ];

  let DATA = { categories: [], products: [], settings: {} };
  let cart = GM.ls.get('gm_cart', []);
  let busy = false;

  const byId = id => DATA.products.find(p => p.id === id);
  const gradient = p => {
    const i = DATA.categories.findIndex(c => c.slug === p.category_slug);
    const g = GRADS[(i < 0 ? 0 : i) % GRADS.length];
    return `linear-gradient(160deg, ${g[0]}, ${g[1]})`;
  };
  const saveCart = () => GM.ls.set('gm_cart', cart);
  const digits = s => String(s || '').replace(/\D/g, '');
  const deliveryType = () => ($('input[name="delivery"]:checked') || {}).value || 'retirada';

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2400);
  }

  /* ---------- carrinho validado com o estoque ---------- */
  function sanitizeCart() {
    let changed = false;
    cart = cart.filter(it => {
      const p = byId(it.id);
      const max = p ? GM.stockOf(p, it.color || '', it.size) : 0;
      if (max <= 0) { changed = true; return false; }
      if (it.qty > max) { it.qty = max; changed = true; }
      return true;
    });
    saveCart();
    return changed;
  }

  /* ---------- totais ---------- */
  function totals() {
    const subtotal = cart.reduce((s, it) => { const p = byId(it.id); return s + (p ? p.price * it.qty : 0); }, 0);
    const fee = Number(DATA.settings.shipping_fee) || 0;
    const freeFrom = Number(DATA.settings.free_shipping_from) || 0;
    const isDelivery = deliveryType() === 'entrega';
    const free = freeFrom > 0 && subtotal >= freeFrom;
    const shipping = isDelivery && !free ? fee : 0;
    return { subtotal, shipping, total: subtotal + shipping, free, fee, freeFrom, isDelivery };
  }

  function renderSummary() {
    const box = $('#ckItems');
    box.innerHTML = cart.map((it, idx) => {
      const p = byId(it.id);
      if (!p) return '';
      const max = GM.stockOf(p, it.color || '', it.size);
      const img = GM.colorImage(p, it.color || '');
      return `<div class="sum">
        <div class="sum__img" style="background:${gradient(p)}">${img ? `<img src="${esc(img)}" alt="">` : ''}</div>
        <div>
          <div class="sum__name">${esc(p.name)}</div>
          <div class="sum__meta">${it.color ? esc(it.color) + ' · ' : ''}Tamanho ${esc(it.size)}</div>
          <div class="qty">
            <button type="button" data-act="minus" data-i="${idx}" aria-label="Diminuir">−</button>
            <span>${it.qty}</span>
            <button type="button" data-act="plus" data-i="${idx}" aria-label="Aumentar" ${it.qty >= max ? 'disabled' : ''}>+</button>
          </div>
        </div>
        <div><div class="sum__price">${brl(p.price * it.qty)}</div>
          <button type="button" class="sum__rm" data-act="rm" data-i="${idx}">remover</button></div>
      </div>`;
    }).join('');

    const t = totals();
    $('#tSub').textContent = brl(t.subtotal);
    $('#tShip').textContent = t.isDelivery ? (t.shipping === 0 ? 'Grátis' : brl(t.shipping)) : 'Retirada · Grátis';
    $('#tTotal').textContent = brl(t.total);
    $('#ckBtnTotal').textContent = brl(t.total);
    $('#tInst').textContent = t.total > 0 ? `ou até 3x de ${brl(t.total / 3)} sem juros no cartão*` : '';

    // textos do bloco de entrega
    $('#pickupInfo').textContent = DATA.settings.pickup_address || '';
    $('#shipPrice').textContent = t.free ? 'Grátis' : brl(t.fee);
    $('#shipInfo').textContent = t.freeFrom > 0
      ? (t.free ? 'Frete grátis nesta compra' : `Frete grátis acima de ${brl(t.freeFrom)}`)
      : 'Enviamos para você';

    const empty = cart.length === 0;
    $('.ck__layout').hidden = empty;
    $('#ckEmpty').hidden = !empty;
  }

  /* ---------- máscaras ---------- */
  function maskPhone(v) {
    const d = digits(v).slice(0, 11);
    if (d.length <= 2) return d ? '(' + d : '';
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  function maskCep(v) {
    const d = digits(v).slice(0, 8);
    return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
  }

  async function lookupCep() {
    const cep = digits($('#fCep').value);
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = await r.json();
      if (d.erro) return;
      if (d.logradouro) $('#fStreet').value = d.logradouro;
      if (d.bairro) $('#fDistrict').value = d.bairro;
      if (d.localidade) $('#fCity').value = d.localidade;
      if (d.uf) $('#fState').value = d.uf;
      $('#fNumber').focus();
    } catch (e) { /* preenche na mão */ }
  }

  /* ---------- validação ---------- */
  function setErr(id, msg) {
    const input = document.getElementById(id);
    const err = $(`.field__err[data-for="${id}"]`);
    if (input && input.closest('.field')) input.closest('.field').classList.toggle('invalid', !!msg);
    if (err) err.textContent = msg || '';
    return !msg;
  }
  function validate() {
    let ok = true;
    const name = $('#fName').value.trim();
    ok = setErr('fName', name.length < 3 || !name.includes(' ') ? 'Informe nome e sobrenome.' : '') && ok;
    ok = setErr('fEmail', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test($('#fEmail').value.trim()) ? '' : 'E-mail inválido.') && ok;
    const ph = digits($('#fPhone').value);
    ok = setErr('fPhone', ph.length >= 10 && ph.length <= 11 ? '' : 'Informe DDD + número.') && ok;
    if (deliveryType() === 'entrega') {
      ok = setErr('fCep', digits($('#fCep').value).length === 8 ? '' : 'CEP inválido.') && ok;
      ok = setErr('fStreet', $('#fStreet').value.trim() ? '' : 'Informe a rua.') && ok;
      ok = setErr('fNumber', $('#fNumber').value.trim() ? '' : 'Informe o número.') && ok;
      ok = setErr('fDistrict', $('#fDistrict').value.trim() ? '' : 'Informe o bairro.') && ok;
      ok = setErr('fCity', $('#fCity').value.trim() ? '' : 'Informe a cidade.') && ok;
      ok = setErr('fState', /^[A-Za-z]{2}$/.test($('#fState').value.trim()) ? '' : 'UF.') && ok;
    }
    const terms = $('#fTerms');
    const tErr = $('.field__err[data-for="fTerms"]');
    tErr.textContent = terms.checked ? '' : 'Confirme para continuar.';
    ok = terms.checked && ok;
    return ok;
  }

  /* ---------- dados salvos ---------- */
  function prefill() {
    const c = GM.ls.get('gm_customer', null);
    if (!c) return;
    $('#fName').value = c.name || '';
    $('#fEmail').value = c.email || '';
    $('#fPhone').value = c.phone || '';
    if (c.address) {
      $('#fCep').value = c.address.cep || '';
      $('#fStreet').value = c.address.street || '';
      $('#fNumber').value = c.address.number || '';
      $('#fComplement').value = c.address.complement || '';
      $('#fDistrict').value = c.address.district || '';
      $('#fCity').value = c.address.city || '';
      $('#fState').value = c.address.state || '';
    }
  }

  function showError(msg) {
    const e = $('#ckError');
    e.textContent = msg;
    e.hidden = !msg;
    if (msg) e.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ---------- envio ---------- */
  async function submit(ev) {
    ev.preventDefault();
    if (busy) return;
    showError('');
    if (!cart.length) return;
    if (!validate()) {
      const first = $('.field.invalid input') || $('#fTerms');
      if (first) first.focus();
      return;
    }

    const type = deliveryType();
    const address = type === 'entrega' ? {
      cep: digits($('#fCep').value),
      street: $('#fStreet').value.trim(),
      number: $('#fNumber').value.trim(),
      complement: $('#fComplement').value.trim(),
      district: $('#fDistrict').value.trim(),
      city: $('#fCity').value.trim(),
      state: $('#fState').value.trim().toUpperCase()
    } : null;

    const customer = { name: $('#fName').value.trim(), email: $('#fEmail').value.trim(), phone: $('#fPhone').value.trim() };
    GM.ls.set('gm_customer', { ...customer, address: address || (GM.ls.get('gm_customer', {}) || {}).address });

    const btn = $('#ckSubmit');
    const label = btn.innerHTML;
    busy = true;
    btn.disabled = true;
    btn.textContent = 'Processando…';

    try {
      const res = await GM.createOrder({
        customer,
        delivery: { type, address },
        notes: $('#fNotes').value.trim(),
        items: cart.map(i => ({ id: i.id, size: i.size, color: i.color || '', qty: i.qty }))
      });
      GM.ls.set('gm_last_order', res.code);
      location.href = res.url;
    } catch (err) {
      showError(err.message || 'Não foi possível finalizar. Tente novamente.');
      busy = false;
      btn.disabled = false;
      btn.innerHTML = label;
      // estoque pode ter mudado: recarrega e ajusta a sacola
      try { DATA = await GM.getCatalog(); sanitizeCart(); renderSummary(); } catch (e) {}
    }
  }

  /* ---------- início ---------- */
  async function init() {
    if (!GM.LIVE) $('#demoNote').hidden = false;

    try {
      DATA = await GM.getCatalog();
    } catch (e) {
      $('#ckEmpty').hidden = false;
      $('#ckEmpty h1').textContent = 'Não foi possível carregar';
      $('#ckEmpty p').textContent = 'Verifique sua conexão e tente de novo.';
      $('.ck__layout').hidden = true;
      return;
    }
    if (sanitizeCart()) toast('Ajustamos sua sacola conforme o estoque');
    prefill();
    renderSummary();

    $('#ckItems').addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const it = cart[+b.dataset.i];
      if (!it) return;
      const p = byId(it.id);
      const max = p ? GM.stockOf(p, it.color || '', it.size) : 0;
      if (b.dataset.act === 'plus' && it.qty < max) it.qty++;
      if (b.dataset.act === 'minus') it.qty = Math.max(1, it.qty - 1);
      if (b.dataset.act === 'rm') cart.splice(+b.dataset.i, 1);
      saveCart();
      renderSummary();
    });

    $$('input[name="delivery"]').forEach(r => r.addEventListener('change', () => {
      $('#addressBox').hidden = deliveryType() !== 'entrega';
      renderSummary();
    }));

    $('#fPhone').addEventListener('input', e => { e.target.value = maskPhone(e.target.value); });
    $('#fCep').addEventListener('input', e => { e.target.value = maskCep(e.target.value); if (digits(e.target.value).length === 8) lookupCep(); });
    $('#fState').addEventListener('input', e => { e.target.value = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase(); });
    $$('.field input').forEach(i => i.addEventListener('input', () => setErr(i.id, '')));

    $('#ckForm').addEventListener('submit', submit);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
