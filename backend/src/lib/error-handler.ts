import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "./errors.js";

// Convierte cualquier error en una respuesta JSON con el código HTTP correcto.
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: "Datos inválidos",
      details: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  // express.json() marca con status 400 al JSON mal formado.
  if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.parse.failed") {
    res.status(400).json({ error: "El cuerpo de la petición no es un JSON válido" });
    return;
  }

  // Error inesperado: se registra en el servidor pero no se muestra el detalle al cliente.
  console.error(error);
  res.status(500).json({ error: "Error interno del servidor" });
};
