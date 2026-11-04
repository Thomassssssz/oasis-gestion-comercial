import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, type ScryptParams } from "../src/helpers/password.js";

// Costo bajo solo para que las pruebas sean rápidas; en el sistema real se usa el costo por defecto.
const FAST: ScryptParams = { N: 1024, r: 8, p: 1 };

describe("hashPassword", () => {
  it("no contiene la contraseña original", async () => {
    const hash = await hashPassword("MiClaveSegura123", FAST);

    expect(hash).not.toContain("MiClaveSegura123");
    expect(hash.startsWith("scrypt$1024$8$1$")).toBe(true);
  });

  it("da un hash distinto cada vez para la misma contraseña (sal aleatoria)", async () => {
    const a = await hashPassword("MiClaveSegura123", FAST);
    const b = await hashPassword("MiClaveSegura123", FAST);

    expect(a).not.toBe(b);
  });
});

describe("verifyPassword", () => {
  it("acepta la contraseña correcta", async () => {
    const hash = await hashPassword("MiClaveSegura123", FAST);

    expect(await verifyPassword("MiClaveSegura123", hash)).toBe(true);
  });

  it("rechaza una contraseña incorrecta", async () => {
    const hash = await hashPassword("MiClaveSegura123", FAST);

    expect(await verifyPassword("miclavesegura123", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("verifica con los parámetros guardados en el hash, no con los de por defecto", async () => {
    const hash = await hashPassword("abc", { N: 2048, r: 8, p: 1 });

    expect(await verifyPassword("abc", hash)).toBe(true);
  });

  it.each([
    ["texto cualquiera", "no es un hash"],
    ["otro algoritmo", "bcrypt$1$2$3$sal$clave"],
    ["campos faltantes", "scrypt$1024$8$1"],
    ["costo no numérico", "scrypt$mucho$8$1$c2Fs$Y2xhdmU="],
    ["costo absurdamente alto", "scrypt$99999999999$8$1$c2Fs$Y2xhdmU="],
  ])("rechaza un hash mal formado: %s", async (_caso, malformado) => {
    expect(await verifyPassword("abc", malformado)).toBe(false);
  });
});
