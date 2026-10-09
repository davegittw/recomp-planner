# Recomp Planner

A personal training and nutrition planner that installs on your iPhone home screen and runs full-screen like an app. It works offline (everything is saved on the phone first) and syncs to your own Supabase database when there's signal.

- **Today**: the day's workout with set-by-set logging (last session shown under each exercise), and meals with running kcal / protein / carbs / fat against target, planned vs eaten.
- **Week**: the split and eating plan side by side, sessions done, average kcal and protein eaten, and the default weekly split.
- **Train**: your exercise database and workout templates (sets, reps, kg, rest per exercise).
- **Food**: your food database and daily targets.
- **Recipe builder**: paste an ingredient list (e.g. copied from an Instagram caption) or add ingredients one by one from the built-in database. Each line is matched to a food with its amount ("2 tbsp olive oil", "1 tin (400g) chopped tomatoes", "½ tsp paprika"), you can change any amount or swap a match, and the recipe is saved as a food with per-serving values.
- **"What did you eat?"**: type something like "2 eggs, 2 slices of wholemeal toast and a flat white". It's split into separate foods and matched against your foods and the database, ready to check and add.
- **Ingredient database, built in**: about 240 everyday UK-named ingredients with typical portions (1 tbsp, 1 medium, 1 tin…), plus about 5,900 more generic foods. Everything runs on the phone, works offline, and costs nothing.

Plain HTML/CSS/JS with no build step, hosted as a static site on Vercel.

## One-time setup (about 15 minutes)

### 1. Supabase
1. In Supabase, create a **new project** (e.g. `recomp-planner`, London region). Keeping it separate from `touchwood-ops` keeps personal data out of the work project, and the free plan allows two projects.
2. **SQL editor** → paste all of `supabase/schema.sql` → Run.
3. **Authentication → Users → Add user → Create new user**: your email and a password, tick *Auto Confirm User*.
4. **Authentication → Sign In / Providers**: turn off *Allow new users to sign up*, so nobody else can create an account.
5. **Project Settings → API**: copy the *Project URL* and the *anon public* key into `config.js`.

The anon key is meant to be public. Row-level security means only your signed-in account can read or write rows.

Note: free Supabase projects pause after a week with no activity. Using the app daily keeps it awake; if it does pause, click *Restore* in the dashboard. Your phone keeps working offline in the meantime and syncs once it's back.

### 2. GitHub + Vercel
1. Create a private repo (e.g. `davegittw/recomp-planner`) and push this folder to it.
2. In Vercel (team *TW*, or your personal account) → *Add New Project* → import the repo. Framework preset: **Other**. No build command, output directory is the repo root.
3. Deploy. You get a URL like `recomp-planner.vercel.app`.

### 3. Install on the iPhone
1. Open the Vercel URL in **Safari**.
2. Share button → **Add to Home Screen** → Add.
3. Open it from the home screen icon (not from Safari), and sign in once.

From then on it opens full-screen with its own icon, and keeps working with no signal.

## Updating the app
Push changes to GitHub and Vercel redeploys. When you change any file, bump `VERSION` in `sw.js` (e.g. `recomp-v2`) so phones drop the old cached copy. The app picks up the new version the next time it's opened with a connection (closing and reopening it once may be needed).

## How the data is stored
One table, `records`, with one row per document:

| kind | id | what's in `data` |
|---|---|---|
| `exercises` | `x-…` | name, pattern (push/pull/legs/core), muscles, equipment, default sets/reps/rest, notes |
| `foods` | `f-…` | name, icon, serving size + unit, kcal, protein, carbs, fat, optional fibre (g) and sodium (mg), all per serving; imported recipes also keep their ingredient list |
| `workouts` | `w-…` | name, type, notes, items (exercise, sets, reps, kg, rest) |
| `days` | `YYYY-MM-DD` | chosen workout (or the split default), meals (food snapshot + amount + eaten), set log per exercise |
| `settings` | `main` | daily targets and the weekly split |

Meals store a copy of the food's macros when added, so editing a food later doesn't rewrite past days.

Two views make the data easy to query in SQL: `workout_log` (one row per completed set) and `daily_nutrition` (planned vs eaten kcal and protein per day).

Deleting is a soft delete (`deleted = true`) so other devices pick it up on their next sync.

## Starter set
On first sign-in the app offers an optional starter set: 26 exercises matched to a rack, barbell, dumbbells, cables, landmine and pull-up bar, Push A / Pull A / Legs A templates, a Mon–Sat split and 18 common foods. Starter foods are tagged *starter* until you edit them. The macros are typical UK label values, so check them against the packets you buy.

## Ingredient database
- `data/ingredients-core.js`: the core list, values per 100 g (100 ml for drinks), with UK names, typical portions and other names each item is matched by. Carbs exclude fibre, as on UK labels.
- `data/usda-foods.json`: the wider list (generic foods only; US brand and restaurant items removed), loaded on first search and cached for offline use.
- `ingredients.js`: search, and the parser that reads lines like "2 large eggs" or "1 tin (400g) chopped tomatoes".

Sources: USDA FoodData Central, SR Legacy (public domain), via the TempoLife food dataset (tempolife.app, CC-BY-4.0). A few UK items that USDA doesn't have (halloumi, gnocchi, panko, oven chips, oat drink, light coconut milk) use typical UK pack values, and coffee-shop drinks are estimated from espresso plus semi-skimmed milk. Each item shows where its numbers came from.

These are reference values. For branded products you buy often, add your own food from the label and it will be matched first.
