# 智采 ZhiCai · 多智能体采购管理平台

> 一个**本地优先**的多智能体 AI 采购管理系统：用 **LangGraph** 编排多个专用智能体，把「收邮件 → 提取需求 → 合规审核 → 生成采购订单 PDF → 需求预测」这条完整采购链路自动化。前端为 React + Vite + Tailwind，后端为 FastAPI，数据存储在本地 SQLite。

---

## ✨ 核心特性

| 能力 | 说明 |
|---|---|
| 🧠 多智能体编排 | 基于 LangGraph 的状态机：编排器（Orchestrator）解析意图并路由到邮件 / 合规 / 订单 / 预测智能体 |
| 📧 邮件智能分析 | LLM 从非结构化邮件正文中提取物品、数量、交期、优先级，并自动匹配到物料与供应商目录 |
| 🛡️ 合规守门 | 规则引擎（库存容量 / 采购政策 / 供应商评分）+ LLM 生成可读的审核解释 |
| 📄 采购订单 PDF | 固定模板自动生成采购订单正文，fpdf2 渲染中文 PDF，支持一键下载 |
| 📈 需求预测 | Meta Prophet 做季节性分解 + LLM 综合生成「执行概览 / 趋势 / 异常洞察」报告与交互图表 |
| 🖥️ 智能体仪表盘 | 实时可视化每个智能体的状态、日志与「思考过程」 |
| 💬 聊天驱动 UI | 用自然语言即可跳转页面、筛选邮件、触发 API、内嵌下单 |
| 🔒 本地优先 | 统一 SQLite 数据库（`procurement.db`），离线可用，数据不出本机 |

---

## 🧰 技术栈

- **后端**：Python 3.9+ · FastAPI · LangChain + LangGraph · Ollama（本地 LLM）· SQLite · fpdf2 · pandas + Prophet
- **前端**：React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui (Radix) · framer-motion · recharts
- **邮件**：IMAP / SMTP（默认 Gmail，可配置）

---

## 🚀 快速开始

### 前置条件

1. **Python 3.9+**
2. **Node.js 18+**
3. **Ollama**：本地运行并拉取模型 `ollama pull mistral`

### 1. 后端

```bash
# 创建虚拟环境（可选）
python -m venv venv
# Windows: venv\Scripts\activate    macOS/Linux: source venv/bin/activate

pip install -r requirements.txt

# 配置环境变量
cp .env.example .env   # Windows: copy .env.example .env
```

### 2. 初始化数据库

```bash
python scripts/db_init.py
```

> 这会创建 `backend/data/procurement.db`，并写入示例物料目录（80 个物料、30 家供应商）、采购政策、库存与 mock 历史订单。

### 3. 前端

```bash
cd frontend
npm install
cp .env.example .env   # Windows: copy .env.example .env
```

### 4. 启动

```bash
# 终端 A：后端
uvicorn backend.api:app --reload        # http://localhost:8000

# 终端 B：前端
cd frontend && npm run dev              # http://localhost:5173
```

> Windows 也可直接运行根目录 `python quick_run.py`，会分别打开后端 / 前端两个新窗口。

---

## ⚙️ 配置

模型与 Ollama 地址通过根目录 `.env` 配置（复制自 `.env.example`）：

```ini
OLLAMA_BASE_URL=http://localhost:11434

ORCHESTRATOR_MODEL=mistral
EMAIL_MODEL=mistral
COMPLIANCE_MODEL=mistral
FORECAST_MODEL=mistral
```

前端 API 地址通过 `frontend/.env` 配置（默认 `VITE_API_URL=http://localhost:8000`）。也可在「设置」页为每个智能体动态切换底层 LLM 模型。

后端跨域来源通过 `CORS_ALLOWED_ORIGINS` 配置（逗号分隔，默认本地开发地址）。

---

## 📦 项目结构

```
multi-agent-ai-v2/
├── backend/
│   ├── agents/                 # 各智能体实现
│   │   ├── orchestrator.py     # 意图路由
│   │   ├── email_analyzer.py   # 邮件结构化提取
│   │   ├── compliance.py       # 合规守门 + 解释
│   │   ├── pdf_generator.py    # 采购订单 PDF
│   │   ├── config.py           # 统一 LLM 配置
│   │   └── models.py           # Pydantic 数据模型
│   ├── data/                   # SQLite 数据库（gitignored）
│   ├── services/               # 业务服务层（供 graph 与 REST 共用）
│   │   ├── orders.py           # 订单 + PDF
│   │   ├── emails.py           # 邮件分析
│   │   └── compliance.py       # 合规检查
│   ├── routers/                # API 路由（按业务域拆分）
│   │   ├── chat.py             # 对话 / 健康检查
│   │   ├── emails.py           # 邮件
│   │   ├── database.py         # 数据库浏览
│   │   ├── orders.py           # 订单
│   │   ├── forecast.py         # 预测
│   │   ├── procurement.py      # 采购流程
│   │   └── settings.py         # 设置
│   ├── api.py                  # 应用装配层（中间件 + 路由注册）
│   ├── database.py             # 数据访问层
│   ├── email_service.py        # IMAP/SMTP
│   ├── forecast.py             # Prophet + LLM 预测
│   └── graph.py                # LangGraph 状态机
├── frontend/
│   ├── public/                 # favicon 等静态资源
│   ├── src/
│   │   ├── api/client.ts       # API 封装
│   │   ├── components/         # 各页面与聊天组件
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   └── vite.config.ts
├── scripts/
│   ├── db_init.py              # 建表 + 种子数据
│   └── evaluate_forecast.py    # 预测模型评估（MAE/RMSE/MAPE）
├── seed-data/
│   └── mock_orders.csv         # 历史订单种子数据
├── orders/                     # 生成的采购订单 PDF（gitignored）
├── .env.example
├── requirements.txt
├── quick_run.py                # Windows 一键启动
└── README.md
```

---

## 🔄 核心业务流

```
邮件接入 (IMAP 同步)
   → 邮件分析 (LLM 提取 → 物品/供应商匹配 → 存 email_analysis)
   → 合规守门 (库存 / 预算 / 政策 → 通过/失败 + 解释)
   → 创建订单 + 生成 PDF (orders 表 + orders/N.pdf)
   → 需求预测 (Prophet 季节性分析 + LLM 综合报告)
```

也可以跳过邮件，直接在「新建订单」或聊天内嵌组件中手动下单。

---

## 🔌 主要 API 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/chat` | 编排器对话入口，返回响应 + 步骤 + UI 动作 |
| POST | `/emails/analyze_all` | 批量分析所有未分析邮件 |
| POST | `/procurement/{email_id}/compliance` | 对指定邮件运行合规检查 |
| POST | `/procurement/{email_id}/order` | 创建订单并生成 PDF |
| POST | `/orders/manual` | 手动下单（自动合规 + PDF） |
| POST | `/orders/{order_id}/generate-pdf` | 重新生成订单 PDF |
| POST | `/forecast/generate` | 生成需求预测报告 |
| GET | `/database/tables/{table}` | 浏览 / 编辑数据库表 |

完整端点见 `backend/api.py`。

---

## 🗺️ 路线图

- [x] 多智能体编排与意图路由（LangGraph）
- [x] 邮件分析、合规守门、采购订单 PDF、需求预测
- [x] 品牌化与项目结构清理（智采 ZhiCai / v1.0.0）
- [x] 商品目录泛化（通用采购/供应链：80 物料 + 30 供应商）
- [x] 抽取公共「订单 + PDF」服务，消除重复逻辑
- [x] CORS 收敛到环境变量配置
- [x] 拆分单体 `api.py` 为模块化路由（7 个业务域 router）
- [x] 统一邮件 / 合规 / PDF 的两条执行路径（graph vs REST，抽取共享服务）
- [ ] 完善的 pytest 测试套件
- [ ] Docker 一键部署

---

## 📄 License

[MIT](./LICENSE)
