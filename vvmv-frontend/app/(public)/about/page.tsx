import {
	ArrowRight,
	Banknote,
	Building2,
	CheckCircle,
	Clock,
	Flag,
	Globe,
	MapPin,
	Phone,
	Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AboutPage() {
	return (
		<div className="min-h-screen overflow-y-auto">
			{/* Hero Section */}
			<section className="relative py-24 bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 overflow-hidden">
				{/* Background decorations */}
				<div className="absolute inset-0 opacity-10">
					<div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
					<div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-cyan-400/20 blur-3xl" />
				</div>

				<div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
					<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-blue-300 text-sm mb-6">
						<Building2 className="w-4 h-4" />
						<span>Since 2007</span>
					</div>
					<h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
						About{" "}
						<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-300">
							VVMV JSC
						</span>
					</h1>
					<p className="text-xl text-blue-200 max-w-3xl mx-auto leading-relaxed">
						Started in 2007 and based in Ho Chi Minh City. VVMV JSC is a trusted
						companion to foreign direct investment (FDI) enterprises in Vietnam
						that clears, ships, and delivers cargoes between the S-shaped
						country and the world.
					</p>
				</div>
			</section>

			{/* Description Section */}
			<section className="py-20 max-w-7xl mx-auto px-6">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
					<div>
						<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
							Your Trusted Logistics Partner
						</h2>
						<p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
							Whether it&apos;s a 1 CBM ocean shipment from Ho Chi Minh City to
							Tokyo or a whole factory relocation project from overseas to
							Vietnam, VVMV JSC is the easiest &quot;Made in Vietnam&quot; way
							to smooth out the process.
						</p>
						<div className="space-y-4">
							{[
								"Comprehensive freight forwarding services",
								"Expert customs clearance solutions",
								"Door-to-door delivery nationwide",
								"Factory relocation projects",
								"Supply chain management",
							].map((item, index) => (
								<div key={index} className="flex items-center gap-3">
									<div className="p-1 rounded-full bg-green-100 dark:bg-green-900/30">
										<CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
									</div>
									<span className="text-gray-700 dark:text-gray-300">
										{item}
									</span>
								</div>
							))}
						</div>
					</div>

					<div className="relative">
						<div className="aspect-video rounded-3xl bg-white shadow-2xl border border-gray-100 p-12 flex items-center justify-center overflow-hidden group">
							{/* Decorative background for logo */}
							<div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-cyan-50 opacity-50 group-hover:opacity-80 transition-opacity" />

							<div className="relative z-10 text-center">
								<div className="mx-auto mb-6 inline-block transition-transform duration-500 group-hover:scale-110">
									<Image
										src="/logo.png"
										alt="VVMV Logo"
										width={240}
										height={80}
										style={{ maxWidth: 200, width: "100%", height: "auto" }}
										className="block"
									/>
								</div>
								<div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
									Made in Vietnam
								</div>
								<div className="text-sm text-gray-400 mt-2 font-medium tracking-widest uppercase">
									Logistics Excellence
								</div>
							</div>

							{/* Decorative elements */}
							<div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-blue-400/10 blur-3xl group-hover:bg-blue-400/20 transition-all" />
							<div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-cyan-400/10 blur-3xl group-hover:bg-cyan-400/20 transition-all" />
						</div>
					</div>
				</div>
			</section>

			{/* Key Figures Section */}
			<section className="py-20 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-gray-800 dark:to-gray-900">
				<div className="max-w-7xl mx-auto px-6">
					<div className="text-center mb-16">
						<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
							Key Figures
						</h2>
						<p className="text-lg text-gray-600 dark:text-gray-400">
							Numbers that define our journey and commitment
						</p>
					</div>

					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
						{[
							{
								value: "2007",
								label: "Year Founded",
								icon: Flag,
								color: "from-red-500 to-orange-500",
							},
							{
								value: "350+",
								label: "Staff Members",
								icon: Users,
								color: "from-blue-500 to-indigo-500",
							},
							{
								value: "100%",
								label: "Vietnamese Owned",
								icon: Globe,
								color: "from-green-500 to-emerald-500",
							},
							{
								value: "14",
								label: "Offices Nationwide",
								icon: Building2,
								color: "from-purple-500 to-pink-500",
							},
							{
								value: "72B VND",
								label: "Legal Capital",
								sublabel: "(3.5M USD)",
								icon: Banknote,
								color: "from-amber-500 to-yellow-500",
							},
						].map((stat, index) => (
							<div
								key={index}
								className="group p-6 rounded-2xl bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all hover:-translate-y-1 text-center"
							>
								<div
									className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${stat.color} text-white mb-4 shadow-lg`}
								>
									<stat.icon className="w-8 h-8" />
								</div>
								<div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
									{stat.value}
								</div>
								<div className="text-sm text-gray-600 dark:text-gray-400">
									{stat.label}
								</div>
								{stat.sublabel && (
									<div className="text-xs text-gray-500">{stat.sublabel}</div>
								)}
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Office Locations Section */}
			<section className="py-20 max-w-7xl mx-auto px-6">
				<div className="text-center mb-16">
					<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
						Our Offices
					</h2>
					<p className="text-lg text-gray-600 dark:text-gray-400">
						Strategically located to serve you better
					</p>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					{/* Southern Area */}
					<div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl">
						<div className="bg-gradient-to-r from-red-500 to-orange-500 p-6">
							<div className="flex items-center gap-3">
								<div className="p-3 bg-white/20 rounded-xl">
									<MapPin className="w-6 h-6 text-white" />
								</div>
								<div>
									<h3 className="text-xl font-bold text-white">
										Southern Area
									</h3>
									<p className="text-red-100">Head Office</p>
								</div>
							</div>
						</div>

						<div className="p-6 space-y-4">
							<div className="flex items-start gap-4">
								<div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
									<Phone className="w-5 h-5 text-red-600 dark:text-red-400" />
								</div>
								<div>
									<p className="text-sm text-gray-500 dark:text-gray-400">
										Contact
									</p>
									<p className="font-semibold text-gray-900 dark:text-white">
										+84 28 5410 5410
									</p>
									<p className="text-sm text-gray-600 dark:text-gray-400">
										Ho Chi Minh City
									</p>
								</div>
							</div>

							<div className="flex items-start gap-4">
								<div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
									<Building2 className="w-5 h-5 text-red-600 dark:text-red-400" />
								</div>
								<div>
									<p className="text-sm text-gray-500 dark:text-gray-400">
										Address
									</p>
									<p className="font-medium text-gray-900 dark:text-white">
										Petroland Tower, 4th Floor
									</p>
									<p className="text-sm text-gray-600 dark:text-gray-400">
										12 Tan Trao Street, Tan Phu Ward, District 7, Ho Chi Minh
										City, Vietnam
									</p>
								</div>
							</div>
						</div>
					</div>

					{/* Northern Area */}
					<div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl">
						<div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-6">
							<div className="flex items-center gap-3">
								<div className="p-3 bg-white/20 rounded-xl">
									<MapPin className="w-6 h-6 text-white" />
								</div>
								<div>
									<h3 className="text-xl font-bold text-white">
										Northern Area
									</h3>
									<p className="text-blue-100">Hanoi Office</p>
								</div>
							</div>
						</div>

						<div className="p-6 space-y-4">
							<div className="flex items-start gap-4">
								<div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
									<Phone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
								</div>
								<div>
									<p className="text-sm text-gray-500 dark:text-gray-400">
										Contact
									</p>
									<p className="font-semibold text-gray-900 dark:text-white">
										+84 24 3972 6250
									</p>
									<p className="text-sm text-gray-600 dark:text-gray-400">
										Ha Noi
									</p>
								</div>
							</div>

							<div className="flex items-start gap-4">
								<div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
									<Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
								</div>
								<div>
									<p className="text-sm text-gray-500 dark:text-gray-400">
										Address
									</p>
									<p className="font-medium text-gray-900 dark:text-white">
										C-Land Tower, 11th Floor
									</p>
									<p className="text-sm text-gray-600 dark:text-gray-400">
										156 Xa Dan II Street, Dong Da District, Hanoi City, Vietnam
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Office Hours */}
				<div className="mt-12 p-8 rounded-2xl bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-800/50 border border-gray-200 dark:border-gray-700">
					<div className="flex flex-col md:flex-row items-center justify-between gap-6">
						<div className="flex items-center gap-4">
							<div className="p-4 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 text-white">
								<Clock className="w-8 h-8" />
							</div>
							<div>
								<h3 className="text-xl font-bold text-gray-900 dark:text-white">
									Office Hours
								</h3>
								<p className="text-gray-600 dark:text-gray-400">
									We&apos;re here to help
								</p>
							</div>
						</div>

						<div className="flex flex-wrap gap-6 text-center md:text-left">
							<div className="px-6 py-3 rounded-xl bg-white dark:bg-gray-700 shadow">
								<p className="font-semibold text-gray-900 dark:text-white">
									Monday - Friday
								</p>
								<p className="text-sm text-gray-600 dark:text-gray-400">
									8:00 AM - 5:00 PM
								</p>
							</div>
							<div className="px-6 py-3 rounded-xl bg-white dark:bg-gray-700 shadow">
								<p className="font-semibold text-gray-900 dark:text-white">
									Saturday
								</p>
								<p className="text-sm text-gray-600 dark:text-gray-400">
									8:00 AM - 12:00 PM
								</p>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="py-20 bg-gradient-to-r from-blue-600 to-cyan-600">
				<div className="max-w-4xl mx-auto px-6 text-center">
					<h2 className="text-3xl font-bold text-white mb-4">
						Ready to Ship with Us?
					</h2>
					<p className="text-xl text-blue-100 mb-8">
						Contact our team today and experience the VVMV difference
					</p>
					<div className="flex flex-wrap justify-center gap-4">
						<Link href="/external/tracking">
							<Button
								size="lg"
								className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-6 text-lg rounded-xl"
							>
								Track Shipment
								<ArrowRight className="ml-2 w-5 h-5" />
							</Button>
						</Link>
						<Link href="/login">
							<Button
								size="lg"
								variant="outline"
								className="border-2 border-white bg-white/10 text-white hover:bg-white hover:text-blue-600 px-8 py-6 text-lg rounded-xl backdrop-blur-sm transition-all"
							>
								Get Started
							</Button>
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
}
