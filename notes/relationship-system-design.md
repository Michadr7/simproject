# Relationship Meter & Romance Design (`dist/relationships.js`)

Unified 0-100 Relationship Meter across all NPCs, plus named baker **Gemma Atkins** (`gemma`) at Ironwood Bakery with a dedicated Friendship + Romance/Partner track.

## 1. Tracks & Tiers
- **Friendship Track (`points`: `0-100`, all NPCs):**
  - `Stranger` (`0-4`)
  - `Acquaintance` (`5-19`)
  - `Friend` (`20-49`)
  - `Close Friend` (`50-79`)
  - `Best Friend` (`80-100`)
- **Romance Track (`romance`: `0-100`, eligible NPCs when player body matches preference):**
  - **Gemma Atkins (`gemma`)**: female Head Baker at Ironwood Bakery. Romance track unlocks when **`playerBody === 'male'`** AND **Friendship >= 20 (`Friend`)**.
  - Female players can build Gemma's Friendship all the way to `100` (`Best Friend`), receive loved-gift reactions, discounts, and bakery favor interactions; Romance stays locked cleanly.
  - Romance Tiers / Status:
    - `Warm Spark` (`0-14`)
    - `Crush` (`15-39`)
    - `Dating` (`40-69`, milestone ask `'ask-date'` unlocked at Friendship `>= 35` & Romance `>= 40`)
    - `Partner` (`70-100`, milestone ask `'ask-partner'` unlocked at Friendship `>= 50` & Romance `>= 70`)

## 2. Daily Actions & Progression
- **Daily Chat** (`1/day`): `+2` Friendship (plus `+1` standing sync).
- **Shop Purchase Bond** (`1/day`): `+1` Friendship when buying at Gemma's bakery counter.
- **Gifts**:
  - Loved by Gemma: `bouquet` (`+8F / +10R`), `coffee` (`+6F / +6R`), `flour-bag` / `eggs` / `apple` (`+5F / +4R`).
  - Standard gifts: `+3F / +2R`.
  - Romance gift bonus applies at most once per game day.
- **Romantic Actions** (`male` player, unlocked at Friendship `>= 20`):
  - **Compliment Her Baking** (`1/day`): `+1` Friendship, `+4` Romance.
  - **Share Coffee After the Rush** (`1/day`): `$2.50` (free once Dating or Partner), `+3` Friendship, `+8` Romance, `+10` Energy & warm comfort boost.
  - **Partner Daily Treat** (`status === 'partner'`, `1/day`): free fresh coffee & pastry (`Food +25`, `Thirst +20`, `Energy +20`, warm comfort boost).

## 3. UI & Persistence
- **Save storage**: optional `progress.relationships[id]` (omitted when empty; zero `SCHEMA` bump). Roster NPCs continue to store base points in `progress.standing.people[id]` and crowd/staff NPCs in `progress.crowdLife[id]`, unified by `relationshipOf(progress, npcOrId, playerBody)`.
- **`#talk` Panel & Phone Contacts (`Contacts` / `phone-people.js`)**: render live Friendship progress bar + Romance Hearts bar (when unlocked) via `relationshipMeterSpec(rel)`.
