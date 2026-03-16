import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  const { id } = await params;

  try {
    const operation = await db.operation.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            user: true,
          },
        },
        list: {
          select: { id: true, name: true },
        },
      },
    });

    if (!operation) {
      return NextResponse.json(
        { error: "Operation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(operation);
  } catch (error) {
    console.error("Failed to fetch operation:", error);
    return NextResponse.json(
      { error: "Failed to fetch operation" },
      { status: 500 }
    );
  }
}
