import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { Site, VendorFeeMode } from "../../prisma/client";
import { SessionGuard } from "../auth/session.guard";
import { PrismaService } from "../prisma/prisma.service";

function normalizeVendorFeeMode(value: unknown): VendorFeeMode {
  const raw = String(value || "ALL")
    .trim()
    .toUpperCase();
  if (raw === "FCL") return VendorFeeMode.FCL;
  if (raw === "LCL") return VendorFeeMode.LCL;
  return VendorFeeMode.ALL;
}

@Controller("vendor-fee-types")
@UseGuards(SessionGuard)
export class VendorFeeTypesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query("feeCode") feeCode: string | undefined,
    @Query("mode") mode: string | undefined,
  ) {
    const sessionUser = req.sessionUser!;
    const user = await this.prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        site: true,
        role: true,
        departmentAssignments: {
          include: { department: { select: { name: true } } },
        },
        teamLeaderships: {
          include: {
            team: {
              include: { department: { select: { name: true } } },
            },
          },
        },
      },
    });

    const site = user?.site as Site | null;
    if (!site && user?.role !== "SUPERADMIN") {
      throw new BadRequestException({
        message: "User site not configured",
      });
    }

    const isTruckingManager =
      user?.role === "MANAGER" &&
      user.departmentAssignments?.some(
        (da) => da.department?.name === "Trucking",
      );
    const isTruckingTeamLeader = user?.teamLeaderships?.some(
      (tl) => tl.team?.department?.name === "Trucking",
    );
    const canEdit =
      user?.role === "ADMIN" ||
      user?.role === "SUPERADMIN" ||
      !!isTruckingManager ||
      !!isTruckingTeamLeader;

    const feeTypes = await this.prisma.vendorFeeType.findMany({
      where: {
        ...(user?.role === "SUPERADMIN" ? {} : { site: site as Site }),
        ...(feeCode
          ? { feeCode: { equals: feeCode, mode: "insensitive" } }
          : {}),
        ...(mode ? { mode: normalizeVendorFeeMode(mode) } : {}),
      },
      orderBy: [
        { site: "asc" },
        { mode: "asc" },
        { feeCode: "asc" },
        { name: "asc" },
      ],
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      canEdit,
      feeTypes: feeTypes.map((item) => ({
        ...item,
        serviceMode: item.feeCode,
      })),
    };
  }

  @Post()
  async create(@Req() req: Request, @Body() body: unknown) {
    const sessionUser = req.sessionUser!;
    const user = await this.prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        site: true,
        role: true,
        departmentAssignments: {
          include: { department: { select: { name: true } } },
        },
        teamLeaderships: {
          include: {
            team: {
              include: { department: { select: { name: true } } },
            },
          },
        },
      },
    });

    const isTruckingManager =
      user?.role === "MANAGER" &&
      user!.departmentAssignments!.some(
        (da) => da.department?.name === "Trucking",
      );

    const isTruckingTeamLeader = user?.teamLeaderships?.some(
      (tl) => tl.team?.department?.name === "Trucking",
    );

    if (
      !user ||
      (user.role !== "ADMIN" &&
        user.role !== "SUPERADMIN" &&
        !isTruckingManager &&
        !isTruckingTeamLeader)
    ) {
      throw new ForbiddenException({ message: "Forbidden" });
    }

    const items = Array.isArray(body) ? body : [body];

    if (!items.length) {
      throw new BadRequestException({ message: "No fee types provided" });
    }

    try {
      const payload = items.map((item: Record<string, unknown>, index: number) => {
        const name = String(item?.name || "").trim();
        const feeCode =
          String(item?.feeCode || item?.serviceMode || "").trim() || null;
        const vendorId = String(item?.vendorId || "").trim() || null;
        const modeNorm = normalizeVendorFeeMode(item?.mode);
        const isActive =
          typeof item?.isActive === "boolean" ? item.isActive : true;
        const isNotDefault =
          typeof item?.isNotDefault === "boolean" ? item.isNotDefault : false;

        if (!name) {
          throw new BadRequestException(
            `Fee name is required at row ${index + 1}`,
          );
        }

        const effectiveSite =
          user.role === "SUPERADMIN"
            ? ((item?.site as Site) || Site.SGN)
            : ((user.site as Site) || Site.SGN);

        return {
          name,
          feeCode,
          feeDescription: String(item?.feeDescription || "").trim() || null,
          vendorId,
          mode: modeNorm,
          isActive,
          isNotDefault,
          site: effectiveSite,
        };
      });

      const created = await this.prisma.$transaction(
        payload.map((data) => this.prisma.vendorFeeType.create({ data })),
      );

      if (Array.isArray(body)) {
        return { success: true, count: created.length };
      }

      return { success: true, feeType: created[0] };
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      const message =
        e instanceof Error ? e.message : "Failed to create vendor fee type";
      throw new BadRequestException(message);
    }
  }

  @Put()
  async update(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const sessionUser = req.sessionUser!;
    const user = await this.prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        site: true,
        role: true,
        departmentAssignments: {
          include: { department: { select: { name: true } } },
        },
        teamLeaderships: {
          include: {
            team: {
              include: { department: { select: { name: true } } },
            },
          },
        },
      },
    });

    const isTruckingManager =
      user?.role === "MANAGER" &&
      user!.departmentAssignments!.some(
        (da) => da.department?.name === "Trucking",
      );

    const isTruckingTeamLeader = user?.teamLeaderships?.some(
      (tl) => tl.team?.department?.name === "Trucking",
    );

    if (
      !user ||
      (user.role !== "ADMIN" &&
        user.role !== "SUPERADMIN" &&
        !isTruckingManager &&
        !isTruckingTeamLeader)
    ) {
      throw new ForbiddenException({ message: "Forbidden" });
    }

    const id = String(body?.id || "").trim();
    const name = String(body?.name || "").trim();
    const feeCode =
      String(body?.feeCode || body?.serviceMode || "").trim() || null;
    const feeDescription = String(body?.feeDescription || "").trim() || null;
    const vendorId = String(body?.vendorId || "").trim() || null;
    const mode = body?.mode;
    const isActive =
      typeof body?.isActive === "boolean" ? body.isActive : undefined;
    const isNotDefault =
      typeof body?.isNotDefault === "boolean" ? body.isNotDefault : undefined;

    if (!id) {
      throw new BadRequestException({ message: "ID is required" });
    }

    if (!name) {
      throw new BadRequestException({ message: "Fee name is required" });
    }

    const existing = await this.prisma.vendorFeeType.findUnique({
      where: { id },
      select: { id: true, site: true },
    });

    if (!existing) {
      throw new NotFoundException({ message: "Not found" });
    }

    if (user.role !== "SUPERADMIN" && user.site !== existing.site) {
      throw new ForbiddenException({ message: "Forbidden" });
    }

    const updated = await this.prisma.vendorFeeType.update({
      where: { id },
      data: {
        name,
        feeCode,
        feeDescription,
        vendorId,
        ...(typeof mode !== "undefined"
          ? { mode: normalizeVendorFeeMode(mode) }
          : {}),
        ...(typeof isActive === "boolean" ? { isActive } : {}),
        ...(typeof isNotDefault === "boolean" ? { isNotDefault } : {}),
      },
    });

    return { success: true, feeType: updated };
  }

  @Delete()
  async remove(@Req() req: Request, @Query("id") id: string | undefined) {
    const sessionUser = req.sessionUser!;
    const user = await this.prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        site: true,
        role: true,
        departmentAssignments: {
          include: { department: { select: { name: true } } },
        },
        teamLeaderships: {
          include: {
            team: {
              include: { department: { select: { name: true } } },
            },
          },
        },
      },
    });

    const isTruckingManager =
      user?.role === "MANAGER" &&
      user!.departmentAssignments!.some(
        (da) => da.department?.name === "Trucking",
      );

    const isTruckingTeamLeader = user?.teamLeaderships?.some(
      (tl) => tl.team?.department?.name === "Trucking",
    );

    if (
      !user ||
      (user.role !== "ADMIN" &&
        user.role !== "SUPERADMIN" &&
        !isTruckingManager &&
        !isTruckingTeamLeader)
    ) {
      throw new ForbiddenException({ message: "Forbidden" });
    }

    const trimmed = id?.trim();
    if (!trimmed) {
      throw new BadRequestException({ message: "ID is required" });
    }

    const existing = await this.prisma.vendorFeeType.findUnique({
      where: { id: trimmed },
      select: { id: true, site: true },
    });

    if (!existing) {
      throw new NotFoundException({ message: "Not found" });
    }

    if (user.role !== "SUPERADMIN" && user.site !== existing.site) {
      throw new ForbiddenException({ message: "Forbidden" });
    }

    await this.prisma.vendorFeeType.delete({ where: { id: trimmed } });

    return { success: true };
  }
}
