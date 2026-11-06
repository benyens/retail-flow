import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** API nativa del navegador (Chrome/Android); en iOS u otros se usa ZXing. */
interface NativeDetector { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> }
type NativeDetectorCtor = new (opts: { formats: string[] }) => NativeDetector;

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"];

const canUseCamera = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;

function cameraError(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "No hay permiso para usar la cámara. Actívalo en la configuración del navegador para este sitio.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No se encontró una cámara en este equipo.";
  if (name === "NotReadableError") return "La cámara está siendo usada por otra aplicación.";
  return "No se pudo abrir la cámara.";
}

/**
 * Botón que abre la cámara y devuelve el primer código de barras leído.
 * No se muestra si el navegador no permite cámara (p. ej. sitio sin HTTPS).
 */
export default function BarcodeScanButton({ onDetected, label = "Escanear", className }: {
  onDetected: (code: string) => void; label?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let stopZxing: (() => void) | null = null;
    let raf = 0;
    setError(null);

    const finish = (code: string) => {
      if (stopped) return;
      stopped = true;
      navigator.vibrate?.(80);
      onDetectedRef.current(code.trim());
      setOpen(false);
    };

    (async () => {
      const video = videoRef.current;
      if (!video) return;
      const Native = (window as unknown as { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector;
      try {
        if (Native) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
          if (stopped) return;
          video.srcObject = stream;
          await video.play();
          const detector = new Native({ formats: FORMATS });
          const tick = async () => {
            if (stopped) return;
            try {
              const found = await detector.detect(video);
              if (found[0]?.rawValue) return finish(found[0].rawValue);
            } catch { /* cuadro sin imagen todavía */ }
            raf = requestAnimationFrame(tick);
          };
          tick();
        } else {
          // Se carga solo cuando hace falta (iPhone y navegadores sin API nativa).
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          if (stopped) return;
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromConstraints(
            { video: { facingMode: { ideal: "environment" } }, audio: false }, video,
            (result) => { if (result) finish(result.getText()); },
          );
          stopZxing = () => controls.stop();
          if (stopped) controls.stop();
        }
      } catch (err) {
        if (!stopped) setError(cameraError(err));
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stopZxing?.();
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [open]);

  if (!canUseCamera()) return null;

  return (
    <>
      <Button type="button" variant="outline" className={cn("shrink-0", className)} onClick={() => setOpen(true)} aria-label="Escanear código de barras con la cámara">
        <Camera className="h-4 w-4 sm:mr-2" aria-hidden="true" />
        <span className="hidden sm:inline">{label}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escanear código</DialogTitle>
            <DialogDescription>Apunta la cámara al código de barras del producto.</DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          ) : (
            <div className="relative overflow-hidden rounded-lg bg-black aspect-[4/3]">
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline aria-label="Vista de la cámara" />
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-md border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
