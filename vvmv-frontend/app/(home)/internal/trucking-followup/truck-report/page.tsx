import type { Metadata } from "next";
import TruckReportPage from "./_components/truck-report-page";

export const metadata: Metadata = {
	title: "Báo cáo Xe tài - VVMV Trucking",
	description: "Báo cáo chi tiết lô hàng xe tải, hàng lẻ (LCL), hàng AIR...",
};

export default function ReportPage() {
	return <TruckReportPage />;
}
