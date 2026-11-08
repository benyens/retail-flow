import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building, Building2, Monitor, Pencil, Plus, Tags } from "lucide-react";
import { apiClient } from "@/api";
import { useApp } from "@/state/AppContext";
import type { BranchWithRegisters, CashRegister } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type BranchForm = { id?: string; name: string; address: string; isActive: boolean; priceListId: string | null };
type ListForm = { id?: string; name: string; copyFromId: string };
type RegisterForm = { id?: string; branchId: string; branchName: string; name: string; code: string; isActive: boolean };

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** Datos de la empresa (salen en el comprobante), sucursales y cajas. Solo ADMIN. */
export default function OrganizationPage() {
  const { reloadBranches } = useApp();
  const qc = useQueryClient();
  const company = useQuery({ queryKey: ["company"], queryFn: () => apiClient.getCompany() });
  const branches = useQuery({ queryKey: ["all-branches"], queryFn: () => apiClient.listAllBranches() });
  const priceLists = useQuery({ queryKey: ["price-lists"], queryFn: () => apiClient.getPriceLists() });
  const saleLists = (priceLists.data ?? []).filter((l) => l.type === "NORMAL");
  const defaultList = saleLists.find((l) => l.isDefault) ?? saleLists[0];
  const listName = (id: string | null | undefined) => (id ? saleLists.find((l) => l.id === id)?.name : undefined) ?? defaultList?.name ?? "—";
  const [listForm, setListForm] = useState<ListForm | null>(null);
  const [companyForm, setCompanyForm] = useState({ name: "", rut: "", address: "" });
  const [savingCompany, setSavingCompany] = useState(false);
  const [branchForm, setBranchForm] = useState<BranchForm | null>(null);
  const [registerForm, setRegisterForm] = useState<RegisterForm | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (company.data) setCompanyForm({ name: company.data.name, rut: company.data.rut, address: company.data.address });
  }, [company.data]);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["all-branches"] });
    await reloadBranches().catch(() => undefined);
  };

  async function saveCompany(e: React.FormEvent) {
    e.preventDefault();
    setSavingCompany(true);
    try {
      await apiClient.updateCompany({ name: companyForm.name.trim(), rut: companyForm.rut.trim(), address: companyForm.address.trim() });
      await qc.invalidateQueries({ queryKey: ["company"] });
      toast.success("Datos de la empresa guardados");
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo guardar"));
    } finally {
      setSavingCompany(false);
    }
  }

  async function saveBranch(e: React.FormEvent) {
    e.preventDefault();
    if (!branchForm) return;
    setSaving(true);
    try {
      const data = { name: branchForm.name.trim(), address: branchForm.address.trim() };
      if (branchForm.id) {
        await apiClient.updateBranch(branchForm.id, { ...data, isActive: branchForm.isActive, priceListId: branchForm.priceListId });
        toast.success("Sucursal actualizada");
      } else {
        const created = await apiClient.createBranch(data);
        if (branchForm.priceListId) await apiClient.updateBranch(created.id, { priceListId: branchForm.priceListId });
        toast.success(`Sucursal "${data.name}" creada con su Caja 1. Asigna encargados y cajeros en Usuarios.`);
      }
      setBranchForm(null);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo guardar la sucursal"));
    } finally {
      setSaving(false);
    }
  }

  async function saveList(e: React.FormEvent) {
    e.preventDefault();
    if (!listForm) return;
    setSaving(true);
    try {
      if (listForm.id) await apiClient.renamePriceList(listForm.id, listForm.name.trim());
      else await apiClient.createPriceList({ name: listForm.name.trim(), copyFromId: listForm.copyFromId || undefined });
      toast.success(listForm.id ? "Lista renombrada" : `Lista "${listForm.name.trim()}" creada. Asígnala a un local y ajusta sus precios en Precios.`);
      setListForm(null);
      await qc.invalidateQueries({ queryKey: ["price-lists"] });
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo guardar la lista"));
    } finally {
      setSaving(false);
    }
  }

  async function saveRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!registerForm) return;
    setSaving(true);
    try {
      const data = { name: registerForm.name.trim(), code: registerForm.code.trim() };
      if (registerForm.id) await apiClient.updateCashRegister(registerForm.id, { ...data, isActive: registerForm.isActive });
      else await apiClient.createCashRegister(registerForm.branchId, data);
      toast.success(registerForm.id ? "Caja actualizada" : "Caja creada");
      setRegisterForm(null);
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo guardar la caja"));
    } finally {
      setSaving(false);
    }
  }

  const newRegister = (b: BranchWithRegisters) => setRegisterForm({
    branchId: b.id, branchName: b.name, name: `Caja ${b.cashRegisters.length + 1}`, code: `C${b.cashRegisters.length + 1}`, isActive: true,
  });
  const editRegister = (b: BranchWithRegisters, r: CashRegister) =>
    setRegisterForm({ id: r.id, branchId: b.id, branchName: b.name, name: r.name, code: r.code, isActive: r.isActive });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Building className="h-6 w-6" aria-hidden="true" />Empresa y locales</h1>
        <p className="text-muted-foreground">Datos del comprobante, sucursales y cajas.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Empresa</CardTitle>
          <CardDescription>Aparecen en el encabezado de cada comprobante.</CardDescription>
        </CardHeader>
        <CardContent>
          {company.isPending ? <p role="status" className="text-sm text-muted-foreground">Cargando…</p> : (
            <form onSubmit={saveCompany} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="co-name">Razón social o nombre</Label>
                <Input id="co-name" required maxLength={120} value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="co-rut">RUT</Label>
                <Input id="co-rut" required maxLength={20} spellCheck={false} placeholder="76.123.456-7" value={companyForm.rut} onChange={(e) => setCompanyForm({ ...companyForm, rut: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="co-address">Dirección</Label>
                <Input id="co-address" required maxLength={200} autoComplete="street-address" value={companyForm.address} onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={savingCompany}>{savingCompany ? "Guardando…" : "Guardar empresa"}</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Tags className="h-4 w-4" aria-hidden="true" />Listas de precios</CardTitle>
            <CardDescription className="mt-1">Cada local vende con una lista. Un producto aparece en un local solo si tiene precio en su lista; los precios se editan en Precios.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setListForm({ name: "", copyFromId: "" })}><Plus className="h-4 w-4 mr-1" aria-hidden="true" />Nueva lista</Button>
        </CardHeader>
        <CardContent>
          <ul className="divide-y rounded-md border">
            {saleLists.map((l) => {
              const used = (branches.data ?? []).filter((b) => (b.priceListId ?? defaultList?.id) === l.id && b.isActive).map((b) => b.name);
              return (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium flex items-center gap-2">{l.name}{l.id === defaultList?.id && <Badge variant="secondary">Predeterminada</Badge>}</p>
                    <p className="text-xs text-muted-foreground">{used.length ? `Locales: ${used.join(", ")}` : "Ningún local la usa"}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setListForm({ id: l.id, name: l.name, copyFromId: "" })} aria-label={`Renombrar ${l.name}`}>Renombrar</Button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Building2 className="h-5 w-5" aria-hidden="true" />Sucursales</h2>
        <Button onClick={() => setBranchForm({ name: "", address: "", isActive: true, priceListId: null })}><Plus className="h-4 w-4 mr-1" aria-hidden="true" />Nueva sucursal</Button>
      </div>

      {branches.isPending && <p role="status" className="text-sm text-muted-foreground">Cargando…</p>}
      {branches.isError && <p role="alert" className="text-sm text-destructive">{branches.error.message}</p>}
      <div className="space-y-3">
        {branches.data?.map((b) => (
          <Card key={b.id} className={b.isActive ? "" : "opacity-70"}>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold flex items-center gap-2">{b.name}{!b.isActive && <Badge variant="secondary">Inactiva</Badge>}</p>
                  <p className="text-sm text-muted-foreground break-words">{b.address}</p>
                  <p className="text-sm mt-0.5"><span className="text-muted-foreground">Lista de precios:</span> {listName(b.priceListId)}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setBranchForm({ id: b.id, name: b.name, address: b.address, isActive: b.isActive, priceListId: b.priceListId ?? null })}>
                  <Pencil className="h-4 w-4 mr-1" aria-hidden="true" />Editar
                </Button>
              </div>
              <ul className="divide-y rounded-md border">
                {b.cashRegisters.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate">{r.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{r.code}</span>
                      {!r.isActive && <Badge variant="secondary">Inactiva</Badge>}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => editRegister(b, r)} aria-label={`Editar ${r.name} de ${b.name}`}>Editar</Button>
                  </li>
                ))}
                {b.cashRegisters.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Sin cajas.</li>}
              </ul>
              <Button variant="ghost" size="sm" onClick={() => newRegister(b)}><Plus className="h-4 w-4 mr-1" aria-hidden="true" />Agregar caja</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!branchForm} onOpenChange={(o) => !o && setBranchForm(null)}>
        <DialogContent className="sm:max-w-md">
          {branchForm && (
            <form onSubmit={saveBranch} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{branchForm.id ? "Editar sucursal" : "Nueva sucursal"}</DialogTitle>
                <DialogDescription>{branchForm.id ? "Una sucursal inactiva deja de aparecer para vender y en los selectores." : "Se crea con una caja (Caja 1) y queda asignada a los administradores."}</DialogDescription>
              </DialogHeader>
              <div className="space-y-1">
                <Label htmlFor="br-name">Nombre</Label>
                <Input id="br-name" required maxLength={80} placeholder="Local Centro" value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="br-address">Dirección</Label>
                <Input id="br-address" required maxLength={200} autoComplete="street-address" value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="br-list">Lista de precios</Label>
                <select id="br-list" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={branchForm.priceListId ?? ""} onChange={(e) => setBranchForm({ ...branchForm, priceListId: e.target.value || null })}>
                  <option value="">Predeterminada ({defaultList?.name ?? "—"})</option>
                  {saleLists.filter((l) => l.id !== defaultList?.id).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">Define qué productos se ven y a qué precio se venden en este local.</p>
              </div>
              {branchForm.id && (
                <div className="flex items-center gap-2">
                  <Switch id="br-active" checked={branchForm.isActive} onCheckedChange={(v) => setBranchForm({ ...branchForm, isActive: v })} />
                  <Label htmlFor="br-active">Activa</Label>
                </div>
              )}
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setBranchForm(null)} disabled={saving}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!listForm} onOpenChange={(o) => !o && setListForm(null)}>
        <DialogContent className="sm:max-w-md">
          {listForm && (
            <form onSubmit={saveList} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{listForm.id ? "Renombrar lista" : "Nueva lista de precios"}</DialogTitle>
                <DialogDescription>{listForm.id ? "El nombre solo se usa para identificarla." : "Por ejemplo \"Tecnología\" o \"Minimarket\"."}</DialogDescription>
              </DialogHeader>
              <div className="space-y-1">
                <Label htmlFor="pl-name">Nombre</Label>
                <Input id="pl-name" required maxLength={60} value={listForm.name} onChange={(e) => setListForm({ ...listForm, name: e.target.value })} />
              </div>
              {!listForm.id && (
                <div className="space-y-1">
                  <Label htmlFor="pl-copy">Precios iniciales</Label>
                  <select id="pl-copy" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={listForm.copyFromId} onChange={(e) => setListForm({ ...listForm, copyFromId: e.target.value })}>
                    <option value="">Vacía (agregar productos de a uno en Precios)</option>
                    {saleLists.map((l) => <option key={l.id} value={l.id}>Copiar todos los precios de "{l.name}"</option>)}
                  </select>
                </div>
              )}
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setListForm(null)} disabled={saving}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!registerForm} onOpenChange={(o) => !o && setRegisterForm(null)}>
        <DialogContent className="sm:max-w-md">
          {registerForm && (
            <form onSubmit={saveRegister} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{registerForm.id ? "Editar caja" : "Nueva caja"}</DialogTitle>
                <DialogDescription>{registerForm.branchName}</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="rg-name">Nombre</Label>
                  <Input id="rg-name" required maxLength={60} value={registerForm.name} onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rg-code">Código</Label>
                  <Input id="rg-code" required maxLength={20} spellCheck={false} value={registerForm.code} onChange={(e) => setRegisterForm({ ...registerForm, code: e.target.value })} />
                </div>
              </div>
              {registerForm.id && (
                <div className="flex items-center gap-2">
                  <Switch id="rg-active" checked={registerForm.isActive} onCheckedChange={(v) => setRegisterForm({ ...registerForm, isActive: v })} />
                  <Label htmlFor="rg-active">Activa</Label>
                </div>
              )}
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setRegisterForm(null)} disabled={saving}>Cancelar</Button>
                <Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
