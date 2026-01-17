-- Fix RLS policies for pizza configuration tables
-- These tables need public read access for the menu to work properly

-- pizza_categories: Allow public read
ALTER TABLE public.pizza_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view pizza categories" ON public.pizza_categories;
CREATE POLICY "Anyone can view pizza categories"
  ON public.pizza_categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- pizza_category_settings: Allow public read
ALTER TABLE public.pizza_category_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view pizza category settings" ON public.pizza_category_settings;
CREATE POLICY "Anyone can view pizza category settings"
  ON public.pizza_category_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- pizza_product_settings: Allow public read
ALTER TABLE public.pizza_product_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view pizza product settings" ON public.pizza_product_settings;
CREATE POLICY "Anyone can view pizza product settings"
  ON public.pizza_product_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- pizza_settings: Allow public read
ALTER TABLE public.pizza_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view pizza settings" ON public.pizza_settings;
CREATE POLICY "Anyone can view pizza settings"
  ON public.pizza_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);
