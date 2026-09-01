import type { User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

/**
 * Garante que o usuário logado tenha uma ficha em `customers`.
 * Usa os dados guardados no cadastro (metadados do Auth) quando a linha
 * ainda não existe — necessário quando o e-mail precisa ser confirmado
 * antes do primeiro login.
 */
export async function garantirFicha(user: User) {
  const { data: existente } = await supabase
    .from("customers")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existente) return true;

  const m = (user.user_metadata ?? {}) as Record<string, unknown>;
  if (!m['full_name'] || !m['cep']) return false;

  const { error } = await supabase.from("customers").upsert({
    id: user.id,
    full_name: String(m['full_name']),
    email: user.email ?? "",
    phone: String(m['phone'] ?? ""),
    cep: String(m['cep']),
    street: (m['street'] as string | null) ?? null,
    number: (m['number'] as string | null) ?? null,
    complement: (m['complement'] as string | null) ?? null,
    neighborhood: (m['neighborhood'] as string | null) ?? null,
    city: (m['city'] as string | null) ?? null,
    state: (m['state'] as string | null) ?? null,
    lat: (m['lat'] as number | null) ?? null,
    lng: (m['lng'] as number | null) ?? null,
  });
  return !error;
}
