michadr.

# 0.36.3 playtest follow-up

- Created this verification report (35 lines). No game files changed, no tests added, and no protected-file edits were needed.
- Used the existing 0.36.3 package and separate Chrome profiles. The local playtest server and relay are running.

## Nighttime pickup quality switches

Both headless captures used an RTX 4070 Ti. The second capture reversed renderer order. Eastbank entry uses staged placement. Values are peak animation callback gaps in milliseconds.

| Capture order | WebGL High → Low | WebGL Low → High | WebGPU High → Low | WebGPU Low → High |
| --- | ---: | ---: | ---: | ---: |
| WebGL first | 400.0 | 54.5 | 2351.4 | 442.4 |
| WebGPU first | 187.9 | 24.2 | 1175.7 | 557.5 |

WebGPU High → Low handlers took 4.8 and 4.6 ms. The frames immediately before the longest gaps took 5.3 and 5.7 ms of CPU time. Both runs point to a delayed stall. Chrome and GPU pipeline timing are still needed to identify its cause.

Raw traces are in `%TEMP%/eden-0363-hardware-20261121-170405` and `%TEMP%/eden-0363-hardware-reverse-20261121-202718`. The initial restricted run failed before rendering with `GPU process isn't usable`. The runs with GPU access completed.

## Diner and bakery browser checks

Used staged positions and an eligible order or gig, then acted through the game's prompts and phone. The Table 1 screen capture showed the cup floating beside the player. Serving succeeded and hid it. Staged sack and pallet deliveries paid out. Giving up a loaded pallet cleared the active gig and truck cargo without a payout. Wholesale was revisited after dark.

```text
espresso-before-serving {"title":"Serve the Espresso · Table 1","carried":1,"meshVisible":true,"offset":[0.32,1.12,0.3]}
espresso-after-serving {"served":1,"table":"eating","tipCents":300,"meshVisible":false}
log {"payout":8230,"carry":null,"stock":{"flour":0,"coffee-beans":1}}
log {"payout":7645,"cargo":null,"stock":{"flour":4,"coffee-beans":1}}
cancel-loaded-pallet {"active":null,"cargo":null,"cashChange":0}
```

Screenshots are in `%TEMP%/eden-0363-playtest-diner/diner-webgl-final`, `bakery-webgl-retry`, and `bakery-webgl-final` under the same parent folder.

Confidence is high in the reproduced hitch, cup pose, and staged transaction results. Full unassisted delivery routes, co-op gig claims, and GPU execution timing remain unverified.
