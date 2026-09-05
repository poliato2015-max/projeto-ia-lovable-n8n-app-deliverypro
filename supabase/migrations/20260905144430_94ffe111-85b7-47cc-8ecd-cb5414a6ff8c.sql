ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status = ANY (ARRAY['aguardando_aprovacao'::text, 'pedidos_a_fazer'::text, 'fazendo'::text, 'saiu_para_entrega'::text, 'entregue'::text, 'rejeitado'::text]));

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

  SELECT c.full_name, c.phone INTO v_name, v_phone
  FROM public.customers c WHERE c.id = NEW.customer_id;

  IF v_phone IS NOT NULL AND left(v_phone, 2) <> '55' THEN
    v_phone := '55' || v_phone;
  END IF;

  PERFORM net.http_post(
    url := 'https://oracle-n8n-marcelo.duckdns.org/webhook/pedidos_delivery',
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
$function$;