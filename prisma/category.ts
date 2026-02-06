import { prisma } from "@/prisma/client";

export const createCategory = async (data: {
  name: string;
  tenantId: string;
}) => {
  return prisma.category.create({
    data,
  });
};

export const getCategoriesByUser = async (tenantId: string) => {
  return prisma.category.findMany({
    where: { tenantId },
  });
};

export const updateCategory = async (id: string, data: { name?: string }) => {
  return prisma.category.update({
    where: { id },
    data,
  });
};

export const deleteCategory = async (id: string) => {
  return prisma.category.delete({
    where: { id },
  });
};
