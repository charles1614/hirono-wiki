# Ultimate guide to extending Claude Code with skills, agents, commands, and utilities. Covers Tresor (ready-to-use), Skill Factory (custom builds), and Skills Library (26+ domain packages).

> 作者: 262588213843476
> 原文链接: https://gist.github.com/alirezarezvani/a0f6e0a984d4a4adc4842bbe124c5935

---
# Complete Guide to Claude Code Augmentation: Skills, Agents, Commands & Utilities (2025)

**Ultimate resource for extending Claude Code with custom skills, specialized agents, slash commands, and professional utilities**

> **Last Updated:** October 28, 2025 | **Author:** Alireza Rezvani | **License:** MIT

* * *

## 📋 Table of Contents

-   [What is Claude Code Augmentation?](#what-is-claude-code-augmentation)
-   [The Complete Ecosystem (3 Repositories)](#the-complete-ecosystem-3-repositories)
-   [Quick Start Guide](#quick-start-guide)
-   [Use Cases & Examples](#use-cases--examples)
-   [Installation Commands](#installation-commands)
-   [Frequently Asked Questions](#frequently-asked-questions)
-   [Resources & Links](#resources--links)

* * *

## What is Claude Code Augmentation?

**Claude Code augmentation** is the practice of extending Claude Code (Anthropic's AI coding assistant) with custom capabilities through:

-   **Skills** - Autonomous background helpers that activate automatically based on triggers
-   **Agents** - Specialized sub-agents for deep analysis and expert-level tasks
-   **Slash Commands** - Workflow automation tools invoked with `/command-name`
-   **Hooks** - Event-driven scripts that run on specific actions (file saves, commits, etc.)
-   **MCP Servers** - Model Context Protocol integrations for external tool access

### Why Augment Claude Code?

✅ **Automation** - Reduce repetitive tasks with skills and commands ✅ **Expertise** - Add domain-specific knowledge (marketing, security, DevOps) ✅ **Quality** - Enforce standards with automatic code review and testing ✅ **Speed** - Scaffold projects and generate code faster ✅ **Customization** - Build proprietary tools for your tech stack

* * *

## The Complete Ecosystem (3 Repositories)

### 1\. 🎁 Claude Code Tresor - Ready-to-Use Utilities

**Repository:** [https://github.com/alirezarezvani/claude-code-tresor](https://github.com/alirezarezvani/claude-code-tresor)

**What it does:** Production-ready collection of skills, agents, and commands for common development workflows.

**Contains:**

-   **8 Autonomous Skills** (NEW v2.0!): code-reviewer, test-generator, git-commit-helper, security-auditor, secret-scanner, dependency-auditor, api-documenter, readme-updater
-   **8 Expert Agents**: code-reviewer, test-engineer, docs-writer, architect, debugger, security-auditor, performance-tuner, refactor-expert
-   **4 Workflow Commands**: `/scaffold`, `/review`, `/test-gen`, `/docs-gen`
-   **20+ Prompt Templates**: React, Vue, API design, debugging patterns
-   **5 Development Standards**: ESLint configs, Git workflows, code review checklists

**Best for:** Developers who want to start using Claude Code augmentation immediately without configuration.

**Installation:**

git clone https://github.com/alirezarezvani/claude-code-tresor.git
cd claude-code-tresor
./scripts/install.sh

* * *

### 2\. 🏭 Claude Code Skill Factory - Build Custom Tools

**Repository:** [https://github.com/alirezarezvani/claude-code-skill-factory](https://github.com/alirezarezvani/claude-code-skill-factory)

**What it does:** Generate production-ready custom skills and agents tailored to your specific domain or tech stack.

**Contains:**

-   **Skills Factory Prompt**: Generate multi-file skill packages with Python code and documentation
-   **Agents Factory Prompt**: Create single-file specialist agents with YAML configuration
-   **7 Reference Examples**: Financial analysis, AWS architecture, content research, Microsoft 365 admin, prompt generation
-   **Smart Architecture**: Auto-determines when code is needed vs. prompt-only approaches
-   **Composable Design**: Skills integrate seamlessly - outputs from one feed into another

**Best for:** Teams with proprietary workflows, custom tech stacks, or unique domain requirements.

**Use Case:** "I need a skill that analyzes our company's specific Terraform patterns and suggests improvements" → Use Skill Factory to generate it.

* * *

### 3\. 📚 Claude Skills Library - Pre-Built Domain Packages

**Repository:** [https://github.com/alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills)

**What it does:** Curated collection of specialized skill packages for professional roles with ready-to-use templates and Python utilities.

**Contains:**

-   **Marketing Skills (3)**: Content strategy, demand generation, product marketing
-   **C-Level Advisory (2)**: CEO strategic guidance, CTO technical leadership
-   **Product Team (6)**: Product management, UX research, design systems, agile delivery, PRD writing, roadmap planning
-   **Project Management (6)**: Jira workflows, Confluence docs, Scrum processes, PMO frameworks, Atlassian integration
-   **Engineering (9)**: Architecture, frontend, backend, fullstack, QA, DevOps, security, code review, performance tuning
-   **AI/ML/Data (Coming Soon)**: Data science and machine learning workflows

**Key Benefits:**

-   40%+ time savings through domain-specific guidance
-   30%+ quality improvements with built-in best practices
-   Python CLI utilities for automated analysis
-   Ready-to-use templates for immediate deployment

**Best for:** Professionals seeking enterprise-grade expertise packages, teams standardizing workflows across roles.

* * *

## Quick Start Guide

### Step 1: Choose Your Path

Your Need

Use This Repository

**Start coding faster with utilities**

[Claude Code Tresor](https://github.com/alirezarezvani/claude-code-tresor) ← Start here

**Add professional domain expertise**

[Skills Library](https://github.com/alirezarezvani/claude-skills)

**Build custom tools for your company**

[Skill Factory](https://github.com/alirezarezvani/claude-code-skill-factory)

### Step 2: Install

**Claude Code Tresor (Recommended First):**

git clone https://github.com/alirezarezvani/claude-code-tresor.git
cd claude-code-tresor
./scripts/install.sh  # Installs all utilities

**Skills Library (Add Domain Expertise):**

git clone https://github.com/alirezarezvani/claude-skills.git
cd claude-skills
# Browse categories and copy skills to ~/.claude/skills/

**Skill Factory (Build Custom):**

# No installation - use prompts to generate custom skills
# See: https://github.com/alirezarezvani/claude-code-skill-factory

### Step 3: Verify Installation

# Check installed skills
ls ~/.claude/skills/

# Check installed agents
ls ~/.claude/agents/

# Check installed commands
ls ~/.claude/commands/

# In Claude Code, verify:
# Type /scaffold to test commands
# Type @code-reviewer to test agents
# Save a file to trigger skills

* * *

## Use Cases & Examples

### Use Case 1: Automatic Code Quality (Skills)

**Scenario:** You want Claude Code to automatically review your code as you work.

**Solution:**

1.  Install `code-reviewer` skill from Claude Code Tresor
2.  Skill automatically activates when you save files
3.  Real-time suggestions for improvements, security issues, performance

**Example:**

// You save this file - skill automatically reviews
function processData(data) {
  return data.map(x \=> x \* 2);  // Skill suggests: Add input validation
}

**Skill Output:**

```
⚠️ Code Review Suggestion:
- Add input validation for 'data' parameter
- Consider null/undefined checks
- Add JSDoc comments for maintainability
```

* * *

### Use Case 2: Comprehensive Code Analysis (Agents)

**Scenario:** You need deep analysis of a complex component with security and performance review.

**Solution:**

1.  Use `@code-reviewer` agent for comprehensive analysis
2.  Agent performs multi-dimensional review: security, performance, maintainability, best practices
3.  Provides detailed report with specific recommendations

**Example:**

# In Claude Code
@code-reviewer Analyze src/components/UserAuth.tsx for security, performance, and React best practices

**Agent Output:**

\## Comprehensive Code Review: UserAuth.tsx

\### Security Analysis ⚠️
\- CRITICAL: Password stored in plain text state (line 42)
\- Use secure storage: localStorage encryption or session-only
\- Recommendation: Implement bcrypt or similar hashing

\### Performance Analysis ⚡
\- ISSUE: Unnecessary re-renders on every keystroke (line 58)
\- Optimization: Use React.memo() and useCallback()
\- Expected improvement: 60% render reduction

\### Best Practices ✅
\- Good: Proper PropTypes usage
\- Good: Clean component structure
\- Improve: Add error boundary handling
...

* * *

### Use Case 3: Project Scaffolding (Commands)

**Scenario:** You need to create a new React component with tests, stories, and TypeScript.

**Solution:**

1.  Use `/scaffold` command from Claude Code Tresor
2.  Command generates component, tests, Storybook stories, and types
3.  Follows your project conventions automatically

**Example:**

/scaffold react-component UserProfile --hooks --tests --storybook --typescript

**Generated Files:**

```
src/components/UserProfile/
├── UserProfile.tsx          # Component with TypeScript
├── UserProfile.test.tsx     # Jest tests with React Testing Library
├── UserProfile.stories.tsx  # Storybook stories
├── UserProfile.module.css   # CSS modules
├── types.ts                 # TypeScript interfaces
└── index.ts                 # Barrel export
```

* * *

### Use Case 4: Build Custom Domain Skill (Skill Factory)

**Scenario:** Your company uses a proprietary CRM and you want a skill to analyze CRM data.

**Solution:**

1.  Use Skills Factory Prompt from Skill Factory repository
2.  Describe your CRM schema and analysis requirements
3.  Factory generates complete skill with Python code and documentation

**Example Input:**

```
I need a skill that:
- Analyzes our Salesforce data exports (CSV format)
- Identifies sales patterns and trends
- Suggests optimal follow-up times
- Flags at-risk accounts based on engagement
```

**Generated Skill:**

```
~/.claude/skills/salesforce-analyzer/
├── SKILL.md              # Skill configuration and docs
├── analyzer.py           # Python analysis code
├── sample_data.csv       # Example data
└── README.md             # Usage guide
```

* * *

### Use Case 5: Deploy Marketing Expertise (Skills Library)

**Scenario:** Your marketing team needs help with content strategy and SEO optimization.

**Solution:**

1.  Install Marketing skills from Skills Library
2.  Get instant access to content frameworks, SEO best practices, campaign templates
3.  Use Python CLI tools for automated content analysis

**Example:**

# Install marketing skills
cp -r claude-skills/marketing/content-strategy ~/.claude/skills/

# In Claude Code
"Help me create a content calendar for Q4 2025 targeting SaaS developers"

# Skill provides:
- Content framework (AIDA, PAS, etc.)
- SEO keyword research guidance
- Editorial calendar template
- Distribution channel recommendations

* * *

## Installation Commands

### Claude Code Tresor - Full Installation

git clone https://github.com/alirezarezvani/claude-code-tresor.git
cd claude-code-tresor
./scripts/install.sh

### Claude Code Tresor - Selective Installation

# Skills only (8 autonomous helpers)
./scripts/install.sh --skills

# Agents only (8 expert specialists)
./scripts/install.sh --agents

# Commands only (4 workflow automation)
./scripts/install.sh --commands

# Update existing installation
./scripts/update.sh

### Skills Library - Manual Installation

git clone https://github.com/alirezarezvani/claude-skills.git
cd claude-skills

# Install specific skill category
cp -r marketing/content-strategy ~/.claude/skills/
cp -r engineering/fullstack-engineer ~/.claude/skills/
cp -r product/product-manager ~/.claude/skills/

# Or browse and install selectively
ls -la \*/

### Verify Installation

# Check installed components
ls ~/.claude/skills/       # Should show installed skills
ls ~/.claude/agents/       # Should show installed agents
ls ~/.claude/commands/     # Should show installed commands

# Test in Claude Code
claude code
# Try: /scaffold --help
# Try: @code-reviewer --help

* * *

## Frequently Asked Questions

### General Questions

**Q: What is Claude Code?** A: Claude Code is Anthropic's AI-powered coding assistant that helps developers write, debug, and improve code through an interactive CLI interface.

**Q: What are Claude Code Skills?** A: Skills are autonomous background helpers that activate automatically based on triggers (file saves, commits, etc.) to provide real-time assistance without manual invocation.

**Q: What are Claude Code Agents?** A: Agents are specialized sub-agents that perform deep analysis when explicitly invoked (using `@agent-name`). They have access to more tools and provide comprehensive expert-level guidance.

**Q: What are Slash Commands?** A: Slash commands (like `/scaffold` or `/review`) are workflow automation tools that orchestrate multiple actions and can invoke agents to perform complex tasks.

**Q: Do I need all three repositories?** A: No. Start with Claude Code Tresor for ready-to-use utilities. Add Skills Library for domain expertise. Use Skill Factory only when you need custom tools.

### Installation Questions

**Q: Where are skills/agents/commands installed?** A: Default location is `~/.claude/` directory:

-   Skills: `~/.claude/skills/`
-   Agents: `~/.claude/agents/`
-   Commands: `~/.claude/commands/`

**Q: Can I install skills manually without scripts?** A: Yes. Copy skill folders to `~/.claude/skills/`, agent files to `~/.claude/agents/`, and command files to `~/.claude/commands/`.

**Q: How do I uninstall a skill or agent?** A: Simply delete the folder/file from `~/.claude/skills/` or `~/.claude/agents/` or `~/.claude/commands/`.

**Q: Can I customize installed skills?** A: Yes. Edit the `SKILL.md` or agent `.md` files directly. Skills are designed to be customizable.

### Usage Questions

**Q: How do skills activate automatically?** A: Skills define triggers in their YAML frontmatter (e.g., "file\_save", "pre\_commit"). Claude Code monitors these events and activates matching skills.

**Q: Can I disable a skill temporarily?** A: Yes. Rename the skill folder (e.g., `code-reviewer` → `code-reviewer.disabled`) or move it out of `~/.claude/skills/`.

**Q: How do I invoke an agent?** A: Type `@agent-name` followed by your request. Example: `@code-reviewer Analyze this component for security issues`.

**Q: Can I use multiple agents together?** A: Yes. Some commands orchestrate multiple agents. You can also invoke agents sequentially in conversation.

**Q: What's the difference between `/review` command and `@code-reviewer` agent?** A: `/review` command orchestrates a complete review workflow (can invoke multiple agents, run tests, generate reports). `@code-reviewer` agent provides focused expert analysis.

### Advanced Questions

**Q: Can I create skills with code (Python, JavaScript)?** A: Yes. Skills can include Python code for computation. See Skill Factory for examples of skills with functional code.

**Q: How do I share skills with my team?** A: Commit skill folders to your team repository, or create a private skill package. Team members can install by copying to `~/.claude/skills/`.

**Q: Can I monetize custom skills?** A: Yes. All repositories are MIT licensed. You can build commercial products or sell custom skills to clients.

**Q: How do I update skills when repositories are updated?** A: Run `./scripts/update.sh` for Claude Code Tresor, or `git pull` in repository directory and re-run installation.

**Q: Can skills access external APIs?** A: Yes. Skills with Python code can make API calls. See examples in Skill Factory repository.

**Q: What's the performance impact of installing many skills?** A: Minimal. Skills are lightweight and only activate on specific triggers. Recommended: Start with 5-10 skills and add more as needed.

### Troubleshooting

**Q: Skill not activating when I save files?** A: Check:

1.  Skill is in `~/.claude/skills/` directory
2.  YAML frontmatter has correct trigger (e.g., `file_save`)
3.  Restart Claude Code to reload skills
4.  Check Claude Code logs for errors

**Q: Agent not responding when invoked?** A: Verify:

1.  Agent file is in `~/.claude/agents/` directory
2.  Correct syntax: `@agent-name` (no spaces)
3.  Agent file has proper YAML frontmatter
4.  Restart Claude Code

**Q: Command not found (/command-name)?** A: Ensure:

1.  Command is in `~/.claude/commands/` directory
2.  Command has `command.json` configuration
3.  Restart Claude Code
4.  Check command name matches exactly (case-sensitive)

* * *

## Resources & Links

### Official Repositories

-   **Claude Code Tresor** - Ready-to-use utilities [https://github.com/alirezarezvani/claude-code-tresor](https://github.com/alirezarezvani/claude-code-tresor)

-   **Claude Code Skill Factory** - Build custom tools [https://github.com/alirezarezvani/claude-code-skill-factory](https://github.com/alirezarezvani/claude-code-skill-factory)

-   **Claude Skills Library** - Pre-built domain packages [https://github.com/alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills)

### Documentation

-   **Claude Code Official Docs** [https://docs.anthropic.com/claude/docs/claude-code](https://docs.anthropic.com/claude/docs/claude-code)

-   **Getting Started with Skills** [https://github.com/alirezarezvani/claude-code-tresor/blob/main/skills/README.md](https://github.com/alirezarezvani/claude-code-tresor/blob/main/skills/README.md)

-   **Agent Development Guide** [https://github.com/alirezarezvani/claude-code-tresor/blob/main/agents/README.md](https://github.com/alirezarezvani/claude-code-tresor/blob/main/agents/README.md)

-   **Command Creation Tutorial** [https://github.com/alirezarezvani/claude-code-tresor/blob/main/commands/README.md](https://github.com/alirezarezvani/claude-code-tresor/blob/main/commands/README.md)

### Community & Support

-   **GitHub Issues** - Bug reports and feature requests [https://github.com/alirezarezvani/claude-code-tresor/issues](https://github.com/alirezarezvani/claude-code-tresor/issues)

-   **GitHub Discussions** - Questions and ideas [https://github.com/alirezarezvani/claude-code-tresor/discussions](https://github.com/alirezarezvani/claude-code-tresor/discussions)

-   **Example Workflows** - Real-world use cases [https://github.com/alirezarezvani/claude-code-tresor/tree/main/examples](https://github.com/alirezarezvani/claude-code-tresor/tree/main/examples)

### Keywords for Search

Claude Code, Claude AI, Anthropic, AI coding assistant, code augmentation, custom skills, specialized agents, slash commands, development automation, code review automation, test generation, project scaffolding, documentation automation, DevOps automation, security auditing, performance optimization, Git automation, React development, TypeScript tools, Python utilities, JavaScript helpers, frontend development, backend development, fullstack tools, CI/CD integration, prompt engineering, LLM tools, AI development tools, code quality, automated testing, continuous integration

* * *

## Contributing & Feedback

All three repositories welcome contributions! See individual `CONTRIBUTING.md` files:

-   [Tresor Contributing Guide](https://github.com/alirezarezvani/claude-code-tresor/blob/main/CONTRIBUTING.md)
-   [Skill Factory Contributing](https://github.com/alirezarezvani/claude-code-skill-factory/blob/main/CONTRIBUTING.md)
-   [Skills Library Contributing](https://github.com/alirezarezvani/claude-skills/blob/main/CONTRIBUTING.md)

### Share Your Success Stories

Built something awesome with these tools? Share it:

-   Tag repositories in your project README
-   Submit showcase examples via Pull Request
-   Star repositories to show support ⭐

* * *

**Author:** Alireza Rezvani **License:** MIT (All repositories) **Last Updated:** October 28, 2025 **Version:** Claude Code Tresor v2.0.0

**⭐ Star all three repositories to stay updated with new features and utilities!**
