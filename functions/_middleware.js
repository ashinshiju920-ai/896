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

  // Helper to attach standard production security headers
  function attachSecurityHeaders(response) {
    const headers = new Headers(response.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    if (url.protocol === 'https:') {
      headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    if (!url.pathname.startsWith('/api/')) {
      headers.set('X-Frame-Options', 'SAMEORIGIN');
      if (!headers.has('Content-Security-Policy')) {
        headers.set(
          'Content-Security-Policy',
          "default-src 'self'; script-src 'self' 'unsafe-inline' https://connect.facebook.net https://www.googletagmanager.com https://*.googletagmanager.com https://*.google-analytics.com https://sdk.cashfree.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://www.facebook.com https://www.googletagmanager.com https://*.google-analytics.com https://*.googletagmanager.com https://res.cloudinary.com https://images.unsplash.com https://api.qrserver.com; connect-src 'self' https://connect.facebook.net https://www.facebook.com https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://sandbox.cashfree.com https://api.cashfree.com https://payments.cashfree.com https://payments-test.cashfree.com https://res.cloudinary.com; frame-src 'self' https://www.googletagmanager.com https://sandbox.cashfree.com https://api.cashfree.com https://payments.cashfree.com https://payments-test.cashfree.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self';"
        );
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  // Always allow API routes to execute without bot-check interference, but attach security headers
  if (url.pathname.startsWith('/api/')) {
    const apiRes = await next();
    return attachSecurityHeaders(apiRes);
  }

  const rawUserAgent = request.headers.get('user-agent');

  // Rule 1: Block missing, empty, or whitespace-only User-Agents
  if (!rawUserAgent || !rawUserAgent.trim()) {
    return attachSecurityHeaders(
      new Response('Access Denied: Empty or missing User-Agent header.', {
        status: 403,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Robots-Tag': 'noindex, nofollow',
          'Cache-Control': 'no-store, max-age=0',
        },
      })
    );
  }

  const userAgent = rawUserAgent.toLowerCase();

  // Rule 2: Immediately allow legitimate search engine and social preview bots
  const isAllowedSearchEngine = ALLOWED_SEARCH_BOTS.some((bot) => userAgent.includes(bot));
  if (isAllowedSearchEngine) {
    const res = await next();
    return attachSecurityHeaders(res);
  }

  // Rule 3: Check against the bad-bot blocklist
  const matchedBadBot = BAD_BOTS.find((bot) => userAgent.includes(bot));
  if (matchedBadBot) {
    return attachSecurityHeaders(
      new Response('Access Denied: Automated bot scraping is prohibited on this site.', {
        status: 403,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Robots-Tag': 'noindex, nofollow',
          'X-Blocked-Bot': matchedBadBot,
          'Cache-Control': 'no-store, max-age=0',
        },
      })
    );
  }

  // Rule 4: Normal browser traffic, legitimate search engines, and requests
  // with empty/missing referrers are allowed through with security headers
  const downstream = await next();
  return attachSecurityHeaders(downstream);
}
