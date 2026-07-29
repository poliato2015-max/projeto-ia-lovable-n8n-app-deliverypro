import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/admin/_protected/")({
  head: () => ({
    meta: [
      { title: "Painel do administrador | Cardápio Digital" },
      {
        name: "description",
        content: "Painel administrativo do delivery: produtos, pedidos e entrega.",
      },
      { property: "og:title", content: "Painel do administrador | Cardápio Digital" },
      {
        property: "og:description",
        content: "Painel administrativo do delivery: produtos, pedidos e entrega.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminHome,
});

function AdminHome() {
  const { user } = Route.useRouteContext();

  const { data: settings } = useQuery({
    queryKey: ["delivery_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("delivery_settings").select("*").limit(1).single();
      if (error) throw error;
      return data;
    },
  });

  return (
    <AdminShell
      title="Visão geral"
      description="Resumo das configurações do delivery."
      email={user.email ?? undefined}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Configurações de entrega</CardTitle>
            <CardDescription>Valores iniciais cadastrados no banco de dados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            {settings ? (
              <>
                <p>CEP da loja: {settings.store_cep}</p>
                <p>Taxa de entrega: R$ {Number(settings.delivery_fee).toFixed(2)}</p>
                <p>Frete grátis: {settings.free_shipping_enabled ? "ativado" : "desativado"}</p>
                <p>Limite de alcance: {settings.delivery_range_limit}</p>
              </>
            ) : (
              <p>Carregando...</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximos passos</CardTitle>
            <CardDescription>
              As telas de checkout e o Kanban de pedidos ainda serão construídas.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </AdminShell>
  );
}
