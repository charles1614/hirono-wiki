---
created: 2026-05-16
updated: 2026-05-16
type: source
source_url: https://blog.csdn.net/love_maomao/article/details/20536389
tags: [tooling]
---

# [2019-03-06] 以太网的8B/10B（来自网络，供参考）

## TL;DR

Aggregated reference article on Ethernet history and signal encoding, covering Ethernet's evolution from 10 Mbps to Gigabit speeds, the transition between encoding schemes (Manchester, 4B/5B, MLT-3, NRZI, PAM5, [[8B10B Encoding]]), and practical cable categories (Cat 1–7a). Includes a secondary section on [[8B10B Encoding]] voltage-level signal theory.

## Key claims

- Manchester encoding (10 Mbps Ethernet) requires 20M baud for 10 Mbps; at 100 Mbps this becomes 200M baud, necessitating a switch to more efficient coding.
- 100BaseTX uses 4B/5B + MLT-3 (3-level signaling) at 125M baud to achieve 100 Mbps with 80% efficiency; NRZI used for 100BaseFX.
- 4B/5B encoding guarantees ≥2 transitions per 5-bit code word, enabling clock synchronization, and includes control/idle/error codes for link management.
- 1000BaseT uses PAM5 (4 voltage levels, 2 bits per symbol) at 125 Mbaud generating 250 Mbps signal throughput.
- [[8B10B Encoding]]: 1000 BaseT sends at 125 Mbaud; high-level voltage-level theory — 4-level signal has twice the voltage transition rate of binary, enabling denser data encoding.
- Gigabit Ethernet extends minimum slot time from 512 bit-times to 512 byte-times (frame extension) to maintain collision detection range compatible with 100 Mbps.

## Visual observations

*No load-bearing images — all panels decorative (logos, badges, photos).*

## Entities touched

[[8B10B Encoding]]

## Raw source

[blog.csdn.net/love_maomao/article/details/20536389](https://blog.csdn.net/love_maomao/article/details/20536389) — CSDN blog post by love_maomao, aggregated from network sources. Read 2026-05-16.
