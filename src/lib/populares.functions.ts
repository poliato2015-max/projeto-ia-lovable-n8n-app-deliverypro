import { createServerFn } from "@tanstack/react-start";

/**
 * Top 3 produtos mais vendidos nos últimos 30 dias.
 * Mesma lógica de ranking usada em Relatórios (soma de quantidade por produto),
 * exposta publicamente apenas como lista de IDs para o emblema "Popular".
 */
export const produtosPopulares = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("order_items")
    .select("product_id, quantity, orders!inner(created_at)")
    .gte("orders.created_at", desde);
  if (error) throw error;

  const totais: Record<string, number> = {};
  for (const item of data ?? []) {
    totais[item.product_id] = (totais[item.product_id] ?? 0) + (item.quantity ?? 0);
  }

  return Object.entries(totais)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);
});
