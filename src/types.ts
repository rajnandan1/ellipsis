// Ellipsis Types

export type TextRankOptions = {
    damping: number;
    maxIterations: number;
    maxSentences: number;
};

export enum NodeFilter {
    SHOW_ALL = 4294967295,
    SHOW_ATTRIBUTE = 2,
    SHOW_COMMENT = 128,
    SHOW_ELEMENT = 1,
    SHOW_TEXT = 4,
}

export enum Node {
    ELEMENT_NODE = 1,
    ATTRIBUTE_NODE = 2,
    TEXT_NODE = 3,
}

export type TextNode = Node & {
    nodeType: number;
    textContent: string;
    innerText?: string;
    parentNode: Node | null;
};

export type HTMLElementDepth = HTMLElement & {
    depth: number;
};

export type DOM = Document | HTMLElement | Element;

export type EllipsisOptions = {
    assignUniqueIDs?: boolean;
    debug?: boolean;
    keepUnknownElements?: boolean;
    preserveAttribute?: string;
    skipMarkdownTranslation?: boolean;
    textRankOptions?: Partial<TextRankOptions>;
};

export type Snapshot = {
    meta: {
        estimatedTokens: number;
        originalSize: number;
        sizeRatio: number;
        snapshotSize: number;
    };
    serializedHtml: string;
};
