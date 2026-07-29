import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = Route.useRouteContext();

  const { data: settings } = useQuery({
    queryKey: ["delivery_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("delivery_settings").select("*").limit(1).single();
      if (error) throw error;
      return data;
    },
  });

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/admin/login", replace: true });
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Painel administrativo</h1>
            <p className="text-sm text-muted-foreground">Conectado como {user.email}</p>
          </div>
          <Button variant="outline" onClick={sair}>
            Sair
          </Button>
        </header>

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
              As telas de cardápio, checkout e Kanban de pedidos ainda serão construídas.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </main>
  );
}
