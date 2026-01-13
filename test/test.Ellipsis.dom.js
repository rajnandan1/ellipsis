import { join } from "path";
import { readFileSync, writeFileSync } from "fs";

import { dynamicizeDOM } from "./dynamicize-dom.js";

import { ellipsis, adaptiveEllipsis } from "../src/index.ts";

function path(fileName) {
    return join(import.meta.dirname, `${fileName}.html`);
}

function readFile(fileName) {
    return readFileSync(path(fileName)).toString();
}

async function readFileAsDOM(fileName) {
    return (await dynamicizeDOM(readFile(fileName))).body;
}

function readExpected(domName) {
    return readFile(`${domName}.expected`);
}

function writeActual(domName, html) {
    return writeFileSync(path(`${domName}.dom.actual`), html);
}

function flattenDOMSnapshot(snapshot) {
    return snapshot
        .trim()
        .replace(/\s*(\n|\r)+\s*/g, "")
        .replace(/\s{2,}/g, " ")
        .replace(/\s+(?=<)|(?=>)\s+/g, "");
}

await test("Take adaptive DOM snapshot (4096) [DOM]", async () => {
    const snapshot = await adaptiveEllipsis(
        await readFileAsDOM("agents"),
        4096,
        5,
        {
            debug: true,
            assignUniqueIDs: true,
        }
    );

    writeActual("agents.4096", snapshot.serializedHtml);

    assertLess(
        snapshot.serializedHtml.length / 4,
        4096,
        "Invalid adaptive DOM snapshot size (4096; max)"
    );
    assertMore(
        snapshot.serializedHtml.length,
        200,
        "Invalid adaptive DOM snapshot size (4096; min)"
    );

    assertIn(
        flattenDOMSnapshot('<a href="/about" data-uid="7">About</a>'),
        flattenDOMSnapshot(snapshot.serializedHtml),
        "Interactive element not preserved"
    );
});

await test("Take adaptive DOM snapshot (2048) [DOM]", async () => {
    const snapshot = await adaptiveEllipsis(
        await readFileAsDOM("agents"),
        2048,
        5,
        {
            debug: true,
        }
    );

    writeActual("agents.2048", snapshot.serializedHtml);

    assertLess(
        snapshot.serializedHtml.length / 4,
        2048,
        "Invalid adaptive DOM snapshot size (2048; max)"
    );
    assertMore(
        snapshot.serializedHtml.length,
        200,
        "Invalid adaptive DOM snapshot size (2048; min)"
    );
});

await test("Take DOM snapshot (L) [DOM]", async () => {
    const snapshot = await ellipsis(
        await readFileAsDOM("pizza"),
        0.3,
        0.3,
        0.3,
        {
            debug: true,
        }
    );

    writeActual("pizza.l", snapshot.serializedHtml);
    const expected = readExpected("pizza.l");

    assertAlmostEqual(
        snapshot.meta.originalSize,
        830,
        -1,
        "Invalid DOM snapshot original size"
    );

    assertAlmostEqual(
        snapshot.meta.sizeRatio,
        0.43,
        2,
        "Invalid DOM snapshot size ratio"
    );

    assertEqual(
        flattenDOMSnapshot(snapshot.serializedHtml),
        flattenDOMSnapshot(expected),
        "Invalid DOM snapshot"
    );
});

await test("Take DOM snapshot (M) [DOM]", async () => {
    const snapshot = await ellipsis(
        await readFileAsDOM("pizza"),
        0.4,
        0.6,
        0.8,
        {
            debug: true,
        }
    );

    writeActual("pizza.m", snapshot.serializedHtml);
    const expected = readExpected("pizza.m");

    assertAlmostEqual(
        snapshot.meta.sizeRatio,
        0.24,
        2,
        "Invalid DOM snapshot size ratio"
    );

    assertEqual(
        flattenDOMSnapshot(snapshot.serializedHtml),
        flattenDOMSnapshot(expected),
        "Invalid DOM snapshot"
    );
});

await test("Take DOM snapshot (S) [DOM]", async () => {
    const snapshot = await ellipsis(
        await readFileAsDOM("pizza"),
        1.0,
        1.0,
        1.0,
        {
            debug: true,
        }
    );

    writeActual("pizza.s", snapshot.serializedHtml);
    const expected = readExpected("pizza.s");

    assertAlmostEqual(
        snapshot.meta.sizeRatio,
        0.17,
        2,
        "Invalid DOM snapshot size ratio"
    );

    assertEqual(
        flattenDOMSnapshot(snapshot.serializedHtml),
        flattenDOMSnapshot(expected),
        "Invalid DOM snapshot"
    );
});

await test("Take DOM snapshot (linearized) [DOM]", async () => {
    const snapshot = await ellipsis(
        await readFileAsDOM("pizza"),
        Infinity,
        0,
        1.0,
        {
            debug: true,
        }
    );

    writeActual("pizza.lin", snapshot.serializedHtml);
    const expected = readExpected("pizza.lin");

    assertAlmostEqual(
        snapshot.meta.sizeRatio,
        0.3,
        2,
        "Invalid DOM snapshot size ratio"
    );

    assertEqual(
        flattenDOMSnapshot(snapshot.serializedHtml),
        flattenDOMSnapshot(expected),
        "Invalid DOM snapshot"
    );
});

await test("Take DOM snapshot (options.keepUnknownElements = false) [DOM]", async () => {
    const snapshot = await ellipsis(
        await readFileAsDOM("custom"),
        Infinity,
        0,
        1.0,
        {
            debug: true,
        }
    );

    writeActual("custom", snapshot.serializedHtml);
    const expected = readExpected("custom");

    assertEqual(
        flattenDOMSnapshot(snapshot.serializedHtml),
        flattenDOMSnapshot(expected),
        "Invalid DOM snapshot"
    );
});

await test("Take DOM snapshot (options.keepUnknownElements = true) [DOM]", async () => {
    const snapshot = await ellipsis(
        await readFileAsDOM("custom"),
        Infinity,
        0,
        1.0,
        {
            debug: true,
            keepUnknownElements: true,
        }
    );

    writeActual("custom.keep", snapshot.serializedHtml);
    const expected = readExpected("custom.keep");

    assertEqual(
        flattenDOMSnapshot(snapshot.serializedHtml),
        flattenDOMSnapshot(expected),
        "Invalid DOM snapshot"
    );
});

await test("Take DOM snapshot (data-preserve attribute) [DOM]", async () => {
    const snapshot = await ellipsis(
        await readFileAsDOM("preserve"),
        Infinity,
        0,
        0.5,
        {
            debug: true,
        }
    );

    writeActual("preserve", snapshot.serializedHtml);

    // Check that span with data-preserve is kept with its nested content
    assertIn(
        "data-preserve",
        snapshot.serializedHtml,
        "data-preserve attribute not preserved"
    );

    assertIn(
        '<span class="highlight"',
        snapshot.serializedHtml,
        "Span with data-preserve not preserved"
    );

    // Check that nested elements inside preserved span are kept
    assertIn(
        "<strong>",
        snapshot.serializedHtml,
        "Nested elements inside data-preserve not preserved"
    );

    assertIn(
        "nested bold",
        snapshot.serializedHtml,
        "Nested text inside data-preserve not preserved"
    );

    // Check that nested spans inside preserved div are kept
    assertIn(
        '<span class="price">',
        snapshot.serializedHtml,
        "Nested span inside data-preserve div not preserved"
    );

    // Check original text is preserved (not compressed by TextRank)
    assertIn(
        "$99.99",
        snapshot.serializedHtml,
        "Original text in preserved element should not be compressed"
    );
});

await test("Take DOM snapshot (custom preserveAttribute) [DOM]", async () => {
    const snapshot = await ellipsis(
        await readFileAsDOM("preserve-custom"),
        Infinity,
        0,
        0.5,
        {
            debug: true,
            preserveAttribute: "data-keep",
        }
    );

    writeActual("preserve-custom", snapshot.serializedHtml);

    // Check that element with custom preserve attribute is kept
    assertIn(
        "data-keep",
        snapshot.serializedHtml,
        "Custom preserve attribute not preserved"
    );

    assertIn(
        '<span class="important"',
        snapshot.serializedHtml,
        "Span with custom preserve attribute not preserved"
    );
});

await test("Take DOM snapshot (preserveAttribute disabled) [DOM]", async () => {
    const snapshot = await ellipsis(
        await readFileAsDOM("preserve"),
        Infinity,
        0,
        0.5,
        {
            debug: true,
            preserveAttribute: "",
        }
    );

    writeActual("preserve-disabled", snapshot.serializedHtml);

    // When preserve is disabled, data-preserve should be stripped (low semantic value)
    // and elements should be converted to markdown
    assertEqual(
        snapshot.serializedHtml.includes("<strong>"),
        false,
        "Strong should be converted to markdown when preserve is disabled"
    );
});

await test("data-preserve elements get data-uid when assignUniqueIDs=true [DOM]", async () => {
    const snapshot = await ellipsis(
        await readFileAsDOM("preserve"),
        Infinity,
        0,
        0.5,
        {
            debug: true,
            assignUniqueIDs: true,
        }
    );

    writeActual("preserve-with-uid", snapshot.serializedHtml);

    // Check that data-preserve elements also get data-uid
    assertIn(
        "data-preserve",
        snapshot.serializedHtml,
        "data-preserve attribute should be preserved"
    );

    // The span with data-preserve should have data-uid
    const hasPreservedSpanWithUid =
        snapshot.serializedHtml.includes('data-preserve="span bold"') &&
        snapshot.serializedHtml.match(
            /<span[^>]*data-preserve="span bold"[^>]*data-uid="/
        );

    assertEqual(
        !!hasPreservedSpanWithUid,
        true,
        "Span with data-preserve should have data-uid attribute"
    );

    // The div with data-preserve should also have data-uid
    const hasPreservedDivWithUid = snapshot.serializedHtml.match(
        /<div[^>]*data-preserve[^>]*data-uid="/
    );

    assertEqual(
        !!hasPreservedDivWithUid,
        true,
        "Div with data-preserve should have data-uid attribute"
    );
});
