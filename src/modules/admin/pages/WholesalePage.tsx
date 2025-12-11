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
import { toast } from "sonner";
import type { VariantGroup, WholesaleTier, VariantWithProduct } from "@/types";
import { formatCurrency } from "@/utils/format";
import * as XLSX from "xlsx";


type Mode = "new" | "edit";

export default function WholesalePage() {
  const { selectedBranch } = useApp();
  const [groups, setGroups] = useState<VariantGroup[]>([]);
  const [tiers, setTiers] = useState<WholesaleTier[]>([]);
  const [variants, setVariants] = useState<VariantWithProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // formulario tramo
  const [mode, setMode] = useState<Mode>("new");
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [minQty, setMinQty] = useState<string>("");
  const [unitPrice, setUnitPrice] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [gs, ts, vs] = await Promise.all([
          apiClient.getVariantGroups(),
          apiClient.getWholesaleTiers(),
          apiClient.getVariants(),
        ]);
        setGroups(gs);
        setTiers(ts);
        setVariants(vs);
        if (!selectedGroupId && gs.length > 0) {
          setSelectedGroupId(gs[0].id);
        }
      } catch (err) {
        console.error(err);
        toast.error("Error al cargar configuración mayorista");
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredGroups = useMemo(() => {
    const q = search.toLowerCase();
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.description ?? "").toLowerCase().includes(q)
    );
  }, [groups, search]);

  const currentGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) ?? null,
    [groups, selectedGroupId]
  );

  const groupTiers = useMemo(
    () =>
      tiers
        .filter((t) => t.variantGroupId === selectedGroupId)
        .sort((a, b) => a.minQty - b.minQty),
    [tiers, selectedGroupId]
  );

  const groupVariants = useMemo(
    () =>
      variants
        .filter((v) => v.variantGroupId === selectedGroupId)
        .sort((a, b) => a.sku.localeCompare(b.sku)),
    [variants, selectedGroupId]
  );

  const resetForm = () => {
    setMode("new");
    setEditingTierId(null);
    setMinQty("");
    setUnitPrice("");
  };

  const handleEdit = (tier: WholesaleTier) => {
    setMode("edit");
    setEditingTierId(tier.id);
    setMinQty(String(tier.minQty));
    setUnitPrice(String(tier.unitPrice));
  };

  const handleDelete = async (tier: WholesaleTier) => {
    if (!confirm("¿Eliminar este tramo mayorista?")) return;
    try {
      await apiClient.deleteWholesaleTier(tier.id);
      setTiers((prev) => prev.filter((t) => t.id !== tier.id));
      toast.success("Tramo eliminado");
      if (editingTierId === tier.id) {
        resetForm();
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar tramo");
    }
  };

  const handleSubmit = async () => {
    if (!currentGroup) {
      toast.error("Seleccione un producto base mayorista");
      return;
    }
    const qty = Number(minQty);
    const price = Number(unitPrice);
    if (!qty || qty <= 0) {
      toast.error("Ingrese una cantidad mínima válida");
      return;
    }
    if (!price || price <= 0) {
      toast.error("Ingrese un precio unitario válido");
      return;
    }

    setSaving(true);
    try {
      if (mode === "new") {
        const newTier = await apiClient.createWholesaleTier({
          variantGroupId: currentGroup.id,
          priceListId: "pl-2", // lista mayorista mock
          minQty: qty,
          unitPrice: price,
        });
        setTiers((prev) => [...prev, newTier]);
        toast.success("Tramo mayorista creado");
      } else if (mode === "edit" && editingTierId) {
        const updated = await apiClient.updateWholesaleTier(editingTierId, {
          minQty: qty,
          unitPrice: price,
        });
        setTiers((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t))
        );
        toast.success("Tramo mayorista actualizado");
      }

      resetForm();
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar tramo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuración de precios mayoristas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Cada <span className="font-semibold">producto base mayorista</span>{" "}
            corresponde a un grupo de variantes (ej: “Desodorante spray 150ml”).
            Todas las variantes de ese grupo (distintos aromas, colores, etc.)
            se suman juntas para calcular el tramo mayorista en el POS.
          </p>

          {selectedBranch && (
            <p className="text-xs text-muted-foreground">
              Las reglas mayoristas son <span className="font-semibold">globales</span>{" "}
              (aplican a todas las sucursales), pero el stock sigue siendo por sucursal.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Columna izquierda: grupos */}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Buscar producto base mayorista
                </label>
                <Input
                  placeholder="Ej: Desodorante, Shampoo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="border rounded-lg h-72 overflow-auto bg-background text-sm">
                {loading ? (
                  <p className="p-3 text-muted-foreground">Cargando...</p>
                ) : filteredGroups.length === 0 ? (
                  <p className="p-3 text-muted-foreground">
                    No hay grupos de variantes configurados.
                  </p>
                ) : (
                  filteredGroups.map((g) => (
                    <button
                      key={g.id}
                      className={`w-full text-left px-3 py-2 border-b last:border-0 hover:bg-muted ${
                        g.id === selectedGroupId ? "bg-muted" : ""
                      }`}
                      onClick={() => {
                        setSelectedGroupId(g.id);
                        resetForm();
                      }}
                    >
                      <p className="font-medium">{g.name}</p>
                      {g.description && (
                        <p className="text-xs text-muted-foreground">
                          {g.description}
                        </p>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Columna derecha: detalle del grupo */}
            <div className="md:col-span-2 space-y-4">
              {currentGroup ? (
                <>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">
                      Producto base mayorista seleccionado:
                    </p>
                    <p>{currentGroup.name}</p>
                    {currentGroup.description && (
                      <p className="text-xs text-muted-foreground">
                        {currentGroup.description}
                      </p>
                    )}
                  </div>

                  {/* Variantes que se suman para el mayorista */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Variantes incluidas en este producto (se suman para el
                      tramo mayorista)
                    </p>
                    {groupVariants.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No hay variantes asociadas a este grupo. Asigna este
                        grupo a las variantes en el mantenimiento de catálogo.
                      </p>
                    ) : (
                      <div className="border rounded-lg max-h-40 overflow-auto text-xs">
                        <table className="w-full">
                          <thead className="bg-muted/60">
                            <tr>
                              <th className="px-3 py-1 text-left">SKU</th>
                              <th className="px-3 py-1 text-left">Descripción</th>
                              <th className="px-3 py-1 text-left">Atributos</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupVariants.map((v) => (
                              <tr key={v.id} className="border-t last:border-b-0">
                                <td className="px-3 py-1 font-mono">{v.sku}</td>
                                <td className="px-3 py-1">
                                  {v.product.name} - {v.name}
                                </td>
                                <td className="px-3 py-1 text-muted-foreground">
                                  {Object.entries(v.attributes)
                                    .map(([k, val]) => `${k}: ${val}`)
                                    .join(" · ") || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Tramos mayoristas */}
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-sm font-medium">
                      Tramos mayoristas definidos
                    </p>
                    {groupTiers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Aún no hay tramos configurados para este producto base.
                      </p>
                    ) : (
                      <table className="w-full text-sm border rounded-lg overflow-hidden">
                        <thead className="bg-muted/60">
                          <tr>
                            <th className="px-3 py-2 text-left">
                              Cantidad mínima (suma de variantes)
                            </th>
                            <th className="px-3 py-2 text-left">
                              Precio unitario mayorista
                            </th>
                            <th className="px-3 py-2 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupTiers.map((t) => (
                            <tr
                              key={t.id}
                              className="border-t last:border-b-0"
                            >
                              <td className="px-3 py-2">{t.minQty} unid.</td>
                              <td className="px-3 py-2">
                                {formatCurrency(t.unitPrice)}
                              </td>
                              <td className="px-3 py-2 text-right space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEdit(t)}
                                >
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600"
                                  onClick={() => handleDelete(t)}
                                >
                                  Eliminar
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Formulario tramo */}
                  <div className="pt-4 border-t space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {mode === "new"
                          ? "Agregar nuevo tramo mayorista"
                          : "Editar tramo mayorista"}
                      </p>
                      {mode === "edit" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={resetForm}
                        >
                          Nuevo tramo
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1 block">
                          Cantidad mínima (unidades totales del grupo)
                        </label>
                        <Input
                          type="number"
                          value={minQty}
                          onChange={(e) => setMinQty(e.target.value)}
                          placeholder="Ej: 3"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1 block">
                          Precio unitario mayorista
                        </label>
                        <Input
                          type="number"
                          value={unitPrice}
                          onChange={(e) => setUnitPrice(e.target.value)}
                          placeholder="Ej: 2500"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          className="w-full"
                          onClick={handleSubmit}
                          disabled={saving}
                        >
                          {saving
                            ? "Guardando..."
                            : mode === "new"
                            ? "Agregar tramo"
                            : "Guardar cambios"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Selecciona un producto base mayorista para configurar sus
                  tramos y ver qué variantes lo componen.
                </p>
              )}
            </div>
          </div>
          {/* Importar tramos mayoristas desde Excel */}
          <div className="mt-6 border-t pt-4">
            <p className="text-sm font-medium mb-2">
              Importar tramos mayoristas desde Excel
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              Plantilla sugerida (cabeceras):{" "}
              <code className="bg-muted px-1 rounded">
                group_name, minQty, unitPrice
              </code>
              . Donde <code>group_name</code> coincide con el nombre del{" "}
              producto base mayorista (grupo de variantes).
            </p>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const data = await file.arrayBuffer();
                  const workbook = XLSX.read(data, { type: "array" });
                  const sheetName = workbook.SheetNames[0];
                  const sheet = workbook.Sheets[sheetName];
                  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(
                    sheet,
                    { defval: "" }
                  );

                  if (rows.length === 0) {
                    toast.error("El archivo está vacío");
                    return;
                  }

                  const groupsByName = new Map(
                    groups.map((g) => [g.name.toLowerCase(), g])
                  );

                  const newTiers: WholesaleTier[] = [];

                  for (const row of rows) {
                    const rawName = String(row.group_name || "").trim();
                    if (!rawName) continue;
                    const key = rawName.toLowerCase();
                    const group =
                      groupsByName.get(key) ||
                      groups.find(
                        (g) => g.name.toLowerCase() === key
                      );
                    if (!group) {
                      // Si no existe el grupo, lo saltamos (o podríamos crearlo)
                      console.warn(
                        "Grupo no encontrado para importación:",
                        rawName
                      );
                      continue;
                    }
                    const minQty = Number(row.minQty || 0);
                    const unitPrice = Number(row.unitPrice || 0);
                    if (!minQty || !unitPrice) continue;

                    const created = await apiClient.createWholesaleTier({
                      variantGroupId: group.id,
                      priceListId: "pl-2",
                      minQty,
                      unitPrice,
                    });
                    newTiers.push(created);
                  }

                  if (newTiers.length === 0) {
                    toast.error(
                      "No se creó ningún tramo. Revisa los datos del archivo."
                    );
                  } else {
                    setTiers((prev) => [...prev, ...newTiers]);
                    toast.success(
                      `Se importaron ${newTiers.length} tramo(s) mayoristas`
                    );
                  }
                } catch (err) {
                  console.error(err);
                  toast.error("Error al importar tramos mayoristas");
                } finally {
                  e.target.value = "";
                }
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
