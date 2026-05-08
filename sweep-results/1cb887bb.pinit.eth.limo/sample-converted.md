# Cloudflare优选IP筛选工具

> 原文链接: https://1cb887bb.pinit.eth.limo/
> 工具元信息: IPFS-gateway-hosted JS web tool · interactive (server has no API surface; data analysis runs in the browser)

---

请在下方粘贴您的完整IP扫描结果，然后点击"分析数据"以开始。

## 操作流程

1. **输入数据：** *(input area for IP scan results)*
2. **1. 分析数据** — 解析输入并按地区聚合
3. **2. 选择地区筛选：** *(dropdown — runtime-populated from analysis)*

> 状态提示：请先粘贴数据并点击"分析数据"按钮。

## 导出选项

**3. 导出当前筛选结果：**

- *(radio: all)* **全部** — 导出所有筛选结果
- *(radio: top)* **前** *(number input)* **个** — 导出前 N 条
- *(radio: latency)* **延迟低于** *(number input)* **ms** — 按延迟阈值过滤

**导出到剪贴板**

## 工具说明

This page is a single-purpose JS tool deployed to IPFS via the
`pinit.eth.limo` gateway (hex-hash subdomain identifies the IPFS
content hash). It accepts pasted Cloudflare IP scan output, parses
it client-side, and lets the user filter / sort / export by region
or latency. Open the URL in a browser to use the tool — there is
no server-side API to query.
