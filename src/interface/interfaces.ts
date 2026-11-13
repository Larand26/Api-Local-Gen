export interface Iresponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Filtros de texto são listas: vazia = sem filtro; vários valores = qualquer um deles (OU)
export interface IproductFilters {
  id: string[];
  barcode: string[];
  manufacturerCode: string[];
  name: string[];
  brand: string[];
  gender: string[];
  type: string[];
  line: string[];
  material: string[];
  color: string[];
  colorCode: string[];
  minStock: number | null;
  maxStock: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  page: number;
  limit: number;
}
