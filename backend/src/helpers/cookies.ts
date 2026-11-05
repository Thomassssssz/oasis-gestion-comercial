import type { CookieOptions, Request } from "express";

export const SESSION_COOKIE = "oasis_session";
export const SESSION_HOURS = 12;

// HttpOnly: el JavaScript de la página no puede leer la cookie (protege del robo por XSS).
// SameSite=Lax: el navegador no la manda en pedidos que vienen de otros sitios (protege de CSRF).
// Secure: en producción solo viaja por HTTPS.
export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

// Lee una cookie de la cabecera "Cookie" (formato: "a=1; b=2").
export function readCookie(req: Request, name: string) {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}
