import { localDay } from "@/components/ui/data-tools";
import { Link } from "react-router-dom";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useRef } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

import type {
  Supplier,
  VariantWithProduct,
  PurchaseInvoice,
  PurchaseLine,
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
  const cache = useQueryClient();
  const savingRef = useRef(false);

  // Datos base
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [variants, setVariants] = useState<VariantWithProduct[]>([]);

  // Formulario de compra actual (nueva)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() =>
    localDay()
  );
  const [notes, setNotes] = useState("");

  const [productSearch, setProductSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [lines, setLines] = useState<PurchaseLineDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useUnsavedChanges(lines.length > 0 || !!invoiceNumber || !!notes);

  // Nuevo proveedor (diálogo)
  const [isSupplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierRut, setNewSupplierRut] = useState("");
  const [newSupplierEmail, setNewSupplierEmail] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [newSupplierAddress, setNewSupplierAddress] = useState("");
  const [newSupplierBusinessLine, setNewSupplierBusinessLine] = useState("");
  const [creatingSupplier, setCreatingSupplier] = useState(false);

  // Nuevo producto rápido (diálogo)
  const [isProductDialogOpen, setProductDialogOpen] = useState(false);
  const [newProdName, setNewProdName] = useState("");
  const [newVariantName, setNewVariantName] = useState("");
  const [newProdSku, setNewProdSku] = useState("");
  const [newProdBarcode, setNewProdBarcode] = useState("");
  const [newProdSalePrice, setNewProdSalePrice] = useState("");
  const [newProdLastCost, setNewProdLastCost] = useState("");
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [quickMode, setQuickMode] = useState<"NEW_PRODUCT" | "ADD_VARIANT">("NEW_PRODUCT");
  const [existingProductId, setExistingProductId] = useState<string>("");

  // Facturas ya ingresadas
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(
    null
  );
  const [purchaseLines, setPurchaseLines] = useState<PurchaseLine[]>([]);
  const [loadingPurchaseDetail, setLoadingPurchaseDetail] = useState(false);

  // Edicion
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const isEditing = !!editingPurchaseId;
  const [updating, setUpdating] = useState(false);
  const [sendingToSii, setSendingToSii] = useState(false);

  
  // Texto de búsqueda limpio (sin el sufijo tipo " 3*" o "-1*")
    const normalizedSearch = useMemo(() => {
    const raw = productSearch.trim();

    // Formato:  3*coca   ó   -2*coca
    const m = raw.match(/^\s*(-?\d+)\*(.*)$/);
    if (m) {
      // m[2] = "coca"
      return m[2].trim();
    }

    return raw;
  }, [productSearch]);



  // ----- CARGA DE DATOS BASE -----
  useEffect(() => {
    (async () => {
      try {
        const [ss, vs] = await Promise.all([
          apiClient.getSuppliers(),
          apiClient.getVariants(selectedBranch?.id),
        ]); 
        setSuppliers(ss);
        setVariants(vs);
      } catch (e) {
        console.error(e);
        toast.error("Error al cargar proveedores o productos");
      }
    })();
  }, [selectedBranch]);

  // Cargar facturas existentes cuando hay sucursal seleccionada
  useEffect(() => {
    if (!selectedBranch) return;
    (async () => {
      try {
        const list = await apiClient.getPurchases(selectedBranch.id);
        // Ordenamos de más reciente a más antigua
        setPurchases(
          [...list].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime()
          )
        );
      } catch (e) {
        console.error(e);
        toast.error("Error al cargar documentos de compra");
      }
    })();
  }, [selectedBranch]);

  // Cargar detalle de la factura seleccionada
  useEffect(() => {
    if (!selectedPurchaseId) {
      setPurchaseLines([]);
      return;
    }
    (async () => {
      try {
        setLoadingPurchaseDetail(true);
        const lines = await apiClient.getPurchaseLines(selectedPurchaseId);
        setPurchaseLines(lines);
      } catch (e) {
        console.error(e);
        toast.error("No se pudieron cargar los detalles de la compra");
      } finally {
        setLoadingPurchaseDetail(false);
      }
    })();
  }, [selectedPurchaseId]);

    // Atajos globales: F4 = guardar factura, F6 = nuevo proveedor
  useEffect(() => {
  const handler = (e: KeyboardEvent) => {
      if (e.repeat || e.isComposing || document.querySelector('[role="dialog"], [role="listbox"]')) return;
      if (e.key === "F7") { e.preventDefault(); setProductDialogOpen(true); return; }
      if (e.key === "F4") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "F6") {
        e.preventDefault();
        setSupplierDialogOpen(true);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedBranch, selectedSupplierId, invoiceNumber, invoiceDate, notes, lines]); 


  const productsList = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    variants.forEach(v => {
      map.set(v.product.id, { id: v.product.id, name: v.product.name });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [variants]);

  const selectedExistingProduct = useMemo(() => {
    return productsList.find(p => p.id === existingProductId) ?? null;
  }, [productsList, existingProductId]);


  const filteredVariants = useMemo(() => {
    const q = normalizedSearch.trim().toLowerCase();
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
  }, [variants, normalizedSearch]);

  const visibleVariants = useMemo(
    () => filteredVariants.slice(0, 20), // mostrar solo los primeros 20
    [filteredVariants]
  );

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

    // Agrega o modifica la cantidad de una variante en las líneas
  const addVariantWithQty = (v: VariantWithProduct, qtyDelta: number) => {
    if (!qtyDelta) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.variant?.id === v.id);

      // Si ya existe la línea, sumamos / restamos cantidad
      if (existing) {
        const newQty =
          (Number(existing.quantity) || 0) + qtyDelta;

        // Si llega a 0 o menos, la quitamos
        if (newQty <= 0) {
          return prev.filter((l) => l.id !== existing.id);
        }

        return prev.map((l) =>
          l.id === existing.id
            ? { ...l, quantity: String(newQty) }
            : l
        );
      }

      // Si no existe y la cantidad es negativa o 0, no hacemos nada
      if (qtyDelta <= 0) return prev;

      // Nueva línea
      const suggestedCost =
        typeof v.lastPurchaseCost === "number"
          ? String(v.lastPurchaseCost)
          : "";

      return [
        ...prev,
        {
          id: newId(),
          variant: v,
          quantity: String(qtyDelta),
          unitCost: suggestedCost,
        },
      ];
    });
  };
  
  const linesFromPurchase = (pls: PurchaseLine[], vMap: Map<string, VariantWithProduct>) => {
    return pls
      .map((l) => ({
        id: newId(),
        variant: vMap.get(l.variantId) ?? null,
        quantity: String(l.quantity),
        unitCost: String(l.unitCost),
      }))
      .filter((x) => x.variant != null);
  };
  // Click normal en la lista = sumar 1
  const handleAddProductToLines = (v: VariantWithProduct) => {
    addVariantWithQty(v, 1);
  };


  const handleRemoveLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleSave = async () => {
    if (savingRef.current || isEditing) return;
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

    if (lines.some(l => !l.variant || !Number.isFinite(Number(l.quantity)) || Number(l.quantity) <= 0 || !l.unitCost.trim() || !Number.isFinite(Number(l.unitCost)) || Number(l.unitCost) < 0)) { toast.error("Revisa cantidad y costo de todas las líneas"); return; }
    const payloadLines = lines
      .filter(
        (l) =>
          l.variant &&
          Number(l.quantity) > 0 &&
          Number(l.unitCost) >= 0
      )
      .map((l) => ({
        variantId: l.variant!.id,
        quantity: Number(l.quantity),
        unitCost: Number(l.unitCost),
      }));

    if (payloadLines.length === 0) {
      toast.error("Agregue al menos un producto válido");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const invoice = await apiClient.createPurchase(
        selectedBranch.id,
        selectedSupplierId,
        invoiceNumber.trim(),
        invoiceDate,
        notes,
        payloadLines
      );

      cache.invalidateQueries({ queryKey: ["purchases"] });
      toast.success("Factura de compra registrada");

      // agregamos al listado de facturas (encabezado)
      setPurchases((prev) => [invoice, ...prev]);

      // reset formulario
      setInvoiceNumber("");
      setNotes("");
      setProductSearch("");
      setLines([]);
    } catch (e) {
      console.error(e);
      toast.error("Error al registrar la compra");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const selectedSupplier = suppliers.find(
    (s) => s.id === selectedSupplierId
  );

  // Mapa para mostrar nombres de productos en detalle de facturas
  const variantMap = useMemo(() => {
    const m = new Map<string, VariantWithProduct>();
    variants.forEach((v) => m.set(v.id, v));
    return m;
  }, [variants]);

  // Filtro de facturas
  const visiblePurchases = useMemo(() => {
    const q = purchaseSearch.trim().toLowerCase();
    if (!q) return purchases;
    return purchases.filter((p) => {
      const supplier = suppliers.find(
        (s) => s.id === p.supplierId
      );
      const supplierName = supplier?.name.toLowerCase() ?? "";
      const supplierRut = supplier?.rut?.toLowerCase() ?? "";
      const num = p.invoiceNumber.toLowerCase();
      const date =
        p.createdAt?.slice(0, 10).toLowerCase() ?? "";
      return (
        num.includes(q) ||
        supplierName.includes(q) ||
        supplierRut.includes(q) ||
        date.includes(q)
      );
    });
  }, [purchases, suppliers, purchaseSearch]);

  const selectedPurchase = selectedPurchaseId
    ? purchases.find((p) => p.id === selectedPurchaseId) ?? null
    : null;

  // ----------------- NUEVO PROVEEDOR -----------------
  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim()) {
      toast.error("Ingrese nombre del proveedor");
      return;
    } else if (!newSupplierRut.trim()) {
      toast.error("Ingrese RUT del proveedor");
      return;
    } else if (!newSupplierBusinessLine.trim()) {
      toast.error("Ingrese giro del proveedor");
      return;
    }

    setCreatingSupplier(true);
    try {
      const supplier = await apiClient.createSupplier({
        name: newSupplierName.trim(),
        rut: newSupplierRut.trim(),
        email: newSupplierEmail.trim() || undefined,
        phone: newSupplierPhone.trim() || undefined,
        address: newSupplierAddress.trim() || undefined,
        businessLine: newSupplierBusinessLine.trim() || undefined,
      } as any);

      // ⚠️ para evitar duplicados, recargamos desde el backend
      const ss = await apiClient.getSuppliers();
      setSuppliers(ss);
      setSelectedSupplierId(supplier.id);

      setSupplierDialogOpen(false);
      setNewSupplierName("");
      setNewSupplierRut("");
      setNewSupplierEmail("");
      setNewSupplierPhone("");
      setNewSupplierAddress("");
      setNewSupplierBusinessLine("");

      toast.success("Proveedor creado");
    } catch (e) {
      console.error(e);
      toast.error("Error al crear proveedor");
    } finally {
      setCreatingSupplier(false);
    }
  };

    const handleProductSearchKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    // Navegar en la lista con ↑ / ↓
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (visibleVariants.length === 0) return;

      setHighlightedIndex((prev) => {
        let next = prev;
        if (e.key === "ArrowDown") {
          next =
            prev < visibleVariants.length - 1 ? prev + 1 : 0;
        } else {
          next =
            prev > 0
              ? prev - 1
              : visibleVariants.length - 1;
        }

        // Scroll al ítem seleccionado
        const container = listRef.current;
        if (container) {
          const item =
            container.querySelector<HTMLButtonElement>(
              `[data-idx="${next}"]`
            );
          if (item) {
            const { offsetTop, offsetHeight } = item;
            const { scrollTop, clientHeight } = container;
            const bottom = offsetTop + offsetHeight;
            if (bottom > scrollTop + clientHeight) {
              container.scrollTop = bottom - clientHeight;
            } else if (offsetTop < scrollTop) {
              container.scrollTop = offsetTop;
            }
          }
        }

        return next;
      });

      return;
    }

    // Derecha / izquierda = subir / bajar cantidad de la ÚLTIMA línea
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      if (lines.length === 0) return;
      e.preventDefault();
      const delta = e.key === "ArrowRight" ? 1 : -1;
      setLines((prev) => {
        if (prev.length === 0) return prev;
        const idx = prev.length - 1;
        const last = prev[idx];
        const currentQty = Number(last.quantity) || 0;
        const newQty = Math.max(0, currentQty + delta);
        const updated = [...prev];
        updated[idx] = {
          ...last,
          quantity: String(newQty),
        };
        return updated;
      });
      return;
    }

    // ENTER = agregar producto
        if (e.key === "Enter") {
      e.preventDefault();

      if (visibleVariants.length === 0) {
        toast.error("No hay productos que coincidan");
        return;
      }

      // Soportar "3*coca" o "-1*coca"
      let qty = 1;
      const raw = productSearch.trim();
      const m = raw.match(/^\s*(-?\d+)\*(.*)$/);
      if (m) {
        qty = parseInt(m[1], 10) || 1;
      }

      // Elegir índice:
      let indexToUse = highlightedIndex;
      if (
        indexToUse < 0 ||
        indexToUse >= visibleVariants.length
      ) {
        if (visibleVariants.length === 1) {
          indexToUse = 0;
        } else {
          toast.message(
            "Usa ↑ / ↓ para elegir el producto y luego Enter."
          );
          return;
        }
      }

      const v = visibleVariants[indexToUse];
      addVariantWithQty(v, qty);
      setProductSearch(""); // limpiar caja de búsqueda
    }

  };


  // ----------------- NUEVO PRODUCTO RÁPIDO -----------------
  const handleCreateQuickProduct = async () => {
    // Validación de precio obligatorio
    const sp = Number(newProdSalePrice);
    if (!sp || sp <= 0) {
      toast.error("Debes ingresar Precio venta (lista normal). Si no, no aparecerá en POS/Precios.");
      return;
    }

    // Validaciones según modo
    if (quickMode === "NEW_PRODUCT") {
      if (!newProdName.trim()) {
        toast.error("Ingrese nombre de producto");
        return;
      }
    } else {
      if (!existingProductId) {
        toast.error("Selecciona el producto existente al que le agregarás la variante");
        return;
      }
    }

    setCreatingProduct(true);
    try {
      const created = await apiClient.createQuickProduct({
        mode: quickMode,
        productName: quickMode === "NEW_PRODUCT" ? newProdName.trim() : undefined,
        existingProductId: quickMode === "ADD_VARIANT" ? existingProductId : undefined,
        variantName: newVariantName.trim() || "Única",
        sku: newProdSku.trim() || undefined,
        barcode: newProdBarcode.trim() || undefined,
        salePrice: sp,
        lastPurchaseCost: newProdLastCost ? Number(newProdLastCost) : undefined,
        unit: "UN",
      });

      // ✅ Refetch catálogo para que quede consistente en toda la app
      const vs = await apiClient.getVariants();
      setVariants(vs);

      setProductDialogOpen(false);

      // limpiar
      setNewProdName("");
      setNewVariantName("");
      setNewProdSku("");
      setNewProdBarcode("");
      setNewProdSalePrice("");
      setNewProdLastCost("");
      setExistingProductId("");
      setQuickMode("NEW_PRODUCT");

      toast.success("Producto/variante creado y listo para usar");

      // Para seguir trabajando sin salir: te deja listo para agregar líneas
      setProductSearch(created.sku);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Error al crear producto");
    } finally {
      setCreatingProduct(false);
    }
  };





  // ----------------- RENDER -----------------
  return (
    <div className="p-6 space-y-6">
      <Button asChild variant="outline"><Link to="/admin/facturas">← Volver a facturas</Link></Button>
      <Card>
        <CardHeader>
          <CardTitle>Ingresar factura</CardTitle>
          <CardDescription className="text-xs">
            F1: buscar · F4: guardar · F6: proveedor · F7: producto. El registro aplica stock inmediatamente.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* --- NUEVA FACTURA --- */}
          <section className="space-y-4">
            <div>
              <div className="font-semibold text-sm">
                {isEditing ? "Editando factura de compra (DRAFT)" : "Nueva factura de compra"}
              </div>

              <p className="text-[11px] text-muted-foreground">
                Completa los datos del documento y luego agrega los
                productos. Las líneas se van creando
                automáticamente.
              </p>

            </div>

            {/* Encabezado documento */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Proveedor
                </label>
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedSupplierId}
                    onValueChange={setSelectedSupplierId}
                  >
                    <SelectTrigger aria-label="Proveedor" className="flex-1">
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
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSupplierDialogOpen(true)}
                  >
                    Nuevo
                  </Button>
                </div>
                {!selectedSupplier && suppliers.length === 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Crea tu primer proveedor con el botón “Nuevo”.
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">
                  N° documento (factura, boleta compra, etc.)
                </label>
                <Input
                  aria-label="Número de factura" value={invoiceNumber}
                  onChange={(e) =>
                    setInvoiceNumber(e.target.value)
                  }
                  placeholder="Ej: 12345"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">
                  Fecha
                </label>
                <Input
                  type="date"
                  aria-label="Fecha de factura" value={invoiceDate}
                  onChange={(e) =>
                    setInvoiceDate(e.target.value)
                  }
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                Observaciones (opcional)
              </label>
              <Textarea
                rows={2}
                aria-label="Observaciones" value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas internas sobre esta compra..."
              />
            </div>

            {/* Búsqueda de productos */}
            <div className="border-t pt-3 mt-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium block">
                  Buscar productos para la factura
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setProductDialogOpen(true)}
                >
                  Nuevo producto rápido
                </Button>
              </div>
              <Input
                data-search-focus aria-label="Buscar por SKU, nombre o código de barras..." placeholder="Buscar por SKU, nombre o código de barras..."
                value={productSearch}
                onChange={(e) =>
                  setProductSearch(e.target.value)
                }
                onKeyDown={handleProductSearchKeyDown}
              />
              <div
                 ref={listRef}
                 className="max-h-40 overflow-auto text-xs mt-1 border rounded-md"
               >
                 {visibleVariants.length === 0 ? (
                   <p className="p-2 text-muted-foreground">
                     No hay productos que coincidan.
                   </p>
                 ) : (
                   visibleVariants.map((v, idx) => (
                     <button
                       key={v.id}
                       type="button"
                       data-idx={idx}
                       className={`w-full px-3 py-1 text-left hover:bg-muted border-b last:border-0 ${
                         idx === highlightedIndex
                          ? "bg-primary/5"
                           : ""
                       }`}
                       onClick={() => handleAddProductToLines(v)}
                     >
                      <div className="font-medium truncate">
                        {v.product.name} - {v.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex gap-2">
                        <span className="font-mono">
                          {v.sku}
                        </span>
                        {v.barcode && (
                          <span>CB: {v.barcode}</span>
                        )}
                        {typeof v.lastPurchaseCost ===
                          "number" && (
                          <span>
                            Últ. costo:{" "}
                            {formatCurrency(
                              v.lastPurchaseCost
                            )}
                          </span>
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
                    <th className="px-3 py-2 text-left">
                      Producto
                    </th>
                    <th className="px-3 py-2 text-right">
                      Cantidad
                    </th>
                    <th className="px-3 py-2 text-right">
                      Costo unitario
                    </th>
                    <th className="px-3 py-2 text-right">
                      Subtotal
                    </th>
                    <th className="px-3 py-2 text-right">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-3 text-center text-xs text-muted-foreground"
                      >
                        Aún no has agregado productos a esta
                        factura.
                      </td>
                    </tr>
                  ) : (
                    lines.map((l) => {
                      const q = Number(l.quantity) || 0;
                      const c = Number(l.unitCost) || 0;
                      const sub = q > 0 && c > 0 ? q * c : 0;

                      return (
                        <tr
                          key={l.id}
                          className="border-t last:border-b-0"
                        >
                          <td className="px-3 py-2">
                            {l.variant ? (
                              <>
                                <div className="font-medium">
                                  {l.variant.product.name} -{" "}
                                  {l.variant.name}
                                </div>
                                <div className="text-[11px] text-muted-foreground font-mono">
                                  {l.variant.sku}
                                </div>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                (sin producto)
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
                                    x.id === l.id
                                      ? {
                                          ...x,
                                          quantity:
                                            e.target.value,
                                        }
                                      : x
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
                                    x.id === l.id
                                      ? {
                                          ...x,
                                          unitCost:
                                            e.target.value,
                                        }
                                      : x
                                  )
                                )
                              }
                              placeholder={
                                l.variant
                                  ?.lastPurchaseCost
                                  ? String(
                                      l.variant
                                        .lastPurchaseCost
                                    )
                                  : ""
                              }
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {sub > 0
                              ? formatCurrency(sub)
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600"
                              onClick={() =>
                                handleRemoveLine(l.id)
                              }
                            >
                              Eliminar
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end items-center mt-2">
              <div className="space-y-1 text-sm w-full max-w-sm">
                <div className="flex justify-between gap-8">
                  <span>Subtotal</span>
                  <span className="font-mono">
                    {formatCurrency(subtotal)}
                  </span>
                </div>
                <div className="flex justify-between gap-8">
                  <span>IVA (19%)</span>
                  <span className="font-mono">
                    {formatCurrency(tax)}
                  </span>
                </div>
                <div className="flex justify-between gap-8 text-base font-semibold">
                  <span>Total</span>
                  <span className="font-mono">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end">
              <Button
                onClick={() => {
                  if (isEditing) {
                    toast.message("Estás editando: usa “Guardar cambios” arriba.");
                    return;
                  }
                  handleSave();
                }}
                disabled={saving || !selectedBranch || isEditing}
              >
                {saving ? "Guardando..." : "Registrar compra"}
              </Button>
            </div>
          </section>
        </CardContent>
      </Card>

      {/* DIÁLOGO NUEVO PROVEEDOR */}
      <Dialog
        open={isSupplierDialogOpen}
        onOpenChange={(value) => {
          if (!value) setSupplierDialogOpen(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo proveedor</DialogTitle>
            <DialogDescription>
              Crea un proveedor para asociarlo a tus facturas de
              compra.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div>
              <label className="block text-xs font-medium mb-1">
                Nombre *
              </label>
              <Input
                value={newSupplierName}
                onChange={(e) =>
                  setNewSupplierName(e.target.value)
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                RUT *
              </label>
              <Input
                value={newSupplierRut}
                onChange={(e) =>
                  setNewSupplierRut(e.target.value)
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Giro *
              </label>
              <Input
                value={newSupplierBusinessLine}
                onChange={(e) =>
                  setNewSupplierBusinessLine(
                    e.target.value
                  )
                }
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">
                  Email
                </label>
                <Input
                  value={newSupplierEmail}
                  onChange={(e) =>
                    setNewSupplierEmail(e.target.value)
                  }
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">
                  Teléfono
                </label>
                <Input
                  value={newSupplierPhone}
                  onChange={(e) =>
                    setNewSupplierPhone(e.target.value)
                  }
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Dirección
              </label>
              <Input
                value={newSupplierAddress}
                onChange={(e) =>
                  setNewSupplierAddress(e.target.value)
                }
              />
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSupplierDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleCreateSupplier}
              disabled={creatingSupplier}
            >
              {creatingSupplier
                ? "Guardando..."
                : "Crear proveedor"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO NUEVO PRODUCTO RÁPIDO */}
      <Dialog
        open={isProductDialogOpen}
        onOpenChange={(value) => {
          if (!value) setProductDialogOpen(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo producto rápido</DialogTitle>
            <DialogDescription>
              Crea un producto/variante básica para poder
              ingresarlo en esta factura. Luego puedes editarlo
              con más detalle en el módulo de productos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            {/* Modo */}
            <div className="space-y-2">
              <div className="text-xs font-medium">Tipo de creación</div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={quickMode === "NEW_PRODUCT" ? "default" : "outline"}
                  onClick={() => setQuickMode("NEW_PRODUCT")}
                >
                  Producto nuevo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={quickMode === "ADD_VARIANT" ? "default" : "outline"}
                  onClick={() => setQuickMode("ADD_VARIANT")}
                >
                  Agregar variante
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                “Producto nuevo” crea producto + variante. “Agregar variante” crea una nueva presentación dentro de un producto existente.
              </p>
            </div>

            {/* Selección según modo */}
            {quickMode === "NEW_PRODUCT" ? (
              <div>
                <label className="block text-xs font-medium mb-1">Nombre de producto *</label>
                <Input value={newProdName} onChange={(e) => setNewProdName(e.target.value)} />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium mb-1">Producto existente *</label>
                <Select value={existingProductId} onValueChange={setExistingProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar producto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {productsList.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedExistingProduct && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Se creará una nueva variante dentro de: <span className="font-medium">{selectedExistingProduct.name}</span>
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium mb-1">Presentación / variante</label>
              <Input
                value={newVariantName}
                onChange={(e) => setNewVariantName(e.target.value)}
                placeholder='Ej: 1L, pack 6, "Única"...'
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">SKU</label>
                <Input value={newProdSku} onChange={(e) => setNewProdSku(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Código de barras</label>
                <Input value={newProdBarcode} onChange={(e) => setNewProdBarcode(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Precio venta (lista normal) *</label>
                <Input
                  type="number"
                  min={0}
                  value={newProdSalePrice}
                  onChange={(e) => setNewProdSalePrice(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Obligatorio para que aparezca en POS / Precios.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Último costo compra</label>
                <Input
                  type="number"
                  min={0}
                  value={newProdLastCost}
                  onChange={(e) => setNewProdLastCost(e.target.value)}
                />
              </div>
            </div>
          </div>


          <div className="pt-3 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setProductDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleCreateQuickProduct}
              disabled={creatingProduct}
            >
              {creatingProduct
                ? "Guardando..."
                : "Crear producto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
