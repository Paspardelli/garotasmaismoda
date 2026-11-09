-- =====================================================================
-- Garota Mais — banco de dados (Supabase)
-- Cole tudo isto em: Supabase > SQL Editor > New query > Run
-- Pode rodar de novo sem problema (é idempotente).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Categorias ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Produtos ----------
-- stock = estoque por variação.
--   sem cores:  {"P":2,"M":1,"G":0}
--   com cores:  {"Rosé|M":2,"Rosé|G":1,"Preto|M":0}   (formato "Cor|Tamanho")
-- (variação ausente = não existe; 0 = esgotado)
-- colors = [{"name":"Rosé","hex":"#d9a5a5","img":0}]  (img = índice da foto)
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category_slug text,
  price numeric(10,2) not null check (price >= 0),
  old_price numeric(10,2) check (old_price is null or old_price >= 0),
  images text[] not null default '{}',
  stock jsonb not null default '{}'::jsonb,
  colors jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  featured boolean not null default false,
  is_new boolean not null default false,
  created_at timestamptz not null default now()
);
-- (para bancos criados antes de existir o campo de cores)
alter table public.products add column if not exists colors jsonb not null default '[]'::jsonb;
create index if not exists products_active_idx on public.products (active, created_at desc);

-- ---------- Pedidos ----------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  customer_name text not null,
  email text not null,
  phone text not null,
  delivery_type text not null check (delivery_type in ('retirada','entrega')),
  address jsonb,
  notes text,
  items jsonb not null,
  subtotal numeric(10,2) not null,
  shipping numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  status text not null default 'aguardando_pagamento'
    check (status in ('aguardando_pagamento','pago','em_separacao','pronto_retirada','enviado','entregue','cancelado')),
  payment_status text not null default 'pendente',
  mp_preference_id text,
  mp_payment_id text,
  pay_url text,
  stock_applied boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
for each row execute function public.touch_updated_at();

-- ---------- Configurações da loja ----------
create table if not exists public.settings (
  key text primary key,
  value jsonb not null
);

-- ---------- Baixa de estoque (chamada só pelo servidor) ----------
create or replace function public.apply_order_stock(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  it jsonb;
  k text;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or o.stock_applied then return; end if;

  for it in select * from jsonb_array_elements(o.items) loop
    -- "variant" = "Cor|Tamanho" (ou só o tamanho, em peças sem cores)
    k := coalesce(it->>'variant', it->>'size');
    update public.products
       set stock = jsonb_set(
             stock,
             array[k],
             to_jsonb(greatest(coalesce((stock->>k)::int, 0) - (it->>'qty')::int, 0))
           )
     where id = (it->>'id')::uuid;
  end loop;

  update public.orders set stock_applied = true where id = p_order;
end $$;

revoke all on function public.apply_order_stock(uuid) from public, anon, authenticated;

-- ---------- Segurança (RLS) ----------
alter table public.categories enable row level security;
alter table public.products   enable row level security;
alter table public.orders     enable row level security;
alter table public.settings   enable row level security;

drop policy if exists "categorias: leitura pública" on public.categories;
create policy "categorias: leitura pública" on public.categories for select using (true);
drop policy if exists "categorias: admin" on public.categories;
create policy "categorias: admin" on public.categories for all to authenticated using (true) with check (true);

drop policy if exists "produtos: leitura pública dos ativos" on public.products;
create policy "produtos: leitura pública dos ativos" on public.products for select using (active);
drop policy if exists "produtos: admin" on public.products;
create policy "produtos: admin" on public.products for all to authenticated using (true) with check (true);

-- Pedidos: ninguém público acessa. Criação e consulta pública passam pelas
-- funções /api (com a chave de serviço). Só o admin logado vê tudo.
drop policy if exists "pedidos: admin" on public.orders;
create policy "pedidos: admin" on public.orders for all to authenticated using (true) with check (true);

drop policy if exists "ajustes: leitura pública" on public.settings;
create policy "ajustes: leitura pública" on public.settings for select using (true);
drop policy if exists "ajustes: admin" on public.settings;
create policy "ajustes: admin" on public.settings for all to authenticated using (true) with check (true);

-- ---------- Fotos dos produtos (Storage) ----------
insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true)
on conflict (id) do nothing;

drop policy if exists "fotos: leitura pública" on storage.objects;
create policy "fotos: leitura pública" on storage.objects for select using (bucket_id = 'produtos');
drop policy if exists "fotos: admin envia" on storage.objects;
create policy "fotos: admin envia" on storage.objects for insert to authenticated with check (bucket_id = 'produtos');
drop policy if exists "fotos: admin altera" on storage.objects;
create policy "fotos: admin altera" on storage.objects for update to authenticated using (bucket_id = 'produtos');
drop policy if exists "fotos: admin apaga" on storage.objects;
create policy "fotos: admin apaga" on storage.objects for delete to authenticated using (bucket_id = 'produtos');

-- ---------- Dados iniciais ----------
insert into public.categories (name, slug, position) values
  ('Vestidos', 'vestidos', 1),
  ('Conjuntos', 'conjuntos', 2),
  ('Calças e Jeans', 'calcas-e-jeans', 3),
  ('Blusas', 'blusas', 4),
  ('Festa e Casamento', 'festa-e-casamento', 5),
  ('Bolsas e Acessórios', 'bolsas-e-acessorios', 6)
on conflict (slug) do nothing;

insert into public.settings (key, value) values
  ('whatsapp', '"5519999999999"'),
  ('vip_link', '""'),
  ('shipping_fee', '15'),
  ('free_shipping_from', '299'),
  ('pickup_address', '"Pátio 330 · Av. Afonso Pansan, 175 · Bertini · Americana-SP"'),
  ('topbar_text', '"BLACK FRIDAY: LOJA TODA COM ATÉ 50% OFF"')
on conflict (key) do nothing;
