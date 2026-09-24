import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getProductAddons = createServerFn({ method: "GET" })
  .validator((productId: string) => z.string().uuid().parse(productId))
  .handler(async ({ data: productId }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("product_addons")
      .select(
        "addon_id, products!inner(id, name, description, price, photo_url, is_active, is_addon)"
      )
      .eq("product_id", productId)
      .eq("products.is_active", true)
      .eq("products.is_addon", true);

    if (error) throw error;

    return (data ?? []).map((row) => row.products);
  });