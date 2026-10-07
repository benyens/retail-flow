import { useEffect, useState } from "react";
import { apiClient } from "@/api";
import { useApp } from "@/state/AppContext";
import { Employee } from "@/types";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Edit2 } from "lucide-react";

const emptyForm = { name: "", rut: "", position: "", isActive: true };

export default function EmployeesPage() {
  const { selectedBranch } = useApp();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function load() {
    if (!selectedBranch) return;
    setIsLoading(true);
    try { setEmployees(await apiClient.getEmployees(selectedBranch.id)); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Error al cargar empleados"); }
    finally { setIsLoading(false); }
  }

  useEffect(() => { load(); }, [selectedBranch]); // eslint-disable-line react-hooks/exhaustive-deps

  function openCreate() { setEditing(null); setForm(emptyForm); setDialogOpen(true); }
  function openEdit(employee: Employee) {
    setEditing(employee);
    setForm({ name: employee.name, rut: employee.rut, position: employee.position, isActive: employee.isActive });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!selectedBranch) return;
    if (!form.name.trim() || !form.rut.trim() || !form.position.trim()) { toast.error("Nombre, RUT y cargo son obligatorios"); return; }
    setIsSubmitting(true);
    try {
      if (editing) { await apiClient.updateEmployee(editing.id, form); toast.success("Empleado actualizado"); }
      else { await apiClient.createEmployee({ branchId: selectedBranch.id, ...form }); toast.success("Empleado creado"); }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar el empleado");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!selectedBranch) return <div className="p-8 text-muted-foreground">Selecciona una sucursal para ver empleados.</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" />Empleados</h1>
          <p className="text-muted-foreground">{selectedBranch.name}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Nuevo empleado</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar empleado" : "Nuevo empleado"}</DialogTitle>
              <DialogDescription>Los anticipos y bonos se registran desde Movimientos de Caja, no acá.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1"><Label htmlFor="emp-name">Nombre</Label><Input id="emp-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="emp-rut">RUT</Label><Input id="emp-rut" value={form.rut} onChange={(e) => setForm({ ...form, rut: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="emp-position">Cargo</Label><Input id="emp-position" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="ej: Vendedor, Cajero, Bodeguero…" /></div>
              <div className="flex items-center gap-2"><Switch id="emp-active" checked={form.isActive} onCheckedChange={(checked) => setForm({ ...form, isActive: checked })} /><Label htmlFor="emp-active">Activo</Label></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? "Guardando…" : "Guardar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>RUT</TableHead><TableHead>Cargo</TableHead><TableHead>Estado</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Cargando…</TableCell></TableRow>}
              {!isLoading && employees.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sin empleados registrados.</TableCell></TableRow>}
              {employees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.name}</TableCell>
                  <TableCell className="text-muted-foreground">{emp.rut}</TableCell>
                  <TableCell>{emp.position}</TableCell>
                  <TableCell><Badge variant={emp.isActive ? "default" : "secondary"}>{emp.isActive ? "Activo" : "Inactivo"}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="sm" onClick={() => openEdit(emp)}><Edit2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
