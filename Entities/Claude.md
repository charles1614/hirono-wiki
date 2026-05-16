---
created: 2026-05-12
updated: 2026-05-16
type: entity
refs: 12
tier: active
---

# Claude

Anthropic's AI assistant used by Tom Turney to accelerate the 7-day reproduction of Google's TurboQuant algorithm from paper math to working code.

## Synthesis

*Regenerated from Observations below as evidence accumulates.*

## Observations

- Opus 4.6 self-navigated 25 iterations of CUDA kernel optimization (Flash Attention with custom mask) without writing any code manually — self-downloaded ncu, ran profiles, analyzed PTX, searched web — matching senior GPU engineer behavior per the operator's assessment. 46.7% speedup over Triton baseline. — [[2026-03-23-mfu达42-opus-4-6-autoresearch-8小时实现25轮迭代自]]
- A practitioner switched from iTerm2 after the [[Claude Code]] team lead Boris publicly stated [[Ghostty]] is the team's preferred terminal; the post used Claude Code to configure Ghostty in a single sentence from a config link. — [[2026-03-13-claude-code团队都在使用的终端软件ghostty-小红书]]
- Reddit r/ClaudeAI discussion (score 498): adding KISS/YAGNI/SOLID principles to prompts reduces code bloat ~50% even on Haiku 3.5; a structured ~800-token system prompt encoding these as pseudo-code behavioral directives was developed by asking Claude to optimize a prompt for LLM adherence. Lesson: SOLID can cause surface compliance on complex codebases; KISS+YAGNI+DRY is the minimal effective set per dissenting commenters. — [[2025-07-27-pro-tip-these-3-magic-words-will-make-cl]]
- In the AI era for STEM-background builders, [[Vibe Design]] is cited alongside Claude as a T0-tier tool for achieving product taste — the post accumulated 4,896 likes and 8,041 collects, signaling broad practitioner interest. — [[2026-03-13-理科生审美救星-vibe-design之神-小红书]]
- MCP教程中，作者使用Claude 3.7直接生成了一个统计桌面TXT文件数量的MCP Server（FastMCP封装，`@mcp.tool()`装饰器），并在Claude Desktop上测试通过；文中将Claude视为MCP协议的核心使用端，与[[Anthropic]] MCP协议的发布密切关联。 — [[2025-06-04-https-zhuanlan-zhihu-com-p-29001189476]]
- Andrej Karpathy将Claude列为个人常用LLM之一，与ChatGPT/Gemini/Grok/Perplexity并列，用于不同任务场景的交替使用；Karpathy明确区分各模型适用场景，将平台选择视为动态路由决策而非单一偏好。 — [[2025-06-04-andrej-karpathy-karpathy-on-x]]
