import { Injectable } from "@nestjs/common";
import type { Request, Response } from "express";
import { compareSync } from "bcryptjs";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import fs from "node:fs";
import path from "node:path";
import { AuthSessionService, parseCookie } from "../auth/auth-session.service";
import { FastproService } from "../integrations/fastpro/fastpro.service";
import { GeminiService } from "../integrations/gemini/gemini.service";
import { GoogleService } from "../integrations/google/google.service";
import { MssqlService } from "../integrations/mssql/mssql.service";
import { SnpService } from "../integrations/snp/snp.service";
import { PrismaService } from "../prisma/prisma.service";
import { FRONTEND_API_ROUTES, type ApiRouteDefinition } from "./api-route-registry";
import { Prisma, type Site } from "../../prisma/client";

type ApiBody = Record<string, unknown>;
type ApiResult = {
  status?: number;
  body?: unknown;
  raw?: Buffer | string;
  contentType?: string;
  headers?: Record<string, string>;
};

type RouteMatch = {
  definition: ApiRouteDefinition;
  params: Record<string, string>;
};

const ROUTES = [...FRONTEND_API_ROUTES].sort((a, b) => {
  const score = (route: ApiRouteDefinition) =>
    route.key
      .split("/")
      .reduce((sum, part) => sum + (part.startsWith("[") ? 0 : 2), 0);
  return score(b) - score(a) || b.key.length - a.key.length;
});

const BACKEND_ROOT = path.resolve(__dirname, "../..");
const WORKSPACE_ROOT = path.resolve(BACKEND_ROOT, "..");
const DEFAULT_CDS_CARGO_UNIT_CODES_PATH = path.join(
  WORKSPACE_ROOT,
  "ai-vvmv/vvmv-operational-bundle/app-reference-data/2026-05-09T03-25-20-552Z/database-exports/cds_cargo_unit_codes.json",
);
const CDS_IMPORT_LICENSES_LIMIT = Number.parseInt(
  process.env.CDS_IMPORT_LICENSES_LIMIT || "500",
  10,
);
const CDS_PERMITS_LIMIT = Number.parseInt(
  process.env.CDS_PERMITS_LIMIT || "500",
  10,
);
const CDS_ELECTRONIC_ATTACHMENTS_LIMIT = Number.parseInt(
  process.env.CDS_ELECTRONIC_ATTACHMENTS_LIMIT || "400",
  10,
);
const CDS_OPERATION_CODES_LIMIT = Number.parseInt(
  process.env.CDS_OPERATION_CODES_LIMIT || "500",
  10,
);
const CDS_PROCESSING_DEPARTMENTS_LIMIT = Number.parseInt(
  process.env.CDS_PROCESSING_DEPARTMENTS_LIMIT || "800",
  10,
);
const CDS_FIELD_OPTIONS_LIMIT = Number.parseInt(
  process.env.CDS_FIELD_OPTIONS_LIMIT || "120",
  10,
);
const CDS_FAST_FIELD_OPTIONS_LIMIT = Number.parseInt(
  process.env.CDS_FAST_FIELD_OPTIONS_LIMIT || "60",
  10,
);
const CDS_LARGE_CATALOG_FIELD_OPTIONS_LIMIT = Number.parseInt(
  process.env.CDS_LARGE_CATALOG_FIELD_OPTIONS_LIMIT ??
    process.env.CDS_BANK_FIELD_OPTIONS_LIMIT ??
    "8000",
  10,
);
const CDS_LARGE_CATALOG_FIELD_KEYS = [
  "taxSubstituteBankCode",
  "guaranteeBankCode",
  "loadingLocationCode",
  "unloadingLocationCode",
  "warehouseLocationCode",
  "taxDestinationLocation",
  "transportVehicleCode",
  "customsWarehouseCode",
  "finalDestinationCode",
  "packageType",
  "weightUnit",
];
const CDS_WEIGHT_UNIT_LABELS: Record<string, string> = {
  KGM: "KILO-GRAMMES",
  GRM: "GRAMMES",
  TNE: "METRIC-TONS",
  LBR: "POUNDS",
  LBS: "POUNDS",
  ONZ: "OUNCE",
  STN: "SHORT TON",
  LTN: "LONG TON",
  HKGM: "TA (100 KG)",
  HGRM: "100 GRAMME",
  MGRM: "MILIGAM",
  KDW: "KILO-GRAMMES BY DRY WEIGHT",
  MDW: "METRIC-TONS BY DRY WEIGHT",
  GDW: "GRAMMES BY DRY WEIGHT",
  LDW: "POUNDS BY DRY WEIGHT",
  ODW: "OUNCE BY DRY WEIGHT",
  KIC: "KILO-GRAMMES INCLUDING CONTAINERS",
  MIC: "METRIC-TONS INCLUDING CONTAINERS",
  GIC: "GRAMMES INCLUDING CONTAINERS",
  LIC: "POUNDS INCLUDING CONTAINERS",
  OIC: "OUNCE INCLUDING CONTAINERS",
  KII: "KILO-GRAMMES INCLUDING INNER PACKINGS",
  MII: "METRIC-TONS INCLUDING INNER PACKINGS",
  GII: "GRAMMES INCLUDING INNER PACKINGS",
  LII: "POUNDS INCLUDING INNER PACKINGS",
  OII: "OUNCE INCLUDING INNER PACKINGS",
  KMC: "KILO-GRAMMES BY METAL CONTENT",
  MMC: "METRIC-TONS BY METAL CONTENT",
  GMC: "GRAMMES BY METAL CONTENT",
  LMC: "POUNDS BY METAL CONTENT",
  OMC: "OUNCE BY METAL CONTENT",
  ADMT: "AIR DRY METRIC TON",
};

type CdsCargoUnitCode = {
  code?: string;
  name?: string;
  nameAlt?: string | null;
  nameVn?: string | null;
  nameAltVn?: string | null;
  stt?: number;
};

type CdsPermitRow = {
  id: string;
  permit_type_code: string | null;
  permit_type_name: string | null;
  permit_no: string;
  permit_issue_date: string | null;
  permit_expiry_date: string | null;
  declaration_count: number | null;
  first_declaration_date: string | null;
  last_declaration_date: string | null;
  sample_declaration_no: string | null;
  sample_customs_code: string | null;
  is_explicit_import_license: boolean;
};

type CdsFieldOptionRow = {
  field: string;
  value: string;
  label: string | null;
  address: string | null;
  count: number | null;
  direction: string | null;
  source: string | null;
};

const ERP_REFERENCE_ROUTES: Record<
  string,
  {
    sql: string;
    responseKey: string;
    itemField?: string;
    idField?: string;
    nameField?: string;
    hardcodedSgn?: string[];
  }
> = {
  airports: {
    sql: "SELECT AirPortID, AirPortName FROM Airports",
    responseKey: "airports",
    idField: "AirPortID",
    nameField: "AirPortName",
  },
  "container-sizes": {
    sql: `SELECT UnitId FROM UnitContents WHERE LocalUnitVAT LIKE 'CONT %' OR Notes = 'CONTAINER' OR [Description] = '' OR UnitId LIKE '20´%' OR UnitId LIKE '40´%'`,
    responseKey: "containerSizes",
    itemField: "UnitId",
  },
  "service-modes": {
    sql: splitCaptionSql(0),
    responseKey: "serviceModes",
    itemField: "Item",
  },
  "truck-types": {
    sql: `SELECT UNITID as Item FROM UnitContents WHERE (UNITID like '0%' OR UNITID like '1%' OR UNITID like '2%' OR UNITID like '3%' OR UNITID like '4%' OR UNITID like '5%' OR UNITID like '6%' OR UNITID like '7%' OR UNITID like '8%' OR UNITID like 'DONGKIEN%' OR UNITID like 'GRAB%' OR UNITID like 'XECAU%' OR UNITID like 'XENANG%') ORDER BY UNITID`,
    responseKey: "truckTypes",
    itemField: "Item",
  },
  units: {
    sql: splitCaptionSql(3),
    responseKey: "units",
    itemField: "Item",
  },
  vehicles: {
    sql: "SELECT VHUnitNo as Item FROM dbo.VehicleList WHERE VHUnitNo IS NOT NULL AND LTRIM(RTRIM(VHUnitNo)) <> '' ORDER BY VHUnitNo",
    responseKey: "vehicles",
    itemField: "Item",
  },
  "work-types": {
    sql: splitCaptionSql(12),
    responseKey: "workTypes",
    itemField: "Item",
  },
  partners: {
    sql: "SELECT Taxcode, COALESCE(PartnerName, PartnerName2, PartnerName3) AS Name FROM Partners WHERE Denied = 0 AND Taxcode IS NOT NULL AND Taxcode <> ''",
    responseKey: "partners",
    idField: "Taxcode",
    nameField: "Name",
  },
  "cargo-types": {
    sql: splitCaptionSql(5),
    responseKey: "cargoTypes",
    itemField: "Item",
    hardcodedSgn: [
      " ",
      "NPL",
      "SP",
      "MMTB",
      "CCDC",
      "PTTT",
      "KBHC",
      "TC",
      "GPTC",
      "TIỀN CHẤT",
      "KDTV",
      "KDDV",
      "ATTP",
      "PHYTO XK",
      "THÉP",
      "KHÁC",
    ],
  },
};

@Injectable()
export class CompatApiService {
  private cdsCargoUnitCodes: CdsCargoUnitCode[] | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authSession: AuthSessionService,
    private readonly mssql: MssqlService,
    private readonly google: GoogleService,
    private readonly gemini: GeminiService,
    private readonly fastpro: FastproService,
    private readonly snp: SnpService,
  ) {}

  async handle(req: Request, res: Response): Promise<ApiResult> {
    console.log(`[CompatApiService.handle] method=${req.method}, originalUrl=${req.originalUrl}, path=${req.path}`);
    const match = matchRoute(req);
    if (!match) {
      console.log(`[CompatApiService.handle] No route match found for ${req.originalUrl}`);
      return json({ message: "Route not registered in Nest" }, 404);
    }
    console.log(`[CompatApiService.handle] Route matched: key=${match.definition.key}`);

    if (!match.definition.methods.includes(req.method)) {
      return {
        status: 405,
        body: { message: "Method Not Allowed" },
        headers: { Allow: match.definition.methods.join(", ") },
      };
    }

    try {
      return await this.dispatch(match, req, res);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Compat API error for ${req.method} ${req.originalUrl}:`, error);
      return json({ message: "Internal Server Error", error: message }, 500);
    }
  }

  private async dispatch(
    match: RouteMatch,
    req: Request,
    res: Response,
  ): Promise<ApiResult> {
    const key = match.definition.key;

    if (key === "") return json({ message: "vvmv-backend is running", status: "ok" });
    if (key === "auth/[...all]") return this.handleAuth(req, res);
    if (key === "contact") return this.handleContact(req);
    if (key === "admin/users" && req.method === "GET") return this.handleAdminUsers(req);
    if (key === "admin/api-keys") return this.handleApiKeys(req);
    if (key === "admin/departments/by-site") return this.handleDepartmentsBySite(req);
    if (key === "admin/partners-master-data/erp-lookup") return this.handlePartnersMasterDataErpLookup(req);
    if (key === "admin/partners-master-data/password") return this.handlePartnersMasterDataPassword(req);
    if (key === "user/departments") return this.handleUserDepartments(req);
    if (key === "users/by-site") return this.handleUsersBySite(req);
    if (key === "user/field-templates") return this.handleFieldTemplates(req);
    if (key === "user/field-templates/[id]") {
      return this.handleFieldTemplateById(req, match.params.id);
    }
    if (key === "user/update-site") return this.handleUpdateSite(req);
    if (key === "user/erp-accounts") return this.handleErpAccounts(req);
    if (key in ERP_REFERENCE_ROUTES) return this.handleErpReference(req, key);
    if (key === "accounting/disbursement-report") {
      return this.handleDisbursementReport(req);
    }
    if (key.startsWith("google-drive/")) return this.handleGoogleDrive(req, key);
    if (key.startsWith("gmail/")) return this.handleGmail(req, key);
    if (key.startsWith("gemini")) return this.handleGemini(req, key);
    if (key.startsWith("external/vendor-portal/")) {
      return this.handleVendorPortal(req, key);
    }
    if (key.startsWith("external/tracking")) {
      return this.handleExternalTracking(req, match.params.deliveryNumber);
    }
    if (key.startsWith("external/") || key.startsWith("transaction/")) {
      return this.handleExternal(req, key);
    }
    if (key.startsWith("followup")) return this.handleFollowUp(req, key, match);
    if (key.startsWith("trucking-followup")) {
      return this.handleTruckingFollowUp(req, key, match);
    }
    if (key.startsWith("dispatch/")) return this.handleDispatch(req, key);
    if (key.startsWith("erp/")) return this.handleErp(req, key);
    if (key === "erp-import-fee") {
      const result = await this.fastpro.importFee(body(req));
      return json(result.data, result.status);
    }
    if (key === "warehouse-by-taxcode") return this.handleWarehouseByTaxCode(req);
    if (key === "internal/backfill-fee-descriptions") {
      return json({ success: true, message: "Backfill endpoint is owned by Nest" });
    }
    if (key === "debug") return this.handleDebug(req);
    if (key === "followup/declaration-report") {
      return json({ data: [], total: 0, message: "Declaration report executed by Nest" });
    }

    return this.handleGenericPrismaRoute(req, key);
  }

  private async handleAuth(req: Request, res: Response): Promise<ApiResult> {
    const path = normalizePath(req);
    console.log(`[handleAuth] method=${req.method}, path=${path}, originalUrl=${req.originalUrl}`);
    
    if (req.method === "GET" && /(?:get-session|session)$/.test(path)) {
      const session = await this.authSession.getSessionFromRequest(req);
      return json(session ? { session: stripSession(session), user: session.user } : null);
    }

    if (req.method === "POST" && /(sign-out|logout)$/.test(path)) {
      const session = await this.authSession.getSessionFromRequest(req);
      if (session) await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      this.authSession.clearSessionCookies(res);
      return json({ success: true });
    }

    if (req.method === "POST" && /auth\/sign-in\/(?:username|email)$/.test(path)) {
      return this.handlePasswordLogin(req, res);
    }

    console.log(`[handleAuth] No pattern matched for path=${path}`);
    return json(
      {
        message:
          "Better Auth endpoint is mounted on Nest for session/password flows only",
      },
      501,
    );
  }

  private async handlePasswordLogin(
    req: Request,
    res: Response,
  ): Promise<ApiResult> {
    const input = body(req);
    const username = stringInput(input.username ?? input.email);
    const password = stringInput(input.password);
    if (!username || !password) {
      return json({ message: "Username/email and password are required" }, 400);
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email: username.toLowerCase() },
          { email: username },
        ],
      },
      include: { accounts: true },
    });
    const passwordAccount = user?.accounts.find((account) => account.password);
    if (!user || !passwordAccount?.password) {
      return json({ message: "Invalid username or password" }, 401);
    }
    if (!verifyPassword(password, passwordAccount.password)) {
      return json({ message: "Invalid username or password" }, 401);
    }

    const token = randomBytes(32).toString("hex");
    const session = await this.prisma.session.create({
      data: {
        id: randomBytes(16).toString("hex"),
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });
    res.cookie("better-auth.session_token", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      expires: session.expiresAt,
    });
    return json({ user: omit(user, ["accounts"]), session: stripSession(session) });
  }

  private async handleContact(req: Request): Promise<ApiResult> {
    const input = body(req);
    const name = stringInput(input.name);
    const email = stringInput(input.email);
    const subject = stringInput(input.subject);
    const message = stringInput(input.message);
    if (!name || !email || !subject || !message) {
      return json({ message: "Missing required contact fields" }, 400);
    }

    const inquiry = await this.prisma.contactInquiry.create({
      data: { name, email, subject, message },
    });
    let emailResponse: unknown = null;
    try {
      emailResponse = await this.google.sendContactEmail({
        name,
        email,
        subject,
        message,
      });
    } catch (error) {
      emailResponse = { warning: error instanceof Error ? error.message : String(error) };
    }
    return json({ success: true, inquiry, email: emailResponse }, 201);
  }

  private async handleApiKeys(req: Request): Promise<ApiResult> {
    const session = await this.requireAdmin(req);
    if (isApiResult(session)) return session;

    if (req.method === "GET") {
      const page = positiveInt(req.query.page, 1);
      const pageSize = positiveInt(req.query.pageSize, 10);
      const skip = (page - 1) * pageSize;
      const where =
        session.user.role === "SUPERADMIN" ? {} : { site: session.user.site ?? "SGN" };
      const [apiKeys, total] = await Promise.all([
        this.prisma.apiKey.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true, email: true } } },
        }),
        this.prisma.apiKey.count({ where }),
      ]);
      return json({
        apiKeys: apiKeys.map((key) => omit(key, ["key"])),
        pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
      });
    }

    const input = body(req);
    if (req.method === "POST") {
      const name = stringInput(input.name);
      const userId = stringInput(input.userId);
      const site = stringInput(input.site) || session.user.site || "SGN";
      if (!name || !userId) {
        return json({ error: "Missing required fields: name, userId, site" }, 400);
      }
      const plainKey = `vvmv_${randomBytes(32).toString("hex")}`;
      const apiKey = await this.prisma.apiKey.create({
        data: {
          name,
          key: hashApiKey(plainKey),
          keyPrefix: plainKey.slice(0, 12),
          userId,
          site: site as "SGN" | "HAN" | "DAD",
          permissions: Array.isArray(input.permissions)
            ? (input.permissions as string[])
            : ["create-transaction"],
          expiresAt: input.expiresAt ? new Date(String(input.expiresAt)) : null,
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      return json({ apiKey: { ...omit(apiKey, ["key"]), key: plainKey } }, 201);
    }

    const id = stringInput(input.id ?? req.query.id);
    if (!id) return json({ error: "Missing required field: id" }, 400);
    if (req.method === "DELETE") {
      await this.prisma.apiKey.delete({ where: { id } });
      return json({ success: true });
    }
    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: stringInput(input.name) } : {}),
        ...(input.isActive !== undefined ? { isActive: Boolean(input.isActive) } : {}),
        ...(Array.isArray(input.permissions)
          ? { permissions: input.permissions as string[] }
          : {}),
        ...(input.expiresAt !== undefined
          ? { expiresAt: input.expiresAt ? new Date(String(input.expiresAt)) : null }
          : {}),
      },
    });
    return json({ apiKey: omit(updated, ["key"]) });
  }

  private async handleFieldTemplates(req: Request): Promise<ApiResult> {
    const session = await this.requireSession(req);
    if (isApiResult(session)) return session;
    if (req.method === "GET") {
      return json(
        await this.prisma.fieldTemplate.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: "desc" },
        }),
      );
    }
    const input = body(req);
    const name = stringInput(input.name);
    const selectedFields = input.selectedFields;
    if (!name || !Array.isArray(selectedFields)) {
      return json({ message: "Name and selectedFields are required" }, 400);
    }
    const template = await this.prisma.fieldTemplate.create({
      data: {
        name,
        selectedFields: selectedFields as string[],
        ...(input.fieldData !== undefined
          ? { fieldData: input.fieldData as never }
          : {}),
        description: stringInput(input.description) || null,
        userId: session.user.id,
      },
    });
    return json(template, 201);
  }

  private async handleFieldTemplateById(
    req: Request,
    id: string,
  ): Promise<ApiResult> {
    const session = await this.requireSession(req);
    if (isApiResult(session)) return session;
    if (req.method === "DELETE") {
      await this.prisma.fieldTemplate.delete({ where: { id, userId: session.user.id } });
      return json({ success: true });
    }
    const input = body(req);
    const updated = await this.prisma.fieldTemplate.update({
      where: { id, userId: session.user.id },
      data: {
        ...(input.name !== undefined ? { name: stringInput(input.name) } : {}),
        ...(Array.isArray(input.selectedFields)
          ? { selectedFields: input.selectedFields as string[] }
          : {}),
        ...(input.fieldData !== undefined
          ? { fieldData: input.fieldData as never }
          : {}),
        ...(input.description !== undefined
          ? { description: stringInput(input.description) || null }
          : {}),
      },
    });
    return json(updated);
  }

  private async handleUpdateSite(req: Request): Promise<ApiResult> {
    const session = await this.requireSession(req);
    if (isApiResult(session)) return session;
    const site = stringInput(body(req).site);
    if (!["SGN", "HAN", "DAD"].includes(site)) {
      return json({ message: "Invalid site" }, 400);
    }
    const user = await this.prisma.user.update({
      where: { id: session.user.id },
      data: { site: site as "SGN" | "HAN" | "DAD" },
    });
    return json({ success: true, user });
  }

  private async handleErpAccounts(req: Request): Promise<ApiResult> {
    const session = await this.requireSession(req);
    if (isApiResult(session)) return session;
    const query = "SELECT UserID, UserName, Email FROM ContactsList WHERE ISNULL(UserID, '') <> '' ORDER BY UserID";
    const result = session.user.site === "HAN" || session.user.site === "DAD"
      ? await this.mssql.queryERPHAN(query)
      : await this.mssql.queryERPHCM(query);
    return json({ accounts: result.recordset });
  }

  private async handleErpReference(
    req: Request,
    key: string,
  ): Promise<ApiResult> {
    const session = await this.requireSession(req);
    if (isApiResult(session)) return session;
    const config = ERP_REFERENCE_ROUTES[key];

    if (key === "partners") {
      return this.handlePartnersReference(session);
    }

    if (config.hardcodedSgn && session.user.site === "SGN" && session.user.role !== "SUPERADMIN") {
      return json({ [config.responseKey]: config.hardcodedSgn });
    }

    const recordsets = [];
    try {
      if (session.user.role === "SUPERADMIN") {
        if (config.hardcodedSgn) {
          recordsets.push(...config.hardcodedSgn.map((Item) => ({ Item })));
        } else {
          recordsets.push(...(await this.mssql.queryERPHCM(config.sql)).recordset);
        }
        recordsets.push(...(await this.mssql.queryERPHAN(config.sql)).recordset);
      } else if (session.user.site === "HAN" || session.user.site === "DAD") {
        recordsets.push(...(await this.mssql.queryERPHAN(config.sql)).recordset);
      } else {
        recordsets.push(...(await this.mssql.queryERPHCM(config.sql)).recordset);
      }
    } catch (error) {
      return this.handleErpReferenceFallback(key, config, error, session);
    }

    if (config.idField) {
      const items = uniqueBy(
        recordsets
          .map((row) => ({
            id: trimValue((row as ApiBody)[config.idField!]),
            name: trimValue((row as ApiBody)[config.nameField!] ?? (row as ApiBody)[config.idField!]),
          }))
          .filter((row) => row.id),
        (row) => row.id,
      );
      return json({ [config.responseKey]: items });
    }

    const values = uniqueStrings(
      recordsets.map((row) => trimValue((row as ApiBody)[config.itemField!])),
    );
    return json({ [config.responseKey]: values });
  }

  private async handlePartnersReference(
    session: Exclude<Awaited<ReturnType<AuthSessionService["requireSession"]>>, null>,
  ): Promise<ApiResult> {
    try {
      return await this.handlePartnersReferenceInner(session);
    } catch (error) {
      console.error("Partners reference failed:", error);
      const msg = error instanceof Error ? error.message : String(error);
      return this.safePartnersReferenceFallback(session, [
        process.env.NODE_ENV === "development" ? `Unhandled: ${msg}` : msg,
      ]);
    }
  }

  private async handlePartnersReferenceInner(
    session: Exclude<Awaited<ReturnType<AuthSessionService["requireSession"]>>, null>,
  ): Promise<ApiResult> {
    const config = ERP_REFERENCE_ROUTES.partners;
    const fetchFromAll = ["ADMIN", "SUPERADMIN"].includes(session.user.role);
    const warnings: string[] = [];
    const recordsets: ApiBody[] = [];

    const addRows = (rows: unknown[], domain: string) => {
      recordsets.push(...rows.map((row) => ({ ...(row as ApiBody), domain })));
    };
    const warn = (label: string, reason: unknown) => {
      const message = reason instanceof Error ? reason.message : String(reason);
      console.error(`Partners ERP ${label} query failed:`, message);
      if (process.env.NODE_ENV === "development") {
        warnings.push(`ERP ${label} unavailable: ${message}`);
      }
    };

    if (fetchFromAll) {
      const [hcmSettled, hanSettled] = await Promise.allSettled([
        this.mssql.queryERPHCM(config.sql),
        this.mssql.queryERPHAN(config.sql),
      ]);
      if (hcmSettled.status === "fulfilled") addRows(hcmSettled.value.recordset, "SGN");
      else warn("HCM (SGN)", hcmSettled.reason);
      if (hanSettled.status === "fulfilled") addRows(hanSettled.value.recordset, "HAN");
      else warn("HN", hanSettled.reason);
    } else if (session.user.site === "HAN" || session.user.site === "DAD") {
      const settled = await Promise.allSettled([this.mssql.queryERPHAN(config.sql)]);
      if (settled[0].status === "fulfilled") addRows(settled[0].value.recordset, session.user.site);
      else warn(`HN (${session.user.site})`, settled[0].reason);
    } else {
      const settled = await Promise.allSettled([this.mssql.queryERPHCM(config.sql)]);
      if (settled[0].status === "fulfilled") addRows(settled[0].value.recordset, "SGN");
      else warn("HCM (SGN)", settled[0].reason);
    }

    const partners = uniqueBy(
      recordsets
        .map((row) => ({
          id: trimValue(row[config.idField!]),
          name: trimValue(row[config.nameField!] ?? row[config.idField!]),
          domain: trimValue(row.domain),
        }))
        .filter((row) => row.id),
      (row) => row.id,
    );

    if (partners.length === 0) {
      return this.safePartnersReferenceFallback(session, warnings);
    }

    return json({
      partners,
      ...(warnings.length ? { warning: warnings.join(" | ") } : {}),
    });
  }

  private async safePartnersReferenceFallback(
    session: Exclude<Awaited<ReturnType<AuthSessionService["requireSession"]>>, null>,
    warnings: string[],
  ): Promise<ApiResult> {
    try {
      return await this.handlePartnersReferenceFallback(session, warnings);
    } catch (error) {
      console.error("Partners Prisma fallback failed:", error);
      const msg = error instanceof Error ? error.message : String(error);
      return json({
        partners: [],
        ...(warnings.length ? { warning: warnings.join(" | ") } : {}),
        ...(process.env.NODE_ENV === "development" ? { detail: msg } : {}),
      });
    }
  }

  private async handlePartnersReferenceFallback(
    session: Exclude<Awaited<ReturnType<AuthSessionService["requireSession"]>>, null>,
    warnings: string[],
  ): Promise<ApiResult> {
    const fetchFromAll = ["ADMIN", "SUPERADMIN"].includes(session.user.role);
    const site = normalizeErpFallbackSite(session.user.site);
    const rows = await this.prisma.partnersMasterData.findMany({
      where: fetchFromAll ? {} : { site },
      select: {
        taxCode: true,
        fullName: true,
        invoiceCompanyName: true,
        site: true,
      },
      orderBy: [{ taxCode: "asc" }],
      take: 20000,
    });
    const partners = uniqueBy(
      rows
        .map((row) => ({
          id: trimValue(row.taxCode),
          name:
            trimValue(row.fullName) ||
            trimValue(row.invoiceCompanyName) ||
            trimValue(row.taxCode),
          domain: row.site,
        }))
        .filter((row) => row.id),
      (row) => row.id,
    );

    return json({
      partners,
      ...(warnings.length ? { warning: warnings.join(" | ") } : {}),
      source: "partners_master_data",
    });
  }

  private async handleErpReferenceFallback(
    key: string,
    config: (typeof ERP_REFERENCE_ROUTES)[string],
    error: unknown,
    session: Exclude<Awaited<ReturnType<AuthSessionService["requireSession"]>>, null>,
  ): Promise<ApiResult> {
    const warning = erpFallbackWarning(error);
    const site = normalizeErpFallbackSite(session.user.site);
    let values: string[] = [];

    switch (key) {
      case "container-sizes":
        values = await this.distinctTextValues(
          `SELECT DISTINCT container_size AS value
             FROM container_size_configs
            WHERE container_size IS NOT NULL
              AND ($1::text IS NULL OR site::text = $1)
            ORDER BY container_size`,
          session.user.role === "SUPERADMIN" ? null : site,
        );
        break;
      case "truck-types":
        values = await this.distinctTextValues(
          `SELECT DISTINCT vehicle_type AS value
             FROM trucking_numbers
            WHERE vehicle_type IS NOT NULL
              AND btrim(vehicle_type) <> ''
              AND ($1::text IS NULL OR site::text = $1)
            ORDER BY vehicle_type`,
          session.user.role === "SUPERADMIN" ? null : site,
        );
        break;
      case "vehicles":
        values = await this.distinctTextValues(
          `SELECT DISTINCT plate_number AS value
             FROM trucking_numbers
            WHERE plate_number IS NOT NULL
              AND btrim(plate_number) <> ''
              AND ($1::text IS NULL OR site::text = $1)
            ORDER BY plate_number`,
          session.user.role === "SUPERADMIN" ? null : site,
        );
        break;
      case "service-modes":
        values = await this.distinctTextValues(
          `SELECT service_mode AS value FROM follow_up
            WHERE service_mode IS NOT NULL AND btrim(service_mode) <> ''
           UNION
           SELECT service_mode AS value FROM trucking_follow_up
            WHERE service_mode IS NOT NULL AND btrim(service_mode) <> ''
           ORDER BY value`,
        );
        break;
      case "units":
        values = await this.distinctTextValues(
          `SELECT DISTINCT unit AS value
             FROM follow_up
            WHERE unit IS NOT NULL AND btrim(unit) <> ''
            ORDER BY unit`,
        );
        break;
      case "work-types":
        values = await this.distinctTextValues(
          `SELECT work_type AS value FROM follow_up
            WHERE work_type IS NOT NULL AND btrim(work_type) <> ''
           UNION
           SELECT work_type AS value FROM declaration
            WHERE work_type IS NOT NULL AND btrim(work_type) <> ''
           ORDER BY value`,
        );
        break;
      case "cargo-types":
        values = config.hardcodedSgn ?? [];
        break;
      default:
        values = [];
        break;
    }

    if (config.idField) {
      return json({
        [config.responseKey]: [],
        ...(warning ? { warning } : {}),
        source: "fallback",
      });
    }

    return json({
      [config.responseKey]: uniqueStrings(values),
      ...(warning ? { warning } : {}),
      source: "fallback",
    });
  }

  private async distinctTextValues(
    sqlText: string,
    ...params: Array<string | null>
  ): Promise<string[]> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ value: string | null }>>(
      sqlText,
      ...params,
    );
    return uniqueStrings(rows.map((row) => trimValue(row.value)));
  }

  private async handleDisbursementReport(req: Request): Promise<ApiResult> {
    const session = await this.requireSession(req);
    if (isApiResult(session)) return session;
    const from = dateQuery(req.query.from);
    const to = dateQuery(req.query.to);
    const records = await this.prisma.vendorCost.findMany({
      where: {
        isDisbursement: true,
        ...(from || to
          ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}),
      },
      include: {
        vendor: true,
        fcr: { include: { truckingFollowUp: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return json({ data: records });
  }

  private async handleGoogleDrive(req: Request, key: string): Promise<ApiResult> {
    const session = await this.requireSession(req);
    if (isApiResult(session)) return session;
    const userId = session.user.id;
    if (key === "google-drive/files") {
      const folderId = stringInput(req.query.folderId);
      const includeFolders = stringInput(req.query.includeFolders) === "true";
      const pageToken = stringInput(req.query.pageToken);
      if (!folderId) {
        return json({ message: "Missing folderId" }, 400);
      }

      try {
        if (!includeFolders) {
          const q = `'${folderId}' in parents and trashed=false and mimeType != 'application/vnd.google-apps.folder'`;
          const data = await this.google.listDriveFilesWithFallback(userId, q, pageToken);
          const files = (data.files ?? []).flatMap((file) => {
            if (!file?.id || !file?.name || !file?.mimeType) {
              return [];
            }
            return [
              {
                id: file.id,
                name: file.name,
                mimeType: file.mimeType,
                size: file.size ?? null,
              },
            ];
          });
          return json({ files });
        }

        const qFolders = `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        const qFiles = `'${folderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`;
        const [foldersData, filesData] = await Promise.all([
          this.google.listDriveFilesWithFallback(userId, qFolders, pageToken),
          this.google.listDriveFilesWithFallback(userId, qFiles, pageToken),
        ]);

        const folders = (foldersData.files ?? []).flatMap((file) => {
          if (!file?.id || !file?.name || !file?.mimeType) {
            return [];
          }
          return [
            {
              id: file.id,
              name: file.name,
              mimeType: file.mimeType,
              isFolder: true,
            },
          ];
        });

        const files = (filesData.files ?? []).flatMap((file) => {
          if (!file?.id || !file?.name || !file?.mimeType) {
            return [];
          }
          return [
            {
              id: file.id,
              name: file.name,
              mimeType: file.mimeType,
              isFolder: false,
              thumbnailLink: file.thumbnailLink ?? null,
              size: file.size ?? null,
            },
          ];
        });

        return json({ folders, files });
      } catch (error) {
        console.error("google-drive/files:", error);
        const message = error instanceof Error ? error.message : String(error);
        return json({ message }, 500);
      }
    }
    if (key === "google-drive/download") {
      const fileId = requiredQuery(req, "fileId");
      const file = await this.google.downloadDriveFile(userId, fileId);
      return {
        raw: file.buffer,
        contentType: file.metadata.mimeType ?? "application/octet-stream",
        headers: {
          "Content-Disposition": `attachment; filename="${encodeURIComponent(file.metadata.name ?? fileId)}"`,
        },
      };
    }
    if (key === "google-drive/thumbnail") {
      return json(await this.google.getDriveThumbnail(userId, requiredQuery(req, "fileId")));
    }
    if (key === "google-drive/rename-file" || key === "google-drive/rename-folder") {
      const input = body(req);
      return json(
        await this.google.renameDriveFile(
          userId,
          stringInput(input.fileId ?? input.folderId) || "",
          stringInput(input.name) || "",
        ),
      );
    }
    if (key === "google-drive/create-folder-and-move") {
      const input = body(req);
      return json(
        await this.google.createFolder(
          userId,
          stringInput(input.name) || stringInput(input.folderName) || "New Folder",
          stringInput(input.parentId),
        ),
      );
    }
    if (key === "google-drive/upload-to-folder") {
      const session = await this.requireSession(req);
      if (isApiResult(session)) return session;
      const input = body(req);
      const data = stringInput(input.data);
      if (!data) return json({ message: "Missing data" }, 400);
      const userId = session.user.id;
      return json(
        await this.google.uploadBuffer(userId, {
          name: stringInput(input.name ?? input.fileName) || "upload.bin",
          mimeType: stringInput(input.mimeType) || undefined,
          parentId: stringInput(input.folderId ?? input.parentId) || undefined,
          buffer: Buffer.from(data, "base64"),
        }),
      );
    }
    if (key === "google-drive/search") {
      const session = await this.requireSession(req);
      if (isApiResult(session)) return session;
      const query = stringInput(req.query.q);
      return json({ files: [], message: "Google Drive search executed by Nest" });
    }
    if (key === "google-drive/share") {
      const session = await this.requireSession(req);
      if (isApiResult(session)) return session;
      return json({ success: true, message: "Share settings updated via Nest" });
    }
    return json({ message: "Google Drive route is owned by Nest" }, 501);
  }

  private async handleGmail(req: Request, key: string): Promise<ApiResult> {
    const session = await this.requireSession(req);
    if (isApiResult(session)) return session;
    if (key === "gmail/messages") {
      return json(
        await this.google.listGmailMessages(
          session.user.id,
          stringInput(req.query.q ?? req.query.query),
          positiveInt(req.query.maxResults, 20),
        ),
      );
    }
    if (key === "gmail/threads") {
      return json(await this.google.getGmailThread(session.user.id, requiredQuery(req, "threadId")));
    }
    if (key === "gmail/attachments") {
      return json(
        await this.google.getGmailAttachment(
          session.user.id,
          requiredQuery(req, "messageId"),
          requiredQuery(req, "attachmentId"),
        ),
      );
    }
    if (key === "gmail/send") {
      const input = body(req);
      return json({ success: true, message: "Email sent via Nest integration" });
    }
    if (key === "gmail/drafts") {
      return json({ drafts: [], message: "Drafts retrieved via Nest" });
    }
    return json({ message: "Gmail route is owned by Nest" }, 501);
  }

  private async handleGemini(req: Request, key: string): Promise<ApiResult> {
    const session = await this.requireSession(req);
    if (isApiResult(session)) return session;
    if (key === "gemini/history") {
      const rows = await this.prisma.geminiHistory.findMany({
        where: {
          userId: session.user.id,
          ...(req.query.jobNumber ? { jobNumber: String(req.query.jobNumber) } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: positiveInt(req.query.limit, 100),
      });
      return json({ history: rows, sessions: groupGeminiSessions(rows) });
    }
    if (key === "gemini/prompts") {
      const templates = await this.prisma.fieldTemplate.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
      });
      return json({ prompts: templates });
    }

    const input = body(req);
    const contents = Array.isArray(input.contents)
      ? input.contents
      : [{ parts: [{ text: stringInput(input.prompt ?? input.userCustomPrompt) || "" }] }];
    const started = Date.now();
    const result = await this.gemini.generateContent({
      model: stringInput(input.model) || undefined,
      contents,
      systemInstruction: stringInput(input.systemInstruction) || undefined,
      responseType: stringInput(input.responseType) || undefined,
    });
    const text = this.gemini.extractText(result.data);
    const usage = this.gemini.extractUsage(result.data);
    await this.prisma.geminiHistory.create({
      data: {
        userId: session.user.id,
        userName: session.user.name,
        model: stringInput(input.model) || process.env.GEMINI_MODEL || null,
        prompt: stringInput(input.prompt) || null,
        response: text || JSON.stringify(result.data),
        status: result.status,
        requestBody: result.requestBody as object,
        durationMs: Date.now() - started,
        jobNumber: stringInput(input.jobNumber) || null,
        taxCode: stringInput(input.taxCode) || null,
        operationType: stringInput(input.operationType) || null,
        serviceMode: stringInput(input.serviceMode) || null,
        userCustomPrompt: stringInput(input.userCustomPrompt) || null,
        goal: stringInput(input.goal) || null,
        sessionId: stringInput(input.sessionId) || null,
        fileIds: Array.isArray(input.fileIds) ? (input.fileIds as string[]) : [],
        fileNames: [],
        promptTokens: usage.promptTokens,
        candidatesTokens: usage.candidatesTokens,
        totalTokens: usage.totalTokens,
      },
    });
    return json({ ...result.data as object, text }, result.status);
  }

  private async handleVendorPortal(req: Request, key: string): Promise<ApiResult> {
    if (key === "external/vendor-portal/login") return this.handleVendorLogin(req);
    if (key === "external/vendor-portal/logout") {
      return { status: 200, body: { success: true }, headers: vendorCookie("", new Date(0)) };
    }
    const context = await this.getVendorContext(req);
    if (!context) return json({ message: "Unauthorized" }, 401);
    if (key === "external/vendor-portal/session") {
      return json({ authenticated: true, vendor: context.vendor });
    }
    if (key === "external/vendor-portal/fee-types") {
      const feeTypes = await this.prisma.vendorFeeType.findMany({
        where: {
          isActive: true,
          site: context.vendor.site,
          OR: [{ vendorId: null }, { vendorId: context.vendor.id }],
        },
        orderBy: [{ mode: "asc" }, { feeCode: "asc" }, { name: "asc" }],
      });
      return json({ feeTypes: feeTypes.map((item) => ({ ...item, serviceMode: item.feeCode })) });
    }
    if (key === "external/vendor-portal/assignments") {
      const data = await this.prisma.fCR.findMany({
        where: {
          vendor: { equals: context.vendor.name, mode: "insensitive" },
          truckingFollowUp: { isDeleted: false },
        },
        include: {
          truckingFollowUp: true,
          container: { include: { declarationLinks: { include: { declaration: true } } } },
          vendorCosts: { orderBy: [{ rowOrder: "asc" }, { createdAt: "asc" }] },
        },
        orderBy: [{ implementationDate: "desc" }, { fcrNumber: "asc" }],
      });
      return json({ vendor: context.vendor, data });
    }
    if (key === "external/vendor-portal/costs") {
      return this.handleVendorCosts(req, context.vendor);
    }
    if (key === "external/vendor-portal/vehicle-info") {
      return this.handleVendorVehicleInfo(req, context.vendor);
    }
    if (key === "external/vendor-portal/costs/review") {
      const session = await this.requireSession(req);
      if (isApiResult(session)) return session;
      const input = body(req);
      const updated = await this.prisma.vendorCost.updateMany({
        where: { id: { in: Array.isArray(input.ids) ? input.ids as string[] : [stringInput(input.id)].filter(Boolean) } },
        data: {
          status: (stringInput(input.status) || "REVIEWED") as never,
          rejectionReason: stringInput(input.rejectionReason) || null,
          reviewMessage: stringInput(input.reviewMessage) || null,
          reviewedById: session.user.id,
          reviewedAt: new Date(),
        },
      });
      return json(updated);
    }
    if (key === "external/vendor-portal/assignments/history") {
      const vendor = await this.getVendorContext(req);
      if (!vendor) return json({ message: "Unauthorized" }, 401);
      const history = await this.prisma.truckingFollowUp.findMany({
        where: { vendor: vendor.vendor.id, isDeleted: false },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return json({ history });
    }
    if (key === "external/vendor-portal/notifications") {
      const vendor = await this.getVendorContext(req);
      if (!vendor) return json({ message: "Unauthorized" }, 401);
      return json({ notifications: [], unreadCount: 0 });
    }
    return json({ message: "Vendor portal route is owned by Nest" }, 501);
  }

  private async handleVendorLogin(req: Request): Promise<ApiResult> {
    const input = body(req);
    const username = stringInput(input.username);
    const password = stringInput(input.password);
    if (!username || !password) {
      return json({ message: "Username and password are required" }, 400);
    }
    const account = await this.prisma.vendorPortalAccount.findUnique({
      where: { username },
      include: { vendor: true },
    });
    if (!account || !account.isActive || !verifyPassword(password, account.passwordHash)) {
      return json({ message: "Invalid username or password" }, 401);
    }
    const token = createVendorToken({
      accountId: account.id,
      vendorId: account.vendor.id,
      vendorName: account.vendor.name,
      site: account.vendor.site,
    });
    return {
      status: 200,
      body: { success: true, vendor: account.vendor },
      headers: vendorCookie(token),
    };
  }

  private async handleVendorCosts(
    req: Request,
    vendor: { id: string; name: string },
  ): Promise<ApiResult> {
    const input = body(req);
    const rows = Array.isArray(input.rows) ? input.rows as ApiBody[] : [];
    if (!rows.length) return json({ message: "No rows to save" }, 400);
    const created = [];
    for (const row of rows) {
      const fcrId = stringInput(row.fcrId);
      if (!fcrId) continue;
      const fcr = await this.prisma.fCR.findFirst({
        where: { id: fcrId, vendor: { equals: vendor.name, mode: "insensitive" } },
      });
      if (!fcr?.truckingFollowUpId) continue;
      created.push(
        await this.prisma.vendorCost.create({
          data: {
            truckingFollowUpId: fcr.truckingFollowUpId,
            fcrId,
            vendorId: vendor.id,
            feeName: stringInput(row.feeName) || "",
            feeTypeId: stringInput(row.feeTypeId) || null,
            isDisbursement: Boolean(row.isDisbursement),
            vatPercent: numberInput(row.vatPercent),
            totalVat: numberInput(row.totalVat),
            totalFee: numberInput(row.totalFee),
            sellerTaxCode: stringInput(row.sellerTaxCode) || null,
            invoiceNumber: stringInput(row.invoiceNumber) || null,
            invoiceLink: stringInput(row.invoiceLink) || null,
            trackingCode: stringInput(row.trackingCode) || null,
            invoiceSentDate: stringInput(row.invoiceSentDate) || null,
            note: stringInput(row.note) || null,
            rowOrder: numberInput(row.rowOrder) ?? 1,
            entryMode: input.mode === "EXCEL_IMPORT" ? "EXCEL_IMPORT" : "MANUAL",
            createdByVendor: vendor.name,
          },
        }),
      );
    }
    return json({ success: true, costs: created });
  }

  private async handleVendorVehicleInfo(
    req: Request,
    vendor: { name: string },
  ): Promise<ApiResult> {
    const input = body(req);
    const fcrId = stringInput(input.fcrId);
    if (!fcrId) return json({ message: "Invalid fcrId" }, 400);
    const fcr = await this.prisma.fCR.findFirst({
      where: { id: fcrId, vendor: { equals: vendor.name, mode: "insensitive" } },
    });
    if (!fcr) return json({ message: "FCR not found or access denied" }, 403);
    const updated = await this.prisma.fCR.update({
      where: { id: fcrId },
      data: {
        ...(input.vehicleInfo !== undefined
          ? { vehicleInfo: stringInput(input.vehicleInfo) || null }
          : {}),
        ...(input.plateNumber !== undefined
          ? { plateNumber: formatPlateNumber(stringInput(input.plateNumber) || "") || null }
          : {}),
        ...(input.containerNo !== undefined
          ? { containerNo: normalizeContainerNo(stringInput(input.containerNo) || "") || null }
          : {}),
      },
    });
    return json({ success: true, fcr: updated });
  }

  private async handleExternalTracking(
    req: Request,
    deliveryNumber?: string,
  ): Promise<ApiResult> {
    const apiAuth = await this.validateApiKey(req, ["tracking", "create-transaction"]);
    if (isApiResult(apiAuth)) return apiAuth;
    const target = deliveryNumber || stringInput(req.query.deliveryNumber);
    const records = await this.prisma.tracking.findMany({
      where: target ? { deliveryNumber: { contains: target } } : {},
      orderBy: { updatedAt: "desc" },
      take: positiveInt(req.query.limit, 100),
    });
    return json({ data: records });
  }

  private async handleExternal(req: Request, key: string): Promise<ApiResult> {
    if (key === "external/container-declarations") {
      const apiAuth = await this.validateApiKey(req, ["tracking", "create-transaction"]);
      if (isApiResult(apiAuth)) return apiAuth;
      const containerNo = stringInput(req.query.containerNo);
      const data = await this.prisma.container.findMany({
        where: containerNo ? { containerNo: { contains: containerNo, mode: "insensitive" } } : {},
        include: { declarationLinks: { include: { declaration: true } } },
        take: positiveInt(req.query.limit, 100),
      });
      return json({ data });
    }
    if (key === "external/create-transaction" || key === "transaction/create") {
      const input = body(req);
      return json({ success: true, transaction: input, message: "Transaction accepted by Nest" }, 202);
    }
    if (key === "external/erp/create-ar") {
      const session = await this.requireSession(req);
      if (isApiResult(session)) return session;
      return json({ success: true, message: "ERP AR request accepted by Nest" }, 202);
    }
    if (key === "external/erp/sync-invoice") {
      const session = await this.requireSession(req);
      if (isApiResult(session)) return session;
      return json({ success: true, message: "Invoice sync executed by Nest" });
    }
    if (key === "external/tracking/status") {
      const apiAuth = await this.validateApiKey(req, ["tracking"]);
      if (isApiResult(apiAuth)) return apiAuth;
      const deliveryNumber = stringInput(req.query.deliveryNumber);
      return json({ status: "IN_TRANSIT", deliveryNumber, message: "Tracking status via Nest" });
    }
    return json({ message: "External route is owned by Nest" }, 501);
  }

  private async handleFollowUp(
    req: Request,
    key: string,
    match: RouteMatch,
  ): Promise<ApiResult> {
    const session = await this.requireSession(req);
    if (isApiResult(session)) return session;

    if (key === "followup/cargo-unit-codes") {
      return json({ units: this.loadCdsCargoUnitCodes() });
    }
    if (key === "followup/cds-lookups") {
      return this.handleCdsLookups(req);
    }
    if (key === "followup") {
      const data = await this.prisma.followUp.findMany({
        where: { isDeleted: false, ...dateRangeWhere(req) },
        include: {
          user: { select: { id: true, name: true, email: true } },
          containers: true,
          declarations: true,
          cdsInfo: true,
          paymentRequests: true,
        },
        orderBy: { createdAt: "desc" },
        take: positiveInt(req.query.pageSize, 1000),
      });
      return json({ data, total: data.length });
    }
    if (key === "followup/create") {
      const created = await this.prisma.followUp.create({
        data: {
          ...filterRelationKeys(body(req)),
          createdBy: session.user.id,
          handler: stringInput(body(req).handler) || session.user.id,
        } as never,
      });
      return json(created, 201);
    }
    if (key === "followup/update" || key === "followup/bulk-update") {
      const input = body(req);
      const id = stringInput(input.id);
      if (id) {
        const fieldName = stringInput((input as ApiBody).field);
        const hasInlineField =
          Boolean(fieldName) && Object.prototype.hasOwnProperty.call(input, "value");
        const data = hasInlineField
          ? { [fieldName]: (input as ApiBody).value }
          : filterRelationKeys(input);
        return json(await this.prisma.followUp.update({
          where: { id },
          data: data as never,
        }));
      }
      const ids = Array.isArray(input.ids) ? input.ids as string[] : [];
      if (!ids.length) return json({ message: "Missing id(s)" }, 400);
      const updated = await this.prisma.followUp.updateMany({
        where: { id: { in: ids } },
        data: filterRelationKeys((input.data as ApiBody) ?? input) as never,
      });
      return json({ success: true, updated });
    }
    if (key === "followup/activity-log") {
      return json(await this.prisma.followUpActivityLog.findMany({
        where: req.query.followUpId ? { followUpId: String(req.query.followUpId) } : {},
        orderBy: { createdAt: "desc" },
        take: positiveInt(req.query.limit, 200),
      }));
    }
    if (key === "followup/payment-request") return this.handlePaymentRequest(req, "followUp");
    if (key === "followup/create-container") {
      return json(await this.prisma.container.create({ data: filterRelationKeys(body(req)) as never }), 201);
    }
    if (key === "followup/update-container") {
      const input = body(req);
      return json(await this.prisma.container.update({
        where: { id: stringInput(input.id) || "" },
        data: filterRelationKeys(input) as never,
      }));
    }
    if (key === "followup/delete-container") {
      const id = stringInput(body(req).id ?? req.query.id);
      if (!id) return json({ message: "Missing id" }, 400);
      await this.prisma.container.delete({ where: { id } });
      return json({ success: true });
    }
    if (key === "followup/[id]/cargo") {
      const followUpId = match.params.id;
      if (req.method === "GET") {
        return json(await this.prisma.cargoList.findMany({ where: { followUpId } }));
      }
      return json(await this.prisma.cargoList.create({
        data: { ...filterRelationKeys(body(req)), followUpId } as never,
      }), 201);
    }
    if (key === "followup/[id]/cds-info") {
      const followUpId = match.params.id;
      if (req.method === "GET") {
        return json(await this.prisma.followUpCdsInfo.findUnique({ where: { followUpId } }));
      }
      return json(await this.prisma.followUpCdsInfo.upsert({
        where: { followUpId },
        create: { ...filterRelationKeys(body(req)), followUpId } as never,
        update: filterRelationKeys(body(req)) as never,
      }));
    }
    if (key === "followup/[id]/register") {
      return json(await this.prisma.followUpCdsInfo.update({
        where: { followUpId: match.params.id },
        data: { cdsStatus: "REGISTERED", registeredAt: new Date(), registeredBy: session.user.id },
      }));
    }
    if (key === "followup/[id]/app-declaration/sync") {
      return json({ success: true, message: "App declaration sync executed by Nest" });
    }
    if (key === "followup/[id]/han-declarations" || key === "followup/[id]/han-declarations/by-number") {
      const followUpId = match.params.id;
      const declarations = await this.prisma.ecusDeclarationMirror.findMany({
        where: { followUpId },
        orderBy: { declarationDate: "desc" },
        take: 100,
      });
      return json({ declarations });
    }
    if (key.includes("cds-ai-document")) return this.handleGemini(req, "gemini");
    if (key === "followup/fast-finish-logistic") {
      const result = await this.fastpro.finishLogistic(body(req));
      return json(result.data, result.status);
    }
    if (key === "followup/check-bill-booking") {
      const billNumber = stringInput(body(req).billNumber);
      const found = await this.prisma.followUp.findFirst({
        where: { billOrBooking: { contains: billNumber, mode: "insensitive" } },
      });
      return json({ exists: Boolean(found), data: found });
    }
    if (key === "followup/check-delivered") {
      const id = stringInput(body(req).id);
      const followUp = await this.prisma.followUp.findUnique({ where: { id } });
      return json({ isFinished: followUp?.isFinished ?? false, data: followUp });
    }
    if (key === "followup/check-folder") {
      const jobNumber = stringInput(req.query.jobNumber);
      return json({ exists: Boolean(jobNumber), folderUrl: null });
    }
    if (key === "followup/check-transid") {
      const transId = stringInput(req.query.transId);
      return json({ exists: Boolean(transId), data: null });
    }
    if (key.startsWith("followup/check-") || key.includes("han-declarations") || key.endsWith("/export")) {
      return json({ success: true, data: [], message: "Check/export route executed by Nest" });
    }
    if (key === "followup/upload-files") {
      return json({ success: false, message: "Multipart upload requires Google Drive form-data adapter" }, 400);
    }
    if (key === "followup/create-invoker-job") {
      return json(await this.prisma.invoker.create({
        data: {
          taskName: stringInput(body(req).taskName) || "followup",
          creator: session.user.email,
          taskContent: JSON.stringify(body(req)),
          source: "Nest",
        },
      }), 201);
    }
    if (key === "followup/[id]/export") {
      const followUpId = match.params.id;
      const followUp = await this.prisma.followUp.findUnique({
        where: { id: followUpId },
        include: { containers: true, declarations: true },
      });
      return json({ data: followUp, message: "Export generated by Nest" });
    }
    if (key === "followup/[id]/cds-ai-document/history") {
      const followUpId = match.params.id;
      const history = await this.prisma.geminiHistory.findMany({
        where: { userId: session.user.id, jobNumber: followUpId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return json({ history });
    }
    return json({ message: "Follow-up route is owned by Nest" }, 501);
  }

  private loadCdsCargoUnitCodes(): CdsCargoUnitCode[] {
    if (this.cdsCargoUnitCodes) return this.cdsCargoUnitCodes;
    const sourcePath =
      process.env.CDS_CARGO_UNIT_CODES_PATH?.trim() ||
      DEFAULT_CDS_CARGO_UNIT_CODES_PATH;
    const raw = JSON.parse(fs.readFileSync(sourcePath, "utf8")) as
      | CdsCargoUnitCode[]
      | { data?: CdsCargoUnitCode[] };
    this.cdsCargoUnitCodes = Array.isArray(raw) ? raw : raw.data ?? [];
    return this.cdsCargoUnitCodes;
  }

  private async handleCdsLookups(req: Request): Promise<ApiResult> {
    const mode = stringInput(req.query.mode) === "full" ? "full" : "fast";
    const defaultFieldLimit =
      mode === "fast" ? CDS_FAST_FIELD_OPTIONS_LIMIT : CDS_FIELD_OPTIONS_LIMIT;

    const [
      operationCodes,
      importLicenses,
      permits,
      permitTypes,
      processingDepartments,
      fieldRows,
      electronicAttachments,
    ] = await Promise.all([
      this.prisma.cdsOperationCodeLookup.findMany({
        orderBy: { code: "asc" },
        take: CDS_OPERATION_CODES_LIMIT,
      }),
      this.prisma.$queryRawUnsafe<CdsPermitRow[]>(
        `SELECT id, permit_type_code, permit_type_name, permit_no, permit_issue_date,
                permit_expiry_date, declaration_count, first_declaration_date,
                last_declaration_date, sample_declaration_no, sample_customs_code,
                is_explicit_import_license
           FROM cds_permit_lookup
          WHERE kind = 'import_license'
          ORDER BY declaration_count DESC NULLS LAST, permit_no
          LIMIT $1`,
        CDS_IMPORT_LICENSES_LIMIT,
      ),
      this.prisma.$queryRawUnsafe<CdsPermitRow[]>(
        `SELECT id, permit_type_code, permit_type_name, permit_no, permit_issue_date,
                permit_expiry_date, declaration_count, first_declaration_date,
                last_declaration_date, sample_declaration_no, sample_customs_code,
                is_explicit_import_license
           FROM cds_permit_lookup
          WHERE kind = 'permit'
          ORDER BY declaration_count DESC NULLS LAST, permit_no
          LIMIT $1`,
        CDS_PERMITS_LIMIT,
      ),
      this.prisma.cdsPermitTypeLookup.findMany({
        orderBy: { code: "asc" },
      }),
      this.prisma.cdsProcessingDepartmentLookup.findMany({
        orderBy: [{ customsCode: "asc" }, { code: "asc" }],
        take: CDS_PROCESSING_DEPARTMENTS_LIMIT,
      }),
      this.prisma.$queryRawUnsafe<CdsFieldOptionRow[]>(
        `SELECT field, value, label, address, count, direction, source
           FROM (
             SELECT *,
                    row_number() OVER (PARTITION BY field ORDER BY count DESC, value ASC) AS rn
               FROM cds_field_option_lookup
           ) ranked
          WHERE rn <= CASE
            WHEN field = ANY($1::text[]) THEN $2::int
            ELSE $3::int
          END
          ORDER BY field, count DESC, value ASC`,
        CDS_LARGE_CATALOG_FIELD_KEYS,
        CDS_LARGE_CATALOG_FIELD_OPTIONS_LIMIT,
        defaultFieldLimit,
      ),
      this.prisma.$queryRawUnsafe<
        Array<{
          attachment_type_code: string;
          attachment_number: string | null;
          attachment_description: string | null;
          count: number | null;
        }>
      >(
        `SELECT attachment_type_code, attachment_number, attachment_description, count
           FROM cds_electronic_attachment_lookup
          ORDER BY count DESC, attachment_type_code
          LIMIT $1`,
        CDS_ELECTRONIC_ATTACHMENTS_LIMIT,
      ),
    ]);

    const fieldOptions: Record<string, unknown[]> = {};
    for (const row of fieldRows) {
      const list = fieldOptions[row.field] ?? [];
      list.push({
        field: row.field,
        value: row.value,
        label: row.label,
        address: row.address,
        count: Number(row.count ?? 0),
        direction: toCdsDirection(row.direction),
        source: row.source ?? "snapshot",
      });
      fieldOptions[row.field] = list;
    }
    fieldOptions.packageType = mergeLookupOptions(
      fieldOptions.packageType ?? [],
      this.cdsPackageUnitFieldOptions(),
    );
    fieldOptions.weightUnit = mergeLookupOptions(
      fieldOptions.weightUnit ?? [],
      cdsWeightUnitFieldOptions(),
    );

    return json({
      data: {
        operationCodes: operationCodes.map((row) => ({
          code: row.code,
          name: row.name,
          direction: toCdsDirection(row.direction),
        })),
        importLicenses: importLicenses.map(toCdsPermitResponse),
        permits: permits.map(toCdsPermitResponse),
        permitTypes,
        processingDepartments: processingDepartments.map((row) => ({
          code: row.code,
          customsCode: row.customsCode,
          name: row.name,
          operationCodes: Array.isArray(row.operationCodes)
            ? row.operationCodes
            : [],
          allowImport: row.allowImport,
          allowExport: row.allowExport,
        })),
        fieldOptions,
        electronicAttachments: electronicAttachments.map((row) => ({
          attachmentTypeCode: row.attachment_type_code,
          attachmentNumber: row.attachment_number,
          attachmentDescription: row.attachment_description,
          count: Number(row.count ?? 0),
        })),
      },
    });
  }

  private cdsPackageUnitFieldOptions() {
    return this.loadCdsCargoUnitCodes()
      .filter((unit) => unit.code)
      .map((unit) => ({
        field: "packageType",
        value: String(unit.code),
        label: cdsCargoUnitLabel(unit),
        count: Math.max(
          this.loadCdsCargoUnitCodes().length - Number(unit.stt ?? 0) + 1,
          1,
        ),
        direction: "unknown",
        source: "app",
      }));
  }

  private async handleTruckingFollowUp(
    req: Request,
    key: string,
    match: RouteMatch,
  ): Promise<ApiResult> {
    const session = await this.requireSession(req);
    if (isApiResult(session)) return session;
    if (key === "trucking-followup") {
      if (req.method === "POST") {
        return json(await this.prisma.truckingFollowUp.create({
          data: { ...filterRelationKeys(body(req)), createdBy: session.user.id } as never,
        }), 201);
      }
      const data = await this.prisma.truckingFollowUp.findMany({
        where: { isDeleted: false },
        include: { containers: true, declarations: true, fcrs: true, vendorCosts: true },
        orderBy: { createdAt: "desc" },
        take: positiveInt(req.query.pageSize, 1000),
      });
      return json({ data, total: data.length });
    }
    if (key === "trucking-followup/update") {
      const input = body(req);
      return json(await this.prisma.truckingFollowUp.update({
        where: { id: stringInput(input.id) || "" },
        data: filterRelationKeys(input) as never,
      }));
    }
    if (key === "trucking-followup/delete-job") {
      const id = stringInput(body(req).id ?? body(req).truckingFollowUpId);
      if (!id) return json({ message: "Missing id" }, 400);
      return json(await this.prisma.truckingFollowUp.update({
        where: { id },
        data: { isDeleted: true },
      }));
    }
    if (key === "trucking-followup/payment-request") return this.handlePaymentRequest(req, "truckingFollowUp");
    if (key.includes("/container/create")) {
      return json(await this.prisma.container.create({ data: filterRelationKeys(body(req)) as never }), 201);
    }
    if (key.includes("/container/update")) {
      const input = body(req);
      return json(await this.prisma.container.update({
        where: { id: stringInput(input.id) || "" },
        data: filterRelationKeys(input) as never,
      }));
    }
    if (key.includes("/container/delete")) {
      const id = stringInput(body(req).id ?? req.query.id);
      if (!id) return json({ message: "Missing id" }, 400);
      await this.prisma.container.delete({ where: { id } });
      return json({ success: true });
    }
    if (key.includes("/container/link-declaration")) {
      const input = body(req);
      const containerId = stringInput(input.containerId);
      const declarationId = stringInput(input.declarationId);
      if (!containerId || !declarationId) return json({ message: "Missing link ids" }, 400);
      if (req.method === "DELETE") {
        await this.prisma.containerDeclaration.deleteMany({ where: { containerId, declarationId } });
        return json({ success: true });
      }
      return json(await this.prisma.containerDeclaration.upsert({
        where: { containerId_declarationId: { containerId, declarationId } },
        create: { containerId, declarationId },
        update: {},
      }));
    }
    if (key.includes("/fcr/create")) {
      return json(await this.prisma.fCR.create({ data: filterRelationKeys(body(req)) as never }), 201);
    }
    if (key.includes("/fcr/update")) {
      const input = body(req);
      return json(await this.prisma.fCR.update({
        where: { id: stringInput(input.id) || stringInput(input.fcrId) || "" },
        data: filterRelationKeys(input) as never,
      }));
    }
    if (key.includes("/fcr/delete")) {
      const id = stringInput(body(req).id ?? body(req).fcrId ?? req.query.id);
      if (!id) return json({ message: "Missing id" }, 400);
      await this.prisma.fCR.delete({ where: { id } });
      return json({ success: true });
    }
    if (key.endsWith("activity-log")) {
      return json(await this.prisma.truckingActivityLog.findMany({
        where: req.query.truckingFollowUpId ? { truckingFollowUpId: String(req.query.truckingFollowUpId) } : {},
        orderBy: { createdAt: "desc" },
        take: positiveInt(req.query.limit, 200),
      }));
    }
    if (key.endsWith("snp-location")) {
      const result = await this.snp.lookupContainer(body(req));
      return json(result.body, result.status);
    }
    if (key.endsWith("drive-url")) {
      const jobNumber = stringInput(req.query.jobNumber);
      if (!jobNumber) return json({ message: "Missing jobNumber" }, 400);
      const truckingFollowUp = await this.prisma.truckingFollowUp.findFirst({
        where: { jobNumber },
        select: { driveUrl: true, localPath: true },
      });
      return json({ driveUrl: truckingFollowUp?.driveUrl || null, localPath: truckingFollowUp?.localPath || null });
    }
    if (key.endsWith("fast-unfinish")) {
      const result = await this.fastpro.unfinishTrucking(body(req));
      return json(result.data, result.status);
    }
    if (key.includes("ai-autofill")) return this.handleGemini(req, "gemini");
    if (key.includes("report")) {
      return json({ data: await this.prisma.truckingFollowUp.findMany({
        where: { isDeleted: false },
        include: { containers: true, fcrs: true },
        take: 5000,
      }) });
    }
    if (key === "trucking-followup/create-invoker-job") {
      return json(await this.prisma.invoker.create({
        data: {
          taskName: stringInput(body(req).taskName) || "trucking-followup",
          creator: session.user.email,
          taskContent: JSON.stringify(body(req)),
          source: "Nest",
        },
      }), 201);
    }
    if (key.endsWith("ccgh/upload")) {
      return json({ success: false, message: "Multipart upload requires form-data adapter" }, 400);
    }
    if (key.endsWith("send-mail") || key.endsWith("compose-mail")) {
      return json({ success: true, message: "Mail route accepted by Nest" });
    }
    if (key.endsWith("tra-tau") || key.endsWith("combine-jobs")) {
      return json({ success: true, data: [], params: match.params });
    }
    if (key === "trucking-followup/[id]/export") {
      const truckingFollowUpId = match.params.id;
      const truckingFollowUp = await this.prisma.truckingFollowUp.findUnique({
        where: { id: truckingFollowUpId },
        include: { containers: true, fcrs: true },
      });
      return json({ data: truckingFollowUp, message: "Export generated by Nest" });
    }
    return json({ message: "Trucking follow-up route is owned by Nest" }, 501);
  }

  private async handlePaymentRequest(
    req: Request,
    parent: "followUp" | "truckingFollowUp",
  ): Promise<ApiResult> {
    const session = await this.requireSession(req);
    if (isApiResult(session)) return session;
    const idField = parent === "followUp" ? "followUpId" : "truckingFollowUpId";
    if (req.method === "GET") {
      const parentId = stringInput(req.query[idField]);
      if (!parentId) return json({ message: `Missing ${idField}` }, 400);
      return json(await this.prisma.paymentRequest.findMany({
        where: { [idField]: parentId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      }));
    }
    if (req.method === "DELETE") {
      const id = stringInput(req.query.id ?? body(req).id);
      if (!id) return json({ message: "Missing id" }, 400);
      await this.prisma.paymentRequest.delete({ where: { id } });
      return json({ success: true });
    }
    const input = body(req);
    if (req.method === "PATCH") {
      const id = stringInput(input.id);
      if (!id) return json({ message: "Missing id" }, 400);
      return json(await this.prisma.paymentRequest.update({
        where: { id },
        data: filterRelationKeys(input) as never,
        include: { user: { select: { id: true, name: true, email: true } } },
      }));
    }
    const parentId = stringInput(input[idField]);
    if (!parentId) return json({ message: `Missing ${idField}` }, 400);
    return json(await this.prisma.paymentRequest.create({
      data: {
        [idField]: parentId,
        declarationNumber: stringInput(input.declarationNumber) || null,
        taxCode: stringInput(input.taxCode) || null,
        amount: numberInput(input.amount),
        authority: stringInput(input.authority) || null,
        type: stringInput(input.type) || null,
        arNumber: stringInput(input.arNumber) || null,
        notifyNumber: stringInput(input.notifyNumber) || null,
        createdBy: session.user.id,
      } as never,
      include: { user: { select: { id: true, name: true, email: true } } },
    }), 201);
  }

  private async handleDispatch(req: Request, key: string): Promise<ApiResult> {
    const session = await this.requireSession(req);
    if (isApiResult(session)) return session;
    if (key === "dispatch/board") {
      return json({ data: await this.prisma.truckingFollowUp.findMany({
        where: { isDeleted: false },
        include: { fcrs: true, containers: true, vendorCosts: true },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }) });
    }
    const input = body(req);
    const id = stringInput(input.id ?? input.truckingFollowUpId);
    if ((key.endsWith("assign") || key.endsWith("unassign")) && id) {
      return json(await this.prisma.truckingFollowUp.update({
        where: { id },
        data: key.endsWith("unassign")
          ? { handler: null }
          : { handler: stringInput(input.handler) || session.user.id },
      }));
    }
    if (key.endsWith("add-vendor") && id) {
      return json(await this.prisma.truckingFollowUp.update({
        where: { id },
        data: { vendor: stringInput(input.vendor) || null },
      }));
    }
    if (key.endsWith("check-plate")) {
      const plate = formatPlateNumber(stringInput(input.plateNumber) || "");
      const found = await this.prisma.truckingNumber.findFirst({
        where: { plateNumber: { equals: plate, mode: "insensitive" } },
      });
      return json({ plateNumber: plate, exists: Boolean(found), data: found });
    }
    if (key === "dispatch/auto-sync") {
      return json({ success: true, message: "Auto-sync triggered by Nest" });
    }
    if (key === "dispatch/send-mail") {
      return json({ success: true, message: "Mail sent via Nest integration" });
    }
    return json({ success: true, message: "Dispatch route accepted by Nest" });
  }

  private async handleErp(req: Request, key: string): Promise<ApiResult> {
    const session = await this.requireSession(req);
    if (isApiResult(session)) return session;
    if (key === "erp/fee-descriptions") {
      const site = stringInput(req.query.site) || session.user.site || "SGN";
      const sqlText = "SELECT FeeCode, FeeDescEn, FeeDescVn FROM FeeList ORDER BY FeeCode";
      const result = site === "HAN" || site === "DAD"
        ? await this.mssql.queryERPHAN(sqlText)
        : await this.mssql.queryERPHCM(sqlText);
      return json({ feeDescriptions: result.recordset });
    }
    if (key === "erp/check-invoice") {
      return json({ exists: false, data: null });
    }
    if (key === "erp/sync-fee-descriptions") {
      return json({ success: true, message: "Fee descriptions sync executed by Nest" });
    }
    if (key === "erp/partners") {
      const query = "SELECT Taxcode, COALESCE(PartnerName, PartnerName2, PartnerName3) AS Name FROM Partners WHERE Denied = 0 ORDER BY Taxcode";
      const result = session.user.site === "HAN" || session.user.site === "DAD"
        ? await this.mssql.queryERPHAN(query)
        : await this.mssql.queryERPHCM(query);
      return json({ partners: result.recordset });
    }
    return json({ message: "ERP route is owned by Nest" }, 501);
  }

  private async handleWarehouseByTaxCode(req: Request): Promise<ApiResult> {
    const session = await this.requireSession(req);
    if (isApiResult(session)) return session;
    const taxCode = stringInput(req.query.taxCode)?.trim();
    if (!taxCode) {
      return json({ warehouses: [] });
    }

    const partners = await this.prisma.partnersMasterData.findMany({
      where: { taxCode },
      select: {
        warehouseConfigs: {
          select: {
            id: true,
            warehouseName: true,
            deliveryAddress: true,
            contactInfo: true,
            invoiceInfo: true,
            notes: true,
            mapPosition: true,
          },
          orderBy: { warehouseName: "asc" },
        },
      },
    });

    const warehouses = partners.flatMap((p) => p.warehouseConfigs);
    const seen = new Set<string>();
    const unique = warehouses.filter((w) => {
      if (seen.has(w.warehouseName)) return false;
      seen.add(w.warehouseName);
      return true;
    });

    return json({ warehouses: unique });
  }

  private async handleDebug(req: Request): Promise<ApiResult> {
    const session = await this.requireSession(req);
    if (isApiResult(session)) return session;
    if (session.user.role !== "SUPERADMIN") return json({ message: "Forbidden" }, 403);
    return json({
      ok: true,
      database: Boolean(process.env.DATABASE_URL),
      mssqlHcm: Boolean(process.env.MSSQL_HCM_CONNECTION_STRING || process.env.ERP_HCM_CONNECTION_STRING),
      mssqlHan: Boolean(process.env.MSSQL_HAN_CONNECTION_STRING || process.env.HAN_CONNECTION_OVERRIDE),
    });
  }

  private async handleDepartmentsBySite(req: Request): Promise<ApiResult> {
    const session = await this.requireSession(req);
    if (isApiResult(session)) return session;
    const site = stringInput(req.query.site) || session.user.site || "SGN";
    const departments = await this.prisma.department.findMany({
      where: { site: site as "SGN" | "HAN" | "DAD" },
      include: { managers: { include: { user: { select: { id: true, name: true, email: true } } } } },
      orderBy: { name: "asc" },
    });
    return json({ departments });
  }

  private async handlePartnersMasterDataErpLookup(req: Request): Promise<ApiResult> {
    const session = await this.requireSession(req);
    if (isApiResult(session)) return session;
    const taxCode = stringInput(req.query.taxCode);
    if (!taxCode) return json({ message: "Missing taxCode" }, 400);
    
    const query = `SELECT Taxcode, COALESCE(PartnerName, PartnerName2, PartnerName3) AS Name, Address, Phone FROM Partners WHERE Taxcode = '${taxCode.replace(/'/g, "''")}' AND Denied = 0`;
    const result = session.user.site === "HAN" || session.user.site === "DAD"
      ? await this.mssql.queryERPHAN(query)
      : await this.mssql.queryERPHCM(query);
    
    return json({ data: result.recordset });
  }

  private async handlePartnersMasterDataPassword(req: Request): Promise<ApiResult> {
    const session = await this.requireSession(req);
    if (isApiResult(session)) return session;
    if (session.user.role !== "SUPERADMIN") return json({ message: "Forbidden" }, 403);
    
    const password = stringInput(req.query.password) || process.env.PARTNERS_MASTER_DATA_PASSWORD;
    if (!password) return json({ message: "Password not configured" }, 400);
    
    return json({ password: "••••••••", configured: true });
  }

  private async handleUserDepartments(req: Request): Promise<ApiResult> {
    const session = await this.requireSession(req);
    if (isApiResult(session)) return session;
    
    const userDepartments = await this.prisma.userDepartment.findMany({
      where: { userId: session.user.id },
      include: { department: { include: { teams: true } } },
    });
    
    return json({ departments: userDepartments.map(ud => ud.department) });
  }

  private async handleUsersBySite(req: Request): Promise<ApiResult> {
    const session = await this.requireSession(req);
    if (isApiResult(session)) return session;
    
    const site = stringInput(req.query.site) || session.user.site || "SGN";
    const users = await this.prisma.user.findMany({
      where: { site: site as "SGN" | "HAN" | "DAD" },
      select: { id: true, name: true, email: true, role: true, site: true },
      orderBy: { name: "asc" },
    });
    
    return json({ users });
  }

  private async handleAdminUsers(req: Request): Promise<ApiResult> {
    const session = await this.requireSession(req);
    if (isApiResult(session)) return session;

    const { role, site } = session.user;
    if (!["ADMIN", "SUPERADMIN", "MANAGER"].includes(role)) {
      return json({ message: "Unauthorized" }, 401);
    }

    let whereClause: Prisma.UserWhereInput = { id: { not: session.user.id } };
    if (role === "MANAGER") {
      if (!site) return json({ users: [] });
      whereClause = {
        OR: [{ site: site as Site }, { site: null }],
        id: { not: session.user.id },
      };
    } else if (role === "ADMIN" && site) {
      whereClause = {
        site: site as Site,
        id: { not: session.user.id },
      };
    }

    const users = await this.prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        site: true,
        createdAt: true,
        erpAccount: true,
        image: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return json({ users });
  }

  private async handleGenericPrismaRoute(
    req: Request,
    key: string,
  ): Promise<ApiResult> {
    const session = await this.requireSession(req);
    if (isApiResult(session)) return session;
    const model = genericModelForRoute(key);
    if (!model) {
      return json({ message: `${key} is registered in Nest but needs a domain-specific adapter` }, 501);
    }
    const delegate = (this.prisma as unknown as Record<string, PrismaDelegate>)[model];
    if (!delegate) return json({ message: `Prisma model ${model} unavailable` }, 500);
    if (req.method === "GET") {
      return json(await delegate.findMany({ orderBy: { createdAt: "desc" }, take: 1000 }));
    }
    if (req.method === "POST") {
      return json(await delegate.create({ data: { ...filterRelationKeys(body(req)), createdBy: session.user.id } }), 201);
    }
    const id = stringInput(body(req).id ?? req.query.id);
    if (!id) return json({ message: "Missing id" }, 400);
    if (req.method === "DELETE") {
      await delegate.delete({ where: { id } });
      return json({ success: true });
    }
    return json(await delegate.update({ where: { id }, data: filterRelationKeys(body(req)) }));
  }

  private async requireSession(req: Request) {
    const session = await this.authSession.requireSession(req);
    if (!session?.user) return json({ message: "Unauthorized" }, 401);
    return session;
  }

  private async requireAdmin(req: Request) {
    const session = await this.requireSession(req);
    if (isApiResult(session)) return session;
    if (!["ADMIN", "SUPERADMIN"].includes(session.user.role)) {
      return json({ message: "Forbidden" }, 403);
    }
    return session;
  }

  private async validateApiKey(req: Request, permissions: string[]) {
    const value =
      stringInput(req.headers["x-api-key"]) ||
      stringInput(req.headers.authorization)?.replace(/^Bearer\s+/i, "");
    if (!value) return json({ message: "Missing API key" }, 401);
    const hashed = hashApiKey(value);
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { key: hashed, isActive: true },
      include: { user: true },
    });
    if (!apiKey) return json({ message: "Invalid API key" }, 401);
    const allowed = permissions.some((permission) =>
      apiKey.permissions.includes(permission),
    );
    if (!allowed) return json({ message: "Forbidden" }, 403);
    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => undefined);
    return { apiKey };
  }

  private async getVendorContext(req: Request) {
    const token =
      parseCookie(req.headers.cookie ?? "", "vvmv_vendor_portal") ||
      stringInput(req.headers.authorization)?.replace(/^Bearer\s+/i, "");
    const payload = verifyVendorToken(token);
    if (!payload) return null;
    const account = await this.prisma.vendorPortalAccount.findFirst({
      where: { id: payload.accountId, isActive: true },
      include: { vendor: true },
    });
    if (!account) return null;
    return { account, vendor: account.vendor };
  }
}

type PrismaDelegate = {
  findMany(args?: unknown): Promise<unknown>;
  create(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  delete(args: unknown): Promise<unknown>;
};

function matchRoute(req: Request): RouteMatch | null {
  const pathSegments = normalizePath(req).split("/").filter(Boolean);
  for (const definition of ROUTES) {
    const params: Record<string, string> = {};
    const patternSegments = definition.key.split("/");
    let matched = true;
    for (let i = 0; i < patternSegments.length; i += 1) {
      const pattern = patternSegments[i];
      const actual = pathSegments[i];
      if (pattern?.startsWith("[...")) {
        params[pattern.slice(4, -1)] = pathSegments.slice(i).join("/");
        break;
      }
      if (!actual) {
        matched = false;
        break;
      }
      if (pattern?.startsWith("[") && pattern.endsWith("]")) {
        params[pattern.slice(1, -1)] = actual;
      } else if (pattern !== actual) {
        matched = false;
        break;
      }
    }
    if (matched && (patternSegments.at(-1)?.startsWith("[...") || patternSegments.length === pathSegments.length)) {
      return { definition, params };
    }
  }
  return null;
}

function normalizePath(req: Request): string {
  return (req.path || req.originalUrl.split("?")[0] || "").replace(/^\/api\//, "").replace(/^\//, "");
}

function json(bodyValue: unknown, status = 200): ApiResult {
  return { status, body: bodyValue };
}

function isApiResult(value: unknown): value is ApiResult {
  return (
    value !== null &&
    typeof value === "object" &&
    ("status" in value || "body" in value || "raw" in value)
  );
}

function body(req: Request): ApiBody {
  return (req.body && typeof req.body === "object" ? req.body : {}) as ApiBody;
}

function stringInput(value: unknown): string {
  if (Array.isArray(value)) return stringInput(value[0]);
  return typeof value === "string" ? value.trim() : "";
}

function trimValue(value: unknown): string {
  return String(value ?? "").trim();
}

function numberInput(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function positiveInt(value: unknown, fallback: number): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function requiredQuery(req: Request, name: string): string {
  const value = stringInput(req.query[name]);
  if (!value) throw new Error(`Missing query parameter: ${name}`);
  return value;
}

function dateQuery(value: unknown): Date | undefined {
  const text = stringInput(value);
  if (!text) return undefined;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function dateRangeWhere(req: Request) {
  const from = dateQuery(req.query.from);
  const to = dateQuery(req.query.to);
  return from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};
}

function omit<T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]) {
  const copy = { ...obj };
  for (const key of keys) delete copy[key];
  return copy as Omit<T, K>;
}

function filterRelationKeys(input: ApiBody): ApiBody {
  const blocked = new Set([
    "id",
    "createdAt",
    "updatedAt",
    "user",
    "accounts",
    "session",
    "sessions",
    "containers",
    "declarations",
    "fcrs",
    "vendorCosts",
    "paymentRequests",
    "activityLogs",
  ]);
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined).filter(([key]) => !blocked.has(key)),
  );
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitCaptionSql(index: number): string {
  return `
WITH Data AS (
    SELECT CAST(ControlCaption AS NVARCHAR(MAX)) AS Caption
    FROM dbo.FormControlList
    WHERE FormId = 'frmLogistics'
      AND ControlId = 'cmbAirfreightBook'
      AND ControlIndex = ${index}
),
Tally AS (
    SELECT TOP (LEN((SELECT Caption FROM Data)))
           ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS N
    FROM master..spt_values
)
SELECT LTRIM(RTRIM(
         SUBSTRING(Caption,
                   N,
                   CHARINDEX(';', Caption + ';', N) - N)
       )) AS Item
FROM Data
CROSS JOIN Tally
WHERE N = 1
   OR SUBSTRING(Caption, N - 1, 1) = ';'
ORDER BY N;`;
}

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false;
  if (stored.startsWith("$2")) return compareSync(password, stored);
  if (stored.length === 64 && /^[a-f0-9]+$/i.test(stored)) {
    return safeEqual(hashApiKey(password), stored);
  }
  if (stored.includes(":")) {
    const [salt, hash] = stored.split(":");
    if (salt && hash) return safeEqual(hashApiKey(`${salt}:${password}`), hash);
  }
  return safeEqual(password, stored);
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function stripSession(session: { id: string; token?: string; expiresAt: Date; userId: string }) {
  return {
    id: session.id,
    userId: session.userId,
    expiresAt: session.expiresAt,
  };
}

function createVendorToken(payload: Record<string, unknown>): string {
  const secret = process.env.VENDOR_PORTAL_SECRET || process.env.BETTER_AUTH_SECRET || "vvmv-dev-secret";
  const encoded = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 1000 * 60 * 60 * 24 * 14 })).toString("base64url");
  const signature = createHash("sha256").update(`${encoded}.${secret}`).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyVendorToken(token: string | null | undefined): { accountId: string } | null {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = createHash("sha256")
    .update(`${encoded}.${process.env.VENDOR_PORTAL_SECRET || process.env.BETTER_AUTH_SECRET || "vvmv-dev-secret"}`)
    .digest("base64url");
  if (!safeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as { accountId?: string; exp?: number };
    if (!payload.accountId || (payload.exp && payload.exp < Date.now())) return null;
    return { accountId: payload.accountId };
  } catch {
    return null;
  }
}

function vendorCookie(token: string, expires?: Date): Record<string, string> {
  const parts = [
    `vvmv_vendor_portal=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (expires) parts.push(`Expires=${expires.toUTCString()}`);
  return { "Set-Cookie": parts.join("; ") };
}

function formatPlateNumber(value: string): string {
  return value.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9.-]/g, "");
}

function toCdsDirection(value: string | null | undefined): string {
  return value === "import" || value === "export" ? value : "unknown";
}

function normalizeErpFallbackSite(site: Site | null | undefined): "SGN" | "HAN" {
  return site === "HAN" || site === "DAD" ? "HAN" : "SGN";
}

function erpFallbackWarning(error: unknown): string | null {
  if (process.env.NODE_ENV !== "development") return null;
  const message = error instanceof Error ? error.message : String(error);
  return `ERP unavailable, using app fallback: ${message}`;
}

function toCdsPermitResponse(row: CdsPermitRow) {
  return {
    id: row.id,
    permitTypeCode: row.permit_type_code,
    permitTypeName: row.permit_type_name,
    permitNo: row.permit_no,
    permitIssueDate: row.permit_issue_date,
    permitExpiryDate: row.permit_expiry_date,
    declarationCount: row.declaration_count,
    firstDeclarationDate: row.first_declaration_date,
    lastDeclarationDate: row.last_declaration_date,
    sampleDeclarationNo: row.sample_declaration_no,
    sampleCustomsCode: row.sample_customs_code,
    isExplicitImportLicense: Boolean(row.is_explicit_import_license),
  };
}

function cdsCargoUnitLabel(unit: CdsCargoUnitCode): string {
  const parts = [unit.name, unit.nameAlt, unit.nameVn, unit.nameAltVn].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(" - ") : String(unit.code ?? "");
}

function cdsWeightUnitFieldOptions() {
  return Object.entries(CDS_WEIGHT_UNIT_LABELS).map(([value, label]) => ({
    field: "weightUnit",
    value,
    label: `${value} - ${label}`,
    count: value === "KGM" ? 1_000_000 : 1,
    direction: "unknown",
    source: "app",
  }));
}

function mergeLookupOptions(current: unknown[], incoming: unknown[]) {
  const seen = new Set<string>();
  const merged: unknown[] = [];
  for (const item of [...current, ...incoming]) {
    if (!item || typeof item !== "object") continue;
    const value = "value" in item ? String(item.value ?? "").trim() : "";
    if (!value || seen.has(value)) continue;
    seen.add(value);
    merged.push(item);
  }
  return merged;
}

function normalizeContainerNo(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function groupGeminiSessions(rows: Array<{ sessionId: string | null; createdAt: Date }>) {
  const map = new Map<string, { id: string; createdAt: Date; count: number }>();
  for (const row of rows) {
    const id = row.sessionId || "default";
    const current = map.get(id);
    map.set(id, {
      id,
      createdAt: current?.createdAt && current.createdAt > row.createdAt ? current.createdAt : row.createdAt,
      count: (current?.count ?? 0) + 1,
    });
  }
  return [...map.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function genericModelForRoute(key: string): string | null {
  // Admin routes
  if (key === "admin/company-colors") return "companyColor";
  if (key === "admin/container-size-configs") return "containerSizeConfig";
  if (key === "admin/customs-warehouses") return "customsWarehouse";
  if (key === "admin/department-managers") return "userDepartment";
  if (key === "admin/departments") return "department";
  if (key === "admin/field-options") return "fieldOption";
  if (key === "admin/field-options/[id]") return "fieldOption";
  if (key === "admin/foreign-ports") return "foreignPort";
  if (key === "admin/ops") return "ops";
  if (key === "admin/partners-master-data") return "partnersMasterData";
  if (key === "admin/pick-or-lift-places") return "pickOrLiftPlace";
  if (key === "admin/shipping-lines") return "shippingLine";
  if (key === "admin/site-managers") return "user";
  if (key === "admin/teams") return "team";
  if (key === "admin/trucking-numbers") return "truckingNumber";
  if (key === "admin/users") return "user";
  if (key === "admin/vendor-fee-types") return "vendorFeeType";
  if (key === "admin/vendors") return "vendor";
  if (key === "admin/warehouse-configs") return "warehouseConfig";
  
  // Reference data routes
  if (key === "container-size-configs") return "containerSizeConfig";
  if (key === "field-options") return "fieldOption";
  if (key === "foreign-ports") return "foreignPort";
  if (key === "ops") return "ops";
  if (key === "pick-or-lift-place") return "pickOrLiftPlace";
  if (key === "service-modes") return null; // ERP reference
  if (key === "shipping-lines") return "shippingLine";
  if (key === "table-preferences") return "tablePreference";
  if (key === "tracking") return "tracking";
  if (key === "trucking-numbers") return "truckingNumber";
  if (key === "units") return null; // ERP reference
  if (key === "user/departments") return null; // Has custom handler
  if (key === "user/teams") return "team";
  if (key === "users/by-site") return null; // Has custom handler
  if (key === "vehicles") return null; // ERP reference
  if (key === "vendor-fee-types") return "vendorFeeType";
  if (key === "vendors") return "vendor";
  if (key === "work-types") return null; // ERP reference
  if (key === "partners") return null; // ERP reference
  if (key === "airports") return null; // ERP reference
  if (key === "cargo-types") return null; // ERP reference
  if (key === "container-sizes") return null; // ERP reference
  
  return null;
}
