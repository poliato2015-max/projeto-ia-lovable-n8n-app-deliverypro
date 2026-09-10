import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { PublicLayout } from "@/components/layout-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/esqueci-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha | DeliveryPro" },
      {
        name: "description",
        content: "Solicite o link de redefinição de senha da sua conta DeliveryPro.",
      },
      { property: "og:title", content: "Redefinir senha | DeliveryPro" },
      {
        property: "og:description",
        content: "Solicite o link de redefinição de senha da sua conta DeliveryPro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EsqueciSenhaPage,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const valor = email.trim();
    if (!EMAIL_RE.test(valor)) {
      setErro("Digite um endereço de e-mail válido.");
      return;
    }
    setEnviando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(valor, {
      redirectTo: `${window.location.origin}/nova-senha`,
    });
    setEnviando(false);
    if (error) {
      toast.error("Não foi possível enviar o e-mail agora. Tente novamente em instantes.");
      return;
    }
    setEnviado(true);
    toast.success("E-mail de redefinição enviado! Verifique sua caixa de entrada.");
  }

  return (
    <div className="min-h-screen bg-client-bg">
      <SiteHeader />
      <PublicLayout className="py-10">
        <main>
        <div className="mx-auto w-full max-w-lg rounded-2xl border bg-card p-6 shadow-sm">
          <h1 className="mb-1 text-2xl font-bold text-foreground">Redefinir senha</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Para redefinir a sua senha, digite o endereço de e-mail que você utiliza em sua
            conta no DeliveryPro.
          </p>

          <form onSubmit={enviar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-redefinir">E-mail</Label>
              <Input
                id="email-redefinir"
                type="email"
                autoComplete="email"
                placeholder="Endereço de e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!erro}
                aria-describedby={erro ? "erro-email-redefinir" : undefined}
                autoFocus
              />
            </div>
            {erro ? (
              <p id="erro-email-redefinir" role="alert" className="text-sm text-destructive">
                {erro}
              </p>
            ) : null}
            {enviado ? (
              <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm text-foreground">
                E-mail de redefinição enviado! Verifique sua caixa de entrada.
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={enviando}>
              {enviando ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Enviando...
                </>
              ) : (
                "RECEBER LINK PARA REDEFINIR"
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Voltar para{" "}
              <Link to="/conta" className="text-primary underline">
                Fazer login
              </Link>
            </p>
          </form>
        </div>
        </main>
      </PublicLayout>
    </div>
  );
}
