import type sql from "mssql";

function clean(value: string | null | undefined) {
	const normalized = String(value ?? "").trim();
	return normalized === "" ? null : normalized;
}

function parseBooleanFlag(value: string | null | undefined) {
	const normalized = clean(value)?.toLowerCase();
	if (!normalized) {
		return false;
	}

	return ["true", "1", "yes"].includes(normalized);
}

function splitServerAndPort(serverValue: string) {
	let server = serverValue.trim();
	let port: number | undefined;

	if (server.toLowerCase().startsWith("tcp:")) {
		server = server.slice(4).trim();
	}

	const commaMatch = server.match(/^(.*?),(\d+)$/);
	if (commaMatch && !commaMatch[1]?.includes("\\")) {
		server = commaMatch[1].trim();
		port = Number.parseInt(commaMatch[2], 10);
	}

	return {
		server,
		port: Number.isFinite(port) ? port : undefined,
	};
}

function parseConnectionStringParts(connectionString: string) {
	return connectionString.split(";").reduce(
		(acc, part) => {
			const [rawKey, ...rawValue] = part.split("=");
			const key = rawKey?.trim();
			const value = rawValue.join("=").trim();

			if (key) {
				acc[key] = value;
			}

			return acc;
		},
		{} as Record<string, string>,
	);
}

export function parseMssqlConnectionString(
	connectionString: string | null | undefined,
	options?: {
		appName?: string;
		connectionTimeout?: number;
		requestTimeout?: number;
	},
): sql.config | null {
	const normalized = clean(connectionString);
	if (!normalized) {
		return null;
	}

	const parts = parseConnectionStringParts(normalized);
	const serverValue =
		clean(parts["Data Source"]) ??
		clean(parts.Server) ??
		clean(parts.Address) ??
		clean(parts.Addr) ??
		clean(parts["Network Address"]);
	const database = clean(parts["Initial Catalog"]) ?? clean(parts.Database);
	const user = clean(parts["User ID"]) ?? clean(parts.UID) ?? clean(parts.User);
	const password = clean(parts.Password) ?? clean(parts.PWD);

	if (!serverValue || !database || !user || !password) {
		return null;
	}

	const { server, port } = splitServerAndPort(serverValue);
	const encrypt = parseBooleanFlag(parts.Encrypt);
	const trustServerCertificate =
		parseBooleanFlag(parts.TrustServerCertificate) || !encrypt;

	return {
		server,
		port,
		database,
		user,
		password,
		connectionTimeout: options?.connectionTimeout ?? 15000,
		requestTimeout: options?.requestTimeout ?? 15000,
		options: {
			encrypt,
			trustServerCertificate,
			enableArithAbort: true,
			appName: options?.appName,
		},
		pool: {
			max: 10,
			min: 0,
			idleTimeoutMillis: 30000,
		},
	};
}
