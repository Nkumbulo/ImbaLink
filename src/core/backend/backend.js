/**
 * Backend port type surface.
 *
 * The concrete composition root lives in infrastructure. This file exists so
 * application code can import the boundary from core without knowing which
 * provider is installed. The application entry point should inject the
 * concrete backend where dependency injection is introduced.
 */
export const BACKEND_PORT = "imbalink-backend";
