export interface EmailDisplayInfo {
    sender?: string | null;
    subject?: string | null;
}


export function formatEmailLabel(email: EmailDisplayInfo): string {
    const sender = email.sender?.trim() || "未知发件人";
    const subject = email.subject?.trim() || "无主题";
    return `「${sender} · ${subject}」`;
}
