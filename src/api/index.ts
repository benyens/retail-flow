import { MockApiClient } from "./mockApiClient";
import { HttpApiClient } from "./httpApiClient";

const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? "true") === "true";

export const apiClient = USE_MOCK ? new MockApiClient() : new HttpApiClient();

export type { ApiClient } from "./client";
