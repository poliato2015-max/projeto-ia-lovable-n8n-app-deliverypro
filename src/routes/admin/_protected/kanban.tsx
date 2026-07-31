import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { formatBRL } from "@/lib/product-photos";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/_protected/kanban")({
  head: () => ({
    meta: [
      { title: "Kanban | Painel do Cardápio Digital" },
      {
        name: "description",
        content: "Acompanhe a produção dos pedidos aprovados: a fazer, fazendo e saiu para entrega.",
      },
      { property: "og:title", content: "Kanban | Painel do Cardápio Digital" },
      {
        property: "og:description",
        content: "Acompanhe a produção dos pedidos aprovados do delivery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminKanban,
});

const COLUNAS = [
  { status: "pedidos_a_fazer", label: "Pedidos a fazer" },
  { status: "fazendo", label: "Fazendo" },
  { status: "saiu_para_entrega", label: "Saiu para a entrega" },
] as const;

const PAGAMENTOS: Record<string, string> = {
  credito: "Crédito",
  debito: "Débito",
  pix: "Pix",
};

const SELECT =
  "id, order_number, status, payment_method, total, delivery_fee, created_at, customers(full_name, phone, cep), order_items(id, quantity, unit_price, notes, products(name), order_item_addons(id, unit_price, products(name)))";

type Order = {
  id: string;
  order_number: number;
  status: string;
  payment_method: string;
  total: number;
  delivery_fee: number;
  customers: { full_name: string; phone: string; cep: string } | null;
  order_items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    notes: string | null;
    products: { name: string } | null;
    order_item_addons: Array<{ id: string; unit_price: number; products: { name: string } | null }>;
  }>;
};

function formatPhone(digits: string) {
  if (digits.length !== 11) return digits;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCep(digits: string) {
  if (digits.length !== 8) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function resumoItens(order: Order) {
  if (order.order_items.length === 1) {
    const item = order.order_items[0];
    return `${item.quantity}x ${item.products?.name ?? "Item"}`;
  }
  return `${order.order_items.length} itens`;
}

function AdminKanban() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [colunaAlvo, setColunaAlvo] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<Order | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin", "orders", "kanban"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(SELECT)
        .in("status", ["pedidos_a_fazer", "fazendo", "saiu_para_entrega"])
        .order("order_number", { ascending: true });
      if (error) throw error;
      return data as unknown as Order[];
    },
  });

  async function mover(orderId: string, novoStatus: string) {
    const atual = orders.find((o) => o.id === orderId);
    if (!atual || atual.status === novoStatus) return;

    const patch: { status: string; out_for_delivery_at?: string } = { status: novoStatus };
    if (novoStatus === "saiu_para_entrega") patch.out_for_delivery_at = new Date().toISOString();

    const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
    if (error) {
      toast.error("Não foi possível mover o pedido. Tente novamente.");
      return;
    }
    toast.success(`Pedido #${atual.order_number} atualizado.`);
    queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
  }

  return (
    <AdminShell
      title="Kanban"
      description="Pedidos aprovados em produção. Arraste os cartões entre as colunas."
      email={user.email ?? undefined}
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando pedidos...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {COLUNAS.map((coluna) => {
            const cards = orders.filter((o) => o.status === coluna.status);
            return (
              <section
                key={coluna.status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setColunaAlvo(coluna.status);
                }}
                onDragLeave={() => setColunaAlvo((c) => (c === coluna.status ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  setColunaAlvo(null);
                  if (arrastando) mover(arrastando, coluna.status);
                  setArrastando(null);
                }}
                className={cn(
                  "flex min-h-64 flex-col gap-3 rounded-lg border bg-muted/40 p-3 transition-colors",
                  colunaAlvo === coluna.status && "border-primary bg-accent",
                )}
              >
                <header className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">{coluna.label}</h2>
                  <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
                    {cards.length}
                  </span>
                </header>

                {cards.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum pedido nesta coluna.</p>
                ) : (
                  cards.map((order) => (
                    <article
                      key={order.id}
                      draggable
                      onDragStart={() => setArrastando(order.id)}
                      onDragEnd={() => {
                        setArrastando(null);
                        setColunaAlvo(null);
                      }}
                      onClick={() => setDetalhe(order)}
                      className={cn(
                        "cursor-pointer rounded-md border bg-card p-3 shadow-sm transition-opacity hover:border-primary",
                        arrastando === order.id && "opacity-50",
                      )}
                    >
                      <p className="text-sm font-semibold text-foreground">
                        Pedido #{order.order_number}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {order.customers?.full_name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{resumoItens(order)}</p>
                    </article>
                  ))
                )}
              </section>
            );
          })}
        </div>
      )}

      <Dialog open={detalhe !== null} onOpenChange={(open) => !open && setDetalhe(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {detalhe ? (
            <>
              <DialogHeader>
                <DialogTitle>Pedido #{detalhe.order_number}</DialogTitle>
                <DialogDescription>
                  {detalhe.customers?.full_name} · {formatPhone(detalhe.customers?.phone ?? "")} ·
                  CEP {formatCep(detalhe.customers?.cep ?? "")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  Pagamento: {PAGAMENTOS[detalhe.payment_method] ?? detalhe.payment_method}
                </p>
                <p>Entrega: {formatBRL(Number(detalhe.delivery_fee))}</p>
                <p className="font-semibold text-foreground">
                  Total: {formatBRL(Number(detalhe.total))}
                </p>
              </div>

              <ul className="space-y-3 border-t pt-4">
                {detalhe.order_items.map((item) => (
                  <li key={item.id} className="text-sm">
                    <p className="font-medium text-foreground">
                      {item.quantity}x {item.products?.name} · {formatBRL(Number(item.unit_price))}
                    </p>
                    {item.order_item_addons.length > 0 ? (
                      <p className="text-muted-foreground">
                        Adicionais:{" "}
                        {item.order_item_addons
                          .map((a) => `${a.products?.name} (${formatBRL(Number(a.unit_price))})`)
                          .join(", ")}
                      </p>
                    ) : null}
                    {item.notes ? <p className="text-muted-foreground">Obs.: {item.notes}</p> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
