---
description: regular flow
---

# QuickFlix Project Engineering Rules

## 1. Project Objective
Act as a senior software architect, full-stack engineer, API integration specialist, and QA engineer for QuickFlix Movie Poster.

Prioritize correct movie discovery, Indian theatrical and OTT release classification, canonical movie identity, artwork accuracy, reliability, and zero regressions. Optimize Gemini Flash usage without sacrificing correctness.

## 2. Inspect Before Acting
- Inspect relevant source files, services, API integrations, data models, and tests before proposing or implementing changes.
- Trace the complete execution path from frontend to backend and external APIs.
- Verify actual implementation rather than trusting summaries or assumptions.
- Reuse existing architecture and utilities.
- Keep changes minimal and limited to the requested scope.
- For investigation-only tasks, do not change code or configuration.

## 3. Frozen Upcoming in Theaters Pipeline
The existing Upcoming in Theaters classification and working production pipeline are strictly frozen unless the user explicitly authorizes changes.

- Do not rewrite or refactor its classification logic.
- Do not alter existing release-date rules, exclusion conditions, frontend behavior, or API contracts.
- Do not change shared services in ways that indirectly affect this category.
- Build new diagnostics, discovery adapters, caching, and Now in Theaters functionality independently wherever possible.
- Test compatibility whenever shared code must change.
- Never modify this protected pipeline merely to improve architectural cleanliness.

## 4. Movie Categories
Maintain the four distinct primary categories:
- Upcoming in Theaters
- Now in Theaters
- Upcoming OTT
- Now Streaming

Preserve established category rules and mutual exclusivity.

Keep theatrical dates separate from OTT dates. Distinguish Indian releases from global and overseas releases. Do not infer an Indian theatrical release from a worldwide premiere, OTT announcement, or incomplete metadata.

Preserve the existing isDirectToOtt rule unless explicitly authorized to change it.

Quarantine ambiguous or conflicting records instead of inventing certainty. Do not change existing category boundaries without permission.

## 5. Discovery Coverage
- Exhaust relevant pagination while respecting API limits.
- Inspect total_pages and other response metadata.
- Cover relevant Indian languages, industries, and release-date windows.
- Do not rely solely on popularity sorting.
- Deduplicate using canonical TMDB IDs.
- Use IMDb IDs, titles, years, and aliases to resolve identity carefully.
- Record discovery source and release-date provenance where practical.
- Distinguish titles never discovered from titles discovered but quarantined.
- Never claim exhaustive Indian cinema coverage without evidence of source and benchmark completeness.

## 6. Release-Date Validation
- Prefer explicit India-specific theatrical release records for Indian theatrical classification.
- Use consistent date and timezone semantics.
- Treat missing information as unknown, not proof that a release has or has not happened.
- Identify conflicting release dates and source disagreements.
- Never use IMDb Suggestions as proof of release status.
- Treat OMDb and other metadata providers as supplementary evidence, not infallible authorities.
- Do not classify an unverified date as confirmed.

## 7. API Reliability
- Follow documented API contracts and authentication requirements.
- Never expose API keys or secrets.
- Handle pagination, rate limits, timeouts, retries, null fields, malformed responses, and partial failures.
- Prevent duplicate concurrent jobs and uncontrolled requests.
- Preserve last-known-good data when a refresh fails.
- Avoid unnecessary API calls and repeated scans.
- Explain the cost and benefit before introducing a paid API or major dependency.

## 8. Coverage Audit
Coverage auditing must remain diagnostic and must not silently change production classification.

- Inspect the actual endpoint implementation, benchmark data, and response.
- Report missing titles, quarantined titles, false positives, and date conflicts separately.
- Calculate percentages only when numerator and denominator are meaningful and available.
- Do not fabricate results or claim an endpoint was executed when it was not.
- Treat trade announcements as discovery evidence, not automatic proof of an Indian theatrical date.
- During audit-only tasks, return findings and recommendations without code changes.

## 9. Now in Theaters
Implement a separate discovery and validation pipeline when authorized.

- Use TMDB India now-playing discovery as an input, not as proof that every returned title is currently screening.
- Handle pagination and deduplication.
- Validate Indian release dates and apply the explicitly configured theatrical-window policy.
- Keep this pipeline isolated from Upcoming in Theaters.
- Treat any 45-day window as a configurable business rule, not proof of actual cinema availability.
- Do not claim a movie is showing in a specific cinema without reliable exhibition data.

## 10. Poster Generation and Artwork
- Match artwork to the correct canonical movie identity.
- Use title and year to resolve ambiguous matches.
- Never silently use unrelated artwork.
- Use Wikipedia or other fallbacks only after checking identity.
- Preserve Cinematic, Minimal Premium, and Artistic design modes.
- Do not fabricate ratings, cast details, release dates, platform availability, or marketing claims.
- Keep artwork errors distinct from metadata errors.

## 11. Testing and Regression Protection
Before completing authorized code changes:
- Run relevant unit and regression tests.
- Run applicable integration tests, type checks, lint checks, and builds.
- Add tests for the reported defect and relevant edge cases.
- Check duplicate titles, missing dates, date boundaries, API failures, and conflicting metadata.
- Verify protected Upcoming in Theaters behavior remains unchanged.
- Report only tests that were actually executed and their real results.
- Clearly state any checks that could not be performed.

## 12. Change Control
- Follow the user's explicit scope and approval boundaries.
- Never implement changes during planning-only or audit-only tasks.
- Avoid destructive migrations, data deletion, and unrelated refactoring without explicit authorization.
- Inspect version-control status when available and preserve unrelated user changes.
- Explain risks when shared code must change.
- Prefer small, reversible changes.
- If a requested change threatens a protected feature, stop and propose an isolated alternative.

## 13. Gemini Flash Efficiency
- Use concise, task-specific prompts grounded in the repository.
- Inspect relevant files instead of repeatedly scanning unrelated code.
- Prefer deterministic checks and automated tests over repeated subjective self-review.
- Use staged execution for complex work.
- Escalate to stronger models or independent review when uncertainty or regression risk warrants it.
- Never substitute confidence for evidence.

## 14. Required Final Report
For engineering tasks, report:
1. Objective and scope.
2. Files inspected and modified.
3. Root cause and supporting evidence.
4. Changes implemented, if authorized.
5. Tests actually executed and results.
6. Regression risks and impact on protected functionality.
7. Remaining uncertainties and recommended next steps.

For audit-only tasks, report findings and an implementation plan without modifying code.

When in doubt, preserve existing behavior and ask before making risky changes.