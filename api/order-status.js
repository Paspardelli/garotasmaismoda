'use strict';
/* GET /api/order-status?code=GM-XXXXXXXX
   Consulta pública de um pedido pelo código. Devolve só o necessário
   (sem e-mail, telefone ou endereço). */
const { sb, send, getSettings } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Método não permitido' });
  try {
    const code = String(req.query?.code || '').trim().toUpperCase();
    if (!/^GM-[A-Z0-9]{8}$/.test(code)) return send(res, 400, { error: 'Código inválido.' });

    const rows = await sb(`orders?code=eq.${code}&select=code,status,payment_status,delivery_type,subtotal,shipping,total,items,customer_name,pay_url,created_at`);
    const o = rows && rows[0];
    if (!o) return send(res, 404, { error: 'Pedido não encontrado.' });

    const settings = await getSettings().catch(() => ({}));
    return send(res, 200, {
      code: o.code,
      status: o.status,
      payment_status: o.payment_status,
      delivery_type: o.delivery_type,
      subtotal: o.subtotal,
      shipping: o.shipping,
      total: o.total,
      first_name: String(o.customer_name || '').split(' ')[0],
      created_at: o.created_at,
      items: (o.items || []).map(i => ({ name: i.name, size: i.size, color: i.color || '', qty: i.qty, price: i.price, image: i.image || null })),
      pay_url: o.status === 'aguardando_pagamento' ? o.pay_url : null,
      pickup_address: settings.pickup_address || '',
      whatsapp: settings.whatsapp || ''
    });
  } catch (err) {
    console.error('order-status:', err);
    return send(res, 500, { error: 'Erro ao consultar o pedido.' });
  }
};
