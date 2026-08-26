-- customers: endereço completo
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS number text,
  ADD COLUMN IF NOT EXISTS complement text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric;

-- delivery_settings: coordenadas da loja + raio
ALTER TABLE public.delivery_settings
  ADD COLUMN IF NOT EXISTS store_lat numeric,
  ADD COLUMN IF NOT EXISTS store_lng numeric;
ALTER TABLE public.delivery_settings RENAME COLUMN delivery_range_limit TO delivery_radius_km;
ALTER TABLE public.delivery_settings ALTER COLUMN delivery_radius_km SET DEFAULT 10;
UPDATE public.delivery_settings SET delivery_radius_km = 10;

-- orders: snapshot do endereço de entrega
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_cep text,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS number text,
  ADD COLUMN IF NOT EXISTS complement text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text;

GRANT SELECT, INSERT, UPDATE ON public.customers TO authenticated;
GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT SELECT, INSERT ON public.order_item_addons TO authenticated;

-- Políticas de cliente
DROP POLICY IF EXISTS "Visitantes criam clientes" ON public.customers;
CREATE POLICY "Cliente cria propria ficha" ON public.customers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Cliente le propria ficha" ON public.customers
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Cliente edita propria ficha" ON public.customers
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Visitantes criam pedidos" ON public.orders;
CREATE POLICY "Cliente le proprios pedidos" ON public.orders
  FOR SELECT TO authenticated USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Visitantes criam itens" ON public.order_items;
CREATE POLICY "Cliente le proprios itens" ON public.order_items
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.customer_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Visitantes criam adicionais do item" ON public.order_item_addons;
CREATE POLICY "Cliente le proprios adicionais" ON public.order_item_addons
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.id = order_item_addons.order_item_id AND o.customer_id = auth.uid()
  ));

-- create_order agora exige login e grava o endereço do pedido
DROP FUNCTION IF EXISTS public.create_order(text, text, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.create_order(
  p_full_name text,
  p_phone text,
  p_cep text,
  p_street text,
  p_number text,
  p_complement text,
  p_neighborhood text,
  p_city text,
  p_state text,
  p_payment_method text,
  p_items jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order_id uuid;
  v_order_number integer;
  v_subtotal numeric := 0;
  v_delivery_fee numeric := 0;
  v_free boolean := false;
  v_item jsonb;
  v_price numeric;
  v_qty integer;
  v_addon uuid;
  v_addon_price numeric;
  v_order_item_id uuid;
  v_notes text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Necessário estar logado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = v_uid) THEN
    RAISE EXCEPTION 'Cadastro do cliente não encontrado';
  END IF;
  IF length(btrim(p_full_name)) < 2 OR length(btrim(p_full_name)) > 120 THEN
    RAISE EXCEPTION 'Nome inválido';
  END IF;
  IF p_phone !~ '^[0-9]{11}$' THEN RAISE EXCEPTION 'Celular inválido'; END IF;
  IF p_cep !~ '^[0-9]{8}$' THEN RAISE EXCEPTION 'CEP inválido'; END IF;
  IF btrim(COALESCE(p_number, '')) = '' THEN RAISE EXCEPTION 'Número inválido'; END IF;
  IF p_payment_method NOT IN ('credito','debito','pix') THEN RAISE EXCEPTION 'Pagamento inválido'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Carrinho vazio'; END IF;

  SELECT delivery_fee, free_shipping_enabled INTO v_delivery_fee, v_free
  FROM public.delivery_settings LIMIT 1;
  IF v_free THEN v_delivery_fee := 0; END IF;
  v_delivery_fee := COALESCE(v_delivery_fee, 0);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::integer;
    IF v_qty < 1 OR v_qty > 100 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
    SELECT price INTO v_price FROM public.products
      WHERE id = (v_item->>'productId')::uuid AND is_active = true;
    IF v_price IS NULL THEN RAISE EXCEPTION 'Produto indisponível'; END IF;
    FOR v_addon IN SELECT (value)::uuid FROM jsonb_array_elements_text(COALESCE(v_item->'addons','[]'::jsonb)) LOOP
      SELECT price INTO v_addon_price FROM public.products WHERE id = v_addon AND is_active = true;
      IF v_addon_price IS NULL THEN RAISE EXCEPTION 'Adicional indisponível'; END IF;
      v_price := v_price + v_addon_price;
    END LOOP;
    v_subtotal := v_subtotal + v_price * v_qty;
  END LOOP;

  UPDATE public.customers
     SET full_name = btrim(p_full_name), phone = p_phone
   WHERE id = v_uid;

  INSERT INTO public.orders (
    customer_id, status, payment_method, payment_status, delivery_fee, total,
    delivery_cep, street, number, complement, neighborhood, city, state
  ) VALUES (
    v_uid, 'aguardando_aprovacao', p_payment_method, 'pendente', v_delivery_fee, v_subtotal + v_delivery_fee,
    p_cep, NULLIF(btrim(COALESCE(p_street,'')),''), btrim(p_number),
    NULLIF(btrim(COALESCE(p_complement,'')),''), NULLIF(btrim(COALESCE(p_neighborhood,'')),''),
    NULLIF(btrim(COALESCE(p_city,'')),''), NULLIF(btrim(COALESCE(p_state,'')),'')
  ) RETURNING id, order_number INTO v_order_id, v_order_number;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT price INTO v_price FROM public.products WHERE id = (v_item->>'productId')::uuid;
    v_notes := NULLIF(btrim(COALESCE(v_item->>'notes','')), '');
    IF v_notes IS NOT NULL AND length(v_notes) > 300 THEN RAISE EXCEPTION 'Observação muito longa'; END IF;
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, notes)
    VALUES (v_order_id, (v_item->>'productId')::uuid, (v_item->>'quantity')::integer, v_price, v_notes)
    RETURNING id INTO v_order_item_id;
    FOR v_addon IN SELECT (value)::uuid FROM jsonb_array_elements_text(COALESCE(v_item->'addons','[]'::jsonb)) LOOP
      SELECT price INTO v_addon_price FROM public.products WHERE id = v_addon;
      INSERT INTO public.order_item_addons (order_item_id, addon_product_id, unit_price)
      VALUES (v_order_item_id, v_addon, v_addon_price);
    END LOOP;
  END LOOP;

  RETURN v_order_number;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_order(text,text,text,text,text,text,text,text,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order(text,text,text,text,text,text,text,text,text,text,jsonb) TO authenticated;