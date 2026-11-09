/* =========================================================
   Garota Mais — camada de dados (window.GM)
   - Modo REAL: Supabase (produtos, pedidos, fotos, login do admin)
   - Modo DEMO: localStorage (quando config.js está sem chaves)
   ========================================================= */
(function () {
  'use strict';

  const C = Object.assign(
    { SUPABASE_URL: '', SUPABASE_ANON_KEY: '', STORE_NAME: 'Garota Mais', WHATSAPP: '' },
    window.GM_CONFIG || {}
  );
  const URL_BASE = C.SUPABASE_URL.replace(/\/$/, '');
  const LIVE = !!(URL_BASE && C.SUPABASE_ANON_KEY);

  const SIZE_ORDER = ['P', 'M', 'G', 'G1', 'G2', 'Único'];
  const ORDER_STATUS = {
    aguardando_pagamento: 'Aguardando pagamento',
    pago: 'Pago',
    em_separacao: 'Em separação',
    pronto_retirada: 'Pronto para retirada',
    enviado: 'Enviado',
    entregue: 'Entregue',
    cancelado: 'Cancelado'
  };
  const PAID_STATUSES = ['pago', 'em_separacao', 'pronto_retirada', 'enviado', 'entregue'];
  const DEFAULT_SETTINGS = {
    whatsapp: C.WHATSAPP,
    vip_link: '',
    shipping_fee: 15,
    free_shipping_from: 299,
    pickup_address: 'Pátio 330 · Av. Afonso Pansan, 175 · Bertini · Americana-SP',
    topbar_text: 'BLACK FRIDAY: LOJA TODA COM ATÉ 50% OFF'
  };

  /* ---------- utilidades ---------- */
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const brl = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slugify = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const sizeIdx = s => { const i = SIZE_ORDER.indexOf(s); return i < 0 ? 99 : i; };
  /* Estoque por variação: "Tam" (sem cores) ou "Cor|Tam" (com cores) */
  const variantKey = (color, size) => (color ? color + '|' + size : size);
  const sizePart = k => { const i = k.lastIndexOf('|'); return i < 0 ? k : k.slice(i + 1); };
  const colorsOf = p => (Array.isArray(p.colors) ? p.colors : []);
  const stockOf = (p, color, size) => Number((p.stock || {})[variantKey(color, size)]) || 0;
  const sizesOf = p => [...new Set(Object.keys(p.stock || {}).map(sizePart))].sort((a, b) => sizeIdx(a) - sizeIdx(b));
  const colorStock = (p, color) => Object.keys(p.stock || {}).reduce((s, k) => s + (k.startsWith(color + '|') ? Number(p.stock[k]) || 0 : 0), 0);
  // tamanho disponível na cor escolhida (ou em qualquer cor, se ainda não escolheu)
  const sizeAvailable = (p, size, color) => (colorsOf(p).length && !color
    ? colorsOf(p).some(c => stockOf(p, c.name, size) > 0)
    : stockOf(p, color, size) > 0);
  const colorImage = (p, color) => {
    const c = colorsOf(p).find(x => x.name === color);
    const imgs = p.images || [];
    return (c && Number.isInteger(c.img) && imgs[c.img]) || imgs[0] || '';
  };
  const totalStock = p => Object.values(p.stock || {}).reduce((s, n) => s + (Number(n) || 0), 0);
  const discount = p => (p.old_price && p.old_price > p.price ? Math.round((1 - p.price / p.old_price) * 100) : 0);
  const randId = () => Math.random().toString(36).slice(2, 10);

  function normProduct(p) {
    return {
      ...p,
      price: Number(p.price),
      old_price: p.old_price != null ? Number(p.old_price) : null,
      images: Array.isArray(p.images) ? p.images : [],
      stock: p.stock && typeof p.stock === 'object' ? p.stock : {},
      colors: Array.isArray(p.colors) ? p.colors : []
    };
  }
  function mergeSettings(rows) {
    const out = { ...DEFAULT_SETTINGS };
    (rows || []).forEach(r => { out[r.key] = r.value; });
    return out;
  }

  /* ---------- Supabase REST ---------- */
  async function sb(path, { method = 'GET', body, token, headers = {}, prefer } = {}) {
    const h = { apikey: C.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + (token || C.SUPABASE_ANON_KEY), ...headers };
    if (body !== undefined) h['Content-Type'] = 'application/json';
    if (prefer) h.Prefer = prefer;
    const r = await fetch(URL_BASE + '/rest/v1/' + path, {
      method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const t = await r.text();
    let data = null;
    try { data = t ? JSON.parse(t) : null; } catch (e) {}
    if (!r.ok) throw new Error((data && (data.message || data.error_description)) || 'Erro ' + r.status);
    return data;
  }

  /* ---------- Login do admin (Supabase Auth) ---------- */
  function saveSession(d) {
    ls.set('gm_session', {
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      expires_at: Date.now() + Math.max(60, (d.expires_in || 3600) - 60) * 1000,
      email: d.user && d.user.email
    });
  }
  async function authCall(grant, payload) {
    const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=${grant}`, {
      method: 'POST',
      headers: { apikey: C.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error_description || d.msg || 'Não foi possível entrar.');
    return d;
  }
  async function adminToken() {
    const s = ls.get('gm_session', null);
    if (!s) throw new Error('Sessão expirada. Entre novamente.');
    if (Date.now() < s.expires_at) return s.access_token;
    try {
      const d = await authCall('refresh_token', { refresh_token: s.refresh_token });
      saveSession(d);
      return d.access_token;
    } catch (e) {
      ls.del('gm_session');
      throw new Error('Sessão expirada. Entre novamente.');
    }
  }
  const auth = {
    async login(email, password) {
      if (!LIVE) return { email: 'demo' };
      const d = await authCall('password', { email, password });
      saveSession(d);
      return { email: d.user && d.user.email };
    },
    logout() { ls.del('gm_session'); },
    async session() {
      if (!LIVE) return { email: 'demo' };
      const s = ls.get('gm_session', null);
      if (!s) return null;
      try { await adminToken(); return { email: s.email }; } catch (e) { return null; }
    }
  };

  /* ---------- Modo demonstração ---------- */
  const DEMO_CATS = [
    { id: 'vestidos', name: 'Vestidos', slug: 'vestidos', position: 1 },
    { id: 'conjuntos', name: 'Conjuntos', slug: 'conjuntos', position: 2 },
    { id: 'calcas-e-jeans', name: 'Calças e Jeans', slug: 'calcas-e-jeans', position: 3 },
    { id: 'blusas', name: 'Blusas', slug: 'blusas', position: 4 },
    { id: 'festa-e-casamento', name: 'Festa e Casamento', slug: 'festa-e-casamento', position: 5 },
    { id: 'bolsas-e-acessorios', name: 'Bolsas e Acessórios', slug: 'bolsas-e-acessorios', position: 6 }
  ];
  const mk = (n, name, cat, price, old, stock, isNew, desc) => ({
    id: 'demo-' + n, name, category_slug: cat, price, old_price: old, images: [], colors: [], stock,
    active: true, featured: false, is_new: isNew, description: desc,
    created_at: new Date(Date.now() - n * 3600e3).toISOString()
  });
  const DEMO_PRODUCTS = [
    mk(1, 'Vestido Midi Branco com Cinto', 'vestidos', 189.9, 379.8, { M: 2, G: 1, G1: 2, G2: 1 }, true, 'Vestido midi com cinto marcando a cintura, tecido com leve elasticidade e caimento elegante.'),
    mk(2, 'Vestido Longo Floral', 'vestidos', 159.9, 319.8, { P: 1, M: 2, G: 2, G1: 0 }, false, 'Longo fluido com estampa floral, ideal para passeios e eventos de dia.'),
    mk(3, 'Vestido Slim Preto Clássico', 'vestidos', 139.9, 199.9, { M: 3, G: 2, G1: 1, G2: 1 }, false, 'O preto básico que não pode faltar: versátil, confortável e elegante.'),
    mk(4, 'Conjunto Alfaiataria Rosé', 'conjuntos', 219.9, 439.8, { P: 1, M: 1, G: 1, G1: 1, G2: 1 }, true, 'Blazer e calça em alfaiataria leve na cor rosé. Pronto para o trabalho e para o happy hour.'),
    mk(5, 'Conjunto Cropped e Saia Midi', 'conjuntos', 179.9, 259.9, { M: 2, G: 2, G1: 1 }, false, 'Duas peças com caimento fluido e tecido macio.'),
    mk(6, 'Calça Jeans Cintura Alta', 'calcas-e-jeans', 149.9, 189.9, { P: 2, M: 3, G: 3, G1: 2, G2: 1 }, false, 'Jeans com elastano, cintura alta e conforto o dia todo.'),
    mk(7, 'Calça Pantalona Linho', 'calcas-e-jeans', 129.9, 229.9, { M: 2, G: 1, G1: 2, G2: 2 }, false, 'Pantalona em tecido leve tipo linho, cós com elástico e bolsos.'),
    mk(8, 'Jeans Wide Leg Premium', 'calcas-e-jeans', 169.9, 249.9, { P: 1, M: 2, G: 2, G1: 1 }, true, 'Modelagem wide leg moderna com lavagem média e ótimo caimento.'),
    mk(9, 'Blusa Manga Bufante', 'blusas', 79.9, 129.9, { P: 3, M: 3, G: 2, G1: 2, G2: 1 }, false, 'Blusa com mangas bufantes e decote suave. Combina com tudo.'),
    mk(10, 'Camisa Social Feminina', 'blusas', 99.9, 159.9, { M: 2, G: 2, G1: 2, G2: 1 }, false, 'Camisa social com corte alongado e tecido que não amassa fácil.'),
    mk(11, 'Blusa Cetim Nude', 'blusas', 89.9, null, { P: 1, M: 1, G: 2, G1: 1 }, true, 'Cetim fluido com brilho discreto, para looks sofisticados.'),
    mk(12, 'Vestido Convidada Marsala', 'festa-e-casamento', 259.9, 519.8, { M: 1, G: 1, G1: 1, G2: 1 }, true, 'Vestido para casamentos e formaturas, com modelagem que valoriza a silhueta.'),
    mk(13, 'Vestido Longo Evasê Azul', 'festa-e-casamento', 289.9, 449.9, { P: 1, M: 1, G: 1, G1: 1, G2: 1 }, false, 'Longo evasê em tecido nobre com forro, para ocasiões especiais.'),
    mk(14, 'Bolsa Transversal Preta', 'bolsas-e-acessorios', 119.9, 179.9, { 'Único': 3 }, false, 'Bolsa estruturada com alça removível, cabe o essencial do dia.'),
    mk(15, 'Bolsa Caramelo Média', 'bolsas-e-acessorios', 139.9, 219.9, { 'Único': 2 }, true, 'Bolsa média na cor caramelo com ferragem dourada.'),
    mk(16, 'Bolsa Off-White Clutch', 'bolsas-e-acessorios', 99.9, 149.9, { 'Único': 0 }, false, 'Clutch off-white que acompanha de looks casuais a festas.')
  ];
  /* algumas peças de exemplo com cores (estoque por "Cor|Tamanho") */
  const colorize = (id, defs, sizes, qty) => {
    const p = DEMO_PRODUCTS.find(x => x.id === id);
    p.colors = defs.map(d => ({ name: d[0], hex: d[1], img: null }));
    p.stock = {};
    defs.forEach((d, ci) => sizes.forEach((s, si) => { p.stock[d[0] + '|' + s] = qty[(ci + si) % qty.length]; }));
  };
  colorize('demo-1', [['Branco', '#f3efe8'], ['Rosé', '#d9a5a5']], ['M', 'G', 'G1', 'G2'], [2, 1, 0, 1]);
  colorize('demo-3', [['Preto', '#1f1a1b'], ['Marinho', '#1d2a4d'], ['Vinho', '#6d1f2e']], ['M', 'G', 'G1', 'G2'], [2, 1, 1, 0]);
  colorize('demo-6', [['Azul médio', '#5b7aa3'], ['Preto', '#1f1a1b']], ['P', 'M', 'G', 'G1', 'G2'], [2, 3, 1, 2, 1]);
  colorize('demo-9', [['Branco', '#f3efe8'], ['Rosa', '#e7a3b4'], ['Verde', '#7a9a7e']], ['P', 'M', 'G', 'G1'], [1, 2, 2, 1]);
  colorize('demo-12', [['Marsala', '#7a2e3b'], ['Azul', '#2c3d6b']], ['M', 'G', 'G1', 'G2'], [1, 1, 0, 1]);

  const demo = {
    cats() { let v = ls.get('gm_demo_cats', null); if (!v) { v = DEMO_CATS; ls.set('gm_demo_cats', v); } return v; },
    saveCats(v) { ls.set('gm_demo_cats', v); },
    products() { let v = ls.get('gm_demo_products', null); if (!v) { v = DEMO_PRODUCTS; ls.set('gm_demo_products', v); } return v; },
    saveProducts(v) { if (!ls.set('gm_demo_products', v)) throw new Error('Sem espaço no navegador (modo demonstração). Use menos/menores fotos.'); },
    orders() { return ls.get('gm_demo_orders', []); },
    saveOrders(v) { ls.set('gm_demo_orders', v); },
    settings() { return { ...DEFAULT_SETTINGS, ...ls.get('gm_demo_settings', {}) }; }
  };

  /* ---------- Vitrine ---------- */
  async function getCatalog() {
    if (LIVE) {
      const [categories, products, srows] = await Promise.all([
        sb('categories?select=*&order=position.asc,name.asc'),
        sb('products?select=*&active=eq.true&order=created_at.desc'),
        sb('settings?select=key,value')
      ]);
      return { categories, products: products.map(normProduct), settings: mergeSettings(srows) };
    }
    return {
      categories: demo.cats().slice().sort((a, b) => a.position - b.position),
      products: demo.products().filter(p => p.active).map(normProduct),
      settings: demo.settings()
    };
  }

  /* ---------- Pedido (cliente) ---------- */
  async function createOrder(payload) {
    if (LIVE) {
      const r = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Não foi possível finalizar o pedido.');
      return d;
    }
    /* demonstração: valida estoque e salva o pedido localmente */
    const settings = demo.settings();
    const products = demo.products();
    const items = [];
    for (const w of payload.items) {
      const p = products.find(x => x.id === w.id);
      if (!p) throw new Error('Uma das peças não está mais disponível.');
      const np = normProduct(p);
      const hasColors = colorsOf(np).length > 0;
      if (hasColors && !colorsOf(np).some(c => c.name === w.color)) throw new Error(`Escolha a cor de ${p.name}.`);
      const color = hasColors ? w.color : '';
      if (stockOf(np, color, w.size) < w.qty) throw new Error(`${p.name} (${color ? color + ', ' : ''}${w.size}): estoque insuficiente.`);
      items.push({ id: p.id, name: p.name, size: w.size, color, variant: variantKey(color, w.size), qty: w.qty, price: p.price, image: colorImage(np, color) || null });
    }
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const free = Number(settings.free_shipping_from) > 0 && subtotal >= Number(settings.free_shipping_from);
    const shipping = payload.delivery.type === 'entrega' && !free ? Number(settings.shipping_fee) : 0;
    const code = 'GM-' + randId().toUpperCase().padEnd(8, 'X').slice(0, 8);
    const order = {
      id: 'ord-' + randId(), code,
      customer_name: payload.customer.name, email: payload.customer.email, phone: payload.customer.phone,
      delivery_type: payload.delivery.type, address: payload.delivery.address || null,
      notes: payload.notes || null, items, subtotal, shipping, total: subtotal + shipping,
      status: 'aguardando_pagamento', payment_status: 'pendente', stock_applied: false,
      created_at: new Date().toISOString(), demo: true
    };
    const orders = demo.orders(); orders.unshift(order); demo.saveOrders(orders);
    return { code, url: 'pedido.html?code=' + code + '&demo=1' };
  }

  async function getOrder(code) {
    code = String(code || '').trim().toUpperCase();
    if (LIVE) {
      const r = await fetch('/api/order-status?code=' + encodeURIComponent(code));
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Pedido não encontrado.');
      return d;
    }
    const o = demo.orders().find(x => x.code === code);
    if (!o) throw new Error('Pedido não encontrado neste navegador (modo demonstração).');
    const s = demo.settings();
    return { ...o, first_name: o.customer_name.split(' ')[0], pay_url: null, pickup_address: s.pickup_address, whatsapp: s.whatsapp, demo: true };
  }

  /* simula o resultado do pagamento (somente demonstração) */
  function demoPay(code, ok) {
    const orders = demo.orders();
    const o = orders.find(x => x.code === code);
    if (!o) return;
    if (ok && o.status === 'aguardando_pagamento') {
      o.status = 'pago'; o.payment_status = 'approved';
      const products = demo.products();
      o.items.forEach(i => {
        const p = products.find(x => x.id === i.id);
        if (p) { const k = i.variant || i.size; p.stock[k] = Math.max(0, (p.stock[k] || 0) - i.qty); }
      });
      o.stock_applied = true;
      demo.saveProducts(products);
    } else if (!ok) {
      o.payment_status = 'rejected';
    }
    demo.saveOrders(orders);
  }

  /* ---------- Fotos ---------- */
  function resizeImage(file, max, quality) {
    max = max || 1200; quality = quality || 0.82;
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => (b ? resolve(b) : reject(new Error('Falha ao processar a imagem.'))), 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem inválida.')); };
      img.src = url;
    });
  }
  const blobToDataUrl = blob => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('Falha ao ler a imagem.'));
    fr.readAsDataURL(blob);
  });

  async function uploadImage(file) {
    if (!LIVE) return blobToDataUrl(await resizeImage(file, 700, 0.7));
    const token = await adminToken();
    const blob = await resizeImage(file, 1200, 0.82);
    const path = `${Date.now()}-${randId()}.jpg`;
    const r = await fetch(`${URL_BASE}/storage/v1/object/produtos/${path}`, {
      method: 'POST',
      headers: { apikey: C.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'image/jpeg', 'Cache-Control': 'max-age=31536000' },
      body: blob
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.message || 'Falha ao enviar a foto.');
    }
    return `${URL_BASE}/storage/v1/object/public/produtos/${path}`;
  }

  /* ---------- Admin ---------- */
  const admin = {
    async products() {
      if (LIVE) return (await sb('products?select=*&order=created_at.desc', { token: await adminToken() })).map(normProduct);
      return demo.products().map(normProduct);
    },
    async saveProduct(p) {
      const payload = {
        name: p.name, description: p.description || '', category_slug: p.category_slug || null,
        price: Number(p.price), old_price: p.old_price ? Number(p.old_price) : null,
        images: p.images || [], stock: p.stock || {}, colors: p.colors || [],
        active: !!p.active, featured: !!p.featured, is_new: !!p.is_new
      };
      if (LIVE) {
        const token = await adminToken();
        if (p.id) { await sb('products?id=eq.' + encodeURIComponent(p.id), { method: 'PATCH', token, body: payload }); return p.id; }
        const r = await sb('products', { method: 'POST', token, body: payload, prefer: 'return=representation' });
        return r[0].id;
      }
      const list = demo.products();
      let id = p.id;
      if (id) {
        const i = list.findIndex(x => x.id === id);
        if (i >= 0) list[i] = { ...list[i], ...payload };
      } else {
        id = 'demo-' + randId();
        list.unshift({ id, created_at: new Date().toISOString(), ...payload });
      }
      demo.saveProducts(list);
      return id;
    },
    async deleteProduct(id) {
      if (LIVE) return sb('products?id=eq.' + encodeURIComponent(id), { method: 'DELETE', token: await adminToken() });
      demo.saveProducts(demo.products().filter(p => p.id !== id));
    },
    async categories() {
      if (LIVE) return sb('categories?select=*&order=position.asc,name.asc', { token: await adminToken() });
      return demo.cats().slice().sort((a, b) => a.position - b.position);
    },
    async saveCategory(c) {
      const slug = slugify(c.name);
      if (!slug) throw new Error('Nome inválido.');
      if (LIVE) {
        const token = await adminToken();
        if (c.id) { await sb('categories?id=eq.' + encodeURIComponent(c.id), { method: 'PATCH', token, body: { name: c.name } }); return; }
        const all = await sb('categories?select=position&order=position.desc&limit=1', { token });
        await sb('categories', { method: 'POST', token, body: { name: c.name, slug, position: ((all[0] && all[0].position) || 0) + 1 } });
        return;
      }
      const list = demo.cats();
      if (c.id) { const x = list.find(k => k.id === c.id); if (x) x.name = c.name; }
      else list.push({ id: slug, name: c.name, slug, position: list.length + 1 });
      demo.saveCats(list);
    },
    async deleteCategory(id) {
      if (LIVE) return sb('categories?id=eq.' + encodeURIComponent(id), { method: 'DELETE', token: await adminToken() });
      demo.saveCats(demo.cats().filter(c => c.id !== id));
    },
    async orders() {
      if (LIVE) return sb('orders?select=*&order=created_at.desc&limit=300', { token: await adminToken() });
      return demo.orders();
    },
    async updateOrder(id, patch) {
      if (LIVE) return sb('orders?id=eq.' + encodeURIComponent(id), { method: 'PATCH', token: await adminToken(), body: patch });
      const list = demo.orders();
      const o = list.find(x => x.id === id);
      if (o) Object.assign(o, patch);
      demo.saveOrders(list);
    },
    async settings() {
      if (LIVE) return mergeSettings(await sb('settings?select=key,value', { token: await adminToken() }));
      return demo.settings();
    },
    async saveSettings(obj) {
      if (LIVE) {
        const rows = Object.keys(obj).map(k => ({ key: k, value: obj[k] }));
        return sb('settings?on_conflict=key', { method: 'POST', token: await adminToken(), body: rows, prefer: 'resolution=merge-duplicates' });
      }
      ls.set('gm_demo_settings', obj);
    },
    resetDemo() { ['gm_demo_cats', 'gm_demo_products', 'gm_demo_orders', 'gm_demo_settings'].forEach(ls.del); }
  };

  window.GM = {
    LIVE, C, ls, brl, esc, slugify, sizesOf, totalStock, discount, normProduct,
    variantKey, colorsOf, stockOf, colorStock, sizeAvailable, colorImage,
    SIZE_ORDER, ORDER_STATUS, PAID_STATUSES, DEFAULT_SETTINGS,
    getCatalog, createOrder, getOrder, demoPay, uploadImage, auth, admin
  };
})();
