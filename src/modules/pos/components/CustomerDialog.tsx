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
import { apiClient } from "@/api";
import type { Customer } from "@/types";
import { toast } from "sonner";

interface CustomerDialogProps {
  open: boolean;
  onCancel: () => void;
  onCreated: (customer: Customer) => void;
}

export function CustomerDialog({ open, onCancel, onCreated }: CustomerDialogProps) {
  const [rut, setRut] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const baseName = businessName || `${firstName} ${lastName}`.trim();
    if (!rut || !baseName) {
      toast.error("Debe ingresar al menos RUT y nombre/razón social");
      return;
    }

    try {
      setSaving(true);
      const customer = await apiClient.createCustomer({
        rut,
        name: baseName,
        email: email || undefined,
        phone: phone || undefined,
        address: address || undefined,
      });
      toast.success("Cliente creado");
      onCreated(customer);

      // si quieres que la próxima vez esté limpio:
      setRut("");
      setFirstName("");
      setLastName("");
      setBusinessName("");
      setEmail("");
      setPhone("");
      setAddress("");
    } catch (e) {
      console.error(e);
      toast.error("Error al crear cliente");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
        </DialogHeader>

        {/* contenedor con margen interno extra */}
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

            <div className="space-y-2">
              <Label>Razón Social / Nombre Fantasía</Label>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Comercial XYZ Ltda."
              />
            </div>

            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Nombre"
              />
            </div>

            <div className="space-y-2">
              <Label>Apellido</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Apellido"
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
            {saving ? "Guardando..." : "Guardar cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
