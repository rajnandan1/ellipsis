// --------------------------
// Copyright (c) Dom Christie
// --------------------------

import TurndownService from "turndown";

// @ts-ignore - no types available
import * as turndownPluginGfm from "turndown-plugin-gfm";

const DEFAULT_KEEP_TAG_NAMES = ["a"] as const;

function createTurndownService(preserveAttribute?: string): TurndownService {
    const service = new TurndownService({
        headingStyle: "atx",
        bulletListMarker: "-",
        codeBlockStyle: "fenced",
    });

    service.addRule("keep", {
        // @ts-ignore - turndown types expect HTMLElementTagNameMap keys but accepts strings
        filter: DEFAULT_KEEP_TAG_NAMES,
        replacement: (_content: string, node: globalThis.Node) =>
            (node as HTMLElement).outerHTML,
    });

    // Preserve elements with the preserve attribute
    if (preserveAttribute) {
        service.addRule("preserveAttribute", {
            filter: (node: HTMLElement) => node.hasAttribute(preserveAttribute),
            replacement: (_content: string, node: globalThis.Node) =>
                (node as HTMLElement).outerHTML,
        });
    }

    service.use(turndownPluginGfm.gfm);

    return service;
}

// Default service for backward compatibility
const DEFAULT_SERVICE = createTurndownService();

export const KEEP_LINE_BREAK_MARK = "@@@";

export function turndown(markup: string, preserveAttribute?: string): string {
    const service = preserveAttribute
        ? createTurndownService(preserveAttribute)
        : DEFAULT_SERVICE;

    return service
        .turndown(markup)
        .trim()
        .replace(/\n|$/g, KEEP_LINE_BREAK_MARK);
}
