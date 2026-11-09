/* =========================================================
   Garota Mais — acompanhamento do pedido (pedido.html)
   Mostra o status e confirma o pagamento quando o cliente volta do
   Mercado Pago (aguarda o aviso automático do webhook).
   ========================================================= */
(function () {
  'use strict';

  const GM = window.GM;
  const { brl, esc } = GM;
  const $ = (s, el = document) => el.querySelector(s);
  const root = () => $('#orderRoot');

  const params = new URLSearchParams(location.search);
  const mpReturn = params.get('collection_status') || params.get('status'); // approved | pending | rejected...
  let code = (params.get('code') || '').toUpperCase();
  let pollTimer = null;
  let polls = 0;

  const FLOW = {
    retirada: [['pago', 'Pago'], ['em_separacao', 'Em separação'], ['pronto_retirada', 'Pronto p/ retirada'], ['entregue', 'Retirado']],
    entrega:  [['pago', 'Pago'], ['em_separacao', 'Em separação'], ['enviado', 'Enviado'], ['entregue', 'Entregue']]
  };

  function lookupForm(msg) {
    root().innerHTML = `<div class="order__hero">
      <div class="order__icon">🔎</div>
      <h1>Acompanhar pedido</h1>
      <p>${esc(msg || 'Digite o código do pedido (ex.: GM-AB12CD34).')}</p>
      <form class="lookup" id="lookupForm">
        <input id="lookupCode" placeholder="GM-XXXXXXXX" maxlength="11" autocomplete="off" required>
        <button class="btn btn--primary" type="submit">Buscar</button>
      </form></div>`;
    $('#lookupForm').addEventListener('submit', e => {
      e.preventDefault();
      const v = $('#lookupCode').value.trim().toUpperCase();
      if (v) location.href = 'pedido.html?code=' + encodeURIComponent(v);
    });
  }

  function waLink(o, text) {
    const num = String(o.whatsapp || GM.C.WHATSAPP || '').replace(/\D/g, '');
    return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
  }

  function hero(o) {
    const s = o.status;
    const first = esc(o.first_name || '');
    if (s === 'cancelado') {
      return { cls: 'bad', icon: '✕', title: 'Pedido cancelado', text: 'Este pedido foi cancelado. Se foi um engano, é só fazer um novo pedido ou falar com a gente.' };
    }
    if (s === 'aguardando_pagamento') {
      if (o.payment_status === 'rejected') {
        return { cls: 'bad', icon: '!', title: 'Pagamento não aprovado', text: `${first}, o pagamento foi recusado. Você pode tentar de novo com outro cartão ou pagar via Pix.` };
      }
      return { cls: '', icon: '⏳', title: 'Aguardando o pagamento', text: o.payment_status === 'in_process' || o.payment_status === 'pending'
        ? 'Estamos aguardando a confirmação do pagamento. Se você pagou via Pix, a confirmação costuma ser imediata.'
        : 'Seu pedido foi criado, mas o pagamento ainda não foi confirmado.' };
    }
    const where = o.delivery_type === 'retirada'
      ? `Retire na loja: ${esc(o.pickup_address || '')}.`
      : 'Vamos enviar para o endereço informado.';
    return { cls: 'ok', icon: '✓', title: `Pagamento confirmado, ${first}!`, text: `Recebemos seu pedido. ${where}` };
  }

  function render(o) {
    const h = hero(o);
    const steps = FLOW[o.delivery_type] || FLOW.retirada;
    const curIdx = steps.findIndex(x => x[0] === o.status);
    const showTimeline = o.status !== 'aguardando_pagamento' && o.status !== 'cancelado';

    const itemsHtml = (o.items || []).map(i => `<div class="sum">
      <div class="sum__img" style="background:linear-gradient(160deg,#b79a9e,#7a2e3b)">${i.image ? `<img src="${esc(i.image)}" alt="">` : ''}</div>
      <div><div class="sum__name">${esc(i.name)}</div><div class="sum__meta">${i.color ? esc(i.color) + ' · ' : ''}Tamanho ${esc(i.size)} · ${i.qty}x</div></div>
      <div class="sum__price">${brl(i.price * i.qty)}</div></div>`).join('');

    const demoBox = (o.demo && o.status === 'aguardando_pagamento') ? `<div class="demo-pay">
      <p><strong>Modo demonstração</strong>: simule o retorno do Mercado Pago.</p>
      <button class="btn btn--primary" id="demoOk">Simular pagamento aprovado</button>
      <button class="btn btn--ghost" id="demoNo">Simular pagamento recusado</button></div>` : '';

    const payBtn = o.pay_url && o.status === 'aguardando_pagamento'
      ? `<a class="btn btn--primary" href="${esc(o.pay_url)}">${o.payment_status === 'rejected' ? 'Tentar pagar de novo' : 'Pagar agora'}</a>` : '';

    root().innerHTML = `
      <div class="order__hero">
        <div class="order__icon ${h.cls}">${h.icon}</div>
        <h1>${h.title}</h1>
        <span class="order__code">${esc(o.code)}</span>
        <p>${h.text}</p>
        <div class="order__actions">
          ${payBtn}
          <a class="btn btn--ghost" target="_blank" rel="noopener" href="${waLink(o, `Olá! Gostaria de falar sobre o pedido ${o.code}.`)}">Falar no WhatsApp</a>
          <a class="btn btn--ghost" href="index.html">Continuar comprando</a>
        </div>
      </div>
      ${demoBox}
      ${showTimeline ? `<ol class="timeline">${steps.map((s, i) => `<li class="${i <= curIdx ? 'done' : ''}">${s[1]}</li>`).join('')}</ol>` : ''}
      <div class="box">
        <h2>Itens do pedido</h2>
        <div class="sum-items" style="max-height:none">${itemsHtml}</div>
        <dl class="totals">
          <div><dt>Subtotal</dt><dd>${brl(o.subtotal)}</dd></div>
          <div><dt>Frete</dt><dd>${o.delivery_type === 'retirada' ? 'Retirada · Grátis' : (Number(o.shipping) === 0 ? 'Grátis' : brl(o.shipping))}</dd></div>
          <div class="totals__final"><dt>Total</dt><dd>${brl(o.total)}</dd></div>
        </dl>
      </div>`;

    if (demoBox) {
      $('#demoOk').addEventListener('click', () => { GM.demoPay(o.code, true); load(); });
      $('#demoNo').addEventListener('click', () => { GM.demoPay(o.code, false); load(); });
    }

    // pedido pago: a sacola já pode ser esvaziada
    if (o.status !== 'aguardando_pagamento' && o.status !== 'cancelado') GM.ls.del('gm_cart');
  }

  async function load() {
    try {
      const o = await GM.getOrder(code);
      render(o);
      // voltou do Mercado Pago como aprovado, mas o aviso automático ainda não chegou
      if (o.status === 'aguardando_pagamento' && !o.demo && mpReturn === 'approved' && polls < 12) {
        polls++;
        clearTimeout(pollTimer);
        pollTimer = setTimeout(load, 3000);
      }
    } catch (err) {
      lookupForm(err.message);
    }
  }

  function init() {
    if (!code) {
      const last = GM.ls.get('gm_last_order', '');
      if (last) { code = last; load(); return; }
      lookupForm();
      return;
    }
    load();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
