export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface ChatRequest {
    message: string;
    agent_email_enabled: boolean;
    agent_compliance_enabled: boolean;
    agent_pdf_enabled: boolean;
    agent_forecast_enabled: boolean;
}

interface ChatResponse {
    response_text: string;
    steps: string[];
    ui_actions?: { action_type: string; params: any }[];
}

export interface EmailItem {
    id: string;
    subject: string;
    sender: string;
    date: string;
    body: string;
    folder: string;
    has_analysis?: boolean;
    priority?: string;
    analysis_status?: string;
    analysis_error?: string;
    attachments?: { filename: string; storage_key: string | null; content_type: string; size: number }[];
}

export interface SendEmailRequest {
    to_email: string;
    subject: string;
    body: string;
}

export async function sendMessage(data: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
}

export async function fetchEmails(folder: string): Promise<EmailItem[]> {
    const response = await fetch(`${API_BASE_URL}/emails/${folder}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch emails: ${response.statusText}`);
    }
    return response.json();
}

export async function sendEmail(data: SendEmailRequest): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/emails/send`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        throw new Error(`Failed to send email: ${response.statusText}`);
    }
}

export async function syncEmails(folder: string): Promise<{ count: number; message: string }> {
    const response = await fetch(`${API_BASE_URL}/emails/sync?folder=${folder}`, {
        method: "POST",
    });
    if (!response.ok) {
        throw new Error(`Failed to sync emails: ${response.statusText}`);
    }
    return response.json();
}

// --- Database Functionality ---

export async function getTables(): Promise<{ tables: string[] }> {
    const response = await fetch(`${API_BASE_URL}/database/tables`);
    if (!response.ok) {
        throw new Error(`Failed to fetch tables: ${response.statusText}`);
    }
    return response.json();
}

export async function getTableData(tableName: string): Promise<{ data: any[] }> {
    const response = await fetch(`${API_BASE_URL}/database/tables/${tableName}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch table data for ${tableName}: ${response.statusText}`);
    }
    return response.json();
}

export async function updateTableRow(tableName: string, originalRow: any, updatedRow: any): Promise<{ status: string }> {
    const response = await fetch(`${API_BASE_URL}/database/tables/${tableName}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            original_row: originalRow,
            updated_row: updatedRow
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to update row: ${response.statusText}`);
    }
    return response.json();
}

export async function deleteTableData(tableName: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/database/tables/${tableName}`, {
        method: "DELETE",
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to delete table data: ${response.statusText}`);
    }
    return response.json();
}

// --- Email Analysis API ---

export async function analyzeEmail(emailId: string): Promise<{ status: string, data: any, step?: string }> {
    const response = await fetch(`${API_BASE_URL}/emails/${emailId}/analyze`, {
        method: "POST",
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to analyze email: ${response.statusText}`);
    }
    return response.json();
}

export async function runCompliance(emailId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/procurement/${emailId}/compliance`, {
        method: "POST",
    });
    if (!response.ok) {
        throw new Error(`Failed to check compliance: ${response.statusText}`);
    }
    return response.json();
}

export async function ignoreEmail(emailId: string, reason?: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/emails/${emailId}/ignore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || "" }),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "忽略邮件失败");
    }
    return response.json();
}

export async function generateOrder(emailId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/procurement/${emailId}/order`, {
        method: "POST",
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to generate order: ${response.statusText}`);
    }
    return response.json();
}

export async function analyzeAllEmails(): Promise<{ status: string, processed_count: number, results: any[] }> {
    const response = await fetch(`${API_BASE_URL}/emails/analyze_all`, {
        method: "POST",
    });
    if (!response.ok) {
        throw new Error(`Failed to analyze all emails: ${response.statusText}`);
    }
    return response.json();
}

export const fetchUnanalyzedCount = async (): Promise<number> => {
    const res = await fetch(`${API_BASE_URL}/emails/unanalyzed-count`);
    if (!res.ok) throw new Error("获取未分析数量失败");
    const data = await res.json();
    return data.count || 0;
};

export const generateForecast = async (): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/forecast/generate`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to generate forecast');
    return res.json();
};

export const fetchForecastStatus = async (): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/forecast/status`);
    if (!res.ok) throw new Error('Failed to fetch forecast status');
    return res.json();
};

export const fetchLatestForecast = async (): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/forecast/latest`);
    if (!res.ok) throw new Error('Failed to fetch latest forecast');
    return res.json();
};

export const fetchForecastHistory = async (): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/forecast/history`);
    if (!res.ok) throw new Error('Failed to fetch forecast history');
    return res.json();
};

export const fetchForecastById = async (id: number): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/forecast/${id}`);
    if (!res.ok) throw new Error('Failed to fetch forecast by id');
    return res.json();
};

export async function getEmailAnalysis(emailId: string): Promise<{ status: string, data?: any }> {
    const response = await fetch(`${API_BASE_URL}/emails/${emailId}/analysis`);
    if (!response.ok) {
        if (response.status === 404) return { status: "not_found" };
        throw new Error(`Failed to fetch email analysis: ${response.statusText}`);
    }
    return response.json();
}

// --- Orders API ---

export async function fetchOrders(): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/orders`);
    if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.statusText}`);
    }
    const data = await response.json();
    return data.orders || [];
}

export interface PaginatedOrdersResponse {
    status: string;
    orders: any[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
}

export async function fetchOrdersPaginated(
    page: number = 1,
    perPage: number = 20,
    search?: string,
    filters?: {
        status?: string;
        min_amount?: number;
        max_amount?: number;
        date_from?: string;
        date_to?: string;
    },
): Promise<PaginatedOrdersResponse> {
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (search) params.set("search", search);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.min_amount != null) params.set("min_amount", String(filters.min_amount));
    if (filters?.max_amount != null) params.set("max_amount", String(filters.max_amount));
    if (filters?.date_from) params.set("date_from", filters.date_from);
    if (filters?.date_to) params.set("date_to", filters.date_to);

    const response = await fetch(`${API_BASE_URL}/orders/list?${params}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.statusText}`);
    }
    return response.json();
}

export interface OrdersSummary {
    total_count: number;
    total_volume: number;
}

export async function fetchOrdersSummary(): Promise<OrdersSummary> {
    const response = await fetch(`${API_BASE_URL}/orders/summary`);
    if (!response.ok) {
        throw new Error(`Failed to fetch orders summary: ${response.statusText}`);
    }
    const data = await response.json();
    return data as OrdersSummary;
}

// --- Suppliers API ---

export interface Supplier {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    category: string | null;
    approved: number;
    ext_score: number;
}

export interface PaginatedSuppliers {
    status: string;
    suppliers: Supplier[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
}

export async function fetchSuppliersPaginated(
    page: number = 1,
    perPage: number = 20,
    search?: string,
    minScore?: number,
    maxScore?: number,
): Promise<PaginatedSuppliers> {
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (search) params.set("search", search);
    if (minScore != null) params.set("min_score", String(minScore));
    if (maxScore != null) params.set("max_score", String(maxScore));
    const response = await fetch(`${API_BASE_URL}/suppliers?${params}`);
    if (!response.ok) throw new Error(`加载供应商失败: ${response.statusText}`);
    return response.json();
}

export async function onboardSupplier(text: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/suppliers/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "供应商入驻失败");
    }
    return response.json();
}

export async function createSupplier(data: {
    name: string; email?: string; phone?: string; category?: string; description?: string;
}): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/suppliers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "新增供应商失败");
    }
    return response.json();
}

export async function updateSupplier(id: number, data: {
    name: string; email?: string; phone?: string; category?: string;
}): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/suppliers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "更新供应商失败");
    }
    return response.json();
}

export async function rescoreSupplier(id: number, description: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/suppliers/${id}/rescore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "重新评分失败");
    }
    return response.json();
}

export async function deleteSupplier(id: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/suppliers/${id}`, { method: "DELETE" });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "删除供应商失败");
    }
    return response.json();
}

// --- Items API ---

export interface PaginatedItems {
    status: string;
    items: any[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
}

export async function fetchItemsPaginated(
    page: number = 1,
    perPage: number = 20,
    search?: string,
    stockStatus?: string,
): Promise<PaginatedItems> {
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (search) params.set("search", search);
    if (stockStatus) params.set("stock_status", stockStatus);
    const response = await fetch(`${API_BASE_URL}/items?${params}`);
    if (!response.ok) throw new Error(`加载物料失败: ${response.statusText}`);
    return response.json();
}

export async function onboardItem(text: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/items/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "物料建档失败");
    }
    return response.json();
}

export async function createItem(data: {
    name: string; sku?: string; unit?: string; unit_price?: number; vendor_id?: number;
}): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "新增物料失败");
    }
    return response.json();
}

export async function updateItem(id: number, data: {
    name: string; unit?: string; unit_price?: number; vendor_id?: number | null;
    qty_on_hand?: number | null; min_qty?: number | null; max_capacity?: number | null;
}): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "更新物料失败");
    }
    return response.json();
}

export async function deleteItem(id: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/items/${id}`, { method: "DELETE" });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "删除物料失败");
    }
    return response.json();
}

// --- Order delete & lifecycle ---

export async function deleteOrder(id: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/orders/${id}`, { method: "DELETE" });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "删除订单失败");
    }
    return response.json();
}

export async function sendOrder(id: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/orders/${id}/send`, { method: "POST" });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "发送邮件失败");
    }
    return response.json();
}

export async function receiveOrder(id: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/orders/${id}/receive`, { method: "POST" });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "确认收货失败");
    }
    return response.json();
}

export async function cancelOrder(id: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/orders/${id}/cancel`, { method: "POST" });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "取消订单失败");
    }
    return response.json();
}
