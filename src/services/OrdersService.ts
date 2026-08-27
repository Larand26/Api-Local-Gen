import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import SqlServer from "../db/SqlServer.js";

import type { Iresponse } from "../interface/interfaces.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

abstract class OrdersService {
  private static queryPath = path.resolve(
    __dirname,
    "..",
    "db",
    "query",
    "getOrdersQuery.sql",
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
        `[OrdersService] Erro fatal: Não foi possível carregar a query em ${this.queryPath}`,
      );
      throw error;
    }
  }

  static async getOrders(): Promise<Iresponse> {
    try {
      if (!this.query) {
        throw new Error("SQL query not found");
      }
      const orders = await SqlServer.query(this.query);
      return { success: true, data: orders };
    } catch (error) {
      console.error("Error fetching orders:", error);
      return { success: false, error: "Failed to fetch orders" };
    }
  }

  static async getOrdersByCnpj(cnpj: string): Promise<Iresponse> {
    try {
      const query = `SELECT 
P.[ID_CODENTIDADE] AS entity_id,
P.[ID_NUMPEDORC] AS order_id,
P.[PEDOR_VLRTOTAL] AS total_value,
V.[VEND_NOME] AS seller_name
FROM [PEDIDOORCAMENTO] P
INNER JOIN [ENTIDADES] E ON P.[ID_CODENTIDADE] = E.[ID_CODENTIDADE]
INNER JOIN [VENDEDORES] V ON P.[ID_CODVENDEDOR] = V.[ID_CODVENDEDOR]
WHERE P.[ID_CODFILIAIS] = 1
AND P.[PEDOR_SITUACAO] = 'Atendido'
AND E.[ENTI_CNPJCPF] = @cnpj`;

      const orders = await SqlServer.query(query, { cnpj: cnpj });

      return { success: true, data: orders };
    } catch (error) {
      console.error("Error fetching orders by CNPJ:", error);
      return { success: false, error: "Failed to fetch orders by CNPJ" };
    }
  }
}

export default OrdersService;
