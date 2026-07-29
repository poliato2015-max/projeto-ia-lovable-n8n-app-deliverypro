import { createServerFn } from "@tanstack/react-start";

import { checkoutSchema } from "./checkout-schema";

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
