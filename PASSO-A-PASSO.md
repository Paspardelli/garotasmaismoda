# Garota Mais: colocar a loja no ar

A loja já abre em **modo demonstração** (dados só no navegador, pagamento simulado). Para vender de verdade, siga os passos abaixo. Dá para fazer tudo pelo celular.

## 0. Testar antes (opcional)
Abra `index.html` pela Vercel (ou GitHub Pages). Faça uma compra de teste: o pagamento é simulado em `pedido.html`. O painel fica em `/admin/` e entra direto no modo demonstração.

## 1. Supabase (banco, login e fotos)
1. Acesse https://supabase.com e crie um projeto chamado `garotamais` (região São Paulo).
2. Menu **SQL Editor** > **New query** > cole todo o conteúdo de `supabase/schema.sql` > **Run**.
3. **Authentication** > **Sign In / Providers** > desligue **Allow new users to sign up** (só você deve entrar no painel).
4. **Authentication** > **Users** > **Add user** > crie o e-mail e a senha da dona da loja (marque *Auto Confirm User*).
5. **Project Settings** > **API**: copie
   - **Project URL**
   - **anon public** (chave pública)
   - **service_role** (chave SECRETA: nunca vai para o GitHub)

## 2. Editar `js/config.js`
Cole a **Project URL** e a chave **anon public**. Só essas duas ficam no arquivo.

## 3. GitHub e Vercel
1. Crie um repositório no GitHub (https://github.com/new) e envie todos os arquivos desta pasta.
2. Em https://vercel.com > **Add New Project** > importe o repositório.
   - **Framework Preset:** Other (sem build)
3. Em **Settings > Environment Variables**, adicione (veja `.env.example`):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MP_ACCESS_TOKEN`
   - `MP_WEBHOOK_SECRET`
   - `SITE_URL` (ex.: `https://garotamais.vercel.app`)
4. Faça **Redeploy** depois de salvar as variáveis.

## 4. Mercado Pago
1. https://www.mercadopago.com.br/developers > **Suas integrações** > **Criar aplicação** > produto **Checkout Pro**.
2. Em **Credenciais**, copie o **Access Token** (`MP_ACCESS_TOKEN`). Use o de **teste** primeiro, depois o de **produção**, da conta da dona da loja.
3. Em **Webhooks**:
   - URL: `https://SEU-SITE.vercel.app/api/mp-webhook`
   - Evento: **Pagamentos**
   - Copie a **chave secreta** para `MP_WEBHOOK_SECRET` na Vercel e faça Redeploy.

## 5. Teste de ponta a ponta
1. Entre em `/admin/`, cadastre um produto com preço R$ 1,00 e estoque 1 (com foto).
2. Compre pelo site e pague. O pedido deve virar **Pago** no painel e o estoque cair sozinho.
3. Volte o preço ao normal e troque para as credenciais de produção.

## 6. Dia a dia (painel `/admin/`)
- **Resumo:** vendas de hoje e do mês, pedidos para preparar, estoque baixo.
- **Pedidos:** mude o status (separação, pronto para retirada, enviado, entregue) e chame a cliente no WhatsApp.
- **Produtos:** preço, estoque por tamanho, fotos (a primeira é a capa), ativar/esconder.
- **Categorias** e **Ajustes** (WhatsApp, Grupo VIP, frete, endereço de retirada).

## Observações
- Peça única: o estoque só baixa quando o pagamento é aprovado. Se duas pessoas pagarem a mesma peça ao mesmo tempo, o pedido da segunda precisa ser tratado na mão (reembolso pelo Mercado Pago).
- Pedido sem pagamento fica como **Aguardando pagamento**; cancele pelo painel se a cliente desistir.
- E-mail automático de pedido pago é opcional (Resend: `RESEND_API_KEY`, `EMAIL_FROM`).
- Frete é um valor fixo (com frete grátis acima de um valor). Não calcula por CEP.
