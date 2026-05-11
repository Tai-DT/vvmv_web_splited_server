"use client";

import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrderInfo } from "@/lib/google-sheets";

interface OrderCardProps {
	order: OrderInfo;
	history: OrderInfo[];
}

function formatDeliveryDate(dateSend: string): string {
	if (!dateSend) return "";
	const date = new Date(dateSend);
	if (Number.isNaN(date.getTime())) return dateSend;
	return date.toLocaleString("vi-VN", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function extractDateOnly(dateStr: string): string {
	if (!dateStr) return "";
	const parts = dateStr.split(" ");
	// Tìm và trả về phần chứa dấu "/" (chính là ngày tháng năm), bỏ phần còn lại (giờ)
	const datePart = parts.find((part) => part.includes("/"));
	return datePart || dateStr;
}

export function OrderCard({ order, history }: OrderCardProps) {
	const lastEntry = history.length > 0 ? history[history.length - 1] : null;
	const estimatedDelivery = lastEntry?.dateSend || order.dateSend;
	const handleCopyOrderCode = () => {
		navigator.clipboard.writeText(order.deliveryNumber);
	};

	return (
		<div className="bg-blue-50 dark:bg-blue-950 border rounded-lg p-6">
			<div className="flex flex-col gap-2 mb-6 pb-4 border-b border-dashed">
				<div className="flex items-center justify-between mb-2">
					<h2 className="text-lg font-semibold">Thông tin đơn hàng</h2>
					<div className="bg-green-500 text-white px-3 py-1 rounded text-sm font-medium">
						{order.status}
					</div>
				</div>
				{/* Order Code with Copy Button */}
				<div className="flex flex-col">
					<span className="text-sm text-muted-foreground">Mã vận đơn:</span>
					<span className="text-2xl font-bold">
						{order.deliveryNumber}
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8"
							onClick={handleCopyOrderCode}
						>
							<Copy className="h-4 w-4" />
						</Button>
					</span>
				</div>
			</div>

			{/* Order Details Grid */}
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
				<span>
					<span className="text-sm text-muted-foreground">Ngày gửi hàng:</span>
					<p className="font-medium">{extractDateOnly(order.dateSend)}</p>
				</span>
				<span>
					<span className="text-sm text-muted-foreground">Người nhận:</span>
					<p className="font-medium">{order.reciever}</p>
				</span>
				<span>
					<span className="text-sm text-muted-foreground">Tỉnh đi:</span>
					<p className="font-medium">{order.from}</p>
				</span>
				<div>
					<span className="text-sm text-muted-foreground">Tỉnh đến:</span>
					<p className="font-medium">{order.to}</p>
				</div>
				<div>
					<span className="text-sm text-muted-foreground">Số kiện:</span>
					<p className="font-medium">{order.totalBox}</p>
				</div>
				<div>
					<span className="text-sm text-muted-foreground">
						Trọng lượng(kg):
					</span>
					<p className="font-medium">{order.weight}</p>
				</div>
				<div className="sm:col-span-2">
					<span className="text-sm text-muted-foreground">
						Thời gian giao hàng (dự kiến):
					</span>
					<p className="font-medium">{formatDeliveryDate(estimatedDelivery)}</p>
				</div>
			</div>
		</div>
	);
}
