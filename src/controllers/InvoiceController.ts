import InvoiceService from "../services/InvoiceService.js";
import type { Request, Response } from "express";

abstract class InvoiceController {
  static async getInvoices(req: Request, res: Response) {
    try {
      const { from, to } = req.query;
      if (!from || !to) {
        return res.status(400).json({ success: false, error: "Missing date" });
      }
      const fromDate = new Date(String(from));
      const toDate = new Date(String(to));

      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        return res.status(400).json({ success: false, error: "Invalid date" });
      }

      const filters = { dates: { from: fromDate, to: toDate } };
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
