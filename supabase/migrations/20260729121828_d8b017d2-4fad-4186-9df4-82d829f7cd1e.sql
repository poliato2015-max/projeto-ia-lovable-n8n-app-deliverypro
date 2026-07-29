
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

DROP POLICY IF EXISTS "Visitantes criam clientes" ON public.customers;
CREATE POLICY "Visitantes criam clientes"
ON public.customers FOR INSERT TO anon, authenticated
WITH CHECK (
  length(btrim(full_name)) BETWEEN 2 AND 120
  AND length(email) <= 254
  AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND phone ~ '^[0-9]{11}$'
  AND cep ~ '^[0-9]{8}$'
);

DROP POLICY IF EXISTS "Visitantes criam pedidos" ON public.orders;
CREATE POLICY "Visitantes criam pedidos"
ON public.orders FOR INSERT TO anon, authenticated
WITH CHECK (
  status = 'aguardando_aprovacao'
  AND payment_status = 'pendente'
  AND payment_method IN ('credito','debito','pix')
  AND delivery_fee >= 0
  AND total >= 0
  AND approved_at IS NULL
  AND out_for_delivery_at IS NULL
);

DROP POLICY IF EXISTS "Visitantes criam itens" ON public.order_items;
CREATE POLICY "Visitantes criam itens"
ON public.order_items FOR INSERT TO anon, authenticated
WITH CHECK (
  quantity BETWEEN 1 AND 100
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = order_items.product_id
      AND p.is_active = true
      AND p.price = order_items.unit_price
  )
);
