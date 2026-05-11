import { BadRequestException } from "@nestjs/common";
import type { Request } from "express";
import type { Site, User } from "../../prisma/client";

export function requireSessionUser(req: Request): User {
  const user = req.sessionUser;
  if (!user) throw new BadRequestException({ message: "Unauthorized" });
  return user;
}

export function isSuperAdmin(user: User): boolean {
  return user.role === "SUPERADMIN";
}

/**
 * Standard pagination (matches Next handlers): page>=1, pageSize>=1.
 * `pageSize=0` from the caller is interpreted as "no pagination" — returns
 * `{ skip: undefined, take: undefined }` so callers can spread into Prisma.
 */
export function parsePagination(
  pageParam: string | undefined,
  pageSizeParam: string | undefined,
): {
  page: number;
  pageSize: number;
  skip: number | undefined;
  take: number | undefined;
} {
  const page = Math.max(1, parseInt(pageParam || "1", 10));
  const pageSizeRaw = parseInt(pageSizeParam || "50", 10);
  const isUnpaged = pageSizeParam === "0";
  const pageSize = isUnpaged ? 0 : Math.max(1, pageSizeRaw);
  return {
    page,
    pageSize,
    skip: isUnpaged ? undefined : (page - 1) * pageSize,
    take: isUnpaged ? undefined : pageSize,
  };
}

/**
 * Site selection mirroring the Next handlers: SUPERADMIN may pass any
 * `?site=`, others are pinned to their `user.site` (defaults to "SGN").
 */
export function siteWhere(
  user: User,
  siteParam: string | undefined,
): Record<string, Site | undefined> {
  if (isSuperAdmin(user)) {
    return siteParam ? { site: siteParam as Site } : {};
  }
  return { site: ((user.site as Site) || "SGN") as Site };
}

export function effectiveSiteForCreate(
  user: User,
  targetSite: string | undefined | null,
): Site {
  if (isSuperAdmin(user)) {
    return ((targetSite as Site) || (user.site as Site) || "SGN") as Site;
  }
  if (!user.site) {
    throw new BadRequestException({
      message: "Tài khoản của bạn chưa được cấu hình Site (SGN/HAN/DAD)",
    });
  }
  return user.site as Site;
}
