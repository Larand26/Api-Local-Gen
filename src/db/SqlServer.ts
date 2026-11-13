import sql from "mssql";
import sqlserverConfig from "../config/sqlserverConfig.js";

type SqlValue = string | number | boolean | null;
type QueryParams = Record<string, SqlValue> | SqlValue[];

class SqlServer {
  private pool: sql.ConnectionPool | null = null;
  private connecting: Promise<sql.ConnectionPool> | null = null;

  constructor() {
    this.pool = null;
    this.connecting = null;
  }

  private async connect(): Promise<sql.ConnectionPool> {
    try {
      if (this.pool?.connected) {
        return this.pool;
      }

      if (this.connecting) {
        return this.connecting;
      }

      this.connecting = new sql.ConnectionPool(sqlserverConfig)
        .connect()
        .then((pool) => {
          this.pool = pool;
          return pool;
        })
        .catch((error) => {
          this.pool = null;
          throw error;
        })
        .finally(() => {
          this.connecting = null;
        });

      return this.connecting;
    } catch (error) {
      console.error("Error connecting to SQL Server:", error);
      this.pool = null;
      throw error;
    }
  }

  async close() {
    if (!this.pool) {
      return;
    }

    await this.pool.close();
    this.pool = null;
  }

  async query<T = any>(
    queryString: string,
    params?: QueryParams,
  ): Promise<T[]> {
    try {
      const pool = await this.connect();
      const request = pool.request();
      if (params) {
        if (Array.isArray(params)) {
          params.forEach((value, index) => {
            request.input(index.toString(), value);
          });
        } else {
          Object.entries(params).forEach(([key, value]) => {
            request.input(key, value);
          });
        }
      }
      const result = await request.query(queryString);
      return result.recordset;
    } catch (error) {
      console.error("Error executing query:", error);
      throw error;
    }
  }
}

export default new SqlServer();
