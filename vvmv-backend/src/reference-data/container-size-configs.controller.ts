import { Controller, Get, Query } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** Mirrors Next handler: unauthenticated read (same as `app/api/container-size-configs`). */
@Controller("container-size-configs")
export class ContainerSizeConfigsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query("site") site: string | undefined,
    @Query("containerSize") containerSize: string | undefined,
  ) {
    const where: Record<string, string> = {};
    if (site) where.site = site;
    if (containerSize) where.containerSize = containerSize;

    const configs = await this.prisma.containerSizeConfig.findMany({
      where,
      orderBy: [{ site: "asc" }, { containerSize: "asc" }],
    });

    return { configs };
  }
}
