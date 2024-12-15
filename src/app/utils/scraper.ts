import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";
import { Logger } from "./logger";
import { Redis } from "@upstash/redis";

type Message = {
  role: "user" | "ai";
  content: string;
};

export interface ScrapedContent {
  title: string;
  content: string;
  url: string;
}

const logger = new Logger("scraper");

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const CACHE_TTL = 7 * (24 * 60 * 60); // Cache time-to-live in seconds
const MAX_CACHE_SIZE = 1024000; // 1MB limit for cached content

export const urlPattern =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

// List of domains that require Puppeteer for dynamic content
const DYNAMIC_CONTENT_DOMAINS = [
  'twitter.com',
  'x.com',
  'instagram.com',
  'facebook.com',
  'linkedin.com',
  'reddit.com',
  'spa.com', // Example SPA domain
  // Add more domains that typically need JavaScript rendering
];

// Function to clean text content
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\n+/g, " ")
    .trim();
}

// Function to determine if URL needs Puppeteer
function needsPuppeteer(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return DYNAMIC_CONTENT_DOMAINS.some(domain => 
      urlObj.hostname.includes(domain)
    );
  } catch {
    return false;
  }
}

// Cheerio scraping for static content
async function scrapeWithCheerio(url: string): Promise<ScrapedContent> {
  try {
    logger.info(`Scraping with Cheerio: ${url}`);
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    // Remove unwanted elements
    $('script, style, noscript, iframe, nav, footer, header, aside').remove();

    const title = $('title').text() || '';
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const h1 = $('h1').first().text() || '';
    
    // Get main content
    let mainContent = '';
    $('article, main, .content, .main, #main, #content').each((_, element) => {
      mainContent += $(element).text() + ' ';
    });

    // If no main content found, get body content
    if (!mainContent.trim()) {
      mainContent = $('body').text();
    }

    const content = cleanText(`${title} ${h1} ${metaDescription} ${mainContent}`);

    return {
      title,
      content,
      url,
    };
  } catch (error) {
    logger.error('Error scraping with Cheerio:', error);
    throw error;
  }
}

// Puppeteer scraping for dynamic content
async function scrapeWithPuppeteer(url: string): Promise<ScrapedContent> {
  let browser;
  try {
    logger.info(`Scraping with Puppeteer: ${url}`);
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    // Extract content
    const content = await page.evaluate(() => {
      // Remove unwanted elements
      const elementsToRemove = document.querySelectorAll(
        'script, style, noscript, iframe, nav, footer, header, aside'
      );
      elementsToRemove.forEach(el => el.remove());

      const title = document.title;
      const h1 = document.querySelector('h1')?.textContent || '';
      const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
      
      // Get main content
      const mainElements = document.querySelectorAll('article, main, .content, .main, #main, #content');
      let mainContent = '';
      mainElements.forEach(el => {
        mainContent += el.textContent + ' ';
      });

      // If no main content found, get body content
      if (!mainContent.trim()) {
        mainContent = document.body.textContent || '';
      }

      return {
        title,
        content: `${title} ${h1} ${metaDescription} ${mainContent}`,
      };
    });

    return {
      title: content.title,
      content: cleanText(content.content),
      url,
    };
  } catch (error) {
    logger.error('Error scraping with Puppeteer:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Main scraping function
export async function scrapeUrl(url: string): Promise<ScrapedContent | null> {
  try {
    // Check cache first
    const cachedContent = await redis.get<ScrapedContent>(url);
    if (cachedContent) {
      logger.info(`Retrieved from cache: ${url}`);
      return cachedContent;
    }

    // Determine scraping method and execute
    const content = needsPuppeteer(url) 
      ? await scrapeWithPuppeteer(url)
      : await scrapeWithCheerio(url);

    // Cache the result if it's not too large
    if (JSON.stringify(content).length <= MAX_CACHE_SIZE) {
      await redis.set(url, content, { ex: CACHE_TTL });
    }

    return content;
  } catch (error) {
    logger.error(`Failed to scrape URL: ${url}`, error);
    return null;
  }
}

// Function to create shareable link (implementation remains the same)
export async function createShareableLink(sessionId: string): Promise<string> {
  // Implementation...
  return sessionId;
}


