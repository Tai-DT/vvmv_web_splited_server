import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type { Site } from "../../prisma/client";
import { SessionGuard } from "../auth/session.guard";
import { PrismaService } from "../prisma/prisma.service";
import { isSuperAdmin, requireSessionUser } from "./site-helpers";

@Controller("admin/company-colors")
@UseGuards(SessionGuard)
export class AdminCompanyColorsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: Request) {
    const user = requireSessionUser(req);
    const userSite = user.site as Site | null;
    const allColors = isSuperAdmin(user);

    const whereClause = allColors ? {} : userSite ? { domain: userSite } : {};

    const [colors, followUpCompanies] = await Promise.all([
      this.prisma.companyColor.findMany({ where: whereClause }),
      this.prisma.followUp.groupBy({
        by: ["companyName", "taxCode"],
        where: {
          isDeleted: false,
          AND: [{ taxCode: { not: null } }, { taxCode: { not: "" } }],
        },
      }),
    ]);

    const userIds = [
      ...new Set(colors.map((c) => c.createdBy).filter((v): v is string => !!v)),
    ];
    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const colorsWithUser = colors.map((c) => ({
      ...c,
      user: c.createdBy ? userMap.get(c.createdBy) ?? null : null,
    }));

    return {
      colors: colorsWithUser,
      companies: followUpCompanies.map((c) => ({
        name: c.companyName,
        taxCode: c.taxCode,
      })),
    };
  }

  @Post()
  async upsert(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const user = requireSessionUser(req);
    const taxCode = body?.taxCode as string | undefined;
    const color = body?.color as string | undefined;
    const targetDomain = body?.domain as string | undefined;
    const userSite = (user.site as Site | null) || "SGN";

    if (!taxCode) {
      throw new BadRequestException({ error: "Tax code is required" });
    }

    let operationDomain: Site;
    if (isSuperAdmin(user)) {
      if (!targetDomain || !["SGN", "DAD", "HAN"].includes(targetDomain)) {
        throw new BadRequestException({
          error:
            "SUPERADMIN must specify a valid target domain (SGN, DAD, or HAN)",
        });
      }
      operationDomain = targetDomain as Site;
    } else {
      operationDomain = userSite as Site;
    }

    if (!color) {
      if (isSuperAdmin(user) && !targetDomain) {
        await this.prisma.companyColor.deleteMany({ where: { taxCode } });
      } else {
        await this.prisma.companyColor.deleteMany({
          where: { taxCode, domain: operationDomain },
        });
      }
      return { success: true, message: "Color reset" };
    }

    const existing = await this.prisma.companyColor.findFirst({
      where: { taxCode, domain: operationDomain },
    });

    if (existing) {
      return this.prisma.companyColor.update({
        where: { id: existing.id },
        data: { color },
      });
    }
    return this.prisma.companyColor.create({
      data: { taxCode, color, domain: operationDomain, createdBy: user.id },
    });
  }
}
