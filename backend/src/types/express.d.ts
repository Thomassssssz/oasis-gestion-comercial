import type { AuthUser } from "./auth.types.js";

// Le agrega a la petición de Express el dato "auth", que completa el middleware requireAuth.
declare global {
  namespace Express {
    interface Request {
      auth?: { user: AuthUser; tokenHash: string };
    }
  }
}

export {};
