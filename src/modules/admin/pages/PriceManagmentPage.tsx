import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api";
import { useApp } from "@/state/AppContext";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import type { VariantWithProduct, VariantPrice } from "@/types";
import { formatCurrency } from "@/utils/format";

type BulkOperation = "SET" | "PERCENT" | "ABSOLUTE";

export default function PriceManagementPage() {
  const { selectedBranch } = useApp();
  const [variants, setVariants] = useState<VariantWithProduct[]>([]);
  const [prices, setPrices] = useState<VariantPrice[]>([]);
  const [loading, setLoading] = useState(true);

  // filtros
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [groupFilter, setGroupFilter] = useState<string>("ALL");
  const [priceListId, setPriceListId] = useState<string>("pl-1"); // pl-1: normal, pl-2: mayorista

  // selección y edición
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rowDrafts, setRowDrafts] = useState<Record<string, string>>({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);

  // bulk
  const [bulkOperation, setBulkOperation] =
    useState<BulkOperation>("SET");
  const [bulkValue, setBulkValue] = useState<string>("");
  const [savingBulk, setSavingBulk] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [vs, ps] = await Promise.all([
          apiClient.getVariants(),
          apiClient.getVariantPrices(),
        ]);
        setVariants(vs);
        setPrices(ps);
      } catch (err) {
        console.error(err);
        toast.error("Error al cargar catálogo y precios");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          variants
            .map((v) => v.product.category)
            .filter((c) => c && c.trim().length > 0)
        )
      ).sort(),
    [variants]
  );

  const groups = useMemo(
    () =>
      Array.from(
        new Set(
          variants
            .map((v) => v.variantGroup.name)
            .filter((g) => g && g.trim().length > 0)
        )
      ).sort(),
    [variants]
  );

  const getPriceForVariant = (variantId: string): VariantPrice | undefined =>
    prices.find(
      (p) => p.variantId === variantId && p.priceListId === priceListId
    );

  const filteredVariants = useMemo(() => {
    const q = search.toLowerCase();
    return variants.filter((v) => {
      if (
        categoryFilter !== "ALL" &&
        v.product.category !== categoryFilter
      )
        return false;
      if (
        groupFilter !== "ALL" &&
        v.variantGroup.name !== groupFilter
      )
        return false;
      if (!q) return true;
      return (
        v.sku.toLowerCase().includes(q) ||
        v.name.toLowerCase().includes(q) ||
        v.product.name.toLowerCase().includes(q) ||
        v.barcode?.toLowerCase().includes(q)
      );
    });
  }, [variants, search, categoryFilter, groupFilter]);

  const allSelectedOnPage =
    filteredVariants.length > 0 &&
    filteredVariants.every((v) => selectedIds.has(v.id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelectedOnPage) {
        filteredVariants.forEach((v) => next.delete(v.id));
      } else {
        filteredVariants.forEach((v) => next.add(v.id));
      }
      return next;
    });
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSaveRow = async (variantId: string) => {
    const draft = rowDrafts[variantId];
    const current = getPriceForVariant(variantId);
    const baseValue =
      draft !== undefined && draft !== ""
        ? Number(draft)
        : current?.price ?? 0;
    if (!baseValue || baseValue <= 0) {
      toast.error("Ingrese un precio válido");
      return;
    }

    setSavingRowId(variantId);
    try {
      const updated = await apiClient.setVariantPrice(
        variantId,
        priceListId,
        Math.round(baseValue)
      );
      setPrices((prev) => {
        const others = prev.filter((p) => p.id !== updated.id);
        return [...others, updated];
      });
      setRowDrafts((prev) => {
        const { [variantId]: _, ...rest } = prev;
        return rest;
      });
      toast.success("Precio actualizado");
    } catch (err) {
      console.error(err);
      toast.error("Error al actualizar precio");
    } finally {
      setSavingRowId(null);
    }
  };

  const handleApplyBulk = async () => {
    if (selectedIds.size === 0) {
      toast.error("Seleccione al menos una variante");
      return;
    }
    const value = Number(bulkValue);
    if (!value && bulkOperation !== "SET") {
      toast.error("Ingrese un valor numérico válido");
      return;
    }
    if (bulkOperation === "SET" && (!value || value <= 0)) {
      toast.error("Ingrese un precio válido");
      return;
    }

    setSavingBulk(true);
    try {
      const variantIds = Array.from(selectedIds);
      const updatedPrices: VariantPrice[] = [];

      for (const vid of variantIds) {
        const current = getPriceForVariant(vid);
        const currentPrice = current?.price ?? 0;
        let newPrice: number;

        if (bulkOperation === "SET") {
          newPrice = value;
        } else if (bulkOperation === "PERCENT") {
          newPrice = currentPrice * (1 + value / 100);
        } else {
          // ABSOLUTE
          newPrice = currentPrice + value;
        }

        if (!isFinite(newPrice) || newPrice <= 0) {
          continue;
        }

        const updated = await apiClient.setVariantPrice(
          vid,
          priceListId,
          Math.round(newPrice)
        );
        updatedPrices.push(updated);
      }

      if (updatedPrices.length === 0) {
        toast.error(
          "No se pudo actualizar ningún precio. Revise los valores actuales."
        );
        return;
      }

      setPrices((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        updatedPrices.forEach((u) => map.set(u.id, u));
        return Array.from(map.values());
      });

      toast.success(
        `Precios actualizados para ${updatedPrices.length} variante(s)`
      );
    } catch (err) {
      console.error(err);
      toast.error("Error al aplicar cambio masivo");
    } finally {
      setSavingBulk(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gestión de precios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Aquí puedes administrar los precios{" "}
            <span className="font-semibold">normales</span> y{" "}
            <span className="font-semibold">mayoristas</span> por variante.
            Los precios mayoristas se combinan con los tramos configurados en
            la sección “Mayorista”.
          </p>

          {selectedBranch && (
            <p className="text-xs text-muted-foreground">
              Los precios son globales para la empresa, pero el stock se
              maneja por sucursal.
            </p>
          )}

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-1 block">
                Buscar
              </label>
              <Input
                placeholder="Buscar por SKU, nombre, código de barras..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                Categoría
              </label>
              <Select
                value={categoryFilter}
                onValueChange={setCategoryFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                Producto base (grupo)
              </label>
              <Select
                value={groupFilter}
                onValueChange={setGroupFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Selector lista de precios */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
            <div>
              <span className="text-sm font-medium mr-2">
                Lista de precios:
              </span>
              <Select
                value={priceListId}
                onValueChange={setPriceListId}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pl-1">Normal</SelectItem>
                  <SelectItem value="pl-2">Mayorista</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cambios masivos */}
          <div className="flex flex-wrap items-end gap-3 pt-2 border-t">
            <div>
              <label className="text-sm font-medium mb-1 block">
                Operación masiva
              </label>
              <Select
                value={bulkOperation}
                onValueChange={(v) =>
                  setBulkOperation(v as BulkOperation)
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SET">Fijar precio</SelectItem>
                  <SelectItem value="PERCENT">
                    Aumentar / disminuir %
                  </SelectItem>
                  <SelectItem value="ABSOLUTE">
                    Sumar / restar monto
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Valor
              </label>
              <Input
                type="number"
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                placeholder={
                  bulkOperation === "SET"
                    ? "Ej: 2990"
                    : bulkOperation === "PERCENT"
                    ? "Ej: 5 (para +5%)"
                    : "Ej: 100 (para +$100)"
                }
              />
            </div>
            <div>
              <Button
                onClick={handleApplyBulk}
                disabled={savingBulk}
              >
                {savingBulk
                  ? "Aplicando..."
                  : "Aplicar a seleccionados"}
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Seleccionados: {selectedIds.size}
              </p>
            </div>
          </div>

          {/* Tabla variantes */}
          <div className="border rounded-lg overflow-auto">
            {loading ? (
              <p className="p-4 text-sm text-muted-foreground">
                Cargando catálogo...
              </p>
            ) : filteredVariants.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No hay variantes que coincidan con los filtros.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-3 py-2 w-10">
                      <Checkbox
                        checked={allSelectedOnPage}
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-3 py-2 text-left">SKU</th>
                    <th className="px-3 py-2 text-left">Producto</th>
                    <th className="px-3 py-2 text-left">
                      Producto base mayorista
                    </th>
                    <th className="px-3 py-2 text-right">
                      Precio actual
                    </th>
                    <th className="px-3 py-2 text-right">
                      Nuevo precio
                    </th>
                    <th className="px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVariants.map((v) => {
                    const price = getPriceForVariant(v.id);
                    const draft = rowDrafts[v.id];
                    const inputValue =
                      draft !== undefined
                        ? draft
                        : price?.price
                        ? String(price.price)
                        : "";
                    return (
                      <tr
                        key={v.id}
                        className="border-t last:border-b-0"
                      >
                        <td className="px-3 py-2 align-top">
                          <Checkbox
                            checked={selectedIds.has(v.id)}
                            onCheckedChange={() =>
                              toggleSelectOne(v.id)
                            }
                          />
                        </td>
                        <td className="px-3 py-2 align-top font-mono">
                          {v.sku}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium">
                            {v.product.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {v.name}
                            {v.barcode && (
                              <> · CB: {v.barcode}</>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Cat: {v.product.category}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top text-xs">
                          {v.variantGroup.name}
                        </td>
                        <td className="px-3 py-2 align-top text-right font-mono">
                          {price
                            ? formatCurrency(price.price)
                            : "—"}
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          <Input
                            type="number"
                            value={inputValue}
                            onChange={(e) =>
                              setRowDrafts((prev) => ({
                                ...prev,
                                [v.id]: e.target.value,
                              }))
                            }
                            className="w-28 ml-auto text-right font-mono"
                            placeholder={
                              price ? String(price.price) : "0"
                            }
                          />
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSaveRow(v.id)}
                            disabled={savingRowId === v.id}
                          >
                            {savingRowId === v.id
                              ? "Guardando..."
                              : "Guardar"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
