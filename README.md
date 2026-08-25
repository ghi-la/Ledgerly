# Ledgerly

A personal budgeting app: multiple accounts, custom categories, CSV import with
a keyword rules engine, a customisable widget dashboard, monthly budgets,
savings goals, transfers, and recurring-payment detection.

Built with Next.js 15 (App Router) + TypeScript, MUI v6, NextAuth v5, and
Mongoose on MongoDB Atlas. Ready to deploy on Vercel.

## What's inside

- **Multiple accounts** - current, savings, credit, cash, investments. Each
  card shows a live balance (opening balance + transactions).
- **Custom categories** - colour-coded, split into spending and income, with
  optional sub-categories.
- **CSV import wizard** - drop a file, map its columns (auto-guessed for common
  bank headers), preview every row with duplicates flagged and rules applied,
  then commit. Handles comma/semicolon/tab delimiters, `1,234.56` and
  `1.234,56` number formats, single-amount or debit/credit columns, and messy
  date orders.
- **Rules engine** - match on any field (description, merchant, amount ranges,
  regex, and more) with all/any logic and priority ordering. Rules run
  automatically on import; a "re-run on everything" action reclassifies
  transactions you already have.
- **Customisable dashboard** - show, hide, resize and reorder widgets
  (net worth, accounts, spend-by-category donut, monthly trend, budgets, recent
  activity, goals, top merchants, net-by-month).
- **Budgets, goals, transfers, recurring detection** - monthly per-category
  limits, savings goals that can track a linked account, two-legged transfers
  excluded from spending totals, and automatic spotting of subscriptions.

## Deploy to Vercel

1. Push this folder to a Git repo and import it in Vercel.
2. Set two environment variables in the Vercel project settings:

   - `MONGODB_URI` - your MongoDB Atlas connection string. Put the database
     name after the host, e.g.
     `mongodb+srv://USER:PASS@cluster-ghila.zrsoj.mongodb.net/ledgerly?retryWrites=true&w=majority&appName=Cluster-Ghila`
   - `AUTH_SECRET` - any random string. Generate one with `openssl rand -base64 32`.

   Optional: `ALLOW_REGISTRATION=false` closes public sign-ups once your
   accounts exist.

3. In Atlas, allow Vercel to connect: under Network Access, add `0.0.0.0/0`
   (or Vercel's IP ranges).
4. Deploy. Open the app, create an account on `/register`, and you're in;
   starter categories and rules are set up automatically.

## Run locally

```bash
cp .env.example .env.local   # then fill in MONGODB_URI and AUTH_SECRET
npm install
npm run dev                  # http://localhost:3000
```

Optional demo data (creates `demo@ledgerly.app` / `password12345`):

```bash
npm run seed
```

A sample bank export to try the importer with is in `sample/sample-statement.csv`.

## Notes

- The connection is cached across serverless invocations, so Atlas isn't
  hammered with new pools on every request.
- Auth is split into an edge-safe config (`src/lib/auth.config.ts`, used by the
  middleware) and the full Node-runtime config (`src/lib/auth.ts`) that talks to
  the database; this is required for NextAuth v5 on Vercel.
- Money is stored as signed numbers: negative is money out, positive is money
  in. Transfers are two linked legs and are left out of income/spending totals.

## Project layout

```
src/
  app/
    (auth)/          login + register pages
    (app)/           dashboard, transactions, import, accounts,
                     categories, rules, budgets, goals, settings
    api/             24 route handlers (accounts, transactions, rules,
                     import/preview, import/commit, stats, recurring, …)
  components/        AppShell, widgets, AuthForm, shared UI
  lib/               db, models, auth, rules engine, CSV parsing, theme
  middleware.ts      edge auth guard
scripts/seed.ts      optional demo seed
sample/              example bank CSV
```
