'use strict';
/* POST /api/mp-webhook — avisos de pagamento do Mercado Pago.
   1) valida a assinatura (MP_WEBHOOK_SECRET)
   2) consulta o pagamento direto na API do Mercado Pago
   3) confere valor e atualiza o pedido; se aprovado, baixa o estoque */
const crypto = require('crypto');
const { sb, send, getSettings, brl, escHtml, sendEmail } = require('./_lib');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validSignature(req, dataId, secret) {
  const header = String(req.headers['x-signature'] || '');
  const requestId = String(req.headers['x-request-id'] || '');
  const parts = {};
  header.split(',').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) parts[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  });
  if (!parts.ts || !parts.v1 || !dataId) return false;
  const manifest = `id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function orderEmailHtml(order, settings) {
  const rows = order.items.map(i =>
    `<tr><td style="padding:6px 0">${i.qty}x ${escHtml(i.name)} (${i.color ? escHtml(i.color) + ', ' : ''}Tam. ${escHtml(i.size)})</td><td style="padding:6px 0;text-align:right">${brl(i.price * i.qty)}</td></tr>`
  ).join('');
  const where = order.delivery_type === 'retirada'
    ? `Retirada na loja: ${escHtml(settings.pickup_address || '')}`
    : `Entrega: ${escHtml(order.address?.street || '')}, ${escHtml(order.address?.number || '')} - ${escHtml(order.address?.district || '')}, ${escHtml(order.address?.city || '')}/${escHtml(order.address?.state || '')}`;
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#2a1a1d">
    <h2 style="color:#7a2e3b">Garota Mais</h2>
    <p>Olá, ${escHtml(order.customer_name.split(' ')[0])}! Recebemos o pagamento do pedido <strong>${escHtml(order.code)}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #eadcde;border-bottom:1px solid #eadcde">${rows}
      <tr><td style="padding:6px 0">Frete</td><td style="text-align:right">${brl(order.shipping)}</td></tr>
      <tr><td style="padding:6px 0"><strong>Total</strong></td><td style="text-align:right"><strong>${brl(order.total)}</strong></td></tr></table>
    <p>${where}</p>
    <p>Avisaremos quando estiver pronto. Dúvidas? Fale com a gente no WhatsApp.</p></div>`;
}

module.exports = async (req, res) => {
  try {
    const secret = process.env.MP_WEBHOOK_SECRET;
    const token = process.env.MP_ACCESS_TOKEN;
    if (!secret || !token) return send(res, 500, { error: 'config' });

    const url = new URL(req.url, 'http://localhost');
    const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch (e) { return {}; } })() : (req.body || {});
    const dataId = url.searchParams.get('data.id') || body?.data?.id;
    const type = url.searchParams.get('type') || url.searchParams.get('topic') || body?.type;

    if (!validSignature(req, dataId, secret)) return send(res, 401, { error: 'assinatura inválida' });
    if (type !== 'payment') return send(res, 200, { ok: true, ignored: type });

    /* Consulta o pagamento no Mercado Pago (não confia no corpo recebido) */
    const pr = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!pr.ok) return send(res, 502, { error: 'não foi possível consultar o pagamento' });
    const payment = await pr.json();

    const ref = String(payment.external_reference || '');
    if (!UUID.test(ref)) return send(res, 200, { ok: true, ignored: 'sem referência' });

    const rows = await sb(`orders?id=eq.${ref}&select=*`);
    const order = rows && rows[0];
    if (!order) return send(res, 200, { ok: true, ignored: 'pedido não encontrado' });

    const paidAmount = Number(payment.transaction_amount);
    const patch = { payment_status: String(payment.status), mp_payment_id: String(payment.id) };
    let becamePaid = false;

    if (payment.status === 'approved') {
      if (Math.abs(paidAmount - Number(order.total)) > 0.01) {
        patch.payment_status = 'valor_divergente';
        console.error('Valor divergente', order.code, paidAmount, order.total);
      } else if (order.status === 'aguardando_pagamento') {
        patch.status = 'pago';
        becamePaid = true;
      }
    } else if (['cancelled', 'refunded', 'charged_back'].includes(payment.status) && order.status === 'aguardando_pagamento') {
      patch.status = 'cancelado';
    }

    await sb(`orders?id=eq.${order.id}`, { method: 'PATCH', body: patch });

    if (becamePaid) {
      await sb('rpc/apply_order_stock', { method: 'POST', body: { p_order: order.id } });
      const settings = await getSettings().catch(() => ({}));
      const html = orderEmailHtml(order, settings);
      await sendEmail({ to: order.email, subject: `Pagamento confirmado - pedido ${order.code}`, html });
      if (process.env.STORE_NOTIFY_EMAIL) {
        await sendEmail({ to: process.env.STORE_NOTIFY_EMAIL, subject: `Novo pedido pago ${order.code} - ${brl(order.total)}`, html });
      }
    }

    return send(res, 200, { ok: true });
  } catch (err) {
    console.error('mp-webhook:', err);
    return send(res, 500, { error: 'erro interno' }); // o Mercado Pago tenta de novo
  }
};
