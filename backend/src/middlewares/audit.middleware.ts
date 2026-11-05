import type { NextFunction, Request, Response } from "express";
import { auditEntryFor, routeKey } from "../helpers/audit-rules.js";
import type { AuditService } from "../services/audit.service.js";

// Anota en el registro de auditoría las operaciones que cambian datos (D20). Se engancha al momento de responder:
// si la operación salió bien (código menor a 400) y hay un usuario con sesión, escribe la anotación ANTES de enviar
// la respuesta; si la operación falló, no anota nada.
//
// Limitación conocida: la anotación no es parte de la misma transacción que la operación. Si la base falla justo al anotar,
// la operación ya quedó hecha: se deja el error en el log del servidor y la respuesta sigue su curso, para no mostrarle
// un error al usuario por algo que sí se hizo.
export function createAuditTrail(audit: AuditService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const send = res.send.bind(res);
    let handled = false;

    res.send = (body?: unknown) => {
      if (handled) return send(body);
      handled = true;

      const userId = req.auth?.user.id;
      const key = req.route ? routeKey(req.method, req.baseUrl, req.route.path as string) : null;
      if (!userId || !key || res.statusCode >= 400) return send(body);

      let parsed: Record<string, unknown> | null = null;
      if (typeof body === "string" && body.startsWith("{")) {
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = null;
        }
      }
      const entry = auditEntryFor(key, { params: req.params, body: parsed, userId });
      if (!entry) return send(body);

      audit
        .record(userId, entry)
        .catch((error: unknown) => console.error("No se pudo escribir en el registro de auditoría:", error))
        .finally(() => send(body));
      return res;
    };

    next();
  };
}
