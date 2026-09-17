import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { listarAdmins, promoverAdmin, removerAdmin } from "@/lib/admins.functions";
import { buscarCep } from "@/lib/cep";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/admin/_protected/configuracao")({
  head: () => ({
    meta: [
      { title: "Configuração | Painel do Cardápio Digital" },
      {
        name: "description",
        content: "Configure o CEP da loja, a taxa de entrega e o frete grátis do delivery.",
      },
      { property: "og:title", content: "Configuração | Painel do Cardápio Digital" },
      {
        property: "og:description",
        content: "Configure o CEP da loja, a taxa de entrega e o frete grátis do delivery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminEntrega,
});

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function AdminEntrega() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();

  const [storeCep, setStoreCep] = useState("");
  const [fee, setFee] = useState("");
  const [freeShipping, setFreeShipping] = useState(false);
  const [range, setRange] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["delivery-settings-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_settings")
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);
    if (!settings) return;

    if (!/^[0-9]{8}$/.test(storeCep)) return setErro("O CEP da loja deve ter 8 dígitos.");
    const feeValue = Number(fee.replace(",", "."));
    if (fee.trim() === "" || Number.isNaN(feeValue) || feeValue < 0) {
      return setErro("Informe uma taxa de entrega igual ou maior que zero.");
    }
    const rangeValue = Number(range);
    if (!Number.isInteger(rangeValue) || rangeValue <= 0) {
      return setErro("Informe um raio de entrega inteiro e maior que zero.");
    }

    setSalvando(true);
    const localizacao = await buscarCep(storeCep);
    if (!localizacao) {
      setSalvando(false);
      return setErro("CEP da loja não encontrado.");
    }
    const { error } = await supabase
      .from("delivery_settings")
      .update({
        store_cep: storeCep,
        delivery_fee: feeValue,
        free_shipping_enabled: freeShipping,
        delivery_radius_km: rangeValue,
        store_lat: localizacao.lat,
        store_lng: localizacao.lng,
        updated_at: new Date().toISOString(),
      })
      .eq("id", settings.id);

    const urlValor = webhookUrl.trim() === "" ? null : webhookUrl.trim();
    const { error: erroWebhook } = webhook
      ? await supabase
          .from("delivery_webhook")
          .update({ url: urlValor })
          .eq("id", webhook.id)
      : await supabase.from("delivery_webhook").insert({ url: urlValor });

    setSalvando(false);

    if (error || erroWebhook) {
      setErro("Não foi possível salvar as configurações. Tente novamente.");
      return;
    }
    toast.success("Configurações de entrega salvas.");
    queryClient.invalidateQueries({ queryKey: ["delivery-settings-admin"] });
    queryClient.invalidateQueries({ queryKey: ["delivery-webhook-admin"] });
    queryClient.invalidateQueries({ queryKey: ["delivery-settings"] });
    queryClient.invalidateQueries({ queryKey: ["delivery_settings"] });
  }

  return (
    <AdminShell
      title="Configuração"
      description="Configurações usadas no cálculo do pedido."
      email={user.email ?? undefined}
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando configurações...</p>
      ) : (
        <form onSubmit={salvar} className="max-w-lg space-y-5 rounded-lg border bg-card p-5">
          <div className="space-y-2">
            <Label htmlFor="store-cep">CEP da loja</Label>
            <Input
              id="store-cep"
              inputMode="numeric"
              placeholder="00000000"
              value={storeCep}
              onChange={(e) => setStoreCep(onlyDigits(e.target.value).slice(0, 8))}
            />
            <p className="text-xs text-muted-foreground">Apenas números, 8 dígitos.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery-fee">Taxa de entrega (R$)</Label>
            <Input
              id="delivery-fee"
              inputMode="decimal"
              placeholder="0,00"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="free-shipping">Frete grátis</Label>
              <p className="text-xs text-muted-foreground">
                Quando ligado, o checkout cobra R$ 0,00 de entrega.
              </p>
            </div>
            <Switch id="free-shipping" checked={freeShipping} onCheckedChange={setFreeShipping} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="range-limit">Raio de entrega (km)</Label>
            <Input
              id="range-limit"
              inputMode="numeric"
              value={range}
              onChange={(e) => setRange(onlyDigits(e.target.value).slice(0, 6))}
            />
            <p className="text-xs text-muted-foreground">
              Pedidos com endereço acima desta distância da loja são bloqueados no cadastro e no
              checkout.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-url">Endereço de avisos (WhatsApp)</Label>
            <Input
              id="webhook-url"
              placeholder="https://..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Enquanto estiver vazio, nenhum aviso automático é enviado ao cliente.
            </p>
          </div>

          {erro ? <p className="text-sm text-destructive">{erro}</p> : null}

          <Button type="submit" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      )}

      <SecaoAdministradores />
    </AdminShell>
  );
}

function SecaoAdministradores() {
  const queryClient = useQueryClient();
  const buscarAdmins = useServerFn(listarAdmins);
  const promover = useServerFn(promoverAdmin);
  const remover = useServerFn(removerAdmin);

  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const { data: admins, isLoading } = useQuery({
    queryKey: ["admins"],
    queryFn: () => buscarAdmins(),
  });

  async function tornarAdmin(event: React.FormEvent) {
    event.preventDefault();
    setErro(null);
    if (!email.trim()) return setErro("Informe o e-mail da conta.");
    setOcupado(true);
    try {
      const r = await promover({ data: { email: email.trim() } });
      if (!r.ok) setErro(r.mensagem);
      else {
        toast.success(r.mensagem);
        setEmail("");
        queryClient.invalidateQueries({ queryKey: ["admins"] });
      }
    } catch {
      setErro("Não foi possível concluir a operação.");
    }
    setOcupado(false);
  }

  async function tirarAdmin(userId: string) {
    setErro(null);
    setOcupado(true);
    try {
      const r = await remover({ data: { userId } });
      if (!r.ok) setErro(r.mensagem);
      else {
        toast.success(r.mensagem);
        queryClient.invalidateQueries({ queryKey: ["admins"] });
      }
    } catch {
      setErro("Não foi possível concluir a operação.");
    }
    setOcupado(false);
  }

  return (
    <section className="mt-8 max-w-lg space-y-5 rounded-lg border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Administradores</h2>
        <p className="text-sm text-muted-foreground">
          Contas com acesso total ao painel. Para promover alguém, a pessoa precisa já ter uma conta
          criada em /conta.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando administradores...</p>
      ) : (
        <ul className="space-y-2">
          {(admins ?? []).map((a) => (
            <li
              key={a.userId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
            >
              <span className="truncate text-sm text-foreground">{a.email}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={ocupado}
                onClick={() => tirarAdmin(a.userId)}
              >
                Remover admin
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={tornarAdmin} className="space-y-2">
        <Label htmlFor="novo-admin">E-mail da conta</Label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="novo-admin"
            type="email"
            className="min-w-48 flex-1"
            placeholder="pessoa@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" disabled={ocupado}>
            Tornar admin
          </Button>
        </div>
      </form>

      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
    </section>
  );
}
