---
created: 2026-05-16
updated: 2026-05-16
type: entity
refs: 3
tier: active
---

# 8B10B Encoding

Line coding scheme that maps 8-bit data symbols to 10-bit transmission symbols to ensure DC balance and clock recovery in high-speed serial links

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- [[8B10B Encoding]] algorithm: low 5 bits (ABCDE) → 5B/6B, high 3 bits (FGH) → 3B/4B; encoded 10-bit words have 5+5, 4+6, or 6+4 zero/one distributions; running disparity (RD) tracks 1-vs-0 excess and alternates between two code variants (RD−/RD+) to maintain long-term DC balance; full encoding table maps each 8-bit input to two 10-bit variants. Efficiency: 80% (20% overhead). — [[2019-03-05-高速信号编码之8b-10b]]
- Root purpose of [[8B10B Encoding]] is DC balance via high-pass-filter-equivalent spectrum shaping: AC-coupling capacitors have impedance Zc=1/2πfC, so low-frequency (continuous 0s/1s) patterns suffer large amplitude loss; encoding shifts energy from low to high frequencies. Secondary benefits: more CDR edge transitions for clock recovery, control/idle/error code support, and moderate error detection capability. 8B/10B limits consecutive identical bits to ≤5. — [[2019-03-06-答题-高速信号编码之8b-10b]]
- Ethernet encoding history: 10 Mbps used Manchester (20M baud); 100BaseTX switched to 4B/5B + MLT-3 (125M baud, 80% efficient); 1000BaseT uses PAM5 at 125 Mbaud = 250 Mbps signal; Gigabit Ethernet extended min slot time to 512 bytes (from 512 bits) to preserve collision-detection distance. 8B/10B appears in PCIe Gen1/Gen2; 128B/130B used in higher-speed protocols. — [[2019-03-06-以太网的8b-10b-来自网络-供参考-love_maomao的专栏-csdn博]]
