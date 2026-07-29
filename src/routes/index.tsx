import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Delivery de Hambúrguer | Cardápio Digital" },
      {
        name: "description",
        content:
          "Delivery de hambúrgueres artesanais e adicionais. Cardápio digital em construção.",
      },
      { property: "og:title", content: "Delivery de Hambúrguer | Cardápio Digital" },
      {
        property: "og:description",
        content:
          "Delivery de hambúrgueres artesanais e adicionais. Cardápio digital em construção.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <h1 className="text-3xl font-bold text-foreground">Delivery de Hambúrguer</h1>
      <p className="max-w-md text-muted-foreground">
        A base de dados do cardápio digital está pronta. As telas de cardápio, checkout e
        acompanhamento de pedidos chegam nas próximas etapas.
      </p>
      <Link
        to="/admin/login"
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Área do administrador
      </Link>
    </main>
  );
}
