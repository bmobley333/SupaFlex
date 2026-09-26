# Supabase Table Schemas, Human-Editable Columns & 1-to-1 Stat Derivations SoT

## Triad Mandate
1. **Rule (The What):** Any UI editor or tool displaying or mutating entities across Supabase tables (`powers`, `traits`, `skills`, `weapons`, `armor`, `shields`) must exclusively present the verified human-editable columns and enforce strict 1-to-1 requirement-to-stat derivations.
2. **Rationale (The Why):** Prevents UI hallucinations of non-existent columns (such as fake range or hands columns in weapons/armor), guarantees zero database payload errors, and ensures pure mathematical parity with the core game rules.
3. **Failure Mechanism (The What Breaks):** Hallucinated fields cause Supabase API write rejections (`column does not exist`), player confusion, and schema drift between the character sheet, the workshop modal, and the canonical database.

---

## 1. Verified Live Supabase Table Schemas

Scanned directly from Supabase master database:

| Table | All Supabase Columns | System / Generated Columns | Human-Editable Columns in UI Editor |
| :--- | :--- | :--- | :--- |
| **`powers`** | `id, name, action, usage, effect, notes, genres, discipline, path, sets, stat_hook, created_at, owner` | `id, created_at, owner, path, sets, stat_hook` | `name`, `action`, `usage`, `effect`, `discipline`, `notes`, `genres` |
| **`traits`** | `id, name, effect, notes, genres, cost, discipline, path, sets, belongs_to, stat_hook, created_at, owner` | `id, created_at, owner, path, sets, belongs_to, stat_hook` | `name`, `effect`, `cost`, `discipline`, `notes`, `genres` |
| **`skills`** | `id, name, attribute, discipline, notes, genres, path, sets, created_at, owner` | `id, created_at, owner, path, sets` | `name`, `attribute`, `discipline`, `notes`, `genres` |
| **`weapons`** | `id, name, type, requirement, atk, dmg, max_block, cost, domain, notes, genres, pic, path, sets, belongs_to, created_at, owner` | `id, created_at, owner, path, sets, belongs_to, pic` | `name`, `type`, `requirement` *(auto-derives `atk, dmg, max_block`)*, `cost`, `domain`, `notes`, `genres` |
| **`armor`** | `id, name, requirement, ar, mr, cost, domain, notes, genres, pic, path, sets, belongs_to, created_at, owner` | `id, created_at, owner, path, sets, belongs_to, pic` | `name`, `requirement` *(auto-derives `ar, mr`)*, `cost`, `domain`, `notes`, `genres` |
| **`shields`** | `id, name, requirement, max_block, mr, cost, domain, notes, genres, path, sets, belongs_to, created_at, owner` | `id, created_at, owner, path, sets, belongs_to` | `name`, `requirement` *(auto-derives `max_block, mr`)*, `cost`, `domain`, `notes`, `genres` |

---

## 2. Standardized UI Labels

- **`Notes`**: Always labeled "Notes" (never "Lore & Notes" or "Rule Notes").
- **`Usage`**: Always labeled "Usage" (never "Usage Cadence").
- **`Action`**: Always labeled "Action" (never "Action Speed").

---

## 3. Strict 1-to-1 Stat Derivation Matrices

### A. Armor Requirement Matrix (1-to-1)
Selecting `Requirement` automatically sets and locks `ar` and `mr`:
* `💪 4`  -> `ar: 🧥4`,  `mr: 👣12`
* `💪 6`  -> `ar: 🧥6`,  `mr: 👣11`
* `💪 8`  -> `ar: 🧥8`,  `mr: 👣10`
* `💪 10` -> `ar: 🧥10`, `mr: 👣9`
* `💪 12` -> `ar: 🧥12`, `mr: 👣8`

### B. Shields Requirement Matrix (1-to-1)
Selecting `Requirement` automatically sets and locks `max_block` and `mr`:
* `💪 4`  -> `max_block: 🛡️12`, `mr: 👣0`
* `💪 6`  -> `max_block: 🛡️16`, `mr: 👣-1`
* `💪 8`  -> `max_block: 🛡️20`, `mr: 👣-2`
* `💪 10` -> `max_block: 🛡️24`, `mr: 👣-3`
* `💪 12` -> `max_block: 🛡️28`, `mr: 👣-4`

### C. Weapons Type & Requirement Matrix (1-to-1)
* **Allowed Types**: `Melee`, `Hurled`, `Shot`, `Melee, Hurled`, `Melee, Shot`
* **Allowed Requirements**: `4`, `6`, `8`, `10`, `12`
* **Derived Stats**:
  * `atk` & `dmg`:
    * `Melee` -> `💪`
    * `Hurled` -> `🏃`
    * `Shot` -> `👁️`
    * `Melee, Hurled` -> `💪, 🏃`
    * `Melee, Shot` -> `💪, 👁️`
  * `max_block`:
    * If `type` contains `Melee`: `requirement * 2` (e.g. `4` -> `8`, `6` -> `12`, `8` -> `16`, `10` -> `20`, `12` -> `24`)
    * If non-melee: `null` / `n/a`

---

## 4. Canonical Value Sets

### A. Attributes
Used without text labels:
* `✨` – Magic
* `💪` – Might
* `👁️` – Mind
* `🏃` – Motion
* `🫀` – Moxie
* `👣` – MR / Movement / Jump

### B. Actions (Powers)
* `AM` – Attack & Move
* `A` – Attack
* `M` – Move
* `P` – Partial
* `F` – Free

### C. Usage (Powers - Strict Rule: Max 3 Uses)
SupaFlex will NEVER support more than 3 uses:
* `1-🍀` – 1-Luck
* `1-⚡` – 1-Bolt
* `1-Enc` – 1/Encounter
* `2-Enc` – 2/Encounter
* `3-Enc` – 3/Encounter
* `1-Rnd` – 1/Round

### D. Range Bands (Exact 8 Bands)
* `Touch` (`≤1 sq`)
* `1sq`
* `2sq`
* `3sq`
* `Short` (`≤6 sq`)
* `Medium` (`≤12 sq`)
* `Long` (`≤24 sq`)
* `Extreme` (`≥25 sq`)

### E. AoE Presets
* `AoE 1r`
* `AoE 2r`
* `AoE 3r`
* `AoE 2x2`
* `AoE 3x3`
* `AoE 4x4`
* `AoE 5x5`
