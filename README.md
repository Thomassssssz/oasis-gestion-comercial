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

## Estado

En construcción. Por ahora el repositorio tiene la estructura inicial y la base de datos de desarrollo.
Las instrucciones para ejecutar el resto del proyecto se agregarán a medida que existan.

## Seguridad

Los archivos `.env`, claves y credenciales nunca se suben al repositorio.
Las variables necesarias se documentan en `.env.example`, sin valores reales.
