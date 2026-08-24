# 智采 ZhiCai

智采是一个本地优先的 AI 采购管理平台。系统使用 LangGraph 编排采购相关任务，将邮件需求提取、目录匹配、规则合规、人工审核、订单管理、PDF 生成和历史需求分析串联在同一套工作流中。

项目采用 React + TypeScript 构建前端，FastAPI 提供后端 API，业务数据和生成文件默认保存在本地。模型默认通过 Ollama 运行，也可以按智能体切换到兼容 OpenAI API 的云端服务。

## 核心能力

| 能力 | 当前实现 |
| --- | --- |
| 对话编排 | LangGraph 根据用户意图路由到邮件、合规、PDF、供应商或需求分析流程，并返回可执行的界面动作 |
| 邮件需求提取 | 从 IMAP 或 Mailpit 邮件中提取物料、数量、预算、交期等采购字段，并匹配本地物料和供应商目录 |
| 采购合规 | 使用确定性规则检查仓储容量、单笔金额、申请预算、供应商准入与评分；LLM 仅负责整理风险说明和建议 |
| 人工审核与订单 | 合规通过后进入待审核状态，由用户确认后创建订单；也支持从界面或聊天手动发起采购 |
| 采购订单 PDF | 使用固定采购订单模板和 fpdf2 生成 PDF，支持本地保存、下载和邮件发送 |
| 供应商与物料管理 | 支持列表管理、自然语言建档、供应商评分和 SKU 生成 |
| 历史需求分析 | 聚合历史订单，识别月度峰值与整体趋势，使用 Prophet 估计趋势并在不可用时回退到线性拟合，再由 LLM 生成结构化摘要 |
| 本地数据账本 | 使用 SQLite 保存邮件、分析结果、目录、库存、政策、订单和分析报告 |

## 工作方式

```text
邮件同步（IMAP / Mailpit）
  → LLM 提取采购需求
  → 物料与供应商目录匹配
  → 确定性合规规则检查
  → 人工审核
  → 创建订单并生成 PDF

历史订单
  → 月度聚合与趋势估计
  → LLM 整理结构化洞察
  → 图表与历史报告
```

编排器支持 `email`、`compliance`、`pdf`、`supplier` 和 `forecast` 五类任务路由。系统提供四组可独立配置的模型：编排器、邮件提取、合规解释和需求分析。供应商与物料建档复用邮件提取模型，PDF 生成不调用 LLM。

## 技术栈

- 后端：Python、FastAPI、LangChain、LangGraph、SQLite、fpdf2、pandas、Prophet
- 模型：Ollama（默认）或兼容 OpenAI API 的云端服务
- 前端：React 18、TypeScript、Vite、Tailwind CSS、Radix UI、Recharts、Framer Motion
- 邮件：IMAP / SMTP；本地开发可使用 Mailpit

## 快速开始

### 环境要求

- Python 3.11（推荐；当前 Prophet 依赖组合不建议使用 Python 3.13）
- Node.js 18+
- Ollama，以及已安装的默认模型 `mistral`

```bash
ollama pull mistral
```

### 1. 安装后端

```bash
python -m venv .venv

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

复制根目录环境变量模板：

```bash
cp .env.example .env
# Windows PowerShell: Copy-Item .env.example .env
```

### 2. 初始化示例数据

```bash
python scripts/db_init.py
```

该脚本会创建 `backend/data/procurement.db`，并写入 80 个示例物料、30 家示例供应商、库存与采购政策，以及 5,000 条历史订单。

### 3. 安装前端

```bash
cd frontend
npm install
cp .env.example .env
# Windows PowerShell: Copy-Item .env.example .env
```

### 4. 启动服务

分别启动后端和前端：

```bash
# 终端 A：在项目根目录运行
uvicorn backend.api:app --reload

# 终端 B
cd frontend
npm run dev
```

- 前端：http://localhost:5173
- 后端：http://localhost:8000
- Swagger API 文档：http://localhost:8000/docs

Windows 用户完成依赖安装后，也可以在项目根目录运行 `python quick_run.py`，由脚本检查数据库并分别打开前后端窗口。

## 模型与邮箱配置

根目录 `.env` 控制模型、跨域和邮箱连接。默认使用本地 Ollama：

```ini
OLLAMA_BASE_URL=http://localhost:11434

ORCHESTRATOR_MODEL=mistral
EMAIL_MODEL=mistral
COMPLIANCE_MODEL=mistral
FORECAST_MODEL=mistral
```

如需使用兼容 OpenAI API 的服务，可以为对应模型设置 provider，并配置服务地址和密钥：

```ini
FORECAST_PROVIDER=openai
CLOUD_BASE_URL=https://api.example.com/v1
CLOUD_API_KEY=your-api-key
FORECAST_MODEL=your-model-name
```

真实邮箱接入使用 `SMTP_*`、`IMAP_*`、`EMAIL_USER` 和 `EMAIL_PASS` 配置项。也可以在前端“设置”页修改模型、云端服务和邮箱配置；配置会写入本地 `.env`。

前端通过 `frontend/.env` 中的 `VITE_API_URL` 指向后端，默认值为 `http://localhost:8000`。

## 数据边界

- SQLite 数据库、邮件附件和采购订单 PDF 默认保存在本机，并已通过 `.gitignore` 排除。
- 使用 Ollama 时，模型推理请求发送到配置的本地 Ollama 服务。
- 使用云端模型时，完成任务所需的提示和业务内容会发送到所配置的云端 API；是否保存或处理这些数据取决于该服务提供方。
- 接入真实邮箱时，系统会通过配置的 IMAP / SMTP 服务器读取和发送邮件。
- `.env` 可能包含邮箱凭据和 API 密钥，不应提交到版本库。

## 常用入口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `POST` | `/chat` | 对话编排入口 |
| `POST` | `/emails/sync` | 同步邮件 |
| `POST` | `/emails/analyze_all` | 分析未处理邮件 |
| `POST` | `/procurement/{email_id}/compliance` | 对邮件需求执行合规检查 |
| `POST` | `/procurement/{email_id}/order` | 审核后创建订单 |
| `POST` | `/orders/manual` | 手动采购流程 |
| `POST` | `/orders/{order_id}/generate-pdf` | 生成或重新生成订单 PDF |
| `POST` | `/forecast/generate` | 生成历史需求趋势报告 |

所有路由及请求结构以运行中的 Swagger 文档 `/docs` 为准。

## 项目结构

```text
ZhiCai/
├── backend/
│   ├── agents/        # 编排、提取、合规解释、建档与 PDF 逻辑
│   ├── routers/       # 按业务域组织的 FastAPI 路由
│   ├── services/      # graph 与 REST API 共用的业务服务
│   ├── api.py         # FastAPI 应用装配
│   ├── database.py    # SQLite 数据访问
│   ├── email_service.py
│   ├── forecast.py    # 历史需求趋势分析
│   └── graph.py       # LangGraph 工作流
├── frontend/          # React + TypeScript 前端
├── scripts/           # 数据初始化、演示邮件与分析评估脚本
├── seed-data/         # 示例历史订单
├── tests/             # 后端测试
├── .env.example
├── requirements.txt
└── quick_run.py       # Windows 快速启动脚本
```

## 测试与构建

```bash
# 后端测试
python -m pytest -q

# 前端生产构建
cd frontend
npm run build
```

当前后端测试覆盖合规规则、邮件分析、数据库查询和订单状态流转。

## 当前边界与路线图

当前的“需求分析”基于历史订单进行趋势估计和季节性汇总，不生成未来日期的采购量预测。邮件同步目前按最近 20 封处理，后台分析状态保存在单个后端进程内。

后续计划：

- 增量同步邮件并支持分页加载
- 增加面向未来日期的需求量预测与评估
- 将长任务迁移到可恢复的后台任务队列
- 补充 Docker 与 CI 配置

## License

[MIT](./LICENSE)
