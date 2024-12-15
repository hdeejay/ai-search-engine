import { Redis } from "@upstash/redis";
import { Logger } from "./logger";

const logger = new Logger("conversation");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Add this verification
if (
  !process.env.UPSTASH_REDIS_REST_URL ||
  !process.env.UPSTASH_REDIS_REST_TOKEN
) {
  console.error("Missing Redis credentials");
}

export type Message = {
  role: "user" | "ai";
  content: string;
};

export async function saveConversation(id: string, messages: Message[]) {
  try {
    logger.info(`Saving conversation with ID: ${id}`);
    await redis.set(`conversation:${id}`, JSON.stringify(messages));
    await redis.expire(`conversation:${id}`, 7 * 24 * 60 * 60); // 7 days
    return true;
  } catch (error) {
    logger.error(`Failed to save conversation ${id}:`, error);
    return false;
  }
}

export async function getConversation(id: string): Promise<Message[] | null> {
  try {
    const data = await redis.get(`conversation:${id}`);
    if (!data) return null;

    return typeof data === "string" ? JSON.parse(data) : data;
  } catch (error) {
    logger.error(`Failed to get conversation ${id}:`, error);
    return null;
  }
}
