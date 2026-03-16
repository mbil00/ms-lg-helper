import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  forbiddenResponse,
  getAuthenticatedUser,
  unauthorizedResponse,
  userIsAdmin,
} from "@/lib/auth-guard";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();
  if (!userIsAdmin(user)) return forbiddenResponse();

  try {
    const lists = await db.userList.findMany({
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(lists);
  } catch (error) {
    console.error("Failed to fetch lists:", error);
    return NextResponse.json(
      { error: "Failed to fetch lists" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();
  if (!userIsAdmin(user)) return forbiddenResponse();

  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const list = await db.userList.create({
      data: {
        name,
        description: description || null,
        createdBy: user.upn!,
      },
    });

    return NextResponse.json(list, { status: 201 });
  } catch (error) {
    console.error("Failed to create list:", error);
    return NextResponse.json(
      { error: "Failed to create list" },
      { status: 500 }
    );
  }
}
