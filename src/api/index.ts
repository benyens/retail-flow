import { MockApiClient } from './mockApiClient';

// Get API base URL from environment
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// For now, always use MockApiClient
// To switch to a real backend:
// 1. Set VITE_API_BASE_URL in .env
// 2. Implement HttpApiClient following the ApiClient interface
export const apiClient = new MockApiClient();

// Re-export types
export type { ApiClient } from './client';
