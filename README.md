# Fixora

Fixora is a household-services marketplace concept built around discovering real household problems and skilled professionals. The repository contains the marketing landing page and an initial Supabase account and onboarding foundation; the job marketplace, posting, applications, reviews, and social feed are not yet implemented.

## Local development

```sh
npm install
npm run dev
```

Create `.env.local` in the repository root (copy `.env.example` if helpful), then replace its placeholders with the Fixora project values before using account features:

- `VITE_SUPABASE_URL` — the Fixora project URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY` — the browser-safe publishable key. Never use a service-role or secret key in the frontend.

Without these values, public pages still load and account actions explain that Supabase is not configured.

## Supabase setup

The initial schema migration is `supabase/migrations/20261018142000_fixora_auth_onboarding.sql`. The corrective migration is `supabase/migrations/20261018144857_grant_public_published_provider_discovery_and_validate_account_type.sql`. Both are applied to the connected Fixora project. The schema contains profiles, provider profiles, service categories, provider-category links, and structured provider service areas; enables RLS; and seeds the six categories already defined in `src/data/serviceCategories.js`.

Email/password and Google OAuth flows use Supabase Auth. The connected project tools do not expose Auth provider settings, so verify the following in the Supabase Dashboard before testing registration:

1. Under **Authentication → Sign In / Providers**, enable Email and Google. Configure email confirmation and working delivery (custom SMTP is recommended for production).
2. In Google Cloud Console, create a Web OAuth client. Add this exact **Authorized redirect URI** to the Google client:
   `https://bhvdpxnqfqktobezgikb.supabase.co/auth/v1/callback`
3. Add the Google client ID and secret under the Supabase Google provider settings. Keep the secret in Supabase only; it does not belong in Vite environment variables.
4. Under **Authentication → URL Configuration**, use `https://fixora-home.vercel.app` as the production Site URL. Add these exact redirect URLs to the allow list: `http://localhost:5173/auth/callback`, `http://localhost:5173/auth/reset-password`, `https://fixora-home.vercel.app/auth/callback`, and `https://fixora-home.vercel.app/auth/reset-password`. Add any Vercel preview origins you intend to use.

The app builds redirect URLs from the current origin. For local work, Vite reads `.env.local` from the repository root when it starts; restart the dev server after creating or changing the file. The `.env.local` file is ignored by Git. For the deployed Vercel site, configure the same two `VITE_` variables in the Vercel project's environment settings and redeploy; a local `.env.local` file is not deployed.

Google sign-in and password-reset links return to the app routes above. Phone numbers are validated and saved in E.164 format but are **not verified**. Provider service areas expose city, region, and country only after onboarding; private profile phone data is never public. Profile account type is persisted once through a guarded database function; editable Auth user metadata is only used to prefill signup/onboarding and is not an RLS authorization source.

The connected Supabase project currently has no Storage buckets. This onboarding version does not upload profile or portfolio photos. It does not implement marketplace jobs, payments, phone verification, or offline account workflows.

## Build, lint, and preview

```sh
npm run build
npm run lint
npm run preview
```
