import { vi } from 'vitest'

// Un pedido que hizo la app a la API simulada.
export type MockCall = { method: string; path: string; query: URLSearchParams; body: unknown }

// Lo que puede responder una ruta simulada:
// un Response ya armado, un Error (red caída), un objeto (se envía como JSON 200) o nada (204).
type Reply = Response | Error | object | undefined
type Handler = (call: MockCall) => Reply

// Reemplaza fetch por una API falsa. Las rutas se escriben como 'GET /api/products'.
// Devuelve la lista de pedidos recibidos para poder comprobar qué le mandó la app.
export function mockApi(routes: Record<string, Handler>) {
  const calls: MockCall[] = []

  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input, 'http://localhost')
    const call: MockCall = {
      method: init?.method ?? 'GET',
      path: url.pathname,
      query: url.searchParams,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    }
    calls.push(call)

    const handler = routes[`${call.method} ${call.path}`]
    if (!handler) {
      return Response.json({ error: `Ruta no simulada: ${call.method} ${call.path}` }, { status: 404 })
    }

    const reply = handler(call)
    if (reply instanceof Error) throw reply
    if (reply instanceof Response) return reply
    if (reply === undefined) return new Response(null, { status: 204 })
    return Response.json(reply)
  })

  vi.stubGlobal('fetch', fetchMock)
  return { calls, fetchMock }
}
