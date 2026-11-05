type LimiterOptions = {
  maxFailures?: number; // intentos fallidos permitidos dentro de la ventana
  windowMs?: number; // duración de la ventana, en milisegundos
  now?: () => number; // reloj (se puede reemplazar en las pruebas)
};

// Frena la adivinación de contraseñas: después de N intentos fallidos para un mismo usuario
// dentro de la ventana, el login queda bloqueado hasta que los intentos viejos vencen.
// Vive en la memoria del servidor: si el servidor se reinicia, se reinicia el conteo (ver D9).
export function createLoginLimiter({
  maxFailures = 5,
  windowMs = 15 * 60 * 1000,
  now = Date.now,
}: LimiterOptions = {}) {
  const failures = new Map<string, number[]>();

  // Devuelve los fallos de esa clave que todavía están dentro de la ventana.
  function recent(key: string) {
    const cutoff = now() - windowMs;
    const list = (failures.get(key) ?? []).filter((time) => time > cutoff);
    if (list.length > 0) failures.set(key, list);
    else failures.delete(key);
    return list;
  }

  return {
    isBlocked: (key: string) => recent(key).length >= maxFailures,

    recordFailure(key: string) {
      // Si alguien prueba miles de nombres distintos, se limpia lo vencido para no llenar la memoria.
      if (failures.size > 1000) for (const other of [...failures.keys()]) recent(other);
      failures.set(key, [...recent(key), now()]);
    },

    // Un login correcto borra los fallos anteriores de ese usuario.
    reset: (key: string) => void failures.delete(key),
  };
}

export type LoginLimiter = ReturnType<typeof createLoginLimiter>;
