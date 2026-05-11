"use client";

import {
	Building2,
	Clock,
	Globe,
	Loader2,
	Mail,
	MapPin,
	MessageSquare,
	Phone,
	Printer,
	Send,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const offices = [
	{
		region: "Southern Area",
		name: "Head Office",
		address:
			"Petroland Tower, 4th Floor, 12 Tan Trao Street, Tan Phu Ward, District 7, Ho Chi Minh City, Viet Nam.",
		phone: "( +84 – 28 ) 54105410 ( 150 lines )",
		fax: "( +84 – 28 ) 54105454",
		email: "headoffice@vvmv.com.vn",
		gradient: "from-blue-600 to-cyan-500",
	},
	{
		region: "Northern Area",
		name: "Ha Noi Office",
		address:
			"C-Land Tower, 11th Floor, 156 Xa Dan II Street, Dong Da District, Ha Noi City, Viet Nam.",
		phone: "( +84 – 24 ) 39726250 ( 50 lines )",
		fax: "( +84 – 24 ) 39726257",
		email: "cshan@vvmv.com.vn",
		gradient: "from-indigo-600 to-blue-500",
	},
	{
		region: "Northern Area",
		name: "Hai Phong Office",
		address:
			"TD Business Center Building, 5th Floor, 512A 20A Le Hong Phong Street, Ngo Quyen District, Hai Phong City, Viet Nam.",
		phone: "( +84 – 225 ) 3555313 ( 5 lines )",
		fax: "( +84 – 225 ) 3555314",
		email: "haiphong@vvmv.com.vn",
		gradient: "from-purple-600 to-indigo-500",
	},
];

export default function ContactPage() {
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setIsSubmitting(true);

		const formData = new FormData(e.currentTarget);
		const data = {
			name: formData.get("name"),
			email: formData.get("email"),
			subject: formData.get("subject"),
			message: formData.get("message"),
		};

		try {
			const response = await fetch("/api/contact", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			});

			if (!response.ok) throw new Error("Failed to send message");

			toast.success("Message sent successfully!", {
				description: "We will get back to you as soon as possible.",
			});
			(e.target as HTMLFormElement).reset();
		} catch (_error) {
			toast.error("Failed to send message", {
				description: "Please try again later or call our hotline.",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

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
						<MessageSquare className="w-4 h-4" />
						<span>Get in Touch</span>
					</div>
					<h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
						Contact{" "}
						<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-300">
							Us
						</span>
					</h1>
					<p className="text-xl text-blue-200 max-w-3xl mx-auto leading-relaxed">
						Have questions or need a logistics solution? Our team is across the
						country and ready to support you.
					</p>
				</div>
			</section>

			{/* Contact Grid */}
			<section className="py-20 max-w-7xl mx-auto px-6">
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-20">
					{offices.map((office, index) => (
						<div
							key={index}
							className="flex flex-col h-full rounded-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1"
						>
							<div className={`p-6 bg-gradient-to-r ${office.gradient}`}>
								<div className="flex items-center gap-3">
									<div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
										<Building2 className="w-6 h-6 text-white" />
									</div>
									<div>
										<p className="text-sm font-medium text-white/80 uppercase tracking-wider">
											{office.region}
										</p>
										<h3 className="text-xl font-bold text-white">
											{office.name}
										</h3>
									</div>
								</div>
							</div>

							<div className="p-8 flex-1 flex flex-col gap-6">
								<div className="flex gap-4">
									<div className="p-2 h-fit rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
										<MapPin className="w-5 h-5" />
									</div>
									<p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
										{office.address}
									</p>
								</div>

								<div className="flex items-center gap-4">
									<div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
										<Phone className="w-5 h-5" />
									</div>
									<p className="text-gray-700 dark:text-gray-300 font-medium text-sm">
										{office.phone}
									</p>
								</div>

								<div className="flex items-center gap-4">
									<div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
										<Printer className="w-5 h-5" />
									</div>
									<p className="text-gray-700 dark:text-gray-300 text-sm">
										{office.fax}
									</p>
								</div>

								<div className="flex items-center gap-4">
									<div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
										<Mail className="w-5 h-5" />
									</div>
									<p className="text-blue-600 dark:text-blue-400 font-medium text-sm text-wrap break-all">
										{office.email}
									</p>
								</div>
							</div>
						</div>
					))}
				</div>

				{/* Contact Form & Hours */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-200 dark:border-gray-700 p-8 lg:p-12 shadow-2xl">
					<div>
						<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
							Send us a Message
						</h2>
						<form onSubmit={handleSubmit} className="space-y-6">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
										Your Name
									</label>
									<Input
										required
										name="name"
										placeholder="John Doe"
										className="h-12 rounded-xl bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700"
									/>
								</div>
								<div className="space-y-2">
									<label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
										Email Address
									</label>
									<Input
										required
										name="email"
										type="email"
										placeholder="john@example.com"
										className="h-12 rounded-xl bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700"
									/>
								</div>
							</div>
							<div className="space-y-2">
								<label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
									Subject
								</label>
								<Input
									required
									name="subject"
									placeholder="Inquiry about freight services"
									className="h-12 rounded-xl bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700"
								/>
							</div>
							<div className="space-y-2">
								<label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">
									Message
								</label>
								<Textarea
									required
									name="message"
									placeholder="Tell us how we can help you..."
									className="min-h-[150px] rounded-xl bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 p-4"
								/>
							</div>
							<Button
								type="submit"
								disabled={isSubmitting}
								className="w-full h-14 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold text-lg shadow-lg shadow-blue-500/25 gap-2 transition-all active:scale-[0.98] disabled:opacity-70"
							>
								{isSubmitting ? (
									<>
										<Loader2 className="w-5 h-5 animate-spin" />
										Sending...
									</>
								) : (
									<>
										Send Message
										<Send className="w-5 h-5" />
									</>
								)}
							</Button>
						</form>
					</div>

					<div className="lg:pl-12 space-y-12">
						<div>
							<h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
								Business Hours
							</h2>
							<div className="space-y-6">
								<div className="flex items-center gap-6 p-6 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
									<div className="p-4 rounded-xl bg-white dark:bg-gray-800 shadow-sm text-blue-600 dark:text-blue-400">
										<Clock className="w-8 h-8" />
									</div>
									<div>
										<h4 className="font-bold text-gray-900 dark:text-white">
											Monday - Friday
										</h4>
										<p className="text-gray-600 dark:text-gray-400">
											8:00 AM - 5:00 PM
										</p>
									</div>
								</div>
								<div className="flex items-center gap-6 p-6 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
									<div className="p-4 rounded-xl bg-white dark:bg-gray-800 shadow-sm text-blue-600 dark:text-blue-400">
										<Globe className="w-8 h-8" />
									</div>
									<div>
										<h4 className="font-bold text-gray-900 dark:text-white">
											Saturday
										</h4>
										<p className="text-gray-600 dark:text-gray-400">
											8:00 AM - 12:00 PM
										</p>
									</div>
								</div>
							</div>
						</div>

						<div className="p-8 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white relative overflow-hidden">
							<div className="relative z-10">
								<h3 className="text-xl font-bold mb-2">Need Immediate Help?</h3>
								<p className="text-blue-100 mb-6">
									Call our 24/7 hotline for urgent shipment inquiries and
									support.
								</p>
								<div className="flex items-center gap-3">
									<Phone className="w-6 h-6" />
									<span className="text-2xl font-bold underline decoration-2 underline-offset-4">
										+84 28 5410 5410
									</span>
								</div>
							</div>
							<div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}
