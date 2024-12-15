import puppeteer from 'puppeteer';
import { Logger } from './logger';

const logger = new Logger('search');

interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

export async function searchWithPuppeteer(query: string): Promise<SearchResult[]> {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Set a custom user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Navigate to Google
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`, {
      waitUntil: 'networkidle0'
    });

    // Extract search results
    const results = await page.evaluate(() => {
      const searchResults: SearchResult[] = [];
      
      // Select all search result divs
      const resultDivs = document.querySelectorAll('div.g');
      
      resultDivs.forEach((div) => {
        const titleElement = div.querySelector('h3');
        const linkElement = div.querySelector('a');
        const snippetElement = div.querySelector('div.VwiC3b');
        
        if (titleElement && linkElement && snippetElement) {
          searchResults.push({
            title: titleElement.textContent || '',
            url: linkElement.getAttribute('href') || '',
            snippet: snippetElement.textContent || ''
          });
        }
      });

      return searchResults.slice(0, 3); // Only return top 3 results
    });

    logger.info(`Found ${results.length} search results for query: ${query}`);
    return results;

  } catch (error) {
    logger.error('Error during search:', error);
    return [];
  } finally {
    await browser.close();
  }
}
