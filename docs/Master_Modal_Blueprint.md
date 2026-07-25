# 📐 SupaFlex Master Modal Blueprint Specification

**Scope:** SupaFlex Technical UI/UX Architecture  
**Target File Path:** `c:\Repos\Projects\SupaFlex\docs\Master_Modal_Blueprint.md`  
**Governed Components:** *Treasure Manager*, *Manage Gear*, *Manage Skillsets*, *Manage Weapons*, *Manage Armor*, *Manage Shields*, *Manage Powers*, *Manage Magic Items*, and *Loot Generator*.

---

## 🏛️ Executive Summary

The **Master Modal Blueprint** defines the unified layout, visual styling, responsive behaviors, and UI/UX standards for all modal dialog boxes across the SupaFlex RPG suite. Every modal—whether managing character equipment, skillsets, powers, or random loot generation—must adhere strictly to this single specification.

---

## 🖼️ 1. Header Standard

All modals must feature a fixed top header bar styled with glassmorphism over a dark slate background (`bg-slate-900/90 border-b border-slate-800 backdrop-blur-md`):

```
+-----------------------------------------------------------------------+
| 💰 [Modal Category Icon]  [Modal Title]                      [ X ]   |
|    [Modal Subtitle / Context Description]                             |
+-----------------------------------------------------------------------+
```

* **Left Zone:** 2xl category emoji icon (e.g. 💰, ⚡, 🛡️, ⚔️, 🎒) paired with a high-contrast bold title (`text-xl font-bold text-amber-400` or `text-indigo-400`) and a muted subtitle (`text-xs text-slate-400`).
* **Right Zone:** High-visibility close button (`text-slate-400 hover:text-white text-2xl font-bold px-2 py-1 rounded hover:bg-slate-800 transition-colors`).

---

## 📐 2. Two-Pane Grid Architecture (`md:grid-cols-12`)

Modals are structured into a responsive two-pane grid layout (`grid grid-cols-1 md:grid-cols-12 gap-6 p-6 bg-slate-900/40`):

```
+------------------------------------+----------------------------------+
|           PANE 1 (LEFT)            |          PANE 2 (RIGHT)          |
|         md:col-span-7              |          md:col-span-5           |
|                                    |                                  |
|  • Active Selections / Cards       |  • Mode Toggles & Search Inputs  |
|  • Results Output Stream           |  • Category Filters & Launchers  |
|  • 1-Click Action Claim Buttons    |  • Primary Master Action Buttons |
|                                    |                                  |
|  [Independent Vertical Scrollbar]  |  [Independent Vertical Scrollbar]|
+------------------------------------+----------------------------------+
```

### 📜 Left Pane Standard (`md:col-span-7`):
* Contains the active inventory list, selection stream, or generated loot result cards.
* Bordered on the right with a subtle slate divider (`border-r border-slate-800/80 pr-6`).
* Features an explicit section header with total item count and explicit action buttons (e.g., `[ 🗑️ Clear History ]`).
* **Independent Vertical Scrollbar:** Must be equipped with its own `overflow-y-auto max-h-full` scrolling container so scrolling results never shifts Pane 2.

### 🎛️ Right Pane Standard (`md:col-span-5`):
* Contains top mode switchers, search bars, category dropdowns, preset buttons, and primary action launchers.
* **Independent Vertical Scrollbar:** Must be equipped with its own `overflow-y-auto max-h-full` scrolling container so scrolling control options never shifts Pane 1.

---

## 🎚️ 3. Dyslexia-Friendly UI Toggles & Peg-Sliders

All mode toggles and switchers within modals must implement explicit visual controls rather than text-changing click buttons:

1. **Side-Labeled Layout:** Position the switch between two explicit state labels. Inactive state on the left, active state on the right.
2. **Dynamic Highlighting:** Brightly highlight the active state (`text-amber-400` or `text-indigo-400` at 100% opacity) and dim the inactive state (`text-slate-500` at 50% opacity).
3. **HTML/CSS Design Pattern:**
   ```html
   <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
     <span className={`text-xs font-bold ${!active ? 'text-amber-400 opacity-100' : 'text-slate-500 opacity-50'}`}>Left Label</span>
     <label className="relative inline-flex items-center cursor-pointer">
       <input type="checkbox" checked={active} onChange={handleToggle} className="sr-only peer" />
       <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-amber-400 after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
     </label>
     <span className={`text-xs font-bold ${active ? 'text-indigo-400 opacity-100' : 'text-slate-500 opacity-50'}`}>Right Label</span>
   </div>
   ```

---

## 🦶 4. Footer Context Bar & Standardized `Done` Button

The modal footer bar must be anchored at the bottom (`px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 shrink-0`):

```
+-----------------------------------------------------------------------+
|  Hero: Eldrin the Wise • Wallet: 145s, 12g                  [ Done ]  |
+-----------------------------------------------------------------------+
```

* **Bottom-Left Zone:** Active character name, level/AP, and wallet silver/gold counts.
* **Bottom-Right Zone (Mandatory Standardized Button):** The bottom-right footer button MUST ALWAYS be a rounded pill button explicitly labeled **`Done`**:
  ```tsx
  <button 
    onClick={onClose} 
    className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-100 font-bold px-5 py-1.5 rounded-xl border border-slate-700/80 transition-all shadow-sm cursor-pointer"
  >
    Done
  </button>
  ```

---

## ⚡ 5. 1-Click Action Handlers & Error Rollback

* All item cards within modals must provide 1-click action buttons (`[ 🎒 Add Inventory ]`, `[ ⚔️ Add & Equip ]`, `[ 🪙 +Add Coins ]`, `[ 💎 +Add Valuables ]`, `[ 🗑️ Delete ]`).
* **State Rollback Guarantee:** If an underlying Supabase API call fails, the UI state must immediately revert to its prior position and notify the user via a toast banner to prevent UI-state mismatch.
