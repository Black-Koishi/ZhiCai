import assert from "node:assert/strict";
import test from "node:test";

import { buildItemUpdatePayload } from "../src/components/itemEditForm.ts";


const baseForm = {
    name: "测试物料",
    unit: "件",
    unit_price: "10.5",
    vendor_id: "",
    qty_on_hand: "",
    min_qty: "",
    max_capacity: "",
};


test("empty inventory inputs are omitted so existing empty values stay unchanged", () => {
    const payload = buildItemUpdatePayload(baseForm);

    assert.equal("qty_on_hand" in payload, false);
    assert.equal("min_qty" in payload, false);
    assert.equal("max_capacity" in payload, false);
});

test("filled inventory inputs are sent as integers", () => {
    const payload = buildItemUpdatePayload({
        ...baseForm,
        qty_on_hand: "12",
        min_qty: "3",
        max_capacity: "100",
    });

    assert.equal(payload.qty_on_hand, 12);
    assert.equal(payload.min_qty, 3);
    assert.equal(payload.max_capacity, 100);
});


test("invalid inventory inputs produce a clear Chinese message", () => {
    assert.throws(
        () => buildItemUpdatePayload({ ...baseForm, min_qty: "-1" }),
        /最小阈值必须是大于等于 0 的整数/,
    );
    assert.throws(
        () => buildItemUpdatePayload({ ...baseForm, max_capacity: "1.5" }),
        /最大容量必须是大于等于 0 的整数/,
    );
});
