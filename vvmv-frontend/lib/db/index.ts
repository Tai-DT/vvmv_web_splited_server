import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/prisma/client";

export const DB_VERSION = "1.0.1";

/**
 * PrismaClient singleton for RPA database
 * This ensures we don't create multiple instances in development
 */
const globalForPrisma = globalThis as unknown as {
	prismaRPA: PrismaClient | undefined;
};

// Reset global prisma to force a fresh initialization if needed via env var
if (process.env.RESET_PRISMA === "true") {
	globalForPrisma.prismaRPA = undefined;
}

function createPrismaClient() {
	const pool = new Pool({
		connectionString: process.env.DATABASE_URL,
	});
	const adapter = new PrismaPg(pool);
	return new PrismaClient({
		adapter,
		log:
			process.env.NODE_ENV === "development"
				? ["query", "error", "warn"]
				: ["error"],
	});
}

export const prismaRPA = globalForPrisma.prismaRPA ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prismaRPA = prismaRPA;
}

/**
 * Disconnect from RPA database
 */
export async function disconnectRPA() {
	await prismaRPA.$disconnect();
}

export { closeERPHAN, queryERPHAN } from "./erp-han";
/**
 * Export ERP database connection utilities
 */
export { closeERPHCM, queryERPHCM } from "./erp-hcm";
