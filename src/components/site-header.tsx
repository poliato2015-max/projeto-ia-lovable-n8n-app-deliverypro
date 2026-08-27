import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { UtensilsCrossed } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { Button } from "@/components/ui/button";

/** Cabeçalho persistente das telas do cliente. */
export function SiteHeader({ actions }: { actions?: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const { user } = useSession();
  const clienteLogado = !!user;

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (ativo && isAdmin) setAdminEmail(user.email ?? "");
    })();
    return () => {
      ativo = false;
    };
  }, []);

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    setAdminEmail(null);
    navigate({ to: "/", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <UtensilsCrossed className="h-4 w-4" />
          </span>
          <span className="text-lg font-bold text-foreground">DeliveryPro</span>
        </Link>
        <Link
          to="/cardapio"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          activeProps={{ className: "text-primary" }}
        >
          Cardápio
        </Link>
        {clienteLogado ? (
          <Link
            to="/meus-pedidos"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            activeProps={{ className: "text-primary" }}
          >
            Meus Pedidos
          </Link>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {adminEmail !== null ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin">Área Admin</Link>
              </Button>
              <span className="hidden max-w-[180px] truncate text-xs text-muted-foreground sm:inline">
                {adminEmail}
              </span>
            </>
          ) : null}
          {clienteLogado ? (
            <Button variant="outline" size="sm" onClick={sair}>
              Sair
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link to="/conta">Entrar</Link>
            </Button>
          )}
          {actions}
        </div>
      </div>
    </header>
  );
}
