import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const SHARE_PREFIX = "share:";
const SHARE_TTL = 60 * 60 * 24 * 7; // 7 days

type Message = {
  role: "user" | "ai";
  content: string;
};

export async function storeSharedConversation(messages: Message[]) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("Redis configuration is missing");
  }
  
  try {
    const shareId = crypto.randomUUID();
    const key = `${SHARE_PREFIX}${shareId}`;
    
    // Ensure messages is a valid array
    if (!Array.isArray(messages)) {
      throw new Error("Invalid messages format");
    }
    
    const messageString = JSON.stringify(messages);
    
    console.log('Storing with key:', key);
    console.log('Storing messages:', messageString);
    
    await redis.set(key, messageString, { ex: SHARE_TTL });
    
    // Verify storage
    const stored = await redis.get(key);
    console.log('Verification - stored data:', stored);
    
    return shareId;
  } catch (error) {
    console.error("Redis store error:", error);
    throw new Error("Failed to store conversation");
  }
}

export async function getSharedConversation(shareId: string) {
  try {
    const key = `${SHARE_PREFIX}${shareId}`;
    console.log('Fetching key:', key);
    
    const data = await redis.get<string>(key);
    console.log('Retrieved data:', data);
    
    if (!data) {
      console.log('No data found for key:', key);
      return null;
    }
    
    // Check if data is already an object (some Redis clients automatically parse JSON)
    if (typeof data === 'object') {
      return data;
    }
    
    try {
      return JSON.parse(data);
    } catch (parseError) {
      console.error("Error parsing JSON:", parseError);
      return null;
    }
    
  } catch (error) {
    console.error("Redis get error:", error);
    return null;
  }
}
