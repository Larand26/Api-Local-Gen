import OrdersService from "../services/OrdersService.js";

import type { Request, Response } from "express";

abstract class OrdersController {
  static async getOrders(req: Request, res: Response) {
    const result = await OrdersService.getOrders();
    if (result.success) {
      res.status(200).json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  }

  static async getOrdersByCnpj(req: Request, res: Response) {
    const { cnpj } = req.params;

    if (!cnpj || typeof cnpj !== "string") {
      res
        .status(400)
        .json({ error: "CNPJ parameter is required and must be a string" });
      return;
    }

    const result = await OrdersService.getOrdersByCnpj(cnpj);

    if (result.success) {
      res.status(200).json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  }
}

export default OrdersController;
