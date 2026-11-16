# Deploying Agentmap

The web app goes on **Vercel**, the API on **Render**, and the database stays on **Supabase**.
The browser only ever talks to your Vercel address: Vercel forwards `/api/*` to Render, so
sign-in cookies belong to one site and nothing needs cross-site setup.

```
browser ──► Vercel (apps/web) ──/api/*──► Render (apps/api) ──► Supabase Postgres
```

You need accounts on GitHub (this repository), Supabase, Render, Vercel and, for email, Resend.
It takes about 20 minutes.

## 1. Database (Supabase)

You can keep using your current Supabase project, or create a fresh one for production
(recommended: pick the region closest to where Render will run, e.g. Frankfurt).

In Supabase: **Project Settings > Database > Connection string**, copy the pooler strings and
add the same options as in `apps/api/.env.example`:

- `DATABASE_URL`: transaction pooler, port **6543**, ending
  `?pgbouncer=true&connection_limit=5&pool_timeout=20&connect_timeout=30&schema=app`
- `DIRECT_URL`: session pooler, port **5432**, ending `?connect_timeout=30&schema=app`

The tables are created automatically on the first API start (step 2).

## 2. API (Render)

1. Merge the latest branch into `main` on GitHub (Render deploys `main`).
2. In Render: **New > Blueprint**, pick this repository. Render reads `render.yaml` and creates
   the `agentmap-api` web service.
3. Fill in the values it asks for:

   | Setting | Value |
   | --- | --- |
   | `DATABASE_URL` | from step 1 |
   | `DIRECT_URL` | from step 1 |
   | `APP_URL` | for now `https://example.com`; you replace it in step 4 |
   | `WEB_ORIGIN` | same as `APP_URL` |
   | `RESEND_API_KEY` | your Resend key (or leave empty: emails are then only written to the log) |

   `JWT_SECRET` is generated for you. Never share it.
4. Deploy. When it is live, open `https://<your-service>.onrender.com/api/health`.
   You should see the API and database as up.

The free Render plan sleeps after 15 minutes without visits; the next visit wakes it in about
a minute. Before a demo, open the health address above once to wake it.

## 3. Web app (Vercel)

1. In Vercel: **Add New > Project**, import this repository.
2. Set **Root Directory** to `apps/web`. Vercel picks up `apps/web/vercel.json`, which installs
   the whole workspace and builds the shared package first.
3. Add the environment variable:

   | Name | Value |
   | --- | --- |
   | `API_URL` | `https://<your-service>.onrender.com` (no trailing slash, no `/api`) |

4. Deploy. Note your address, e.g. `https://agentmap.vercel.app`.

## 4. Connect the two

Back in Render, set `APP_URL` and `WEB_ORIGIN` to your Vercel address (no trailing slash) and
save; Render redeploys. Email links (confirm email, reset password, invites) now point to it.

## 5. Try it

1. Open your Vercel address and create an account.
2. Pick a template (for example Customer support) to get a full agent in one click.
3. On the agent page, **⋯ > Share a read-only link**. That link works for anyone, without an
   account: it is the one to post on X.

## Email

Without a domain of your own, Resend's test sender (`onboarding@resend.dev`) only delivers to
the email address of your Resend account. That is enough for your own account. To send
confirmation and invite emails to other people, verify a domain in Resend
(**Domains > Add domain**), then set `MAIL_FROM` in Render to an address on it, such as
`Agentmap <hello@yourdomain.com>`.

## Updating

Push to `main`: Render and Vercel both redeploy. New database migrations are applied by the API
when it starts, before it takes traffic.
