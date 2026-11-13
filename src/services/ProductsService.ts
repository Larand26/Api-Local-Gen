import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import SqlServer from "../db/SqlServer.js";

import type { IproductFilters, Iresponse } from "../interface/interfaces.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

abstract class ProductsService {
  private static queryPath = path.resolve(
    __dirname,
    "..",
    "db",
    "query",
    "getProductsQuery.sql",
  );
  private static query: string | null = null;

  static async initialize() {
    try {
      if (this.query) {
        return;
      }
      this.query = await fs.readFile(this.queryPath, "utf8");
    } catch (error) {
      console.error(
        `[ProductsService] Erro fatal: Não foi possível carregar a query em ${this.queryPath}`,
      );
      throw error;
    }
  }

  // Escapa os curingas do LIKE para que %, _ e [ enviados pelo cliente sejam tratados como texto
  private static escapeLike(value: string): string {
    return value.replace(/[[%_]/g, (char) => `[${char}]`);
  }

  // Monta a lista no formato "<v>valor1</v><v>valor2</v>" lido pela query; lista vazia = null (sem filtro)
  private static toXmlList(
    values: string[],
    { like = false }: { like?: boolean } = {},
  ): string | null {
    if (values.length === 0) {
      return null;
    }
    return values
      .map((value) => (like ? this.escapeLike(value) : value))
      .map(
        (value) =>
          `<v>${value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")}</v>`,
      )
      .join("");
  }

  static async getProducts(filters: IproductFilters): Promise<Iresponse> {
    try {
      if (!this.query) {
        throw new Error("SQL query not found");
      }

      const rows = await SqlServer.query(this.query, {
        id: this.toXmlList(filters.id),
        barcode: this.toXmlList(filters.barcode),
        manufacturerCode: this.toXmlList(filters.manufacturerCode),
        colorCode: this.toXmlList(filters.colorCode),
        name: this.toXmlList(filters.name, { like: true }),
        brand: this.toXmlList(filters.brand, { like: true }),
        gender: this.toXmlList(filters.gender, { like: true }),
        type: this.toXmlList(filters.type, { like: true }),
        line: this.toXmlList(filters.line, { like: true }),
        material: this.toXmlList(filters.material, { like: true }),
        color: this.toXmlList(filters.color, { like: true }),
        minStock: filters.minStock,
        maxStock: filters.maxStock,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        offset: (filters.page - 1) * filters.limit,
        limit: filters.limit,
      });

      const total = rows[0]?.total_count ?? 0;
      const data = rows.map(({ total_count, ...product }) => product);

      return {
        success: true,
        data: {
          page: filters.page,
          limit: filters.limit,
          total,
          totalPages: Math.ceil(total / filters.limit),
          data,
        },
      };
    } catch (error) {
      console.error("Error fetching products:", error);
      return { success: false, error: "Failed to fetch products" };
    }
  }
}

export default ProductsService;
