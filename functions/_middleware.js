/**
 * Cloudflare Pages Edge Middleware
 * Intercepts every incoming request to enforce bot-blocking and protect SEO ranking.
 *
 * Requirements fulfilled:
 * 1. Blocks AI scrapers, LLM training crawlers, and aggressive harvesters with HTTP 403.
 * 2. Blocks empty or missing User-Agent headers.
 * 3. Explicitly allowlists verified search engines and social sharing bots.
 * 4. Never blocks empty referrers or legitimate browser traffic.
 */

// ==============================================================================
// 1. BAD BOTS LIST (Easy to edit & customize)
// Match against lowercase User-Agent strings.
// ==============================================================================
const BAD_BOTS = [
  // AI Scrapers & LLM Crawlers
  'gptbot',                // OpenAI web crawler
  'chatgpt-user',          // OpenAI user-prompt web search
  'claudebot',             // Anthropic Claude scraper
  'claude-web',            // Anthropic Claude web client
  'anthropic-ai',          // Anthropic generic scraper
  'ccbot',                 // Common Crawl crawler
  'google-extended',       // Google Gemini/AI training scraper (distinct from Googlebot)
  'bytespider',            // ByteDance / TikTok crawler
  'perplexitybot',         // Perplexity AI web crawler
  'amazonbot',             // Amazon Alexa / AI scraper
  'cohere-ai',             // Cohere AI training crawler
  'diffbot',               // Diffbot content extractor
  'omgilibot',             // Omgili news and forum scraper
  'timpibot',              // Timpi AI web crawler
  'youbot',                // You.com AI scraper

  // Meta / Facebook Scrapers (AI / bulk scrapers, distinct from social share)
  'facebookbot',           // Meta AI / web crawler
  'meta-externalagent',    // Meta external agent
  'meta-externalfetcher',  // Meta external fetcher

  // Aggressive SEO Scrapers & Site Downloaders
  'semrushbot',            // Semrush SEO harvester
  'ahrefsbot',             // Ahrefs SEO crawler
  'mj12bot',               // Majestic-12 bot
  'dotbot',                // Moz DotBot
  'petalbot',              // Aspiegel PetalBot
  'zoominfobot',           // ZoomInfo crawler
  'scrapy',                // Python Scrapy framework
  'httptrack',             // HTTrack website copier
  'wget',                  // Wget bulk downloader
];

// ==============================================================================
// 2. VERIFIED SEARCH ENGINE & SOCIAL PREVIEW ALLOWLIST (SEO Preservation)
// If any of these match, request is passed through immediately.
// ==============================================================================
const ALLOWED_SEARCH_BOTS = [
  // Search Engine Crawlers
  'googlebot',             // Google Search indexer
  'bingbot',               // Microsoft Bing indexer
  'slurp',                 // Yahoo Search indexer
  'duckduckbot',           // DuckDuckGo crawler
  'baiduspider',           // Baidu Search crawler
  'yandex',                // Yandex Search crawler
  'sogou',                 // Sogou Search crawler
  'applebot',              // Apple Siri / Spotlight indexer

  // Social Media Link Preview Bots (For open-graph / twitter previews)
  'facebookexternalhit',   // Facebook link preview
  'twitterbot',            // Twitter / X card generator
  'linkedinbot',           // LinkedIn link preview
  'whatsapp',              // WhatsApp link preview
  'telegrambot',           // Telegram link preview
  'pinterest',             // Pinterest rich pins
  'slackbot',              // Slack unfurl preview
  'discordbot',            // Discord embed preview
];

export async function onRequest(context) {
  const { request, next } = context;

  const url = new URL(request.url);
  // Always allow API routes to execute without bot-check interference
  if (url.pathname.startsWith('/api/')) {
    return await next();
  }

  const rawUserAgent = request.headers.get('user-agent');

  // Rule 1: Block missing, empty, or whitespace-only User-Agents
  if (!rawUserAgent || !rawUserAgent.trim()) {
    return new Response('Access Denied: Empty or missing User-Agent header.', {
      status: 403,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  }

  const userAgent = rawUserAgent.toLowerCase();

  // Rule 2: Immediately allow legitimate search engine and social preview bots
  const isAllowedSearchEngine = ALLOWED_SEARCH_BOTS.some((bot) => userAgent.includes(bot));
  if (isAllowedSearchEngine) {
    return await next();
  }

  // Rule 3: Check against the bad-bot blocklist
  const matchedBadBot = BAD_BOTS.find((bot) => userAgent.includes(bot));
  if (matchedBadBot) {
    return new Response('Access Denied: Automated bot scraping is prohibited on this site.', {
      status: 403,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Blocked-Bot': matchedBadBot,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  }

  // Rule 4: Normal browser traffic, legitimate search engines, and requests
  // with empty/missing referrers are allowed through
  return await next();
}
