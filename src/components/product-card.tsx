import type { ReactNode } from "react";
import { Plus } from "lucide-react";

import { formatBRL } from "@/lib/product-photos";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

type Emblema = { texto: string; classe: string } | null;

interface ProductCardProps {
  product: Product;
  photoUrl?: string;
  emblema?: Emblema;
  onClick?: () => void;
  children?: ReactNode;
}

export function ProductCard({ product, photoUrl, emblema, onClick, children }: ProductCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full w-full flex-col overflow-hidden rounded-xl bg-card text-left transition hover:-translate-y-0.5 hover:border-primary"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <img
          src={photoUrl}
          alt={`Foto de ${product.name}`}
          loading="lazy"
          className="h-full w-full object-cover object-center"
        />
        {emblema ? (
          <span
            className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${emblema.classe}`}
          >
            {emblema.texto}
          </span>
        ) : null}
        <span className="absolute -bottom-5 right-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition group-hover:scale-105">
          <Plus className="h-5 w-5" />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4 pt-5">
        <h3 className="pr-10 font-semibold text-foreground">{product.name}</h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
        <p className="mt-auto pt-3 text-lg font-bold text-foreground">
          {formatBRL(Number(product.price))}
        </p>
      </div>
      {children}
    </button>
  );
}
