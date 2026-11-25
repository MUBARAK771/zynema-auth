# Zynema Auth

Static site (HTML/CSS/vanilla JS) on Supabase Auth with PKCE. No build step.

## 1. Supabase setup
1. Authentication → Providers → Email: enable, turn **Confirm email** ON.
2. Authentication → URL Configuration:
   - Site URL: `https://www.zynema-app.online`.
   - Redirect URLs: add `https://www.zynema-app.online/callback.html?type=signup` and `https://www.zynema-app.online/callback.html?type=recovery`, plus `http://127.0.0.1:5500/callback.html`, and `http://localhost:5500/callback.html`. Add `http://localhost:3000/callback.html` only if that is also a local development URL you use.
   - Add `https://zynema-snowy.vercel.app/auth/callback` only if the Watch app implements that callback itself.
3. Authentication → Email Templates → Confirm signup: use Supabase's confirmation URL, which honors the `emailRedirectTo` callback sent by the signup code:
   ```html
   <a href="{{ .ConfirmationURL }}">Confirm your email</a>
   ```
   Do not hardcode `127.0.0.1` or link directly to `{{ .SiteURL }}` in this template. In Authentication → Email Templates → Reset Password, also use `{{ .ConfirmationURL }}`; the code requests `https://www.zynema-app.online/callback.html?type=recovery`. PKCE confirmation links must be opened in the same browser profile that started signup. After signup confirmation, the callback clears its temporary Supabase session and sends the user to `https://www.zynema-app.online/login.html` to sign in manually. Password-recovery links continue to the reset-password page.
4. Put `SUPABASE_URL` and the **anon** key in `js/config.js` (public values; never the service_role key).
5. Optional profile table with RLS:
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
The auth site and dashboard use separate browser origins and do not share browser storage. The dashboard's handoff accepts the sign-in form POST and establishes its own server-side session cookie; access and refresh tokens are sent in the POST body, never in redirect URLs. The auth callback is reserved for email confirmation and password recovery.

For seamless sign-on, put both apps on subdomains of a domain you own (for example `auth.zynema.com` and `app.zynema.com`), then configure both apps to use that shared parent cookie domain and implement cookie handling with `@supabase/ssr`. A custom domain is required; Vercel's `*.vercel.app` hostnames cannot share a parent-domain cookie. Otherwise, users need to sign in separately on each website.

## 3. Main Next.js app (App Router)
The cookie-reading middleware below is for the shared-cookie setup only. Without shared-cookie configuration, it will not see the auth site's session; use the dashboard handoff flow or configure shared cookies on subdomains of a domain you own.

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

## 5. Production authentication smoke test
1. Deploy this auth project to `https://www.zynema-app.online` and confirm `https://www.zynema-app.online/callback.html` loads directly.
2. Update the Supabase Site URL, redirect allowlist, and confirmation/recovery email templates as described above.
3. Sign up with a new email address. Open the newest confirmation email in the same browser profile and verify its link opens `www.zynema-app.online/callback.html`, never a localhost URL. A successful confirmation clears its Supabase session and redirects to `https://www.zynema-app.online/login.html`; sign in manually afterward.
4. Sign in on the auth site and verify invalid credentials and unconfirmed accounts are rejected. Confirm the dashboard handoff accepts the auth site's Origin and establishes the dashboard session.
5. Use Forgot password, open the email link, confirm it returns to `www.zynema-app.online/callback.html?type=recovery`, set a new password, and sign in with it. Request another recovery link and verify that an expired or already-used link displays an error instead of redirecting elsewhere.

## Notes
- Poster showcase loads weekly trending movie posters from TMDB. The TMDB API key in `js/config.js` is visible to visitors because this is a static site; use a server-side proxy if the key must remain private. TMDB attribution is shown below the posters.
- Footer Privacy/Terms point to `APP_URL/privacy` and `/terms`; make sure those pages exist. Replace `support@zynema.com`.
- "Remember me" stores only the email on this device; session length is set in Supabase (Auth → Sessions).
