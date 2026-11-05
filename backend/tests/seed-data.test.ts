import { describe, expect, it } from "vitest";
import { createRandom, generateCustomers, generateProducts, seedCategories } from "../src/helpers/seed-data.js";
import { customerInputSchema } from "../src/validators/customer.validator.js";
import { productInputSchema } from "../src/validators/product.validator.js";

describe("createRandom", () => {
  it("con la misma semilla da siempre la misma secuencia, y con otra semilla, otra", () => {
    const a = createRandom(1);
    const b = createRandom(1);
    const c = createRandom(2);

    const first = [a.next(), a.next(), a.next()];
    expect([b.next(), b.next(), b.next()]).toEqual(first);
    expect([c.next(), c.next(), c.next()]).not.toEqual(first);
  });

  it("int incluye los dos extremos y nunca se sale del rango", () => {
    const random = createRandom(7);
    const values = Array.from({ length: 2000 }, () => random.int(3, 6));

    expect(Math.min(...values)).toBe(3);
    expect(Math.max(...values)).toBe(6);
  });

  it("pickWeighted respeta los pesos y un peso 0 no sale nunca", () => {
    const random = createRandom(9);
    const picks = Array.from({ length: 4000 }, () => random.pickWeighted([["a", 3], ["b", 1], ["c", 0]] as const));

    const a = picks.filter((p) => p === "a").length;
    expect(picks).not.toContain("c");
    expect(a / picks.length).toBeGreaterThan(0.7);
    expect(a / picks.length).toBeLessThan(0.8);
  });

  it("shuffle devuelve los mismos elementos sin modificar la lista original", () => {
    const original = [1, 2, 3, 4, 5, 6];

    const shuffled = createRandom(3).shuffle(original);

    expect([...shuffled].sort()).toEqual(original);
    expect(original).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("chance(0) nunca y chance(1) siempre", () => {
    const random = createRandom(5);

    expect(Array.from({ length: 200 }, () => random.chance(0)).some(Boolean)).toBe(false);
    expect(Array.from({ length: 200 }, () => random.chance(1)).every(Boolean)).toBe(true);
  });
});

describe("generateProducts", () => {
  const products = generateProducts(1000, createRandom(1));
  const categoryNames = seedCategories().map((c) => c.name);

  it("genera exactamente la cantidad pedida, con nombres distintos", () => {
    expect(products).toHaveLength(1000);
    expect(new Set(products.map((p) => p.name)).size).toBe(1000);
  });

  it("los reparte parejo entre las categorías (se diferencian como mucho en 1)", () => {
    const counts = categoryNames.map((name) => products.filter((p) => p.categoryName === name).length);

    expect(counts.every((n) => n > 0)).toBe(true);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it("cada producto es válido para la API (precio con 2 decimales, múltiplo de 50, stock mínimo 3 a 12)", () => {
    for (const product of products) {
      const parsed = productInputSchema.parse({ name: product.name, categoryId: 1, salePrice: product.salePrice, minStock: product.minStock });
      expect(product.salePrice).toMatch(/^\d+\.00$/);
      expect(Number(parsed.salePrice) % 50).toBe(0);
      expect(parsed.minStock).toBeGreaterThanOrEqual(3);
      expect(parsed.minStock).toBeLessThanOrEqual(12);
    }
  });

  it("es repetible: la misma semilla da los mismos productos", () => {
    expect(generateProducts(1000, createRandom(1))).toEqual(products);
    expect(generateProducts(1000, createRandom(2))).not.toEqual(products);
  });

  it("con pocos productos (menos que categorías) usa solo las primeras categorías", () => {
    const few = generateProducts(5, createRandom(1));

    expect(few).toHaveLength(5);
    expect(few.map((p) => p.categoryName)).toEqual(categoryNames.slice(0, 5));
  });

  it("avisa si piden más productos de los que dan las combinaciones", () => {
    expect(() => generateProducts(100000, createRandom(1))).toThrow(/solo da para/);
  });
});

describe("generateCustomers", () => {
  const customers = generateCustomers(50, createRandom(1));

  it("genera la cantidad pedida con nombres y DNI distintos, y cada uno es válido para la API", () => {
    expect(customers).toHaveLength(50);
    expect(new Set(customers.map((c) => c.name)).size).toBe(50);
    expect(new Set(customers.map((c) => c.dni)).size).toBe(50);
    for (const customer of customers) expect(customerInputSchema.safeParse(customer).success).toBe(true);
  });

  it("los DNI son de 8 dígitos y empiezan con 98; todos quedan marcados como dato de prueba", () => {
    for (const customer of customers) {
      expect(customer.dni).toMatch(/^98\d{6}$/);
      expect(customer.notes).toBe("Dato de prueba (seed)");
    }
  });

  it("algunos tienen crédito autorizado y otros no", () => {
    const withCredit = customers.filter((c) => c.creditAuthorized).length;

    expect(withCredit).toBeGreaterThan(5);
    expect(withCredit).toBeLessThan(45);
  });

  it("avisa si piden más clientes de los nombres disponibles", () => {
    expect(() => generateCustomers(10000, createRandom(1))).toThrow(/Solo hay nombres/);
  });
});
