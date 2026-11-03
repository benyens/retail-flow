

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
import type { Customer } from "@/types";
import { toast } from "sonner";

interface CustomerEditDialogProps {
  open: boolean;
  customer: Customer;
  onCancel: () => void;
  onUpdated: (customer: Customer) => void;
}

export function CustomerEditDialog({
  open,
  customer,
  onCancel,
  onUpdated,
}: CustomerEditDialogProps) {
  const [rut, setRut] = useState(customer.rut);
  const [name, setName] = useState(customer.name);
  const [email, setEmail] = useState(customer.email ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [address, setAddress] = useState(customer.address ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && customer) {
      setRut(customer.rut);
      setName(customer.name);
      setEmail(customer.email ?? "");
      setPhone(customer.phone ?? "");
      setAddress(customer.address ?? "");
    }
  }, [open, customer]);

  const handleSave = async () => {
    if (!rut || !name.trim()) {
      toast.error("Debe ingresar al menos RUT y nombre/razón social");
      return;
    }

    try {
      setSaving(true);
      const updated = await apiClient.updateCustomer(customer.id, {
        rut,
        name: name.trim(),
        email: email || undefined,
        phone: phone || undefined,
        address: address || undefined,
      });
      toast.success("Cliente actualizado");
      onUpdated(updated);
    } catch (e) {
      console.error(e);
      toast.error("Error al actualizar cliente");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
        </DialogHeader>

        <div className="mt-3 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-auto">
            <div className="space-y-2">
              <Label>RUT</Label>
              <Input
                value={rut}
                onChange={(e) => setRut(e.target.value)}
                placeholder="12345678-9"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Razón Social / Nombre</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Comercial XYZ Ltda. / Juan Pérez"
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="correo@cliente.cl"
              />
            </div>

            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+569..."
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Dirección</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Calle, número, comuna"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
