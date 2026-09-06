ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = public;

ALTER FUNCTION public.guard_customer_order_update() SET search_path = public;

ALTER FUNCTION public.create_order(text, text, text, text, text, text, text, text, text, text, jsonb) SET search_path = public;

ALTER FUNCTION public.notify_order_whatsapp() SET search_path = public, net, extensions;