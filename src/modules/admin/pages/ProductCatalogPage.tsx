// src/modules/admin/pages/ProductCatalogPage.tsx
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api";
import {
  Product,
  Variant,
  VariantGroup,
  VariantWithProduct,
} from "@/types";
import { cn } from "@/lib/utils";
import { generateIdLikeSku } from "@/utils/format";
import {
  Edit2,
  Trash2,
  Plus,
  Package2,
  Tag,
  Layers,
} from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/format";

// Helpers locales
type ProductFormState = {
  id?: string;
  name: string;
  description: string;
  category: string;
  isActive: boolean;
  hasVariants: boolean;
  // Campos para variante automática cuando NO tiene variantes
  autoSku: string;
  autoBarcode: string;
  autoUnit: string;
};

type VariantFormState = {
  id?: string;
  sku: string;
  name: string;
  barcode: string;
  unit: string;
  attributes: string; // JSON plano "clave=valor, clave2=valor2"
  variantGroupId: string;
  cost: string; // costo unitario (última compra)
};

function buildVariantWithProduct(
  v: Variant,
  products: Product[],
  groups: VariantGroup[]
): VariantWithProduct | null {
  const product = products.find((p) => p.id === v.productId);
  const variantGroup = groups.find(
    (g) => g.id === v.variantGroupId
  );
  if (!product || !variantGroup) return null;
  return { ...v, product, variantGroup } as VariantWithProduct;
}

export default function ProductCatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<VariantWithProduct[]>([]);
  const [variantGroups, setVariantGroups] = useState<VariantGroup[]>(
    []
  );

  // Categorías
  const [categories, setCategories] = useState<string[]>([]);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] =
    useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Grupos mayoristas (variant groups)
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [isVariantGroupDialogOpen, setIsVariantGroupDialogOpen] =
    useState(false);
  const [isSavingVariantGroup, setIsSavingVariantGroup] =
    useState(false);

  const [selectedProductId, setSelectedProductId] =
    useState<string | null>(null);

  const [productForm, setProductForm] =
    useState<ProductFormState>({
      name: "",
      description: "",
      category: "",
      isActive: true,
      hasVariants: true,
      autoSku: "",
      autoBarcode: "",
      autoUnit: "UN",
    });

  const [variantForm, setVariantForm] =
    useState<VariantFormState>({
      sku: "",
      name: "",
      barcode: "",
      unit: "UN",
      attributes: "",
      variantGroupId: "",
      cost: "",
    });

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const [isLoading, setIsLoading] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isSavingVariant, setIsSavingVariant] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const [prods, groups, allVariants] = await Promise.all([
          apiClient.getProducts(),
          apiClient.getVariantGroups(),
          apiClient.getVariants(),
        ]);

        setProducts(prods);
        setVariantGroups(groups);

        const variantsWith = allVariants
          .map((v) => buildVariantWithProduct(v, prods, groups))
          .filter(
            (v): v is VariantWithProduct => !!v
          );

        setVariants(variantsWith);

        // Derivar categorías únicas desde los productos
        const uniqueCats = Array.from(
          new Set(
            prods
              .map((p) => p.category?.trim())
              .filter(
                (c): c is string => !!c
              )
          )
        ).sort((a, b) => a.localeCompare(b));
        setCategories(uniqueCats);

        // Seleccionar el primero por defecto
        if (prods.length > 0) {
          handleSelectProduct(prods[0]);
        }
      } catch (e) {
        console.error(e);
        toast.error("Error al cargar catálogo");
      } finally {
        setIsLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProduct = useMemo(
    () =>
      products.find((p) => p.id === selectedProductId) ||
      null,
    [products, selectedProductId]
  );

  const filteredProducts = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [products, debouncedSearch]);

  const productVariants = useMemo(
    () =>
      variants.filter(
        (v) => v.productId === selectedProductId
      ) ?? [],
    [variants, selectedProductId]
  );

  // ================== Handlers de producto ==================

  // Helper: actualiza variantGroups y elimina duplicados (por nombre)
  const updateVariantGroups = (
    updater: (prev: VariantGroup[]) => VariantGroup[]
  ) => {
    setVariantGroups((prev) => {
      const next = updater(prev);

      const byName = new Map<string, VariantGroup>();
      for (const g of next) {
        const key = g.name.trim().toLowerCase();
        if (!byName.has(key)) {
          byName.set(key, g);
        }
      }

      return Array.from(byName.values());
    });
  };

  const resetProductForm = () => {
    setSelectedProductId(null);
    setProductForm({
      name: "",
      description: "",
      category: "",
      isActive: true,
      hasVariants: true,
      autoSku: "",
      autoBarcode: "",
      autoUnit: "UN",
    });
    // también limpiamos el formulario de variantes para que quede en "nuevo"
    resetVariantForm();
  };

  const handleSelectProduct = (p: Product) => {
    setSelectedProductId(p.id);
    setProductForm({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      category: p.category ?? "",
      isActive: p.isActive,
      hasVariants: true, // por defecto asumimos que sí tiene variantes
      autoSku: "",
      autoBarcode: "",
      autoUnit: "UN",
    });
    // al cambiar de producto, empezar con variante nueva
    resetVariantForm();
  };

  const handleSaveProduct = async () => {
    if (!productForm.name.trim()) {
      toast.error("El nombre del producto es obligatorio");
      return;
    }

    setIsSavingProduct(true);
    try {
      const payload: Omit<Product, "id"> = {
        name: productForm.name.trim(),
        description:
          productForm.description.trim() || undefined,
        category: productForm.category.trim() || "",
        isActive: productForm.isActive,
      };

      let saved: Product;
      let isNew = false;

      if (productForm.id) {
        // Update
        saved = await apiClient.updateProduct(
          productForm.id,
          payload
        );
        setProducts((prev) =>
          prev.map((p) =>
            p.id === saved.id ? saved : p
          )
        );
      } else {
        // Create
        saved = await apiClient.createProduct(payload);
        isNew = true;
        setProducts((prev) => [...prev, saved]);
      }

      // Actualizar categorías derivadas
      setCategories((prev) => {
        const cat = payload.category.trim();
        if (!cat) return prev;
        if (prev.includes(cat)) return prev;
        return [...prev, cat].sort((a, b) =>
          a.localeCompare(b)
        );
      });

      // Si es nuevo y NO tiene variantes, creamos una variante automática
      if (isNew && !productForm.hasVariants) {
        // Asegurar un grupo de variantes
        let group = variantGroups.find(
          (g) =>
            g.name.toLowerCase() ===
            saved.name.toLowerCase()
        );
        if (!group) {
          group = await apiClient.createVariantGroup({
            name: saved.name,
            description: `Grupo automático para ${saved.name}`,
          });
          // evitar duplicados
          updateVariantGroups((prev) => [...prev, group!]);
        }

        const autoSku =
          productForm.autoSku.trim() ||
          generateIdLikeSku(saved.name);

        const newVariant: Omit<Variant, "id"> = {
          productId: saved.id,
          variantGroupId: group.id,
          sku: autoSku,
          name: saved.name,
          attributes: {}, // sin atributos
          unit: productForm.autoUnit || "UN",
          barcode:
            productForm.autoBarcode.trim() || undefined,
          isActive: true,
          // Nota: agrega lastPurchaseCost a Variant si quieres costear también la variante auto
          lastPurchaseCost: undefined as any,
        };

        const created = await apiClient.createVariant(
          newVariant
        );
        const vw = buildVariantWithProduct(
          created,
          [saved, ...products],
          [...variantGroups, group]
        );
        if (vw) {
          setVariants((prev) =>
            prev.some((v) => v.id === vw.id)
              ? prev
              : [...prev, vw]
          );
        }
      }

      setSelectedProductId(saved.id);
      toast.success("Producto guardado");
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar producto");
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (p: Product) => {
    if (
      !window.confirm(
        `¿Eliminar producto "${p.name}"?`
      )
    )
      return;
    try {
      await apiClient.deleteProduct(p.id);
      setProducts((prev) =>
        prev.filter((x) => x.id !== p.id)
      );
      setVariants((prev) =>
        prev.filter((v) => v.productId !== p.id)
      );
      if (selectedProductId === p.id) {
        resetProductForm();
      }
      toast.success("Producto eliminado");
    } catch (e) {
      console.error(e);
      toast.error("Error al eliminar producto");
    }
  };

  // ================== Categorías ==================

  const handleCreateCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;

    setIsSavingCategory(true);
    try {
      setCategories((prev) => {
        if (prev.includes(name)) return prev;
        return [...prev, name].sort((a, b) =>
          a.localeCompare(b)
        );
      });

      setProductForm((prev) => ({
        ...prev,
        category: name,
      }));
      setNewCategoryName("");
      setIsCategoryDialogOpen(false);
    } finally {
      setIsSavingCategory(false);
    }
  };

  // ================== Variant groups ==================

  const handleCreateVariantGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;

    setIsSavingVariantGroup(true);
    try {
      // Evitar duplicados por nombre ANTES de llamar al API
      const existing = variantGroups.find(
        (g) =>
          g.name.trim().toLowerCase() ===
          name.toLowerCase()
      );
      if (existing) {
        setVariantForm((prev) => ({
          ...prev,
          variantGroupId: existing.id,
        }));
        setIsVariantGroupDialogOpen(false);
        return;
      }

      const created =
        await apiClient.createVariantGroup({
          name,
          description:
            newGroupDesc.trim() || undefined,
        });

      // Actualizar estado SIN duplicados
      updateVariantGroups((prev) => [...prev, created]);

      setVariantForm((prev) => ({
        ...prev,
        variantGroupId: created.id,
      }));
      setIsVariantGroupDialogOpen(false);
      toast.success("Grupo mayorista creado");
    } catch (e) {
      console.error(e);
      toast.error("Error al crear grupo mayorista");
    } finally {
      setIsSavingVariantGroup(false);
      setNewGroupName("");
      setNewGroupDesc("");
    }
  };

  // ================== Variantes ==================

  const resetVariantForm = () => {
    setVariantForm({
      id: undefined,
      sku: "",
      name: "",
      barcode: "",
      unit: "UN",
      attributes: "",
      variantGroupId: "",
      cost: "",
    });
  };

  const handleSelectVariant = (v: VariantWithProduct) => {
    const costRaw = (v as any)
      .lastPurchaseCost as number | undefined;
    setVariantForm({
      id: v.id,
      sku: v.sku,
      name: v.name,
      barcode: v.barcode ?? "",
      unit: v.unit,
      attributes: Object.entries(v.attributes || {})
        .map(([k, val]) => `${k}=${val}`)
        .join(", "),
      variantGroupId: v.variantGroupId,
      cost:
        typeof costRaw === "number"
          ? String(costRaw)
          : "",
    });
  };

  const handleSaveVariant = async () => {
    if (!selectedProduct) {
      toast.error("Seleccione un producto primero");
      return;
    }
    if (
      !variantForm.sku.trim() ||
      !variantForm.name.trim()
    ) {
      toast.error(
        "SKU y nombre de variante son obligatorios"
      );
      return;
    }
    if (!variantForm.variantGroupId) {
      toast.error(
        "Debe seleccionar un producto base (grupo mayorista)"
      );
      return;
    }

    setIsSavingVariant(true);
    try {
      const attributes: Record<string, string> = {};
      if (variantForm.attributes.trim()) {
        variantForm.attributes
          .split(",")
          .forEach((pair) => {
            const [k, v] = pair
              .split("=")
              .map((s) => s.trim());
            if (k && v) attributes[k] = v;
          });
      }

      const costNumber =
        variantForm.cost.trim() !== ""
          ? Number(variantForm.cost)
          : undefined;

      // Nota: agrega lastPurchaseCost a Variant en "@/types"
      const payload: Omit<Variant, "id"> = {
        productId: selectedProduct.id,
        variantGroupId: variantForm.variantGroupId,
        sku: variantForm.sku.trim(),
        name: variantForm.name.trim(),
        barcode:
          variantForm.barcode.trim() || undefined,
        unit: variantForm.unit || "UN",
        attributes,
        isActive: true,
        lastPurchaseCost:
          typeof costNumber === "number" &&
          isFinite(costNumber) &&
          costNumber > 0
            ? (costNumber as any)
            : undefined,
      };

      let saved: Variant;
      if (variantForm.id) {
        saved = await apiClient.updateVariant(
          variantForm.id,
          payload
        );
      } else {
        saved = await apiClient.createVariant(payload);
      }

      const vw = buildVariantWithProduct(
        saved,
        products,
        variantGroups
      );
      if (vw) {
        setVariants((prev) => {
          // Evitar duplicados
          const existingIndex = prev.findIndex(
            (x) => x.id === vw.id
          );
          if (existingIndex >= 0) {
            const copy = [...prev];
            copy[existingIndex] = vw;
            return copy;
          }
          return [...prev, vw];
        });
      }

      resetVariantForm();
      toast.success("Variante guardada");
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar variante");
    } finally {
      setIsSavingVariant(false);
    }
  };

  const handleDeleteVariant = async (
    v: VariantWithProduct
  ) => {
    if (
      !window.confirm(
        `¿Eliminar variante "${v.name}"?`
      )
    )
      return;
    try {
      await apiClient.deleteVariant(v.id);
      setVariants((prev) =>
        prev.filter((x) => x.id !== v.id)
      );
      if (variantForm.id === v.id) resetVariantForm();
      toast.success("Variante eliminada");
    } catch (e) {
      console.error(e);
      toast.error("Error al eliminar variante");
    }
  };

  // ================== Render ==================

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Package2 className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-semibold">
          Catálogo de productos
        </h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Administra productos, variantes y grupos mayoristas
        usados en el POS.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4">
        {/* Columna izquierda – lista de productos */}
        <Card className="h-[600px] flex flex-col">
          <CardHeader className="pb-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">
                Productos
              </CardTitle>
              <Button
                size="sm"
                className="h-8 px-3 whitespace-nowrap"
                onClick={resetProductForm}
              >
                <Plus className="w-4 h-4 mr-1" />
                Nuevo producto
              </Button>
            </div>
            <CardDescription className="text-xs">
              {isLoading
                ? "Cargando..."
                : `${products.length} producto(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-3">
            <Input
              placeholder="Nombre, categoría..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              className="h-9 text-sm"
            />

            <div className="flex-1 overflow-auto space-y-1">
              {filteredProducts.map((p) => {
                const isActive =
                  p.id === selectedProductId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      handleSelectProduct(p)
                    }
                    className={cn(
                      "w-full flex items-center justify-between rounded-md px-3 py-2 text-left text-sm border transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:bg-muted border-border"
                    )}
                  >
                    <div>
                      <div className="font-medium truncate">
                        {p.name}
                      </div>
                      <div
                        className={cn(
                          "text-xs",
                          isActive
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground"
                        )}
                      >
                        {p.category || "Sin categoría"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn(
                          "h-7 w-7",
                          isActive
                            ? "text-primary-foreground/90 hover:bg-primary-foreground/10"
                            : "text-muted-foreground hover:bg-muted/70"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectProduct(p);
                        }}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn(
                          "h-7 w-7 text-red-600 hover:text-red-700",
                          isActive &&
                            "hover:bg-primary-foreground/10"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProduct(p);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </button>
                );
              })}

              {!isLoading &&
                filteredProducts.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center mt-4">
                    No hay productos que coincidan con la
                    búsqueda.
                  </p>
                )}
            </div>
          </CardContent>
        </Card>

        {/* Columna derecha – formulario y variantes */}
        <div className="space-y-4">
          {/* Form producto */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package2 className="w-4 h-4 text-primary" />
                {productForm.id
                  ? "Editar producto"
                  : "Nuevo producto"}
              </CardTitle>
              <CardDescription className="text-xs">
                Datos generales del producto. Para productos
                simples puedes crear una variante automática.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">
                    Nombre
                  </label>
                  <Input
                    value={productForm.name}
                    onChange={(e) =>
                      setProductForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Ej: Desodorante Fresh"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    Categoría
                  </label>
                  <div className="flex gap-2 items-end">
                    <Select
                      value={
                        productForm.category || ""
                      }
                      onValueChange={(value) =>
                        setProductForm((prev) => ({
                          ...prev,
                          category: value,
                        }))
                      }
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Seleccionar categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => {
                        setNewCategoryName("");
                        setIsCategoryDialogOpen(true);
                      }}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">
                  Descripción
                </label>
                <Textarea
                  rows={2}
                  value={productForm.description}
                  onChange={(e) =>
                    setProductForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Opcional"
                />
              </div>

              <div className="flex items-center justify-between gap-4 border-t pt-3 mt-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={productForm.hasVariants}
                    onCheckedChange={(checked) =>
                      setProductForm((prev) => ({
                        ...prev,
                        hasVariants: checked,
                      }))
                    }
                  />
                  <div className="text-xs">
                    <div className="font-medium">
                      Este producto tiene variantes
                    </div>
                    <div className="text-muted-foreground">
                      (tallas, colores, aromas, etc.)
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleSaveProduct}
                  disabled={isSavingProduct}
                >
                  {isSavingProduct
                    ? "Guardando..."
                    : "Guardar producto"}
                </Button>
              </div>

              {/* Opciones de variante automática */}
              {!productForm.hasVariants && (
                <div className="mt-3 border-t pt-3 space-y-2">
                  <p className="text-xs font-medium flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    Variante automática para productos
                    simples
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs">
                        SKU
                      </label>
                      <Input
                        className="h-8 text-xs"
                        placeholder="Opcional (se autogenera)"
                        value={productForm.autoSku}
                        onChange={(e) =>
                          setProductForm((prev) => ({
                            ...prev,
                            autoSku: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs">
                        Código de barras
                      </label>
                      <Input
                        className="h-8 text-xs"
                        placeholder="Opcional"
                        value={productForm.autoBarcode}
                        onChange={(e) =>
                          setProductForm((prev) => ({
                            ...prev,
                            autoBarcode:
                              e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs">
                        Unidad
                      </label>
                      <Input
                        className="h-8 text-xs"
                        placeholder="UN"
                        value={productForm.autoUnit}
                        onChange={(e) =>
                          setProductForm((prev) => ({
                            ...prev,
                            autoUnit: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Al crear el producto se generará una
                    variante por defecto con estos datos.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Variantes */}
          {selectedProduct && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Layers className="w-4 h-4 text-primary" />
                      Variantes de{" "}
                      {selectedProduct.name}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      SKU, código de barras, atributos,
                      producto base mayorista y costo.
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    onClick={resetVariantForm}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Nueva variante
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Tabla de variantes */}
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/60">
                        <TableHead className="text-xs">
                          SKU
                        </TableHead>
                        <TableHead className="text-xs">
                          Nombre
                        </TableHead>
                        <TableHead className="text-xs">
                          Producto base (grupo)
                        </TableHead>
                        <TableHead className="text-xs">
                          Código barras
                        </TableHead>
                        <TableHead className="text-xs">
                          Unidad
                        </TableHead>
                        <TableHead className="text-xs">
                          Costo
                        </TableHead>
                        <TableHead className="text-xs">
                          Atributos
                        </TableHead>
                        <TableHead className="text-xs text-right">
                          Acciones
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productVariants.map((v) => {
                        const costRaw = (v as any)
                          .lastPurchaseCost as
                          | number
                          | undefined;
                        const cost =
                          typeof costRaw === "number"
                            ? costRaw
                            : null;

                        return (
                          <TableRow key={v.id}>
                            <TableCell className="text-xs font-mono">
                              {v.sku}
                            </TableCell>
                            <TableCell className="text-xs">
                              {v.name}
                            </TableCell>
                            <TableCell className="text-xs">
                              {v.variantGroup.name}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {v.barcode || "-"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {v.unit}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {cost != null
                                ? formatCurrency(cost)
                                : "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {Object.entries(
                                v.attributes || {}
                              )
                                .map(
                                  ([k, val]) =>
                                    `${k}=${val}`
                                )
                                .join(", ")}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() =>
                                    handleSelectVariant(
                                      v
                                    )
                                  }
                                >
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-red-600 hover:text-red-700"
                                  onClick={() =>
                                    handleDeleteVariant(
                                      v
                                    )
                                  }
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {productVariants.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="text-xs text-muted-foreground text-center py-4"
                          >
                            No hay variantes para este
                            producto.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Form variante */}
                <div className="border-t pt-3 mt-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium flex items-center gap-1">
                      {variantForm.id
                        ? "Editar variante"
                        : "Nueva variante"}
                    </p>
                    {variantForm.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={resetVariantForm}
                      >
                        Limpiar
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs">
                        SKU
                      </label>
                      <Input
                        className="h-8 text-xs font-mono"
                        value={variantForm.sku}
                        onChange={(e) =>
                          setVariantForm((prev) => ({
                            ...prev,
                            sku: e.target.value,
                          }))
                        }
                        placeholder="DEO-FRESH-001"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs">
                        Nombre variante
                      </label>
                      <Input
                        className="h-8 text-xs"
                        value={variantForm.name}
                        onChange={(e) =>
                          setVariantForm((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        placeholder="Ej: Aroma Sport"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs">
                        Código de barras (EAN)
                      </label>
                      <Input
                        className="h-8 text-xs font-mono"
                        value={variantForm.barcode}
                        onChange={(e) =>
                          setVariantForm((prev) => ({
                            ...prev,
                            barcode: e.target.value,
                          }))
                        }
                        placeholder="Opcional"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        Producto base mayorista (grupo)
                      </label>
                      <div className="flex items-end gap-2">
                        <Select
                          value={
                            variantForm.variantGroupId
                          }
                          onValueChange={(value) =>
                            setVariantForm((prev) => ({
                              ...prev,
                              variantGroupId: value,
                            }))
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Seleccionar grupo" />
                          </SelectTrigger>
                          <SelectContent>
                            {variantGroups.map((g) => (
                              <SelectItem
                                key={g.id}
                                value={g.id}
                              >
                                {g.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setNewGroupName(
                              selectedProduct
                                ? selectedProduct.name
                                : ""
                            );
                            setNewGroupDesc("");
                            setIsVariantGroupDialogOpen(
                              true
                            );
                          }}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs">
                        Unidad
                      </label>
                      <Input
                        className="h-8 text-xs"
                        value={variantForm.unit}
                        onChange={(e) =>
                          setVariantForm((prev) => ({
                            ...prev,
                            unit: e.target.value,
                          }))
                        }
                        placeholder="UN"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs">
                        Costo (última compra)
                      </label>
                      <Input
                        className="h-8 text-xs text-right font-mono"
                        type="number"
                        value={variantForm.cost}
                        onChange={(e) =>
                          setVariantForm((prev) => ({
                            ...prev,
                            cost: e.target.value,
                          }))
                        }
                        placeholder="Ej: 1200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs">
                        Atributos
                      </label>
                      <Input
                        className="h-8 text-xs"
                        value={variantForm.attributes}
                        onChange={(e) =>
                          setVariantForm((prev) => ({
                            ...prev,
                            attributes: e.target.value,
                          }))
                        }
                        placeholder="aroma=Sport, tamaño=150ml"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={handleSaveVariant}
                      disabled={isSavingVariant}
                    >
                      {isSavingVariant
                        ? "Guardando variante..."
                        : "Guardar variante"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modal nueva categoría */}
      <Dialog
        open={isCategoryDialogOpen}
        onOpenChange={setIsCategoryDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva categoría</DialogTitle>
            <DialogDescription>
              Crea una categoría para organizar tus
              productos (por ejemplo: Abarrotes, Higiene
              Personal, Lácteos, etc.).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 mt-2">
            <Label htmlFor="category-name">
              Nombre de la categoría
            </Label>
            <Input
              id="category-name"
              autoFocus
              placeholder="Ej: Higiene Personal"
              value={newCategoryName}
              onChange={(e) =>
                setNewCategoryName(e.target.value)
              }
            />
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setIsCategoryDialogOpen(false)
              }
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={
                !newCategoryName.trim() ||
                isSavingCategory
              }
              onClick={handleCreateCategory}
            >
              {isSavingCategory
                ? "Guardando..."
                : "Guardar categoría"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal nuevo grupo mayorista */}
      <Dialog
        open={isVariantGroupDialogOpen}
        onOpenChange={setIsVariantGroupDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Nuevo grupo mayorista
            </DialogTitle>
            <DialogDescription>
              Agrupa variantes que comparten el mismo
              producto base mayorista (por ejemplo:
              Desodorante Spray 150ml).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div className="space-y-1">
              <Label htmlFor="group-name">
                Nombre del grupo
              </Label>
              <Input
                id="group-name"
                autoFocus
                placeholder="Ej: Desodorante Spray 150ml"
                value={newGroupName}
                onChange={(e) =>
                  setNewGroupName(e.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="group-desc">
                Descripción (opcional)
              </Label>
              <Input
                id="group-desc"
                placeholder="Opcional"
                value={newGroupDesc}
                onChange={(e) =>
                  setNewGroupDesc(e.target.value)
                }
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setIsVariantGroupDialogOpen(false)
              }
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={
                !newGroupName.trim() ||
                isSavingVariantGroup
              }
              onClick={handleCreateVariantGroup}
            >
              {isSavingVariantGroup
                ? "Guardando..."
                : "Guardar grupo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
