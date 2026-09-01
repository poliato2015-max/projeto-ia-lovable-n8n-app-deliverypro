import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { garantirFicha } from "@/lib/ensure-customer";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";
import { useCepEntrega } from "@/lib/use-cep-entrega";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/conta")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search['redirect'] === "string" ? { redirect: search['redirect'] as string } : {},
  head: () => ({
    meta: [
      { title: "Entrar ou criar conta | DeliveryPro" },
      {
        name: "description",
        content:
          "Entre na sua conta DeliveryPro ou cadastre-se com endereço para finalizar seu pedido.",
      },
      { property: "og:title", content: "Entrar ou criar conta | DeliveryPro" },
      {
        property: "og:description",
        content:
          "Entre na sua conta DeliveryPro ou cadastre-se com endereço para finalizar seu pedido.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContaPage,
});

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

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

/** Envia o usuário logado para o destino certo conforme o papel. */
export async function destinoAposLogin(userId: string, redirecionar?: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (isAdmin) return "/admin";
  if (redirecionar && redirecionar.startsWith("/") && !redirecionar.startsWith("/admin")) {
    return redirecionar;
  }
  return "/cardapio";
}

function ContaPage() {
  const navigate = useNavigate();
  const { redirect: redirecionar } = Route.useSearch();
  const { user } = useSession();
  const [recuperacao, setRecuperacao] = useState<boolean>(() => urlDeRecuperacao());

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "PASSWORD_RECOVERY") setRecuperacao(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (recuperacao || !user) return;
    let ativo = true;
    destinoAposLogin(user.id, redirecionar).then((destino) => {
      if (ativo) navigate({ to: destino as never, replace: true });
    });
    return () => {
      ativo = false;
    };
  }, [user, navigate, recuperacao, redirecionar]);

  return (
    <div className="min-h-screen bg-client-bg">
      <SiteHeader />
      <main className="px-4 py-10">
        <div className="mx-auto w-full max-w-lg rounded-2xl border bg-card p-6 shadow-sm">
          {recuperacao ? (
            <>
              <h1 className="mb-1 text-2xl font-bold text-foreground">Definir nova senha</h1>
              <p className="mb-6 text-sm text-muted-foreground">
                Escolha uma nova senha para a sua conta.
              </p>
              <FormNovaSenha onConcluido={() => setRecuperacao(false)} />
            </>
          ) : (
            <>
              <h1 className="mb-1 text-2xl font-bold text-foreground">Bem-vindo ao DeliveryPro</h1>
              <p className="mb-6 text-sm text-muted-foreground">
                Entre ou crie a sua conta para continuar.
              </p>
              <Tabs defaultValue="entrar">
                <TabsList className="mb-6 grid w-full grid-cols-2">
                  <TabsTrigger value="entrar">Entrar</TabsTrigger>
                  <TabsTrigger value="cadastrar">Cadastrar</TabsTrigger>
                </TabsList>
                <TabsContent value="entrar">
                  <FormEntrar redirecionar={redirecionar} />
                </TabsContent>
                <TabsContent value="cadastrar">
                  <FormCadastrar />
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function FormNovaSenha({ onConcluido }: { onConcluido: () => void }) {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 6) return setErro("A senha deve ter no mínimo 6 caracteres.");
    if (senha !== confirmar) return setErro("As senhas não conferem.");

    setEnviando(true);
    const { data: sessao } = await supabase.auth.getSession();
    if (!sessao.session) {
      setEnviando(false);
      return setErro(
        "O link de recuperação expirou ou já foi usado. Peça um novo link em “Esqueci minha senha”.",
      );
    }
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) return setErro("Não foi possível alterar a senha. Peça um novo link.");

    window.history.replaceState(null, "", "/conta");
    toast.success("Senha alterada com sucesso!");
    onConcluido();
    const { data: user } = await supabase.auth.getUser();
    const destino = user.user ? await destinoAposLogin(user.user.id) : "/conta";
    navigate({ to: destino as never, replace: true });
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nova-senha">Nova senha</Label>
        <Input
          id="nova-senha"
          type="password"
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="nova-senha-confirmar">Confirmar nova senha</Label>
        <Input
          id="nova-senha-confirmar"
          type="password"
          autoComplete="new-password"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
        />
      </div>
      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
      <Button type="submit" className="w-full" disabled={enviando}>
        {enviando ? "Salvando..." : "Salvar nova senha"}
      </Button>
    </form>
  );
}

function FormEntrar({ redirecionar }: { redirecionar?: string }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    if (error || !data.user) {
      setEnviando(false);
      setErro("E-mail ou senha inválidos.");
      return;
    }
    await garantirFicha(data.user);
    setEnviando(false);
    navigate({ to: "/checkout", replace: true });
  }

  async function recuperar() {
    if (!email.trim()) {
      setErro("Informe seu e-mail para receber o link de recuperação.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/conta`,
    });
    if (error) {
      toast.error("Não foi possível enviar o e-mail de recuperação.");
      return;
    }
    toast.success("Enviamos um link de recuperação para o seu e-mail.");
  }

  return (
    <form onSubmit={entrar} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="login-email">E-mail</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-senha">Senha</Label>
        <Input
          id="login-senha"
          type="password"
          autoComplete="current-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
      </div>
      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
      <Button type="submit" className="w-full" disabled={enviando}>
        {enviando ? "Entrando..." : "Entrar"}
      </Button>
      <button
        type="button"
        onClick={recuperar}
        className="w-full text-sm text-primary underline"
      >
        Esqueci minha senha
      </button>
    </form>
  );
}

function FormCadastrar() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cep, setCep] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const { endereco, erro: erroCep, verificando, foraDoRaio, mensagemDistancia } =
    useCepEntrega(cep);

  const cepOk = !!endereco && !foraDoRaio;

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (fullName.trim().length < 2) return setErro("Informe seu nome completo.");
    if (!/^[0-9]{11}$/.test(phone)) return setErro("O celular deve ter 11 dígitos.");
    if (!endereco) return setErro("Confirme um CEP válido.");
    if (foraDoRaio) return setErro(mensagemDistancia);
    if (!/^[0-9]+$/.test(numero)) return setErro("Informe o número do endereço (apenas dígitos).");
    if (senha.length < 6) return setErro("A senha deve ter no mínimo 6 caracteres.");
    if (senha !== confirmar) return setErro("As senhas não conferem.");

    setEnviando(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        emailRedirectTo: `${window.location.origin}/conta`,
        data: {
          full_name: fullName.trim(),
          phone,
          cep: endereco.cep,
          street: endereco.street,
          number: numero,
          complement: complemento.trim() || null,
          neighborhood: endereco.neighborhood,
          city: endereco.city,
          state: endereco.state,
          lat: endereco.lat,
          lng: endereco.lng,
        },
      },
    });

    if (error) {
      setEnviando(false);
      const msg = error.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        setErro("Este e-mail já tem uma conta — tente entrar");
      } else {
        setErro("Não foi possível criar sua conta. Tente novamente.");
      }
      return;
    }

    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setEnviando(false);
      setErro("Este e-mail já tem uma conta — tente entrar");
      return;
    }

    let userId = data.user?.id ?? null;
    if (!data.session) {
      const { data: login, error: erroLogin } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });
      if (erroLogin || !login.user) {
        setEnviando(false);
        setErro("Conta criada. Confirme seu e-mail para continuar.");
        return;
      }
      userId = login.user.id;
    }

    const { error: erroFicha } = await supabase.from("customers").upsert({
      id: userId!,
      full_name: fullName.trim(),
      email: email.trim(),
      phone,
      cep: endereco.cep,
      street: endereco.street,
      number: numero,
      complement: complemento.trim() || null,
      neighborhood: endereco.neighborhood,
      city: endereco.city,
      state: endereco.state,
      lat: endereco.lat,
      lng: endereco.lng,
    });
    setEnviando(false);

    if (erroFicha) {
      setErro("Não foi possível salvar seu cadastro. Tente novamente.");
      return;
    }
    toast.success("Conta criada com sucesso!");
    navigate({ to: "/checkout", replace: true });
  }

  return (
    <form onSubmit={cadastrar} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cad-nome">Nome completo</Label>
        <Input
          id="cad-nome"
          value={fullName}
          maxLength={120}
          autoComplete="name"
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cad-email">E-mail</Label>
        <Input
          id="cad-email"
          type="email"
          value={email}
          maxLength={254}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cad-phone">Telefone / WhatsApp</Label>
        <Input
          id="cad-phone"
          inputMode="numeric"
          placeholder="11912345678"
          value={phone}
          onChange={(e) => setPhone(onlyDigits(e.target.value).slice(0, 11))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cad-cep">CEP</Label>
        <Input
          id="cad-cep"
          inputMode="numeric"
          placeholder="00000000"
          value={cep}
          autoComplete="postal-code"
          onChange={(e) => setCep(onlyDigits(e.target.value).slice(0, 8))}
        />
        {verificando ? <p className="text-sm text-muted-foreground">Verificando CEP...</p> : null}
        {erroCep ? <p className="text-sm text-destructive">{erroCep}</p> : null}
        {endereco ? (
          <p className="text-sm text-muted-foreground">
            {endereco.street ? `${endereco.street}, ` : ""}
            {endereco.neighborhood ? `${endereco.neighborhood} — ` : ""}
            {endereco.city}/{endereco.state}
          </p>
        ) : null}
        {mensagemDistancia ? (
          <p className="text-sm text-destructive">{mensagemDistancia}</p>
        ) : null}
      </div>

      {cepOk ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="cad-numero">Número</Label>
            <Input
              id="cad-numero"
              inputMode="numeric"
              value={numero}
              onChange={(e) => setNumero(onlyDigits(e.target.value).slice(0, 10))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cad-complemento">Complemento (opcional)</Label>
            <Input
              id="cad-complemento"
              value={complemento}
              maxLength={100}
              placeholder="Apto 42, bloco B"
              onChange={(e) => setComplemento(e.target.value)}
            />
          </div>
        </>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="cad-senha">Senha</Label>
        <Input
          id="cad-senha"
          type="password"
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cad-confirmar">Confirmar senha</Label>
        <Input
          id="cad-confirmar"
          type="password"
          autoComplete="new-password"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
        />
      </div>

      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
      <Button type="submit" className="w-full" disabled={enviando || foraDoRaio}>
        {enviando ? "Criando conta..." : "Cadastrar"}
      </Button>
    </form>
  );
}
