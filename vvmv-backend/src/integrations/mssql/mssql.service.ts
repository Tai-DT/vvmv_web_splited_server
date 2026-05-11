import { Injectable, OnModuleDestroy } from "@nestjs/common";
import sql from "mssql";
import { PrismaService } from "../../prisma/prisma.service";

type MssqlParams = Record<string, unknown>;
type PoolKey = "hcm" | "han" | string;

export interface MssqlQueryResult<T> {
  recordset: T[];
  rowsAffected: number[];
}

@Injectable()
export class MssqlService implements OnModuleDestroy {
  private readonly pools = new Map<PoolKey, Promise<sql.ConnectionPool>>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleDestroy(): Promise<void> {
    const pools = await Promise.allSettled([...this.pools.values()]);
    await Promise.all(
      pools.map((entry) =>
        entry.status === "fulfilled" ? entry.value.close() : undefined,
      ),
    );
    this.pools.clear();
  }

  queryERPHCM<T = Record<string, unknown>>(
    query: string,
    params?: MssqlParams,
  ): Promise<MssqlQueryResult<T>> {
    return this.query<T>("hcm", query, params);
  }

  queryERPHAN<T = Record<string, unknown>>(
    query: string,
    params?: MssqlParams,
  ): Promise<MssqlQueryResult<T>> {
    return this.query<T>("han", query, params);
  }

  async queryHanForTaxCode<T = Record<string, unknown>>(
    taxCode: string | null | undefined,
    query: string,
    params?: MssqlParams,
  ): Promise<MssqlQueryResult<T>> {
    const config = await this.resolveHanConnectionForTaxCode(taxCode);
    if (!config) {
      return this.queryERPHAN<T>(query, params);
    }
    const key = `han:${taxCode ?? "override"}`;
    return this.queryWithConfig<T>(key, config, query, params);
  }

  async resolveHanConnectionForTaxCode(
    taxCode: string | null | undefined,
  ): Promise<string | sql.config | null> {
    const normalized = String(taxCode ?? "").trim();
    if (normalized) {
      const partner = await this.prisma.partnersMasterData.findFirst({
        where: { taxCode: normalized },
        select: { ddInfo: true },
      });
      const parsed = parseConnectionInfo(partner?.ddInfo);
      if (parsed) return parsed;
    }

    return (
      process.env.HAN_CONNECTION_OVERRIDE?.trim() ||
      connectionFromEnv("HAN_DB") ||
      connectionFromEnv("MSSQL_HAN") ||
      connectionFromEnv("ERP_HAN") ||
      connectionFromEnv("ERP_HN") ||
      null
    );
  }

  async query<T = Record<string, unknown>>(
    key: PoolKey,
    query: string,
    params?: MssqlParams,
  ): Promise<MssqlQueryResult<T>> {
    const config =
      key === "hcm"
        ? (process.env.MSSQL_HCM_CONNECTION_STRING?.trim() ||
          process.env.ERP_HCM_CONNECTION_STRING?.trim() ||
          connectionFromEnv("MSSQL_HCM") ||
          connectionFromEnv("ERP_HCM"))
        : (process.env.MSSQL_HAN_CONNECTION_STRING?.trim() ||
          process.env.ERP_HAN_CONNECTION_STRING?.trim() ||
          process.env.HAN_CONNECTION_OVERRIDE?.trim() ||
          connectionFromEnv("MSSQL_HAN") ||
          connectionFromEnv("ERP_HAN") ||
          connectionFromEnv("ERP_HN") ||
          connectionFromEnv("HAN_DB"));

    if (!config) {
      throw new Error(`Missing MSSQL connection config for ${key}`);
    }

    return this.queryWithConfig<T>(key, config, query, params);
  }

  private async queryWithConfig<T = Record<string, unknown>>(
    key: PoolKey,
    config: string | sql.config,
    query: string,
    params?: MssqlParams,
  ): Promise<MssqlQueryResult<T>> {
    const pool = await this.getPool(key, config);
    const request = pool.request();
    for (const [name, value] of Object.entries(params ?? {})) {
      request.input(name, value as sql.ISqlTypeFactoryWithNoParams | string);
    }
    const result = await request.query<T>(query);
    return {
      recordset: result.recordset ?? [],
      rowsAffected: result.rowsAffected ?? [],
    };
  }

  private getPool(
    key: PoolKey,
    config: string | sql.config,
  ): Promise<sql.ConnectionPool> {
    const existing = this.pools.get(key);
    if (existing) return existing;

    const created = new sql.ConnectionPool(config).connect();
    this.pools.set(key, created);
    return created;
  }
}

function parseConnectionInfo(value: string | null | undefined) {
  const text = value?.trim();
  if (!text) return null;
  if (/server\s*=|data source\s*=/i.test(text)) return text;

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const server = stringValue(parsed.server ?? parsed.host);
    const database = stringValue(parsed.database ?? parsed.name);
    const user = stringValue(parsed.user ?? parsed.username);
    const password = stringValue(parsed.password);
    if (!server || !database || !user || !password) return null;
    return buildConfig(server, database, user, password, {
      encrypt: booleanValue(parsed.encrypt, true),
      trustServerCertificate: booleanValue(
        parsed.trustServerCertificate,
        true,
      ),
    });
  } catch {
    return null;
  }
}

function connectionFromEnv(prefix: string): sql.config | string | null {
  const connectionString =
    process.env[`${prefix}_CONNECTION_STRING`]?.trim() ||
    process.env[`${prefix}_DB_CONNECTION_STRING`]?.trim();
  if (connectionString) return connectionString;

  const server =
    process.env[`${prefix}_SERVER`]?.trim() ||
    process.env[`${prefix}_HOST`]?.trim() ||
    process.env[`${prefix}_DB_SERVER`]?.trim() ||
    process.env[`${prefix}_DB_HOST`]?.trim();
  if (!server) return null;
  // Support separate port env var (e.g. ERP_HN_DB_PORT=12154)
  const dbPort =
    process.env[`${prefix}_PORT`]?.trim() ||
    process.env[`${prefix}_DB_PORT`]?.trim();
  const serverWithPort = dbPort ? `${server},${dbPort}` : server;
  const database =
    process.env[`${prefix}_DATABASE`]?.trim() ||
    process.env[`${prefix}_DB`]?.trim() ||
    process.env[`${prefix}_NAME`]?.trim() ||
    process.env[`${prefix}_DB_NAME`]?.trim() ||
    process.env[`${prefix}_DB_DATABASE`]?.trim();
  const user =
    process.env[`${prefix}_USER`]?.trim() ||
    process.env[`${prefix}_USERNAME`]?.trim() ||
    process.env[`${prefix}_DB_USER`]?.trim() ||
    process.env[`${prefix}_DB_USERNAME`]?.trim();
  const password =
    process.env[`${prefix}_PASSWORD`]?.trim() ||
    process.env[`${prefix}_DB_PASSWORD`]?.trim();
  if (!serverWithPort || !database || !user || !password) return null;

  return buildConfig(serverWithPort, database, user, password, {
    encrypt: booleanValue(
      process.env[`${prefix}_ENCRYPT`] ||
      process.env[`${prefix}_DB_ENCRYPT`],
      true,
    ),
    trustServerCertificate: booleanValue(
      process.env[`${prefix}_TRUST_SERVER_CERTIFICATE`] ||
      process.env[`${prefix}_DB_TRUST_SERVER_CERTIFICATE`],
      true,
    ),
  });
}

function buildConfig(
  serverValue: string,
  database: string,
  user: string,
  password: string,
  options: { encrypt: boolean; trustServerCertificate: boolean },
): sql.config {
  const [host, portRaw] = serverValue.split(",");
  const port = portRaw ? Number(portRaw) : undefined;
  return {
    server: host,
    port: Number.isFinite(port) ? port : undefined,
    database,
    user,
    password,
    options,
    pool: {
      max: Number(process.env.MSSQL_POOL_MAX ?? 10),
      min: 0,
      idleTimeoutMillis: Number(process.env.MSSQL_IDLE_TIMEOUT_MS ?? 30000),
    },
    requestTimeout: Number(process.env.MSSQL_REQUEST_TIMEOUT_MS ?? 120000),
  };
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  return ["1", "true", "yes", "y"].includes(value.trim().toLowerCase());
}
