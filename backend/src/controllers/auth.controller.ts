import type { Request, Response } from "express";
import { readCookie, SESSION_COOKIE, SESSION_HOURS, sessionCookieOptions } from "../helpers/cookies.js";
import type { AuthService } from "../services/auth.service.js";
import { changePasswordSchema, loginSchema } from "../validators/auth.validator.js";

// Controlador de autenticación: valida lo que llega, llama al servicio y maneja la cookie de sesión.
export function createAuthController(service: AuthService) {
  return {
    async login(req: Request, res: Response) {
      const { username, password } = loginSchema.parse(req.body ?? {});
      const { token, user } = await service.login(username, password);

      res.cookie(SESSION_COOKIE, token, { ...sessionCookieOptions(), maxAge: SESSION_HOURS * 60 * 60 * 1000 });
      res.json(user);
    },

    // Cerrar sesión siempre responde 204, haya o no una sesión abierta.
    async logout(req: Request, res: Response) {
      const token = readCookie(req, SESSION_COOKIE);
      if (token) await service.logout(token);

      res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
      res.status(204).send();
    },

    // Devuelve el usuario de la sesión actual (lo completó el middleware requireAuth).
    me(req: Request, res: Response) {
      res.json(req.auth!.user);
    },

    async changePassword(req: Request, res: Response) {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body ?? {});
      await service.changePassword(req.auth!.user.id, req.auth!.tokenHash, currentPassword, newPassword);
      res.status(204).send();
    },
  };
}
