/* warboard: TornTools' background is an MV3 service worker; we run it in a plain
   hidden page. Stub the service-worker-only globals + chrome.offscreen so the
   bundle doesn't throw on load. Runs after the browser shim (injected first). */
(function () {
  try {
    var g = self;
    if (typeof g.skipWaiting !== 'function') g.skipWaiting = function () { return Promise.resolve(); };
    if (typeof g.clients === 'undefined') g.clients = { claim: function () { return Promise.resolve(); }, matchAll: function () { return Promise.resolve([]); }, openWindow: function () { return Promise.resolve(null); } };
    if (typeof g.registration === 'undefined') g.registration = { showNotification: function () { return Promise.resolve(); }, getNotifications: function () { return Promise.resolve([]); }, scope: location.origin + '/', update: function () { return Promise.resolve(); } };
    if (typeof g.importScripts !== 'function') g.importScripts = function () {};
    var c = window.chrome || window.browser;
    if (c && !c.offscreen) c.offscreen = { createDocument: function () { return Promise.resolve(); }, closeDocument: function () { return Promise.resolve(); }, hasDocument: function () { return Promise.resolve(false); } };
    // chrome.runtime.getContexts — Chrome-116 MV3 API TornTools uses to check for an
    // existing offscreen doc before creating one; undefined in the WKWebView runtime.
    if (c && c.runtime && typeof c.runtime.getContexts !== 'function') c.runtime.getContexts = function () { return Promise.resolve([]); };
  } catch (e) { console.log('[warboard] tt prelude error', e); }

  // DIAGNOSTIC + safety net: report anything the background bundle throws at init.
  // The content-script diag doesn't cover this off-main background context, so a
  // silent throw here just shows up as "TornTools completely gone". Multi-channel
  // (console + image + fetch beacon) so at least one survives the page's CSP.
  function ttReport(kind, msg) {
    var s = '[' + kind + '] ' + String(msg == null ? '' : msg).slice(0, 1500);
    try { console.error('[warboard-tt-init]', s); } catch (e) {}
    try {
      var u = 'https://tornwar.com/api/debug/tt-beacon?m=' + encodeURIComponent(s);
      if (typeof Image === 'function') { var im = new Image(); im.src = u; }
      if (typeof fetch === 'function') { fetch(u, { mode: 'no-cors' }).catch(function () {}); }
    } catch (e) {}
  }
  try {
    if (self.addEventListener) {
      self.addEventListener('error', function (ev) {
        ttReport('error', (ev && ev.message) + ' @ ' + (ev && ev.filename) + ':' + (ev && ev.lineno) + ':' + (ev && ev.colno) + ' | ' + (ev && ev.error && ev.error.stack || ''));
      });
      self.addEventListener('unhandledrejection', function (ev) {
        var r = ev && ev.reason;
        ttReport('reject', (r && (r.stack || r.message)) || String(r));
      });
    }
  } catch (e) {}
})();

var background = (function() {
	//#region \0rolldown/runtime.js
	var __defProp = Object.defineProperty;
	var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
	var __getOwnPropNames = Object.getOwnPropertyNames;
	var __hasOwnProp = Object.prototype.hasOwnProperty;
	var __esmMin = (fn, res, err) => () => {
		if (err) throw err[0];
		try {
			return fn && (res = fn(fn = 0)), res;
		} catch (e) {
			throw err = [e], e;
		}
	};
	var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
	var __exportAll = (all, no_symbols) => {
		let target = {};
		for (var name in all) __defProp(target, name, {
			get: all[name],
			enumerable: true
		});
		if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
		return target;
	};
	var __copyProps = (to, from, except, desc) => {
		if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
			key = keys[i];
			if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
				get: ((k) => from[k]).bind(null, key),
				enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
			});
		}
		return to;
	};
	var __toCommonJS = (mod) => __hasOwnProp.call(mod, "module.exports") ? mod["module.exports"] : __copyProps(__defProp({}, "__esModule", { value: true }), mod);
	//#endregion
	//#region node_modules/wxt/dist/utils/define-background.mjs
	function defineBackground(arg) {
		if (arg == null || typeof arg === "function") return { main: arg };
		return arg;
	}
	//#endregion
	//#region node_modules/@wxt-dev/storage/node_modules/@wxt-dev/browser/src/index.mjs
	var browser$2 = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
	//#endregion
	//#region node_modules/async-mutex/index.mjs
	var E_CANCELED = /* @__PURE__ */ new Error("request for lock canceled");
	var __awaiter$2 = function(thisArg, _arguments, P, generator) {
		function adopt(value) {
			return value instanceof P ? value : new P(function(resolve) {
				resolve(value);
			});
		}
		return new (P || (P = Promise))(function(resolve, reject) {
			function fulfilled(value) {
				try {
					step(generator.next(value));
				} catch (e) {
					reject(e);
				}
			}
			function rejected(value) {
				try {
					step(generator["throw"](value));
				} catch (e) {
					reject(e);
				}
			}
			function step(result) {
				result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
			}
			step((generator = generator.apply(thisArg, _arguments || [])).next());
		});
	};
	var Semaphore = class {
		constructor(_value, _cancelError = E_CANCELED) {
			this._value = _value;
			this._cancelError = _cancelError;
			this._queue = [];
			this._weightedWaiters = [];
		}
		acquire(weight = 1, priority = 0) {
			if (weight <= 0) throw new Error(`invalid weight ${weight}: must be positive`);
			return new Promise((resolve, reject) => {
				const task = {
					resolve,
					reject,
					weight,
					priority
				};
				const i = findIndexFromEnd(this._queue, (other) => priority <= other.priority);
				if (i === -1 && weight <= this._value) this._dispatchItem(task);
				else this._queue.splice(i + 1, 0, task);
			});
		}
		runExclusive(callback_1) {
			return __awaiter$2(this, arguments, void 0, function* (callback, weight = 1, priority = 0) {
				const [value, release] = yield this.acquire(weight, priority);
				try {
					return yield callback(value);
				} finally {
					release();
				}
			});
		}
		waitForUnlock(weight = 1, priority = 0) {
			if (weight <= 0) throw new Error(`invalid weight ${weight}: must be positive`);
			if (this._couldLockImmediately(weight, priority)) return Promise.resolve();
			else return new Promise((resolve) => {
				if (!this._weightedWaiters[weight - 1]) this._weightedWaiters[weight - 1] = [];
				insertSorted(this._weightedWaiters[weight - 1], {
					resolve,
					priority
				});
			});
		}
		isLocked() {
			return this._value <= 0;
		}
		getValue() {
			return this._value;
		}
		setValue(value) {
			this._value = value;
			this._dispatchQueue();
		}
		release(weight = 1) {
			if (weight <= 0) throw new Error(`invalid weight ${weight}: must be positive`);
			this._value += weight;
			this._dispatchQueue();
		}
		cancel() {
			this._queue.forEach((entry) => entry.reject(this._cancelError));
			this._queue = [];
		}
		_dispatchQueue() {
			this._drainUnlockWaiters();
			while (this._queue.length > 0 && this._queue[0].weight <= this._value) {
				this._dispatchItem(this._queue.shift());
				this._drainUnlockWaiters();
			}
		}
		_dispatchItem(item) {
			const previousValue = this._value;
			this._value -= item.weight;
			item.resolve([previousValue, this._newReleaser(item.weight)]);
		}
		_newReleaser(weight) {
			let called = false;
			return () => {
				if (called) return;
				called = true;
				this.release(weight);
			};
		}
		_drainUnlockWaiters() {
			if (this._queue.length === 0) for (let weight = this._value; weight > 0; weight--) {
				const waiters = this._weightedWaiters[weight - 1];
				if (!waiters) continue;
				waiters.forEach((waiter) => waiter.resolve());
				this._weightedWaiters[weight - 1] = [];
			}
			else {
				const queuedPriority = this._queue[0].priority;
				for (let weight = this._value; weight > 0; weight--) {
					const waiters = this._weightedWaiters[weight - 1];
					if (!waiters) continue;
					const i = waiters.findIndex((waiter) => waiter.priority <= queuedPriority);
					(i === -1 ? waiters : waiters.splice(0, i)).forEach(((waiter) => waiter.resolve()));
				}
			}
		}
		_couldLockImmediately(weight, priority) {
			return (this._queue.length === 0 || this._queue[0].priority < priority) && weight <= this._value;
		}
	};
	function insertSorted(a, v) {
		const i = findIndexFromEnd(a, (other) => v.priority <= other.priority);
		a.splice(i + 1, 0, v);
	}
	function findIndexFromEnd(a, predicate) {
		for (let i = a.length - 1; i >= 0; i--) if (predicate(a[i])) return i;
		return -1;
	}
	var __awaiter$1 = function(thisArg, _arguments, P, generator) {
		function adopt(value) {
			return value instanceof P ? value : new P(function(resolve) {
				resolve(value);
			});
		}
		return new (P || (P = Promise))(function(resolve, reject) {
			function fulfilled(value) {
				try {
					step(generator.next(value));
				} catch (e) {
					reject(e);
				}
			}
			function rejected(value) {
				try {
					step(generator["throw"](value));
				} catch (e) {
					reject(e);
				}
			}
			function step(result) {
				result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
			}
			step((generator = generator.apply(thisArg, _arguments || [])).next());
		});
	};
	var Mutex = class {
		constructor(cancelError) {
			this._semaphore = new Semaphore(1, cancelError);
		}
		acquire() {
			return __awaiter$1(this, arguments, void 0, function* (priority = 0) {
				const [, releaser] = yield this._semaphore.acquire(1, priority);
				return releaser;
			});
		}
		runExclusive(callback, priority = 0) {
			return this._semaphore.runExclusive(() => callback(), 1, priority);
		}
		isLocked() {
			return this._semaphore.isLocked();
		}
		waitForUnlock(priority = 0) {
			return this._semaphore.waitForUnlock(1, priority);
		}
		release() {
			if (this._semaphore.isLocked()) this._semaphore.release();
		}
		cancel() {
			return this._semaphore.cancel();
		}
	};
	//#endregion
	//#region node_modules/dequal/lite/index.mjs
	var has = Object.prototype.hasOwnProperty;
	function dequal(foo, bar) {
		var ctor, len;
		if (foo === bar) return true;
		if (foo && bar && (ctor = foo.constructor) === bar.constructor) {
			if (ctor === Date) return foo.getTime() === bar.getTime();
			if (ctor === RegExp) return foo.toString() === bar.toString();
			if (ctor === Array) {
				if ((len = foo.length) === bar.length) while (len-- && dequal(foo[len], bar[len]));
				return len === -1;
			}
			if (!ctor || typeof foo === "object") {
				len = 0;
				for (ctor in foo) {
					if (has.call(foo, ctor) && ++len && !has.call(bar, ctor)) return false;
					if (!(ctor in bar) || !dequal(foo[ctor], bar[ctor])) return false;
				}
				return Object.keys(bar).length === len;
			}
		}
		return foo !== foo && bar !== bar;
	}
	createStorage();
	function createStorage() {
		const drivers = {
			local: createDriver("local"),
			session: createDriver("session"),
			sync: createDriver("sync"),
			managed: createDriver("managed")
		};
		const getDriver = (area) => {
			const driver = drivers[area];
			if (driver == null) {
				const areaNames = Object.keys(drivers).join(", ");
				throw Error(`Invalid area "${area}". Options: ${areaNames}`);
			}
			return driver;
		};
		const resolveKey = (key) => {
			const deliminatorIndex = key.indexOf(":");
			const driverArea = key.substring(0, deliminatorIndex);
			const driverKey = key.substring(deliminatorIndex + 1);
			if (driverKey == null) throw Error(`Storage key should be in the form of "area:key", but received "${key}"`);
			return {
				driverArea,
				driverKey,
				driver: getDriver(driverArea)
			};
		};
		const getMetaKey = (key) => key + "$";
		const mergeMeta = (oldMeta, newMeta) => {
			const newFields = { ...oldMeta };
			Object.entries(newMeta).forEach(([key, value]) => {
				if (value == null) delete newFields[key];
				else newFields[key] = value;
			});
			return newFields;
		};
		const getValueOrFallback = (value, fallback) => value ?? fallback ?? null;
		const getMetaValue = (properties) => typeof properties === "object" && !Array.isArray(properties) ? properties : {};
		const getItem = async (driver, driverKey, opts) => {
			return getValueOrFallback(await driver.getItem(driverKey), opts?.fallback ?? opts?.defaultValue);
		};
		const getMeta = async (driver, driverKey) => {
			const metaKey = getMetaKey(driverKey);
			return getMetaValue(await driver.getItem(metaKey));
		};
		const setItem = async (driver, driverKey, value) => {
			await driver.setItem(driverKey, value ?? null);
		};
		const setMeta = async (driver, driverKey, properties) => {
			const metaKey = getMetaKey(driverKey);
			const existingFields = getMetaValue(await driver.getItem(metaKey));
			await driver.setItem(metaKey, mergeMeta(existingFields, properties));
		};
		const removeItem = async (driver, driverKey, opts) => {
			await driver.removeItem(driverKey);
			if (opts?.removeMeta) {
				const metaKey = getMetaKey(driverKey);
				await driver.removeItem(metaKey);
			}
		};
		const removeMeta = async (driver, driverKey, properties) => {
			const metaKey = getMetaKey(driverKey);
			if (properties == null) await driver.removeItem(metaKey);
			else {
				const newFields = getMetaValue(await driver.getItem(metaKey));
				[properties].flat().forEach((field) => delete newFields[field]);
				await driver.setItem(metaKey, newFields);
			}
		};
		const watch = (driver, driverKey, cb) => driver.watch(driverKey, cb);
		return {
			getItem: async (key, opts) => {
				const { driver, driverKey } = resolveKey(key);
				return await getItem(driver, driverKey, opts);
			},
			getItems: async (keys) => {
				const areaToKeyMap = /* @__PURE__ */ new Map();
				const keyToOptsMap = /* @__PURE__ */ new Map();
				const orderedKeys = [];
				keys.forEach((key) => {
					let keyStr;
					let opts;
					if (typeof key === "string") keyStr = key;
					else if ("getValue" in key) {
						keyStr = key.key;
						opts = { fallback: key.fallback };
					} else {
						keyStr = key.key;
						opts = key.options;
					}
					orderedKeys.push(keyStr);
					const { driverArea, driverKey } = resolveKey(keyStr);
					const areaKeys = areaToKeyMap.get(driverArea) ?? [];
					areaToKeyMap.set(driverArea, areaKeys.concat(driverKey));
					keyToOptsMap.set(keyStr, opts);
				});
				const resultsMap = /* @__PURE__ */ new Map();
				await Promise.all(Array.from(areaToKeyMap.entries()).map(async ([driverArea, keys]) => {
					(await drivers[driverArea].getItems(keys)).forEach((driverResult) => {
						const key = `${driverArea}:${driverResult.key}`;
						const opts = keyToOptsMap.get(key);
						const value = getValueOrFallback(driverResult.value, opts?.fallback ?? opts?.defaultValue);
						resultsMap.set(key, value);
					});
				}));
				return orderedKeys.map((key) => ({
					key,
					value: resultsMap.get(key)
				}));
			},
			getMeta: async (key) => {
				const { driver, driverKey } = resolveKey(key);
				return await getMeta(driver, driverKey);
			},
			getMetas: async (args) => {
				const keys = args.map((arg) => {
					const key = typeof arg === "string" ? arg : arg.key;
					const { driverArea, driverKey } = resolveKey(key);
					return {
						key,
						driverArea,
						driverKey,
						driverMetaKey: getMetaKey(driverKey)
					};
				});
				const areaToDriverMetaKeysMap = keys.reduce((map, key) => {
					map[key.driverArea] ??= [];
					map[key.driverArea].push(key);
					return map;
				}, {});
				const resultsMap = {};
				await Promise.all(Object.entries(areaToDriverMetaKeysMap).map(async ([area, keys]) => {
					const areaRes = await browser$2.storage[area].get(keys.map((key) => key.driverMetaKey));
					keys.forEach((key) => {
						resultsMap[key.key] = areaRes[key.driverMetaKey] ?? {};
					});
				}));
				return keys.map((key) => ({
					key: key.key,
					meta: resultsMap[key.key]
				}));
			},
			setItem: async (key, value) => {
				const { driver, driverKey } = resolveKey(key);
				await setItem(driver, driverKey, value);
			},
			setItems: async (items) => {
				const areaToKeyValueMap = {};
				items.forEach((item) => {
					const { driverArea, driverKey } = resolveKey("key" in item ? item.key : item.item.key);
					areaToKeyValueMap[driverArea] ??= [];
					areaToKeyValueMap[driverArea].push({
						key: driverKey,
						value: item.value
					});
				});
				await Promise.all(Object.entries(areaToKeyValueMap).map(async ([driverArea, values]) => {
					await getDriver(driverArea).setItems(values);
				}));
			},
			setMeta: async (key, properties) => {
				const { driver, driverKey } = resolveKey(key);
				await setMeta(driver, driverKey, properties);
			},
			setMetas: async (items) => {
				const areaToMetaUpdatesMap = {};
				items.forEach((item) => {
					const { driverArea, driverKey } = resolveKey("key" in item ? item.key : item.item.key);
					areaToMetaUpdatesMap[driverArea] ??= [];
					areaToMetaUpdatesMap[driverArea].push({
						key: driverKey,
						properties: item.meta
					});
				});
				await Promise.all(Object.entries(areaToMetaUpdatesMap).map(async ([storageArea, updates]) => {
					const driver = getDriver(storageArea);
					const metaKeys = updates.map(({ key }) => getMetaKey(key));
					const existingMetas = await driver.getItems(metaKeys);
					const existingMetaMap = Object.fromEntries(existingMetas.map(({ key, value }) => [key, getMetaValue(value)]));
					const metaUpdates = updates.map(({ key, properties }) => {
						const metaKey = getMetaKey(key);
						return {
							key: metaKey,
							value: mergeMeta(existingMetaMap[metaKey] ?? {}, properties)
						};
					});
					await driver.setItems(metaUpdates);
				}));
			},
			removeItem: async (key, opts) => {
				const { driver, driverKey } = resolveKey(key);
				await removeItem(driver, driverKey, opts);
			},
			removeItems: async (keys) => {
				const areaToKeysMap = {};
				keys.forEach((key) => {
					let keyStr;
					let opts;
					if (typeof key === "string") keyStr = key;
					else if ("getValue" in key) keyStr = key.key;
					else if ("item" in key) {
						keyStr = key.item.key;
						opts = key.options;
					} else {
						keyStr = key.key;
						opts = key.options;
					}
					const { driverArea, driverKey } = resolveKey(keyStr);
					areaToKeysMap[driverArea] ??= [];
					areaToKeysMap[driverArea].push(driverKey);
					if (opts?.removeMeta) areaToKeysMap[driverArea].push(getMetaKey(driverKey));
				});
				await Promise.all(Object.entries(areaToKeysMap).map(async ([driverArea, keys]) => {
					await getDriver(driverArea).removeItems(keys);
				}));
			},
			clear: async (base) => {
				await getDriver(base).clear();
			},
			removeMeta: async (key, properties) => {
				const { driver, driverKey } = resolveKey(key);
				await removeMeta(driver, driverKey, properties);
			},
			snapshot: async (base, opts) => {
				const data = await getDriver(base).snapshot();
				opts?.excludeKeys?.forEach((key) => {
					delete data[key];
					delete data[getMetaKey(key)];
				});
				return data;
			},
			restoreSnapshot: async (base, data) => {
				await getDriver(base).restoreSnapshot(data);
			},
			watch: (key, cb) => {
				const { driver, driverKey } = resolveKey(key);
				return watch(driver, driverKey, cb);
			},
			unwatch() {
				Object.values(drivers).forEach((driver) => {
					driver.unwatch();
				});
			},
			defineItem: (key, opts) => {
				const { driver, driverKey } = resolveKey(key);
				const { version: targetVersion = 1, migrations = {}, onMigrationComplete, debug = false } = opts ?? {};
				if (targetVersion < 1) throw Error("Storage item version cannot be less than 1. Initial versions should be set to 1, not 0.");
				let needsVersionSet = false;
				const migrate = async () => {
					const driverMetaKey = getMetaKey(driverKey);
					const [{ value }, { value: meta }] = await driver.getItems([driverKey, driverMetaKey]);
					needsVersionSet = value == null && meta?.v == null && !!targetVersion;
					if (value == null) return;
					const currentVersion = meta?.v ?? 1;
					if (currentVersion > targetVersion) throw Error(`Version downgrade detected (v${currentVersion} -> v${targetVersion}) for "${key}"`);
					if (currentVersion === targetVersion) return;
					if (debug) console.debug(`[@wxt-dev/storage] Running storage migration for ${key}: v${currentVersion} -> v${targetVersion}`);
					const migrationsToRun = Array.from({ length: targetVersion - currentVersion }, (_, i) => currentVersion + i + 1);
					let migratedValue = value;
					for (const migrateToVersion of migrationsToRun) try {
						migratedValue = await migrations?.[migrateToVersion]?.(migratedValue) ?? migratedValue;
						if (debug) console.debug(`[@wxt-dev/storage] Storage migration processed for version: v${migrateToVersion}`);
					} catch (err) {
						throw new MigrationError(key, migrateToVersion, { cause: err });
					}
					await driver.setItems([{
						key: driverKey,
						value: migratedValue
					}, {
						key: driverMetaKey,
						value: {
							...meta,
							v: targetVersion
						}
					}]);
					if (debug) console.debug(`[@wxt-dev/storage] Storage migration completed for ${key} v${targetVersion}`, { migratedValue });
					onMigrationComplete?.(migratedValue, targetVersion);
				};
				const migrationsDone = opts?.migrations == null ? Promise.resolve() : migrate().catch((err) => {
					console.error(`[@wxt-dev/storage] Migration failed for ${key}`, err);
				});
				const initMutex = new Mutex();
				const getFallback = () => opts?.fallback ?? opts?.defaultValue ?? null;
				const getOrInitValue = () => initMutex.runExclusive(async () => {
					const value = await driver.getItem(driverKey);
					if (value != null || opts?.init == null) return value;
					const newValue = await opts.init();
					await driver.setItem(driverKey, newValue);
					if (value == null && targetVersion > 1) await setMeta(driver, driverKey, { v: targetVersion });
					return newValue;
				});
				migrationsDone.then(getOrInitValue);
				return {
					key,
					get defaultValue() {
						return getFallback();
					},
					get fallback() {
						return getFallback();
					},
					getValue: async () => {
						await migrationsDone;
						if (opts?.init) return await getOrInitValue();
						else return await getItem(driver, driverKey, opts);
					},
					getMeta: async () => {
						await migrationsDone;
						return await getMeta(driver, driverKey);
					},
					setValue: async (value) => {
						await migrationsDone;
						if (needsVersionSet) {
							needsVersionSet = false;
							await Promise.all([setItem(driver, driverKey, value), setMeta(driver, driverKey, { v: targetVersion })]);
						} else await setItem(driver, driverKey, value);
					},
					setMeta: async (properties) => {
						await migrationsDone;
						return await setMeta(driver, driverKey, properties);
					},
					removeValue: async (opts) => {
						await migrationsDone;
						return await removeItem(driver, driverKey, opts);
					},
					removeMeta: async (properties) => {
						await migrationsDone;
						return await removeMeta(driver, driverKey, properties);
					},
					watch: (cb) => watch(driver, driverKey, (newValue, oldValue) => cb(newValue ?? getFallback(), oldValue ?? getFallback())),
					migrate
				};
			}
		};
	}
	function createDriver(storageArea) {
		const getStorageArea = () => {
			if (browser$2.runtime == null) throw Error(`'wxt/storage' must be loaded in a web extension environment

 - If thrown during a build, see https://github.com/wxt-dev/wxt/issues/371
 - If thrown during tests, mock 'wxt/browser' correctly. See https://wxt.dev/guide/go-further/testing.html
`);
			if (browser$2.storage == null) throw Error("You must add the 'storage' permission to your manifest to use 'wxt/storage'");
			const area = browser$2.storage[storageArea];
			if (area == null) throw Error(`"browser.storage.${storageArea}" is undefined`);
			return area;
		};
		const watchListeners = /* @__PURE__ */ new Set();
		return {
			getItem: async (key) => {
				return (await getStorageArea().get(key))[key];
			},
			getItems: async (keys) => {
				const result = await getStorageArea().get(keys);
				return keys.map((key) => ({
					key,
					value: result[key] ?? null
				}));
			},
			setItem: async (key, value) => {
				if (value == null) await getStorageArea().remove(key);
				else await getStorageArea().set({ [key]: value });
			},
			setItems: async (values) => {
				const map = values.reduce((map, { key, value }) => {
					map[key] = value;
					return map;
				}, {});
				await getStorageArea().set(map);
			},
			removeItem: async (key) => {
				await getStorageArea().remove(key);
			},
			removeItems: async (keys) => {
				await getStorageArea().remove(keys);
			},
			clear: async () => {
				await getStorageArea().clear();
			},
			snapshot: async () => {
				return await getStorageArea().get();
			},
			restoreSnapshot: async (data) => {
				await getStorageArea().set(data);
			},
			watch(key, cb) {
				const listener = (changes) => {
					const change = changes[key];
					if (change == null || dequal(change.newValue, change.oldValue)) return;
					cb(change.newValue ?? null, change.oldValue ?? null);
				};
				getStorageArea().onChanged.addListener(listener);
				watchListeners.add(listener);
				return () => {
					getStorageArea().onChanged.removeListener(listener);
					watchListeners.delete(listener);
				};
			},
			unwatch() {
				watchListeners.forEach((listener) => {
					getStorageArea().onChanged.removeListener(listener);
				});
				watchListeners.clear();
			}
		};
	}
	var MigrationError = class extends Error {
		constructor(key, version, options) {
			super(`v${version} migration failed for "${key}"`, options);
			this.key = key;
			this.version = version;
		}
	};
	var ttStorage;
	var RUNTIME_INFORMATION;
	var RUNTIME_STORAGE;
	var OFFLOAD_SERVICE;
	var DATA_FETCHER;
	var EVENT_HANDLER;
	function setTTStorage(storage) {
		ttStorage = storage;
	}
	function setRuntimeInformation(runtimeInformation) {
		RUNTIME_INFORMATION = runtimeInformation;
	}
	function setRuntimeStorage(runtimeStorage) {
		RUNTIME_STORAGE = runtimeStorage;
	}
	function setOffloadService(offloadService) {
		OFFLOAD_SERVICE = offloadService;
	}
	function setDataFetcher(dataFetcher) {
		DATA_FETCHER = dataFetcher;
	}
	function setEventHandler(eventHandler) {
		EVENT_HANDLER = eventHandler;
	}
	//#endregion
	//#region src/common/utils/data/cache.ts
	var TornToolsCache = class {
		_cache;
		persistTimer = null;
		constructor() {
			this._cache = {};
		}
		set cache(value) {
			this._cache = value || {};
		}
		get cache() {
			return this._cache;
		}
		get(section, key) {
			return this.getCacheValue(section, key)?.value;
		}
		remove(section, key) {
			const actualKey = key ?? section;
			const actualSection = key ? section : null;
			if (actualSection && !this.hasValue(actualSection, actualKey) || !actualSection && !this.hasValue(actualKey.toString())) return;
			if (actualSection) delete this.cache[actualSection][actualKey];
			else delete this.cache[actualKey];
			this.schedulePersist();
		}
		hasValue(section, key) {
			return this.getCacheValue(section, key) !== null;
		}
		getCacheValue(section, key) {
			const actualKey = key ?? section;
			const actualSection = key ? section : null;
			let value = null;
			if (actualSection) {
				if (section in this.cache && actualKey in this.cache[actualSection]) value = this.cache[actualSection][actualKey];
			} else if (actualKey in this.cache) value = this.cache[actualKey];
			if (value === null || !("value" in value)) return null;
			if ("indefinite" in value) return value;
			else return value.timeout > Date.now() ? value : null;
		}
		set(object, ttl, section) {
			return this._set(object, ttl, section);
		}
		setIndefinite(object, section) {
			return this._set(object, null, section);
		}
		_set(object, ttl, section) {
			const timeout = ttl === null ? null : Date.now() + ttl;
			if (section) {
				if (!(section in this.cache)) this.cache[section] = {};
				for (const [key, value] of Object.entries(object)) this.cache[section][key] = this.createCacheValue(value, timeout);
			} else for (const [key, value] of Object.entries(object)) this.cache[key] = this.createCacheValue(value, timeout);
			this.schedulePersist();
		}
		createCacheValue(value, timeout) {
			if (timeout === null) return {
				value,
				indefinite: true
			};
			else return {
				value,
				timeout
			};
		}
		async clear(section) {
			if (section) {
				delete this.cache[section];
				this.schedulePersist();
			} else {
				this.cache = {};
				if (this.persistTimer) clearTimeout(this.persistTimer);
				this.persistTimer = null;
				await ttStorage.set({ cache: {} });
			}
		}
		async refresh() {
			let hasChanged = false;
			const now = Date.now();
			refreshObject(this.cache);
			for (const section in this.cache) if (!Object.keys(this.cache[section]).length) delete this.cache[section];
			if (hasChanged) this.schedulePersist();
			function refreshObject(object) {
				for (const key in object) {
					const value = object[key];
					if ("value" in value) {
						const cacheValue = value;
						if ("indefinite" in cacheValue || cacheValue.timeout > now) continue;
						hasChanged = true;
						delete object[key];
					} else refreshObject(value);
				}
			}
		}
		schedulePersist() {
			if (this.persistTimer) clearTimeout(this.persistTimer);
			this.persistTimer = setTimeout(() => {
				this.persistTimer = null;
				ttStorage.set({ cache: this.cache }).catch((err) => console.error("Failed to persist cache.", err));
			}, 500);
		}
	};
	var ttCache = new TornToolsCache();
	//#endregion
	//#region src/common/utils/data/default-database.ts
	var DefaultSetting = class {
		type;
		defaultValue;
		constructor(type, defaultValue) {
			this.type = type;
			this.defaultValue = defaultValue ?? null;
		}
	};
	var DEFAULT_STORAGE = {
		version: {
			current: new DefaultSetting("string", () => RUNTIME_INFORMATION.getVersion()),
			initial: new DefaultSetting("string", () => RUNTIME_INFORMATION.getVersion()),
			oldVersion: new DefaultSetting("string"),
			showNotice: new DefaultSetting("boolean", true)
		},
		api: {
			torn: {
				key: new DefaultSetting("string"),
				online: new DefaultSetting("boolean", true),
				error: new DefaultSetting("string"),
				owner: new DefaultSetting("number")
			},
			tornstats: { key: new DefaultSetting("string") },
			yata: { key: new DefaultSetting("string") },
			ffScouter: { key: new DefaultSetting("string") }
		},
		settings: {
			updateNotice: new DefaultSetting("boolean", true),
			featureDisplay: new DefaultSetting("boolean", true),
			featureDisplayPosition: new DefaultSetting("string", "bottom-left"),
			featureDisplayOnlyFailed: new DefaultSetting("boolean", false),
			featureDisplayHideDisabled: new DefaultSetting("boolean", false),
			featureDisplayHideEmpty: new DefaultSetting("boolean", true),
			developer: new DefaultSetting("boolean", false),
			formatting: {
				tct: new DefaultSetting("boolean", false),
				date: new DefaultSetting("string", "eu"),
				time: new DefaultSetting("string", "eu")
			},
			sorting: { abroad: {
				column: new DefaultSetting("string", ""),
				order: new DefaultSetting("string", "none")
			} },
			notifications: {
				sound: new DefaultSetting("string", "default"),
				soundCustom: new DefaultSetting("string", ""),
				tts: new DefaultSetting("boolean", false),
				ttsVoice: new DefaultSetting("string", "default"),
				ttsRate: new DefaultSetting("number", 1),
				link: new DefaultSetting("boolean", true),
				volume: new DefaultSetting("number", 100),
				requireInteraction: new DefaultSetting("boolean", false),
				types: {
					global: new DefaultSetting("boolean", () => typeof Notification !== "undefined" && Notification.permission === "granted"),
					events: new DefaultSetting("boolean", true),
					messages: new DefaultSetting("boolean", true),
					status: new DefaultSetting("boolean", true),
					traveling: new DefaultSetting("boolean", true),
					cooldowns: new DefaultSetting("boolean", true),
					education: new DefaultSetting("boolean", true),
					newDay: new DefaultSetting("boolean", true),
					energy: new DefaultSetting("array", ["100%"]),
					nerve: new DefaultSetting("array", ["100%"]),
					happy: new DefaultSetting("array", ["100%"]),
					life: new DefaultSetting("array", ["100%"]),
					offline: new DefaultSetting("array", []),
					chainTimerEnabled: new DefaultSetting("boolean", true),
					chainBonusEnabled: new DefaultSetting("boolean", true),
					leavingHospitalEnabled: new DefaultSetting("boolean", true),
					landingEnabled: new DefaultSetting("boolean", true),
					cooldownDrugEnabled: new DefaultSetting("boolean", true),
					cooldownBoosterEnabled: new DefaultSetting("boolean", true),
					cooldownMedicalEnabled: new DefaultSetting("boolean", true),
					chainTimer: new DefaultSetting("array", []),
					chainBonus: new DefaultSetting("array", []),
					leavingHospital: new DefaultSetting("array", []),
					landing: new DefaultSetting("array", []),
					cooldownDrug: new DefaultSetting("array", []),
					cooldownBooster: new DefaultSetting("array", []),
					cooldownMedical: new DefaultSetting("array", []),
					stocks: new DefaultSetting("object", {}),
					missionsLimitEnabled: new DefaultSetting("boolean", false),
					missionsLimit: new DefaultSetting("string", ""),
					missionsExpireEnabled: new DefaultSetting("boolean", false),
					missionsExpire: new DefaultSetting("array", []),
					npcsGlobal: new DefaultSetting("boolean", true),
					npcs: new DefaultSetting("array", []),
					npcPlannedEnabled: new DefaultSetting("boolean", true),
					npcPlanned: new DefaultSetting("array", []),
					refillEnergyEnabled: new DefaultSetting("boolean", true),
					refillEnergy: new DefaultSetting("string", ""),
					refillNerveEnabled: new DefaultSetting("boolean", true),
					refillNerve: new DefaultSetting("string", "")
				}
			},
			apiUsage: {
				comment: new DefaultSetting("string", "TornTools"),
				delayEssential: new DefaultSetting("number", 30),
				delayBasic: new DefaultSetting("number", 120),
				delayPassive: new DefaultSetting("number", 3600),
				delayStakeouts: new DefaultSetting("number", 30),
				user: {
					bars: new DefaultSetting("boolean", true),
					cooldowns: new DefaultSetting("boolean", true),
					travel: new DefaultSetting("boolean", true),
					newevents: new DefaultSetting("boolean", true),
					newmessages: new DefaultSetting("boolean", true),
					refills: new DefaultSetting("boolean", true),
					stocks: new DefaultSetting("boolean", true),
					education: new DefaultSetting("boolean", true),
					networth: new DefaultSetting("boolean", true),
					inventory: new DefaultSetting("boolean", true),
					jobpoints: new DefaultSetting("boolean", true),
					merits: new DefaultSetting("boolean", true),
					perks: new DefaultSetting("boolean", true),
					icons: new DefaultSetting("boolean", true),
					ammo: new DefaultSetting("boolean", true),
					battlestats: new DefaultSetting("boolean", true),
					crimes: new DefaultSetting("boolean", true),
					workstats: new DefaultSetting("boolean", true),
					skills: new DefaultSetting("boolean", true),
					weaponexp: new DefaultSetting("boolean", true),
					properties: new DefaultSetting("boolean", true),
					calendar: new DefaultSetting("boolean", true),
					organizedcrime: new DefaultSetting("boolean", true),
					missions: new DefaultSetting("boolean", true),
					personalstats: new DefaultSetting("boolean", true),
					attacks: new DefaultSetting("boolean", true),
					money: new DefaultSetting("boolean", true),
					honors: new DefaultSetting("boolean", true),
					medals: new DefaultSetting("boolean", true),
					virus: new DefaultSetting("boolean", true)
				}
			},
			themes: {
				pages: new DefaultSetting("string", "default"),
				containers: new DefaultSetting("string", "default")
			},
			hideIcons: new DefaultSetting("array", []),
			hideCasinoGames: new DefaultSetting("array", []),
			hideStocks: new DefaultSetting("array", []),
			alliedFactions: new DefaultSetting("array", []),
			customLinks: new DefaultSetting("array", []),
			employeeInactivityWarning: new DefaultSetting("array", []),
			factionInactivityWarning: new DefaultSetting("array", []),
			userAlias: new DefaultSetting("array", []),
			csvDelimiter: new DefaultSetting("string", ";"),
			pages: {
				global: {
					alignLeft: new DefaultSetting("boolean", false),
					hideLevelUpgrade: new DefaultSetting("boolean", false),
					hideQuitButtons: new DefaultSetting("boolean", false),
					hideTutorials: new DefaultSetting("boolean", false),
					keepAttackHistory: new DefaultSetting("boolean", true),
					miniProfileLastAction: new DefaultSetting("boolean", true),
					reviveProvider: new DefaultSetting("string", ""),
					pageTitles: new DefaultSetting("boolean", true),
					stackingMode: new DefaultSetting("boolean", false),
					noOutsideLinkAlert: new DefaultSetting("boolean", false),
					urlFill: new DefaultSetting("boolean", true)
				},
				profile: {
					avgpersonalstats: new DefaultSetting("boolean", false),
					statusIndicator: new DefaultSetting("boolean", true),
					idBesideProfileName: new DefaultSetting("boolean", true),
					notes: new DefaultSetting("boolean", true),
					showAllyWarning: new DefaultSetting("boolean", true),
					ageToWords: new DefaultSetting("boolean", true),
					disableAllyAttacks: new DefaultSetting("boolean", true),
					box: new DefaultSetting("boolean", true),
					boxStats: new DefaultSetting("boolean", true),
					boxSpy: new DefaultSetting("boolean", true),
					boxStakeout: new DefaultSetting("boolean", true),
					boxAttackHistory: new DefaultSetting("boolean", true),
					boxFetch: new DefaultSetting("boolean", true)
				},
				chat: {
					fontSize: new DefaultSetting("number", 12),
					searchChat: new DefaultSetting("boolean", true),
					completeUsernames: new DefaultSetting("boolean", true),
					highlights: new DefaultSetting("array", [{
						name: "$player",
						color: "#7ca900"
					}]),
					titleHighlights: new DefaultSetting("array", []),
					tradeTimer: new DefaultSetting("boolean", true),
					resizable: new DefaultSetting("boolean", true),
					hideChatButton: new DefaultSetting("boolean", true),
					hideChat: new DefaultSetting("boolean", false)
				},
				sidebar: {
					notes: new DefaultSetting("boolean", true),
					highlightEnergy: new DefaultSetting("boolean", true),
					highlightNerve: new DefaultSetting("boolean", false),
					ocTimer: new DefaultSetting("boolean", true),
					oc2Timer: new DefaultSetting("boolean", true),
					oc2TimerPosition: new DefaultSetting("boolean", false),
					oc2TimerLevel: new DefaultSetting("boolean", true),
					factionOCTimer: new DefaultSetting("boolean", false),
					collapseAreas: new DefaultSetting("boolean", true),
					settingsLink: new DefaultSetting("boolean", true),
					hideGymHighlight: new DefaultSetting("boolean", false),
					hideNewspaperHighlight: new DefaultSetting("boolean", false),
					upkeepPropHighlight: new DefaultSetting("number", 0),
					barLinks: new DefaultSetting("boolean", true),
					pointsValue: new DefaultSetting("boolean", true),
					npcLootTimes: new DefaultSetting("boolean", true),
					npcLootTimesService: new DefaultSetting("string", "tornstats"),
					cooldownEndTimes: new DefaultSetting("boolean", true),
					companyAddictionLevel: new DefaultSetting("boolean", true),
					showJobPointsToolTip: new DefaultSetting("boolean", true),
					rwTimer: new DefaultSetting("boolean", true),
					virusTimer: new DefaultSetting("boolean", false)
				},
				popup: {
					dashboard: new DefaultSetting("boolean", true),
					marketSearch: new DefaultSetting("boolean", true),
					bazaarUsingExternal: new DefaultSetting("boolean", true),
					calculator: new DefaultSetting("boolean", true),
					stocksOverview: new DefaultSetting("boolean", true),
					notifications: new DefaultSetting("boolean", true),
					defaultTab: new DefaultSetting("string", "dashboard"),
					showStakeouts: new DefaultSetting("boolean", true),
					showIcons: new DefaultSetting("boolean", true),
					fullBarTime: new DefaultSetting("boolean", false)
				},
				icon: {
					global: new DefaultSetting("boolean", true),
					energy: new DefaultSetting("boolean", true),
					nerve: new DefaultSetting("boolean", true),
					happy: new DefaultSetting("boolean", true),
					life: new DefaultSetting("boolean", true),
					chain: new DefaultSetting("boolean", true),
					travel: new DefaultSetting("boolean", true)
				},
				education: {
					greyOut: new DefaultSetting("boolean", true),
					finishTime: new DefaultSetting("boolean", true)
				},
				jail: { filter: new DefaultSetting("boolean", true) },
				bank: {
					investmentInfo: new DefaultSetting("boolean", true),
					investmentDueTime: new DefaultSetting("boolean", true)
				},
				home: {
					networthDetails: new DefaultSetting("boolean", true),
					effectiveStats: new DefaultSetting("boolean", true)
				},
				items: {
					quickItems: new DefaultSetting("boolean", true),
					values: new DefaultSetting("boolean", true),
					drugDetails: new DefaultSetting("boolean", true),
					marketLinks: new DefaultSetting("boolean", false),
					highlightBloodBags: new DefaultSetting("string", "none"),
					missingFlowers: new DefaultSetting("boolean", false),
					missingPlushies: new DefaultSetting("boolean", false),
					missingBooks: new DefaultSetting("boolean", false),
					bookEffects: new DefaultSetting("boolean", true),
					canGains: new DefaultSetting("boolean", true),
					nerveGains: new DefaultSetting("boolean", true),
					candyHappyGains: new DefaultSetting("boolean", true),
					energyWarning: new DefaultSetting("boolean", true),
					medicalLife: new DefaultSetting("boolean", true),
					openedSupplyPackValue: new DefaultSetting("boolean", true),
					hideRecycleMessage: new DefaultSetting("boolean", false),
					hideTooManyItemsWarning: new DefaultSetting("boolean", false)
				},
				crimes: { quickCrimes: new DefaultSetting("boolean", true) },
				companies: {
					idBesideCompanyName: new DefaultSetting("boolean", false),
					specials: new DefaultSetting("boolean", true),
					autoStockFill: new DefaultSetting("boolean", true),
					employeeEffectiveness: new DefaultSetting("number", 18)
				},
				travel: {
					computer: new DefaultSetting("boolean", true),
					table: new DefaultSetting("boolean", true),
					cleanFlight: new DefaultSetting("boolean", false),
					tabTitleTimer: new DefaultSetting("boolean", false),
					travelProfits: new DefaultSetting("boolean", true),
					fillMax: new DefaultSetting("boolean", true),
					peopleFilter: new DefaultSetting("boolean", true),
					landingTime: new DefaultSetting("boolean", true),
					flyingTime: new DefaultSetting("boolean", true),
					itemFilter: new DefaultSetting("boolean", true),
					energyWarning: new DefaultSetting("boolean", true),
					cooldownWarnings: new DefaultSetting("boolean", true),
					autoTravelTableCountry: new DefaultSetting("boolean", false),
					autoFillMax: new DefaultSetting("boolean", true),
					efficientRehab: new DefaultSetting("boolean", true),
					efficientRehabSelect: new DefaultSetting("boolean", false),
					hideInventoryButton: new DefaultSetting("boolean", true),
					fastHunting: new DefaultSetting("boolean", true)
				},
				stocks: {
					filter: new DefaultSetting("boolean", true),
					acronyms: new DefaultSetting("boolean", true),
					valueAndProfit: new DefaultSetting("boolean", true),
					moneyInput: new DefaultSetting("boolean", true)
				},
				competitions: {
					easterEggs: new DefaultSetting("boolean", false),
					easterEggsAlert: new DefaultSetting("boolean", true)
				},
				events: { worth: new DefaultSetting("boolean", true) },
				hospital: { filter: new DefaultSetting("boolean", true) },
				auction: {
					filter: new DefaultSetting("boolean", true),
					movePagination: new DefaultSetting("boolean", false)
				},
				api: {
					autoFillKey: new DefaultSetting("boolean", true),
					autoDemo: new DefaultSetting("boolean", false),
					autoPretty: new DefaultSetting("boolean", true),
					clickableSelections: new DefaultSetting("boolean", true)
				},
				forums: {
					menu: new DefaultSetting("boolean", true),
					hidePosts: new DefaultSetting("object", {}),
					hideThreads: new DefaultSetting("object", {}),
					highlightPosts: new DefaultSetting("object", {}),
					highlightThreads: new DefaultSetting("object", {}),
					ignoredThreads: new DefaultSetting("object", {}),
					debugInfoBtn: new DefaultSetting("boolean", true),
					onlyNewFeedButton: new DefaultSetting("boolean", true)
				},
				bazaar: {
					itemsCost: new DefaultSetting("boolean", true),
					worth: new DefaultSetting("boolean", true),
					fillMax: new DefaultSetting("boolean", true),
					maxBuyIgnoreCash: new DefaultSetting("boolean", false),
					highlightSubVendorItems: new DefaultSetting("boolean", false)
				},
				trade: {
					itemValues: new DefaultSetting("boolean", true),
					openChat: new DefaultSetting("boolean", true)
				},
				displayCase: { worth: new DefaultSetting("boolean", true) },
				shops: {
					fillMax: new DefaultSetting("boolean", true),
					maxBuyIgnoreCash: new DefaultSetting("boolean", false),
					profit: new DefaultSetting("boolean", true),
					filters: new DefaultSetting("boolean", true),
					values: new DefaultSetting("boolean", true)
				},
				casino: {
					netTotal: new DefaultSetting("boolean", true),
					blackjack: new DefaultSetting("boolean", true),
					highlow: new DefaultSetting("boolean", false),
					highlowMovement: new DefaultSetting("boolean", true)
				},
				racing: {
					winPercentage: new DefaultSetting("boolean", true),
					upgrades: new DefaultSetting("boolean", true),
					filter: new DefaultSetting("boolean", true)
				},
				faction: {
					idBesideFactionName: new DefaultSetting("boolean", false),
					csvRaidReport: new DefaultSetting("boolean", true),
					csvRankedWarReport: new DefaultSetting("boolean", true),
					csvWarReport: new DefaultSetting("boolean", true),
					csvChainReport: new DefaultSetting("boolean", true),
					csvChallengeContributions: new DefaultSetting("boolean", true),
					openOc: new DefaultSetting("boolean", true),
					highlightOwn: new DefaultSetting("boolean", true),
					availablePlayers: new DefaultSetting("boolean", true),
					recommendedNnb: new DefaultSetting("boolean", true),
					ocNnb: new DefaultSetting("boolean", true),
					ocTimes: new DefaultSetting("boolean", true),
					ocLastAction: new DefaultSetting("boolean", true),
					banker: new DefaultSetting("boolean", true),
					showFullInfobox: new DefaultSetting("boolean", true),
					foldableInfobox: new DefaultSetting("boolean", true),
					numberMembers: new DefaultSetting("boolean", true),
					warFinishTimes: new DefaultSetting("boolean", false),
					memberFilter: new DefaultSetting("boolean", true),
					memberFilterRevivable: new DefaultSetting("boolean", false),
					armoryFilter: new DefaultSetting("boolean", true),
					armoryWorth: new DefaultSetting("boolean", true),
					upgradeRequiredRespect: new DefaultSetting("boolean", true),
					memberInfo: new DefaultSetting("boolean", false),
					rankedWarFilter: new DefaultSetting("boolean", true),
					quickItems: new DefaultSetting("boolean", true),
					stakeout: new DefaultSetting("boolean", true),
					showFactionSpy: new DefaultSetting("boolean", true),
					oc2Filter: new DefaultSetting("boolean", true),
					warnCrime: new DefaultSetting("boolean", false),
					rankedWarValue: new DefaultSetting("boolean", true),
					totalChallengeContributions: new DefaultSetting("boolean", true),
					memberRevives: new DefaultSetting("boolean", true),
					warReportHighlight: new DefaultSetting("boolean", true)
				},
				property: {
					value: new DefaultSetting("boolean", true),
					happy: new DefaultSetting("boolean", true)
				},
				gym: {
					specialist: new DefaultSetting("boolean", true),
					disableStats: new DefaultSetting("boolean", true),
					graph: new DefaultSetting("boolean", true),
					steadfast: new DefaultSetting("boolean", true),
					progress: new DefaultSetting("boolean", true)
				},
				missions: {
					hints: new DefaultSetting("boolean", true),
					rewards: new DefaultSetting("boolean", true)
				},
				attack: {
					bonusInformation: new DefaultSetting("boolean", true),
					timeoutWarning: new DefaultSetting("boolean", true),
					fairAttack: new DefaultSetting("boolean", true),
					weaponExperience: new DefaultSetting("boolean", true),
					hideAttackButtons: new DefaultSetting("array", [])
				},
				city: {
					items: new DefaultSetting("boolean", true),
					combineDuplicates: new DefaultSetting("boolean", true),
					groupByPeriod: new DefaultSetting("boolean", false),
					groupByPeriodUnit: new DefaultSetting("string", "day")
				},
				joblist: { specials: new DefaultSetting("boolean", true) },
				bounties: { filter: new DefaultSetting("boolean", true) },
				userlist: { filter: new DefaultSetting("boolean", true) },
				itemmarket: {
					highlightCheapItems: new DefaultSetting("number|empty", ""),
					highlightCheapItemsSound: new DefaultSetting("boolean", false),
					leftBar: new DefaultSetting("boolean", false),
					fillMax: new DefaultSetting("boolean", true)
				},
				competition: { filter: new DefaultSetting("boolean", true) },
				museum: { autoFill: new DefaultSetting("boolean", true) },
				enemies: { filter: new DefaultSetting("boolean", true) },
				friends: { filter: new DefaultSetting("boolean", true) },
				targets: { filter: new DefaultSetting("boolean", true) },
				crimes2: { value: new DefaultSetting("boolean", true) }
			},
			scripts: {
				noConfirm: {
					itemEquip: new DefaultSetting("boolean", true),
					tradeAccept: new DefaultSetting("boolean", false),
					pointsMarketRemove: new DefaultSetting("boolean", false),
					pointsMarketBuy: new DefaultSetting("boolean", false),
					abroadItemBuy: new DefaultSetting("boolean", true),
					propertiesSell: new DefaultSetting("boolean", false)
				},
				achievements: {
					show: new DefaultSetting("boolean", true),
					completed: new DefaultSetting("boolean", false)
				},
				reminders: {
					finished: new DefaultSetting("boolean", false),
					show: new DefaultSetting("boolean", true),
					types: {
						energyRefill: new DefaultSetting("boolean", true),
						nerveRefill: new DefaultSetting("boolean", true),
						medicalCooldown: new DefaultSetting("boolean", true),
						boosterCooldown: new DefaultSetting("boolean", true),
						drugCooldown: new DefaultSetting("boolean", true),
						bankInvestment: new DefaultSetting("boolean", true),
						virusCoding: new DefaultSetting("boolean", true),
						missionReward: new DefaultSetting("boolean", true),
						oc: new DefaultSetting("boolean", true),
						ocItem: new DefaultSetting("boolean", true),
						race: new DefaultSetting("boolean", true),
						education: new DefaultSetting("boolean", true)
					}
				},
				lastAction: {
					factionMember: new DefaultSetting("boolean", false),
					companyOwn: new DefaultSetting("boolean", false),
					companyOther: new DefaultSetting("boolean", false)
				},
				statsEstimate: {
					global: new DefaultSetting("boolean", true),
					delay: new DefaultSetting("number", 1500),
					cachedOnly: new DefaultSetting("boolean", true),
					displayNoResult: new DefaultSetting("boolean", false),
					maxLevel: new DefaultSetting("number", 100),
					profiles: new DefaultSetting("boolean", true),
					enemies: new DefaultSetting("boolean", true),
					hof: new DefaultSetting("boolean", true),
					attacks: new DefaultSetting("boolean", true),
					userlist: new DefaultSetting("boolean", true),
					bounties: new DefaultSetting("boolean", true),
					factions: new DefaultSetting("boolean", true),
					wars: new DefaultSetting("boolean", true),
					abroad: new DefaultSetting("boolean", true),
					competition: new DefaultSetting("boolean", true),
					rankedWars: new DefaultSetting("boolean", true),
					targets: new DefaultSetting("boolean", true)
				},
				ffScouter: {
					miniProfile: new DefaultSetting("boolean", true),
					profile: new DefaultSetting("boolean", true),
					attack: new DefaultSetting("boolean", true),
					factionList: new DefaultSetting("boolean", true),
					gauge: new DefaultSetting("boolean", true)
				}
			},
			external: {
				tornstats: new DefaultSetting("boolean", false),
				yata: new DefaultSetting("boolean", false),
				prometheus: new DefaultSetting("boolean", false),
				lzpt: new DefaultSetting("boolean", false),
				tornw3b: new DefaultSetting("boolean", false),
				ffScouter: new DefaultSetting("boolean", false),
				tornintel: new DefaultSetting("boolean", false),
				playgroundTorntools: new DefaultSetting("boolean", false)
			},
			servicePreferences: {
				spies: {
					tornstats: {
						enabled: new DefaultSetting("boolean", true),
						priority: new DefaultSetting("number", 1)
					},
					yata: {
						enabled: new DefaultSetting("boolean", true),
						priority: new DefaultSetting("number", 2)
					}
				},
				factionSpies: {
					tornstats: {
						enabled: new DefaultSetting("boolean", true),
						priority: new DefaultSetting("number", 1)
					},
					yata: {
						enabled: new DefaultSetting("boolean", true),
						priority: new DefaultSetting("number", 2)
					}
				},
				travelData: {
					prometheus: {
						enabled: new DefaultSetting("boolean", true),
						priority: new DefaultSetting("number", 1)
					},
					tornintel: {
						enabled: new DefaultSetting("boolean", true),
						priority: new DefaultSetting("number", 1)
					},
					yata: {
						enabled: new DefaultSetting("boolean", true),
						priority: new DefaultSetting("number", 2)
					}
				}
			},
			reporting: {}
		},
		filters: {
			hospital: {
				enabled: new DefaultSetting("boolean", true),
				timeStart: new DefaultSetting("number", 0),
				timeEnd: new DefaultSetting("number", 100),
				levelStart: new DefaultSetting("number", 0),
				levelEnd: new DefaultSetting("number", 100),
				faction: new DefaultSetting("string", ""),
				activity: new DefaultSetting("array", []),
				revivesOn: new DefaultSetting("boolean", false)
			},
			jail: {
				enabled: new DefaultSetting("boolean", true),
				activity: new DefaultSetting("array", []),
				faction: new DefaultSetting("string", "All"),
				timeStart: new DefaultSetting("number", 0),
				timeEnd: new DefaultSetting("number", 100),
				levelStart: new DefaultSetting("number", 1),
				levelEnd: new DefaultSetting("number", 100),
				scoreStart: new DefaultSetting("number", 0),
				scoreEnd: new DefaultSetting("number", 5e3),
				bailCost: new DefaultSetting("number", -1)
			},
			racing: {
				enabled: new DefaultSetting("boolean", true),
				hideRaces: new DefaultSetting("array", []),
				timeStart: new DefaultSetting("number", 0),
				timeEnd: new DefaultSetting("number", 48),
				driversMin: new DefaultSetting("number", 2),
				driversMax: new DefaultSetting("number", 100),
				lapsMin: new DefaultSetting("number", 1),
				lapsMax: new DefaultSetting("number", 100),
				track: new DefaultSetting("array", []),
				name: new DefaultSetting("string", ""),
				exemptions: new DefaultSetting("array", [])
			},
			containers: new DefaultSetting("object", {}),
			travel: {
				open: new DefaultSetting("boolean", false),
				type: new DefaultSetting("string", "basic"),
				categories: new DefaultSetting("array", []),
				countries: new DefaultSetting("array", []),
				hideOutOfStock: new DefaultSetting("boolean", false),
				applySalesTax: new DefaultSetting("boolean", false),
				sellAnonymously: new DefaultSetting("boolean", false)
			},
			abroadPeople: {
				enabled: new DefaultSetting("boolean", true),
				activity: new DefaultSetting("array", []),
				status: new DefaultSetting("array", []),
				levelStart: new DefaultSetting("number", 0),
				levelEnd: new DefaultSetting("number", 100),
				faction: new DefaultSetting("string", ""),
				special: {
					newPlayer: new DefaultSetting("string", "both"),
					inCompany: new DefaultSetting("string", "both"),
					inFaction: new DefaultSetting("string", "both"),
					isDonator: new DefaultSetting("string", "both"),
					hasBounties: new DefaultSetting("string", "both"),
					bazaarOpen: new DefaultSetting("string", "both")
				},
				estimates: new DefaultSetting("array", []),
				ffScoreMax: new DefaultSetting("number", null),
				ffScoreMin: new DefaultSetting("number", null)
			},
			abroadItems: {
				enabled: new DefaultSetting("boolean", true),
				profitOnly: new DefaultSetting("boolean", false),
				outOfStock: new DefaultSetting("boolean", false),
				categories: new DefaultSetting("array", []),
				taxes: new DefaultSetting("array", [])
			},
			trade: { hideValues: new DefaultSetting("boolean", false) },
			gym: {
				specialist1: new DefaultSetting("string", "none"),
				specialist2: new DefaultSetting("string", "none"),
				strength: new DefaultSetting("boolean", false),
				speed: new DefaultSetting("boolean", false),
				defense: new DefaultSetting("boolean", false),
				dexterity: new DefaultSetting("boolean", false)
			},
			city: { highlightItems: new DefaultSetting("boolean", true) },
			bounties: {
				maxLevel: new DefaultSetting("number", 100),
				hideUnavailable: new DefaultSetting("boolean", false)
			},
			userlist: {
				enabled: new DefaultSetting("boolean", true),
				activity: new DefaultSetting("array", []),
				levelStart: new DefaultSetting("number", 0),
				levelEnd: new DefaultSetting("number", 100),
				special: {
					fedded: new DefaultSetting("string", "both"),
					fallen: new DefaultSetting("string", "both"),
					traveling: new DefaultSetting("string", "both"),
					newPlayer: new DefaultSetting("string", "both"),
					onWall: new DefaultSetting("string", "both"),
					inCompany: new DefaultSetting("string", "both"),
					inFaction: new DefaultSetting("string", "both"),
					isDonator: new DefaultSetting("string", "both"),
					inHospital: new DefaultSetting("string", "both"),
					inJail: new DefaultSetting("string", "both"),
					earlyDischarge: new DefaultSetting("string", "both"),
					hasBounties: new DefaultSetting("string", "both"),
					bazaarOpen: new DefaultSetting("string", "both")
				},
				hospReason: {
					attackedBy: new DefaultSetting("string", "both"),
					muggedBy: new DefaultSetting("string", "both"),
					hospitalizedBy: new DefaultSetting("string", "both"),
					other: new DefaultSetting("string", "both")
				},
				estimates: new DefaultSetting("array", []),
				ffScoreMax: new DefaultSetting("number", null),
				ffScoreMin: new DefaultSetting("number", null)
			},
			stocks: {
				enabled: new DefaultSetting("boolean", true),
				name: new DefaultSetting("string", ""),
				investment: {
					owned: new DefaultSetting("string", "both"),
					benefit: new DefaultSetting("string", "both"),
					passive: new DefaultSetting("string", "both"),
					collectionReady: new DefaultSetting("string", "both")
				},
				price: {
					price: new DefaultSetting("string", "both"),
					profit: new DefaultSetting("string", "both")
				}
			},
			faction: {
				enabled: new DefaultSetting("boolean", true),
				activity: new DefaultSetting("array", []),
				levelStart: new DefaultSetting("number", 1),
				levelEnd: new DefaultSetting("number", 100),
				lastActionStart: new DefaultSetting("number", 0),
				lastActionEnd: new DefaultSetting("number", -1),
				status: new DefaultSetting("array", []),
				position: new DefaultSetting("string", ""),
				special: {
					fedded: new DefaultSetting("string", "both"),
					fallen: new DefaultSetting("string", "both"),
					newPlayer: new DefaultSetting("string", "both"),
					inCompany: new DefaultSetting("string", "both"),
					isDonator: new DefaultSetting("string", "both"),
					isRecruit: new DefaultSetting("string", "both")
				},
				ffScoreMax: new DefaultSetting("number", null),
				ffScoreMin: new DefaultSetting("number", null),
				revivable: new DefaultSetting("array", [])
			},
			factionArmory: {
				enabled: new DefaultSetting("boolean", true),
				hideUnavailable: new DefaultSetting("boolean", false),
				weapons: {
					name: new DefaultSetting("string", ""),
					category: new DefaultSetting("string", ""),
					rarity: new DefaultSetting("string", ""),
					weaponType: new DefaultSetting("string", ""),
					damage: new DefaultSetting("string", ""),
					accuracy: new DefaultSetting("string", ""),
					weaponBonus: new DefaultSetting("array", [])
				},
				armor: {
					name: new DefaultSetting("string", ""),
					rarity: new DefaultSetting("string", ""),
					defence: new DefaultSetting("string", ""),
					set: new DefaultSetting("string", ""),
					armorBonus: new DefaultSetting("string", "")
				},
				temporary: { name: new DefaultSetting("string", "") }
			},
			factionRankedWar: {
				enabled: new DefaultSetting("boolean", true),
				activity: new DefaultSetting("array", []),
				status: new DefaultSetting("array", []),
				levelStart: new DefaultSetting("number", 1),
				levelEnd: new DefaultSetting("number", 100),
				estimates: new DefaultSetting("array", []),
				ffScoreMax: new DefaultSetting("number", null),
				ffScoreMin: new DefaultSetting("number", null)
			},
			profile: {
				relative: new DefaultSetting("boolean", false),
				stats: new DefaultSetting("array", [])
			},
			competition: {
				levelStart: new DefaultSetting("number", 1),
				levelEnd: new DefaultSetting("number", 100),
				estimates: new DefaultSetting("array", [])
			},
			shops: {
				hideLoss: new DefaultSetting("boolean", false),
				hideUnder100: new DefaultSetting("boolean", false)
			},
			auction: {
				enabled: new DefaultSetting("boolean", true),
				weapons: {
					name: new DefaultSetting("string", ""),
					category: new DefaultSetting("string", ""),
					rarity: new DefaultSetting("string", ""),
					weaponType: new DefaultSetting("string", ""),
					damage: new DefaultSetting("string", ""),
					accuracy: new DefaultSetting("string", ""),
					weaponBonus: new DefaultSetting("array", []),
					quality: new DefaultSetting("string", "")
				},
				armor: {
					name: new DefaultSetting("string", ""),
					rarity: new DefaultSetting("string", ""),
					defence: new DefaultSetting("string", ""),
					set: new DefaultSetting("string", ""),
					armorBonus: new DefaultSetting("string", "")
				},
				items: {
					name: new DefaultSetting("string", ""),
					category: new DefaultSetting("string", ""),
					rarity: new DefaultSetting("string", "")
				}
			},
			enemies: {
				enabled: new DefaultSetting("boolean", true),
				activity: new DefaultSetting("array", []),
				levelStart: new DefaultSetting("number", 0),
				levelEnd: new DefaultSetting("number", 100),
				estimates: new DefaultSetting("array", []),
				ffScoreMax: new DefaultSetting("number", null),
				ffScoreMin: new DefaultSetting("number", null)
			},
			friends: {
				enabled: new DefaultSetting("boolean", true),
				activity: new DefaultSetting("array", []),
				levelStart: new DefaultSetting("number", 0),
				levelEnd: new DefaultSetting("number", 100)
			},
			targets: {
				enabled: new DefaultSetting("boolean", true),
				activity: new DefaultSetting("array", []),
				levelStart: new DefaultSetting("number", 0),
				levelEnd: new DefaultSetting("number", 100),
				estimates: new DefaultSetting("array", []),
				ffScoreMax: new DefaultSetting("number", null),
				ffScoreMin: new DefaultSetting("number", null)
			},
			oc2: {
				enabled: new DefaultSetting("boolean", true),
				difficulty: new DefaultSetting("array", []),
				status: new DefaultSetting("array", [])
			}
		},
		userdata: new DefaultSetting("object", { date: -1 }),
		torndata: new DefaultSetting("object", { date: -2 }),
		stockdata: {
			date: new DefaultSetting("number", 0),
			stocks: new DefaultSetting("array", [])
		},
		factiondata: new DefaultSetting("object", {}),
		localdata: {
			tradeMessage: new DefaultSetting("number", 0),
			popup: { calculatorItems: new DefaultSetting("array", []) },
			vault: {
				initialized: new DefaultSetting("boolean", false),
				lastTransaction: new DefaultSetting("string", ""),
				total: new DefaultSetting("number", 0),
				user: {
					initial: new DefaultSetting("number", 0),
					current: new DefaultSetting("number", 0)
				},
				partner: {
					initial: new DefaultSetting("number", 0),
					current: new DefaultSetting("number", 0)
				}
			},
			chatResize: new DefaultSetting("object", {}),
			feedHidden: new DefaultSetting("object", {}),
			threadsHiddenInFeed: new DefaultSetting("array", []),
			hiddenTravelInventory: new DefaultSetting("boolean", false)
		},
		stakeouts: new DefaultSetting("object", {
			list: [],
			date: 0
		}),
		factionStakeouts: new DefaultSetting("object", {
			list: [],
			date: 0
		}),
		attackHistory: {
			fetchData: new DefaultSetting("boolean", true),
			lastAttack: new DefaultSetting("number", 0),
			history: new DefaultSetting("object", {})
		},
		notes: {
			sidebar: {
				text: new DefaultSetting("string", ""),
				height: new DefaultSetting("string", "22px")
			},
			profile: new DefaultSetting("object", {})
		},
		quick: {
			items: new DefaultSetting("array", []),
			factionItems: new DefaultSetting("array", []),
			crimes: new DefaultSetting("array", []),
			jail: new DefaultSetting("array", [])
		},
		cache: new DefaultSetting("object", {}),
		npcs: new DefaultSetting("object", {}),
		notificationHistory: new DefaultSetting("array", []),
		notifications: {
			events: new DefaultSetting("object", {}),
			messages: new DefaultSetting("object", {}),
			newDay: new DefaultSetting("object", {}),
			energy: new DefaultSetting("object", {}),
			happy: new DefaultSetting("object", {}),
			nerve: new DefaultSetting("object", {}),
			life: new DefaultSetting("object", {}),
			travel: new DefaultSetting("object", {}),
			drugs: new DefaultSetting("object", {}),
			boosters: new DefaultSetting("object", {}),
			medical: new DefaultSetting("object", {}),
			hospital: new DefaultSetting("object", {}),
			chain: new DefaultSetting("object", {}),
			chainCount: new DefaultSetting("object", {}),
			stakeouts: new DefaultSetting("object", {}),
			npcs: new DefaultSetting("object", {}),
			offline: new DefaultSetting("object", {}),
			missionsLimit: new DefaultSetting("object", {}),
			missionsExpire: new DefaultSetting("object", {}),
			refillEnergy: new DefaultSetting("object", {}),
			refillNerve: new DefaultSetting("object", {})
		},
		migrations: new DefaultSetting("array", [])
	};
	function getDefaultStorage(defaultStorage) {
		const newStorage = {};
		for (const key in defaultStorage) if (typeof defaultStorage[key] === "object") {
			const setting = defaultStorage[key];
			if (setting instanceof DefaultSetting && "defaultValue" in setting) switch (typeof setting.defaultValue) {
				case "function":
					newStorage[key] = setting.defaultValue();
					break;
				case "boolean":
				case "number":
				case "string":
				case "object":
					newStorage[key] = setting.defaultValue;
					break;
				default:
					newStorage[key] = setting.defaultValue;
					break;
			}
			else newStorage[key] = getDefaultStorage(defaultStorage[key]);
		} else newStorage[key] = defaultStorage[key];
		return newStorage;
	}
	//#endregion
	//#region node_modules/wxt/dist/browser.mjs
	/**
	* Contains the `browser` export which you should use to access the extension
	* APIs in your project:
	*
	* ```ts
	* import { browser } from 'wxt/browser';
	*
	* browser.runtime.onInstalled.addListener(() => {
	*   // ...
	* });
	* ```
	*
	* @module wxt/browser
	*/
	var browser = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
	//#endregion
	//#region src/common/utils/functions/browser.ts
	function usingFirefox() {
		return navigator.userAgent.includes("Firefox");
	}
	function hasSilentSupport() {
		if (navigator.userAgentData) return navigator.userAgentData.brands.some(({ brand }) => brand === "Chromium");
		else return !usingFirefox();
	}
	function hasInteractionSupport() {
		if (navigator.userAgentData) return navigator.userAgentData.brands.some(({ brand }) => brand === "Chromium");
		else return !usingFirefox();
	}
	//#endregion
	//#region src/common/utils/functions/requires.ts
	function requireCondition(condition, partialOptions = {}) {
		const options = {
			delay: 50,
			maxCycles: 100,
			...partialOptions
		};
		const error = /* @__PURE__ */ new Error("Maximum cycles reached.");
		return new Promise((resolve, reject) => {
			if (checkCondition()) return;
			let counter = 0;
			const checker = setInterval(() => {
				if (checkCounter(counter++) || checkCondition()) return clearInterval(checker);
			}, options.delay);
			function checkCondition() {
				const response = condition();
				if (!response) return false;
				if (typeof response === "boolean") if (response) resolve(response);
				else reject();
				else if (typeof response === "object") if ("success" in response) if (response.success === true) resolve(response.value);
				else reject(response.value);
				else resolve(response);
				return true;
			}
			function checkCounter(count) {
				if (options.maxCycles <= 0) return false;
				if (count > options.maxCycles) {
					reject(error);
					return true;
				}
				return false;
			}
		});
	}
	function checkListener(listener, entry) {
		const element = listener.parent.querySelector(listener.selector);
		if (!(listener.invert ? !element : !!element)) return false;
		if (listener.timeoutId) clearTimeout(listener.timeoutId);
		entry.listeners.delete(listener);
		listener.resolve(listener.invert ? true : element);
		cleanupEntryIfEmpty(entry);
		return true;
	}
	function cleanupEntryIfEmpty(entry) {
		if (entry.listeners.size > 0) return;
		entry.observer.disconnect();
		observerRegistry.delete(entry.parent);
	}
	function removeListenerFromRegistry(listener) {
		const entry = observerRegistry.get(listener.parent);
		if (!entry) return;
		entry.listeners.delete(listener);
		cleanupEntryIfEmpty(entry);
	}
	function requireElement(selector, attributes = {}) {
		const options = {
			invert: false,
			parent: document,
			timeout: TO_MILLIS.SECONDS * 5,
			observerOptions: {
				childList: true,
				subtree: true
			},
			...attributes
		};
		const error = /* @__PURE__ */ new Error("Maximum cycles reached.");
		return new Promise((resolve, reject) => {
			const element = options.parent.querySelector(selector);
			if (options.invert && !element) {
				resolve(true);
				return;
			} else if (!options.invert && element) {
				resolve(element);
				return;
			}
			const timeoutId = options.timeout > 0 ? window.setTimeout(() => {
				removeListenerFromRegistry(listener);
				reject(error);
			}, options.timeout) : null;
			const listener = {
				selector,
				invert: options.invert,
				parent: options.parent,
				resolve,
				reject,
				timeoutId
			};
			getOrCreateObserverEntry(options.parent).listeners.add(listener);
		});
	}
	var observerRegistry = /* @__PURE__ */ new Map();
	function getOrCreateObserverEntry(parent) {
		const existing = observerRegistry.get(parent);
		if (existing) return existing;
		const observer = new MutationObserver(() => {
			const entry = observerRegistry.get(parent);
			if (!entry) return;
			entry.listeners.forEach((listener) => checkListener(listener, entry));
		});
		const entry = {
			parent,
			observer,
			listeners: /* @__PURE__ */ new Set()
		};
		observerRegistry.set(parent, entry);
		observer.observe(parent, {
			childList: true,
			subtree: true
		});
		return entry;
	}
	function requireDOMContentLoaded() {
		return new Promise((resolve) => {
			if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
			else resolve();
		});
	}
	function requireDOMInteractive() {
		return new Promise((resolve) => {
			if (document.readyState === "loading") document.addEventListener("readystatechange", () => resolve(), { once: true });
			else resolve();
		});
	}
	//#endregion
	//#region src/common/utils/svg-helper.ts
	function svgImport(svgImport) {
		if (typeof svgImport !== "string") return (attributes = {}) => createFallbackElement(attributes);
		if (svgImport.startsWith("data:image/svg+xml")) {
			const encodedData = svgImport.substring(19);
			let svgContent;
			try {
				svgContent = decodeURIComponent(encodedData);
			} catch (error) {
				console.error("Failed to decode SVG data URL", error);
				return (attributes = {}) => createFallbackElement(attributes);
			}
			return (attributes = {}) => createSvgElement(svgContent, attributes);
		}
		return (attributes = {}) => createSvgElement(svgImport, attributes);
	}
	function createFallbackElement(attributes) {
		const svgNS = "http://www.w3.org/2000/svg";
		const svg = document.createElementNS(svgNS, "svg");
		svg.setAttribute("width", "24");
		svg.setAttribute("height", "24");
		svg.setAttribute("viewBox", "0 0 24 24");
		Object.entries(attributes).filter(([, value]) => value !== false && value !== null && value !== void 0).map(([key, value]) => svg.setAttribute(key, String(value)));
		const rect = document.createElementNS(svgNS, "rect");
		rect.setAttribute("x", "0");
		rect.setAttribute("y", "0");
		rect.setAttribute("width", "24");
		rect.setAttribute("height", "24");
		rect.setAttribute("fill", "red");
		svg.appendChild(rect);
		return svg;
	}
	function createSvgElement(svgContent, attributes = {}) {
		const fullAttributes = {
			width: "size" in attributes ? attributes.size : "1em",
			height: "size" in attributes ? attributes.size : "1em",
			...attributes
		};
		const svg = elementBuilder({
			type: "template",
			html: svgContent.trim()
		}).content.firstChild;
		if (!isSVGElement(svg)) return createFallbackElement(fullAttributes);
		Object.entries(fullAttributes).filter(([, value]) => value !== false && value !== null && value !== void 0).forEach(([key, value]) => svg.setAttribute(key, String(value)));
		return svg;
	}
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/bold/check-bold.svg
	var check_bold_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/bold/copy-bold.svg
	var copy_bold_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M216,28H88A12,12,0,0,0,76,40V76H40A12,12,0,0,0,28,88V216a12,12,0,0,0,12,12H168a12,12,0,0,0,12-12V180h36a12,12,0,0,0,12-12V40A12,12,0,0,0,216,28ZM156,204H52V100H156Zm48-48H180V88a12,12,0,0,0-12-12H100V52H204Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/bold/spinner-gap-bold.svg
	var spinner_gap_bold_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M140,32V64a12,12,0,0,1-24,0V32a12,12,0,0,1,24,0Zm84,84H192a12,12,0,0,0,0,24h32a12,12,0,0,0,0-24Zm-42.26,48.77a12,12,0,1,0-17,17l22.63,22.63a12,12,0,0,0,17-17ZM128,180a12,12,0,0,0-12,12v32a12,12,0,0,0,24,0V192A12,12,0,0,0,128,180ZM74.26,164.77,51.63,187.4a12,12,0,0,0,17,17l22.63-22.63a12,12,0,1,0-17-17ZM76,128a12,12,0,0,0-12-12H32a12,12,0,0,0,0,24H64A12,12,0,0,0,76,128ZM68.6,51.63a12,12,0,1,0-17,17L74.26,91.23a12,12,0,0,0,17-17Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/regular/question.svg
	var question_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M140,180a12,12,0,1,1-12-12A12,12,0,0,1,140,180ZM128,72c-22.06,0-40,16.15-40,36v4a8,8,0,0,0,16,0v-4c0-11,10.77-20,24-20s24,9,24,20-10.77,20-24,20a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-.72c18.24-3.35,32-17.9,32-35.28C168,88.15,150.06,72,128,72Zm104,56A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/regular/x-circle.svg
	var x_circle_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M165.66,101.66,139.31,128l26.35,26.34a8,8,0,0,1-11.32,11.32L128,139.31l-26.34,26.35a8,8,0,0,1-11.32-11.32L116.69,128,90.34,101.66a8,8,0,0,1,11.32-11.32L128,116.69l26.34-26.35a8,8,0,0,1,11.32,11.32ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z'/%3e%3c/svg%3e";
	//#endregion
	//#region src/common/utils/icons/phosphor-icons.ts
	var lazyImport = (svgData) => {
		let factory;
		return (attributes) => {
			factory ??= svgImport(svgData);
			return factory(attributes);
		};
	};
	var PHQuestion = lazyImport(question_default);
	var PHXCircle = lazyImport(x_circle_default);
	var PHBoldCheck = lazyImport(check_bold_default);
	var PHBoldCopy = lazyImport(copy_bold_default);
	var PHBoldSpinnerGap = lazyImport(spinner_gap_bold_default);
	//#endregion
	//#region src/common/utils/functions/dom.ts
	var mobile;
	var tablet;
	var hasSidebar;
	var tabletHorizontal;
	var tabletVertical;
	function elementBuilder(options) {
		if (typeof options === "string") return document.createElement(options);
		else if (typeof options === "object") {
			options = {
				id: void 0,
				class: void 0,
				text: void 0,
				html: void 0,
				value: void 0,
				href: void 0,
				children: [],
				attributes: {},
				events: {},
				style: {},
				dataset: {},
				...options
			};
			const newElement = document.createElement(options.type);
			if (options.id) newElement.id = options.id;
			if (options.class) newElement.className = Array.isArray(options.class) ? options.class.filter((name) => !!name).join(" ") : options.class.trim();
			if (options.text !== void 0) newElement.textContent = options.text.toString();
			if (options.html) newElement.innerHTML = options.html;
			if (options.value && "value" in newElement) if (typeof options.value === "function") newElement.value = options.value();
			else newElement.value = options.value;
			if (options.href && "href" in newElement) newElement.href = options.href;
			for (const child of options.children?.filter((child) => !!child) || []) if (typeof child === "string") newElement.appendChild(document.createTextNode(child));
			else newElement.appendChild(child);
			if (options.attributes) {
				let attributes = options.attributes;
				if (typeof attributes === "function") attributes = attributes();
				for (const attribute in attributes) newElement.setAttribute(attribute, attributes[attribute].toString());
			}
			for (const event in options.events) newElement.addEventListener(event, options.events[event]);
			for (const key in options.style) newElement.style[key] = options.style[key];
			for (const key in options.dataset) if (typeof options.dataset[key] === "object") newElement.dataset[key] = JSON.stringify(options.dataset[key]);
			else newElement.dataset[key] = options.dataset[key].toString();
			return newElement;
		} else throw new Error("Invalid options provided to newElement.");
	}
	function findAllElements(selector, parent = document) {
		return Array.from(parent.querySelectorAll(selector));
	}
	async function checkDevice() {
		await requireDOMInteractive();
		const innerWidth = window.innerWidth;
		mobile = innerWidth <= 600;
		tablet = innerWidth <= 1e3 && innerWidth >= 600;
		hasSidebar = innerWidth > 1e3;
		tabletHorizontal = tablet && innerWidth >= 784;
		tabletVertical = tablet && !tabletHorizontal;
		return {
			mobile,
			tablet,
			tabletHorizontal,
			tabletVertical,
			hasSidebar
		};
	}
	function isSVGElement(node) {
		return !!node && node instanceof SVGElement;
	}
	//#endregion
	//#region src/common/utils/functions/utilities.ts
	var SCRIPT_TYPE = (() => {
		if (typeof window === "undefined" || window.location.href.endsWith("/_generated_background_page.html")) return "BACKGROUND";
		else if (typeof browser === "object" && browser.action) return "POPUP";
		else if (typeof location !== "undefined" && location.protocol?.includes("extension")) return "INTERNAL_CONTENT";
		else return "CONTENT";
	})();
	function arraysEquals(a1, a2) {
		if (a1.length !== a2.length) return false;
		for (let i = 0; i < a1.length; i++) {
			const x1 = a1[i];
			const x2 = a2[i];
			if (Array.isArray(x1) && Array.isArray(x2)) {
				if (!arraysEquals(x1, x2)) return false;
			} else if (typeof x1 === "object" && typeof x2 === "object") {
				if (!objectsEquals(x1, x2)) return false;
			} else if (x1 !== x2) return false;
		}
		return true;
	}
	function objectsEquals(o1, o2) {
		for (const property in o1) if (Object.hasOwn(o1, property) !== Object.hasOwn(o2, property)) return false;
		else if (typeof o1[property] !== typeof o2[property]) return false;
		for (const property in o2) {
			if (Object.hasOwn(o1, property) !== Object.hasOwn(o2, property)) return false;
			else if (typeof o1[property] !== typeof o2[property]) return false;
			if (!Object.hasOwn(o1, property)) continue;
			const x1 = o1[property];
			const x2 = o2[property];
			if (Array.isArray(x1) && Array.isArray(x2)) {
				if (!arraysEquals(x1, x2)) return false;
			} else if (typeof x1 === "object" && typeof x2 === "object") {
				if (!objectsEquals(x1, x2)) return false;
			} else if (x1 !== x2) return false;
		}
		return true;
	}
	function sleep(millis) {
		return new Promise((resolve) => setTimeout(resolve, millis));
	}
	var TO_MILLIS = {
		SECONDS: 1e3,
		MINUTES: 1e3 * 60,
		HOURS: 1e3 * 60 * 60,
		DAYS: 1e3 * 60 * 60 * 24
	};
	function isSameUTCDay(date1, date2) {
		const _date1 = new Date(date1);
		const _date2 = new Date(date2);
		return _date1.setUTCHours(24, 0, 0, 0) === _date2.setUTCHours(24, 0, 0, 0);
	}
	function getUTCTodayAtTime(hours, minutes) {
		const date = /* @__PURE__ */ new Date();
		date.setUTCHours(hours, minutes);
		return date;
	}
	function hasTimePassed(timestamp, time) {
		const difference = Date.now() - timestamp;
		return Math.abs(difference) >= time;
	}
	function getCookie(cname) {
		const name = `${cname}=`;
		for (let cookie of decodeURIComponent(document.cookie).split(";")) {
			cookie = cookie.trimStart();
			if (cookie.includes(name)) return cookie.substring(name.length);
		}
		return "";
	}
	function toClipboard(text) {
		if (navigator?.clipboard?.writeText) {
			navigator.clipboard.writeText(text).then(() => {});
			return true;
		} else {
			const textarea = elementBuilder({
				type: "textarea",
				value: text,
				style: {
					position: "absolute",
					left: "-9999px"
				},
				attributes: { readonly: "" }
			});
			document.body.appendChild(textarea);
			textarea.select();
			const copied = document.execCommand("copy");
			document.body.removeChild(textarea);
			return copied;
		}
	}
	function toNumericVersion(version) {
		return parseInt(version.split(".").map((part) => part.padStart(3, "0")).join("").padEnd(9, "9"));
	}
	function isTabFocused() {
		return document.hasFocus();
	}
	function isSpeechSynthesisAvailable() {
		return typeof SpeechSynthesisUtterance !== "undefined";
	}
	//#endregion
	//#region src/common/utils/data/migrations.ts
	var MIGRATIONS = [
		{
			id: "43fae1f2-5568-4ae5-b12f-f3625e1e58c6",
			version: "9.0.0",
			execute(database, _flags, _oldStorage) {
				database.cache["personal-stats"] = {};
			}
		},
		{
			id: "b194a6d5-4230-4b03-8a8b-bebd7c431cc9",
			version: "9.0.0",
			execute(database, _flags, _oldStorage) {
				database.settings.pages.api.autoDemo = false;
			}
		},
		{
			id: "b0f539ba-41f8-4eed-93e2-e8523f7c49a5",
			version: "9.0.1",
			execute(database, _flags, oldStorage) {
				const oldCustomLinks = oldStorage?.settings?.customLinks ?? [];
				database.settings.customLinks = oldCustomLinks.map((link) => {
					return link.preset && link.preset !== "custom" ? {
						newTab: link.newTab,
						location: link.location,
						name: link.name,
						preset: link.preset
					} : {
						newTab: link.newTab,
						location: link.location,
						name: link.name,
						href: link.href
					};
				});
			}
		},
		{
			id: "360b1f70-c78b-44c1-b217-24bd6b398bac",
			version: "9.0.5",
			execute(database, _flags, oldStorage) {
				if (!oldStorage?.settings?.userAlias || Array.isArray(oldStorage.settings.userAlias)) return;
				const oldUserAliases = oldStorage.settings.userAlias;
				database.settings.userAlias = Object.entries(oldUserAliases).map(([id, { alias, name }]) => {
					const idMatch = id.match(/^(\d+)$/);
					return idMatch ? {
						userId: parseInt(idMatch[0]),
						userName: name,
						alias
					} : {
						userId: -1,
						userName: name,
						alias,
						incorrectId: id
					};
				});
			}
		},
		{
			id: "95c020eb-2c75-4bbe-8fe9-64f96f108f48",
			version: "9.0.5",
			execute(database, _flags, oldStorage) {
				if (!oldStorage?.settings?.pages?.popup?.defaultTab) return;
				if (oldStorage.settings.pages.popup.defaultTab === "stocks") database.settings.pages.popup.defaultTab = "stocksOverview";
				else if (oldStorage.settings.pages.popup.defaultTab === "market") database.settings.pages.popup.defaultTab = "marketSearch";
			}
		},
		{
			id: "96356911-fecd-4b79-9825-ee5ad422c8fe",
			version: "9.0.5",
			execute(database, _flags, oldStorage) {
				if (typeof oldStorage?.settings?.pages?.popup.hoverBarTime !== "boolean") return;
				database.settings.pages.popup.fullBarTime = oldStorage.settings.pages.popup.hoverBarTime;
			}
		},
		{
			id: "7396191c-35a9-4d92-905a-0e411f9a6823",
			version: "9.0.5",
			execute(_database, _flags, _oldStorage) {
				ttStorage.remove("usage");
			}
		},
		{
			id: "d3e6e03a-698d-4df4-9062-4d3c9ce9d479",
			version: "9.0.5",
			execute(database, _flags, oldStorage) {
				if (!oldStorage?.filters?.travel?.categories?.includes("other")) return;
				database.filters.travel.categories = [...oldStorage.filters.travel.categories, "defensive"];
			}
		},
		{
			id: "700848e9-ee48-42ce-b8b1-893cb471cfe4",
			version: "9.0.6",
			execute(_database, flags, _oldStorage) {
				flags.clearCache = true;
			}
		},
		{
			id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
			version: "9.0.6",
			execute(database, _flags, oldStorage) {
				const oldStakeouts = oldStorage?.stakeouts;
				if (!oldStakeouts || typeof oldStakeouts !== "object") return;
				const reservedKeys = /* @__PURE__ */ new Set([
					"order",
					"date",
					"list"
				]);
				const oldOrder = oldStakeouts.order ?? [];
				const list = [];
				Object.entries(oldStakeouts).filter((entry) => !reservedKeys.has(entry[0])).forEach(([id, data]) => {
					const orderIndex = oldOrder.indexOf(id);
					list.push({
						...data,
						id: parseInt(id),
						order: orderIndex !== -1 ? orderIndex : Date.now()
					});
				});
				database.stakeouts.list = list;
			}
		},
		{
			id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
			version: "9.0.6",
			execute(database, _flags, oldStorage) {
				const oldFactionStakeouts = oldStorage?.factionStakeouts;
				if (!oldFactionStakeouts || typeof oldFactionStakeouts !== "object") return;
				const reservedKeys = /* @__PURE__ */ new Set(["date", "list"]);
				const list = [];
				Object.entries(oldFactionStakeouts).filter((entry) => !reservedKeys.has(entry[0])).forEach(([id, data]) => {
					list.push({
						...data,
						id: parseInt(id),
						order: Date.now()
					});
				});
				database.factionStakeouts.list = list;
			}
		},
		{
			id: "16d7de5c-e9ad-4060-966e-49b4252301c5",
			version: "9.0.7",
			execute(_database, _flags, _oldStorage) {
				OFFLOAD_SERVICE.reinitializeTimers().catch(() => {});
			}
		},
		{
			id: "a1b8db49-f255-43fc-b3b8-dc82b8c072b1",
			version: "9.0.9",
			execute(database, _flags, oldStorage) {
				const owner = oldStorage.userdata?.profile?.id;
				if (!owner) return;
				database.api.torn.owner = owner;
			}
		},
		{
			id: "8a88db28-d02c-4b08-a672-bb73394b5ae4",
			version: "9.0.12",
			execute(_database, _flags, _oldStorage) {
				OFFLOAD_SERVICE.reinitializeTimers().catch(() => {});
			}
		},
		{
			id: "19384047-faaa-4894-a0bb-1695b964a125",
			version: "9.0.14",
			execute(_database, flags, _oldStorage) {
				flags.updateStockdata = true;
			}
		},
		{
			id: "b2102994-0920-4586-8259-0e5beedc7f13",
			version: "9.1.0",
			execute(database, _flags, oldStorage) {
				if (oldStorage.api.torn.owner) return;
				const owner = oldStorage.userdata?.profile?.id;
				if (!owner) return;
				database.api.torn.owner = owner;
			}
		},
		{
			id: "8f883a44-fa45-407b-bdc7-18c6982ab108",
			version: "9.1.0",
			execute(database, _flags, _oldStorage) {
				database.cache["stats-estimate"] = {};
			}
		},
		{
			id: "0e1534e5-a199-429b-9f6d-32eefeae66cd",
			version: "9.1.0",
			execute(_database, flags, _oldStorage) {
				flags.updateUserdata = true;
			}
		}
	];
	async function executeMigrationScripts(storage, oldStorage) {
		if (RUNTIME_INFORMATION.isUserscript()) return;
		const migrations = MIGRATIONS.filter(({ version }) => toNumericVersion(version) >= toNumericVersion(storage.version.initial)).filter(({ id }) => !storage.migrations.map(({ id }) => id).includes(id));
		const flags = {
			updateUserdata: false,
			updateFactiondata: false,
			updateStockdata: false,
			updateTorndata: false,
			clearCache: false
		};
		migrations.reverse().forEach((migration) => {
			migration.execute(storage, flags, oldStorage);
			storage.migrations.push({ id: migration.id });
		});
		if (flags.updateUserdata) storage.userdata.date = 0;
		if (flags.updateFactiondata) storage.factiondata.date = 0;
		if (flags.updateStockdata) storage.stockdata.date = 0;
		if (flags.updateTorndata) storage.torndata.date = 0;
		if (flags.clearCache) storage.cache = {};
	}
	//#endregion
	//#region src/common/utils/data/database.ts
	var settings;
	var filters;
	var version;
	var api;
	var userdata;
	var torndata;
	var stakeouts;
	var attackHistory;
	var notes;
	var factiondata;
	var quick;
	var localdata;
	var npcs;
	var notificationHistory;
	var stockdata;
	var factionStakeouts;
	var notifications;
	var migrations;
	var storageListeners = {
		settings: [],
		filters: [],
		version: [],
		userdata: [],
		torndata: [],
		attackHistory: [],
		stakeouts: [],
		factionStakeouts: [],
		notes: [],
		factiondata: [],
		localdata: [],
		cache: [],
		api: [],
		npcs: [],
		stockdata: [],
		notificationHistory: [],
		notifications: [],
		quick: [],
		migrations: []
	};
	var databaseLoaded = false;
	var databaseLoadPromise = null;
	async function loadDatabase(force = false) {
		if (databaseLoaded && !force) return {
			settings,
			filters,
			version,
			userdata,
			stakeouts,
			factionStakeouts,
			notes,
			factiondata,
			localdata,
			cache: ttCache.cache,
			api,
			npcs,
			torndata,
			notificationHistory,
			attackHistory,
			quick,
			stockdata,
			notifications,
			migrations
		};
		if (databaseLoadPromise) return await databaseLoadPromise;
		databaseLoadPromise = (async () => {
			const database = await ttStorage.get();
			populateDatabaseVariables(database);
			console.debug("TT - Database loaded.");
			return database;
		})();
		try {
			const result = await databaseLoadPromise;
			databaseLoaded = true;
			databaseLoadPromise = null;
			return result;
		} catch (error) {
			databaseLoadPromise = null;
			throw error;
		}
	}
	async function migrateDatabase(force = false) {
		try {
			const loadedStorage = await ttStorage.get();
			if (!loadedStorage || !Object.keys(loadedStorage).length) {
				console.log("TT - Fresh installation detected, setting up default storage.");
				await ttStorage.reset();
				await loadDatabase();
				return;
			}
			const storedVersion = loadedStorage?.version?.current || "5.0.0";
			const currentVersion = RUNTIME_INFORMATION.getVersion();
			console.log(`TT - Migration check: ${storedVersion} -> ${currentVersion}`);
			const migratedStorage = convertStorage(loadedStorage, DEFAULT_STORAGE);
			await executeMigrationScripts(migratedStorage, loadedStorage);
			migratedStorage.version.current = currentVersion;
			await ttStorage.set(migratedStorage);
			populateDatabaseVariables(migratedStorage);
			console.debug("TT - Database migration completed successfully.");
		} catch (error) {
			console.error("TT - Database migration failed:", error);
			await loadDatabase();
		}
	}
	function convertStorage(oldStorage, defaultStorage) {
		const newStorage = {};
		for (const key in defaultStorage) {
			if (!oldStorage) oldStorage = {};
			const defaultValue = defaultStorage[key];
			const oldValue = key in oldStorage ? oldStorage[key] : void 0;
			if (typeof defaultValue === "object" && defaultValue !== null) if (defaultValue instanceof DefaultSetting) newStorage[key] = migrateDefaultSetting(oldValue ?? {}, defaultValue);
			else newStorage[key] = convertStorage(oldValue ?? {}, defaultValue);
			else newStorage[key] = oldValue ?? defaultValue;
		}
		return newStorage;
	}
	function migrateDefaultSetting(oldValue, setting) {
		if (isValidSettingValue(oldValue, setting)) return oldValue;
		if (setting.defaultValue !== null) return typeof setting.defaultValue === "function" ? setting.defaultValue() : setting.defaultValue;
		return null;
	}
	function isValidSettingValue(value, setting) {
		if (setting.type === "array") return Array.isArray(value);
		return setting.type.split("|").some((type) => type === "empty" && value === "" || typeof value === type);
	}
	function populateDatabaseVariables(database) {
		settings = database.settings;
		filters = database.filters;
		version = database.version;
		api = database.api;
		userdata = database.userdata;
		torndata = database.torndata;
		localdata = database.localdata;
		stakeouts = database.stakeouts;
		attackHistory = database.attackHistory;
		notes = database.notes;
		factiondata = database.factiondata;
		quick = database.quick;
		npcs = database.npcs;
		stockdata = database.stockdata;
		factionStakeouts = database.factionStakeouts;
		notificationHistory = database.notificationHistory;
		notifications = database.notifications;
		migrations = database.migrations;
		ttCache.cache = database.cache;
	}
	async function initializeDatabase() {
		await loadDatabase().catch((reason) => console.error("TT - Failed to load database.", reason));
		initializeDatabaseListener();
	}
	var initializedDatabaseListeners = false;
	function initializeDatabaseListener() {
		if (initializedDatabaseListeners) return;
		RUNTIME_STORAGE.addChangeListener((changes, area) => {
			if (area === "local") for (const key in changes) {
				switch (key) {
					case "settings":
						settings = changes.settings.newValue;
						break;
					case "filters":
						filters = changes.filters.newValue;
						break;
					case "version":
						version = changes.version.newValue;
						break;
					case "userdata":
						userdata = changes.userdata.newValue;
						break;
					case "api":
						api = changes.api.newValue;
						break;
					case "torndata":
						torndata = changes.torndata.newValue;
						break;
					case "stakeouts":
						stakeouts = changes.stakeouts.newValue;
						break;
					case "attackHistory":
						attackHistory = changes.attackHistory.newValue;
						break;
					case "notes":
						notes = changes.notes.newValue;
						break;
					case "factiondata":
						factiondata = changes.factiondata.newValue;
						break;
					case "quick":
						quick = changes.quick.newValue;
						break;
					case "localdata":
						localdata = changes.localdata.newValue;
						break;
					case "cache":
						ttCache.cache = changes.cache.newValue;
						break;
					case "npcs":
						npcs = changes.npcs.newValue;
						break;
					case "stockdata":
						stockdata = changes.stockdata.newValue;
						break;
					case "notificationHistory":
						notificationHistory = changes.notificationHistory.newValue;
						break;
					case "notifications":
						notifications = changes.notifications.newValue;
						break;
					case "factionStakeouts":
						factionStakeouts = changes.factionStakeouts.newValue;
						break;
				}
				if (storageListeners[key]) storageListeners[key].forEach((listener) => listener(changes[key].oldValue, changes[key].newValue));
			}
		});
		initializedDatabaseListeners = true;
	}
	function setUserdata(data) {
		userdata = data;
	}
	function setFactiondata(data) {
		factiondata = data;
	}
	function setTorndata(data) {
		torndata = data;
	}
	function setNotificationHistory(data) {
		notificationHistory = data;
	}
	//#endregion
	//#region src/common/utils/functions/pages-debug.ts
	function exposeDebugObjects(backgroundService) {
		globalThis.DebugFunctions = {
			fullDataDump,
			forceUpdateUserdata: () => backgroundService.forceUpdate("userdata"),
			forceUpdateTorndata: () => backgroundService.forceUpdate("torndata"),
			forceUpdateAll: () => forceUpdateAll(backgroundService),
			reinitializeTimers: () => backgroundService.reinitializeTimers(),
			notification: (title, message) => backgroundService.notification(title, message)
		};
		globalThis.InternalObjects = {
			ttStorage,
			ttCache
		};
	}
	function fullDataDump(reduction = true) {
		ttStorage.get().then((storage) => {
			Object.values(storage.api).forEach((x) => {
				if (!("key" in x) || !x.key) return;
				if (x.key.startsWith("TS_")) x.key = `TS_<redacted:${x.key.length - 3}>`;
				else x.key = `<redacted:${x.key.length}>`;
			});
			if (reduction) {
				if (storage.settings.notifications?.soundCustom) storage.settings.notifications.soundCustom = "<reduced:custom_sound>";
				if (storage.stockdata) storage.stockdata.stocks = `<reduced:${storage.stockdata.stocks?.length ?? "N/A"}>"`;
				if (storage.torndata) {
					storage.torndata.education = `<reduced:${storage.torndata.education?.length ?? "N/A"}>`;
					storage.torndata.honors = `<reduced:${storage.torndata.honors?.length ?? "N/A"}>`;
					storage.torndata.medals = `<reduced:${storage.torndata.medals?.length ?? "N/A"}>`;
					storage.torndata.items = `<reduced:${storage.torndata.items?.length ?? "N/A"}>`;
					storage.torndata.itemsMap = `<reduced:${(storage.torndata.itemsMap ? Object.keys(storage.torndata.itemsMap).length : null) ?? "N/A"}>`;
					storage.torndata.stats = `<reduced:${(storage.torndata.stats ? Object.keys(storage.torndata.stats).length : null) ?? "N/A"}>`;
					storage.torndata.properties = `<reduced:${storage.torndata.properties?.length ?? "N/A"}>`;
					storage.torndata.calendar.competitions = `<reduced:${storage.torndata.calendar?.competitions?.length ?? "N/A"}>`;
					storage.torndata.calendar.events = `<reduced:${storage.torndata.calendar?.events?.length ?? "N/A"}>`;
				}
				if (storage.factiondata?.access === "full_access") {
					storage.factiondata.crimes = `<reduced:${(storage.factiondata.crimes ? Object.values(storage.factiondata.crimes).length : null) ?? "N/A"}>`;
					storage.factiondata.rankedwars = `<reduced:${storage.factiondata.rankedwars?.length ?? "N/A"}>`;
				}
				storage.notes.profile = `<reduced:${(storage.notes.profile ? Object.values(storage.notes.profile).length : null) ?? "N/A"}>`;
				storage.attackHistory.history = `<reduced:${(storage.attackHistory?.history ? Object.keys(storage.attackHistory.history).length : null) ?? "N/A"}>`;
				Object.keys(storage.cache).forEach((cacheKey) => {
					storage.cache[cacheKey] = `<reduced:${Object.values(storage.cache[cacheKey]).length}>`;
				});
			}
			const data = JSON.stringify(storage, null, 4);
			elementBuilder({
				type: "a",
				href: window.URL.createObjectURL(new Blob([data], { type: "octet/stream" })),
				attributes: { download: "torntools-full-data-dump.json" }
			}).click();
		});
	}
	function forceUpdateAll(backgroundService) {
		return Promise.all([
			backgroundService.forceUpdate("torndata"),
			backgroundService.forceUpdate("userdata"),
			backgroundService.forceUpdate("stocks"),
			backgroundService.forceUpdate("factiondata")
		]);
	}
	//#endregion
	//#region src/extension/entrypoints/background/notifications.ts
	var AudioPlayer = class {
		_src;
		_volume;
		audio;
		set src(src) {
			this._src = src;
			if (this.audio) this.audio.src = src;
		}
		set volume(volume) {
			this._volume = volume;
			if (this.audio) this.audio.volume = volume;
		}
		async play() {
			if (!this._src) throw Error("No sound src set.");
			if (typeof Audio !== "undefined") {
				if (!this.audio) this.audio = new Audio(this._src);
				else this.audio.currentTime = 0;
				this.audio.play();
				return;
			}
			try {
				await setupAudioPlayerDocument();
				await browser.runtime.sendMessage({
					offscreen: "audio",
					src: this._src,
					volume: this._volume
				});
			} catch {
				console.warn("Audio playback unavailable (offscreen document not ready).");
			}
		}
		async pause() {
			this.audio?.pause();
		}
	};
	var creatingOffscreen = null;
	async function setupAudioPlayerDocument() {
		if ((await browser.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] })).length > 0) return;
		if (!creatingOffscreen) {
			creatingOffscreen = browser.offscreen.createDocument({
				url: "/offscreen.html",
				reasons: ["AUDIO_PLAYBACK"],
				justification: "To play notification alert sound and TTS."
			});
			await creatingOffscreen;
			creatingOffscreen = null;
		} else await creatingOffscreen;
	}
	var notificationPlayer = new AudioPlayer();
	var notificationTestPlayer = new AudioPlayer();
	var notificationSound;
	var notificationWorker;
	var backoffUntil = 0;
	var backoffQueue = [];
	var backoffTimer = null;
	function initializeBackoff(durationMs = TO_MILLIS.SECONDS * 3) {
		backoffUntil = Date.now() + durationMs;
		if (backoffTimer) clearTimeout(backoffTimer);
		backoffTimer = setTimeout(() => void drainStartupQueue(), durationMs);
	}
	async function dispatchNotification(notification) {
		if (Date.now() < backoffUntil) {
			backoffQueue.push(notification);
			return;
		}
		await notifyUser(notification.title, notification.message, notification.url);
		notification.seen = true;
		await storeNotification(notification);
	}
	async function drainStartupQueue() {
		backoffUntil = 0;
		if (backoffTimer) {
			clearTimeout(backoffTimer);
			backoffTimer = null;
		}
		for (const notification of backoffQueue) {
			await notifyUser(notification.title, notification.message, notification.url);
			notification.seen = true;
			await storeNotification(notification);
			await sleep(250);
		}
	}
	async function cleanupNotifications() {
		const notifications = await ttStorage.get("notifications");
		for (const type in notifications) for (const key in notifications[type]) {
			const notification = notifications[type][key];
			if ("combined" in notification) continue;
			if (Date.now() - notification.date > 3 * TO_MILLIS.DAYS) delete notifications[type][key];
		}
		await ttStorage.set({ notifications });
	}
	async function notifyUser(title, message, url) {
		await setupSoundPlayer();
		const icon = browser.runtime.getURL("/images/icon_128.png");
		const requireInteraction = hasInteractionSupport() && settings.notifications.requireInteraction;
		const silent = hasSilentSupport() && notificationSound !== "default";
		if (settings.notifications.tts) readMessage(title + message).then(() => {}).catch((err) => console.error(err));
		try {
			await notifyNative();
		} catch (errorNative) {
			try {
				await notifyService();
			} catch (errorService) {
				console.error("Failed to send notification.", {
					native: errorNative,
					service: errorService
				});
			}
		}
		async function setupSoundPlayer() {
			if (notificationSound !== settings.notifications.sound) {
				const sound = getNotificationSound(settings.notifications.sound);
				if (sound && sound !== "mute") notificationPlayer.src = sound;
				notificationSound = settings.notifications.sound;
			}
			notificationPlayer.volume = settings.notifications.volume / 100;
		}
		async function notifyNative() {
			const options = {
				type: "basic",
				iconUrl: icon,
				title,
				message
			};
			if (silent) options.silent = true;
			if (requireInteraction) options.requireInteraction = true;
			const id = await browser.notifications.create(options);
			if (notificationSound !== "default" && notificationSound !== "mute") notificationPlayer.play().catch(console.error);
			if (settings.notifications.link) {
				const relation = { link: url };
				ttCache.set({ [id]: relation }, TO_MILLIS.DAYS * 3, "notification-relations");
			}
		}
		async function notifyService() {
			const options = {
				icon,
				body: message,
				requireInteraction,
				data: { settings: {} }
			};
			if (silent) options.silent = true;
			if (settings.notifications.link) options.data.link = url;
			if (!notificationWorker) await navigator.serviceWorker.register("scripts/service-worker.js").then(async (registration) => {
				notificationWorker = registration;
				await registration.update();
			});
			await new Promise((resolve, reject) => {
				notificationWorker.showNotification(title, options).then(() => {
					if (notificationSound !== "default" && notificationSound !== "mute") notificationPlayer.play().catch(console.error);
					resolve();
				}).catch((error) => reject(error));
			});
		}
		async function readMessage(text) {
			if (isSpeechSynthesisAvailable()) {
				const ttsMessage = new SpeechSynthesisUtterance(text);
				ttsMessage.volume = settings.notifications.volume / 100;
				if (settings.notifications.ttsVoice !== "default") {
					const matchedVoice = window.speechSynthesis.getVoices().find(({ name, lang }) => `${name} (${lang})` === settings.notifications.ttsVoice);
					if (matchedVoice) ttsMessage.voice = matchedVoice;
				}
				ttsMessage.rate = settings.notifications.ttsRate;
				window.speechSynthesis.speak(ttsMessage);
			} else {
				await setupAudioPlayerDocument();
				await browser.runtime.sendMessage({
					offscreen: "tts",
					text,
					volume: settings.notifications.volume / 100,
					voice: settings.notifications.ttsVoice,
					rate: settings.notifications.ttsRate
				});
			}
		}
	}
	async function storeNotification(notification) {
		const notificationHistory = await ttStorage.get("notificationHistory");
		if ("combined" in notification) {
			console.warn("Trying to save a combined notification.", notification);
			return;
		}
		if (!notification.title || !notification.message || !notification.date) {
			console.warn("Trying to save a notification without title, message or date.", notification);
			return;
		}
		notificationHistory.splice(0, 0, notification);
		setNotificationHistory(notificationHistory.slice(0, 100));
		await ttStorage.set({ notificationHistory });
	}
	function getNotificationSound(type, allowDefault = false) {
		switch (type) {
			case "1":
			case "2":
			case "3":
			case "4":
			case "5": return browser.runtime.getURL(`/audio/notification${type}.wav`);
			case "custom": return settings.notifications.soundCustom;
			default: return allowDefault ? getNotificationSound("1") : false;
		}
	}
	function newNotification(title, message, link) {
		return {
			title: `TornTools - ${title}`,
			message,
			url: link,
			date: Date.now()
		};
	}
	//#endregion
	//#region src/common/utils/functions/api.ts
	var FACTION_ACCESS = {
		none: "none",
		basic: "basic",
		full_access: "full_access"
	};
	function hasAPIData() {
		const hasKey = !!api?.torn?.key;
		const hasError = !!api?.torn?.error && !api.torn.error.includes("Backend error") && api.torn.error !== "Network issues";
		const hasUserdata = !!(userdata && Object.keys(userdata).length);
		return hasKey && !hasError && hasUserdata;
	}
	function hasFactionAPIAccess() {
		if (!hasAPIData()) return false;
		return !!userdata.faction && factiondata?.access === FACTION_ACCESS.full_access;
	}
	function isTornApiError(response) {
		return !!response && typeof response === "object" && "error" in response && "code" in response;
	}
	//#endregion
	//#region src/common/utils/functions/extension.ts
	var BADGE_TYPES = {
		default: {
			text: "",
			color: null
		},
		error: {
			text: "error",
			color: "#FF0000"
		},
		count: {
			text: async (options) => {
				if (options.events && options.messages) return `${options.events}/${options.messages}`;
				else if (options.events) return options.events.toString();
				else if (options.messages) return options.messages.toString();
				else return await getBadgeText() === "error" ? "error" : null;
			},
			color: async (options) => {
				if (options.events && options.messages) return "#1ed2ac";
				else if (options.events) return "#009eda";
				else if (options.messages) return "#84af03";
				else return await getBadgeText() === "error" ? "error" : null;
			}
		}
	};
	async function setBadge(type, partialOptions = {}) {
		if (SCRIPT_TYPE !== "BACKGROUND") return false;
		const options = {
			events: 0,
			messages: 0,
			...partialOptions
		};
		const badge = { ...BADGE_TYPES[type] };
		if (typeof badge.text === "function") badge.text = await badge.text(options);
		if (typeof badge.color === "function") badge.color = await badge.color(options);
		if (!badge.text) badge.text = "";
		browser.action.setBadgeText({ text: badge.text || "" });
		if (badge.color) browser.action.setBadgeBackgroundColor({ color: badge.color });
		return true;
	}
	function getBadgeText() {
		if (SCRIPT_TYPE !== "BACKGROUND") return Promise.resolve(null);
		return browser.action.getBadgeText({});
	}
	//#endregion
	//#region src/common/utils/functions/formatting.ts
	var REGEXES = {
		convertToNumber: /-?[\d,]+(\.\d+)?/,
		formatNumber: /\B(?=(\d{3})+(?!\d))/g
	};
	function dropDecimals(number) {
		return parseInt(number.toString());
	}
	function toMultipleDigits(number, digits = 2) {
		if (number === void 0) return void 0;
		return number.toString().length < digits ? toMultipleDigits(`0${number}`, digits) : number.toString();
	}
	function formatTime(time, partialOptions = {}) {
		if (typeof time === "number") return formatTime({ milliseconds: time }, partialOptions);
		else if (typeof time === "string") return formatTime(new Date(time), partialOptions);
		else if (time instanceof Date) return formatTime({ milliseconds: time.getTime() }, partialOptions);
		const options = {
			type: "normal",
			showDays: false,
			hideHours: false,
			hideSeconds: false,
			short: false,
			extraShort: false,
			agoFilter: void 0,
			daysToHours: false,
			truncateSeconds: false,
			...partialOptions
		};
		let millis;
		if ("milliseconds" in time) millis = time.milliseconds;
		else if ("seconds" in time) millis = time.seconds * TO_MILLIS.SECONDS;
		let date, parts;
		switch (options.type) {
			case "normal": {
				date = new Date(millis);
				let seconds, minutes, hours;
				if (settings.formatting.tct) {
					seconds = date.getUTCSeconds();
					minutes = date.getUTCMinutes();
					hours = date.getUTCHours();
				} else {
					seconds = date.getSeconds();
					minutes = date.getMinutes();
					hours = date.getHours();
				}
				const secondsText = options.hideSeconds ? void 0 : toMultipleDigits(seconds);
				const minutesText = toMultipleDigits(minutes);
				let hoursText = toMultipleDigits(hours);
				switch (settings.formatting.time) {
					case "us": {
						const afternoon = hours >= 12;
						hoursText = toMultipleDigits(hours % 12 || 12);
						return secondsText ? `${hoursText}:${minutesText}:${secondsText} ${afternoon ? "PM" : "AM"}` : `${hoursText}:${minutesText} ${afternoon ? "PM" : "AM"}`;
					}
					default: return secondsText ? `${hoursText}:${minutesText}:${secondsText}` : `${hoursText}:${minutesText}`;
				}
			}
			case "timer": {
				date = new Date(millis);
				parts = [];
				if (options.showDays) parts.push(Math.floor(date.getTime() / TO_MILLIS.DAYS));
				if (!options.hideHours) parts.push(date.getUTCHours() + (options.daysToHours ? 24 * Math.floor(millis / TO_MILLIS.DAYS) : 0));
				parts.push(date.getUTCMinutes());
				if (!options.hideSeconds) parts.push(date.getUTCSeconds());
				let timerText = parts.map((p) => toMultipleDigits(p, 2)).join(":");
				if (options.short && options.showDays && timerText.startsWith("00:")) timerText = timerText.slice(3);
				return timerText;
			}
			case "wordTimer": return formatTimeAsWordTimer(millis, options);
			case "ago": {
				let timeAgo = Math.floor(Date.now() - millis);
				let token = "ago";
				if (timeAgo < 0) {
					token = "from now";
					timeAgo = Math.abs(timeAgo);
				}
				const UNITS = [
					{
						unit: options.short ? "y" : "year",
						millis: TO_MILLIS.DAYS * 370,
						getter: () => {
							const to = /* @__PURE__ */ new Date();
							const from = new Date(millis);
							let years = to.getFullYear() - from.getFullYear();
							if (to.getMonth() > from.getMonth() || to.getMonth() === from.getMonth() && to.getDay() > from.getDay()) years--;
							return years;
						}
					},
					{
						unit: options.short ? "mth" : "month",
						millis: TO_MILLIS.DAYS * 30,
						getter: () => {
							const to = /* @__PURE__ */ new Date();
							const from = new Date(millis);
							let months = (to.getFullYear() - from.getFullYear()) * 12;
							months += to.getMonth() - from.getMonth();
							if (to.getDay() > from.getDay()) months--;
							return months;
						}
					},
					{
						unit: options.short ? "d" : "day",
						millis: TO_MILLIS.DAYS
					},
					{
						unit: options.short ? "hr" : "hour",
						millis: TO_MILLIS.HOURS
					},
					{
						unit: options.short ? "min" : "minute",
						millis: TO_MILLIS.MINUTES
					},
					{
						unit: options.short ? "sec" : "second",
						millis: TO_MILLIS.SECONDS
					},
					{
						text: options.short ? "now" : "just now",
						millis: 0
					}
				];
				let _units = UNITS;
				if (options.agoFilter) _units = UNITS.filter((value) => value.millis <= options.agoFilter);
				for (const unit of _units) {
					if (timeAgo < unit.millis) continue;
					if (unit.unit) {
						const amount = unit.getter ? unit.getter() : Math.floor(timeAgo / unit.millis);
						return `${amount} ${unit.unit}${applyPlural(amount)} ${token}`;
					} else if (unit.text) return unit.text;
				}
				return timeAgo.toString();
			}
			default: throw new Error("Invalid formatTime type.");
		}
	}
	function formatTimeAsWordTimer(millis, options) {
		const date = new Date(millis);
		let hasShownDays = false;
		let hasShownHours = false;
		const parts = [];
		if (options.showDays && dropDecimals(date.getTime() / TO_MILLIS.DAYS) > 0) {
			hasShownDays = true;
			parts.push(formatUnit(Math.floor(date.getTime() / TO_MILLIS.DAYS), {
				normal: "day",
				short: "day",
				extraShort: "d"
			}));
		}
		if (!options.hideHours && date.getUTCHours()) {
			hasShownHours = true;
			parts.push(formatUnit(date.getUTCHours(), {
				normal: "hour",
				short: "hr",
				extraShort: "h"
			}));
		}
		if (date.getUTCMinutes()) parts.push(formatUnit(date.getUTCMinutes(), {
			normal: "minute",
			short: "min",
			extraShort: "m"
		}));
		if (!options.hideSeconds && date.getUTCSeconds() && (!options.truncateSeconds || !(hasShownDays || hasShownHours))) parts.push(formatUnit(date.getUTCSeconds(), {
			normal: "second",
			short: "sec",
			extraShort: "s"
		}));
		if (parts.length > 1 && !options.extraShort) parts.splice(parts.length - 1, 0, "and");
		function formatUnit(amount, unit) {
			let formatted = `${amount}`;
			if (options.extraShort) formatted += unit.extraShort;
			else if (options.short) formatted += ` ${unit.short}${applyPlural(amount)}`;
			else formatted += ` ${unit.normal}${applyPlural(amount)}`;
			return formatted;
		}
		return parts.join(" ");
	}
	function formatNumber(number, partialOptions = {}) {
		const options = {
			shorten: false,
			formatter: void 0,
			decimals: 0,
			currency: false,
			forceOperation: false,
			roman: false,
			...partialOptions
		};
		if (typeof number !== "number") if (Number.isNaN(parseInt(number))) return number;
		else number = parseFloat(number);
		if (number === Number.POSITIVE_INFINITY) return "∞";
		if (options.decimals !== void 0) number = parseFloat(number.toFixed(options.decimals));
		if (options.formatter) return options.formatter.format(number);
		if (options.roman) {
			if (number === 0) return "";
			else if (number < 0) throw "Roman numbers can only be positive!";
			const ROMAN = [
				[1e3, "M"],
				[900, "CM"],
				[500, "D"],
				[400, "CD"],
				[100, "C"],
				[90, "XC"],
				[50, "L"],
				[40, "XL"],
				[10, "X"],
				[9, "IX"],
				[5, "V"],
				[4, "IV"],
				[1, "I"]
			];
			return toRoman(number);
			function toRoman(number) {
				if (number === 0) return "";
				for (const [value, character] of ROMAN) {
					if (number < value) continue;
					return character + toRoman(number - value);
				}
				return "N/A";
			}
		}
		const abstract = Math.abs(number);
		const operation = number < 0 ? "-" : options.forceOperation ? "+" : "";
		let text;
		if (options.shorten) {
			const version = options.shorten === true ? 1 : options.shorten;
			const decimals = options.decimals !== -1 ? options.decimals : 3;
			const words = (() => {
				switch (version) {
					case 1: return {
						thousand: "k",
						million: "mil",
						billion: "bill"
					};
					case 2:
					case 3: return {
						thousand: "k",
						million: "m",
						billion: "b"
					};
				}
			})();
			if (version === 1 || version === 2) {
				if (abstract >= 1e9) if (abstract % 1e9 === 0) text = (abstract / 1e9).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + words.billion;
				else text = (abstract / 1e9).toFixed(3) + words.billion;
				else if (abstract >= 1e6) if (abstract % 1e6 === 0) text = abstract / 1e6 + words.million;
				else text = (abstract / 1e6).toFixed(3) + words.million;
				else if (abstract >= 1e3) {
					if (abstract % 1e3 === 0) text = abstract / 1e3 + words.thousand;
				}
			} else if (abstract >= 1e9) if (abstract % 1e9 === 0) text = abstract / 1e9 + words.billion;
			else text = parseFloat((abstract / 1e9).toFixed(decimals)) + words.billion;
			else if (abstract >= 1e6) if (abstract % 1e6 === 0) text = abstract / 1e6 + words.million;
			else text = parseFloat((abstract / 1e6).toFixed(decimals)) + words.million;
			else if (abstract >= 1e3) {
				if (abstract % 1e3 === 0) text = abstract / 1e3 + words.thousand;
				else if (abstract % 100 === 0) text = abstract / 1e3 + words.thousand;
			}
		}
		if (!text) text = abstract.toString().replace(REGEXES.formatNumber, ",");
		return `${operation}${options.currency ? "$" : ""}${text}`;
	}
	function capitalizeText(text, partialOptions = {}) {
		if (!{
			everyWord: false,
			...partialOptions
		}.everyWord) return text[0].toUpperCase() + text.slice(1);
		return text.trim().split(" ").map((word) => capitalizeText(word)).join(" ").trim();
	}
	function applyPlural(check) {
		return check !== 1 ? "s" : "";
	}
	//#endregion
	//#region src/common/utils/functions/torn.ts
	var LINKS = {
		auction: "https://www.torn.com/amarket.php",
		bank: "https://www.torn.com/bank.php",
		bazaar: "https://www.torn.com/bazaar.php",
		bounties: "https://www.torn.com/bounties.php#!p=main",
		chain: "https://www.torn.com/factions.php?step=your#/war/chain",
		church: "https://www.torn.com/church.php",
		committee: "https://www.torn.com/committee.php",
		companies: "https://www.torn.com/companies.php",
		companyEmployees: "https://www.torn.com/companies.php#/option=employees",
		crimes: "https://www.torn.com/crimes.php",
		donator: "https://www.torn.com/donator.php",
		education: "https://www.torn.com/page.php?sid=education",
		events: "https://www.torn.com/events.php#/step=all",
		faction: "https://www.torn.com/factions.php",
		faction__ranked_war: "https://www.torn.com/factions.php?step=your&type=1#/war/rank",
		faction_oc: "https://www.torn.com/factions.php?step=your#/tab=crimes",
		gym: "https://www.torn.com/gym.php",
		home: "https://www.torn.com/index.php",
		homepage: "https://www.torn.com/index.php",
		hospital: "https://www.torn.com/hospitalview.php",
		itemmarket: "https://www.torn.com/page.php?sid=ItemMarket",
		items: "https://www.torn.com/item.php",
		items_booster: "https://www.torn.com/item.php#boosters-items",
		items_candy: "https://www.torn.com/item.php#candy-items",
		items_drug: "https://www.torn.com/item.php#drugs-items",
		items_medical: "https://www.torn.com/item.php#medical-items",
		jailview: "https://www.torn.com/jailview.php",
		jobs: "https://www.torn.com/companies.php",
		loan: "https://www.torn.com/loan.php",
		messages: "https://www.torn.com/messages.php",
		missions: "https://www.torn.com/page.php?sid=missions",
		organizedCrimes: "https://www.torn.com/factions.php?step=your#/tab=crimes",
		pc: "https://www.torn.com/pc.php",
		points: "https://www.torn.com/page.php?sid=points",
		pointsmarket: "https://www.torn.com/pmarket.php",
		properties: "https://www.torn.com/properties.php",
		property_upkeep: "https://www.torn.com/properties.php#/p=options&tab=upkeep",
		property_vault: "https://www.torn.com/properties.php#/p=options&tab=vault",
		raceway: "https://www.torn.com/page.php?sid=racing",
		staff: "https://www.torn.com/staff.php",
		stocks: "https://www.torn.com/page.php?sid=stocks",
		trade: "https://www.torn.com/trade.php",
		travelagency: "https://www.torn.com/page.php?sid=travel"
	};
	LINKS.donator, LINKS.donator, LINKS.staff, LINKS.committee, LINKS.church, LINKS.jobs, LINKS.jobs, LINKS.jobs, LINKS.jobs, LINKS.jobs, LINKS.jobs, LINKS.companies, LINKS.companies, LINKS.companies, LINKS.faction, LINKS.faction, LINKS.faction, LINKS.faction, LINKS.faction, LINKS.education, LINKS.education, LINKS.bank, LINKS.bank, LINKS.travelagency, LINKS.property_vault, LINKS.loan, LINKS.auction, LINKS.bazaar, LINKS.itemmarket, LINKS.pointsmarket, LINKS.stocks, LINKS.stocks, LINKS.trade, LINKS.homepage, LINKS.raceway, LINKS.raceway, LINKS.faction_oc, LINKS.faction_oc, LINKS.faction_oc, LINKS.faction_oc, LINKS.bounties, LINKS.bank, LINKS.auction, LINKS.auction, LINKS.hospital, LINKS.hospital, LINKS.hospital, LINKS.jailview, LINKS.hospital, LINKS.items_booster, LINKS.items_booster, LINKS.items_booster, LINKS.items_booster, LINKS.items_booster, LINKS.items_medical, LINKS.items_medical, LINKS.items_medical, LINKS.items_medical, LINKS.items_medical, LINKS.items_drug, LINKS.items_drug, LINKS.items_drug, LINKS.items_drug, LINKS.items_drug, LINKS.travelagency, LINKS.travelagency, LINKS.travelagency, LINKS.travelagency, LINKS.travelagency, LINKS.items_medical, LINKS.items_medical, LINKS.items_medical, LINKS.items_medical, LINKS.items_medical, LINKS.property_upkeep, LINKS.property_upkeep, LINKS.property_upkeep;
	[
		{
			id: 1,
			reason: "Admin"
		},
		{
			id: 4,
			reason: "NPC"
		},
		{
			id: 7,
			reason: "NPC"
		},
		{
			id: 9,
			reason: "NPC"
		},
		{
			id: 10,
			reason: "NPC"
		},
		{
			id: 15,
			reason: "NPC"
		},
		{
			id: 17,
			reason: "NPC"
		},
		{
			id: 19,
			reason: "NPC"
		},
		{
			id: 20,
			reason: "NPC"
		},
		{
			id: 21,
			reason: "NPC"
		}
	].map(({ id }) => id);
	var CHAIN_BONUSES = [
		10,
		25,
		50,
		100,
		250,
		500,
		1e3,
		2500,
		5e3,
		1e4,
		25e3,
		5e4,
		1e5
	];
	function getNextChainBonus(current) {
		return CHAIN_BONUSES.find((bonus) => bonus > current);
	}
	function getRFC() {
		const rfc = getCookie("rfc_v");
		if (!rfc) for (const cookie of document.cookie.split("; ")) {
			const parts = cookie.split("=");
			if (parts[0] === "rfc_v") return parts[1];
		}
		return rfc;
	}
	function hasFinishedEducation() {
		if (!torndata.education || !userdata.education?.complete) return false;
		return torndata.education.flatMap((e) => e.courses).every(({ id }) => userdata.education.complete.includes(id));
	}
	var HOSP_REASONS = [
		{
			name: "overdosed",
			display: "Overdosed",
			display_sentence: "after overdosing",
			keywords: [
				"overdosed",
				"collapsed after taking",
				"collapsed while smoking"
			],
			important: true
		},
		{
			name: "hospitalized",
			display: "Hospitalized",
			display_sentence: "after being hospitalized",
			keywords: ["hospitalized"],
			important: true
		},
		{
			name: "mugged",
			display: "Mugged",
			display_sentence: "after being mugged",
			keywords: ["mugged"],
			important: true
		},
		{
			name: "attacked",
			display: "Attacked",
			display_sentence: "after being attacked",
			keywords: ["attacked"],
			important: true
		},
		{
			name: "lost",
			display: "Lost",
			keywords: ["lost"]
		},
		{
			name: "crashed",
			display: "Crashed",
			keywords: ["crashed"]
		},
		{
			name: "oc 1 failure",
			display: "OC 1 Failure",
			keywords: [
				"thrown at a wall",
				"nudist rebels",
				"shot in the back",
				"exploded",
				"swat marksman",
				"taken down by members",
				"taken down by guards",
				"attempted robbery",
				"derailed",
				"attempting to take down a president",
				"dropped by swiss guards"
			]
		},
		{
			name: "crimes 1 failure",
			display: "Crimes 1 Failure",
			keywords: [
				"trying to rob",
				"drive-by shooting",
				"third degree burns",
				"hitman mission",
				"arson attempt",
				"mauled by a guard dog",
				"shot while resisting arrest"
			]
		},
		{
			name: "crimes 2 failure",
			display: "Crimes 2 Failure",
			keywords: ["gunshot wound", "primary blast"]
		},
		{
			name: "sed",
			display: "SED",
			display_sentence: "after using a SED",
			keywords: ["nasty surprise"],
			important: true
		},
		{
			name: "blood_bag",
			display: "Blood Bag",
			display_sentence: "after using a wrong blood bag",
			keywords: ["acute hemolytic transfusion reaction"],
			important: true
		},
		{
			name: "ipecac_syrup",
			display: "Ipecac Syrup",
			display_sentence: "after ingesting Ipecac Syrup",
			keywords: ["ipecac syrup"],
			important: true
		},
		{
			name: "radiation_poisoning",
			display: "Radiation Poisoning",
			keywords: ["radiation poisoning"]
		}
	];
	function getHospitalizationReason(details) {
		details = details.toLowerCase();
		return HOSP_REASONS.find((_reason) => _reason.keywords.some((keyword) => details.includes(keyword)));
	}
	var MAX_MISSIONS = {
		Duke: 3,
		DEFAULT: 3
	};
	//#endregion
	//#region src/common/utils/functions/api-fetcher.ts
	var CUSTOM_API_ERROR = {
		NO_NETWORK: "tt-no_network",
		NO_PERMISSION: "tt-no_permission",
		CANCELLED: "tt-cancelled"
	};
	var FETCH_PLATFORMS = {
		tornv2: "https://api.torn.com/v2/",
		torn_direct: "https://www.torn.com/",
		yata: "https://yata.yt/",
		tornstats: "https://www.tornstats.com/",
		torntools: "https://torntools.gregork.com/",
		nukefamily: "https://nuke.family/",
		uhc: "https://tornuhc.eu/",
		stig: "https://api.no1irishstig.co.uk/",
		prometheus: "https://prombot.co.uk:8443/",
		lzpt: "https://api.lzpt.io/",
		wtf: "https://what-the-f.de/",
		tornw3b: "https://weav3r.dev/",
		ffscouter: "https://ffscouter.com/",
		laekna: "https://laekna-revive-bot.onrender.com/",
		tornintel: "https://torn-intel.com/",
		playground_torntools: "https://torntools.tornplayground.eu/"
	};
	var TORN_API_PLATFORMS = ["tornv2"];
	var TEXT_RESPONSE_PLATFORMS = ["torn_direct", "laekna"];
	async function fetchData(location, partialOptions = {}) {
		const options = mergeOptions(partialOptions);
		if (options.relay && SCRIPT_TYPE !== "BACKGROUND" && !RUNTIME_INFORMATION.isUserscript()) return relayToBackground(location, options);
		const request = buildFetchRequest(location, options);
		let result;
		try {
			result = parseFetchResponse(await DATA_FETCHER.fetch(request.url, {
				method: request.method,
				...request.method === "POST" ? { body: request.body } : {},
				headers: request.headers,
				timeout: decideTimeoutTimer(location)
			}), location);
		} catch (error) {
			return await handleError(location, options, error);
		}
		if (!result.success) return await handleError(location, options, result);
		else if (isApiErrorResponse(result.data)) return await handleError(location, options, result.data);
		await handleTornApiState(location, options);
		return result.data;
	}
	function mergeOptions(partial) {
		return {
			section: "",
			id: void 0,
			selections: [],
			legacySelections: [],
			key: void 0,
			action: void 0,
			method: "GET",
			body: void 0,
			silent: false,
			includeKey: false,
			relay: false,
			params: {},
			...partial
		};
	}
	async function relayToBackground(location, options) {
		return OFFLOAD_SERVICE.fetchRelay(location, {
			...options,
			relay: false
		});
	}
	function decideTimeoutTimer(location) {
		switch (location) {
			case "yata": return 30 * TO_MILLIS.SECONDS;
			default: return 10 * TO_MILLIS.SECONDS;
		}
	}
	function buildFetchRequest(location, options) {
		const url = buildUrl(location, options);
		const headers = buildHeaders(location, options);
		if (options.method === "POST") return {
			url,
			method: options.method,
			body: buildBody(options),
			headers
		};
		else return {
			url,
			method: options.method,
			headers
		};
	}
	function buildUrl(location, options) {
		let path, pathSections;
		let key;
		const params = new URLSearchParams();
		switch (location) {
			case "tornv2":
				path = `${options.section}/${options.id || ""}`;
				params.append("selections", [...options.selections, ...options.legacySelections].join(","));
				params.append("legacy", options.legacySelections.join(","));
				if (settings.apiUsage.comment) params.append("comment", settings.apiUsage.comment);
				break;
			case "torn_direct":
				path = options.action;
				params.set("rfcv", getRFC());
				break;
			case "tornstats":
				pathSections = [
					"api",
					"v2",
					options.key || api.tornstats.key || api.torn.key || ""
				];
				if (options.section) pathSections.push(options.section);
				if (options.id) pathSections.push(options.id);
				path = pathSections.join("/");
				break;
			case "yata":
				pathSections = [
					"api",
					"v1",
					options.section
				];
				if (options.id) pathSections.push(options.id, "");
				if (options.includeKey) key = api.yata.key;
				path = pathSections.join("/");
				break;
			case "prometheus":
				path = ["api", options.section].join("/");
				break;
			case "tornw3b":
				path = ["api", options.section].join("/");
				break;
			case "ffscouter":
				path = [
					"api",
					"v1",
					options.section
				].join("/");
				key = api.ffScouter.key;
				break;
			case "tornintel":
				path = ["api", options.section].join("/");
				break;
			case "playground_torntools":
				path = ["api", options.section].join("/");
				break;
			default:
				path = options.section;
				break;
		}
		if (options.includeKey) params.append("key", options.key || key || api.torn.key || "");
		if (options.params) for (const [key, value] of Object.entries(options.params)) params.append(key, value.toString());
		return `${FETCH_PLATFORMS[location]}${path}${params.toString() ? `?${params}` : ""}`;
	}
	function buildHeaders(location, options) {
		const headers = {};
		if (location === "tornv2") headers["Authorization"] = `ApiKey ${options.key || api.torn.key}`;
		if (options.method === "POST") {
			if (!(options.body instanceof URLSearchParams)) headers["content-type"] = "application/json";
			if (location === "torn_direct") headers["x-requested-with"] = "XMLHttpRequest";
		}
		return headers;
	}
	function buildBody(options) {
		if (options.method !== "POST") return null;
		return options.body instanceof URLSearchParams ? options.body : JSON.stringify(options.body);
	}
	function parseFetchResponse(response, location) {
		try {
			return {
				data: JSON.parse(response.text),
				success: true
			};
		} catch {
			if (TEXT_RESPONSE_PLATFORMS.includes(location)) return {
				data: response.text,
				success: true
			};
			if (response.ok) return { success: true };
			return {
				success: false,
				error: new HTTPException(response.status)
			};
		}
	}
	async function handleError(location, options, result) {
		if (result instanceof DOMException) return handleTimeoutError(location, options);
		if (result instanceof TypeError) return handleNetworkError(location, options, result.message);
		return handleApiError(location, options, result);
	}
	async function handleTimeoutError(location, options) {
		const error = "Request cancelled because it took too long.";
		await handleTornApiState(location, options, error);
		throw {
			error,
			isLocal: false,
			code: CUSTOM_API_ERROR.CANCELLED
		};
	}
	async function handleTornApiState(location, options, error, online = false) {
		if (!TORN_API_PLATFORMS.includes(location) || options.silent || SCRIPT_TYPE !== "BACKGROUND") return;
		if (error) {
			await ttStorage.change({ api: { torn: {
				online,
				error
			} } });
			await setBadge("error");
		} else {
			await getBadgeText().then((value) => {
				if (value === "error") return setBadge("default");
			}).catch(() => console.error("TT - Couldn't get the badge text."));
			await ttStorage.change({ api: { torn: {
				online: true,
				error: ""
			} } });
		}
	}
	async function handleNetworkError(location, options, message) {
		let error = message;
		let isLocal = false;
		let code;
		if (error === "Failed to fetch") {
			isLocal = true;
			if (!RUNTIME_INFORMATION.isUserscript() && SCRIPT_TYPE === "BACKGROUND" && !await hasOrigins(FETCH_PLATFORMS[location])) {
				error = "Permission issues";
				code = CUSTOM_API_ERROR.NO_PERMISSION;
			} else {
				error = "Network issues";
				code = CUSTOM_API_ERROR.NO_NETWORK;
			}
		}
		await handleTornApiState(location, options, error);
		throw {
			error,
			isLocal,
			code
		};
	}
	async function hasOrigins(...origins) {
		return browser.permissions.contains({ origins });
	}
	async function handleApiError(location, options, result) {
		if (TORN_API_PLATFORMS.includes(location)) {
			let error, online;
			if (result.error instanceof HTTPException) {
				error = result.error.toString();
				online = false;
			} else {
				error = result.error.error;
				online = result.error.code !== 9 && !(result instanceof HTTPException);
			}
			await handleTornApiState(location, options, error, online);
			throw result.error instanceof HTTPException ? result.error.asObject() : result.error;
		}
		throw { error: result.error };
	}
	function isApiErrorResponse(data) {
		return !!data && typeof data === "object" && "error" in data;
	}
	var HTTPException = class HTTPException {
		code;
		constructor(code) {
			this.code = code;
		}
		get message() {
			return this.code in HTTPException.codes ? HTTPException.codes[this.code] : `Unknown code (${this.code})`;
		}
		asObject() {
			return {
				code: this.code,
				message: this.message,
				http: true
			};
		}
		toString() {
			return `HTTP ${this.code}: ${this.message}`;
		}
		static get codes() {
			return {
				200: "OK",
				201: "Created",
				202: "Accepted",
				203: "Non-Authoritative Information",
				204: "No Content",
				205: "Reset Content",
				206: "Partial Content",
				300: "Multiple Choices",
				301: "Moved Permanently",
				302: "Found",
				303: "See Other",
				304: "Not Modified",
				305: "Use Proxy",
				306: "Unused",
				307: "Temporary Redirect",
				400: "Bad Request",
				401: "Unauthorized",
				402: "Payment Required",
				403: "Forbidden",
				404: "Not Found",
				405: "Method Not Allowed",
				406: "Not Acceptable",
				407: "Proxy Authentication Required",
				408: "Request Timeout",
				409: "Conflict",
				410: "Gone",
				411: "Length Required",
				412: "Precondition Required",
				413: "Request Entry Too Large",
				414: "Request-URI Too Long",
				415: "Unsupported Media Type",
				416: "Requested Range Not Satisfiable",
				417: "Expectation Failed",
				418: "I'm a teapot",
				429: "Too Many Requests",
				500: "Internal Server Error",
				501: "Not Implemented",
				502: "Bad Gateway",
				503: "Service Unavailable",
				504: "Gateway Timeout",
				505: "HTTP Version Not Supported"
			};
		}
	};
	//#endregion
	//#region src/extension/entrypoints/background/updates/faction-stakeouts.ts
	var UPDATE_JITTER$2 = 1e3;
	async function updateFactionStakeouts(forceUpdate = false) {
		await loadDatabase(true);
		const now = Date.now();
		if (!forceUpdate && factionStakeouts.date && !hasTimePassed(factionStakeouts.date - UPDATE_JITTER$2, TO_MILLIS.SECONDS * settings.apiUsage.delayStakeouts)) return { updated: false };
		let success = 0;
		let failed = 0;
		for (const entry of factionStakeouts.list) {
			const factionId = entry.id;
			const oldData = entry.info ?? null;
			let data;
			try {
				data = await fetchData("tornv2", {
					section: "faction",
					selections: [
						"basic",
						"chain",
						"wars"
					],
					id: factionId,
					silent: true
				});
				if (!data) {
					console.log("Unexpected result during faction stakeout updating.");
					failed++;
					continue;
				}
				success++;
			} catch (e) {
				console.log("FACTION STAKEOUT error", e);
				failed++;
				continue;
			}
			if (entry.alerts) {
				const { chainReaches, memberCountDrops, rankedWarStarts, inRaid, inTerritoryWar } = entry.alerts;
				if (chainReaches !== null) {
					const oldChainCount = oldData ? oldData.chain : false;
					const chainCount = data.chain.current;
					if (chainReaches === 0) {
						const key = `faction_${factionId}_chainDrops`;
						if (typeof oldChainCount === "number" && chainCount < oldChainCount && oldChainCount >= 10 && !notifications.stakeouts[key]) {
							if (settings.notifications.types.global) {
								const notification = newNotification("Faction Stakeouts", `${data.basic.name} has dropped their ${oldChainCount} chain.`, `https://www.torn.com/factions.php?step=profile&ID=${factionId}#/`);
								await dispatchNotification(notification);
								await ttStorage.change({ notifications: { stakeouts: { [key]: notification } } });
							}
						} else if (chainCount > 10) await ttStorage.update("notifications", (notifications) => delete notifications.stakeouts[key]);
					} else {
						const key = `faction_${factionId}_chainReaches`;
						if (chainReaches !== false && chainCount >= chainReaches && (!oldChainCount || oldChainCount < chainCount) && !notifications.stakeouts[key]) {
							if (settings.notifications.types.global) {
								const notification = newNotification("Faction Stakeouts", `${data.basic.name} has reached a ${chainCount} chain.`, `https://www.torn.com/factions.php?step=profile&ID=${factionId}#/`);
								await dispatchNotification(notification);
								await ttStorage.change({ notifications: { stakeouts: { [key]: notification } } });
							}
						} else if (typeof oldChainCount === "number" && chainCount < oldChainCount) await ttStorage.update("notifications", (notifications) => delete notifications.stakeouts[key]);
					}
				}
				if (memberCountDrops) {
					const oldMemberCount = oldData ? oldData.members.current : false;
					const memberCount = data.basic.members;
					const key = `faction_${factionId}_memberCountDrops`;
					if (typeof oldMemberCount === "number" && memberCount < memberCountDrops && (!oldMemberCount || oldMemberCount > memberCount) && !notifications.stakeouts[key]) {
						if (settings.notifications.types.global) {
							const notification = newNotification("Faction Stakeouts", `${data.basic.name} now has less than ${memberCountDrops} members.`, `https://www.torn.com/factions.php?step=profile&ID=${factionId}#/`);
							await dispatchNotification(notification);
							await ttStorage.change({ notifications: { stakeouts: { [key]: notification } } });
						}
					} else await ttStorage.update("notifications", (notifications) => delete notifications.stakeouts[key]);
				}
				const handleWarStakeout = async (type, wasValue, isValue, createMessage) => {
					const key = `faction_${factionId}_${type}`;
					if (isValue && (!oldData || !wasValue) && !notifications.stakeouts[key]) {
						if (settings.notifications.types.global) {
							const notification = newNotification("Faction Stakeouts", createMessage(), `https://www.torn.com/factions.php?step=profile&ID=${factionId}#/`);
							await dispatchNotification(notification);
							await ttStorage.change({ notifications: { stakeouts: { [key]: notification } } });
						}
					} else if (!isValue) await ttStorage.update("notifications", (notifications) => delete notifications.stakeouts[key]);
				};
				if (rankedWarStarts) await handleWarStakeout("rankedWarStarts", oldData ? oldData.rankedWar : false, data.wars.ranked !== null, () => `${data.basic.name} is now in a ranked war.`);
				if (inRaid) await handleWarStakeout("inRaid", oldData ? oldData.raid : false, data.wars.raids.length > 0, () => `${data.basic.name} is now in a raid.`);
				if (inTerritoryWar) await handleWarStakeout("inTerritoryWar", oldData ? oldData.territoryWar : false, data.wars.territory.length > 0, () => `${data.basic.name} is now in a territory war.`);
			}
			const existingIndex = factionStakeouts.list.findIndex((e) => e.id === factionId);
			if (existingIndex !== -1) factionStakeouts.list[existingIndex].info = {
				name: data.basic.name,
				chain: data.chain.current,
				respect: data.basic.respect,
				members: {
					current: data.basic.members,
					maximum: data.basic.capacity
				},
				rankedWar: data.wars.ranked !== null,
				raid: data.wars.raids.length > 0,
				territoryWar: data.wars.territory.length > 0
			};
		}
		factionStakeouts.date = now;
		await ttStorage.change({ factionStakeouts });
		return {
			updated: true,
			success,
			failed
		};
	}
	//#endregion
	//#region src/extension/entrypoints/background/updates-helper.ts
	function calculateOC(crimes, user) {
		return Object.values(crimes).reverse().filter(({ initiated }) => !initiated).filter(({ participants }) => participants.map((value) => parseInt(Object.keys(value)[0])).includes(user)).map(({ time_ready }) => time_ready * 1e3).find((time) => !!time) ?? -1;
	}
	//#endregion
	//#region src/extension/entrypoints/background/updates/factiondata.ts
	async function updateFactiondata() {
		if (!userdata?.faction) setFactiondata({
			access: FACTION_ACCESS.none,
			date: 0
		});
		else if (!(!factiondata || typeof factiondata !== "object" || factiondata.access !== FACTION_ACCESS.none) || hasFactionAPIAccess()) setFactiondata(await updateAccess());
		else if ("retry" in factiondata && !!factiondata.retry || "date" in factiondata && hasTimePassed(factiondata.date, TO_MILLIS.HOURS * 6)) setFactiondata(await updateAccess());
		else setFactiondata(await updateBasic());
		await ttStorage.set({ factiondata });
		async function updateAccess() {
			try {
				const data = await fetchData("tornv2", {
					section: "faction",
					selections: ["basic", "rankedwars"],
					legacySelections: ["crimes"],
					silent: true
				});
				return {
					...data,
					access: FACTION_ACCESS.full_access,
					date: Date.now(),
					userCrime: calculateOC(data.crimes, userdata.profile.id)
				};
			} catch (error) {
				if (error?.code === 7) return {
					...await updateBasic(),
					retry: Date.now()
				};
				return {
					error,
					access: FACTION_ACCESS.none,
					date: 0
				};
			}
		}
		async function updateBasic() {
			try {
				return {
					...await fetchData("tornv2", {
						section: "faction",
						selections: ["basic", "rankedwars"],
						silent: true
					}),
					access: FACTION_ACCESS.basic,
					date: Date.now()
				};
			} catch (error) {
				return {
					error,
					access: FACTION_ACCESS.none,
					date: 0
				};
			}
		}
	}
	//#endregion
	//#region src/extension/entrypoints/background/updates/npcs.ts
	var npcUpdater;
	async function updateNPCs() {
		const { yata: useYata, tornstats: useTornstats, lzpt: useLzpt } = settings.external;
		if (!useYata && !useTornstats && !useLzpt) {
			await ttStorage.set({ npcs: {} });
			return { updated: false };
		}
		const NPCS = {
			4: "DUKE",
			7: "Amanda",
			9: "Anonymous",
			10: "Scrooge",
			15: "Leslie",
			17: "Easter Bunny",
			19: "Jimmy",
			20: "Fernando",
			21: "Tiny"
		};
		const now = Date.now();
		let updated;
		if (npcs && "next_update" in npcs && npcs.next_update > now) updated = await updateLevels();
		else {
			const services = [
				{
					service: "loot-rangers",
					method: fetchLootRangers,
					check: useLzpt
				},
				{
					service: "yata",
					method: fetchYata,
					check: useYata
				},
				{
					service: "tornstats",
					method: fetchTornStats,
					check: useTornstats && hasAPIData()
				}
			].filter((s) => s.check);
			updated = await (services.find((s) => s.service === settings.pages.sidebar.npcLootTimesService) || services[0]).method();
		}
		if (updated || !npcUpdater) triggerUpdate();
		const alerts = await checkNPCAlerts();
		return {
			updated,
			alerts
		};
		async function fetchYata() {
			const data = await fetchData("yata", { section: "loot" });
			if (npcs && "timestamp" in npcs && npcs.timestamp === data.timestamp) return await updateLevels();
			const newNpcs = {
				next_update: data.next_update * 1e3,
				service: "YATA",
				targets: {}
			};
			for (let [id, hospital] of Object.entries(data.hosp_out)) {
				hospital = hospital * 1e3;
				newNpcs.targets[id] = {
					levels: {
						1: hospital,
						2: hospital + TO_MILLIS.MINUTES * 30,
						3: hospital + TO_MILLIS.MINUTES * 90,
						4: hospital + TO_MILLIS.MINUTES * 210,
						5: hospital + TO_MILLIS.MINUTES * 450
					},
					name: NPCS[id] ?? "Unknown",
					order: parseInt(id)
				};
				newNpcs.targets[id].current = getCurrentLevel(newNpcs.targets[id]);
			}
			await ttStorage.set({ npcs: newNpcs });
			return true;
		}
		async function fetchTornStats() {
			const data = await fetchData("tornstats", { section: "loot" });
			if (data && !data.status) return await updateLevels();
			const newNpcs = {
				next_update: now + TO_MILLIS.MINUTES * 15,
				service: "TornStats",
				targets: {}
			};
			for (const npc of Object.values(data).filter((x) => typeof x === "object").filter((npc) => npc.torn_id)) {
				newNpcs.targets[npc.torn_id] = {
					levels: {
						1: npc.hosp_out * 1e3,
						2: npc.loot_2 * 1e3,
						3: npc.loot_3 * 1e3,
						4: npc.loot_4 * 1e3,
						5: npc.loot_5 * 1e3
					},
					name: npc.name,
					order: npc.torn_id
				};
				newNpcs.targets[npc.torn_id].current = getCurrentLevel(newNpcs.targets[npc.torn_id]);
			}
			await ttStorage.set({ npcs: newNpcs });
			return true;
		}
		async function fetchLootRangers() {
			const result = await fetchData("lzpt", { section: "loot" });
			if (!("npcs" in result)) {
				await ttStorage.set({ npcs: {
					error: "No NPC results from Loot Rangers.",
					next_update: now + TO_MILLIS.MINUTES * 5,
					service: "Loot Rangers"
				} });
				return;
			}
			const { time: { clear: planned, reason, attack: ongoing }, ...data } = result;
			const newNpcs = {
				next_update: now + TO_MILLIS.MINUTES * (ongoing || planned === 0 && !reason ? 1 : 15),
				service: "Loot Rangers",
				targets: {}
			};
			for (const [_id, npc] of Object.entries(data.npcs)) {
				const id = parseInt(_id);
				const hospital = npc.hosp_out * 1e3;
				newNpcs.targets[id] = {
					levels: {
						1: hospital,
						2: hospital + TO_MILLIS.MINUTES * 30,
						3: hospital + TO_MILLIS.MINUTES * 90,
						4: hospital + TO_MILLIS.MINUTES * 210,
						5: hospital + TO_MILLIS.MINUTES * 450
					},
					name: npc.name || (NPCS[id] ?? "Unknown"),
					scheduled: npc.next ?? true,
					order: data.order.indexOf(id) + (npc.next ? 0 : 10)
				};
				newNpcs.targets[id].current = getCurrentLevel(newNpcs.targets[id]);
			}
			newNpcs.planned = planned === 0 ? false : planned * 1e3;
			newNpcs.reason = reason;
			await ttStorage.set({ npcs: newNpcs });
			return true;
		}
		async function updateLevels() {
			if (!("targets" in npcs)) return false;
			const targets = {};
			for (const [id, npc] of Object.entries(npcs.targets)) {
				const current = getCurrentLevel(npc);
				if (npc.current !== current) targets[id] = { current };
			}
			if (Object.keys(targets).length) {
				await ttStorage.change({ npcs: { targets } });
				return true;
			}
			return false;
		}
		function getCurrentLevel(npc) {
			return Object.entries(npc.levels).filter(([, time]) => time <= now).map(([level, time]) => ({
				level: parseInt(level),
				time
			}))?.at(-1)?.level ?? 0;
		}
		async function checkNPCAlerts() {
			if (!settings.notifications.types.global || !settings.notifications.types.npcsGlobal) return 0;
			if (!("targets" in npcs)) return 0;
			let alerts = 0;
			for (const { id, level, minutes } of settings.notifications.types.npcs.filter((npc) => npc.level !== "" && npc.minutes !== "")) {
				const npc = npcs.targets[id];
				if (!npc) {
					await ttStorage.update("notifications", (notifications) => delete notifications.npcs[id]);
					continue;
				}
				const time = npc.levels[level];
				if (!time) {
					await ttStorage.update("notifications", (notifications) => delete notifications.npcs[id]);
					continue;
				}
				const left = time - now;
				const _minutes = Math.ceil(left / TO_MILLIS.MINUTES);
				if (_minutes > minutes || _minutes < 0) {
					await ttStorage.update("notifications", (notifications) => delete notifications.npcs[id]);
					continue;
				}
				if (notifications.npcs[id]) continue;
				const notification = newNotification("NPC Loot", `${npc.name} is reaching loot level ${formatNumber(level, { roman: true })} in ${formatTime(left, { type: "wordTimer" })}.`, `https://www.torn.com/profiles.php?XID=${id}`);
				await dispatchNotification(notification);
				await ttStorage.change({ notifications: { npcs: { [id]: notification } } });
				alerts++;
			}
			if (settings.notifications.types.npcPlannedEnabled && npcs.planned) for (const minutes of settings.notifications.types.npcPlanned.sort()) {
				const key = `npc_planned_${minutes}`;
				const time = npcs.planned;
				if (!time) {
					await ttStorage.update("notifications", (notifications) => delete notifications.npcs[key]);
					continue;
				}
				const left = time - now;
				const minutesPlanned = Math.ceil(left / TO_MILLIS.MINUTES);
				if (minutesPlanned > minutes || minutesPlanned < 0) {
					await ttStorage.update("notifications", (notifications) => delete notifications.npcs[key]);
					continue;
				}
				if (notifications.npcs[key]) continue;
				const notification = newNotification("NPC Loot", `There is a planned attack in ${formatTime(left, { type: "wordTimer" })}.`);
				await dispatchNotification(notification);
				await ttStorage.change({ notifications: { npcs: { [key]: notification } } });
				alerts++;
			}
			return alerts;
		}
		function triggerUpdate() {
			const shortest = "targets" in npcs ? Object.values(npcs.targets).flatMap((npc) => Object.values(npc.levels)).filter((time) => time > now).sort((a, b) => a - b)[0] : null;
			if (!shortest) return;
			if (npcUpdater) clearTimeout(npcUpdater);
			npcUpdater = setTimeout(() => {
				updateLevels();
				npcUpdater = void 0;
			}, shortest - Date.now());
		}
	}
	//#endregion
	//#region src/extension/entrypoints/background/updates/stakeouts.ts
	var UPDATE_JITTER$1 = 1e3;
	async function updateStakeouts(forceUpdate = false) {
		await loadDatabase(true);
		const now = Date.now();
		if (!forceUpdate && stakeouts.date && !hasTimePassed(stakeouts.date - UPDATE_JITTER$1, TO_MILLIS.SECONDS * settings.apiUsage.delayStakeouts)) return { updated: false };
		let success = 0;
		let failed = 0;
		for (const stakeout of stakeouts.list) {
			const id = stakeout.id;
			const oldData = stakeout?.info ?? null;
			let data;
			try {
				data = await fetchData("tornv2", {
					section: "user",
					selections: ["profile"],
					id,
					silent: true
				});
				if (!data) {
					console.log("Unexpected result during stakeout updating.");
					failed++;
					continue;
				}
				success++;
			} catch (e) {
				console.log("STAKEOUT error", e);
				failed++;
				continue;
			}
			if (stakeout.alerts) {
				const { label } = stakeout;
				const { okay, hospital, flying, landing, online, life, offline, revivable } = stakeout.alerts;
				if (okay) {
					const key = `${id}_okay`;
					if (data.profile.status.state === "Okay" && (!oldData || oldData.status.state !== data.profile.status.state) && !notifications.stakeouts[key]) {
						if (settings.notifications.types.global) {
							const notification = newNotification("Stakeouts", label ? `${data.profile.name} (${label}) is now okay.` : `${data.profile.name} is now okay.`, `https://www.torn.com/profiles.php?XID=${id}`);
							await dispatchNotification(notification);
							await ttStorage.change({ notifications: { stakeouts: { [key]: notification } } });
						}
					} else if (data.profile.status.state !== "Okay") await ttStorage.update("notifications", (notifications) => delete notifications.stakeouts[key]);
				}
				if (hospital) {
					const key = `${id}_hospital`;
					if (data.profile.status.state === "Hospital" && (!oldData || oldData.status.state !== data.profile.status.state)) {
						if (settings.notifications.types.global) {
							let reasonText = "";
							const reason = getHospitalizationReason(data.profile.status.details);
							if (reason?.important) {
								reasonText = reason.display_sentence ?? reason.display ?? reason.name;
								reasonText = ` ${reasonText}`;
							}
							const notification = newNotification("Stakeouts", label ? `${data.profile.name} (${label}) is now in the hospital${reasonText}.` : `${data.profile.name} is now in the hospital${reasonText}.`, `https://www.torn.com/profiles.php?XID=${id}`);
							await dispatchNotification(notification);
							await ttStorage.change({ notifications: { stakeouts: { [key]: notification } } });
						}
					} else if (data.profile.status.state !== "Hospital") await ttStorage.update("notifications", (notifications) => delete notifications.stakeouts[key]);
				}
				if (flying) {
					const key = `${id}_flying`;
					if (data.profile.status.state === "Traveling" && (!oldData || oldData.status.state !== data.profile.status.state) && !notifications.stakeouts[key]) {
						if (settings.notifications.types.global) {
							const notification = newNotification("Stakeouts", label ? `${data.profile.name} (${label}) is now flying.` : `${data.profile.name} is now flying.`, `https://www.torn.com/profiles.php?XID=${id}`);
							await dispatchNotification(notification);
							await ttStorage.change({ notifications: { stakeouts: { [key]: notification } } });
						}
					} else if (data.profile.status.state !== "Traveling") await ttStorage.update("notifications", (notifications) => delete notifications.stakeouts[key]);
				}
				if (landing) {
					const key = `${id}_landing`;
					if (data.profile.status.state !== "Traveling" && (!oldData || oldData.status.state !== data.profile.status.state) && !notifications.stakeouts[key]) {
						if (settings.notifications.types.global) {
							const notification = newNotification("Stakeouts", label ? `${data.profile.name} (${label}) is now ${data.profile.status.state === "Abroad" ? data.profile.status.description : "in Torn"}.` : `${data.profile.name} is now ${data.profile.status.state === "Abroad" ? data.profile.status.description : "in Torn"}.`, `https://www.torn.com/profiles.php?XID=${id}`);
							await dispatchNotification(notification);
							await ttStorage.change({ notifications: { stakeouts: { [key]: notification } } });
						}
					} else if (data.profile.status.state === "Traveling") await ttStorage.update("notifications", (notifications) => delete notifications.stakeouts[key]);
				}
				if (online) {
					const key = `${id}_online`;
					if (data.profile.last_action.status === "Online" && (!oldData || oldData.last_action.status !== data.profile.last_action.status) && !notifications.stakeouts[key]) {
						if (settings.notifications.types.global) {
							const notification = newNotification("Stakeouts", label ? `${data.profile.name} (${label}) is now online.` : `${data.profile.name} is now online.`, `https://www.torn.com/profiles.php?XID=${id}`);
							await dispatchNotification(notification);
							await ttStorage.change({ notifications: { stakeouts: { [key]: notification } } });
						}
					} else if (data.profile.last_action.status !== "Online") await ttStorage.update("notifications", (notifications) => delete notifications.stakeouts[key]);
				}
				if (life) {
					const key = `${id}_life`;
					if (data.profile.life.current <= data.profile.life.maximum * (life / 100) && !notifications.stakeouts[key]) {
						if (settings.notifications.types.global) {
							const notification = newNotification("Stakeouts", label ? `${data.profile.name}'${data.profile.name.endsWith("s") ? "" : "s"} (${label}) life has dropped below ${life}%.` : `${data.profile.name}'${data.profile.name.endsWith("s") ? "" : "s"} life has dropped below ${life}%.`, `https://www.torn.com/profiles.php?XID=${id}`);
							await dispatchNotification(notification);
							await ttStorage.change({ notifications: { stakeouts: { [key]: notification } } });
						}
					} else if (data.profile.life.current > data.profile.life.maximum * (life / 100)) await ttStorage.update("notifications", (notifications) => delete notifications.stakeouts[key]);
				}
				if (offline) {
					const oldOfflineHours = oldData ? dropDecimals((now - oldData.last_action.timestamp * 1e3) / TO_MILLIS.HOURS) : null;
					const offlineHours = dropDecimals((now - data.profile.last_action.timestamp * 1e3) / TO_MILLIS.HOURS);
					const key = `${id}_offline`;
					if (offlineHours >= offline && (!oldOfflineHours || oldOfflineHours < offlineHours) && !notifications.stakeouts[key]) {
						if (settings.notifications.types.global) {
							const notification = newNotification("Stakeouts", label ? `${data.profile.name} (${label}) has been offline for ${offlineHours} hours.` : `${data.profile.name} has been offline for ${offlineHours} hours.`, `https://www.torn.com/profiles.php?XID=${id}`);
							await dispatchNotification(notification);
							await ttStorage.change({ notifications: { stakeouts: { [key]: notification } } });
						}
					} else if (offlineHours < offline) await ttStorage.update("notifications", (notifications) => delete notifications.stakeouts[key]);
				}
				if (revivable) {
					const oldIsRevivable = oldData?.isRevivable ?? false;
					const isRevivable = data.profile.revivable;
					const key = `${id}_revivable`;
					if (!oldIsRevivable && isRevivable && !notifications.stakeouts[key]) {
						if (settings.notifications.types.global) {
							const notification = newNotification("Stakeouts", label ? `${data.profile.name} (${label}) is now revivable.` : `${data.profile.name} is now revivable.`, `https://www.torn.com/profiles.php?XID=${id}`);
							await dispatchNotification(notification);
							await ttStorage.change({ notifications: { stakeouts: { [key]: notification } } });
						}
					} else if (!isRevivable) await ttStorage.update("notifications", (notifications) => delete notifications.stakeouts[key]);
				}
			}
			const existingIndex = stakeouts.list.findIndex((e) => e.id === id);
			if (existingIndex !== -1) stakeouts.list[existingIndex] = {
				...stakeout,
				info: {
					name: data.profile.name,
					last_action: {
						status: data.profile.last_action.status,
						relative: data.profile.last_action.relative,
						timestamp: data.profile.last_action.timestamp * 1e3
					},
					life: {
						current: data.profile.life.current,
						maximum: data.profile.life.maximum
					},
					status: {
						state: data.profile.status.state,
						color: data.profile.status.color,
						until: data.profile.status.until ? data.profile.status.until * 1e3 : null,
						description: data.profile.status.description
					},
					isRevivable: data.profile.revivable
				}
			};
		}
		stakeouts.date = now;
		await ttStorage.change({ stakeouts });
		return {
			updated: true,
			success,
			failed
		};
	}
	//#endregion
	//#region src/extension/entrypoints/background/updates/stockdata.ts
	async function updateStocks() {
		const oldStocks = [...stockdata?.stocks ?? []];
		const stocks = (await fetchData("tornv2", {
			section: "torn",
			selections: ["stocks"]
		})).stocks;
		if (!stocks?.length) throw new Error("Aborted updating due to an unexpected response.");
		await ttStorage.change({ stockdata: {
			stocks,
			date: Date.now()
		} });
		if (oldStocks.length && settings.notifications.types.global) for (const _id in settings.notifications.types.stocks) {
			const id = parseInt(_id);
			const oldStock = oldStocks.find((s) => s.id === id);
			if (!oldStock) continue;
			const newStock = stocks.find((s) => s.id === id);
			if (!newStock) continue;
			const alerts = settings.notifications.types.stocks[id];
			if (alerts.priceFalls && oldStock.market.price > alerts.priceFalls && newStock.market.price <= alerts.priceFalls) await dispatchNotification({
				title: "TornTools -  Stock Alerts",
				message: `(${newStock.acronym}) ${newStock.name} has fallen to ${formatNumber(newStock.market.price, { currency: true })} (alert: ${formatNumber(alerts.priceFalls, { currency: true })})!`,
				url: LINKS.stocks,
				date: Date.now()
			});
			else if (alerts.priceReaches && oldStock.market.price < alerts.priceReaches && newStock.market.price >= alerts.priceReaches) await dispatchNotification({
				title: "TornTools -  Stock Alerts",
				message: `(${newStock.acronym}) ${newStock.name} has reached ${formatNumber(newStock.market.price, { currency: true })} (alert: ${formatNumber(alerts.priceReaches, { currency: true })})!`,
				url: LINKS.stocks,
				date: Date.now()
			});
		}
	}
	//#endregion
	//#region src/extension/entrypoints/background/updates/torndata.ts
	async function updateTorndata() {
		const data = await fetchData("tornv2", {
			section: "torn",
			selections: [
				"education",
				"calendar",
				"properties",
				"honors",
				"medals",
				"items"
			],
			legacySelections: ["pawnshop", "stats"]
		});
		if (data.stats.points_averagecost === null || data.stats.points_averagecost <= 0) throw new Error("Aborted updating due to an unexpected/corrupted response.");
		const newData = {
			...data,
			itemsMap: data.items.reduce((map, item) => {
				map[item.id] = item;
				return map;
			}, {}),
			date: Date.now()
		};
		setTorndata(newData);
		await ttStorage.set({ torndata: newData });
	}
	//#endregion
	//#region src/extension/entrypoints/background/updates/icon-bars.ts
	var context;
	async function showIconBars() {
		if (!settings.apiUsage.user.bars || !hasAPIData() || !settings.pages.icon.global) {
			await browser.action.setIcon({ path: browser.runtime.getURL("/images/icon_128.png") });
			return;
		}
		let barCount = 0;
		if (settings.pages.icon.energy) barCount++;
		if (settings.pages.icon.nerve) barCount++;
		if (settings.pages.icon.happy) barCount++;
		if (settings.pages.icon.life) barCount++;
		if (settings.pages.icon.chain && userdata.bars.chain && userdata.bars.chain.current > 0) barCount++;
		if (settings.pages.icon.travel && userdata.travel.time_left > 0) barCount++;
		let canvas;
		let canvasContext;
		if (!context) {
			canvas = new OffscreenCanvas(128, 128);
			canvasContext = canvas.getContext("2d");
			context = {
				canvas,
				canvasContext
			};
		} else {
			canvas = context.canvas;
			canvasContext = context.canvasContext;
		}
		canvasContext.fillStyle = "#fff";
		canvasContext.fillRect(0, 0, canvas.width, canvas.height);
		const padding = 10;
		const barHeight = (canvas.height - (barCount + 1) * 10) / barCount;
		const barWidth = canvas.width - padding * 2;
		const BAR_COLORS = {
			energy: "#7cc833",
			nerve: "#b3382c",
			happy: "#e3e338",
			life: "#7b98ee",
			chain: "#333",
			travel: "#d961ee"
		};
		let y = padding;
		Object.keys(BAR_COLORS).forEach((key) => {
			if (!settings.pages.icon[key]) return;
			if (key === "travel") {
				if (userdata.travel.time_left <= 0) return;
			} else if (key === "chain") {
				if (!userdata.bars.chain || userdata.bars.chain.current === 0) return;
			} else if (!userdata.bars[key]) return;
			let current, maximum;
			if (key === "travel") {
				const totalTrip = userdata.travel.arrival_at - userdata.travel.departed_at;
				current = totalTrip - userdata.travel.time_left;
				maximum = totalTrip;
			} else if (key === "chain") {
				current = userdata.bars[key].current;
				maximum = userdata.bars[key].max;
				if (current !== maximum) maximum = getNextChainBonus(current);
			} else {
				current = userdata.bars[key].current;
				maximum = userdata.bars[key].maximum;
			}
			let width = barWidth * (current / maximum);
			width = Math.min(width, barWidth);
			canvasContext.fillStyle = BAR_COLORS[key];
			canvasContext.fillRect(padding, y, width, barHeight);
			y += barHeight + padding;
		});
		await browser.action.setIcon({ imageData: canvasContext.getImageData(0, 0, canvas.width, canvas.height) });
	}
	//#endregion
	//#region src/extension/entrypoints/background/updates/userdata.ts
	var UPDATE_JITTER = 1e3;
	async function updateUserdata(forceUpdate = false) {
		const now = Date.now();
		const updatedTypes = [];
		const updateEssential = forceUpdate || !userdata || !Object.keys(userdata).length || hasTimePassed((userdata.date ?? 0) - UPDATE_JITTER, TO_MILLIS.SECONDS * settings.apiUsage.delayEssential);
		const updateBasic = updateEssential && (forceUpdate || !userdata?.dateBasic || hasTimePassed(userdata?.dateBasic - UPDATE_JITTER, TO_MILLIS.SECONDS * settings.apiUsage.delayBasic) && !hasTimePassed(userdata?.profile?.last_action?.timestamp * 1e3, TO_MILLIS.MINUTES * 5));
		const updatePassive = updateEssential && (forceUpdate || !userdata?.datePassive || hasTimePassed(userdata?.datePassive - UPDATE_JITTER, TO_MILLIS.SECONDS * settings.apiUsage.delayPassive) && !hasTimePassed(userdata?.profile?.last_action?.timestamp * 1e3, TO_MILLIS.MINUTES * 5));
		const selections = [];
		const selectionsV2 = [];
		if (updateEssential) {
			selectionsV2.push("profile", "faction", "job", "timestamp", "notifications");
			for (const selection of [
				"bars",
				"cooldowns",
				"icons",
				"newmessages",
				"money",
				"travel",
				"refills"
			]) {
				if (!settings.apiUsage.user[selection]) continue;
				selectionsV2.push(selection);
			}
			updatedTypes.push("essential");
		}
		if (updateBasic) {
			for (const selection of ["perks", "networth"]) {
				if (!settings.apiUsage.user[selection]) continue;
				selections.push(selection);
			}
			for (const selection of [
				"ammo",
				"battlestats",
				"skills",
				"calendar",
				"organizedcrime",
				"personalstats",
				"honors",
				"weaponexp",
				"medals",
				"properties",
				"missions",
				"workstats",
				"virus",
				"merits",
				"stocks"
			]) {
				if (!settings.apiUsage.user[selection]) continue;
				selectionsV2.push(selection);
			}
			if (settings.apiUsage.user.education && !hasFinishedEducation()) selectionsV2.push("education");
			updatedTypes.push("basic");
		}
		if (updatePassive) {
			for (const selection of ["jobpoints"]) {
				if (!settings.apiUsage.user[selection]) continue;
				selectionsV2.push(selection);
			}
			updatedTypes.push("passive");
		}
		if (attackHistory.fetchData && settings.apiUsage.user.attacks && settings.pages.global.keepAttackHistory) {
			selectionsV2.push("attacks");
			updatedTypes.push("attack history");
		}
		if (!selections.length && !selectionsV2.length) return { updated: false };
		const fetchOptions = {
			section: "user",
			legacySelections: selections,
			selections: selectionsV2,
			params: {
				cat: "all",
				timestamp: Math.floor(Date.now() / 1e3)
			}
		};
		const fetchedUserdata = await fetchData("tornv2", fetchOptions);
		validateUserdataResponse(fetchedUserdata, buildFetchRequest("tornv2", mergeOptions(fetchOptions)));
		const oldUserdata = (await loadDatabase()).userdata;
		const newUserdata = {
			...oldUserdata,
			...fetchedUserdata,
			date: now,
			dateBasic: updateBasic ? now : oldUserdata?.dateBasic ?? now,
			datePassive: updatePassive ? now : oldUserdata?.datePassive ?? now
		};
		if (oldUserdata?.notifications?.events !== newUserdata?.notifications?.events) {
			const newEventsCount = (newUserdata?.notifications?.events ?? 0) - (oldUserdata?.notifications?.events ?? 0);
			if (newEventsCount > 0) {
				const category = newEventsCount <= 25 ? "newevents" : "events";
				newUserdata.events = (await fetchData("tornv2", {
					section: "user",
					selections: [category],
					params: { limit: newEventsCount }
				})).events;
				selections.push(category);
			}
		}
		if (!("events" in newUserdata) || newUserdata?.notifications?.events === 0) newUserdata.events = [];
		await processUserdata().catch((error) => console.error("Error while processing userdata.", error));
		await checkAttacks().catch((error) => console.error("Error while checking personal stats for attack changes.", error));
		setUserdata(newUserdata);
		await ttStorage.set({ userdata: newUserdata });
		await showIconBars().catch((error) => console.error("Error while updating the icon bars.", error));
		if (updateEssential) {
			await notifyEventMessages().catch((error) => console.error("Error while sending event and message notifications.", error));
			await notifyTravelLanding().catch((error) => console.error("Error while sending travel landing notifications.", error));
			await notifyBars().catch((error) => console.error("Error while sending bar notification.", error));
			await notifyOffline().catch((error) => console.error("Error while sending offline notification.", error));
			await notifyChain().catch((error) => console.error("Error while sending chain notifications.", error));
			await notifyTraveling().catch((error) => console.error("Error while sending traveling notifications.", error));
			await notifyMissions().catch((error) => console.error("Error while sending mission notifications.", error));
			await notifyRefills().catch((error) => console.error("Error while sending refill notifications.", error));
		}
		await notifyStatusChange().catch((error) => console.error("Error while sending status change notifications.", error));
		await notifyCooldownOver().catch((error) => console.error("Error while sending cooldown notifications.", error));
		await notifyEducation().catch((error) => console.error("Error while sending education notifications.", error));
		await notifyNewDay().catch((error) => console.error("Error while sending new day notification.", error));
		await notifyHospital().catch((error) => console.error("Error while sending hospital notifications.", error));
		await notifySpecificCooldowns().catch((error) => console.error("Error while sending specific cooldown notifications.", error));
		return {
			updated: true,
			types: updatedTypes,
			selections: [...selections, ...selectionsV2]
		};
		async function checkAttacks() {
			if (!settings.pages.global.keepAttackHistory) return;
			if (newUserdata.attacks) {
				await updateAttackHistory();
				delete newUserdata.attacks;
			}
			if (oldUserdata.personalstats && newUserdata.personalstats) {
				const fetchData = [
					(data) => data.personalstats.attacking.attacks.lost,
					(data) => data.personalstats.attacking.attacks.stalemate,
					(data) => data.personalstats.attacking.defends.lost,
					(data) => data.personalstats.attacking.defends.stalemate,
					(data) => data.personalstats.attacking.killstreak.current
				].some((getter) => getter(oldUserdata) !== getter(newUserdata));
				await ttStorage.change({ attackHistory: { fetchData } });
			}
			async function updateAttackHistory() {
				let lastAttack = attackHistory.lastAttack;
				newUserdata.attacks.filter(({ id }) => id > attackHistory.lastAttack).forEach((attack) => {
					if (attack.id > lastAttack) lastAttack = attack.id;
					const enemyId = attack.attacker?.id === newUserdata.profile.id ? attack.defender.id : attack.attacker?.id;
					if (!enemyId) return;
					attackHistory.history[enemyId] = {
						name: "",
						defend: 0,
						defend_lost: 0,
						lose: 0,
						stalemate: 0,
						win: 0,
						stealth: 0,
						mug: 0,
						hospitalise: 0,
						leave: 0,
						arrest: 0,
						assist: 0,
						special: 0,
						escapes: 0,
						respect: [],
						respect_base: [],
						...enemyId in attackHistory.history ? attackHistory.history[enemyId] : {},
						lastAttack: attack.ended * 1e3,
						lastAttackCode: attack.code
					};
					if (attack.defender.id === newUserdata.profile.id) {
						if (attack.attacker.name) attackHistory.history[enemyId].name = attack.attacker.name;
						if (attack.result === "Assist") {} else if ([
							"Lost",
							"Timeout",
							"Escape",
							"Stalemate"
						].includes(attack.result)) attackHistory.history[enemyId].defend++;
						else attackHistory.history[enemyId].defend_lost++;
					} else if (attack.attacker?.id === newUserdata.profile.id) {
						if (attack.defender.name) attackHistory.history[enemyId].name = attack.defender.name;
						if (attack.result === "Lost" || attack.result === "Timeout") attackHistory.history[enemyId].lose++;
						else if (attack.result === "Stalemate") attackHistory.history[enemyId].stalemate++;
						else if (attack.result === "Assist") attackHistory.history[enemyId].assist++;
						else if (attack.result === "Escape") attackHistory.history[enemyId].escapes++;
						else {
							attackHistory.history[enemyId].win++;
							if (attack.is_stealthed) attackHistory.history[enemyId].stealth++;
							let respect = attack.respect_gain;
							if (respect !== 0) {
								let hasAccurateModifiers = "modifiers" in attack;
								if (hasAccurateModifiers) {
									if (respect === attack.modifiers.chain) {
										respect = 1;
										hasAccurateModifiers = false;
									} else {
										if (attack.result === "Mugged") respect /= .75;
										respect = respect / attack.modifiers.war / attack.modifiers.retaliation / attack.modifiers.group / attack.modifiers.overseas / attack.modifiers.chain / attack.modifiers.warlord;
									}
									attackHistory.history[enemyId].latestFairFightModifier = attack.modifiers.fair_fight;
								}
								attackHistory.history[enemyId][hasAccurateModifiers ? "respect_base" : "respect"].push(respect);
							}
							switch (attack.result) {
								case "Mugged":
									attackHistory.history[enemyId].mug++;
									break;
								case "Hospitalized":
									attackHistory.history[enemyId].hospitalise++;
									break;
								case "Attacked":
									attackHistory.history[enemyId].leave++;
									break;
								case "Arrested":
									attackHistory.history[enemyId].arrest++;
									break;
								case "Special":
									attackHistory.history[enemyId].special++;
									break;
							}
						}
					}
				});
				await ttStorage.change({ attackHistory: {
					lastAttack,
					fetchData: false,
					history: { ...attackHistory.history }
				} });
			}
		}
		async function processUserdata() {
			if ("icons" in newUserdata) {
				const icon85 = newUserdata.icons.find(({ id }) => id === 85);
				if (icon85) newUserdata.userCrime = icon85.until * 1e3;
				else if (newUserdata.icons.some(({ id }) => id === 86)) newUserdata.userCrime = newUserdata.timestamp * TO_MILLIS.SECONDS;
				else newUserdata.userCrime = -1;
			}
		}
		async function notifyEventMessages() {
			if (settings.apiUsage.user.newevents && settings.notifications.types.global && settings.notifications.types.events) {
				const events = newUserdata.events.filter((event) => !notifications.events[event.id]);
				if (events.length) {
					let message = events.at(-1).event.replace(/<\/?[^>]+(>|$)/g, "");
					if (events.length > 1) message += `\n(and ${events.length - 1} more event${events.length > 2 ? "s" : ""})`;
					await dispatchNotification(newNotification(`New Event${applyPlural(events.length)}`, message, LINKS.events));
					await Promise.all(events.map((event) => ttStorage.change({ notifications: { events: { [event.id]: { combined: true } } } })));
				}
			}
			if (settings.apiUsage.user.newmessages && settings.notifications.types.global && settings.notifications.types.messages) {
				const messages = newUserdata.messages.filter(({ seen }) => !seen).filter((message) => !notifications.messages[message.id]);
				if (messages.length) {
					let message = `${messages.at(-1).topic} - by ${messages.at(-1).sender.name}`;
					if (messages.length > 1) message += `\n(and ${messages.length - 1} more message${messages.length > 2 ? "s" : ""})`;
					await dispatchNotification(newNotification(`New Message${applyPlural(messages.length)}`, message, LINKS.messages));
					await Promise.all(messages.map((message) => ttStorage.change({ notifications: { messages: { [message.id]: { combined: true } } } })));
				}
			}
			await setBadge("count", {
				events: newUserdata.notifications.events,
				messages: newUserdata.notifications.messages
			});
		}
		async function notifyStatusChange() {
			if (!settings.notifications.types.global || !settings.notifications.types.status || !oldUserdata.profile?.status) return;
			const previous = oldUserdata.profile.status.state;
			const current = newUserdata.profile.status.state;
			if (current === previous || current === "Traveling" || current === "Abroad") return;
			if (current === "Okay") {
				if (previous === "Hospital") await dispatchNotification({
					title: "TornTools - Status",
					message: "You are out of the hospital.",
					url: LINKS.home,
					type: "status",
					key: Date.now(),
					date: Date.now()
				});
				else if (previous === "Jail") await dispatchNotification({
					title: "TornTools - Status",
					message: "You are out of the jail.",
					url: LINKS.home,
					date: Date.now()
				});
			} else await dispatchNotification({
				title: "TornTools - Status",
				message: newUserdata.profile.status.description,
				url: LINKS.home,
				date: Date.now()
			});
		}
		async function notifyCooldownOver() {
			if (!settings.apiUsage.user.cooldowns || !settings.notifications.types.global || !settings.notifications.types.cooldowns || !oldUserdata.cooldowns) return;
			for (const type in newUserdata.cooldowns) {
				if (newUserdata.cooldowns[type] || !oldUserdata.cooldowns[type]) continue;
				await dispatchNotification({
					title: "TornTools - Cooldown",
					message: `Your ${type} cooldown has ended.`,
					url: LINKS.items,
					date: Date.now()
				});
			}
		}
		async function notifyTravelLanding() {
			if (!settings.apiUsage.user.travel || !settings.notifications.types.global || !settings.notifications.types.traveling || !oldUserdata.travel) return;
			if (newUserdata.travel.time_left !== 0 || oldUserdata.travel.time_left === 0) return;
			await dispatchNotification({
				title: "TornTools - Traveling",
				message: `You have landed in ${newUserdata.travel.destination}.`,
				url: LINKS.home,
				date: Date.now()
			});
		}
		async function notifyEducation() {
			if (!settings.apiUsage.user.education || !settings.notifications.types.global || !settings.notifications.types.education || !oldUserdata.education.current || newUserdata.education.current) return;
			await dispatchNotification({
				title: "TornTools - Education",
				message: "You have finished your education course.",
				url: LINKS.education,
				date: Date.now()
			});
		}
		async function notifyNewDay() {
			if (!settings.notifications.types.global || !settings.notifications.types.newDay) return;
			const date = /* @__PURE__ */ new Date();
			const utc = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
			if (date.getUTCHours() !== 0 || date.getUTCMinutes() !== 0 || utc in notifications.newDay) return;
			const notification = newNotification("New Day", "It's a new day! Hopefully a sunny one.", LINKS.home);
			await dispatchNotification(notification);
			await ttStorage.change({ notifications: { newDay: { [utc]: notification } } });
		}
		async function notifyBars() {
			if (!settings.apiUsage.user.bars || !settings.notifications.types.global) return;
			for (const bar of [
				"energy",
				"happy",
				"nerve",
				"life"
			]) {
				if (!settings.notifications.types[bar].length || !oldUserdata.bars?.[bar]) continue;
				const checkpoints = settings.notifications.types[bar].map((checkpoint) => typeof checkpoint === "string" && checkpoint.includes("%") ? parseInt(checkpoint) / 100 * newUserdata.bars[bar].maximum : parseInt(checkpoint.toString())).sort((a, b) => b - a);
				for (const checkpoint of checkpoints) if (oldUserdata.bars[bar].current < newUserdata.bars[bar].current && newUserdata.bars[bar].current >= checkpoint && !notifications[bar][checkpoint]) {
					const url = (() => {
						switch (bar) {
							case "energy": return LINKS.gym;
							case "happy": return LINKS.items_candy;
							case "nerve": return LINKS.crimes;
							case "life": return LINKS.items_medical;
							default: return LINKS.home;
						}
					})();
					const notification = newNotification("Bars", `Your ${capitalizeText(bar)} bar has reached ${newUserdata.bars[bar].current}/${newUserdata.bars[bar].maximum}.`, url);
					await dispatchNotification(notification);
					await ttStorage.change({ notifications: { [bar]: { [checkpoint]: notification } } });
					break;
				} else if (newUserdata.bars[bar].current < checkpoint && notifications[bar][checkpoint]) await ttStorage.update("notifications", (notifications) => delete notifications[bar][checkpoint]);
			}
		}
		async function notifyOffline() {
			if (!settings.notifications.types.global || !settings.notifications.types.offline.length || !oldUserdata?.profile?.last_action?.timestamp) return;
			const checkpoints = settings.notifications.types.offline.sort((a, b) => b - a);
			const oldHoursOffline = Math.floor((oldUserdata.timestamp - oldUserdata.profile.last_action.timestamp) * TO_MILLIS.SECONDS / TO_MILLIS.HOURS);
			const hoursOffline = Math.floor((newUserdata.timestamp - newUserdata.profile.last_action.timestamp) * TO_MILLIS.SECONDS / TO_MILLIS.HOURS);
			for (const checkpoint of checkpoints) if (oldHoursOffline < hoursOffline && hoursOffline >= checkpoint && !notifications.offline[checkpoint]) {
				const notification = newNotification("Offline", `You've been offline for over ${checkpoint} hour${applyPlural(checkpoint)}.`, LINKS.home);
				await dispatchNotification(notification);
				await ttStorage.change({ notifications: { offline: { [checkpoint]: notification } } });
				break;
			} else if (hoursOffline < checkpoint && notifications.offline[checkpoint]) await ttStorage.update("notifications", (notifications) => delete notifications.offline[checkpoint]);
		}
		async function notifyChain() {
			if (!settings.apiUsage.user.bars || !settings.notifications.types.global) return;
			if (settings.notifications.types.chainTimerEnabled && settings.notifications.types.chainTimer.length > 0 && newUserdata.bars?.chain && newUserdata.bars.chain.timeout !== 0 && newUserdata.bars.chain.current >= 10) {
				const timeout = newUserdata.bars.chain.timeout * 1e3 - (now - newUserdata.timestamp * 1e3);
				const count = newUserdata.bars.chain.current;
				for (const checkpoint of settings.notifications.types.chainTimer.sort((a, b) => a - b)) {
					const key = `${count}_${checkpoint}`;
					if (timeout > checkpoint * TO_MILLIS.SECONDS || notifications.chain[key]) continue;
					const notification = newNotification("Chain", `Chain timer will run out in ${formatTime({ milliseconds: timeout }, { type: "wordTimer" })}.`, LINKS.chain);
					await dispatchNotification(notification);
					await ttStorage.change({ notifications: { chain: { [key]: notification } } });
					break;
				}
			} else await ttStorage.update("notifications", (notifications) => notifications.chain = {});
			if (settings.notifications.types.chainBonusEnabled && settings.notifications.types.chainBonus.length > 0 && newUserdata.bars?.chain && newUserdata.bars.chain.timeout !== 0 && newUserdata.bars.chain.current >= 10) {
				const count = newUserdata.bars.chain.current;
				const nextBonus = getNextChainBonus(count);
				for (const checkpoint of settings.notifications.types.chainBonus.sort((a, b) => b - a)) {
					const key = `${nextBonus}_${checkpoint}`;
					if (nextBonus - count > checkpoint || notifications.chainCount[key]) continue;
					const notification = newNotification("Chain", `Chain will reach the next bonus hit in ${nextBonus - count} hit${applyPlural(nextBonus - count)}.`, LINKS.chain);
					await dispatchNotification(notification);
					await ttStorage.change({ notifications: { chainCount: { [key]: notification } } });
					break;
				}
			} else await ttStorage.update("notifications", (notifications) => notifications.chainCount = {});
		}
		async function notifyHospital() {
			if (!settings.notifications.types.global) return;
			if (settings.notifications.types.leavingHospitalEnabled && settings.notifications.types.leavingHospital.length && newUserdata.profile.status.state === "Hospital") for (const checkpoint of settings.notifications.types.leavingHospital.sort((a, b) => a - b)) {
				const timeLeft = newUserdata.profile.status.until * 1e3 - now;
				if (timeLeft > checkpoint * TO_MILLIS.MINUTES || notifications.hospital[checkpoint]) continue;
				const notification = newNotification("Hospital", `You will be out of the hospital in ${formatTime({ milliseconds: timeLeft }, { type: "wordTimer" })}.`, LINKS.hospital);
				await dispatchNotification(notification);
				await ttStorage.change({ notifications: { hospital: { [checkpoint]: notification } } });
				break;
			}
			else await ttStorage.update("notifications", (notifications) => notifications.hospital = {});
		}
		async function notifyTraveling() {
			if (!settings.apiUsage.user.travel || !settings.notifications.types.global) return;
			if (settings.notifications.types.landingEnabled && settings.notifications.types.landing.length && newUserdata.travel.time_left) for (const checkpoint of settings.notifications.types.landing.sort((a, b) => a - b)) {
				const timeLeft = newUserdata.travel.arrival_at * 1e3 - now;
				if (timeLeft > checkpoint * TO_MILLIS.MINUTES || notifications.travel[checkpoint]) continue;
				const notification = newNotification("Travel", `You will be landing in ${formatTime({ milliseconds: timeLeft }, { type: "wordTimer" })}.`, LINKS.home);
				await dispatchNotification(notification);
				await ttStorage.change({ notifications: { travel: { [checkpoint]: notification } } });
				break;
			}
			else await ttStorage.update("notifications", (notifications) => notifications.travel = {});
		}
		async function notifySpecificCooldowns() {
			if (!settings.apiUsage.user.cooldowns || !settings.notifications.types.global) return;
			for (const cooldown of [
				{
					name: "drug",
					title: "Drugs",
					setting: "cooldownDrug",
					memory: "drugs",
					enabled: "cooldownDrugEnabled"
				},
				{
					name: "booster",
					title: "Boosters",
					setting: "cooldownBooster",
					memory: "boosters",
					enabled: "cooldownBoosterEnabled"
				},
				{
					name: "medical",
					title: "Medical",
					setting: "cooldownMedical",
					memory: "medical",
					enabled: "cooldownMedicalEnabled"
				}
			]) if (settings.notifications.types[cooldown.enabled] && settings.notifications.types[cooldown.setting].length && newUserdata.cooldowns[cooldown.name] > 0) for (const checkpoint of settings.notifications.types[cooldown.setting].sort((a, b) => a - b)) {
				const timeLeft = newUserdata.cooldowns[cooldown.name] * 1e3;
				if (timeLeft > parseFloat(checkpoint) * TO_MILLIS.MINUTES || notifications[cooldown.memory][checkpoint]) continue;
				const notification = newNotification(cooldown.title, `Your ${cooldown.name} cooldown will end in ${formatTime({ milliseconds: timeLeft }, { type: "wordTimer" })}.`, LINKS.items);
				await dispatchNotification(notification);
				await ttStorage.change({ notifications: { [cooldown.memory]: { [checkpoint]: notification } } });
			}
			else await ttStorage.update("notifications", (notifications) => notifications[cooldown.memory] = {});
		}
		async function notifyMissions() {
			if (!settings.apiUsage.user.missions || !settings.notifications.types.global) return;
			if (settings.notifications.types.missionsLimitEnabled && settings.notifications.types.missionsLimit) {
				const limitParts = settings.notifications.types.missionsLimit.split(":").map((part) => parseInt(part, 10));
				const cutoff = getUTCTodayAtTime(limitParts[0], limitParts[1]);
				if (/* @__PURE__ */ new Date() >= cutoff) for (const { name, contracts } of newUserdata.missions.givers) {
					const activeContracts = contracts.filter((contract) => contract.completed_at === null);
					const maxMissions = name in MAX_MISSIONS ? MAX_MISSIONS[name] : MAX_MISSIONS.DEFAULT;
					if (activeContracts.length >= maxMissions) {
						const now = /* @__PURE__ */ new Date();
						const key = `${name}_${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
						if (!(key in notifications.missionsLimit)) {
							const notification = newNotification("Missions", `You are currently at the maximum amount of contracts (${maxMissions}) for ${name}.`, LINKS.missions);
							await dispatchNotification(notification);
							await ttStorage.change({ notifications: { missionsLimit: { [key]: notification } } });
						}
					}
				}
			} else await ttStorage.update("notifications", (notifications) => notifications.missionsLimit = {});
			if (settings.notifications.types.missionsExpireEnabled && settings.notifications.types.missionsExpire.length) for (const { name, contracts } of newUserdata.missions.givers) {
				const ongoingMissions = contracts.filter((contract) => contract.status === "Accepted");
				for (const mission of ongoingMissions) for (const checkpoint of settings.notifications.types.missionsExpire.sort((a, b) => a - b)) {
					const timeLeft = mission.expires_at * 1e3 - now;
					const key = `${name}_${mission.title}_${mission.created_at}_${checkpoint}`;
					if (timeLeft > checkpoint * TO_MILLIS.HOURS || notifications.missionsExpire[key]) continue;
					const notification = newNotification("Missions", `'${mission.title}' by ${name} will expire in ${formatTime({ milliseconds: timeLeft }, {
						type: "wordTimer",
						showDays: true,
						truncateSeconds: true
					})}.`, LINKS.missions);
					await dispatchNotification(notification);
					await ttStorage.change({ notifications: { missionsExpire: { [key]: notification } } });
					break;
				}
			}
			else await ttStorage.update("notifications", (notifications) => notifications.missionsExpire = {});
		}
		async function notifyRefills() {
			if (!settings.apiUsage.user.refills || !settings.notifications.types.global) return;
			if (settings.notifications.types.refillEnergyEnabled && settings.notifications.types.refillEnergy) {
				const limitParts = settings.notifications.types.refillEnergy.split(":").map((part) => parseInt(part, 10));
				const cutoff = getUTCTodayAtTime(limitParts[0], limitParts[1]);
				if (/* @__PURE__ */ new Date() >= cutoff) {
					if (!newUserdata.refills.energy) {
						const now = /* @__PURE__ */ new Date();
						const key = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
						if (!(key in notifications.refillEnergy)) {
							const notification = newNotification("Refill", `You have yet to use your energy refill today.`, LINKS.points);
							await dispatchNotification(notification);
							await ttStorage.change({ notifications: { refillEnergy: { [key]: notification } } });
						}
					}
				}
			} else await ttStorage.update("notifications", (notifications) => notifications.refillEnergy = {});
			if (settings.notifications.types.refillNerveEnabled && settings.notifications.types.refillNerve) {
				const limitParts = settings.notifications.types.refillNerve.split(":").map((part) => parseInt(part, 10));
				const cutoff = getUTCTodayAtTime(limitParts[0], limitParts[1]);
				if (/* @__PURE__ */ new Date() >= cutoff) {
					if (!newUserdata.refills.nerve) {
						const now = /* @__PURE__ */ new Date();
						const key = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
						if (!(key in notifications.refillNerve)) {
							const notification = newNotification("Refill", `You have yet to use your nerve refill today.`, LINKS.points);
							await dispatchNotification(notification);
							await ttStorage.change({ notifications: { refillNerve: { [key]: notification } } });
						}
					}
				}
			} else await ttStorage.update("notifications", (notifications) => notifications.refillNerve = {});
		}
	}
	function validateUserdataResponse(fetchedUserdata, _request) {
		if (!fetchedUserdata?.profile?.id) throw new Error("Aborted updating due to an unexpected response.");
		if (api.torn.owner && api.torn.owner !== fetchedUserdata.profile.id) throw new Error(`Aborted updating since it seems you received the data from ${fetchedUserdata.profile.id} instead of ${api.torn.owner}.`);
	}
	//#endregion
	//#region src/extension/entrypoints/background/updates/index.ts
	var lockTimedUpdates = false;
	async function timedUpdates() {
		if (lockTimedUpdates) return;
		lockTimedUpdates = true;
		const updatePromises = [];
		try {
			await initializeDatabase();
			if (api.torn.key) {
				updatePromises.push(updateUserdata().then(({ updated, types, selections }) => {
					if (updated) console.log(`Updated ${types.join("+")} userdata.`, selections);
					else console.log("Skipped this userdata update.");
				}).catch((error) => logError("updating userdata", error)));
				updatePromises.push(updateStakeouts().then(({ updated, success, failed }) => {
					if (updated) if (success || failed) console.log("Updated stakeouts.", {
						success,
						failed
					});
					else console.log("No stakeouts to update.");
					else console.log("Skipped this stakeout update.");
				}).catch((error) => logError("updating stakeouts", error)));
				updatePromises.push(updateFactionStakeouts().then(({ updated, success, failed }) => {
					if (updated) if (success || failed) console.log("Updated faction stakeouts.", {
						success,
						failed
					});
					else console.log("No faction stakeouts to update.");
					else console.log("Skipped this faction stakeout update.");
				}).catch((error) => logError("updating faction stakeouts", error)));
				if (!torndata || !isSameUTCDay(new Date(torndata.date), /* @__PURE__ */ new Date()) || hasOutdatedTornStats() && hasTimePassed(torndata.date, TO_MILLIS.MINUTES * 10)) updatePromises.push(updateTorndata().then(() => console.log("Updated torndata.")).catch((error) => logError("updating torndata", error)));
				if (!stockdata?.date || hasTimePassed(stockdata.date, TO_MILLIS.MINUTES * 5)) updatePromises.push(updateStocks().then(() => console.log("Updated stocks.")).catch((error) => logError("updating stocks", error)));
				if (!factiondata || !("date" in factiondata) || hasTimePassed(factiondata.date, TO_MILLIS.MINUTES * 15)) updatePromises.push(updateFactiondata().then(() => console.log("Updated factiondata.")).catch((error) => logError("updating factiondata", error)));
			}
			updatePromises.push(updateNPCs().then(({ updated, alerts }) => {
				if (updated) console.log("Updated npcs.");
				if (alerts) console.log(`Sent out ${alerts} npc alerts.`);
			}).catch((error) => logError("updating npcs", error)));
			updatePromises.push(verifyTime().catch((error) => logError("Failed to verify your time to be synced.", error)));
			await Promise.all(updatePromises);
		} finally {
			lockTimedUpdates = false;
		}
		function logError(message, error) {
			if (error.code === CUSTOM_API_ERROR.NO_PERMISSION) console.warn(`You disabled our permission to call the API!`);
			else if (error.code === CUSTOM_API_ERROR.NO_NETWORK) console.warn(`Error due to no internet while ${message}.`);
			else if (error.code === CUSTOM_API_ERROR.CANCELLED) console.warn(`Error due to requests taking too long while ${message}.`);
			else if (isTornApiError(error)) if (error.code === 9) console.log(`Torn's API is temporary disabled while ${message}.`);
			else if (error.code === 17) console.log(`Torn's API is having backend issues while ${message}.`);
			else console.error(`Error while ${message}.`, error);
			else console.error(`Error while ${message}.`, error);
		}
	}
	async function verifyTime() {
		const savedTime = await ttStorage.get("time");
		const now = Date.now();
		if (savedTime != null && savedTime > Date.now()) {
			console.warn("Detected a desynchronized time! Resetting timed data.");
			await ttCache.clear();
			await Promise.all([
				updateUserdata(true),
				updateFactiondata(),
				updateTorndata(),
				updateStocks(),
				updateStakeouts(true),
				updateFactionStakeouts(true)
			]);
		}
		await ttStorage.set({ time: now });
	}
	function hasOutdatedTornStats() {
		const alteredStatsTimestamp = torndata.stats.timestamp * 1e3 + TO_MILLIS.DAYS;
		return !isSameUTCDay(alteredStatsTimestamp, torndata.date) && torndata.date > alteredStatsTimestamp;
	}
	//#endregion
	//#region src/common/utils/functions/events.ts
	var EVENT_CHANNELS = /* @__PURE__ */ function(EVENT_CHANNELS) {
		EVENT_CHANNELS["CHAT_MESSAGE"] = "chat-message";
		EVENT_CHANNELS["CHAT_NEW"] = "chat-box-new";
		EVENT_CHANNELS["CHAT_OPENED"] = "chat-box-opened";
		EVENT_CHANNELS["CHAT_PEOPLE_MENU_OPENED"] = "chat-people-menu-opened";
		EVENT_CHANNELS["CHAT_SETTINGS_MENU_OPENED"] = "chat-settings-menu-opened";
		EVENT_CHANNELS["CHAT_REFRESHED"] = "chat-refreshed";
		EVENT_CHANNELS["CHAT_RECONNECTED"] = "chat-reconnected";
		EVENT_CHANNELS["CHAT_CLOSED"] = "chat-closed";
		EVENT_CHANNELS["COMPANY_EMPLOYEES_PAGE"] = "company-employees-page";
		EVENT_CHANNELS["COMPANY_STOCK_PAGE"] = "company-stock-page";
		EVENT_CHANNELS["FACTION_ARMORY_TAB"] = "faction-armory-tab";
		EVENT_CHANNELS["FACTION_CRIMES"] = "faction-crimes";
		EVENT_CHANNELS["FACTION_CRIMES2"] = "faction-crimes2";
		EVENT_CHANNELS["FACTION_CRIMES2_TAB"] = "faction-crimes2-tab";
		EVENT_CHANNELS["FACTION_CRIMES2_REFRESH"] = "faction-crimes2-refresh";
		EVENT_CHANNELS["FACTION_GIVE_TO_USER"] = "faction-give-to-user";
		EVENT_CHANNELS["FACTION_UPGRADE_INFO"] = "faction-upgrade-info";
		EVENT_CHANNELS["FACTION_INFO"] = "faction-info";
		EVENT_CHANNELS["FACTION_MAIN"] = "faction-main";
		EVENT_CHANNELS["FACTION_NATIVE_FILTER"] = "faction-filter_native";
		EVENT_CHANNELS["FACTION_NATIVE_SORT"] = "faction-sort_native";
		EVENT_CHANNELS["FACTION_NATIVE_ICON_UPDATE"] = "faction-icon_update_native";
		EVENT_CHANNELS["FF_SCOUTER_GAUGE"] = "ff-scouter-gauge";
		EVENT_CHANNELS["ITEM_AMOUNT"] = "item-amount";
		EVENT_CHANNELS["ITEM_EQUIPPED"] = "item-equipped";
		EVENT_CHANNELS["ITEM_ITEMS_LOADED"] = "item-items-loaded";
		EVENT_CHANNELS["ITEM_SWITCH_TAB"] = "item-switch-tab";
		EVENT_CHANNELS["HOSPITAL_SWITCH_PAGE"] = "hospital-switch-page";
		EVENT_CHANNELS["JAIL_SWITCH_PAGE"] = "jail-switch-page";
		EVENT_CHANNELS["USERLIST_SWITCH_PAGE"] = "userlist-switch-page";
		EVENT_CHANNELS["TRAVEL_SELECT_TYPE"] = "travel-select-type";
		EVENT_CHANNELS["TRAVEL_SELECT_COUNTRY"] = "travel-select-country";
		EVENT_CHANNELS["TRAVEL_DESTINATION_UPDATE"] = "travel-destination-update";
		EVENT_CHANNELS["TRAVEL_ABROAD__SHOP_LOAD"] = "TRAVEL_ABROAD__SHOP_LOAD";
		EVENT_CHANNELS["TRAVEL_ABROAD__SHOP_REFRESH"] = "TRAVEL_ABROAD__SHOP_REFRESH";
		EVENT_CHANNELS["FEATURE_ENABLED"] = "feature-enabled";
		EVENT_CHANNELS["FEATURE_DISABLED"] = "feature-disabled";
		EVENT_CHANNELS["STATE_CHANGED"] = "state-changed";
		EVENT_CHANNELS["SHOP__LOAD"] = "SHOP__LOAD";
		EVENT_CHANNELS["GYM_LOAD"] = "gym-load";
		EVENT_CHANNELS["GYM_TRAIN"] = "gym-train";
		EVENT_CHANNELS["CRIMES_LOADED"] = "crimes-loaded";
		EVENT_CHANNELS["CRIMES_CRIME"] = "crimes-crime";
		EVENT_CHANNELS["CRIMES2_HOME_LOADED"] = "crimes2-home-loaded";
		EVENT_CHANNELS["CRIMES2_BURGLARY_LOADED"] = "crimes2-burglary-loaded";
		EVENT_CHANNELS["CRIMES2_CRIME_LOADED"] = "crimes2-crime-loaded";
		EVENT_CHANNELS["MISSION_LOAD"] = "mission-load";
		EVENT_CHANNELS["MISSION_REWARDS"] = "mission-rewards";
		EVENT_CHANNELS["TRADE"] = "trade";
		EVENT_CHANNELS["PROFILE_FETCHED"] = "profile-fetched";
		EVENT_CHANNELS["FILTER_APPLIED"] = "filter-applied";
		EVENT_CHANNELS["STATS_ESTIMATED"] = "stats-estimated";
		EVENT_CHANNELS["SWITCH_PAGE"] = "switch-page";
		EVENT_CHANNELS["AUCTION_SWITCH_TYPE"] = "auction-switch-type";
		EVENT_CHANNELS["ITEMMARKET_CATEGORY_ITEMS"] = "itemmarket-category-items";
		EVENT_CHANNELS["ITEMMARKET_CATEGORY_ITEMS_UPDATE"] = "itemmarket-category-items-update";
		EVENT_CHANNELS["ITEMMARKET_ITEMS"] = "itemmarket-items";
		EVENT_CHANNELS["ITEMMARKET_ITEMS_UPDATE"] = "itemmarket-items-update";
		EVENT_CHANNELS["ITEMMARKET_ITEM_DETAILS"] = "itemmarket-item-details";
		EVENT_CHANNELS["WINDOW__FOCUS"] = "WINDOW__FOCUS";
		EVENT_CHANNELS["PROPERTIES__ROUTE"] = "PROPERTIES__ROUTE";
		EVENT_CHANNELS["PROPERTIES__ROUTE_PAGE"] = "PROPERTIES__ROUTE_PAGE";
		return EVENT_CHANNELS;
	}({});
	var ANTI_SCRAPE_EVENTS = [
		"TRAVEL_ABROAD__SHOP_LOAD",
		"chat-message",
		"chat-box-opened",
		"chat-closed",
		"chat-refreshed",
		"chat-reconnected",
		"itemmarket-category-items",
		"itemmarket-category-items-update",
		"itemmarket-items",
		"itemmarket-items-update"
	];
	function triggerCustomListener(channel, payload) {
		if (ANTI_SCRAPE_EVENTS.includes(channel) && !isTabFocused()) return;
		EVENT_HANDLER.triggerEvent(channel, payload);
	}
	//#endregion
	//#region src/extension/runtime/extension-event-handler.ts
	var CUSTOM_LISTENERS = (() => {
		const listeners = {};
		for (const channel of Object.values(EVENT_CHANNELS)) listeners[channel] = [];
		return listeners;
	})();
	var ExtensionEventHandler = {
		triggerEvent(channel, payload) {
			for (const listener of CUSTOM_LISTENERS[channel]) listener(payload);
		},
		registerListener(channel, listener) {
			CUSTOM_LISTENERS[channel].push(listener);
		}
	};
	//#endregion
	//#region node_modules/@aklinker1/zero-serialize-error/dist/index.mjs
	var e = `string`;
	var t = `object`;
	function n(n) {
		return n != null && typeof n === t && typeof n.name === e && typeof n.message === e && typeof n.stack === e;
	}
	function r(e) {
		if (typeof e !== t || e == null) return e;
		if (e instanceof Error) return {
			name: e.name,
			message: e.message,
			stack: e.stack ?? ``,
			...e.cause ? { cause: r(e.cause) } : {},
			...r({ ...e })
		};
		if (Array.isArray(e)) {
			let t = [];
			for (let n of e) t.push(r(n));
			return t;
		}
		let n = Object.create(null);
		for (let [t, i] of Object.entries(e)) n[t] = r(i);
		return n;
	}
	function i(e) {
		if (n(e)) {
			let t = Error(e.message, e.cause ? { cause: i(e.cause) } : void 0);
			t.name = e.name, t.stack = e.stack;
			for (let [n, r] of Object.entries(e)) n !== `name` && n !== `message` && n !== `stack` && n !== `cause` && (t[n] = r);
			return t;
		}
		if (e == null || typeof e !== t) return e;
		if (Array.isArray(e)) {
			let t = [];
			for (let n of e) t.push(i(n));
			return t;
		}
		let r = Object.create(null);
		for (let [t, n] of Object.entries(e)) r[t] = i(n);
		return r;
	}
	//#endregion
	//#region node_modules/@webext-core/messaging/dist/generic-67DrFc4U.mjs
	function defineGenericMessanging(config) {
		let removeRootListener;
		let perTypeListeners = {};
		function cleanupRootListener() {
			if (Object.entries(perTypeListeners).length === 0) {
				removeRootListener?.();
				removeRootListener = void 0;
			}
		}
		let idSeq = Math.floor(Math.random() * 1e4);
		function getNextId() {
			return idSeq++;
		}
		return {
			async sendMessage(type, data, ...args) {
				const _message = {
					id: getNextId(),
					type,
					data,
					timestamp: Date.now()
				};
				const message = await config.verifyMessageData?.(_message) ?? _message;
				config.logger?.debug(`[messaging] sendMessage {id=${message.id}} ─ᐅ`, message, ...args);
				const { res, err } = await config.sendMessage(message, ...args) ?? { err: /* @__PURE__ */ new Error("No response") };
				config.logger?.debug(`[messaging] sendMessage {id=${message.id}} ᐊ─`, {
					res,
					err
				});
				if (err != null) throw i(err);
				return res;
			},
			onMessage(type, onReceived) {
				if (removeRootListener == null) {
					config.logger?.debug(`[messaging] "${type}" initialized the message listener for this context`);
					removeRootListener = config.addRootListener((message) => {
						if (typeof message.type != "string" || typeof message.timestamp !== "number") if (config.throwOnUnknownMessageFormat) {
							const err = Error(`[messaging] Unknown message format, must include the 'type' & 'timestamp' fields, received: ${JSON.stringify(message)}`);
							config.logger?.error(err);
							throw err;
						} else return;
						config?.logger?.debug("[messaging] Received message", message);
						const listener = perTypeListeners[message.type];
						if (listener == null) return;
						return (async () => {
							try {
								const raw = await listener(message);
								const res = config.verifyMessageData?.(raw) ?? raw;
								config?.logger?.debug(`[messaging] onMessage {id=${message.id}} ─ᐅ`, { res });
								return { res };
							} catch (err) {
								config?.logger?.debug(`[messaging] onMessage {id=${message.id}} ─ᐅ`, { err });
								return { err: r(err) };
							}
						})();
					});
				}
				if (perTypeListeners[type] != null) {
					const err = Error(`[messaging] In this JS context, only one listener can be setup for ${type}`);
					config.logger?.error(err);
					throw err;
				}
				perTypeListeners[type] = onReceived;
				config.logger?.log(`[messaging] Added listener for ${type}`);
				return () => {
					delete perTypeListeners[type];
					cleanupRootListener();
				};
			},
			removeAllListeners() {
				Object.keys(perTypeListeners).forEach((type) => {
					delete perTypeListeners[type];
				});
				cleanupRootListener();
			}
		};
	}
	//#endregion
	//#region node_modules/@webext-core/messaging/dist/index.mjs
	/**
	* Returns an `ExtensionMessenger` that is backed by the `browser.runtime.sendMessage` and
	* `browser.tabs.sendMessage` APIs.
	*
	* It can be used to send messages to and from the background page/service worker.
	*/
	function defineExtensionMessaging(config) {
		return defineGenericMessanging({
			...config,
			sendMessage(message, arg) {
				if (arg == null) return new Promise((resolve, reject) => chrome.runtime.sendMessage(message, (response) => {
					if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
					else resolve(response);
				}));
				const options = typeof arg === "number" ? { tabId: arg } : arg;
				return new Promise((res) => chrome.tabs.sendMessage(options.tabId, message, options.frameId != null ? { frameId: options.frameId } : void 0, res));
			},
			addRootListener(processMessage) {
				const listener = (message, sender, sendResponse) => {
					const res = processMessage(typeof message === "object" ? {
						...message,
						sender
					} : message);
					if (res instanceof Promise) {
						res.then(sendResponse);
						return true;
					}
					return false;
				};
				chrome.runtime.onMessage.addListener(listener);
				return () => chrome.runtime.onMessage.removeListener(listener);
			}
		});
	}
	//#endregion
	//#region node_modules/@webext-core/proxy-service/dist/index.mjs
	/**
	* Create a proxy service that uses the message APIs to proxy function calls to the real service
	* registered in the background with `registerService`.
	*
	* @param key The service key to listen for, must be the same string as the one used in
	*   `registerService`.
	*/
	function createProxyService(key, config) {
		return createProxy(defineProxyMessaging(key, config));
	}
	/**
	* Sets up message listeners that receive messages from proxies created with `createProxyService`.
	*
	* @param key The service key to listen for, must be the same string as the one used in
	*   `createProxyService`.
	* @param realService The real service instance that will handle the requests.
	*/
	function registerService(key, realService, config) {
		const messenger = defineProxyMessaging(key, config);
		return messenger.onMessage(messenger.messageKey, ({ data }) => {
			const method = data.path == null ? realService : get(realService ?? {}, data.path);
			const target = data.path == null ? realService : get(realService ?? {}, data.path.slice(0, -1));
			if (method) return Promise.resolve(method.bind(target)(...data.args));
		});
	}
	function defineProxyMessaging(key, config) {
		const messaging = defineExtensionMessaging(config);
		return {
			messageKey: `proxy-service.${key}`,
			...messaging
		};
	}
	/**
	* Create and returns a "deep" proxy. Every property that is accessed returns another proxy, and
	* when a function is called at any depth, a message is sent to the background.
	*/
	function createProxy(messenger, path) {
		const wrapped = (() => {});
		const proxy = new Proxy(wrapped, {
			async apply(_target, _thisArg, args) {
				return await messenger.sendMessage(messenger.messageKey, {
					path,
					args
				});
			},
			get(target, propertyName, receiver) {
				if (typeof propertyName === "symbol") return Reflect.get(target, propertyName, receiver);
				return createProxy(messenger, path == null ? [propertyName] : path.concat([propertyName]));
			}
		});
		proxy[ProxyServiceSymbol] = true;
		return proxy;
	}
	var ProxyServiceSymbol = Symbol();
	function get(obj, path) {
		if (path.length === 0) return obj;
		return path.reduce((acc, key) => acc?.[key], obj);
	}
	//#endregion
	//#region src/extension/services/proxy-service-keys.ts
	var SOURCE_SERVICE_KEY = "source-service";
	var BACKGROUND_SERVICE_KEY = "background-service";
	//#endregion
	//#region src/extension/services/proxy-services.ts
	var SOURCE_SERVICE = createProxyService(SOURCE_SERVICE_KEY);
	var BACKGROUND_SERVICE = createProxyService(BACKGROUND_SERVICE_KEY);
	//#endregion
	//#region src/common/features/feature.ts
	var ExecutionTiming = /* @__PURE__ */ function(ExecutionTiming) {
		ExecutionTiming["IMMEDIATELY"] = "IMMEDIATELY";
		ExecutionTiming["DOM_INTERACTIVE"] = "DOM_INTERACTIVE";
		ExecutionTiming["CONTENT_LOADED"] = "CONTENT_LOADED";
		return ExecutionTiming;
	}({});
	//#endregion
	//#region src/extension/runtime/extension-feature-manager.ts
	var ExtensionFeatureManager = class {
		logPadding;
		containerID;
		container;
		features;
		initialized;
		popupLoaded;
		resultQueue;
		errorCount;
		earlyErrors;
		loadedFeatures;
		constructor() {
			this.logPadding = "[TornTools] FeatureManager - ";
			this.containerID = "tt-page-status";
			this.container = null;
			this.features = [];
			this.initialized = [];
			this.popupLoaded = false;
			this.resultQueue = [];
			this.errorCount = 0;
			this.earlyErrors = [];
			this.loadedFeatures = [];
			window.addEventListener("error", (e) => {
				if (e.error) this.logError("Uncaught window error:", e.error);
				else {
					if (e.message === "ResizeObserver loop completed with undelivered notifications." && (e.filename.includes("torn.com/") || e.filename === "")) return;
					this.logError("Uncaught window error:", e);
				}
			});
			window.addEventListener("unhandledrejection", (e) => {
				this.logError("Uncaught promise rejection:", e.reason);
			});
			loadDatabase().then(() => {
				if (settings.developer) return;
				console.log("%cTorn%cTools %cis running.", "font-size: 30px; font-weight: 600; color: green;", "font-size: 30px; font-weight: 600; color: #000;", "font-size: 30px;");
			});
		}
		logInfo(...params) {
			if (!settings) {
				loadDatabase().then(() => this.logInfo(...params));
				return;
			}
			if (!settings.developer) return;
			params[0] = this.logPadding + params[0];
			console.log(...params);
		}
		logError(info, error) {
			if (error?.message === "Extension context invalidated.") return;
			if (error?.message === "Maximum cycles reached." && !settings.developer) return;
			this.errorCount = this.errorCount + 1;
			if (this.errorCount === 1) requireCondition(() => this.container).then((container) => requireElement(".error-messages", { parent: container })).then((messages) => messages.classList.add("show"));
			this.generateErrorMessage(info, error).then((message) => console.error(...message)).catch(() => {});
			if (!this.container) this.earlyErrors.push(error);
			else if (this.errorCount > 25) this.container.setAttribute("error-count", "25+");
			else {
				this.container.setAttribute("error-count", this.errorCount.toString());
				this.addErrorToPopup(error).catch((err) => console.error(err));
			}
		}
		async generateErrorMessage(info, error) {
			if (Array.isArray(info)) info[0] = this.logPadding + info[0];
			else info = [this.logPadding + info];
			if (error) if (typeof error === "object") {
				if (error instanceof Error) info.push(await SOURCE_SERVICE.mappedStack(error.stack));
				else if (error instanceof ErrorEvent) {
					const location = await SOURCE_SERVICE.fromSource(error.lineno, error.colno);
					const formattedLocation = location ? `${location.file}:${location.line}` : `${error.filename}:${error.lineno}`;
					info.push(`${error.message} @ ${formattedLocation}`);
				}
			} else info.push(error);
			return info;
		}
		async addErrorToPopup(error) {
			if (!this.container) return;
			this.container.setAttribute("error-count", this.errorCount.toString());
			let errorElement;
			if (error != null && typeof error === "object") {
				if (error instanceof Error) errorElement = elementBuilder({
					type: "div",
					class: "error",
					children: [elementBuilder({
						type: "div",
						class: "name",
						text: `${error.name}: ${error.message}`
					}), elementBuilder({
						type: "pre",
						class: "stack",
						text: await SOURCE_SERVICE.mappedStack(error.stack)
					})]
				});
				else if (error instanceof ErrorEvent) {
					const location = await SOURCE_SERVICE.fromSource(error.lineno, error.colno);
					const formattedLocation = location ? `${location.file}:${location.line}` : `${error.filename}:${error.lineno}`;
					errorElement = elementBuilder({
						type: "div",
						class: "error",
						children: [elementBuilder({
							type: "div",
							class: "name",
							text: error.message
						}), elementBuilder({
							type: "pre",
							class: "stack",
							text: formattedLocation
						})]
					});
				}
			} else errorElement = elementBuilder({
				type: "pre",
				class: "error",
				children: [elementBuilder({
					type: "div",
					class: "name",
					text: `Unknown error message: ${error}`
				})]
			});
			this.container.querySelector(".error-messages").appendChild(errorElement);
		}
		clearEarlyErrors() {
			this.earlyErrors.forEach((error) => this.addErrorToPopup(error));
			this.earlyErrors = [];
		}
		registerFeature(feature) {
			this.fullyRegisterFeature(feature).catch((error) => {
				this.logError(`Failed to register "${feature.name}".`, error);
				this.showResult(feature, "failed");
			});
		}
		async fullyRegisterFeature(feature) {
			if (this.findFeature(feature.name)) throw "Feature already registered.";
			if (feature.executionTiming === ExecutionTiming.DOM_INTERACTIVE) await requireDOMInteractive();
			else if (feature.executionTiming === ExecutionTiming.CONTENT_LOADED) await requireDOMContentLoaded();
			if (!await feature.precondition()) return;
			this.logInfo("Registered new feature.", feature);
			this.features.push(feature);
			this.showResult(feature, "registered", { message: "Loaded. Starting feature." });
			this.startFeature(feature).catch((error) => this.logError(`Failed to start "${feature.name}".`, error));
			this.startLoadListeners(feature);
		}
		findFeature(name) {
			return this.features.find((feature) => feature.name === name) ?? null;
		}
		async startFeature(feature, liveReload) {
			await Promise.all([loadDatabase(), feature.requiresScreenInformation() ? checkDevice() : Promise.resolve()]);
			try {
				if (feature.isEnabled()) {
					this.logInfo("Starting feature.", feature);
					const requirements = await feature.requirements();
					if (typeof requirements === "string") {
						await this.executeFunction(feature.cleanup).catch((error) => this.logError(`Failed to (string requirements)cleanup "${feature.name}".`, error));
						this.showResult(feature, "information", { message: requirements });
						return;
					}
					if (!this.initialized.includes(feature.name)) {
						await this.executeFunction(feature.initialise);
						this.initialized.push(feature.name);
					}
					if (liveReload && feature.shouldLiveReload()) await this.executeFunction(feature.execute, liveReload);
					else await this.executeFunction(feature.execute);
					this.showResult(feature, "loaded");
					if (feature.shouldTriggerEvents()) triggerCustomListener(EVENT_CHANNELS.FEATURE_ENABLED, { name: feature.name });
				} else {
					if (this.loadedFeatures.includes(feature.name)) {
						this.logInfo("Disabling feature.", feature);
						await this.executeFunction(feature.cleanup);
						if (feature.shouldTriggerEvents()) triggerCustomListener(EVENT_CHANNELS.FEATURE_DISABLED, { name: feature.name });
					}
					this.showResult(feature, "disabled");
				}
			} catch (error) {
				await this.executeFunction(feature.cleanup).catch((error) => this.logError(`Failed to cleanup in a failed start of "${feature.name}".`, error));
				this.showResult(feature, "failed");
				this.logError(`Failed to start "${feature.name}".`, error);
			}
			this.loadedFeatures.push(feature.name);
		}
		startLoadListeners(feature) {
			const keys = feature.storageKeys();
			if (keys.length === 0) return;
			const storageKeys = keys.reduce((previousValue, currentValue) => {
				const path = currentValue.split(".");
				const area = path[0];
				if (!previousValue[area]) previousValue[area] = [];
				previousValue[area].push(path.slice(1));
				return previousValue;
			}, {});
			for (const [key, getter] of [
				["settings", () => settings],
				["userdata", () => userdata],
				["version", () => version],
				["factiondata", () => factiondata],
				["localdata", () => localdata],
				["npcs", () => npcs]
			]) {
				if (!(key in storageKeys)) continue;
				storageListeners[key].push((oldSettings) => {
					if (!storageKeys[key].some((path) => {
						const newValue = rec(getter(), path);
						const oldValue = rec(oldSettings, path);
						if (Array.isArray(newValue) && Array.isArray(oldValue)) return !arraysEquals(newValue, oldValue);
						else if (newValue instanceof Object && oldValue instanceof Object) return !objectsEquals(newValue, oldValue);
						return newValue !== oldValue;
					})) return;
					this.startFeature(feature, true).catch((error) => this.logError(`Failed to start "${feature.name}" during live reload.`, error));
				});
			}
			function rec(parent, path) {
				if (!parent) return void 0;
				if (path.length > 1) return rec(parent[path[0]], path.slice(1));
				return parent[path[0]];
			}
		}
		async executeFunction(func, liveReload) {
			if (!func) return;
			await (liveReload ? func(liveReload) : func());
		}
		showResult(feature, status, options = {}) {
			if (!this.popupLoaded) {
				this.resultQueue.push([
					feature,
					status,
					options
				]);
				return;
			}
			(async () => {
				let row = this.container.querySelector(`[feature-name="${feature.name}"]`);
				if (row) {
					row.setAttribute("status", status);
					const statusIcon = row.querySelector("svg");
					const newIcon = getIconElement(status);
					statusIcon.replaceWith(newIcon);
					if (options.message) row.setAttribute("title", options.message);
					else row.removeAttribute("title");
				} else {
					row = elementBuilder({
						type: "div",
						class: "tt-feature",
						attributes: {
							"feature-name": feature.name,
							status
						},
						children: [getIconElement(status), elementBuilder({
							type: "span",
							text: feature.name
						})]
					});
					let scopeEl = this.container.querySelector(`[scope*="${feature.scope}"]`);
					if (!scopeEl) {
						scopeEl = elementBuilder({
							type: "div",
							attributes: { scope: feature.scope },
							children: [elementBuilder({
								type: "div",
								text: `— ${feature.scope} —`
							})]
						});
						this.container.querySelector(".tt-features-list").appendChild(scopeEl);
					}
					scopeEl.appendChild(row);
				}
				this.hideEmptyScopes();
			})().catch((error) => {
				this.logError(`Couldn't log result for ${feature.name}: ${JSON.stringify(options)}`, error);
			});
			function getIconElement(status) {
				switch (status) {
					case "disabled":
					case "failed": return PHXCircle();
					case "loaded": return PHBoldCheck();
					case "registered": return PHBoldSpinnerGap();
					default: return PHQuestion();
				}
			}
		}
		display() {
			if (!this.container) return;
			this.container.className = [
				settings.featureDisplay ? "" : "tt-hidden",
				settings.featureDisplayOnlyFailed ? "only-fails" : "",
				settings.featureDisplayHideDisabled ? "hide-disabled" : "",
				settings.featureDisplayHideEmpty ? "hide-empty" : ""
			].filter((c) => !!c).join(" ");
			this.hideEmptyScopes();
			this.clearEarlyErrors();
		}
		async createPopup() {
			await loadDatabase();
			const popup = elementBuilder({
				type: "div",
				id: this.containerID,
				attributes: {
					tabindex: "0",
					"error-count": "0"
				},
				children: [elementBuilder({
					type: "div",
					children: [elementBuilder({
						type: "button",
						style: { backgroundImage: `url(${browser.runtime.getURL("/images/icon_128.png")})` },
						events: { click: (e) => {
							const target = e.target;
							const title = target.matches(`#${this.containerID}`) ? target : target.closest(`#${this.containerID}`);
							title.querySelector("button").style.backgroundImage = title.classList.toggle("open") ? `url(${browser.runtime.getURL("/images/svg-icons/cross.svg")})` : `url(${browser.runtime.getURL("/images/icon_128.png")})`;
						} }
					})]
				}), elementBuilder({
					type: "div",
					class: "tt-features-list",
					children: [elementBuilder({
						type: "div",
						class: "error-messages",
						children: [elementBuilder({
							type: "div",
							class: "heading",
							text: "Errors",
							attributes: { title: "Click to copy all errors" },
							children: [PHBoldCopy()],
							events: { click: () => {
								toClipboard(`TornTools ${document.querySelector("#tt-page-status .error-messages").innerText}`);
							} }
						})]
					})]
				})]
			});
			if (!document.body) return;
			try {
				document.body.appendChild(popup);
			} catch {
				return;
			}
			this.container = popup;
			this.popupLoaded = true;
			this.display();
			for (const item of this.resultQueue) {
				const [feature, status, options] = item;
				this.showResult(feature, status, options);
			}
		}
		hideEmptyScopes() {
			if (!settings.featureDisplay) return;
			findAllElements(".tt-features-list > div[scope]", this.container).forEach((scopeDiv) => {
				let hideScope = false;
				if (settings.featureDisplayOnlyFailed && findAllElements(":scope > .tt-feature[status*='failed']", scopeDiv).length === 0) hideScope = true;
				if (settings.featureDisplayHideDisabled && findAllElements(":scope > .tt-feature:not([status*='disabled'])", scopeDiv).length === 0) hideScope = true;
				scopeDiv.classList[hideScope ? "add" : "remove"]("no-content");
			});
			if (!this.container.querySelector(".tt-features-list > div[scope]:not(.no-content)")) this.container.classList.add("no-content");
			else this.container.classList.remove("no-content");
		}
		isEnabled(featureConstructor) {
			const feature = this.features.find((f) => f instanceof featureConstructor);
			if (!feature) return false;
			return feature.isEnabled();
		}
	};
	//#endregion
	//#region src/common/utils/data/storage.ts
	var TornToolsStorage = class {
		async update(key, fn) {
			const database = await this.get(key);
			fn(database);
			await this.set({ [key]: database });
		}
		async change(object) {
			const keys = Object.keys(object);
			for (const key of keys) {
				const data = this.recursive(await this.get(key), object[key]);
				await this.set({ [key]: data });
			}
		}
		recursive(parent, toChange) {
			for (const key in toChange) if (parent && typeof parent === "object" && !Array.isArray(parent[key]) && key in parent && typeof toChange[key] === "object" && !Array.isArray(toChange[key]) && toChange[key] !== null) parent[key] = this.recursive(parent[key], toChange[key]);
			else if (parent && typeof parent === "object") {
				const value = toChange[key];
				parent[key] = Array.isArray(value) ? Array.from(value) : value;
			} else parent = { [key]: toChange[key] };
			return parent;
		}
	};
	//#endregion
	//#region src/extension/runtime/extension-storage.ts
	var TTExtensionStorage = class extends TornToolsStorage {
		async get(key) {
			if (Array.isArray(key)) {
				const data = await browser.storage.local.get(key);
				return key.map((i) => data[i]);
			} else if (key) return (await browser.storage.local.get([key]))[key];
			else return browser.storage.local.get();
		}
		set(object) {
			return browser.storage.local.set(object);
		}
		remove(key) {
			return browser.storage.local.remove(Array.isArray(key) ? key : [key]);
		}
		clear() {
			return browser.storage.local.clear();
		}
		async reset(key) {
			if ([
				"attackHistory",
				"stakeouts",
				"factionStakeouts"
			].includes(key)) await this.set({ [key]: getDefaultStorage(DEFAULT_STORAGE)[key] });
			else {
				const apiKey = api ? api.torn.key : void 0;
				await this.clear();
				await this.set(getDefaultStorage(DEFAULT_STORAGE));
				await this.change({ api: { torn: { key: apiKey } } });
				console.log("Storage cleared");
				console.log("New storage", await this.get());
			}
		}
		async getSize() {
			let size;
			if (browser.storage.local.getBytesInUse) size = await browser.storage.local.getBytesInUse();
			else size = JSON.stringify(await this.get(null)).length;
			return size;
		}
	};
	//#endregion
	//#region src/extension/runtime/extension-context.ts
	var BLACKLISTED_SCRIPT_TYPES = [
		"BACKGROUND",
		"POPUP",
		"INTERNAL_CONTENT"
	];
	function registerExtensionContext() {
		setTTStorage(new TTExtensionStorage());
		if (typeof window !== "undefined" && !BLACKLISTED_SCRIPT_TYPES.includes(SCRIPT_TYPE)) new ExtensionFeatureManager();
		setEventHandler(ExtensionEventHandler);
		setRuntimeInformation(ExtensionRuntimeInformation);
		setRuntimeStorage(ExtensionRuntimeStorage);
		setOffloadService(ExtensionOffloadService);
		setDataFetcher(ExtensionDataFetcher);
	}
	var ExtensionRuntimeInformation = {
		getWindow() {
			return usingFirefox() ? window.wrappedJSObject : window;
		},
		getVersion() {
			return browser.runtime.getManifest().version;
		},
		isUserscript() {
			return false;
		}
	};
	var ExtensionRuntimeStorage = { addChangeListener: (cb) => browser.storage.onChanged.addListener(cb) };
	var ExtensionOffloadService = {
		fetchRelay(location, options) {
			return BACKGROUND_SERVICE.fetchRelay(location, options);
		},
		initialize() {
			return BACKGROUND_SERVICE.initialize();
		},
		async reinitializeTimers() {
			await BACKGROUND_SERVICE.reinitializeTimers();
		}
	};
	var ExtensionDataFetcher = { async fetch(url, options) {
		const controller = new AbortController();
		const timeoutId = options?.timeout ? setTimeout(() => controller.abort(), options.timeout) : void 0;
		try {
			const response = await fetch(url, {
				method: options?.method || "GET",
				...options?.method === "POST" ? { body: options.body } : {},
				headers: options?.headers,
				signal: controller.signal
			});
			return {
				text: await response.text(),
				status: response.status,
				ok: response.ok
			};
		} finally {
			if (timeoutId) clearTimeout(timeoutId);
		}
	} };
	//#endregion
	//#region node_modules/source-map/lib/base64.js
	var require_base64 = /* @__PURE__ */ __commonJSMin(((exports) => {
		var intToCharMap = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");
		/**
		* Encode an integer in the range of 0 to 63 to a single base 64 digit.
		*/
		exports.encode = function(number) {
			if (0 <= number && number < intToCharMap.length) return intToCharMap[number];
			throw new TypeError("Must be between 0 and 63: " + number);
		};
	}));
	//#endregion
	//#region node_modules/source-map/lib/base64-vlq.js
	var require_base64_vlq = /* @__PURE__ */ __commonJSMin(((exports) => {
		var base64 = require_base64();
		var VLQ_BASE_SHIFT = 5;
		var VLQ_BASE = 1 << VLQ_BASE_SHIFT;
		var VLQ_BASE_MASK = VLQ_BASE - 1;
		var VLQ_CONTINUATION_BIT = VLQ_BASE;
		/**
		* Converts from a two-complement value to a value where the sign bit is
		* placed in the least significant bit.  For example, as decimals:
		*   1 becomes 2 (10 binary), -1 becomes 3 (11 binary)
		*   2 becomes 4 (100 binary), -2 becomes 5 (101 binary)
		*/
		function toVLQSigned(aValue) {
			return aValue < 0 ? (-aValue << 1) + 1 : (aValue << 1) + 0;
		}
		/**
		* Returns the base 64 VLQ encoded value.
		*/
		exports.encode = function base64VLQ_encode(aValue) {
			let encoded = "";
			let digit;
			let vlq = toVLQSigned(aValue);
			do {
				digit = vlq & VLQ_BASE_MASK;
				vlq >>>= VLQ_BASE_SHIFT;
				if (vlq > 0) digit |= VLQ_CONTINUATION_BIT;
				encoded += base64.encode(digit);
			} while (vlq > 0);
			return encoded;
		};
	}));
	//#endregion
	//#region \0rolldown/data-url:0NMjSNUoL1OByn9ximJyFA
	var data_url_0NMjSNUoL1OByn9ximJyFA_exports = /* @__PURE__ */ __exportAll({ URL: () => URL$1 });
	var URL$1;
	var init_data_url_0NMjSNUoL1OByn9ximJyFA = __esmMin((() => {
		URL$1 = globalThis.URL;
	}));
	//#endregion
	//#region node_modules/source-map/lib/url.js
	var require_url = /* @__PURE__ */ __commonJSMin(((exports, module) => {
		module.exports = typeof URL === "function" ? URL : (init_data_url_0NMjSNUoL1OByn9ximJyFA(), __toCommonJS(data_url_0NMjSNUoL1OByn9ximJyFA_exports)).URL;
	}));
	//#endregion
	//#region node_modules/source-map/lib/util.js
	var require_util = /* @__PURE__ */ __commonJSMin(((exports) => {
		var URL = require_url();
		/**
		* This is a helper function for getting values from parameter/options
		* objects.
		*
		* @param args The object we are extracting values from
		* @param name The name of the property we are getting.
		* @param defaultValue An optional value to return if the property is missing
		* from the object. If this is not specified and the property is missing, an
		* error will be thrown.
		*/
		function getArg(aArgs, aName, aDefaultValue) {
			if (aName in aArgs) return aArgs[aName];
			else if (arguments.length === 3) return aDefaultValue;
			throw new Error("\"" + aName + "\" is a required argument.");
		}
		exports.getArg = getArg;
		var supportsNullProto = (function() {
			return !("__proto__" in Object.create(null));
		})();
		function identity(s) {
			return s;
		}
		/**
		* Because behavior goes wacky when you set `__proto__` on objects, we
		* have to prefix all the strings in our set with an arbitrary character.
		*
		* See https://github.com/mozilla/source-map/pull/31 and
		* https://github.com/mozilla/source-map/issues/30
		*
		* @param String aStr
		*/
		function toSetString(aStr) {
			if (isProtoString(aStr)) return "$" + aStr;
			return aStr;
		}
		exports.toSetString = supportsNullProto ? identity : toSetString;
		function fromSetString(aStr) {
			if (isProtoString(aStr)) return aStr.slice(1);
			return aStr;
		}
		exports.fromSetString = supportsNullProto ? identity : fromSetString;
		function isProtoString(s) {
			if (!s) return false;
			const length = s.length;
			if (length < 9) return false;
			if (s.charCodeAt(length - 1) !== 95 || s.charCodeAt(length - 2) !== 95 || s.charCodeAt(length - 3) !== 111 || s.charCodeAt(length - 4) !== 116 || s.charCodeAt(length - 5) !== 111 || s.charCodeAt(length - 6) !== 114 || s.charCodeAt(length - 7) !== 112 || s.charCodeAt(length - 8) !== 95 || s.charCodeAt(length - 9) !== 95) return false;
			for (let i = length - 10; i >= 0; i--) if (s.charCodeAt(i) !== 36) return false;
			return true;
		}
		function strcmp(aStr1, aStr2) {
			if (aStr1 === aStr2) return 0;
			if (aStr1 === null) return 1;
			if (aStr2 === null) return -1;
			if (aStr1 > aStr2) return 1;
			return -1;
		}
		/**
		* Comparator between two mappings with inflated source and name strings where
		* the generated positions are compared.
		*/
		function compareByGeneratedPositionsInflated(mappingA, mappingB) {
			let cmp = mappingA.generatedLine - mappingB.generatedLine;
			if (cmp !== 0) return cmp;
			cmp = mappingA.generatedColumn - mappingB.generatedColumn;
			if (cmp !== 0) return cmp;
			cmp = strcmp(mappingA.source, mappingB.source);
			if (cmp !== 0) return cmp;
			cmp = mappingA.originalLine - mappingB.originalLine;
			if (cmp !== 0) return cmp;
			cmp = mappingA.originalColumn - mappingB.originalColumn;
			if (cmp !== 0) return cmp;
			return strcmp(mappingA.name, mappingB.name);
		}
		exports.compareByGeneratedPositionsInflated = compareByGeneratedPositionsInflated;
		/**
		* Strip any JSON XSSI avoidance prefix from the string (as documented
		* in the source maps specification), and then parse the string as
		* JSON.
		*/
		function parseSourceMapInput(str) {
			return JSON.parse(str.replace(/^\)]}'[^\n]*\n/, ""));
		}
		exports.parseSourceMapInput = parseSourceMapInput;
		var PROTOCOL_AND_HOST = `http://host`;
		/**
		* Make it easy to create small utilities that tweak a URL's path.
		*/
		function createSafeHandler(cb) {
			return (input) => {
				const type = getURLType(input);
				const base = buildSafeBase(input);
				const url = new URL(input, base);
				cb(url);
				const result = url.toString();
				if (type === "absolute") return result;
				else if (type === "scheme-relative") return result.slice(5);
				else if (type === "path-absolute") return result.slice(PROTOCOL_AND_HOST.length);
				return computeRelativeURL(base, result);
			};
		}
		function withBase(url, base) {
			return new URL(url, base).toString();
		}
		function buildUniqueSegment(prefix, str) {
			let id = 0;
			do {
				const ident = prefix + id++;
				if (str.indexOf(ident) === -1) return ident;
			} while (true);
		}
		function buildSafeBase(str) {
			const maxDotParts = str.split("..").length - 1;
			const segment = buildUniqueSegment("p", str);
			let base = `${PROTOCOL_AND_HOST}/`;
			for (let i = 0; i < maxDotParts; i++) base += `${segment}/`;
			return base;
		}
		var ABSOLUTE_SCHEME = /^[A-Za-z0-9\+\-\.]+:/;
		function getURLType(url) {
			if (url[0] === "/") {
				if (url[1] === "/") return "scheme-relative";
				return "path-absolute";
			}
			return ABSOLUTE_SCHEME.test(url) ? "absolute" : "path-relative";
		}
		/**
		* Given two URLs that are assumed to be on the same
		* protocol/host/user/password build a relative URL from the
		* path, params, and hash values.
		*
		* @param rootURL The root URL that the target will be relative to.
		* @param targetURL The target that the relative URL points to.
		* @return A rootURL-relative, normalized URL value.
		*/
		function computeRelativeURL(rootURL, targetURL) {
			if (typeof rootURL === "string") rootURL = new URL(rootURL);
			if (typeof targetURL === "string") targetURL = new URL(targetURL);
			const targetParts = targetURL.pathname.split("/");
			const rootParts = rootURL.pathname.split("/");
			if (rootParts.length > 0 && !rootParts[rootParts.length - 1]) rootParts.pop();
			while (targetParts.length > 0 && rootParts.length > 0 && targetParts[0] === rootParts[0]) {
				targetParts.shift();
				rootParts.shift();
			}
			return rootParts.map(() => "..").concat(targetParts).join("/") + targetURL.search + targetURL.hash;
		}
		/**
		* Given a URL, ensure that it is treated as a directory URL.
		*
		* @param url
		* @return A normalized URL value.
		*/
		var ensureDirectory = createSafeHandler((url) => {
			url.pathname = url.pathname.replace(/\/?$/, "/");
		});
		/**
		* Given a URL, strip off any filename if one is present.
		*
		* @param url
		* @return A normalized URL value.
		*/
		var trimFilename = createSafeHandler((url) => {
			url.href = new URL(".", url.toString()).toString();
		});
		/**
		* Normalize a given URL.
		* * Convert backslashes.
		* * Remove any ".." and "." segments.
		*
		* @param url
		* @return A normalized URL value.
		*/
		var normalize = createSafeHandler((url) => {});
		exports.normalize = normalize;
		/**
		* Joins two paths/URLs.
		*
		* All returned URLs will be normalized.
		*
		* @param aRoot The root path or URL. Assumed to reference a directory.
		* @param aPath The path or URL to be joined with the root.
		* @return A joined and normalized URL value.
		*/
		function join(aRoot, aPath) {
			const pathType = getURLType(aPath);
			const rootType = getURLType(aRoot);
			aRoot = ensureDirectory(aRoot);
			if (pathType === "absolute") return withBase(aPath, void 0);
			if (rootType === "absolute") return withBase(aPath, aRoot);
			if (pathType === "scheme-relative") return normalize(aPath);
			if (rootType === "scheme-relative") return withBase(aPath, withBase(aRoot, PROTOCOL_AND_HOST)).slice(5);
			if (pathType === "path-absolute") return normalize(aPath);
			if (rootType === "path-absolute") return withBase(aPath, withBase(aRoot, PROTOCOL_AND_HOST)).slice(PROTOCOL_AND_HOST.length);
			const base = buildSafeBase(aPath + aRoot);
			return computeRelativeURL(base, withBase(aPath, withBase(aRoot, base)));
		}
		exports.join = join;
		/**
		* Make a path relative to a URL or another path. If returning a
		* relative URL is not possible, the original target will be returned.
		* All returned URLs will be normalized.
		*
		* @param aRoot The root path or URL.
		* @param aPath The path or URL to be made relative to aRoot.
		* @return A rootURL-relative (if possible), normalized URL value.
		*/
		function relative(rootURL, targetURL) {
			const result = relativeIfPossible(rootURL, targetURL);
			return typeof result === "string" ? result : normalize(targetURL);
		}
		exports.relative = relative;
		function relativeIfPossible(rootURL, targetURL) {
			if (getURLType(rootURL) !== getURLType(targetURL)) return null;
			const base = buildSafeBase(rootURL + targetURL);
			const root = new URL(rootURL, base);
			const target = new URL(targetURL, base);
			try {
				new URL("", target.toString());
			} catch (err) {
				return null;
			}
			if (target.protocol !== root.protocol || target.user !== root.user || target.password !== root.password || target.hostname !== root.hostname || target.port !== root.port) return null;
			return computeRelativeURL(root, target);
		}
		/**
		* Compute the URL of a source given the the source root, the source's
		* URL, and the source map's URL.
		*/
		function computeSourceURL(sourceRoot, sourceURL, sourceMapURL) {
			if (sourceRoot && getURLType(sourceURL) === "path-absolute") sourceURL = sourceURL.replace(/^\//, "");
			let url = normalize(sourceURL || "");
			if (sourceRoot) url = join(sourceRoot, url);
			if (sourceMapURL) url = join(trimFilename(sourceMapURL), url);
			return url;
		}
		exports.computeSourceURL = computeSourceURL;
	}));
	//#endregion
	//#region node_modules/source-map/lib/array-set.js
	var require_array_set = /* @__PURE__ */ __commonJSMin(((exports) => {
		exports.ArraySet = class ArraySet {
			constructor() {
				this._array = [];
				this._set = /* @__PURE__ */ new Map();
			}
			/**
			* Static method for creating ArraySet instances from an existing array.
			*/
			static fromArray(aArray, aAllowDuplicates) {
				const set = new ArraySet();
				for (let i = 0, len = aArray.length; i < len; i++) set.add(aArray[i], aAllowDuplicates);
				return set;
			}
			/**
			* Return how many unique items are in this ArraySet. If duplicates have been
			* added, than those do not count towards the size.
			*
			* @returns Number
			*/
			size() {
				return this._set.size;
			}
			/**
			* Add the given string to this set.
			*
			* @param String aStr
			*/
			add(aStr, aAllowDuplicates) {
				const isDuplicate = this.has(aStr);
				const idx = this._array.length;
				if (!isDuplicate || aAllowDuplicates) this._array.push(aStr);
				if (!isDuplicate) this._set.set(aStr, idx);
			}
			/**
			* Is the given string a member of this set?
			*
			* @param String aStr
			*/
			has(aStr) {
				return this._set.has(aStr);
			}
			/**
			* What is the index of the given string in the array?
			*
			* @param String aStr
			*/
			indexOf(aStr) {
				const idx = this._set.get(aStr);
				if (idx >= 0) return idx;
				throw new Error("\"" + aStr + "\" is not in the set.");
			}
			/**
			* What is the element at the given index?
			*
			* @param Number aIdx
			*/
			at(aIdx) {
				if (aIdx >= 0 && aIdx < this._array.length) return this._array[aIdx];
				throw new Error("No element indexed by " + aIdx);
			}
			/**
			* Returns the array representation of this set (which has the proper indices
			* indicated by indexOf). Note that this is a copy of the internal array used
			* for storing the members so that no one can mess with internal state.
			*/
			toArray() {
				return this._array.slice();
			}
		};
	}));
	//#endregion
	//#region node_modules/source-map/lib/mapping-list.js
	var require_mapping_list = /* @__PURE__ */ __commonJSMin(((exports) => {
		var util = require_util();
		/**
		* Determine whether mappingB is after mappingA with respect to generated
		* position.
		*/
		function generatedPositionAfter(mappingA, mappingB) {
			const lineA = mappingA.generatedLine;
			const lineB = mappingB.generatedLine;
			const columnA = mappingA.generatedColumn;
			const columnB = mappingB.generatedColumn;
			return lineB > lineA || lineB == lineA && columnB >= columnA || util.compareByGeneratedPositionsInflated(mappingA, mappingB) <= 0;
		}
		/**
		* A data structure to provide a sorted view of accumulated mappings in a
		* performance conscious manner. It trades a negligible overhead in general
		* case for a large speedup in case of mappings being added in order.
		*/
		var MappingList = class {
			constructor() {
				this._array = [];
				this._sorted = true;
				this._last = {
					generatedLine: -1,
					generatedColumn: 0
				};
			}
			/**
			* Iterate through internal items. This method takes the same arguments that
			* `Array.prototype.forEach` takes.
			*
			* NOTE: The order of the mappings is NOT guaranteed.
			*/
			unsortedForEach(aCallback, aThisArg) {
				this._array.forEach(aCallback, aThisArg);
			}
			/**
			* Add the given source mapping.
			*
			* @param Object aMapping
			*/
			add(aMapping) {
				if (generatedPositionAfter(this._last, aMapping)) {
					this._last = aMapping;
					this._array.push(aMapping);
				} else {
					this._sorted = false;
					this._array.push(aMapping);
				}
			}
			/**
			* Returns the flat, sorted array of mappings. The mappings are sorted by
			* generated position.
			*
			* WARNING: This method returns internal data without copying, for
			* performance. The return value must NOT be mutated, and should be treated as
			* an immutable borrow. If you want to take ownership, you must make your own
			* copy.
			*/
			toArray() {
				if (!this._sorted) {
					this._array.sort(util.compareByGeneratedPositionsInflated);
					this._sorted = true;
				}
				return this._array;
			}
		};
		exports.MappingList = MappingList;
	}));
	//#endregion
	//#region node_modules/source-map/lib/source-map-generator.js
	var require_source_map_generator = /* @__PURE__ */ __commonJSMin(((exports) => {
		var base64VLQ = require_base64_vlq();
		var util = require_util();
		var ArraySet = require_array_set().ArraySet;
		var MappingList = require_mapping_list().MappingList;
		/**
		* An instance of the SourceMapGenerator represents a source map which is
		* being built incrementally. You may pass an object with the following
		* properties:
		*
		*   - file: The filename of the generated source.
		*   - sourceRoot: A root for all relative URLs in this source map.
		*/
		var SourceMapGenerator = class SourceMapGenerator {
			constructor(aArgs) {
				if (!aArgs) aArgs = {};
				this._file = util.getArg(aArgs, "file", null);
				this._sourceRoot = util.getArg(aArgs, "sourceRoot", null);
				this._skipValidation = util.getArg(aArgs, "skipValidation", false);
				this._sources = new ArraySet();
				this._names = new ArraySet();
				this._mappings = new MappingList();
				this._sourcesContents = null;
			}
			/**
			* Creates a new SourceMapGenerator based on a SourceMapConsumer
			*
			* @param aSourceMapConsumer The SourceMap.
			*/
			static fromSourceMap(aSourceMapConsumer) {
				const sourceRoot = aSourceMapConsumer.sourceRoot;
				const generator = new SourceMapGenerator({
					file: aSourceMapConsumer.file,
					sourceRoot
				});
				aSourceMapConsumer.eachMapping(function(mapping) {
					const newMapping = { generated: {
						line: mapping.generatedLine,
						column: mapping.generatedColumn
					} };
					if (mapping.source != null) {
						newMapping.source = mapping.source;
						if (sourceRoot != null) newMapping.source = util.relative(sourceRoot, newMapping.source);
						newMapping.original = {
							line: mapping.originalLine,
							column: mapping.originalColumn
						};
						if (mapping.name != null) newMapping.name = mapping.name;
					}
					generator.addMapping(newMapping);
				});
				aSourceMapConsumer.sources.forEach(function(sourceFile) {
					let sourceRelative = sourceFile;
					if (sourceRoot != null) sourceRelative = util.relative(sourceRoot, sourceFile);
					if (!generator._sources.has(sourceRelative)) generator._sources.add(sourceRelative);
					const content = aSourceMapConsumer.sourceContentFor(sourceFile);
					if (content != null) generator.setSourceContent(sourceFile, content);
				});
				return generator;
			}
			/**
			* Add a single mapping from original source line and column to the generated
			* source's line and column for this source map being created. The mapping
			* object should have the following properties:
			*
			*   - generated: An object with the generated line and column positions.
			*   - original: An object with the original line and column positions.
			*   - source: The original source file (relative to the sourceRoot).
			*   - name: An optional original token name for this mapping.
			*/
			addMapping(aArgs) {
				const generated = util.getArg(aArgs, "generated");
				const original = util.getArg(aArgs, "original", null);
				let source = util.getArg(aArgs, "source", null);
				let name = util.getArg(aArgs, "name", null);
				if (!this._skipValidation) this._validateMapping(generated, original, source, name);
				if (source != null) {
					source = String(source);
					if (!this._sources.has(source)) this._sources.add(source);
				}
				if (name != null) {
					name = String(name);
					if (!this._names.has(name)) this._names.add(name);
				}
				this._mappings.add({
					generatedLine: generated.line,
					generatedColumn: generated.column,
					originalLine: original && original.line,
					originalColumn: original && original.column,
					source,
					name
				});
			}
			/**
			* Set the source content for a source file.
			*/
			setSourceContent(aSourceFile, aSourceContent) {
				let source = aSourceFile;
				if (this._sourceRoot != null) source = util.relative(this._sourceRoot, source);
				if (aSourceContent != null) {
					if (!this._sourcesContents) this._sourcesContents = Object.create(null);
					this._sourcesContents[util.toSetString(source)] = aSourceContent;
				} else if (this._sourcesContents) {
					delete this._sourcesContents[util.toSetString(source)];
					if (Object.keys(this._sourcesContents).length === 0) this._sourcesContents = null;
				}
			}
			/**
			* Applies the mappings of a sub-source-map for a specific source file to the
			* source map being generated. Each mapping to the supplied source file is
			* rewritten using the supplied source map. Note: The resolution for the
			* resulting mappings is the minimium of this map and the supplied map.
			*
			* @param aSourceMapConsumer The source map to be applied.
			* @param aSourceFile Optional. The filename of the source file.
			*        If omitted, SourceMapConsumer's file property will be used.
			* @param aSourceMapPath Optional. The dirname of the path to the source map
			*        to be applied. If relative, it is relative to the SourceMapConsumer.
			*        This parameter is needed when the two source maps aren't in the same
			*        directory, and the source map to be applied contains relative source
			*        paths. If so, those relative source paths need to be rewritten
			*        relative to the SourceMapGenerator.
			*/
			applySourceMap(aSourceMapConsumer, aSourceFile, aSourceMapPath) {
				let sourceFile = aSourceFile;
				if (aSourceFile == null) {
					if (aSourceMapConsumer.file == null) throw new Error("SourceMapGenerator.prototype.applySourceMap requires either an explicit source file, or the source map's \"file\" property. Both were omitted.");
					sourceFile = aSourceMapConsumer.file;
				}
				const sourceRoot = this._sourceRoot;
				if (sourceRoot != null) sourceFile = util.relative(sourceRoot, sourceFile);
				const newSources = this._mappings.toArray().length > 0 ? new ArraySet() : this._sources;
				const newNames = new ArraySet();
				this._mappings.unsortedForEach(function(mapping) {
					if (mapping.source === sourceFile && mapping.originalLine != null) {
						const original = aSourceMapConsumer.originalPositionFor({
							line: mapping.originalLine,
							column: mapping.originalColumn
						});
						if (original.source != null) {
							mapping.source = original.source;
							if (aSourceMapPath != null) mapping.source = util.join(aSourceMapPath, mapping.source);
							if (sourceRoot != null) mapping.source = util.relative(sourceRoot, mapping.source);
							mapping.originalLine = original.line;
							mapping.originalColumn = original.column;
							if (original.name != null) mapping.name = original.name;
						}
					}
					const source = mapping.source;
					if (source != null && !newSources.has(source)) newSources.add(source);
					const name = mapping.name;
					if (name != null && !newNames.has(name)) newNames.add(name);
				}, this);
				this._sources = newSources;
				this._names = newNames;
				aSourceMapConsumer.sources.forEach(function(srcFile) {
					const content = aSourceMapConsumer.sourceContentFor(srcFile);
					if (content != null) {
						if (aSourceMapPath != null) srcFile = util.join(aSourceMapPath, srcFile);
						if (sourceRoot != null) srcFile = util.relative(sourceRoot, srcFile);
						this.setSourceContent(srcFile, content);
					}
				}, this);
			}
			/**
			* A mapping can have one of the three levels of data:
			*
			*   1. Just the generated position.
			*   2. The Generated position, original position, and original source.
			*   3. Generated and original position, original source, as well as a name
			*      token.
			*
			* To maintain consistency, we validate that any new mapping being added falls
			* in to one of these categories.
			*/
			_validateMapping(aGenerated, aOriginal, aSource, aName) {
				if (aOriginal && typeof aOriginal.line !== "number" && typeof aOriginal.column !== "number") throw new Error("original.line and original.column are not numbers -- you probably meant to omit the original mapping entirely and only map the generated position. If so, pass null for the original mapping instead of an object with empty or null values.");
				if (aGenerated && "line" in aGenerated && "column" in aGenerated && aGenerated.line > 0 && aGenerated.column >= 0 && !aOriginal && !aSource && !aName) {} else if (aGenerated && "line" in aGenerated && "column" in aGenerated && aOriginal && "line" in aOriginal && "column" in aOriginal && aGenerated.line > 0 && aGenerated.column >= 0 && aOriginal.line > 0 && aOriginal.column >= 0 && aSource) {} else throw new Error("Invalid mapping: " + JSON.stringify({
					generated: aGenerated,
					source: aSource,
					original: aOriginal,
					name: aName
				}));
			}
			/**
			* Serialize the accumulated mappings in to the stream of base 64 VLQs
			* specified by the source map format.
			*/
			_serializeMappings() {
				let previousGeneratedColumn = 0;
				let previousGeneratedLine = 1;
				let previousOriginalColumn = 0;
				let previousOriginalLine = 0;
				let previousName = 0;
				let previousSource = 0;
				let result = "";
				let next;
				let mapping;
				let nameIdx;
				let sourceIdx;
				const mappings = this._mappings.toArray();
				for (let i = 0, len = mappings.length; i < len; i++) {
					mapping = mappings[i];
					next = "";
					if (mapping.generatedLine !== previousGeneratedLine) {
						previousGeneratedColumn = 0;
						while (mapping.generatedLine !== previousGeneratedLine) {
							next += ";";
							previousGeneratedLine++;
						}
					} else if (i > 0) {
						if (!util.compareByGeneratedPositionsInflated(mapping, mappings[i - 1])) continue;
						next += ",";
					}
					next += base64VLQ.encode(mapping.generatedColumn - previousGeneratedColumn);
					previousGeneratedColumn = mapping.generatedColumn;
					if (mapping.source != null) {
						sourceIdx = this._sources.indexOf(mapping.source);
						next += base64VLQ.encode(sourceIdx - previousSource);
						previousSource = sourceIdx;
						next += base64VLQ.encode(mapping.originalLine - 1 - previousOriginalLine);
						previousOriginalLine = mapping.originalLine - 1;
						next += base64VLQ.encode(mapping.originalColumn - previousOriginalColumn);
						previousOriginalColumn = mapping.originalColumn;
						if (mapping.name != null) {
							nameIdx = this._names.indexOf(mapping.name);
							next += base64VLQ.encode(nameIdx - previousName);
							previousName = nameIdx;
						}
					}
					result += next;
				}
				return result;
			}
			_generateSourcesContent(aSources, aSourceRoot) {
				return aSources.map(function(source) {
					if (!this._sourcesContents) return null;
					if (aSourceRoot != null) source = util.relative(aSourceRoot, source);
					const key = util.toSetString(source);
					return Object.prototype.hasOwnProperty.call(this._sourcesContents, key) ? this._sourcesContents[key] : null;
				}, this);
			}
			/**
			* Externalize the source map.
			*/
			toJSON() {
				const map = {
					version: this._version,
					sources: this._sources.toArray(),
					names: this._names.toArray(),
					mappings: this._serializeMappings()
				};
				if (this._file != null) map.file = this._file;
				if (this._sourceRoot != null) map.sourceRoot = this._sourceRoot;
				if (this._sourcesContents) map.sourcesContent = this._generateSourcesContent(map.sources, map.sourceRoot);
				return map;
			}
			/**
			* Render the source map being generated to a string.
			*/
			toString() {
				return JSON.stringify(this.toJSON());
			}
		};
		SourceMapGenerator.prototype._version = 3;
		exports.SourceMapGenerator = SourceMapGenerator;
	}));
	//#endregion
	//#region node_modules/source-map/lib/binary-search.js
	var require_binary_search = /* @__PURE__ */ __commonJSMin(((exports) => {
		exports.GREATEST_LOWER_BOUND = 1;
		exports.LEAST_UPPER_BOUND = 2;
		/**
		* Recursive implementation of binary search.
		*
		* @param aLow Indices here and lower do not contain the needle.
		* @param aHigh Indices here and higher do not contain the needle.
		* @param aNeedle The element being searched for.
		* @param aHaystack The non-empty array being searched.
		* @param aCompare Function which takes two elements and returns -1, 0, or 1.
		* @param aBias Either 'binarySearch.GREATEST_LOWER_BOUND' or
		*     'binarySearch.LEAST_UPPER_BOUND'. Specifies whether to return the
		*     closest element that is smaller than or greater than the one we are
		*     searching for, respectively, if the exact element cannot be found.
		*/
		function recursiveSearch(aLow, aHigh, aNeedle, aHaystack, aCompare, aBias) {
			const mid = Math.floor((aHigh - aLow) / 2) + aLow;
			const cmp = aCompare(aNeedle, aHaystack[mid], true);
			if (cmp === 0) return mid;
			else if (cmp > 0) {
				if (aHigh - mid > 1) return recursiveSearch(mid, aHigh, aNeedle, aHaystack, aCompare, aBias);
				if (aBias === exports.LEAST_UPPER_BOUND) return aHigh < aHaystack.length ? aHigh : -1;
				return mid;
			}
			if (mid - aLow > 1) return recursiveSearch(aLow, mid, aNeedle, aHaystack, aCompare, aBias);
			if (aBias == exports.LEAST_UPPER_BOUND) return mid;
			return aLow < 0 ? -1 : aLow;
		}
		/**
		* This is an implementation of binary search which will always try and return
		* the index of the closest element if there is no exact hit. This is because
		* mappings between original and generated line/col pairs are single points,
		* and there is an implicit region between each of them, so a miss just means
		* that you aren't on the very start of a region.
		*
		* @param aNeedle The element you are looking for.
		* @param aHaystack The array that is being searched.
		* @param aCompare A function which takes the needle and an element in the
		*     array and returns -1, 0, or 1 depending on whether the needle is less
		*     than, equal to, or greater than the element, respectively.
		* @param aBias Either 'binarySearch.GREATEST_LOWER_BOUND' or
		*     'binarySearch.LEAST_UPPER_BOUND'. Specifies whether to return the
		*     closest element that is smaller than or greater than the one we are
		*     searching for, respectively, if the exact element cannot be found.
		*     Defaults to 'binarySearch.GREATEST_LOWER_BOUND'.
		*/
		exports.search = function search(aNeedle, aHaystack, aCompare, aBias) {
			if (aHaystack.length === 0) return -1;
			let index = recursiveSearch(-1, aHaystack.length, aNeedle, aHaystack, aCompare, aBias || exports.GREATEST_LOWER_BOUND);
			if (index < 0) return -1;
			while (index - 1 >= 0) {
				if (aCompare(aHaystack[index], aHaystack[index - 1], true) !== 0) break;
				--index;
			}
			return index;
		};
	}));
	//#endregion
	//#region node_modules/source-map/lib/read-wasm-browser.js
	var require_read_wasm_browser = /* @__PURE__ */ __commonJSMin(((exports, module) => {
		var mappingsWasm = null;
		module.exports = function readWasm() {
			if (typeof mappingsWasm === "string") return fetch(mappingsWasm).then((response) => response.arrayBuffer());
			if (mappingsWasm instanceof ArrayBuffer) return Promise.resolve(mappingsWasm);
			throw new Error("You must provide the string URL or ArrayBuffer contents of lib/mappings.wasm by calling SourceMapConsumer.initialize({ 'lib/mappings.wasm': ... }) before using SourceMapConsumer");
		};
		module.exports.initialize = (input) => {
			mappingsWasm = input;
		};
	}));
	//#endregion
	//#region node_modules/source-map/lib/wasm.js
	var require_wasm = /* @__PURE__ */ __commonJSMin(((exports, module) => {
		var readWasm = require_read_wasm_browser();
		/**
		* Provide the JIT with a nice shape / hidden class.
		*/
		function Mapping() {
			this.generatedLine = 0;
			this.generatedColumn = 0;
			this.lastGeneratedColumn = null;
			this.source = null;
			this.originalLine = null;
			this.originalColumn = null;
			this.name = null;
		}
		var cachedWasm = null;
		module.exports = function wasm() {
			if (cachedWasm) return cachedWasm;
			const callbackStack = [];
			cachedWasm = readWasm().then((buffer) => {
				return WebAssembly.instantiate(buffer, { env: {
					mapping_callback(generatedLine, generatedColumn, hasLastGeneratedColumn, lastGeneratedColumn, hasOriginal, source, originalLine, originalColumn, hasName, name) {
						const mapping = new Mapping();
						mapping.generatedLine = generatedLine + 1;
						mapping.generatedColumn = generatedColumn;
						if (hasLastGeneratedColumn) mapping.lastGeneratedColumn = lastGeneratedColumn - 1;
						if (hasOriginal) {
							mapping.source = source;
							mapping.originalLine = originalLine + 1;
							mapping.originalColumn = originalColumn;
							if (hasName) mapping.name = name;
						}
						callbackStack[callbackStack.length - 1](mapping);
					},
					start_all_generated_locations_for() {
						console.time("all_generated_locations_for");
					},
					end_all_generated_locations_for() {
						console.timeEnd("all_generated_locations_for");
					},
					start_compute_column_spans() {
						console.time("compute_column_spans");
					},
					end_compute_column_spans() {
						console.timeEnd("compute_column_spans");
					},
					start_generated_location_for() {
						console.time("generated_location_for");
					},
					end_generated_location_for() {
						console.timeEnd("generated_location_for");
					},
					start_original_location_for() {
						console.time("original_location_for");
					},
					end_original_location_for() {
						console.timeEnd("original_location_for");
					},
					start_parse_mappings() {
						console.time("parse_mappings");
					},
					end_parse_mappings() {
						console.timeEnd("parse_mappings");
					},
					start_sort_by_generated_location() {
						console.time("sort_by_generated_location");
					},
					end_sort_by_generated_location() {
						console.timeEnd("sort_by_generated_location");
					},
					start_sort_by_original_location() {
						console.time("sort_by_original_location");
					},
					end_sort_by_original_location() {
						console.timeEnd("sort_by_original_location");
					}
				} });
			}).then((Wasm) => {
				return {
					exports: Wasm.instance.exports,
					withMappingCallback: (mappingCallback, f) => {
						callbackStack.push(mappingCallback);
						try {
							f();
						} finally {
							callbackStack.pop();
						}
					}
				};
			}).then(null, (e) => {
				cachedWasm = null;
				throw e;
			});
			return cachedWasm;
		};
	}));
	//#endregion
	//#region node_modules/source-map/lib/source-map-consumer.js
	var require_source_map_consumer = /* @__PURE__ */ __commonJSMin(((exports) => {
		var util = require_util();
		var binarySearch = require_binary_search();
		var ArraySet = require_array_set().ArraySet;
		require_base64_vlq();
		var readWasm = require_read_wasm_browser();
		var wasm = require_wasm();
		var INTERNAL = Symbol("smcInternal");
		var SourceMapConsumer = class SourceMapConsumer {
			constructor(aSourceMap, aSourceMapURL) {
				if (aSourceMap == INTERNAL) return Promise.resolve(this);
				return _factory(aSourceMap, aSourceMapURL);
			}
			static initialize(opts) {
				readWasm.initialize(opts["lib/mappings.wasm"]);
			}
			static fromSourceMap(aSourceMap, aSourceMapURL) {
				return _factoryBSM(aSourceMap, aSourceMapURL);
			}
			/**
			* Construct a new `SourceMapConsumer` from `rawSourceMap` and `sourceMapUrl`
			* (see the `SourceMapConsumer` constructor for details. Then, invoke the `async
			* function f(SourceMapConsumer) -> T` with the newly constructed consumer, wait
			* for `f` to complete, call `destroy` on the consumer, and return `f`'s return
			* value.
			*
			* You must not use the consumer after `f` completes!
			*
			* By using `with`, you do not have to remember to manually call `destroy` on
			* the consumer, since it will be called automatically once `f` completes.
			*
			* ```js
			* const xSquared = await SourceMapConsumer.with(
			*   myRawSourceMap,
			*   null,
			*   async function (consumer) {
			*     // Use `consumer` inside here and don't worry about remembering
			*     // to call `destroy`.
			*
			*     const x = await whatever(consumer);
			*     return x * x;
			*   }
			* );
			*
			* // You may not use that `consumer` anymore out here; it has
			* // been destroyed. But you can use `xSquared`.
			* console.log(xSquared);
			* ```
			*/
			static async with(rawSourceMap, sourceMapUrl, f) {
				const consumer = await new SourceMapConsumer(rawSourceMap, sourceMapUrl);
				try {
					return await f(consumer);
				} finally {
					consumer.destroy();
				}
			}
			/**
			* Iterate over each mapping between an original source/line/column and a
			* generated line/column in this source map.
			*
			* @param Function aCallback
			*        The function that is called with each mapping.
			* @param Object aContext
			*        Optional. If specified, this object will be the value of `this` every
			*        time that `aCallback` is called.
			* @param aOrder
			*        Either `SourceMapConsumer.GENERATED_ORDER` or
			*        `SourceMapConsumer.ORIGINAL_ORDER`. Specifies whether you want to
			*        iterate over the mappings sorted by the generated file's line/column
			*        order or the original's source/line/column order, respectively. Defaults to
			*        `SourceMapConsumer.GENERATED_ORDER`.
			*/
			eachMapping(aCallback, aContext, aOrder) {
				throw new Error("Subclasses must implement eachMapping");
			}
			/**
			* Returns all generated line and column information for the original source,
			* line, and column provided. If no column is provided, returns all mappings
			* corresponding to a either the line we are searching for or the next
			* closest line that has any mappings. Otherwise, returns all mappings
			* corresponding to the given line and either the column we are searching for
			* or the next closest column that has any offsets.
			*
			* The only argument is an object with the following properties:
			*
			*   - source: The filename of the original source.
			*   - line: The line number in the original source.  The line number is 1-based.
			*   - column: Optional. the column number in the original source.
			*    The column number is 0-based.
			*
			* and an array of objects is returned, each with the following properties:
			*
			*   - line: The line number in the generated source, or null.  The
			*    line number is 1-based.
			*   - column: The column number in the generated source, or null.
			*    The column number is 0-based.
			*/
			allGeneratedPositionsFor(aArgs) {
				throw new Error("Subclasses must implement allGeneratedPositionsFor");
			}
			destroy() {
				throw new Error("Subclasses must implement destroy");
			}
		};
		/**
		* The version of the source mapping spec that we are consuming.
		*/
		SourceMapConsumer.prototype._version = 3;
		SourceMapConsumer.GENERATED_ORDER = 1;
		SourceMapConsumer.ORIGINAL_ORDER = 2;
		SourceMapConsumer.GREATEST_LOWER_BOUND = 1;
		SourceMapConsumer.LEAST_UPPER_BOUND = 2;
		exports.SourceMapConsumer = SourceMapConsumer;
		/**
		* A BasicSourceMapConsumer instance represents a parsed source map which we can
		* query for information about the original file positions by giving it a file
		* position in the generated source.
		*
		* The first parameter is the raw source map (either as a JSON string, or
		* already parsed to an object). According to the spec, source maps have the
		* following attributes:
		*
		*   - version: Which version of the source map spec this map is following.
		*   - sources: An array of URLs to the original source files.
		*   - names: An array of identifiers which can be referenced by individual mappings.
		*   - sourceRoot: Optional. The URL root from which all sources are relative.
		*   - sourcesContent: Optional. An array of contents of the original source files.
		*   - mappings: A string of base64 VLQs which contain the actual mappings.
		*   - file: Optional. The generated file this source map is associated with.
		*
		* Here is an example source map, taken from the source map spec[0]:
		*
		*     {
		*       version : 3,
		*       file: "out.js",
		*       sourceRoot : "",
		*       sources: ["foo.js", "bar.js"],
		*       names: ["src", "maps", "are", "fun"],
		*       mappings: "AA,AB;;ABCDE;"
		*     }
		*
		* The second parameter, if given, is a string whose value is the URL
		* at which the source map was found.  This URL is used to compute the
		* sources array.
		*
		* [0]: https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit?pli=1#
		*/
		var BasicSourceMapConsumer = class BasicSourceMapConsumer extends SourceMapConsumer {
			constructor(aSourceMap, aSourceMapURL) {
				return super(INTERNAL).then((that) => {
					let sourceMap = aSourceMap;
					if (typeof aSourceMap === "string") sourceMap = util.parseSourceMapInput(aSourceMap);
					const version = util.getArg(sourceMap, "version");
					const sources = util.getArg(sourceMap, "sources").map(String);
					const names = util.getArg(sourceMap, "names", []);
					const sourceRoot = util.getArg(sourceMap, "sourceRoot", null);
					const sourcesContent = util.getArg(sourceMap, "sourcesContent", null);
					const mappings = util.getArg(sourceMap, "mappings");
					const file = util.getArg(sourceMap, "file", null);
					const x_google_ignoreList = util.getArg(sourceMap, "x_google_ignoreList", null);
					if (version != that._version) throw new Error("Unsupported version: " + version);
					that._sourceLookupCache = /* @__PURE__ */ new Map();
					that._names = ArraySet.fromArray(names.map(String), true);
					that._sources = ArraySet.fromArray(sources, true);
					that._absoluteSources = ArraySet.fromArray(that._sources.toArray().map(function(s) {
						return util.computeSourceURL(sourceRoot, s, aSourceMapURL);
					}), true);
					that.sourceRoot = sourceRoot;
					that.sourcesContent = sourcesContent;
					that._mappings = mappings;
					that._sourceMapURL = aSourceMapURL;
					that.file = file;
					that.x_google_ignoreList = x_google_ignoreList;
					that._computedColumnSpans = false;
					that._mappingsPtr = 0;
					that._wasm = null;
					return wasm().then((w) => {
						that._wasm = w;
						return that;
					});
				});
			}
			/**
			* Utility function to find the index of a source.  Returns -1 if not
			* found.
			*/
			_findSourceIndex(aSource) {
				const cachedIndex = this._sourceLookupCache.get(aSource);
				if (typeof cachedIndex === "number") return cachedIndex;
				const sourceAsMapRelative = util.computeSourceURL(null, aSource, this._sourceMapURL);
				if (this._absoluteSources.has(sourceAsMapRelative)) {
					const index = this._absoluteSources.indexOf(sourceAsMapRelative);
					this._sourceLookupCache.set(aSource, index);
					return index;
				}
				const sourceAsSourceRootRelative = util.computeSourceURL(this.sourceRoot, aSource, this._sourceMapURL);
				if (this._absoluteSources.has(sourceAsSourceRootRelative)) {
					const index = this._absoluteSources.indexOf(sourceAsSourceRootRelative);
					this._sourceLookupCache.set(aSource, index);
					return index;
				}
				return -1;
			}
			/**
			* Create a BasicSourceMapConsumer from a SourceMapGenerator.
			*
			* @param SourceMapGenerator aSourceMap
			*        The source map that will be consumed.
			* @param String aSourceMapURL
			*        The URL at which the source map can be found (optional)
			* @returns BasicSourceMapConsumer
			*/
			static fromSourceMap(aSourceMap, aSourceMapURL) {
				return new BasicSourceMapConsumer(aSourceMap.toString());
			}
			get sources() {
				return this._absoluteSources.toArray();
			}
			_getMappingsPtr() {
				if (this._mappingsPtr === 0) this._parseMappings();
				return this._mappingsPtr;
			}
			/**
			* Parse the mappings in a string in to a data structure which we can easily
			* query (the ordered arrays in the `this.__generatedMappings` and
			* `this.__originalMappings` properties).
			*/
			_parseMappings() {
				const aStr = this._mappings;
				const size = aStr.length;
				const mappingsBufPtr = this._wasm.exports.allocate_mappings(size) >>> 0;
				const mappingsBuf = new Uint8Array(this._wasm.exports.memory.buffer, mappingsBufPtr, size);
				for (let i = 0; i < size; i++) mappingsBuf[i] = aStr.charCodeAt(i);
				const mappingsPtr = this._wasm.exports.parse_mappings(mappingsBufPtr);
				if (!mappingsPtr) {
					const error = this._wasm.exports.get_last_error();
					let msg = `Error parsing mappings (code ${error}): `;
					switch (error) {
						case 1:
							msg += "the mappings contained a negative line, column, source index, or name index";
							break;
						case 2:
							msg += "the mappings contained a number larger than 2**32";
							break;
						case 3:
							msg += "reached EOF while in the middle of parsing a VLQ";
							break;
						case 4:
							msg += "invalid base 64 character while parsing a VLQ";
							break;
						default:
							msg += "unknown error code";
							break;
					}
					throw new Error(msg);
				}
				this._mappingsPtr = mappingsPtr;
			}
			eachMapping(aCallback, aContext, aOrder) {
				const context = aContext || null;
				const order = aOrder || SourceMapConsumer.GENERATED_ORDER;
				this._wasm.withMappingCallback((mapping) => {
					if (mapping.source !== null) {
						mapping.source = this._absoluteSources.at(mapping.source);
						if (mapping.name !== null) mapping.name = this._names.at(mapping.name);
					}
					if (this._computedColumnSpans && mapping.lastGeneratedColumn === null) mapping.lastGeneratedColumn = Infinity;
					aCallback.call(context, mapping);
				}, () => {
					switch (order) {
						case SourceMapConsumer.GENERATED_ORDER:
							this._wasm.exports.by_generated_location(this._getMappingsPtr());
							break;
						case SourceMapConsumer.ORIGINAL_ORDER:
							this._wasm.exports.by_original_location(this._getMappingsPtr());
							break;
						default: throw new Error("Unknown order of iteration.");
					}
				});
			}
			allGeneratedPositionsFor(aArgs) {
				let source = util.getArg(aArgs, "source");
				const originalLine = util.getArg(aArgs, "line");
				const originalColumn = aArgs.column || 0;
				source = this._findSourceIndex(source);
				if (source < 0) return [];
				if (originalLine < 1) throw new Error("Line numbers must be >= 1");
				if (originalColumn < 0) throw new Error("Column numbers must be >= 0");
				const mappings = [];
				this._wasm.withMappingCallback((m) => {
					let lastColumn = m.lastGeneratedColumn;
					if (this._computedColumnSpans && lastColumn === null) lastColumn = Infinity;
					mappings.push({
						line: m.generatedLine,
						column: m.generatedColumn,
						lastColumn
					});
				}, () => {
					this._wasm.exports.all_generated_locations_for(this._getMappingsPtr(), source, originalLine - 1, "column" in aArgs, originalColumn);
				});
				return mappings;
			}
			destroy() {
				if (this._mappingsPtr !== 0) {
					this._wasm.exports.free_mappings(this._mappingsPtr);
					this._mappingsPtr = 0;
				}
			}
			/**
			* Compute the last column for each generated mapping. The last column is
			* inclusive.
			*/
			computeColumnSpans() {
				if (this._computedColumnSpans) return;
				this._wasm.exports.compute_column_spans(this._getMappingsPtr());
				this._computedColumnSpans = true;
			}
			/**
			* Returns the original source, line, and column information for the generated
			* source's line and column positions provided. The only argument is an object
			* with the following properties:
			*
			*   - line: The line number in the generated source.  The line number
			*     is 1-based.
			*   - column: The column number in the generated source.  The column
			*     number is 0-based.
			*   - bias: Either 'SourceMapConsumer.GREATEST_LOWER_BOUND' or
			*     'SourceMapConsumer.LEAST_UPPER_BOUND'. Specifies whether to return the
			*     closest element that is smaller than or greater than the one we are
			*     searching for, respectively, if the exact element cannot be found.
			*     Defaults to 'SourceMapConsumer.GREATEST_LOWER_BOUND'.
			*
			* and an object is returned with the following properties:
			*
			*   - source: The original source file, or null.
			*   - line: The line number in the original source, or null.  The
			*     line number is 1-based.
			*   - column: The column number in the original source, or null.  The
			*     column number is 0-based.
			*   - name: The original identifier, or null.
			*/
			originalPositionFor(aArgs) {
				const needle = {
					generatedLine: util.getArg(aArgs, "line"),
					generatedColumn: util.getArg(aArgs, "column")
				};
				if (needle.generatedLine < 1) throw new Error("Line numbers must be >= 1");
				if (needle.generatedColumn < 0) throw new Error("Column numbers must be >= 0");
				let bias = util.getArg(aArgs, "bias", SourceMapConsumer.GREATEST_LOWER_BOUND);
				if (bias == null) bias = SourceMapConsumer.GREATEST_LOWER_BOUND;
				let mapping;
				this._wasm.withMappingCallback((m) => mapping = m, () => {
					this._wasm.exports.original_location_for(this._getMappingsPtr(), needle.generatedLine - 1, needle.generatedColumn, bias);
				});
				if (mapping) {
					if (mapping.generatedLine === needle.generatedLine) {
						let source = util.getArg(mapping, "source", null);
						if (source !== null) source = this._absoluteSources.at(source);
						let name = util.getArg(mapping, "name", null);
						if (name !== null) name = this._names.at(name);
						return {
							source,
							line: util.getArg(mapping, "originalLine", null),
							column: util.getArg(mapping, "originalColumn", null),
							name
						};
					}
				}
				return {
					source: null,
					line: null,
					column: null,
					name: null
				};
			}
			/**
			* Return true if we have the source content for every source in the source
			* map, false otherwise.
			*/
			hasContentsOfAllSources() {
				if (!this.sourcesContent) return false;
				return this.sourcesContent.length >= this._sources.size() && !this.sourcesContent.some(function(sc) {
					return sc == null;
				});
			}
			/**
			* Returns the original source content. The only argument is the url of the
			* original source file. Returns null if no original source content is
			* available.
			*/
			sourceContentFor(aSource, nullOnMissing) {
				if (!this.sourcesContent) return null;
				const index = this._findSourceIndex(aSource);
				if (index >= 0) return this.sourcesContent[index];
				if (nullOnMissing) return null;
				throw new Error("\"" + aSource + "\" is not in the SourceMap.");
			}
			/**
			* Returns the generated line and column information for the original source,
			* line, and column positions provided. The only argument is an object with
			* the following properties:
			*
			*   - source: The filename of the original source.
			*   - line: The line number in the original source.  The line number
			*     is 1-based.
			*   - column: The column number in the original source.  The column
			*     number is 0-based.
			*   - bias: Either 'SourceMapConsumer.GREATEST_LOWER_BOUND' or
			*     'SourceMapConsumer.LEAST_UPPER_BOUND'. Specifies whether to return the
			*     closest element that is smaller than or greater than the one we are
			*     searching for, respectively, if the exact element cannot be found.
			*     Defaults to 'SourceMapConsumer.GREATEST_LOWER_BOUND'.
			*
			* and an object is returned with the following properties:
			*
			*   - line: The line number in the generated source, or null.  The
			*     line number is 1-based.
			*   - column: The column number in the generated source, or null.
			*     The column number is 0-based.
			*/
			generatedPositionFor(aArgs) {
				let source = util.getArg(aArgs, "source");
				source = this._findSourceIndex(source);
				if (source < 0) return {
					line: null,
					column: null,
					lastColumn: null
				};
				const needle = {
					source,
					originalLine: util.getArg(aArgs, "line"),
					originalColumn: util.getArg(aArgs, "column")
				};
				if (needle.originalLine < 1) throw new Error("Line numbers must be >= 1");
				if (needle.originalColumn < 0) throw new Error("Column numbers must be >= 0");
				let bias = util.getArg(aArgs, "bias", SourceMapConsumer.GREATEST_LOWER_BOUND);
				if (bias == null) bias = SourceMapConsumer.GREATEST_LOWER_BOUND;
				let mapping;
				this._wasm.withMappingCallback((m) => mapping = m, () => {
					this._wasm.exports.generated_location_for(this._getMappingsPtr(), needle.source, needle.originalLine - 1, needle.originalColumn, bias);
				});
				if (mapping) {
					if (mapping.source === needle.source) {
						let lastColumn = mapping.lastGeneratedColumn;
						if (this._computedColumnSpans && lastColumn === null) lastColumn = Infinity;
						return {
							line: util.getArg(mapping, "generatedLine", null),
							column: util.getArg(mapping, "generatedColumn", null),
							lastColumn
						};
					}
				}
				return {
					line: null,
					column: null,
					lastColumn: null
				};
			}
		};
		BasicSourceMapConsumer.prototype.consumer = SourceMapConsumer;
		exports.BasicSourceMapConsumer = BasicSourceMapConsumer;
		/**
		* An IndexedSourceMapConsumer instance represents a parsed source map which
		* we can query for information. It differs from BasicSourceMapConsumer in
		* that it takes "indexed" source maps (i.e. ones with a "sections" field) as
		* input.
		*
		* The first parameter is a raw source map (either as a JSON string, or already
		* parsed to an object). According to the spec for indexed source maps, they
		* have the following attributes:
		*
		*   - version: Which version of the source map spec this map is following.
		*   - file: Optional. The generated file this source map is associated with.
		*   - sections: A list of section definitions.
		*
		* Each value under the "sections" field has two fields:
		*   - offset: The offset into the original specified at which this section
		*       begins to apply, defined as an object with a "line" and "column"
		*       field.
		*   - map: A source map definition. This source map could also be indexed,
		*       but doesn't have to be.
		*
		* Instead of the "map" field, it's also possible to have a "url" field
		* specifying a URL to retrieve a source map from, but that's currently
		* unsupported.
		*
		* Here's an example source map, taken from the source map spec[0], but
		* modified to omit a section which uses the "url" field.
		*
		*  {
		*    version : 3,
		*    file: "app.js",
		*    sections: [{
		*      offset: {line:100, column:10},
		*      map: {
		*        version : 3,
		*        file: "section.js",
		*        sources: ["foo.js", "bar.js"],
		*        names: ["src", "maps", "are", "fun"],
		*        mappings: "AAAA,E;;ABCDE;"
		*      }
		*    }],
		*  }
		*
		* The second parameter, if given, is a string whose value is the URL
		* at which the source map was found.  This URL is used to compute the
		* sources array.
		*
		* [0]: https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit#heading=h.535es3xeprgt
		*/
		var IndexedSourceMapConsumer = class extends SourceMapConsumer {
			constructor(aSourceMap, aSourceMapURL) {
				return super(INTERNAL).then((that) => {
					let sourceMap = aSourceMap;
					if (typeof aSourceMap === "string") sourceMap = util.parseSourceMapInput(aSourceMap);
					const version = util.getArg(sourceMap, "version");
					const sections = util.getArg(sourceMap, "sections");
					if (version != that._version) throw new Error("Unsupported version: " + version);
					let lastOffset = {
						line: -1,
						column: 0
					};
					return Promise.all(sections.map((s) => {
						if (s.url) throw new Error("Support for url field in sections not implemented.");
						const offset = util.getArg(s, "offset");
						const offsetLine = util.getArg(offset, "line");
						const offsetColumn = util.getArg(offset, "column");
						if (offsetLine < lastOffset.line || offsetLine === lastOffset.line && offsetColumn < lastOffset.column) throw new Error("Section offsets must be ordered and non-overlapping.");
						lastOffset = offset;
						return new SourceMapConsumer(util.getArg(s, "map"), aSourceMapURL).then((consumer) => {
							return {
								generatedOffset: {
									generatedLine: offsetLine + 1,
									generatedColumn: offsetColumn + 1
								},
								consumer
							};
						});
					})).then((s) => {
						that._sections = s;
						return that;
					});
				});
			}
			/**
			* The list of original sources.
			*/
			get sources() {
				const sources = [];
				for (let i = 0; i < this._sections.length; i++) for (let j = 0; j < this._sections[i].consumer.sources.length; j++) sources.push(this._sections[i].consumer.sources[j]);
				return sources;
			}
			/**
			* Returns the original source, line, and column information for the generated
			* source's line and column positions provided. The only argument is an object
			* with the following properties:
			*
			*   - line: The line number in the generated source.  The line number
			*     is 1-based.
			*   - column: The column number in the generated source.  The column
			*     number is 0-based.
			*
			* and an object is returned with the following properties:
			*
			*   - source: The original source file, or null.
			*   - line: The line number in the original source, or null.  The
			*     line number is 1-based.
			*   - column: The column number in the original source, or null.  The
			*     column number is 0-based.
			*   - name: The original identifier, or null.
			*/
			originalPositionFor(aArgs) {
				const needle = {
					generatedLine: util.getArg(aArgs, "line"),
					generatedColumn: util.getArg(aArgs, "column")
				};
				const sectionIndex = binarySearch.search(needle, this._sections, function(aNeedle, section) {
					const cmp = aNeedle.generatedLine - section.generatedOffset.generatedLine;
					if (cmp) return cmp;
					return aNeedle.generatedColumn - (section.generatedOffset.generatedColumn - 1);
				});
				const section = this._sections[sectionIndex];
				if (!section) return {
					source: null,
					line: null,
					column: null,
					name: null
				};
				return section.consumer.originalPositionFor({
					line: needle.generatedLine - (section.generatedOffset.generatedLine - 1),
					column: needle.generatedColumn - (section.generatedOffset.generatedLine === needle.generatedLine ? section.generatedOffset.generatedColumn - 1 : 0),
					bias: aArgs.bias
				});
			}
			/**
			* Return true if we have the source content for every source in the source
			* map, false otherwise.
			*/
			hasContentsOfAllSources() {
				return this._sections.every(function(s) {
					return s.consumer.hasContentsOfAllSources();
				});
			}
			/**
			* Returns the original source content. The only argument is the url of the
			* original source file. Returns null if no original source content is
			* available.
			*/
			sourceContentFor(aSource, nullOnMissing) {
				for (let i = 0; i < this._sections.length; i++) {
					const content = this._sections[i].consumer.sourceContentFor(aSource, true);
					if (content) return content;
				}
				if (nullOnMissing) return null;
				throw new Error("\"" + aSource + "\" is not in the SourceMap.");
			}
			_findSectionIndex(source) {
				for (let i = 0; i < this._sections.length; i++) {
					const { consumer } = this._sections[i];
					if (consumer._findSourceIndex(source) !== -1) return i;
				}
				return -1;
			}
			/**
			* Returns the generated line and column information for the original source,
			* line, and column positions provided. The only argument is an object with
			* the following properties:
			*
			*   - source: The filename of the original source.
			*   - line: The line number in the original source.  The line number
			*     is 1-based.
			*   - column: The column number in the original source.  The column
			*     number is 0-based.
			*
			* and an object is returned with the following properties:
			*
			*   - line: The line number in the generated source, or null.  The
			*     line number is 1-based.
			*   - column: The column number in the generated source, or null.
			*     The column number is 0-based.
			*/
			generatedPositionFor(aArgs) {
				const index = this._findSectionIndex(util.getArg(aArgs, "source"));
				const section = index >= 0 ? this._sections[index] : null;
				const nextSection = index >= 0 && index + 1 < this._sections.length ? this._sections[index + 1] : null;
				const generatedPosition = section && section.consumer.generatedPositionFor(aArgs);
				if (generatedPosition && generatedPosition.line !== null) {
					const lineShift = section.generatedOffset.generatedLine - 1;
					const columnShift = section.generatedOffset.generatedColumn - 1;
					if (generatedPosition.line === 1) {
						generatedPosition.column += columnShift;
						if (typeof generatedPosition.lastColumn === "number") generatedPosition.lastColumn += columnShift;
					}
					if (generatedPosition.lastColumn === Infinity && nextSection && generatedPosition.line === nextSection.generatedOffset.generatedLine) generatedPosition.lastColumn = nextSection.generatedOffset.generatedColumn - 2;
					generatedPosition.line += lineShift;
					return generatedPosition;
				}
				return {
					line: null,
					column: null,
					lastColumn: null
				};
			}
			allGeneratedPositionsFor(aArgs) {
				const index = this._findSectionIndex(util.getArg(aArgs, "source"));
				const section = index >= 0 ? this._sections[index] : null;
				const nextSection = index >= 0 && index + 1 < this._sections.length ? this._sections[index + 1] : null;
				if (!section) return [];
				return section.consumer.allGeneratedPositionsFor(aArgs).map((generatedPosition) => {
					const lineShift = section.generatedOffset.generatedLine - 1;
					const columnShift = section.generatedOffset.generatedColumn - 1;
					if (generatedPosition.line === 1) {
						generatedPosition.column += columnShift;
						if (typeof generatedPosition.lastColumn === "number") generatedPosition.lastColumn += columnShift;
					}
					if (generatedPosition.lastColumn === Infinity && nextSection && generatedPosition.line === nextSection.generatedOffset.generatedLine) generatedPosition.lastColumn = nextSection.generatedOffset.generatedColumn - 2;
					generatedPosition.line += lineShift;
					return generatedPosition;
				});
			}
			eachMapping(aCallback, aContext, aOrder) {
				this._sections.forEach((section, index) => {
					const nextSection = index + 1 < this._sections.length ? this._sections[index + 1] : null;
					const { generatedOffset } = section;
					const lineShift = generatedOffset.generatedLine - 1;
					const columnShift = generatedOffset.generatedColumn - 1;
					section.consumer.eachMapping(function(mapping) {
						if (mapping.generatedLine === 1) {
							mapping.generatedColumn += columnShift;
							if (typeof mapping.lastGeneratedColumn === "number") mapping.lastGeneratedColumn += columnShift;
						}
						if (mapping.lastGeneratedColumn === Infinity && nextSection && mapping.generatedLine === nextSection.generatedOffset.generatedLine) mapping.lastGeneratedColumn = nextSection.generatedOffset.generatedColumn - 2;
						mapping.generatedLine += lineShift;
						aCallback.call(this, mapping);
					}, aContext, aOrder);
				});
			}
			computeColumnSpans() {
				for (let i = 0; i < this._sections.length; i++) this._sections[i].consumer.computeColumnSpans();
			}
			destroy() {
				for (let i = 0; i < this._sections.length; i++) this._sections[i].consumer.destroy();
			}
		};
		exports.IndexedSourceMapConsumer = IndexedSourceMapConsumer;
		function _factory(aSourceMap, aSourceMapURL) {
			let sourceMap = aSourceMap;
			if (typeof aSourceMap === "string") sourceMap = util.parseSourceMapInput(aSourceMap);
			const consumer = sourceMap.sections != null ? new IndexedSourceMapConsumer(sourceMap, aSourceMapURL) : new BasicSourceMapConsumer(sourceMap, aSourceMapURL);
			return Promise.resolve(consumer);
		}
		function _factoryBSM(aSourceMap, aSourceMapURL) {
			return BasicSourceMapConsumer.fromSourceMap(aSourceMap, aSourceMapURL);
		}
	}));
	//#endregion
	//#region node_modules/source-map/lib/source-node.js
	var require_source_node = /* @__PURE__ */ __commonJSMin(((exports) => {
		var SourceMapGenerator = require_source_map_generator().SourceMapGenerator;
		var util = require_util();
		var REGEX_NEWLINE = /(\r?\n)/;
		var NEWLINE_CODE = 10;
		var isSourceNode = "$$$isSourceNode$$$";
		exports.SourceNode = class SourceNode {
			constructor(aLine, aColumn, aSource, aChunks, aName) {
				this.children = [];
				this.sourceContents = Object.create(null);
				this.line = aLine == null ? null : aLine;
				this.column = aColumn == null ? null : aColumn;
				this.source = aSource == null ? null : aSource;
				this.name = aName == null ? null : aName;
				this[isSourceNode] = true;
				if (aChunks != null) this.add(aChunks);
			}
			/**
			* Creates a SourceNode from generated code and a SourceMapConsumer.
			*
			* @param aGeneratedCode The generated code
			* @param aSourceMapConsumer The SourceMap for the generated code
			* @param aRelativePath Optional. The path that relative sources in the
			*        SourceMapConsumer should be relative to.
			*/
			static fromStringWithSourceMap(aGeneratedCode, aSourceMapConsumer, aRelativePath) {
				const node = new SourceNode();
				const remainingLines = aGeneratedCode.split(REGEX_NEWLINE);
				let remainingLinesIndex = 0;
				const shiftNextLine = function() {
					return getNextLine() + (getNextLine() || "");
					function getNextLine() {
						return remainingLinesIndex < remainingLines.length ? remainingLines[remainingLinesIndex++] : void 0;
					}
				};
				let lastGeneratedLine = 1, lastGeneratedColumn = 0;
				let lastMapping = null;
				let nextLine;
				aSourceMapConsumer.eachMapping(function(mapping) {
					if (lastMapping !== null) if (lastGeneratedLine < mapping.generatedLine) {
						addMappingWithCode(lastMapping, shiftNextLine());
						lastGeneratedLine++;
						lastGeneratedColumn = 0;
					} else {
						nextLine = remainingLines[remainingLinesIndex] || "";
						const code = nextLine.substr(0, mapping.generatedColumn - lastGeneratedColumn);
						remainingLines[remainingLinesIndex] = nextLine.substr(mapping.generatedColumn - lastGeneratedColumn);
						lastGeneratedColumn = mapping.generatedColumn;
						addMappingWithCode(lastMapping, code);
						lastMapping = mapping;
						return;
					}
					while (lastGeneratedLine < mapping.generatedLine) {
						node.add(shiftNextLine());
						lastGeneratedLine++;
					}
					if (lastGeneratedColumn < mapping.generatedColumn) {
						nextLine = remainingLines[remainingLinesIndex] || "";
						node.add(nextLine.substr(0, mapping.generatedColumn));
						remainingLines[remainingLinesIndex] = nextLine.substr(mapping.generatedColumn);
						lastGeneratedColumn = mapping.generatedColumn;
					}
					lastMapping = mapping;
				}, this);
				if (remainingLinesIndex < remainingLines.length) {
					if (lastMapping) addMappingWithCode(lastMapping, shiftNextLine());
					node.add(remainingLines.splice(remainingLinesIndex).join(""));
				}
				aSourceMapConsumer.sources.forEach(function(sourceFile) {
					const content = aSourceMapConsumer.sourceContentFor(sourceFile);
					if (content != null) {
						if (aRelativePath != null) sourceFile = util.join(aRelativePath, sourceFile);
						node.setSourceContent(sourceFile, content);
					}
				});
				return node;
				function addMappingWithCode(mapping, code) {
					if (mapping === null || mapping.source === void 0) node.add(code);
					else {
						const source = aRelativePath ? util.join(aRelativePath, mapping.source) : mapping.source;
						node.add(new SourceNode(mapping.originalLine, mapping.originalColumn, source, code, mapping.name));
					}
				}
			}
			/**
			* Add a chunk of generated JS to this source node.
			*
			* @param aChunk A string snippet of generated JS code, another instance of
			*        SourceNode, or an array where each member is one of those things.
			*/
			add(aChunk) {
				if (Array.isArray(aChunk)) aChunk.forEach(function(chunk) {
					this.add(chunk);
				}, this);
				else if (aChunk[isSourceNode] || typeof aChunk === "string") {
					if (aChunk) this.children.push(aChunk);
				} else throw new TypeError("Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk);
				return this;
			}
			/**
			* Add a chunk of generated JS to the beginning of this source node.
			*
			* @param aChunk A string snippet of generated JS code, another instance of
			*        SourceNode, or an array where each member is one of those things.
			*/
			prepend(aChunk) {
				if (Array.isArray(aChunk)) for (let i = aChunk.length - 1; i >= 0; i--) this.prepend(aChunk[i]);
				else if (aChunk[isSourceNode] || typeof aChunk === "string") this.children.unshift(aChunk);
				else throw new TypeError("Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk);
				return this;
			}
			/**
			* Walk over the tree of JS snippets in this node and its children. The
			* walking function is called once for each snippet of JS and is passed that
			* snippet and the its original associated source's line/column location.
			*
			* @param aFn The traversal function.
			*/
			walk(aFn) {
				let chunk;
				for (let i = 0, len = this.children.length; i < len; i++) {
					chunk = this.children[i];
					if (chunk[isSourceNode]) chunk.walk(aFn);
					else if (chunk !== "") aFn(chunk, {
						source: this.source,
						line: this.line,
						column: this.column,
						name: this.name
					});
				}
			}
			/**
			* Like `String.prototype.join` except for SourceNodes. Inserts `aStr` between
			* each of `this.children`.
			*
			* @param aSep The separator.
			*/
			join(aSep) {
				let newChildren;
				let i;
				const len = this.children.length;
				if (len > 0) {
					newChildren = [];
					for (i = 0; i < len - 1; i++) {
						newChildren.push(this.children[i]);
						newChildren.push(aSep);
					}
					newChildren.push(this.children[i]);
					this.children = newChildren;
				}
				return this;
			}
			/**
			* Call String.prototype.replace on the very right-most source snippet. Useful
			* for trimming whitespace from the end of a source node, etc.
			*
			* @param aPattern The pattern to replace.
			* @param aReplacement The thing to replace the pattern with.
			*/
			replaceRight(aPattern, aReplacement) {
				const lastChild = this.children[this.children.length - 1];
				if (lastChild[isSourceNode]) lastChild.replaceRight(aPattern, aReplacement);
				else if (typeof lastChild === "string") this.children[this.children.length - 1] = lastChild.replace(aPattern, aReplacement);
				else this.children.push("".replace(aPattern, aReplacement));
				return this;
			}
			/**
			* Set the source content for a source file. This will be added to the SourceMapGenerator
			* in the sourcesContent field.
			*
			* @param aSourceFile The filename of the source file
			* @param aSourceContent The content of the source file
			*/
			setSourceContent(aSourceFile, aSourceContent) {
				this.sourceContents[util.toSetString(aSourceFile)] = aSourceContent;
			}
			/**
			* Walk over the tree of SourceNodes. The walking function is called for each
			* source file content and is passed the filename and source content.
			*
			* @param aFn The traversal function.
			*/
			walkSourceContents(aFn) {
				for (let i = 0, len = this.children.length; i < len; i++) if (this.children[i][isSourceNode]) this.children[i].walkSourceContents(aFn);
				const sources = Object.keys(this.sourceContents);
				for (let i = 0, len = sources.length; i < len; i++) aFn(util.fromSetString(sources[i]), this.sourceContents[sources[i]]);
			}
			/**
			* Return the string representation of this source node. Walks over the tree
			* and concatenates all the various snippets together to one string.
			*/
			toString() {
				let str = "";
				this.walk(function(chunk) {
					str += chunk;
				});
				return str;
			}
			/**
			* Returns the string representation of this source node along with a source
			* map.
			*/
			toStringWithSourceMap(aArgs) {
				const generated = {
					code: "",
					line: 1,
					column: 0
				};
				const map = new SourceMapGenerator(aArgs);
				let sourceMappingActive = false;
				let lastOriginalSource = null;
				let lastOriginalLine = null;
				let lastOriginalColumn = null;
				let lastOriginalName = null;
				this.walk(function(chunk, original) {
					generated.code += chunk;
					if (original.source !== null && original.line !== null && original.column !== null) {
						if (lastOriginalSource !== original.source || lastOriginalLine !== original.line || lastOriginalColumn !== original.column || lastOriginalName !== original.name) map.addMapping({
							source: original.source,
							original: {
								line: original.line,
								column: original.column
							},
							generated: {
								line: generated.line,
								column: generated.column
							},
							name: original.name
						});
						lastOriginalSource = original.source;
						lastOriginalLine = original.line;
						lastOriginalColumn = original.column;
						lastOriginalName = original.name;
						sourceMappingActive = true;
					} else if (sourceMappingActive) {
						map.addMapping({ generated: {
							line: generated.line,
							column: generated.column
						} });
						lastOriginalSource = null;
						sourceMappingActive = false;
					}
					for (let idx = 0, length = chunk.length; idx < length; idx++) if (chunk.charCodeAt(idx) === NEWLINE_CODE) {
						generated.line++;
						generated.column = 0;
						if (idx + 1 === length) {
							lastOriginalSource = null;
							sourceMappingActive = false;
						} else if (sourceMappingActive) map.addMapping({
							source: original.source,
							original: {
								line: original.line,
								column: original.column
							},
							generated: {
								line: generated.line,
								column: generated.column
							},
							name: original.name
						});
					} else generated.column++;
				});
				this.walkSourceContents(function(sourceFile, sourceContent) {
					map.setSourceContent(sourceFile, sourceContent);
				});
				return {
					code: generated.code,
					map
				};
			}
		};
	}));
	//#endregion
	//#region src/extension/services/SourceService.ts
	var import_source_map = (/* @__PURE__ */ __commonJSMin(((exports) => {
		exports.SourceMapGenerator = require_source_map_generator().SourceMapGenerator;
		exports.SourceMapConsumer = require_source_map_consumer().SourceMapConsumer;
		exports.SourceNode = require_source_node().SourceNode;
	})))();
	var SourceService = class SourceService {
		static CHROME_METHOD_STACK_LINE = /^\s*at (?<method>.*) \(chrome-extension:\/\/.*\/content-scripts\/extension\.js:(?<line>\d+):(?<column>\d+)\)$/;
		static CHROME_STACK_LINE = /^\s*at chrome-extension:\/\/.*\/content-scripts\/extension\.js:(?<line>\d+):(?<column>\d+)$/;
		static FIREFOX_METHOD_STACK_LINE = /^(?<method>.+)@moz-extension:\/\/.*\/content-scripts\/extension\.js:(?<line>\d+):(?<column>\d+)$/;
		static FIREFOX_STACK_LINE = /^@moz-extension:\/\/.*\/content-scripts\/extension\.js:(?<line>\d+):(?<column>\d+)$/;
		sourceMapConsumer = null;
		constructor() {
			this.initializeSourceMap().catch((err) => console.error(err));
		}
		async initializeSourceMap() {
			import_source_map.SourceMapConsumer.initialize({ "lib/mappings.wasm": "https://unpkg.com/source-map@0.8.0/lib/mappings.wasm" });
			const name = browser.runtime.getURL("/content-scripts/extension.js.map");
			const content = await fetch(name).then((res) => res.json());
			this.sourceMapConsumer = await new import_source_map.SourceMapConsumer(content);
		}
		mappedStack(stack) {
			if (!stack) return "";
			if (!this.sourceMapConsumer) return stack;
			return stack.split("\n").map((stackLine) => {
				const generatedFrame = SourceService.parseGeneratedSourceStackFrame(stackLine);
				if (!generatedFrame) return stackLine;
				const location = this.fromSource(generatedFrame.line, generatedFrame.column);
				if (!location) return stackLine;
				return SourceService.formatMappedStackFrame(generatedFrame, location);
			}).join("\n");
		}
		fromSource(line, column) {
			if (!this.sourceMapConsumer) return null;
			const position = this.sourceMapConsumer.originalPositionFor({
				line,
				column
			});
			return SourceService.convertSourceLocation(position);
		}
		static parseGeneratedSourceStackFrame(stackLine) {
			const chromeMethodFrame = stackLine.match(SourceService.CHROME_METHOD_STACK_LINE);
			if (chromeMethodFrame) return SourceService.convertStackFrameGroups(chromeMethodFrame.groups);
			const chromeFrame = stackLine.match(SourceService.CHROME_STACK_LINE);
			if (chromeFrame) return SourceService.convertStackFrameGroups(chromeFrame.groups);
			const firefoxMethodFrame = stackLine.match(SourceService.FIREFOX_METHOD_STACK_LINE);
			if (firefoxMethodFrame) return SourceService.convertStackFrameGroups(firefoxMethodFrame.groups);
			const firefoxFrame = stackLine.match(SourceService.FIREFOX_STACK_LINE);
			if (firefoxFrame) return SourceService.convertStackFrameGroups(firefoxFrame.groups);
			return null;
		}
		static convertStackFrameGroups(groups) {
			if (!groups.line || !groups.column) return null;
			return {
				method: groups.method ?? null,
				line: parseInt(groups.line, 10),
				column: parseInt(groups.column, 10)
			};
		}
		static formatMappedStackFrame(frame, location) {
			const mappedLocation = `${location.path}:${location.line}:${location.column}`;
			if (frame.method) return `    at ${frame.method} (${mappedLocation})`;
			return `    at ${mappedLocation}`;
		}
		static convertSourceLocation(raw) {
			if (raw.source === null || raw.line === null || raw.column === null) return null;
			const splitPath = raw.source.split("/");
			const cleanedPath = `/${splitPath.filter((p) => p !== "..").join("/")}`;
			return {
				rawPath: raw.source,
				path: cleanedPath,
				file: splitPath[splitPath.length - 1],
				line: raw.line,
				column: raw.column
			};
		}
	};
	//#endregion
	//#region src/extension/services/BackgroundService.ts
	var BackgroundService = class {
		async initialize() {
			await timedUpdates();
			return { success: true };
		}
		playNotificationSound(s, volume, allowDefault) {
			const sound = getNotificationSound(s, allowDefault ?? true);
			if (sound) {
				notificationTestPlayer.volume = volume / 100;
				notificationTestPlayer.src = sound;
				notificationTestPlayer.play();
			}
		}
		stopNotificationSound() {
			notificationTestPlayer.pause();
		}
		notification(title, message, url) {
			return new Promise((resolve) => {
				dispatchNotification({
					title,
					message,
					url,
					type: "unknown",
					key: Date.now(),
					date: Date.now()
				}).then(() => resolve({ success: true })).catch((error) => resolve({
					success: false,
					error
				}));
			});
		}
		fetchRelay(location, options = {}) {
			return fetchData(location, options);
		}
		async forceUpdate(update) {
			let updateFunction;
			if (update === "torndata") updateFunction = updateTorndata;
			else if (update === "stocks") updateFunction = updateStocks;
			else if (update === "factiondata") updateFunction = updateFactiondata;
			else if (update === "userdata") updateFunction = updateUserdata;
			else return {
				success: false,
				message: "Unknown update type."
			};
			await updateFunction(true);
			return { success: true };
		}
		async reinitializeTimers() {
			await resetAlarms();
			return browser.alarms.getAll();
		}
		async clearCache() {
			await ttCache.clear();
			return { success: true };
		}
	};
	//#endregion
	//#region src/extension/entrypoints/background/index.ts
	var iconBarListenerRegistered = false;
	function onInitialisation() {
		registerExtensionContext();
		browser.alarms.getAll().then((currentAlarms) => {
			if (currentAlarms.length === Object.keys(ALARM_NAMES).length) return;
			resetAlarms();
		});
	}
	function registerShowIconBarsListener() {
		if (iconBarListenerRegistered) return;
		iconBarListenerRegistered = true;
		storageListeners.settings.push(showIconBars);
	}
	async function onInstall() {
		await migrateDatabase(true);
		initializeDatabase();
		checkUpdate();
		initializeBackoff();
		resetAlarms();
		clearCache();
		await timedUpdates();
		showIconBars();
		registerShowIconBarsListener();
	}
	async function checkUpdate() {
		const oldVersion = version.oldVersion;
		const newVersion = browser.runtime.getManifest().version;
		const change = { version: { oldVersion: newVersion } };
		if (oldVersion !== newVersion) {
			console.log("New version detected!", newVersion);
			change.version.showNotice = true;
		}
		await ttStorage.change(change);
	}
	async function onStartup() {
		await migrateDatabase(false);
		initializeDatabase();
		checkUpdate();
		initializeBackoff();
		clearCache();
		await timedUpdates();
		showIconBars();
		registerShowIconBarsListener();
	}
	var ALARM_NAMES = {
		CLEAR_CACHE: "clear-cache-alarm",
		DATA_UPDATE: "data-update-alarm",
		CLEANUP_NOTIFICATIONS: "CLEANUP_NOTIFICATIONS-ALARM"
	};
	async function onAlarm(alarm) {
		await loadDatabase();
		switch (alarm.name) {
			case ALARM_NAMES.CLEAR_CACHE:
				clearCache();
				break;
			case ALARM_NAMES.CLEANUP_NOTIFICATIONS:
				await cleanupNotifications();
				break;
			case ALARM_NAMES.DATA_UPDATE:
				await timedUpdates();
				break;
			default: console.warn(`TT - Unknown alarm: ${alarm.name}`);
		}
	}
	function clearCache() {
		ttCache.refresh().catch((error) => console.error("Error while clearing cache.", error));
	}
	async function resetAlarms() {
		await browser.alarms.clearAll();
		browser.alarms.create(ALARM_NAMES.CLEAR_CACHE, { periodInMinutes: 60 });
		browser.alarms.create(ALARM_NAMES.DATA_UPDATE, { periodInMinutes: .5 });
		browser.alarms.create(ALARM_NAMES.CLEANUP_NOTIFICATIONS, { periodInMinutes: 60 });
	}
	function onNotificationClicked(id) {
		const relation = ttCache.get("notification-relations", id);
		if (!relation?.link) return;
		browser.tabs.create({ url: relation.link });
	}
	var background_default = defineBackground(() => {
		onInitialisation();
		browser.runtime.onInstalled.addListener(onInstall);
		browser.runtime.onStartup.addListener(onStartup);
		browser.alarms.onAlarm.addListener(onAlarm);
		browser.notifications.onClicked.addListener(onNotificationClicked);
		const backgroundService = new BackgroundService();
		registerService(BACKGROUND_SERVICE_KEY, backgroundService);
		registerService(SOURCE_SERVICE_KEY, new SourceService());
		if ("connection" in navigator) navigator.connection.addEventListener("change", async () => {
			if (navigator.onLine) await timedUpdates();
		});
		else if (typeof window !== "undefined") window.addEventListener("online", timedUpdates);
		else self.addEventListener("online", timedUpdates);
		exposeDebugObjects(backgroundService);
		console.log("Background script loaded");
	});
	//#endregion
	//#region \0virtual:wxt-background-entrypoint?/tmp/claude-0/-root/597a87b4-6cf4-448a-916a-cd272c67141a/scratchpad/tt-9.1.1/src/extension/entrypoints/background/index.ts
	/** Wrapper around `console` with a "[wxt]" prefix */
	var logger = {
		debug: (...args) => ([...args], void 0),
		log: (...args) => ([...args], void 0),
		warn: (...args) => ([...args], void 0),
		error: (...args) => ([...args], void 0)
	};
	var result;
	try {
		result = background_default.main();
		if (result instanceof Promise) console.warn("The background's main() function return a promise, but it must be synchronous");
	} catch (err) {
		logger.error("The background crashed on startup!");
		throw err;
	}
	//#endregion
	return result;
})();

//# sourceMappingURL=background.js.map