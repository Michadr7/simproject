# Road Network Geometry Verification (`notes/map-master.md` Section 6.1)

This check calculates the length of each road listed in Section 6.1 of `notes/map-master.md` as the straight-line sum of its listed points (Euclidean distance $\sqrt{\Delta x^2 + \Delta z^2}$ per segment) and compares it against the stated length in the table. Any discrepancy greater than 10% is flagged with full arithmetic shown below.

## Summary Table

| # | Road | Start Point | End Point | Intermediate Points / Segments | Stated Length (m) | Computed Length (m) | Diff (%) | Status |
|---|------|-------------|-----------|--------------------------------|-------------------|---------------------|----------|--------|
| 1 | Eden Road (spine) | Freight South (72, 68) | East exit (1082, 68) | None | 1010 | 1010.00 | 0.00% | OK |
| 2 | Eden haul road | (960, 68) | Truck gate (960, -62) | None | 130 | 130.00 | 0.00% | OK |
| 3 | Blackstone Access Road | Spine (600, 68) | Lake car park (620, -420) | None | 490 | 488.41 | 0.32% | OK |
| 4 | Eden car link | Access road (600, -200) | Main gate (700, -200) | None | 100 | 100.00 | 0.00% | OK |
| 5a | Lake Road | Car park (620, -420) | P2 (900, -900) | (830, -420), Trailhead (830, -720) | 760 | 703.13 | 7.48% | OK (Note 1) |
| 5b | Lake Road: P1 spur | Trailhead (830, -720) | P1 (600, -690) | Along z = -700 | 230 | 230.00 | 0.00% | OK |
| 6 | Bay Road | Freight-out (250, 68) | (250, 380) | None | 310 | 312.00 | 0.65% | OK |
| 7 | Kaspian Bay streets | Harbor front | Cross streets | x 160..520 (360m) + 2x 120m | 600 (360 + 2x120) | 600.00 | 0.00% | OK |
| 8 | Coast Link | Kaspian Bay east (520, 330) | Spine (640, 68) | None | 290 | 288.17 | 0.63% | OK |
| 9 | County Road | alderNorth (-30, -60) | countyEnd (-30, -246) | None | 186 | 186.00 | 0.00% | OK |
| 10 | Farm road (m) + Ranch Lane | farmGate (-164, -160) | P7 (-300, -330) | farmJoin (-34, -160) | Lane 250 (Farm rd: 130) | Lane 217.71 (Farm rd: 130) | **12.92%** | **FLAGGED** |
| 11 | West Bank Lane | Oak St west (-58.5, 5) | P3 (-390, -100) | West Bank Bridge (-330, 5) | 410 | 392.43 (via bridge) / 347.73 (direct) | 4.29% / **15.19%** | **FLAGGED (Direct)** |
| 12 | Pine track | Woods Road end (195, -250) | P8 (100, -520) | None | 200 | 286.23 | **43.12%** | **FLAGGED** |

---

## Arithmetic for Flagged Rows (> 10% Discrepancy)

### Row 10: Farm Road + Ranch Lane
- **Stated Length**: `lane 250`
- **Coordinates**:
  - `farmGate`: $(-164, -160)$ (from `map-definition.js:33` where $z = n(-160) = -160$)
  - `farmJoin`: $(-34, -160)$ ($z = n(-160) = -160$)
  - `P7`: $(-300, -330)$
- **Calculations**:
  - Existing Farm Road: $(-164, -160) \to (-34, -160)$:
    $$\Delta x = -34 - (-164) = 130\text{ m}, \quad \Delta z = 0 \implies 130.00\text{ m}$$
  - Ranch Lane: from `farmGate` $(-164, -160)$ west to `P7` $(-300, -330)$:
    $$\Delta x = -300 - (-164) = -136\text{ m}$$
    $$\Delta z = -330 - (-160) = -170\text{ m}$$
    $$\text{Length} = \sqrt{(-136)^2 + (-170)^2} = \sqrt{18496 + 28900} = \sqrt{47396} \approx 217.71\text{ m}$$
- **Discrepancy**:
  $$|217.71 - 250| = 32.29\text{ m}$$
  $$\frac{32.29}{250} = 12.92\% \quad (> 10\%)$$
  *(Note: Manhattan distance $|\Delta x| + |\Delta z| = 136 + 170 = 306\text{ m}$ would also differ by 22.4%).*

---

### Row 11: West Bank Lane
- **Stated Length**: `410`
- **Coordinates**:
  - Start: Oak Street west track $(-58.5, 5)$
  - Intermediate: West Bank Bridge at approx $(-330, 5)$ (lines 533-534)
  - End: P3 $(-390, -100)$
- **Calculations**:
  - **Direct endpoint-to-endpoint straight line**:
    $$\Delta x = -390 - (-58.5) = -331.5\text{ m}$$
    $$\Delta z = -100 - 5 = -105\text{ m}$$
    $$\text{Length}_{\text{direct}} = \sqrt{(-331.5)^2 + (-105)^2} = \sqrt{109892.25 + 11025} = \sqrt{120917.25} \approx 347.73\text{ m}$$
    $$\text{Discrepancy} = \frac{|347.73 - 410|}{410} = \frac{62.27}{410} = 15.19\% \quad (> 10\%)$$
  - **Sum of segments via bridge point $(-330, 5)$**:
    $$\text{Segment 1: } (-58.5, 5) \to (-330, 5) \implies \Delta x = 271.5\text{ m}, \Delta z = 0 \implies 271.50\text{ m}$$
    $$\text{Segment 2: } (-330, 5) \to (-390, -100) \implies \Delta x = -60\text{ m}, \Delta z = -105\text{ m}$$
    $$\text{Length}_{\text{seg2}} = \sqrt{(-60)^2 + (-105)^2} = \sqrt{3600 + 11025} = \sqrt{14625} \approx 120.93\text{ m}$$
    $$\text{Total} = 271.50 + 120.93 = 392.43\text{ m}$$
    $$\text{Discrepancy} = \frac{|392.43 - 410|}{410} = 4.29\% \quad (\le 10\%)$$

---

### Row 12: Pine Track
- **Stated Length**: `200`
- **Coordinates**:
  - Start: Woods Road end `(195, -250)` (from `map-definition.js:33` where `woodsEnd` is `{x: 195, z: n(-180)}` with $n(z) = z - 70$, giving $z = -250$)
  - End: P8 `(100, -520)`
- **Calculations**:
  $$\Delta x = 100 - 195 = -95\text{ m}$$
  $$\Delta z = -520 - (-250) = -270\text{ m}$$
  $$\text{Length} = \sqrt{(-95)^2 + (-270)^2} = \sqrt{9025 + 72900} = \sqrt{81925} \approx 286.23\text{ m}$$
- **Discrepancy**:
  $$|286.23 - 200| = 86.23\text{ m}$$
  $$\frac{86.23}{200} = 43.12\% \quad (> 10\%)$$
  *(Even if evaluated against the pre-shift coordinate $z = -180$, $\Delta z = -340\text{ m}$, yielding $\sqrt{95^2 + 340^2} \approx 353.03\text{ m}$, which is a $76.5\%$ discrepancy).*

---

### Additional Note on Row 5 (Lake Road)
- **Stated**: `760`
- Segments:
  - $(620, -420) \to (830, -420) = 210.00\text{ m}$
  - $(830, -420) \to (830, -720) = 300.00\text{ m}$
  - $(830, -720) \to (900, -900) = \sqrt{70^2 + 180^2} \approx 193.13\text{ m}$
- Euclidean sum: $210 + 300 + 193.13 = 703.13\text{ m}$ (7.48% diff, within 10%).
- Manhattan sum: $210 + 300 + (70 + 180) = 760.00\text{ m}$ (exact match with stated 760).
