import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";

export const Route = createFileRoute("/admin/_protected/visao-geral")({
  head: () => ({
    meta: [
      { title: "Visão geral | Painel do Cardápio Digital" },
      {
        name: "description",
        content: "Acompanhe em tempo real quantos pedidos estão em cada etapa do delivery.",
      },
      { property: "og:title", content: "Visão geral | Painel do Cardápio Digital" },
      {
        property: "og:description",
        content: "Contagem de pedidos por status atualizada em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminVisaoGeral,
});

const STATUS = [
  { key: "aguardando_aprovacao", label: "Aguardando aprovação" },
  { key: "pedidos_a_fazer", label: "Pedidos a fazer" },
  { key: "fazendo", label: "Fazendo" },
  { key: "saiu_para_entrega", label: "Saiu para a entrega" },
  { key: "rejeitado", label: "Rejeitado" },
] as const;

function AdminVisaoGeral() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();

  const { data: counts, isLoading } = useQuery({
    queryKey: ["admin", "orders", "counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("status");
      if (error) throw error;
      const acc: Record<string, number> = {};
      for (const row of data ?? []) acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("orders-overview")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <AdminShell
      title="Visão geral"
      description="Contagem de pedidos por status, atualizada automaticamente."
      email={user.email ?? undefined}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STATUS.map((s) => (
          <article key={s.key} className="rounded-lg border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="mt-2 text-4xl font-bold tabular-nums text-foreground">
              {isLoading ? "—" : (counts?.[s.key] ?? 0)}
            </p>
          </article>
        ))}
      </div>
    </AdminShell>
  );
}
