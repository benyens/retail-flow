import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Tras un nuevo deploy, una pestaña abierta puede pedir un fragmento de página que
// ya no existe. Se recarga para tomar la versión nueva, como máximo una vez por minuto
// para no entrar en bucle si el problema es otro (p. ej. sin conexión).
window.addEventListener("vite:preloadError", (event) => {
  let last = 0;
  try { last = Number(sessionStorage.getItem("chunk-reload-at") ?? 0); } catch { /* sin almacenamiento */ }
  if (Date.now() - last < 60_000) return;
  try { sessionStorage.setItem("chunk-reload-at", String(Date.now())); } catch { /* sin almacenamiento */ }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
