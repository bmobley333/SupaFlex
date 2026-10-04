import sys
import re

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Re-implement exact JS logic in Python to test all edge cases deterministically
def parse_monster_attributes(raw_text):
    default_magic = 12
    default_might = 16
    default_mind = 12
    default_motion = 15
    default_moxie = 12

    if not raw_text:
        return {
            'attributes': {'magic': default_magic, 'might': default_might, 'mind': default_mind, 'motion': default_motion, 'moxie': default_moxie},
            'attrBlock': f"- [✨{default_magic}/💪{default_might}/👁️{default_mind}/🏃{default_motion}/🫀{default_moxie}]",
            'rawBracket': None
        }

    first_combat = re.search(r'[🚩👣🥊⚔️🛡️🧥🥋❤️💔]', raw_text)
    search_text = raw_text[first_combat.start():] if first_combat else raw_text

    m = re.search(r'\[([^\]]*?(?:/|✨|💪|🥊|👁️|👁|🧠|🏃|👣|🫀|💖|❤)[^\]]*?)\]', search_text)
    if not m:
        m = re.search(r'\[([^\]]*?(?:/|✨|💪|🥊|👁️|👁|🧠|🏃|👣|🫀|💖|❤)[^\]]*?)\]', raw_text)

    if not m:
        return {
            'attributes': {'magic': default_magic, 'might': default_might, 'mind': default_mind, 'motion': default_motion, 'moxie': default_moxie},
            'attrBlock': f"- [✨{default_magic}/💪{default_might}/👁️{default_mind}/🏃{default_motion}/🫀{default_moxie}]",
            'rawBracket': None
        }

    raw_bracket = m.group(0)
    content = m.group(1).strip()
    segments = content.split('/')

    magic, might, mind, motion, moxie = None, None, None, None, None
    any_emoji = False

    for s in segments:
        num = re.search(r'\d+', s)
        if not num: continue
        val = int(num.group(0))

        if '✨' in s:
            magic = val
            any_emoji = True
        elif '💪' in s or '🥊' in s:
            might = val
            any_emoji = True
        elif '👁' in s or '🧠' in s:
            mind = val
            any_emoji = True
        elif '🏃' in s or '👣' in s:
            motion = val
            any_emoji = True
        elif '🫀' in s or '💖' in s or '❤' in s:
            moxie = val
            any_emoji = True

    if not any_emoji:
        nums = []
        for s in segments:
            nm = re.search(r'\d+', s)
            if nm: nums.append(int(nm.group(0)))
        if len(nums) >= 5:
            magic, might, mind, motion, moxie = nums[0], nums[1], nums[2], nums[3], nums[4]
        elif len(nums) == 4:
            might, motion, mind, magic = nums[0], nums[1], nums[2], nums[3]

    final_attrs = {
        'magic': magic if magic is not None else default_magic,
        'might': might if might is not None else default_might,
        'mind': mind if mind is not None else default_mind,
        'motion': motion if motion is not None else default_motion,
        'moxie': moxie if moxie is not None else default_moxie,
    }

    attr_block = f"- [✨{final_attrs['magic']}/💪{final_attrs['might']}/👁️{final_attrs['mind']}/🏃{final_attrs['motion']}/🫀{final_attrs['moxie']}]"
    return {'attributes': final_attrs, 'attrBlock': attr_block, 'rawBracket': raw_bracket}

def normalize_monster_statblock_attributes(raw_text):
    if not raw_text: return ''
    res = parse_monster_attributes(raw_text)
    if not res['rawBracket']:
        vit = re.search(r'(?:❤️|💔)\s*\d+', raw_text)
        if vit:
            idx = vit.end()
            return f"{raw_text[:idx]} {res['attrBlock']} {raw_text[idx:].strip()}".strip()
        return f"{raw_text} {res['attrBlock']}".strip()
    return re.sub(r'(?:[-–—]\s*)?' + re.escape(res['rawBracket']), res['attrBlock'], raw_text)

def decompose_monster(raw_text):
    normalized = normalize_monster_statblock_attributes(raw_text)
    abilities = ''
    statline = normalized

    attr_close = re.search(r'^(.*?\[[^\]]*\])\s*(.*)$', normalized, re.DOTALL)
    if attr_close:
        statline = attr_close.group(1).strip()
        trailing = (attr_close.group(2) or '').strip()
        if trailing:
            outer = re.match(r'^\((.*)\)$', trailing, re.DOTALL)
            abilities = outer.group(1).strip() if outer else trailing

    gear = ''
    first_icon = re.search(r'[🚩👣🥊⚔️🛡️🧥🥋❤️💔]', statline)
    if first_icon:
        pre_icon = statline[:first_icon.start()]
        post_icon = statline[first_icon.start():]
        paren = re.search(r'\(([^)]+)\)', pre_icon)
        if paren:
            gear = paren.group(1).strip()
            clean_pre = re.sub(r'\([^)]+\)', '', pre_icon).strip()
            statline = f"{clean_pre} {post_icon}".strip()

    return {'statline': statline, 'gear': gear, 'abilities': abilities}

print("=" * 70)
print("🧪 S-TIER AUTOMATED TEST: UNIVERSAL MONSTER ATTRIBUTE PARSER")
print("=" * 70)

# Test 1: Blake's exact Orc Patrol Leader string
test1 = "1 Orc Patrol Leader (Reinforced Leather and Bone, Heavy Axe) 🚩15, 👣10, ⚔️19/13(2), 🛡️17/2 ❤️14 – [💪19/🏃12/👁️11/✨9] (Once per Enc as a Free action the Leader can bark an order granting all remaining patrol members +2 to their next Atk or Nish🚩)."
res1 = parse_monster_attributes(test1)
decomp1 = decompose_monster(test1)

print("\n[Test 1] Blake's Exact Orc Patrol Leader:")
print("  Parsed Attributes:", res1['attributes'])
print("  Attr Block:", res1['attrBlock'])
print("  Extracted Gear:", decomp1['gear'])
print("  Extracted Abilities:", decomp1['abilities'])
print("  Decomposed Statline:", decomp1['statline'])

assert res1['attributes']['magic'] == 9, f"Expected magic 9, got {res1['attributes']['magic']}"
assert res1['attributes']['might'] == 19, f"Expected might 19, got {res1['attributes']['might']}"
assert res1['attributes']['mind'] == 11, f"Expected mind 11, got {res1['attributes']['mind']}"
assert res1['attributes']['motion'] == 12, f"Expected motion 12, got {res1['attributes']['motion']}"
assert res1['attributes']['moxie'] == 12, f"Expected moxie 12 (default), got {res1['attributes']['moxie']}"
assert res1['attrBlock'] == "- [✨9/💪19/👁️11/🏃12/🫀12]"
assert decomp1['gear'] == "Reinforced Leather and Bone, Heavy Axe"
assert "Leader can bark an order" in decomp1['abilities']
print("  ✅ Passed: All 5 attributes matched, Moxie defaulted to 12, canonical ordering verified!")

# Test 2: Scrambled 5 attributes with legacy Moxie heart
test2 = "Goblin Shaman 🚩14 👣10 ⚔️12/5 🧥14/0 ❤️10 - [💖14/✨18/🏃10/💪8/🧠16]"
res2 = parse_monster_attributes(test2)
print("\n[Test 2] Scrambled 5 Attributes with 💖 and 🧠:")
print("  Parsed Attributes:", res2['attributes'])
assert res2['attributes'] == {'magic': 18, 'might': 8, 'mind': 16, 'motion': 10, 'moxie': 14}
assert res2['attrBlock'] == "- [✨18/💪8/👁️16/🏃10/🫀14]"
print("  ✅ Passed: Scrambled order re-ordered to canonical format!")

# Test 3: 4-number legacy without emojis
test3 = "Dire Boar 🚩12 👣12 ⚔️16/8 🧥15/2 ❤️22 - [18/14/10/8]"
res3 = parse_monster_attributes(test3)
print("\n[Test 3] Legacy 4-number format without emojis:")
print("  Parsed Attributes:", res3['attributes'])
assert res3['attributes'] == {'magic': 8, 'might': 18, 'mind': 10, 'motion': 14, 'moxie': 12}
assert res3['attrBlock'] == "- [✨8/💪18/👁️10/🏃14/🫀12]"
print("  ✅ Passed: Legacy 4-number mapped to Might/Motion/Mind/Magic with Moxie 12!")

# Test 4: Missing attribute bracket completely
test4 = "Bandit 🚩12 👣10 ⚔️14/6 🧥12/1 ❤️12"
res4 = parse_monster_attributes(test4)
print("\n[Test 4] Monster with no attribute bracket:")
print("  Parsed Attributes:", res4['attributes'])
assert res4['attributes'] == {'magic': 12, 'might': 16, 'mind': 12, 'motion': 15, 'moxie': 12}
print("  ✅ Passed: All 5 attributes cleanly defaulted to TL 0 baseline!")

print("\n" + "=" * 70)
print("🎉 ALL S-TIER SUITE TESTS PASSED WITH 100% SUCCESS!")
print("=" * 70)
