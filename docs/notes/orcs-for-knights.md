## The orcs in place of the knights

The owner's call: "Remove knights and bring in orcs." Changes "Five peoples to found a town as"
(`docs/notes/five-origins.md`). `PLAYABLE_ORIGINS` (`data/origins.ts`) is now settlers, dwarves, orcs, lich and vampire
(Blood Court). The knights (the Exiled Order) are hidden like the other seven: older knight towns load and play as
before, and knights still turn up as strangers, rivals and powers. Their art stays (run, hurt, sword, axe and hammer
looks were drawn on Oct 23).

The orcs' art: the three cast looks (`art/iso/folk/orcs/`: brute, woman, shaman) with walk, idle, attack (a punch),
death, children, and one tool each (the brute an axe, the woman and the shaman a hammer). Not yet drawn: run, hurt and
a weapon look, as the knights, lich and Blood Court have (`tools/pixellab/`, about 300 generations).

Tests: `test/playableOrigins.test.ts` (the five offered, the knights among the hidden peoples whose towns still step).
