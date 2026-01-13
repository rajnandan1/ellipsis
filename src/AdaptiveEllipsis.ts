// -------------------------------------
// Ellipsis - Adaptive DOM Snapshot
// -------------------------------------

import { DOM, EllipsisOptions, Snapshot } from "./types";
import { resolveRoot } from "./util";
import { ellipsis } from "./Ellipsis.dom";

export async function adaptiveEllipsis(
    dom: DOM,
    maxTokens: number = 32768,
    maxIterations: number = 5,
    options: EllipsisOptions = {}
): Promise<
    Snapshot & {
        parameters: {
            k: number;
            l: number;
            m: number;
            adaptiveIterations: number;
        };
    }
> {
    const S = resolveRoot(dom).outerHTML.length;
    const M = 1e6;

    function* generateHalton() {
        const halton = (index: number, base: number) => {
            let result: number = 0;
            let f: number = 1 / base;
            let i: number = index;
            while (i > 0) {
                result += f * (i % base);
                i = Math.floor(i / base);
                f /= base;
            }
            return result;
        };

        let i = 0;
        while (true) {
            i++;

            yield [halton(i, 7), halton(i, 3), halton(i, 3)];
        }
    }

    let i = 0;
    let sCalc = S;
    let parameters: { k: number; l: number; m: number };
    let snapshot: Snapshot;
    const haltonGenerator = generateHalton();

    while (true) {
        const haltonPoint: number[] = haltonGenerator.next().value!;

        const computeParam = (haltonValue: number) =>
            Math.min((sCalc / M) * haltonValue, 1);

        parameters = {
            k: computeParam(haltonPoint[0]),
            l: computeParam(haltonPoint[1]),
            m: computeParam(haltonPoint[2]),
        };
        snapshot = await ellipsis(
            dom,
            parameters.k,
            parameters.l,
            parameters.m,
            options
        );
        sCalc = sCalc ** 1.125; // stretch

        if (snapshot.meta.estimatedTokens <= maxTokens) break;

        if (i++ === maxIterations)
            throw new RangeError(
                "Unable to create snapshot below given token threshold"
            );
    }

    return {
        ...snapshot,

        parameters: {
            ...parameters,

            adaptiveIterations: i,
        },
    };
}
