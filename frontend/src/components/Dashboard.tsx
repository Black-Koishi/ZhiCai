import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Activity, Terminal, ArrowRight, CheckCircle2, Clock, AlertCircle, Mail, Shield, TrendingUp, Cpu } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Message } from "./ChatInterface";
import { API_BASE_URL } from "@/api/client";

interface DashboardProps {
    messages: Message[];
    isLoading: boolean;
}

interface Agent {
    id: string;
    key: string; // Used for matching logs
    agentSettingsKey?: string; // key used in /settings/models API
    name: string;
    role: string;
    status: "active" | "idle" | "thinking" | "error";
    icon: any;
    color: string;
    description: string;
    thoughts: string[];
    capabilities: string[];
    model?: string;
}

const initialAgents: Agent[] = [
    {
        id: "orch-01",
        key: "编排器",
        agentSettingsKey: "orchestrator",
        name: "编排器",
        role: "系统协调器",
        status: "idle",
        icon: Brain,
        color: "from-purple-500 to-indigo-600",
        description: "中央调度单元，负责拆解用户请求并将子任务委派给专业智能体。",
        thoughts: ["系统已初始化。", "等待输入..."],
        capabilities: ["意图分类", "任务委派", "上下文管理"],
        model: "加载中..."
    },
    {
        id: "agent-email-05",
        key: "邮件智能体",
        agentSettingsKey: "email",
        name: "邮件智能体",
        role: "通讯",
        status: "idle",
        icon: Mail,
        color: "from-sky-500 to-blue-600",
        description: "处理收发邮件通信，提取订单或供应商询价信息。",
        thoughts: ["模型配置已加载。", "等待处理邮件请求..."],
        capabilities: ["邮件解析", "供应商检索", "成本计算"],
        model: "加载中..."
    },
    {
        id: "agent-comp-06",
        key: "合规智能体",
        agentSettingsKey: "compliance",
        name: "合规智能体",
        role: "政策执行器",
        status: "idle",
        icon: Shield,
        color: "from-rose-500 to-red-600",
        description: "依据公司政策、预算上限和供应商限制来审核采购请求。",
        thoughts: ["政策已加载。", "准备校验。"],
        capabilities: ["政策检查", "预算审批"],
        model: "加载中..."
    },
    {
        id: "agent-forecast-08",
        key: "需求分析智能体",
        agentSettingsKey: "forecast",
        name: "需求分析智能体",
        role: "历史趋势分析",
        status: "idle",
        icon: TrendingUp,
        color: "from-teal-500 to-emerald-600",
        description: "聚合历史订单，估计整体采购趋势并识别月度需求峰值。",
        thoughts: ["数据模型已加载。", "准备分析。"],
        capabilities: ["趋势估计", "季节性汇总"],
        model: "加载中..."
    }
];

export function Dashboard({ messages, isLoading }: DashboardProps) {
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
    const [agents, setAgents] = useState<Agent[]>(initialAgents);

    // Fetch models on mount
    useEffect(() => {
        let isMounted = true;
        
        const fetchModels = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/settings/models`);
                if (!res.ok) throw new Error("Failed to fetch models");
                const data = await res.json();
                
                if (isMounted && data.status === "success") {
                    setAgents(prev => prev.map(agent => {
                        if (agent.agentSettingsKey && data.models[agent.agentSettingsKey]) {
                            return { ...agent, model: data.models[agent.agentSettingsKey] };
                        }
                        return agent;
                    }));
                }
            } catch (err) {
                console.error("Error fetching agent models:", err);
            }
        };

        fetchModels();
        
        // Also set up a small polling interval to keep dashboard models in sync if changed in Settings
        const interval = setInterval(fetchModels, 30000);
        
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    // Update the displayed status and steps from the latest chat response
    useEffect(() => {
        if (messages.length === 0 && !isLoading) return;

        setAgents(prevAgents => {
            const newAgents = [...prevAgents];

            // Get the latest message with steps
            const lastMessage = messages[messages.length - 1];
            const steps = lastMessage?.steps || [];

            return newAgents.map(agent => {
                const updatedAgent = { ...agent };

                // 1. Update Status based on global loading state
                if (agent.key === "编排器") {
                    updatedAgent.status = isLoading ? "thinking" : "active";
                } else {
                    // For worker agents, check if they were involved in the last turn
                    const engaged = steps.some(step => step.includes(agent.key));
                    if (isLoading) {
                        updatedAgent.status = "idle"; // Reset while orchestrator thinks
                    } else {
                        updatedAgent.status = engaged ? "active" : "idle";
                    }
                }

                // 2. Parse the latest execution steps
                // Filter steps that belong to this agent
                const relevantSteps = steps.filter(step => step.includes(agent.key));

                if (relevantSteps.length > 0) {
                    // Clean up the prefix "Agent Name: "
                    const cleanThoughts = relevantSteps.map(step => {
                        const parts = step.split(": ");
                        return parts.length > 1 ? parts[1] : step;
                    });
                    updatedAgent.thoughts = cleanThoughts;
                } else if (isLoading && agent.key === "编排器") {
                    updatedAgent.thoughts = ["正在分析请求...", "正在确定路由..."];
                }

                return updatedAgent;
            });
        });

    }, [messages, isLoading]);


    return (
        <div className="h-full flex flex-col bg-transparent overflow-hidden">
            <ScrollArea className="flex-1">
                <div className="max-w-7xl mx-auto p-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8"
                    >
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent mb-2">
                            智能体仪表盘
                        </h1>
                        <p className="text-muted-foreground">展示当前请求状态与最近一次返回的处理步骤。</p>
                    </motion.div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {agents.map((agent, index) => (
                            <motion.div
                                key={agent.id}
                                layoutId={`card-${agent.id}`}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.1 }}
                                onClick={() => setSelectedAgent(agent)}
                                className="group relative cursor-pointer h-full"
                            >
                                {/* Dynamic Glow Background */}
                                <div className={`absolute -inset-0.5 bg-gradient-to-r ${agent.color} rounded-xl opacity-20 group-hover:opacity-60 blur transition duration-500`} />

                                <Card className="relative h-full bg-white/60 dark:bg-black/40 backdrop-blur-xl border-black/5 dark:border-white/10 overflow-hidden hover:bg-white/80 dark:hover:bg-black/60 transition-colors shadow-sm flex flex-col">
                                    <CardHeader className="pb-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className={`p-3 rounded-lg bg-gradient-to-br ${agent.color} bg-opacity-10 dark:bg-opacity-20`}>
                                                <agent.icon className="w-6 h-6 text-white" />
                                            </div>
                                            <StatusBadge status={agent.status} />
                                        </div>
                                        <CardTitle className="text-xl text-foreground">{agent.name}</CardTitle>
                                        <CardDescription className="text-muted-foreground">{agent.role}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex flex-col flex-1 h-full">
                                        <div className="h-[60px] mb-4">
                                            <p className="text-sm text-muted-foreground/80 line-clamp-3">
                                                {agent.description}
                                            </p>
                                        </div>

                                        {/* Model display inside card */}
                                        {agent.model && (
                                            <div className="flex items-center gap-1.5 mb-4 text-xs font-medium text-slate-600 dark:text-slate-400 bg-black/5 dark:bg-white/5 w-fit px-2.5 py-1 rounded-md border border-black/5 dark:border-white/10">
                                                <Cpu className="w-3.5 h-3.5" />
                                                <span>模型：</span>
                                                <span className="text-foreground tracking-tight">{agent.model}</span>
                                            </div>
                                        )}
                                        
                                        <div className="flex items-center text-xs text-blue-600 dark:text-blue-400 font-medium group-hover:translate-x-1 transition-transform mt-auto">
                                            查看步骤 <ArrowRight className="w-3 h-3 ml-1" />
                                        </div>
                                    </CardContent>

                                    {/* Animated Activity Line */}
                                    {agent.status === 'thinking' && (
                                        <motion.div
                                            className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent w-full"
                                            animate={{ x: ['-100%', '100%'] }}
                                            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                                        />
                                    )}
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </ScrollArea>

            {/* Expanded Modal Overlay */}
            <AnimatePresence>
                {selectedAgent && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedAgent(null)}
                            className="absolute inset-0 bg-white/40 dark:bg-black/60 backdrop-blur-sm"
                        />

                        <motion.div
                            layoutId={`card-${selectedAgent.id}`}
                            className="relative w-full max-w-2xl bg-white dark:bg-black/90 border border-black/5 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[85vh]"
                        >
                            {/* Header */}
                            <div className={`relative p-8 overflow-hidden`}>
                                <div className={`absolute inset-0 bg-gradient-to-br ${selectedAgent.color} opacity-10`} />

                                <div className="relative z-10 flex items-start justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-4 rounded-xl bg-gradient-to-br ${selectedAgent.color} shadow-lg shadow-black/5 dark:shadow-black/20`}>
                                            <selectedAgent.icon className="w-8 h-8 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/70">
                                                {selectedAgent.name}
                                            </h2>
                                            <p className="text-lg text-muted-foreground">{selectedAgent.role}</p>
                                        </div>
                                    </div>
                                    <StatusBadge status={selectedAgent.status} size="lg" />
                                </div>
                            </div>

                            <ScrollArea className="flex-1">
                                <div className="p-8 space-y-8">

                                    {/* Selected Model Details */}
                                    {selectedAgent.model && (
                                        <div>
                                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                                                <Cpu className="w-4 h-4" /> 已配置引擎
                                            </h3>
                                            <div className="flex flex-col bg-blue-50/50 dark:bg-blue-900/10 rounded-lg p-4 border border-blue-100 dark:border-blue-900/30">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-slate-600 dark:text-slate-400">当前 LLM：</span>
                                                    <Badge variant="outline" className="bg-white dark:bg-black text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                                                        {selectedAgent.model}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Capabilities */}
                                    <div>
                                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                                            <Brain className="w-4 h-4" /> 能力属性
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedAgent.capabilities.map((cap) => (
                                                <Badge key={cap} variant="secondary" className="bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-foreground border-black/5 dark:border-white/10 px-3 py-1">
                                                    {cap}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Recent execution steps */}
                                    <div>
                                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                                            <Terminal className="w-4 h-4" /> 最近执行步骤
                                        </h3>
                                        <div className="bg-gray-50 dark:bg-black/50 rounded-lg border border-black/5 dark:border-white/10 p-4 font-mono text-sm shadow-inner min-h-[150px]">
                                            {selectedAgent.thoughts.map((thought, i) => (
                                                <motion.div
                                                    key={i}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: i * 0.1 }}
                                                    className="mb-2 flex items-start gap-3 last:mb-0"
                                                >
                                                    <span className="text-blue-500/50 select-none">{`>`}</span>
                                                    <span className={i === selectedAgent.thoughts.length - 1 ? 'text-blue-600 dark:text-cyan-400 font-medium' : 'text-gray-500 dark:text-gray-400'}>
                                                        {thought}
                                                    </span>
                                                </motion.div>
                                            ))}
                                            <motion.div
                                                animate={{ opacity: [0, 1, 0] }}
                                                transition={{ repeat: Infinity, duration: 0.8 }}
                                                className="w-2 h-4 bg-blue-500/50 dark:bg-cyan-500/50 mt-1"
                                            />
                                        </div>
                                    </div>

                                    <div className="text-xs text-muted-foreground pt-4 border-t border-black/5 dark:border-white/5 flex justify-between">
                                        <span>智能体 ID：<span className="font-mono text-blue-500 dark:text-blue-400/70">{selectedAgent.id}</span></span>
                                    </div>
                                </div>
                            </ScrollArea>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function StatusBadge({ status, size = "sm" }: { status: string, size?: "sm" | "lg" }) {
    const config = {
        active: { color: "bg-green-500", label: "最近参与", icon: CheckCircle2, text: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" },
        thinking: { color: "bg-cyan-500", label: "处理中", icon: Activity, text: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-500/10" },
        idle: { color: "bg-gray-400", label: "未参与", icon: Clock, text: "text-gray-500 dark:text-gray-400", bg: "bg-gray-500/10" },
        error: { color: "bg-red-500", label: "错误", icon: AlertCircle, text: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" }
    }[status] || { color: "bg-gray-500", label: "未知", icon: Clock, text: "text-gray-500", bg: "bg-gray-500/10" };

    return (
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-transparent ${config.bg} ${status === 'thinking' ? 'animate-pulse' : ''} ${size === 'lg' ? 'px-4 py-1.5' : ''}`}>
            <div className={`relative flex items-center justify-center`}>
                <div className={`w-2 h-2 rounded-full ${config.color} ${status === 'active' ? 'shadow-[0_0_8px_rgba(34,197,94,0.6)]' : ''}`} />
                {status === 'thinking' && <div className={`absolute w-3 h-3 rounded-full ${config.color} opacity-30 animate-ping`} />}
            </div>
            <span className={`text-xs font-medium ${config.text} ${size === 'lg' ? 'text-sm' : ''}`}>{config.label}</span>
        </div>
    );
}
