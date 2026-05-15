---
created: 2026-05-15
updated: 2026-05-15
type: topic
source_count: 1
---

# Hardware Reliability

## What

Silent data corruption, ECC, fault tolerance, and reliability mechanisms in AI accelerators and GPU clusters

## Current understanding

_(stub — populate as sources accumulate. `topic-content-gaps` will lint-warn once source_count ≥ 3.)_

## Open threads

## Observations

- SDC classification: benign fault (ECC-corrected silently) → DUE (detected but unrecoverable, system stops) → SDC (escapes all detection, corrupts output silently). Root causes: permanent faults (stuck-at, intermittent, small-delay defects from aggressive voltage/frequency; manufacturing variance); transient faults (cosmic-ray neutrons, alpha particles hitting register files and ALU buffers). AI accelerators are more exposed than CPUs because a larger fraction of die area is given to arithmetic units. Paper arXiv:2502.12340 provides a rigorous 15+15 healthy/unhealthy node experimental framework. — [[2026-01-26-静默数据损坏-sdc-ai-infra-的隐性杀手]]

## Sources drawn on

_(populated as Sources wikilink this Topic; cite each with one-line relevance.)_
