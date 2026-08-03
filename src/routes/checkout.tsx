import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useCart, lineTotal } from "@/lib/cart";
import { formatBRL } from "@/lib/product-photos";
import { checkoutSchema } from "@/lib/checkout-schema";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout | DeliveryPro" },
      {
        name: "description",
        content: "Finalize seu pedido no DeliveryPro: seus dados, o pagamento e a confirmação.",
      },
      { property: "og:title", content: "Checkout | DeliveryPro" },
      {
        property: "og:description",
        content: "Finalize seu pedido no DeliveryPro: seus dados, o pagamento e a confirmação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },

    ],
  }),
  component: Checkout,
});

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function maskPhone(digits: string) {
  const d = digits.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

type Errors = Partial<Record<"fullName" | "email" | "phone" | "cep" | "paymentMethod", string>>;

function Checkout() {
  const navigate = useNavigate();
  const { items, subtotal, updateQuantity, removeLine, clear } = useCart();

  const [confirmado, setConfirmado] = useState<{ orderNumber: number; total: number } | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cep, setCep] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [enviando, setEnviando] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["delivery-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_settings")
        .select("delivery_fee, free_shipping_enabled")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const deliveryFee = settings?.free_shipping_enabled ? 0 : Number(settings?.delivery_fee ?? 0);
  const total = subtotal + deliveryFee;

  useEffect(() => {
    if (items.length === 0 && !confirmado) {
      navigate({ to: "/cardapio", replace: true });
    }
  }, [items.length, confirmado, navigate]);

  if (confirmado) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <h1 className="text-3xl font-bold text-foreground">Pedido confirmado!</h1>
        <p className="text-muted-foreground">
          Seu pedido é o número{" "}
          <span className="font-semibold text-foreground">#{confirmado.orderNumber}</span>.
        </p>
        <p className="text-muted-foreground">
          Total: <span className="font-semibold text-foreground">{formatBRL(confirmado.total)}</span>
        </p>
        <p className="max-w-md text-sm text-muted-foreground">
          Estamos aguardando a aprovação do restaurante. Em breve seu pedido entra em preparo.
        </p>
        <Button asChild>
          <Link to="/cardapio">Voltar ao cardápio</Link>
        </Button>
      </main>
    );
  }

  if (items.length === 0) return null;

  async function confirmar() {
    const payload = {
      fullName,
      email,
      phone,
      cep,
      paymentMethod,
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        notes: i.notes || undefined,
        addons: i.addons.map((a) => a.productId),
      })),
    };

    const parsed = checkoutSchema.safeParse(payload);
    if (!parsed.success) {
      const novos: Errors = {};
      for (const issue of parsed.error.issues) {
        const campo = issue.path[0] as keyof Errors;
        if (campo && !novos[campo]) novos[campo] = issue.message;
      }
      setErrors(novos);
      toast.error("Confira os campos destacados para continuar.");
      return;
    }

    setErrors({});
    setEnviando(true);
    try {
      const { data: orderNumber, error } = await supabase.rpc("create_order", {
        p_full_name: parsed.data.fullName,
        p_email: parsed.data.email,
        p_phone: parsed.data.phone,
        p_cep: parsed.data.cep,
        p_payment_method: parsed.data.paymentMethod,
        p_items: parsed.data.items,
      });
      if (error || orderNumber == null) throw error ?? new Error("Pedido não criado");
      const totalConfirmado = total;
      clear();
      setConfirmado({ orderNumber, total: totalConfirmado });
    } catch {
      toast.error("Não foi possível finalizar o pedido. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Checkout</h1>
          <Link to="/cardapio" className="inline-block text-sm text-primary underline">
            Voltar ao cardápio
          </Link>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Seu pedido</h2>
          <ul className="divide-y rounded-lg border bg-card">
            {items.map((item) => (
              <li key={item.lineId} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate font-medium text-foreground">{item.name}</p>
                  {item.addons.length > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Adicionais:{" "}
                      {item.addons
                        .map((a) => `${a.name} (${formatBRL(a.price)})`)
                        .join(", ")}
                    </p>
                  ) : null}
                  {item.notes ? (
                    <p className="text-sm text-muted-foreground">Obs.: {item.notes}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Diminuir ${item.name}`}
                    onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Aumentar ${item.name}`}
                    onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover ${item.name}`}
                    onClick={() => removeLine(item.lineId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="w-24 text-right font-semibold text-foreground">
                  {formatBRL(lineTotal(item))}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Seus dados</h2>

          <div className="space-y-2">
            <Label htmlFor="fullName">Nome completo</Label>
            <Input
              id="fullName"
              value={fullName}
              maxLength={120}
              autoComplete="name"
              onChange={(e) => setFullName(e.target.value)}
            />
            {errors.fullName ? (
              <p className="text-sm text-destructive">{errors.fullName}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              maxLength={254}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
            />
            {errors.email ? <p className="text-sm text-destructive">{errors.email}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Celular</Label>
            <Input
              id="phone"
              inputMode="numeric"
              placeholder="(11) 91234-5678"
              value={maskPhone(phone)}
              autoComplete="tel"
              onChange={(e) => setPhone(onlyDigits(e.target.value).slice(0, 11))}
            />
            {errors.phone ? <p className="text-sm text-destructive">{errors.phone}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cep">CEP</Label>
            <Input
              id="cep"
              inputMode="numeric"
              placeholder="00000000"
              value={cep}
              autoComplete="postal-code"
              onChange={(e) => setCep(onlyDigits(e.target.value).slice(0, 8))}
            />
            {errors.cep ? <p className="text-sm text-destructive">{errors.cep}</p> : null}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Forma de pagamento</h2>
          <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="gap-3">
            {[
              { value: "credito", label: "Crédito" },
              { value: "debito", label: "Débito" },
              { value: "pix", label: "Pix" },
            ].map((opcao) => (
              <div key={opcao.value} className="flex items-center gap-2">
                <RadioGroupItem value={opcao.value} id={`pagamento-${opcao.value}`} />
                <Label htmlFor={`pagamento-${opcao.value}`}>{opcao.label}</Label>
              </div>
            ))}
          </RadioGroup>
          {errors.paymentMethod ? (
            <p className="text-sm text-destructive">{errors.paymentMethod}</p>
          ) : null}
        </section>

        <section className="space-y-2 rounded-lg border bg-card p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">{formatBRL(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Taxa de entrega</span>
            <span className="text-foreground">{formatBRL(deliveryFee)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span className="text-foreground">Total</span>
            <span className="text-foreground">{formatBRL(total)}</span>
          </div>
        </section>

        <Button className="w-full" size="lg" disabled={enviando} onClick={confirmar}>
          {enviando ? "Enviando pedido..." : "Confirmar pedido"}
        </Button>
      </div>
    </main>
  );
}
