import { useApp } from '@/state/AppContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Monitor, LogOut } from 'lucide-react';

export default function BranchSelector() {
  const {
    branches,
    selectedBranch,
    setSelectedBranch,
    cashRegisters,
    selectedCashRegister,
    setSelectedCashRegister,
    logout,
    auth,
  } = useApp();
  const isCashier = auth.user?.role === 'CASHIER';

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-lg animate-scale-in">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{isCashier ? 'Configuración de Punto de Venta' : 'Elige la sucursal'}</CardTitle>
          <CardDescription>{isCashier ? 'Seleccione la sucursal y caja para operar' : 'La caja se elige solo si vas a vender.'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Branch Selection */}
          <div className="space-y-2">
            <label id="branch-label" className="text-sm font-medium flex items-center gap-2">
              <Building2 className="w-4 h-4" aria-hidden="true" />
              Sucursal
            </label>
            <Select
              value={selectedBranch?.id || ''}
              onValueChange={(value) => {
                const branch = branches.find(b => b.id === value);
                setSelectedBranch(branch || null);
              }}
            >
              <SelectTrigger className="h-12" aria-labelledby="branch-label">
                <SelectValue placeholder="Seleccione una sucursal" />
              </SelectTrigger>
              <SelectContent>
                {branches.map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>
                    <div>
                      <p className="font-medium">{branch.name}</p>
                      <p className="text-xs text-muted-foreground">{branch.address}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cash Register Selection */}
          {selectedBranch && (
            <div className="space-y-2 animate-fade-in">
              <label id="register-label" className="text-sm font-medium flex items-center gap-2">
                <Monitor className="w-4 h-4" aria-hidden="true" />
                Caja
              </label>
              <Select
                value={selectedCashRegister?.id || ''}
                onValueChange={(value) => {
                  const register = cashRegisters.find(r => r.id === value);
                  setSelectedCashRegister(register || null);
                }}
              >
                <SelectTrigger className="h-12" aria-labelledby="register-label">
                  <SelectValue placeholder="Seleccione una caja" />
                </SelectTrigger>
                <SelectContent>
                  {cashRegisters.map(register => (
                    <SelectItem key={register.id} value={register.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm bg-muted px-2 py-0.5 rounded">
                          {register.code}
                        </span>
                        <span>{register.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Al elegir la caja se entra directo al POS; aquí solo se avisan los casos sin opciones. */}
          {branches.length === 0 && (
            <p role="status" className="text-sm text-muted-foreground">
              Tu usuario no tiene sucursales asignadas. Pide a un administrador que te asigne una.
            </p>
          )}
          {selectedBranch && cashRegisters.length === 0 && (
            <p role="status" className="text-sm text-muted-foreground">
              Esta sucursal no tiene cajas activas.
            </p>
          )}
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={logout}>
            <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
