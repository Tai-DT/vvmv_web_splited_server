import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type { Site } from "../../prisma/client";
import { SessionGuard } from "../auth/session.guard";
import { PrismaService } from "../prisma/prisma.service";
import { requireSessionUser } from "./site-helpers";

function requireAdmin(req: Request) {
  const user = requireSessionUser(req);
  if (user.role !== "ADMIN" && user.role !== "SUPERADMIN") {
    throw new ForbiddenException({ message: "Forbidden" });
  }
  return user;
}

interface NormalizedFieldOption {
  fieldName: string;
  code: string | null;
  name: string;
  color: string | null;
  conditions: unknown;
  order: number;
  site: Site | null;
  isActive: boolean;
}

function normalizeItem(
  item: Record<string, unknown>,
  index: number,
): NormalizedFieldOption {
  let normalizedConditions: unknown = null;
  if (typeof item.conditions === "string") {
    try {
      normalizedConditions = JSON.parse(item.conditions);
    } catch {
      throw new BadRequestException(
        `Dòng ${index + 1}: conditions JSON không hợp lệ`,
      );
    }
  } else if (item.conditions && typeof item.conditions === "object") {
    normalizedConditions = item.conditions;
  }

  const fieldName =
    typeof item.fieldName === "string" ? item.fieldName.trim() : "";
  const name = typeof item.name === "string" ? item.name.trim() : "";
  if (!fieldName || !name) {
    throw new BadRequestException(
      `Dòng ${index + 1}: fieldName và name là bắt buộc`,
    );
  }

  return {
    fieldName,
    code: typeof item.code === "string" ? item.code.trim() || null : null,
    name,
    color: typeof item.color === "string" ? item.color.trim() || null : null,
    conditions: normalizedConditions,
    order: Number.isFinite(Number(item.order)) ? Number(item.order) : 0,
    site: (item.site || null) as Site | null,
    isActive: item.isActive ?? true,
  } as NormalizedFieldOption;
}

@Controller("admin/field-options")
@UseGuards(SessionGuard)
export class AdminFieldOptionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query("fieldName") fieldName: string | undefined,
    @Query("site") siteParam: string | undefined,
    @Query("page") pageParam: string | undefined,
    @Query("pageSize") pageSizeParam: string | undefined,
  ) {
    requireAdmin(req);

    const page = Math.max(1, parseInt(pageParam || "1", 10));
    const pageSize = parseInt(pageSizeParam || "100", 10);
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (fieldName) where.fieldName = fieldName;
    if (siteParam !== undefined && siteParam !== null) {
      where.site = (siteParam as string) === "" ? null : (siteParam as Site);
    }

    const [items, total] = await Promise.all([
      this.prisma.fieldOption.findMany({
        where,
        orderBy: [
          { fieldName: "asc" },
          { order: "asc" },
          { code: "asc" },
          { name: "asc" },
        ],
        skip: pageSize === 0 ? undefined : skip,
        take: pageSize === 0 ? undefined : pageSize,
        include: { user: { select: { name: true, email: true } } },
      }),
      this.prisma.fieldOption.count({ where }),
    ]);

    const fieldNames = await this.prisma.fieldOption.findMany({
      select: { fieldName: true },
      distinct: ["fieldName"],
      orderBy: { fieldName: "asc" },
    });

    return {
      items,
      fieldNames: fieldNames.map((f) => f.fieldName),
      pagination: {
        total,
        totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 1,
      },
    };
  }

  @Post()
  @HttpCode(201)
  async create(@Req() req: Request, @Body() body: unknown) {
    const user = requireAdmin(req);

    const items = Array.isArray(body)
      ? (body as Record<string, unknown>[])
      : [body as Record<string, unknown>];

    if (items.length === 0) {
      throw new BadRequestException({ error: "Không có dữ liệu để tạo" });
    }

    const normalized = items.map((item, index) => normalizeItem(item, index));

    const seenKeys = new Set<string>();
    for (const [index, item] of normalized.entries()) {
      const key = `${item.fieldName}::${item.code ?? ""}::${item.site ?? ""}`;
      if (seenKeys.has(key)) {
        throw new ConflictException({
          error: `Dòng ${index + 1}: trùng fieldName + code + site trong dữ liệu dán vào`,
        });
      }
      seenKeys.add(key);
    }

    const existingHits = await Promise.all(
      normalized.map((item) =>
        this.prisma.fieldOption.findFirst({
          where: {
            fieldName: item.fieldName,
            code: item.code,
            site: item.site,
          },
          select: { id: true },
        }),
      ),
    );
    const conflictIndex = existingHits.findIndex(Boolean);
    if (conflictIndex >= 0) {
      throw new ConflictException({
        error: `Dòng ${conflictIndex + 1}: option với fieldName, code và site này đã tồn tại`,
      });
    }

    const created = await this.prisma.$transaction(
      normalized.map((item) =>
        this.prisma.fieldOption.create({
          data: {
            fieldName: item.fieldName,
            code: item.code,
            name: item.name,
            color: item.color,
            conditions: item.conditions ?? undefined,
            order: item.order,
            site: item.site,
            isActive: item.isActive,
            createdBy: user.id,
          },
        }),
      ),
    );

    if (Array.isArray(body)) {
      return { items: created, count: created.length };
    }
    return { item: created[0] };
  }
}

@Controller("admin/field-options/:id")
@UseGuards(SessionGuard)
export class AdminFieldOptionByIdController {
  constructor(private readonly prisma: PrismaService) {}

  @Patch()
  async patch(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    requireAdmin(req);

    const existing = await this.prisma.fieldOption.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ error: "Option không tồn tại" });
    }

    const updateData: Record<string, unknown> = {};
    if (body.fieldName !== undefined) updateData.fieldName = body.fieldName;
    if (body.name !== undefined) updateData.name = body.name;
    if (body.code !== undefined) updateData.code = body.code || null;
    if (body.color !== undefined) updateData.color = body.color || null;
    if (body.conditions !== undefined) {
      if (typeof body.conditions === "string") {
        updateData.conditions = body.conditions.trim()
          ? JSON.parse(body.conditions)
          : null;
      } else {
        updateData.conditions = body.conditions || null;
      }
    }
    if (body.order !== undefined) updateData.order = body.order;
    if (body.site !== undefined) updateData.site = (body.site as Site) || null;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    try {
      const item = await this.prisma.fieldOption.update({
        where: { id },
        data: updateData,
      });
      return { item };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed";
      throw new HttpException({ error: message }, 500);
    }
  }

  @Delete()
  async remove(@Req() req: Request, @Param("id") id: string) {
    requireAdmin(req);

    const existing = await this.prisma.fieldOption.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ error: "Option không tồn tại" });
    }

    await this.prisma.fieldOption.delete({ where: { id } });
    return { success: true };
  }
}
