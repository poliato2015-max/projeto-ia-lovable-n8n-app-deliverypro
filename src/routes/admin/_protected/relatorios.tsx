import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/product-photos";

export const Route = createFileRoute("/admin/_protected/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios | Painel do Cardápio Digital" },
      {
        name: "description",
        content:
          "Status dos pedidos ao vivo, resumo por período, gráficos, mais vendidos e exportação em XLSX ou CSV.",
      },
      { property: "og:title", content: "Relatórios | Painel do Cardápio Digital" },
      {
        property: "og:description",
        content: "Painel de indicadores do delivery com filtro de período e exportação.",
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

// Resumo curto dos itens, no mesmo formato do card do Kanban.
function resumoItens(order: OrderRow) {
  const partes = order.order_items.map((item) => {
    const adicionais = item.order_item_addons
      .map((a) => a.products?.name)
      .filter(Boolean)
      .join(", ");
    return `${item.quantity}x ${item.products?.name ?? "Item"}${adicionais ? ` (+ ${adicionais})` : ""}`;
  });
  return partes.join(" • ") || "—";
}


const EXCLUIDOS = ["aguardando_aprovacao", "rejeitado"];

const PAGAMENTOS: Record<string, string> = {
  credito: "Crédito",
  debito: "Débito",
  pix: "Pix",
};

const CORES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type OrderRow = {
  order_number: number;
  created_at: string;
  total: number;
  payment_method: string;
  status: string;
  customers: { full_name: string } | null;
  order_items: Array<{
    quantity: number;
    products: { name: string } | null;
    order_item_addons: Array<{ products: { name: string } | null }>;
  }>;
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function defaultRange() {
  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - 29);
  return { inicio: isoDate(inicio), fim: isoDate(fim) };
}

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function linhasExport(orders: OrderRow[]) {
  return orders.map((o) => ({
    Data: new Date(o.created_at).toLocaleString("pt-BR"),
    "Número do pedido": o.order_number,
    Cliente: o.customers?.full_name ?? "",
    Total: Number(o.total),
    "Forma de pagamento": PAGAMENTOS[o.payment_method] ?? o.payment_method,
    Status: STATUS_LABEL[o.status] ?? o.status,
  }));
}

function AdminRelatorios() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();

  const padrao = defaultRange();
  const [inicio, setInicio] = useState(padrao.inicio);
  const [fim, setFim] = useState(padrao.fim);
  const [periodo, setPeriodo] = useState(padrao);

  const { data: todos = [], isLoading } = useQuery({
    queryKey: ["admin", "orders", "relatorios", periodo.inicio, periodo.fim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "order_number, created_at, total, payment_method, status, customers(full_name), order_items(quantity, products(name), order_item_addons(products(name)))",
        )
        .gte("created_at", `${periodo.inicio}T00:00:00`)
        .lte("created_at", `${periodo.fim}T23:59:59.999`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as OrderRow[];
    },
  });

  const orders = todos.filter((o) => !EXCLUIDOS.includes(o.status));

  const receita = orders.reduce((s, o) => s + Number(o.total), 0);
  const ticket = orders.length > 0 ? receita / orders.length : 0;

  const porDia = orders
    .reduce<Array<{ dia: string; quantidade: number; ts: number }>>((acc, o) => {
      const dia = dayKey(o.created_at);
      const existente = acc.find((d) => d.dia === dia);
      if (existente) existente.quantidade += 1;
      else acc.push({ dia, quantidade: 1, ts: new Date(o.created_at).getTime() });
      return acc;
    }, [])
    .sort((a, b) => a.ts - b.ts);

  // O gráfico de pizza mostra TODOS os status do período, inclusive os excluídos dos indicadores.
  const porStatus = todos.reduce<Array<{ nome: string; valor: number }>>((acc, o) => {
    const nome = STATUS_LABEL[o.status] ?? o.status;
    const existente = acc.find((d) => d.nome === nome);
    if (existente) existente.valor += 1;
    else acc.push({ nome, valor: 1 });
    return acc;
  }, []);


  function ranking(tipo: "produto" | "adicional") {
    const acc: Record<string, number> = {};
    for (const o of orders) {
      for (const item of o.order_items ?? []) {
        if (tipo === "produto") {
          const nome = item.products?.name;
          if (nome) acc[nome] = (acc[nome] ?? 0) + item.quantity;
        } else {
          for (const addon of item.order_item_addons ?? []) {
            const nome = addon.products?.name;
            if (nome) acc[nome] = (acc[nome] ?? 0) + item.quantity;
          }
        }
      }
    }
    return Object.entries(acc)
      .map(([nome, quantidade]) => ({ nome, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);
  }

  const produtosTop = ranking("produto");
  const adicionaisTop = ranking("adicional");

  async function exportarXlsx() {
    if (orders.length === 0) {
      toast.error("Não há pedidos no período selecionado.");
      return;
    }
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(linhasExport(orders));
    sheet["!cols"] = [{ wch: 20 }, { wch: 18 }, { wch: 28 }, { wch: 12 }, { wch: 20 }, { wch: 22 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Pedidos");
    XLSX.writeFile(book, `pedidos-${periodo.inicio}-a-${periodo.fim}.xlsx`);
    toast.success("Planilha exportada.");
  }

  function exportarCsv() {
    if (orders.length === 0) {
      toast.error("Não há pedidos no período selecionado.");
      return;
    }
    const linhas = linhasExport(orders);
    const cabecalho = Object.keys(linhas[0]);
    const escapar = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [
      cabecalho.join(";"),
      ...linhas.map((l) => cabecalho.map((c) => escapar(l[c as keyof typeof l])).join(";")),
    ].join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedidos-${periodo.inicio}-a-${periodo.fim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado.");
  }

  return (
    <AdminShell
      title="Relatórios"
      description="Status ao vivo, indicadores do período, gráficos e exportação."
      email={user.email ?? undefined}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportarCsv} disabled={isLoading}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button onClick={exportarXlsx} disabled={isLoading}>
            <Download className="h-4 w-4" />
            XLSX
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <section className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
          <div className="space-y-1">
            <Label htmlFor="data-inicial">Data inicial</Label>
            <Input
              id="data-inicial"
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="data-final">Data final</Label>
            <Input
              id="data-final"
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              className="w-44"
            />
          </div>
          <Button
            onClick={() => {
              if (inicio > fim) {
                toast.error("A data inicial deve ser anterior à data final.");
                return;
              }
              setPeriodo({ inicio, fim });
            }}
          >
            Atualizar
          </Button>
        </section>




        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Resumo do período ({periodo.inicio.split("-").reverse().join("/")} a{" "}
            {periodo.fim.split("-").reverse().join("/")})
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <article className="rounded-lg border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Total de pedidos</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
                {isLoading ? "—" : orders.length}
              </p>
            </article>
            <article className="rounded-lg border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Receita bruta</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
                {isLoading ? "—" : formatBRL(receita)}
              </p>
            </article>
            <article className="rounded-lg border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Ticket médio</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
                {isLoading ? "—" : formatBRL(ticket)}
              </p>
            </article>
          </div>
        </section>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando pedidos...</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum pedido válido no período selecionado.
          </p>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-lg border bg-card p-4">
                <h2 className="mb-4 text-sm font-semibold text-foreground">Pedidos por dia</h2>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={porDia}>
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="quantidade" name="Pedidos" fill="var(--chart-1)" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </section>

              <section className="rounded-lg border bg-card p-4">
                <h2 className="mb-4 text-sm font-semibold text-foreground">Status dos pedidos</h2>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={porStatus}
                      dataKey="valor"
                      nameKey="nome"
                      innerRadius={50}
                      outerRadius={90}
                    >
                      {porStatus.map((entry, i) => (
                        <Cell key={entry.nome} fill={CORES[i % CORES.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </section>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {[
                { titulo: "Produtos mais vendidos", dados: produtosTop },
                { titulo: "Adicionais mais vendidos", dados: adicionaisTop },
              ].map((bloco) => (
                <section key={bloco.titulo} className="rounded-lg border bg-card p-4">
                  <h2 className="mb-4 text-sm font-semibold text-foreground">{bloco.titulo}</h2>
                  {bloco.dados.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nada vendido no período.</p>
                  ) : (
                    <ul className="space-y-2">
                      {bloco.dados.map((d) => (
                        <li key={d.nome} className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate text-muted-foreground">{d.nome}</span>
                          <span className="font-semibold tabular-nums text-foreground">
                            {d.quantidade}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>

            <section className="overflow-x-auto rounded-lg border bg-card">
              <h2 className="border-b px-4 py-3 text-sm font-semibold text-foreground">
                Pedidos do período
              </h2>
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Data</th>
                    <th className="px-4 py-2 font-medium">Pedido</th>
                    <th className="px-4 py-2 font-medium">Cliente</th>
                    <th className="px-4 py-2 font-medium">Produtos</th>
                    <th className="px-4 py-2 font-medium">Total</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {todos.map((o) => (
                    <tr key={o.order_number} className="border-b last:border-0">
                      <td className="px-4 py-2 text-muted-foreground">
                        {new Date(o.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-2 font-medium text-foreground">#{o.order_number}</td>
                      <td className="px-4 py-2 text-muted-foreground">{o.customers?.full_name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{resumoItens(o)}</td>
                      <td className="px-4 py-2 text-foreground">{formatBRL(Number(o.total))}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {STATUS_LABEL[o.status] ?? o.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

          </>
        )}
      </div>
    </AdminShell>
  );
}
