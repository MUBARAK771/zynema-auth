import { createBrowserClient } from 'https://esm.sh/@supabase/ssr@0.5.2';
import { CONFIG } from './config.js';

// Cookie-based storage (not localStorage) so the Next.js app on the same parent domain can read the session.
export const supabase = createBrowserClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: { flowType: 'pkce', detectSessionInUrl: false },
  cookieOptions: {
    ...(CONFIG.COOKIE_DOMAIN ? { domain: CONFIG.COOKIE_DOMAIN } : {}),
    path: '/', sameSite: 'lax', secure: location.protocol === 'https:'
  }
});
