import { useEffect, useState } from "react";
import { useApp } from "@/state/AppContext";
import { apiClient } from "@/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/utils/format";
import { toast } from "sonner";

import type { CashMovement, Employee } from "@/types";
import { CashMovementDialog } from "@/modules/cash/components/CashMovementDialog";

const CONCEPT_LABELS: Record<CashMovement["concept"], string> = {
  WITHDRAW_TO_SAFE: "Retiro a bóveda / caja fuerte",
  PETTY_CASH_EXPENSE: "Gasto de caja chica",
  ADVANCE_EMPLOYEE: "Adelanto a trabajador",
  BONUS_AGUINALDO: "Bono / aguinaldo",
  REFUND_CUSTOMER: "Devolución a cliente",
  OTHER: "Otro",
};

export default function CashMovementsPage() {
  const { currentSession, selectedCashRegister } = useApp();
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const canUsePage = !!currentSession && !!selectedCashRegister;

  const loadData = async () => {
    if (!currentSession || !selectedCashRegister) return;
    try {
      setLoading(true);
      const [movs, emps] = await Promise.all([
        apiClient.getSessionMovements(currentSession.id),
        apiClient.getEmployees(selectedCashRegister.branchId),
      ]);
      setMovements(movs);
      setEmployees(emps);
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar los movimientos de caja");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canUsePage) {
      loadData();
    }
  }, [currentSession?.id, selectedCashRegister?.branchId]);

  if (!canUsePage) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-2">Movimientos de caja</h1>
        <p className="text-muted-foreground text-sm">
          Debe seleccionar una sucursal y tener una caja abierta para ver esta
          información.
        </p>
      </div>
    );
  }

  const totalIn = movements
    .filter((m) => m.type === "IN")
    .reduce((acc, m) => acc + m.amount, 0);
  const totalOut = movements
    .filter((m) => m.type === "OUT")
    .reduce((acc, m) => acc + m.amount, 0);

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle>Movimientos de caja</CardTitle>
            <p className="text-xs text-muted-foreground">
              Sesión actual: {currentSession?.id}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-muted-foreground mr-1">Ingresos:</span>
              <span className="font-semibold">
                {formatCurrency(totalIn)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground mr-1">Egresos:</span>
              <span className="font-semibold">
                {formatCurrency(totalOut)}
              </span>
            </div>
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="ml-2"
            >
              Nuevo movimiento
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">
              Cargando movimientos...
            </p>
          ) : movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay movimientos registrados en esta sesión.
            </p>
          ) : (
            <div className="overflow-auto max-h-[70vh]">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-2 py-1 text-left">Fecha</th>
                    <th className="px-2 py-1 text-left">Tipo</th>
                    <th className="px-2 py-1 text-left">Concepto</th>
                    <th className="px-2 py-1 text-left">Trabajador</th>
                    <th className="px-2 py-1 text-left">Motivo</th>
                    <th className="px-2 py-1 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {movements
                    .slice()
                    .sort((a, b) =>
                      a.createdAt < b.createdAt ? 1 : -1
                    )
                    .map((m) => {
                      const employee =
                        m.employeeId &&
                        employees.find((e) => e.id === m.employeeId);
                      return (
                        <tr key={m.id} className="border-t">
                          <td className="px-2 py-1 text-[11px]">
                            {new Date(m.createdAt).toLocaleString()}
                          </td>
                          <td className="px-2 py-1">
                            {m.type === "IN" ? "Ingreso" : "Egreso"}
                          </td>
                          <td className="px-2 py-1">
                            {CONCEPT_LABELS[m.concept] ?? m.concept}
                          </td>
                          <td className="px-2 py-1">
                            {employee ? `${employee.name} (${employee.rut})` : "-"}
                          </td>
                          <td className="px-2 py-1">{m.reason}</td>
                          <td className="px-2 py-1 text-right">
                            {formatCurrency(m.amount)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CashMovementDialog
        open={dialogOpen}
        sessionId={currentSession!.id}
        branchId={selectedCashRegister!.branchId}
        employees={employees}
        onCancel={() => setDialogOpen(false)}
        onCreated={() => {
          setDialogOpen(false);
          loadData();
        }}
      />
    </div>
  );
}
