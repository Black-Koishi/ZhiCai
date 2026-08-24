import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, Mail, ShieldCheck, ShoppingCart, Sparkles, Star, TrendingUp, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./MessageBubble";
import { sendMessage } from "@/api/client";
import { OrchestratorStatus } from "./OrchestratorStatus";

export interface Message {
    role: 'user' | 'assistant';
    content: string;
    steps?: string[];
    ui_actions?: any[];
}

interface ChatInterfaceProps {
    agentEmailEnabled: boolean;
    agentComplianceEnabled: boolean;
    agentPdfEnabled: boolean;
    agentForecastEnabled: boolean;
    messages: Message[];
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    input: string;
    setInput: (value: string) => void;
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
    onUIAction?: (action: { action_type: string; params: any }) => void;
}

export function ChatInterface({
    agentEmailEnabled,
    agentComplianceEnabled,
    agentPdfEnabled,
    agentForecastEnabled,
    messages,
    setMessages,
    input,
    setInput,
    isLoading,
    setIsLoading,
    onUIAction
}: ChatInterfaceProps) {
    const [currentSteps, setCurrentSteps] = useState<string[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, currentSteps, isLoading]);

    const submitMessage = async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMessage = text.trim();
        setInput("");
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);
        setCurrentSteps([]);

        // simulate orchestrator thinking start
        setCurrentSteps(["编排器：正在分析输入..."]);

        try {
            const response = await sendMessage({
                message: userMessage,
                agent_email_enabled: agentEmailEnabled,
                agent_compliance_enabled: agentComplianceEnabled,
                agent_pdf_enabled: agentPdfEnabled,
                agent_forecast_enabled: agentForecastEnabled,
            });

            // Update with final response
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: response.response_text,
                steps: response.steps,
                ui_actions: response.ui_actions
            }]);

            // Handle UI Actions from LLM
            if (response.ui_actions && onUIAction) {
                response.ui_actions.forEach((action: any) => {
                    if (action.action_type !== 'trigger_api') {
                        onUIAction(action);
                    }
                });
            }
            setCurrentSteps([]);

        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: "错误：处理请求失败。" }]);
        } finally {
            setIsLoading(false);
            setCurrentSteps([]);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        submitMessage(input);
    };

    const suggestions: { icon: any; text: string; desc: string; command?: string }[] = [
        { icon: Mail, text: "分析邮件", desc: "解析收件箱中的采购需求" },
        { icon: ShieldCheck, text: "运行合规检查", desc: "审核已分析的采购请求" },
        { icon: Star, text: "显示高优先级邮件", desc: "跳转邮件并筛选高优先级" },
        { icon: ShoppingCart, text: "下单", desc: "示例：订购 10 个无绳电钻", command: "订购 10 个无绳电钻" },
        { icon: TrendingUp, text: "生成趋势报告", desc: "分析历史采购需求" },
        { icon: Settings, text: "打开设置", desc: "配置智能体与邮箱" },
    ];

    return (
        <div className="flex flex-col h-full bg-transparent">
            {/* Messages Area */}
            <ScrollArea className="flex-1 px-4 py-6">
                <div className="max-w-4xl mx-auto space-y-8">
                    {messages.length === 0 && !isLoading && (
                        <div className="flex flex-col items-center justify-center text-center py-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25 mb-6">
                                <Bot className="h-8 w-8 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                                智采 ZhiCai
                            </h2>
                            <p className="text-muted-foreground mt-2">AI 多智能体采购助手</p>
                            <p className="text-sm text-muted-foreground/70 mt-1 max-w-md">
                                用自然语言管理采购全流程：邮件分析、合规审核、订单管理、需求趋势分析。
                            </p>

                            <div className="flex items-center gap-2 text-xs text-muted-foreground/60 mt-10">
                                <Sparkles className="h-3.5 w-3.5" />
                                点击下方指令快速开始
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4 w-full max-w-2xl">
                                {suggestions.map((s) => (
                                    <button
                                        key={s.text}
                                        onClick={() => submitMessage(s.command || s.text)}
                                        className="group flex flex-col items-start gap-1.5 p-4 rounded-xl text-left bg-white/40 dark:bg-black/30 backdrop-blur-sm border border-white/20 dark:border-white/10 hover:border-blue-500/40 hover:bg-white/60 dark:hover:bg-black/50 transition-all duration-200 hover:-translate-y-0.5"
                                    >
                                        <s.icon className="h-5 w-5 text-blue-500 group-hover:text-cyan-500 transition-colors" />
                                        <span className="text-sm font-medium text-foreground">{s.text}</span>
                                        <span className="text-xs text-muted-foreground/70">{s.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, index) => (
                        <MessageBubble key={index} msg={msg} onActionClick={onUIAction} />
                    ))}

                    {/* Live Status Indicator (Floating) */}
                    {(isLoading || currentSteps.length > 0) && (
                        <div className="max-w-xl mx-auto my-4">
                            <OrchestratorStatus isProcessing={isLoading} steps={currentSteps} />
                        </div>
                    )}

                    <div ref={scrollRef} className="h-4" />
                </div>
            </ScrollArea>

            {/* Floating Input Area */}
            <div className="p-6 bg-transparent">
                <div className="max-w-3xl mx-auto rounded-full p-2 bg-white/70 dark:bg-black/70 backdrop-blur-xl border border-transparent flex items-center gap-2 transition-all duration-300 focus-within:bg-white/80 dark:focus-within:bg-black/80 focus-within:shadow-[0_0_0_1px_rgba(59,130,246,0.5),0_0_12px_rgba(6,182,212,0.4)] overflow-hidden bg-clip-padding">
                    <form onSubmit={handleSubmit} className="flex-1 flex items-center px-2">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="请输入内容..."
                            className="flex-1 bg-transparent !border-none !shadow-none !ring-0 !outline-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base py-6 placeholder:text-muted-foreground/70"
                            disabled={isLoading}
                        />
                        <Button
                            type="submit"
                            disabled={isLoading}
                            size="icon"
                            className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/30 transition-all hover:scale-105"
                        >
                            <Send className="w-4 h-4" />
                        </Button>
                    </form>
                </div>
                <div className="text-center mt-2">
                    <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">智采 ZhiCai · AI 多智能体采购平台</span>
                </div>
            </div>
        </div>
    );
}
