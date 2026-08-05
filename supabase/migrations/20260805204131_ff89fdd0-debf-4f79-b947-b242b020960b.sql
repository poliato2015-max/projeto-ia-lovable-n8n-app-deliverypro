CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Publico le categorias" ON public.categories
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins gerenciam categorias" ON public.categories
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.products
  ADD COLUMN is_addon boolean NOT NULL DEFAULT false,
  ADD COLUMN category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;

INSERT INTO public.categories (name) VALUES ('Hambúrguer');

UPDATE public.products
SET is_addon = false,
    category_id = (SELECT id FROM public.categories WHERE name = 'Hambúrguer' LIMIT 1)
WHERE category = 'hamburguer';

UPDATE public.products
SET is_addon = true,
    category_id = NULL
WHERE category = 'adicional';

ALTER TABLE public.products DROP COLUMN category;