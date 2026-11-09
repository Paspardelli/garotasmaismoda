'use strict';
/* POST /api/create-checkout
   Recebe carrinho + dados do cliente, confere preços e estoque NO SERVIDOR,
   cria o pedido e devolve o link de pagamento do Mercado Pago. */
const { sb, send, siteUrl, getSettings, genCode } = require('./_lib');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const digits = s => String(s ?? '').replace(/\D/g, '');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Método não permitido' });

  try {
    if (!process.env.MP_ACCESS_TOKEN) return send(res, 500, { error: 'Pagamento ainda não configurado na loja.' });

    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    /* ---- Dados do cliente ---- */
    const name = clean(b.customer?.name, 80);
    const email = clean(b.customer?.email, 120).toLowerCase();
    const phone = digits(b.customer?.phone);
    if (name.length < 3) return send(res, 400, { error: 'Informe seu nome completo.' });
    if (!EMAIL.test(email)) return send(res, 400, { error: 'E-mail inválido.' });
    if (phone.length < 10 || phone.length > 13) return send(res, 400, { error: 'Telefone inválido. Use DDD + número.' });

    /* ---- Entrega ---- */
    const type = b.delivery?.type === 'entrega' ? 'entrega' : 'retirada';
    let address = null;
    if (type === 'entrega') {
      const a = b.delivery?.address || {};
      address = {
        cep: digits(a.cep).slice(0, 8),
        street: clean(a.street, 120),
        number: clean(a.number, 12),
        complement: clean(a.complement, 60),
        district: clean(a.district, 80),
        city: clean(a.city, 80),
        state: clean(a.state, 2).toUpperCase()
      };
      if (address.cep.length !== 8 || !address.street || !address.number || !address.district || !address.city || address.state.length !== 2) {
        return send(res, 400, { error: 'Preencha o endereço de entrega completo.' });
      }
    }

    /* ---- Itens (junta duplicados) ---- */
    if (!Array.isArray(b.items) || !b.items.length || b.items.length > 30) {
      return send(res, 400, { error: 'Sua sacola está vazia.' });
    }
    const merged = new Map();
    for (const it of b.items) {
      const id = String(it.id || '');
      const size = clean(it.size, 8);
      const qty = Number(it.qty);
      if (!UUID.test(id) || !size || !Number.isInteger(qty) || qty < 1 || qty > 10) {
        return send(res, 400, { error: 'Item inválido na sacola.' });
      }
      const key = id + '|' + size;
      merged.set(key, { id, size, qty: (merged.get(key)?.qty || 0) + qty });
    }
    const wanted = [...merged.values()];

    /* ---- Preços e estoque vêm do banco, nunca do navegador ---- */
    const ids = [...new Set(wanted.map(i => i.id))];
    const prods = await sb(`products?id=in.(${ids.join(',')})&active=eq.true&select=id,name,price,stock,images`);
    const byId = new Map((prods || []).map(p => [p.id, p]));

    const items = [];
    for (const w of wanted) {
      const p = byId.get(w.id);
      if (!p) return send(res, 409, { error: 'Uma das peças não está mais disponível. Atualize a sacola.' });
      const available = Number(p.stock?.[w.size] ?? 0);
      if (available < w.qty) {
        return send(res, 409, {
          error: available > 0
            ? `${p.name} (${w.size}): só temos ${available} em estoque.`
            : `${p.name} (${w.size}) acabou de esgotar.`
        });
      }
      items.push({
        id: p.id, name: p.name, size: w.size, qty: w.qty,
        price: Number(p.price), image: (p.images && p.images[0]) || null
      });
    }

    const settings = await getSettings();
    const fee = Number(settings.shipping_fee ?? 0);
    const freeFrom = Number(settings.free_shipping_from ?? 0);
    const subtotal = Math.round(items.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100;
    let shipping = 0;
    if (type === 'entrega' && !(freeFrom > 0 && subtotal >= freeFrom)) shipping = fee;
    const total = Math.round((subtotal + shipping) * 100) / 100;
    if (!(total > 0)) return send(res, 400, { error: 'Total inválido.' });

    /* ---- Cria o pedido ---- */
    const code = genCode();
    const created = await sb('orders', {
      method: 'POST',
      prefer: 'return=representation',
      body: {
        code, customer_name: name, email, phone,
        delivery_type: type, address,
        notes: clean(b.notes, 500) || null,
        items, subtotal, shipping, total
      }
    });
    const order = created[0];

    /* ---- Cria a cobrança no Mercado Pago (Checkout Pro) ---- */
    const site = siteUrl(req);
    const back = `${site}/pedido.html?code=${code}`;
    const mpItems = items.map(i => ({
      id: i.id,
      title: `${i.name} (Tam. ${i.size})`.slice(0, 120),
      quantity: i.qty,
      unit_price: i.price,
      currency_id: 'BRL'
    }));
    if (shipping > 0) mpItems.push({ id: 'frete', title: 'Frete', quantity: 1, unit_price: shipping, currency_id: 'BRL' });

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.MP_ACCESS_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: mpItems,
        payer: {
          name: name.split(' ')[0],
          surname: name.split(' ').slice(1).join(' ') || undefined,
          email,
          phone: { area_code: phone.slice(0, 2), number: phone.slice(2) }
        },
        external_reference: order.id,
        back_urls: { success: back, pending: back, failure: back },
        auto_return: 'approved',
        notification_url: `${site}/api/mp-webhook`,
        statement_descriptor: 'GAROTA MAIS'
      })
    });
    const pref = await mpRes.json().catch(() => ({}));

    if (!mpRes.ok || !pref.init_point) {
      console.error('Mercado Pago recusou a preferência:', mpRes.status, JSON.stringify(pref));
      await sb(`orders?id=eq.${order.id}`, { method: 'PATCH', body: { status: 'cancelado', payment_status: 'erro' } }).catch(() => {});
      return send(res, 502, { error: 'Não foi possível iniciar o pagamento agora. Tente de novo em instantes.' });
    }

    await sb(`orders?id=eq.${order.id}`, {
      method: 'PATCH',
      body: { mp_preference_id: pref.id, pay_url: pref.init_point }
    });

    return send(res, 200, { code, url: pref.init_point });
  } catch (err) {
    console.error('create-checkout:', err);
    return send(res, 500, { error: 'Erro ao finalizar o pedido. Tente novamente.' });
  }
};
