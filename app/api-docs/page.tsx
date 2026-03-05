"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FiCode, FiDatabase, FiKey, FiPackage, FiUsers } from "react-icons/fi";
import AuthenticatedLayout from "../components/AuthenticatedLayout";

export default function ApiDocsPage() {
  const endpoints = [
    {
      name: "Authentication",
      icon: FiKey,
      endpoints: [
        {
          method: "POST",
          path: "/api/auth/login",
          description: "Authenticate user and create a session (sets HTTP-only cookie session_id)",
          parameters: [
            { name: "header.x-tenant-slug", type: "string", required: false, description: "Tenant slug (optional). If omitted, uses DEFAULT_TENANT_SLUG or 'default'" },
            { name: "email", type: "string", required: true, description: "User's email address" },
            { name: "password", type: "string", required: true, description: "User's password" }
          ],
          response: {
            success: { status: 200, data: "{ userId: string, userName: string, userEmail: string }" },
            error: { status: 401, data: "{ error: string } | { code: 'IP_NOT_ALLOWED', message: string } | { error: 'Too many login attempts...', retryAfterSeconds: number }" }
          }
        },
        {
          method: "POST",
          path: "/api/auth/logout",
          description: "Logout user and clear session",
          parameters: [],
          response: {
            success: { status: 204, data: "(no content)" },
            error: { status: 500, data: "{ error: string }" }
          }
        },
        {
          method: "GET",
          path: "/api/auth/session",
          description: "Get current user session",
          parameters: [],
          response: {
            success: { status: 200, data: "{ id: string, tenantId: string, name: string, email: string, role: 'USER'|'ADMIN', isActive: boolean, createdAt: string, updatedAt: string }" },
            error: { status: 401, data: "{ error: string }" }
          }
        },
        {
          method: "POST",
          path: "/api/auth/register",
          description: "Public registration is disabled (users are provisioned by an ADMIN)",
          parameters: [],
          response: {
            success: { status: 403, data: "{ error: 'Registration disabled', code: 'REGISTRATION_DISABLED' }" },
            error: { status: 405, data: "{ error: string }" }
          }
        }
      ]
    },
    {
      name: "Catalog",
      icon: FiPackage,
      endpoints: [
        {
          method: "GET",
          path: "/api/products",
          description: "List all products for the current tenant",
          parameters: [],
          response: {
            success: { status: 200, data: "Product[]" },
            error: { status: 401, data: "{ error: string }" }
          }
        },
        {
          method: "GET",
          path: "/api/products/[id]",
          description: "Get a single product by id",
          parameters: [
            { name: "path.id", type: "string", required: true, description: "Product ID" }
          ],
          response: {
            success: { status: 200, data: "Product" },
            error: { status: 404, data: "{ error: string }" }
          }
        },
        {
          method: "POST",
          path: "/api/products",
          description: "Create a new product",
          parameters: [
            { name: "name", type: "string", required: true, description: "Product name" },
            { name: "sku", type: "string", required: true, description: "Unique SKU" },
            { name: "price", type: "number", required: true, description: "Product price" },
            { name: "quantity", type: "number", required: true, description: "Product quantity" },
            { name: "status", type: "string", required: true, description: "Product status" },
            { name: "categoryId", type: "string", required: true, description: "Category ID" },
            { name: "supplierId", type: "string", required: true, description: "Supplier ID" }
          ],
          response: {
            success: { status: 201, data: "Product" },
            error: { status: 400, data: "{ error: string }" }
          }
        },
        {
          method: "PUT",
          path: "/api/products",
          description: "Update an existing product",
          parameters: [
            { name: "id", type: "string", required: true, description: "Product ID" },
            { name: "name", type: "string", required: true, description: "Product name" },
            { name: "sku", type: "string", required: true, description: "Unique SKU" },
            { name: "price", type: "number", required: true, description: "Product price" },
            { name: "quantity", type: "number", required: true, description: "Product quantity" },
            { name: "status", type: "string", required: true, description: "Product status" },
            { name: "categoryId", type: "string", required: true, description: "Category ID" },
            { name: "supplierId", type: "string", required: true, description: "Supplier ID" }
          ],
          response: {
            success: { status: 200, data: "Product" },
            error: { status: 400, data: "{ error: string }" }
          }
        },
        {
          method: "DELETE",
          path: "/api/products",
          description: "Delete a product",
          parameters: [
            { name: "id", type: "string", required: true, description: "Product ID" }
          ],
          response: {
            success: { status: 204, data: "(no content)" },
            error: { status: 404, data: "{ error: string }" }
          }
        },
        {
          method: "GET",
          path: "/api/categories",
          description: "List all categories for the current tenant",
          parameters: [],
          response: {
            success: { status: 200, data: "Category[]" },
            error: { status: 401, data: "{ error: string }" }
          }
        },
        {
          method: "POST",
          path: "/api/categories",
          description: "Create a new category",
          parameters: [
            { name: "name", type: "string", required: true, description: "Category name" }
          ],
          response: {
            success: { status: 201, data: "Category" },
            error: { status: 400, data: "{ error: string }" }
          }
        },
        {
          method: "PUT",
          path: "/api/categories",
          description: "Update an existing category",
          parameters: [
            { name: "id", type: "string", required: true, description: "Category ID" },
            { name: "name", type: "string", required: true, description: "Category name" }
          ],
          response: {
            success: { status: 200, data: "Category" },
            error: { status: 400, data: "{ error: string }" }
          }
        },
        {
          method: "DELETE",
          path: "/api/categories",
          description: "Delete a category",
          parameters: [
            { name: "id", type: "string", required: true, description: "Category ID" }
          ],
          response: {
            success: { status: 204, data: "(no content)" },
            error: { status: 409, data: "{ error: string }" }
          }
        },
        {
          method: "GET",
          path: "/api/suppliers",
          description: "List all suppliers for the current tenant",
          parameters: [],
          response: {
            success: { status: 200, data: "Supplier[]" },
            error: { status: 401, data: "{ error: string }" }
          }
        },
        {
          method: "POST",
          path: "/api/suppliers",
          description: "Create a new supplier",
          parameters: [
            { name: "name", type: "string", required: true, description: "Supplier name" },
            { name: "email", type: "string", required: false, description: "Supplier email" },
            { name: "phone", type: "string", required: false, description: "Supplier phone" }
          ],
          response: {
            success: { status: 201, data: "Supplier" },
            error: { status: 400, data: "{ error: string }" }
          }
        },
        {
          method: "PUT",
          path: "/api/suppliers",
          description: "Update an existing supplier",
          parameters: [
            { name: "id", type: "string", required: true, description: "Supplier ID" },
            { name: "name", type: "string", required: true, description: "Supplier name" },
            { name: "email", type: "string", required: false, description: "Supplier email" },
            { name: "phone", type: "string", required: false, description: "Supplier phone" }
          ],
          response: {
            success: { status: 200, data: "Supplier" },
            error: { status: 400, data: "{ error: string }" }
          }
        },
        {
          method: "DELETE",
          path: "/api/suppliers",
          description: "Delete a supplier",
          parameters: [
            { name: "id", type: "string", required: true, description: "Supplier ID" }
          ],
          response: {
            success: { status: 204, data: "(no content)" },
            error: { status: 404, data: "{ error: string }" }
          }
        }
      ]
    },
    {
      name: "Requesting Services",
      icon: FiDatabase,
      endpoints: [
        {
          method: "GET",
          path: "/api/requesting-services",
          description: "List requesting services (inactive services are hidden unless ADMIN and includeInactive=1)",
          parameters: [
            { name: "query.includeInactive", type: "string", required: false, description: "Use '1' (ADMIN only) to include inactive" }
          ],
          response: {
            success: { status: 200, data: "RequestingService[]" },
            error: { status: 401, data: "{ error: string }" }
          }
        },
        {
          method: "POST",
          path: "/api/requesting-services",
          description: "Create requesting service (ADMIN only)",
          parameters: [
            { name: "codigo", type: "string", required: true, description: "Short code" },
            { name: "designacao", type: "string", required: true, description: "Service name" },
            { name: "ativo", type: "boolean", required: false, description: "Active flag" }
          ],
          response: {
            success: { status: 201, data: "RequestingService" },
            error: { status: 403, data: "{ error: string }" }
          }
        },
        {
          method: "PATCH",
          path: "/api/requesting-services/[id]",
          description: "Update requesting service (ADMIN only)",
          parameters: [
            { name: "path.id", type: "number", required: true, description: "Service ID" },
            { name: "codigo", type: "string", required: false, description: "Short code" },
            { name: "designacao", type: "string", required: false, description: "Service name" },
            { name: "ativo", type: "boolean", required: false, description: "Active flag" }
          ],
          response: {
            success: { status: 200, data: "RequestingService" },
            error: { status: 404, data: "{ error: string }" }
          }
        }
      ]
    },
    {
      name: "Requests (GTMI)",
      icon: FiDatabase,
      endpoints: [
        {
          method: "GET",
          path: "/api/requests",
          description: "List requests (tenant-wide by default). Filters: mine=1 or (ADMIN only) asUserId",
          parameters: [
            { name: "query.mine", type: "string", required: false, description: "Use '1' to show only my requests" },
            { name: "query.asUserId", type: "string", required: false, description: "ADMIN only: filter by request owner user id" }
          ],
          response: {
            success: { status: 200, data: "Request[]" },
            error: { status: 401, data: "{ error: string }" }
          }
        },
        {
          method: "POST",
          path: "/api/requests",
          description: "Create a request and allocate stock (creates GTMI number and creates stock movements)",
          parameters: [
            { name: "requestingServiceId", type: "number", required: true, description: "Requesting service id" },
            { name: "title", type: "string", required: false, description: "Optional title" },
            { name: "notes", type: "string", required: false, description: "Optional notes" },
            { name: "requestedAt", type: "string", required: false, description: "ISO date" },
            { name: "goodsTypes", type: "GoodsType[]", required: false, description: "Goods type flags" },
            { name: "items", type: "Array", required: true, description: "[{ productId, quantity, notes?, unit?, reference?, destination? }]" }
          ],
          response: {
            success: { status: 201, data: "Request" },
            error: { status: 400, data: "{ error: string, code?: string, details?: any }" }
          }
        },
        {
          method: "GET",
          path: "/api/requests/[id]",
          description: "Get full request details (includes items, invoices, latestInvoices)",
          parameters: [
            { name: "path.id", type: "string", required: true, description: "Request ID" }
          ],
          response: {
            success: { status: 200, data: "Request" },
            error: { status: 404, data: "{ error: string }" }
          }
        },
        {
          method: "PATCH",
          path: "/api/requests/[id]",
          description: "Update request fields, manage signature/pickup signature, and update item fields (owner or ADMIN)",
          parameters: [
            { name: "path.id", type: "string", required: true, description: "Request ID" },
            { name: "status", type: "RequestStatus", required: false, description: "Optional status transition" },
            { name: "sign", type: "{ name: string, title?: string }", required: false, description: "Sign the request" },
            { name: "voidSign", type: "{ reason: string }", required: false, description: "Void signature" },
            { name: "pickupSign", type: "{ name: string, title?: string, signatureDataUrl: string }", required: false, description: "Register pickup signature" },
            { name: "voidPickupSign", type: "{ reason: string }", required: false, description: "Void pickup signature" }
          ],
          response: {
            success: { status: 200, data: "Request" },
            error: { status: 409, data: "{ error: string }" }
          }
        },
        {
          method: "GET",
          path: "/api/requests/notifications",
          description: "Latest requests for notification bell",
          parameters: [
            { name: "query.limit", type: "number", required: false, description: "Max 100 (default 20)" }
          ],
          response: {
            success: { status: 200, data: "Array" },
            error: { status: 401, data: "{ error: string }" }
          }
        },
        {
          method: "GET",
          path: "/api/requests/user-intake",
          description: "Get prefilled metadata for the internal USER intake form",
          parameters: [],
          response: {
            success: { status: 200, data: "{ requestingService, requesterName, requestedAt }" },
            error: { status: 403, data: "{ error: string }" }
          }
        },
        {
          method: "POST",
          path: "/api/requests/user-intake",
          description: "Submit internal intake request (USER, no PIN)",
          parameters: [
            { name: "title", type: "string", required: false, description: "Optional title" },
            { name: "deliveryLocation", type: "string", required: true, description: "Delivery location" },
            { name: "notes", type: "string", required: true, description: "Request justification" }
          ],
          response: {
            success: { status: 201, data: "{ ok: true, id: string }" },
            error: { status: 400, data: "{ error: string }" }
          }
        }
      ]
    },
    {
      name: "Units (QR Items)",
      icon: FiPackage,
      endpoints: [
        {
          method: "GET",
          path: "/api/units",
          description: "Paginated unit list for a product or invoice",
          parameters: [
            { name: "query.invoiceId", type: "string", required: false, description: "Filter by invoice id" },
            { name: "query.productId", type: "string", required: false, description: "Filter by product id" },
            { name: "query.cursor", type: "string", required: false, description: "Cursor (unit id)" },
            { name: "query.limit", type: "number", required: false, description: "Max 200 (default 50)" }
          ],
          response: {
            success: { status: 200, data: "{ items: ProductUnit[], nextCursor: string|null }" },
            error: { status: 400, data: "{ error: string }" }
          }
        },
        {
          method: "GET",
          path: "/api/units/available",
          description: "Find available IN_STOCK units for a product (for allocation)",
          parameters: [
            { name: "query.productId", type: "string", required: true, description: "Product id" },
            { name: "query.take", type: "number", required: false, description: "How many to return (default 1)" },
            { name: "query.exclude", type: "string|string[]", required: false, description: "Exclude unit codes" }
          ],
          response: {
            success: { status: 200, data: "{ availableCount: number, items: Array<{id:string, code:string}> }" },
            error: { status: 400, data: "{ error: string }" }
          }
        },
        {
          method: "GET",
          path: "/api/units/lookup",
          description: "Lookup a unit by QR code",
          parameters: [
            { name: "query.code", type: "string", required: true, description: "Unit code (uuid)" }
          ],
          response: {
            success: { status: 200, data: "ProductUnit" },
            error: { status: 404, data: "{ error: string }" }
          }
        },
        {
          method: "PATCH",
          path: "/api/units/[id]",
          description: "Edit unit metadata (serialNumber/partNumber/assetTag/notes)",
          parameters: [
            { name: "query.id", type: "string", required: true, description: "Unit ID" },
            { name: "serialNumber", type: "string|null", required: false, description: "Serial number" },
            { name: "partNumber", type: "string|null", required: false, description: "Part number" },
            { name: "assetTag", type: "string|null", required: false, description: "Asset tag" },
            { name: "notes", type: "string|null", required: false, description: "Notes" }
          ],
          response: {
            success: { status: 200, data: "ProductUnit" },
            error: { status: 409, data: "{ error: string }" }
          }
        },
        {
          method: "POST",
          path: "/api/units/acquire",
          description: "Acquire a unit (OUT movement; decrements product quantity)",
          parameters: [
            { name: "code", type: "string", required: true, description: "Unit code (uuid)" },
            { name: "assignedToUserId", type: "string|null", required: false, description: "Assign to user" },
            { name: "reason", type: "string|null", required: false, description: "Reason" }
          ],
          response: {
            success: { status: 200, data: "{ unit: ProductUnit, product: { id: string, quantity: number, status: string } }" },
            error: { status: 404, data: "{ error: string }" }
          }
        },
        {
          method: "POST",
          path: "/api/units/return",
          description: "Return a unit to stock (RETURN movement; increments product quantity)",
          parameters: [
            { name: "code", type: "string", required: true, description: "Unit code (uuid)" },
            { name: "reason", type: "string|null", required: false, description: "Reason" }
          ],
          response: {
            success: { status: 200, data: "{ unit: ProductUnit, product: { id: string, quantity: number, status: string } }" },
            error: { status: 400, data: "{ error: string }" }
          }
        },
        {
          method: "POST",
          path: "/api/units/repair-out",
          description: "Mark unit as IN_REPAIR (may decrement stock if it was IN_STOCK)",
          parameters: [
            { name: "code", type: "string", required: true, description: "Unit code (uuid)" }
          ],
          response: {
            success: { status: 200, data: "{ unit: ProductUnit, product: { id: string, quantity: number, status: string } }" },
            error: { status: 400, data: "{ error: string }" }
          }
        },
        {
          method: "POST",
          path: "/api/units/repair-in",
          description: "Bring unit back from repair to IN_STOCK (increments stock)",
          parameters: [
            { name: "code", type: "string", required: true, description: "Unit code (uuid)" }
          ],
          response: {
            success: { status: 200, data: "{ unit: ProductUnit, product: { id: string, quantity: number, status: string } }" },
            error: { status: 400, data: "{ error: string }" }
          }
        },
        {
          method: "POST",
          path: "/api/units/scrap",
          description: "Scrap a unit (SCRAP movement; may decrement stock)",
          parameters: [
            { name: "code", type: "string", required: true, description: "Unit code (uuid)" }
          ],
          response: {
            success: { status: 200, data: "{ unit: ProductUnit, product: { id: string, quantity: number, status: string } }" },
            error: { status: 400, data: "{ error: string }" }
          }
        },
        {
          method: "POST",
          path: "/api/units/lost",
          description: "Mark a unit as LOST (LOST movement; may decrement stock)",
          parameters: [
            { name: "code", type: "string", required: true, description: "Unit code (uuid)" }
          ],
          response: {
            success: { status: 200, data: "{ unit: ProductUnit, product: { id: string, quantity: number, status: string } }" },
            error: { status: 400, data: "{ error: string }" }
          }
        }
      ]
    },
    {
      name: "Stock Movements",
      icon: FiDatabase,
      endpoints: [
        {
          method: "GET",
          path: "/api/stock-movements",
          description: "Query stock movements with pagination and filters",
          parameters: [
            { name: "query.productId", type: "string", required: false, description: "Filter by product id" },
            { name: "query.unitId", type: "string", required: false, description: "Filter by unit id" },
            { name: "query.type", type: "string", required: false, description: "IN|OUT|RETURN|REPAIR_OUT|REPAIR_IN|SCRAP|LOST" },
            { name: "query.invoiceNumber", type: "string", required: false, description: "Filter by invoice number" },
            { name: "query.reqNumber", type: "string", required: false, description: "Filter by req number" },
            { name: "query.requestId", type: "string", required: false, description: "Filter by request id" },
            { name: "query.q", type: "string", required: false, description: "Free text search" },
            { name: "query.limit", type: "number", required: false, description: "Max 100" },
            { name: "query.cursor", type: "string", required: false, description: "Cursor (movement id)" }
          ],
          response: {
            success: { status: 200, data: "{ items: StockMovement[], nextCursor: string|null }" },
            error: { status: 400, data: "{ error: string }" }
          }
        }
      ]
    },
    {
      name: "Invoices",
      icon: FiDatabase,
      endpoints: [
        {
          method: "GET",
          path: "/api/invoices",
          description: "List invoices for a product",
          parameters: [
            { name: "query.productId", type: "string", required: true, description: "Product id" },
            { name: "query.take", type: "number", required: false, description: "Limit (max 50)" }
          ],
          response: {
            success: { status: 200, data: "ProductInvoice[]" },
            error: { status: 404, data: "{ error: string }" }
          }
        },
        {
          method: "POST",
          path: "/api/invoices",
          description: "Create an invoice entry for a product (can optionally link to a request)",
          parameters: [
            { name: "productId", type: "string", required: true, description: "Product id" },
            { name: "invoiceNumber", type: "string", required: true, description: "Invoice number" },
            { name: "quantity", type: "number", required: true, description: "Quantity" },
            { name: "unitPrice", type: "number", required: true, description: "Unit price" },
            { name: "requestId", type: "string", required: false, description: "Optional request id" },
            { name: "reqNumber", type: "string", required: false, description: "Optional req number" }
          ],
          response: {
            success: { status: 201, data: "ProductInvoice" },
            error: { status: 400, data: "{ error: string }" }
          }
        }
      ]
    },
    {
      name: "Intake",
      icon: FiDatabase,
      endpoints: [
        {
          method: "POST",
          path: "/api/intake",
          description: "Register a stock intake (creates invoice and increments product stock; can create product)",
          parameters: [
            { name: "invoiceNumber", type: "string", required: true, description: "Invoice number" },
            { name: "quantity", type: "number", required: true, description: "Quantity to add" },
            { name: "productId", type: "string", required: false, description: "Existing product id" },
            { name: "product", type: "object", required: false, description: "Create new product payload" },
            { name: "reqNumber", type: "string", required: false, description: "Optional req number to link" },
            { name: "requestId", type: "string", required: false, description: "Optional request id to link" }
          ],
          response: {
            success: { status: 201, data: "{ ok: true, invoiceId: string, productId: string }" },
            error: { status: 400, data: "{ error: string, code?: string }" }
          }
        }
      ]
    },
    {
      name: "Storage",
      icon: FiDatabase,
      endpoints: [
        {
          method: "GET",
          path: "/api/storage",
          description: "List stored files by kind (and optionally invoiceId/requestId)",
          parameters: [
            { name: "query.kind", type: "INVOICE|REQUEST|DOCUMENT|OTHER", required: true, description: "File kind" },
            { name: "query.invoiceId", type: "string", required: false, description: "Filter by invoice id (kind=INVOICE)" },
            { name: "query.requestId", type: "string", required: false, description: "Filter by request id (kind=REQUEST)" }
          ],
          response: {
            success: { status: 200, data: "StoredFile[]" },
            error: { status: 400, data: "{ error: string }" }
          }
        },
        {
          method: "POST",
          path: "/api/storage",
          description: "Upload a file (multipart/form-data). Body parser is disabled.",
          parameters: [
            { name: "form.kind", type: "INVOICE|REQUEST|DOCUMENT|OTHER", required: true, description: "File kind" },
            { name: "form.invoiceId", type: "string", required: false, description: "Only allowed when kind=INVOICE" },
            { name: "form.requestId", type: "string", required: false, description: "Only allowed when kind=REQUEST" },
            { name: "form.file", type: "file", required: true, description: "File field (file/upload/document accepted)" }
          ],
          response: {
            success: { status: 201, data: "StoredFile" },
            error: { status: 400, data: "{ error: string }" }
          }
        },
        {
          method: "GET",
          path: "/api/storage/[id]",
          description: "Download a stored file by id",
          parameters: [
            { name: "path.id", type: "string", required: true, description: "StoredFile id" }
          ],
          response: {
            success: { status: 200, data: "(binary file)" },
            error: { status: 404, data: "{ error: string }" }
          }
        },
        {
          method: "DELETE",
          path: "/api/storage/[id]",
          description: "Delete a stored file by id",
          parameters: [
            { name: "path.id", type: "string", required: true, description: "StoredFile id" }
          ],
          response: {
            success: { status: 204, data: "(no content)" },
            error: { status: 404, data: "{ error: string }" }
          }
        }
      ]
    },
    {
      name: "Reports",
      icon: FiCode,
      endpoints: [
        {
          method: "GET",
          path: "/api/reports/municipal",
          description: "Municipal report data (ADMIN only)",
          parameters: [
            { name: "query.from", type: "string", required: false, description: "ISO date (start)" },
            { name: "query.to", type: "string", required: false, description: "ISO date (end)" }
          ],
          response: {
            success: { status: 200, data: "MunicipalReportData" },
            error: { status: 403, data: "{ error: string }" }
          }
        },
        {
          method: "GET",
          path: "/api/reports/municipal/pdf",
          description: "Municipal report PDF (ADMIN only)",
          parameters: [
            { name: "query.from", type: "string", required: false, description: "ISO date (start)" },
            { name: "query.to", type: "string", required: false, description: "ISO date (end)" }
          ],
          response: {
            success: { status: 200, data: "application/pdf" },
            error: { status: 403, data: "{ error: string }" }
          }
        },
        {
          method: "GET",
          path: "/api/reports/business-insights/pdf",
          description: "Business insights PDF",
          parameters: [],
          response: {
            success: { status: 200, data: "application/pdf" },
            error: { status: 401, data: "{ error: string }" }
          }
        },
        {
          method: "GET",
          path: "/api/reports/ticket-operations",
          description: "Relatório consolidado de tickets, requisições associadas e intervenções/auditoria (ADMIN only)",
          parameters: [
            { name: "query.from", type: "string", required: false, description: "ISO date (start)" },
            { name: "query.to", type: "string", required: false, description: "ISO date (end)" },
            { name: "query.status", type: "OPEN|IN_PROGRESS|WAITING_CUSTOMER|ESCALATED|RESOLVED|CLOSED", required: false, description: "Filtro por estado do ticket" },
            { name: "query.level", type: "L1|L2|L3", required: false, description: "Filtro por nível N1/N2/N3" },
            { name: "query.priority", type: "LOW|NORMAL|HIGH|CRITICAL", required: false, description: "Filtro por prioridade" },
            { name: "query.assignedToUserId", type: "string", required: false, description: "UUID do técnico responsável" },
            { name: "query.includeClosed", type: "boolean", required: false, description: "Por omissão fechado = não incluído" },
            { name: "query.limit", type: "number", required: false, description: "1-1000 (default 200)" }
          ],
          response: {
            success: { status: 200, data: "{ summary, breakdowns, items[] }" },
            error: { status: 403, data: "{ error: string }" }
          }
        }
      ]
    },
    {
      name: "Admin",
      icon: FiUsers,
      endpoints: [
        {
          method: "GET",
          path: "/api/admin/users",
          description: "List users (ADMIN only)",
          parameters: [],
          response: {
            success: { status: 200, data: "User[]" },
            error: { status: 403, data: "{ error: string }" }
          }
        },
        {
          method: "POST",
          path: "/api/admin/users",
          description: "Create user (ADMIN only)",
          parameters: [
            { name: "name", type: "string", required: true, description: "Full name" },
            { name: "email", type: "string", required: true, description: "Email" },
            { name: "password", type: "string", required: true, description: "Password" },
            { name: "role", type: "'USER'|'ADMIN'", required: false, description: "Role" }
          ],
          response: {
            success: { status: 201, data: "User" },
            error: { status: 400, data: "{ error: string }" }
          }
        },
        {
          method: "POST",
          path: "/api/admin/users/[id]/reset-password",
          description: "Reset user password (ADMIN only)",
          parameters: [
            { name: "path.id", type: "string", required: true, description: "User id" },
            { name: "password", type: "string", required: true, description: "New password" }
          ],
          response: {
            success: { status: 204, data: "(no content)" },
            error: { status: 404, data: "{ error: string }" }
          }
        },
        {
          method: "GET",
          path: "/api/admin/allowed-ips",
          description: "List allowed IPs/CIDRs (ADMIN only)",
          parameters: [],
          response: {
            success: { status: 200, data: "AllowedIp[]" },
            error: { status: 403, data: "{ error: string }" }
          }
        },
        {
          method: "POST",
          path: "/api/admin/allowed-ips",
          description: "Create allowed IP/CIDR (ADMIN only)",
          parameters: [
            { name: "ipOrCidr", type: "string", required: true, description: "IP or CIDR" },
            { name: "note", type: "string", required: false, description: "Optional note" }
          ],
          response: {
            success: { status: 201, data: "AllowedIp" },
            error: { status: 400, data: "{ error: string }" }
          }
        },
        {
          method: "PATCH",
          path: "/api/admin/allowed-ips/[id]",
          description: "Update allowed IP/CIDR (ADMIN only)",
          parameters: [
            { name: "path.id", type: "string", required: true, description: "AllowedIp id" },
            { name: "ipOrCidr", type: "string", required: false, description: "IP or CIDR" },
            { name: "isActive", type: "boolean", required: false, description: "Activate/deactivate" }
          ],
          response: {
            success: { status: 200, data: "AllowedIp" },
            error: { status: 404, data: "{ error: string }" }
          }
        },
        {
          method: "GET",
          path: "/api/admin/ip-requests",
          description: "List IP access requests (ADMIN only)",
          parameters: [
            { name: "query.status", type: "PENDING|APPROVED|REJECTED", required: false, description: "Default PENDING" }
          ],
          response: {
            success: { status: 200, data: "IpAccessRequest[]" },
            error: { status: 403, data: "{ error: string }" }
          }
        },
        {
          method: "POST",
          path: "/api/admin/ip-requests/[id]/approve",
          description: "Approve IP access request (creates allowed IP) (ADMIN only)",
          parameters: [
            { name: "path.id", type: "string", required: true, description: "IpAccessRequest id" },
            { name: "ipOrCidr", type: "string", required: false, description: "Override IP/CIDR" },
            { name: "note", type: "string", required: false, description: "Optional note" }
          ],
          response: {
            success: { status: 200, data: "AllowedIp" },
            error: { status: 409, data: "{ error: string }" }
          }
        },
        {
          method: "POST",
          path: "/api/admin/ip-requests/[id]/reject",
          description: "Reject IP access request (ADMIN only)",
          parameters: [
            { name: "path.id", type: "string", required: true, description: "IpAccessRequest id" },
            { name: "note", type: "string", required: false, description: "Optional note" }
          ],
          response: {
            success: { status: 204, data: "(no content)" },
            error: { status: 409, data: "{ error: string }" }
          }
        },
        {
          method: "GET",
          path: "/api/admin/public-requests",
          description: "List public requests (ADMIN only)",
          parameters: [
            { name: "query.status", type: "RECEIVED|ACCEPTED|REJECTED", required: false, description: "Optional status filter" },
            { name: "query.limit", type: "number", required: false, description: "Max 200" }
          ],
          response: {
            success: { status: 200, data: "PublicRequest[]" },
            error: { status: 403, data: "{ error: string }" }
          }
        },
        {
          method: "GET",
          path: "/api/admin/public-requests/notifications",
          description: "Latest public requests for notifications (ADMIN only)",
          parameters: [
            { name: "query.limit", type: "number", required: false, description: "Max 100" },
            { name: "query.status", type: "RECEIVED|ACCEPTED|REJECTED", required: false, description: "Optional status" }
          ],
          response: {
            success: { status: 200, data: "Array" },
            error: { status: 403, data: "{ error: string }" }
          }
        },
        {
          method: "POST",
          path: "/api/admin/public-requests/[id]/accept",
          description: "Accept a public request and convert it into a GTMI request (ADMIN only)",
          parameters: [
            { name: "path.id", type: "string", required: true, description: "PublicRequest id" },
            { name: "note", type: "string", required: false, description: "Optional handling note" }
          ],
          response: {
            success: { status: 200, data: "{ ok: true, requestId: string }" },
            error: { status: 400, data: "{ error: string, code?: string, details?: any }" }
          }
        },
        {
          method: "POST",
          path: "/api/admin/public-requests/[id]/reject",
          description: "Reject a public request (ADMIN only)",
          parameters: [
            { name: "path.id", type: "string", required: true, description: "PublicRequest id" },
            { name: "note", type: "string", required: false, description: "Optional handling note" }
          ],
          response: {
            success: { status: 200, data: "{ ok: true }" },
            error: { status: 400, data: "{ error: string }" }
          }
        },
        {
          method: "POST",
          path: "/api/admin/storage/reorganize",
          description: "Reorganize files on disk to match canonical storage layout (ADMIN only)",
          parameters: [
            { name: "dryRun", type: "boolean", required: false, description: "Default true" },
            { name: "limit", type: "number", required: false, description: "Max 5000" },
            { name: "kinds", type: "string[]", required: false, description: "['INVOICE','REQUEST','DOCUMENT','OTHER']" },
            { name: "includeUnlinked", type: "boolean", required: false, description: "Include unlinked files" },
            { name: "renameFiles", type: "boolean", required: false, description: "Rename filenames to canonical format" }
          ],
          response: {
            success: { status: 200, data: "{ ok: true, dryRun: boolean, summary: any, results: any[] }" },
            error: { status: 400, data: "{ error: string }" }
          }
        }
      ]
    }
  ];

  const dataTypes = [
    {
      name: "SessionUser",
      fields: [
        { name: "id", type: "string", description: "Unique identifier" },
        { name: "tenantId", type: "string", description: "Tenant identifier" },
        { name: "name", type: "string", description: "User name" },
        { name: "email", type: "string", description: "Email address" },
        { name: "role", type: "'USER'|'ADMIN'", description: "Authorization role" },
        { name: "isActive", type: "boolean", description: "Active flag" }
      ]
    },
    {
      name: "Product",
      fields: [
        { name: "id", type: "string", description: "Unique identifier" },
        { name: "name", type: "string", description: "Product name" },
        { name: "sku", type: "string", description: "Stock Keeping Unit" },
        { name: "price", type: "number", description: "Product price" },
        { name: "quantity", type: "number", description: "Available quantity" },
        { name: "status", type: "string", description: "Product status" },
        { name: "categoryId", type: "string", description: "Category reference" },
        { name: "supplierId", type: "string", description: "Supplier reference" },
        { name: "tenantId", type: "string", description: "Tenant reference" },
        { name: "createdAt", type: "Date", description: "Creation timestamp" },
        { name: "category", type: "string", description: "Category name" },
        { name: "supplier", type: "string", description: "Supplier name" }
      ]
    },
    {
      name: "Category",
      fields: [
        { name: "id", type: "string", description: "Unique identifier" },
        { name: "name", type: "string", description: "Category name" },
        { name: "tenantId", type: "string", description: "Tenant reference" },
        { name: "createdAt", type: "Date", description: "Creation timestamp" }
      ]
    },
    {
      name: "Supplier",
      fields: [
        { name: "id", type: "string", description: "Unique identifier" },
        { name: "name", type: "string", description: "Supplier name" },
        { name: "email", type: "string", description: "Supplier email" },
        { name: "phone", type: "string", description: "Supplier phone" },
        { name: "tenantId", type: "string", description: "Tenant reference" },
        { name: "createdAt", type: "Date", description: "Creation timestamp" }
      ]
    },
    {
      name: "Request",
      fields: [
        { name: "id", type: "string", description: "Unique identifier" },
        { name: "gtmiNumber", type: "string", description: "GTMI formatted number" },
        { name: "status", type: "'DRAFT'|'SUBMITTED'|'APPROVED'|'REJECTED'|'FULFILLED'", description: "Request status" },
        { name: "requestingServiceId", type: "number", description: "Requesting service id" },
        { name: "requestedAt", type: "string", description: "Requested timestamp (ISO)" },
        { name: "items", type: "RequestItem[]", description: "Line items" }
      ]
    },
    {
      name: "ProductUnit",
      fields: [
        { name: "id", type: "string", description: "Unique identifier" },
        { name: "code", type: "string", description: "QR code (uuid)" },
        { name: "status", type: "string", description: "IN_STOCK | ACQUIRED | IN_REPAIR | SCRAPPED | LOST" },
        { name: "productId", type: "string", description: "Product id" },
        { name: "invoiceId", type: "string|null", description: "Invoice id" }
      ]
    },
    {
      name: "StockMovement",
      fields: [
        { name: "id", type: "string", description: "Unique identifier" },
        { name: "type", type: "string", description: "IN|OUT|RETURN|REPAIR_OUT|REPAIR_IN|SCRAP|LOST" },
        { name: "quantity", type: "number", description: "Quantity moved" },
        { name: "createdAt", type: "string", description: "Timestamp (ISO)" },
        { name: "productId", type: "string", description: "Product id" },
        { name: "unitId", type: "string|null", description: "Unit id" }
      ]
    },
    {
      name: "StoredFile",
      fields: [
        { name: "id", type: "string", description: "Unique identifier" },
        { name: "kind", type: "string", description: "INVOICE | REQUEST | DOCUMENT | OTHER" },
        { name: "originalName", type: "string", description: "Original filename" },
        { name: "mimeType", type: "string", description: "Mime type" },
        { name: "sizeBytes", type: "number", description: "File size" }
      ]
    },
    {
      name: "ProductInvoice",
      fields: [
        { name: "id", type: "string", description: "Unique identifier" },
        { name: "invoiceNumber", type: "string", description: "Invoice number" },
        { name: "issuedAt", type: "string", description: "Issued date (ISO)" },
        { name: "quantity", type: "number", description: "Quantity" },
        { name: "unitPrice", type: "number", description: "Unit price" },
        { name: "productId", type: "string", description: "Product id" }
      ]
    },
    {
      name: "User",
      fields: [
        { name: "id", type: "string", description: "Unique identifier" },
        { name: "name", type: "string", description: "User's full name" },
        { name: "email", type: "string", description: "User's email address" },
        { name: "username", type: "string", description: "Unique username" },
        { name: "createdAt", type: "Date", description: "Account creation timestamp" }
      ]
    }
  ];

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET": return "bg-green-100 text-green-800";
      case "POST": return "bg-blue-100 text-blue-800";
      case "PUT": return "bg-yellow-100 text-yellow-800";
      case "DELETE": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-primary">CMCHUB API Documentation</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Comprehensive API documentation for the CMCHUB inventory management system.
            Most endpoints require authentication via an HTTP-only session cookie.
          </p>
        </div>

        {/* Base URL */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FiCode className="h-5 w-5" />
              Base URL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <code className="bg-muted px-3 py-2 rounded text-sm font-mono">
              {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}
            </code>
          </CardContent>
        </Card>

        {/* Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FiKey className="h-5 w-5" />
              Authentication
            </CardTitle>
            <CardDescription>
              Auth is cookie-based. Call login to set the session cookie, then send requests with cookies (browser does this automatically).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">JWT Token Authentication</h4>
                <p className="text-sm text-muted-foreground">
                  The server issues a JWT stored in the HTTP-only cookie <code className="px-1">session_id</code>.
                  For API clients, ensure you keep and send cookies (e.g. <code className="px-1">credentials: &quot;include&quot;</code>).
                </p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Tenants</h4>
                <p className="text-sm text-muted-foreground">
                  Login supports multi-tenant resolution via <code className="px-1">x-tenant-slug</code>.
                  After login, tenant scoping comes from the session user.
                </p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Public endpoints</h4>
                <p className="text-sm text-muted-foreground">
                  Endpoints under <code className="px-1">/api/public</code> are anonymous and require a PIN.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Endpoints */}
        <div className="space-y-6">
          {endpoints.map((section) => (
            <Card key={section.name}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <section.icon className="h-5 w-5" />
                  {section.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {section.endpoints.map((endpoint, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <Badge className={getMethodColor(endpoint.method)}>
                          {endpoint.method}
                        </Badge>
                        <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                          {endpoint.path}
                        </code>
                      </div>
                      <p className="text-sm text-muted-foreground">{endpoint.description}</p>

                      {endpoint.parameters.length > 0 && (
                        <div>
                          <h5 className="font-semibold text-sm mb-2">Parameters:</h5>
                          <div className="space-y-1">
                            {endpoint.parameters.map((param, paramIndex) => (
                              <div key={paramIndex} className="flex items-center gap-2 text-sm">
                                <code className="bg-muted px-2 py-1 rounded text-xs">
                                  {param.name}
                                </code>
                                <span className="text-muted-foreground">({param.type})</span>
                                {param.required && <Badge variant="outline" className="text-xs">Required</Badge>}
                                <span className="text-muted-foreground">- {param.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <h5 className="font-semibold text-sm mb-2">Response:</h5>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-green-100 text-green-800">Success</Badge>
                            <span className="text-sm">Status: {endpoint.response.success.status}</span>
                          </div>
                          <code className="bg-muted px-2 py-1 rounded text-xs font-mono block">
                            {endpoint.response.success.data}
                          </code>

                          <div className="flex items-center gap-2">
                            <Badge className="bg-red-100 text-red-800">Error</Badge>
                            <span className="text-sm">Status: {endpoint.response.error.status}</span>
                          </div>
                          <code className="bg-muted px-2 py-1 rounded text-xs font-mono block">
                            {endpoint.response.error.data}
                          </code>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Data Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FiDatabase className="h-5 w-5" />
              Data Types
            </CardTitle>
            <CardDescription>
              Common data structures used throughout the API
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dataTypes.map((type) => (
                <div key={type.name} className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-3">{type.name}</h4>
                  <div className="space-y-2">
                    {type.fields.map((field, fieldIndex) => (
                      <div key={fieldIndex} className="flex items-center gap-3 text-sm">
                        <code className="bg-muted px-2 py-1 rounded text-xs font-mono">
                          {field.name}
                        </code>
                        <span className="text-muted-foreground">({field.type})</span>
                        <span className="text-muted-foreground">- {field.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Error Codes */}
        <Card>
          <CardHeader>
            <CardTitle>Error Codes</CardTitle>
            <CardDescription>
              Common HTTP status codes and their meanings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800">200</Badge>
                  <span className="text-sm">OK - Request successful</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-800">201</Badge>
                  <span className="text-sm">Created - Resource created successfully</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-100 text-red-800">400</Badge>
                  <span className="text-sm">Bad Request - Invalid input</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-100 text-red-800">401</Badge>
                  <span className="text-sm">Unauthorized - Authentication required</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-red-100 text-red-800">500</Badge>
                  <span className="text-sm">Internal Server Error</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthenticatedLayout>
  );
}
