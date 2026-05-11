import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type { Site } from "../../prisma/client";
import { SessionGuard } from "../auth/session.guard";
import { PrismaService } from "../prisma/prisma.service";
import { requireSessionUser } from "./site-helpers";

/**
 * Read-only listing endpoints for departments. POST/PUT/DELETE remain on
 * Next for now since they touch the `name_site` composite unique key and
 * have role-specific cascading-delete checks worth migrating in a dedicated
 * pass.
 */
@Controller("admin/departments")
@UseGuards(SessionGuard)
export class AdminDepartmentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: Request) {
    const user = requireSessionUser(req);
    const isAdmin = user.role === "ADMIN";
    const isSuperAdmin = user.role === "SUPERADMIN";
    const isManager = user.role === "MANAGER";
    if (!isAdmin && !isSuperAdmin && !isManager) {
      throw new ForbiddenException({ message: "Unauthorized" });
    }

    let whereClause: Record<string, unknown> = {};

    if (isManager) {
      const managerDepts = await this.prisma.userDepartment.findMany({
        where: { userId: user.id },
        select: { departmentId: true },
      });
      if (managerDepts.length === 0) {
        return { departments: [] };
      }
      whereClause = { id: { in: managerDepts.map((d) => d.departmentId) } };
    } else if (isAdmin && user.site) {
      whereClause = { site: user.site };
    }

    const departments = await this.prisma.department.findMany({
      where: whereClause,
      include: {
        _count: { select: { teams: true } },
        teams: {
          include: {
            leaders: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    image: true,
                  },
                },
              },
            },
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    image: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ site: "asc" }, { name: "asc" }],
    });

    return { departments };
  }
}

@Controller("admin/departments/by-site")
@UseGuards(SessionGuard)
export class AdminDepartmentsBySiteController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async listBySite(
    @Req() req: Request,
    @Query("site") site: string | undefined,
  ) {
    const user = requireSessionUser(req);
    const role = user.role;
    const allowed =
      role === "ADMIN" ||
      role === "SUPERADMIN" ||
      role === "MANAGER" ||
      role === "STAFF";
    if (!allowed) {
      throw new ForbiddenException({ message: "Unauthorized" });
    }

    if (!site) {
      throw new BadRequestException({ message: "Site parameter is required" });
    }
    if (!["SGN", "DAD", "HAN"].includes(site)) {
      throw new BadRequestException({ message: "Invalid site value" });
    }

    if (role === "MANAGER" && user.site && site !== user.site) {
      throw new ForbiddenException({
        message: "Managers can only view departments from their own site",
      });
    }

    const whereClause: Record<string, unknown> = { site: site as Site };

    if (role === "MANAGER") {
      whereClause.managers = { some: { userId: user.id } };
    }

    const departments = await this.prisma.department.findMany({
      where: whereClause,
      orderBy: { name: "asc" },
    });

    return { departments };
  }
}
