import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { PaymentMethod } from "@/types";
import { formatCurrency } from "@/utils/format";

export interface PaymentDraft {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

interface PaymentDialogProps {
  open: boolean;
  total: number;
  onCancel: () => void;
  onConfirm: (draft: PaymentDraft) => void;
}

export function PaymentDialog({ open, total, onCancel, onConfirm }: PaymentDialogProps) {
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [amountStr, setAmountStr] = useState("");
  const [reference, setReference] = useState("");

  useEffect(() => {
    if (open) {
      setMethod("CASH");
      setAmountStr(total.toString());
      setReference("");
    }
  }, [open, total]);

  const amount = Number(amountStr) || 0;
  const change = method === "CASH" && amount > total ? amount - total : 0;

  const handleConfirm = () => {
    if (amount <= 0) return;
    if (amount < total) {
      alert("El monto ingresado es menor al total de la venta.");
      return;
    }
    onConfirm({ method, amount, reference: reference || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Pago</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Total a pagar</span>
            <span className="font-semibold">{formatCurrency(total)}</span>
          </div>

          <div className="space-y-2">
            <Label>Medio de pago</Label>
            <Select
              value={method}
              onValueChange={(val) => setMethod(val as PaymentMethod)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Efectivo</SelectItem>
                <SelectItem value="CARD">Tarjeta</SelectItem>
                <SelectItem value="TRANSFER">Transferencia</SelectItem>
                <SelectItem value="OTHER">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Monto recibido</Label>
            <Input
              type="number"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
            />
            {method === "CASH" && (
              <p className="text-xs text-muted-foreground">
                Vuelto:{" "}
                <span className="font-semibold">
                  {formatCurrency(Math.max(change, 0))}
                </span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Referencia (opcional)</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Nº de voucher, banco, etc."
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>Confirmar pago</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
