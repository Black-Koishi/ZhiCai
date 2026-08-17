import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Bot, Network, Mail, Database, Terminal, TrendingUp } from "lucide-react";

export function DocsPage() {
    return (
        <div className="h-full flex flex-col bg-white/30 dark:bg-black/20 backdrop-blur-md">
            {/* Header */}
            <div className="h-16 border-b border-white/20 px-8 flex items-center bg-white/40 dark:bg-black/40">
                <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    系统文档
                </h2>
            </div>

            <ScrollArea className="flex-1 p-8">
                <div className="max-w-4xl mx-auto space-y-8">

                    {/* Introduction */}
                    <div className="space-y-4">
                        <h1 className="text-4xl font-bold tracking-tight text-foreground">
                            智采 ZhiCai · 多智能体采购平台
                        </h1>
                        v1.0.0（统一账本与智能体模块）
                        <p className="text-muted-foreground leading-relaxed">
                            本系统是针对自主采购工作流打造的 <strong>多智能体 AI 架构</strong> 的复杂演示。
                            它利用本地化编排层来管理专业智能体（邮件、合规、订单、预测），确保准确性、政策合规性与离线能力。
                        </p>
                    </div>

                    {/* Architecture Overview */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-blue-500">
                            <Network className="h-6 w-6" />
                            <h3 className="text-2xl font-semibold text-foreground">系统架构</h3>
                        </div>
                        <Card className="p-6 bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10 backdrop-blur-sm">
                            <div className="grid md:grid-cols-2 gap-8">
                                <div>
                                    <h4 className="font-semibold mb-2">前端（React + Vite）</h4>
                                    <p className="text-sm text-muted-foreground">
                                        使用 <strong>React</strong>、<strong>Tailwind CSS</strong> 和 <strong>Shadcn UI</strong> 构建的现代化响应式仪表盘。
                                        采用玻璃拟态美学（"霓虹玻璃"），并实现类似 WebSocket 的实时状态同步。
                                    </p>
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-2">后端（FastAPI + LangGraph）</h4>
                                    <p className="text-sm text-muted-foreground">
                                        由 <strong>FastAPI</strong> 驱动高性能异步 API 端点。
                                        核心逻辑由 <strong>LangGraph</strong> 驱动，这是一个有状态的编排库，用于管理不同 AI 智能体之间的工作流。
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </section>

                    {/* The Agents */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-purple-500">
                            <Bot className="h-6 w-6" />
                            <h3 className="text-2xl font-semibold text-foreground">智能体集群</h3>
                        </div>
                        <Card className="p-6 bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10 backdrop-blur-sm md:col-span-2">
                            <h4 className="font-bold text-xl mb-3 flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]"></span> 编排器
                            </h4>
                            <p className="text-foreground/90 leading-relaxed mb-4">
                                整个多智能体架构的核心路由机制。它接收所有顶层输入（文本、语音或系统触发），并使用 LLM 判断意图。
                            </p>
                            <ul className="list-disc pl-5 space-y-2 text-muted-foreground text-sm">
                                <li><strong>状态管理：</strong>使用 LangGraph 的状态字典维护跨子智能体的全局上下文。</li>
                                <li><strong>动态路由：</strong>评估传入提示以决定智能体路由：<code>email</code>、<code>compliance</code>、<code>pdf</code> 或 <code>forecast</code>。</li>
                                <li><strong>实例扩展：</strong>使用 8 个编排过的专用 LLM 实例来隔离职责（路由、提取、合规解释、采购订单撰写、预测）。</li>
                            </ul>
                        </Card>

                        <Card className="p-6 bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10 backdrop-blur-sm md:col-span-2">
                            <h4 className="font-bold text-xl mb-3 flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.8)]"></span> 邮件智能体
                            </h4>
                            <p className="text-foreground/90 leading-relaxed mb-4">
                                一个自主的收件箱处理器，旨在将非结构化的对话式邮件转化为格式化的采购数据。
                            </p>
                            <ul className="list-disc pl-5 space-y-2 text-muted-foreground text-sm">
                                <li><strong>信息提取：</strong>使用受 Pydantic 模式约束的 LLM 提取 `item_name`、`quantity` 和时限要求。</li>
                                <li><strong>智能物品匹配：</strong>采用高级 SKU 提取（例如从 <code>"Model X (SKU: AC-EV-X)"</code> 这类字符串中提取）以及分词模糊匹配，确保数据库关联准确率达 99%。</li>
                                <li><strong>实时修复机制：</strong>访问历史记录时自动检测缺失（"N/A"）数据，重新运行查找逻辑并实时将修复后的数据写回数据库。</li>
                                <li><strong>数学优先级：</strong>严格依据请求的交付时限自动计算紧急优先级（高/中/低）。</li>
                            </ul>
                        </Card>

                        <Card className="p-6 bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10 backdrop-blur-sm md:col-span-2">
                            <h4 className="font-bold text-xl mb-3 flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]"></span> 合规智能体
                            </h4>
                            <p className="text-foreground/90 leading-relaxed mb-4">
                                公司政策的守门人。在任何采购订单起草之前，该智能体会基于已提取邮件的数据集，验证拟订订单是否满足所有法律和内部阈值。
                            </p>
                            <ul className="list-disc pl-5 space-y-2 text-muted-foreground text-sm">
                                <li><strong>守门逻辑：</strong>执行库存容量限制（<code>max_capacity</code>）以及政策规定（<code>max_single_order_amount</code>、供应商审批评级）。</li>
                                <li><strong>LLM 解释器：</strong>将基于规则的通过/失败结果转化为自然、易读的文字，把技术性的 "Failed on vendor_score &lt; 70" 翻译成可执行的通俗建议。</li>
                                <li><strong>合规检查：</strong>对提取结果运行库存 / 政策守门检查，并用 LLM 生成通俗解释；下单需显式触发。</li>
                            </ul>
                        </Card>

                        <Card className="p-6 bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10 backdrop-blur-sm md:col-span-2">
                            <h4 className="font-bold text-xl mb-3 flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.8)]"></span> 预测智能体
                            </h4>
                            <p className="text-foreground/90 leading-relaxed mb-4">
                                一个混合分析引擎，将统计时间序列预测（Meta Prophet）与智能 LLM 综合层相结合，主动可视化和描述尚未发生的供应链瓶颈。
                            </p>
                            <ul className="list-disc pl-5 space-y-2 text-muted-foreground text-sm">
                                <li><strong>统计引擎：</strong>对数据库中的 5000+ 条历史记录运行 Facebook Prophet，识别深层的季节性规律和组件销量峰值。</li>
                                <li><strong>动态 JSON UI 架构：</strong>LLM 通过 `format="json"` 被严格约束输出结构化洞察（执行概览、宏观趋势、异常）。前端绕过不可预测的 Markdown，将该 JSON 直接映射为高度风格化的原生 React 便当卡片。</li>
                                <li><strong>交互式可视化：</strong>将原始时间序列数据无缝输出到交互式 `Recharts` 图形仪表盘中，支持实时图例隔离与筛选。</li>
                                <li><strong>状态持久化：</strong>所有分析运行都会快照到 `forecasts` SQLite 账本中，可通过历史下拉菜单即时热加载此前的执行报告。</li>
                            </ul>
                        </Card>
                    </section>

                    {/* Features */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-amber-500">
                            <Terminal className="h-6 w-6" />
                            <h3 className="text-2xl font-semibold text-foreground">核心功能</h3>
                        </div>
                        <div className="grid gap-4">
                            <Card className="p-5 flex gap-4 items-start bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10">
                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                                    <Mail className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-semibold">邮件集成</h4>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        连接 IMAP/SMTP 服务器以收发邮件。
                                        直接集成到工作流中，允许智能体处理传入的邮件数据。
                                    </p>
                                </div>
                            </Card>
                            <Card className="p-5 flex gap-4 items-start bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10">
                                <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
                                    <Database className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-semibold">本地 SQLite 数据库</h4>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        实现"本地优先"架构。统一的 <strong>procurement.db</strong> 将邮件与库存、预算、供应商和政策安全地存储在一起，实现无缝的离线智能体协作。
                                    </p>
                                </div>
                            </Card>
                            <Card className="p-5 flex gap-4 items-start bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10">
                                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                                    <Bot className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-semibold">智能体仪表盘</h4>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        可视化智能体内部的"思考过程"。实时观察编排器委派任务、智能体执行各自逻辑的过程。
                                    </p>
                                </div>
                            </Card>
                            <Card className="p-5 flex gap-4 items-start bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10">
                                <div className="p-2 rounded-lg bg-teal-500/10 text-teal-500">
                                    <TrendingUp className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-semibold">交互式分析</h4>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        数据即时转化为响应式图表仪表盘。混合模型在硬核统计数学之上叠加深度学习 AI 叙述，提供终极的执行仪表盘视图。
                                    </p>
                                </div>
                            </Card>
                            <Card className="p-5 flex gap-4 items-start bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10">
                                <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
                                    <Database className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-semibold">订单账本</h4>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        提供所有历史采购订单和当前采购记录的清晰账本视图，包含动态 PDF 生成路径以及物品-供应商交叉映射。
                                    </p>
                                </div>
                            </Card>
                        </div>

                    </section>

                    {/* Chat Commands & Routing */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-indigo-500">
                            <Bot className="h-6 w-6" />
                            <h3 className="text-2xl font-semibold text-foreground">聊天命令与路由</h3>
                        </div>
                        <p className="text-muted-foreground">
                            智能编排器对提示意图进行分类，并显式路由到匹配的流水线。
                        </p>

                        <div className="overflow-hidden rounded-lg border border-white/20 dark:border-white/10 shadow-sm bg-white/40 dark:bg-black/40 backdrop-blur-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-black/5 dark:bg-white/5 border-b border-white/20 dark:border-white/10">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-foreground">用户查询示例</th>
                                        <th className="px-4 py-3 font-semibold text-foreground">智能体路由</th>
                                        <th className="px-4 py-3 font-semibold text-foreground">流水线执行模式</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10">
                                    <tr>
                                        <td className="px-4 py-3 font-mono text-xs">"analyze emails"</td>
                                        <td className="px-4 py-3"><span className="px-2 py-1 bg-sky-500/10 text-sky-600 rounded">email</span></td>
                                        <td className="px-4 py-3 text-muted-foreground">获取未分析邮件 → AI 提取 → 物品/供应商匹配 → 保存分析记录</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 font-mono text-xs">"run compliance checks"</td>
                                        <td className="px-4 py-3"><span className="px-2 py-1 bg-rose-500/10 text-rose-600 rounded">compliance</span></td>
                                        <td className="px-4 py-3 text-muted-foreground">遍历所有历史 `email_analysis` 记录 → 重新运行守门检查 → 创建已验证订单</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 font-mono text-xs">"generate pdf for order 14"</td>
                                        <td className="px-4 py-3"><span className="px-2 py-1 bg-amber-500/10 text-amber-600 rounded">pdf</span></td>
                                        <td className="px-4 py-3 text-muted-foreground">通过正则提取整数订单 ID → 生成 LLM 叙述 → 构建 Helvetica PDF → 更新数据库路径</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 font-mono text-xs">"show high priority emails"</td>
                                        <td className="px-4 py-3"><span className="px-2 py-1 bg-gray-500/10 text-gray-600 rounded">unknown</span></td>
                                        <td className="px-4 py-3 text-muted-foreground">编排器生成客户端 UI 动作 → 触发 <code>redirect</code> 跳转到邮件标签页 + <code>filter: High</code></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Key Endpoints */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-green-500">
                            <Network className="h-6 w-6" />
                            <h3 className="text-2xl font-semibold text-foreground">交互式采购 API</h3>
                        </div>
                        <p className="text-muted-foreground">
                            系统将提取与下游流水线解耦，允许用户通过以下端点控制执行：
                        </p>
                        <div className="grid gap-4">
                            <Card className="p-5 flex gap-4 items-start bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10">
                                <div>
                                    <h4 className="font-mono font-semibold text-blue-500">POST /procurement/{"{email_id}"}/compliance</h4>
                                    <p className="text-sm text-foreground/90 mt-1">
                                        对已提取的邮件记录运行守门规则。记录简单的通过/失败标志，并保存通俗易懂的解释。
                                    </p>
                                </div>
                            </Card>
                            <Card className="p-5 flex gap-4 items-start bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10">
                                <div>
                                    <h4 className="font-mono font-semibold text-green-500">POST /procurement/{"{email_id}"}/order</h4>
                                    <p className="text-sm text-foreground/90 mt-1">
                                        启动实际的采购订单创建。仅当请求满足所有合规阈值时才执行。在 `orders` 表中写入记录并触发本地 PDF 文件生成。
                                    </p>
                                </div>
                            </Card>
                            <Card className="p-5 flex gap-4 items-start bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10">
                                <div>
                                    <h4 className="font-mono font-semibold text-sky-500">POST /procurement/compliance-by-item</h4>
                                    <p className="text-sm text-foreground/90 mt-1">
                                        对匹配给定 <code>item_name</code> 载荷的最新邮件分析运行合规检查。返回详细的通过/失败说明。
                                    </p>
                                </div>
                            </Card>
                            <Card className="p-5 flex gap-4 items-start bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10">
                                <div>
                                    <h4 className="font-mono font-semibold text-emerald-500">POST /procurement/order-by-item</h4>
                                    <p className="text-sm text-foreground/90 mt-1">
                                        通过检查匹配 <code>item_name</code> 载荷的最新合规请求，显式创建订单并生成其 PDF。
                                    </p>
                                </div>
                            </Card>
                            <Card className="p-5 flex gap-4 items-start bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10">
                                <div>
                                    <h4 className="font-mono font-semibold text-amber-500">POST /orders/{"{order_id}"}/generate-pdf</h4>
                                    <p className="text-sm text-foreground/90 mt-1">
                                        为特定的历史订单 ID 重新生成并返回采购订单 PDF，显式绕过标准执行流水线以便直接 UI 下载。
                                    </p>
                                </div>
                            </Card>
                            <Card className="p-5 flex gap-4 items-start bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10">
                                <div>
                                    <h4 className="font-mono font-semibold text-indigo-500">POST /orders/manual</h4>
                                    <p className="text-sm text-foreground/90 mt-1">
                                        绕过邮件提取流水线创建手动订单。在一个流程中自动执行合规和 PDF 生成，并返回即时结果供内嵌 UI 使用。
                                    </p>
                                </div>
                            </Card>
                        </div>
                    </section>

                    {/* Chat Procurement Workflow */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-pink-500">
                            <Bot className="h-6 w-6" />
                            <h3 className="text-2xl font-semibold text-foreground">聊天采购工作流</h3>
                        </div>
                        <p className="text-muted-foreground">
                            系统现在提供完全集成的基于聊天的采购流程。它用流畅的对话界面取代了打断操作的弹窗：
                        </p>
                        <Card className="p-6 bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10 backdrop-blur-sm">
                            <ul className="list-disc pl-5 space-y-2 text-foreground/90 text-sm leading-relaxed">
                                <li><strong>上下文交接：</strong>点击已分析邮件上的"开始采购"会将结构化触发命令直接注入编排器。</li>
                                <li><strong>交互式组件：</strong>编排器在聊天气泡内以内联方式渲染专用 React 组件，而非纯文本，提供丰富的上下文（物品、供应商、总成本）。</li>
                                <li><strong>顺序执行：</strong>用户无需离开聊天界面即可手动调用 <code>run_compliance</code> 工具，然后依次调用 <code>place_order</code> 生成工具。</li>
                                <li><strong>内嵌产物：</strong>后端生成的采购订单 PDF 会立即在聊天组件内格式化并添加超链接，支持一键下载。</li>
                            </ul>
                        </Card>
                    </section>

                    {/* Database Tables */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-rose-500">
                            <Database className="h-6 w-6" />
                            <h3 className="text-2xl font-semibold text-foreground">数据库结构</h3>
                        </div>
                        <p className="text-muted-foreground">
                            系统依赖统一的 <strong>procurement.db</strong> SQLite 数据库。以下是智能体集群使用的核心表：
                        </p>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Card className="p-4 bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10 backdrop-blur-sm">
                                <h4 className="font-bold flex items-center gap-2 mb-1">
                                    <span className="w-2 h-2 rounded-sm bg-blue-500"></span> emails
                                </h4>
                                <p className="text-sm text-muted-foreground mb-2">
                                    存储通过 IMAP 获取的原始邮件数据。
                                </p>
                                <p className="text-xs font-mono text-muted-foreground bg-black/5 dark:bg-white/5 p-1 rounded">
                                    id, subject, sender, date, body, folder, is_read, timestamp
                                </p>
                            </Card>

                            <Card className="p-4 bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10 backdrop-blur-sm">
                                <h4 className="font-bold flex items-center gap-2 mb-1">
                                    <span className="w-2 h-2 rounded-sm bg-blue-500"></span> email_analysis
                                </h4>
                                <p className="text-sm text-muted-foreground mb-2">
                                    保存邮件智能体提取的结构化数据。
                                </p>
                                <p className="text-xs font-mono text-muted-foreground bg-black/5 dark:bg-white/5 p-1 rounded overflow-x-auto whitespace-nowrap">
                                    id, email_id, priority, summary, item_id, item_name, item_quantity, item_unit_price, vendor_id, vendor_name, vendor_email, vendor_phone, total_cost, compliance_explanation, order_id
                                </p>
                            </Card>

                            <Card className="p-4 bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10 backdrop-blur-sm">
                                <h4 className="font-bold flex items-center gap-2 mb-1">
                                    <span className="w-2 h-2 rounded-sm bg-green-500"></span> items
                                </h4>
                                <p className="text-sm text-muted-foreground mb-2">
                                    产品目录，包括定价和可用供应商。
                                </p>
                                <p className="text-xs font-mono text-muted-foreground bg-black/5 dark:bg-white/5 p-1 rounded overflow-x-auto whitespace-nowrap">
                                    item_id, item_name, sku, item_unit_qty, item_unit_price, item_vendor_id
                                </p>
                            </Card>

                            <Card className="p-4 bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10 backdrop-blur-sm">
                                <h4 className="font-bold flex items-center gap-2 mb-1">
                                    <span className="w-2 h-2 rounded-sm bg-green-500"></span> vendors
                                </h4>
                                <p className="text-sm text-muted-foreground mb-2">
                                    供应商详情及其内部审批评分。
                                </p>
                                <p className="text-xs font-mono text-muted-foreground bg-black/5 dark:bg-white/5 p-1 rounded overflow-x-auto whitespace-nowrap">
                                    vendor_id, vendor_name, vendor_email, vendor_phone, vendor_approved, vendor_score
                                </p>
                            </Card>

                            <Card className="p-4 bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10 backdrop-blur-sm">
                                <h4 className="font-bold flex items-center gap-2 mb-1">
                                    <span className="w-2 h-2 rounded-sm bg-amber-500"></span> inventory
                                </h4>
                                <p className="text-sm text-muted-foreground mb-2">
                                    跟踪物品在库数量和仓库容量。
                                </p>
                                <p className="text-xs font-mono text-muted-foreground bg-black/5 dark:bg-white/5 p-1 rounded overflow-x-auto whitespace-nowrap">
                                    item_id, qty_on_hand, max_capacity, min_qty
                                </p>
                            </Card>

                            <Card className="p-4 bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10 backdrop-blur-sm">
                                <h4 className="font-bold flex items-center gap-2 mb-1">
                                    <span className="w-2 h-2 rounded-sm bg-purple-500"></span> policies
                                </h4>
                                <p className="text-sm text-muted-foreground mb-2">
                                    内部业务规则的键值存储（例如最大订单金额）。
                                </p>
                                <p className="text-xs font-mono text-muted-foreground bg-black/5 dark:bg-white/5 p-1 rounded overflow-x-auto whitespace-nowrap">
                                    key, value
                                </p>
                            </Card>

                            <Card className="p-4 bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10 backdrop-blur-sm">
                                <h4 className="font-bold flex items-center gap-2 mb-1">
                                    <span className="w-2 h-2 rounded-sm bg-purple-500"></span> orders
                                </h4>
                                <p className="text-sm text-muted-foreground mb-2">
                                    已生成采购订单及其 PDF 路径的历史账本。
                                </p>
                                <p className="text-xs font-mono text-muted-foreground bg-black/5 dark:bg-white/5 p-1 rounded overflow-x-auto whitespace-nowrap">
                                    id, item_id, qty, vendor_id, amount, pdf_path, created_at
                                </p>
                            </Card>

                            <Card className="p-4 bg-white/40 dark:bg-black/40 border-white/20 dark:border-white/10 backdrop-blur-sm">
                                <h4 className="font-bold flex items-center gap-2 mb-1">
                                    <span className="w-2 h-2 rounded-sm bg-teal-500"></span> forecasts
                                </h4>
                                <p className="text-sm text-muted-foreground mb-2">
                                    存储 JSON 映射情报报告和时间序列数组的历史归档。
                                </p>
                                <p className="text-xs font-mono text-muted-foreground bg-black/5 dark:bg-white/5 p-1 rounded overflow-x-auto whitespace-nowrap">
                                    id, markdown, chart_data, created_at
                                </p>
                            </Card>
                        </div>
                    </section>

                    <div className="h-20" /> {/* Bottom spacer */}
                </div>
            </ScrollArea >
        </div >
    );
}
