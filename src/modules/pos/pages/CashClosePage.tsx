import { useEffect, useState } from "react";
import { useApp } from "@/state/AppContext";
import { apiClient } from "@/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/utils/format";
import { toast } from "sonner";

import type { CashSessionSummary } from "@/types";

export default function CashClosePage() {
  const { currentSession, selectedCashRegister, setCurrentSession } = useApp();
  const [summary, setSummary] = useState<CashSessionSummary | null>(null);
  const [declaredStr, setDeclaredStr] = useState("");
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);

  const canUsePage = !!currentSession && !!selectedCashRegister;

  const loadSummary = async () => {
    if (!currentSession) return;
    try {
      setLoading(true);
      const s = await apiClient.getSessionSummary(currentSession.id);
      setSummary(s);
      setDeclaredStr(String(Math.round(s.expectedCash)));
    } catch (e) {
      console.error(e);
      toast.error("No se pudo cargar el resumen de caja");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canUsePage) {
      loadSummary();
    }
  }, [currentSession?.id, selectedCashRegister?.id]);

  if (!canUsePage) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-2">Cierre de caja</h1>
        <p className="text-muted-foreground text-sm">
          Debe seleccionar una sucursal y tener una caja abierta para ver esta
          información.
        </p>
      </div>
    );
  }

  const declared = Number(declaredStr) || 0;
  const expected = summary?.expectedCash ?? 0;
  const diff = declared - expected;

  const handleClose = async () => {
    if (!currentSession) return;
    if (!window.confirm("¿Seguro que quieres cerrar la caja actual?")) return;

    try {
      setClosing(true);
      const closed = await apiClient.closeCashSession(
        currentSession.id,
        declared,
        diff === 0 ? undefined : `Diferencia declarada: ${diff}`
      );
      setCurrentSession(null);
      toast.success("Caja cerrada correctamente");
      setSummary(null);
    } catch (e) {
      console.error(e);
      toast.error("Error al cerrar la caja");
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Cierre de caja</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {loading || !summary ? (
            <p className="text-muted-foreground">Cargando resumen...</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">
                    Fondo inicial
                  </p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(summary.session.initialFund)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">
                    Total ventas
                  </p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(summary.totalSales)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">
                    Esperado en efectivo
                  </p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(summary.expectedCash)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">
                    Ventas efectivo
                  </p>
                  <p className="font-semibold">
                    {formatCurrency(summary.totalCashSales)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">
                    Ventas tarjeta
                  </p>
                  <p className="font-semibold">
                    {formatCurrency(summary.totalCardSales)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">
                    Ventas transferencia
                  </p>
                  <p className="font-semibold">
                    {formatCurrency(summary.totalTransferSales)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">
                    Otros medios
                  </p>
                  <p className="font-semibold">
                    {formatCurrency(summary.totalOtherSales)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Ingresos/Egresos manuales de caja
                </p>
                <div className="border rounded max-h-40 overflow-auto">
                  {summary.movements.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-3 py-2">
                      No hay movimientos registrados.
                    </p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="px-2 py-1 text-left">Fecha</th>
                          <th className="px-2 py-1 text-left">Tipo</th>
                          <th className="px-2 py-1 text-left">Concepto</th>
                          <th className="px-2 py-1 text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.movements.map((m) => (
                          <tr key={m.id} className="border-t">
                            <td className="px-2 py-1 text-[11px]">
                              {new Date(m.createdAt).toLocaleString()}
                            </td>
                            <td className="px-2 py-1">
                              {m.type === "IN" ? "Ingreso" : "Egreso"}
                            </td>
                            <td className="px-2 py-1">{m.reason}</td>
                            <td className="px-2 py-1 text-right">
                              {formatCurrency(m.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Monto contado en caja (efectivo real)
                  </p>
                  <Input
                    type="number"
                    value={declaredStr}
                    onChange={(e) => setDeclaredStr(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Diferencia
                  </p>
                  <p
                    className={cnDiff(diff, "font-semibold text-lg")}
                  >
                    {formatCurrency(diff)}
                  </p>
                </div>
                <div className="flex md:justify-end mt-2 md:mt-0">
                  <Button
                    onClick={handleClose}
                    disabled={closing}
                    className="w-full md:w-auto"
                  >
                    {closing ? "Cerrando..." : "Cerrar caja"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// pequeño helper para colorear diferencias
function cnDiff(diff: number, base: string) {
  if (diff === 0) return base + " text-emerald-600";
  if (diff > 0) return base + " text-orange-600";
  return base + " text-red-600";
}
