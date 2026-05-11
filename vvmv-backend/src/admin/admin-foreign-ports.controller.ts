import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  NotFoundException,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type {
  PortType,
  Site,
} from "../../prisma/client";
import { SessionGuard } from "../auth/session.guard";
import { PrismaService } from "../prisma/prisma.service";
import {
  effectiveSiteForCreate,
  parsePagination,
  requireSessionUser,
  siteWhere,
} from "./site-helpers";

@Controller("admin/foreign-ports")
@UseGuards(SessionGuard)
export class AdminForeignPortsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query("page") page: string | undefined,
    @Query("pageSize") pageSize: string | undefined,
    @Query("search") search: string | undefined,
    @Query("site") siteParam: string | undefined,
    @Query("portType") portTypeParam: string | undefined,
  ) {
    const user = requireSessionUser(req);
    const { skip, take, pageSize: ps } = parsePagination(page, pageSize);

    const where: Record<string, unknown> = { ...siteWhere(user, siteParam) };
    if (portTypeParam) where.portType = portTypeParam as PortType;
    const trimmed = search?.trim();
    if (trimmed) {
      where.name = { contains: trimmed, mode: "insensitive" };
    }

    const [items, total] = await Promise.all([
      this.prisma.foreignPort.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take,
        include: { user: { select: { name: true, email: true } } },
      }),
      this.prisma.foreignPort.count({ where }),
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

    const skipped: { row: number; name: string; reason: string }[] = [];
    const validData: Array<{
      name: string;
      portType: PortType | null;
      domesticPort: string | null | undefined;
      site: Site;
      createdBy: string;
    }> = [];
    const seenKeys = new Set<string>();

    for (const [index, item] of items.entries()) {
      const name = typeof item?.name === "string" ? item.name : "";
      const portType = item?.portType as PortType | undefined;
      const domesticPort = item?.domesticPort as string | null | undefined;
      const targetSite = item?.site as string | undefined;
      if (!name) {
        skipped.push({
          row: index + 1,
          name: name || "(trống)",
          reason: "Thiếu tên cảng",
        });
        continue;
      }

      const site = effectiveSiteForCreate(user, targetSite);

      const batchKey = `${name.toLowerCase()}__${site}`;
      if (seenKeys.has(batchKey)) {
        skipped.push({
          row: index + 1,
          name,
          reason: "Trùng lặp trong cùng file import",
        });
        continue;
      }

      const existing = await this.prisma.foreignPort.findFirst({
        where: {
          name: { equals: name, mode: "insensitive" },
          site,
          domesticPort:
            domesticPort !== undefined ? domesticPort || null : null,
        },
      });
      if (existing) {
        skipped.push({
          row: index + 1,
          name,
          reason: `Đã tồn tại (name + site + domesticPort) trong site ${site}`,
        });
        continue;
      }

      seenKeys.add(batchKey);
      validData.push({
        name,
        portType: portType || null,
        domesticPort:
          domesticPort !== undefined ? domesticPort || null : undefined,
        site,
        createdBy: user.id,
      });
    }

    if (!isBulk) {
      if (skipped.length > 0) {
        throw new HttpException({ error: skipped[0].reason }, 400);
      }
      return this.prisma.foreignPort.create({ data: validData[0] });
    }

    if (validData.length > 0) {
      await this.prisma.$transaction(
        validData.map((data) => this.prisma.foreignPort.create({ data })),
      );
    }

    return { success: true, inserted: validData.length, skipped };
  }

  @Put()
  async update(@Body() body: Record<string, unknown>) {
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) throw new BadRequestException({ error: "Missing ID" });
    const name = body.name as string | undefined;
    const portType = body.portType as PortType | undefined;
    const domesticPort = body.domesticPort as string | null | undefined;

    const current = await this.prisma.foreignPort.findUnique({ where: { id } });
    if (!current) throw new NotFoundException({ error: "Record not found" });

    if (name) {
      const duplicate = await this.prisma.foreignPort.findFirst({
        where: {
          name: { equals: name, mode: "insensitive" },
          site: current.site,
          domesticPort:
            domesticPort !== undefined ? domesticPort || null : null,
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new HttpException(
          {
            error: `Cảng "${name}" đã tồn tại (name + site + domesticPort) trong site ${current.site}`,
          },
          409,
        );
      }
    }

    return this.prisma.foreignPort.update({
      where: { id },
      data: {
        name,
        portType: portType || null,
        domesticPort:
          domesticPort !== undefined ? domesticPort || null : undefined,
      },
    });
  }

  @Delete()
  async remove(@Query("id") id: string | undefined) {
    if (!id) throw new BadRequestException({ error: "Missing ID" });
    await this.prisma.foreignPort.delete({ where: { id } });
    return { success: true };
  }
}
