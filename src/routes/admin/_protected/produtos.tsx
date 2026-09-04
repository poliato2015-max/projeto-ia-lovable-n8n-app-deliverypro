import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type Category = Tables<"categories">;

const ABA_ADICIONAIS = "__adicionais__";

function AdminProdutos() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [aba, setAba] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

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

  const { data: categories = [] } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  const { data: photoUrls = {} } = useQuery({
    queryKey: ["photo-urls", products.map((p) => p.photo_url).join(",")],
    queryFn: () => getPhotoUrls(products.map((p) => p.photo_url)),
    enabled: products.length > 0,
  });

  const abas = [
    ...categories.map((c) => ({ value: c.id, label: c.name })),
    { value: ABA_ADICIONAIS, label: "Adicionais" },
  ];
  const abaAtual = aba ?? abas[0]?.value ?? ABA_ADICIONAIS;

  const filtrar = (valor: string) =>
    products.filter(
      (p) =>
        (valor === ABA_ADICIONAIS ? p.is_addon : !p.is_addon && p.category_id === valor) &&
        p.name.toLowerCase().includes(busca.trim().toLowerCase()),
    );


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

  async function alternarAtivo(product: Product, ativo: boolean) {
    const { error } = await supabase
      .from("products")
      .update({ is_active: ativo })
      .eq("id", product.id);
    if (error) {
      toast.error("Não foi possível atualizar o status do produto.");
      return;
    }
    toast.success(ativo ? "Produto ativado." : "Produto desativado.");
    queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
  }

  function novoProduto() {
    setEditing(null);
    setFormOpen(true);
  }

  return (
    <AdminShell
      title="Produtos"
      description="Gerencie os itens do cardápio."
      email={user.email ?? undefined}
      actions={
        <Button onClick={novoProduto}>
          <Plus className="mr-2 h-4 w-4" />
          Novo produto
        </Button>
      }
    >
      <div className="space-y-4">
        <Input
          placeholder="Buscar por nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-sm"
        />

        <Tabs value={abaAtual} onValueChange={setAba}>
          <TabsList className="flex-wrap">
            {abas.map((a) => (
              <TabsTrigger key={a.value} value={a.value}>
                {a.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {abas.map((categoria) => (
            <TabsContent key={categoria.value} value={categoria.value}>
              <div className="rounded-lg border bg-card">
                {isLoading ? (
                  <p className="p-6 text-sm text-muted-foreground">Carregando produtos...</p>
                ) : filtrar(categoria.value).length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">
                    Nenhum produto encontrado nesta aba.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {filtrar(categoria.value).map((product) => (
                      <li key={product.id} className="flex items-center gap-4 p-4">
                        <img
                          src={product.photo_url ? photoUrls[product.photo_url] : undefined}
                          alt={`Foto de ${product.name}`}
                          className="h-14 w-14 shrink-0 rounded-md border bg-muted object-contain"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {categoria.label} · {formatBRL(Number(product.price))}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={product.is_active}
                            aria-label={`Ativar ou desativar ${product.name}`}
                            onCheckedChange={(checked) => alternarAtivo(product, checked)}
                          />
                          <span className="w-14 text-xs text-muted-foreground">
                            {product.is_active ? "Ativo" : "Inativo"}
                          </span>
                        </div>
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
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
        categories={categories}
        defaultIsAddon={abaAtual === ABA_ADICIONAIS}
        defaultCategoryId={abaAtual === ABA_ADICIONAIS ? null : abaAtual}
        addonOptions={products.filter((p) => p.is_addon && p.is_active)}
        currentPhotoUrl={editing?.photo_url ? photoUrls[editing.photo_url] : undefined}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
          queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
          queryClient.invalidateQueries({ queryKey: ["admin", "product-addons"] });
        }}
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
  categories,
  defaultIsAddon,
  defaultCategoryId,
  addonOptions,
  currentPhotoUrl,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  categories: Category[];
  defaultIsAddon: boolean;
  defaultCategoryId: string | null;
  addonOptions: Product[];
  currentPhotoUrl?: string;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isAddon, setIsAddon] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [criandoCategoria, setCriandoCategoria] = useState(false);
  const [criadas, setCriadas] = useState<Array<{ id: string; name: string }>>([]);
  // Mantém a categoria recém-criada mesmo se o formulário re-inicializar.
  const categoriaPendente = useRef<string | null>(null);
  const [price, setPrice] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isPromo, setIsPromo] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [addons, setAddons] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const { data: vinculos } = useQuery({
    queryKey: ["admin", "product-addons", product?.id],
    queryFn: async () => {
      const { data, error: dbError } = await supabase
        .from("product_addons")
        .select("addon_id")
        .eq("product_id", product!.id);
      if (dbError) throw dbError;
      return data.map((v) => v.addon_id);
    },
    enabled: open && !!product,
  });

  const formKey = open ? (product?.id ?? "new") : null;
  if (open && loadedFor !== formKey) {
    setLoadedFor(formKey);
    setName(product?.name ?? "");
    setDescription(product?.description ?? "");
    setIsAddon(product ? product.is_addon : defaultIsAddon);
    setCategoryId(categoriaPendente.current ?? (product ? product.category_id : defaultCategoryId));
    setNovaCategoria("");
    setCriandoCategoria(false);
    setPrice(product ? String(product.price) : "");
    setIsActive(product?.is_active ?? true);
    setIsPromo(product?.is_promo ?? false);
    setFile(null);
    setAddons([]);
    setError(null);
  }
  if (!open && loadedFor !== null) {
    setLoadedFor(null);
    categoriaPendente.current = null;
  }
  const opcoesCategoria = [
    ...categories.map((c) => ({ id: c.id, name: c.name })),
    ...criadas.filter((c) => !categories.some((x) => x.id === c.id)),
  ];


  useEffect(() => {
    if (vinculos) setAddons(vinculos);
  }, [vinculos]);
  async function criarCategoria() {
    const nome = novaCategoria.trim();
    if (!nome) return setError("Informe o nome da nova categoria.");
    const { data, error: dbError } = await supabase
      .from("categories")
      .insert({ name: nome })
      .select("id, name")
      .single();
    if (dbError || !data) {
      setError("Não foi possível criar a categoria.");
      return;
    }
    // Guarda localmente para a opção existir no select antes do refetch.
    setCriadas((atuais) => [...atuais, { id: data.id, name: data.name }]);
    categoriaPendente.current = data.id;
    setCategoryId(data.id);
    setNovaCategoria("");
    setCriandoCategoria(false);
    setError(null);
    toast.success("Categoria criada.");
  }


  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Informe o nome do produto.");
    if (!description.trim()) return setError("Informe a descrição / ingredientes do produto.");
    const categoriaFinal = categoriaPendente.current ?? categoryId;
    if (!isAddon && !categoriaFinal) return setError("Escolha uma categoria para o produto.");

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
        is_addon: isAddon,
        category_id: isAddon ? null : categoriaFinal,
        price: priceValue,
        is_active: isActive,
        is_promo: isPromo,
        photo_url: photoPath,
      };

      let productId = product?.id ?? null;
      if (product) {
        const { error: dbError } = await supabase
          .from("products")
          .update(payload)
          .eq("id", product.id);
        if (dbError) throw dbError;
      } else {
        const { data: created, error: dbError } = await supabase
          .from("products")
          .insert(payload)
          .select("id")
          .single();
        if (dbError) throw dbError;
        productId = created.id;
      }

      if (!isAddon && productId) {
        const atuais = product ? (vinculos ?? []) : [];
        const paraAdicionar = addons.filter((id) => !atuais.includes(id));
        const paraRemover = atuais.filter((id) => !addons.includes(id));
        if (paraAdicionar.length > 0) {
          const { error: linkError } = await supabase
            .from("product_addons")
            .insert(paraAdicionar.map((addonId) => ({ product_id: productId, addon_id: addonId })));
          if (linkError) throw linkError;
        }
        if (paraRemover.length > 0) {
          const { error: unlinkError } = await supabase
            .from("product_addons")
            .delete()
            .eq("product_id", productId)
            .in("addon_id", paraRemover);
          if (unlinkError) throw unlinkError;
        }
      }

      if (file && product?.photo_url && product.photo_url !== photoPath) {
        await removeProductPhoto(product.photo_url);
      }

      toast.success(product ? "Produto atualizado." : "Produto cadastrado.");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(
        message.includes("price")
          ? "O preço precisa ser maior que zero."
          : "Não foi possível salvar o produto. Tente novamente.",
      );
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

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="is_addon">Este item é um adicional</Label>
              <p className="text-xs text-muted-foreground">
                Adicionais não aparecem como produto no cardápio, só dentro de outros produtos.
              </p>
            </div>
            <Switch id="is_addon" checked={isAddon} onCheckedChange={setIsAddon} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {!isAddon ? (
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select
                  value={criandoCategoria ? "__nova__" : (categoryId ?? "")}
                  onValueChange={(v) => {
                    if (v === "__nova__") {
                      setCriandoCategoria(true);
                    } else {
                      setCriandoCategoria(false);
                      categoriaPendente.current = v;
                      setCategoryId(v);
                    }
                  }}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Escolha uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {opcoesCategoria.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}

                    <SelectItem value="__nova__">+ Nova categoria</SelectItem>
                  </SelectContent>
                </Select>
                {criandoCategoria ? (
                  <div className="flex gap-2">
                    <Input
                      value={novaCategoria}
                      onChange={(e) => setNovaCategoria(e.target.value)}
                      placeholder="Nome da categoria"
                      maxLength={60}
                      aria-label="Nome da nova categoria"
                    />
                    <Button type="button" variant="outline" onClick={criarCategoria}>
                      Criar
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}


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
                className="h-20 w-20 rounded-md border object-contain"
              />
            ) : null}
          </div>

          {!isAddon ? (
            <div className="space-y-2 rounded-md border p-3">
              <Label>Adicionais disponíveis</Label>
              {addonOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum adicional ativo cadastrado ainda.
                </p>
              ) : (
                <ul className="space-y-2">
                  {addonOptions.map((addon) => (
                    <li key={addon.id} className="flex items-center gap-3">
                      <Checkbox
                        id={`form-addon-${addon.id}`}
                        checked={addons.includes(addon.id)}
                        onCheckedChange={(checked) =>
                          setAddons((current) =>
                            checked
                              ? [...current, addon.id]
                              : current.filter((id) => id !== addon.id),
                          )
                        }
                      />
                      <Label htmlFor={`form-addon-${addon.id}`} className="flex-1 cursor-pointer">
                        {addon.name}
                      </Label>
                      <span className="text-sm text-muted-foreground">
                        {formatBRL(Number(addon.price))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="is_active">Produto ativo</Label>
              <p className="text-xs text-muted-foreground">
                Desative para esconder o produto do cardápio sem apagá-lo.
              </p>
            </div>
            <Switch id="is_active" checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="is_promo">Em promoção</Label>
              <p className="text-xs text-muted-foreground">
                Mostra o emblema "Promo" no cartão do produto no cardápio.
              </p>
            </div>
            <Switch id="is_promo" checked={isPromo} onCheckedChange={setIsPromo} />
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
