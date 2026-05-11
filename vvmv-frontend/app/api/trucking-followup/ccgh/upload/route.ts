import { Readable } from "node:stream";
import { type NextRequest, NextResponse } from "next/server";
import { logTruckingActivity } from "@/lib/activity-logger";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import { getDriveClient } from "@/lib/google-sheets/client";

function extractDriveFolderId(driveUrl: string | null | undefined) {
	if (!driveUrl) return null;
	const match = driveUrl.match(/(?:folders\/|id=)([a-zA-Z0-9_-]+)/);
	return match?.[1] ?? null;
}

function escapeDriveQueryValue(value: string) {
	return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function ensureChildFolder(parentFolderId: string, folderName: string) {
	const drive = getDriveClient();
	const escapedFolderName = escapeDriveQueryValue(folderName);

	const existing = await drive.files.list({
		q: `name='${escapedFolderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
		fields: "files(id, name)",
		includeItemsFromAllDrives: true,
		supportsAllDrives: true,
	});

	const existingFolderId = existing.data.files?.[0]?.id;
	if (existingFolderId) {
		return {
			folderId: existingFolderId,
			folderUrl: `https://drive.google.com/drive/folders/${existingFolderId}`,
		};
	}

	const created = await drive.files.create({
		requestBody: {
			name: folderName,
			mimeType: "application/vnd.google-apps.folder",
			parents: [parentFolderId],
		},
		fields: "id",
		supportsAllDrives: true,
	});

	if (!created.data.id) {
		throw new Error(`Không thể tạo folder ${folderName}`);
	}

	return {
		folderId: created.data.id,
		folderUrl: `https://drive.google.com/drive/folders/${created.data.id}`,
	};
}

async function isAccountingOnlyUser(userId: string) {
	const actingUser = await prismaRPA.user.findUnique({
		where: { id: userId },
		select: {
			role: true,
			departmentAssignments: {
				select: { department: { select: { name: true } } },
			},
			teamLeaderships: {
				include: {
					team: { include: { department: { select: { name: true } } } },
				},
			},
			teamMemberships: {
				include: {
					team: { include: { department: { select: { name: true } } } },
				},
			},
		},
	});

	if (!actingUser) return false;
	if (actingUser.role === "ADMIN" || actingUser.role === "SUPERADMIN") {
		return false;
	}

	const deptNames = new Set<string>();
	actingUser.departmentAssignments.forEach((da: any) => {
		if (da.department?.name) deptNames.add(da.department.name);
	});
	actingUser.teamLeaderships?.forEach((tl: any) => {
		if (tl.team?.department?.name) deptNames.add(tl.team.department.name);
	});
	actingUser.teamMemberships?.forEach((tm: any) => {
		if (tm.team?.department?.name) deptNames.add(tm.team.department.name);
	});

	return deptNames.has("Accounting");
}

export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		if (await isAccountingOnlyUser(session.user.id)) {
			return NextResponse.json(
				{
					message:
						"Accounting department has view-only access to trucking follow-ups",
				},
				{ status: 403 },
			);
		}

		const formData = await request.formData();
		const truckingFollowUpId = String(
			formData.get("truckingFollowUpId") || "",
		).trim();
		const containerId =
			String(formData.get("containerId") || "").trim() || null;
		const files = formData.getAll("files") as File[];

		if (!truckingFollowUpId) {
			return NextResponse.json(
				{ message: "Thiếu truckingFollowUpId" },
				{ status: 400 },
			);
		}

		if (files.length === 0) {
			return NextResponse.json(
				{ message: "Không có file nào" },
				{ status: 400 },
			);
		}

		const trucking = await prismaRPA.truckingFollowUp.findUnique({
			where: { id: truckingFollowUpId },
			select: {
				id: true,
				ccgh: true,
				driveUrl: true,
				requestNumber: true,
				jobNumber: true,
				containers: {
					select: {
						id: true,
						containerNo: true,
						podUrl: true,
					},
					orderBy: [{ createdAt: "asc" }, { id: "asc" }],
				},
			},
		});

		if (!trucking) {
			return NextResponse.json(
				{ message: "TruckingFollowUp record not found" },
				{ status: 404 },
			);
		}

		const linkedFollowUp = await prismaRPA.followUp.findFirst({
			where: {
				isDeleted: false,
				driveUrl: { not: null },
				OR: [
					...(trucking.requestNumber
						? [{ requestTruckingNo: trucking.requestNumber }]
						: []),
					...(trucking.jobNumber ? [{ jobNumber: trucking.jobNumber }] : []),
				],
			},
			select: {
				id: true,
				jobNumber: true,
				requestTruckingNo: true,
				driveUrl: true,
			},
			orderBy: { createdAt: "desc" },
		});

		const linkedContainerRows = await prismaRPA.container.findMany({
			where: {
				followUp: {
					isDeleted: false,
					OR: [
						...(trucking.requestNumber
							? [{ requestTruckingNo: trucking.requestNumber }]
							: []),
						...(trucking.jobNumber ? [{ jobNumber: trucking.jobNumber }] : []),
					],
				},
			},
			select: {
				id: true,
				containerNo: true,
				podUrl: true,
			},
			orderBy: [{ createdAt: "asc" }, { id: "asc" }],
		});

		const availableContainers = Array.from(
			new Map(
				[...trucking.containers, ...linkedContainerRows].map((container) => [
					container.id,
					container,
				]),
			).values(),
		);

		if (availableContainers.length > 0 && !containerId) {
			return NextResponse.json(
				{
					message:
						"Lô hàng có container, vui lòng chọn container để cập nhật POD",
					requiresContainerSelection: true,
					containers: availableContainers,
				},
				{ status: 400 },
			);
		}

		const selectedContainer = containerId
			? availableContainers.find((container) => container.id === containerId) ||
				null
			: null;

		if (containerId && !selectedContainer) {
			return NextResponse.json(
				{ message: "Container được chọn không thuộc lô hàng này" },
				{ status: 400 },
			);
		}

		const sourceDriveUrl = linkedFollowUp?.driveUrl || trucking.driveUrl;
		const rootFolderId = extractDriveFolderId(sourceDriveUrl);

		if (!rootFolderId) {
			return NextResponse.json(
				{
					message:
						"Không tìm thấy folder Drive của lô hàng. Hãy tạo folder Drive cho logistics request hoặc trucking job trước.",
				},
				{ status: 400 },
			);
		}

		const { folderId, folderUrl } = await ensureChildFolder(
			rootFolderId,
			"TRUCKING",
		);

		const drive = getDriveClient();
		const uploadedFiles: Array<{ id: string; name: string; url: string }> = [];

		for (const file of files) {
			const buffer = Buffer.from(await file.arrayBuffer());
			const stream = Readable.from(buffer);

			const created = await drive.files.create({
				requestBody: {
					name: file.name,
					parents: [folderId],
				},
				media: {
					mimeType: file.type || "application/octet-stream",
					body: stream,
				},
				fields: "id, name",
				supportsAllDrives: true,
			});

			if (!created.data.id) {
				throw new Error(`Không thể upload file ${file.name}`);
			}

			uploadedFiles.push({
				id: created.data.id,
				name: created.data.name || file.name,
				url: `https://drive.google.com/file/d/${created.data.id}/view`,
			});
		}

		const mergedCcgh = Array.from(
			new Set([...(trucking.ccgh || []), ...uploadedFiles.map((f) => f.url)]),
		);

		await prismaRPA.truckingFollowUp.update({
			where: { id: truckingFollowUpId },
			data: { ccgh: mergedCcgh },
		});

		if (selectedContainer && uploadedFiles.length > 0) {
			await prismaRPA.container.update({
				where: { id: selectedContainer.id },
				data: { podUrl: uploadedFiles[0].url },
			});

			logTruckingActivity(truckingFollowUpId, {
				userId: session.user.id,
				userName: session.user.name,
				action: "UPDATE_CONTAINER_POD_URL",
				subResource: "container",
				subResourceId: selectedContainer.id,
				field: "podUrl",
				oldValue: selectedContainer.podUrl,
				newValue: uploadedFiles[0].url,
			});
		}

		logTruckingActivity(truckingFollowUpId, {
			userId: session.user.id,
			userName: session.user.name,
			action: "UPLOAD_CCGH_FILES",
			field: "ccgh",
			oldValue: trucking.ccgh || [],
			newValue: mergedCcgh,
		});

		return NextResponse.json({
			ccgh: mergedCcgh,
			uploadedFiles,
			folderId,
			folderUrl,
			source: linkedFollowUp?.driveUrl ? "logistics-request" : "trucking-job",
			updatedContainerId: selectedContainer?.id || null,
			podUrl: uploadedFiles[0]?.url || null,
		});
	} catch (error: any) {
		console.error("Error uploading CCGH files:", error);
		return NextResponse.json(
			{ message: error.message || "Lỗi upload CCGH" },
			{ status: 500 },
		);
	}
}
