//import { ReactNode } from "react";

// Define the Product interface
export interface Product {
  id: string;
  name: string;
  description?: string | null;
  sku: string;
  price: number;
  quantity: number;
  status?: string;
  createdAt: Date | string;
  updatedAt?: Date | string;
  userId: string;
  categoryId: string;
  supplierId: string;
  category?: string;
  supplier?: string;
}

export interface ProductInvoice {
  id: string;
  userId: string;
  productId: string;
  requestId?: string | null;
  invoiceNumber: string;
  reqNumber?: string | null;
  issuedAt: Date | string;
  quantity: number;
  unitPrice: number;
  notes?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export type ProductUnitStatus = "IN_STOCK" | "ACQUIRED";

export interface ProductUnit {
  id: string;
  code: string;
  status: ProductUnitStatus;
  productId: string;
  invoiceId?: string | null;
  acquiredByUserId?: string | null;
  createdAt: Date | string;
  acquiredAt?: Date | string | null;
}

// Define the Supplier interface
export interface Supplier {
  id: string;
  name: string;
  // Multi-tenant: DB column is userId but Prisma field is tenantId.
  // Keep both optional to be compatible with existing code paths.
  tenantId?: string;
  userId?: string;

  nif?: string | null;
  email?: string | null;
  phone?: string | null;
  contactName?: string | null;
  address?: string | null;
  notes?: string | null;

  isActive?: boolean;

  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// Define the Category interface
export interface Category {
  id: string;
  name: string;
  userId: string;
}

export type RequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "FULFILLED";

export interface RequestItem {
  id: string;
  requestId: string;
  productId: string;
  quantity: number;
  notes?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  product?: {
    id: string;
    name: string;
    sku: string;
  };
}

export interface Request {
  id: string;
  userId: string;
  status: RequestStatus;
  title?: string | null;
  notes?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  items: RequestItem[];
  invoices?: Array<{
    id: string;
    invoiceNumber: string;
    issuedAt: Date | string;
    productId: string;
  }>;
}
