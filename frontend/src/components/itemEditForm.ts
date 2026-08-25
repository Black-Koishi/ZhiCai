export interface ItemEditFormValues {
    name: string;
    unit: string;
    unit_price: string;
    vendor_id: string;
    qty_on_hand: string;
    min_qty: string;
    max_capacity: string;
}
export interface ItemUpdatePayload {
    name: string;
    unit?: string;
    unit_price: number;
    vendor_id: number | null;
    qty_on_hand?: number;
    min_qty?: number;
    max_capacity?: number;
}

const inventoryFields = [
    ["qty_on_hand", "现有库存"],
    ["min_qty", "最小阈值"],
    ["max_capacity", "最大容量"],
] as const;

function parseOptionalInventoryInteger(value: string, label: string): number | undefined {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`${label}必须是大于等于 0 的整数`);
    }
    return parsed;
}

export function buildItemUpdatePayload(form: ItemEditFormValues): ItemUpdatePayload {
    const name = form.name.trim();
    if (!name) throw new Error("请填写物料名称");

    const payload: ItemUpdatePayload = {
        name,
        unit: form.unit.trim() || undefined,
        unit_price: Number(form.unit_price) || 0,
        vendor_id: form.vendor_id ? Number(form.vendor_id) : null,
    };

    for (const [field, label] of inventoryFields) {
        const value = parseOptionalInventoryInteger(form[field], label);
        if (value !== undefined) payload[field] = value;
    }

    return payload;
}
