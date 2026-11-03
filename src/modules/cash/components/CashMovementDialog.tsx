import { useState } from "react";
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
import type { CashMovementType, CashMovementConcept, Employee } from "@/types";
import { apiClient } from "@/api";
import { toast } from "sonner";

interface CashMovementDialogProps {
  open: boolean;
  sessionId: string;
  branchId: string;
  employees: Employee[];
  onCancel: () => void;
  onCreated: () => void;
}

const CONCEPT_LABELS: Record<CashMovementConcept, string> = {
  WITHDRAW_TO_SAFE: "Retiro a bóveda / caja fuerte",
  PETTY_CASH_EXPENSE: "Gasto de caja chica",
  ADVANCE_EMPLOYEE: "Adelanto a trabajador",
  BONUS_AGUINALDO: "Bono / aguinaldo",
  REFUND_CUSTOMER: "Devolución a cliente",
  OTHER: "Otro",
};

export function CashMovementDialog({
  open,
  sessionId,
  branchId,
  employees,
  onCancel,
  onCreated,
}: CashMovementDialogProps) {
  const [type, setType] = useState<CashMovementType>("OUT");
  const [concept, setConcept] = useState<CashMovementConcept>("ADVANCE_EMPLOYEE");
  const [amountStr, setAmountStr] = useState("");
  const [reason, setReason] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [saving, setSaving] = useState(false);

  const amount = Number(amountStr) || 0;
  const needsEmployee =
    concept === "ADVANCE_EMPLOYEE" || concept === "BONUS_AGUINALDO";

  const handleSave = async () => {
    if (amount <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }
    if (!reason.trim()) {
      toast.error("Debe ingresar un motivo");
      return;
    }
    if (needsEmployee && !employeeId) {
      toast.error("Debe seleccionar el trabajador");
      return;
    }

    try {
      setSaving(true);
      await apiClient.createCashMovement(
        sessionId,
        type,
        concept,
        amount,
        reason.trim(),
        needsEmployee ? employeeId : undefined
      );
      toast.success("Movimiento de caja registrado");
      onCreated();
      // limpiar para el próximo uso
      setAmountStr("");
      setReason("");
      setEmployeeId("");
      setType("OUT");
      setConcept("ADVANCE_EMPLOYEE");
    } catch (e) {
      console.error(e);
      toast.error("Error al registrar el movimiento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Movimiento de caja</DialogTitle>
        </DialogHeader>

        <div className="mt-3 space-y-4 text-sm">
          {/* Tipo IN/OUT */}
          <div className="space-y-1">
            <Label>Tipo</Label>
            <div className="inline-flex rounded border overflow-hidden">
              <button
                type="button"
                className={`px-3 py-1 text-xs ${
                  type === "IN"
                    ? "bg-emerald-600 text-white"
                    : "bg-background text-emerald-700"
                }`}
                onClick={() => setType("IN")}
              >
                Ingreso
              </button>
              <button
                type="button"
                className={`px-3 py-1 text-xs ${
                  type === "OUT"
                    ? "bg-red-600 text-white"
                    : "bg-background text-red-700"
                }`}
                onClick={() => setType("OUT")}
              >
                Egreso
              </button>
            </div>
          </div>

          {/* Concepto */}
          <div className="space-y-1">
            <Label>Concepto</Label>
            <select
              className="border rounded px-2 py-1 text-xs w-full"
              value={concept}
              onChange={(e) => setConcept(e.target.value as CashMovementConcept)}
            >
              {(Object.keys(CONCEPT_LABELS) as CashMovementConcept[]).map((c) => (
                <option key={c} value={c}>
                  {CONCEPT_LABELS[c]}
                </option>
              ))}
            </select>
          </div>

          {/* Monto */}
          <div className="space-y-1">
            <Label>Monto</Label>
            <Input
              type="number"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0"
            />
          </div>

          {/* Trabajador (cuando aplica) */}
          {needsEmployee && (
            <div className="space-y-1">
              <Label>Trabajador</Label>
              <select
                className="border rounded px-2 py-1 text-xs w-full"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                <option value="">Seleccione trabajador...</option>
                {employees
                  .filter((e) => e.branchId === branchId)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.rut})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Motivo */}
          <div className="space-y-1">
            <Label>Motivo</Label>
            <textarea
              className="w-full border rounded px-2 py-1 text-sm min-h-[60px]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Detalle del movimiento (ej: adelanto quincena, retiro a bóveda...)"
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
