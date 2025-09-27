import type argon2Module from "argon2-browser";

export type Argon2 = typeof argon2Module;

let loaderPromise: Promise<Argon2> | null = null;

async function importArgon2(): Promise<Argon2> {
    if (typeof window === "undefined") {
        throw new Error("argon2 can only be loaded in the browser runtime");
    }

    if (!loaderPromise) {
        loaderPromise = import(
            "argon2-browser/dist/argon2-bundled.min.js"
        ).then((mod) => mod.default);
    }

    return loaderPromise;
}

export async function loadArgon2(): Promise<Argon2> {
    return importArgon2();
}
