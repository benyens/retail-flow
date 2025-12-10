import { useState } from 'react';
import { useApp } from '@/state/AppContext';
import { apiClient } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Clock, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/utils/format';
import { toast } from 'sonner';

export default function POSPage() {
  const { currentSession, selectedCashRegister, setCurrentSession, refreshSession } = useApp();
  const [initialFund, setInitialFund] = useState('50000');
  const [isOpening, setIsOpening] = useState(false);

  const handleOpenSession = async () => {
    if (!selectedCashRegister) return;
    
    setIsOpening(true);
    try {
      const session = await apiClient.openCashSession(
        selectedCashRegister.id,
        parseInt(initialFund) || 0
      );
      setCurrentSession(session);
      toast.success('Caja abierta exitosamente');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al abrir caja');
    } finally {
      setIsOpening(false);
    }
  };

  // If no session, show open session form
  if (!currentSession) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md animate-scale-in">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-warning" />
            </div>
            <CardTitle>Caja Cerrada</CardTitle>
            <CardDescription>
              Debe abrir la caja antes de realizar ventas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Fondo Inicial
              </label>
              <Input
                type="number"
                value={initialFund}
                onChange={(e) => setInitialFund(e.target.value)}
                className="h-12 text-lg font-mono"
                placeholder="0"
              />
              <p className="text-sm text-muted-foreground">
                {formatCurrency(parseInt(initialFund) || 0)}
              </p>
            </div>
            <Button
              onClick={handleOpenSession}
              disabled={isOpening}
              className="w-full h-12 text-lg"
            >
              {isOpening ? 'Abriendo...' : 'Abrir Caja'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main POS interface
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-14 bg-card border-b px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">Punto de Venta</h1>
          <div className="badge-success flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Caja Abierta
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          Fondo: {formatCurrency(currentSession.initialFund)}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Products Search Panel */}
        <div className="flex-1 p-4 overflow-auto bg-pos-panel">
          <div className="mb-4">
            <Input
              placeholder="Buscar por SKU, nombre o código de barras..."
              className="h-12 text-lg"
            />
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Product cards would go here */}
            <Card className="cursor-pointer hover:border-primary transition-colors">
              <CardContent className="p-4 text-center">
                <p className="font-medium">Desodorante Fresh</p>
                <p className="text-xs text-muted-foreground font-mono">DEO-FRESH-001</p>
                <p className="text-lg font-bold text-primary mt-2">{formatCurrency(2990)}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Cart Panel */}
        <div className="w-96 bg-card border-l flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Carrito</h2>
          </div>
          
          <div className="flex-1 p-4 overflow-auto">
            <p className="text-center text-muted-foreground py-8">
              Agregue productos al carrito
            </p>
          </div>

          {/* Totals */}
          <div className="p-4 border-t space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatCurrency(0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>IVA (19%)</span>
              <span>{formatCurrency(0)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold">
              <span>Total</span>
              <span>{formatCurrency(0)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t space-y-2">
            <Button className="w-full h-14 text-lg pos-button-success">
              Pagar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
