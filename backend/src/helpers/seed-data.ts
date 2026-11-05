// Datos de prueba para llenar una base de desarrollo (npm run db:seed). Todo es INVENTADO: nombres, precios,
// DNI y teléfonos no corresponden al inventario ni a los clientes reales de la librería (CLAUDE.md: no inventar
// datos de la empresa; esto es solo material de prueba). Son funciones puras y deterministas: con la misma
// semilla generan siempre lo mismo, así dos personas ven los mismos datos.

// Generador de números al azar con semilla (mulberry32). Math.random no sirve: no se puede repetir.
export function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next, // número entre 0 (incluido) y 1 (excluido)
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)), // entero entre min y max, ambos incluidos
    chance: (probability: number) => next() < probability,
    pick: <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]!,
    // Elige según pesos: pickWeighted([["a", 3], ["b", 1]]) da "a" tres veces de cada cuatro.
    pickWeighted<T>(list: readonly (readonly [T, number])[]): T {
      const total = list.reduce((sum, [, weight]) => sum + weight, 0);
      let point = next() * total;
      for (const [value, weight] of list) {
        point -= weight;
        if (point < 0) return value;
      }
      return list[list.length - 1]![0];
    },
    shuffle<T>(list: readonly T[]): T[] {
      const copy = [...list];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      }
      return copy;
    },
  };
}
export type Random = ReturnType<typeof createRandom>;

type CategoryTemplate = {
  name: string;
  types: string[]; // qué es el producto
  variants: string[]; // característica principal
  extras: string[]; // color, tamaño o presentación
  price: [number, number]; // rango de precio inventado, en pesos
};

const CATEGORIES: CategoryTemplate[] = [
  { name: "Cuadernos y blocks", types: ["Cuaderno tapa dura", "Cuaderno espiral", "Block de dibujo", "Block de notas", "Libreta"], variants: ["rayado", "cuadriculado", "liso", "48 hojas", "84 hojas", "A4"], extras: ["azul", "rojo", "verde", "negro", "surtido"], price: [1800, 9500] },
  { name: "Escritura", types: ["Lapicera", "Birome", "Lápiz negro", "Marcador", "Portaminas"], variants: ["trazo fino", "trazo medio", "punta gruesa", "borrable", "gel", "x 6"], extras: ["azul", "negro", "rojo", "verde", "surtido"], price: [300, 4200] },
  { name: "Colores y arte", types: ["Lápices de colores", "Fibras", "Crayones", "Témperas", "Acuarelas"], variants: ["x 6", "x 12", "x 24", "escolar", "profesional", "lavables"], extras: ["caja", "estuche", "blister", "set", "pote"], price: [1200, 12000] },
  { name: "Papelería", types: ["Resma", "Cartulina", "Papel afiche", "Papel glasé", "Papel autoadhesivo"], variants: ["A4", "A3", "oficio", "75 g", "80 g", "x 100 hojas"], extras: ["blanco", "color", "surtido", "pastel", "fluo"], price: [700, 14000] },
  { name: "Carpetas y archivo", types: ["Carpeta", "Folio", "Bibliorato", "Sobre", "Clasificador"], variants: ["oficio", "A4", "con elástico", "con anillos", "transparente", "x 10"], extras: ["azul", "negro", "rojo", "gris", "surtido"], price: [500, 8500] },
  { name: "Mochilas y cartucheras", types: ["Mochila", "Cartuchera", "Lonchera", "Riñonera", "Estuche"], variants: ["escolar", "juvenil", "de tela", "con cierre", "doble", "chica"], extras: ["azul", "negro", "rosa", "gris", "estampada"], price: [3500, 38000] },
  { name: "Geometría y dibujo técnico", types: ["Regla", "Escuadra", "Transportador", "Compás", "Juego de geometría"], variants: ["15 cm", "20 cm", "30 cm", "plástico", "metal", "flexible"], extras: ["transparente", "azul", "negra", "surtida", "estuche"], price: [350, 7800] },
  { name: "Adhesivos y corrección", types: ["Plasticola", "Adhesivo en barra", "Cinta adhesiva", "Corrector", "Pegamento"], variants: ["chico", "mediano", "grande", "transparente", "escolar", "x 3"], extras: ["blanca", "incolora", "surtida", "blister", "pack"], price: [400, 5600] },
  { name: "Oficina", types: ["Abrochadora", "Perforadora", "Tijera", "Clips", "Broches"], variants: ["chica", "mediana", "reforzada", "x 100", "x 50", "de escritorio"], extras: ["negra", "azul", "metal", "plástico", "caja"], price: [600, 16500] },
  { name: "Manualidades", types: ["Goma Eva", "Cartón corrugado", "Papel crepe", "Lana", "Pompones"], variants: ["A4", "pliego", "x 10", "x 20", "con brillo", "mixto"], extras: ["colores", "pastel", "neón", "metalizado", "surtido"], price: [500, 9000] },
  { name: "Libros y lectura", types: ["Libro de cuentos", "Libro para colorear", "Diccionario", "Atlas", "Cuaderno de actividades"], variants: ["infantil", "ilustrado", "tapa blanda", "tapa dura", "primaria", "bolsillo"], extras: ["edición de prueba", "colección A", "colección B", "reimpresión", "oferta"], price: [2500, 24000] },
  { name: "Regalería y varios", types: ["Taza", "Almohadilla", "Llavero", "Tarjeta", "Bolsa de regalo"], variants: ["chica", "mediana", "grande", "lisa", "estampada", "x 12"], extras: ["rosa", "azul", "dorada", "blanca", "surtida"], price: [800, 18000] },
];

export type SeedCategory = { name: string };
export type SeedProduct = { name: string; categoryName: string; salePrice: string; minStock: number };
export type SeedCustomer = { name: string; phone: string; dni: string; notes: string; creditAuthorized: boolean };

export const seedCategories = (): SeedCategory[] => CATEGORIES.map(({ name }) => ({ name }));

// Redondea a múltiplos de 50 pesos, como suelen estar los precios de un comercio chico.
const roundTo50 = (amount: number) => Math.max(50, Math.round(amount / 50) * 50);
export const asMoney = (amount: number) => amount.toFixed(2);

// Genera `count` productos repartidos parejo entre las categorías, todos con nombre distinto.
// Se combinan tipo × característica × presentación, y se eligen combinaciones al azar sin repetir.
export function generateProducts(count: number, random: Random): SeedProduct[] {
  const products: SeedProduct[] = [];

  CATEGORIES.forEach((category, index) => {
    const quota = Math.floor(count / CATEGORIES.length) + (index < count % CATEGORIES.length ? 1 : 0);
    const names: string[] = [];
    for (const type of category.types) {
      for (const variant of category.variants) {
        for (const extra of category.extras) names.push(`${type} ${variant} ${extra}`);
      }
    }
    if (quota > names.length) throw new Error(`La categoría "${category.name}" solo da para ${names.length} productos`);

    for (const name of random.shuffle(names).slice(0, quota)) {
      const [min, max] = category.price;
      products.push({
        name,
        categoryName: category.name,
        salePrice: asMoney(roundTo50(min + random.next() * (max - min))),
        minStock: random.int(3, 12),
      });
    }
  });
  return products;
}

const FIRST_NAMES = ["Ana", "Beatriz", "Carlos", "Daniela", "Eduardo", "Fabiana", "Gustavo", "Hilda", "Ignacio", "Julia", "Karina", "Luis", "Marta", "Nicolás", "Olga", "Pablo", "Rosa", "Sergio", "Teresa", "Valentín", "Walter", "Yamila", "Zulema", "Ramón", "Silvia", "Matías", "Lorena", "Facundo", "Noelia", "Héctor"];
const LAST_NAMES = ["Acosta", "Benítez", "Cáceres", "Duarte", "Escobar", "Fernández", "Gómez", "Herrera", "Ibarra", "Jara", "Insfrán", "López", "Mendoza", "Núñez", "Ojeda", "Peralta", "Quiroga", "Ramírez", "Sosa", "Torres", "Ullúa", "Vera", "Villalba", "Yegros", "Zárate", "Aguirre", "Britez", "Centurión", "Delgado", "Flores"];

// Genera `count` clientes con nombre, DNI y teléfono inventados y distintos entre sí.
// Los DNI empiezan con 98 para no coincidir con los de personas reales de uso corriente; igual son ficticios.
// Cerca del 40% tiene el crédito autorizado.
export function generateCustomers(count: number, random: Random): SeedCustomer[] {
  const pairs = random.shuffle(FIRST_NAMES.flatMap((first) => LAST_NAMES.map((last) => `${first} ${last}`)));
  if (count > pairs.length) throw new Error(`Solo hay nombres para ${pairs.length} clientes`);
  const dnis = new Set<string>();
  while (dnis.size < count) dnis.add(`98${String(random.int(0, 999999)).padStart(6, "0")}`);
  const dniList = [...dnis];

  return pairs.slice(0, count).map((name, i) => ({
    name,
    dni: dniList[i]!,
    phone: `370 4${String(random.int(0, 999999)).padStart(6, "0")}`,
    notes: "Dato de prueba (seed)",
    creditAuthorized: random.chance(0.4),
  }));
}
