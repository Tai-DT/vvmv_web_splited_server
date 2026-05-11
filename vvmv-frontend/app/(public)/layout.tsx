import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export default function PublicLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
			<Header />
			<main className="flex-1">{children}</main>
			<Footer />
		</div>
	);
}
