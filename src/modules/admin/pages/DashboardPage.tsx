import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api";
import { useApp } from "@/state/AppContext";
import { formatCurrency, formatDateTime } from "@/utils/format";
import type { DashboardDay } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, LayoutDashboard, TrendingDown, TrendingUp, Wallet } from "lucide-react";

const weekday = new Intl.DateTimeFormat("es-CL", { weekday: "short", timeZone: "UTC" });
const longDay = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const qty = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 });
const dayDate = (d: string) => new Date(`${d}T12:00:00Z`);

/** Barras de los últimos 7 días: una sola serie, sin leyenda; valor al pasar o enfocar. */
function WeekBars({ days }: { days: DashboardDay[] }) {
  const max = Math.max(1, ...days.map((d) => d.net));
  return (
    <figure>
      <div className="flex items-end gap-1.5 sm:gap-3 h-36" role="list" aria-label="Ventas netas por día, últimos 7 días">
        {days.map((d, i) => {
          const isToday = i === days.length - 1;
          const pct = Math.max(0, d.net) / max;
          const label = `${longDay.format(dayDate(d.day))}: ${formatCurrency(d.net)}, ${d.transactions} ventas`;
          return (
            <div key={d.day} role="listitem" className="group relative flex-1 h-full flex flex-col justify-end items-center outline-none"
              tabIndex={0} aria-label={label}>
              {/* Tooltip */}
              <div className="pointer-events-none absolute bottom-full mb-1 z-10 hidden group-hover:block group-focus:block whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md tabular-nums">
                {formatCurrency(d.net)} · {d.transactions} ventas
              </div>
              <div className="w-full max-w-10 rounded-t-[4px] bg-primary transition-opacity group-hover:opacity-80 group-focus:ring-2 group-focus:ring-ring"
                style={{ height: `${Math.max(pct * 100, d.net > 0 ? 2 : 0)}%`, opacity: isToday ? 1 : 0.55 }} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 sm:gap-3 border-t pt-1.5 mt-0.5" aria-hidden="true">
        {days.map((d, i) => (
          <span key={d.day} className={`flex-1 text-center text-xs capitalize ${i === days.length - 1 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
            {i === days.length - 1 ? "Hoy" : weekday.format(dayDate(d.day)).replace(".", "")}
          </span>
        ))}
      </div>
    </figure>
  );
}

export default function DashboardPage() {
  const { selectedBranch, auth } = useApp();
  const dash = useQuery({
    queryKey: ["dashboard", selectedBranch?.id],
    queryFn: () => apiClient.getDashboard(selectedBranch!.id),
    enabled: !!selectedBranch,
    refetchInterval: 60_000,
  });
  if (!selectedBranch) return <p className="p-8">Selecciona una sucursal.</p>;
  const d = dash.data;
  const diff = d ? d.today.net - d.yesterday.net : 0;
  const firstName = auth.user?.name?.split(" ")[0];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 max-w-6xl">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2"><LayoutDashboard className="h-6 w-6" aria-hidden="true" />Inicio</h1>
        <p className="text-muted-foreground">{firstName ? `Hola, ${firstName}. ` : ""}{selectedBranch.name} · {longDay.format(dayDate(d?.today.day ?? new Date().toISOString().slice(0, 10)))}</p>
      </header>

      {dash.isPending && <p role="status" className="text-muted-foreground">Cargando…</p>}
      {dash.isError && (
        <p role="alert" className="text-destructive">{dash.error.message} <Button variant="outline" size="sm" onClick={() => dash.refetch()}>Reintentar</Button></p>
      )}

      {d && <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 [&>*]:min-w-0">
          <Card className="col-span-2 lg:col-span-1">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Ventas de hoy</p>
              <p className="text-3xl font-bold tabular-nums mt-1">{formatCurrency(d.today.net)}</p>
              <p className={`text-sm mt-1 flex items-center gap-1 tabular-nums ${diff >= 0 ? "text-success" : "text-destructive"}`}>
                {diff >= 0 ? <TrendingUp className="h-4 w-4" aria-hidden="true" /> : <TrendingDown className="h-4 w-4" aria-hidden="true" />}
                {diff >= 0 ? "+" : "−"}{formatCurrency(Math.abs(diff))} vs. ayer
              </p>
            </CardContent>
          </Card>
          <Card><CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Ventas hoy</p>
            <p className="text-2xl font-semibold tabular-nums mt-1">{d.today.transactions}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Ticket promedio</p>
            <p className="text-2xl font-semibold tabular-nums mt-1">{formatCurrency(d.today.transactions ? d.today.net / d.today.transactions : 0)}</p>
          </CardContent></Card>
          <Card className="col-span-2 lg:col-span-1"><CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Últimos 7 días</p>
            <p className="text-2xl font-semibold tabular-nums mt-1">{formatCurrency(d.weekNet)}</p>
          </CardContent></Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 [&>*]:min-w-0">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-base">Ventas netas por día</CardTitle></CardHeader>
            <CardContent className="pt-6">
              <WeekBars days={d.last7Days} />
              <p className="text-xs text-muted-foreground mt-3">IVA incluido, descontando notas de crédito. Toca una barra para ver el monto.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" aria-hidden="true" />Cajas abiertas</CardTitle>
            </CardHeader>
            <CardContent>
              {d.openSessions.length === 0 ? <p className="text-sm text-muted-foreground">No hay cajas abiertas.</p> : (
                <ul className="space-y-3">
                  {d.openSessions.map((s) => (
                    <li key={s.id} className="flex justify-between gap-3 text-sm">
                      <div><p className="font-medium">{s.registerName}</p><p className="text-xs text-muted-foreground">Desde {formatDateTime(s.openedAt)}</p></div>
                      <div className="text-right"><p className="font-semibold tabular-nums">{formatCurrency(s.expectedCash)}</p><p className="text-xs text-muted-foreground">efectivo esperado</p></div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 [&>*]:min-w-0">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Más vendidos · 7 días</CardTitle></CardHeader>
            <CardContent>
              {d.topProducts.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay ventas esta semana.</p> : (
                <ol className="space-y-2.5">
                  {d.topProducts.map((p, i) => (
                    <li key={p.variantId} className="flex items-center gap-3 text-sm">
                      <span className="w-5 text-muted-foreground tabular-nums">{i + 1}.</span>
                      <span className="flex-1 min-w-0 truncate">{p.name}</span>
                      <span className="text-muted-foreground tabular-nums whitespace-nowrap">{qty.format(p.quantity)} u.</span>
                      <span className="font-medium tabular-nums whitespace-nowrap text-right">{formatCurrency(p.total)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${d.lowStockCount ? "text-amber-500" : ""}`} aria-hidden="true" />
                Por reponer{d.lowStockCount > 0 && <span className="tabular-nums">({d.lowStockCount})</span>}
              </CardTitle>
              <Button asChild variant="ghost" size="sm"><Link to="/admin/stock?filtro=reponer">Ver todo<ArrowRight className="h-4 w-4 ml-1" aria-hidden="true" /></Link></Button>
            </CardHeader>
            <CardContent>
              {d.lowStockCount === 0 ? (
                <p className="text-sm text-muted-foreground">Nada por reponer. Define mínimos en <Link className="underline" to="/admin/stock">Stock</Link> para recibir avisos.</p>
              ) : (
                <ul className="space-y-2.5">
                  {d.lowStock.map((s) => (
                    <li key={s.variantId} className="flex items-center gap-3 text-sm">
                      <span className="flex-1 min-w-0 truncate">{s.name}</span>
                      <span className={`tabular-nums whitespace-nowrap font-medium ${s.quantity <= 0 ? "text-destructive" : ""}`}>{qty.format(s.quantity)}</span>
                      <span className="text-muted-foreground tabular-nums whitespace-nowrap">mín. {qty.format(s.minQuantity)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </>}
    </div>
  );
}
