# ImbaLink architecture refactor — notes

## 0. Validation — now against the project's real toolchain

The first pass of this refactor was validated with a throwaway Vite scaffold
using guessed dependency versions, because only `src/` had been uploaded.
You've since provided the real `package.json` and `vite.config.js`, so this
section reflects re-validating against those exact files — a meaningfully
stronger check than before.

**What changed with the real files:**

- **The `lucide-react` version concern from the first pass was a false
  alarm.** I'd tested against the latest published `lucide-react`, which
  doesn't export `Facebook`/`Instagram` (dropped in a later major
  version) — flagged it as a risk. The project's actual pinned version,
  `lucide-react@0.468.0`, exports both. Nothing to fix; that code was
  always fine.
- **A real gap, found and fixed: no `tailwind.config.js` or
  `postcss.config.js` were ever uploaded**, in any of the three uploads
  so far. `package.json` lists `tailwindcss`, `postcss`, and
  `autoprefixer` as devDependencies, and `index.css` starts with
  `@tailwind base; @tailwind components; @tailwind utilities;`, but
  without a PostCSS config telling Vite to run Tailwind, those three
  lines pass straight through into the built CSS as **literal,
  unprocessed text** — a 164-byte output file with zero actual utility
  classes in it. Since nearly every component in this codebase is styled
  with Tailwind utility classNames (`"flex items-center gap-3
  active:scale-[0.98] ..."` throughout), a build in that state would
  produce a technically-valid but completely unstyled app — every element
  in its default browser styling. This was true of the *original*
  uploaded code too (it's a missing-file problem, not something the
  restructure caused), but it only became checkable once I had a config
  I trusted enough to test against.

  I added a standard, minimal `tailwind.config.js` (content globs over
  `index.html` and `src/**/*.{js,jsx}`, no theme customization —
  confirmed `GlobalStyles.jsx` only uses plain custom CSS classes like
  `.f-body`/`.f-mono`, not Tailwind theme extensions, so a default theme
  is safe) and a standard `postcss.config.js` (`tailwindcss` +
  `autoprefixer`). With those in place, the build output CSS jumped from
  164 bytes of literal `@tailwind` text to **18.7 KB of real generated
  utility CSS** (verified: `.flex{...}`, `.items-center`, etc. all
  present). **If your real project already has its own
  `tailwind.config.js`/`postcss.config.js` that just weren't part of any
  upload, use those instead of mine** — content globs in particular are
  worth checking, since a config scoped to the old flat `src/pages/` /
  `src/components/` layout would now miss files under the new
  `src/features/**` paths. Mine intentionally globs all of `src/` so it
  can't have that problem, but I can't promise it matches every detail
  (e.g. custom theme colors) of whatever the original had, since I never
  saw it.
- Re-ran the full build against the **real** `package.json` /
  `vite.config.js` / my reconstructed Tailwind config, on the exact `src/`
  tree from the delivered zip (extracted fresh from the zip itself, not
  my working copy) — clean build, real CSS output, all `lazy()` page
  chunks present. See §8 for the updated build confirmation.

This zip now also includes `package.json`, `vite.config.js` (both exactly
as you provided them — unchanged), and my reconstructed
`tailwind.config.js` / `postcss.config.js`, so `npm install && npm run
build` should work directly from what's in this archive.

## 0b. The original constraint (first pass)

The initial upload contained only the `src/` folder — no `package.json`,
lockfile, `vite.config`, or `index.html`. To validate that first pass, I
built a disposable Vite + React scaffold, guessed at dependency versions
close to what the code implied, and ran `vite build` after every batch of
changes. That caught real structural bugs (see §9) even before the real
config files were available — but see §0 above for where those guesses
turned out to be wrong or incomplete.

## 1. Final folder tree

```
src/
├── App.css
├── README-ECOSYSTEM.md
├── index.css
├── main.jsx
├── app/                          — app shell / composition root
│   ├── App.jsx
│   ├── components/
│   │   └── ResponsiveTopbar.jsx
│   └── routes/
│       └── tabs.js
├── assets/
├── data/                         — dev-time JSON datasets
│   ├── contractors.json
│   ├── properties.json
│   └── universities.json
├── database/                     — persistence layer
│   ├── DATABASE-SCHEMA.md
│   ├── database.js
│   ├── idb.js
│   └── repositories/
│       ├── agentRepository.js
│       ├── companyRepository.js
│       ├── contractorRepository.js
│       ├── landlordRepository.js
│       ├── messageRepository.js
│       ├── propertyRepository.js
│       ├── roommateRepository.js
│       ├── studentRepository.js
│       └── userRepository.js
├── features/
│   ├── agent/{components,pages,services}
│   ├── auth/ (+ components/, services/)
│   ├── company/{components,pages,services}
│   ├── contractor/{components,pages,services}
│   ├── landlord/{components,pages,services}
│   ├── messaging/{components,hooks,models,pages,services}
│   ├── profile/{pages,services}
│   ├── property/{components,pages,services,utils}
│   ├── roommate/{pages,services}
│   └── student/{pages,services,utils}
├── shared/
│   ├── components/   (Avatar, BarChart, DonutChart, PhotoCarousel, …)
│   ├── dev/          (DatabaseInspector)
│   ├── hooks/        (useDatabase, useMediaQuery, useOnlineStatus)
│   ├── layouts/      (BottomNav, DesktopSidebar, PhoneFrame, TabletBottomNav)
│   └── utils/        (formatters)
└── styles/
    ├── GlobalStyles.jsx
    └── tokens.js
```

Every feature folder follows the same shape (`components/`, `pages/`,
`services/`, and `hooks/`/`utils/` where the feature has any), so "where is
X" always resolves the same way: `features/<domain>/...`.

## 2. Largest files, before → after

| File | Before | After |
|---|---:|---:|
| `MessagesPage.jsx` | 1875 | 1754 |
| `ContractorsPage.jsx` | 1605 | 1590 |
| `HomePage.jsx` | 1581 | 1557 |
| `PropertyDetail.jsx` | 1368 | 1266 |
| `App.jsx` | 1015 | 850 |
| `PostCard.jsx` | 902 | 898 |

## 3. What was extracted, and from where

- **`App.jsx`** (1015→850): pulled its three self-contained layout
  components out to `shared/layouts/` — `TabletBottomNav.jsx` and
  `DesktopSidebar.jsx` (pure nav chrome, no feature dependencies) — and
  `ResponsiveTopbar.jsx` to `app/components/` (it embeds the property
  feature's `QuickFilterBar`, so it belongs in the app-shell layer, not
  `shared/` — see §5).
- **`PropertyDetail.jsx`** (1368→1266): pulled the "Contact" tab's
  call/WhatsApp/Messenger/Instagram logic out to
  `features/property/components/PropertyContactMethods.jsx`
  (`buildContactMethods()` + `ContactRow`) — a self-contained, stateless
  piece with a clean single input (`p`, the listing).
- **`MessagesPage.jsx`** (1875→1754): pulled its three presentational
  status/badge pieces out to `features/messaging/components/` —
  `UnreadBadge.jsx`, `InboxStatus.jsx`, `MessageAreaStatus.jsx`.
- **`AgentHubPage.jsx`** and **`CompanyHubPage.jsx`**: their identical
  `DonutChart`/`BarChart` implementations moved to
  `shared/components/DonutChart.jsx` / `BarChart.jsx` (see §4).
- **11 page files**: their identical `useMediaQuery` hook moved to
  `shared/hooks/useMediaQuery.js` (see §4).

## 4. Duplicated code found and removed

This was the highest-value part of the refactor and worth calling out
explicitly:

- **`useMediaQuery`** — byte-for-byte identical 12-line hook, copy-pasted
  into **11 different page files** (`AgentHubPage`, `PerformanceTrendsPage`,
  `CompanyHubPage`, `ContractorsPage`, `LandlordDashboardPage`,
  `MessagesPage`, `ProfilePage`, `CollectionsPage`, `HomePage`,
  `SearchPage`, `StudentPage`). Now one hook in `shared/hooks/`.
- **`isListingVerified`** — the same verification-check function existed
  under **three different names** in three files: `isListingVerified` in
  `PostCard.jsx` and `PropertyDetail.jsx`, and `isPropertyVerified` in
  `HomePage.jsx` (functionally identical, just with an extra null-guard
  that was a no-op given optional chaining). Consolidated into
  `features/property/utils/propertyHelpers.js` as `isListingVerified`, used
  everywhere.
- **`DonutChart` / `BarChart`** — identical implementations in
  `AgentHubPage.jsx` and `CompanyHubPage.jsx`, moved to
  `shared/components/`. `PerformanceTrendsPage.jsx` has its **own**,
  behaviorally-different versions of both — I confirmed by hand that
  they're not copies (different rendering logic) and left them alone
  rather than force a merge that could change behavior.
- **Dead unused imports** — `useEffect` was imported but never used in 8
  files (`AgentRegistration`, `AgentHubPage`, `PerformanceTrendsPage`,
  `ContractorRegistration`, `ContractorsPage`, `CompanyRegistration`,
  `CompanyHubPage`, `LandlordDashboardPage`); `PerformanceTrendsPage.jsx`
  also had unused `useState` and `TrendingUp`; `ProfilePage.jsx` had an
  unused `STUDY_YEARS` import. All removed. These were pre-existing, not
  introduced by the move.
- **Not consolidated, on purpose**: `FilterPill` (`HomePage.jsx` vs
  `SearchPage.jsx`) and `PropertyPicker` (`ProfilePage.jsx` vs
  `RoommateFinderPage.jsx`) share a name but are genuinely different
  components — different color schemes, different prop APIs. Merging them
  would mean picking one visual design and changing the other page's
  appearance, which the brief said not to do. `normalizePhone` (in
  `database.js` and `localAuthProvider.js`) and `normalizeMessage` (in
  `database.js` and `messageModel.js`) are duplicated but are tiny
  (1–8 line) private helpers; consolidating them would mean adding a new
  cross-layer import between auth/database/messaging for marginal benefit,
  so I left them as a documented minor nit rather than force it.
- **One dead file deleted**: `src/components/BottomNav.jsx` — an older,
  unused copy of the bottom nav. The app only ever imported the other one
  (`src/layouts/BottomNav.jsx`, now `shared/layouts/BottomNav.jsx`), which
  also supports a `studentMode` prop the deleted copy didn't have.

## 5. Layering / circular-dependency fixes

Two `shared/` components turned out to reach down into the `property`
feature — a real violation of the "shared shouldn't depend on
feature-specific code" rule, inherited from how the original
`components/common/` folder was organized:

- **`PriceHistogramSlider`** — only ever used by `QuickFilterBar.jsx` and
  `HomePage.jsx`, both in the property feature, and itself depends on
  `getPriceHistogram` from `propertyHelpers.js`. It was never actually
  generic. Moved to `features/property/components/`.
- **`ResponsiveTopbar`** — only used by `App.jsx`, and it embeds the
  property feature's `QuickFilterBar` for the search-quick-filters row.
  Moved to `app/components/` (the app-shell layer, which is allowed to
  depend on any feature — it's the top of the dependency graph) instead of
  `shared/`.

No other `shared → feature → shared` or feature-to-feature import cycles
were found (checked by grep across `shared/` and `database/` for any
`features/...` import path).

## 6. Files intentionally left large, and why

- **`MessagesPage.jsx`, `ContractorsPage.jsx`, `HomePage.jsx`,
  `RoommateFinderPage.jsx`, `ProfilePage.jsx`, `PostCard.jsx`,
  `PropertyDetail.jsx`** (still 800–1750 lines each): each is a single,
  tightly-coupled interactive surface — gesture handling (drag-to-dismiss,
  double-tap-to-like, pinch-zoom), inline styles computed from dozens of
  interdependent state variables, or a conversation-list/active-thread
  state machine sharing one set of refs and effects. Real extraction here
  means threading many pieces of local state and refs across a new
  parent/child prop boundary. I did this successfully in six places (see
  §3) where the boundary was genuinely clean; I did **not** attempt it on
  these because I have no way to interaction-test the result — only a
  production `vite build`, which proves the code is syntactically valid
  and every import resolves, not that a swipe gesture or a chat's
  optimistic-send-reconciliation still behaves correctly at runtime.
  Getting this wrong silently (code that builds but misbehaves) is worse
  than leaving the file large. I'd rather flag this honestly than
  guess-and-hope on files this size with no test harness.
- **`database.js`** (1216 lines): kept intact rather than physically split
  into repository files. It has meaningful module-level shared state — an
  in-memory property cache (`ALL_DATA`), a paginated-query cache, and
  `ACTIVE_USER_ID` scoping — that many of its ~50 methods read and write,
  and several methods call sibling methods via `this.method()`. Physically
  moving method bodies into separate repository files would mean either
  duplicating that shared state across files (correctness risk) or
  threading it through as explicit parameters (a real behavior-preserving
  rewrite, not a move — against "don't rewrite business logic" without a
  way to test it). Instead, `database/repositories/*.js` is a facade layer
  on top of the untouched `database.js`, grouping its API by domain
  (`propertyRepository`, `studentRepository`, etc.) — the organizational
  benefit the brief asked for, without touching working internals. Feature
  `services/*.js` files sit on top of those repositories, ready for
  components to adopt incrementally. **I did not rewire every existing
  `db.xxx()` call site to go through them** — that would mean touching
  business-logic call sites in dozens of components for a cosmetic gain,
  which is the specific trade the brief said not to make.
- **`GlobalStyles.jsx`** (693 lines) and **`idb.js`** (489 lines): left
  in place — one is the app's global stylesheet-as-JS (inherently one
  file by nature), the other is the low-level IndexedDB wrapper `database.js`
  sits on (already a single clear responsibility, not a grab-bag).

## 7. Imports

Every relative import (including dynamic `import()` calls used for route
code-splitting) was mechanically rewritten to match the new file
locations, then verified with a script that resolves every import against
the real file tree. **204/204 resolve.** One real bug this caught along
the way: `App.jsx`'s `lazy(() => import("./pages/HomePage"))`-style
dynamic imports were missed by my first rewrite pass (a regex gap — dynamic
`import(` calls don't match the same pattern as `import ... from`) and
would have 404'd every lazy-loaded page at runtime; a second pass with a
dynamic-import-aware pattern caught and fixed all 12 of them.

## 8. Build

Confirmed with a real `vite build`, using the project's actual
`package.json` and `vite.config.js` plus the reconstructed Tailwind config
(§0) — the `src/` tree builds successfully, route-level code-splitting
works as expected (every `lazy()`-loaded page produces its own chunk, and
the extracted shared pieces `useMediaQuery`, `BarChart`, `DonutChart` each
show up as their own small chunk, confirming correct imports rather than
silent inlining/duplication), and the output CSS contains real generated
Tailwind utility classes (18.7 KB), not just the app's hand-written
`GlobalStyles.jsx` CSS. This was re-verified against the exact `src/` from
the delivered zip, extracted fresh, not my local working copy.

## 9. Functionality preserved

No page, route, hook, or exported function signature was changed. Every
extraction moved code verbatim (copy the block, delete the original,
import instead) rather than reimplementing it. The one exception —
consolidating four verbatim-duplicate functions into one each — preserves
identical behavior since the implementations were checked to be identical
(or, for `isPropertyVerified`, checked to be behaviorally equivalent)
before merging.

Two real bugs were **found and fixed** in the process, both pre-existing
in the moved code, not introduced by the move:
1. `database/repositories/*.js`: several `db.*` methods call sibling
   methods via `this.someOtherMethod()`. A naive facade
   (`{ getProperties: db.getProperties }`) would silently break at
   runtime the moment such a method ran, because `this` would resolve to
   the repository object instead of `db`. Every repository method is
   wrapped (`(...args) => db.method(...args)`) to keep `this` bound
   correctly.
2. Two unused, dead icon imports in `App.jsx` (`Building2`, `LogOut`) —
   pre-existing, removed while cleaning up that file's imports.

## 10. Housekeeping

No temporary files, backups, or duplicate old-version files were left
behind — the one genuinely dead file (`components/BottomNav.jsx`) was
deleted outright rather than kept alongside its replacement. My own
build-verification scaffold lives outside `src/` and isn't part of this
delivery.

## What I'd do next, if this were a longer engagement

The six large interactive files in §6 are the obvious next target, but
only with a real dev server and either manual click-through testing or an
existing test suite to check against — not from a chat session limited to
static analysis and production builds. I'd also suggest actually adopting
the new `features/*/services` layer at call sites (currently additive/
unused-by-default) once there's a way to test each migrated call site.
