import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/product-photos";

export const Route = createFileRoute("/admin/_protected/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos | Painel do Cardápio Digital" },
      {
        name: "description",
        content: "Aprove ou rejeite os pedidos que estão aguardando aprovação do restaurante.",
      },
      { property: "og:title", content: "Pedidos | Painel do Cardápio Digital" },
      {
        property: "og:description",
        content: "Aprove ou rejeite os pedidos que estão aguardando aprovação do restaurante.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPedidos,
});

const PAGAMENTOS: Record<string, string> = {
  credito: "Crédito",
  debito: "Débito",
  pix: "Pix",
};

function formatPhone(digits: string) {
  if (digits.length !== 11) return digits;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCep(digits: string) {
  if (digits.length !== 8) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function AdminPedidos() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [processando, setProcessando] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin", "orders", "aguardando_aprovacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, payment_method, total, delivery_fee, created_at, customers(full_name, phone, cep), order_items(id, quantity, unit_price, notes, products(name), order_item_addons(id, unit_price, products(name)))",
        )
        .eq("status", "aguardando_aprovacao")
        .order("order_number", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  async function atualizarStatus(orderId: string, aprovar: boolean) {
    setProcessando(orderId);
    const { error } = await supabase
      .from("orders")
      .update(
        aprovar
          ? { status: "pedidos_a_fazer", approved_at: new Date().toISOString() }
          : { status: "rejeitado" },
      )
      .eq("id", orderId);
    setProcessando(null);

    if (error) {
      toast.error("Não foi possível atualizar o pedido. Tente novamente.");
      return;
    }
    toast.success(aprovar ? "Pedido aprovado." : "Pedido rejeitado.");
    queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
  }

  return (
    <AdminShell
      title="Pedidos"
      description="Pedidos aguardando aprovação do restaurante."
      email={user.email ?? undefined}
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando pedidos...</p>
      ) : orders.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Nenhum pedido aguardando aprovação no momento.
        </p>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li key={order.id} className="rounded-lg border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    Pedido #{order.order_number}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {order.customers?.full_name} · {formatPhone(order.customers?.phone ?? "")} · CEP{" "}
                    {formatCep(order.customers?.cep ?? "")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Pagamento: {PAGAMENTOS[order.payment_method] ?? order.payment_method}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-foreground">
                    {formatBRL(Number(order.total))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Entrega: {formatBRL(Number(order.delivery_fee))}
                  </p>
                </div>
              </div>

              <ul className="mt-4 space-y-3 border-t pt-4">
                {order.order_items.map((item) => (
                  <li key={item.id} className="text-sm">
                    <p className="font-medium text-foreground">
                      {item.quantity}x {item.products?.name} ·{" "}
                      {formatBRL(Number(item.unit_price))}
                    </p>
                    {item.order_item_addons.length > 0 ? (
                      <p className="text-muted-foreground">
                        Adicionais:{" "}
                        {item.order_item_addons
                          .map((a) => `${a.products?.name} (${formatBRL(Number(a.unit_price))})`)
                          .join(", ")}
                      </p>
                    ) : null}
                    {item.notes ? (
                      <p className="text-muted-foreground">Obs.: {item.notes}</p>
                    ) : null}
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex gap-2">
                <Button
                  disabled={processando === order.id}
                  onClick={() => atualizarStatus(order.id, true)}
                >
                  Aprovar
                </Button>
                <Button
                  variant="outline"
                  disabled={processando === order.id}
                  onClick={() => atualizarStatus(order.id, false)}
                >
                  Rejeitar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
