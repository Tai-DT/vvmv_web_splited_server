import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type { Site } from "../../prisma/client";
import { SessionGuard } from "../auth/session.guard";
import { PrismaService } from "../prisma/prisma.service";
import {
  effectiveSiteForCreate,
  parsePagination,
  requireSessionUser,
  siteWhere,
} from "./site-helpers";

@Controller("admin/customs-warehouses")
@UseGuards(SessionGuard)
export class AdminCustomsWarehousesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query("page") page: string | undefined,
    @Query("pageSize") pageSize: string | undefined,
    @Query("search") search: string | undefined,
    @Query("site") siteParam: string | undefined,
  ) {
    const user = requireSessionUser(req);
    const { skip, take, pageSize: ps } = parsePagination(page, pageSize);

    const where: Record<string, unknown> = { ...siteWhere(user, siteParam) };
    const trimmed = search?.trim();
    if (trimmed) {
      where.OR = [
        { whCode: { contains: trimmed, mode: "insensitive" } },
        { whName: { contains: trimmed, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.customsWarehouse.findMany({
        where,
        orderBy: { whCode: "asc" },
        skip,
        take,
        include: { user: { select: { name: true, email: true } } },
      }),
      this.prisma.customsWarehouse.count({ where }),
    ]);

    return {
      items,
      pagination: { total, totalPages: ps > 0 ? Math.ceil(total / ps) : 1 },
    };
  }

  @Post()
  async create(@Req() req: Request, @Body() body: unknown) {
    const user = requireSessionUser(req);
    const isBulk = Array.isArray(body);
    const items = isBulk
      ? (body as Record<string, unknown>[])
      : [body as Record<string, unknown>];

    const errors: string[] = [];
    const validData: Array<{
      whCode: string;
      whName: string;
      site: Site;
      createdBy: string;
    }> = [];

    for (const [index, item] of items.entries()) {
      const whCodeRaw = typeof item?.whCode === "string" ? item.whCode : "";
      const whNameRaw = typeof item?.whName === "string" ? item.whName : "";
      const targetSite = item?.site as string | undefined;
      const rowSuffix = isBulk ? ` (Dòng ${index + 1})` : "";

      if (!whCodeRaw) {
        errors.push(`Thiếu WH Code${rowSuffix}`);
        continue;
      }
      if (!whNameRaw) {
        errors.push(`Thiếu WH Name${rowSuffix}`);
        continue;
      }

      const site = effectiveSiteForCreate(user, targetSite);
      const whCode = whCodeRaw.trim().toUpperCase();
      const whName = whNameRaw.trim();

      const existing = await this.prisma.customsWarehouse.findFirst({
        where: { whCode: { equals: whCode, mode: "insensitive" }, site },
      });
      if (existing) {
        errors.push(`WH Code "${whCode}" đã tồn tại trong site ${site}${rowSuffix}`);
        continue;
      }

      validData.push({ whCode, whName, site, createdBy: user.id });
    }

    if (errors.length > 0) {
      throw new HttpException(
        { error: "Dữ liệu không hợp lệ", details: errors.join("\n") },
        400,
      );
    }

    if (isBulk) {
      await this.prisma.$transaction(
        validData.map((data) => this.prisma.customsWarehouse.create({ data })),
      );
      return { success: true, count: validData.length };
    }
    return this.prisma.customsWarehouse.create({ data: validData[0] });
  }

  @Put()
  async update(@Body() body: Record<string, unknown>) {
    const id = typeof body?.id === "string" ? body.id : "";
    const whCodeRaw = typeof body?.whCode === "string" ? body.whCode : "";
    const whNameRaw = typeof body?.whName === "string" ? body.whName : "";
    if (!id) throw new BadRequestException({ error: "Missing ID" });
    if (!whCodeRaw) throw new BadRequestException({ error: "Missing WH Code" });
    if (!whNameRaw) throw new BadRequestException({ error: "Missing WH Name" });

    return this.prisma.customsWarehouse.update({
      where: { id },
      data: {
        whCode: whCodeRaw.trim().toUpperCase(),
        whName: whNameRaw.trim(),
      },
    });
  }

  @Delete()
  async remove(@Query("id") id: string | undefined) {
    if (!id) throw new BadRequestException({ error: "Missing ID" });
    await this.prisma.customsWarehouse.delete({ where: { id } });
    return { success: true };
  }
}
