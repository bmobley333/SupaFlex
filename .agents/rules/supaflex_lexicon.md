# Canonical SupaFlex Lexicon & Tactical Invariants

> [!IMPORTANT]
> **Authoritative Source of Truth:**
> This rule enforces canonical SupaFlex game terminology, tactical action/usage invariants, UI labeling standards, and database/code accessor mappings across all AI operations in the SupaFlex repository.

---

## 1. Strictly Prohibited & Deprecated Terms

The following legacy terms are **100% deprecated** and must **NEVER** appear in user-facing UI labels, tooltips, or new feature designs:

| Deprecated / Prohibited Term | Canonical SupaFlex Replacement | Notes / Rationale |
| :--- | :--- | :--- |
| ❌ **Relic** | **Artifact** | All high-tier items are strictly called **Artifacts**. |
| ❌ **Hardware** | **Exotic Gear** / **Exotics** | Advanced, alien, or unconventional technology is **Exotic Gear**. |
| ❌ **Function** / **Combat Function** | **Exotic Powers** / **Exotics** | AP-activated abilities granted by gear are **Exotic Powers**. |
| ❌ **Vault** | **Gear Manager** | There is no separate "Vault". All character gear is active. |
| ❌ **Loadout** | **Gear List** / **Equipped** | SupaFlex has no loadout limits; all owned gear is active. |
| ❌ **Wit** / 🧠 | **Mind (👁️)** | Wit never existed. The attribute is strictly Mind with the 👁️ icon. |
| ❌ **Grit / Guard** | None (Deprecated) | Not a recognized SupaFlex mechanic. Legacy code properties remain passive. |
| ❌ **Bulk** / **Encumbrance** | **Zero Encumbrance** | SupaFlex is an encumbrance-free and bulk-free system. |
| ❌ **Starred** | **Wishlist** | Desired gear wishlist (stored under legacy `starred_magic_items`). |
| ❌ **Trauma** | **Wounds (Wnds / Wnd)** | Damage suffered to Vitality after Armor reduction (`Wnds = Dmg - Armor`). |
| ❌ **XP** | **Adventure Points (AP)** | Character progression points are strictly **AP**. |
| ❌ **Conditions** / **Status Effects** | **Hazards** | Status debuffs (`Prone`, `Stunned`, `Blinded`, `Poisoned`, `Weakened`). |
| ❌ **Speed** | **MR / Jump (👣)** | Movement Rate and Jump distance are designated as MR or 👣. |
| ❌ **Quests** / **Modules** | **Adventures** | Campaign scenarios are strictly Adventures. |
| ❌ **Bestiary** | **Monsters** | Adversary catalog is strictly Monsters. |

---

## 2. Core Game Systems & Taxonomy Invariants

### 1. Gear Master Taxonomy
* **All possessions are Gear.**
* Gear is subdivided into **EXACTLY four categories**:
  1. **Weapons** (Melee, Hurled, Shot)
  2. **Armor** (Exploding DR die: `d4`, `d6`, `d8`, `d10`, `d12`)
  3. **Shields** (Hand-held / strapped, Max Block rating)
  4. **Supplies** (Consumables, kits, exploration utilities)
* **Never confuse Supplies and Gear** or use them interchangeably.

### 2. The 5 Core Attributes (UI Density Standard)
* Use the five icons **`✨💪👁️🏃🫀` without text labels** in most UI and effect contexts:
  1. **Magic (✨):** Supernatural, sorce, psionic, and arcane manifestations.
  2. **Might (💪):** Physical power, melee attack/damage, lifting, blocking.
  3. **Mind (👁️):** Intelligence, technical hacking, logic, perception, shot weapon attacks.
  4. **Motion (🏃):** Speed, reflexes, acrobatics, dodging, hurled attacks.
  5. **Moxie (🫀):** Spirit, charisma, willpower; **directly derives Vitality (Vit)**.
* **MR & Jump (👣):** `👣` is the unified icon for both Movement Rate and Jump distance (e.g. `👣 8`, `jump 👣+4`).

---

## 3. Action Economy & Usage Standards

### Closed Action Set (`AM, A, M, P, F`)
Every power, item trigger, or ability must declare **EXACTLY ONE** action code:
* **`AM`**: Attack & Move (full combat turn expenditure)
* **`A`**: Attack (primary offensive action)
* **`M`**: Move (tactical movement up to MR 👣)
* **`P`**: Partial (quick action, reloading, minor utility)
* **`F`**: Free (zero action-economy cost, reaction triggers)

### Standardized Usage Frequencies
* **`1-🍀`**: 1-Luck chit
* **`1-⚡`**: 1-Bolt / Spark
* **`1-Enc`**, **`2-Enc`**, **`3-Enc`**: 1, 2, or 3 uses per Encounter
* **`1-Rnd`**: 1 use per Round (continuous stances/grips)

> [!CAUTION]
> **Encounter Usage Ceiling:**
> SupaFlex will **NEVER** support more than 3 uses per encounter (`3-Enc`). Any ability with 4+ encounter uses must normalize to a maximum of `3-Enc`.

---

## 4. Tactical Ranges (Rng🎯) & AoE Geometry

### The 8 Canonical Range Bands (Rng🎯)
Distance is categorized into **EXACTLY and ONLY 8 bands**:
1. `Touch` (≤1 sq)
2. `1sq`
3. `2sq`
4. `3sq`
5. `Short` (≤6 sq)
6. `Medium` (≤12 sq)
7. `Long` (≤24 sq)
8. `Extreme` (≥25 sq)

### Tactical AoE Geometry Standards
Permits **EXACTLY TWO** geometric representations:
1. **Circles:** Designated strictly as **`AoE [#]r`** (where `#` is radius in squares, e.g. `AoE 1r`, `AoE 2r`).
2. **Rectangles / Boxes:** Designated strictly as **`[#]x[#]`** (e.g. `2x2`, `3x5`).
* Cones, lines, rings, and bursts are **strictly prohibited**. Never write "rings" or "ring areas".

---

## 5. Code & Supabase Data Accessor Translation

When searching, reading, or writing code, map canonical terms to existing data structures safely:

| Canonical Term | UI Label | Code Interface / State | Supabase DB Schema |
| :--- | :--- | :--- | :--- |
| **Artifact** | `Artifact` | `MagicItem` (aliased to `Artifact`) | Split in `cost` column across `weapons`, `armor`, `shields`, `supplies` (`cost = 'artifact'`) |
| **Exotic Gear** | `Exotics` | `ExoticItem` / `item_type: 'exotic'` | `exotics` table & `supplies` (`category = 'exotic'`) |
| **Custom Artifact** | `Custom Artifact`| `character.custom_magic_items` | `characters.custom_magic_items` (JSONB) |
| **Wishlist** | `Wishlist` | `character.starred_magic_items` | `characters.starred_magic_items` (JSONB) |
| **Hazards** | `Hazards` | `character.conditions` / `hazards` | `characters.conditions` |
| **AP** | `AP` | `character.ap` (or `character.xp`) | `characters.ap` |
| **Motion** | `Motion` / `🏃` | `stats.motion` / `stats.agility` | `characters.agility` |
| **MR / Jump** | `MR` / `👣` | `stats.movement_rate` | Client derived |
