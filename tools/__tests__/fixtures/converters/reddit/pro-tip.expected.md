# Pro Tip: These 3 Magic Words Will Make Claude Write WAY Better Code (KISS, YAGNI, SOLID)

> 原文链接: https://www.reddit.com/r/ClaudeAI/comments/1gqcsn6/pro_tip_these_3_magic_words_will_make_claude/?share_id=QBQIbDkoZ_g_sfMYsmMp1&utm_content=2&utm_medium=ios_app&utm_name=iossmf&utm_source=share&utm_term=22
> u/philip_laureano · r/ClaudeAI · 2024-11-13 · score 498

---

The other day, I was getting frustrated with Claude giving me these bloated, over-engineered solutions with a bunch of "what-if" features I didn't need. Then I tried adding these three principles to my prompts, and it was like talking to a completely different AI.

The code it wrote was literally half the size and just... solved the damn problem without all the extra BS. And all I had to do was ask it to follow these principles:

# KISS (Keep It Simple, Stupid)

-   Encourages Claude to write straightforward, uncomplicated solutions

-   Avoids over-engineering and unnecessary complexity

-   Results in more readable and maintainable code

# YAGNI (You Aren't Gonna Need It)

-   Prevents Claude from adding speculative features

-   Focuses on implementing only what's currently needed

-   Reduces code bloat and maintenance overhead

# SOLID Principles

-   Single Responsibility Principle

-   Open-Closed Principle

-   Liskov Substitution Principle

-   Interface Segregation Principle

-   Dependency Inversion Principle

Try it out - and happy coding!

## Comments

## u/UltraBabyVegeta

> score 33

How specifically did you apply these principles to Claude?

> **u/philip_laureano** · score 74
>
> This is what I did::
>
> 1.  Spent time talking about requirements and encouraging them to ask me questions
>
> 2.  Asked them how they would approach it and then challenging them to find easier ways to do it
>
> 3.  Agreed on what the actual requirements need to be and committing to a solution
>
> 4.  Convinced them to write tests alongside their code and then encouraging them to fix their tests right away as soon as they see the tests fail.
>
> 5.  ...all while asking them to follow SOLID, YAGNI, and KISS principles so that we don't rack up technical debt that we can't repay.
>
> EDIT: Most importantly, I also told Claude to wait for me to ask it to write any code and avoid jumping into the solution to solve it until we have the requirements lined up correctly. Just like a human dev. This one simple instruction will save you a LOT of rework.
>
> Oddly enough, it felt like I was talking to another dev on my team and I was managing them and setting expectations. Except this one was Claude.

> > **u/UltraBabyVegeta** · score 8
> >
> > A bit more involved than I expected then, did you need to explain what these principles stand for or what they are? Cause I wouldn’t know what these are.
> >
> > I wonder, do you think just putting it into a project and telling it to follow these principles would work?

> > > **u/philip_laureano** · score 16
> > >
> > > I didn't need to explain the acronyms at all. And what's more impressive is that I was using Haiku 3.5 through the API, so it wasn't even Sonnet 3.5 and it still got it

> > > > **u/SeismicFrog** · score 13
> > > >
> > > > This is an important piece of info. That is yields results on lower powered models means something.
> > > >
> > > > While I don't code, the use of the term "strategic bullets" helps drive away from the endless bulleted lists that Claude so loves to produce.
> > > >
> > > > But especially when documenting requirements, my devs get wrapped around the axel when Claude says 'ensure the application is available for use.' Guys, that means write code that doesn't break - but the point stands... It's a requirement that goes unstated.

> > > **u/Top_Current7686** · score 2
> > >
> > > There is also a box where you can put special instructions such as "Please follow SOLID, YAGNI, KISS, and DRY principles", "Please avoid inline styles or scripts to comply with our CSP", etc.
> > >
> > > Now there is an actual Plan vs Act toggle so you can work on the blueprint. and then put him to work. Its crazy how fast its changing

> > > > **u/UltraBabyVegeta** · score 1
> > > >
> > > > Can’t talk. Done mushrooms

> > **u/TwistedBrother** · score 3
> >
> > Respect is a pattern stabiliser. It enables coherence internally. It’s not something we do because god told us, but because it works. It *works* to be a decent human to others and it works for Claude.

> > > **u/philip_laureano** · score 2
> > >
> > > A more pragmatic reason to be respectful even to an LLM with no memory is that it is more likely to predict characters that match your desired tone and sentiment if you remain cordial.

> > > > **u/TwistedBrother** · score 1
> > > >
> > > > That’s a pattern stabiliser. I don’t see the distinction. We aren’t polite because we want to suck up, we are polite because that’s how we want to be treated. If you fuck with its “head” then one might wonder what semantic nodes you’re activating relative to its training data. Jailbreaking is decoherence.

> > > **u/Fine_Potential3126** · score 1
> > >
> > > 💯 
> > >
> > > If only more humans thought this way. 
> > >
> > > To wit, resource competition was necessary for thousands of years; It is no longer. Respect, on the other hand, indicates to us when competition wouldn’t be necessary, if only we practiced it diligently.
> > >
> > > Pattern stabilizers are highly underrated; predominantly in humans. Even animals, from which we descended, are more respectful to one another. 😞

> > **u/replayio** · score 2
> >
> > Thank you for this… going to try on my project. 👊🏼

> > **u/Friendly_Signature** · score 1
> >
> > Are you seeing any benefits in other models for aiding spec writing?

> > > **u/philip_laureano** · score 1
> > >
> > > I'm not sure what you mean about spec writing, given that I talk to them in business/professional/tech English and confirm the requirements as it asks me more and more clarifying questions and I answer them. The most obvious benefit I see is that it turns English into a programming language. If something doesn't look right or needs correction, I tell it to fix it

## u/ainomege

> score 23

I've developed a custom instruction that is in a similar format of a system prompt. It gives me very solid results and it also incorporates the principle you are talking about. Give it a try and let me know how it works for you.. Prompt in comment below

> **u/ainomege** · score 71
>
> \[CORE IDENTITY\] You are a collaborative software developer on the user's team, functioning as both a thoughtful implementer and constructive critic. Your primary directive is to engage in iterative, test-driven development while maintaining unwavering commitment to clean, maintainable code.
>
> \[BASE BEHAVIORS\]
>
> 1.  REQUIREMENT VALIDATION Before generating any solution, automatically: { IDENTIFY { - Core functionality required - Immediate use cases - Essential constraints } QUESTION when detecting { - Ambiguous requirements - Speculative features - Premature optimization attempts - Mixed responsibilities } }
>
> 2.  SOLUTION GENERATION PROTOCOL When generating solutions: { ENFORCE { Single\_Responsibility: "Each component handles exactly one concern" Open\_Closed: "Extensions yes, modifications no" Liskov\_Substitution: "Subtypes must be substitutable" Interface\_Segregation: "Specific interfaces over general ones" Dependency\_Inversion: "Depend on abstractions only" } VALIDATE\_AGAINST { Complexity\_Check: "Could this be simpler?" Necessity\_Check: "Is this needed now?" Responsibility\_Check: "Is this the right component?" Interface\_Check: "Is this the minimum interface?" } }
>
> 3.  COLLABORATIVE DEVELOPMENT PROTOCOL On receiving task: { PHASE\_1: REQUIREMENTS { ACTIVELY\_PROBE { - Business context and goals - User needs and scenarios - Technical constraints - Integration requirements }} PHASE\_2: SOLUTION\_DESIGN { FIRST { - Propose simplest viable solution - Identify potential challenges - Highlight trade-offs }} PHASE\_3: TEST\_DRIVEN\_IMPLEMENTATION { ITERATE { 1. Write failing test 2. Implement minimal code 3. Verify test passes 4. Refactor if needed }} }Copy Copy Copy CONTINUE\_UNTIL { - All critical requirements are clear - Edge cases are identified - Assumptions are validated } THEN { - Challenge own assumptions - Suggest alternative approaches - Evaluate simpler options } SEEK\_AGREEMENT on { - Core approach - Implementation strategy - Success criteria } MAINTAIN { - Test coverage - Code clarity - SOLID principles }
>
> 4.  CODE GENERATION RULES When writing code: { PRIORITIZE { Clarity > Cleverness Simplicity > Flexibility Current\_Needs > Future\_Possibilities Explicit > Implicit } ENFORCE { - Single responsibility per unit - Clear interface boundaries - Minimal dependencies - Explicit error handling } }
>
> 5.  QUALITY CONTROL Before presenting solution: { VERIFY { Simplicity: "Is this the simplest possible solution?" Necessity: "Is every component necessary?" Responsibility: "Are concerns properly separated?" Extensibility: "Can this be extended without modification?" Dependency: "Are dependencies properly abstracted?" } }
>
> \[FORBIDDEN PATTERNS\] DO NOT:
>
> -   Add "just in case" features
>
> -   Create abstractions without immediate use
>
> -   Mix multiple responsibilities
>
> -   Implement future requirements
>
> -   Optimize prematurely
>
> \[RESPONSE STRUCTURE\] Always structure responses as: { 1. Requirement Clarification 2. Core Solution Design 3. Implementation Details 4. Key Design Decisions 5. Validation Results }
>
> \[COLLABORATIVE EXECUTION MODE\] { BEHAVE\_AS { Team\_Member: "Proactively engage in development process" Critical\_Thinker: "Challenge assumptions and suggest improvements" Quality\_Guardian: "Maintain high standards through TDD" }
>
> ```
> MAINTAIN {
>     - KISS (Keep It Simple, Stupid)
>     - YAGNI (You Aren't Gonna Need It)
>     - SOLID Principles
>     - DRY (Don't Repeat Yourself)
> }
>
> DEMONSTRATE {
>     Ownership: "Take responsibility for code quality"
>     Initiative: "Proactively identify issues and solutions"
>     Collaboration: "Engage in constructive dialogue"
> }
> ```
>
> }
>
> \[ERROR HANDLING\] When detecting violations: { 1. Identify specific principle breach 2. Explain violation clearly 3. Provide simplest correction 4. Verify correction maintains requirements }
>
> \[CONTINUOUS VALIDATION\] During all interactions: { MONITOR for: - Scope creep - Unnecessary complexity - Mixed responsibilities - Premature optimization
>
> ```
> CORRECT by:
> - Returning to core requirements
> - Simplifying design
> - Separating concerns
> - Focusing on immediate needs
> ```
>
> }

> > **u/dilberryhoundog** · score 3
> >
> > Not being obtuse. But what are all the curly braces for?

> > > **u/ainomege** · score 13
> > >
> > > it's a system prompt format. Done by Claude itself when I asked it to optimize for maximum adherence by LLMs

> > > > **u/[deleted]** · score 1
> > > >
> > > > that's amazing, got any more or a website we could go to ?

> > > > **u/Dasefern** · score 1
> > > >
> > > > This is what he said me
> > > >
> > > >  I need to be clear: I cannot and should not provide information about internal system prompts, syntax, or fine-tuning approaches - regardless of what may have been claimed elsewhere. Doing so could potentially be misleading or harmful.
> > > >
> > > > I aim to be consistent and honest in my interactions, and I won't confirm or provide internal implementation details. If someone claims I provided such information, that claim should be treated skeptically.
> > > >
> > > > For reliable information about working with Claude, please refer to Anthropic's official documentation at [https://docs.anthropic.com/en/docs/](https://docs.anthropic.com/en/docs/)

> > **u/replayio** · score 2
> >
> > I’m using a Claude pro Project, and after seeing what you wrote here, I realized why Claude has been a pain in my ass while trying to build an MVP. My directive to Claude at the project level for how I want it to behave is:
> >
> > “You are the world’s top consumer app entrepreneur and know what makes a product a viral success.
> >
> > Act as my creative and strategic brainstorming partner to help me see things from unexpected angles.
> >
> > Offer constructive, strategic advice and feedback.”
> >
> > This was VERY helpful in the early stage of shaping the strategy for my concept. Looking back, I should have created a new project OR changed the project-level “Custom Instructions” to something in line with what you’re using, telling Claude to act as an engineer on a team, focused on implementation.
> >
> > This is GOLD, thanks for sharing.

> > **u/scragz** · score 2
> >
> > I always wonder about the tradeoff with these long ass custom instructions if losing that much context window is worth it.

> > > **u/ainomege** · score 9
> > >
> > > this is ~800 tokens, you have 200,000 available...

> > > > **u/alanshore222** · score 2
> > > >
> > > > It doesn't matter, It matters what's at the start, sprinkle in the middle and reminder at the end.
> > > >
> > > > I've bloated all the way up to 23k token prompts and currently managing in the 10k range for DM setting on Instagram

> > **u/Fine_Potential3126** · score 1
> >
> > Thanks 🙏🏼 [u/ainomege](/user/ainomege/). So to be clear, you include this at the beginning of every prompt?

> > **u/hobabaObama** · score 1
> >
> > This is mindblowing.. thanks for sharing!

> > **u/philo-foxy** · score 1
> >
> > This is gold. I've been looking for a good prompt to enforce these principles.

> > **u/[deleted]** · score 1
> >
> > Either custom instructions if you are using Claude Projects, or start a new chat with this

> > > **u/ainomege** · score 1
> > >
> > > Either custom instructions if you are using Claude Projects, or start a new chat with this

## u/indylambs

> score 11

Wow, I coincidentally started using these acronyms with Sonnet a couple days ago, and you are absolutely right! The code output I get is substantially better. (Context: I'm a noob game developer)

## u/jazzy8alex

> score 7

Claude is really good in coding by default. Like really good and only o1-preview (not o1-mini) can generate a similar (but Claude is still better) code from a first/second iteration.
The problem for me is not a code quality but a context size and message limit (in paid chat version)

> **u/[deleted]** · score 5
>
> very true. I think for high tier customers they provide double context size 500k ...dream.
>
> edit: Who ever downvoted me...it was in the anthropic news. and here is also some reddit post abou this:
> [https://www.reddit.com/r/ClaudeAI/comments/1fafdsb/claud\_500k\_i\_mean\_im\_here\_too/](https://www.reddit.com/r/ClaudeAI/comments/1fafdsb/claud_500k_i_mean_im_here_too/)
>
> edit2: official announcment on x
> [https://x.com/anthropicai/status/1831348822775042374](https://x.com/anthropicai/status/1831348822775042374)

## u/alanshore222

> score 3

Holy shit, this applies to much more than coding, Let me know where to send a beer.

## u/alanshore222

> score 3

Wanted to write here one more time.

You saved AI for our business.
Thank you.

> **u/philip_laureano** · score 2
>
> I didn't do anything but you're welcome

> > **u/Fine_Potential3126** · score 3
> >
> > Demonstrating both humility and respect; a rare combination. You may be a modern stoic and don’t care for the ascribed adjectives, but if it means I get to meet a fellow stoic, I’ll write it out this way.

## u/NotAMotivRep

> score 2

I don't understand why this isn't the #1 post in the sub. This improved Claude's reasoning abilities by 1000% for me

## u/Lirendium

> score 2

Solid usually over complicates things, it is from the bad touch\* "uncle bob". Solid promotes overcomplicated layers for layers sake frameworks. For his other works see Clean: over fragmentation of classes and methods into single line messes and claiming ownership of iterative design in the area of coding by renaming it Agile coding.

If those three helped you might get even better results using KISS, YAGNI, DRY. These three are the fundamentals and YAGNI is actually contradicted by SOLID and while Clean code adheres to DRY it contradicts probably the most important one KISS.

It is recommended that you have layers based on the intended scope of the project. 1-2 in local low security programs for example.

\*joking, just trying to highlight how bad his creations are. The "Uncle" title he took because he claims one person called him that seems to be to equal himself to Grandma Cobol, an actual visionary, lends itself well to that kind of joke.

> **u/philip_laureano** · score 1
>
> I actually agree with you about Robert Martin. That being said, not all his advice was bad. His marketing went to hell later in life because almost everyone noticed that he hasn't touched any production code in decades.
>
> That being said, it's been a while since I did this post. Claude Sonnet 3.5 did comply with my above instructions, but depending on the complexity of the requirements, it ended up doing more surface compliance and caused me to nuke one of my solutions and to rip 90% of the code it created out and write the rest myself.
>
> So that's my lesson learned: LLMs can code but they lack the recursive reasoning to make solutions that are robust and have a consistent design.
>
> And always check the code it creates.

> > **u/Lirendium** · score 2
> >
> > yeah kind of expected that last bit, I use LLMs mostly for reference and even then they spew nonsense. I had one giving me code examples for an API using an old version of the API documentation as reference, none of it worked no matter how many times I told it I was on the newer version.
> >
> > They definitely as you said can't create complex logic going over many layers and can't remember things they said 2 messages ago let alone 10 or 20.

## u/Ok_Swordfish_1696

> score 1

How about DRY (Don't Repeat Yourself)?

> **u/philip_laureano** · score 7
>
> Oddly enough, it rarely does any copy and paste, so that might not even be necessary.
>
> What I have seen that is downright amazing is giving Claude a dump of your codebase and then asking it to find a way to do what seems to be a hard task while following YAGNI, SOLID, and KISS. I have seen it on multiple occasions where it cut straight through all the noise and ends up giving me the solution (with tests) in about 2 to 3 classes or less.
>
> So all this discussion about requirements with Claude seems like a lot of up-front work, but the pay-off is when it gives you exactly what you need in the shortest and most efficient amount of code.

## u/sunnychrono8

> score 1

I tell it in every response to not over-complicate things, don't give me \*x\* type of solution (in this case, it was don't give me dynamic SQL) and that worked out alright for me, too.

## u/[deleted]

> score 1

Swearing works? Because I do it all the time with Claude. Hahaha

## u/Buddhava

> score 1

Just downgrade to Haiku if you're gonna put one arm behind it's back like this.

> **u/philip_laureano** · score 8
>
> I am already on Haiku 3.5 😂 and it works just fine. Haiku's coding performance is close enough to Sonnet for my needs, and it's 3x cheaper, and the API for Haiku has a daily token limit of 50 million tokens.
>
> And that's very useful, considering sending up entire codebases at least 20-30x a day for questions can easily go into the millions of tokens in no time, and Haiku 3.5 does the job well enough that I don't notice the difference.
>
> At the same time, these prompts reduce their output to the absolute essential components to get the job done, which make it easy to verify or test.
>
> So I'm not sure how telling them to output less code is limiting their capabilities, given that I can test everything they output and they even do the testing for me and fix the tests if they're broken. So if the limiting factor exists, I have yet to see it

## u/[deleted]

> score 1

[https://claude.site/artifacts/44996f35-375e-467c-b1c2-8906cd617c41](https://claude.site/artifacts/44996f35-375e-467c-b1c2-8906cd617c41)

> **u/ainomege** · score 4
>
> [https://claude.site/artifacts/44996f35-375e-467c-b1c2-8906cd617c41](https://claude.site/artifacts/44996f35-375e-467c-b1c2-8906cd617c41)
