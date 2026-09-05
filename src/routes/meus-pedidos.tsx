import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { formatBRL, getPhotoUrls } from "@/lib/product-photos";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

const STATUS_LABEL: Record<string, string> = {
  aguardando_aprovacao: "Aguardando aprovação",
  pedidos_a_fazer: "Pedido a fazer",
  fazendo: "Fazendo",
  saiu_para_entrega: "Saiu para a entrega",
  entregue: "Entregue",
  rejeitado: "Rejeitado",
};

/** Mesmas cores por etapa usadas no Kanban do admin. */
const STATUS_COR: Record<string, string> = {
  aguardando_aprovacao: "bg-slate-100 text-slate-700",
  pedidos_a_fazer: "bg-blue-100 text-blue-800",
  fazendo: "bg-amber-100 text-amber-800",
  saiu_para_entrega: "bg-emerald-100 text-emerald-800",
  entregue: "bg-violet-100 text-violet-800",
  rejeitado: "bg-destructive/10 text-destructive",
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
    products: { name: string; photo_url: string | null } | null;
  }[];
};

function resumoItens(pedido: Pedido) {
  return pedido.order_items
    .map((i) => `${i.quantity}x ${i.products?.name ?? "Item"}`)
    .join(", ");
}

function MeusPedidos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading } = useSession();
  const [confirmando, setConfirmando] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/conta", replace: true });
  }, [loading, user, navigate]);

  async function confirmarRecebimento(pedido: Pedido) {
    setConfirmando(pedido.id);
    const { error } = await supabase
      .from("orders")
      .update({ status: "entregue" })
      .eq("id", pedido.id);
    setConfirmando(null);

    if (error) {
      toast.error("Não foi possível confirmar o recebimento. Tente novamente.");
      return;
    }
    toast.success(`Pedido #${pedido.order_number} confirmado. Bom apetite!`);
    queryClient.invalidateQueries({ queryKey: ["meus-pedidos"] });
  }


  const { data: pedidos, isLoading } = useQuery({
    queryKey: ["meus-pedidos", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, created_at, total, status, order_items(quantity, products(name, photo_url))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Pedido[];
    },
  });

  const caminhosFotos = (pedidos ?? [])
    .map((p) => p.order_items[0]?.products?.photo_url ?? null)
    .filter((p): p is string => !!p);

  const { data: fotos } = useQuery({
    queryKey: ["meus-pedidos-fotos", caminhosFotos.join(",")],
    enabled: caminhosFotos.length > 0,
    queryFn: () => getPhotoUrls(caminhosFotos),
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
                <li key={pedido.id} className="flex gap-4 rounded-xl border bg-card p-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {(() => {
                      const caminho = pedido.order_items[0]?.products?.photo_url ?? null;
                      const url = caminho ? fotos?.[caminho] : undefined;
                      return url ? (
                        <img
                          src={url}
                          alt={pedido.order_items[0]?.products?.name ?? "Produto do pedido"}
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      );
                    })()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-foreground">#{pedido.order_number}</p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          STATUS_COR[pedido.status] ?? "bg-muted text-muted-foreground"
                        }`}
                      >
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
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
