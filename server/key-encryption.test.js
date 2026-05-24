import test from "node:test";
import assert from "node:assert/strict";

import { decrypt, decryptMap, encrypt, encryptMap, isEncrypted } from "./key-encryption.js";

test.beforeEach(() => {
  process.env.KEY_ENCRYPTION_SECRET = "test-encryption-secret";
  delete process.env.KEY_ENCRYPTION_KEY;
  delete process.env.API_KEY_ENCRYPTION_SECRET;
  delete process.env.ENCRYPTION_SECRET;
});

test("encrypts and decrypts a value", () => {
  const encrypted = encrypt("abc123secret");

  assert.equal(isEncrypted(encrypted), true);
  assert.notEqual(encrypted, "abc123secret");
  assert.equal(decrypt(encrypted), "abc123secret");
});

test("passes legacy plaintext values through unchanged", () => {
  assert.equal(isEncrypted("legacy-api-key"), false);
  assert.equal(decrypt("legacy-api-key"), "legacy-api-key");
});

test("encrypts and decrypts object values", () => {
  const encrypted = encryptMap({ "1": "key-one", "2": "key-two" });

  assert.deepEqual(Object.keys(encrypted), ["1", "2"]);
  assert.equal(isEncrypted(encrypted["1"]), true);
  assert.deepEqual(decryptMap(encrypted), { "1": "key-one", "2": "key-two" });
});
