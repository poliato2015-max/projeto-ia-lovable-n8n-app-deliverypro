import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Settings,
  KanbanSquare,
  LayoutDashboard,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AdminNavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
};

// Adicione novas seções do painel aqui.
export const adminNavItems: AdminNavItem[] = [
  { label: "Produtos", to: "/admin/produtos", icon: Package },
  { label: "Pedidos", to: "/admin/kanban", icon: KanbanSquare },
  { label: "Configuração", to: "/admin/configuracao", icon: Settings },
];


export function AdminShell({
  title,
  description,
  email,
  actions,
  children,
}: {
  title: string;
  description?: string;
  email?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/admin/login", replace: true });
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:flex-row">
        <aside className="md:w-56 md:shrink-0">
          <div className="mb-4">
            <p className="text-sm font-semibold text-foreground">Painel administrativo</p>
            {email ? <p className="truncate text-xs text-muted-foreground">{email}</p> : null}
          </div>
          <nav className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
            {adminNavItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: true }}
                className={cn(
                  "inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                )}
                activeProps={{ className: "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" }}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <Button variant="outline" size="sm" className="mt-4 w-full" onClick={sair}>
            Sair
          </Button>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {actions}
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
