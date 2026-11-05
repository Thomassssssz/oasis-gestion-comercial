import { createHash, randomBytes } from "node:crypto";
import { badRequest, tooManyRequests, unauthorized } from "../helpers/errors.js";
import type { AuthRepository } from "../repositories/auth.repository.js";
import { SESSION_HOURS } from "../helpers/cookies.js";
import type { LoginLimiter } from "../helpers/login-limiter.js";
import { hashPassword, verifyPassword } from "../helpers/password.js";
import type { AuthUser } from "../types/auth.types.js";

const INVALID_CREDENTIALS = "Usuario o contraseña incorrectos";

// El código de la cookie es aleatorio (32 bytes). En la base se guarda solo su hash SHA-256:
// si alguien lee la base, no puede usar esos valores para entrar.
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const toAuthUser = (user: { id: number; username: string; fullName: string }): AuthUser => ({
  id: user.id,
  username: user.username,
  fullName: user.fullName,
});

// Hash falso para gastar el mismo tiempo cuando el usuario no existe (ver login).
let dummyHash: Promise<string> | undefined;

// Reglas de negocio del login. No sabe nada de HTTP ni de cookies.
export function createAuthService(repository: AuthRepository, limiter: LoginLimiter, now: () => Date = () => new Date()) {
  return {
    async login(username: string, password: string) {
      if (limiter.isBlocked(username)) {
        throw tooManyRequests("Demasiados intentos fallidos. Esperá unos minutos y probá de nuevo");
      }

      const user = await repository.findUserByUsername(username);

      // Se verifica la contraseña aunque el usuario no exista, contra un hash falso: así la
      // respuesta tarda lo mismo y no se puede averiguar qué usuarios existen midiendo el tiempo.
      dummyHash ??= hashPassword("contraseña-falsa");
      const passwordOk = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));

      // El mismo mensaje para usuario inexistente, dado de baja o contraseña mala.
      if (!user || !user.active || !passwordOk) {
        limiter.recordFailure(username);
        throw unauthorized(INVALID_CREDENTIALS);
      }

      limiter.reset(username);
      await repository.deleteExpiredSessions(user.id, now());

      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(now().getTime() + SESSION_HOURS * 60 * 60 * 1000);
      await repository.createSession(user.id, hashToken(token), expiresAt);

      return { token, user: toAuthUser(user) };
    },

    async logout(token: string) {
      await repository.deleteSession(hashToken(token));
    },

    // Devuelve el usuario dueño de una sesión válida, o null si no existe, venció o el usuario está dado de baja.
    async authenticate(token: string) {
      const tokenHash = hashToken(token);
      const session = await repository.findSession(tokenHash);
      if (!session) return null;

      if (session.expiresAt <= now()) {
        await repository.deleteSession(tokenHash);
        return null;
      }
      if (!session.user.active) return null;

      return { user: toAuthUser(session.user), tokenHash };
    },

    async changePassword(userId: number, tokenHash: string, currentPassword: string, newPassword: string) {
      const user = await repository.findUserById(userId);
      if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
        throw badRequest("La contraseña actual no es correcta");
      }
      if (currentPassword === newPassword) {
        throw badRequest("La contraseña nueva tiene que ser distinta de la actual");
      }

      await repository.updatePasswordHash(userId, await hashPassword(newPassword));
      // Por seguridad, se cierran las demás sesiones abiertas (otras computadoras o celulares).
      await repository.deleteOtherSessions(userId, tokenHash);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
