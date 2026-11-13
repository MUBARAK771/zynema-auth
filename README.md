# Zynema Auth

Static site (HTML/CSS/vanilla JS) on Supabase Auth with PKCE. No build step.

## 1. Supabase setup
1. Authentication → Providers → Email: enable, turn **Confirm email** ON.
2. Authentication → URL Configuration:
   - Site URL: your auth site URL
   - Redirect URLs: `https://AUTH_SITE/callback.html**`, `https://zynema-snowy.vercel.app/auth/callback`, plus `http://localhost:3000/**` for dev.
3. Put `SUPABASE_URL` and the **anon** key in `js/config.js` (public values; never the service_role key).
4. Optional profile table with RLS:
```sql
create table public.profiles (id uuid primary key references auth.users on delete cascade, full_name text, avatar_url text, updated_at timestamptz default now());
alter table public.profiles enable row level security;
create policy "own read"   on public.profiles for select using (auth.uid() = id);
create policy "own update" on public.profiles for update using (auth.uid() = id);
create function public.new_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(id, full_name) values (new.id, new.raw_user_meta_data->>'full_name'); return new; end $$;
create trigger on_signup after insert on auth.users for each row execute function public.new_profile();
```

## 2. Single sign-on (read this)
Browsers do not share cookies or localStorage between different sites. `*.vercel.app` is a public suffix, so
`zynema-auth.vercel.app` and `zynema-snowy.vercel.app` **cannot** share a session cookie.

Working setup: put both apps on subdomains of one domain you own, e.g. `auth.zynema.com` and `app.zynema.com`, then set
`COOKIE_DOMAIN: '.zynema.com'` in `js/config.js` and update `APP_URL` and `ALLOWED_REDIRECTS`.
The auth site writes the Supabase session to a cookie on `.zynema.com`; the Next.js app reads it server-side through `@supabase/ssr`.
Tokens are never put in URLs.

## 3. Main Next.js app (App Router)
`npm i @supabase/ssr @supabase/supabase-js`, env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_AUTH_URL`.

`middleware.ts`
```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => { list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, { ...options, httpOnly: true, secure: true, domain: process.env.COOKIE_DOMAIN })); },
    },
  });
  const { data: { user } } = await supabase.auth.getUser(); // verified with Supabase, not just decoded
  if (!user) {
    const to = new URL('/login.html', process.env.NEXT_PUBLIC_AUTH_URL!);
    to.searchParams.set('next', req.nextUrl.href);
    return NextResponse.redirect(to);
  }
  return res;
}
export const config = { matcher: ['/((?!auth/callback|_next/static|_next/image|favicon.ico|privacy|terms).*)'] };
```
`app/auth/callback/route.ts` (optional; handles codes if you point email links at the main app)
```ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const safe = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  if (code) {
    const jar = await cookies();
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: { getAll: () => jar.getAll(), setAll: (l) => l.forEach(({ name, value, options }) => jar.set(name, value, options)) },
    });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(origin + safe);
  }
  return NextResponse.redirect(process.env.NEXT_PUBLIC_AUTH_URL + '/login.html');
}
```
Add a logout route calling `supabase.auth.signOut()` and redirecting to the auth site.

## 4. Deploy (Vercel)
Import this folder as a project, framework preset "Other", no build command, output directory `.`. Add the custom domain, then update Supabase redirect URLs.

## Notes
- Poster showcase loads weekly trending movie posters from TMDB. The TMDB API key in `js/config.js` is visible to visitors because this is a static site; use a server-side proxy if the key must remain private. TMDB attribution is shown below the posters.
- Footer Privacy/Terms point to `APP_URL/privacy` and `/terms`; make sure those pages exist. Replace `support@zynema.com`.
- "Remember me" stores only the email on this device; session length is set in Supabase (Auth → Sessions).
