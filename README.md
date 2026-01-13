# Ellipsis

<video src="https://github.com/user-attachments/assets/cdfe026b-db3c-47d7-875f-a0aa3a1933a4" autoplay loop muted playsinline></video>

A TypeScript library for DOM to Snapshot conversion - compress HTML documents for efficient processing by LLMs.

Based on the [Beyond Pixels: Exploring DOM Downsampling for LLM-Based Web Agents](https://arxiv.org/abs/2508.04412).

## Installation

```bash
npm install @rajnandan1/ellipsis
```

## Quick Start

```typescript
import { ellipsis, adaptiveEllipsis } from "@rajnandan1/ellipsis";

// Method 1: Manual control with k, l, m parameters
const snapshot = await ellipsis(document.body, 0.1, 0.3, 0.5);

// Method 2: Automatic compression to fit token budget
const adaptive = await adaptiveEllipsis(document.body, 4096);
```

## Understanding the Parameters

The three parameters $k$, $l$, $m$ (each ∈ [0, 1]) control how much to downsample three different aspects of the DOM:

### $k$ — Hierarchy/Container Downsampling

**Controls**: How many levels of nested container elements (like `<div>`, `<section>`, `<main>`) to merge together.

**How it works**: If a DOM has height 10, and $k = 0.5$, it merges containers to reduce the tree to roughly 5 levels deep.

| Value          | Effect                       |
| -------------- | ---------------------------- |
| Low (0.1-0.3)  | Preserve more structure      |
| High (0.7-1.0) | Flatten more aggressively    |
| `Infinity`     | Remove root wrapper entirely |

**Significance**: Hierarchy is the **most important feature**. Low $k$ values (0.1-0.3) that preserve structure achieve the best performance because nesting conveys semantic relationships—which buttons belong to which sections, what content is grouped together, etc.

### $l$ — Text Downsampling

**Controls**: What fraction of sentences to remove from text nodes.

**How it works**: Uses the TextRank algorithm to rank sentences by relevance, then eliminates the lowest-ranking fraction.

| Value | Effect                              |
| ----- | ----------------------------------- |
| 0     | Keep all text                       |
| 0.5   | Remove 50% least relevant sentences |
| 1.0   | Maximum text compression            |

**Significance**: Text content matters for understanding what actions to take, but moderate text reduction is acceptable. The algorithm keeps the most informative sentences while reducing token count.

### $m$ — Attribute Downsampling

**Controls**: Threshold for filtering HTML attributes based on their semantic importance.

**How it works**: Attributes are rated by a ground truth scoring system (e.g., `href` = 0.9, `disabled` = 0.5, `style` = 0.1). Only attributes scoring above $m$ are kept.

| Value          | Effect                         |
| -------------- | ------------------------------ |
| Low (0.1-0.3)  | Keep most attributes           |
| High (0.7-1.0) | Keep only essential attributes |

**Significance**: Attributes provide important metadata (like `type="button"`, `disabled`, `required`) that help agents understand element functionality, but many attributes are irrelevant for task completion.

## Recommended Configurations

Based on research findings, these configurations achieve optimal performance:

| Configuration          | k   | l   | m   | Use Case                                     |
| ---------------------- | --- | --- | --- | -------------------------------------------- |
| **Preserve Structure** | 0.1 | 0   | 0   | Best for complex UIs, forms                  |
| **Balanced**           | 0.3 | 0.3 | 0.5 | Good general-purpose compression             |
| **Aggressive**         | 0.6 | 0.9 | 0.3 | Maximum compression with hierarchy preserved |
| **Linearized**         | ∞   | 0   | 1.0 | Flat output, minimal attributes              |

**Key insight**: Hierarchy ($k$) has the strongest effect on agent performance, while text and attributes can be more aggressively downsampled without as much performance loss.

## Methods

### `ellipsis(dom, k, l, m, options?)`

Manual compression with explicit control over parameters.

```typescript
import { ellipsis } from "@rajnandan1/ellipsis";

const snapshot = await ellipsis(
    document.body, // DOM element to compress
    0.1, // k: hierarchy (low = preserve structure)
    0.3, // l: text compression
    0.5, // m: attribute threshold
    {
        debug: true, // Format output for readability
        assignUniqueIDs: true, // Add data-uid to elements
    }
);

console.log(snapshot.serializedHtml);
console.log(snapshot.meta);
// { originalSize: 15000, snapshotSize: 3000, sizeRatio: 0.2, estimatedTokens: 750 }
```

### `adaptiveEllipsis(dom, maxTokens?, maxIterations?, options?)`

Automatic compression that finds optimal parameters to fit within a token budget.

```typescript
import { adaptiveEllipsis } from "@rajnandan1/ellipsis";

const snapshot = await adaptiveEllipsis(
    document.body,
    4096, // Target max tokens
    5, // Max iterations to find parameters
    { debug: true }
);

console.log(snapshot.serializedHtml);
console.log(snapshot.parameters);
// { k: 0.142, l: 0.333, m: 0.333, adaptiveIterations: 2 }
```

**How it works**: Uses a Halton sequence to explore the parameter space, progressively increasing compression until the output fits within the token budget.

## API Reference

### Options

```typescript
type EllipsisOptions = {
    assignUniqueIDs?: boolean; // Add data-uid attributes to elements
    debug?: boolean; // Pretty-print output HTML
    keepUnknownElements?: boolean; // Keep elements not in ground truth
    preserveAttribute?: string; // Attribute to mark preserved elements (default: "data-preserve")
    skipMarkdownTranslation?: boolean; // Skip converting content to markdown
    textRankOptions?: {
        damping?: number; // TextRank damping factor (default: 0.75)
        maxIterations?: number; // TextRank iterations (default: 20)
        maxSentences?: number; // Max sentences to process
    };
};
```

### Return Type

```typescript
type Snapshot = {
    serializedHtml: string;
    meta: {
        originalSize: number; // Original HTML character count
        snapshotSize: number; // Compressed HTML character count
        sizeRatio: number; // snapshotSize / originalSize
        estimatedTokens: number; // Approximate LLM tokens (~chars/4)
    };
};

// adaptiveEllipsis additionally returns:
type AdaptiveSnapshot = Snapshot & {
    parameters: {
        k: number;
        l: number;
        m: number;
        adaptiveIterations: number;
    };
};
```

### Types Export

```typescript
import type {
    DOM,
    EllipsisOptions,
    Snapshot,
    TextRankOptions,
} from "@rajnandan1/ellipsis";
```

## Preserving Elements

To prevent specific elements from being compressed, add the preserve attribute:

```html
<div data-preserve="this is important">
    <span class="price">$99.99</span>
    <strong>Important text</strong>
    <!-- All nested content is preserved as-is -->
</div>
```

Custom preserve attribute:

```typescript
const snapshot = await ellipsis(dom, 0.5, 0.5, 0.5, {
    preserveAttribute: "data-keep",
});
```

```html
<span data-keep class="critical">This stays intact</span>
```

## Playground

Test the library interactively:

```bash
npm run playground
```

Opens a browser-based tool to experiment with different parameters and see compression results in real-time.

## Browser Usage (IIFE)

```html
<script src="https://unpkg.com/@rajnandan1/ellipsis@latest/dist/index.global.js"></script>
<script>
    const { ellipsis, adaptiveEllipsis } = Ellipsis;

    ellipsis(document.body, 0.3, 0.3, 0.5).then((snapshot) => {
        console.log(snapshot.serializedHtml);
    });
</script>
```

## References

-   [Beyond Pixels: Exploring DOM Downsampling for LLM-Based Web Agents](https://arxiv.org/abs/2508.04412)

## License

MIT
