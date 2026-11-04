import type { RequestHandler } from "express";
import { unauthorized } from "../helpers/errors.js";
import { readCookie, SESSION_COOKIE } from "../helpers/cookies.js";
import type { AuthService } from "../services/auth.service.js";

// Se pone delante de las rutas privadas: si no hay una sesión válida, responde 401
// y la ruta ni se ejecuta. Si la hay, deja al usuario disponible en req.auth.
export function createRequireAuth(service: AuthService): RequestHandler {
  return async (req, _res, next) => {
    const token = readCookie(req, SESSION_COOKIE);
    const auth = token ? await service.authenticate(token) : null;

    if (!auth) throw unauthorized("Tenés que iniciar sesión");

    req.auth = auth;
    next();
  };
}
