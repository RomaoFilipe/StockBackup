import { prisma } from "@/prisma/client";

export const createProduct = async (data: {
  name: string;
  sku: string;
  price: number;
  quantity: bigint;
  status: string;
  tenantId: string;
  categoryId: string;
  supplierId: string;
  createdAt: Date;
}) => {
  return prisma.product.create({
    data,
  });
};

export const getProductsByUser = async (tenantId: string) => {
  return prisma.product.findMany({
    where: { tenantId },
  });
};

export const updateProduct = async (
  id: string,
  data: {
    name?: string;
    sku?: string;
    price?: number;
    quantity?: number;
    status?: string;
    categoryId?: string;
    supplierId?: string;
  }
) => {
  return prisma.product.update({
    where: { id },
    data,
  });
};

export const deleteProduct = async (id: string) => {
  return prisma.product.delete({
    where: { id },
  });
};
