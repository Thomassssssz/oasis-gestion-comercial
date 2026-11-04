import { z } from "zod";

// El :id de la URL llega como texto; se convierte y valida como entero positivo.
const INVALID_ID = "El identificador no es válido";

export const idParamSchema = z.object({
  id: z.coerce.number({ error: INVALID_ID }).int(INVALID_ID).positive(INVALID_ID),
});
