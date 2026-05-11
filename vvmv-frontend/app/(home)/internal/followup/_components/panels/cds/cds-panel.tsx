// cds-panel.tsx – reusable component for rendering a CDS info tab

"use client";

import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CdsInfoTabConfig } from "./cds-types";

/**
 * Lightweight fallback renderer used by extracted CDS tab configs.
 * The production CDS screen renders specialized controls elsewhere.
 */
export function CdsInfoTabPanel({ config }: { config: CdsInfoTabConfig }) {
	return (
		<Tabs defaultValue={config.sections[0]?.title ?? ""} className="w-full">
			<TabsList className="grid w-full grid-cols-2">
				{config.sections.map((section) => (
					<TabsTrigger key={section.title} value={section.title}>
						{section.title}
					</TabsTrigger>
				))}
			</TabsList>
			{config.sections.map((section) => (
				<TabsContent
					key={section.title}
					value={section.title}
					className="space-y-4"
				>
					<h3 className="text-lg font-medium">{section.title}</h3>
					{section.fields.map((field) => {
						const fieldId = `${section.title}-${String(field.key)}`;

						return (
							<label
								key={String(field.key)}
								htmlFor={fieldId}
								className="flex flex-col space-y-1"
							>
								<span className="text-sm font-medium">
									{field.label ?? String(field.key)}
								</span>
								<Input
									id={fieldId}
									placeholder={field.label ?? String(field.key)}
									disabled={field.disabled}
								/>
							</label>
						);
					})}
				</TabsContent>
			))}
		</Tabs>
	);
}
