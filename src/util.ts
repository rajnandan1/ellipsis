// Ellipsis Utility Functions
import type { EllipsisOptions, DOM } from "./types";

export function resolveDocument(dom: DOM): Document | null {
    let doc: Node | Document | null;
    try {
        doc = (window ?? ({} as Window)).document;
        if (doc) return doc as Document;
    } catch {
        /* ignore */
    }

    doc = dom;
    while (doc) {
        if (!!(doc as Document)["createTreeWalker"]) return doc as Document;
        doc = doc?.parentNode;
    }

    return null;
}

export function resolveRoot(dom: DOM): HTMLElement {
    return (dom as HTMLElement)["outerHTML"]
        ? (dom as HTMLElement)
        : (dom as Document)?.documentElement;
}

export async function traverseDom<T>(
    doc: Document,
    root: HTMLElement,
    filter: number = NodeFilter.SHOW_ALL,
    cb: (node: T) => void
): Promise<void> {
    const resolvedDoc = resolveDocument(doc);
    if (!resolvedDoc) return;

    const walker = resolvedDoc.createTreeWalker(root, filter);

    const nodes: T[] = [];
    let node = walker.firstChild() as T;
    while (node) {
        nodes.push(node);
        node = walker.nextNode() as T;
    }
    while (nodes.length) {
        await cb(nodes.shift()!);
    }
}

export function formatHtml(html: string, indentSize: number = 2): string {
    const tokens = html
        .replace(/>\s+</g, "><")
        .trim()
        .split(/(<[^>]+>)/)
        .filter((token) => token.trim().length);
    const indentChar = " ".repeat(indentSize);

    let indentLevel = 0;
    const formattedHtml: string[] = [];
    for (const token of tokens) {
        if (token.match(/^<\/\w/)) {
            indentLevel = Math.max(indentLevel - 1, 0);
            formattedHtml.push(indentChar.repeat(indentLevel) + token);
            continue;
        }
        if (token.match(/^<\w[^>]*[^\/]>$/)) {
            formattedHtml.push(indentChar.repeat(indentLevel) + token);
            indentLevel++;
            continue;
        }
        if (token.match(/^<[^>]+\/>$/)) {
            formattedHtml.push(indentChar.repeat(indentLevel) + token);
            continue;
        }
        if (token.match(/^<[^!]/)) {
            formattedHtml.push(indentChar.repeat(indentLevel) + token);
            continue;
        }
        formattedHtml.push(indentChar.repeat(indentLevel) + token.trim());
    }

    return formattedHtml.join("\n").trim();
}

export function validateParams(k: number, l: number, m: number): void {
    const validateParam = (param: number, allowInfinity: boolean = false) => {
        if (allowInfinity && param === Infinity) return;
        if (param < 0 || param > 1) {
            throw new RangeError(
                `Invalid parameter ${param}, expects value in [0, 1]`
            );
        }
    };

    validateParam(k, true);
    validateParam(l);
    validateParam(m);
}

export function getOptionsWithDefaults<O extends string | number | symbol = "">(
    options: Partial<EllipsisOptions>
): Omit<EllipsisOptions, O> {
    return {
        assignUniqueIDs: false,
        debug: false,
        keepUnknownElements: false,
        preserveAttribute: "data-preserve",
        skipMarkdownTranslation: false,
        textRankOptions: {},
        ...options,
    };
}
