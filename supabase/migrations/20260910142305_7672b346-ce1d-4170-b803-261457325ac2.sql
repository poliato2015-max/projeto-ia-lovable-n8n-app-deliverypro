CREATE TABLE IF NOT EXISTS public.delivery_webhook (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_webhook TO authenticated;
GRANT ALL ON public.delivery_webhook TO service_role;

ALTER TABLE public.delivery_webhook ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam webhook"
ON public.delivery_webhook
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_delivery_webhook_updated_at
BEFORE UPDATE ON public.delivery_webhook
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.delivery_webhook (url)
SELECT NULLIF(btrim(COALESCE(ds.n8n_webhook_url, '')), '')
FROM public.delivery_settings ds LIMIT 1;

DROP VIEW IF EXISTS public.delivery_settings_public;

ALTER TABLE public.delivery_settings DROP COLUMN IF EXISTS n8n_webhook_url;

DROP POLICY IF EXISTS "Admins leem configuracoes" ON public.delivery_settings;
CREATE POLICY "Publico le configuracoes"
ON public.delivery_settings
FOR SELECT
TO anon, authenticated
USING (true);
GRANT SELECT ON public.delivery_settings TO anon;

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

  SELECT NULLIF(btrim(COALESCE(w.url, '')), '') INTO v_url
  FROM public.delivery_webhook w ORDER BY w.updated_at DESC LIMIT 1;

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