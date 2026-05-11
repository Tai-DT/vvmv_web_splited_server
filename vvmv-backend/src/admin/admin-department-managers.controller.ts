import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
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

@Controller("admin/department-managers")
@UseGuards(SessionGuard)
export class AdminDepartmentManagersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: Request) {
    requireAdmin(req);

    const assignments = await this.prisma.userDepartment.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
            site: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            site: true,
            _count: { select: { teams: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { assignments };
  }

  @Post()
  @HttpCode(201)
  async assign(@Req() req: Request, @Body() body: Record<string, unknown>) {
    requireAdmin(req);
    const userId = body?.userId as string | undefined;
    const departmentIds = body?.departmentIds as string[] | undefined;

    if (!userId || !Array.isArray(departmentIds)) {
      throw new BadRequestException({
        message: "userId and departmentIds array are required",
      });
    }
    if (departmentIds.length === 0) {
      throw new BadRequestException({
        message: "At least one department is required",
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, site: true, name: true },
    });
    if (!user) throw new NotFoundException({ message: "User not found" });

    if (user.role !== "MANAGER") {
      throw new BadRequestException({ message: "User must have MANAGER role" });
    }
    if (!user.site) {
      throw new BadRequestException({ message: "User must have a site assigned" });
    }

    const departments = await this.prisma.department.findMany({
      where: { id: { in: departmentIds } },
      select: { id: true, site: true, name: true },
    });
    if (departments.length !== departmentIds.length) {
      throw new NotFoundException({
        message: "One or more departments not found",
      });
    }
    const invalid = departments.filter((d) => d.site !== user.site);
    if (invalid.length > 0) {
      throw new BadRequestException({
        message: `Cannot assign manager to departments in different site. Departments: ${invalid
          .map((d) => d.name)
          .join(", ")} are in site ${invalid[0].site}`,
      });
    }

    const created = await Promise.all(
      departmentIds.map((deptId) =>
        this.prisma.userDepartment.upsert({
          where: {
            userId_departmentId: { userId, departmentId: deptId },
          },
          create: { userId, departmentId: deptId },
          update: {},
          include: {
            department: { select: { id: true, name: true, site: true } },
          },
        }),
      ),
    );

    return {
      message: `Manager assigned to ${created.length} department(s)`,
      assignments: created,
    };
  }

  @Delete()
  async remove(
    @Req() req: Request,
    @Query("userId") userId: string | undefined,
    @Query("departmentId") departmentId: string | undefined,
  ) {
    requireAdmin(req);
    if (!userId || !departmentId) {
      throw new BadRequestException({
        message: "userId and departmentId query parameters are required",
      });
    }

    const assignment = await this.prisma.userDepartment.findUnique({
      where: { userId_departmentId: { userId, departmentId } },
    });
    if (!assignment) {
      throw new NotFoundException({
        message: "Manager-department assignment not found",
      });
    }

    await this.prisma.userDepartment.delete({
      where: { userId_departmentId: { userId, departmentId } },
    });

    return { message: "Manager removed from department" };
  }
}
