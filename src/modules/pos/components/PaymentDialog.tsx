import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/utils/format";
import type { PaymentMethod } from "@/types";
import { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type SinglePayment = {
  method: PaymentMethod;
  amount: number;
  note?: string;
};

export type PaymentDraft = {
  payments: SinglePayment[];
};

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "CASH",       label: "Efectivo" },
  { id: "CARD",       label: "Tarjeta" },
  { id: "TRANSFER",   label: "Transferencia" },
  { id: "CHECK",      label: "Cheque" },
  { id: "OTHER",      label: "Otro" },
];

type Props = {
  open: boolean;
  total: number;
  onCancel: () => void;
  onConfirm: (draft: PaymentDraft) => void;
};

export function PaymentDialog({ open, total, onCancel, onConfirm }: Props) {
  const [payments, setPayments] = useState<SinglePayment[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [amountInput, setAmountInput] = useState<string>("");
  const [note, setNote] = useState("");

  const alreadyPaid = useMemo(
    () => payments.reduce((sum, p) => sum + (p.amount || 0), 0),
    [payments]
  );

  const remaining = Math.max(total - alreadyPaid, 0);
  const currentMethod = METHODS[selectedIndex]?.id ?? "CASH";

  // Reset cada vez que se abre
  useEffect(() => {
    if (!open) return;
    setPayments([]);
    setSelectedIndex(0);
    setNote("");
    setAmountInput(String(total));
  }, [open, total]);

  const labelForNote = useMemo(() => {
    switch (currentMethod) {
      case "CARD":
        return "Detalle tarjeta (últimos 4, banco, etc.)";
      case "TRANSFER":
        return "Detalle transferencia (nº operación, banco, etc.)";
      case "CHECK":
        return "Detalle cheque (nº cheque, banco, etc.)";
      case "OTHER":
        return "Detalle del pago";
      case "CASH":
      default:
        return "Nota (opcional)";
    }
  }, [currentMethod]);

  const handleAddAndMaybeConfirm = useCallback(
    (origin: "enter" | "f4" | "click") => {
      const clean = amountInput.replace(",", ".").trim();
      const amount = Number(clean);

      if (!Number.isFinite(amount) || amount <= 0) {
        toast.error("Ingrese un monto válido para este método");
        return;
      }

      const remainingBefore = Math.max(total - alreadyPaid, 0);

      // Caso especial: primer pago en efectivo, puede ser mayor al total → calculamos cambio
      const isFirstCash =
        payments.length === 0 && currentMethod === "CASH";

      let appliedAmount = amount;
      let change = 0;

      if (isFirstCash && amount >= total) {
        appliedAmount = total;
        change = amount - total;
      }

      // En pagos múltiples no dejamos pasar del resto
      if (!isFirstCash && amount > remainingBefore + 0.0001) {
        toast.error(
          `El monto excede lo restante (${formatCurrency(
            remainingBefore
          )})`
        );
        return;
      }

      const newPayments: SinglePayment[] = [
        ...payments,
        {
          method: currentMethod,
          amount: appliedAmount,
          note: note.trim() || undefined,
        },
      ];

      const newTotalPaid = newPayments.reduce(
        (sum, p) => sum + p.amount,
        0
      );

      // ¿Aún queda por pagar? → agregamos el pago y obligamos a seguir
      if (newTotalPaid + 0.0001 < total) {
        setPayments(newPayments);
        setNote("");
        const newRemaining = Math.max(total - newTotalPaid, 0);
        setAmountInput(String(newRemaining));
        if (origin !== "enter") {
          toast.info(
            `Pago agregado. Restante: ${formatCurrency(newRemaining)}`
          );
        }
        return;
      }

      // Total cubierto → confirmamos venta con TODOS los métodos
      onConfirm({ payments: newPayments });

      if (isFirstCash && change > 0) {
        toast.success(`Pago registrado. Cambio: ${formatCurrency(change)}`);
      } else {
        toast.success("Pago registrado");
      }

      // limpiar estado interno
      setPayments([]);
      setNote("");
      setAmountInput("");
    },
    [
      amountInput,
      payments,
      currentMethod,
      note,
      alreadyPaid,
      total,
      onConfirm,
    ]
  );

  // Manejo de teclas DENTRO del diálogo
  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev <= 0 ? METHODS.length - 1 : prev - 1
      );
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev >= METHODS.length - 1 ? 0 : prev + 1
      );
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      handleAddAndMaybeConfirm("enter");
      return;
    }

    if (e.key === "F4") {
      e.preventDefault();
      handleAddAndMaybeConfirm("f4");
      return;
    }
  };

  // Cuando cambias de método sugerimos el restante
  useEffect(() => {
    setAmountInput(String(remaining || total));
  }, [selectedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cambio SOLO visible si es un único pago en efectivo
  const changeToShow =
    payments.length === 0 && currentMethod === "CASH"
      ? Math.max(Number(amountInput || "0") - total, 0)
      : 0;

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onCancel()}>
      <DialogContent
        className="max-w-lg w-full"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle>Pago</DialogTitle>
          <DialogDescription>
            Total a pagar:{" "}
            <span className="font-semibold">
              {formatCurrency(total)}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Métodos de pago */}
          <div>
            <div className="text-xs text-muted-foreground mb-1">
              Método de pago (↑↓ para cambiar, Enter/F4 para agregar/confirmar)
            </div>
            <div className="border rounded-md divide-y overflow-hidden">
              {METHODS.map((m, idx) => {
                const selected = idx === selectedIndex;
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={cn(
                      "w-full px-3 py-2 text-sm flex items-center justify-between cursor-pointer",
                      "focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                      selected
                        ? "bg-primary/10 text-primary"
                        : "bg-background hover:bg-muted"
                    )}
                    onClick={() => setSelectedIndex(idx)}
                  >
                    <span>{m.label}</span>
                    {selected && (
                      <span className="text-[11px] uppercase">
                        seleccionado
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Monto y nota */}
          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium">
                Monto para este método
              </label>
              <Input
                type="number"
                className="mt-1"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
              />
              <div className="text-[11px] text-muted-foreground mt-1">
                Restante actual:{" "}
                <span className="font-semibold">
                  {formatCurrency(remaining)}
                </span>
              </div>
              {changeToShow > 0 && (
                <div className="text-[11px] text-emerald-600 mt-1">
                  Cambio:{" "}
                  <span className="font-semibold">
                    {formatCurrency(changeToShow)}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium">
                {labelForNote}
              </label>
              <Input
                className="mt-1"
                placeholder={
                  currentMethod === "CASH"
                    ? "Ej: billetes grandes, caja 2, etc."
                    : ""
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          {/* Resumen de pagos ya agregados */}
          {payments.length > 0 && (
            <div className="border rounded-md px-3 py-2 text-xs space-y-1 bg-muted/40">
              <div className="font-semibold mb-1">
                Pagos agregados
              </div>
              {payments.map((p, idx) => (
                <div
                  key={idx}
                  className="flex justify-between"
                >
                  <span>
                    {METHODS.find((m) => m.id === p.method)?.label ??
                      p.method}
                  </span>
                  <span>{formatCurrency(p.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-1 mt-1">
                <span>Total pagado</span>
                <span>{formatCurrency(alreadyPaid)}</span>
              </div>
            </div>
          )}

          {/* Totales */}
          <div className="border rounded-md px-3 py-2 text-xs space-y-1">
            <div className="flex justify-between">
              <span>Total venta</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between">
              <span>Pagado</span>
              <span>{formatCurrency(alreadyPaid)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Restante</span>
              <span>{formatCurrency(remaining)}</span>
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-between gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancelar (Esc)
            </Button>
            <Button
              type="button"
              onClick={() => handleAddAndMaybeConfirm("click")}
              className="flex-1"
            >
              Agregar / Confirmar (Enter · F4)
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Atajos: ↑↓ cambiar método · Enter/F4 agrega el pago actual
            (si ya cubre el total, confirma la venta) · Esc cancela.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
