# Fixora

Fixora is a mobile-first marketplace for household services in Nigeria. It is being built to help people find skilled local professionals and, in a later release, describe household work they need done.

## What works today

- Create a customer or professional account with email and password, or Google sign-in.
- Complete the account-specific onboarding flow.
- Professionals can add their name, service description, categories, and service areas. A completed professional profile can appear in discovery.
- Customers can browse published professional profiles by name, service category, and service area, then view profile details.
- Manage account details and sign out.

Problem posting is not available yet. Users cannot currently publish household requests, upload job photos, set job budgets, apply for work, contact professionals, book services, send messages, pay, or leave reviews. The landing page includes illustrative photography and examples; they are not live customer requests or professional profiles.

## Run Fixora locally

You’ll need Node.js 20.19 or newer in the 20.x line, or 22.12 or newer, and npm.

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create `.env.local` in the project root with the browser-safe Supabase values for your project:

   ```dotenv
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
   ```

   Use a Supabase publishable key only. Never put a service-role key or other secret in frontend configuration. Without these values, public pages run, but account features cannot connect to Supabase.

3. Start the development server:

   ```sh
   npm run dev
   ```

Vite prints the local address when the server starts. To check the production bundle and lint the source, run `npm run build` and `npm run lint`.

## Technology

Fixora uses React and JavaScript with JSX, Vite, React Router, Supabase Auth and Postgres, plain CSS, Phosphor Icons, GSAP, and `libphonenumber-js`. The web app can be installed as a PWA; cached app files do not make account or marketplace actions available offline.
