import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// scrypt es una función pensada para guardar contraseñas: es lenta y gasta memoria a propósito,
// para que probar millones de contraseñas por segundo sea carísimo.
export type ScryptParams = { N: number; r: number; p: number };

// N = costo (cuánto trabajo y memoria), r = tamaño de bloque, p = paralelismo.
export const DEFAULT_PARAMS: ScryptParams = { N: 2 ** 15, r: 8, p: 1 };

const KEY_LENGTH = 64;
const MAX_N = 2 ** 20; // tope para no aceptar un hash guardado con un costo absurdo

function derive(password: string, salt: Buffer, { N, r, p }: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // maxmem: memoria permitida; scrypt necesita unos 128 * N * r bytes.
    scrypt(password, salt, KEY_LENGTH, { N, r, p, maxmem: 256 * N * r }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

// Devuelve un texto "scrypt$N$r$p$sal$hash". La sal es un valor aleatorio distinto para cada
// contraseña: dos usuarios con la misma contraseña terminan con hashes distintos.
export async function hashPassword(password: string, params: ScryptParams = DEFAULT_PARAMS) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, params);
  return ["scrypt", params.N, params.r, params.p, salt.toString("base64"), key.toString("base64")].join("$");
}

// Comprueba una contraseña contra un hash guardado. Usa los parámetros que están dentro del
// propio hash, así se puede subir el costo en el futuro sin romper los usuarios existentes.
export async function verifyPassword(password: string, stored: string) {
  const [algorithm, n, r, p, salt, key] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !key) return false;

  const params = { N: Number(n), r: Number(r), p: Number(p) };
  if (![params.N, params.r, params.p].every(Number.isInteger) || params.N > MAX_N) return false;

  try {
    const expected = Buffer.from(key, "base64");
    const actual = await derive(password, Buffer.from(salt, "base64"), params);
    // Comparación en tiempo constante: no revela cuántos caracteres coincidieron.
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
