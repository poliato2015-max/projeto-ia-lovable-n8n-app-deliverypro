import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/;

export const checkoutSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Informe o nome completo.")
    .max(120, "Nome muito longo.")
    .regex(NAME_RE, "O nome deve conter apenas letras e espaços."),
  email: z
    .string()
    .trim()
    .email("Informe um e-mail válido.")
    .max(254, "E-mail muito longo."),
  phone: z.string().regex(/^[0-9]{11}$/, "O celular deve ter 11 dígitos."),
  cep: z.string().regex(/^[0-9]{8}$/, "O CEP deve ter 8 dígitos."),
  paymentMethod: z.enum(["credito", "debito", "pix"], {
    errorMap: () => ({ message: "Escolha uma forma de pagamento." }),
  }),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(100),
      }),
    )
    .min(1, "O carrinho está vazio."),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => checkoutSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ids = data.items.map((i) => i.productId);
    const { data: products, error: productsError } = await supabaseAdmin
      .from("products")
      .select("id, price, is_active")
      .in("id", ids);
    if (productsError) throw new Error("Não foi possível validar os produtos do carrinho.");

    const activeProducts = (products ?? []).filter((p) => p.is_active);
    if (activeProducts.length !== ids.length) {
      throw new Error("Algum item do carrinho não está mais disponível.");
    }

    const priceById = new Map(activeProducts.map((p) => [p.id, Number(p.price)]));
    const subtotal = data.items.reduce(
      (acc, item) => acc + (priceById.get(item.productId) ?? 0) * item.quantity,
      0,
    );

    const { data: settings } = await supabaseAdmin
      .from("delivery_settings")
      .select("delivery_fee, free_shipping_enabled")
      .limit(1)
      .maybeSingle();

    const deliveryFee = settings?.free_shipping_enabled ? 0 : Number(settings?.delivery_fee ?? 0);
    const total = subtotal + deliveryFee;

    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .insert({
        full_name: data.fullName,
        email: data.email,
        phone: data.phone,
        cep: data.cep,
      })
      .select("id")
      .single();
    if (customerError || !customer) throw new Error("Não foi possível salvar seus dados.");

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_id: customer.id,
        status: "aguardando_aprovacao",
        payment_status: "pendente",
        payment_method: data.paymentMethod,
        delivery_fee: deliveryFee,
        total,
      })
      .select("id, order_number")
      .single();
    if (orderError || !order) throw new Error("Não foi possível criar o pedido.");

    const { error: itemsError } = await supabaseAdmin.from("order_items").insert(
      data.items.map((item) => ({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: priceById.get(item.productId) ?? 0,
      })),
    );
    if (itemsError) throw new Error("Não foi possível salvar os itens do pedido.");

    return { orderNumber: order.order_number, total, deliveryFee, subtotal };
  });
