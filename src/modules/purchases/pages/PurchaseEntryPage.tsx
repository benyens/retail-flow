import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api";
import { useApp } from "@/state/AppContext";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

import type {
  Supplier,
  VariantWithProduct,
} from "@/types";
import { formatCurrency } from "@/utils/format";

type PurchaseLineDraft = {
  id: string;
  variant: VariantWithProduct | null;
  quantity: string;
  unitCost: string;
};

const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export default function PurchaseEntryPage() {
  const { selectedBranch } = useApp();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [variants, setVariants] = useState<VariantWithProduct[]>([]);

  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState("");

  const [productSearch, setProductSearch] = useState("");
  const [lines, setLines] = useState<PurchaseLineDraft[]>([
    { id: newId(), variant: null, quantity: "1", unitCost: "" },
  ]);
  const [saving, setSaving] = useState(false);

  // Cargar proveedores y productos
  useEffect(() => {
    (async () => {
      try {
        const [ss, vs] = await Promise.all([
          apiClient.getSuppliers(),
          apiClient.getVariants(),
        ]);
        setSuppliers(ss);
        setVariants(vs);
      } catch (e) {
        console.error(e);
        toast.error("Error al cargar proveedores o productos");
      }
    })();
  }, []);

  const filteredVariants = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return variants;
    return variants.filter((v) => {
      const sku = v.sku?.toLowerCase() ?? "";
      const name = v.name?.toLowerCase() ?? "";
      const prodName = v.product.name.toLowerCase();
      const barcode = v.barcode?.toLowerCase() ?? "";
      return (
        sku.includes(q) ||
        name.includes(q) ||
        prodName.includes(q) ||
        barcode.includes(q)
      );
    });
  }, [variants, productSearch]);

  const subtotal = useMemo(() => {
    return lines.reduce((sum, l) => {
      const q = Number(l.quantity);
      const c = Number(l.unitCost);
      if (!l.variant || !q || !c) return sum;
      return sum + q * c;
    }, 0);
  }, [lines]);

  const tax = Math.round(subtotal * 0.19);
  const total = subtotal + tax;

  const handleAddEmptyLine = () => {
    setLines((prev) => [
      ...prev,
      { id: newId(), variant: null, quantity: "1", unitCost: "" },
    ]);
  };

  const handleRemoveLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleSelectVariantForLine = (lineId: string, v: VariantWithProduct) => {
    setLines((prev) =>
      prev.map((l) =>
        l.id === lineId
          ? {
              ...l,
              variant: v,
              // sugerir costo con último costo de compra si existe
              unitCost:
                l.unitCost ||
                (v.lastPurchaseCost ? String(v.lastPurchaseCost) : ""),
            }
          : l
      )
    );
  };

  const handleSave = async () => {
    if (!selectedBranch) {
      toast.error("Debe seleccionar una sucursal");
      return;
    }
    if (!selectedSupplierId) {
      toast.error("Seleccione un proveedor");
      return;
    }
    if (!invoiceNumber.trim()) {
      toast.error("Ingrese número de documento");
      return;
    }

    const payloadLines = lines
      .filter((l) => l.variant && Number(l.quantity) > 0 && Number(l.unitCost) > 0)
      .map((l) => ({
        variantId: l.variant!.id,
        quantity: Number(l.quantity),
        unitCost: Number(l.unitCost),
      }));

    if (payloadLines.length === 0) {
      toast.error("Agregue al menos una línea válida");
      return;
    }

    setSaving(true);
    try {
      await apiClient.createPurchase(
        selectedBranch.id,
        selectedSupplierId,
        invoiceNumber.trim(),
        payloadLines
      );

      toast.success("Factura de compra registrada");

      // reset
      setInvoiceNumber("");
      setNotes("");
      setProductSearch("");
      setLines([{ id: newId(), variant: null, quantity: "1", unitCost: "" }]);
    } catch (e) {
      console.error(e);
      toast.error("Error al registrar la compra");
    } finally {
      setSaving(false);
    }
  };

  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ingreso de documentos de compra</CardTitle>
          <CardDescription className="text-xs">
            Registra facturas de compra con sus productos para actualizar stock y costos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Encabezado documento */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Proveedor</label>
              <Select
                value={selectedSupplierId}
                onValueChange={setSelectedSupplierId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.rut ? `(${s.rut})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedSupplier && suppliers.length === 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Más adelante puedes agregar un formulario “Nuevo proveedor”.
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                N° documento (factura, boleta compra, etc.)
              </label>
              <Input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Ej: 12345"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Fecha</label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              Observaciones (opcional)
            </label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas internas sobre esta compra..."
            />
          </div>

          {/* Búsqueda de productos */}
          <div className="border-t pt-3 mt-2 space-y-2">
            <label className="text-sm font-medium mb-1 block">
              Buscar productos para la factura
            </label>
            <Input
              placeholder="Buscar por SKU, nombre o código de barras..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
            <div className="max-h-40 overflow-auto text-xs mt-1 border rounded-md">
              {filteredVariants.length === 0 ? (
                <p className="p-2 text-muted-foreground">
                  No hay productos que coincidan.
                </p>
              ) : (
                filteredVariants.slice(0, 30).map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className="w-full px-3 py-1 text-left hover:bg-muted border-b last:border-0"
                    onClick={() => {
                      // al clickear, asignamos a la última línea sin variante
                      const target = lines.find((l) => !l.variant) ?? lines[lines.length - 1];
                      handleSelectVariantForLine(target.id, v);
                    }}
                  >
                    <div className="font-medium truncate">
                      {v.product.name} - {v.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground flex gap-2">
                      <span className="font-mono">{v.sku}</span>
                      {v.barcode && <span>CB: {v.barcode}</span>}
                      {typeof v.lastPurchaseCost === "number" && (
                        <span>Últ. costo: {formatCurrency(v.lastPurchaseCost)}</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Líneas de factura */}
          <div className="border rounded-lg overflow-hidden mt-3">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-3 py-2 text-left">Producto</th>
                  <th className="px-3 py-2 text-right">Cantidad</th>
                  <th className="px-3 py-2 text-right">Costo unitario</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const q = Number(l.quantity) || 0;
                  const c = Number(l.unitCost) || 0;
                  const sub = q > 0 && c > 0 ? q * c : 0;

                  return (
                    <tr key={l.id} className="border-t last:border-b-0">
                      <td className="px-3 py-2">
                        {l.variant ? (
                          <>
                            <div className="font-medium">
                              {l.variant.product.name} - {l.variant.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              {l.variant.sku}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Seleccione un producto desde la búsqueda
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          type="number"
                          min={0}
                          className="w-24 ml-auto text-right font-mono"
                          value={l.quantity}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x) =>
                                x.id === l.id ? { ...x, quantity: e.target.value } : x
                              )
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          type="number"
                          min={0}
                          className="w-28 ml-auto text-right font-mono"
                          value={l.unitCost}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x) =>
                                x.id === l.id ? { ...x, unitCost: e.target.value } : x
                              )
                            )
                          }
                          placeholder={
                            l.variant?.lastPurchaseCost
                              ? String(l.variant.lastPurchaseCost)
                              : ""
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {sub > 0 ? formatCurrency(sub) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          onClick={() => handleRemoveLine(l.id)}
                          disabled={lines.length === 1}
                        >
                          Eliminar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center mt-2">
            <Button variant="outline" size="sm" onClick={handleAddEmptyLine}>
              Agregar línea
            </Button>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between gap-8">
                <span>Subtotal</span>
                <span className="font-mono">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between gap-8">
                <span>IVA (19%)</span>
                <span className="font-mono">{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between gap-8 text-base font-semibold">
                <span>Total</span>
                <span className="font-mono">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t flex justify-end">
            <Button onClick={handleSave} disabled={saving || !selectedBranch}>
              {saving ? "Guardando..." : "Registrar compra"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
