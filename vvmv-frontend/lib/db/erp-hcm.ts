import sql from "mssql";

/**
 * ERP HCM Database Connection Configuration
 * For VVMV Ho Chi Minh ERP System
 */
const config: sql.config = {
	server: process.env.ERP_HCM_DB_SERVER || "",
	database: process.env.ERP_HCM_DB_NAME || "",
	user: process.env.ERP_HCM_DB_USER || "",
	password: process.env.ERP_HCM_DB_PASSWORD || "",
	options: {
		encrypt: process.env.ERP_HCM_DB_ENCRYPT === "true",
		trustServerCertificate: true,
		enableArithAbort: true,
	},
	pool: {
		max: 10,
		min: 0,
		idleTimeoutMillis: 30000,
	},
};

let poolPromise: Promise<sql.ConnectionPool> | null = null;

/**
 * Get or create connection pool for ERP HCM database
 */
function getPool(): Promise<sql.ConnectionPool> {
	if (!poolPromise) {
		poolPromise = new sql.ConnectionPool(config)
			.connect()
			.then((pool: sql.ConnectionPool) => {
				return pool;
			})
			.catch((err: Error) => {
				console.error("ERP HCM database connection failed:", err);
				poolPromise = null;
				throw err;
			});
	}
	return poolPromise as Promise<sql.ConnectionPool>;
}

/**
 * Execute a raw SQL query on ERP HCM database
 * @param query - SQL query string with @parameters
 * @param params - Parameters object { paramName: value }
 * @returns Query result with recordset
 */
export async function queryERPHCM<T = any>(
	query: string,
	params?: Record<string, any>,
): Promise<sql.IResult<T>> {
	try {
		const pool = await getPool();
		const request = pool.request();

		// Add parameters to request
		if (params) {
			for (const [key, value] of Object.entries(params)) {
				request.input(key, value);
			}
		}

		const result = await request.query<T>(query);
		return result;
	} catch (error) {
		console.error("ERP HCM query error:", error);
		throw error;
	}
}

/**
 * Close the connection pool
 */
export async function closeERPHCM(): Promise<void> {
	if (poolPromise) {
		const pool = await poolPromise;
		await pool.close();
		poolPromise = null;
	}
}
