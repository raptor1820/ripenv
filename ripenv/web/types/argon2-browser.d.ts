declare module "argon2-browser" {
    export enum ArgonType {
        Argon2d = 0,
        Argon2i = 1,
        Argon2id = 2,
    }

    export interface HashOptions {
        pass: string | Uint8Array;
        salt: string | Uint8Array;
        time?: number;
        mem?: number;
        hashLen?: number;
        parallelism?: number;
        type?: ArgonType;
        raw?: boolean;
        secret?: Uint8Array;
        ad?: Uint8Array;
    }

    export interface HashResult {
        hash: Uint8Array;
        hashHex: string;
        encoded: string;
    }

    export function hash(options: HashOptions): Promise<HashResult>;
    export function verify(options: {
        pass: string | Uint8Array;
        encoded: string | Uint8Array;
        type?: ArgonType;
        secret?: Uint8Array;
        ad?: Uint8Array;
    }): Promise<void>;
    export function unloadRuntime(): void;

    const argon2: {
        ArgonType: typeof ArgonType;
        hash: typeof hash;
        verify: typeof verify;
        unloadRuntime: typeof unloadRuntime;
    };

    export default argon2;
}

declare module "argon2-browser/dist/argon2-bundled.min.js" {
    import argon2 from "argon2-browser";
    export default argon2;
}
