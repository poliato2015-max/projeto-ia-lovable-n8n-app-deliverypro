import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Bike, Flame, Inbox, ListChecks } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
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
      { title: "Pedidos | Painel do Cardápio Digital" },
      {
        name: "description",
        content: "Aprove pedidos pendentes e acompanhe a produção: a fazer, fazendo e saiu para entrega.",
      },
      { property: "og:title", content: "Pedidos | Painel do Cardápio Digital" },
      {
        property: "og:description",
        content: "Aprovação e acompanhamento da produção dos pedidos do delivery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminKanban,
});

const COLUNAS = [
  {
    status: "pedidos_a_fazer",
    label: "Pedidos a fazer",
    icon: ListChecks,
    header: "bg-blue-100 text-blue-800",
  },
  {
    status: "fazendo",
    label: "Fazendo",
    icon: Flame,
    header: "bg-amber-100 text-amber-800",
  },
  {
    status: "saiu_para_entrega",
    label: "Saiu para a entrega",
    icon: Bike,
    header: "bg-emerald-100 text-emerald-800",
  },
] as const;

const PAGAMENTOS: Record<string, string> = {
  credito: "Crédito",
  debito: "Débito",
  pix: "Pix",
};

const SELECT =
  "id, order_number, status, payment_method, total, delivery_fee, created_at, delivery_cep, street, number, complement, neighborhood, city, state, customers(full_name, phone, cep, street, number, complement, neighborhood), order_items(id, quantity, unit_price, notes, products(name), order_item_addons(id, unit_price, products(name)))";

type Order = {
  id: string;
  order_number: number;
  status: string;
  payment_method: string;
  total: number;
  delivery_fee: number;
  delivery_cep: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  customers: {
    full_name: string;
    phone: string;
    cep: string;
    street: string | null;
    number: string | null;
    complement: string | null;
    neighborhood: string | null;
  } | null;
  order_items: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    notes: string | null;
    products: { name: string } | null;
    order_item_addons: Array<{ id: string; unit_price: number; products: { name: string } | null }>;
  }>;
};

/** Endereço de entrega do pedido, com o cadastro do cliente como reserva. */
function enderecoCompleto(order: Order) {
  const rua = order.street ?? order.customers?.street ?? "";
  const numero = order.number ?? order.customers?.number ?? "";
  const complemento = order.complement ?? order.customers?.complement ?? "";
  const bairro = order.neighborhood ?? order.customers?.neighborhood ?? "";
  const cep = order.delivery_cep ?? order.customers?.cep ?? "";
  const partes = [
    [rua, numero].filter(Boolean).join(", "),
    complemento,
    bairro,
    cep ? `CEP ${formatCep(cep)}` : "",
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : "Endereço não informado";
}

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
  const [processando, setProcessando] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin", "orders", "kanban"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(SELECT)
        .in("status", [
          "aguardando_aprovacao",
          "pedidos_a_fazer",
          "fazendo",
          "saiu_para_entrega",
        ])
        .order("order_number", { ascending: true });
      if (error) throw error;
      return data as unknown as Order[];
    },
  });

  const pendentes = orders.filter((o) => o.status === "aguardando_aprovacao");

  async function mover(orderId: string, novoStatus: string) {
    const atual = orders.find((o) => o.id === orderId);
    if (!atual || atual.status === novoStatus) return;
    if (atual.status === "aguardando_aprovacao") return;

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

  async function decidir(order: Order, aprovar: boolean) {
    setProcessando(order.id);
    const { error } = await supabase
      .from("orders")
      .update(
        aprovar
          ? { status: "pedidos_a_fazer", approved_at: new Date().toISOString() }
          : { status: "rejeitado" },
      )
      .eq("id", order.id);
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
      description="Aprove os pedidos pendentes e acompanhe a produção arrastando os cartões."
      email={user.email ?? undefined}
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando pedidos...</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          <section className="flex min-h-64 flex-col gap-3 rounded-lg border bg-card p-3 shadow-sm">
            <header className="flex min-h-[3.5rem] items-center justify-between rounded-md bg-slate-200 px-3 py-2 text-slate-800">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Inbox className="h-4 w-4" />
                Aguardando aprovação
              </h2>
              <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold">
                {pendentes.length}
              </span>
            </header>


            {pendentes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum pedido aguardando aprovação.</p>
            ) : (
              pendentes.map((order) => (
                <article key={order.id} className="rounded-md border bg-background p-3 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setDetalhe(order)}
                    className="w-full text-left"
                  >
                    <p className="text-sm font-semibold text-foreground">
                      Pedido #{order.order_number}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {order.customers?.full_name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{resumoItens(order)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBRL(Number(order.total))} ·{" "}
                      {PAGAMENTOS[order.payment_method] ?? order.payment_method}
                    </p>
                  </button>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      disabled={processando === order.id}
                      onClick={() => decidir(order, true)}
                    >
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={processando === order.id}
                      onClick={() => decidir(order, false)}
                    >
                      Rejeitar
                    </Button>
                  </div>
                </article>
              ))
            )}
          </section>

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
                  "flex min-h-64 flex-col gap-3 rounded-lg border bg-card p-3 shadow-sm transition-colors",
                  colunaAlvo === coluna.status && "border-primary bg-accent",
                )}
              >
                <header
                  className={cn(
                    "flex min-h-[3.5rem] items-center justify-between rounded-md px-3 py-2",
                    coluna.header,
                  )}
                >
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <coluna.icon className="h-4 w-4" />
                    {coluna.label}
                  </h2>
                  <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold">
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
                  {detalhe.customers?.full_name} · {formatPhone(detalhe.customers?.phone ?? "")}
                  <br />
                  {enderecoCompleto(detalhe)}
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
