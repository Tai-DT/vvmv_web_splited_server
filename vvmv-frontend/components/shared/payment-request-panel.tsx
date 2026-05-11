"use client";

import { CreditCard, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { UserDisplay } from "@/components/ui/user-display";
import { apiFetch, getFetchErrorMessage } from "@/lib/api/client";

export type PaymentRequestRow = {
	id?: string;
	declarationNumber?: string | null;
	taxCode?: string | null;
	amount?: number | null;
	authority?: string | null;
	type?: string | null;
	arNumber?: string | null;
	notifyNumber?: string | null;
	createdAt?: string;
	user?: { id: string; name?: string | null; email: string } | null;
};

type Column = {
	key: keyof PaymentRequestRow;
	label: string;
	minWidth?: string;
};

const COLUMNS: Column[] = [
	{ key: "declarationNumber", label: "Số tờ khai", minWidth: "130px" },
	{ key: "taxCode", label: "Mã số thuế", minWidth: "120px" },
	{ key: "amount", label: "Số tiền", minWidth: "110px" },
	{ key: "authority", label: "Cơ quan", minWidth: "120px" },
	{ key: "type", label: "Loại", minWidth: "100px" },
	{ key: "arNumber", label: "Số AR", minWidth: "110px" },
	{ key: "notifyNumber", label: "Số thông báo", minWidth: "130px" },
	{ key: "createdAt", label: "Ngày tạo", minWidth: "130px" },
];

interface PaymentRequestPanelProps {
	/** e.g. "/api/trucking-followup/payment-request" */
	apiPath: string;
	/** The parent record id (truckingFollowUpId or followUpId) */
	parentId: string;
	/** The query param name for the parent id */
	parentIdParam: "truckingFollowUpId" | "followUpId";
}

export function PaymentRequestPanel({
	apiPath,
	parentId,
	parentIdParam,
}: PaymentRequestPanelProps) {
	const [data, setData] = useState<PaymentRequestRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);

	const fetchData = useCallback(async () => {
		setIsLoading(true);
		setLoadError(null);
		try {
			const res = await apiFetch(`${apiPath}?${parentIdParam}=${parentId}`);
			if (!res.ok) {
				throw new Error(
					await getFetchErrorMessage(res, "Failed to load payment requests"),
				);
			}
			const items: PaymentRequestRow[] = await res.json();
			setData(items);
		} catch (error) {
			setLoadError(error instanceof Error ? error.message : "Failed to load");
		} finally {
			setIsLoading(false);
		}
	}, [apiPath, parentId, parentIdParam]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const formatAmount = (value: number | null | undefined) => {
		if (value === null || value === undefined) return "—";
		return value.toLocaleString("vi-VN");
	};

	const formatDate = (value: string | null | undefined) => {
		if (!value) return "—";
		const d = new Date(value);
		if (Number.isNaN(d.getTime())) return "—";
		return d.toLocaleDateString("vi-VN", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		});
	};

	const colSpan = COLUMNS.length + 2; // # + columns + Created By

	return (
		<div className="flex flex-col gap-4 p-4">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-medium flex items-center gap-2">
					<CreditCard className="size-4" />
					Payment Requests
				</h3>
				<Button
					variant="ghost"
					size="sm"
					onClick={fetchData}
					disabled={isLoading}
				>
					<RefreshCw
						className={`size-3.5 ${isLoading ? "animate-spin" : ""}`}
					/>
				</Button>
			</div>

			<div className="border rounded-lg overflow-x-auto min-h-[200px] bg-slate-50/50">
				<Table>
					<TableHeader className="bg-slate-100/80">
						<TableRow>
							<TableHead className="text-[10px] h-8 w-8 whitespace-nowrap">
								#
							</TableHead>
							{COLUMNS.map((col) => (
								<TableHead
									key={col.key}
									className="text-[10px] h-8 whitespace-nowrap"
									style={{ minWidth: col.minWidth }}
								>
									{col.label}
								</TableHead>
							))}
							<TableHead className="text-[10px] h-8 whitespace-nowrap min-w-[100px]">
								Tạo bởi
							</TableHead>
						</TableRow>
					</TableHeader>

					<TableBody>
						{isLoading ? (
							<TableRow>
								<TableCell
									colSpan={colSpan}
									className="h-32 text-center text-muted-foreground"
								>
									<div className="flex flex-col items-center gap-2">
										<Loader2 className="size-8 animate-spin opacity-50" />
										<span>Đang tải...</span>
									</div>
								</TableCell>
							</TableRow>
						) : loadError ? (
							<TableRow>
								<TableCell
									colSpan={colSpan}
									className="h-32 text-center text-muted-foreground"
								>
									<div className="flex flex-col items-center gap-2">
										<span className="text-destructive">{loadError}</span>
										<Button variant="outline" size="sm" onClick={fetchData}>
											<RefreshCw className="size-4 mr-1" /> Thử lại
										</Button>
									</div>
								</TableCell>
							</TableRow>
						) : data.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={colSpan}
									className="h-24 text-center text-muted-foreground text-sm"
								>
									Không có dữ liệu
								</TableCell>
							</TableRow>
						) : (
							data.map((row, rowIndex) => (
								<TableRow
									key={row.id ?? rowIndex}
									className="hover:bg-slate-100/50"
								>
									<TableCell className="py-1.5 px-2 text-[10px] text-muted-foreground w-8">
										{rowIndex + 1}
									</TableCell>

									{COLUMNS.map((col) => {
										const value = row[col.key];
										const display =
											col.key === "amount"
												? formatAmount(value as number | null | undefined)
												: col.key === "createdAt"
													? formatDate(value as string | null | undefined)
													: (value as string | null | undefined) || "—";

										return (
											<TableCell
												key={col.key}
												className="py-1.5 px-2 text-xs"
												style={{ minWidth: col.minWidth }}
											>
												{display}
											</TableCell>
										);
									})}

									<TableCell className="py-1.5 px-2 min-w-[140px]">
										<UserDisplay user={row.user} size="sm" placeholder="—" />
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
