// WebAuthn / FIDO2 admin authentication.
//
// Replaces (or supplements) TOTP 2FA on /admin/login with a hardware-key
// challenge-response. The user touches their YubiKey / Touch-ID / Windows
// Hello device; the browser does the cryptographic dance with the server.
// No shared secret to lose, phishing-resistant by virtue of origin binding.
//
// Storage: per-player list of registered credentials at
//   data/admin-passkeys.json
// Each credential entry stores the credential id, public key (base64),
// signature counter (replay-protection), declared transports, and a
// human-readable label set by the admin at registration time. There is
// no secret material here — the corresponding private key never leaves
// the YubiKey.
//
// Registration flow:
//   1. client → POST /admin/webauthn/register/begin → server returns
//      PublicKeyCredentialCreationOptions
//   2. client calls navigator.credentials.create(options) — user
//      touches YubiKey
//   3. client → POST /admin/webauthn/register/finish with the
//      attestation response — server verifies, stores credential
//
// Authentication flow:
//   1. client → POST /admin/webauthn/login/begin → server returns
//      PublicKeyCredentialRequestOptions (challenge)
//   2. client calls navigator.credentials.get(options) — user
//      touches YubiKey
//   3. client → POST /admin/webauthn/login/finish with the assertion
//      — server verifies signature against stored public key, increments
//      counter, issues the admin cookie just like /admin/login does

import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.DATA_DIR || "./data";
const FILE = path.join(DATA_DIR, "admin-passkeys.json");

// Relying-Party identity. RP_ID must be the eTLD+1 (or a subdomain
// thereof) of the origin the user logs in from. ORIGIN must match the
// scheme + host the browser is on. Both must agree across registration
// and authentication or the verification will fail.
const RP_ID = process.env.WEBAUTHN_RP_ID || "tornwar.com";
const RP_NAME = "Warboard Admin";
const ORIGIN = process.env.WEBAUTHN_ORIGIN || "https://tornwar.com";

// In-memory pending challenges. Keyed by `${type}:${playerId}` to allow
// concurrent register + authenticate flows for the same player. 5-min
// TTL — well above the human-touch interaction window, well below any
// useful replay window.
const _pendingChallenges = new Map();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function _setChallenge(key, challenge) {
    _pendingChallenges.set(key, { challenge, expiresAt: Date.now() + CHALLENGE_TTL_MS });
}
function _consumeChallenge(key) {
    const c = _pendingChallenges.get(key);
    if (!c) return null;
    _pendingChallenges.delete(key);
    if (c.expiresAt < Date.now()) return null;
    return c.challenge;
}

// Persisted credentials shape:
//   { [playerId(string)]: [{ id, publicKey, counter, transports,
//                            deviceName, addedAt }] }
let _passkeys = {};
function _load() {
    try {
        if (fs.existsSync(FILE)) _passkeys = JSON.parse(fs.readFileSync(FILE, "utf8"));
    } catch (e) {
        console.warn("[webauthn] load failed:", e.message);
        _passkeys = {};
    }
}
function _save() {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(FILE, JSON.stringify(_passkeys, null, 2));
    } catch (e) {
        console.error("[webauthn] save failed:", e.message);
    }
}
_load();

function _credsFor(playerId) {
    return _passkeys[String(playerId)] || [];
}

/** Total registered passkey count across ALL players. Used by the
 *  bootstrap path: when zero keys exist, we let the admin register a
 *  first key with just a verified Torn-owner key (no prior session
 *  required). After that, normal admin auth gates registration. */
export function totalPasskeyCount() {
    let n = 0;
    for (const list of Object.values(_passkeys)) n += list.length;
    return n;
}

export function listPasskeys(playerId) {
    return _credsFor(playerId).map(c => ({
        idShort: String(c.id).slice(0, 16) + "…",
        deviceName: c.deviceName,
        addedAt: c.addedAt,
        transports: c.transports || [],
    }));
}

export function removePasskey(playerId, idPrefix) {
    const pid = String(playerId);
    const list = _passkeys[pid];
    if (!list) return false;
    const trimmed = String(idPrefix).replace(/…$/, "");
    const before = list.length;
    _passkeys[pid] = list.filter(c => !c.id.startsWith(trimmed));
    if (_passkeys[pid].length < before) {
        _save();
        return true;
    }
    return false;
}

// ── Registration ─────────────────────────────────────────────────────

export async function beginRegistration(playerId, playerName) {
    const existing = _credsFor(playerId);
    const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userID: new TextEncoder().encode(String(playerId)),
        userName: playerName || `player-${playerId}`,
        attestationType: "none",
        authenticatorSelection: {
            residentKey: "discouraged",      // YubiKey OTP slot — no resident key needed
            userVerification: "preferred",   // touch is mandatory; PIN is optional
        },
        // Tell the browser not to offer any already-registered key for
        // re-registration (would just be a no-op duplicate).
        excludeCredentials: existing.map(c => ({
            id: c.id,
            type: "public-key",
            transports: c.transports || ["usb", "nfc"],
        })),
    });
    _setChallenge(`reg:${playerId}`, options.challenge);
    return options;
}

export async function finishRegistration(playerId, attestationResponse, deviceName) {
    const expectedChallenge = _consumeChallenge(`reg:${playerId}`);
    if (!expectedChallenge) throw new Error("No active registration challenge (or expired)");
    const verification = await verifyRegistrationResponse({
        response: attestationResponse,
        expectedChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: false,
    });
    if (!verification.verified || !verification.registrationInfo) {
        throw new Error("Registration verification failed");
    }
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const pid = String(playerId);
    if (!_passkeys[pid]) _passkeys[pid] = [];
    _passkeys[pid].push({
        id: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64"),
        counter: credential.counter,
        transports: attestationResponse.response?.transports || [],
        deviceName: String(deviceName || "Security Key").slice(0, 64),
        deviceType: credentialDeviceType,
        backedUp: !!credentialBackedUp,
        addedAt: Date.now(),
    });
    _save();
    return { ok: true, credentialId: credential.id };
}

// ── Authentication ───────────────────────────────────────────────────

export async function beginAuthentication(playerId) {
    const creds = _credsFor(playerId);
    if (creds.length === 0) {
        const e = new Error("No passkeys registered for this player");
        e.code = "NO_PASSKEYS";
        throw e;
    }
    const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: creds.map(c => ({
            id: c.id,
            type: "public-key",
            transports: c.transports || ["usb", "nfc"],
        })),
        userVerification: "preferred",
    });
    _setChallenge(`auth:${playerId}`, options.challenge);
    return options;
}

export async function finishAuthentication(playerId, assertionResponse) {
    const expectedChallenge = _consumeChallenge(`auth:${playerId}`);
    if (!expectedChallenge) throw new Error("No active authentication challenge (or expired)");
    const cred = _credsFor(playerId).find(c => c.id === assertionResponse.id);
    if (!cred) throw new Error("Unknown credential — was this key registered?");
    const verification = await verifyAuthenticationResponse({
        response: assertionResponse,
        expectedChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        credential: {
            id: cred.id,
            publicKey: Buffer.from(cred.publicKey, "base64"),
            counter: cred.counter,
            transports: cred.transports || [],
        },
        requireUserVerification: false,
    });
    if (!verification.verified) throw new Error("Authentication verification failed");
    // Persist the new counter — replay-protection. If a stolen credential
    // were ever used, the original device's counter would have advanced
    // beyond what the attacker has, and Torn's lib rejects it.
    cred.counter = verification.authenticationInfo.newCounter;
    _save();
    return { ok: true };
}
