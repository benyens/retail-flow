import { MockApiClient } from "./mockApiClient";
import { HttpApiClient, API_ORIGIN } from "./httpApiClient";

const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? "true") === "true";

export const apiClient = USE_MOCK ? new MockApiClient() : new HttpApiClient();

// Render Free duerme el servicio tras inactividad: este ping lo despierta
// mientras el usuario escribe sus credenciales.
if (!USE_MOCK && typeof window !== "undefined") {
  fetch(`${API_ORIGIN}/health`, { cache: "no-store" }).catch(() => {});
}

export type { ApiClient } from "./client";
