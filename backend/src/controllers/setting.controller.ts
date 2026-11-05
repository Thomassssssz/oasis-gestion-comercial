import type { Request, Response } from "express";
import type { SettingService } from "../services/setting.service.js";
import { settingInputSchema } from "../validators/setting.validator.js";

// Controlador de parámetros: valida lo que llega, llama al servicio y arma la respuesta HTTP.
export function createSettingController(service: SettingService) {
  return {
    async get(_req: Request, res: Response) {
      res.json(await service.get());
    },

    // Quién cambió el parámetro sale de la sesión, nunca del cuerpo del pedido.
    async update(req: Request, res: Response) {
      res.json(await service.update(req.auth!.user.id, settingInputSchema.parse(req.body ?? {})));
    },
  };
}
