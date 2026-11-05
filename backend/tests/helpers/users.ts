import request from "supertest";
import type { Express } from "express";
import { hashPassword } from "../../src/helpers/password.js";
import type { PrismaClient } from "../../src/config/prisma.js";

export const TEST_PASSWORD = "ClaveDePrueba123";

// Costo bajo de scrypt solo para que las pruebas sean rápidas.
const FAST = { N: 1024, r: 8, p: 1 };

type UserOverrides = { username?: string; fullName?: string; password?: string; active?: boolean };

// Crea un usuario directamente en la base de pruebas.
export async function createUser(
  prisma: PrismaClient,
  { username = "ana", fullName = "Ana Propietaria", password = TEST_PASSWORD, active = true }: UserOverrides = {},
) {
  return prisma.user.create({
    data: { username, fullName, active, passwordHash: await hashPassword(password, FAST) },
  });
}

// Crea un usuario, inicia sesión con él y devuelve un "agente" de Supertest que
// guarda la cookie de sesión y la manda en cada pedido, como haría un navegador.
export async function loginAgent(app: Express, prisma: PrismaClient, overrides: UserOverrides = {}) {
  const user = await createUser(prisma, overrides);
  const agent = request.agent(app);
  const response = await agent
    .post("/api/auth/login")
    .send({ username: user.username, password: overrides.password ?? TEST_PASSWORD });

  if (response.status !== 200) throw new Error(`No se pudo iniciar sesión en la prueba (${response.status})`);
  return agent;
}
