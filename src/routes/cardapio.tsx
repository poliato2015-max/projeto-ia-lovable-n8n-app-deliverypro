import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { formatBRL, getPhotoUrls } from "@/lib/product-photos";
import { useCart } from "@/lib/cart";
import { SiteHeader } from "@/components/site-header";
import { CartSheet } from "@/components/cart-sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

export const Route = createFileRoute("/cardapio")({
  head: () => ({
    meta: [
      { title: "Cardápio | DeliveryPro" },
      {
        name: "description",
        content:
          "Monte seu pedido no DeliveryPro: hambúrgueres artesanais com adicionais à sua escolha.",
      },
      { property: "og:title", content: "Cardápio | DeliveryPro" },
      {
        property: "og:description",
        content:
          "Monte seu pedido no DeliveryPro: hambúrgueres artesanais com adicionais à sua escolha.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Cardapio,
});

function Cardapio() {
  const [selecionado, setSelecionado] = useState<Product | null>(null);

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

  const { data: links = [] } = useQuery({
    queryKey: ["cardapio", "product-addons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_addons").select("product_id, addon_id");
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
  const addonsById = new Map(products.filter((p) => p.category === "adicional").map((p) => [p.id, p]));
  const addonsDo = (productId: string) =>
    links
      .filter((l) => l.product_id === productId)
      .map((l) => addonsById.get(l.addon_id))
      .filter((p): p is Product => !!p);

  return (
    <div className="min-h-screen bg-client-bg">
      <SiteHeader actions={<CartSheet />} />
      <main className="px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-8">
          <header className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">Cardápio</h1>
            <p className="text-muted-foreground">
              Escolha seu hambúrguer e monte com os adicionais que quiser.
            </p>
            <Link to="/" className="inline-block text-sm text-primary underline">
              Voltar para o início
            </Link>
          </header>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando cardápio...</p>
          ) : hamburgueres.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda não há hambúrgueres disponíveis no cardápio.
            </p>
          ) : (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Hambúrgueres</h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {hamburgueres.map((product) => (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => setSelecionado(product)}
                      className="flex w-full gap-4 rounded-lg border bg-card p-4 text-left shadow-sm transition hover:border-primary"
                    >
                      <img
                        src={product.photo_url ? photoUrls[product.photo_url] : undefined}
                        alt={`Foto de ${product.name}`}
                        loading="lazy"
                        className="h-20 w-20 shrink-0 rounded-md bg-muted object-cover"
                      />
                      <div className="min-w-0">
                        <h3 className="font-medium text-foreground">{product.name}</h3>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {product.description}
                        </p>
                        <p className="mt-1 font-semibold text-foreground">
                          {formatBRL(Number(product.price))}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <ConfigDialog
          product={selecionado}
          addons={selecionado ? addonsDo(selecionado.id) : []}
          photoUrl={selecionado?.photo_url ? photoUrls[selecionado.photo_url] : undefined}
          onClose={() => setSelecionado(null)}
        />
      </main>
    </div>
  );

}

function ConfigDialog({
  product,
  addons,
  photoUrl,
  onClose,
}: {
  product: Product | null;
  addons: Product[];
  photoUrl?: string;
  onClose: () => void;
}) {
  const { addLine } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (product && loadedFor !== product.id) {
    setLoadedFor(product.id);
    setQuantity(1);
    setSelected([]);
    setNotes("");
  }
  if (!product && loadedFor !== null) setLoadedFor(null);

  if (!product) return null;

  const escolhidos = addons.filter((a) => selected.includes(a.id));
  const unit = Number(product.price) + escolhidos.reduce((acc, a) => acc + Number(a.price), 0);
  const total = unit * quantity;

  return (
    <Dialog open={!!product} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>{product.description}</DialogDescription>
        </DialogHeader>

        <img
          src={photoUrl}
          alt={`Foto de ${product.name}`}
          className="h-40 w-full rounded-md bg-muted object-cover"
        />

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Adicionais</h3>
          {addons.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum adicional disponível para este hambúrguer.
            </p>
          ) : (
            <ul className="space-y-2">
              {addons.map((addon) => (
                <li key={addon.id} className="flex items-center gap-3">
                  <Checkbox
                    id={`addon-${addon.id}`}
                    checked={selected.includes(addon.id)}
                    onCheckedChange={(checked) =>
                      setSelected((current) =>
                        checked
                          ? [...current, addon.id]
                          : current.filter((id) => id !== addon.id),
                      )
                    }
                  />
                  <Label htmlFor={`addon-${addon.id}`} className="flex-1 cursor-pointer">
                    {addon.name}
                  </Label>
                  <span className="text-sm text-muted-foreground">
                    + {formatBRL(Number(addon.price))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Observações (opcional)</Label>
          <Textarea
            id="notes"
            value={notes}
            maxLength={300}
            placeholder="Ex.: sem cebola"
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Diminuir quantidade"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span aria-live="polite" className="w-8 text-center text-sm font-medium">
              {quantity}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Aumentar quantidade"
              onClick={() => setQuantity((q) => Math.min(100, q + 1))}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-lg font-semibold text-foreground">{formatBRL(total)}</p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              addLine({
                productId: product.id,
                name: product.name,
                price: Number(product.price),
                quantity,
                photoPath: product.photo_url,
                notes: notes.trim(),
                addons: escolhidos.map((a) => ({
                  productId: a.id,
                  name: a.name,
                  price: Number(a.price),
                })),
              });
              toast.success(`${product.name} adicionado ao carrinho.`);
              onClose();
            }}
          >
            Adicionar ao carrinho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
