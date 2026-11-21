# 跃动 MoveMate · 个性化运动计划智能体

> 软件工程实践团队项目 · 第二次团队作业（原型设计 + 概要设计）

**团队名称**：跃动 MoveMate　｜　**课程**：2026 秋软工实践

**一句话定位**：面向健身入门人群的个性化运动计划智能体（Web 应用）——把只有运动医学门诊和私教才提供的「运动处方」，用领域知识 + 工具计算 + 流程编排，做成一个随身的处方师。

---

## 可运行版本 MoveMate 3.2

当前可运行源码位于 [`app/`](app/)，是在原型与概要设计之后完成的本地可运行版本：

- Windows 11 x64 原生窗口已实测：本机后端、SQLite、DeepSeek 配置和计划助手页面均可用。
- 默认接入 DeepSeek 官方 API（`https://api.deepseek.com/v1`，`deepseek-chat`），也保留 OpenAI、Anthropic、Gemini、Ollama 等格式。
- 38 项领域检查、20 项后端/协议测试、12 项浏览器 E2E 通过。
- 详细运行方式和验收证据见 [`app/README.md`](app/README.md)、[`app/docs/验收记录.md`](app/docs/验收记录.md)。

> `app/` 不包含 `runtime/`、`node_modules/` 和 Windows 免安装包；浏览器预览直接 `python app/serve.py`，原生窗口先按 `app/requirements-desktop.txt` 安装 `pywebview`。

---

## 仓库结构

```
.
├── README.md                        # 本文件
├── app/                             # MoveMate 3.2 可运行源码、测试与验收文档
│   ├── backend/                     # 本机后端与 DeepSeek/多协议适配
│   ├── src/                         # 前端页面、领域规则与交互
│   ├── tests/                       # 领域、后端与 Playwright 浏览器测试
│   └── docs/                        # 3.2 系统设计、验收记录与截图
├── docs/                            # 第二次作业团队文档（历史）
│   ├── 跃动MoveMate_系统设计说明书.pdf     # 系统设计说明书（含 UML、架构、Agent 集成）
│   ├── 跃动MoveMate_数据库设计说明书.pdf   # 数据库设计说明书（ER 图、关系模型、ORM）
│   └── 博客随笔.md                    # 团队博客《原型设计+概要设计》全文
├── diagrams/                        # 设计图（源文件 + SVG + PNG）
│   ├── *.mmd                        # Mermaid 源文件（可编辑）
│   ├── svg/                         # 矢量图
│   └── png/                         # 位图（博客/PPT 用）
├── prototype/                       # 可交互 HTML 原型
│   ├── index.html                   # 用户端 + 管理端 + 智能体交互（浏览器直接打开）
│   └── preview_*.png                # 原型预览截图
└── scripts/                         # 文档与图的构建脚本（可选）
```

## 设计图清单

| 图 | 文件 | 说明 |
| --- | --- | --- |
| 系统总体架构图 | `design/01_架构图` | 五层分层架构（表现/接口/应用/Agent 编排/数据） |
| 用例图 | `design/02_用例图` | 用户与管理员用例 |
| 业务活动图 | `design/03_活动图` | 处方生成与动态调整流程 |
| 类图 | `design/04_类图` | 领域实体类 + 服务编排类 |
| 时序图 | `design/05_时序图` | 处方生成核心算法时序 |
| 协作图 | `design/06_协作图` | 对象协作与消息传递 |
| ER 图 | `design/07_ER图` | 12 张表的实体关系 |

## 快速开始

1. 打开 `prototype/index.html` 即可浏览可交互原型（用户端 + 管理端 + 智能体交互）；
2. 查看 `docs/` 下的两份 PDF 与博客全文；
3. 设计图可在 `design/` 下获取源文件（`.mmd`）与导出图（`.svg` / `.png`）。

## 团队协作

团队使用 GitHub Projects 管理迭代（里程碑 M1–M5，详见博客《团队协作记录》）。每位成员均在本仓库有提交记录。
