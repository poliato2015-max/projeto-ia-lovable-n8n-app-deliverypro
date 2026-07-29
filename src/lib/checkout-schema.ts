import { z } from "zod";

const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/;

export const checkoutSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Informe o nome completo.")
    .max(120, "Nome muito longo.")
    .regex(NAME_RE, "O nome deve conter apenas letras e espaços."),
  email: z.string().trim().email("Informe um e-mail válido.").max(254, "E-mail muito longo."),
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
        notes: z.string().max(300, "A observação deve ter no máximo 300 caracteres.").optional(),
        addons: z.array(z.string().uuid()).default([]),
      }),
    )
    .min(1, "O carrinho está vazio."),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
