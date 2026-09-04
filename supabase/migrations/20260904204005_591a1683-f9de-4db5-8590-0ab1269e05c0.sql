ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone;

CREATE POLICY "Cliente confirma recebimento"
ON public.orders
FOR UPDATE
TO authenticated
USING (customer_id = auth.uid() AND status = 'saiu_para_entrega')
WITH CHECK (customer_id = auth.uid() AND status = 'entregue');

CREATE OR REPLACE FUNCTION public.guard_customer_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new public.orders;
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF OLD.customer_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Alteração não permitida';
  END IF;

  IF OLD.status <> 'saiu_para_entrega' OR NEW.status <> 'entregue' THEN
    RAISE EXCEPTION 'Somente a confirmação de recebimento é permitida';
  END IF;

  -- Ignora qualquer outra alteração de campo vinda do cliente.
  v_new := OLD;
  v_new.status := 'entregue';
  v_new.delivered_at := now();
  RETURN v_new;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_customer_order_update ON public.orders;
CREATE TRIGGER trg_guard_customer_order_update
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_customer_order_update();