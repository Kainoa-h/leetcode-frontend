You are building a complete production-quality static website and its supporting Git-history ingestion system.

Implement the project directly in this repository. Do not stop at an outline, architecture document, pseudocode, or partial scaffold. Create all source files, configuration, tests, documentation, example data, and GitHub Actions workflows necessary for the project to run.

Use reasonable defaults where details are unspecified. Do not ask questions. Record material assumptions in the README.

# Project objective

Build a static Astro website that visualizes the solution history from this GitHub repository:

```text
https://github.com/Kainoa-h/BOMBBOMBOBMOBOMBOMBOMBOMBBOMB
```

The source repository contains LeetCode solutions written in multiple languages.

For every unique combination of:

```text
(problem ID, programming language)
```

generate a static page showing every meaningful committed version of that solution.

The page must organize revisions into LLM-inferred approaches and display the code revisions for each approach side by side with syntax highlighting.

The ingestion system must:

* Parse the source repository’s Git history.
* Support both full and incremental ingestion.
* Reconstruct the complete source snapshot for every relevant revision.
* Determine which problem and language each revision belongs to.
* Derive the LeetCode problem title from the solution filename.
* Use an LLM through OpenRouter to:

  * Produce an extremely short description of the change made in each revision.
  * Classify revisions into distinct algorithmic approaches.
  * Reorder revisions for presentation so the progression makes narrative sense.
* Preserve the real chronological order separately from the LLM presentation order.
* Generate deterministic JSON consumed by the Astro frontend.
* Track previous processing so unchanged histories do not require repeated LLM calls.
* Be triggerable by GitHub Actions from the source LeetCode repository.
* Deploy the generated Astro site to Cloudflare Pages.

The frontend repository and the LeetCode source repository are separate repositories.

# Required technology

Use:

* Astro 7
* TypeScript 7
* Tailwind CSS
* Node.js
* pnpm
* Zod
* Shiki for build-time syntax highlighting
* Vitest for unit tests
* OpenRouter as the LLM provider
* Git CLI for source-history analysis
* GitHub Actions
* Wrangler for Cloudflare Pages deployment

All application, ingestion, configuration, and test code must be TypeScript wherever practical.

Do not use npm or Yarn. Use pnpm commands and commit a `pnpm-lock.yaml`.

Configure strict TypeScript settings.

Avoid unnecessary client-side frameworks. Use Astro components and server-side/static generation by default. Add small client-side scripts only where browser interactivity requires them.

The final Astro output must be completely static.

# Repository layout

Use a clean structure similar to:

```text
.
├── .github/
│   └── workflows/
│       ├── ingest-and-deploy.yml
│       └── validate.yml
├── config/
│   ├── site.json
│   └── favorites.json
├── generated/
│   ├── manifest.json
│   ├── index.json
│   ├── ingestion-errors.json
│   └── problems/
│       └── <problem-id>/
│           └── <language>.json
├── scripts/
│   ├── ingest.ts
│   ├── validate-generated.ts
│   └── lib/
│       ├── git.ts
│       ├── commit-parser.ts
│       ├── filename-parser.ts
│       ├── language.ts
│       ├── history.ts
│       ├── snapshots.ts
│       ├── grouping.ts
│       ├── hashing.ts
│       ├── manifest.ts
│       ├── openrouter.ts
│       ├── narrative.ts
│       ├── schemas.ts
│       └── errors.ts
├── src/
│   ├── components/
│   ├── layouts/
│   ├── lib/
│   ├── pages/
│   └── styles/
├── tests/
├── astro.config.ts
├── package.json
├── tsconfig.json
├── wrangler.toml
└── README.md
```

This layout is indicative. Improve it where useful, but preserve a clear division between:

1. Git-history ingestion.
2. Generated content.
3. Astro presentation.
4. Deployment automation.

# Source commit convention

The source repository generally follows this commit-subject format:

```text
[language]? [problem id][!]?:? [comment]?
```

Examples:

```text
rust 1971: initial union find
java 1: use hash map
42: simplify iterator
rust 20!: incorrect stack approach
rust 224
```

Rules:

* The language prefix is optional.
* Old commits without a language prefix are Rust.
* The exclamation mark after the problem ID is optional.
* An exclamation mark indicates that the committed solution is considered wrong.
* A wrong revision may fail LeetCode tests.
* Rarely, it may pass tests but use an invalid or conceptually wrong approach.
* The optional text after the colon is the author’s comment.
* Commit history is not guaranteed to be a clean linear progression.
* Work on multiple approaches may be interleaved.
* A later commit can refine an earlier approach after another approach was introduced.

Use a tolerant regex parser.

Do not rely on the expression alone. Validate and normalize the parsed data.

# Source repository access

The ingestion command must accept a local path to a full clone of the source repository:

```bash
pnpm ingest --source ./source-solutions
```

Also support optional flags such as:

```bash
pnpm ingest --source ./source-solutions --full
pnpm ingest --source ./source-solutions --dry-run
pnpm ingest --source ./source-solutions --no-llm
pnpm ingest --source ./source-solutions --problem 1971
pnpm ingest --source ./source-solutions --language rust
```

The implementation may use a mature typed CLI argument package or a small internal parser.

Before ingestion, verify that:

* The supplied path exists.
* It is a Git working tree.
* Its history is available.
* The current HEAD can be resolved.

Return actionable errors.

Do not use the GitHub API to reconstruct source history. Use local Git commands.

# Git-history ingestion

Use local Git commands such as:

```bash
git log
git show
git diff-tree
git diff
git ls-tree
git merge-base
```

Never parse human-oriented default Git output. Always request machine-readable formats with stable delimiters.

For each relevant commit, capture at least:

```ts
interface ParsedCommit {
  sha: string;
  parentSha: string | null;
  authoredAt: string;
  committedAt: string;
  chronologicalIndex: number;
  rawSubject: string;
  problemId: number | null;
  declaredLanguage: string | null;
  normalizedLanguage: string | null;
  markedWrong: boolean;
  comment: string;
  changedFiles: ChangedFile[];
  warnings: IngestionWarning[];
}
```

Handle:

* Root commits.
* Merge commits.
* File additions.
* File modifications.
* File deletions.
* File moves and renames.
* Commits touching multiple files.
* Commits touching multiple solution files.
* Malformed commit messages.
* Commit messages whose declared problem conflicts with changed files.
* Commit messages whose language conflicts with paths or extensions.

Do not allow one malformed commit to fail the entire build.

Record recoverable issues in:

```text
generated/ingestion-errors.json
```

# Language inference and normalization

Infer language using all available evidence:

1. Explicit language in the commit subject.
2. File extension.
3. Directory name.
4. Existing history for that file or problem.

At minimum support:

```text
.rs    -> rust
.java  -> java
.py    -> python
.ts    -> typescript
.js    -> javascript
.cpp   -> cpp
.cc    -> cpp
.cxx   -> cpp
.c     -> c
.cs    -> csharp
.go    -> go
.kt    -> kotlin
.swift -> swift
.rb    -> ruby
.php   -> php
```

The actual source repository may currently contain fewer languages. Design the mapping to be extensible.

Normalize common aliases:

```text
rs -> rust
py -> python
ts -> typescript
js -> javascript
c++ -> cpp
cs -> csharp
```

When the commit omits the language, default to Rust for compatibility with old commits, unless strong file evidence proves otherwise.

If the declared language and file extension conflict, preserve both pieces of information, choose the file-backed language for the solution snapshot, and emit a warning.

# Problem ID and title derivation

The canonical identity is:

```text
(problem ID, normalized language)
```

Do not use file paths as permanent identity because files may be renamed.

Each generated question page must derive the question title from the solution filename.

Support common filename patterns such as:

```text
1971-find-if-path-exists-in-graph.rs
1971_find_if_path_exists_in_graph.rs
1971. Find If Path Exists in Graph.rs
1971-find-if-path-exists-in-graph.solution.rs
find-if-path-exists-in-graph.rs
two-sum.rs
Two Sum.java
```

Implement a filename parser that:

* Removes the final source extension.
* Removes known secondary suffixes such as `.solution`, where appropriate.
* Removes a leading problem ID when present.
* Converts hyphens and underscores to spaces.
* Normalizes repeated whitespace.
* Converts the remaining text to readable title case.
* Preserves common technical acronyms where practical.
* Falls back to `Problem <id>` when no meaningful title can be derived.

Examples:

```text
1971-find-if-path-exists-in-graph.rs
-> Find If Path Exists in Graph

1_two_sum.rs
-> Two Sum

20-valid-parentheses.java
-> Valid Parentheses
```

Store both:

```ts
derivedTitle: string;
sourceFilename: string;
```

If the filename changes over time:

* Prefer the title derived from the latest valid non-deleted revision.
* Fall back to the most recent historical filename.
* Preserve historical filenames on individual revisions.
* Emit a warning if filenames in the same problem/language group imply materially different titles.

Do not fetch titles from LeetCode or another external service. Filename derivation is the source of truth for this project.

# Solution snapshots

For each relevant source revision, retrieve the complete source file as it existed at that commit.

Store full snapshots, not only diffs.

Each revision should include data similar to:

```ts
interface SolutionRevision {
  sha: string;
  shortSha: string;
  parentSha: string | null;
  authoredAt: string;
  committedAt: string;
  chronologicalIndex: number;

  problemId: number;
  language: string;

  sourcePath: string;
  sourceFilename: string;
  code: string;
  codeHash: string;

  markedWrong: boolean;
  commitComment: string;
  rawCommitSubject: string;

  diffFromPreviousRelevantRevision: string | null;
  changedLineCounts: {
    additions: number;
    deletions: number;
  } | null;

  approachId: string;
  narrativeIndex: number;
  shortChangeSummary: string;

  warnings: IngestionWarning[];
}
```

A “previous relevant revision” means the previous revision for the same problem and language, not necessarily the commit’s immediate Git parent.

Avoid duplicate revision cards when a commit does not actually change the solution content. Use the source-content hash to detect this.

Preserve a no-op or metadata-only commit only when its commit message carries meaningful information that cannot otherwise be represented. Document the chosen behavior.

For deleted files:

* Preserve all historical snapshots.
* Mark the latest state as deleted.
* Do not erase the group from generated output unless no historical solution ever existed.

# Deterministic data before LLM processing

The following must be deterministic and must not be delegated to the LLM:

* Git traversal.
* Commit parsing.
* File detection.
* Language normalization.
* Problem-ID extraction.
* Filename-derived title extraction.
* Snapshot retrieval.
* Diff calculation.
* Chronological ordering.
* Content hashes.
* Cache invalidation.
* Manifest updates.
* Generated route construction.

Use the LLM only for semantic summarization and presentation grouping.

# LLM responsibilities

For one complete `(problem ID, language)` group, send the model enough information to:

1. Identify distinct algorithmic or implementation approaches.
2. Assign every revision to exactly one approach.
3. Place approaches into a sensible presentation order.
4. Place revisions within each approach into a sensible narrative order.
5. Produce an extremely short summary of each revision’s change.
6. Produce a short title for each approach.
7. Optionally produce one concise sentence describing each approach.

The real Git chronology must remain available separately.

The LLM presentation order may differ from chronological order.

For example, an interleaved history:

```text
A1, B1, A2, B2, A3
```

may be presented as:

```text
Approach A: A1, A2, A3
Approach B: B1, B2
```

Never mutate the source SHA order or imply that narrative order is historical order.

The UI must expose both:

* Narrative position.
* Original chronological position or commit timestamp.

# OpenRouter integration

Use OpenRouter’s OpenAI-compatible Chat Completions API format.

Default endpoint:

```text
https://openrouter.ai/api/v1/chat/completions
```

Configuration must come from environment variables:

```text
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_SITE_URL=
OPENROUTER_APP_NAME=LeetCode Solution History
```

Only `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` need to be mandatory when LLM processing is required.

Send headers compatible with OpenRouter:

```http
Authorization: Bearer <OPENROUTER_API_KEY>
Content-Type: application/json
HTTP-Referer: <OPENROUTER_SITE_URL>
X-Title: <OPENROUTER_APP_NAME>
```

Only include optional headers when configured.

Use the endpoint:

```text
POST {OPENROUTER_BASE_URL}/chat/completions
```

Use a request body based on:

```ts
interface OpenRouterChatRequest {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  temperature?: number;
  response_format?: {
    type: "json_schema";
    json_schema: {
      name: string;
      strict: boolean;
      schema: Record<string, unknown>;
    };
  };
}
```

Prefer a low temperature.

Use OpenRouter structured outputs with JSON Schema when the configured model supports them.

Do not depend solely on provider-side validation. Always validate the received payload locally with Zod.

Handle the normalized Chat Completions response shape:

```ts
response.choices[0].message.content
```

Treat missing choices, missing content, refusal responses, malformed JSON, schema violations, rate limits, provider errors, and timeouts as explicit error cases.

Implement:

* Request timeout.
* Bounded retries.
* Exponential backoff with jitter.
* Retry handling for rate limits and transient 5xx errors.
* Useful error messages without leaking API keys.
* A deterministic fallback when LLM generation fails.

Do not log secrets or full authorization headers.

# LLM structured output schema

Create a strict Zod schema and matching JSON Schema for a result shaped approximately as follows:

```ts
interface NarrativeResult {
  approaches: Array<{
    id: string;
    title: string;
    summary: string;
    order: number;
    revisions: Array<{
      sha: string;
      order: number;
      shortChange: string;
    }>;
  }>;
}
```

Validation rules:

* Every input revision SHA must appear exactly once.
* No unknown SHA may appear.
* Approach IDs must be unique and stable within the result.
* Approach ordering values must be unique or normalized deterministically.
* Revision ordering within an approach must be unique or normalized deterministically.
* `shortChange` must be extremely short, ideally one brief clause or sentence.
* Cap summary lengths in the schema.
* Empty approach groups are invalid.
* Every revision must belong to exactly one approach.

Suggested limits:

```text
Approach title: at most 60 characters
Approach summary: at most 160 characters
Revision shortChange: at most 120 characters
```

The LLM prompt must instruct the model:

* Do not judge correctness unless supported by evidence.
* A revision marked `!` must remain marked incorrect.
* Do not invent a test failure reason.
* Do not claim performance complexity unless it is directly inferable.
* Group code by actual algorithmic or structural similarity.
* Treat a substantial rewrite as a distinct approach.
* Treat cleanup, idiomatic refactoring, and micro-optimization as revisions of the same approach when the underlying algorithm is unchanged.
* Prefer concise labels such as:

  * “Union-find”
  * “Prefix component labels”
  * “Hash-map lookup”
  * “Two-pointer scan”
* Return only data satisfying the supplied schema.

# LLM input design

For each problem/language group, provide:

* Problem ID.
* Derived title.
* Language.
* Chronological revision list.
* SHA.
* Commit subject.
* Wrong marker.
* Complete code snapshot.
* Diff from the previous relevant revision.
* Existing narrative classification, when reprocessing an existing group.
* Explicit instructions distinguishing chronology from presentation order.

Keep the prompt deterministic.

Create a prompt-version constant. Include it in cache keys and the generated manifest.

Avoid sending irrelevant repository data.

When a group becomes too large for a single model request:

* Use a deterministic batching strategy.
* First classify or summarize batches.
* Then reconcile batch-level approaches in a final structured call.
* Preserve complete SHA coverage.
* Document the strategy.
* Make token or character limits configurable.

# LLM fallback behavior

The site build must still succeed when:

* No OpenRouter key is present.
* `--no-llm` is supplied.
* OpenRouter is unavailable.
* The model does not support structured outputs.
* The model returns invalid output after retries.

Fallback behavior:

* Preserve existing valid generated narrative output when available.
* Append new revisions using deterministic chronological order.
* If no prior output exists, create one fallback approach:

  * ID: `chronological`
  * Title: `Solution history`
  * Revisions ordered chronologically.
* Create short deterministic summaries from commit comments.
* When a commit comment is empty, use `Updates the solution.`
* Clearly mark generated metadata with an analysis status such as:

  * `llm`
  * `cached`
  * `fallback`
  * `stale`

A failed LLM call must not destroy previously valid narrative data.

# Incremental processing

Create a persisted build manifest at:

```text
generated/manifest.json
```

Use a schema version.

Store at least:

```ts
interface BuildManifest {
  schemaVersion: number;
  sourceRepository: string;
  sourceHeadSha: string | null;
  generatedAt: string;
  parserVersion: string;
  promptVersion: string;

  processedCommits: Record<
    string,
    {
      contentHash: string;
      affectedGroups: string[];
      processedAt: string;
    }
  >;

  groups: Record<
    string,
    {
      problemId: number;
      language: string;
      inputHash: string;
      outputPath: string;
      promptVersion: string;
      model: string | null;
      analysisStatus: "llm" | "cached" | "fallback" | "stale";
      updatedAt: string;
    }
  >;
}
```

Use a stable group key such as:

```text
1971/rust
```

On an incremental build:

1. Load and validate the existing manifest.
2. Resolve the source repository’s current HEAD.
3. Check whether the previous processed HEAD is an ancestor of current HEAD.
4. If it is an ancestor:

   * Parse only commits after the previous HEAD.
   * Determine all affected problem/language groups.
5. If it is not an ancestor:

   * Assume history was rewritten.
   * Perform a complete deterministic re-index.
6. Reconstruct complete histories only for affected groups.
7. Calculate a canonical normalized input hash.
8. Reuse existing LLM output when:

   * Input hash is unchanged.
   * Prompt version is unchanged.
   * Relevant schema version is unchanged.
9. Regenerate affected JSON files.
10. Regenerate the global index.
11. Update the manifest only after successful writes.
12. Use atomic file writes where practical.

Do not treat GitHub Actions cache as authoritative state.

The committed files under `generated/` are the authoritative generated state.

A `--full` run must rebuild deterministic data for every group.

Do not call the LLM when its normalized input hash is unchanged.

# Generated problem JSON

Generate one validated JSON file for each problem/language pair:

```text
generated/problems/<problem-id>/<language>.json
```

Use a schema similar to:

```ts
interface GeneratedProblemLanguagePage {
  schemaVersion: number;

  problem: {
    id: number;
    title: string;
    slug: string;
  };

  language: {
    id: string;
    label: string;
    shikiLanguage: string;
  };

  source: {
    repositoryUrl: string;
    latestPath: string | null;
    latestSha: string | null;
    deleted: boolean;
  };

  statistics: {
    revisionCount: number;
    approachCount: number;
    incorrectRevisionCount: number;
    firstCommittedAt: string | null;
    lastCommittedAt: string | null;
  };

  analysis: {
    status: "llm" | "cached" | "fallback" | "stale";
    model: string | null;
    promptVersion: string;
    inputHash: string;
  };

  approaches: GeneratedApproach[];
  chronologicalRevisionShas: string[];
  warnings: IngestionWarning[];
}
```

Each approach should contain its narrative-ordered revisions.

Each revision must still include its chronological position.

All generated JSON must be validated before writing.

Use stable JSON formatting so Git diffs remain readable.

# Global index JSON

Generate:

```text
generated/index.json
```

This is the frontend’s canonical list of available questions.

It must contain one entry per unique problem ID and summarize all available languages.

Suggested shape:

```ts
interface GeneratedQuestionIndex {
  schemaVersion: number;
  generatedAt: string;
  sourceHeadSha: string | null;
  questions: Array<{
    id: number;
    title: string;
    slug: string;
    languages: Array<{
      id: string;
      label: string;
      route: string;
      revisionCount: number;
      approachCount: number;
      incorrectRevisionCount: number;
      lastCommittedAt: string | null;
    }>;
    firstCommittedAt: string | null;
    lastCommittedAt: string | null;
  }>;
}
```

Sort questions by numeric problem ID by default.

If titles differ between languages for the same problem:

* Prefer the title from the latest revision overall.
* Record a warning.
* Keep language-specific derived titles in the individual page data.

# Favorites configuration

Create a human-editable file:

```text
config/favorites.json
```

Use it to pin selected questions on the home page.

Use a format similar to:

```json
{
  "problemIds": [1, 20, 1971]
}
```

Validate it with Zod during both ingestion and Astro builds.

Requirements:

* Favorites must appear in the exact order specified in `favorites.json`.
* Ignore duplicate IDs after preserving the first occurrence.
* A favorite ID that is not present in `generated/index.json` must not break the build.
* Emit a visible build warning for missing favorite IDs.
* Do not copy favorites into opaque code constants.
* The home page must read this JSON file at build time.
* Updating only `favorites.json` must not require re-running Git ingestion or the LLM.
* The README must explain how to pin and unpin questions.

Optionally allow future expansion using a schema version, but keep the initial file simple.

# Static routes

Generate static routes for:

```text
/
 /problems/<problem-id>/
 /problems/<problem-id>/<language>/
```

Examples:

```text
/
 /problems/1/
 /problems/1/rust/
 /problems/1/java/
 /problems/1971/rust/
```

Use human-readable canonical slugs where useful, but keep stable problem-ID-based paths.

A language-specific page is the primary content page.

The problem landing page should summarize available languages and link to each language-specific page.

Generate a static 404 page.

# Home page

The home page acts as the complete index of solved questions.

It must read from:

```text
generated/index.json
config/favorites.json
```

The page must include:

## Header

* Site title.
* Short description.
* Link to the source GitHub repository.
* Total question count.
* Total language-specific solution count.
* Total revision count.

## Favorites section

* Show only when at least one configured favorite exists.
* Pin favorite questions at the top.
* Preserve the order from `favorites.json`.
* Use a visually distinct but restrained design.
* Include all available language links for each favorite.
* Show revision and approach counts.

## All questions section

Show every solved question.

Each question card or row must display:

* Numeric problem ID.
* Filename-derived question title.
* Available language badges or links.
* Revision count per language.
* Approach count per language.
* Incorrect-revision count where non-zero.
* Latest commit date.
* Favorite indicator where applicable.

## Index controls

Implement lightweight client-side filtering and sorting:

* Search by problem ID.
* Search by title.
* Filter by language.
* Sort by:

  * Problem ID ascending.
  * Problem ID descending.
  * Recently updated.
  * Title.
  * Revision count.
* Option to show favorites only.

Keep the index usable without JavaScript. JavaScript may progressively enhance filtering and sorting.

Do not use a server, database, or runtime API.

Ensure controls are keyboard-accessible and properly labelled.

For large numbers of questions, use an efficient DOM strategy, but do not introduce unnecessary virtualization at this project’s current scale.

# Problem landing page

The route:

```text
/problems/<problem-id>/
```

must display:

* Problem ID.
* Derived title.
* Available languages.
* Revision count for each language.
* Approach count for each language.
* Incorrect revision count.
* First and latest commit dates.
* Links to language-specific pages.
* Back link to the index.

When only one language exists, still generate this landing page.

# Language-specific question page

The route:

```text
/problems/<problem-id>/<language>/
```

must include:

## Header

* Problem ID.
* Filename-derived title.
* Language.
* Link back to the problem landing page.
* Link back to the home index.
* Link to the source repository.
* Link to the latest source file or commit when available.
* Revision count.
* Approach count.
* Incorrect revision count.
* Analysis status.

## Approach navigation

* List all LLM-inferred approaches.
* Show approach title.
* Show concise approach summary.
* Show number of revisions.
* Allow anchor navigation to an approach.

## Approach sections

For each approach:

* Show approach title and summary.
* Display all revisions assigned to that approach.
* Use LLM narrative ordering.
* Display the revisions side by side on wide screens.
* Use a horizontally scrollable comparison region when needed.
* On small screens, show one full-width revision at a time or use horizontal snapping.
* Keep each code column readable.
* Do not squeeze many code columns into unusably narrow widths.

## Revision card

Each revision card must include:

* Short SHA.
* Commit timestamp.
* Original chronological position.
* Narrative position within its approach.
* Original commit comment.
* Extremely short LLM change summary.
* Incorrect badge when marked with `!`.
* Source filename/path.
* Link to the source commit.
* Copy-code button.
* Complete source snapshot.
* Build-time syntax highlighting.
* Optional toggle between full code and diff where a diff exists.

Wrong revisions must be clearly marked but must remain fully visible.

Use restrained wording such as:

```text
Marked incorrect by the author
```

Do not invent failure reasons.

## Comparison behavior

Implement:

* Horizontal scrolling for multiple code cards.
* CSS scroll snapping where helpful.
* Sticky revision-card headers inside the comparison area where practical.
* A “show full code” and “show diff” control when diff data exists.
* Independent code scrolling by default.
* Optional synchronized vertical scrolling only if it can be implemented robustly and accessibly without excessive complexity.

The site must remain useful with JavaScript disabled. Full code should be the non-JavaScript default.

# Syntax highlighting

Use Shiki at build time.

Map normalized languages to supported Shiki grammar names.

Do not run a browser syntax-highlighting library after page load.

Create a reusable highlighting utility.

Handle unsupported languages gracefully by rendering escaped plain text.

Include line numbers.

Highlight added and removed lines in diff mode where practical.

Ensure generated highlighted HTML is treated safely. Only render HTML produced by the local highlighter, never raw LLM output.

# Styling

Use Tailwind CSS.

Create a restrained developer-tool aesthetic:

* Strong readability.
* Neutral colors.
* Clear hierarchy.
* Dense enough for code comparison without appearing cramped.
* Responsive layouts.
* Excellent dark mode.
* Accessible contrast.
* Visible keyboard focus states.
* Minimal animation.
* No gradients unless extremely subtle.
* No oversized marketing hero.
* No generic dashboard template appearance.

Use CSS custom properties or Tailwind theme tokens for consistent design.

Support system light/dark preference.

Optionally include a small persisted theme toggle, but the site must work correctly without it.

Code blocks should use a monospace stack and preserve horizontal overflow.

Avoid adding a component framework solely for styling.

# Accessibility

Meet practical WCAG AA expectations.

Include:

* Semantic landmarks.
* Logical heading hierarchy.
* Keyboard-operable controls.
* Visible focus states.
* Descriptive link text.
* Proper labels for form controls.
* Accessible copy-button feedback.
* Sufficient color contrast.
* Non-color indicators for incorrect revisions.
* Reduced-motion handling.
* Correct table or list semantics where applicable.

Do not make horizontal scrolling the only way to discover revisions. Include revision labels and counts.

# SEO and metadata

For every generated page, include:

* Descriptive `<title>`.
* Meta description.
* Canonical URL support configurable through `config/site.json`.
* Open Graph metadata.
* Basic Twitter card metadata.
* Meaningful heading structure.

Generate:

* `sitemap.xml`
* `robots.txt`

Use static generation.

# Site configuration

Create:

```text
config/site.json
```

Suggested content:

```json
{
  "title": "LeetCode Solution History",
  "description": "An explorable history of iterative LeetCode solutions.",
  "siteUrl": "https://example.pages.dev",
  "sourceRepositoryUrl": "https://github.com/Kainoa-h/BOMBBOMBOBMOBOMBOMBOMBOMBBOMB"
}
```

Validate the configuration.

Use the source repository URL from this file rather than repeating it throughout the code.

Document which values must be changed before deployment.

# Source links

Construct commit URLs as:

```text
<sourceRepositoryUrl>/commit/<sha>
```

Construct file-at-revision URLs as:

```text
<sourceRepositoryUrl>/blob/<sha>/<encoded-path>
```

Correctly encode path segments.

Do not assume the default branch name when linking to historical content.

# Build validation

Create commands such as:

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "pnpm validate:generated && astro build",
    "preview": "astro preview",
    "ingest": "tsx scripts/ingest.ts",
    "ingest:full": "tsx scripts/ingest.ts --full",
    "validate:generated": "tsx scripts/validate-generated.ts",
    "typecheck": "astro check && tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "...",
    "format": "...",
    "check": "pnpm lint && pnpm typecheck && pnpm test && pnpm build"
  }
}
```

Choose appropriate linting and formatting tools compatible with TypeScript 7 and Astro 7.

The build must fail when generated JSON violates its schema.

The build should not fail merely because recoverable ingestion warnings exist.

# Tests

Add meaningful Vitest tests for:

## Commit parsing

Test:

```text
1971: initial solution
1971!: broken solution
rust 1971: use union find
java 1!: incorrect map approach
cpp 42: optimize
malformed message
```

Verify omitted language compatibility.

## Filename title parsing

Test:

```text
1971-find-if-path-exists-in-graph.rs
1_two_sum.rs
20-valid-parentheses.java
Two Sum.java
problem.rs
```

Verify ID removal, separator conversion, title casing, and fallback behavior.

## Language inference

Test extensions, directory names, aliases, omitted-language Rust behavior, and conflicts.

## History grouping

Test:

* Multiple approaches interleaved chronologically.
* Multiple languages for one problem.
* Multiple problems modified by one commit.
* Renames.
* Deletions.
* Duplicate code snapshots.
* Wrong revisions.

## Narrative validation

Test:

* Missing SHA.
* Duplicate SHA.
* Unknown SHA.
* Duplicate approach IDs.
* Invalid ordering.
* Excessively long summaries.
* Valid LLM output.

## Incremental manifest behavior

Test:

* Unchanged input skips LLM work.
* Prompt-version change invalidates narrative cache.
* New commit affects only the relevant group.
* Rewritten history triggers a full re-index.
* Failed generation does not overwrite valid prior data.

## Favorites

Test:

* Ordering.
* Duplicate IDs.
* Missing IDs.
* Empty favorites.
* Invalid JSON schema.

Use temporary Git repositories in integration tests where helpful.

# Initial generated data

The project must build immediately after installation even before the first real source ingestion.

Provide either:

* A small schema-valid example generated data set clearly marked as sample data, or
* An empty but valid generated index and manifest that produce a useful empty-state home page.

Prefer an empty valid state to avoid publishing fake questions.

The home page empty state should explain that ingestion must be run.

# GitHub Actions: validation workflow

Create:

```text
.github/workflows/validate.yml
```

Trigger on:

* Pull requests.
* Pushes to the frontend repository’s primary branch.

It must:

* Check out the frontend repository.
* Install pnpm.
* Install the required Node.js version.
* Run `pnpm install --frozen-lockfile`.
* Run linting.
* Run type checking.
* Run tests.
* Validate generated content.
* Build Astro.

Do not require an OpenRouter key for normal pull-request validation.

# GitHub Actions: ingest and deploy workflow

Create:

```text
.github/workflows/ingest-and-deploy.yml
```

Trigger on:

```yaml
repository_dispatch:
  types: [leetcode-updated]

workflow_dispatch:
```

For manual dispatch, support optional inputs where useful, such as:

* Full rebuild.
* Skip LLM.
* Source SHA override.

Use a concurrency group to prevent overlapping production ingestion:

```yaml
concurrency:
  group: leetcode-site-production
  cancel-in-progress: false
```

Required workflow behavior:

1. Check out the frontend repository with full history.
2. Check out the source LeetCode repository into:

   ```text
   ./source-solutions
   ```
3. Use `fetch-depth: 0` for both repositories.
4. For `repository_dispatch`, check out the exact SHA supplied in:

   ```text
   github.event.client_payload.source_sha
   ```
5. For manual runs without a SHA, use the source repository’s default branch.
6. Install pnpm and Node.js.
7. Run `pnpm install --frozen-lockfile`.
8. Run ingestion.
9. Validate generated content.
10. Run tests and build.
11. Commit changed files under `generated/` back to the frontend repository.
12. Avoid making an empty commit.
13. Push generated changes safely.
14. Deploy `dist/` to Cloudflare Pages using Wrangler.

Use secrets:

```text
OPENROUTER_API_KEY
OPENROUTER_MODEL
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

Optionally support:

```text
OPENROUTER_SITE_URL
OPENROUTER_APP_NAME
```

Set GitHub workflow permissions narrowly.

For committing generated data:

```yaml
permissions:
  contents: write
```

Use a bot identity.

Include the ingested source SHA in the generated commit message.

Ensure the workflow does not recursively trigger itself in an infinite loop.

Since `ingest-and-deploy.yml` does not need to run on ordinary frontend pushes, committing generated data should not re-run the ingestion workflow.

It may trigger the validation workflow, which is acceptable.

# Cloudflare Pages deployment

Use direct upload through Wrangler.

Provide a command equivalent to:

```bash
pnpm wrangler pages deploy dist --project-name="$CLOUDFLARE_PAGES_PROJECT"
```

Support the project name through an environment variable or repository variable:

```text
CLOUDFLARE_PAGES_PROJECT
```

Provide a sensible documented fallback in `wrangler.toml` if supported by the selected Wrangler version.

The site is static. Do not add Cloudflare Functions.

Document how to create the Cloudflare Pages project and required API token permissions.

# Source repository trigger workflow

The frontend repository cannot directly create a workflow in the separate source repository at runtime, but include a complete example in the README and also place a copy at:

```text
docs/source-repository-workflow.yml
```

The source repository workflow must trigger on pushes to its primary branch and dispatch:

```text
leetcode-updated
```

to the frontend repository.

Use a payload containing:

```json
{
  "source_sha": "<current SHA>",
  "source_ref": "<current ref>"
}
```

Do not send source code in the dispatch payload.

Provide a workflow similar to:

```yaml
name: Trigger solution site

on:
  push:
    branches:
      - main

jobs:
  dispatch:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger frontend build
        env:
          GH_TOKEN: ${{ secrets.FRONTEND_DISPATCH_TOKEN }}
          FRONTEND_REPOSITORY: Kainoa-h/<frontend-repository-name>
        run: |
          gh api \
            --method POST \
            "repos/${FRONTEND_REPOSITORY}/dispatches" \
            -f event_type="leetcode-updated" \
            -F client_payload[source_sha]="${GITHUB_SHA}" \
            -F client_payload[source_ref]="${GITHUB_REF}"
```

Explain that the source repository’s default `GITHUB_TOKEN` is generally not sufficient to dispatch to another repository.

Document two supported authentication choices:

1. Fine-grained personal access token scoped only to the frontend repository.
2. GitHub App installation token.

Recommend the GitHub App approach for long-term use and the fine-grained token for the simplest initial setup.

# Ingestion writes and commits

Generated files must be stable and reviewable.

Requirements:

* Use deterministic key ordering where practical.
* Use two-space JSON indentation.
* End files with a newline.
* Do not include volatile timestamps in hashes.
* Avoid rewriting unchanged files.
* Write files atomically.
* Delete obsolete generated group files when a group no longer exists after a full re-index.
* Never delete files outside the generated directory.
* Print a concise summary:

  * Commits parsed.
  * Groups affected.
  * Groups regenerated.
  * LLM calls made.
  * Cache hits.
  * Warnings.
  * Errors.
  * Current source HEAD.

# Security requirements

* Never expose `OPENROUTER_API_KEY` to Astro client bundles.
* Run all LLM processing only in the Node.js ingestion script.
* Never embed secrets in generated JSON.
* Escape source code before rendering.
* Render LLM summaries as plain text, not arbitrary HTML.
* Validate all configuration and generated files.
* Avoid shell command interpolation with untrusted paths.
* Use argument arrays when spawning Git.
* Restrict file reads and writes to expected directories.
* Do not execute code from the source repository.
* Do not run solution files.
* Do not install dependencies from the source repository.

# Performance requirements

At the current repository scale, correctness is more important than extreme optimization, but implement sensible caching.

Requirements:

* Avoid rereading unchanged commits during incremental builds where possible.
* Avoid repeated `git show` calls for the same object within one run.
* Limit concurrent OpenRouter requests.
* Make concurrency configurable.
* Cache syntax-highlighted output during an Astro build where practical.
* Do not make network requests during normal Astro page rendering.
* Generate all routes from local JSON.
* Keep client-side JavaScript small.

# Logging

Use concise structured or consistently prefixed logs.

Example:

```text
[git] Parsed 8 new commits
[group] Affected groups: 1971/rust, 1/java
[llm] 1971/rust: cache hit
[llm] 1/java: generated using <model>
[write] Updated generated/problems/1/java.json
[done] 2 groups processed, 1 API call, 1 warning
```

Provide verbose logging through an optional flag.

Never print full code snapshots by default.

# README

Write a complete README containing:

* Project purpose.
* Architecture overview.
* Data flow diagram in Mermaid.
* Prerequisites.
* Node.js and pnpm requirements.
* Installation.
* Local development.
* First full ingestion.
* Incremental ingestion.
* No-LLM fallback mode.
* OpenRouter configuration.
* Supported environment variables.
* How filename title derivation works.
* How commit parsing works.
* How wrong revisions are represented.
* How narrative ordering differs from chronological ordering.
* Generated file schemas.
* How to configure favorites.
* How to configure site metadata.
* How to add a language mapping.
* How to update the LLM model.
* How prompt-version cache invalidation works.
* How to trigger the frontend from the source repository.
* GitHub token and GitHub App options.
* Cloudflare Pages setup.
* Required repository secrets and variables.
* Recovery from rewritten Git history.
* Full rebuild instructions.
* Troubleshooting malformed commits.
* Troubleshooting invalid LLM output.
* Troubleshooting Cloudflare deployment.
* Testing and validation commands.

Include exact commands.

# Implementation quality

Use:

* Small focused modules.
* Explicit types.
* Zod at external and persisted-data boundaries.
* Dependency injection for Git command execution and OpenRouter calls where it improves testing.
* Pure functions for parsing and normalization.
* Clear error classes or typed results.
* No `any` unless unavoidable and locally justified.
* No broad `as unknown as` assertions.
* No placeholder TODOs for core behavior.
* No dead code.
* No fake API implementations in production paths.
* No hardcoded sample LLM response in normal execution.
* No dependency on a proprietary SDK when direct standards-compatible HTTP is sufficient.

# Required acceptance criteria

The implementation is complete only when all of the following are true:

1. `pnpm install` succeeds.
2. `pnpm typecheck` succeeds.
3. `pnpm test` succeeds.
4. `pnpm build` succeeds without an OpenRouter key using valid empty or cached generated data.
5. `pnpm ingest --source <full-clone-path> --full --no-llm` produces valid deterministic output.
6. Old commits without language prefixes are interpreted as Rust unless file evidence proves otherwise.
7. Wrong commits with `!` are visibly represented.
8. Question titles are derived from filenames.
9. One static language-specific page is generated per problem/language pair.
10. Every revision is displayed with complete highlighted source.
11. Revisions are grouped into approaches.
12. Narrative and chronological positions are both preserved.
13. The home page lists every question from `generated/index.json`.
14. Favorites from `config/favorites.json` are pinned in configured order.
15. Missing favorite IDs do not fail the build.
16. Home-page filtering and sorting work.
17. Incremental builds skip unchanged LLM inputs.
18. Rewritten source history causes a safe full re-index.
19. Invalid OpenRouter output cannot corrupt valid prior data.
20. The frontend repository workflow can ingest, commit generated files, build, and deploy.
21. The documented source-repository workflow can dispatch the source SHA.
22. No API key is included in browser output.
23. The generated site is fully static.
24. The README is sufficient for a new maintainer to configure and deploy the project.

# Execution instructions

Start by inspecting the current repository.

Then:

1. Create or update the project structure.
2. Install and configure dependencies with pnpm.
3. Implement shared schemas.
4. Implement deterministic Git ingestion.
5. Implement filename-derived titles.
6. Implement manifests and incremental caching.
7. Implement the OpenRouter client and narrative processor.
8. Implement deterministic fallback behavior.
9. Implement generated index construction.
10. Implement the Astro pages and Tailwind styling.
11. Implement Shiki highlighting.
12. Implement tests.
13. Implement GitHub Actions.
14. Implement Cloudflare Pages configuration.
15. Write the README.
16. Run all validation commands.
17. Fix all failures.
18. Provide a final concise summary of:

    * Files created.
    * Major design choices.
    * Commands run.
    * Test and build results.
    * Any assumptions that remain.

Do not merely describe what should be built. Build it.
