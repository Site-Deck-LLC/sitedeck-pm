import { PrismaClient } from '@prisma/client';

let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}

export function setPrismaClient(instance: PrismaClient): void {
  prismaInstance = instance;
}

export const prisma = getPrismaClient();
