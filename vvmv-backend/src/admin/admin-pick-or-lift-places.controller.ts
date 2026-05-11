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

@Controller("admin/pick-or-lift-places")
@UseGuards(SessionGuard)
export class AdminPickOrLiftPlacesController {
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
    if (trimmed) where.name = { contains: trimmed, mode: "insensitive" };

    const [items, total] = await Promise.all([
      this.prisma.pickOrLiftPlace.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take,
        include: { user: { select: { name: true, email: true } } },
      }),
      this.prisma.pickOrLiftPlace.count({ where }),
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
    const validData: Array<{ name: string; site: Site; createdBy: string }> = [];

    for (const [index, item] of items.entries()) {
      const name = typeof item?.name === "string" ? item.name : "";
      const targetSite = item?.site as string | undefined;
      const rowSuffix = isBulk ? ` (Dòng ${index + 1})` : "";

      if (!name) {
        errors.push(`Thiếu tên${rowSuffix}`);
        continue;
      }

      const site = effectiveSiteForCreate(user, targetSite);

      const existing = await this.prisma.pickOrLiftPlace.findFirst({
        where: { name: { equals: name, mode: "insensitive" }, site },
      });
      if (existing) {
        errors.push(`"${name}" đã tồn tại trong site ${site}${rowSuffix}`);
        continue;
      }

      validData.push({ name, site, createdBy: user.id });
    }

    if (errors.length > 0) {
      throw new HttpException(
        { error: "Dữ liệu không hợp lệ", details: errors.join("\n") },
        400,
      );
    }

    if (isBulk) {
      await this.prisma.$transaction(
        validData.map((data) => this.prisma.pickOrLiftPlace.create({ data })),
      );
      return { success: true, count: validData.length };
    }
    return this.prisma.pickOrLiftPlace.create({ data: validData[0] });
  }

  @Put()
  async update(@Body() body: Record<string, unknown>) {
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) throw new BadRequestException({ error: "Missing ID" });
    return this.prisma.pickOrLiftPlace.update({
      where: { id },
      data: { name: body.name as string | undefined },
    });
  }

  @Delete()
  async remove(@Query("id") id: string | undefined) {
    if (!id) throw new BadRequestException({ error: "Missing ID" });
    await this.prisma.pickOrLiftPlace.delete({ where: { id } });
    return { success: true };
  }
}
