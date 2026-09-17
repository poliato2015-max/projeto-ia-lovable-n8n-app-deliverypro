import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { UtensilsCrossed } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { CartSheet } from "@/components/cart-sheet";
import { useSession } from "@/lib/use-session";
import { Button } from "@/components/ui/button";
import { AdminLayout, PublicLayout } from "@/components/layout-container";

/** Cabeçalho persistente das telas do cliente. */
export function SiteHeader({
  actions,
  layout = "public",
}: {
  actions?: ReactNode;
  layout?: "public" | "admin";
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const { user } = useSession();
  const clienteLogado = !!user;
  const email = user?.email ?? "";

  useEffect(() => {
    let ativo = true;
    if (!user) {
      setIsAdmin(false);
      return;
    }
    (async () => {
      const { data } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (ativo) setIsAdmin(!!data);
    })();
    return () => {
      ativo = false;
    };
  }, [user]);

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    setIsAdmin(false);
    navigate({ to: "/", replace: true });
  }

  const Layout = layout === "admin" ? AdminLayout : PublicLayout;

  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
      <Layout className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-3 sm:flex sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <Link to="/" className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <UtensilsCrossed className="h-4 w-4" />
          </span>
          <span className="truncate text-sm font-bold text-foreground sm:text-lg">DeliveryPro</span>
        </Link>
        <Link
          to="/cardapio"
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-primary sm:text-sm"
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
        {clienteLogado && isAdmin ? (
          <Link
            to="/admin"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            activeProps={{ className: "text-primary" }}
          >
            Área Admin
          </Link>
        ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:ml-auto sm:gap-2">
          {clienteLogado && email ? (
            <span className="hidden max-w-[180px] truncate text-xs text-muted-foreground sm:inline">
              {email}
            </span>
          ) : null}
          {clienteLogado ? (
            <Button variant="outline" size="sm" onClick={sair}>
              Sair
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm" className="px-1 sm:px-3">
              <Link to="/conta">Entrar</Link>
            </Button>
          )}
          {clienteLogado ? <CartSheet /> : null}
          {actions}
        </div>
      </Layout>
    </header>
  );
}
