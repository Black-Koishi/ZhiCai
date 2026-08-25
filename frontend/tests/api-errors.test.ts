import assert from "node:assert/strict";
import test from "node:test";

import { getApiErrorMessage } from "../src/api/errors.ts";


test("FastAPI validation detail arrays are rendered as readable messages", () => {
    const message = getApiErrorMessage(
        {
            detail: [
                {
                    type: "int_type",
                    loc: ["body", "qty_on_hand"],
                    msg: "Input should be a valid integer",
                },
                {
                    type: "greater_than_equal",
                    loc: ["body", "min_qty"],
                    msg: "Input should be greater than or equal to 0",
                    ctx: { ge: 0 },
                },
            ],
        },
        "更新物料失败",
    );

    assert.equal(message, "现有库存：请输入整数；最小阈值：不能小于 0");
    assert.equal(message.includes("[object Object]"), false);
});

test("plain backend messages and fallback messages are preserved", () => {
    assert.equal(getApiErrorMessage({ detail: "物料未找到" }, "更新失败"), "物料未找到");
    assert.equal(getApiErrorMessage({}, "更新失败"), "更新失败");
});
