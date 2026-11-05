import type { Request, Response } from "express";
import type { CreditAccountService } from "../services/credit-account.service.js";
import { idParamSchema } from "../validators/common.validator.js";
import { accountListQuerySchema, accountPaymentSchema } from "../validators/credit-account.validator.js";

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

    async pay(req: Request, res: Response) {
      const { id } = idParamSchema.parse(req.params);
      res.status(201).json(await service.pay(id, req.auth!.user.id, accountPaymentSchema.parse(req.body)));
    },

    async applySurcharges(req: Request, res: Response) {
      const { id } = idParamSchema.parse(req.params);
      res.json(await service.applySurcharges(id, req.auth!.user.id));
    },
  };
}
