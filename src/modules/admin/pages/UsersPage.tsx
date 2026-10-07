import { useEffect, useState } from "react";
import { apiClient } from "@/api";
import { useApp } from "@/state/AppContext";
import { User, UserRole } from "@/types";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectValue, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Plus } from "lucide-react";

const ROLE_LABELS: Record<UserRole, string> = { ADMIN: "Administrador", MANAGER: "Encargado", CASHIER: "Cajero" };
const emptyForm = { email: "", name: "", rut: "", role: "CASHIER" as UserRole, password: "", isActive: true };

export default function UsersPage() {
  const { auth, branches, selectedBranch } = useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isAdmin = auth.user?.role === "ADMIN";

  async function load() {
    setIsLoading(true);
    try { setUsers(await apiClient.getUsers()); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Error al cargar usuarios"); }
    finally { setIsLoading(false); }
  }

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  function openCreate() { setForm({ ...emptyForm }); setBranchIds(selectedBranch ? [selectedBranch.id] : []); setDialogOpen(true); }
  function toggleBranch(id: string) { setBranchIds((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id])); }

  async function handleSubmit() {
    if (!form.email.trim() || !form.name.trim() || !form.rut.trim() || !form.password.trim()) { toast.error("Email, nombre, RUT y contraseña son obligatorios"); return; }
    if (form.password.length < 8) { toast.error("La contraseña debe tener al menos 8 caracteres"); return; }
    setIsSubmitting(true);
    try {
      await apiClient.createUser({ ...form, branchIds });
      toast.success("Usuario creado");
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear el usuario");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleActive(user: User) {
    try { await apiClient.updateUser(user.id, { isActive: !user.isActive }); await load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Error al actualizar el usuario"); }
  }

  if (!isAdmin) return <div className="p-8 text-muted-foreground">Solo un administrador puede gestionar usuarios.</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="h-6 w-6" />Usuarios</h1>
          <p className="text-muted-foreground">Gestión de accesos al sistema</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Nuevo usuario</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo usuario</DialogTitle>
              <DialogDescription>El cambio de contraseña de un usuario existente no está disponible todavía.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1"><Label htmlFor="user-email">Email</Label><Input id="user-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="user-name">Nombre</Label><Input id="user-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="user-rut">RUT</Label><Input id="user-rut" value={form.rut} onChange={(e) => setForm({ ...form, rut: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="user-password">Contraseña</Label><Input id="user-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 8 caracteres" /></div>
              <div className="space-y-1">
                <Label>Rol</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as UserRole })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (<SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Sucursales con acceso</Label>
                <div className="flex flex-wrap gap-2">
                  {branches.map((b) => (
                    <Button key={b.id} type="button" size="sm" variant={branchIds.includes(b.id) ? "default" : "outline"} onClick={() => toggleBranch(b.id)}>{b.name}</Button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? "Creando…" : "Crear usuario"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Email</TableHead><TableHead>Rol</TableHead><TableHead>Sucursales</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Cargando…</TableCell></TableRow>}
              {!isLoading && users.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sin usuarios.</TableCell></TableRow>}
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>{ROLE_LABELS[u.role]}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{u.branchIds.map((id) => branches.find((b) => b.id === id)?.name ?? id).join(", ") || "—"}</TableCell>
                  <TableCell><Badge variant={u.isActive ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleActive(u)}>{u.isActive ? "Activo" : "Inactivo"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
