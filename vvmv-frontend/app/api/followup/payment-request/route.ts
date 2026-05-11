import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prismaRPA } from "@/lib/db";
import type { Site } from "@/prisma/client";

/**
 * GET /api/followup/payment-request?followUpId=xxx
 * List all payment requests for a logistics follow-up
 */
export async function GET(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const followUpId = searchParams.get("followUpId");

		if (!followUpId) {
			return NextResponse.json(
				{ message: "Missing followUpId" },
				{ status: 400 },
			);
		}

		const records = await prismaRPA.paymentRequest.findMany({
			where: { followUpId },
			include: {
				user: { select: { id: true, name: true, email: true } },
			},
			orderBy: { createdAt: "asc" },
		});

		return NextResponse.json(records);
	} catch (error) {
		console.error("Error fetching payment requests:", error);
		return NextResponse.json(
			{ message: "Failed to fetch payment requests" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/followup/payment-request
 * Create a new payment request for a logistics follow-up
 */
export async function POST(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const {
			followUpId,
			declarationNumber,
			taxCode,
			amount,
			authority,
			type,
			arNumber,
			notifyNumber,
		} = body;

		if (!followUpId) {
			return NextResponse.json(
				{ message: "Missing followUpId" },
				{ status: 400 },
			);
		}

		// Get domain from the parent followUp record
		const followUpRecord = await prismaRPA.followUp.findUnique({
			where: { id: followUpId },
			select: { domain: true },
		});

		if (!followUpRecord) {
			return NextResponse.json(
				{ message: "Follow-up not found" },
				{ status: 404 },
			);
		}

		const newRecord = await prismaRPA.paymentRequest.create({
			data: {
				followUpId,
				declarationNumber: declarationNumber || null,
				taxCode: taxCode || null,
				amount: amount ? Number(amount) : null,
				authority: authority || null,
				type: type || null,
				arNumber: arNumber || null,
				notifyNumber: notifyNumber || null,
				createdBy: session.user.id,
				domain: (followUpRecord.domain as Site) || undefined,
			},
			include: {
				user: { select: { id: true, name: true, email: true } },
			},
		});

		return NextResponse.json(newRecord, { status: 201 });
	} catch (error) {
		console.error("Error creating payment request:", error);
		return NextResponse.json(
			{ message: "Failed to create payment request" },
			{ status: 500 },
		);
	}
}

/**
 * PATCH /api/followup/payment-request
 * Update a payment request
 */
export async function PATCH(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const {
			id,
			declarationNumber,
			taxCode,
			amount,
			authority,
			type,
			arNumber,
			notifyNumber,
		} = body;

		if (!id) {
			return NextResponse.json({ message: "Missing id" }, { status: 400 });
		}

		const existing = await prismaRPA.paymentRequest.findUnique({
			where: { id },
		});
		if (!existing) {
			return NextResponse.json(
				{ message: "Record not found" },
				{ status: 404 },
			);
		}

		const updated = await prismaRPA.paymentRequest.update({
			where: { id },
			data: {
				declarationNumber:
					declarationNumber !== undefined
						? declarationNumber || null
						: existing.declarationNumber,
				taxCode: taxCode !== undefined ? taxCode || null : existing.taxCode,
				amount:
					amount !== undefined
						? amount
							? Number(amount)
							: null
						: existing.amount,
				authority:
					authority !== undefined ? authority || null : existing.authority,
				type: type !== undefined ? type || null : existing.type,
				arNumber: arNumber !== undefined ? arNumber || null : existing.arNumber,
				notifyNumber:
					notifyNumber !== undefined
						? notifyNumber || null
						: existing.notifyNumber,
			},
			include: {
				user: { select: { id: true, name: true, email: true } },
			},
		});

		return NextResponse.json(updated);
	} catch (error) {
		console.error("Error updating payment request:", error);
		return NextResponse.json(
			{ message: "Failed to update payment request" },
			{ status: 500 },
		);
	}
}

/**
 * DELETE /api/followup/payment-request?id=xxx
 * Delete a payment request
 */
export async function DELETE(request: NextRequest) {
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const id = searchParams.get("id");

		if (!id) {
			return NextResponse.json({ message: "Missing id" }, { status: 400 });
		}

		await prismaRPA.paymentRequest.delete({ where: { id } });

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error deleting payment request:", error);
		return NextResponse.json(
			{ message: "Failed to delete payment request" },
			{ status: 500 },
		);
	}
}
