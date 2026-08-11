# 📜 SupaFlex Magic Item Blueprint & Rules Reference

*Last Updated: August 10, 2026*  
*Status: Master Reference Specification for Future Rules & Player Guide Updates*

---

## 🎯 Executive Summary (KISS Principles)

The **Magic Item System** in SupaFlex balances high-dopamine loot acquisition with tactical loadout decision-making by separating **Item Ownership** from **Active Equip Capacity**:

1. **Character Vault (Unlimited & 0 AP):** ALL magic items claimed from drops, loot generators, or codex catalogs are stored permanently in the player's personal **Character Vault**. Items are never lost or destroyed upon un-equipping.
2. **Active Magic Item Slots (AP Unlocks):** To use a magic item in combat or active play, it must be assigned to an **Active Slot**. Every character begins with **3 Free Slots** at Level 1. Additional slots are purchased permanently with AP on the character sheet.
3. **Item Slot Weights (1 to 4 Slots):** Items occupy active slot capacity based on their power tier:
   - 🍺 **Minor Magic Item:** 1 Slot (🗲)
   - 🪄 **Lesser Magic Item:** 2 Slots (🗲🗲)
   - ✨ **Greater Magic Item:** 3 Slots (🗲🗲🗲)
   - 💫 **Relic / Epic Magic Item:** 4 Slots (🗲🗲🗲🗲)
4. **GM-Approved Swap Windows (0 AP):** Equipping or un-equipping items between the Character Vault and Active Loadout costs `0 AP`, but can **ONLY** take place during GM-approved windows (e.g. leveling up, long rests, breaks, or GM toggle state).

---

## 📊 Complete Slot Progression & AP Cost Schedule (Levels 1–100+)

Characters receive **2 AP per level** for all character growth. Slot capacity expansions are level-gated and require modest AP investments:

| Level Bracket | Max Allowed Slots | Free Base Slots | AP Cost for Next Slot | Cumulative AP Spent |
| --- | --- | --- | --- | --- |
| **Level 1** | 3 Slots | 3 Slots | 0 AP (Base Free) | 0 AP |
| **Level 2–3** | 4 Slots | 3 Slots | 1 AP (Slot 4) | 1 AP |
| **Level 4–5** | 5 Slots | 3 Slots | 1 AP (Slot 5) | 2 AP |
| **Level 6–7** | 6 Slots | 3 Slots | 1 AP (Slot 6) | 3 AP |
| **Level 8–9** | 7 Slots | 3 Slots | 1 AP (Slot 7) | 4 AP |
| **Level 10–14** | 8 Slots | 3 Slots | 1 AP (Slot 8) | 5 AP |
| **Level 15–19** | 9 Slots | 3 Slots | 2 AP (Slot 9) | 7 AP |
| **Level 20–29** | 10 Slots | 3 Slots | 2 AP (Slot 10) | 9 AP |
| **Level 30–39** | 11 Slots | 3 Slots | 2 AP (Slot 11) | 11 AP |
| **Level 40–49** | 12 Slots | 3 Slots | 2 AP (Slot 12) | 13 AP |
| **Level 50–69** | 13 Slots | 3 Slots | 3 AP (Slot 13) | 16 AP |
| **Level 70–89** | 14 Slots | 3 Slots | 3 AP (Slot 14) | 19 AP |
| **Level 90–100+** | 15 Slots | 3 Slots | 3 AP (Slot 15) | 22 AP |

*Note: Unlocked slot capacity is permanent. There are no slot rollbacks or respec penalties.*

---

## 🔄 Digital Workflow & Operational Rules

```
[ LOOT DROP / GENERATOR ]
          │
          ▼ (Claim to Character Vault | 0 AP | Unlimited Capacity)
[ CHARACTER VAULT ]
          │
          ▼ (GM Rest / Leveling Window | 0 AP | Loadout Weight <= Max Unlocked Slots)
[ ACTIVE EQUIPPED LOADOUT ]
```

### 1. Ingestion Rule (0 AP Claim)
- Claiming magic items from Loot Generators, Echo Vaults, or GM Rewards costs **0 AP** and displays no AP upgrade prompts.
- All claimed items land safely inside the **Character Vault**.

### 2. Slot Upgrade Rule (AP Manager)
- In the **AP Manager**, players can spend AP to purchase extra slot capacity up to their current Level Cap.
- Unlocking a slot permanently raises the active loadout capacity threshold (`unlocked_magic_slots`).

### 3. Loadout Swapping Rule (GM Window Required)
- Equipping an item from the Character Vault into the active loadout validates:
  $$\text{Current Active Slot Weight} + \text{Item Slot Weight} \le \text{Max Unlocked Slots}$$
- Out-of-combat swapping is permitted **only when the GM Swap Window is active** (`is_gm_swap_window_active = true`).
- Mid-combat hot-swapping is strictly prohibited once initiative is rolled.

---

## 🛠️ Codebase Implementation Reference

- **Types & Schemas:** [`game.ts`](file:///C:/Repos/Projects/SupaFlex/src/types/game.ts) (`CharacterSheetData.character_vault`, `unlocked_magic_slots`).
- **Mathematical Rules Engine:** [`magicSlotSchedule.ts`](file:///C:/Repos/Projects/SupaFlex/src/utils/magicSlotSchedule.ts) (`getItemSlotWeight`, `getMaxSlotsForLevel`, `getApCostForNextSlot`, `calculateTotalLoadoutSlotsUsed`).
- **Character Vault & Loadout UI:** [`AbilitySlotsGrid.tsx`](file:///C:/Repos/Projects/SupaFlex/src/components/sheet/AbilitySlotsGrid.tsx).
- **AP Slot Upgrades:** [`ApManagerModal.tsx`](file:///C:/Repos/Projects/SupaFlex/src/components/modals/ApManagerModal.tsx).
