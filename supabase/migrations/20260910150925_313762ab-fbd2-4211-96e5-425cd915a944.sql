REVOKE ALL ON FUNCTION public.create_order(text,text,text,text,text,text,text,text,text,text,jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_order(text,text,text,text,text,text,text,text,text,text,jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.guard_customer_order_update() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.notify_order_whatsapp() FROM anon, authenticated, public;