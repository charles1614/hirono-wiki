# [KVConnector] Add metrics to Prometheus-Grafana dashboard by NickLucche · Pull Request #26811 · vllm

> 原文链接: https://github.com/vllm-project/vllm/pull/26811

---

## NickLucche

> opened this on Oct 14, 2025 · Collaborator

Follow-up to the work and discussion in this PR https://github.com/vllm-project/vllm/pull/22188.
Here we expose the metrics we're currently tracking for the nixl connector to prometheus.

<img width="1396" height="927" alt="image" src="01-image.bin" />

cc @markmc  

Update:
@markmc generalized the PR to work for KVConnectorStats more broadly

### Conversation

Signed-off-by: NickLucche <nlucches@redhat.com>

 [NickLucche](/NickLucche) marked this pull request as ready for review [October 14, 2025 21:57](#event-20270826662)

 [NickLucche](/NickLucche) requested review from [WoosukKwon](/WoosukKwon), [alexm-redhat](/alexm-redhat), [comaniac](/comaniac), [njhill](/njhill), [robertgshaw2-redhat](/robertgshaw2-redhat) and [ywang96](/ywang96) as [code owners](/vllm-project/vllm/blob/ca683a2a729d894286e7fef6afcb4d34b75e37ca/.github/CODEOWNERS#L29) [October 14, 2025 21:57](#event-20270826894)

[@mergify](/apps/mergify) [mergify](/apps/mergify) Bot added [v1](/vllm-project/vllm/issues?q=state%3Aopen%20label%3Av1) [kv-connector](/vllm-project/vllm/issues?q=state%3Aopen%20label%3Akv-connector) labels [Oct 14, 2025](#event-20270842465)

[[Metrics] [KVConnector] Add connector prefix cache hit rate stats #26245](/vllm-project/vllm/pull/26245)

Signed-off-by: Mark McLoughlin <markmc@redhat.com>

[[NIXL][Metrics] Add abstraction for per-connector Prometheus metrics NickLucche/vllm#4](/NickLucche/vllm/pull/4)

Comment thread [vllm/v1/metrics/loggers.py](/vllm-project/vllm/pull/26811/files/f6b39fab8e1eb2c4d8e3a27decdcd9f56961468d#diff-43531f6ec44e98f78e8f3fd53839a31c4fe4dd1c1b9015a45bf88b6f5dfeaabd) Outdated

nixl\_histogram\_post\_time, engine\_indexes, model\_name

)

\# uniform 2kb to 16gb range

buckets = \[2\*\*10 + i for i in range(1, 24, 2)]

![@charles1614](github-snap-pr-images/img_009.jpg)

Reply...

Suggest changes

* * *

* * *

* * *

-   Suggest changes

##### An unexpected error has occurred

Leave a comment

Cancel

Comment thread [vllm/v1/metrics/loggers.py](/vllm-project/vllm/pull/26811/files/f6b39fab8e1eb2c4d8e3a27decdcd9f56961468d#diff-43531f6ec44e98f78e8f3fd53839a31c4fe4dd1c1b9015a45bf88b6f5dfeaabd) Outdated

name="vllm:nixl\_post\_time\_seconds",

documentation="Histogram of transfer post time for NIXL KV"

" Cache transfers.",

buckets=buckets\[1:],

![@charles1614](github-snap-pr-images/img_009.jpg)

Reply...

Suggest changes

* * *

* * *

* * *

-   Suggest changes

##### An unexpected error has occurred

Leave a comment

Cancel

\[NIXL][Metrics] Add abstraction for per-connector Prometheus metrics

 [NickLucche](/NickLucche) requested a review from [ApostaC](/ApostaC) as a [code owner](/vllm-project/vllm/blob/3567816932e674abce3f44ceb0aff03f73b5aaff/.github/CODEOWNERS#L18) [October 24, 2025 18:04](#event-20479273973)

[[KV Connector][Metrics] Add prometheus metrics support to multi-connector NickLucche/vllm#5](/NickLucche/vllm/pull/5)

`[[NIXL][Metrics] Fix NIXL buckets](/vllm-project/vllm/pull/26811/commits/35f8ba1ed416ab154d387c5e73dd439360acadab "[NIXL][Metrics] Fix NIXL buckets It's post times that need the smaller bucket size, not transfer duration. Uniform 2kb to 16gb range: ``` >>> def human_size(bytes, units=[' bytes','KB','MB','GB','TB', 'PB', 'EB']): ...     \"\"\" Returns a human readable string representation of bytes \"\"\" ...     return str(bytes) + units[0] if bytes < 1024 else human_size(bytes>>10, units[1:]) ... >>> [human_size(2**(10+i)) for i in range(1, 25, 2)] ['2KB', '8KB', '32KB', '128KB', '512KB', '2MB', '8MB', '32MB', '128MB', '512MB', '2GB', '8GB'] ``` Signed-off-by: Mark McLoughlin <markmc@redhat.com>")` …

It's post times that need the smaller bucket size, not
transfer duration.

Uniform 2kb to 16gb range:

\`\`\`
>>> def human\_size(bytes, units=\[' bytes','KB','MB','GB','TB', 'PB', 'EB']):
...     """ Returns a human readable string representation of bytes """
...     return str(bytes) + units[0] if bytes < 1024 else human_size(bytes>>10, units[1:])
...
>>> [human_size(2\*\*(10+i)) for i in range(1, 25, 2)]
['2KB', '8KB', '32KB', '128KB', '512KB', '2MB', '8MB', '32MB', '128MB', '512MB', '2GB', '8GB']
\`\`\`

Signed-off-by: Mark McLoughlin <markmc@redhat.com>

[[NIXL][Metrics] Fix NIXL buckets NickLucche/vllm#6](/NickLucche/vllm/pull/6)

\[NIXL][Metrics] Fix NIXL buckets

Signed-off-by: Mark McLoughlin <markmc@redhat.com>

[KV Connector][Metrics] Add prometheus metrics support to multi-connector

 [NickLucche](/NickLucche) changed the title \[Nixl] Add metrics to Prometheus-Grafana dashboard [KVConnector] Add metrics to Prometheus-Grafana dashboard [Oct 28, 2025](#event-20554111444)

 [simon-mo](/simon-mo) enabled auto-merge (squash) [October 29, 2025 01:50](#event-20560617645)

[@github-actions](/apps/github-actions) [github-actions](/apps/github-actions) Bot added the [ready](/vllm-project/vllm/issues?q=state%3Aopen%20label%3Aready) ONLY add when PR is ready to merge/full CI is needed label [Oct 29, 2025](#event-20560621353)

[[Observability] Integrate LMCache observability to vLLM's KV connector metrics LMCache/LMCache#1914](/LMCache/LMCache/issues/1914)

[[Metrics] [KVConnector] Add Offloading Connector metrics #27942](/vllm-project/vllm/pull/27942)

[[Feature]: [P/D] Expose kv_transfer metrics (print to console, and to promethus) #21784](/vllm-project/vllm/issues/21784)

[…ct#26811](https://github.com/vllm-project/vllm/pull/26811))

Signed-off-by: NickLucche <nlucches@redhat.com>
Signed-off-by: Mark McLoughlin <markmc@redhat.com>
Co-authored-by: Mark McLoughlin <markmc@redhat.com>

[…ct#26811](https://github.com/vllm-project/vllm/pull/26811))

Signed-off-by: NickLucche <nlucches@redhat.com>
Signed-off-by: Mark McLoughlin <markmc@redhat.com>
Co-authored-by: Mark McLoughlin <markmc@redhat.com>

[…ct#26811](https://github.com/vllm-project/vllm/pull/26811))

Signed-off-by: NickLucche <nlucches@redhat.com>
Signed-off-by: Mark McLoughlin <markmc@redhat.com>
Co-authored-by: Mark McLoughlin <markmc@redhat.com>

[…ct#26811](https://github.com/vllm-project/vllm/pull/26811))

Signed-off-by: NickLucche <nlucches@redhat.com>
Signed-off-by: Mark McLoughlin <markmc@redhat.com>
Co-authored-by: Mark McLoughlin <markmc@redhat.com>

[[Roadmap] `llm-d` `v0.4.0` Roadmap llm-d/llm-d#347](/llm-d/llm-d/issues/347)

[[Feature]: Support C++/Python to use same metrics singleton ModelEngine-Group/unified-cache-management#655](/ModelEngine-Group/unified-cache-management/issues/655)

 [markmc](/markmc) added this to [Metrics & Tracing](/orgs/vllm-project/projects/44) [Feb 4, 2026](#event-22526196382)

 [markmc](/markmc) moved this from **Done** to **Done - 0.12** in [Metrics & Tracing](/orgs/vllm-project/projects/44) [Feb 4, 2026](#event-22526196148)

[@github-project-automation](/apps/github-project-automation) [github-project-automation](/apps/github-project-automation) Bot moved this to **Done** in [Metrics & Tracing](/orgs/vllm-project/projects/44) [Feb 4, 2026](#event-22526196561)

 [markmc](/markmc) moved this from **Done - 0.12** to **Done - 0.11** in [Metrics & Tracing](/orgs/vllm-project/projects/44) [Feb 4, 2026](#event-22526666075)

### Merge info

#### Pull request successfully merged and closed

You're all set — the branch has been merged.

  

##### Add a comment

* * *

* * *

##### An unexpected error has occurred

**ProTip!** Add [.patch](/vllm-project/vllm/pull/26811.patch) or [.diff](/vllm-project/vllm/pull/26811.diff) to the end of URLs for Git’s plaintext views.
