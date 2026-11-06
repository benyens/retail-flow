import { useState } from 'react';
import { toast } from 'sonner';
import { useApp } from '@/state/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const MIN = 10;

export default function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { changePassword } = useApp();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => { setCurrent(''); setNext(''); setConfirm(''); setError(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < MIN) return setError(`La nueva contraseña debe tener al menos ${MIN} caracteres.`);
    if (next !== confirm) return setError('Las contraseñas nuevas no coinciden.');
    if (next === current) return setError('La nueva contraseña debe ser distinta de la actual.');
    setSaving(true);
    setError(null);
    try {
      await changePassword(current, next);
      toast.success('Contraseña actualizada. Se cerraron tus otras sesiones.');
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
            <DialogDescription>
              Al guardar se cerrarán tus sesiones en otros dispositivos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cp-current">Contraseña actual</Label>
            <Input id="cp-current" type="password" autoComplete="current-password" required
              value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-new">Nueva contraseña</Label>
            <Input id="cp-new" type="password" autoComplete="new-password" required minLength={MIN} maxLength={128}
              aria-describedby="cp-hint" value={next} onChange={(e) => setNext(e.target.value)} />
            <p id="cp-hint" className="text-xs text-muted-foreground">Mínimo {MIN} caracteres. Una frase corta es más fácil de recordar.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-confirm">Repite la nueva contraseña</Label>
            <Input id="cp-confirm" type="password" autoComplete="new-password" required
              value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {error && <p role="alert" aria-live="polite" className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar contraseña'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
