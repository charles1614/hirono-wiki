---
created: 2026-05-15
updated: 2026-05-15
type: source
source_url: https://sspai.com/post/90170
tags: [tooling, production-deployment]
---

# [2025-10-08] 从零开始搭建你的免费图床系统 (Cloudflare R2 + WebP Cloud + PicGo)

## TL;DR

Step-by-step Chinese tutorial (pseudoyu, 少数派, July 2024) for setting up a **zero-cost personal image-hosting pipeline**: [[Cloudflare R2]] as S3-compatible object storage (10 GB free tier), [[WebP Cloud]] as an image-proxy/optimization layer, and [[PicGo]] as the desktop upload client. Covers the author's migration journey through four prior solutions before landing on this stack.

## Key claims

- **Cloudflare R2 free tier** provides 10 GB/month storage with S3-compatible API; requires a credit card for identity verification but does not charge within free limits.
- **PicGo + picgo-plugin-s3** bridges the desktop upload workflow to any S3-compatible endpoint; config requires Access Key ID, Secret Access Key, bucket name, custom endpoint, and custom domain.
- **WebP Cloud** proxies R2 images through its CDN, converting to WebP on the fly and typically compressing 5 MB JPEGs to under 1 MB; free quota covers 2,000 requests/day with 100 MB cache.
- When WebP Cloud quota is exceeded, it 301-redirects to the origin R2 URL — degraded but still functional.
- Author's daily blog traffic generates ~4,000–5,000 WebP Cloud requests normally, spiking to 10,000+ on post-publication days; uses the Lite paid plan to cover peaks.
- Earlier solutions (GitHub + jsDelivr CDN, Aliyun OSS, self-hosted Chevereto) each failed for distinct reasons: jsDelivr DNS poisoning in mainland China, cost creep on Aliyun, data loss on self-hosted server crash.

## Visual observations

*No load-bearing images — all panels decorative (UI screenshots of configuration forms; no architecture diagrams or charts conveying data not in body text).*

## Entities touched

[[Cloudflare R2]], [[PicGo]], [[WebP Cloud]]

## Raw source

[sspai.com/post/90170](https://sspai.com/post/90170) — Chinese blog post · ~8.5 KB · 29 images (UI screenshots) · fetched 2026-05-10.
