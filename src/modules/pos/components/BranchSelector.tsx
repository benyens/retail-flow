import { useApp } from '@/state/AppContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Monitor, ArrowRight } from 'lucide-react';

export default function BranchSelector() {
  const {
    branches,
    selectedBranch,
    setSelectedBranch,
    cashRegisters,
    selectedCashRegister,
    setSelectedCashRegister,
  } = useApp();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-lg animate-scale-in">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Configuración de Punto de Venta</CardTitle>
          <CardDescription>Seleccione la sucursal y caja para operar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Branch Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Sucursal
            </label>
            <Select
              value={selectedBranch?.id || ''}
              onValueChange={(value) => {
                const branch = branches.find(b => b.id === value);
                setSelectedBranch(branch || null);
              }}
            >
              <SelectTrigger className="h-12">
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
              <label className="text-sm font-medium flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                Caja
              </label>
              <Select
                value={selectedCashRegister?.id || ''}
                onValueChange={(value) => {
                  const register = cashRegisters.find(r => r.id === value);
                  setSelectedCashRegister(register || null);
                }}
              >
                <SelectTrigger className="h-12">
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

          {selectedBranch && selectedCashRegister && (
            <div className="pt-4 animate-fade-in">
              <Button className="w-full h-12 text-lg">
                Continuar al POS
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
