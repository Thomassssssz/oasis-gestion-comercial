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

## Tecnologías

React, Vite, TypeScript, Node.js, Express, PostgreSQL, Prisma, Tailwind CSS, shadcn/ui, Zod, Recharts, Lucide, Vitest y Supertest.

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

Abrí http://localhost:5173. La pantalla consulta `/api/health` y muestra "API conectada" si el backend responde, o "Sin conexión con la API" si no.
Los estilos se escriben con clases de Tailwind CSS (v4, integrado a Vite con `@tailwindcss/vite`), directamente en los componentes.
Vite redirige los pedidos que empiezan con `/api` hacia http://localhost:3000, por eso no hace falta configurar CORS en desarrollo.

Comandos útiles (siempre dentro de `frontend/`):

- `npm test`: corre las pruebas (Vitest + Testing Library).
- `npm run lint`: revisa el código con oxlint.
- `npm run typecheck`: revisa los tipos de TypeScript.
- `npm run build`: genera la versión para producción en `dist/`.

## Estado

En construcción. Por ahora el repositorio tiene la estructura inicial, la base de datos de desarrollo, un backend mínimo con un endpoint de salud y un frontend mínimo que lo consulta.
Las instrucciones para ejecutar el resto del proyecto se agregarán a medida que existan.

## Seguridad

Los archivos `.env`, claves y credenciales nunca se suben al repositorio.
Las variables necesarias se documentan en `.env.example`, sin valores reales.
