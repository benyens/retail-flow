import { MockApiClient } from "./mockApiClient";
// import { HttpApiClient } from "./httpApiClient"; // lo agregaremos después

const USE_MOCK = (import.meta.env.VITE_USE_MOCK || "true") === "true";

// Hoy: solo mock
export const apiClient = new MockApiClient();

// Después será algo como:
// export const apiClient = USE_MOCK ? new MockApiClient() : new HttpApiClient({...});

export type { ApiClient } from "./client";
