import { NextResponse } from "next/server";
import { getSharedConversation } from "@/app/utils/redis";

export async function GET(
  request: Request,
  { params }: { params: { shareId: string } }
) {
  try {
    const messages = await getSharedConversation(params.shareId);
    
    if (!messages) {
      return NextResponse.json(
        { error: "Shared chat not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Error fetching shared chat:", error);
    return NextResponse.json(
      { error: "Failed to fetch shared chat" },
      { status: 500 }
    );
  }
} 