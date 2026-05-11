import DeclarationReportPage from "./_components/declaration-report-page";

export const dynamic = "force-dynamic";

export const metadata = {
	title: "Báo cáo Tờ khai | VVMV",
	description: "Báo cáo tờ khai Logistics theo từng khai báo hải quan",
};

export default function ReportPage() {
	return <DeclarationReportPage />;
}
