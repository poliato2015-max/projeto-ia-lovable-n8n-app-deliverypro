import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type CartAddon = {
  productId: string;
  name: string;
  price: number;
};

export type CartLine = {
  lineId: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  photoPath: string | null;
  notes: string;
  addons: CartAddon[];
};

export function lineUnitPrice(line: CartLine) {
  return line.price + line.addons.reduce((acc, a) => acc + a.price, 0);
}

export function lineTotal(line: CartLine) {
  return lineUnitPrice(line) * line.quantity;
}

type CartContextValue = {
  items: CartLine[];
  addLine: (line: Omit<CartLine, "lineId">) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;
  clear: () => void;
  totalItems: number;
  subtotal: number;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);

  const value = useMemo<CartContextValue>(() => {
    return {
      items,
      addLine: (line) =>
        setItems((current) => [
          ...current,
          { ...line, lineId: crypto.randomUUID(), quantity: Math.min(100, line.quantity) },
        ]),
      updateQuantity: (lineId, quantity) =>
        setItems((current) =>
          quantity <= 0
            ? current.filter((i) => i.lineId !== lineId)
            : current.map((i) =>
                i.lineId === lineId ? { ...i, quantity: Math.min(100, quantity) } : i,
              ),
        ),
      removeLine: (lineId) => setItems((current) => current.filter((i) => i.lineId !== lineId)),
      clear: () => setItems([]),
      totalItems: items.reduce((acc, i) => acc + i.quantity, 0),
      subtotal: items.reduce((acc, i) => acc + lineTotal(i), 0),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart precisa estar dentro de CartProvider");
  return ctx;
}
