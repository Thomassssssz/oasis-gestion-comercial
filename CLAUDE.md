# CLAUDE.md – Proyecto Oasis

Sistema web de gestión comercial e inventario para Librería Oasis (Formosa, Argentina).
Es a la vez un sistema real para el comercio y el Trabajo Integrador de Práctica Profesionalizante III del ISIV.

## Cómo trabajar en este repo

- Idioma: español rioplatense para explicaciones, mensajes de commit y documentación. Código y nombres técnicos en inglés.
- Cambios **pequeños e incrementales**. Un commit por cambio, con mensaje descriptivo.
- Los commits se firman solo con la identidad del autor del repo. No se agregan líneas `Co-Authored-By` ni otras de atribución.
- Explicar qué se hizo y por qué, en palabras simples. El autor debe poder defender cada línea en una inspección de código en vivo.
- Todo cambio con lógica de negocio lleva pruebas (Vitest + Supertest).
- Antes de una decisión relevante de diseño o de negocio, preguntar. No decidir en silencio.
- No inventar datos de la empresa. Distinguir siempre entre información relevada, estimaciones y supuestos.
- **Nunca** subir `.env`, claves de Neon, tokens ni credenciales. Solo `.env.example` sin valores reales.
- No proponer cronogramas, semanas ni fechas de desarrollo. Las estimaciones académicas (LDC, COCOMO) no son compromisos de calendario.
- No generar la aplicación de golpe: se construye por etapas.

## Estructura

```
frontend/   React + Vite + TypeScript. Una carpeta por módulo en src/features/
backend/    Express + TypeScript + Prisma. Módulos en src/modules/, con capas:
            rutas -> servicio (reglas de negocio) -> acceso a datos; validación con Zod
docs/       documentación y decisiones
```

Son dos proyectos npm independientes (cada uno con su `package.json`). Gestor de paquetes: **npm**.
El backend usa ESM con `module: NodeNext`: los imports relativos llevan extensión `.js` (por ejemplo `import { x } from "./x.js"`), aunque el archivo sea `.ts`.
Versiones en la PC del autor: Node 24 y npm 11. Los tipos de Node (`@types/node`) se mantienen en la misma versión mayor que el Node real (24).
PostgreSQL de desarrollo en Docker (`docker-compose.yml`, solo la base de datos).

## Stack acordado

React, Vite, TypeScript, Node.js, Express, PostgreSQL, Prisma, Tailwind CSS, shadcn/ui, Zod, Recharts, Lucide, Vitest, Supertest, Git + GitHub. API REST.
Hosting previsto (aún sin configurar): Render y Neon en planes gratuitos. Antes de usar datos reales hay que evaluar backups, seguridad, disponibilidad y límites de esos planes.
Los montos se guardan como `Decimal`, nunca como `float`.

## Módulos del sistema

1. Productos y categorías
2. Inventario y movimientos (con alertas de stock mínimo)
3. Ventas rápidas y completas
4. Clientes
5. Cuentas corrientes, pagos, vencimientos y recargos
6. Compras y proveedores
7. Reportes y estadísticas
8. Usuarios, configuración, login y auditoría

Fuera de alcance: facturación electrónica/ARCA, tienda online, app móvil nativa, múltiples sucursales, RR. HH. y sueldos, integración bancaria, automatización del servicio de impresión.

## Reglas de negocio confirmadas

- Todas las ventas deben registrarse. Venta rápida: productos, cantidades, total y medio de pago. Venta completa: además cliente, descuentos y casos especiales.
- Medios de pago: efectivo, transferencia, tarjeta y billetera virtual.
- Confirmar una venta descuenta stock. Confirmar la recepción de una compra aumenta stock.
- Solo clientes autorizados compran a crédito. Cada cliente tiene su ficha individual.
- El primer producto registrado en la ficha inicia el plazo de un mes de esa ficha. Cada cliente tiene su propio ciclo.
- Un pago parcial reduce el saldo, pero **no reinicia ni modifica el vencimiento original**.
- Las cuentas canceladas pasan a un historial separado de las pendientes.
- Recargo por mora: 5% por mes de atraso, como parámetro configurable.
- Los recargos se registran de forma trazable. No se recalcula el pasado en silencio.
- Se registra quién realizó cada operación importante (auditoría).
- Hay login y las contraseñas se almacenan protegidas.

## Supuestos y decisiones pendientes (no asumir)

- Fórmula exacta del recargo. Propuesta no confirmada: 5 puntos por mes sobre el saldo pendiente al vencimiento, sin capitalizar. Falta confirmar con los propietarios: artículos agregados después del inicio del ciclo, pagos posteriores al vencimiento, orden de imputación del pago (recargo o capital) y qué pasa al reabrir una ficha cancelada.
- Roles de usuario: no definidos. Los dos propietarios usarán el sistema. No asumir roles distintos.
- Qué operaciones se auditan, y cómo se manejan anulaciones, devoluciones y stock negativo.
- Stock calculado desde los movimientos o guardado en un campo.
- Los 1.000 productos y los 50 clientes son datos de dimensionamiento y de prueba, no un inventario real.
- Antes de uso comercial real, el recargo requiere revisión profesional y legal.

## Contexto académico

- El modelo de datos debe quedar normalizado hasta 3FN, y el autor tiene que poder defender el paso a paso.
- Los DFD y el diccionario de datos de Desarrollo de Sistemas II son la base del diseño de datos.
- La estimación (VE, métricas, COCOMO) y los parámetros son del autor. Las propuestas de Claude se explican para que el autor las pueda justificar.
