import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminUser = { userId: string; email: string };

/** Garante que quem chamou é admin; devolve o client de serviço. */
async function exigirAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !isAdmin) throw new Error("Acesso restrito a administradores.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function listarContas(supabaseAdmin: any) {
  const contas: { id: string; email: string }[] = [];
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("Não foi possível ler as contas.");
    const users = data?.users ?? [];
    users.forEach((u: any) => contas.push({ id: u.id, email: u.email ?? "" }));
    if (users.length < 1000) break;
  }
  return contas;
}

export const listarAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUser[]> => {
    const supabaseAdmin = await exigirAdmin(context as any);
    const { data: papeis, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (error) throw new Error("Não foi possível carregar os administradores.");
    const contas = await listarContas(supabaseAdmin);
    const mapa = new Map(contas.map((c) => [c.id, c.email]));
    return (papeis ?? []).map((p: any) => ({
      userId: p.user_id as string,
      email: mapa.get(p.user_id) ?? "(conta removida)",
    }));
  });

export const promoverAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ email: z.string().min(3).max(254) }).parse(data))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await exigirAdmin(context as any);
    const email = data.email.trim().toLowerCase();
    const contas = await listarContas(supabaseAdmin);
    const conta = contas.find((c) => c.email.toLowerCase() === email);
    if (!conta) {
      return {
        ok: false as const,
        mensagem:
          "Nenhuma conta encontrada com esse e-mail — a pessoa precisa se cadastrar primeiro em /conta",
      };
    }
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: conta.id, role: "admin" }, { onConflict: "user_id,role" });
    if (error) return { ok: false as const, mensagem: "Não foi possível conceder o papel admin." };
    return { ok: true as const, mensagem: `${conta.email} agora é administrador.` };
  });

export const removerAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await exigirAdmin(context as any);
    const { count, error: erroCount } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (erroCount) return { ok: false as const, mensagem: "Não foi possível verificar os admins." };
    if ((count ?? 0) <= 1) {
      return {
        ok: false as const,
        mensagem:
          "Este é o único administrador do sistema. Promova outra conta antes de remover, para o painel nunca ficar sem acesso.",
      };
    }
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", "admin");
    if (error) return { ok: false as const, mensagem: "Não foi possível remover o papel admin." };
    return { ok: true as const, mensagem: "Administrador removido." };
  });
