"use client";

import {
	ArrowRight,
	BarChart3,
	Clock,
	FileText,
	Globe,
	MapPin,
	Package,
	Shield,
	Truck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";

export default function Home() {
	const { data: session } = useSession();
	const isLoggedIn = !!session?.user;
	const isStaff =
		session?.user?.role === "STAFF" ||
		session?.user?.role === "MANAGER" ||
		session?.user?.role === "ADMIN";

	return (
		<div className="min-h-screen overflow-y-auto w-full">
			{/* Hero Section */}
			<section className="relative h-[600px] overflow-hidden">
				{/* Background Image with Overlay */}
				<div className="absolute inset-0">
					<Image
						src="/banner-default.jpg"
						alt="Logistics background"
						fill
						className="object-cover"
						priority
					/>
					<div className="absolute inset-0 bg-gradient-to-br from-blue-950/70 via-indigo-900/50 to-purple-900/30" />
					<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.1),transparent_60%)]" />
				</div>

				{/* Hero Content */}
				<div className="relative z-10 max-w-7xl mx-auto px-6 h-full flex items-center">
					<div className="max-w-2xl">
						<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-sm mb-6">
							<Globe className="w-4 h-4" />
							<span>Trusted Global Logistics Partner</span>
						</div>

						<h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
							Seamless{" "}
							<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-rose-400 animate-gradient">
								Logistics
							</span>{" "}
							Solutions
						</h1>

						<p className="text-xl text-gray-300 mb-8 leading-relaxed">
							Delivering excellence in freight forwarding, customs clearance,
							and supply chain management. Your cargo, our commitment.
						</p>

						<div className="flex flex-wrap gap-4">
							<Link href="/external/tracking">
								<Button
									size="lg"
									className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-blue-500/25 transition-all hover:scale-105 active:scale-95"
								>
									Track Shipment
									<ArrowRight className="ml-2 w-5 h-5" />
								</Button>
							</Link>
							<Link href="/vendor-portal">
								<Button
									size="lg"
									variant="outline"
									className="border-2 border-cyan-200 bg-cyan-50/90 text-cyan-700 hover:bg-cyan-100 hover:text-cyan-800 px-8 py-6 text-lg rounded-xl backdrop-blur-sm transition-all"
								>
									Vendor Cost Portal
								</Button>
							</Link>
							{!isLoggedIn && (
								<Link href="/login">
									<Button
										size="lg"
										variant="outline"
										className="border-2 border-white bg-white/10 text-white hover:bg-white hover:text-blue-600 px-8 py-6 text-lg rounded-xl backdrop-blur-sm transition-all"
									>
										Get Started
									</Button>
								</Link>
							)}
						</div>
					</div>
				</div>

				{/* Decorative Elements */}
				<div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-50 dark:from-slate-950" />
			</section>

			{/* Stats Section */}
			<section className="relative -mt-16 z-20 max-w-7xl mx-auto px-6">
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					{[
						{
							value: "15+",
							label: "Years Experience",
							icon: Clock,
							gradient: "from-blue-500 to-indigo-600",
							shadow: "shadow-blue-500/20",
							bgGradient:
								"from-blue-100/80 to-white dark:from-blue-900/30 dark:to-gray-950/80",
						},
						{
							value: "50+",
							label: "Countries Served",
							icon: Globe,
							gradient: "from-indigo-500 to-purple-600",
							shadow: "shadow-indigo-500/20",
							bgGradient:
								"from-indigo-100/80 to-white dark:from-indigo-950/20 dark:to-gray-950/80",
						},
						{
							value: "10K+",
							label: "Shipments/Year",
							icon: Package,
							gradient: "from-purple-500 to-rose-600",
							shadow: "shadow-purple-500/20",
							bgGradient:
								"from-purple-100/80 to-white dark:from-purple-950/20 dark:to-gray-950/80",
						},
						{
							value: "99%",
							label: "On-Time Delivery",
							icon: Truck,
							gradient: "from-rose-500 to-blue-600",
							shadow: "shadow-rose-500/20",
							bgGradient:
								"from-rose-100/80 to-white dark:from-blue-950/20 dark:to-gray-950/80",
						},
					].map((stat) => (
						<div
							key={stat.label}
							className={`group p-6 rounded-2xl bg-gradient-to-br ${stat.bgGradient} backdrop-blur-md shadow-xl border border-gray-200/50 dark:border-gray-700/50 hover:shadow-2xl hover:scale-105 transition-all duration-300`}
						>
							<div className="flex items-center gap-4">
								<div
									className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} text-white shadow-lg ${stat.shadow}`}
								>
									<stat.icon className="w-6 h-6" />
								</div>
								<div>
									<div className="text-3xl font-bold text-gray-900 dark:text-white">
										{stat.value}
									</div>
									<div className="text-sm text-gray-500 dark:text-gray-400">
										{stat.label}
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</section>

			{/* Services Section */}
			<section className="py-24 bg-slate-50/50 dark:bg-slate-900/20">
				<div className="max-w-7xl mx-auto px-6">
					<div className="text-center mb-16">
						<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm mb-4">
							<Package className="w-4 h-4" />
							<span>Our Services</span>
						</div>
						<h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
							Comprehensive Logistics Solutions
						</h2>
						<p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
							From freight forwarding to customs clearance, we provide
							end-to-end logistics services tailored to your needs.
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
						{[
							{
								id: "sea-freight",
								title: "Sea Freight",
								description:
									"Full container load (FCL) and less than container load (LCL) shipping solutions worldwide.",
								icon: Package,
								gradient: "from-blue-600 to-indigo-600",
								bgGradient:
									"from-blue-100/40 via-white to-white dark:from-blue-900/20 dark:via-gray-900/50 dark:to-gray-950",
								hoverShadow: "hover:shadow-blue-500/10",
							},
							{
								id: "air-freight",
								title: "Air Freight",
								description:
									"Express air cargo services for time-sensitive shipments to any destination.",
								icon: Globe,
								gradient: "from-purple-500 to-indigo-600",
								bgGradient:
									"from-purple-100/40 via-white to-white dark:from-purple-900/20 dark:via-gray-900/50 dark:to-gray-950",
								hoverShadow: "hover:shadow-purple-500/10",
							},
							{
								id: "customs-clearance",
								title: "Customs Clearance",
								description:
									"Expert customs brokerage services ensuring smooth import/export procedures.",
								icon: FileText,
								gradient: "from-indigo-600 to-rose-600",
								bgGradient:
									"from-indigo-100/40 via-white to-white dark:from-indigo-900/10 dark:via-gray-900/50 dark:to-gray-950",
								hoverShadow: "hover:shadow-indigo-500/10",
							},
							{
								id: "domestic-transport",
								title: "Domestic Transport",
								description:
									"Door-to-door delivery services across Vietnam with real-time tracking.",
								icon: Truck,
								gradient: "from-blue-500 to-purple-600",
								bgGradient:
									"from-blue-100/40 via-white to-white dark:from-blue-900/20 dark:via-gray-900/50 dark:to-gray-950",
								hoverShadow: "hover:shadow-blue-500/10",
							},
							{
								id: "warehousing",
								title: "Warehousing",
								description:
									"Modern warehouse facilities with inventory management and distribution services.",
								icon: MapPin,
								gradient: "from-blue-500 to-indigo-600",
								bgGradient:
									"from-blue-100/40 via-white to-white dark:from-blue-900/10 dark:via-gray-900/50 dark:to-gray-950",
								hoverShadow: "hover:shadow-blue-500/10",
							},
							{
								id: "supply-chain",
								title: "Supply Chain",
								description:
									"End-to-end supply chain management and consulting services.",
								icon: BarChart3,
								gradient: "from-indigo-600 to-violet-600",
								bgGradient:
									"from-indigo-100/40 via-white to-white dark:from-indigo-900/20 dark:via-gray-900/50 dark:to-gray-950",
								hoverShadow: "hover:shadow-indigo-500/10",
							},
						].map((service) => (
							<Link
								key={service.id}
								href={`/services#${service.id}`}
								className="group relative p-8 rounded-2xl bg-white dark:bg-gray-900/80 border-l-4 border-l-blue-500 border border-gray-200 dark:border-gray-700 shadow-xl shadow-blue-100/50 dark:shadow-blue-900/20 hover:shadow-2xl hover:shadow-blue-500/20 hover:border-l-purple-500 transition-all duration-300 hover:-translate-y-2 block overflow-hidden"
							>
								<div
									className={`absolute inset-0 bg-gradient-to-br ${service.bgGradient} opacity-60`}
								/>
								<div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
								<div className="relative z-10">
									<div
										className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${service.gradient} text-white mb-6 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300`}
									>
										<service.icon className="w-8 h-8" />
									</div>
									<h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
										{service.title}
									</h3>
									<p className="text-gray-600 dark:text-gray-400 leading-relaxed">
										{service.description}
									</p>
								</div>
							</Link>
						))}
					</div>
				</div>
			</section>

			{/* Features Section */}
			<section className="relative py-24 bg-slate-950 overflow-hidden">
				<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.05),transparent_70%)]" />
				<div className="max-w-7xl mx-auto px-6 relative z-10">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
						<div>
							<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-blue-300 text-sm mb-6">
								<Shield className="w-4 h-4" />
								<span>Why Choose Us</span>
							</div>
							<h2 className="text-4xl font-bold text-white mb-6">
								Your Trusted Partner in{" "}
								<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-rose-400">
									Global Trade
								</span>
							</h2>
							<p className="text-xl text-blue-200 mb-8">
								We combine industry expertise with cutting-edge technology to
								deliver exceptional logistics services.
							</p>

							<div className="space-y-6">
								{[
									{
										title: "Real-time Tracking",
										description:
											"Monitor your shipments 24/7 with our advanced tracking system",
									},
									{
										title: "Expert Team",
										description:
											"Experienced professionals dedicated to your success",
									},
									{
										title: "Global Network",
										description:
											"Extensive partner network across 50+ countries",
									},
									{
										title: "Competitive Rates",
										description: "Transparent pricing with no hidden fees",
									},
								].map((feature) => (
									<div key={feature.title} className="flex items-start gap-4">
										<div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 text-white">
											<Shield className="w-5 h-5" />
										</div>
										<div>
											<h4 className="font-semibold text-white mb-1">
												{feature.title}
											</h4>
											<p className="text-blue-200">{feature.description}</p>
										</div>
									</div>
								))}
							</div>
						</div>

						<div className="relative">
							<div className="aspect-square rounded-3xl bg-white shadow-2xl border border-gray-100 p-8 flex items-center justify-center">
								<div className="text-center">
									<Image
										src="/logo.png"
										alt="VVMV Logo"
										width={240}
										height={80}
										style={{ maxWidth: 200, width: "100%", height: "auto" }}
										className="mx-auto mb-4 block"
									/>
									<div className="text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
										Logistics Excellence
									</div>
								</div>
							</div>
							{/* Decorative circles */}
							<div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-cyan-500/30 blur-2xl" />
							<div className="absolute -bottom-8 -left-8 w-48 h-48 rounded-full bg-blue-500/30 blur-3xl" />
						</div>
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="py-24 bg-white dark:bg-slate-950">
				<div className="max-w-7xl mx-auto px-6">
					<div className="relative rounded-3xl bg-gradient-to-br from-blue-500 via-purple-400 to-rose-400 p-12 overflow-hidden shadow-2xl shadow-blue-500/20">
						<div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.2),transparent_50%)]" />
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.1),transparent_60%)]" />
						<div className="absolute inset-0 bg-gradient-to-t from-blue-800/30 to-transparent" />
						<div className="relative z-10 text-center">
							<h2 className="text-4xl font-bold text-white mb-4">
								Ready to Streamline Your Logistics?
							</h2>
							<p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
								Get in touch with our team today and discover how we can
								optimize your supply chain.
							</p>
							<div className="flex flex-wrap justify-center gap-4">
								<Link
									href={
										isLoggedIn
											? isStaff
												? "/internal/followup"
												: "/external/tracking"
											: "/login"
									}
								>
									<Button
										size="lg"
										className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-6 text-lg rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95"
									>
										{isLoggedIn ? "Go to Dashboard" : "Get Started Today"}
										<ArrowRight className="ml-2 w-5 h-5" />
									</Button>
								</Link>
							</div>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}
