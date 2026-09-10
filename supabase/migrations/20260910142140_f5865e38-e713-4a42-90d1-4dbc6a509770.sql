DROP POLICY IF EXISTS "Publico le configuracoes" ON public.delivery_settings;

REVOKE SELECT ON public.delivery_settings FROM anon;

CREATE POLICY "Admins leem configuracoes"
ON public.delivery_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE VIEW public.delivery_settings_public
WITH (security_invoker = off) AS
SELECT id, store_cep, delivery_fee, free_shipping_enabled, delivery_radius_km, store_lat, store_lng, updated_at
FROM public.delivery_settings;

GRANT SELECT ON public.delivery_settings_public TO anon, authenticated;