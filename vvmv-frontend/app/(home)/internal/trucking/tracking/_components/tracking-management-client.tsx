"use client";

import dynamic from "next/dynamic";

const TrackingEditor = dynamic(
	() => import("./tracking-editor").then((mod) => mod.TrackingEditor),
	{ ssr: false },
);

export function TrackingManagementClient() {
	return <TrackingEditor />;
}
