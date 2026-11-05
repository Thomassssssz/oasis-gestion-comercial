import type { Request, Response } from "express";
import type { CreditAccountService } from "../services/credit-account.service.js";
import { idParamSchema } from "../validators/common.validator.js";
import { accountListQuerySchema } from "../validators/credit-account.validator.js";

// Controlador de cuentas corrientes: valida lo que llega, llama al servicio y arma la respuesta HTTP.
export function createCreditAccountController(service: CreditAccountService) {
  return {
    async list(req: Request, res: Response) {
      res.json(await service.list(accountListQuerySchema.parse(req.query)));
    },

    async get(req: Request, res: Response) {
      const { id } = idParamSchema.parse(req.params);
      res.json(await service.get(id));
    },
  };
}
