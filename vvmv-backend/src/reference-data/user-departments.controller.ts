import {
  Controller,
  Get,
  InternalServerErrorException,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { SessionGuard } from "../auth/session.guard";
import { PrismaService } from "../prisma/prisma.service";

@Controller("user/departments")
@UseGuards(SessionGuard)
export class UserDepartmentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: Request) {
    const sessionUser = req.sessionUser!;

    try {
      const departmentNames = new Set<string>();

      const teams = await this.prisma.team.findMany({
        where: {
          OR: [
            { leaders: { some: { userId: sessionUser.id } } },
            { members: { some: { userId: sessionUser.id } } },
          ],
        },
        include: { department: true },
      });

      teams.forEach((team) => {
        if (team.department) {
          departmentNames.add(team.department.name);
        }
      });

      const directAssignments = await this.prisma.userDepartment.findMany({
        where: { userId: sessionUser.id },
        include: { department: true },
      });

      directAssignments.forEach((assignment) => {
        departmentNames.add(assignment.department.name);
      });

      const departments = Array.from(departmentNames);

      return { departments };
    } catch {
      throw new InternalServerErrorException({
        message: "Failed to fetch user departments",
      });
    }
  }
}
