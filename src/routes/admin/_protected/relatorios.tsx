import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/product-photos";

export const Route = createFileRoute("/admin/_protected/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios | Painel do Cardápio Digital" },
      {
        name: "description",
        content: "Veja a quantidade de pedidos por dia e exporte a lista completa para Excel.",
      },
      { property: "og:title", content: "Relatórios | Painel do Cardápio Digital" },
      {
        property: "og:description",
        content: "Pedidos por dia e exportação detalhada em planilha.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminRelatorios,
});

const STATUS_LABEL: Record<string, string> = {
  aguardando_aprovacao: "Aguardando aprovação",
  pedidos_a_fazer: "Pedidos a fazer",
  fazendo: "Fazendo",
  saiu_para_entrega: "Saiu para a entrega",
  rejeitado: "Rejeitado",
};

const PAGAMENTOS: Record<string, string> = {
  credito: "Crédito",
  debito: "Débito",
  pix: "Pix",
};

type OrderRow = {
  order_number: number;
  created_at: string;
  total: number;
  payment_method: string;
  status: string;
  customers: { full_name: string } | null;
};

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function AdminRelatorios() {
  const { user } = Route.useRouteContext();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin", "orders", "relatorios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("order_number, created_at, total, payment_method, status, customers(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as OrderRow[];
    },
  });

  const porDia = orders.reduce<Array<{ dia: string; quantidade: number }>>((acc, o) => {
    const dia = dayKey(o.created_at);
    const existente = acc.find((d) => d.dia === dia);
    if (existente) existente.quantidade += 1;
    else acc.push({ dia, quantidade: 1 });
    return acc;
  }, []);

  const maximo = Math.max(1, ...porDia.map((d) => d.quantidade));

  async function exportar() {
    if (orders.length === 0) {
      toast.error("Não há pedidos para exportar.");
      return;
    }
    const XLSX = await import("xlsx");
    const linhas = orders.map((o) => ({
      Data: new Date(o.created_at).toLocaleString("pt-BR"),
      "Número do pedido": o.order_number,
      Cliente: o.customers?.full_name ?? "",
      Total: Number(o.total),
      "Forma de pagamento": PAGAMENTOS[o.payment_method] ?? o.payment_method,
      Status: STATUS_LABEL[o.status] ?? o.status,
    }));
    const sheet = XLSX.utils.json_to_sheet(linhas);
    sheet["!cols"] = [{ wch: 20 }, { wch: 18 }, { wch: 28 }, { wch: 12 }, { wch: 20 }, { wch: 22 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Pedidos");
    XLSX.writeFile(book, "pedidos.xlsx");
    toast.success("Planilha exportada.");
  }

  return (
    <AdminShell
      title="Relatórios"
      description="Quantidade de pedidos por dia e exportação da lista completa."
      email={user.email ?? undefined}
      actions={
        <Button onClick={exportar} disabled={isLoading}>
          <Download className="h-4 w-4" />
          Exportar para Excel
        </Button>
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando pedidos...</p>
      ) : porDia.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pedido registrado até agora.</p>
      ) : (
        <div className="space-y-6">
          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Pedidos por dia</h2>
            <ul className="space-y-3">
              {porDia.map((d) => (
                <li key={d.dia} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-sm text-muted-foreground">{d.dia}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(d.quantidade / maximo) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                    {d.quantidade}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Data</th>
                  <th className="px-4 py-2 font-medium">Pedido</th>
                  <th className="px-4 py-2 font-medium">Cliente</th>
                  <th className="px-4 py-2 font-medium">Total</th>
                  <th className="px-4 py-2 font-medium">Pagamento</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.order_number} className="border-b last:border-0">
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(o.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-2 font-medium text-foreground">#{o.order_number}</td>
                    <td className="px-4 py-2 text-muted-foreground">{o.customers?.full_name}</td>
                    <td className="px-4 py-2 text-foreground">{formatBRL(Number(o.total))}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {PAGAMENTOS[o.payment_method] ?? o.payment_method}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {STATUS_LABEL[o.status] ?? o.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </AdminShell>
  );
}
