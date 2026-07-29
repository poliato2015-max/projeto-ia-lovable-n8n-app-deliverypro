CREATE TABLE public.product_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  addon_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, addon_id)
);
GRANT SELECT ON public.product_addons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_addons TO authenticated;
GRANT ALL ON public.product_addons TO service_role;
ALTER TABLE public.product_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Publico le vinculos de adicionais" ON public.product_addons FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins gerenciam vinculos de adicionais" ON public.product_addons FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.order_items ADD COLUMN notes text;

CREATE TABLE public.order_item_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  addon_product_id uuid NOT NULL REFERENCES public.products(id),
  unit_price numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.order_item_addons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_item_addons TO authenticated;
GRANT ALL ON public.order_item_addons TO service_role;
ALTER TABLE public.order_item_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visitantes criam adicionais do item" ON public.order_item_addons FOR INSERT TO anon, authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = order_item_addons.addon_product_id AND p.is_active = true AND p.price = order_item_addons.unit_price));
CREATE POLICY "Admins gerenciam adicionais do item" ON public.order_item_addons FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.create_order(p_full_name text, p_email text, p_phone text, p_cep text, p_payment_method text, p_items jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id uuid;
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
  IF length(btrim(p_full_name)) < 2 OR length(btrim(p_full_name)) > 120
     OR btrim(p_full_name) !~ '^[A-Za-zÀ-ÖØ-öø-ÿ ]+$' THEN
    RAISE EXCEPTION 'Nome inválido';
  END IF;
  IF p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(p_email) > 254 THEN
    RAISE EXCEPTION 'E-mail inválido';
  END IF;
  IF p_phone !~ '^[0-9]{11}$' THEN RAISE EXCEPTION 'Celular inválido'; END IF;
  IF p_cep !~ '^[0-9]{8}$' THEN RAISE EXCEPTION 'CEP inválido'; END IF;
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

  INSERT INTO public.customers (full_name, email, phone, cep)
  VALUES (btrim(p_full_name), p_email, p_phone, p_cep)
  RETURNING id INTO v_customer_id;

  INSERT INTO public.orders (customer_id, status, payment_method, payment_status, delivery_fee, total)
  VALUES (v_customer_id, 'aguardando_aprovacao', p_payment_method, 'pendente', v_delivery_fee, v_subtotal + v_delivery_fee)
  RETURNING id, order_number INTO v_order_id, v_order_number;

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
$function$;