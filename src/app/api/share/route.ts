import { NextResponse } from "next/server";
import { storeSharedConversation } from "@/app/utils/redis";

export async function POST(req: Request) {
  try {
    console.log("Share API called");
    const { messages } = await req.json();
    
    // Validate messages format
    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      );
    }
    
    // Validate each message
    const isValidMessages = messages.every(msg => 
      msg && 
      typeof msg === 'object' && 
      ('role' in msg) && 
      ('content' in msg) &&
      (msg.role === 'user' || msg.role === 'ai') &&
      typeof msg.content === 'string'
    );
    
    if (!isValidMessages) {
      return NextResponse.json(
        { error: "Invalid message format" },
        { status: 400 }
      );
    }

    console.log("Messages received:", messages);
    const shareId = await storeSharedConversation(messages);
    console.log("Share ID generated:", shareId);

    return NextResponse.json({ shareId });
  } catch (error) {
    console.error("Share creation error:", error);
    return NextResponse.json(
      { error: "Failed to create share link", details: error.message },
      { status: 500 }
    );
  }
}
