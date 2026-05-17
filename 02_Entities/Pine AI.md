---
created: 2026-05-15
updated: 2026-05-16
type: entity
refs: 10
tier: active
---

# Pine AI

AI startup by Bojie Li; uses vibe coding as an engineering hiring filter

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Uses vibe coding ability as an explicit hiring filter: interview challenge requires candidates to build a working attention-based hallucination detector in 2 hours; evaluates both Transformer fundamentals understanding and rapid vibe coding execution. — [[2025-08-19-又一道-vibe-coding-面试题-基于注意力的-llm-幻觉检测器]]
- Second known vibe-coding interview challenge: implement constrained LLM sampling (vocabulary-limited output) via a string-level `LogitsProcessor`; tests tokenization depth (catching the token-whitelist error) as well as implementation speed. — [[2025-08-19-用-vibe-coding-解决-llm-限制采样的面试题]]
- Founding product: AI phone agent that calls customer service on behalf of users to negotiate bills, cancel subscriptions, process refunds, and book restaurants; operates in the US market where hold times are commonly 30+ minutes. Technical approach: fast-slow thinking (Talker + Reasoner agents), code-generated RPA tools for GUI automation, knowledge base for business-rule memory, and SFT/RL for high-frequency task internalization. On Tau-Bench Airline scenario: baseline 56% → sequential-revision 64% success rate; of remaining failures, 8/18 are ground-truth annotation errors. GUI operations 5× faster than Anthropic/OpenAI computer use. — [[2025-06-14-能办成事的-agent-实时与环境交互-从经验中学习]]
