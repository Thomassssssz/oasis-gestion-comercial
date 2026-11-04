import { Router, type RequestHandler } from "express";
import { createAuthController } from "../controllers/auth.controller.js";
import type { AuthService } from "../services/auth.service.js";

// Rutas de autenticación: login, logout, quién soy y cambio de contraseña.
// Cada ruta decide si exige sesión (requireAuth) o no.
export function createAuthRouter(service: AuthService, requireAuth: RequestHandler) {
  const controller = createAuthController(service);
  const router = Router();

  router.post("/login", controller.login);
  router.post("/logout", controller.logout);
  router.get("/me", requireAuth, controller.me);
  router.post("/change-password", requireAuth, controller.changePassword);

  return router;
}
