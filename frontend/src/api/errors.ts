interface FastApiValidationIssue {
    type?: string;
    loc?: unknown[];
    msg?: string;
    ctx?: Record<string, unknown>;
}
const fieldLabels: Record<string, string> = {
    vendor_id: "默认供应商",
    qty_on_hand: "现有库存",
    min_qty: "最小阈值",
    max_capacity: "最大容量",
};

function formatValidationIssue(issue: FastApiValidationIssue): string | null {
    const rawField = issue.loc?.at(-1);
    const field = typeof rawField === "string" ? rawField : "";
    const label = fieldLabels[field] || field;

    let message = issue.msg || "输入内容不合法";
    if (issue.type === "int_type" || issue.type === "int_parsing") {
        message = "请输入整数";
    } else if (issue.type === "greater_than_equal") {
        const minimum = issue.ctx?.ge;
        message = minimum === undefined ? "输入值过小" : `不能小于 ${String(minimum)}`;
    }

    return label ? `${label}：${message}` : message;
}

export function getApiErrorMessage(payload: unknown, fallback: string): string {
    if (!payload || typeof payload !== "object") return fallback;

    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail;

    if (Array.isArray(detail)) {
        const messages = detail
            .filter((entry): entry is FastApiValidationIssue => Boolean(entry) && typeof entry === "object")
            .map(formatValidationIssue)
            .filter((message): message is string => Boolean(message));
        if (messages.length > 0) return messages.join("；");
    }

    return fallback;
}
