import type { Request, Response } from "express";

// Responde si el servidor está vivo. No consulta la base de datos.
export function getHealth(_req: Request, res: Response) {
  res.json({ status: "ok" });
}
