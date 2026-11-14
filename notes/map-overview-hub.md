# New map: one-page overview (2026-11-14)

Status: planning is done. Nothing is built. Full detail: notes/map-master.md (sections 1 to 8). This page is an overview for reading, not a build request.

## The map
- 1,500 x 1,800 m (x -450..1050, z -1200..600). The old 540 x 480 m map stays where it is (offset 0), west and south-west. The sea is the south end; later growth goes north, east and west.
- 100 m chunks, a 5 x 5 ring loaded around the player, as seamless as possible. Ground stays at 0; rivers, the lake and the sea are dug in.
- Water flows: stream (from the pass) -> Blackstone Lake -> river west past Ironwood, bends south at about x -330 -> Kaspian Bay (the bay and the harbor town share the name).

## Regions
| Region | Where | What it is |
|---|---|---|
| Ironwood | old map | downtown, hotel start, new streets, 20 shops |
| Eastbank | old map | Ridgeline offices moved by the warehouse; old office = Freight Exchange; gas station sells snacks |
| Husky Ranch | old farm, grows west | farming, 7 animal types, laid-back jobs |
| Blackstone Pass and Lake | north-east | hunting (bow first, licence), fishing, ATV loop, camps; Eden Outdoors at the lake car park; peaks about 100 m |
| Eden Industries | east | factory halls: welding, laser, CNC, assembly, shipping; owner Bruce Hughes |
| Kaspian Bay | south coast | harbor town: docks, ferry, fish market, boats, tourism |
| Plots P1 to P9 | scattered | buyable land, one plot per player |

## Rules decided
- Crime: licence, no-weapon zones (weapon put away automatically), patrols as witnesses, 5 s to comply for a ticket, arrest with holding, fines become weekly debt, Standing can go negative and blocks jobs. Chase like GTA; three forces (Ironwood PD, Blackstone Rangers, Kaspian Bay Police).
- ATVs: several models, default handling in notes/atv-handling-design.md; mud and dirty paint in now.
- Water: moving, stylised, bed visible in shallows; swimming later.
- Crowds: 16 to 20 NPC vehicles and people near the player, to be tested on the real GPU. Fuel: no change yet.
- Welding job after Eden Industries exists; Tier 5 = ATV frame, utility trailer (flatbed bed on hold).

## Build order (about 70 agent runs, 7 to 9 weeks)
| Phase | Goal | Models |
|---|---|---|
| P0 | planks bug (done), rename Ironwood, trees, move rooms | Haiku / Sonnet |
| P1 | frame and streaming (riskiest) | Opus brief, Sonnet builds |
| P2 | water and road data | Sonnet |
| P3 | Ironwood grows, hotel start | Sonnet; Opus for the save format |
| P4 | Blackstone and Kaspian Bay | Sonnet |
| P5 | Eden Industries, ranch, harbor | Sonnet |
| P6 | life and law | Sonnet; Opus for the law save |
| P7 | plots and multiplayer | Opus |
| P8 | look pass and tuning | Sonnet; Fable only if the user says yes |

Rule: one stage per run, stop and report, the user checks FPS and commits by hand. Dense files (game.js in about 45 stages) are never edited by two stages at once.

## Waiting for the user
Plot prices, fast travel, lone sleeper in co-op, Eden products beyond Tier 5, Ridgeline's new office / Hal / Bruce's terminal, ATV numbers per model, chase end rules, fog over the lake, visual overhaul timing, which stages get Fable.
