import capiParamBuilder from 'capi-param-builder-nodejs';

const { ParamBuilder, PlainDataObject, PII_DATA_TYPE } = capiParamBuilder;

const DEFAULT_DOMAIN = 'aylemlearning.online';
const CLIENT_IP_COOKIE = '_fbi';
const PUBLIC_SUFFIX_HINTS = new Set(['co', 'com', 'net', 'org', 'ac', 'edu', 'gov']);

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    String(cookieHeader || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf('=');
        if (idx === -1) return [part, ''];
        return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
      })
  );
}

function getRegistrableDomain(hostname) {
  const host = cleanString(hostname).toLowerCase();
  if (!host || host === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) {
    return host || DEFAULT_DOMAIN;
  }

  const parts = host.split('.').filter(Boolean);
  if (parts.length <= 2) return host;

  const [secondLevel] = parts.slice(-2, -1);
  const suffixSize = PUBLIC_SUFFIX_HINTS.has(secondLevel) ? 3 : 2;
  return parts.slice(-suffixSize).join('.');
}

function getForwardedScheme(request, url) {
  return (
    cleanString(request.headers.get('x-forwarded-proto')) ||
    cleanString(request.headers.get('cf-visitor')).match(/"scheme":"([^"]+)"/)?.[1] ||
    url.protocol.replace(':', '') ||
    'https'
  );
}

function toPlainDataObject(request) {
  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());
  const cookies = parseCookies(request.headers.get('cookie') || '');
  const forwardedFor = cleanString(request.headers.get('x-forwarded-for'));
  const cfIp = cleanString(request.headers.get('cf-connecting-ip'));

  return new PlainDataObject(
    request.headers.get('host') || url.host,
    queryParams,
    cookies,
    request.headers.get('referer') || null,
    forwardedFor || cfIp || null,
    cfIp || null,
    getForwardedScheme(request, url),
    `${url.pathname}${url.search}`
  );
}

export function createMetaParamContext(request) {
  if (!request) {
    return {
      builder: new ParamBuilder([DEFAULT_DOMAIN]),
      cookiesToSet: [],
    };
  }

  const url = new URL(request.url);
  const domain = getRegistrableDomain(url.hostname);
  const builder = new ParamBuilder([domain, DEFAULT_DOMAIN, 'localhost']);
  const cookiesToSet = builder.processRequestFromContext(toPlainDataObject(request));

  return { builder, cookiesToSet, domain };
}

export function appendParamBuilderCookies(headers, cookiesToSet = []) {
  for (const cookie of cookiesToSet) {
    if (!cookie?.name || !cookie?.value) continue;

    const parts = [
      `${cookie.name}=${encodeURIComponent(cookie.value)}`,
      `Max-Age=${Number(cookie.maxAge || 0)}`,
      'Path=/',
      'SameSite=Lax',
    ];

    if (cookie.domain && cookie.domain !== 'localhost') {
      parts.push(`Domain=${cookie.domain}`);
    }

    parts.push('Secure');
    headers.append('Set-Cookie', parts.join('; '));
  }
}

export function getClientIpFromBuilderOrCookie(builder, request) {
  const clientIp = cleanString(builder?.getClientIpAddress?.());
  if (clientIp) return clientIp;

  const cookies = request ? parseCookies(request.headers.get('cookie') || '') : {};
  return cleanString(cookies[CLIENT_IP_COOKIE]);
}

export function getNormalizedAndHashedPII(builder, value, dataType) {
  const clean = cleanString(value);
  if (!clean || !builder?.getNormalizedAndHashedPII) return null;
  return builder.getNormalizedAndHashedPII(clean, dataType);
}

export { PII_DATA_TYPE };
