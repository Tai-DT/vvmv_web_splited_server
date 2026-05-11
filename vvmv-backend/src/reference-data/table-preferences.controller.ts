import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { SessionGuard } from "../auth/session.guard";
import { PrismaService } from "../prisma/prisma.service";

@Controller("table-preferences")
@UseGuards(SessionGuard)
export class TablePreferencesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(@Req() req: Request, @Query("tableKey") tableKey: string | undefined) {
    const sessionUser = req.sessionUser!;
    if (!tableKey) {
      throw new BadRequestException({ message: "tableKey is required" });
    }

    try {
      const pref = await this.prisma.tablePreference.findUnique({
        where: {
          userId_tableKey: {
            userId: sessionUser.id,
            tableKey,
          },
        },
      });

      return { preferences: pref?.preferences ?? null };
    } catch {
      throw new InternalServerErrorException({
        message: "Failed to fetch table preference",
      });
    }
  }

  @Put()
  async put(
    @Req() req: Request,
    @Body() body: { tableKey?: string; preferences?: unknown },
  ) {
    const sessionUser = req.sessionUser!;
    const { tableKey, preferences } = body;

    if (!tableKey || preferences === undefined) {
      throw new BadRequestException({
        message: "tableKey and preferences are required",
      });
    }

    try {
      const pref = await this.prisma.tablePreference.upsert({
        where: {
          userId_tableKey: {
            userId: sessionUser.id,
            tableKey,
          },
        },
        update: { preferences: preferences as object },
        create: {
          userId: sessionUser.id,
          tableKey,
          preferences: preferences as object,
        },
      });

      return pref;
    } catch {
      throw new InternalServerErrorException({
        message: "Failed to save table preference",
      });
    }
  }
}
