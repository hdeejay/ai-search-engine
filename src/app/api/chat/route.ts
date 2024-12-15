// TODO: Implement the chat API with Groq and web scraping with Cheerio and Puppeteer
// Refer to the Next.js Docs on how to read the Request body: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
// Refer to the Groq SDK here on how to use an LLM: https://www.npmjs.com/package/groq-sdk
// Refer to the Cheerio docs here on how to parse HTML: https://cheerio.js.org/docs/basics/loading
// Refer to Puppeteer docs here: https://pptr.dev/guides/what-is-puppeteer

import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import fetch from "node-fetch";
import { NextResponse } from "next/server";
import { getGroqResponse } from "@/app/utils/groqClient";
import { urlPattern } from "@/app/utils/scraper";
import { scrapeUrl } from "@/app/utils/scraper";
import { Console } from "console";

export async function POST(req: Request) {
  try {
    const { message, messages } = await req.json();

    console.log("message received:", message);
    console.log("messags received:", messages);
    const urlMatch = message.match(urlPattern);
    const url = urlMatch ? urlMatch[0] : null;
    let scrapedContent = "";

    if (url) {
      console.log("URL found:", url);
      const scraperResponse = await scrapeUrl(url);
      console.log("Scraped content:", scrapedContent);
      if (scraperResponse) {
        scrapedContent = scraperResponse.content;
      }
    }

    const userQuery = message.replace(url || "", "").trim();
    const userPrompt = `
    Previous conversation:
    ${messages.map(msg => `${msg.role}: ${msg.content}`).join("\n")}

    ${
      scrapedContent
        ? `
    Additional context from URL:
    <content>
    ${scrapedContent}
    </content>
    `
        : ""
    }

    Current question: "${userQuery}"
    `;

    const llmMessages = [
      ...messages.map(msg => ({
        role: msg.role === "ai" ? "assistant" : "user",
        content: msg.content,
      })),
      {
        role: "user",
        content: userPrompt,
      },
    ];

    const response = await getGroqResponse({ chatMessages: llmMessages });
    return NextResponse.json({ message: response });
  } catch (error) {
    console.error("Error in POST handler:", error);
    return NextResponse.json({
      message:
        "Sorry, I encountered an error while processing your request. Please try again.",
    });
  }
}
