# DeliveryPro

CONTEXTO: Estou construindo um app de cardápio digital para delivery de hambúrguer e adicionais, com painel administrativo e fluxo de pedido pro cliente. Este prompt é só a fundação de dados — ainda sem telas de cardápio, checkout ou Kanban.

Crie as seguintes tabelas no Supabase. Nomes de tabelas e campos em inglês; toda mensagem/texto visível ao usuário em português.

1) products: id, name, description (ingredientes), price (numeric, com constraint price > 0), category (texto: 'hamburguer' ou 'adicional'), photo_url (texto, nullable), is_active (boolean, default true), created_at

2) customers: id, full_name, email, phone (texto, exatamente 11 dígitos numéricos), cep (texto, exatamente 8 dígitos numéricos), created_at

3) delivery_settings: id, store_cep (texto, 8 dígitos), delivery_fee (numeric), free_shipping_enabled (boolean, default false), delivery_range_limit (integer — por enquanto só um valor numérico placeholder, sem lógica de cálculo real ainda), updated_at.

Insira uma linha inicial: store_cep '00000000', delivery_fee 0, free_shipping_enabled false, delivery_range_limit 100.

4) orders: id, order_number (identity/serial legível, começando em 1001), customer_id (fk para customers), status (texto: 'aguardando_aprovacao' | 'pedidos_a_fazer' | 'fazendo' | 'saiu_para_entrega', default 'aguardando_aprovacao'), payment_method (texto: 'credito' | 'debito' | 'pix'), payment_status (texto: 'pendente' | 'pago', default 'pendente'), delivery_fee (numeric), total (numeric), created_at, approved_at (nullable), out_for_delivery_at (nullable)

5) order_items: id, order_id (fk para orders), product_id (fk para products), quantity (integer), unit_price (numeric — cópia do preço do produto no momento do pedido, não muda se o preço do produto mudar depois)

6) user_roles: id, user_id (fk para auth.users), role (texto, único valor possível por enquanto: 'admin')

AUTENTICAÇÃO E RLS:

- Ative Row Level Security em TODAS as tabelas, sem exceção.

- Crie uma função SECURITY DEFINER (ex: has_role(uid, role)) que verifica o papel do usuário lendo user_roles, e use essa função — não uma consulta direta — dentro das políticas de RLS de outras tabelas, pra evitar recursão.

- Anônimo (não logado) pode: inserir em customers, orders e order_items; ler products (só is_active = true) e delivery_settings. Não pode ler, editar nem apagar customers, orders ou order_items.

- Só usuário com papel admin (via has_role) pode ler/editar/apagar em todas as tabelas, e é o único que pode inserir/editar/apagar em products e delivery_settings.

- Crie uma tela de login de admin (e-mail/senha) em /admin/login, sem autocadastro público. Crie o usuário inicial com e-mail: a92424345@gmail.com e senha: Po140470 , e insira o papel 'admin' pra ele em user_roles. Qualquer rota /admin/* deve redirecionar pro login se não estiver autenticado como admin.

Ao terminar, verifique no navegador: login funciona em /admin/login com essas credenciais; as 6 tabelas existem no Supabase com RLS ativado; a linha inicial de delivery_settings foi criada.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/10d8cdda-a592-47a1-876e-882daf765782).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
