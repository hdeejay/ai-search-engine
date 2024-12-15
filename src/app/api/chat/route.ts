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
import { searchWithPuppeteer } from "@/app/utils/search";

export async function POST(req: Request) {
  try {
    const { message, messages } = await req.json();

    console.log("message received:", message);
    console.log("messags received:", messages);
    const urlMatch = message.match(urlPattern);
    const url = urlMatch ? urlMatch[0] : null;
    let scrapedContent = "";
    let sources: string[] = [];

    if (url) {
      console.log("URL found:", url);
      const scraperResponse = await scrapeUrl(url);
      console.log("Scraped content:", scrapedContent);
      if (scraperResponse) {
        scrapedContent = scraperResponse.content;
        sources.push(url);
      }
    } else {
      console.log("No URL found, searching the web...");
      const searchResults = await searchWithPuppeteer(message);

      const scrapedContents = await Promise.all(
        searchResults.map(async result => {
          const scraped = await scrapeUrl(result.url);
          if (scraped) {
            sources.push(`${result.title} (${result.url})`);
            return `From ${result.title}:\n${scraped.content}`;
          }
          return null;
        })
      );

      scrapedContent = scrapedContents
        .filter(content => content !== null)
        .join("\n\n");
    }

    const userQuery = url ? message.replace(url, "").trim() : message;
    const userPrompt = `
    Previous conversation:
    ${messages.map(msg => `${msg.role}: ${msg.content}`).join("\n")}

    ${
      scrapedContent
        ? `
    Additional context from ${sources.length} sources:
    <content>
    ${scrapedContent}
    </content>

    Sources:
    ${sources.join("\n")}
    `
        : ""
    }

    Current question: "${userQuery}"
    
    Please provide a comprehensive answer based on the available context. If using information from the sources, please cite them.
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

    const response = await getGroqResponse({
      chatMessages: llmMessages,
      hasUrl: !!url,
    });
    return NextResponse.json({ message: response });
  } catch (error) {
    console.error("Error in POST handler:", error);
    return NextResponse.json({
      message:
        "Sorry, I encountered an error while processing your request. Please try again.",
    });
  }
}
