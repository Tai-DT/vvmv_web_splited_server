/**
 * Creates `admin` / `admin123` with **bcrypt** in `account.password`.
 * Next/Better Auth verifies bcrypt hashes (see `vvmv-frontend/lib/auth.ts`).
 */
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "./prisma/client";
import { hashSync } from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function createTestUser() {
  try {
    // Create test user
    const user = await prisma.user.create({
      data: {
        id: "test-user-id-123",
        email: "admin@vvmv.com",
        username: "admin",
        name: "Admin User",
        emailVerified: true,
        role: "SUPERADMIN",
        site: "SGN",
        accounts: {
          create: {
            id: "account-id-123",
            accountId: "admin@vvmv.com",
            providerId: "credential",
            password: hashSync("admin123"), // Default password
          },
        },
      },
      include: { accounts: true },
    });

    console.log("✅ Test user created successfully:");
    console.log("   Email: admin@vvmv.com");
    console.log("   Username: admin");
    console.log("   Password: admin123");
    console.log("   Role: SUPERADMIN");
    console.log("   Site: SGN");
  } catch (error) {
    console.error("❌ Error creating test user:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
