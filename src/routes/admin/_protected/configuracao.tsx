import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/admin/_protected/entrega")({
  head: () => ({
    meta: [
      { title: "Entrega | Painel do Cardápio Digital" },
      {
        name: "description",
        content: "Configure o CEP da loja, a taxa de entrega e o frete grátis do delivery.",
      },
      { property: "og:title", content: "Entrega | Painel do Cardápio Digital" },
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
    if (!settings) return;
    setStoreCep(settings.store_cep);
    setFee(String(settings.delivery_fee));
    setFreeShipping(settings.free_shipping_enabled);
    setRange(String(settings.delivery_range_limit));
  }, [settings]);

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
    if (!Number.isInteger(rangeValue) || rangeValue < 0) {
      return setErro("Informe um limite de alcance inteiro e não negativo.");
    }

    setSalvando(true);
    const { error } = await supabase
      .from("delivery_settings")
      .update({
        store_cep: storeCep,
        delivery_fee: feeValue,
        free_shipping_enabled: freeShipping,
        delivery_range_limit: rangeValue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", settings.id);
    setSalvando(false);

    if (error) {
      setErro("Não foi possível salvar as configurações. Tente novamente.");
      return;
    }
    toast.success("Configurações de entrega salvas.");
    queryClient.invalidateQueries({ queryKey: ["delivery-settings-admin"] });
    queryClient.invalidateQueries({ queryKey: ["delivery-settings"] });
    queryClient.invalidateQueries({ queryKey: ["delivery_settings"] });
  }

  return (
    <AdminShell
      title="Entrega"
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
            <Label htmlFor="range-limit">Limite de alcance (ainda sem efeito)</Label>
            <Input
              id="range-limit"
              inputMode="numeric"
              value={range}
              onChange={(e) => setRange(onlyDigits(e.target.value).slice(0, 6))}
            />
            <p className="text-xs text-muted-foreground">
              Este valor ainda não bloqueia nenhum pedido — é só preparação para quando a validação
              de CEP de entrega for implementada.
            </p>
          </div>

          {erro ? <p className="text-sm text-destructive">{erro}</p> : null}

          <Button type="submit" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      )}
    </AdminShell>
  );
}
