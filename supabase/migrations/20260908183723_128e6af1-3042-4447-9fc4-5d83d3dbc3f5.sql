ALTER TABLE public.delivery_settings ADD COLUMN IF NOT EXISTS n8n_webhook_url text;

CREATE OR REPLACE FUNCTION public.notify_order_whatsapp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net', 'extensions'
AS $function$
DECLARE
  v_event text;
  v_name text;
  v_phone text;
  v_payment text;
  v_items text;
  v_addons text;
  v_notes text;
  v_url text;
BEGIN
  IF OLD.status = 'aguardando_aprovacao' AND NEW.status = 'pedidos_a_fazer' THEN
    v_event := 'aprovado';
  ELSIF OLD.status IS DISTINCT FROM 'saiu_para_entrega' AND NEW.status = 'saiu_para_entrega' THEN
    v_event := 'saiu_para_entrega';
  ELSIF OLD.status IS DISTINCT FROM 'entregue' AND NEW.status = 'entregue' THEN
    v_event := 'entregue';
  ELSE
    RETURN NEW;
  END IF;

  SELECT NULLIF(btrim(COALESCE(ds.n8n_webhook_url, '')), '') INTO v_url
  FROM public.delivery_settings ds LIMIT 1;

  IF v_url IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.full_name, c.phone INTO v_name, v_phone
  FROM public.customers c WHERE c.id = NEW.customer_id;

  IF v_phone IS NOT NULL AND left(v_phone, 2) <> '55' THEN
    v_phone := '55' || v_phone;
  END IF;

  v_payment := CASE NEW.payment_method
    WHEN 'pix' THEN 'Pix'
    WHEN 'credito' THEN 'Cartão de Crédito'
    WHEN 'debito' THEN 'Cartão de Débito'
    ELSE NEW.payment_method
  END;

  SELECT COALESCE(string_agg(oi.quantity || 'x ' || p.name, '; ' ORDER BY oi.created_at), '')
  INTO v_items
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = NEW.id;

  SELECT COALESCE(string_agg(oi.quantity || 'x ' || ap.name, '; ' ORDER BY oi.created_at, ap.name), '')
  INTO v_addons
  FROM public.order_items oi
  JOIN public.order_item_addons oia ON oia.order_item_id = oi.id
  JOIN public.products ap ON ap.id = oia.addon_product_id
  WHERE oi.order_id = NEW.id;

  SELECT COALESCE(string_agg(oi.notes, ' | ' ORDER BY oi.created_at)
                  FILTER (WHERE oi.notes IS NOT NULL AND btrim(oi.notes) <> ''), '')
  INTO v_notes
  FROM public.order_items oi
  WHERE oi.order_id = NEW.id;

  PERFORM net.http_post(
    url := v_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'event', v_event,
      'order_number', NEW.order_number,
      'customer_name', v_name,
      'customer_phone', v_phone,
      'total', NEW.total,
      'payment_method', v_payment,
      'items_description', COALESCE(v_items, ''),
      'addons_description', COALESCE(v_addons, ''),
      'notes', COALESCE(v_notes, '')
    )
  );

  RETURN NEW;
END;
$function$;