import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestPrisma, resetDatabase } from "./helpers/db.js";
import { createUserAccount } from "../src/services/user.service.js";
import { verifyPassword } from "../src/helpers/password.js";

const prisma = createTestPrisma();

beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

const valid = { username: "ana", fullName: "Ana Propietaria", password: "ClaveLarga2026" };

describe("createUserAccount", () => {
  it("crea el usuario y devuelve sus datos sin el hash", async () => {
    const user = await createUserAccount(prisma, valid);

    expect(user).toEqual({ id: expect.any(Number), username: "ana", fullName: "Ana Propietaria" });
  });

  it("guarda la contraseña solo como hash, que luego se puede verificar", async () => {
    await createUserAccount(prisma, valid);
    const stored = await prisma.user.findUniqueOrThrow({ where: { username: "ana" } });

    expect(stored.passwordHash).not.toContain("ClaveLarga2026");
    expect(await verifyPassword("ClaveLarga2026", stored.passwordHash)).toBe(true);
    expect(stored.active).toBe(true);
  });

  it("guarda el usuario en minúsculas y sin espacios sobrantes", async () => {
    const user = await createUserAccount(prisma, { ...valid, username: "  Ana  ", fullName: "  Ana P.  " });

    expect(user.username).toBe("ana");
    expect(user.fullName).toBe("Ana P.");
  });

  it("rechaza un usuario repetido, aunque cambien las mayúsculas", async () => {
    await createUserAccount(prisma, valid);

    await expect(createUserAccount(prisma, { ...valid, username: "ANA" })).rejects.toMatchObject({
      status: 409,
      message: "Ya existe un usuario con ese nombre de usuario",
    });
  });

  it.each([
    ["usuario muy corto", { username: "ab" }],
    ["usuario con espacios", { username: "ana perez" }],
    ["usuario con caracteres raros", { username: "ana@mail" }],
    ["nombre completo vacío", { fullName: "  " }],
    ["contraseña de menos de 10 caracteres", { password: "corta123" }],
    ["contraseña igual al usuario", { username: "propietario", password: "Propietario" }],
  ])("rechaza: %s", async (_caso, cambios) => {
    await expect(createUserAccount(prisma, { ...valid, ...cambios })).rejects.toThrow();
    expect(await prisma.user.count()).toBe(0);
  });
});
