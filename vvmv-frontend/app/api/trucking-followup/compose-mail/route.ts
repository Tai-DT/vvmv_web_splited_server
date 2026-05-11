import { format } from "date-fns";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";

export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { jobNumber } = await request.json();
		if (!jobNumber || typeof jobNumber !== "string") {
			return NextResponse.json(
				{ message: "Missing or invalid jobNumber" },
				{ status: 400 },
			);
		}

		const job = await prismaRPA.truckingFollowUp.findFirst({
			where: { jobNumber, isDeleted: false },
			include: {
				fcrs: {
					include: {
						container: {
							select: {
								id: true,
								containerNo: true,
								containerSize: true,
								cutOffTime: true,
								declarationLinks: {
									select: {
										declaration: {
											select: { id: true, declarationNumber: true },
										},
									},
								},
							},
						},
					},
				},
				declarations: { select: { id: true, declarationNumber: true } },
			},
		});

		if (!job) {
			return NextResponse.json({ message: "Job not found" }, { status: 404 });
		}

		// Filter out FCRs without implementationDate
		const originalFcrCount = job.fcrs.length;
		const fcrsWithDate = job.fcrs.filter((f) => !!f.implementationDate);
		console.log(
			"--------------------------------------------fcrsWithDate",
			jobNumber,
		);
		console.log(
			"--------------------------------------------originalFcrCount",
			job,
		);
		if (originalFcrCount > 0 && fcrsWithDate.length === 0) {
			return NextResponse.json(
				{
					message:
						"Không thể tạo mail: Không có FCR nào có ngày thực hiện (implementationDate).",
					errors: [
						"Tất cả FCR trong lô hàng đều chưa được cập nhật ngày thực hiện.",
					],
				},
				{ status: 422 },
			);
		}

		// Replace job.fcrs with the filtered list so downstream logic only sees ready FCRs
		(job as any).fcrs = fcrsWithDate;

		const orConditions: any[] = [];
		if (job.requestNumber)
			orConditions.push({ requestTruckingNo: job.requestNumber });
		if (job.jobNumber) orConditions.push({ jobNumber: job.jobNumber });

		let linkedFollowUp: {
			driveUrl?: string | null;
			jobNumber?: string | null;
			handler?: string | null;
			createdBy?: string | null;
		} | null = null;
		if (orConditions.length > 0) {
			linkedFollowUp = await prismaRPA.followUp.findFirst({
				where: { OR: orConditions, isDeleted: false },
				select: {
					driveUrl: true,
					jobNumber: true,
					handler: true,
					createdBy: true,
				},
			});
		}

		let logisticsCcEmails: string[] = [];
		if (linkedFollowUp) {
			const idsToFetch = [];
			if (linkedFollowUp.handler)
				idsToFetch.push(linkedFollowUp.handler.trim());
			if (linkedFollowUp.createdBy)
				idsToFetch.push(linkedFollowUp.createdBy.trim());

			if (idsToFetch.length > 0) {
				const users = await prismaRPA.user.findMany({
					where: {
						OR: [
							{ id: { in: idsToFetch } },
							{ email: { in: idsToFetch } },
							{ username: { in: idsToFetch } },
						],
					},
					select: { email: true },
				});

				logisticsCcEmails = users.map((u) => u.email).filter(Boolean);
			}
		}

		// ── Resolve declaration numbers per FCR (same logic as vendor-portal) ──
		// Case 2 needs FollowUp lookups for requestNumbers without container links
		const requestNumbersNeedingFollowUp = [
			...new Set(
				job.fcrs
					.filter(
						(f) =>
							(f.container?.declarationLinks ?? []).length === 0 &&
							job.requestNumber,
					)
					.map(() => job.requestNumber!),
			),
		];
		const followUpDeclMap = new Map<string, string[]>(); // requestNumber → declarationNumbers[]
		if (requestNumbersNeedingFollowUp.length > 0) {
			const followUps = await prismaRPA.followUp.findMany({
				where: {
					requestTruckingNo: { in: requestNumbersNeedingFollowUp },
					isDeleted: false,
				},
				select: {
					requestTruckingNo: true,
					declarations: { select: { declarationNumber: true } },
				},
			});
			for (const fu of followUps) {
				if (!fu.requestTruckingNo) continue;
				const nums = fu.declarations
					.map((d) => d.declarationNumber)
					.filter((n): n is string => Boolean(n));
				const existing = followUpDeclMap.get(fu.requestTruckingNo) ?? [];
				followUpDeclMap.set(fu.requestTruckingNo, [...existing, ...nums]);
			}
		}

		// Build a map: fcrId → declarationNumbers[]
		const fcrDeclMap = new Map<string, string[]>();
		for (const fcr of job.fcrs) {
			const containerDecls = fcr.container?.declarationLinks ?? [];
			let declNums: string[];
			if (containerDecls.length > 0) {
				declNums = containerDecls
					.map((l) => l.declaration.declarationNumber)
					.filter((n): n is string => Boolean(n));
			} else if (job.requestNumber) {
				declNums = followUpDeclMap.get(job.requestNumber) ?? [];
			} else {
				declNums = (job.declarations ?? [])
					.map((d) => d.declarationNumber)
					.filter((n): n is string => Boolean(n));
			}
			fcrDeclMap.set(fcr.id, [...new Set(declNums)]);
		}

		console.log("[compose-mail] jobNumber:", jobNumber);
		console.log("[compose-mail] job.driveUrl:", job.driveUrl);
		console.log(
			"[compose-mail] linkedFollowUp?.driveUrl:",
			linkedFollowUp?.driveUrl,
		);

		const opType =
			job.operationType?.toUpperCase() === "XUAT"
				? "Xuất"
				: job.operationType?.toUpperCase() === "NHAP"
					? "Nhập"
					: job.operationType || "";
		const serviceMode = job.serviceMode || "";
		const company = job.companyName || "";
		const bill = job.billOrBooking || "";

		// Collect all unique FCR implementation dates (sorted ascending)
		const fcrImplDates = [
			...new Set(
				job.fcrs
					.map((f) => {
						const d = new Date(f.implementationDate!);
						return Number.isNaN(d.getTime()) ? null : d;
					})
					.filter((d): d is Date => d !== null)
					.sort((a, b) => a.getTime() - b.getTime())
					.map((d) => format(d, "dd/MM/yyyy")),
			),
		];

		// Fallback: use job-level date if no FCR dates found
		const jobImplDate =
			fcrImplDates.length > 0
				? fcrImplDates.join(", ")
				: job.implementationDate
					? format(new Date(job.implementationDate), "dd/MM/yyyy")
					: "";

		const subject = [opType, serviceMode, company, bill, jobNumber, jobImplDate]
			.filter(Boolean)
			.join(" + ");

		// Build ops → fcrs map (source of truth is FCR.ops, not trucking_follow_up.ops)
		const opsFcrMap = new Map<string, typeof job.fcrs>();
		for (const fcr of job.fcrs) {
			if (!fcr.ops) continue;
			if (!opsFcrMap.has(fcr.ops)) opsFcrMap.set(fcr.ops, []);
			opsFcrMap.get(fcr.ops)?.push(fcr);
		}

		// Fetch ops emails in one batch
		const opsEmailMap = new Map<string, string[]>();
		if (opsFcrMap.size > 0) {
			const opsRecords = await prismaRPA.ops.findMany({
				where: { name: { in: [...opsFcrMap.keys()] } },
				select: { name: true, emails: true },
			});
			for (const r of opsRecords) {
				if (r.name) opsEmailMap.set(r.name, r.emails ?? []);
			}
		}

		// Drive files shared across all drafts
		const driveUrl = job.driveUrl || linkedFollowUp?.driveUrl || "";
		const driveFiles: {
			id: string;
			name: string;
			webViewLink?: string;
			mimeType: string;
		}[] = [];
		if (driveUrl) {
			const match = driveUrl.match(/(?:folders\/|id=)([\w-]+)/);
			if (match?.[1]) {
				try {
					const { getDriveClient } = await import("@/lib/google-sheets/client");
					const drive = getDriveClient();
					const response = await drive.files.list({
						q: `'${match[1]}' in parents and trashed=false`,
						fields: "files(id, name, webViewLink, mimeType)",
						includeItemsFromAllDrives: true,
						supportsAllDrives: true,
					});
					for (const item of response.data.files || []) {
						if (item.mimeType === "application/vnd.google-apps.folder") {
							const subRes = await drive.files.list({
								q: `'${item.id}' in parents and trashed=false and mimeType != 'application/vnd.google-apps.folder'`,
								fields: "files(id, name, webViewLink, mimeType)",
								includeItemsFromAllDrives: true,
								supportsAllDrives: true,
							});
							subRes.data.files?.forEach((f) => {
								driveFiles.push({
									id: f.id!,
									name: `[${item.name}] ${f.name!}`,
									webViewLink: f.webViewLink || "",
									mimeType: f.mimeType || "",
								});
							});
						} else {
							driveFiles.push({
								id: item.id!,
								name: item.name!,
								webViewLink: item.webViewLink || "",
								mimeType: item.mimeType || "",
							});
						}
					}
				} catch (e) {
					console.error("Error fetching drive files:", e);
				}
			}
		}

		// Attach FreightDoc files: match billOrBooking → FreightDoc.habl
		// Only keep the highest-version record per (type) group
		if (job.billOrBooking) {
			const freightDocs = await prismaRPA.freightDoc.findMany({
				where: { habl: job.billOrBooking, type: "EDO_email" },
				select: {
					id: true,
					habl: true,
					type: true,
					driveUrl: true,
					version: true,
				},
			});

			// Deduplicate: per type, keep the record with the highest version
			const latestByType = new Map<string, (typeof freightDocs)[number]>();
			for (const doc of freightDocs) {
				const key = doc.type ?? "__no_type__";
				const existing = latestByType.get(key);
				if (
					!existing ||
					(doc.version ?? -Infinity) > (existing.version ?? -Infinity)
				) {
					latestByType.set(key, doc);
				}
			}
			const latestDocs = Array.from(latestByType.values());

			if (latestDocs.length > 0) {
				try {
					const { getDriveClient } = await import("@/lib/google-sheets/client");
					const drive = getDriveClient();

					for (const doc of latestDocs) {
						if (!doc.driveUrl) continue;

						// driveUrl may be a raw file ID or a full Drive URL — extract the ID
						const fileIdMatch = doc.driveUrl.match(
							/(?:\/d\/|id=|\/file\/d\/)([^/?&]+)/,
						);
						const fileId = fileIdMatch?.[1] ?? doc.driveUrl.trim();

						if (!fileId) continue;

						try {
							const fileInfo = await drive.files.get({
								fileId,
								fields: "id, name, webViewLink, mimeType",
								supportsAllDrives: true,
							});

							if (fileInfo.data.id) {
								const label = [
									doc.type,
									doc.version != null ? `v${doc.version}` : null,
								]
									.filter(Boolean)
									.join(" ");
								const displayName = `[Freight Doc${label ? ` - ${label}` : ""}] ${fileInfo.data.name || doc.habl || fileId}`;
								driveFiles.push({
									id: fileInfo.data.id,
									name: displayName,
									webViewLink: fileInfo.data.webViewLink || "",
									mimeType:
										fileInfo.data.mimeType || "application/octet-stream",
								});
							}
						} catch (err) {
							console.warn(
								`[compose-mail] Cannot fetch FreightDoc file ${fileId}:`,
								err,
							);
						}
					}
				} catch (e) {
					console.error(
						"[compose-mail] Error loading FreightDoc Drive files:",
						e,
					);
				}
			}
		}

		const vendorFcrMap = new Map<string, typeof job.fcrs>();
		for (const fcr of job.fcrs) {
			const vendor = fcr.vendor || "Không rõ Vendor";
			if (!vendorFcrMap.has(vendor)) vendorFcrMap.set(vendor, []);
			vendorFcrMap.get(vendor)?.push(fcr);
		}
		if (vendorFcrMap.size === 0) vendorFcrMap.set("Không rõ Vendor", []);

		// Fetch vendor emails in one batch
		const allVendorNames = Array.from(vendorFcrMap.keys());
		const vendorRecords = await prismaRPA.vendor.findMany({
			where: { name: { in: allVendorNames } },
			select: { name: true, emails: true },
		});
		const vendorEmailMap = new Map<string, string[]>();
		for (const v of vendorRecords) {
			if (v.name) vendorEmailMap.set(v.name, v.emails.filter(Boolean));
		}

		// Collect all unique warehouse names from FCRs to batch-load WarehouseConfig
		const allWarehouseNames = Array.from(
			new Set(job.fcrs.map((f) => f.warehouse).filter(Boolean) as string[]),
		);
		const warehouseConfigs =
			allWarehouseNames.length > 0
				? await prismaRPA.warehouseConfig.findMany({
						where: { warehouseName: { in: allWarehouseNames } },
						select: {
							warehouseName: true,
							deliveryAddress: true,
							contactInfo: true,
							invoiceInfo: true,
							mapPosition: true,
							notes: true,
						},
					})
				: [];
		const warehouseConfigMap = new Map(
			warehouseConfigs.map((wc) => [wc.warehouseName, wc]),
		);

		// HCM job + FCL service mode → contactInfo not required for vendor drafts
		const isFcl = (job.serviceMode || "").toUpperCase().includes("FCL");
		const isHcmFcl = jobNumber.toUpperCase().startsWith("HCM") && isFcl;

		// ── Validate: every FCR must have full info before building drafts ──
		const validationErrors: string[] = [];
		for (const fcr of job.fcrs) {
			const fcrLabel = fcr.fcrNumber
				? `FCR ${fcr.fcrNumber}`
				: `FCR (id: ${fcr.id.slice(0, 8)})`;
			const missing: string[] = [];

			const wh = fcr.warehouse ? warehouseConfigMap.get(fcr.warehouse) : null;
			if (!fcr.warehouse) {
				missing.push("Kho (warehouse)");
			} else if (!wh) {
				missing.push(
					`Cấu hình kho "${fcr.warehouse}" không tồn tại trong WarehouseConfig`,
				);
			} else {
				if (!wh.deliveryAddress) missing.push("Địa chỉ đóng hàng");
				if (!isHcmFcl && !wh.contactInfo)
					missing.push("Thông tin liên hệ lấy hàng");
				if (!wh.invoiceInfo) missing.push("Thông tin xuất hoá đơn");
			}

			if (missing.length > 0) {
				validationErrors.push(`${fcrLabel}: thiếu ${missing.join(", ")}`);
			}
		}

		if (validationErrors.length > 0) {
			return NextResponse.json(
				{
					message: `Không thể tạo mail — một số FCR chưa đủ thông tin:\n${validationErrors.join("\n")}`,
					errors: validationErrors,
				},
				{ status: 422 },
			);
		}
		// ────────────────────────────────────────────────────────────────────

		const userEmail = session.user.email || "";

		// Helper: escape HTML special chars
		const esc = (s: string | null | undefined) =>
			(s ?? "")
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;");

		const drafts = Array.from(vendorFcrMap.entries()).map(
			([vendorName, fcrs]) => {
				const vendorEmails = vendorEmailMap.get(vendorName) ?? [];
				// Vendor draft: only send to vendor, NOT to OPS
				const toEmails = [...new Set(vendorEmails)].join(";");

				const vendorFcrImplDates = [
					...new Set(
						fcrs
							.map((f) => {
								const d = new Date(f.implementationDate!);
								return Number.isNaN(d.getTime()) ? null : d;
							})
							.filter((d): d is Date => d !== null)
							.sort((a, b) => a.getTime() - b.getTime())
							.map((d) => format(d, "dd/MM/yyyy")),
					),
				];

				const vendorJobImplDate =
					vendorFcrImplDates.length > 0
						? vendorFcrImplDates.join(", ")
						: job.implementationDate
							? format(new Date(job.implementationDate), "dd/MM/yyyy")
							: "";

				const vendorSubject = [
					opType,
					serviceMode,
					company,
					bill,
					jobNumber,
					vendorJobImplDate,
				]
					.filter(Boolean)
					.join(" + ");

				// Group FCRs by warehouse inside this vendor's draft
				const whFcrMap = new Map<string, typeof fcrs>();
				for (const f of fcrs) {
					const key = f.warehouse!; // guaranteed by validation
					if (!whFcrMap.has(key)) whFcrMap.set(key, []);
					whFcrMap.get(key)?.push(f);
				}

				// Build one section per warehouse
				const warehouseSections = Array.from(whFcrMap.entries())
					.map(([whName, whFcrs], idx) => {
						const wh = warehouseConfigMap.get(whName)!;

						// Inner FCR rows: number + date + container (if any FCR has containerNo) + cut off (XUAT) + declarations
						const hasContainerData = whFcrs.some(
							(f) => f.container?.containerNo || f.containerNo,
						);
						const showCutOff = hasContainerData;
						const fcrInnerRows = whFcrs
							.map((f) => {
								const dateStr = format(
									new Date(f.implementationDate!),
									"dd/MM/yyyy",
								);
								const fcrNo = f.fcrNumber || "Không có số";
								const noteCell = f.notes
									? `<span style="color:#94a3b8;font-style:italic;font-size:11px;"> — ${esc(f.notes)}</span>`
									: "";
								const declNums = fcrDeclMap.get(f.id) ?? [];
								const declCell =
									declNums.length > 0
										? declNums
												.map(
													(n) =>
														`<span style="display:inline-block;padding:1px 5px;border-radius:3px;background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;font-size:11px;font-weight:600;margin:1px;">${esc(n)}</span>`,
												)
												.join(" ")
										: `<span style="color:#94a3b8;font-size:11px;font-style:italic;">—</span>`;
								const containerCell = hasContainerData
									? `<td style="padding:5px 12px;font-size:12px;color:#1e293b;border-bottom:1px solid #f1f5f9;white-space:nowrap;">${esc(f.container?.containerNo || f.containerNo || "—")}<span style="color:#94a3b8;font-size:10px;margin-left:4px;">${esc(f.container?.containerSize || "")}</span></td>`
									: "";
								const cutOffCell = showCutOff
									? (() => {
											const ct = f.container?.cutOffTime;
											const ctStr = ct
												? format(new Date(ct), "dd/MM HH:mm")
												: "—";
											return `<td style="padding:5px 12px;font-size:12px;color:#b45309;border-bottom:1px solid #f1f5f9;white-space:nowrap;font-weight:600;">${esc(ctStr)}</td>`;
										})()
									: "";
								return `
              <tr>
                <td style="padding:5px 12px;font-size:12px;color:#1e293b;font-weight:600;border-bottom:1px solid #f1f5f9;">
                  ${esc(fcrNo)}${noteCell}
                </td>
                <td style="padding:5px 12px;font-size:12px;color:#475569;border-bottom:1px solid #f1f5f9;white-space:nowrap;">
                  ${esc(dateStr)}
                </td>
                ${containerCell}
                ${cutOffCell}
                <td style="padding:5px 12px;font-size:12px;border-bottom:1px solid #f1f5f9;">${declCell}</td>
              </tr>`;
							})
							.join("");

						const containerThCell = hasContainerData
							? `<th style="padding:6px 12px;font-size:11px;color:#94a3b8;text-align:left;font-weight:600;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;">CONTAINER</th>`
							: "";
						const cutOffThCell = showCutOff
							? `<th style="padding:6px 12px;font-size:11px;color:#94a3b8;text-align:left;font-weight:600;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;">CUT OFF</th>`
							: "";

						const borderTop = idx > 0 ? "margin-top:20px;" : "";

						return `
            <div style="${borderTop}border:1px solid #e2e8f0;border-radius:6px;overflow-x:auto;max-width:100%;">
              <!-- Warehouse header -->
              <table style="border-collapse:collapse;width:100%;background:#f0f9ff;">
                <tr>
                  <td colspan="2" style="padding:8px 14px 6px;font-weight:700;font-size:13px;color:#0369a1;border-bottom:1px solid #bae6fd;">
                    🏭 ${esc(whName)}
                  </td>
                </tr>
                <tr>
                  <td style="padding:5px 14px;font-size:12px;color:#64748b;white-space:nowrap;width:210px;">Địa chỉ đóng hàng</td>
                  <td style="padding:5px 14px;font-size:12px;color:#1e293b;">${esc(wh.deliveryAddress)}</td>
                </tr>
                ${
									!isHcmFcl && wh.contactInfo
										? `
                <tr style="background:#e0f2fe;">
                  <td style="padding:5px 14px;font-size:12px;color:#64748b;white-space:nowrap;">Thông tin liên hệ lấy hàng</td>
                  <td style="padding:5px 14px;font-size:12px;color:#1e293b;white-space:pre-line;">${esc(wh.contactInfo)}</td>
                </tr>`
										: ""
								}
                <tr>
                  <td style="padding:5px 14px 8px;font-size:12px;color:#64748b;white-space:nowrap;">Thông tin xuất hoá đơn</td>
                  <td style="padding:5px 14px 8px;font-size:12px;color:#1e293b;white-space:pre-line;">${esc(wh.invoiceInfo)}</td>
                </tr>
                ${
									wh.mapPosition
										? `
                <tr style="background:#f0fdf4;">
                  <td style="padding:5px 14px 8px;font-size:12px;color:#64748b;white-space:nowrap;">📍 Định vị kho</td>
                  <td style="padding:5px 14px 8px;font-size:12px;">
                    <a href="${wh.mapPosition}" style="color:#0369a1;font-weight:600;">Xem trên Google Maps</a>
                  </td>
                </tr>`
										: ""
								}
              </table>
              ${
								wh.notes
									? `
              <div style="margin:10px 14px 12px;padding:10px 14px;background:#fffbeb;border:1px solid #fcd34d;border-left:4px solid #f59e0b;border-radius:4px;">
                <div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">⚠️ Lưu ý</div>
                <div style="font-size:12px;color:#78350f;white-space:pre-line;">${esc(wh.notes)}</div>
              </div>`
									: ""
							}
              <!-- FCR list for this warehouse -->
              <table style="border-collapse:collapse;width:100%;background:#ffffff;">
                <tr style="background:#f8fafc;">
                  <th style="padding:6px 12px;font-size:11px;color:#94a3b8;text-align:left;font-weight:600;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;">SỐ FCR</th>
                  <th style="padding:6px 12px;font-size:11px;color:#94a3b8;text-align:left;font-weight:600;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;">NGÀY THỰC HIỆN</th>
                  ${containerThCell}
                  ${cutOffThCell}
                  <th style="padding:6px 12px;font-size:11px;color:#94a3b8;text-align:left;font-weight:600;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;">TỜ KHAI</th>
                </tr>
                ${fcrInnerRows}
              </table>
            </div>`;
					})
					.join("");

				const jobInfoLine = [opType, serviceMode, company, bill]
					.filter(Boolean)
					.join(" + ");
				const bodyPrefix = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;font-size:13px;color:#1e293b;margin:0;padding:20px;">
  <p>Kính gửi <strong>${esc(vendorName)}</strong>,</p>
  <p>Chúng tôi xin thông báo thông tin đóng/trả hàng cho job <strong>${esc(jobNumber)}</strong> như sau:</p>
  ${jobInfoLine ? `<p style="font-weight:700;color:#0369a1;font-size:16px;margin:0 0 16px;">${esc(jobInfoLine)}</p>` : ""}
  ${warehouseSections}
  <p style="margin-top:24px;">Trân trọng,</p>
</body>
</html>`;

				return {
					vendorName,
					to: toEmails,
					cc:
						logisticsCcEmails.length > 0
							? [...new Set(logisticsCcEmails)].join(";")
							: undefined,
					subject: vendorSubject,
					bodyPrefix,
					isHtml: true,
					driveUrl,
					driveFiles,
					userEmail,
				};
			},
		);

		// ── OPS drafts: one email per OPS person, showing only their FCRs ──
		for (const [opsName, opsFcrs] of opsFcrMap.entries()) {
			const opsEmailList = opsEmailMap.get(opsName) ?? [];
			if (opsEmailList.length === 0) continue;

			// Build vendor→fcrs map for just this OPS person's FCRs
			const vendorFcrMapForOps = new Map<string, typeof opsFcrs>();
			for (const f of opsFcrs) {
				const v = f.vendor || "Không rõ Vendor";
				if (!vendorFcrMapForOps.has(v)) vendorFcrMapForOps.set(v, []);
				vendorFcrMapForOps.get(v)?.push(f);
			}

			const allVendorSections = Array.from(vendorFcrMapForOps.entries())
				.map(([vendorName, fcrs]) => {
					const esc2 = esc; // reuse helper

					const whFcrMap2 = new Map<string, typeof fcrs>();
					for (const f of fcrs) {
						const key = f.warehouse!;
						if (!whFcrMap2.has(key)) whFcrMap2.set(key, []);
						whFcrMap2.get(key)?.push(f);
					}

					const warehouseSections2 = Array.from(whFcrMap2.entries())
						.map(([whName, whFcrs], idx) => {
							const wh = warehouseConfigMap.get(whName)!;
							const hasContainerData2 = whFcrs.some(
								(f) => f.container?.containerNo || f.containerNo,
							);
							const showCutOff2 = hasContainerData2;

							const containerThCell2 = hasContainerData2
								? `<th style="padding:6px 12px;font-size:11px;color:#94a3b8;text-align:left;font-weight:600;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;">CONTAINER</th>`
								: "";
							const cutOffThCell2 = showCutOff2
								? `<th style="padding:6px 12px;font-size:11px;color:#94a3b8;text-align:left;font-weight:600;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;">CUT OFF</th>`
								: "";

							const fcrInnerRows2 = whFcrs
								.map((f) => {
									const dateStr = format(
										new Date(f.implementationDate!),
										"dd/MM/yyyy",
									);
									const fcrNo = f.fcrNumber || "Không có số";
									const noteCell = f.notes
										? `<span style="color:#94a3b8;font-style:italic;font-size:11px;"> — ${esc2(f.notes)}</span>`
										: "";
									const vendorCell = `<td style="padding:5px 12px;font-size:12px;color:#7c3aed;border-bottom:1px solid #f1f5f9;white-space:nowrap;font-weight:600;">${esc2(vendorName)}</td>`;
									const declNums2 = fcrDeclMap.get(f.id) ?? [];
									const declCell2 =
										declNums2.length > 0
											? declNums2
													.map(
														(n) =>
															`<span style="display:inline-block;padding:1px 5px;border-radius:3px;background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;font-size:11px;font-weight:600;margin:1px;">${esc2(n)}</span>`,
													)
													.join(" ")
											: `<span style="color:#94a3b8;font-size:11px;font-style:italic;">—</span>`;
									const containerCell2 = hasContainerData2
										? `<td style="padding:5px 12px;font-size:12px;color:#1e293b;border-bottom:1px solid #f1f5f9;white-space:nowrap;">${esc2(f.container?.containerNo || f.containerNo || "—")}<span style="color:#94a3b8;font-size:10px;margin-left:4px;">${esc2(f.container?.containerSize || "")}</span></td>`
										: "";
									const cutOffCell2 = showCutOff2
										? (() => {
												const ct = f.container?.cutOffTime;
												const ctStr = ct
													? format(new Date(ct), "dd/MM HH:mm")
													: "—";
												return `<td style="padding:5px 12px;font-size:12px;color:#b45309;border-bottom:1px solid #f1f5f9;white-space:nowrap;font-weight:600;">${esc2(ctStr)}</td>`;
											})()
										: "";
									return `
              <tr>
                ${vendorCell}
                <td style="padding:5px 12px;font-size:12px;color:#1e293b;font-weight:600;border-bottom:1px solid #f1f5f9;">${esc2(fcrNo)}${noteCell}</td>
                <td style="padding:5px 12px;font-size:12px;color:#475569;border-bottom:1px solid #f1f5f9;white-space:nowrap;">${esc2(dateStr)}</td>
                ${containerCell2}
                ${cutOffCell2}
                <td style="padding:5px 12px;font-size:12px;border-bottom:1px solid #f1f5f9;">${declCell2}</td>
              </tr>`;
								})
								.join("");

							const borderTop2 = idx > 0 ? "margin-top:20px;" : "";
							return `
            <div style="${borderTop2}border:1px solid #e2e8f0;border-radius:6px;overflow-x:auto;max-width:100%;">
              <table style="border-collapse:collapse;width:100%;background:#f0f9ff;">
                <tr>
                  <td colspan="2" style="padding:8px 14px 6px;font-weight:700;font-size:13px;color:#0369a1;border-bottom:1px solid #bae6fd;">
                    🏭 ${esc2(whName)}
                  </td>
                </tr>
                <tr>
                  <td style="padding:5px 14px;font-size:12px;color:#64748b;white-space:nowrap;width:210px;">Địa chỉ đóng hàng</td>
                  <td style="padding:5px 14px;font-size:12px;color:#1e293b;">${esc2(wh.deliveryAddress)}</td>
                </tr>
                <tr style="background:#e0f2fe;">
                  <td style="padding:5px 14px;font-size:12px;color:#64748b;white-space:nowrap;">Thông tin liên hệ lấy hàng</td>
                  <td style="padding:5px 14px;font-size:12px;color:#1e293b;white-space:pre-line;">${esc2(wh.contactInfo)}</td>
                </tr>
                <tr>
                  <td style="padding:5px 14px 8px;font-size:12px;color:#64748b;white-space:nowrap;">Thông tin xuất hoá đơn</td>
                  <td style="padding:5px 14px 8px;font-size:12px;color:#1e293b;white-space:pre-line;">${esc2(wh.invoiceInfo)}</td>
                </tr>
                ${
									wh.mapPosition
										? `
                <tr style="background:#f0fdf4;">
                  <td style="padding:5px 14px 8px;font-size:12px;color:#64748b;white-space:nowrap;">📍 Định vị kho</td>
                  <td style="padding:5px 14px 8px;font-size:12px;">
                    <a href="${wh.mapPosition}" style="color:#0369a1;font-weight:600;">Xem trên Google Maps</a>
                  </td>
                </tr>`
										: ""
								}
              </table>
              ${
								wh.notes
									? `
              <div style="margin:10px 14px 12px;padding:10px 14px;background:#fffbeb;border:1px solid #fcd34d;border-left:4px solid #f59e0b;border-radius:4px;">
                <div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">⚠️ Lưu ý</div>
                <div style="font-size:12px;color:#78350f;white-space:pre-line;">${esc2(wh.notes)}</div>
              </div>`
									: ""
							}
              <table style="border-collapse:collapse;width:100%;background:#ffffff;">
                <tr style="background:#f8fafc;">
                  <th style="padding:6px 12px;font-size:11px;color:#94a3b8;text-align:left;font-weight:600;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;">VENDOR</th>
                  <th style="padding:6px 12px;font-size:11px;color:#94a3b8;text-align:left;font-weight:600;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;">SỐ FCR</th>
                  <th style="padding:6px 12px;font-size:11px;color:#94a3b8;text-align:left;font-weight:600;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;">NGÀY THỰC HIỆN</th>
                  ${containerThCell2}
                  ${cutOffThCell2}
                  <th style="padding:6px 12px;font-size:11px;color:#94a3b8;text-align:left;font-weight:600;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0;">TỜ KHAI</th>
                </tr>
                ${fcrInnerRows2}
              </table>
            </div>`;
						})
						.join("");

					return warehouseSections2;
				})
				.join("");

			const opsJobInfoLine = [opType, serviceMode, company, bill]
				.filter(Boolean)
				.join(" + ");
			const opsBodyPrefix = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;font-size:13px;color:#1e293b;margin:0;padding:20px;">
  <p>Kính gửi <strong>${esc(opsName)}</strong>,</p>
  <p>Tổng hợp thông tin giao nhận hàng cho job <strong>${esc(jobNumber)}</strong>:</p>
  ${opsJobInfoLine ? `<p style="font-weight:700;color:#0369a1;font-size:16px;margin:0 0 16px;">${esc(opsJobInfoLine)}</p>` : ""}
  ${allVendorSections}
  <p style="margin-top:24px;">Trân trọng,</p>
</body>
</html>`;

			drafts.push({
				vendorName: `OPS - ${opsName}`,
				to: [...new Set(opsEmailList)].join(";"),
				cc:
					logisticsCcEmails.length > 0
						? [...new Set(logisticsCcEmails)].join(";")
						: undefined,
				subject,
				bodyPrefix: opsBodyPrefix,
				isHtml: true,
				driveUrl,
				driveFiles,
				userEmail,
			});
		}

		const totalEmailsFound = drafts.reduce(
			(acc, d) => acc + (d.to ? d.to.split(";").filter(Boolean).length : 0),
			0,
		);

		return NextResponse.json({
			success: true,
			emailsFound: totalEmailsFound,
			drafts,
			draft: drafts[0] ?? null,
		});
	} catch (error: any) {
		console.error("Compose mail error:", error);
		return NextResponse.json(
			{ message: error.message || "Failed to generate mail link" },
			{ status: 500 },
		);
	}
}
