// -------------------------------------
// Ellipsis - DOM Snapshot Library
// -------------------------------------

import {
    TextNode,
    HTMLElementDepth,
    DOM,
    EllipsisOptions,
    Snapshot,
    NodeFilter,
    Node,
} from "./types";
import {
    formatHtml,
    traverseDom,
    resolveDocument,
    resolveRoot,
    validateParams,
    getOptionsWithDefaults,
} from "./util";
import {
    getAttributeSemantics,
    getContainerSemantics,
    isElementType,
} from "./ground-truth";
import { relativeTextRank } from "./TextRank";
import { KEEP_LINE_BREAK_MARK, turndown } from "./Turndown";
import { uniqueIDAttribute } from "./config";

const FILTER_TAG_NAMES = ["SCRIPT", "STYLE", "LINK"];

export async function ellipsis(
    dom: DOM,
    k: number,
    l: number,
    m: number,
    options: EllipsisOptions = {}
): Promise<Snapshot> {
    validateParams(k, l, m);

    const optionsWithDefaults = getOptionsWithDefaults(options);
    const preserveAttr =
        optionsWithDefaults.preserveAttribute ?? "data-preserve";

    function hasPreserveAttribute(element: HTMLElement): boolean {
        return element.hasAttribute(preserveAttr);
    }

    function isInPreservedTree(element: HTMLElement): boolean {
        let current: HTMLElement | null = element;
        while (current) {
            if (hasPreserveAttribute(current)) return true;
            current = current.parentElement;
        }
        return false;
    }

    function snapElementNode(elementNode: HTMLElement) {
        // Skip if element or ancestor has preserve attribute
        if (isInPreservedTree(elementNode)) return;

        if (isElementType("container", elementNode.tagName)) return;

        if (isElementType("content", elementNode.tagName)) {
            return snapElementContentNode(elementNode);
        }
        if (isElementType("interactive", elementNode.tagName)) {
            snapElementInteractiveNode(elementNode);

            return;
        }

        if (optionsWithDefaults.keepUnknownElements) return;

        elementNode.parentNode?.removeChild(elementNode);
    }

    function snapElementContainerNode(
        elementNode: HTMLElementDepth,
        k: number,
        domTreeHeight: number
    ) {
        if (elementNode.nodeType !== Node.ELEMENT_NODE) return;
        if (!isElementType("container", elementNode.tagName)) return;

        // Don't merge containers that have data-preserve attribute
        if (hasPreserveAttribute(elementNode as HTMLElement)) return;

        if (
            !elementNode.parentElement ||
            !isElementType("container", elementNode.parentElement.tagName)
        )
            return;

        // merge
        const mergeLevels: number = Math.max(
            Math.round(domTreeHeight * Math.min(1, k)),
            1
        );
        if ((elementNode.depth - 1) % mergeLevels === 0) return;

        const elements = [
            elementNode.parentElement as HTMLElementDepth,
            elementNode,
        ];

        const mergeUpwards =
            getContainerSemantics(elements[0].tagName) >=
            getContainerSemantics(elements[1].tagName);
        !mergeUpwards && elements.reverse();

        const targetEl = elements[0];
        const sourceEl = elements[1];

        const mergedAttributes = Array.from(targetEl.attributes);
        for (const attr of sourceEl.attributes) {
            if (
                mergedAttributes.some(
                    (targetAttr) => targetAttr.name === attr.name
                )
            )
                continue;
            mergedAttributes.push(attr);
        }
        for (const attr of targetEl.attributes) {
            targetEl.removeAttribute(attr.name);
        }
        for (const attr of mergedAttributes) {
            targetEl.setAttribute(attr.name, attr.value);
        }

        if (mergeUpwards) {
            while (sourceEl.childNodes.length) {
                targetEl.insertBefore(sourceEl.childNodes[0], sourceEl);
            }
        } else {
            let afterPivot = false;
            while (sourceEl.childNodes.length > 1) {
                const childNode = sourceEl.childNodes[+afterPivot];

                if (childNode === targetEl) {
                    afterPivot = true;

                    continue;
                }

                afterPivot || !targetEl.childNodes.length
                    ? targetEl.appendChild(childNode)
                    : targetEl.insertBefore(childNode, targetEl.childNodes[0]);
            }

            targetEl.depth = sourceEl.depth!;

            sourceEl.parentNode?.insertBefore(targetEl, sourceEl);
        }

        sourceEl.parentNode?.removeChild(sourceEl);
    }

    function snapElementContentNode(elementNode: HTMLElement) {
        if (elementNode.nodeType !== Node.ELEMENT_NODE) return;
        if (!isElementType("content", elementNode.tagName)) return;
        if (optionsWithDefaults.skipMarkdownTranslation) return;

        // Check if element or ancestor has preserve attribute
        if (isInPreservedTree(elementNode)) return;

        // markdown (pass preserveAttribute to preserve nested elements)
        const markdown = turndown(elementNode.outerHTML, preserveAttr);
        const markdownNodesFragment = resolveDocument(dom)!
            .createRange()
            .createContextualFragment(markdown);

        elementNode.replaceWith(...markdownNodesFragment.childNodes);
    }

    function snapElementInteractiveNode(elementNode: HTMLElement) {
        if (elementNode.nodeType !== Node.ELEMENT_NODE) return;
        if (!isElementType("interactive", elementNode.tagName)) return;

        // pass
    }

    function snapTextNode(textNode: TextNode, l: number) {
        if (textNode.nodeType !== Node.TEXT_NODE) return;

        // Skip text compression for preserved elements
        const parentElement = (textNode as unknown as globalThis.Node)
            .parentNode as HTMLElement;
        if (
            parentElement &&
            parentElement.nodeType === Node.ELEMENT_NODE &&
            isInPreservedTree(parentElement)
        )
            return;

        const text: string = textNode?.innerText ?? textNode.textContent;

        textNode.textContent = relativeTextRank(
            text,
            1 - l,
            optionsWithDefaults.textRankOptions,
            true
        );
    }

    function snapAttributeNode(elementNode: HTMLElement, m: number) {
        if (elementNode.nodeType !== Node.ELEMENT_NODE) return;

        // Skip attribute filtering for preserved elements
        if (isInPreservedTree(elementNode)) return;

        for (const attr of Array.from(elementNode.attributes)) {
            // Never remove the preserve attribute itself
            if (attr.name === preserveAttr) continue;
            if (getAttributeSemantics(attr.name) >= m) continue;

            elementNode.removeAttribute(attr.name);
        }
    }

    const document = resolveDocument(dom);
    if (!document)
        throw new ReferenceError(
            "Could not resolve a valid document object from DOM"
        );

    const rootElement: HTMLElement = resolveRoot(dom);
    const originalSize = rootElement.outerHTML.length;

    let n = 0;
    optionsWithDefaults.assignUniqueIDs &&
        (await traverseDom<Element>(
            document,
            rootElement,
            NodeFilter.SHOW_ELEMENT,
            (elementNode) => {
                const isContainer = isElementType(
                    "container",
                    elementNode.tagName
                );
                const isInteractive = isElementType(
                    "interactive",
                    elementNode.tagName
                );
                const hasPreserve = (elementNode as HTMLElement).hasAttribute(
                    preserveAttr
                );

                // Assign UIDs to container, interactive, and preserved elements
                if (!isContainer && !isInteractive && !hasPreserve) return;

                elementNode.setAttribute(uniqueIDAttribute, (n++).toString());
            }
        ));

    const virtualDom = rootElement.cloneNode(true) as HTMLElement;

    // Prepare
    await traverseDom<Comment>(
        document,
        virtualDom,
        NodeFilter.SHOW_COMMENT,
        (node) => node.parentNode?.removeChild(node)
    );
    await traverseDom<Element>(
        document,
        virtualDom,
        NodeFilter.SHOW_ELEMENT,
        (elementNode) => {
            if (!FILTER_TAG_NAMES.includes(elementNode.tagName.toUpperCase()))
                return;

            elementNode.parentNode?.removeChild(elementNode);
        }
    );

    let domTreeHeight: number = 0;
    await traverseDom<Element>(
        document,
        virtualDom,
        NodeFilter.SHOW_ELEMENT,
        (elementNode) => {
            const depth: number =
                ((elementNode.parentNode as HTMLElementDepth).depth ?? 0) + 1;

            (elementNode as HTMLElementDepth).depth = depth;

            domTreeHeight = Math.max(depth, domTreeHeight);
        }
    );

    // Ellipsis implementation harnessing the power of the TreeWalkers API:

    // Text nodes first
    await traverseDom<TextNode>(
        document,
        virtualDom,
        NodeFilter.SHOW_TEXT,
        (node: TextNode) => snapTextNode(node, l)
    );

    // Non-container element nodes
    await traverseDom<HTMLElement>(
        document,
        virtualDom,
        NodeFilter.SHOW_ELEMENT,
        (node: HTMLElement) => snapElementNode(node)
    );

    // Container element nodes
    await traverseDom<HTMLElementDepth>(
        document,
        virtualDom,
        NodeFilter.SHOW_ELEMENT,
        (node: HTMLElementDepth) => {
            if (!isElementType("container", node.tagName)) return;

            return snapElementContainerNode(node, k, domTreeHeight);
        }
    );

    // Attribute nodes
    await traverseDom<HTMLElement>(
        document,
        virtualDom,
        NodeFilter.SHOW_ELEMENT,
        (node: HTMLElement) => snapAttributeNode(node, m) // work on parent element
    );

    const snapshot = virtualDom.innerHTML;
    let serializedHtml = optionsWithDefaults.debug
        ? formatHtml(snapshot)
        : snapshot;
    serializedHtml = serializedHtml
        .replace(new RegExp(KEEP_LINE_BREAK_MARK, "g"), "\n")
        .replace(/\n *(\n|$)/g, "");
    serializedHtml =
        k === Infinity && virtualDom.children.length
            ? serializedHtml
                  .trim()
                  .replace(/^<[^>]+>\s*/, "")
                  .replace(/\s*<\/[^<]+>$/, "")
            : serializedHtml;

    return {
        serializedHtml,
        meta: {
            originalSize,
            snapshotSize: snapshot.length,
            sizeRatio: snapshot.length / originalSize,
            estimatedTokens: Math.round(snapshot.length / 4), // according to https://platform.openai.com/tokenizer
        },
    };
}
