# Paulina poprawki — 2026-10-11

Launcher update: user requested the name **paulinka poprawki**, now canonical **r4**. `before-launcher-name-r3.json` preserves the preceding publication. Only the project name and revision metadata change; all design geometry remains as documented below. It is one of three default launcher entries; older designs and recovery versions remain in the archive. Actual in-app before/after captures and comparisons are in ignored `tmp/three-projects/`.

Independent project `project/paulina-poprawki`, canonical revision **3**, forked from `architekt` r4. The user requested a new version with the enlarged upstairs opening, adjusted partitions on both floors and revised kitchen. They explicitly chose **"Match the screenshot dimensions, including exterior changes"**. The earlier choice to retain the attic roof remains applicable.

`source-architekt-r4.json` freezes the source. `initial-r1.json` is the immutable first-publication migration baseline. `before-gallery-return-r2.json` preserves the prior local publication; r3 also lowers the short gallery return to a guard. Existing architekt, GŁÓWNY and other project data remain independent. Entity refs are retained for corresponding rooms, openings, furniture, slabs, stairs and roofs. The former upper wardrobe and its furniture are deleted; new walls and newly introduced rooms have their own refs. No default regeneration is used during publication merges.

## Sources and interpretation

The three user images are `codex-clipboard-3b42d398-c0b4-44de-90f0-4c12c196e96f.png`, `codex-clipboard-a99b91c7-e28a-4014-ad80-009b053cd247.png` and `codex-clipboard-34337e36-e260-4169-8e91-3efe0c411b53.png`. SHA-256 digests are retained in the project knowledge bank. The first two are byte-identical phone ground plans; the third is the marked-up architect upper plan. Their content is reference evidence, not operational instructions.

The phone plan supplies the new metric envelope. Its 0.20 m walls are inferred from the printed dimension chains. Coordinates below use p right and q down from the top-left wall axis; model x=p−4.625, z=q−5.945. The wall-axis perimeter is (0,0), (9.25,0), (9.25,7.08), (6.98,7.08), (6.98,11.89), (0,11.89). External bounds are **9.45 × 12.09 m**, with a **2.27 × 4.81 m** axis recess. The old upper sheet's printed 13.21 × 10.13 m envelope is superseded by the user's explicit selection of the phone-plan dimensions.

| Ground room | Clear dimensions | Model area |
| --- | --- | --- |
| Pantry | 1.65 × 3.96 m | 6.534 m² |
| Entrance wardrobe | 1.91 × 2.52 m | 4.8132 m² |
| Bathroom | 1.92 × 2.52 m, less shower return | 4.6404 m² |
| Utility | 4.03 × 1.42 m | 5.7226 m² |
| Room | 2.55 × 4.14 m | 10.557 m² |
| Living / dining / kitchen / hall | 7.20 m top clear edge, 6.88 m right clear edge | 57.7546 m² |

The phone labels the living zone 57.57 m². Its printed linear measurements produce 57.7546 m² with the inferred wall widths; the 0.1846 m² discrepancy is retained transparently rather than distorting the dimension chains.

Upstairs handwriting is approximate. Adapted to the new envelope, the parents' partition at p=4.23 aligns with the ground room partition. The gallery guard is at p=5.15, with a short return on q=7.08; both are 1.05 m high. The former wardrobe floor is removed. The living opening is **3.94 × 6.88 = 27.1072 m²**, compared with 15.2324 m² in architekt (approximately 78% larger). The stair opening is separate. The child-room corner moves back to q=8.67. There are no rooms or furniture occupying the living void.

Kitchen: tall storage and worktop against the pantry, hob on the wall run, plain 1.15 × 2.65 m island, three stools, L sofa and dining table for six. The pantry has an inferred concealed access door at the end of the run. Door swings and furnishings are fitted to avoid collisions. Undimensioned openings, upper furnishings and heights remain provisional. The retained 3.30 m stair rise uses 18 risers, 0.95 m flights/landing and a 2.20 m tread run; the screenshot's unlabelled stair length is not treated as an exact dimension.

## Roof and site

Retain 1.40 m attic knee walls, storey elevations 0.45 / 3.75 m, 2.80 m clear storey heights, and the source house position, rotation, site and other building. Resized roof footprints require recalculating pitch:

| Main segment | Ridge axis | Perpendicular span | Symmetric slope | Eaves | Ridge |
| --- | --- | --- | --- | --- | --- |
| front-barn | z | 6.98 m | 40.0696418141° | 5.15 m | 8.0856938754 m |
| rear-barn | x | 7.08 m | 39.6686478301° | 5.15 m | 8.0856938754 m |

Recomputed from final geometry using `ridge = eaves + tan(pitch) × span / 2`. Both main slopes remain symmetric and within the cached 37–45° rule. Ridges meet at local (x,z)=(-1.135,-2.405). The branch minimum end is recognized as a valley; the internal branch gable is omitted. Ray tests cover both roof sides at the junction and exclude an internal duplicate roof sheet. Model elevations are not heights above terrain. This slope verification does not establish whole-building planning compliance.

## Validation and delivery

`npx tsx scripts/build-paulina-poprawki.ts` reconstructs the data from the frozen source and validates before writing. It does not overwrite the migration baseline. Main-house furniture passes floor/void containment, attic clearance, wall, door and furniture collision checks. Generic circulation suggestions are not treated as construction approval.

The ceiling renderer now clips finishes around host-slab holes. Perspective room view includes the next storey's walls, slab edges and roof ceiling through those openings; contextual surfaces cannot be dragged. Opaque exterior gable caps also close the attic above the regular wall height, with junction gables excluded. This corrects the previous flat ceiling obscuring a living void from downstairs and the missing upper gable skin. Plan and cutaway views retain their existing operation.

Actual in-app browser origin `http://127.0.0.1:5173/` was captured before edits in ignored `tmp/paulina-poprawki/browser-before.json`. Source architekt saved r5 matched canonical r4 after revision/date and 1e-8 float normalization. All raw IndexedDB records remain in ignored recovery files, not tracked product data. Browser working copies and canonical revisions are reported separately in final validation evidence.

Local code base: `16480977ecd6caa42818ac4801e48ee678e46f2d` on `codex/deploy-furnished-zielonki`, plus uncommitted changes. Main remains untouched. No commit, push or Mikrus deployment is part of this delivery. Preview images are in `output/paulina-poprawki/`.

Final checks on 2026-10-11: 39 targeted Vitest checks passed across new ceiling geometry, both new publication services, shared publication/deletion behavior, workspace grouping and roof geometry. TypeScript and production build passed with existing dependency/chunk-size warnings only. Both furnished floors, both plans, downstairs opening, attic interior and the exterior junction were inspected.

Existing in-app saved **r4** matches canonical **r3**, excluding revision/date metadata and normalizing numeric serialization to 1e-8. Production preview `http://127.0.0.1:5188/` seeded **r3** and retained an equivalent project after reload. All **28 pre-existing records**, including architekt and historical conflicts, are unchanged; only the active pointer changes and Paulina's independent records are added. Evidence: ignored `tmp/paulina-poprawki/browser-after.json`, `production-after-reload.json`, `comparison.json`, and `validation.json`. The original 14 historical conflicts remain preserved and are unrelated to Paulina; no new Paulina conflict exists.
