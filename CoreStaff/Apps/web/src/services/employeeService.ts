import { hrRequest } from './hrService';

/**
 * Employee-specific API client.
 * Uses the same cookie/envelope handling as hrRequest but scoped to employee endpoints.
 */
export const employeeRequest = {
    /**
     * GET request for employee endpoints.
     */
    get: <T>(path: string, options?: RequestInit): Promise<T> => {
        // Prepend /api/ because NestJS has globalPrefix 'api'
        const apiPath = path.startsWith('/api/') ? path : `/api${path}`;
        return hrRequest<T>(import.meta.env.VITE_API_BASE || 'http://localhost:3000', apiPath, options);
    },

    /**
     * POST request for employee endpoints.
     */
    post: <T>(path: string, body?: unknown, options?: RequestInit): Promise<T> => {
        const apiPath = path.startsWith('/api/') ? path : `/api${path}`;
        return hrRequest<T>(import.meta.env.VITE_API_BASE || 'http://localhost:3000', apiPath, {
            ...options,
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
        });
    },

    /**
     * PUT request for employee endpoints.
     */
    put: <T>(path: string, body?: unknown, options?: RequestInit): Promise<T> => {
        const apiPath = path.startsWith('/api/') ? path : `/api${path}`;
        return hrRequest<T>(import.meta.env.VITE_API_BASE || 'http://localhost:3000', apiPath, {
            ...options,
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined,
        });
    },

    /**
     * DELETE request for employee endpoints.
     */
    delete: <T>(path: string, options?: RequestInit): Promise<T> => {
        const apiPath = path.startsWith('/api/') ? path : `/api${path}`;
        return hrRequest<T>(import.meta.env.VITE_API_BASE || 'http://localhost:3000', apiPath, {
            ...options,
            method: 'DELETE',
        });
    },
};
