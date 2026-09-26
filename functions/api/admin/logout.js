// functions/api/admin/logout.js
import { getCorsHeaders, handleOptions } from '../../utils/cors.js';

export async function onRequestOptions(context) {
  return handleOptions(context.request, context.env);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = getCorsHeaders(request, env);

  // Clear admin_session cookie immediately
  const cookieVal = 'admin_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';

  return new Response(
    JSON.stringify({ success: true, message: 'Logged out' }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookieVal,
        ...cors,
      },
    }
  );
}
