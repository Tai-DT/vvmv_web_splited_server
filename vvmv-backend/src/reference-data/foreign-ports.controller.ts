import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { Site } from "../../prisma/client";
import { SessionGuard } from "../auth/session.guard";
import { PrismaService } from "../prisma/prisma.service";

@Controller("foreign-ports")
@UseGuards(SessionGuard)
export class ForeignPortsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query("portType") portTypeParam: string | undefined,
  ) {
    const sessionUser = req.sessionUser!;
    const user = await this.prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { site: true, role: true },
    });

    const isSuperAdmin = user?.role === "SUPERADMIN";
    const siteFilter = isSuperAdmin
      ? {}
      : { site: (user?.site || "SGN") as Site };

    let portTypeFilter: Record<string, unknown> = {};
    if (portTypeParam === "DESTINATION") {
      portTypeFilter = {
        OR: [{ portType: "DESTINATION" }, { portType: null }],
      };
    } else if (portTypeParam === "TRANSIT") {
      portTypeFilter = { OR: [{ portType: "TRANSIT" }, { portType: null }] };
    }

    const ports = await this.prisma.foreignPort.findMany({
      where: { ...siteFilter, ...portTypeFilter },
      orderBy: { name: "asc" },
      select: { id: true, name: true, portType: true },
    });

    return { ports };
  }
}
