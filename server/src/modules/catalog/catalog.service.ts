import { AuditService } from "../reports/audit.service.js";
import type { PrismaClient, Prisma } from "@prisma/client";

export class CatalogConflictError extends Error {
  readonly statusCode = 409;
}
export class CatalogNotFoundError extends Error {
  readonly statusCode = 404;
}

function toProductDTO(product: {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  isActive: boolean;
  allowedBranches: { branchId: string }[];
}) {
  return {
    id: product.id,
    name: product.name,
    description: product.description ?? undefined,
    category: product.categoryId ?? "",
    isActive: product.isActive,
    allowedBranchIds: product.allowedBranches.length > 0 ? product.allowedBranches.map((b) => b.branchId) : null,
  };
}

function toVariantDTO(variant: {
  id: string;
  productId: string;
  variantGroupId: string;
  sku: string;
  name: string;
  attributes: unknown;
  unit: string;
  barcode: string | null;
  isActive: boolean;
  lastPurchaseCost: unknown;
  lastPurchaseDate: Date | null;
}) {
  return {
    id: variant.id,
    productId: variant.productId,
    variantGroupId: variant.variantGroupId,
    sku: variant.sku,
    name: variant.name,
    attributes: (variant.attributes ?? {}) as Record<string, string>,
    unit: variant.unit,
    barcode: variant.barcode ?? undefined,
    isActive: variant.isActive,
    lastPurchaseCost: variant.lastPurchaseCost != null ? Number(variant.lastPurchaseCost) : null,
    lastPurchaseDate: variant.lastPurchaseDate ? variant.lastPurchaseDate.toISOString() : null,
  };
}

export interface QuickProductPayload {
  mode: "NEW_PRODUCT" | "ADD_VARIANT";
  productName?: string;
  existingProductId?: string;
  variantName?: string;
  sku?: string;
  barcode?: string;
  salePrice: number;
  lastPurchaseCost?: number;
  unit?: string;
  categoryId?: string | null;
}

export class CatalogService {
  constructor(private readonly prisma: PrismaClient) {}

  async listProducts() {
    const products = await this.prisma.product.findMany({
      include: { allowedBranches: true },
      orderBy: { name: "asc" },
    });
    return products.map(toProductDTO);
  }

  async createProduct(input: {
    name: string;
    description?: string;
    category: string;
    isActive: boolean;
    allowedBranchIds?: string[] | null;
  }) {
    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          categoryId: input.category || null,
          isActive: input.isActive,
        },
      });
      if (input.allowedBranchIds && input.allowedBranchIds.length > 0) {
        await tx.productAllowedBranch.createMany({
          data: input.allowedBranchIds.map((branchId) => ({ productId: created.id, branchId })),
        });
      }
      return tx.product.findUniqueOrThrow({ where: { id: created.id }, include: { allowedBranches: true } });
    });
    return toProductDTO(product);
  }

  async updateProduct(
    id: string,
    patch: Partial<{
      name: string;
      description?: string;
      category: string;
      isActive: boolean;
      allowedBranchIds?: string[] | null;
    }>,
  ) {
    const product = await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          name: patch.name,
          description: patch.description,
          categoryId: patch.category !== undefined ? patch.category || null : undefined,
          isActive: patch.isActive,
        },
      });
      if (patch.allowedBranchIds !== undefined) {
        await tx.productAllowedBranch.deleteMany({ where: { productId: id } });
        if (patch.allowedBranchIds && patch.allowedBranchIds.length > 0) {
          await tx.productAllowedBranch.createMany({
            data: patch.allowedBranchIds.map((branchId) => ({ productId: id, branchId })),
          });
        }
      }
      return tx.product.findUniqueOrThrow({ where: { id }, include: { allowedBranches: true } });
    });
    return toProductDTO(product);
  }

  async deleteProduct(id: string) {
    const variantCount = await this.prisma.variant.count({ where: { productId: id } });
    if (variantCount > 0) {
      throw new CatalogConflictError(
        "El producto tiene variantes asociadas; desactívalo (isActive: false) en vez de eliminarlo",
      );
    }
    await this.prisma.product.delete({ where: { id } });
  }

  async listVariantGroups() {
    return this.prisma.variantGroup.findMany({ orderBy: { name: "asc" } });
  }

  async createVariantGroup(input: { name: string; description?: string }) {
    return this.prisma.variantGroup.create({ data: input });
  }

  async updateVariantGroup(id: string, patch: Partial<{ name: string; description?: string }>) {
    return this.prisma.variantGroup.update({ where: { id }, data: patch });
  }

  async deleteVariantGroup(id: string) {
    const variantCount = await this.prisma.variant.count({ where: { variantGroupId: id } });
    if (variantCount > 0) {
      throw new CatalogConflictError("El grupo de variantes tiene variantes asociadas");
    }
    await this.prisma.variantGroup.delete({ where: { id } });
  }

  async listVariants(branchId?: string) {
    const variants = await this.prisma.variant.findMany({
      where: branchId
        ? { product: { OR: [{ allowedBranches: { none: {} } }, { allowedBranches: { some: { branchId } } }] } }
        : undefined,
      include: { product: { include: { allowedBranches: true } }, variantGroup: true },
      orderBy: { name: "asc" },
    });
    return variants.map((v) => ({ ...toVariantDTO(v), product: toProductDTO(v.product), variantGroup: v.variantGroup }));
  }

  async createVariant(input: {
    productId: string;
    variantGroupId: string;
    sku: string;
    name: string;
    attributes: Record<string, string>;
    unit: string;
    barcode?: string;
    isActive: boolean;
    lastPurchaseCost?: number | null;
    lastPurchaseDate?: string | null;
  }) {
    const variant = await this.prisma.variant.create({
      data: {
        productId: input.productId,
        variantGroupId: input.variantGroupId,
        sku: input.sku,
        name: input.name,
        attributes: input.attributes as Prisma.InputJsonValue,
        unit: input.unit,
        barcode: input.barcode ?? null,
        isActive: input.isActive,
        lastPurchaseCost: input.lastPurchaseCost ?? null,
        lastPurchaseDate: input.lastPurchaseDate ? new Date(input.lastPurchaseDate) : null,
      },
    });
    return toVariantDTO(variant);
  }

  async updateVariant(id: string, patch: Record<string, unknown>) {
    const data: Prisma.VariantUpdateInput = {};
    if (patch.sku !== undefined) data.sku = patch.sku as string;
    if (patch.name !== undefined) data.name = patch.name as string;
    if (patch.attributes !== undefined) data.attributes = patch.attributes as Prisma.InputJsonValue;
    if (patch.unit !== undefined) data.unit = patch.unit as string;
    if (patch.barcode !== undefined) data.barcode = (patch.barcode as string) || null;
    if (patch.isActive !== undefined) data.isActive = patch.isActive as boolean;
    if (patch.lastPurchaseCost !== undefined) data.lastPurchaseCost = patch.lastPurchaseCost as number | null;
    if (patch.lastPurchaseDate !== undefined) {
      data.lastPurchaseDate = patch.lastPurchaseDate ? new Date(patch.lastPurchaseDate as string) : null;
    }
    const variant = await this.prisma.variant.update({ where: { id }, data });
    return toVariantDTO(variant);
  }

  async deleteVariant(id: string) {
    const salesCount = await this.prisma.salesLine.count({ where: { variantId: id } });
    if (salesCount > 0) {
      throw new CatalogConflictError(
        "La variante tiene ventas históricas asociadas; desactívala (isActive: false) en vez de eliminarla",
      );
    }
    await this.prisma.variant.delete({ where: { id } });
  }

  async searchVariants(query: string) {
    const variants = await this.prisma.variant.findMany({
      where: {
        isActive: true,
        OR: [
          { sku: { contains: query, mode: "insensitive" } },
          { barcode: { contains: query } },
          { name: { contains: query, mode: "insensitive" } },
          { product: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      include: { product: { include: { allowedBranches: true } }, variantGroup: true },
      take: 20,
    });
    return variants.map((v) => ({ ...toVariantDTO(v), product: toProductDTO(v.product), variantGroup: v.variantGroup }));
  }

  async createQuickProduct(payload: QuickProductPayload) {
    const normalList = await this.prisma.priceList.findUnique({ where: { type: "NORMAL" } });
    if (!normalList) {
      throw new CatalogConflictError("No existe la lista de precios NORMAL (falta correr el seed)");
    }

    const sku = payload.sku?.trim() || `SKU-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    const result = await this.prisma.$transaction(async (tx) => {
      let productId: string;
      let variantGroupId: string;

      if (payload.mode === "NEW_PRODUCT") {
        if (!payload.productName) {
          throw new CatalogConflictError("productName es requerido para mode=NEW_PRODUCT");
        }
        const product = await tx.product.create({
          data: { name: payload.productName, categoryId: payload.categoryId ?? null, isActive: true },
        });
        const group = await tx.variantGroup.create({ data: { name: "Única" } });
        productId = product.id;
        variantGroupId = group.id;
      } else {
        if (!payload.existingProductId) {
          throw new CatalogConflictError("existingProductId es requerido para mode=ADD_VARIANT");
        }
        const existingVariant = await tx.variant.findFirst({ where: { productId: payload.existingProductId } });
        if (existingVariant) {
          variantGroupId = existingVariant.variantGroupId;
        } else {
          const group = await tx.variantGroup.create({ data: { name: "Única" } });
          variantGroupId = group.id;
        }
        productId = payload.existingProductId;
      }

      const variant = await tx.variant.create({
        data: {
          productId,
          variantGroupId,
          sku,
          name: payload.variantName?.trim() || "Única",
          attributes: {},
          unit: payload.unit || "UN",
          barcode: payload.barcode || null,
          isActive: true,
          lastPurchaseCost: payload.lastPurchaseCost ?? null,
        },
      });

      await tx.salesVariantPrice.create({
        data: { variantId: variant.id, priceListId: normalList.id, price: payload.salePrice },
      });

      return tx.variant.findUniqueOrThrow({
        where: { id: variant.id },
        include: { product: { include: { allowedBranches: true } }, variantGroup: true },
      });
    });

    return { ...toVariantDTO(result), product: toProductDTO(result.product), variantGroup: result.variantGroup };
  }

  async listVariantPrices() {
    const prices = await this.prisma.salesVariantPrice.findMany();
    return prices.map((p) => ({ id: p.id, variantId: p.variantId, priceListId: p.priceListId, price: Number(p.price) }));
  }

  async setVariantPrice(variantId: string, priceListId: string, price: number, performedBy: string) {
    return this.prisma.$transaction(async tx => {
    const before = await tx.salesVariantPrice.findUnique({ where: { variantId_priceListId: { variantId, priceListId } } });
    const record = await tx.salesVariantPrice.upsert({
      where: { variantId_priceListId: { variantId, priceListId } },
      create: { variantId, priceListId, price },
      update: { price },
    });
    await AuditService.log(tx, { userId: performedBy, action: "SET_PRICE", entityType: "VariantPrice", entityId: record.id, beforeData: { price: before ? Number(before.price) : null }, afterData: { variantId, priceListId, price } });
    return { id: record.id, variantId: record.variantId, priceListId: record.priceListId, price: Number(record.price) };
    });
  }

  async listWholesaleTiers() {
    const tiers = await this.prisma.wholesaleTier.findMany({ orderBy: { minQty: "asc" } });
    return tiers.map((t) => ({ id: t.id, variantGroupId: t.variantGroupId, priceListId: t.priceListId, minQty: t.minQty, unitPrice: Number(t.unitPrice) }));
  }

  async createWholesaleTier(input: { variantGroupId: string; priceListId: string; minQty: number; unitPrice: number }) {
    const tier = await this.prisma.wholesaleTier.create({ data: input });
    return { id: tier.id, variantGroupId: tier.variantGroupId, priceListId: tier.priceListId, minQty: tier.minQty, unitPrice: Number(tier.unitPrice) };
  }

  async updateWholesaleTier(id: string, patch: Partial<{ minQty: number; unitPrice: number }>) {
    const tier = await this.prisma.wholesaleTier.update({ where: { id }, data: patch });
    return { id: tier.id, variantGroupId: tier.variantGroupId, priceListId: tier.priceListId, minQty: tier.minQty, unitPrice: Number(tier.unitPrice) };
  }

  async deleteWholesaleTier(id: string) {
    await this.prisma.wholesaleTier.delete({ where: { id } });
  }
}
