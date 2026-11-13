// Public client config only. NEVER put a service_role key here.
export const CONFIG = {
  SUPABASE_URL: 'https://ygjeshnrmwibheyjdypp.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_uHhrVizZowhC9T9yxpztaQ_9_5ezSZi',
  APP_URL: 'https://zynema-snowy.vercel.app',   // main Zynema app
  AUTH_URL: location.origin,                    // this auth site
  COOKIE_DOMAIN: '',                            // e.g. '.zynema.com' (required for single sign-on, see README)
  TMDB_API_KEY: '95cb28f668ffa5187508c78ad8bd16c4',
  ALLOWED_REDIRECTS: ['https://zynema-snowy.vercel.app']
};
