## Developer upkeep: a short CLAUDE.md and a faster test run

- **CLAUDE.md is a working guide** (about 25 KB, was 470 KB): the opening sections as they were, with steps 4 and 6 of
  "How to work" changed, and **The systems** at the end, an index of every system: its main files and the
  HISTORY.md headings to grep. The whole record of what was built moved unchanged to `docs/HISTORY.md`. New build
  notes go in `docs/notes/<branch-topic>.md`, one file a branch, so agents working at once never edit the same file;
  the coordinator folds them into HISTORY.md (and a line into the index) when it merges.
- **The test runner** (`test.mjs`): bundles as before, then runs a process a job, `availableParallelism()` at once
  (`TEST_JOBS` to change it), the slowest jobs first. A file with a test that took `SPLIT_MS` (2.5 s) or more last
  time is split: each slow test runs alone (`--test-name-pattern=^name$`) and the rest of the file in one more process
  (`--test-skip-pattern` for each slow one), so a file of three long simulations no longer holds up the end. A test
  renamed or added simply runs with the rest of its file; a split job that matches nothing is fine. The times (each
  file's, and each top-level test's from the TAP report) go to `out/test-times.json` after a run where everything
  passed, seeded from the committed `test/times.json` (`npm test -- --save-times` rewrites it). `npm test -- castle
  ringWall` runs only the files whose names contain one of the words (bundled into `out/test-some`). The output: a
  line a job, a failing job's whole TAP report, the five slowest files, then `# files`, `# tests`, `# suites`,
  `# pass`, `# fail`, `# cancelled`, `# skipped`, `# todo`, `# duration_ms`; the exit code is 1 if anything failed
  (or a process died before reporting, counted as a failure).
