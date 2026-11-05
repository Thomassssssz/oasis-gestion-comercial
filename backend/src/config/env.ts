import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string({ error: "Falta DATABASE_URL" }).min(1, "Falta DATABASE_URL"),
  PORT: z.coerce.number().int().positive().default(3000),
});

// Lee y valida las variables de entorno. Si falta algo, avisa en español qué es.
export function loadEnv(source: NodeJS.ProcessEnv = process.env) {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const problems = result.error.issues.map((issue) => issue.message).join(", ");
    throw new Error(`Configuración inválida: ${problems}. Revisá backend/.env (ver .env.example).`);
  }

  return result.data;
}
