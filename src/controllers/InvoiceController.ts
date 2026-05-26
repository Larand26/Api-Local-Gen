import InvoiceService from "../services/InvoiceService.js";
import type { Request, Response } from "express";

abstract class InvoiceController {
  static async getInvoices(req: Request, res: Response) {
    try {
      const { from, to } = req.body;
      if (!from || !to) {
        return res.status(400).json({ success: false, error: "Missing date" });
      }
      const filters = { dates: { from: new Date(from), to: new Date(to) } };
      const result = await InvoiceService.getInvoices(filters);
      if (!result.success) {
        return res.status(500).json({ success: false, error: result.error });
      }
      res.status(200).json(result);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res
        .status(500)
        .json({ success: false, error: "Error fetching invoices" });
    }
  }
}

export default InvoiceController;
