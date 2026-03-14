---
name: playground-rauchg-api-endpoint
overview: 为 `playground` 新增 `rauchg` 模板的图片生成 API，支持通过查询参数控制模板文本、样式及 Satori 关键渲染参数，并可通过类似 `/api/v1/rauchg?...` 直接访问生成结果。
todos:
  - id: audit-rauchg-surface
    content: 使用[subagent:code-explorer]核对rauchg模板可参数化字段与默认值
    status: completed
  - id: create-og-endpoint
    content: 新建playground/pages/api/v1/rauchg.ts实现查询参数解析与校验
    status: completed
    dependencies:
      - audit-rauchg-surface
  - id: wire-render-pipeline
    content: 接入字体与emoji加载并调用satori生成SVG响应
    status: completed
    dependencies:
      - create-og-endpoint
  - id: harden-response
    content: 完善错误处理、缓存头与参数边界保护
    status: completed
    dependencies:
      - wire-render-pipeline
  - id: document-api-usage
    content: 更新README补充端点示例与参数说明
    status: completed
    dependencies:
      - harden-response
---

## User Requirements

- 在 playground 中新增一个可直接访问的图片生成端点，路径为 `/api/v1/rauchg`。
- 通过 URL 查询参数控制 `rauchg` 模板中可配置内容，示例形态：`/api/v1/rauchg?fonts=...&amp;title=...&amp;contents=...`。
- 未传参数时使用模板默认值；传参后按参数覆盖模板内容与关键视觉配置。
- 需要可部署后直接调用，用于 OG 图片生成场景。

## Product Overview

- 提供一个面向 `rauchg` 模板的 HTTP API：接收查询参数，生成并返回图片内容（默认 SVG）。
- 输出效果与 playground 中 `rauchg` 模板一致，并允许通过参数调整文案、尺寸、颜色、间距、字体等核心视觉元素。

## Core Features

- 参数化模板渲染：标题、副文案、角标文案、画布尺寸、主色/背景色、字号等。
- 默认值与边界保护：非法参数回退默认值，尺寸与数值参数做区间限制。
- 字体与多语言支持：支持基础字体选择，并兼容多语种回退字体与 emoji 资源。
- 统一图片响应：返回可直接被社交平台抓取的图片响应与缓存头。

## Tech Stack Selection

- 复用现有 `playground` 的 Next.js Pages API 方案与 Edge Runtime 模式（与 `pages/api/font.ts` 一致）。
- 复用现有 `satori` 渲染链路与 playground 中已验证的字体、emoji、fallback 逻辑来源。

## Implementation Approach

- 采用“参数解析层 + 模板构建层 + 渲染响应层”三段式实现：先解析并校验 query，再组装 `rauchg` JSX 节点，最后调用 `satori` 输出 SVG 响应。
- 关键决策：优先保持单端点可用与可维护，不做跨模块大重构；仅在必要处抽小型本地工具函数（参数规范化、颜色/数值校验）以减少回归风险。
- 性能：参数解析 O(k)；文本扫描/字体检测约 O(n)；主要瓶颈是外部字体与 emoji 拉取，采用内存缓存与最小化重复请求策略（复用 `FontDetector` 与 emoji cache 机制）。

## Implementation Notes (Execution Details)

- 保持向后兼容：不改动现有 `/api/font` 行为，仅新增 `/api/v1/rauchg`。
- 复用 `playground/utils/font.ts`、`playground/utils/twemoji.ts`，避免重复实现动态资产加载。
- 数值参数统一 clamp（如宽高、字号、边距），防止异常输入导致渲染失败或资源消耗过大。
- 错误输出使用简洁可诊断信息，避免返回大体量堆栈；成功响应设置合理 `Cache-Control`。
- 控制影响面：不改 UI，不改现有模板列表渲染逻辑，仅增加 API 能力。

## Architecture Design

- 请求流：`HTTP Query` → `参数校验/默认值合并` → `rauchg JSX 生成` → `satori 渲染` → `SVG Response`。
- 资源流：基础字体（public）+ 动态字体/emoji（按需加载）→ 渲染选项 `fonts/loadAdditionalAsset`。

## Directory Structure Summary

本次改动以新增 API 为主，保持 playground 现有结构不变。

- `e:/Projects/satori/playground/pages/api/v1/rauchg.ts`  # [NEW] `rauchg` 图片生成端点。负责 query 解析、参数校验、默认值回退、模板节点构建、Satori 渲染与响应头设置；复用现有字体与 emoji 工具能力。
- `e:/Projects/satori/README.md`  # [MODIFY] 补充 API 调用示例与参数说明（路径、默认值、可选范围、示例 URL），便于部署后直接使用。

## Key Code Structures (Optional)

- 建议在 `rauchg.ts` 内定义：
- `type RauchgQueryOptions = { title; contents; badgeText; width; height; ... }`
- `function parseRauchgOptions(searchParams): RauchgQueryOptions`
- `function buildRauchgElement(opts): ReactElement`

## Agent Extensions

- **SubAgent: code-explorer**
- Purpose: 继续核对 `rauchg` 模板字段、默认样式与可参数化边界，确保参数映射完整且不偏离现有实现。
- Expected outcome: 形成可直接落地的参数清单与默认值表，避免遗漏可控项或引入不一致行为。