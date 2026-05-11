import { format, parseISO } from "date-fns";
import { prismaRPA } from "@/lib/db";
import { getGmailClient } from "@/lib/gmail/client";
import { ALL_OPTIONAL_FIELDS } from "./fcr-fields";

export async function sendDispatchMail({
	truckingNumberId,
	date,
	tripNumber,
	accessToken,
	userEmail,
	columnsOrder,
}: {
	truckingNumberId: string;
	date: string;
	tripNumber?: number;
	accessToken: string;
	userEmail: string;
	columnsOrder?: string[];
}) {
	const result = await sendGroupedDispatchMails({
		items: [{ truckingNumberId, date, tripNumber }],
		accessToken,
		userEmail,
		columnsOrder,
	});
	return result[0];
}

export async function sendGroupedDispatchMails({
	items,
	accessToken,
	userEmail,
	columnsOrder,
}: {
	items: { truckingNumberId: string; date: string; tripNumber?: number }[];
	accessToken: string;
	userEmail: string;
	columnsOrder?: string[];
}) {
	const results: any[] = [];

	try {
		const truckingNumberIds = Array.from(
			new Set(items.map((i) => i.truckingNumberId)),
		);
		const trucks = await prismaRPA.truckingNumber.findMany({
			where: { id: { in: truckingNumberIds } },
		});
		const truckMap = new Map(trucks.map((t) => [t.id, t]));

		const groups = new Map<string, typeof items>();

		for (const item of items) {
			const truck = truckMap.get(item.truckingNumberId);
			if (!truck) continue;

			const fromDate = new Date(`${item.date}T00:00:00.000Z`);
			const toDate = new Date(`${item.date}T23:59:59.999Z`);
			const firstFcr = await prismaRPA.fCR.findFirst({
				where: {
					truckingNumberId: item.truckingNumberId,
					implementationDate: { gte: fromDate, lte: toDate },
					...(item.tripNumber ? { tripNumber: item.tripNumber } : {}),
				},
				select: { vendor: true },
			});

			const effectiveVendor = firstFcr?.vendor || truck.vendorName;

			const key = effectiveVendor
				? `VENDOR:${effectiveVendor}`
				: `TRUCK:${truck.id}:${item.date}`;
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)?.push(item);
		}

		const gmail = getGmailClient(accessToken);

		const DEFAULT_COLS = [
			"fcrNumber",
			"jobNumber",
			"pickupAt",
			"deliveryAt",
			"weight",
			"notes",
		];
		const activeCols =
			columnsOrder && columnsOrder.length > 0 ? columnsOrder : DEFAULT_COLS;

		// Allow 'type' and 'serviceMode' base columns as well as optional fields.
		const validCols = activeCols.filter(
			(c) =>
				c === "type" ||
				c === "serviceMode" ||
				ALL_OPTIONAL_FIELDS.some((f) => f.key === c),
		);
		const finalColKeys = ["tripNumber", ...validCols];

		const esc = (s: string | null | undefined) =>
			(s ?? "")
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;");

		function getCellValue(f: any, key: string) {
			switch (key) {
				case "tripNumber":
					return `Chuyến ${f.tripNumber}`;
				case "jobNumber":
					return f.truckingFollowUp?.jobNumber || "—";
				case "billOrBooking":
					return f.truckingFollowUp?.billOrBooking || "—";
				case "companyName":
					return f.truckingFollowUp?.companyName || "—";
				case "warehouse":
					return (
						f.truckingFollowUp?.warehouse ||
						f.truckingFollowUp?.routineDetail ||
						"—"
					);
				case "pickupAt":
					return f.pickupAt || "—";
				case "deliveryAt":
					return f.deliveryAt || "—";
				case "route":
					return [f.pickupAt, f.deliveryAt].filter(Boolean).join(" → ") || "—";
				case "fcrNumber":
					return f.fcrNumber || "—";
				case "weight":
					return f.grossWeight ? `${f.grossWeight}kg` : "—";
				case "cbm":
					return f.cbm ? `${f.cbm}cbm` : "—";
				case "qty":
					return f.quantity ? `${f.quantity} kiện` : "—";
				case "date":
					return f.implementationDate
						? format(
								typeof f.implementationDate === "string"
									? parseISO(f.implementationDate)
									: f.implementationDate,
								"dd/MM",
							)
						: "—";
				case "notes":
					return (
						[f.notes, f.truckingFollowUp?.note].filter(Boolean).join(" ") || "—"
					);
				case "pickUpTime":
					return f.truckingFollowUp?.pickUpTime || "—";
				case "plateNumber":
					return f.plateNumber || "—";
				case "driver":
					return f.driver || "—";
				case "truckType":
					return f.truckType || "—";
				case "containerNumber":
					return f.containerNo || "—";
				case "routineDetail":
					return f.truckingFollowUp?.routineDetail || "—";
				case "vendor":
					return f.vendor || "—";
				case "shipper":
					return f.truckingFollowUp?.companyName || f.shipper || "—";
				case "serviceMode":
					return f.truckingFollowUp?.serviceMode || "—";
				case "type":
					return f.truckingFollowUp?.operationType === "NHAP" ? "NHẬP" : "XUẤT";
				default:
					return "—";
			}
		}

		for (const [_key, groupItems] of groups.entries()) {
			try {
				const firstItem = groupItems[0];
				const date = firstItem.date;
				const displayDate = format(parseISO(date), "dd/MM/yyyy");

				const allGroupFcrs: any[] = [];
				const truckLines: string[] = [];
				let recipientName = "";
				let toAddresses: string[] = [];

				for (const item of groupItems) {
					const truck = truckMap.get(item.truckingNumberId);
					if (!truck) continue;

					if (!recipientName)
						recipientName = truck.isVendor
							? truck.vendorName || ""
							: truck.driverName || "";
					if (truck.driverEmail) toAddresses.push(truck.driverEmail);

					const fromDate = new Date(`${date}T00:00:00.000Z`);
					const toDate = new Date(`${date}T23:59:59.999Z`);
					const firstFcrInSlot = await prismaRPA.fCR.findFirst({
						where: {
							truckingNumberId: item.truckingNumberId,
							implementationDate: { gte: fromDate, lte: toDate },
							...(item.tripNumber ? { tripNumber: item.tripNumber } : {}),
						},
						select: { vendor: true },
					});

					const effectiveVendorName =
						firstFcrInSlot?.vendor || truck.vendorName;
					if (effectiveVendorName) {
						if (!recipientName || recipientName === truck.driverName)
							recipientName = effectiveVendorName;
						const vendor = await prismaRPA.vendor.findFirst({
							where: { name: effectiveVendorName, site: truck.site },
							select: { emails: true },
						});
						if (vendor?.emails) toAddresses.push(...vendor.emails);
					}

					const fcrs = await prismaRPA.fCR.findMany({
						where: {
							truckingNumberId: item.truckingNumberId,
							implementationDate: { gte: fromDate, lte: toDate },
							...(item.tripNumber ? { tripNumber: item.tripNumber } : {}),
						},
						include: {
							truckingFollowUp: {
								select: {
									jobNumber: true,
									companyName: true,
									serviceMode: true,
									billOrBooking: true,
									warehouse: true,
									routineDetail: true,
									pickUpTime: true,
									operationType: true,
									note: true,
								},
							},
						},
						orderBy: [{ tripNumber: "asc" }, { fcrNumber: "asc" }],
					});

					if (fcrs.length > 0) {
						const plateLabel = truck.plateNumber || truck.vendorName || "Xe";
						allGroupFcrs.push({ plateLabel, fcrs });
						truckLines.push(plateLabel);
					}
				}

				if (allGroupFcrs.length === 0) {
					groupItems.forEach((i) =>
						results.push({
							...i,
							success: false,
							message: "Không tìm thấy lô hàng",
						}),
					);
					continue;
				}

				toAddresses = [...new Set(toAddresses.filter(Boolean))];
				const to = toAddresses.join(";");
				if (!to) {
					groupItems.forEach((i) =>
						results.push({
							...i,
							success: false,
							message: "Không tìm thấy email recipient",
						}),
					);
					continue;
				}

				const thCells = finalColKeys
					.map((k, colIdx) => {
						let label = k;
						if (k === "tripNumber") label = "Chuyến";
						else if (k === "type") label = "N/X";
						else if (k === "serviceMode") label = "Mode";
						else {
							label = ALL_OPTIONAL_FIELDS.find((f) => f.key === k)?.label || k;
						}
						const isLast = colIdx === finalColKeys.length - 1;
						const br = isLast ? "" : "border-right:1px solid #cbd5e1;";
						return `<th style="padding:10px 8px; text-align:center; color:#1e293b; font-weight:bold; border-bottom:2px solid #cbd5e1; ${br} white-space:nowrap; font-size:13px; background-color: #f1f5f9;">${esc(label)}</th>`;
					})
					.join("");

				const tableWidth = Math.max(700, finalColKeys.length * 110);

				let sectionsHtml = "";
				for (const group of allGroupFcrs) {
					const rowsHtml = group.fcrs
						.map((f: any, rowIdx: number) => {
							const bg = rowIdx % 2 === 0 ? "#ffffff" : "#f8fafc";
							const tdCells = finalColKeys
								.map((k, colIdx) => {
									const isLast = colIdx === finalColKeys.length - 1;
									const val = getCellValue(f, k);
									let style = `padding:8px 10px; border-bottom:1px solid #e2e8f0; ${isLast ? "" : "border-right:1px solid #e2e8f0;"} color:#475569; font-size:13px; text-align:center;`;
									if (
										k !== "notes" &&
										k !== "warehouse" &&
										k !== "routineDetail" &&
										k !== "companyName" &&
										k !== "route"
									)
										style += " white-space:nowrap;";
									if (k === "tripNumber")
										style += " font-weight:bold; color:#3b82f6;";
									if (k === "fcrNumber" || k === "jobNumber")
										style += " font-weight:600; color:#0f172a;";
									if (k === "type" && val === "NHẬP")
										style += " font-weight:bold; color:#0284c7;";
									if (k === "type" && val === "XUẤT")
										style += " font-weight:bold; color:#ea580c;";

									if (k === "pickupAt")
										return `<td style="${style} color:#059669; font-weight:500;">⬆ ${esc(val)}</td>`;
									if (k === "deliveryAt")
										return `<td style="${style} color:#dc2626; font-weight:500;">⬇ ${esc(val)}</td>`;

									return `<td style="${style}">${esc(val)}</td>`;
								})
								.join("");
							return `<tr style="background-color: ${bg};">${tdCells}</tr>`;
						})
						.join("");

					sectionsHtml += `
             <div style="margin-top: 24px; border-radius: 8px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
               <div style="background: linear-gradient(to right, #f1f5f9, #ffffff); padding: 12px 16px; border-bottom: 2px solid #3b82f6; font-weight: bold; color: #1e293b; font-size: 15px;">
                 <span style="color: #64748b; font-weight: normal; margin-right: 4px;">Xe:</span><span style="color: #2563eb; letter-spacing: 0.5px;">${esc(group.plateLabel)}</span>
               </div>
               <div style="overflow-x: auto; width: 100%; -webkit-overflow-scrolling: touch;">
                 <div style="display: inline-block; min-width: 100%;">
                   <table width="${tableWidth}" border="0" cellpadding="0" cellspacing="0" style="width: ${tableWidth}px; min-width: ${tableWidth}px; border-collapse: collapse; background-color: #ffffff;">
                     <thead>
                        <tr>${thCells}</tr>
                     </thead>
                     <tbody>${rowsHtml}</tbody>
                   </table>
                 </div>
               </div>
             </div>
           `;
				}

				const label = Array.from(new Set(truckLines)).join(", ");
				const subject = `[Dispatch] Lịch vận chuyển ngày ${displayDate} - ${label}`;
				const bodyContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          </head>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.5; color: #1a202c; margin: 0; padding: 20px; background-color: #f7fafc; -webkit-text-size-adjust: 100%;">
            <div style="width: 100%; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.05); overflow: hidden;">
              <div style="background: linear-gradient(135deg, #3182ce 0%, #2c5282 100%); padding: 20px; color: #ffffff;">
                <h2 style="margin: 0; font-size: 18px; letter-spacing: 0.5px;">KẾ HOẠCH VẬN CHUYỂN</h2>
                <div style="font-size: 13px; opacity: 0.9; margin-top: 4px;">Ngày: ${displayDate}</div>
              </div>
              <div style="padding: 24px;">
                <p>Kính gửi <strong>${esc(recipientName)}</strong>,</p>
                <p>Dưới đây là danh sách điều phối vận chuyển cho ngày <strong>${displayDate}</strong>:</p>
                ${sectionsHtml}
                <p style="margin-top: 24px; font-size: 12px; color: #718096; border-top: 1px solid #edf2f7; padding-top: 16px;">
                  * Vui lòng kiểm tra kỹ thông tin và phản hồi ngay nếu có sai sót.<br/>
                  * Đảm bảo an toàn giao thông và tuân thủ quy trình giao nhận.
                </p>
              </div>
              <div style="background-color: #f7fafc; padding: 12px 24px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #a0aec0; text-align: center;">
                Email tự động từ hệ thống quản lý VVMV.
              </div>
            </div>
          </body>
          </html>
        `;

				const utf8Subject = `=?utf-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
				const emailContent = [
					`To: ${to}`,
					`Subject: ${utf8Subject}`,
					`From: ${userEmail}`,
					`Content-Type: text/html; charset=utf-8`,
					`MIME-Version: 1.0`,
					"",
					bodyContent,
				].join("\r\n");

				const base64EncodedEmail = Buffer.from(emailContent)
					.toString("base64")
					.replace(/\+/g, "-")
					.replace(/\//g, "_")
					.replace(/=+$/, "");

				await gmail.users.messages.send({
					userId: "me",
					requestBody: { raw: base64EncodedEmail },
				});

				groupItems.forEach((i) => results.push({ ...i, success: true, to }));
			} catch (e) {
				console.error("Grouped Mail Error:", e);
				groupItems.forEach((i) =>
					results.push({
						...i,
						success: false,
						message: e instanceof Error ? e.message : "Error",
					}),
				);
			}
		}
	} catch (err) {
		console.error("sendGroupedDispatchMails error:", err);
	}

	return results;
}
