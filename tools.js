import { llm } from '@livekit/agents';
import { z } from 'zod';
import * as cheerio from 'cheerio';

// SARA Agent Tools

export const getWeather = llm.tool({
  name: 'get_weather',
  description: 'Get the current weather for a given city.',
  parameters: z.object({
    city: z.string().describe('The name of the city to get the weather for'),
  }),
  execute: async ({ city }) => {
    try {
      const res = await fetch(`https://wttr.in/${city}?format=3`);
      if (res.ok) {
        return await res.text();
      }
      return `Failed to get weather for ${city}: ${res.status}`;
    } catch (err) {
      return `Error retrieving weather for ${city}: ${err.message}`;
    }
  },
});

export const searchWeb = llm.tool({
  name: 'search_web',
  description: 'Search the web using DuckDuckGo.',
  parameters: z.object({
    query: z.string().describe('The search query'),
  }),
  execute: async ({ query }) => {
    try {
      const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      if (!res.ok) {
        throw new Error(`DuckDuckGo returned status ${res.status}`);
      }
      const html = await res.text();
      const $ = cheerio.load(html);
      
      const results = [];
      $('.result__body').each((i, el) => {
        if (i >= 3) return false; // Get top 3 results
        const title = $(el).find('.result__title').text().replace(/\s+/g, ' ').trim();
        const snippet = $(el).find('.result__snippet').text().replace(/\s+/g, ' ').trim();
        const url = $(el).find('.result__url').attr('href') || '';
        results.push(`${title}: ${snippet}`);
      });
      
      if (results.length === 0) {
        return `No results found for '${query}'.`;
      }
      
      return results.join('\n\n');
    } catch (err) {
      return `Error searching the web for '${query}': ${err.message}`;
    }
  },
});

export const getCurrentTime = llm.tool({
  name: 'get_current_time',
  description: 'Get the current time and date in the user\'s context.',
  parameters: z.object({}), 
  execute: async () => {
    return new Date().toString();
  }
});
