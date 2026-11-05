import { loadEnv } from "../config/env.js";
import { createPrismaClient } from "../config/prisma.js";
import { createUserAccount } from "../services/user.service.js";

// Crea un usuario desde la línea de comandos. Uso:
//   npm run user:create -- ana "Ana Propietaria"
// La contraseña se pide por pantalla (no se ve lo que escribís) y no queda en el historial.

// Pide un texto sin mostrarlo en pantalla. Si no hay una terminal interactiva, lee una línea común.
function askHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    stdout.write(question);

    if (!stdin.isTTY) {
      let data = "";
      stdin.setEncoding("utf8");
      stdin.on("data", (chunk) => {
        data += chunk;
        if (data.includes("\n")) {
          stdin.pause();
          resolve(data.split(/\r?\n/)[0]);
        }
      });
      stdin.on("end", () => resolve(data.split(/\r?\n/)[0]));
      return;
    }

    let typed = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const onData = (char: string) => {
      for (const key of char) {
        if (key === "\r" || key === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          resolve(typed);
          return;
        }
        if (key === "\u0003") {
          // Ctrl+C
          stdin.setRawMode(false);
          stdout.write("\n");
          reject(new Error("Cancelado"));
          return;
        }
        if (key === "\u007f" || key === "\b") typed = typed.slice(0, -1);
        else typed += key;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const [username, ...nameParts] = process.argv.slice(2);
  const fullName = nameParts.join(" ");

  if (!username || !fullName) {
    console.error('Uso: npm run user:create -- <usuario> "<Nombre completo>"');
    process.exit(1);
  }

  try {
    process.loadEnvFile();
  } catch {
    // Sin .env: se usan las variables que ya tenga el entorno.
  }
  const prisma = createPrismaClient(loadEnv().DATABASE_URL);

  try {
    const password = await askHidden("Contraseña (mínimo 10 caracteres): ");
    const repeated = await askHidden("Repetí la contraseña: ");
    if (password !== repeated) {
      console.error("Las contraseñas no coinciden. No se creó el usuario.");
      process.exitCode = 1;
      return;
    }

    const user = await createUserAccount(prisma, { username, fullName, password });
    console.log(`Usuario "${user.username}" creado (${user.fullName}).`);
  } catch (error) {
    // Los errores de validación de Zod traen el mensaje por campo; el resto, un mensaje simple.
    const issues = (error as { issues?: { message: string }[] }).issues;
    console.error(issues ? issues.map((issue) => issue.message).join(". ") : (error as Error).message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

await main();
