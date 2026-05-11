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

@Controller("ops")
@UseGuards(SessionGuard)
export class OpsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: Request) {
    const sessionUser = req.sessionUser!;
    const user = await this.prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { site: true, role: true },
    });

    if (!user?.site) {
      throw new BadRequestException({
        message: "User site not configured",
      });
    }

    let whereClause: { site?: Site } = {};

    if (user.role !== "SUPERADMIN") {
      whereClause.site = user.site;
    }

    const opsList = await this.prisma.ops.findMany({
      where: whereClause,
      orderBy: { name: "asc" },
      select: { name: true },
    });

    return { ops: opsList.map((op) => op.name) };
  }
}
