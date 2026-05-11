import {
  Controller,
  ForbiddenException,
  Get,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { SessionGuard } from "../auth/session.guard";
import { PrismaService } from "../prisma/prisma.service";
import { requireSessionUser } from "./site-helpers";

/**
 * Read-only listing of teams. Mirrors the Next handler's role-based scoping
 * (SUPERADMIN sees all; ADMIN sees their site; MANAGER sees teams in
 * assigned departments; team leaders see teams they lead). The `POST`/`PUT`/
 * `DELETE` flows are still on Next pending a fuller migration.
 */
@Controller("admin/teams")
@UseGuards(SessionGuard)
export class AdminTeamsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: Request) {
    const sessionUser = requireSessionUser(req);
    const role = sessionUser.role;
    const userSite = sessionUser.site;

    const isAdmin = role === "ADMIN";
    const isSuperAdmin = role === "SUPERADMIN";
    const isManager = role === "MANAGER";

    const teamLeaderships = await this.prisma.teamLeader.findMany({
      where: { userId: sessionUser.id },
      select: { teamId: true },
    });
    const isTeamLeader = teamLeaderships.length > 0;

    if (!isAdmin && !isSuperAdmin && !isManager && !isTeamLeader) {
      throw new ForbiddenException({ message: "Unauthorized" });
    }

    let whereClause: Record<string, unknown> = {};

    if (isSuperAdmin) {
      whereClause = {};
    } else if (isAdmin) {
      whereClause = userSite ? { department: { site: userSite } } : {};
    } else if (isManager) {
      const managerDepts = await this.prisma.userDepartment.findMany({
        where: { userId: sessionUser.id },
        select: { departmentId: true },
      });
      if (managerDepts.length === 0) {
        whereClause = { id: "none" };
      } else {
        whereClause = {
          departmentId: { in: managerDepts.map((d) => d.departmentId) },
        };
      }
    } else if (isTeamLeader) {
      whereClause = {
        leaders: { some: { userId: sessionUser.id } },
      };
    } else {
      whereClause = { id: "none" };
    }

    const teams = await this.prisma.team.findMany({
      where: whereClause,
      include: {
        department: true,
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
      orderBy: { createdAt: "desc" },
    });

    return {
      teams: teams.map((t) => ({
        ...t,
        leaders: t.leaders.map((tl) => tl.user),
        members: t.members.map((tm) => tm.user),
      })),
    };
  }
}
