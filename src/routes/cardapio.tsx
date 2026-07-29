import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { formatBRL, getPhotoUrls } from "@/lib/product-photos";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

export const Route = createFileRoute("/cardapio")({
  head: () => ({
    meta: [
      { title: "Cardápio | Delivery de Hambúrguer" },
      {
        name: "description",
        content:
          "Confira os hambúrgueres artesanais e adicionais disponíveis para delivery hoje.",
      },
      { property: "og:title", content: "Cardápio | Delivery de Hambúrguer" },
      {
        property: "og:description",
        content:
          "Confira os hambúrgueres artesanais e adicionais disponíveis para delivery hoje.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Cardapio,
});

function Cardapio() {
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["cardapio"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: photoUrls = {} } = useQuery({
    queryKey: ["photo-urls", "cardapio", products.map((p) => p.photo_url).join(",")],
    queryFn: () => getPhotoUrls(products.map((p) => p.photo_url)),
    enabled: products.length > 0,
  });

  const hamburgueres = products.filter((p) => p.category === "hamburguer");
  const adicionais = products.filter((p) => p.category === "adicional");

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-10">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Cardápio</h1>
          <p className="text-muted-foreground">Escolha seu hambúrguer favorito e os adicionais.</p>
          <Link to="/" className="inline-block text-sm text-primary underline">
            Voltar para o início
          </Link>
        </header>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando cardápio...</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda não há produtos disponíveis no cardápio.
          </p>
        ) : (
          <>
            <Secao titulo="Hambúrgueres" items={hamburgueres} photoUrls={photoUrls} />
            <Secao titulo="Adicionais" items={adicionais} photoUrls={photoUrls} />
          </>
        )}
      </div>
    </main>
  );
}

function Secao({
  titulo,
  items,
  photoUrls,
}: {
  titulo: string;
  items: Product[];
  photoUrls: Record<string, string>;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">{titulo}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum item disponível nesta seção.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((product) => (
            <li key={product.id} className="flex gap-4 rounded-lg border bg-card p-4">
              <img
                src={product.photo_url ? photoUrls[product.photo_url] : undefined}
                alt={`Foto de ${product.name}`}
                loading="lazy"
                className="h-20 w-20 shrink-0 rounded-md bg-muted object-cover"
              />
              <div className="min-w-0">
                <h3 className="font-medium text-foreground">{product.name}</h3>
                <p className="text-sm text-muted-foreground">{product.description}</p>
                <p className="mt-1 font-semibold text-foreground">
                  {formatBRL(Number(product.price))}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
