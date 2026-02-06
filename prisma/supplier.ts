import { prisma } from "@/prisma/client";

export const createSupplier = async (data: {
  name: string;
  tenantId: string;
}) => {
  return prisma.supplier.create({
    data,
  });
};

export const getSuppliersByUser = async (tenantId: string) => {
  return prisma.supplier.findMany({
    where: { tenantId },
  });
};

export const updateSupplier = async (id: string, data: { name?: string }) => {
  return prisma.supplier.update({
    where: { id },
    data,
  });
};

export const deleteSupplier = async (id: string) => {
  return prisma.supplier.delete({
    where: { id },
  });
};
