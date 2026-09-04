import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";

import { useCart, lineTotal } from "@/lib/cart";
import { formatBRL, getPhotoUrls } from "@/lib/product-photos";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/** Botão de carrinho com contador + painel lateral deslizante. */
export function CartSheet() {
  const { items, totalItems, subtotal, updateQuantity, removeLine } = useCart();
  const [open, setOpen] = useState(false);

  const paths = items.map((i) => i.photoPath);
  const { data: photoUrls = {} } = useQuery({
    queryKey: ["photo-urls", "carrinho", paths.join(",")],
    queryFn: () => getPhotoUrls(paths),
    enabled: paths.some(Boolean),
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative" aria-label="Abrir carrinho">
          <ShoppingCart className="h-4 w-4" />
          <span className="ml-2 hidden sm:inline">Carrinho</span>
          <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
            {totalItems}
          </span>
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="flex w-full flex-col gap-0 bg-card p-0 sm:max-w-md">
        <SheetHeader className="border-b px-4 py-4">
          <SheetTitle className="text-foreground">Carrinho ({totalItems})</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Seu carrinho está vazio.</p>
          ) : (
            items.map((item) => (
              <article key={item.lineId} className="flex gap-3 rounded-lg border bg-card p-3">
                <img
                  src={item.photoPath ? photoUrls[item.photoPath] : undefined}
                  alt={`Foto de ${item.name}`}
                  loading="lazy"
                  className="h-16 w-16 shrink-0 rounded-md bg-muted object-contain"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 truncate font-medium text-foreground">
                      {item.name}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      aria-label={`Remover ${item.name}`}
                      onClick={() => removeLine(item.lineId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {item.addons.length > 0 ? (
                    <ul className="space-y-0.5 text-xs text-muted-foreground">
                      {item.addons.map((a) => (
                        <li key={a.productId}>
                          + {a.name} ({formatBRL(a.price)})
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {item.notes ? (
                    <p className="text-xs text-muted-foreground">Obs.: {item.notes}</p>
                  ) : null}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Diminuir ${item.name}`}
                        onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-7 text-center text-sm font-medium text-foreground">
                        {item.quantity}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Aumentar ${item.name}`}
                        onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="font-semibold text-foreground">{formatBRL(lineTotal(item))}</p>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <footer className="space-y-3 border-t bg-card px-4 py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-base font-semibold text-foreground">{formatBRL(subtotal)}</span>
          </div>
          <Button asChild className="w-full" disabled={items.length === 0}>
            <Link to="/checkout" onClick={() => setOpen(false)}>
              Ir para o checkout
            </Link>
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
