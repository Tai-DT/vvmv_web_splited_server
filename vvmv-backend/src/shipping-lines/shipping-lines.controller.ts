import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { OperationType, Site } from "../../prisma/client";
import { SessionGuard } from "../auth/session.guard";
import { PrismaService } from "../prisma/prisma.service";

@Controller("shipping-lines")
@UseGuards(SessionGuard)
export class ShippingLinesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query("site") siteParam: string | undefined,
    @Query("operationType") operationTypeParam: string | undefined,
  ) {
    const user = req.sessionUser!;
    const site = siteParam as Site | undefined;
    const operationType = operationTypeParam as OperationType | undefined;
    const userSite = user.site as Site | undefined;

    const items = await this.prisma.shippingLine.findMany({
      where: {
        site: site || userSite || "SGN",
        ...(operationType
          ? {
              OR: [
                { operationType },
                { operationType: null },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        operationType: true,
      },
    });

    return { shippingLines: items };
  }
}
