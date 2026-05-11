import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { SessionGuard } from "../auth/session.guard";
import { PrismaService } from "../prisma/prisma.service";

@Controller("tracking")
@UseGuards(SessionGuard)
export class TrackingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query("deliveryNumber") deliveryNumber: string | undefined,
    @Query("limit") limitRaw: string | undefined,
    @Query("offset") offsetRaw: string | undefined,
  ) {
    const limit = parseInt(limitRaw || "100", 10);
    const offset = parseInt(offsetRaw || "0", 10);

    const where = deliveryNumber
      ? { deliveryNumber: { contains: deliveryNumber } }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.tracking.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      this.prisma.tracking.count({ where }),
    ]);

    return { items, total };
  }

  @Post()
  async createOrUpdate(
    @Req() req: Request,
    @Body() body: { items?: unknown[] },
  ) {
    const sessionUser = req.sessionUser!;
    const { items } = body;

    if (!Array.isArray(items)) {
      throw new BadRequestException({ error: "Invalid data format" });
    }

    const operations = items.map((item: Record<string, unknown>) => {
      const { id, createdAt, updatedAt, ...data } = item;

      const copy = { ...data } as Record<string, unknown>;
      if (copy.time) copy.time = new Date(copy.time as string | Date);
      if (copy.dateSend)
        copy.dateSend = new Date(copy.dateSend as string | Date);
      if (copy.totalBox !== undefined)
        copy.totalBox = parseFloat(String(copy.totalBox));
      if (copy.weight !== undefined)
        copy.weight = parseFloat(String(copy.weight));

      const idStr = typeof id === "string" ? id : "";
      if (idStr && idStr.length > 10) {
        return this.prisma.tracking.update({
          where: { id: idStr },
          data: copy as Record<string, never>,
        });
      }
      return this.prisma.tracking.create({
        data: {
          ...(copy as Record<string, never>),
          createdBy: sessionUser.id,
        },
      });
    });

    await this.prisma.$transaction(operations);

    return { success: true, count: items.length };
  }

  @Delete()
  async remove(@Body() body: { ids?: unknown }) {
    const { ids } = body;

    if (!Array.isArray(ids)) {
      throw new BadRequestException({ error: "Invalid data format" });
    }

    await this.prisma.tracking.deleteMany({
      where: {
        id: { in: ids as string[] },
      },
    });

    return { success: true };
  }
}
