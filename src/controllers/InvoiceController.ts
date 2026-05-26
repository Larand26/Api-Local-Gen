import InvoiceService from "../services/InvoiceService.js";
import type { Request, Response } from "express";

abstract class InvoiceController {
  static async getInvoices(req: Request, res: Response) {
    try {
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Error fetching invoices" });
    }
  }
}

export default InvoiceController;
