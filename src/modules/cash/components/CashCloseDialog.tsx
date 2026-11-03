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
import { formatCurrency } from "@/utils/format";
import { apiClient } from "@/api";
import type { CashSessionSummary } from "@/types";
import { toast } from "sonner";

interface CashCloseDialogProps {
  open: boolean;
  sessionId: string;
  onCancel: () => void;
  onClosed: () => void; // el padre decide qué hacer después (limpiar sesión, navegar, etc.)
}

export function CashCloseDialog({
  open,
  sessionId,
  onCancel,
  onClosed,
}: CashCloseDialogProps) {
  const [summary, setSummary] = useState<CashSessionSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [declaredStr, setDeclaredStr] = useState("");
  const [notes, setNotes] = useState("");
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!open) return;

    setLoadingSummary(true);
    setSummary(null);
    setDeclaredStr("");
    setNotes("");

    (async () => {
      try {
        const s = await apiClient.getSessionSummary(sessionId);
        setSummary(s);
        // sugerir efectivo esperado como default
        setDeclaredStr(s.expectedCash.toString());
      } catch (e) {
        console.error(e);
        toast.error("No se pudo cargar el resumen de caja");
      } finally {
        setLoadingSummary(false);
      }
    })();
  }, [open, sessionId]);

  const declared = Number(declaredStr) || 0;
  const expected = summary?.expectedCash ?? 0;
  const difference = declared - expected;

  const handleClose = async () => {
    if (!summary) return;
    setClosing(true);
    try {
      await apiClient.closeCashSession(summary.session.id, declared, notes || undefined);
      toast.success("Caja cerrada correctamente");
      onClosed();
    } catch (e) {
      console.error(e);
      toast.error("Error al cerrar caja");
    } finally {
      setClosing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Cierre de caja</DialogTitle>
        </DialogHeader>

        {loadingSummary && <p className="text-sm text-muted-foreground">Cargando resumen...</p>}

        {!loadingSummary && summary && (
          <div className="mt-3 space-y-4">
            {/* Resumen superior */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground">Sucursal</p>
                <p className="font-medium">
                  {summary.session.cashRegisterId} {/* o nombre si lo tienes */}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Usuario</p>
                <p className="font-medium">{summary.session.userId}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Apertura</p>
                <p className="font-mono text-xs">{summary.session.openedAt}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Fondo inicial</p>
                <p className="font-medium">
                  {formatCurrency(summary.session.initialFund)}
                </p>
              </div>
            </div>

            {/* Totales de ventas */}
            <div className="border rounded-lg p-3 space-y-2 text-sm">
              <p className="font-semibold">Ventas</p>
              <div className="flex justify-between">
                <span>Total ventas</span>
                <span>{formatCurrency(summary.totalSales)}</span>
              </div>
              <div className="flex justify-between">
                <span>Efectivo</span>
                <span>{formatCurrency(summary.totalCashSales)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tarjeta</span>
                <span>{formatCurrency(summary.totalCardSales)}</span>
              </div>
              <div className="flex justify-between">
                <span>Transferencia</span>
                <span>{formatCurrency(summary.totalTransferSales)}</span>
              </div>
              <div className="flex justify-between">
                <span>Otros</span>
                <span>{formatCurrency(summary.totalOtherSales)}</span>
              </div>
            </div>

            {/* Movimientos de caja */}
            <div className="border rounded-lg p-3 space-y-2 text-sm max-h-40 overflow-auto">
              <p className="font-semibold">Movimientos de caja</p>
              {summary.movements.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin movimientos registrados.</p>
              ) : (
                summary.movements.map((m) => (
                  <div key={m.id} className="flex justify-between text-xs">
                    <span>
                      {m.type === "IN" ? "+" : "-"} {m.concept} – {m.reason}
                    </span>
                    <span
                      className={
                        m.type === "IN" ? "text-green-600 font-medium" : "text-red-600 font-medium"
                      }
                    >
                      {formatCurrency(m.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Efectivo esperado vs declarado */}
            <div className="border rounded-lg p-3 space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Efectivo esperado en caja</span>
                <span className="font-semibold">{formatCurrency(expected)}</span>
              </div>

              <div className="space-y-1">
                <Label>Efectivo declarado</Label>
                <Input
                  type="number"
                  value={declaredStr}
                  onChange={(e) => setDeclaredStr(e.target.value)}
                />
              </div>

              <div className="flex justify-between text-sm">
                <span>Diferencia</span>
                <span
                  className={
                    difference === 0
                      ? "font-semibold"
                      : difference > 0
                      ? "font-semibold text-green-600"
                      : "font-semibold text-red-600"
                  }
                >
                  {formatCurrency(difference)}
                </span>
              </div>
            </div>

            {/* Notas */}
            <div className="space-y-1 text-sm">
              <Label>Observaciones</Label>
              <textarea
                className="w-full border rounded-md px-2 py-1 text-sm min-h-[60px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas sobre diferencias, retiros, etc."
              />
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={handleClose} disabled={closing || !summary}>
            {closing ? "Cerrando..." : "Confirmar cierre"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
