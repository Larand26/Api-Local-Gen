import type { Request, Response } from "express";

import ProductsService from "../services/ProductsService.js";

import type { IproductFilters } from "../interface/interfaces.js";

const DEFAULT_MIN_STOCK = 12;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;
const MAX_VALUES_PER_FILTER = 50;
const MAX_VALUE_LENGTH = 200;

// Lê um parâmetro de texto da query string; vazio ou ausente vira null
const getString = (value: unknown): string | null => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === null) {
    return null;
  }
  const text = String(raw).trim();
  return text === "" ? null : text;
};

// Lê um filtro com vários valores. Aceita tanto "brand=zaxy,ipanema"
// quanto "brand=zaxy&brand=ipanema". Remove vazios e repetidos.
const getList = (value: unknown): string[] => {
  const raw = Array.isArray(value) ? value : [value];
  const values = raw
    .filter((item) => item !== undefined && item !== null)
    .flatMap((item) => String(item).split(","))
    .map((item) => item.trim())
    .filter((item) => item !== "");
  return [...new Set(values)];
};

// Lê um parâmetro numérico; retorna undefined quando o valor é inválido
const getNumber = (value: unknown): number | null | undefined => {
  const text = getString(value);
  if (text === null) {
    return null;
  }
  const number = Number(text.replace(",", "."));
  return Number.isFinite(number) ? number : undefined;
};

abstract class ProductsController {
  static async getProducts(req: Request, res: Response) {
    const numericParams = {
      minStock: getNumber(req.query.minStock),
      maxStock: getNumber(req.query.maxStock),
      minPrice: getNumber(req.query.minPrice),
      maxPrice: getNumber(req.query.maxPrice),
      page: getNumber(req.query.page),
      limit: getNumber(req.query.limit),
    };

    const invalid = Object.entries(numericParams)
      .filter(([, value]) => value === undefined)
      .map(([key]) => key);

    if (invalid.length > 0) {
      res.status(400).json({
        error: `Invalid numeric parameter(s): ${invalid.join(", ")}`,
      });
      return;
    }

    const page = numericParams.page ?? 1;
    const limit = numericParams.limit ?? DEFAULT_LIMIT;

    if (!Number.isInteger(page) || page < 1) {
      res.status(400).json({ error: "page must be an integer >= 1" });
      return;
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      res
        .status(400)
        .json({ error: `limit must be an integer between 1 and ${MAX_LIMIT}` });
      return;
    }

    const listParams = {
      id: getList(req.query.id),
      barcode: getList(req.query.barcode),
      manufacturerCode: getList(req.query.manufacturerCode),
      name: getList(req.query.name),
      brand: getList(req.query.brand),
      gender: getList(req.query.gender),
      type: getList(req.query.type),
      line: getList(req.query.line),
      material: getList(req.query.material),
      color: getList(req.query.color),
      colorCode: getList(req.query.colorCode),
    };

    const tooMany = Object.entries(listParams)
      .filter(
        ([, values]) =>
          values.length > MAX_VALUES_PER_FILTER ||
          values.some((item) => item.length > MAX_VALUE_LENGTH),
      )
      .map(([key]) => key);

    if (tooMany.length > 0) {
      res.status(400).json({
        error: `Too many values (max ${MAX_VALUES_PER_FILTER}) or value too long (max ${MAX_VALUE_LENGTH} chars) in: ${tooMany.join(", ")}`,
      });
      return;
    }

    const filters: IproductFilters = {
      ...listParams,
      // Sem minStock informado, mantém a regra de estoque mínimo de 12
      minStock: numericParams.minStock ?? DEFAULT_MIN_STOCK,
      maxStock: numericParams.maxStock ?? null,
      minPrice: numericParams.minPrice ?? null,
      maxPrice: numericParams.maxPrice ?? null,
      page,
      limit,
    };

    const result = await ProductsService.getProducts(filters);
    if (result.success) {
      res.status(200).json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  }
}

export default ProductsController;
