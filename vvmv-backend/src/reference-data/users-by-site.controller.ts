import {
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { Prisma } from "../../prisma/client";
import { SessionGuard } from "../auth/session.guard";
import { PrismaService } from "../prisma/prisma.service";

@Controller("users/by-site")
@UseGuards(SessionGuard)
export class UsersBySiteController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query("department") department: string | undefined,
  ) {
    const sessionUser = req.sessionUser!;

    try {
      const currentUser = await this.prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { role: true, site: true },
      });

      if (!currentUser) {
        throw new NotFoundException({ message: "User not found" });
      }

      let whereClause: Prisma.UserWhereInput = {};

      if (currentUser.role === "ADMIN" || currentUser.role === "SUPERADMIN") {
        whereClause = {};
      } else if (currentUser.site) {
        whereClause = {
          OR: [{ site: currentUser.site }, { role: "SUPERADMIN" }],
        };
      } else {
        whereClause = { role: "SUPERADMIN" };
      }

      if (department) {
        whereClause = {
          AND: [
            whereClause,
            {
              OR: [
                {
                  departmentAssignments: {
                    some: {
                      department: {
                        name: {
                          contains: department,
                          mode: "insensitive",
                        },
                      },
                    },
                  },
                },
                {
                  teamMemberships: {
                    some: {
                      team: {
                        department: {
                          name: {
                            contains: department,
                            mode: "insensitive",
                          },
                        },
                      },
                    },
                  },
                },
                {
                  teamLeaderships: {
                    some: {
                      team: {
                        department: {
                          name: {
                            contains: department,
                            mode: "insensitive",
                          },
                        },
                      },
                    },
                  },
                },
              ],
            },
          ],
        };
      }

      const users = await this.prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          image: true,
          site: true,
        },
        orderBy: { name: "asc" },
      });

      return { users };
    } catch (e) {
      if (e instanceof NotFoundException) {
        throw e;
      }
      throw new InternalServerErrorException({ message: "Failed to fetch users" });
    }
  }
}
