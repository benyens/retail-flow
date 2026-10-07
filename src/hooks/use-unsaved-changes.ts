import { useEffect } from 'react';
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const confirm = (e: Event) => {
      if (!window.confirm('Hay cambios sin guardar. ¿Quieres salir y descartarlos?')) e.preventDefault();
    };
    const click = (e: MouseEvent) => {
      const link = (e.target as Element).closest('a[href]') as HTMLAnchorElement | null;
      if (link && link.pathname !== location.pathname) {
        confirm(e); if (e.defaultPrevented) e.stopPropagation();
      }
    };
    const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    document.addEventListener('click', click, true);
    window.addEventListener('app:before-navigate', confirm);
    window.addEventListener('beforeunload', unload);
    return () => { document.removeEventListener('click', click, true); window.removeEventListener('app:before-navigate', confirm); window.removeEventListener('beforeunload', unload); };
  }, [dirty]);
}
