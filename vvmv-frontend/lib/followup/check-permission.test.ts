import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
	prismaRPA: {
		followUp: {
			findUnique: vi.fn(),
		},
		user: {
			findUnique: vi.fn(),
		},
	},
}));

import { prismaRPA } from "@/lib/db";
import { checkFollowUpPermission } from "./check-permission";

const followUpFindUnique = prismaRPA.followUp
	.findUnique as unknown as ReturnType<typeof vi.fn>;
const userFindUnique = prismaRPA.user.findUnique as unknown as ReturnType<
	typeof vi.fn
>;

function user(overrides: Record<string, unknown> = {}) {
	return {
		id: "user-1",
		email: "user@example.com",
		username: "user1",
		role: "STAFF",
		site: "HAN",
		departmentAssignments: [],
		teamLeaderships: [],
		teamMemberships: [],
		...overrides,
	};
}

describe("checkFollowUpPermission", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		followUpFindUnique.mockResolvedValue({
			createdBy: "owner-1",
			domain: "HAN",
			handler: null,
		});
	});

	it("allows read access for Document users in the same site", async () => {
		userFindUnique.mockResolvedValue(
			user({
				departmentAssignments: [
					{ department: { name: "Document", site: "HAN" } },
				],
			}),
		);

		await expect(
			checkFollowUpPermission("followup-1", "user-1", "STAFF", {
				mode: "read",
			}),
		).resolves.toEqual({ ok: true });
	});

	it("denies read access for site-scoped users from another site", async () => {
		userFindUnique.mockResolvedValue(
			user({
				site: "SGN",
				departmentAssignments: [
					{ department: { name: "Document", site: "SGN" } },
				],
			}),
		);

		await expect(
			checkFollowUpPermission("followup-1", "user-1", "STAFF", {
				mode: "read",
			}),
		).resolves.toEqual({ ok: false, status: 403, error: "Access denied" });
	});

	it("allows write access for the assigned handler", async () => {
		followUpFindUnique.mockResolvedValue({
			createdBy: "owner-1",
			domain: "HAN",
			handler: "user-1",
		});
		userFindUnique.mockResolvedValue(user());

		await expect(
			checkFollowUpPermission("followup-1", "user-1", "STAFF"),
		).resolves.toEqual({ ok: true });
	});

	it("keeps Accounting users read-only for writes", async () => {
		followUpFindUnique.mockResolvedValue({
			createdBy: "user-1",
			domain: "HAN",
			handler: null,
		});
		userFindUnique.mockResolvedValue(
			user({
				departmentAssignments: [
					{ department: { name: "Accounting", site: "HAN" } },
				],
			}),
		);

		await expect(
			checkFollowUpPermission("followup-1", "user-1", "STAFF"),
		).resolves.toEqual({
			ok: false,
			status: 403,
			error: "Accounting department has view-only access to follow-ups",
		});
	});
});
