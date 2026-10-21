## The Studies menu, revamped, and the research queue kept free of repeats

Changes "Research picked by hand" and "Every menu in sub-tabs".

- **Duplicates.** The sim already refused a topic that was queued or picked, and a test (`test/researchDupes.test.ts`) pins that. As a second guard `orderQueue` (`sim/research.ts`) now drops any repeat from `queue` and `picked`. The panel also ignores the same queue or remove command sent twice within 600 ms (`send` in `panel/researchPanel.ts`), so one tap cannot act twice.
- **The menu** (`panel/researchPanel.ts`, CSS `.rs-*` in `panel/panel.html`): a "Studying now" card (name, bar, time left, who studies it), "Studying next" (the queue: ✋ First / ▲ ▼ reorder, ✕ remove, all 44px taps), "Next to study" (topics that can be added, by line via `laneName`, each with time and what it unlocks on one line, `+ Add`), "Stations", and the tech tree. Tapping a topic's name opens its card.
- **Tabs:** `GROUPS.research` in `panel/subtabs.ts` gains "Next up" (`^Next to study`).
