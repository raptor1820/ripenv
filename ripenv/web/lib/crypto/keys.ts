import nacl from "tweetnacl";
import { loadArgon2 } from "./argon2";

export interface KeyfileJSON {
    publicKey: string;
    encPrivateKey: string;
    salt: string;
    kdf: "argon2id";
}

export function generateKeypair(): {
    publicKeyBase64: string;
    privateKeyBytes: Uint8Array;
} {
    const pair = nacl.box.keyPair();
    return {
        publicKeyBase64: toBase64(pair.publicKey),
        privateKeyBytes: pair.secretKey,
    };
}

export async function deriveKEK(
    password: string,
    salt: Uint8Array
): Promise<Uint8Array> {
    const argon2 = await loadArgon2();
    const { hash } = await argon2.hash({
        pass: password,
        salt,
        time: 2,
        mem: 65536,
        hashLen: 32,
        parallelism: 1,
        type: argon2.ArgonType.Argon2id,
        raw: true,
    });
    return new Uint8Array(hash);
}

export function encryptPrivateKey(
    kek: Uint8Array,
    privateKey: Uint8Array
): string {
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const box = nacl.secretbox(privateKey, nonce, kek);
    const payload = new Uint8Array(nonce.length + box.length);
    payload.set(nonce, 0);
    payload.set(box, nonce.length);
    return toBase64(payload);
}

export function buildKeyfile(
    publicKeyBase64: string,
    encPrivateKeyBase64: string,
    saltBase64: string
): KeyfileJSON {
    return {
        publicKey: publicKeyBase64,
        encPrivateKey: encPrivateKeyBase64,
        salt: saltBase64,
        kdf: "argon2id",
    };
}

export function downloadJSON(data: unknown, filename: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function toBase64(buffer: Uint8Array): string {
    return btoa(String.fromCharCode(...buffer));
}

export function fromBase64(encoded: string): Uint8Array {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

export function randomSalt(): Uint8Array {
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);
    return salt;
}
