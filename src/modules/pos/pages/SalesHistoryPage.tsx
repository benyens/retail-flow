import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api";
import { useApp } from "@/state/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/utils/format";
import { toast } from "sonner";

import type {
  Branch,
  SalesDocument,
  Customer,
  DocumentType,
  DocumentStatus,
} from "@/types";
import { CreditNoteDialog } from "../components/CreditNoteDialog";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface SaleRow {
  doc: SalesDocument;
  customer?: Customer;
}

interface SalesHistoryPageProps {
    mode?: 'sales' | 'returns';
}

export default function SalesHistoryPage({ mode = "sales" }: SalesHistoryPageProps) {
  const { selectedCashRegister } = useApp();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const [sales, setSales] = useState<SaleRow[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [searchFolio, setSearchFolio] = useState("");
  const [searchRut, setSearchRut] = useState("");

  const [loading, setLoading] = useState(false);

  const [creditNoteSaleId, setCreditNoteSaleId] = useState<string | null>(null);

  // Estado para ANULACIÓN
  const [voidSale, setVoidSale] = useState<SalesDocument | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidLoading, setVoidLoading] = useState(false);

  const loadData = async (branchId: string) => {
    try {
      setLoading(true);
      const [docs, cs] = await Promise.all([
        apiClient.getSales(branchId),
        apiClient.getCustomers(),
      ]);
      setCustomers(cs);

      const customerMap = new Map<string, Customer>();
      cs.forEach((c) => customerMap.set(c.id, c));

      setSales(
        docs.map((d) => ({
          doc: d,
          customer: d.customerId ? customerMap.get(d.customerId) : undefined,
        }))
      );
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar las ventas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const bs = await apiClient.getBranches();
      setBranches(bs);
      const initialId =
        selectedCashRegister?.branchId ?? (bs.length ? bs[0].id : null);
      setSelectedBranchId(initialId);
      if (initialId) {
        await loadData(initialId);
      }
    })();
  }, [selectedCashRegister?.branchId]);

  const isReturnOrVoid = (doc: SalesDocument) =>
    doc.docType === "CREDIT_NOTE" || doc.status === "VOID_INTERNAL";

  const filteredSales = useMemo(() => {
    let rows = sales;

    // 1) Filtrado base según modo
    if (mode === "returns") {
        // Solo devoluciones / anulaciones
        rows = rows.filter((r) => isReturnOrVoid(r.doc));
    } else {
        // Historial normal: excluir anulados y notas de crédito
        rows = rows.filter((r) => !isReturnOrVoid(r.doc));
    }

    // 2) Filtros por folio y RUT
    if (searchFolio.trim()) {
        const folioQ = searchFolio.trim().toLowerCase();
        rows = rows.filter((r) =>
        (r.doc.folio ?? "").toLowerCase().includes(folioQ)
        );
    }

    if (searchRut.trim()) {
        const rutQ = searchRut.trim().toLowerCase();
        rows = rows.filter((r) =>
        (r.customer?.rut ?? "").toLowerCase().includes(rutQ)
        );
    }

    // 3) Orden por fecha desc
    return [...rows].sort((a, b) =>
        a.doc.createdAt < b.doc.createdAt ? 1 : -1
    );
    }, [sales, searchFolio, searchRut, mode]);


  const handleBranchChange = async (id: string) => {
    setSelectedBranchId(id);
    await loadData(id);
  };

  const handleOpenVoid = (doc: SalesDocument) => {
    if (doc.status !== "ISSUED") {
      toast.error("Solo se pueden anular documentos emitidos");
      return;
    }
    setVoidSale(doc);
    setVoidReason("");
  };

  const handleConfirmVoid = async () => {
    if (!voidSale) return;
    if (!voidReason.trim()) {
      toast.error("Debe ingresar un motivo de anulación");
      return;
    }

    try {
      setVoidLoading(true);
      await apiClient.voidSaleInternal(voidSale.id, voidReason.trim());
      toast.success("Documento anulado");
      const branchId = selectedBranchId;
      setVoidSale(null);
      setVoidReason("");
      if (branchId) await loadData(branchId);
    } catch (e) {
      console.error(e);
      toast.error("Error al anular el documento");
    } finally {
      setVoidLoading(false);
    }
  };

  const handleCreditNoteCreated = async () => {
    setCreditNoteSaleId(null);
    if (selectedBranchId) await loadData(selectedBranchId);
  };

  const typeLabel = (t: DocumentType) =>
    t === "BOLETA" ? "Boleta" : t === "FACTURA" ? "Factura" : "NC";

  const statusLabel = (s: DocumentStatus) => {
    switch (s) {
      case "PENDING_ISSUE":
        return "Pendiente";
      case "ISSUED":
        return "Emitido";
      case "REJECTED":
        return "Rechazado";
      case "VOID_INTERNAL":
        return "Anulado interno";
      default:
        return s;
    }
  };

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle>
                {mode === "sales" ? "Historial de ventas" : "Historial de devoluciones"}
            </CardTitle>
             <p className="text-xs text-muted-foreground">
                {mode === "returns"
                    ? "Muestra notas de crédito y documentos anulados."
                    : "Muestra los documentos de venta emitidos."}
                </p>
          </div>

          <div className="flex flex-wrap gap-2 items-center text-xs">
            <span>Sucursal:</span>
            <select
              className="border rounded px-2 py-1 text-xs"
              value={selectedBranchId ?? ""}
              onChange={(e) => handleBranchChange(e.target.value)}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <Input
              value={searchFolio}
              onChange={(e) => setSearchFolio(e.target.value)}
              placeholder="Buscar por folio..."
              className="h-7 text-[11px] w-40"
            />
            <Input
              value={searchRut}
              onChange={(e) => setSearchRut(e.target.value)}
              placeholder="Buscar por RUT cliente..."
              className="h-7 text-[11px] w-48"
            />
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando ventas...</p>
          ) : filteredSales.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay ventas registradas para los filtros seleccionados.
            </p>
          ) : (
            <div className="overflow-auto max-h-[70vh]">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-2 py-1 text-left">Fecha</th>
                    <th className="px-2 py-1 text-left">Doc</th>
                    <th className="px-2 py-1 text-left">Folio</th>
                    <th className="px-2 py-1 text-left">Cliente</th>
                    <th className="px-2 py-1 text-left">RUT</th>
                    <th className="px-2 py-1 text-right">Total</th>
                    <th className="px-2 py-1 text-left">Estado</th>
                    <th className="px-2 py-1 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map(({ doc, customer }) => (
                    <tr key={doc.id} className="border-t">
                      <td className="px-2 py-1 text-left text-[11px]">
                        {new Date(doc.createdAt).toLocaleString()}
                      </td>
                      <td className="px-2 py-1">{typeLabel(doc.docType)}</td>
                      <td className="px-2 py-1">{doc.folio ?? "-"}</td>
                      <td className="px-2 py-1">
                        {customer ? customer.name : "-"}
                      </td>
                      <td className="px-2 py-1">
                        {customer ? customer.rut : "-"}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {formatCurrency(doc.total)}
                      </td>
                      <td className="px-2 py-1">{statusLabel(doc.status)}</td>
                      <td className="px-2 py-1 text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[10px]"
                            onClick={() => setCreditNoteSaleId(doc.id)}
                            disabled={
                              doc.status !== "ISSUED" ||
                              doc.docType === "CREDIT_NOTE"
                            }
                          >
                            Nota cr.
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[10px]"
                            onClick={() => handleOpenVoid(doc)}
                            disabled={doc.status !== "ISSUED"}
                          >
                            Anular
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nota de crédito */}
      <CreditNoteDialog
        open={!!creditNoteSaleId}
        saleId={creditNoteSaleId}
        onClose={() => setCreditNoteSaleId(null)}
        onCreated={handleCreditNoteCreated}
      />

      {/* Diálogo de anulación */}
      <Dialog
        open={!!voidSale}
        onOpenChange={(open) => {
          if (!open) {
            setVoidSale(null);
            setVoidReason("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Anular documento</DialogTitle>
          </DialogHeader>

          {voidSale && (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                Se anulará el documento{" "}
                <span className="font-medium">
                  {typeLabel(voidSale.docType)}{" "}
                  {voidSale.folio ? `#${voidSale.folio}` : ""}
                </span>{" "}
                por un total de{" "}
                <span className="font-medium">
                  {formatCurrency(voidSale.total)}
                </span>
                .
              </p>

              <div className="space-y-1">
                <Label>Motivo de anulación</Label>
                <textarea
                  className="w-full border rounded px-2 py-1 text-sm min-h-[70px]"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Ej: Error en el monto, producto equivocado, cliente se arrepiente, etc."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setVoidSale(null);
                setVoidReason("");
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmVoid} disabled={voidLoading || !voidSale}>
              {voidLoading ? "Anulando..." : "Confirmar anulación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
