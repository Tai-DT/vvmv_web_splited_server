import { prismaRPA } from "@/lib/db";
import type { OrderInfo, OrderTrackingData } from "@/lib/google-sheets/types";

export async function getOrderTrackingDataFromDB(
	deliveryNumber: string,
): Promise<OrderTrackingData | null> {
	try {
		// Find all tracking records for this delivery number
		// Even if it's unique in schema for now, we write it to handle multiple
		const records = await prismaRPA.tracking.findMany({
			where: {
				deliveryNumber: deliveryNumber,
			},
			orderBy: {
				time: "asc",
			},
		});

		if (records.length === 0) {
			return null;
		}

		// Map DB records to OrderInfo format used by the frontend
		const history: OrderInfo[] = records.map((record) => ({
			deliveryNumber: record.deliveryNumber || "",
			image: record.image || "",
			time: record.time ? record.time.toLocaleString("vi-VN") : "",
			file: record.file || "",
			status: record.status || "",
			from: record.from || "",
			to: record.to || "",
			dateSend: record.dateSend ? record.dateSend.toLocaleString("vi-VN") : "",
			totalBox: record.totalBox?.toString() || "",
			weight: record.weight?.toString() || "",
			description: record.description || "",
			reciever: record.customerName || "", // Note: customerName maps to reciever in OrderInfo
		}));

		// For "order", take the first one but update status from the latest one
		// (similar to Google Sheets logic)
		const order = { ...history[0] };
		order.status = history[history.length - 1].status;

		// Additional logic from Google Sheets if needed (filling receiver/dateSend from history)
		if (!order.reciever || !order.dateSend) {
			const pickupEntry = history.find(
				(item) => item.status === "Đã lấy hàng từ nhà máy",
			);
			if (pickupEntry) {
				if (!order.reciever) order.reciever = pickupEntry.reciever;
				if (!order.dateSend) order.dateSend = pickupEntry.time;
			}
		}

		return { order, history };
	} catch (error) {
		console.error("Error fetching tracking data from DB:", error);
		throw new Error("Failed to fetch tracking data from database");
	}
}
