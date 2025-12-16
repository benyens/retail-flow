// src/modules/pos/pages/POSPage.tsx
import {
  useEffect,
  useMemo,
  useState,
  useRef,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/state/AppContext";
import { apiClient } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DollarSign,
  Clock,
  AlertCircle,
  Plus,
  Minus,
  Pencil,
  Boxes,
} from "lucide-react";
import { formatCurrency } from "@/utils/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import type {
  Cart,
  CartLine,
  VariantWithProduct,
  WholesaleTier,
  VariantPrice,
  Stock,
  Customer,
  DocumentType,
  Employee,
} from "@/types";
import { recalculateCart } from "@/utils/wholesale";
import {
  PaymentDialog,
  PaymentDraft,
} from "@/modules/pos/components/PaymentDialog";
import { CustomerDialog } from "@/modules/pos/components/CustomerDialog";
import { PriceEditDialog } from "@/modules/pos/components/PriceEditDialog";
import { CashCloseDialog } from "@/modules/cash/components/CashCloseDialog";
import { CustomerEditDialog } from "@/modules/pos/components/CustomerEditDialog";
import { CashMovementDialog } from "@/modules/cash/components/CashMovementDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const emptyCart: Cart = {
  lines: [],
  groupSummaries: [],
  subtotal: 0,
  tax: 0,
  total: 0,
};

// por ahora lo dejamos siempre true; luego lo amarramos a roles (ADMIN / MANAGER)
const canEditPrice = true;

// ID seguro (fallback si randomUUID no está)
const newId = (prefix = "cart") => {
  const base =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? (crypto as any).randomUUID()
      : `${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2)}`;
  return `${prefix}-${base}`;
};

type BranchStockRow = {
  branchId: string;
  branchName: string;
  quantity: number;
};

type QuickCommand = { qty: number; text: string } | null;

export default function POSPage() {
  const { currentSession, selectedCashRegister, setCurrentSession } = useApp();
  const navigate = useNavigate();

  const [initialFund, setInitialFund] = useState("50000");
  const [isOpening, setIsOpening] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const customerSearchRef = useRef<HTMLInputElement | null>(null);

  // POS data
  const [query, setQuery] = useState("");
  const [variants, setVariants] = useState<VariantWithProduct[]>([]);
  const [tiers, setTiers] = useState<WholesaleTier[]>([]);
  const [priceMap, setPriceMap] = useState<Map<string, number>>(new Map());
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map());
  const [cart, setCart] = useState<Cart>(emptyCart);

  // selección en la lista de productos
  const [searchSelectionIndex, setSearchSelectionIndex] =
    useState<number>(-1);

  // selección en el carrito
  const [selectedCartIndex, setSelectedCartIndex] =
    useState<number>(-1);

  // Cliente y tipo de documento
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer | null>(null);
  const [docType, setDocType] = useState<DocumentType>("BOLETA");

  // Pago / cliente dialogs / cierre / precio
  const [isPaymentOpen, setPaymentOpen] = useState(false);
  const [isCustomerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [isCustomerEditDialogOpen, setCustomerEditDialogOpen] =
    useState(false);
  const [isCloseDialogOpen, setCloseDialogOpen] = useState(false);
  const [priceEditLineId, setPriceEditLineId] = useState<string | null>(
    null
  );
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isCashMovementOpen, setCashMovementOpen] = useState(false);

  // Stock por sucursal (modal)
  const [stockVariantId, setStockVariantId] = useState<string | null>(
    null
  );
  const [stockVariantName, setStockVariantName] = useState<string>("");

  // ------- Helper para comandos rápidos (12*desodorante, -1*desodorante) -------
  const parseQuickCommand = (raw: string): QuickCommand => {
    const cmd = raw.trim();
    const match = cmd.match(/^([+-]?\d+)\s*[*xX]\s*(.+)$/);
    if (!match) return null;
    const qty = Number(match[1]);
    const text = match[2].trim();
    if (!text || !Number.isFinite(qty) || qty === 0) return null;
    return { qty, text };
  };

  const handleOpenSession = async () => {
    if (!selectedCashRegister) return;
    setIsOpening(true);
    try {
      const session = await apiClient.openCashSession(
        selectedCashRegister.id,
        parseInt(initialFund) || 0
      );
      setCurrentSession(session);
      toast.success("Caja abierta exitosamente");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al abrir caja"
      );
    } finally {
      setIsOpening(false);
    }
  };

  // Cargar datos base al abrir sesión
  useEffect(() => {
    if (!currentSession || !selectedCashRegister) return;

    (async () => {
      try {
        const [v, t, vp, st, cs, emps] = await Promise.all([
          apiClient.getVariants(),
          apiClient.getWholesaleTiers(),
          apiClient.getVariantPrices(),
          apiClient.getStock(selectedCashRegister.branchId),
          apiClient.getCustomers(),
          apiClient.getEmployees(selectedCashRegister.branchId),
        ]);

        setVariants(v);
        setTiers(t);

        // precios normales (lista pl-1)
        const normalPriceListId = "pl-1";
        const pMap = new Map<string, number>();
        (vp as VariantPrice[])
          .filter((x) => x.priceListId === normalPriceListId)
          .forEach((x) => pMap.set(x.variantId, x.price));
        setPriceMap(pMap);

        // stock en sucursal actual
        const sMap = new Map<string, number>();
        (st as Stock[]).forEach((s) => sMap.set(s.variantId, s.quantity));
        setStockMap(sMap);

        // clientes
        setCustomers([...cs]);
        // Empleados
        setEmployees(emps);

        const general =
          cs.find((c) => c.rut === "66666666-6") ??
          cs.find((c) =>
            c.name.toLowerCase().includes("general")
          ) ??
          cs[0] ??
          null;
        setSelectedCustomer(general);

        setCart((prev) => recalculateCart(prev.lines, t));
      } catch (e) {
        console.error(e);
        toast.error("No se pudieron cargar datos de POS");
      }
    })();
  }, [currentSession, selectedCashRegister]);

  // --- mapa de tramos mayoristas por grupo (para mostrar en la lista) ---
  const groupTiersMap = useMemo(() => {
    const map = new Map<string, WholesaleTier[]>();
    tiers.forEach((t) => {
      const arr = map.get(t.variantGroupId);
      if (arr) arr.push(t);
      else map.set(t.variantGroupId, [t]);
    });
    for (const arr of map.values()) {
      arr.sort((a, b) => a.minQty - b.minQty);
    }
    return map;
  }, [tiers]);

  // Búsqueda de productos
  const filteredProducts = useMemo(() => {
    const quick = parseQuickCommand(query);
    const baseText = quick ? quick.text : query; // si es 12*desodorante, usamos solo "desodorante"
    const q = baseText.trim().toLowerCase();
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
  }, [query, variants]); // parseQuickCommand es determinista según query

  // mantener índice de selección de búsqueda coherente
  useEffect(() => {
    if (filteredProducts.length === 0) {
      setSearchSelectionIndex(-1);
    } else if (
      searchSelectionIndex < 0 ||
      searchSelectionIndex >= filteredProducts.length
    ) {
      setSearchSelectionIndex(0);
    }
  }, [filteredProducts.length, searchSelectionIndex]);

  // Búsqueda de clientes
  const visibleCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      const name = c.name.toLowerCase();
      const rut = c.rut.toLowerCase();
      return name.includes(q) || rut.includes(q);
    });
  }, [customers, customerSearch]);

  // ¿Cliente válido para FACTURA?
  const canIssueInvoice =
    selectedCustomer != null &&
    selectedCustomer.rut !== "66666666-6";

  // Agregar al carrito con control de stock
  const addVariantToCart = (
    variant: VariantWithProduct,
    qty: number = 1
  ) => {
    if (qty <= 0) return;
    try {
      setCart((prev) => {
        const existing = prev.lines.find(
          (l) => l.variantId === variant.id
        );
        const basePrice = priceMap.get(variant.id) ?? 0;
        const stock = stockMap.get(variant.id) ?? Infinity;
        const currentQty = existing?.quantity ?? 0;

        if (currentQty + qty > stock) {
          toast.error("Stock insuficiente para este producto");
          return prev;
        }

        let newLines: CartLine[];
        if (existing) {
          newLines = prev.lines.map((l) =>
            l.variantId === variant.id
              ? { ...l, quantity: l.quantity + qty }
              : l
          );
        } else {
          const line: CartLine = {
            id: newId(),
            variantId: variant.id,
            variantGroupId: variant.variantGroupId,
            variant,
            quantity: qty,
            basePrice,
            unitPrice: basePrice,
            priceSource: "NORMAL",
            subtotal: basePrice * qty,
          };
          newLines = [...prev.lines, line];
        }

        return recalculateCart(newLines, tiers);
      });
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "Error al agregar producto"
      );
    }
  };

  // Cambiar cantidad respetando stock (botones +/-)
  const changeQty = (lineId: string, delta: number) => {
    setCart((prev) => {
      const target = prev.lines.find((l) => l.id === lineId);
      if (!target) return prev;

      const stock = stockMap.get(target.variantId) ?? Infinity;
      const newQty = target.quantity + delta;

      if (newQty < 0) return prev;
      if (newQty === 0) {
        const remaining = prev.lines.filter((l) => l.id !== lineId);
        return recalculateCart(remaining, tiers);
      }

      if (newQty > stock) {
        toast.error("Stock insuficiente para este producto");
        return prev;
      }

      const updated = prev.lines.map((l) =>
        l.id === lineId ? { ...l, quantity: newQty } : l
      );
      return recalculateCart(updated, tiers);
    });
  };

  // mantener índice de selección del carrito coherente
  useEffect(() => {
    if (cart.lines.length === 0) {
      setSelectedCartIndex(-1);
    } else if (
      selectedCartIndex < 0 ||
      selectedCartIndex >= cart.lines.length
    ) {
      setSelectedCartIndex(0);
    }
  }, [cart.lines.length, selectedCartIndex]);

  // Atajos globales de teclado:
  // F1 / F3 / F2 / F4 / F6 / F8 / F10 + flechas para carrito
  // IMPORTANTE: si el diálogo de pago está abierto, NO manipulamos el carrito ni atajos de POS.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingElement =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      // --- Si estoy en la pantalla de pago, no dejo que estas teclas toquen el carrito ---
      if (isPaymentOpen) return;
      if (!currentSession) return;

      // F1: foco buscador de productos
      if (e.key === "F1") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // F3: foco buscador de clientes
      if (e.key === "F3") {
        e.preventDefault();
        customerSearchRef.current?.focus();
        return;
      }

      // F2: alternar BOLETA/FACTURA
      if (e.key === "F2") {
        e.preventDefault();
        setDocType((prev) => {
          if (prev === "BOLETA") {
            if (!canIssueInvoice) {
              toast.error(
                "Para emitir factura debe seleccionar un cliente válido (no Cliente General)."
              );
              return prev;
            }
            return "FACTURA";
          }
          return "BOLETA";
        });
        return;
      }

      // F4: pagar
      if (e.key === "F4") {
        e.preventDefault();
        if (cart.lines.length > 0) {
          setPaymentOpen(true);
        }
        return;
      }

      // F6: nuevo cliente
      if (e.key === "F6") {
        e.preventDefault();
        setCustomerDialogOpen(true);
        return;
      }

      // F8: vaciar carrito
      if (e.key === "F8") {
        e.preventDefault();
        if (
          cart.lines.length > 0 &&
          window.confirm("¿Vaciar el carrito?")
        ) {
          setCart(emptyCart);
          setSelectedCartIndex(-1);
        }
        return;
      }

      // F10: ir a pantalla de ingreso de facturas de compra
      if (e.key === "F10") {
        e.preventDefault();
        navigate("/ingresar-facturas");
        return;
      }

      // Flechas para el carrito (solo si no está escribiendo en un input)
      if (isTypingElement) return;

      if (e.key === "ArrowDown") {
        if (cart.lines.length === 0) return;
        e.preventDefault();
        setSelectedCartIndex((prev) =>
          prev < 0
            ? 0
            : prev >= cart.lines.length - 1
            ? 0
            : prev + 1
        );
        return;
      }

      if (e.key === "ArrowUp") {
        if (cart.lines.length === 0) return;
        e.preventDefault();
        setSelectedCartIndex((prev) =>
          prev <= 0 ? cart.lines.length - 1 : prev - 1
        );
        return;
      }

      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        if (selectedCartIndex < 0) return;
        e.preventDefault();
        const delta = e.key === "ArrowRight" ? 1 : -1;

        setCart((prev) => {
          if (
            selectedCartIndex < 0 ||
            selectedCartIndex >= prev.lines.length
          ) {
            return prev;
          }

          const line = prev.lines[selectedCartIndex];
          const stock = stockMap.get(line.variantId) ?? Infinity;
          const newQty = line.quantity + delta;

          if (newQty > stock) {
            toast.error("Stock insuficiente para este producto");
            return prev;
          }

          let newLines: CartLine[];
          if (newQty <= 0) {
            newLines = prev.lines.filter(
              (_, i) => i !== selectedCartIndex
            );
          } else {
            newLines = prev.lines.map((l, i) =>
              i === selectedCartIndex
                ? { ...l, quantity: newQty }
                : l
            );
          }

          return recalculateCart(newLines, tiers);
        });
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    cart.lines.length,
    canIssueInvoice,
    navigate,
    selectedCartIndex,
    stockMap,
    tiers,
    isPaymentOpen,
    currentSession,
    cart.lines.length,
  ]);

  // Enter y flechas en buscador de productos
  const handleSearchKeyDown = (
    e: ReactKeyboardEvent<HTMLInputElement>
  ) => {
    const { key } = e;

    // Flechas para navegar la lista de productos
    if (key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      if (filteredProducts.length === 0) return;
      setSearchSelectionIndex((prev) =>
        prev < 0
          ? 0
          : prev >= filteredProducts.length - 1
          ? 0
          : prev + 1
      );
      return;
    }

    if (key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      if (filteredProducts.length === 0) return;
      setSearchSelectionIndex((prev) =>
        prev <= 0 ? filteredProducts.length - 1 : prev - 1
      );
      return;
    }

    if (key !== "Enter") return;
    e.preventDefault();

    const raw = query.trim();
    if (!raw) return;

    // 1) Comando rápido tipo 12*desodorante o -1*desodorante
    const quick = parseQuickCommand(raw);
    if (quick) {
      const { qty, text } = quick;
      const qLower = text.toLowerCase();

      const matches = variants.filter((v) => {
        const sku = v.sku?.toLowerCase() ?? "";
        const name = v.name?.toLowerCase() ?? "";
        const prodName = v.product.name.toLowerCase();
        const barcode = v.barcode?.toLowerCase() ?? "";
        return (
          sku.includes(qLower) ||
          name.includes(qLower) ||
          prodName.includes(qLower) ||
          barcode.includes(qLower)
        );
      });

      if (matches.length === 0) {
        toast.error("No se encontró ningún producto que coincida");
        return;
      }

      const variant = matches[0];

      if (qty > 0) {
        // agregar n unidades
        addVariantToCart(variant, qty);
      } else {
        // qty < 0 => restar unidades
        const removeQty = Math.abs(qty);
        setCart((prev) => {
          const line = prev.lines.find(
            (l) => l.variantId === variant.id
          );
          if (!line) {
            toast.error("Ese producto no está en el carrito");
            return prev;
          }
          const newQty = line.quantity - removeQty;
          if (newQty <= 0) {
            const remaining = prev.lines.filter(
              (l) => l.id !== line.id
            );
            return recalculateCart(remaining, tiers);
          }
          const updated = prev.lines.map((l) =>
            l.id === line.id ? { ...l, quantity: newQty } : l
          );
          return recalculateCart(updated, tiers);
        });
      }

      setQuery("");
      return;
    }

    // 2) Caso lector de código de barras o SKU exacto
    const qLower = raw.toLowerCase();

    const exact =
      variants.find(
        (v) => (v.barcode ?? "").toLowerCase() === qLower
      ) ??
      variants.find(
        (v) => (v.sku ?? "").toLowerCase() === qLower
      );

    if (exact) {
      addVariantToCart(exact);
      setQuery("");
      return;
    }

    // 3) Si hay selección con flechas, usar esa
    if (
      searchSelectionIndex >= 0 &&
      searchSelectionIndex < filteredProducts.length
    ) {
      const v = filteredProducts[searchSelectionIndex];
      addVariantToCart(v);
      setQuery("");
      return;
    }

    // 4) Si solo hay un resultado, usar ese
    if (filteredProducts.length === 1) {
      addVariantToCart(filteredProducts[0]);
      setQuery("");
    }
  };

  // Confirmar pago desde el diálogo
  // antes: draft: { method, amount, reference }
  const handleConfirmPayment = async (draft: PaymentDraft) => {
    setPaymentOpen(false);

    if (!currentSession || !selectedCashRegister) return;
    if (cart.lines.length === 0) {
      toast.error("Carrito vacío");
      return;
    }

    // Validación extra para FACTURA
    if (docType === "FACTURA" && !canIssueInvoice) {
      toast.error(
        "Para emitir factura debe seleccionar un cliente válido (no Cliente General)."
      );
      return;
    }

    if (!draft.payments || draft.payments.length === 0) {
      toast.error("Debe registrar al menos un método de pago");
      return;
    }

    const totalPaid = draft.payments.reduce(
      (sum, p) => sum + (p.amount || 0),
      0
    );

    if (totalPaid + 0.0001 < cart.total) {
      // En teoría no debería pasar porque el diálogo no confirma hasta cubrir total,
      // pero por seguridad dejamos esta validación.
      toast.error("Los pagos no cubren el total de la venta");
      return;
    }

    try {
      const lines = cart.lines.map((l) => ({
        variantId: l.variantId,
        variantGroupId: l.variantGroupId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        priceSource: l.priceSource,
        wholesaleMinQtyApplied: l.wholesaleMinQtyApplied,
        wholesaleUnitPriceApplied: l.wholesaleUnitPriceApplied,
        subtotal: l.subtotal,
      }));

      const payments = draft.payments.map((p) => ({
        method: p.method,
        amount: p.amount,
        reference: p.note,
      })) as any[];

      const customerId = selectedCustomer ? selectedCustomer.id : null;

      await apiClient.createSale(
        selectedCashRegister.branchId,
        currentSession.id,
        customerId,
        docType,
        lines,
        payments
      );

      toast.success("Venta registrada correctamente");
      setCart(emptyCart);
    } catch (e) {
      console.error(e);
      toast.error("Error al crear venta");
    }
  };



  // Lógica de edición de precio
  const priceEditLine = priceEditLineId
    ? cart.lines.find((l) => l.id === priceEditLineId) ?? null
    : null;

  const handleSaveNewPrice = (newPrice: number) => {
    if (!priceEditLine) return;

    setCart((prev) => {
      const newLines = prev.lines.map((l) =>
        l.id === priceEditLine.id
          ? {
              ...l,
              unitPrice: newPrice,
              priceSource: "MANUAL" as const,
              wholesaleMinQtyApplied: undefined,
              wholesaleUnitPriceApplied: undefined,
              subtotal: Math.round(newPrice * l.quantity),
            }
          : l
      );
      return recalculateCart(newLines, tiers);
    });

    setPriceEditLineId(null);
  };

  // --- Render ---

  if (!currentSession) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md animate-scale-in">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-warning" />
            </div>
            <CardTitle>Caja Cerrada</CardTitle>
            <CardDescription>
              Debe abrir la caja antes de realizar ventas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Fondo Inicial
              </label>
              <Input
                type="number"
                value={initialFund}
                onChange={(e) => setInitialFund(e.target.value)}
                className="h-12 text-lg font-mono"
                placeholder="0"
              />
              <p className="text-sm text-muted-foreground">
                {formatCurrency(parseInt(initialFund) || 0)}
              </p>
            </div>
            <Button
              onClick={handleOpenSession}
              disabled={isOpening}
              className="w-full h-12 text-lg"
            >
              {isOpening ? "Abriendo..." : "Abrir Caja"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="h-14 bg-card border-b px-4 flex items-center justify-between shrink-0">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">Punto de Venta</h1>
            <div className="badge-success flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Caja Abierta
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Atajos: F1 productos · F3 clientes · F2 boleta/factura ·
            F4 pagar · F8 vaciar · F10 ingreso facturas
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            Fondo: {formatCurrency(currentSession.initialFund)}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCashMovementOpen(true)}
          >
            Mov. caja
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCloseDialogOpen(true)}
          >
            Cerrar caja
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Lista de productos */}
        <div className="flex-1 p-4 overflow-auto bg-pos-panel">
          <div className="mb-2">
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Buscar producto por SKU, nombre o código de barras... (F1)"
              className="h-12 text-lg"
            />
          </div>
          <div className="mb-2 text-[10px] text-muted-foreground">
            También puedes usar: 12*desodorante, -1*shampoo, etc.
          </div>

          <div className="space-y-2">
            {filteredProducts.map((v, idx) => {
              const p = priceMap.get(v.id) ?? 0;
              const stock = stockMap.get(v.id) ?? 0;
              const groupTiers =
                groupTiersMap.get(v.variantGroupId) ?? [];

              return (
                <div
                  key={v.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 hover:border-primary cursor-pointer",
                    idx === searchSelectionIndex &&
                      "border-primary bg-primary/5"
                  )}
                  onMouseEnter={() =>
                    setSearchSelectionIndex(idx)
                  }
                  onClick={() => addVariantToCart(v)}
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {v.name}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {v.sku}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {v.variantGroup?.name}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary">
                        {formatCurrency(p)}
                      </div>

                      {/* todos los precios mayoristas para este grupo */}
                      {groupTiers.length > 0 && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Mayorista:{" "}
                          {groupTiers.map((t, idx2) => (
                            <span key={t.id}>
                              {t.minQty}+{" "}
                              {formatCurrency(t.unitPrice)}
                              {idx2 <
                                groupTiers.length - 1 && " · "}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="text-[11px] text-muted-foreground">
                        IVA incl. · Stock sucursal:{" "}
                        <span
                          className={
                            stock <= 0 ? "text-red-500" : ""
                          }
                        >
                          {stock}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Botón stock por sucursal */}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStockVariantId(v.id);
                          setStockVariantName(
                            v.name || v.product.name
                          );
                        }}
                      >
                        <Boxes className="w-4 h-4" />
                      </Button>

                      <Button
                        className="h-9"
                        onClick={(e) => {
                          e.stopPropagation();
                          addVariantToCart(v);
                        }}
                        disabled={stock <= 0}
                      >
                        Agregar
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Carrito */}
        <div className="w-96 bg-card border-l flex flex-col">
          <div className="p-4 border-b space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Carrito</h2>
              <span className="text-[10px] text-muted-foreground">
                F8 vacía carrito
              </span>
            </div>

            {/* Cliente + Tipo Doc + búsqueda */}
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Cliente</span>
                <div className="flex items-center gap-2 min-w-0">
                  <select
                    className="border rounded px-2 text-[11px] h-7 max-w-[150px] truncate"
                    value={selectedCustomer?.id ?? ""}
                    onChange={(e) => {
                      const c =
                        customers.find(
                          (x) => x.id === e.target.value
                        ) ?? null;
                      setSelectedCustomer(c);
                    }}
                  >
                    {visibleCustomers.length === 0 && (
                      <option value="" disabled>
                        Sin resultados
                      </option>
                    )}
                    {visibleCustomers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.rut})
                      </option>
                    ))}
                  </select>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px] whitespace-nowrap"
                    onClick={() => setCustomerDialogOpen(true)}
                  >
                    Nuevo
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px] whitespace-nowrap"
                    onClick={() =>
                      selectedCustomer &&
                      setCustomerEditDialogOpen(true)
                    }
                    disabled={!selectedCustomer}
                  >
                    Editar
                  </Button>
                </div>
              </div>

              <Input
                ref={customerSearchRef}
                value={customerSearch}
                onChange={(e) =>
                  setCustomerSearch(e.target.value)
                }
                placeholder="Buscar cliente por nombre o RUT... (F3)"
                className="h-7 text-[11px]"
              />

              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>F6 nuevo cliente</span>
                <span>F3 buscar cliente</span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground flex items-center gap-1">
                  Documento
                  <span className="text-[9px] text-muted-foreground/75">
                    (F2 alterna)
                  </span>
                </span>
                <div className="inline-flex rounded border overflow-hidden">
                  <button
                    className={`px-3 py-1 text-xs ${
                      docType === "BOLETA"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background"
                    }`}
                    onClick={() => setDocType("BOLETA")}
                  >
                    Boleta
                  </button>
                  <button
                    className={`px-3 py-1 text-xs ${
                      docType === "FACTURA"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background"
                    }`}
                    onClick={() => {
                      if (!canIssueInvoice) {
                        toast.error(
                          "Para emitir factura debe seleccionar un cliente válido (no Cliente General)."
                        );
                        return;
                      }
                      setDocType("FACTURA");
                    }}
                  >
                    Factura
                  </button>
                </div>
              </div>
            </div>

            {cart.groupSummaries.length > 0 && (
              <div className="mt-2 space-y-1 text-xs">
                {cart.groupSummaries.map((g) => (
                  <div
                    key={g.variantGroupId}
                    className="flex justify-between"
                  >
                    <span className="truncate">
                      {g.variantGroupName} (x{g.totalQty})
                    </span>
                    <span
                      className={
                        g.isWholesale
                          ? "text-primary font-semibold"
                          : "text-muted-foreground"
                      }
                    >
                      {g.isWholesale
                        ? `Mayorista ${formatCurrency(
                            g.appliedUnitPrice
                          )}`
                        : "Normal"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 p-4 overflow-auto">
            {cart.lines.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Agregue productos al carrito
              </p>
            ) : (
              <div className="space-y-3">
                {cart.lines.map((l, index) => (
                  <div
                    key={l.id}
                    className={cn(
                      "border rounded-lg p-3 cursor-pointer",
                      index === selectedCartIndex &&
                        "border-primary bg-primary/5"
                    )}
                    onClick={() =>
                      setSelectedCartIndex(index)
                    }
                  >
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {l.variant.name}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {l.variant.sku}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          Grupo: {l.variant.variantGroup?.name}
                        </div>
                        <div className="text-xs flex items-center gap-1">
                          {l.priceSource === "WHOLESALE" ? (
                            <span className="text-primary font-semibold">
                              Mayorista (≥
                              {l.wholesaleMinQtyApplied}){" "}
                              {formatCurrency(l.unitPrice)}
                            </span>
                          ) : l.priceSource === "MANUAL" ? (
                            <span className="text-amber-600 font-semibold">
                              Precio manual{" "}
                              {formatCurrency(l.unitPrice)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              Normal{" "}
                              {formatCurrency(l.unitPrice)}
                            </span>
                          )}
                          {canEditPrice && (
                            <button
                              type="button"
                              className="ml-1 inline-flex items-center text-[11px] text-muted-foreground hover:text-primary"
                              onClick={() =>
                                setPriceEditLineId(l.id)
                              }
                            >
                              <Pencil className="w-3 h-3 mr-0.5" />
                              Editar
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              changeQty(l.id, -1)
                            }
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <div className="w-8 text-center font-mono">
                            {l.quantity}
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              changeQty(l.id, +1)
                            }
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="font-semibold">
                          {formatCurrency(l.subtotal)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totales (IVA incluido) */}
          <div className="p-4 border-t space-y-2">
            <div className="flex justify-between text-sm">
              <span>Neto</span>
              <span>{formatCurrency(cart.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>IVA (incluido)</span>
              <span>{formatCurrency(cart.tax)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold">
              <span>Total</span>
              <span>{formatCurrency(cart.total)}</span>
            </div>
            <div className="text-[10px] text-muted-foreground text-right">
              F10: Ingreso facturas de compra
            </div>
          </div>

          <div className="p-4 border-t space-y-2">
            <Button
              className="w-full h-14 text-lg pos-button-success"
              onClick={() => setPaymentOpen(true)}
              disabled={cart.lines.length === 0}
            >
              Pagar
              <span className="ml-2 text-[11px] font-mono bg-black/10 dark:bg-white/10 rounded px-1">
                F4
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* Diálogo de pago */}
      <PaymentDialog
        open={isPaymentOpen}
        total={cart.total}
        onCancel={() => setPaymentOpen(false)}
        onConfirm={handleConfirmPayment}
      />

      {/* Diálogo nuevo cliente */}
      <CustomerDialog
        open={isCustomerDialogOpen}
        onCancel={() => setCustomerDialogOpen(false)}
        onCreated={(customer) => {
          setCustomerDialogOpen(false);
          setCustomers((prev) => [...prev, customer]);
          setSelectedCustomer(customer);
        }}
      />

      {/* Diálogo editar cliente */}
      {selectedCustomer && (
        <CustomerEditDialog
          open={isCustomerEditDialogOpen}
          customer={selectedCustomer}
          onCancel={() => setCustomerEditDialogOpen(false)}
          onUpdated={(updated) => {
            setCustomerEditDialogOpen(false);
            setCustomers((prev) =>
              prev.map((c) =>
                c.id === updated.id ? updated : c
              )
            );
            setSelectedCustomer(updated);
          }}
        />
      )}

      {/* Diálogo de edición de precio */}
      <PriceEditDialog
        open={!!priceEditLine}
        lineName={priceEditLine?.variant.name ?? ""}
        currentPrice={priceEditLine?.unitPrice ?? 0}
        onCancel={() => setPriceEditLineId(null)}
        onSave={handleSaveNewPrice}
      />

      {/* Diálogo de cierre de caja */}
      <CashCloseDialog
        open={isCloseDialogOpen}
        sessionId={currentSession.id}
        onCancel={() => setCloseDialogOpen(false)}
        onClosed={() => {
          setCloseDialogOpen(false);
          setCurrentSession(null);
          toast.success("Caja cerrada");
        }}
      />

      {/* Diálogo de movimiento de caja */}
      <CashMovementDialog
        open={isCashMovementOpen}
        sessionId={currentSession.id}
        branchId={selectedCashRegister!.branchId}
        employees={employees}
        onCancel={() => setCashMovementOpen(false)}
        onCreated={() => {
          setCashMovementOpen(false);
          toast.success("Movimiento registrado");
        }}
      />

      {/* Diálogo de stock por sucursal */}
      <StockByBranchDialog
        open={!!stockVariantId}
        variantId={stockVariantId}
        variantName={stockVariantName}
        onClose={() => setStockVariantId(null)}
      />
    </div>
  );
}

// ---- Dialog de stock por sucursal ----
// Necesitas implementar apiClient.getStockByVariant(variantId)
// que devuelva: { branchId, branchName, quantity }[]

function StockByBranchDialog(props: {
  open: boolean;
  variantId: string | null;
  variantName: string;
  onClose: () => void;
}) {
  const { open, variantId, variantName, onClose } = props;
  const [rows, setRows] = useState<BranchStockRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !variantId) return;
    setLoading(true);
    (async () => {
      try {
        const data = await apiClient.getStockByVariant(
          variantId
        );
        setRows(data as BranchStockRow[]);
      } catch (e) {
        console.error(e);
        toast.error(
          "No se pudo cargar el stock por sucursal"
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [open, variantId]);

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stock por sucursal</DialogTitle>
          <DialogDescription>
            {variantName}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">
            Cargando stock...
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay información de stock para esta variante.
          </p>
        ) : (
          <div className="border rounded-md max-h-60 overflow-auto text-sm">
            <table className="w-full">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-3 py-1 text-left">
                    Sucursal
                  </th>
                  <th className="px-3 py-1 text-right">
                    Stock
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.branchId}
                    className="border-t last:border-b-0"
                  >
                    <td className="px-3 py-1">
                      {r.branchName}
                    </td>
                    <td className="px-3 py-1 text-right">
                      {r.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
