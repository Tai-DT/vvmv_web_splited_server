import {
	ArrowRight,
	BarChart3,
	CheckCircle,
	Clock,
	FileText,
	Globe,
	Package,
	Plane,
	Shield,
	Ship,
	Truck,
	Users,
	Warehouse,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const services = [
	{
		id: "sea-freight",
		title: "Sea Freight",
		subtitle: "Ocean Shipping Solutions",
		description:
			"Comprehensive ocean freight services for all your shipping needs. We offer both Full Container Load (FCL) and Less than Container Load (LCL) options with competitive rates and reliable schedules.",
		icon: Ship,
		gradient: "from-blue-500 to-cyan-500",
		features: [
			"Full Container Load (FCL)",
			"Less than Container Load (LCL)",
			"Break Bulk Cargo",
			"Project Cargo",
			"Door-to-Door Service",
			"Port-to-Port Service",
		],
	},
	{
		id: "air-freight",
		title: "Air Freight",
		subtitle: "Express Air Cargo",
		description:
			"Fast and reliable air freight services for time-sensitive shipments. Our global network ensures your cargo reaches any destination quickly and safely.",
		icon: Plane,
		gradient: "from-purple-500 to-pink-500",
		features: [
			"Express Delivery",
			"Charter Services",
			"Dangerous Goods Handling",
			"Temperature-Controlled",
			"Airport-to-Airport",
			"Door-to-Door Service",
		],
	},
	{
		id: "customs-clearance",
		title: "Customs Clearance",
		subtitle: "Expert Brokerage Services",
		description:
			"Professional customs brokerage services ensuring smooth and compliant import/export procedures. Our experienced team handles all documentation and regulatory requirements.",
		icon: FileText,
		gradient: "from-orange-500 to-red-500",
		features: [
			"Import/Export Clearance",
			"Documentation Processing",
			"Tariff Classification",
			"Duty Optimization",
			"Compliance Advisory",
			"Bonded Warehouse",
		],
	},
	{
		id: "domestic-transport",
		title: "Domestic Transport",
		subtitle: "Nationwide Delivery",
		description:
			"Efficient domestic transportation services across Vietnam. From small parcels to full truckloads, we deliver your cargo safely and on time.",
		icon: Truck,
		gradient: "from-green-500 to-emerald-500",
		features: [
			"Full Truckload (FTL)",
			"Less than Truckload (LTL)",
			"Express Delivery",
			"Last Mile Delivery",
			"Real-time Tracking",
			"Proof of Delivery",
		],
	},
	{
		id: "warehousing",
		title: "Warehousing",
		subtitle: "Storage & Distribution",
		description:
			"Modern warehouse facilities with advanced inventory management systems. We provide secure storage and efficient distribution services.",
		icon: Warehouse,
		gradient: "from-amber-500 to-yellow-500",
		features: [
			"Bonded Warehousing",
			"Inventory Management",
			"Pick & Pack Services",
			"Cross-Docking",
			"Quality Control",
			"Order Fulfillment",
		],
	},
	{
		id: "supply-chain",
		title: "Supply Chain Management",
		subtitle: "End-to-End Solutions",
		description:
			"Comprehensive supply chain consulting and management services. We optimize your logistics operations for maximum efficiency and cost savings.",
		icon: BarChart3,
		gradient: "from-indigo-500 to-violet-500",
		features: [
			"Supply Chain Consulting",
			"Vendor Management",
			"Procurement Support",
			"Logistics Optimization",
			"Cost Analysis",
			"Performance Reporting",
		],
	},
];

export default function ServicesPage() {
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
						<Package className="w-4 h-4" />
						<span>Comprehensive Solutions</span>
					</div>
					<h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
						Our{" "}
						<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-300">
							Services
						</span>
					</h1>
					<p className="text-xl text-blue-200 max-w-3xl mx-auto leading-relaxed">
						From freight forwarding to supply chain management, we provide
						end-to-end logistics solutions tailored to your business needs.
					</p>
				</div>
			</section>

			{/* Services Overview */}
			<section className="py-20 max-w-7xl mx-auto px-6">
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
					{services.map((service) => (
						<a
							key={service.id}
							href={`#${service.id}`}
							className="group p-8 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-600 transition-all hover:-translate-y-1"
						>
							<div
								className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${service.gradient} text-white mb-6 shadow-lg group-hover:scale-110 transition-transform`}
							>
								<service.icon className="w-8 h-8" />
							</div>
							<h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
								{service.title}
							</h3>
							<p className="text-sm text-blue-600 dark:text-blue-400 mb-3">
								{service.subtitle}
							</p>
							<p className="text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3">
								{service.description}
							</p>
						</a>
					))}
				</div>
			</section>

			{/* Detailed Services */}
			{services.map((service, index) => (
				<section
					key={service.id}
					id={service.id}
					className={`py-20 ${
						index % 2 === 0
							? "bg-white dark:bg-gray-800"
							: "bg-gray-50 dark:bg-gray-900"
					}`}
				>
					<div className="max-w-7xl mx-auto px-6">
						<div
							className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${
								index % 2 === 1 ? "lg:flex-row-reverse" : ""
							}`}
						>
							<div className={index % 2 === 1 ? "lg:order-2" : ""}>
								<div
									className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${service.gradient} text-white mb-6 shadow-lg`}
								>
									<service.icon className="w-10 h-10" />
								</div>
								<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
									{service.title}
								</h2>
								<p className="text-lg text-blue-600 dark:text-blue-400 mb-4">
									{service.subtitle}
								</p>
								<p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed mb-8">
									{service.description}
								</p>

								<div className="grid grid-cols-2 gap-4">
									{service.features.map((feature, featureIndex) => (
										<div key={featureIndex} className="flex items-center gap-3">
											<div className="p-1 rounded-full bg-green-100 dark:bg-green-900/30">
												<CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
											</div>
											<span className="text-sm text-gray-700 dark:text-gray-300">
												{feature}
											</span>
										</div>
									))}
								</div>
							</div>

							<div className={index % 2 === 1 ? "lg:order-1" : ""}>
								<div
									className={`aspect-video rounded-2xl bg-gradient-to-br ${service.gradient} p-8 flex items-center justify-center shadow-2xl`}
								>
									<div className="text-center text-white">
										<service.icon className="w-24 h-24 mx-auto mb-4 opacity-90" />
										<div className="text-3xl font-bold">{service.title}</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>
			))}

			{/* Why Choose Us */}
			<section className="py-20 bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900">
				<div className="max-w-7xl mx-auto px-6">
					<div className="text-center mb-16">
						<h2 className="text-3xl font-bold text-white mb-4">
							Why Choose VVMV?
						</h2>
						<p className="text-xl text-blue-200 max-w-2xl mx-auto">
							We deliver exceptional logistics services with a focus on quality,
							reliability, and customer satisfaction.
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
						{[
							{
								icon: Clock,
								title: "On-Time Delivery",
								description: "99% on-time delivery rate",
							},
							{
								icon: Shield,
								title: "Secure Handling",
								description: "Full cargo insurance coverage",
							},
							{
								icon: Users,
								title: "Expert Team",
								description: "350+ experienced professionals",
							},
							{
								icon: Globe,
								title: "Global Network",
								description: "Partners in 50+ countries",
							},
						].map((item, index) => (
							<div
								key={index}
								className="p-6 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 text-center"
							>
								<div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 text-white inline-flex mb-4">
									<item.icon className="w-8 h-8" />
								</div>
								<h3 className="text-lg font-bold text-white mb-2">
									{item.title}
								</h3>
								<p className="text-blue-200">{item.description}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="py-20 bg-gradient-to-r from-blue-600 to-cyan-600">
				<div className="max-w-4xl mx-auto px-6 text-center">
					<h2 className="text-3xl font-bold text-white mb-4">
						Need a Custom Solution?
					</h2>
					<p className="text-xl text-blue-100 mb-8">
						Contact our team to discuss your specific logistics requirements
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
						<Link href="/about">
							<Button
								size="lg"
								variant="outline"
								className="border-2 border-white bg-white/10 text-white hover:bg-white hover:text-blue-600 px-8 py-6 text-lg rounded-xl backdrop-blur-sm transition-all"
							>
								Learn More About Us
							</Button>
						</Link>
					</div>
				</div>
			</section>
		</div>
	);
}
