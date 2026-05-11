import {
  BadRequestException,
  Controller,
  Get,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type { Site } from "../../prisma/client";
import { SessionGuard } from "../auth/session.guard";
import { PrismaService } from "../prisma/prisma.service";

@Controller("vendors")
@UseGuards(SessionGuard)
export class VendorsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: Request) {
    const sessionUser = req.sessionUser!;
    const user = await this.prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { site: true, role: true },
    });

    if (!user?.site && user?.role !== "SUPERADMIN") {
      throw new BadRequestException({
        message: "User site not configured",
      });
    }

    const isSuperAdmin = user.role === "SUPERADMIN";

    const dbVendors = await this.prisma.vendor.findMany({
      where: isSuperAdmin ? {} : { site: user.site as Site },
      orderBy: { name: "asc" },
      select: { name: true },
    });

    const vendors = dbVendors.map((v) => v.name);

    return { vendors };
  }
}
