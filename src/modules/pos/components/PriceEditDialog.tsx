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

interface PriceEditDialogProps {
  open: boolean;
  lineName: string;
  currentPrice: number;
  onCancel: () => void;
  onSave: (newPrice: number) => void;
}

export function PriceEditDialog({
  open,
  lineName,
  currentPrice,
  onCancel,
  onSave,
}: PriceEditDialogProps) {
  const [priceStr, setPriceStr] = useState("");

  useEffect(() => {
    if (open) {
      setPriceStr(currentPrice.toString());
    }
  }, [open, currentPrice]);

  const price = Number(priceStr) || 0;

  const handleSave = () => {
    if (price <= 0) return;
    onSave(price);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar precio</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Línea: <span className="font-medium">{lineName}</span>
          </p>

          <div className="space-y-2">
            <Label>Nuevo precio unitario (IVA incl.)</Label>
            <Input
              type="number"
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Vista previa: <span className="font-semibold">{formatCurrency(price)}</span>
            </p>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={price <= 0}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
