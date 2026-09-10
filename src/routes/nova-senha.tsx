import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { traduzirErroSenha } from "@/lib/password-rules";

export const Route = createFileRoute("/nova-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nova senha | DeliveryPro" },
      { name: "description", content: "Defina a nova senha de acesso da sua conta DeliveryPro." },
      { property: "og:title", content: "Nova senha | DeliveryPro" },
      {
        property: "og:description",
        content: "Defina a nova senha de acesso da sua conta DeliveryPro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NovaSenhaPage,
});

/** Detecta os parâmetros de recuperação de senha na URL (hash ou query). */
function urlDeRecuperacao() {
  if (typeof window === "undefined") return false;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  return (
    hash.get("type") === "recovery" ||
    query.get("type") === "recovery" ||
    !!query.get("code") ||
    !!query.get("token_hash")
  );
}

function NovaSenhaPage() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [verConfirmar, setVerConfirmar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [linkInvalido, setLinkInvalido] = useState(false);
  const [sessaoPronta, setSessaoPronta] = useState(false);

  useEffect(() => {
    let ativo = true;
    const { data: sub } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (!ativo) return;
      if (evento === "PASSWORD_RECOVERY" && sessao) setSessaoPronta(true);
    });
    if (urlDeRecuperacao()) {
      supabase.auth.getSession().then(({ data }) => {
        if (ativo && data.session) setSessaoPronta(true);
      });
    }
    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const senhaCurta = senha.length > 0 && senha.length < 6;
  const diferentes = confirmar.length > 0 && senha !== confirmar;
  const formularioValido = senha.length >= 6 && senha === confirmar;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!formularioValido) return;

    setEnviando(true);
    const { data: sessao } = await supabase.auth.getSession();
    if (!sessao.session) {
      setEnviando(false);
      setLinkInvalido(true);
      setErro("Este link expirou ou é inválido. Solicite uma nova redefinição de senha.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("session") || msg.includes("token") || msg.includes("expired")) {
        setLinkInvalido(true);
        setErro("Este link expirou ou é inválido. Solicite uma nova redefinição de senha.");
      } else {
        setErro(traduzirErroSenha(error.message));
      }
      return;
    }

    window.history.replaceState(null, "", "/nova-senha");
    toast.success("Senha redefinida com sucesso!");
    setTimeout(() => {
      navigate({ to: "/conta", replace: true });
    }, 1500);
  }

  return (
    <div className="min-h-screen bg-client-bg">
      <SiteHeader />
      <main className="px-4 py-10">
        <div className="mx-auto w-full max-w-lg rounded-2xl border bg-card p-6 shadow-sm">
          <h1 className="mb-1 text-2xl font-bold text-foreground">Nova Senha</h1>
          <p className="mb-6 text-sm text-muted-foreground">Defina sua nova senha de acesso.</p>

          <form onSubmit={salvar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nova-senha-campo">Defina sua nova senha</Label>
              <div className="relative">
                <Input
                  id="nova-senha-campo"
                  type={verSenha ? "text" : "password"}
                  autoComplete="new-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="pr-10"
                  aria-invalid={senhaCurta}
                  aria-describedby={senhaCurta ? "erro-senha-curta" : undefined}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setVerSenha((v) => !v)}
                  aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {senhaCurta ? (
                <p id="erro-senha-curta" role="alert" className="text-sm text-destructive">
                  A senha deve ter no mínimo 6 caracteres.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nova-senha-repetir">Repita a senha</Label>
              <div className="relative">
                <Input
                  id="nova-senha-repetir"
                  type={verConfirmar ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  className="pr-10"
                  aria-invalid={diferentes}
                  aria-describedby={diferentes ? "erro-senhas-diferentes" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setVerConfirmar((v) => !v)}
                  aria-label={verConfirmar ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {verConfirmar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {diferentes ? (
                <p id="erro-senhas-diferentes" role="alert" className="text-sm text-destructive">
                  A senha e a confirmação da senha não são iguais.
                </p>
              ) : null}
            </div>

            {erro ? (
              <div role="alert" className="rounded-lg border bg-muted/40 p-3">
                <p className="text-sm text-destructive">{erro}</p>
                {linkInvalido ? (
                  <Link
                    to="/esqueci-senha"
                    className="mt-2 inline-block text-sm text-primary underline"
                  >
                    Solicitar nova redefinição de senha
                  </Link>
                ) : null}
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={!formularioValido || enviando}>
              {enviando ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Salvando...
                </>
              ) : (
                "SALVAR NOVA SENHA"
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
    </div>
  );
}
