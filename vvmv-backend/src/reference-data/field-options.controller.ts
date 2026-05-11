import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type { Site } from "../../prisma/client";
import { SessionGuard } from "../auth/session.guard";
import { FieldOptionsService } from "./field-options.service";

@Controller("field-options")
@UseGuards(SessionGuard)
export class FieldOptionsController {
  constructor(private readonly fieldOptions: FieldOptionsService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query("fieldName") fieldName: string | undefined,
    @Query("site") siteParam: string | undefined,
    @Query("context") contextParam: string | undefined,
  ) {
    if (!fieldName) {
      throw new BadRequestException({ message: "fieldName is required" });
    }

    const sessionUser = req.sessionUser!;
    const userSite = sessionUser.site as Site | undefined;
    const effectiveSite = (siteParam as Site | undefined) || userSite || "SGN";

    let context: Record<string, unknown> = {};
    if (contextParam) {
      try {
        context = JSON.parse(contextParam) as Record<string, unknown>;
      } catch {
        throw new BadRequestException({ message: "Invalid context JSON" });
      }
    }

    const items = await this.fieldOptions.listFiltered({
      fieldName,
      effectiveSite,
      context,
    });

    return { items };
  }
}
