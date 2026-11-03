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
import { apiClient } from "@/api";
import { formatCurrency } from "@/utils/format";
import { toast } from "sonner";

import type {
  SalesDocument,
  SalesLine,
  PaymentMethod,
  RefType,
} from "@/types";

type Mode = "FULL" | "PARTIAL";

interface CreditNoteDialogProps {
  open: boolean;
  saleId: string | null;
  onClose: () => void;
  onCreated: () => void;
}

export function CreditNoteDialog({
  open,
  saleId,
  onClose,
  onCreated,
}: CreditNoteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<{
    document: SalesDocument;
    lines: SalesLine[];
  } | null>(null);

  const [mode, setMode] = useState<Mode>("FULL");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>("CASH");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !saleId) return;

    setLoading(true);
    setDetail(null);
    setQuantities({});
    setMode("FULL");
    setRefundMethod("CASH");

    (async () => {
      try {
        const { document, lines } = await apiClient.getSaleDetail(saleId);
        setDetail({ document, lines });

        const initialQty: Record<string, string> = {};
        lines.forEach((l) => {
          initialQty[l.id] = String(l.quantity);
        });
        setQuantities(initialQty);
      } catch (e) {
        console.error(e);
        toast.error("No se pudo cargar el detalle de la venta");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, saleId]);

  const handleChangeQty = (lineId: string, value: string) => {
    setQuantities((prev) => ({ ...prev, [lineId]: value }));
  };

  const handleConfirm = async () => {
    if (!detail) return;

    const { document, lines } = detail;

    let refType: RefType;
    let payloadLines: { variantId: string; quantity: number }[];

    if (mode === "FULL") {
      refType = "ANULACION_TOTAL";
      payloadLines = lines.map((l) => ({
        variantId: l.variantId,
        quantity: l.quantity,
      }));
    } else {
      refType = "DEVOLUCION_PARCIAL";
      payloadLines = lines
        .map((l) => ({
          variantId: l.variantId,
          quantity: Math.min(
            l.quantity,
            Math.max(0, Number(quantities[l.id] ?? 0))
          ),
        }))
        .filter((x) => x.quantity > 0);

      if (payloadLines.length === 0) {
        toast.error("Debe indicar al menos una cantidad mayor a 0");
        return;
      }
    }

    try {
      setSaving(true);
      await apiClient.createCreditNote(
        document.id,
        refType,
        payloadLines,
        refundMethod
      );
      toast.success("Nota de crédito creada");
      onCreated();
    } catch (e) {
      console.error(e);
      toast.error("Error al crear la nota de crédito");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nota de crédito</DialogTitle>
        </DialogHeader>

        {loading && (
          <p className="text-sm text-muted-foreground">Cargando venta...</p>
        )}

        {!loading && detail && (
          <div className="mt-3 space-y-4 text-sm">
            {/* Resumen del documento */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-muted-foreground">Documento</p>
                <p className="font-medium">
                  {detail.document.docType}{" "}
                  {detail.document.folio ? `#${detail.document.folio}` : ""}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Total original</p>
                <p className="font-medium">
                  {formatCurrency(detail.document.total)}
                </p>
              </div>
            </div>

            {/* Modo */}
            <div className="space-y-1">
              <Label>Tipo de devolución</Label>
              <div className="inline-flex rounded border overflow-hidden">
                <button
                  type="button"
                  className={`px-3 py-1 text-xs ${
                    mode === "FULL"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background"
                  }`}
                  onClick={() => setMode("FULL")}
                >
                  Anulación total
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 text-xs ${
                    mode === "PARTIAL"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background"
                  }`}
                  onClick={() => setMode("PARTIAL")}
                >
                  Devolución parcial
                </button>
              </div>
            </div>

            {/* Líneas */}
            <div className="border rounded-md max-h-64 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-2 py-1 text-left">Producto</th>
                    <th className="px-2 py-1 text-right">Cant. vendida</th>
                    <th className="px-2 py-1 text-right">Cant. a devolver</th>
                    <th className="px-2 py-1 text-right">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="px-2 py-1">
                        <div className="truncate">{l.variantId}</div>
                      </td>
                      <td className="px-2 py-1 text-right">{l.quantity}</td>
                      <td className="px-2 py-1 text-right">
                        {mode === "FULL" ? (
                          l.quantity
                        ) : (
                          <Input
                            type="number"
                            className="h-7 w-20 text-right text-[11px] inline-block"
                            value={quantities[l.id] ?? ""}
                            onChange={(e) =>
                              handleChangeQty(l.id, e.target.value)
                            }
                          />
                        )}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {formatCurrency(l.unitPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Método de reembolso */}
            <div className="space-y-1">
              <Label>Método de reembolso</Label>
              <select
                className="border rounded px-2 py-1 text-xs"
                value={refundMethod}
                onChange={(e) =>
                  setRefundMethod(e.target.value as PaymentMethod)
                }
              >
                <option value="CASH">Efectivo</option>
                <option value="CARD">Tarjeta</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={saving || !detail}>
            {saving ? "Creando..." : "Crear nota de crédito"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
