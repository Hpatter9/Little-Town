#!/bin/sh
# walk and idle for every look first, then attacks, then deaths, while the month's generations last
P="robot merfolk nomads fae alchemists knights"
for m in walk,idle attack death; do
  MOVES_ONLY=$m SLOTS=8 STATE=pl/people_looks_state.json python3 pl_people.py $P >> pl/people_anim.out 2>&1
done
