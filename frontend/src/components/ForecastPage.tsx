import React, { useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Loader2, TrendingUp, Presentation, AlertCircle, Bot } from 'lucide-react';
import { generateForecast, fetchLatestForecast, fetchForecastHistory, fetchForecastById } from '../api/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { History } from 'lucide-react';

export interface ForecastPageProps {
    isGenerating: boolean;
    setIsGenerating: (val: boolean) => void;
    report: string | null;
    setReport: (val: string | null) => void;
    chartData: any[] | null;
    setChartData: (val: any[] | null) => void;
    error: string | null;
    setError: (val: string | null) => void;
}

export const ForecastPage: React.FC<ForecastPageProps> = ({
    isGenerating, setIsGenerating, report, setReport, chartData, setChartData, error, setError
}) => {
    const [selectedItems, setSelectedItems] = React.useState<string[]>([]);
    const [history, setHistory] = React.useState<any[]>([]);

    React.useEffect(() => {
        fetchForecastHistory().then(res => {
            if (res.status === 'success') setHistory(res.data);
        }).catch(() => {});
    }, [isGenerating]);
    
    const allChartKeys = React.useMemo(() => {
        if (!chartData || chartData.length === 0) return [];
        return Object.keys(chartData[0]).filter(k => k !== 'name');
    }, [chartData]);

    React.useEffect(() => {
        if (allChartKeys.length > 0) {
            // Select up to 4 items initially so the chart isn't overly cluttered
            setSelectedItems(allChartKeys.slice(0, 4));
        } else {
            setSelectedItems([]);
        }
    }, [allChartKeys]);

    const colors = [
        "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", 
        "#6366f1", "#14b8a6", "#84cc16", "#eab308", "#f97316", "#f43f5e",
        "#d946ef", "#0ea5e9", "#22c55e"
    ];

    useEffect(() => {
        if (isGenerating || report) return; // Skip if already loaded or currently generating
        fetchLatestForecast()
            .then(res => {
                if (res.status === 'success' && res.data) {
                    setReport(res.data.markdown || null);
                    if (res.data.chart_data) {
                        try {
                            setChartData(JSON.parse(res.data.chart_data));
                        } catch(e) {}
                    }
                }
            })
            .catch(() => console.log("No stored forecast available."));
    }, [isGenerating, report, setReport, setChartData]);

    const handleGenerate = async () => {
        setIsGenerating(true);
        setError(null);
        setReport(null);
        setChartData(null);
        try {
            const data = await generateForecast();
            if (data.error) {
                // Backend LLM or parsing errors that still returned nicely packed json
                setReport(data.markdown); 
            } else {
                setReport(data.markdown);
            }
            if (data.chart_data) {
                setChartData(typeof data.chart_data === 'string' ? JSON.parse(data.chart_data) : data.chart_data);
            }
        } catch (err: any) {
            setError(err.message || "生成需求趋势报告时发生意外错误。");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleLoadHistory = async (id: number) => {
        try {
            const data = await fetchForecastById(id);
            if (data.status === 'success' && data.data) {
                setReport(data.data.markdown || null);
                if (data.data.chart_data) {
                    try {
                        setChartData(JSON.parse(data.data.chart_data));
                    } catch(e) {}
                }
            }
        } catch (err) {
            console.error("Failed to load history", err);
        }
    };

    const renderReportContent = () => {
        if (!report) return null;
        
        try {
            const parsed = JSON.parse(report);
            return (
                <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {/* Executive Summary */}
                    <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-700 rounded-xl p-5 md:p-6 shadow-xl text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white/20 rounded-full blur-3xl"></div>
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 drop-shadow-md">
                            <TrendingUp className="w-5 h-5 opacity-90" />
                            执行概览
                        </h2>
                        <p className="text-base leading-relaxed opacity-95 font-medium drop-shadow-sm">
                            {parsed.executive_summary}
                        </p>
                    </div>

                    {/* Overall Trend */}
                    {parsed.overall_trend && (
                        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 shadow-lg border border-slate-200 dark:border-white/5 flex flex-col md:flex-row items-center gap-5 hover:shadow-xl transition-shadow duration-500">
                            <div className="flex flex-col items-center justify-center min-w-[120px] p-4 rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 shadow-inner">
                                <span className={`text-3xl font-black tracking-tighter ${parsed.overall_trend.direction?.toLowerCase() === 'downward' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                    {String(parsed.overall_trend.percentage ?? '').replace(/[^\d.+-]/g, '') || '0'}%
                                </span>
                                <span className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-2">
                                    {parsed.overall_trend.direction?.toLowerCase() === 'downward' ? '下行趋势' : '上行趋势'}
                                </span>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 tracking-tight">宏观分析</h3>
                                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm">
                                    {parsed.overall_trend.analysis}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Anomalies Grid */}
                    {parsed.anomalies && parsed.anomalies.length > 0 && (
                        <div className="mt-2">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 tracking-tight">关键组件洞察</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                                {parsed.anomalies.map((anomaly: any, idx: number) => {
                                    const isHigh = anomaly.severity?.toLowerCase() === 'high';
                                    return (
                                        <div key={idx} className="bg-white dark:bg-gray-900 flex flex-col rounded-xl p-5 shadow-md border border-slate-200 dark:border-white/5 hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
                                            <div className={`absolute top-0 left-0 w-1.5 h-full transition-all duration-300 group-hover:w-2.5 ${isHigh ? 'bg-gradient-to-b from-rose-400 to-rose-600' : 'bg-gradient-to-b from-amber-400 to-orange-500'}`}></div>
                                            <div className="flex justify-between items-start mb-3 pl-2">
                                                <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 pr-3 leading-tight">{anomaly.item}</h4>
                                                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${isHigh ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'}`}>
                                                    {anomaly.severity === 'High' ? '高' : anomaly.severity === 'Medium' ? '中' : anomaly.severity === 'Low' ? '低' : anomaly.severity}
                                                </span>
                                            </div>
                                            <p className="text-slate-600 dark:text-slate-400 mb-4 flex-1 pl-2 text-sm leading-relaxed">
                                                {anomaly.insight}
                                            </p>
                                            <div className="mt-auto bg-slate-50 dark:bg-black/40 rounded-lg p-3 border border-slate-100 dark:border-white/5 ml-2">
                                                <div className="text-[0.65rem] font-black text-purple-600 dark:text-purple-400 uppercase mb-1 tracking-widest flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></div>
                                                    推荐策略
                                                </div>
                                                <div className="text-slate-700 dark:text-slate-200 font-semibold text-sm leading-snug">
                                                    {anomaly.recommended_action}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                    
                    {/* Subtle LLM Model Label */}
                    {parsed.model_used && (
                        <div className="flex justify-end mt-4">
                            <span className="px-4 py-1.5 rounded-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[0.65rem] font-black tracking-widest text-slate-500 uppercase flex items-center gap-2 shadow-sm">
                                <Bot className="w-3.5 h-3.5 text-purple-500" />
                                由 {parsed.model_used} 整理
                            </span>
                        </div>
                    )}
                </div>
            );
        } catch (e) {
            // Fallback for old markdown reports
            return (
                <div className="bg-white dark:bg-gray-900 rounded-xl p-5 md:p-6 border border-slate-200 dark:border-white/5 shadow-md">
                    <div className="text-purple-500 text-xs mb-3 font-black uppercase tracking-widest">旧版报告格式</div>
                    <pre className="whitespace-pre-wrap font-sans text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
                        {report.startsWith('#') ? report : `# 需求趋势报告\n\n${report}`}
                    </pre>
                </div>
            );
        }
    };

    return (
        <div className="flex-1 p-6 space-y-5 overflow-y-auto w-full h-full custom-scrollbar">
            {/* Header Area */}
            <div className="flex justify-between items-start w-full gap-4 flex-col lg:flex-row">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            需求趋势分析
                        </h1>
                    </div>
                    <p className="text-muted-foreground max-w-2xl leading-relaxed text-sm">
                        聚合历史采购记录，识别月度峰值与整体趋势。
                        确定性分析负责计算，LLM 负责整理结构化洞察。
                    </p>
                </div>
                
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="gap-2 bg-white/5 border-white/10 hover:bg-white/10 mt-2 lg:mt-0 shadow-lg">
                            <History className="w-4 h-4" />
                            查看历史
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64 glass border-white/10 max-h-96 overflow-y-auto custom-scrollbar p-2">
                        {history.map((h: any) => (
                            <DropdownMenuItem 
                                key={h.id} 
                                onClick={() => handleLoadHistory(h.id)}
                                className="cursor-pointer gap-2 py-3 rounded-lg hover:bg-white/10 mb-1"
                            >
                                <div className="flex flex-col gap-1 w-full text-left">
                                    <span className="font-semibold text-sm">报告 #{h.id}</span>
                                    <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
                                </div>
                            </DropdownMenuItem>
                        ))}
                        {history.length === 0 && (
                            <div className="p-4 text-center text-sm text-muted-foreground">暂无历史记录</div>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Main Action Area */}
            <div className="flex justify-start">
                <Button 
                    onClick={handleGenerate} 
                    disabled={isGenerating}
                    className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/20 border-0 h-10 px-5 text-sm font-medium"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            正在分析数据...
                        </>
                    ) : (
                        <>
                            <Presentation className="w-5 h-5" />
                            生成趋势报告
                        </>
                    )}
                </Button>
            </div>

            {/* Error State */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            {/* Report Container */}
            <Card className="min-h-[400px] border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/40 backdrop-blur-md shadow-2xl relative overflow-hidden">
                <div className="p-8">
                    {!report && !isGenerating && !error && (
                        <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground/60 gap-4">
                            <TrendingUp className="w-16 h-16 opacity-20" />
                            <p className="text-lg font-medium">点击生成以构建需求趋势报告。</p>
                        </div>
                    )}
                    
                    {isGenerating && (
                        <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground gap-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full"></div>
                                <Loader2 className="w-12 h-12 animate-spin text-purple-500 relative z-10" />
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <p className="text-lg font-medium text-foreground">正在分析历史采购数据</p>
                                <p className="text-sm">聚合历史订单 → 估计整体趋势 → 识别月度峰值 → 整理报告</p>
                            </div>
                        </div>
                    )}

                    {report && !isGenerating && (
                        <div className="flex flex-col gap-12 w-full pb-16">
                            {/* Render Dynamic UI Blocks */}
                            <div className="w-full flex justify-center mt-2">
                                <div className="w-full max-w-[850px]">
                                    {renderReportContent()}
                                </div>
                            </div>
                            
                            {chartData && chartData.length > 0 && (
                                <div className="mt-10 pt-10 border-t border-slate-200 dark:border-white/10 max-w-[800px] mx-auto w-full">
                                    <div className="flex flex-col mb-6 text-center md:text-left">
                                        <h3 className="text-xl font-bold bg-gradient-to-r from-purple-700 to-indigo-600 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent mb-2 tracking-tight">
                                            历史采购趋势
                                        </h3>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm">在下方选择项目以切换曲线并聚焦关键组件。</p>
                                    </div>
                                    
                                    {/* Interactive Legend / Filters */}
                                    <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-6 p-4 bg-white dark:bg-black/20 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
                                        {allChartKeys.map((key, index) => {
                                            const isSelected = selectedItems.includes(key);
                                            const color = colors[index % colors.length];
                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setSelectedItems(prev => prev.filter(i => i !== key));
                                                        } else {
                                                            setSelectedItems(prev => [...prev, key]);
                                                        }
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 border shadow-sm hover:scale-105 active:scale-95 ${isSelected ? '' : 'opacity-50 hover:opacity-80 bg-slate-50 dark:bg-transparent'}`}
                                                    style={{
                                                        backgroundColor: isSelected ? `${color}15` : undefined,
                                                        borderColor: isSelected ? color : 'currentColor',
                                                        color: isSelected ? color : '#64748b'
                                                    }}
                                                >
                                                    {key}
                                                </button>
                                            )
                                        })}
                                    </div>

                                    <div className="h-[320px] w-full bg-white dark:bg-gray-900/50 p-4 rounded-xl border border-slate-200 dark:border-white/5 shadow-md">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart
                                                data={chartData}
                                                margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
                                            >
                                                <CartesianGrid strokeDasharray="4 4" stroke="#ffffff10" />
                                                <XAxis dataKey="name" stroke="#6b7280" tick={{fill: '#9ca3af'}} axisLine={false} tickLine={false} dy={10} />
                                                <YAxis stroke="#6b7280" tick={{fill: '#9ca3af'}} axisLine={false} tickLine={false} dx={-10} />
                                                <Tooltip 
                                                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)', padding: '12px 16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}
                                                    itemStyle={{ color: '#e5e7eb', fontSize: '14px' }}
                                                    labelStyle={{ color: '#9ca3af', marginBottom: '8px', fontWeight: 'bold' }}
                                                />
                                                {allChartKeys
                                                    .filter(key => selectedItems.includes(key))
                                                    .map((key) => {
                                                        const index = allChartKeys.indexOf(key);
                                                        return (
                                                            <Line 
                                                                key={key}
                                                                type="monotone" 
                                                                dataKey={key} 
                                                                stroke={colors[index % colors.length]} 
                                                                strokeWidth={4}
                                                                dot={{ r: 5, strokeWidth: 2, fill: 'var(--background)', stroke: colors[index % colors.length] }}
                                                                activeDot={{ r: 8, strokeWidth: 0, fill: colors[index % colors.length] }}
                                                                animationDuration={1500}
                                                            />
                                                        );
                                                    })
                                                }
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};
