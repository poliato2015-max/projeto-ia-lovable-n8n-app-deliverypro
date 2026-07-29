CREATE OR REPLACE FUNCTION public.create_order(
  p_full_name text,
  p_email text,
  p_phone text,
  p_cep text,
  p_payment_method text,
  p_items jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price)
    VALUES (v_order_id, (v_item->>'productId')::uuid, (v_item->>'quantity')::integer, v_price);
  END LOOP;

  RETURN v_order_number;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order(text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order(text, text, text, text, text, jsonb) TO anon, authenticated;