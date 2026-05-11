"use client";

import Link from "next/link";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { OrderInfo } from "@/lib/google-sheets";

interface HistoryTableProps {
	history: OrderInfo[];
}

export function HistoryTable({ history }: HistoryTableProps) {
	return (
		<div className="border rounded-lg overflow-hidden shadow-sm">
			<div className="bg-blue-50 dark:bg-blue-950 px-6 py-4 border-b">
				<h2 className="text-lg font-semibold">Lịch sử hành trình</h2>
				<p className="text-sm text-muted-foreground">
					Tiến trình chuyển phát được cập nhật liên tục từ hệ thống VVMV
				</p>
			</div>

			<Table>
				<TableHeader>
					<TableRow className="border-b-2 bg-muted/50 h-10">
						<TableHead className="w-3/14 font-semibold text-foreground">
							Thời gian
						</TableHead>
						<TableHead className="w-3/14 font-semibold text-foreground">
							Trạng thái
						</TableHead>
						<TableHead className="w-1/2 font-semibold text-foreground">
							Ghi chú
						</TableHead>
						<TableHead className="w-1/14 font-semibold text-foreground"></TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{history.map((item, index) => (
						<TableRow key={index}>
							<TableCell>{item.time}</TableCell>
							<TableCell>
								{item.status && (
									<div className="bg-green-500 text-white px-3 py-1 rounded text-sm font-medium w-fit">
										{item.status}
									</div>
								)}{" "}
								{item.file}
							</TableCell>
							<TableCell>{item.description}</TableCell>
							<TableCell>
								{item.image ? (
									<Link
										href={item.image}
										target="_blank"
										rel="noopener noreferrer"
										className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
									>
										Xem ảnh
									</Link>
								) : (
									"-"
								)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
