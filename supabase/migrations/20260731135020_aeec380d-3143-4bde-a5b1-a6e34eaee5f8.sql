CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_order_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_event text;
  v_name text;
  v_phone text;
BEGIN
  IF OLD.status = 'aguardando_aprovacao' AND NEW.status = 'pedidos_a_fazer' THEN
    v_event := 'aprovado';
  ELSIF OLD.status IS DISTINCT FROM 'saiu_para_entrega' AND NEW.status = 'saiu_para_entrega' THEN
    v_event := 'saiu_para_entrega';
  ELSE
    RETURN NEW;
  END IF;

  SELECT c.full_name, c.phone INTO v_name, v_phone
  FROM public.customers c WHERE c.id = NEW.customer_id;

  PERFORM extensions.net.http_post(
    url := '<configurado em delivery_settings.n8n_webhook_url>',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'event', v_event,
      'order_number', NEW.order_number,
      'customer_name', v_name,
      'customer_phone', v_phone
    )
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_order_whatsapp() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_order_whatsapp ON public.orders;
CREATE TRIGGER trg_notify_order_whatsapp
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.notify_order_whatsapp();