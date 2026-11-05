// Búsqueda por nombre sin distinguir mayúsculas ni tildes ("lapiz" encuentra "Lápiz").
export const normalizeText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

// Todas las palabras escritas tienen que estar en el nombre, en cualquier orden ("goma eva" encuentra "Eva goma brillante").
export function matchesName(name: string, query: string): boolean {
  const words = normalizeText(query).split(/\s+/).filter(Boolean)
  const target = normalizeText(name)
  return words.every((word) => target.includes(word))
}

// Filtra una lista por el nombre de cada elemento. Con la búsqueda vacía devuelve todo.
// `keep` son elementos que se conservan siempre (por ejemplo, el que ya está elegido en una lista desplegable).
export function filterByName<T extends { id: number; name: string }>(items: T[], query: string, keep?: number | null): T[] {
  if (!query.trim()) return items
  return items.filter((item) => item.id === keep || matchesName(item.name, query))
}
