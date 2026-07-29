import { supabase } from "@/integrations/supabase/client";

export const PRODUCT_PHOTOS_BUCKET = "product-photos";
export const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
export const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export function validatePhoto(file: File): string | null {
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
    return "Formato inválido. Envie uma foto em JPG, PNG ou WEBP.";
  }
  if (file.size > MAX_PHOTO_SIZE) {
    return "A foto deve ter no máximo 5MB.";
  }
  return null;
}

export async function uploadProductPhoto(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(PRODUCT_PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error("Não foi possível enviar a foto. Tente novamente.");
  return path;
}

export async function removeProductPhoto(path: string | null) {
  if (!path) return;
  await supabase.storage.from(PRODUCT_PHOTOS_BUCKET).remove([path]);
}

/** Gera URLs assinadas (bucket privado) para exibir as fotos. */
export async function getPhotoUrls(paths: (string | null)[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  if (unique.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(PRODUCT_PHOTOS_BUCKET)
    .createSignedUrls(unique, 60 * 60);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  data.forEach((item) => {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  });
  return map;
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
