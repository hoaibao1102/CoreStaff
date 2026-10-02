import { hrRequest } from './hrService';
import { resolveApiBase } from '../config/api';

/**
 * Employee-specific API client.
 * Uses the same cookie/envelope handling as hrRequest but scoped to employee endpoints.
 */
export const employeeRequest = {
    /**
     * GET request for employee endpoints.
     */
    get: async <T>(path: string, options?: RequestInit): Promise<T> => {
        const apiPath = path.startsWith('/api/') ? path : `/api${path}`;
        const { base } = await resolveApiBase();
        return hrRequest<T>(base, apiPath, options);
    },

    /**
     * POST request for employee endpoints.
     */
    post: async <T>(path: string, body?: unknown, options?: RequestInit): Promise<T> => {
        const apiPath = path.startsWith('/api/') ? path : `/api${path}`;
        const { base } = await resolveApiBase();
        return hrRequest<T>(base, apiPath, {
            ...options,
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
        });
    },

    /**
     * PUT request for employee endpoints.
     */
    put: async <T>(path: string, body?: unknown, options?: RequestInit): Promise<T> => {
        const apiPath = path.startsWith('/api/') ? path : `/api${path}`;
        const { base } = await resolveApiBase();
        return hrRequest<T>(base, apiPath, {
            ...options,
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined,
        });
    },

    /**
     * DELETE request for employee endpoints.
     */
    delete: async <T>(path: string, options?: RequestInit): Promise<T> => {
        const apiPath = path.startsWith('/api/') ? path : `/api${path}`;
        const { base } = await resolveApiBase();
        return hrRequest<T>(base, apiPath, {
            ...options,
            method: 'DELETE',
        });
    },
};
