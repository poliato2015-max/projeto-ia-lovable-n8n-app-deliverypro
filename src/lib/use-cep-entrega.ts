import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { buscarCep, distanciaKm, formatarKm, type EnderecoCep } from "@/lib/cep";

/**
 * Valida um CEP na BrasilAPI e confere a distância até a loja.
 * Dispara automaticamente quando o CEP chega a 8 dígitos.
 */
export function useCepEntrega(cep: string) {
  const [endereco, setEndereco] = useState<EnderecoCep | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);

  const { data: loja } = useQuery({
    queryKey: ["delivery-settings-geo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_settings")
        .select("store_lat, store_lng, delivery_radius_km")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const digitos = cep.replace(/\D/g, "");

  useEffect(() => {
    let ativo = true;
    setEndereco(null);
    setErro(null);
    if (digitos.length !== 8) return;
    setVerificando(true);
    buscarCep(digitos).then((resultado) => {
      if (!ativo) return;
      setVerificando(false);
      if (!resultado) {
        setErro("CEP não encontrado");
        return;
      }
      setEndereco(resultado);
    });
    return () => {
      ativo = false;
    };
  }, [digitos]);

  let distancia: number | null = null;
  let foraDoRaio = false;
  let mensagemDistancia: string | null = null;
  const raio = Number(loja?.delivery_radius_km ?? 0);

  if (endereco?.lat != null && endereco.lng != null && loja?.store_lat != null && loja.store_lng != null) {
    distancia = distanciaKm(
      Number(loja.store_lat),
      Number(loja.store_lng),
      endereco.lat,
      endereco.lng,
    );
    if (raio > 0 && distancia > raio) {
      foraDoRaio = true;
      mensagemDistancia = `Infelizmente não entregamos nesse endereço — fica a ${formatarKm(
        distancia,
      )} km, nosso limite atual é ${formatarKm(raio)} km`;
    }
  }

  return { endereco, erro, verificando, distancia, foraDoRaio, mensagemDistancia };
}
