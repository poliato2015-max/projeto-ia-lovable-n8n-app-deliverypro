CREATE OR REPLACE FUNCTION public.notify_order_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions
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

  PERFORM net.http_post(
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