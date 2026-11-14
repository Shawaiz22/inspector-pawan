# DESIGN.md: Inspector Pawan visual rules

Read before any UI work. These rules beat your defaults.

## Idea
Inspector Pawan is about proof. Every claim sits next to the data that supports it. The data colors carry the
meaning, so everything else is calm, clean and quiet. Two moods:
- Workspace (officer, principal, society): a precise working tool. Claim beside proof.
- Citizen notice: a clear public notice. Big type, one column, printable, kind.

## Tokens
Color (CSS variables on :root, dark values under prefers-color-scheme: dark):
- --haze #EEF2F3 (page background, a cool sky haze)
- --surface #FFFFFF (panels)
- --ink #16242B (text)
- --muted #52636B (secondary text, still AA on haze)
- --line #CBD5D9 (borders, grid gaps)
- --accent #1E5C94 (buttons, links, focus ring) and --accent-ink #FFFFFF
- --warn #8A4B00 on #FFF1DC (unverified and data quality notices)
Dark: --haze #0F1A1F, --surface #16242B, --ink #E6EDF0, --muted #A3B3BA, --line #2A3B43,
--accent #7DB4E6, --accent-ink #0F1A1F.

AQI category colors (CPCB), used ONLY for data (grid cells, map pins, badges), always with the
number and category name beside them:
Good #00B050, Satisfactory #92D050, Moderate #FFFF00, Poor #FF9900, Very Poor #FF0000,
Severe #C00000. Dark text on Good, Satisfactory, Moderate, Poor. White text on Very Poor, Severe.

Type (next/font/google):
- Anek Latin for everything Latin. Anek Devanagari for Hindi (matched design). Noto Nastaliq Urdu for
  Urdu with line-height 2.
- Scale: 14 / 16 / 18 / 22 / 28 / 40. Body 16 (citizen page 18). Line length under 75 characters.
- Numbers: font-variant-numeric: tabular-nums everywhere data appears.
- Headings in sentence case. No all-caps labels, no tracked-out eyebrows.

Shape:
- Radius by hierarchy: panels 14px, buttons 10px, chips 999px, grid cells 4px.
- One subtle shadow only for floating things (menus, drawers). Panels use a 1px --line border.

## Layout
Workspace, desktop:
```
[logo Inspector Pawan]  [Ward 12, Kolar (Ward officer)]   [Case #3]          [Settings]
[Upload] -> [Data check] -> [Evidence] -> [Case plan] -> [Notice] -> [Follow-up]
+------------------------------+  +-----------------------------------+
| PROOF                         |  | CLAIMS                            |
| heat grid (location x hour)   |  | findings with row chips,          |
| map tab (if lat/long)         |  | confidence, verified badge        |
| rows table (highlighted)      |  | actions / notes / notice          |
+------------------------------+  +-----------------------------------+
```
Hovering or focusing a claim highlights its cells and rows on the left. That link IS the product.
Mobile: claims first, "Show the rows" opens a bottom drawer with the evidence.

Citizen notice page:
```
[area name]                         [language: English | हिंदी | اردو]
[big colored band: today's category + number + one sentence]
Who are you worried about?  [Children] [Older adults] [Breathing problems] [Everyone]
[advice for the chosen group, large type]
[Listen]  [Print]  [Share]
Published 14 Nov, 10:30. Based on 120 readings from 5 sensors.
```

## Signature element
The heat grid. When a brief arrives, cells fill in column by column (stagger 15ms). Cells show the
number on hover/focus. Saturated cells get a diagonal hatch. Missing cells are empty with a dotted
outline, never colored.

## Motion (library: motion, import from "motion/react")
Only these:
1. Boot: the logo (a magnifying glass with a small air swirl inside the lens) does one slow
   breath (scale 1 -> 1.12 -> 1) while the swirl rotates a quarter turn, then flies into the header
   with layoutId. Max 1.6s, skippable, once per session. Use components/BootSplash.tsx.
2. Results: heat grid fill, then findings appear with a 40ms stagger.
3. Claim to proof: highlight transitions on the grid and table (150ms).
Springs for movement (stiffness 220, damping 26). Animate only transform and opacity.
Reduced motion: no movement, simple fades only.

## Banned (these look AI generated)
Purple or blue-purple gradients, gradient text, glass cards, glowing borders, aurora backgrounds,
sparkle icons, "Powered by AI" badges, emoji in headings, three identical feature cards, bento grids,
icons in tinted rounded squares, fade-up on every section, hover lift on every card, all-caps labels,
arrows on every button, cream background with terracotta accent, near-black with neon accent,
components copied from Aceternity UI or Magic UI.

## Copy
- Plain words, sentence case, active voice. Buttons say what happens: "Create brief",
  "Accept fix", "Publish notice", "Copy note".
- Case language from PLAN.md: case, data check, evidence, case plan, notice, follow-up.
- Persona voice only in headings and status lines. Plain and serious everywhere else.
- Role-specific names: "Notice for residents" (ward), "Notice for parents" (school),
  "Notice for members" (housing society).
- Errors say what happened and what to do. Empty states invite the next step.
- Sample data is always labeled "Sample data".

## Quality floor
Mobile first at 360px. Visible focus. Labels on every input. AA contrast. aria-live for results.
Color never the only signal. After each screen, screenshot it and compare with this file.
