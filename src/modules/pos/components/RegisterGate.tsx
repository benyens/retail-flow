import { useQuery } from "@tanstack/react-query";
import { Monitor, Lock, CircleCheck } from "lucide-react";
import { apiClient } from "@/api";
import { useApp } from "@/state/AppContext";
import { formatCurrency, formatDateTime } from "@/utils/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Admin y encargado navegan sin caja; al entrar a Vender, Movimientos o Cierre se pide
 * elegir una. Muestra qué cajas están abiertas y por quién. Una caja abierta por otra
 * persona se puede revisar y cerrar, pero no vender en ella (el servidor lo impide).
 */
export default function RegisterGate({ children }: { children: React.ReactNode }) {
  const { selectedBranch, selectedCashRegister, setSelectedCashRegister, cashRegisters, auth } = useApp();
  const open = useQuery({
    queryKey: ["open-sessions", selectedBranch?.id],
    queryFn: () => apiClient.getOpenSessions(selectedBranch!.id),
    enabled: !!selectedBranch && !selectedCashRegister,
  });

  if (selectedCashRegister) return <>{children}</>;

  const active = cashRegisters.filter((r) => r.isActive);
  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Monitor className="h-5 w-5" aria-hidden="true" />Elige una caja</CardTitle>
          <CardDescription>Para vender, registrar movimientos o cerrar necesitas una caja de {selectedBranch?.name}.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {open.isPending && <p role="status" className="text-sm text-muted-foreground">Cargando cajas…</p>}
          {!open.isPending && active.length === 0 && <p className="text-sm text-muted-foreground">Esta sucursal no tiene cajas activas.</p>}
          {!open.isPending && active.map((r) => {
            const session = open.data?.find((s) => s.cashRegisterId === r.id);
            const mine = session?.userId === auth.user?.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedCashRegister(r)}
                className="w-full text-left rounded-lg border p-3 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{r.name}</p>
                  {!session && <p className="text-sm text-muted-foreground">Cerrada · puedes abrirla</p>}
                  {session && mine && <p className="text-sm text-success flex items-center gap-1"><CircleCheck className="h-4 w-4" aria-hidden="true" />Abierta por ti</p>}
                  {session && !mine && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Abierta por {session.userName} desde {formatDateTime(session.openedAt)} · solo revisar o cerrar
                    </p>
                  )}
                </div>
                {session && (
                  <div className="text-right shrink-0 tabular-nums">
                    <p className="font-semibold">{formatCurrency(session.salesNet)}</p>
                    <p className="text-xs text-muted-foreground">{session.salesCount} ventas</p>
                  </div>
                )}
              </button>
            );
          })}
          <Button variant="link" className="px-0" onClick={() => open.refetch()}>Actualizar</Button>
        </CardContent>
      </Card>
    </div>
  );
}
