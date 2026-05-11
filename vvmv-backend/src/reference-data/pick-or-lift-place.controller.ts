import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { Site } from "../../prisma/client";
import { SessionGuard } from "../auth/session.guard";
import { PrismaService } from "../prisma/prisma.service";

@Controller("pick-or-lift-place")
@UseGuards(SessionGuard)
export class PickOrLiftPlaceController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: Request) {
    const sessionUser = req.sessionUser!;
    const user = await this.prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { site: true, role: true },
    });

    const isSuperAdmin = user?.role === "SUPERADMIN";
    const siteFilter = isSuperAdmin
      ? {}
      : { site: (user?.site || "SGN") as Site };

    const places = await this.prisma.pickOrLiftPlace.findMany({
      where: siteFilter,
      orderBy: { name: "asc" },
      select: { name: true },
    });

    return { pickOrLiftPlaces: places.map((p) => p.name) };
  }
}
