"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface TabConfig {
	/** Unique tab identifier (used as Tabs value) */
	id: string;
	/** Display label */
	label: string;
	/** Lucide icon component */
	icon: LucideIcon;
	/** Count shown as badge (hidden when 0) */
	count: number;
	/** Whether this tab is visible (defaults to true) */
	visible?: boolean;
	/** Tab content */
	content: ReactNode;
}

interface BaseDetailsPanelProps {
	/** Tab configurations */
	tabs: TabConfig[];
	/** Controlled active tab (from parent state) */
	activeTab?: string;
	/** Called when tab changes (syncs back to parent) */
	onTabChange?: (tab: string) => void;
}

/**
 * BaseDetailsPanel - Shared expandable row detail panel
 *
 * Renders a tabbed panel inside an expanded table row.
 * Used by both Logistics Follow-Up and Trucking Follow-Up tables.
 *
 * Supports controlled (via activeTab/onTabChange) and uncontrolled modes.
 */
export function BaseDetailsPanel({
	tabs,
	activeTab,
	onTabChange,
}: BaseDetailsPanelProps) {
	const visibleTabs = tabs.filter((tab) => tab.visible !== false);

	const [localTab, setLocalTab] = useState<string>(
		visibleTabs[0]?.id || "tasks",
	);
	const currentTab = useMemo(() => {
		const requestedTab = activeTab || localTab;
		if (visibleTabs.some((tab) => tab.id === requestedTab)) {
			return requestedTab;
		}

		return visibleTabs[0]?.id || "tasks";
	}, [activeTab, localTab, visibleTabs]);

	useEffect(() => {
		if (!activeTab && currentTab !== localTab) {
			setLocalTab(currentTab);
		}
	}, [activeTab, currentTab, localTab]);

	const handleTabChange = (value: string) => {
		if (onTabChange) {
			onTabChange(value);
		} else {
			setLocalTab(value);
		}
	};

	if (visibleTabs.length === 0) return null;

	return (
		<div className="bg-muted/30 min-w-0 w-full max-w-full border-b p-4">
			<div className="flex max-h-[min(72vh,calc(100dvh-10rem))] flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
				<Tabs
					value={currentTab}
					onValueChange={handleTabChange}
					className="flex min-h-0 w-full flex-1 flex-col gap-0"
				>
					<TabsList className="shrink-0 gap-4 overflow-x-auto overflow-y-hidden border-b border-border/60 bg-background px-4 pt-2">
						{visibleTabs.map((tab) => (
							<TabsTrigger
								key={tab.id}
								value={tab.id}
								className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-10 px-2 gap-2"
							>
								<tab.icon className="size-4" />
								<span>{tab.label}</span>
								{tab.count > 0 && (
									<Badge
										variant="secondary"
										className="ml-1 h-5 px-1.5 text-[10px]"
									>
										{tab.count}
									</Badge>
								)}
							</TabsTrigger>
						))}
					</TabsList>

					{visibleTabs.map((tab) => (
						<TabsContent
							key={tab.id}
							value={tab.id}
							className="m-0 min-h-0 flex-1 overflow-auto overscroll-contain focus-visible:ring-0 [scrollbar-gutter:stable]"
						>
							{tab.content}
						</TabsContent>
					))}
				</Tabs>
			</div>
		</div>
	);
}
