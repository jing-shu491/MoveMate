# MoveMate 3.2 · Windows x64 本机运行版

MoveMate 在独立桌面窗口中运行，窗口内自动启动本机后端与 SQLite 数据库。AI 助手通过本机后端调用你选择的模型接口；训练日程继续使用可检查的规则模板，AI 负责解释计划与回答问题。

3.2 默认接入 **DeepSeek 官方 API**：首次打开配置向导时，接口格式、地址和模型都已预填，粘贴 API Key 后点“测试并启用”即可。

> 本次交付的是 Windows x64 3.2 构建。macOS 包仍是此前的 3.1 构建，尚未同步 3.2 的 DeepSeek 预设；macOS 源码与打包脚本仍保留在项目中。
>
> GitHub 中的 `app/` 是源码目录，不包含 `runtime/`、`node_modules/` 和 Windows 免安装运行包（体积原因）。只想看页面可用 `python serve.py`；需要原生窗口时先执行 `pip install -r requirements-desktop.txt`，再运行 `python desktop_windows.py`。

## 两个平台

- **macOS**：现有 `MoveMate-macOS.zip` 为 3.1 构建；解压后双击 `MoveMate.app`。支持 macOS 13+，同时内置 Apple Silicon 与 Intel 两种运行环境。整个 App 可一起移动到“应用程序”目录。
- **Windows**：解压 `MoveMate-Windows-x64.zip`，双击 `启动.vbs`（无控制台），或 `启动.bat`。内置 x64 Python 与窗口依赖，适用于 Windows 10/11 x64。

无需安装 Python、Node.js 或 npm 依赖。请完整解压后运行。应用没有浏览器标签页和地址栏；macOS 使用 Cocoa + WKWebView，Windows 使用 WinForms + WebView2。关闭窗口即停止该窗口启动的本机服务，数据保留。

Windows 的原生窗口需要系统的 Microsoft Edge WebView2 Runtime 和 .NET Framework 4.8。大多数较新的 Windows 已有这些组件；若提示缺少 WebView2，可手动运行包内微软官方的 `安装WebView2.exe` 后重试。包内安装器不会自动执行。若系统禁用 VBScript，使用 `启动.bat` 即可；该入口启动窗口后会退出控制台。

**从 3.1 升级时，请先关闭仍在运行的旧 MoveMate 窗口，再启动 3.2。** 两个版本共用 `%LOCALAPPDATA%\MoveMate` 数据目录，同时运行会造成两个本机服务争用同一个数据库。升级不会删除已有档案、训练记录或 API 配置；但 3.1 不识别 `deepseek` 格式，升级后请在 3.2 里重新选择 DeepSeek 并保存。

macOS App 使用本地签名，未做 Apple 公证。请按系统提供的正常打开流程使用。开发者仍可用 `python3 serve.py` 运行浏览器预览，但正式入口打开独立窗口。

## 直接接入 DeepSeek API（推荐）

1. 打开 [DeepSeek 开放平台](https://platform.deepseek.com/api_keys)，登录后创建一个 API Key。
2. 启动 MoveMate，首次会自动弹出“配置你的 AI 助手”。
3. 保持“API 格式”为 **DeepSeek 官方 API（OpenAI 兼容）**。地址已经填为 `https://api.deepseek.com/v1`，模型填 `deepseek-chat`（默认）或 `deepseek-reasoner`。
4. 粘贴 API Key，点击“测试连接”。连接成功后点击“测试并启用”。
5. 进入“计划助手”提问；回答会结合当前周计划和最近三次训练反馈。

也可以从右上角“API 配置”随时修改。若之前保存过密钥，界面只显示“已保存密钥”，不会把密钥回传给页面；地址或格式不变时可以留空继续使用。

模型选择：

| 模型 ID | 适用场景 | 说明 |
| --- | --- | --- |
| `deepseek-chat` | 日常解释、问答、计划说明 | 速度快，默认推荐 |
| `deepseek-reasoner` | 需要多步推理的问题 | 响应更慢；应用只展示最终回答，不保存推理过程 |

DeepSeek 采用 OpenAI Chat Completions 兼容协议。应用会把当前计划、最近三条训练的日期/感受/分钟数和最近对话写入请求，但不会主动附带姓名、年龄、体重和健康备注。密钥保存在本机 SQLite 数据库，不随训练 JSON 备份导出。

### 用 JSON 快速填入

“已有配置？一键填入 JSON”可以填入：

```json
{
  "format": "deepseek",
  "base_url": "https://api.deepseek.com/v1",
  "model": "deepseek-chat",
  "api_key": "sk-你的密钥"
}
```

“填入配置”只填表，点击“测试并启用”才会连接和保存。

## 首次启动与 API 配置

启动先检查运行环境、SQLite 数据库和 API 配置。没有 API 配置时自动弹出向导：

1. 选择接口格式。
2. 确认 API 地址和模型 ID，填写自己的 API Key。
3. 点击“测试并启用”。连接成功后保存，立即可用。

已有配置时，进入应用会发送一次简短模型请求检查连通性；失败会显示原因并打开配置向导。该请求按服务商的 API 规则计费。点击“稍后配置”仍可使用计划与打卡；点击 AI 问答时会再次引导配置，配置成功后会继续发送刚才的问题。

## 支持的 API 格式

| format | 请求格式 | 地址示例 |
| --- | --- | --- |
| `deepseek` | DeepSeek 官方 API（OpenAI Chat Completions 兼容） | `https://api.deepseek.com/v1` |
| `openai` | OpenAI Chat Completions / 使用同格式的第三方服务 | `https://api.openai.com/v1` |
| `responses` | OpenAI Responses | `https://api.openai.com/v1` |
| `anthropic` | Anthropic Messages | `https://api.anthropic.com/v1` |
| `gemini` | Gemini generateContent | `https://generativelanguage.googleapis.com/v1beta` |
| `ollama` | Ollama `/api/chat` | `http://127.0.0.1:11434` |

模型 ID 由你使用的服务商决定，不硬编码模型清单；DeepSeek 的两个官方模型 ID 作为预设提示提供。第三方中转需要选择它实际支持的请求格式。支持填写基础前缀或匹配的完整端点；Anthropic API 版本头使用 `2023-06-01`。Ollama 不要求 API Key，但需要你已启动 Ollama 并准备好模型；本包不含模型权重。远程服务使用 HTTPS，本机接口支持 HTTP。

常见错误：`401` 表示 Key 无效；`402` 表示账户余额不足；`404` 通常是地址或模型 ID 不匹配；连接超时请检查网络、代理和证书。应用不会在错误信息中回显密钥或上游响应体。

## 页面缩放

原生窗口和浏览器预览都支持像网页一样的缩放：

- `Ctrl` + 鼠标滚轮
- `Ctrl` + `+` / `Ctrl` + `-`（主键盘和小键盘）
- `Ctrl` + `0` 恢复 100%
- 右上角也有 `−`、当前百分比、`+` 三个按钮（窗口较窄时自动隐藏）

缩放范围 80%–200%，每次 10%，保存在本机浏览器存储中，下次打开继续使用。Windows 原生窗口调用 WebView2 的页面缩放，布局会随缩放重新排布；浏览器预览使用等价的 CSS 缩放。

## 数据在哪里

- macOS：`~/Library/Application Support/MoveMate/movemate.sqlite3`
- Windows：`%LOCALAPPDATA%\MoveMate\movemate.sqlite3`

应用文件与用户数据库分开，替换程序包不会覆盖记录。数据库包含档案、计划、训练日志、对话、笔记和 API 配置。数据库文件没有应用层加密，请通过操作系统账户保护；分享程序包时不要附带数据库。

“本地数据管理”可以导出训练 JSON、清空训练资料和管理笔记。API 配置保留，JSON 备份当前没有导入界面。旧浏览器数据存在时会提示手动迁入，原浏览器数据保留。

## 功能

- 档案校验、风险确认与生成拦截。
- 依据频率、时长、目标和场景生成自然周计划。
- 吃力反馈调短下一次生成的计划时长。
- 真实打卡、重复与未来日期检查、周统计及体重趋势。
- 真实 AI 多轮问答、六种接口格式、连接诊断。
- DeepSeek 官方 API 预设与一键配置。
- 页面缩放：`Ctrl` + 滚轮、`Ctrl` + `+` / `-`、`Ctrl` + `0`，以及右上角缩放控件。
- SQLite 持久化、写入冲突检查、JSON 导出与笔记管理。

本工具提供运动入门模板，不代替医疗评估。日程与动作是本项目规则，并非大模型生成的医学处方。

## 开发与检查

源码目录中可用系统 Python 3.9+ 运行 `python3 serve.py` 打开浏览器预览；需要原生窗口时安装桌面依赖后再运行入口：

```sh
pip install -r requirements-desktop.txt
python desktop_windows.py
```

打包版本直接使用各自启动入口。自动检查：

```sh
python3 tests/test_backend.py
node tests/domain.test.js
node tests/e2e.mjs
```

`tests/e2e.mjs` 是真实浏览器验收：使用本机 Microsoft Edge、独立临时数据库和本地模拟模型接口，覆盖首次配置、DeepSeek 预设、连接测试、页面缩放（快捷键、Ctrl+滚轮、重置、刷新持久化）、档案生成计划、训练打卡、AI 对话、刷新持久化和 390px 移动端布局。运行前需要：

```sh
npm install
```

Node 和 Playwright 只用于开发验收，实际运行无需 Node。后端协议测试使用本机模拟上游，不需要真实密钥、不产生外部 API 调用。本版交付前另用项目提供的临时 Key 完成了一次真实 DeepSeek 连接测试和一轮对话；测试密钥没有写入交付包。其他人复现时需填写自己的 Key，并在应用内“测试连接”确认账号权限、余额和地区可用性。

## 3.2 改进

- 新增 `deepseek` 官方 API 预设，默认地址 `https://api.deepseek.com/v1`、默认模型 `deepseek-chat`，并给出 `deepseek-reasoner` 选项。
- 配置向导默认选中 DeepSeek，地址和模型自动带入；增加获取 Key 的入口、针对 DeepSeek 的密钥提示和 `402` 余额错误说明。
- 在配置前提问时暂存问题，配置成功后自动继续发送，不再丢失输入。
- 修复 Windows 启动器复用旧进程时写死 `3.0.0` 版本、导致无法复用的问题；健康接口新增应用标识。
- **Windows 11 x64 原生窗口已实测通过**：窗口标题“MoveMate 跃动”、1240×850、后端 `127.0.0.1:8765`、SQLite 正常、`app=movemate`、`version=3.2.0`，并完成 DeepSeek 配置和聊天页面验证。截图见 `docs/screenshots/native-windows.png`。
- 新增页面缩放：原生窗口通过 WebView2 `ZoomFactor` 实现，浏览器预览使用 CSS 回退；支持快捷键、Ctrl+滚轮和右上角控件，范围 80%–200%。
- 新增 Playwright 真实浏览器验收，生成桌面/移动端截图；浏览器 E2E 扩展到 17 项，后端测试 20 项，领域逻辑 38 项。

## 官方协议参考

- [DeepSeek API 文档](https://api-docs.deepseek.com/)
- [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)
- [OpenAI Responses](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [Anthropic Messages](https://platform.claude.com/docs/en/api/messages/create)
- [Gemini generateContent](https://ai.google.dev/api/generate-content)
- [Ollama Chat](https://docs.ollama.com/api/chat)

第三方运行环境的来源、版本与哈希见打包文件中的 `runtime-sources.json`。证书包来自 certifi。
