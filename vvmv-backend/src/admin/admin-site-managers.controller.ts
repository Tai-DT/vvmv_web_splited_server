import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
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
    throw new ForbiddenException({ message: "Unauthorized" });
  }
  return user;
}

@Controller("admin/site-managers")
@UseGuards(SessionGuard)
export class AdminSiteManagersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: Request) {
    requireAdmin(req);

    const managers = await this.prisma.user.findMany({
      where: { role: "MANAGER", site: { not: null } },
      select: { id: true, site: true },
    });

    return {
      siteManagers: managers.map((m) => ({
        site: m.site as "SGN" | "HAN" | "DAD",
        managerId: m.id,
      })),
    };
  }

  @Post()
  async assign(@Req() req: Request, @Body() body: Record<string, unknown>) {
    requireAdmin(req);
    const site = body?.site as string | undefined;
    const managerId = body?.managerId as string | undefined;

    if (!site || !managerId) {
      throw new BadRequestException({
        message: "Missing required fields: site and managerId are required",
      });
    }
    if (!["SGN", "HAN", "DAD"].includes(site)) {
      throw new BadRequestException({
        message: "Invalid site. Must be SGN, HAN, or DAD",
      });
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: managerId },
    });
    if (!existing) throw new NotFoundException({ message: "User not found" });

    const updated = await this.prisma.user.update({
      where: { id: managerId },
      data: { role: "MANAGER", site: site as Site },
    });

    return {
      message: "Site manager assigned successfully",
      siteManager: { site, managerId: updated.id },
    };
  }

  @Delete()
  async remove(
    @Req() req: Request,
    @Query("managerId") managerId: string | undefined,
  ) {
    requireAdmin(req);
    if (!managerId) {
      throw new BadRequestException({
        message: "Manager ID parameter is required",
      });
    }
    await this.prisma.user.update({
      where: { id: managerId },
      data: { site: null },
    });
    return { message: "Site manager removed successfully" };
  }
}
