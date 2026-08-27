import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { formatBRL } from "@/lib/product-photos";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

const STATUS_LABEL: Record<string, string> = {
  aguardando_aprovacao: "Aguardando aprovação",
  pedidos_a_fazer: "Pedido a fazer",
  fazendo: "Fazendo",
  saiu_para_entrega: "Saiu para a entrega",
  rejeitado: "Rejeitado",
};

export const Route = createFileRoute("/meus-pedidos")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Meus Pedidos | DeliveryPro" },
      {
        name: "description",
        content: "Acompanhe seus pedidos no DeliveryPro: itens, total e status de cada entrega.",
      },
      { property: "og:title", content: "Meus Pedidos | DeliveryPro" },
      {
        property: "og:description",
        content: "Acompanhe seus pedidos no DeliveryPro: itens, total e status de cada entrega.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MeusPedidos,
});

type Pedido = {
  id: string;
  order_number: number;
  created_at: string;
  total: number;
  status: string;
  order_items: {
    quantity: number;
    products: { name: string } | null;
  }[];
};

function resumoItens(pedido: Pedido) {
  return pedido.order_items
    .map((i) => `${i.quantity}x ${i.products?.name ?? "Item"}`)
    .join(", ");
}

function MeusPedidos() {
  const navigate = useNavigate();
  const { user, loading } = useSession();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/conta", replace: true });
  }, [loading, user, navigate]);

  const { data: pedidos, isLoading } = useQuery({
    queryKey: ["meus-pedidos", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, created_at, total, status, order_items(quantity, products(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Pedido[];
    },
  });

  return (
    <div className="min-h-screen bg-client-bg">
      <SiteHeader />
      <main className="px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-6">
          <h1 className="text-3xl font-bold text-foreground">Meus Pedidos</h1>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando pedidos...</p>
          ) : !pedidos || pedidos.length === 0 ? (
            <div className="space-y-4 rounded-2xl border bg-card p-8 text-center">
              <p className="text-muted-foreground">Você ainda não fez nenhum pedido.</p>
              <Button asChild>
                <Link to="/cardapio">Ver cardápio</Link>
              </Button>
            </div>
          ) : (
            <ul className="space-y-3">
              {pedidos.map((pedido) => (
                <li key={pedido.id} className="rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">#{pedido.order_number}</p>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                      {STATUS_LABEL[pedido.status] ?? pedido.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(pedido.created_at).toLocaleString("pt-BR")}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{resumoItens(pedido)}</p>
                  <p className="mt-2 font-semibold text-foreground">
                    {formatBRL(Number(pedido.total))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
