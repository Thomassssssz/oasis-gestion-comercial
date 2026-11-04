import { describe, expect, it } from "vitest";
import { createLoginLimiter } from "../src/helpers/login-limiter.js";

// Reloj controlado a mano para probar el paso del tiempo sin esperar.
function setup(options = {}) {
  let time = 1_000_000;
  const limiter = createLoginLimiter({ now: () => time, ...options });
  return { limiter, advance: (ms: number) => (time += ms) };
}

describe("createLoginLimiter", () => {
  it("no bloquea antes de llegar al máximo de fallos", () => {
    const { limiter } = setup({ maxFailures: 3 });

    limiter.recordFailure("ana");
    limiter.recordFailure("ana");

    expect(limiter.isBlocked("ana")).toBe(false);
  });

  it("bloquea al llegar al máximo de fallos", () => {
    const { limiter } = setup({ maxFailures: 3 });

    for (let i = 0; i < 3; i++) limiter.recordFailure("ana");

    expect(limiter.isBlocked("ana")).toBe(true);
  });

  it("cuenta por separado a cada usuario", () => {
    const { limiter } = setup({ maxFailures: 2 });

    limiter.recordFailure("ana");
    limiter.recordFailure("ana");

    expect(limiter.isBlocked("ana")).toBe(true);
    expect(limiter.isBlocked("beto")).toBe(false);
  });

  it("desbloquea cuando los fallos salen de la ventana de tiempo", () => {
    const { limiter, advance } = setup({ maxFailures: 2, windowMs: 60_000 });
    limiter.recordFailure("ana");
    limiter.recordFailure("ana");

    advance(59_000);
    expect(limiter.isBlocked("ana")).toBe(true);

    advance(2_000);
    expect(limiter.isBlocked("ana")).toBe(false);
  });

  it("un login correcto (reset) borra los fallos", () => {
    const { limiter } = setup({ maxFailures: 2 });
    limiter.recordFailure("ana");

    limiter.reset("ana");
    limiter.recordFailure("ana");

    expect(limiter.isBlocked("ana")).toBe(false);
  });
});
