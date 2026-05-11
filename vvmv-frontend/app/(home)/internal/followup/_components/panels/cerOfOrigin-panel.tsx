"use client";

import Link from "next/link";
import { SiQuicklook } from "react-icons/si";
import type { CerOfOriginRow } from "../../types";
import { CEROFORIGIN_HEADERS } from "../table/column-headers";

interface CerOfOriginPanelProps {
	cerOfOrigins: CerOfOriginRow[];
}

/**
 * Collapsible panel for displaying declaration children
 * Shows all declaration fields from Prisma schema
 */
export function CerOfOriginPanel({ cerOfOrigins }: CerOfOriginPanelProps) {
	const formatDate = (dateStr: string | null | undefined) => {
		if (!dateStr) return "—";
		try {
			const date = new Date(dateStr);
			return date.toLocaleDateString("en-US", {
				year: "numeric",
				month: "short",
				day: "numeric",
			});
		} catch {
			return "—";
		}
	};

	const formatNumber = (value: number | null | undefined) => {
		if (value === null || value === undefined) return "—";
		return value.toLocaleString();
	};

	const content = (
		<div className="space-y-4">
			{/* Desktop: Table view (md and above) */}
			<div className="hidden md:block overflow-x-auto">
				<table className="text-xs border-collapse table-auto">
					<thead>
						<tr className="text-muted-foreground border-b italic">
							<th className="text-left py-2 px-3 font-medium whitespace-nowrap">
								{CEROFORIGIN_HEADERS.coNo}
							</th>
							<th className="text-left py-2 px-3 font-medium whitespace-nowrap">
								{CEROFORIGIN_HEADERS.coDate}
							</th>
							<th className="text-left py-2 px-3 font-medium whitespace-nowrap">
								{CEROFORIGIN_HEADERS.issuedDepartment}
							</th>
							<th className="text-left py-2 px-3 font-medium whitespace-nowrap">
								{CEROFORIGIN_HEADERS.issuedPlace}
							</th>
							<th className="text-left py-2 px-3 font-medium whitespace-nowrap">
								{CEROFORIGIN_HEADERS.form}
							</th>
							<th className="text-left py-2 px-3 font-medium whitespace-nowrap">
								{CEROFORIGIN_HEADERS.importer}
							</th>
							<th className="text-left py-2 px-3 font-medium whitespace-nowrap">
								{CEROFORIGIN_HEADERS.exporter}
							</th>
							<th className="text-left py-2 px-3 font-medium whitespace-nowrap">
								{CEROFORIGIN_HEADERS.invoice}
							</th>
							<th className="text-left py-2 px-3 font-medium whitespace-nowrap">
								{CEROFORIGIN_HEADERS.totalLines}
							</th>
							<th className="text-left py-2 px-3 font-medium whitespace-nowrap"></th>
						</tr>
					</thead>
					<tbody>
						{cerOfOrigins.length === 0 ? (
							<tr>
								<td
									colSpan={10}
									className="py-4 px-3 text-center text-muted-foreground"
								>
									No certificates of origin found
								</td>
							</tr>
						) : (
							cerOfOrigins.map((cerOfOrigin, index) => (
								<tr
									key={cerOfOrigin.id || index}
									className="border-b border-muted/50 last:border-0 hover:bg-muted/30 transition-colors"
								>
									<td className="py-2 px-3 font-medium whitespace-nowrap">
										{cerOfOrigin.coNo || "—"}
									</td>
									<td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
										{formatDate(cerOfOrigin.coDate)}
									</td>
									<td className="py-2 px-3 font-medium whitespace-nowrap">
										{cerOfOrigin.issuedDepartment || "—"}
									</td>
									<td className="py-2 px-3 font-medium whitespace-nowrap">
										{cerOfOrigin.issuedPlace || "—"}
									</td>
									<td className="py-2 px-3 font-medium whitespace-nowrap">
										{cerOfOrigin.form || "—"}
									</td>
									<td className="py-2 px-3 font-medium whitespace-nowrap Broad">
										{cerOfOrigin.importer || "—"}
									</td>
									<td className="py-2 px-3 font-medium whitespace-nowrap Broad">
										{cerOfOrigin.exporter || "—"}
									</td>
									<td className="py-2 px-3 font-medium whitespace-nowrap">
										{cerOfOrigin.invoice || "—"}
									</td>
									<td className="py-2 px-3 whitespace-nowrap">
										{formatNumber(cerOfOrigin.totalLines)}
									</td>
									<td className="py-2 px-3 whitespace-nowrap">
										<Link
											href={cerOfOrigin.driveUrl || "—"}
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center gap-1.5 text-primary hover:underline group"
										>
											<SiQuicklook />{" "}
											<span className="text-sm truncate">View</span>
										</Link>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>

			{/* Mobile/Tablet: Card grid (below md) */}
			<div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
				{cerOfOrigins.length === 0 ? (
					<div className="col-span-full py-4 text-center text-muted-foreground text-sm">
						No certificates of origin found
					</div>
				) : (
					cerOfOrigins.map((cerOfOrigin, index) => (
						<div
							key={cerOfOrigin.id || index}
							className="p-3 bg-neutral-50 rounded-md border"
						>
							<div className="font-medium text-xs mb-2 truncate">
								{cerOfOrigin.coNo || "—"}
							</div>
							<div className="space-y-1 text-xs text-muted-foreground">
								<div>
									<span className="font-medium">NGÀY CO:</span>{" "}
									{formatDate(cerOfOrigin.coDate)}
								</div>
								{cerOfOrigin.issuedDepartment && (
									<div className="truncate">
										<span className="font-medium">NƠI PHÁT HÀNH:</span>{" "}
										{cerOfOrigin.issuedDepartment}
									</div>
								)}
								{cerOfOrigin.issuedPlace && (
									<div className="truncate">
										<span className="font-medium">NGÀY PHÁT HÀNH:</span>{" "}
										{cerOfOrigin.issuedPlace}
									</div>
								)}
								{cerOfOrigin.form && (
									<div className="truncate">
										<span className="font-medium">FORM:</span>{" "}
										{cerOfOrigin.form}
									</div>
								)}
								{cerOfOrigin.importer && (
									<div className="truncate">
										<span className="font-medium">IMPORTER:</span>{" "}
										{cerOfOrigin.importer}
									</div>
								)}
								{cerOfOrigin.exporter && (
									<div className="truncate">
										<span className="font-medium">EXPORTER:</span>{" "}
										{cerOfOrigin.exporter}
									</div>
								)}
								{cerOfOrigin.invoice && (
									<div className="truncate">
										<span className="font-medium">INVOICE:</span>{" "}
										{cerOfOrigin.invoice}
									</div>
								)}
								{cerOfOrigin.totalLines && (
									<div>
										<span className="font-medium">SỐ DÒNG CO:</span>{" "}
										{formatNumber(cerOfOrigin.totalLines)}
									</div>
								)}
								{cerOfOrigin.driveUrl && (
									<div>
										<span className="font-medium"></span>{" "}
										<Link
											href={cerOfOrigin.driveUrl || "—"}
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center gap-1.5 text-primary hover:underline group"
										>
											<SiQuicklook />{" "}
											<span className="text-sm truncate">View</span>
										</Link>
									</div>
								)}
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);

	return <div className="p-4">{content}</div>;
}
