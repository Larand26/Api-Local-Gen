import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import SqlServer from "../db/SqlServer.js";
import Utils from "../utils/Utils.js";

import type { Iresponse } from "../interface/interfaces.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

abstract class InvoiceService {
  private static queryPath = path.resolve(
    __dirname,
    "..",
    "db",
    "query",
    "getInvoicesQuery.sql",
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
        `[InvoiceService] Erro fatal: Não foi possível carregar a query em ${this.queryPath}`,
      );
      throw error;
    }
  }

  static async getInvoices(filters: {
    dates: { from: Date; to: Date };
  }): Promise<Iresponse> {
    try {
      if (!this.query) {
        await this.initialize();
      }

      if (!this.query) {
        throw new Error("SQL query not found");
      }
      const invoices = await SqlServer.query(this.query, {
        dataFrom: Utils.formatDateToSql(filters?.dates.from),
        dataTo: Utils.formatDateToSql(filters?.dates.to),
      });
      return { success: true, data: invoices };
    } catch (error) {
      console.error("Error fetching invoices:", error);
      return { success: false, error: "Failed to fetch invoices" };
    }
  }
}

export default InvoiceService;
