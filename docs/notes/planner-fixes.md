## Planner fixes: knights' first research, every people researches

Changes the HISTORY.md section "Research picked by hand" (the planner's topic scores).

- **Knights researched the long way round.** Their start list lacks `basic_shelter`, and a prerequisite inherits most of
  the worth of the topic behind it (`LEADS_SHARE`), so Fire Keeping then Oral Tradition beat Basic Shelter. `Needs.noHome`
  (`sim/planner.ts`) is true while no housing building is unlocked; then a topic with no prerequisites that opens a home
  scores 80 (not 30) for beds.
- **`test/originPlanner.test.ts`**: for every origin, a town with the autopilot on runs 8 days and must finish a topic.
