import assert from "node:assert/strict";
import test from "node:test";

import { formatEmailLabel } from "../src/components/emailDisplay.ts";


test("email labels show sender and subject instead of the internal id", () => {
    const label = formatEmailLabel({
        id: "internal-4242",
        sender: "采购部 <buyer@example.com>",
        subject: "8 月办公用品采购",
    });

    assert.equal(label, "「采购部 <buyer@example.com> · 8 月办公用品采购」");
    assert.equal(label.includes("internal-4242"), false);
});


test("email labels remain readable when sender or subject is empty", () => {
    assert.equal(
        formatEmailLabel({ sender: "", subject: "" }),
        "「未知发件人 · 无主题」",
    );
});
