# Oasis – Gestión Comercial

Sistema web de gestión comercial e inventario para **Librería Oasis**, un comercio familiar de Formosa, Argentina.

Desarrollado como Trabajo Integrador de Práctica Profesionalizante III (ISIV).

## Qué resuelve

- Conocer el stock real y recibir alertas de stock mínimo.
- Registrar todas las ventas (rápidas y completas).
- Llevar cuentas corrientes de clientes con pagos, vencimientos y recargos.
- Registrar compras a proveedores.
- Consultar reportes y estadísticas.

## Estructura

```
frontend/   React + Vite + TypeScript
backend/    Node.js + Express + TypeScript + Prisma
docs/       documentación y decisiones del proyecto
```

Dentro de cada proyecto, el código está ordenado por **tipo de archivo**:

```
backend/
  prisma/          tablas (schema.prisma) y migraciones
  src/
    config/        variables de entorno y conexión a la base
    helpers/       funciones auxiliares (errores, contraseñas)
    middlewares/   pasos que corren antes o después de las rutas
    validators/    validación de los datos que llegan (Zod)
    routes/        qué URL existe
    controllers/   qué responde cada URL
    services/      reglas de negocio
    repositories/  consultas a la base de datos
    scripts/       tareas por línea de comandos
  tests/           todas las pruebas del backend

frontend/src/
  pages/           una pantalla por sección
  components/      piezas reutilizables (ui/ = shadcn/ui, layout/ = estructura)
  context/         estado compartido de toda la app (la sesión del usuario)
  routes/          qué dirección muestra qué pantalla
  services/        llamadas a la API
  types/           tipos de TypeScript
  utils/           funciones auxiliares
```

## Tecnologías

React, React Router, Vite, TypeScript, Node.js, Express, PostgreSQL, Prisma, Tailwind CSS, shadcn/ui, Zod, Recharts, Lucide, Vitest y Supertest.

## Base de datos de desarrollo

Requiere [Docker Desktop](https://www.docker.com/products/docker-desktop/).

1. Copiá la plantilla de variables y completá tus valores (en PowerShell: `copy .env.example .env`).
2. Levantá la base: `docker compose up -d`
3. Comprobá que esté lista: `docker compose ps` (el estado debe decir `healthy`).
4. Para apagarla sin perder datos: `docker compose down`. Con `docker compose down -v` se borran también los datos.

La base escucha solo en `127.0.0.1` (tu propia computadora), puerto 5432 por defecto.

## Backend (API)

Requiere Node.js 22 o superior. Desde la carpeta del proyecto:

```
cd backend
npm install
npm run dev
```

La API queda escuchando en http://localhost:3000 y se reinicia sola al guardar cambios.
Para comprobar que funciona, abrí http://localhost:3000/api/health: debe responder `{"status":"ok"}`.

### Base de datos (Prisma)

La API usa PostgreSQL a través de Prisma. Con el contenedor de la sección anterior corriendo, dentro de `backend/`:

1. Copiá `.env.example` como `.env` y completá `DATABASE_URL` y `TEST_DATABASE_URL` con tu usuario y contraseña (los mismos del `.env` de la raíz).
2. Creá la base de pruebas, que es aparte y se vacía en cada corrida. Desde la raíz del proyecto: `docker compose exec db psql -U <usuario> -d postgres -c "CREATE DATABASE oasis_test"`.
3. Aplicá las migraciones a la base de desarrollo, dentro de `backend/`: `npm run db:migrate`.
4. Aplicá las migraciones a la base de pruebas: `npm run db:test:deploy`.

5. Creá tu usuario para entrar al sistema (no hay registro público). Dentro de `backend/`: `npm run user:create -- ana "Ana Propietaria"` (reemplazá el usuario y el nombre por los tuyos). El programa te pide la contraseña dos veces, sin mostrarla en pantalla; tiene que tener al menos 10 caracteres. Repetí el comando para el segundo propietario.

El cliente de Prisma se genera solo al correr `npm install` (carpeta `src/generated/`, que no se sube al repositorio).
El modelo de datos está explicado en `docs/modelo-de-datos.md`.

Otros comandos útiles (siempre dentro de `backend/`):

- `npm test`: corre las pruebas (Vitest + Supertest).
- `npm run typecheck`: revisa los tipos de TypeScript sin compilar.
- `npm run build` y `npm start`: compila a `dist/` y ejecuta la versión compilada.

## Frontend

Requiere Node.js 22 o superior y el backend corriendo en el puerto 3000 (ver la sección anterior). En otra terminal:

```
cd frontend
npm install
npm run dev
```

Abrí http://localhost:5173. Primero aparece el **login**: entrá con el usuario que creaste con `npm run user:create` (ver la sección anterior). Una vez adentro, arriba a la derecha se ve "API conectada" si el backend responde, o "Sin conexión con la API" (con un botón para reintentar) si no, junto con tu nombre y el botón **Salir**. Hoy hay cuatro pantallas: **Productos** (`/productos`: lista con búsqueda y filtros, stock actual con la marca "Stock bajo", alta, edición y baja), **Categorías** (`/categorias`: alta, edición y borrado) **Inventario** (`/inventario`: historial de movimientos de stock, carga del stock inicial y ajustes con motivo) y **Ventas** (`/ventas`: venta rápida con carrito y medio de pago, historial y anulación con motivo). Si la sesión vence (dura 12 horas), la app vuelve sola al login. Para que todo funcione, el backend tiene que estar conectado a la base (ver la sección anterior).
Los estilos se escriben con clases de Tailwind CSS (v4, integrado a Vite con `@tailwindcss/vite`), directamente en los componentes.
Los componentes de interfaz siguen la convención de shadcn/ui: viven en `src/components/ui/` y se importan con el atajo `@/` (por ejemplo `@/components/ui/button`). Para agregar otro componente se puede usar `npx shadcn@latest add <nombre>`; `components.json` ya está configurado. Los íconos son de Lucide.
Vite redirige los pedidos que empiezan con `/api` hacia http://localhost:3000, por eso no hace falta configurar CORS en desarrollo.

Comandos útiles (siempre dentro de `frontend/`):

- `npm test`: corre las pruebas (Vitest + Testing Library).
- `npm run lint`: revisa el código con oxlint.
- `npm run typecheck`: revisa los tipos de TypeScript.
- `npm run build`: genera la versión para producción en `dist/`.

## Estado

En construcción, por módulos. Hecho: estructura inicial, base de datos de desarrollo, API con endpoint de salud, el módulo 1 (Productos y categorías), el login (usuarios, sesiones, pantalla de ingreso y rutas protegidas) el módulo 2 (Inventario: movimientos de stock, stock calculado y alerta de stock mínimo) y el módulo 3 en su parte de venta rápida (descuento de stock y anulación con registro), todo con pruebas. Los demás módulos se agregan de a uno; las decisiones de diseño están en `docs/decisiones.md`.
Las instrucciones para ejecutar el resto del proyecto se agregarán a medida que existan.

## Seguridad

Los archivos `.env`, claves y credenciales nunca se suben al repositorio.
Las variables necesarias se documentan en `.env.example`, sin valores reales.
