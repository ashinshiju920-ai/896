// functions/api/download.js
// Direct storefront PDF delivery is disabled.
// Paid customers access materials through the external Aylem student portal.

import { getCorsHeaders, handleOptions } from '../utils/cors.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);
  const studentPortalUrl = (env && env.STUDENT_PORTAL_URL)
    ? String(env.STUDENT_PORTAL_URL).trim()
    : 'https://portal.aylemlearning.online/';

  return new Response(
    JSON.stringify({
      error: 'Direct PDF downloads are no longer available from this storefront.',
      message: 'Please access your purchased study materials through the Aylem Learning student portal.',
      portalUrl: studentPortalUrl,
    }),
    {
      status: 410,
      headers: {
        'Content-Type': 'application/json',
        'Location': studentPortalUrl,
        ...cors,
      },
    }
  );
}
