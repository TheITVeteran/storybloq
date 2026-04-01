# Setup Flow -- AI-Assisted Project Initialization

This file is referenced from SKILL.md when no `.story/` directory exists but project indicators are present. SKILL.md has already determined that setup is needed before routing here.

**If arriving from Step 2b (scaffold detection):** The project already has an empty `.story/` scaffold but no tickets. Skip 1a and start at **1b. Existing Project -- Analyze**.

## AI-Assisted Setup Flow

This flow creates a meaningful `.story/` project instead of empty scaffolding. Claude analyzes the project, proposes structure, and creates everything via MCP tools.

#### 1a. Detect Project Type

Check for project indicators to determine if this is an **existing project** or a **new/empty project**:

- `package.json` -> npm/node (read `name`, `description`, check for `typescript` dep)
- `Cargo.toml` -> Rust
- `go.mod` -> Go
- `pyproject.toml` / `requirements.txt` -> Python
- `*.xcodeproj` / `Package.swift` -> Swift/macOS
- `*.sln` / `*.csproj` -> C#/.NET
- `Gemfile` -> Ruby
- `build.gradle.kts` / `build.gradle` -> Android/Kotlin/Java (or Spring Boot)
- `pubspec.yaml` -> Flutter/Dart
- `angular.json` -> Angular
- `svelte.config.js` -> SvelteKit
- `.git/` -> has version history

If none found (empty or near-empty directory) -> skip to **1c. New Project Interview**.

#### 1b. Existing Project -- Analyze

Before diving into analysis, briefly introduce claudestory to the user:

"Claude Story tracks your project's roadmap, tickets, issues, and session handovers in a `.story/` directory. Every Claude Code session starts by reading this context, so you never re-explain your project from scratch. Sessions build on each other: decisions, blockers, and lessons carry forward automatically. I'll analyze your project and propose a structure. You can adjust everything before I create anything."

Keep it to 3-4 sentences. Not a sales pitch, just enough that the user knows what they're opting into and that they're in control.

Read these files to understand the project (skip any that don't exist, skip files > 50KB):

1. **README.md** -- project description, goals, feature list, roadmap/TODO sections
2. **Package manifest** -- project name, dependencies, scripts
3. **CLAUDE.md** -- existing project spec (if any)
4. **Top-level directory listing** -- identify major components (src/, test/, docs/, etc.)
5. **Git summary** -- `git log --oneline -20` for recent work patterns
6. **GitHub issues (ask user first)** -- `gh issue list --limit 30 --state open --json number,title,labels,body,createdAt`. If gh fails (auth, rate limit, no remote), skip cleanly and note "GitHub import skipped: [reason]"

**Framework-specific deep scan** -- after detecting the project type in 1a, scan deeper into framework conventions to understand architecture:

- **Next.js / Nuxt:** Check `app/` vs `pages/` routing, scan `app/api/` or `pages/api/` for API routes, read `next.config.*` / `nuxt.config.*`, check for middleware.
- **Express / Fastify / Koa:** Scan for route files (`routes/`, `src/routes/`), look for `router.get/post` patterns, identify service/controller layers.
- **NestJS:** Read `nest-cli.json`, scan `src/` for `*.module.ts`, check for controllers and services.
- **React (CRA / Vite) / Vue / Svelte:** Check `src/components/` structure, look for state management imports (redux, zustand, pinia), identify routing setup.
- **Angular:** Read `angular.json`, scan `src/app/` for modules and components, check for services and guards.
- **Django / FastAPI / Flask:** Check for `manage.py`, scan for app directories or router files, look at models and migrations.
- **Spring Boot:** Check `pom.xml` or `build.gradle` for Spring deps, scan `src/main/java` for controller/service/repository layers.
- **Rust:** Check `Cargo.toml` for workspace members, scan for `mod.rs` / `lib.rs` structure, identify crate types.
- **Swift / Xcode:** Check `.xcodeproj` or `Package.swift`, identify SwiftUI vs UIKit, scan for targets.
- **Android (Kotlin/Java):** Check `build.gradle.kts`, scan `app/src/main/` for activity/fragment/composable structure, check `AndroidManifest.xml`, identify Compose vs XML layouts.
- **Flutter / Dart:** Check `pubspec.yaml`, scan `lib/` for feature folders (models/, screens/, widgets/, services/), check for state management imports (provider, riverpod, bloc).
- **Go:** Check `go.mod`, scan for `cmd/` and `internal/`/`pkg/`, check for `Makefile`.
- **Monorepo:** If `packages/`, `apps/`, or workspace config detected, list each package with its purpose before proposing phases.
- **Other:** Scan `src/` two levels deep and identify dominant patterns (MVC, service layers, feature folders).

**Derive project metadata:**
- **name**: from package manifest `name` field, or directory name
- **type**: from package manager (npm, cargo, pip, etc.)
- **language**: from file extensions and manifest

**Assess project stage** from the data -- don't use fixed thresholds. A project with 3 commits and a half-written README is greenfield. A project with 500+ commits, test suites, and release tags is mature. A project with 200 commits and active PRs is active development. Use your judgment.

**Propose 3-7 phases** reflecting the project's actual development trajectory. Examples:
- Library: setup -> core-api -> documentation -> testing -> publishing
- App: mvp -> auth -> data-layer -> ui-polish -> deployment
- Mid-development project: capture completed work as early phases, then plan forward

**Propose initial tickets** per active phase (2-5 each), based on:
- README TODOs or roadmap sections (treat as hints, not ground truth)
- GitHub issues if imported -- infer from label semantics: bug/defect labels -> issues, enhancement/feature labels -> tickets
- Obvious gaps (missing tests, no CI, no docs, etc.)
- If more than 30 GitHub issues exist, note "Showing 30 of N. Additional issues can be imported later."

**Important:** Only mark phases complete if explicitly confirmed by user or docs -- do NOT infer completion from git history alone.

#### 1c. New Project -- Interview

Ask the user:
1. "What are you building?" -- project name and purpose
2. "What's the tech stack?" -- language, framework, project type
3. "What are the major milestones?" -- helps define phases
4. "What's the first thing to build?" -- seeds the first ticket

Propose phases and initial tickets from the answers.

#### 1d. Present Proposal

Show the user a structured proposal (table format, not raw JSON):
- **Project:** name, type, language
- **Phases** (table: id, name, description)
- **Tickets per phase** (title, type, status)
- **Issues** (if GitHub import was used)

Before asking for approval, briefly explain what they're looking at:

"**How this works:** Phases are milestones in your project's development. They track progress from setup to shipping. Tickets are specific work items within each phase. After setup, typing `/story` at the start of any Claude Code session loads this context automatically. Claude will know your project's state, what was done last session, and what to work on next."

Then ask for approval with clear interaction guidance:

"Does this look right? You can:
- Adjust any phase (rename, reorder, add, remove)
- Change tickets (add, remove, rephrase, move between phases)
- Mark phases as complete or in-progress
- Split or merge phases

I'll iterate until you're happy, then create everything."

#### 1e. Execute on Approval

1. Call `claudestory_init` with name, type, language -- after this, all MCP tools become available dynamically
2. Call `claudestory_phase_create` for each phase -- first phase with `atStart: true`, subsequent with `after: <previous-phase-id>`
3. Call `claudestory_ticket_create` for each ticket
4. Call `claudestory_issue_create` for each imported GitHub issue
5. Call `claudestory_ticket_update` to mark already-complete tickets as `complete`
6. Call `claudestory_snapshot` to save initial baseline

#### 1f. Post-Setup

After creation completes:
- Confirm what was created (e.g., "Created 5 phases, 12 tickets, and 3 issues")
- Check if `.gitignore` includes `.story/snapshots/` (warn if missing -- snapshots should not be committed)
- Suggest creating `CLAUDE.md` if it doesn't exist (project spec for AI sessions)
- Suggest creating `RULES.md` if it doesn't exist (development constraints)
- Write an initial handover documenting the setup decisions
- Setup complete. Continue with **Step 2: Load Context** in SKILL.md (already in your context). Execute all 6 steps -- the project now has data to load.
