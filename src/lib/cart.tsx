import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  photoPath: string | null;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  totalItems: number;
  subtotal: number;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const value = useMemo<CartContextValue>(() => {
    return {
      items,
      addItem: (item, quantity) =>
        setItems((current) => {
          const existing = current.find((i) => i.productId === item.productId);
          if (existing) {
            return current.map((i) =>
              i.productId === item.productId
                ? { ...i, quantity: Math.min(100, i.quantity + quantity) }
                : i,
            );
          }
          return [...current, { ...item, quantity: Math.min(100, quantity) }];
        }),
      updateQuantity: (productId, quantity) =>
        setItems((current) =>
          quantity <= 0
            ? current.filter((i) => i.productId !== productId)
            : current.map((i) =>
                i.productId === productId ? { ...i, quantity: Math.min(100, quantity) } : i,
              ),
        ),
      removeItem: (productId) =>
        setItems((current) => current.filter((i) => i.productId !== productId)),
      clear: () => setItems([]),
      totalItems: items.reduce((acc, i) => acc + i.quantity, 0),
      subtotal: items.reduce((acc, i) => acc + i.quantity * i.price, 0),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart precisa estar dentro de CartProvider");
  return ctx;
}
