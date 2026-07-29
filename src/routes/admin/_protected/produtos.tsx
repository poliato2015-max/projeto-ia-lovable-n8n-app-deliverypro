import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatBRL,
  getPhotoUrls,
  removeProductPhoto,
  uploadProductPhoto,
  validatePhoto,
} from "@/lib/product-photos";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

export const Route = createFileRoute("/admin/_protected/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos | Painel do Cardápio Digital" },
      { name: "description", content: "Cadastre, edite e organize os produtos do cardápio." },
      { property: "og:title", content: "Produtos | Painel do Cardápio Digital" },
      {
        property: "og:description",
        content: "Cadastre, edite e organize os produtos do cardápio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminProdutos,
});

const CATEGORIAS = [
  { value: "hamburguer", label: "Hambúrguer" },
  { value: "adicional", label: "Adicional" },
];

function AdminProdutos() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: photoUrls = {} } = useQuery({
    queryKey: ["photo-urls", products.map((p) => p.photo_url).join(",")],
    queryFn: () => getPhotoUrls(products.map((p) => p.photo_url)),
    enabled: products.length > 0,
  });

  async function excluir() {
    if (!toDelete) return;
    const { error } = await supabase.from("products").delete().eq("id", toDelete.id);
    if (error) {
      toast.error("Não foi possível excluir o produto.");
      return;
    }
    await removeProductPhoto(toDelete.photo_url);
    toast.success("Produto excluído.");
    setToDelete(null);
    queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
  }

  return (
    <AdminShell
      title="Produtos"
      description="Gerencie os itens do cardápio."
      email={user.email ?? undefined}
      actions={
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo produto
        </Button>
      }
    >
      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando produtos...</p>
        ) : products.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            Nenhum produto cadastrado ainda. Clique em "Novo produto" para começar.
          </p>
        ) : (
          <ul className="divide-y">
            {products.map((product) => (
              <li key={product.id} className="flex items-center gap-4 p-4">
                <img
                  src={product.photo_url ? photoUrls[product.photo_url] : undefined}
                  alt={`Foto de ${product.name}`}
                  className="h-14 w-14 shrink-0 rounded-md border bg-muted object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {product.category === "hamburguer" ? "Hambúrguer" : "Adicional"} ·{" "}
                    {formatBRL(Number(product.price))}
                  </p>
                </div>
                <Badge variant={product.is_active ? "default" : "secondary"}>
                  {product.is_active ? "Ativo" : "Inativo"}
                </Badge>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar ${product.name}`}
                    onClick={() => {
                      setEditing(product);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Excluir ${product.name}`}
                    onClick={() => setToDelete(product)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
        currentPhotoUrl={editing?.photo_url ? photoUrls[editing.photo_url] : undefined}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["admin", "products"] })}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{toDelete?.name}"? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluir}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}

function ProductFormDialog({
  open,
  onOpenChange,
  product,
  currentPhotoUrl,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  currentPhotoUrl?: string;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("hamburguer");
  const [price, setPrice] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const formKey = open ? (product?.id ?? "new") : null;
  if (open && loadedFor !== formKey) {
    setLoadedFor(formKey);
    setName(product?.name ?? "");
    setDescription(product?.description ?? "");
    setCategory(product?.category ?? "hamburguer");
    setPrice(product ? String(product.price) : "");
    setIsActive(product?.is_active ?? true);
    setFile(null);
    setError(null);
  }
  if (!open && loadedFor !== null) setLoadedFor(null);

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Informe o nome do produto.");
    if (!description.trim()) return setError("Informe a descrição / ingredientes do produto.");

    const priceValue = Number(price.replace(",", "."));
    if (!price.trim() || Number.isNaN(priceValue)) return setError("Informe um preço válido.");
    if (priceValue <= 0) return setError("O preço precisa ser maior que zero.");

    if (!product && !file) return setError("Envie uma foto do produto.");
    if (file) {
      const photoError = validatePhoto(file);
      if (photoError) return setError(photoError);
    }

    setSaving(true);
    try {
      let photoPath = product?.photo_url ?? null;
      if (file) {
        photoPath = await uploadProductPhoto(file);
      }

      const payload = {
        name: name.trim(),
        description: description.trim(),
        category,
        price: priceValue,
        is_active: isActive,
        photo_url: photoPath,
      };

      const { error: dbError } = product
        ? await supabase.from("products").update(payload).eq("id", product.id)
        : await supabase.from("products").insert(payload);

      if (dbError) {
        if (dbError.message.includes("price")) {
          setError("O preço precisa ser maior que zero.");
        } else {
          setError("Não foi possível salvar o produto. Tente novamente.");
        }
        return;
      }

      if (file && product?.photo_url && product.photo_url !== photoPath) {
        await removeProductPhoto(product.photo_url);
      }

      toast.success(product ? "Produto atualizado." : "Produto cadastrado.");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado ao salvar o produto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? "Editar produto" : "Novo produto"}</DialogTitle>
          <DialogDescription>
            Preencha os dados do item que aparecerá no cardápio.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={salvar} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição / ingredientes</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Preço (R$)</Label>
              <Input
                id="price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="25,90"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="photo">Foto (JPG, PNG ou WEBP, até 5MB)</Label>
            <Input
              id="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {currentPhotoUrl && !file ? (
              <img
                src={currentPhotoUrl}
                alt="Foto atual do produto"
                className="h-20 w-20 rounded-md border object-cover"
              />
            ) : null}
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="is_active">Produto ativo</Label>
              <p className="text-xs text-muted-foreground">
                Desative para esconder o produto do cardápio sem apagá-lo.
              </p>
            </div>
            <Switch id="is_active" checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
