(function() {
	//#region node_modules/wxt/dist/utils/define-unlisted-script.mjs
	function defineUnlistedScript(arg) {
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
	//#endregion
	//#region src/common/utils/context.ts
	var ttStorage;
	var RUNTIME_INFORMATION;
	function setRuntimeInformation(runtimeInformation) {
		RUNTIME_INFORMATION = runtimeInformation;
	}
	//#endregion
	//#region src/common/utils/functions/context-interfaces.ts
	var DEFAULT_RUNTIME_INFORMATION = {
		getWindow: () => window,
		getVersion: () => "N/A",
		isUserscript: () => false
	};
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
	new TornToolsCache();
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
	new DefaultSetting("string", () => RUNTIME_INFORMATION.getVersion()), new DefaultSetting("string", () => RUNTIME_INFORMATION.getVersion()), new DefaultSetting("string"), new DefaultSetting("boolean", true), new DefaultSetting("string"), new DefaultSetting("boolean", true), new DefaultSetting("string"), new DefaultSetting("number"), new DefaultSetting("string"), new DefaultSetting("string"), new DefaultSetting("string"), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("string", "bottom-left"), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("string", "eu"), new DefaultSetting("string", "eu"), new DefaultSetting("string", ""), new DefaultSetting("string", "none"), new DefaultSetting("string", "default"), new DefaultSetting("string", ""), new DefaultSetting("boolean", false), new DefaultSetting("string", "default"), new DefaultSetting("number", 1), new DefaultSetting("boolean", true), new DefaultSetting("number", 100), new DefaultSetting("boolean", false), new DefaultSetting("boolean", () => typeof Notification !== "undefined" && Notification.permission === "granted"), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("array", ["100%"]), new DefaultSetting("array", ["100%"]), new DefaultSetting("array", ["100%"]), new DefaultSetting("array", ["100%"]), new DefaultSetting("array", []), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("object", {}), new DefaultSetting("boolean", false), new DefaultSetting("string", ""), new DefaultSetting("boolean", false), new DefaultSetting("array", []), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("boolean", true), new DefaultSetting("string", ""), new DefaultSetting("boolean", true), new DefaultSetting("string", ""), new DefaultSetting("string", "TornTools"), new DefaultSetting("number", 30), new DefaultSetting("number", 120), new DefaultSetting("number", 3600), new DefaultSetting("number", 30), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("string", "default"), new DefaultSetting("string", "default"), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("string", ";"), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("string", ""), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("number", 12), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("array", [{
		name: "$player",
		color: "#7ca900"
	}]), new DefaultSetting("array", []), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("number", 0), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("string", "tornstats"), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("string", "dashboard"), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("string", "none"), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("number", 18), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("string", "day"), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("number|empty", ""), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("number", 1500), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("number", 100), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("number", 1), new DefaultSetting("boolean", true), new DefaultSetting("number", 2), new DefaultSetting("boolean", true), new DefaultSetting("number", 1), new DefaultSetting("boolean", true), new DefaultSetting("number", 2), new DefaultSetting("boolean", true), new DefaultSetting("number", 1), new DefaultSetting("boolean", true), new DefaultSetting("number", 1), new DefaultSetting("boolean", true), new DefaultSetting("number", 2), new DefaultSetting("boolean", true), new DefaultSetting("number", 0), new DefaultSetting("number", 100), new DefaultSetting("number", 0), new DefaultSetting("number", 100), new DefaultSetting("string", ""), new DefaultSetting("array", []), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("string", "All"), new DefaultSetting("number", 0), new DefaultSetting("number", 100), new DefaultSetting("number", 1), new DefaultSetting("number", 100), new DefaultSetting("number", 0), new DefaultSetting("number", 5e3), new DefaultSetting("number", -1), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("number", 0), new DefaultSetting("number", 48), new DefaultSetting("number", 2), new DefaultSetting("number", 100), new DefaultSetting("number", 1), new DefaultSetting("number", 100), new DefaultSetting("array", []), new DefaultSetting("string", ""), new DefaultSetting("array", []), new DefaultSetting("object", {}), new DefaultSetting("boolean", false), new DefaultSetting("string", "basic"), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("number", 0), new DefaultSetting("number", 100), new DefaultSetting("string", ""), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("array", []), new DefaultSetting("number", null), new DefaultSetting("number", null), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("boolean", false), new DefaultSetting("string", "none"), new DefaultSetting("string", "none"), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("number", 100), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("number", 0), new DefaultSetting("number", 100), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("array", []), new DefaultSetting("number", null), new DefaultSetting("number", null), new DefaultSetting("boolean", true), new DefaultSetting("string", ""), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("number", 1), new DefaultSetting("number", 100), new DefaultSetting("number", 0), new DefaultSetting("number", -1), new DefaultSetting("array", []), new DefaultSetting("string", ""), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("number", null), new DefaultSetting("number", null), new DefaultSetting("array", []), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("array", []), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("number", 1), new DefaultSetting("number", 100), new DefaultSetting("array", []), new DefaultSetting("number", null), new DefaultSetting("number", null), new DefaultSetting("boolean", false), new DefaultSetting("array", []), new DefaultSetting("number", 1), new DefaultSetting("number", 100), new DefaultSetting("array", []), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("array", []), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("number", 0), new DefaultSetting("number", 100), new DefaultSetting("array", []), new DefaultSetting("number", null), new DefaultSetting("number", null), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("number", 0), new DefaultSetting("number", 100), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("number", 0), new DefaultSetting("number", 100), new DefaultSetting("array", []), new DefaultSetting("number", null), new DefaultSetting("number", null), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("object", { date: -1 }), new DefaultSetting("object", { date: -2 }), new DefaultSetting("number", 0), new DefaultSetting("array", []), new DefaultSetting("object", {}), new DefaultSetting("number", 0), new DefaultSetting("array", []), new DefaultSetting("boolean", false), new DefaultSetting("string", ""), new DefaultSetting("number", 0), new DefaultSetting("number", 0), new DefaultSetting("number", 0), new DefaultSetting("number", 0), new DefaultSetting("number", 0), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("array", []), new DefaultSetting("boolean", false), new DefaultSetting("object", {
		list: [],
		date: 0
	}), new DefaultSetting("object", {
		list: [],
		date: 0
	}), new DefaultSetting("boolean", true), new DefaultSetting("number", 0), new DefaultSetting("object", {}), new DefaultSetting("string", ""), new DefaultSetting("string", "22px"), new DefaultSetting("object", {}), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("array", []), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("array", []);
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
	(() => {
		if (typeof window === "undefined" || window.location.href.endsWith("/_generated_background_page.html")) return "BACKGROUND";
		else if (typeof browser === "object" && browser.action) return "POPUP";
		else if (typeof location !== "undefined" && location.protocol?.includes("extension")) return "INTERNAL_CONTENT";
		else return "CONTENT";
	})();
	function isIntNumber(number) {
		if (number === null) return false;
		if (number.match(/[a-zA-Z]/)) return false;
		const _number = parseFloat(number.toString());
		return !Number.isNaN(_number) && Number.isFinite(_number) && _number % 1 === 0;
	}
	//#endregion
	//#region src/common/utils/functions/formatting.ts
	function capitalizeText(text, partialOptions = {}) {
		if (!{
			everyWord: false,
			...partialOptions
		}.everyWord) return text[0].toUpperCase() + text.slice(1);
		return text.trim().split(" ").map((word) => capitalizeText(word)).join(" ").trim();
	}
	//#endregion
	//#region src/common/utils/functions/script-injector.ts
	var RequestListenerInjector = class {
		injectListeners;
		id;
		constructor(injectListeners) {
			this.injectListeners = injectListeners;
			this.id = capitalizeText(injectListeners.name);
		}
		inject() {
			if (this.isInjected()) return;
			this.injectListeners();
			this.setInjected();
		}
		isInjected() {
			return document.documentElement.dataset[`tt${this.id}`] === "true";
		}
		setInjected() {
			document.documentElement.dataset[`tt${this.id}`] = "true";
		}
	};
	function injectFetchListeners() {
		const oldFetch = RUNTIME_INFORMATION.getWindow().fetch;
		RUNTIME_INFORMATION.getWindow().fetch = (input, init) => new Promise((resolve, reject) => {
			oldFetch(input, init).then(async (response) => {
/* warboard: pass Cloudflare/non-Torn responses straight through — clone()+read stalls the CF challenge in WKWebView. */ const __wbu=(response&&response.url)||(typeof input==="string"?input:(input&&input.url))||""; if(typeof __wbu!=="string"||__wbu.indexOf("torn.com/")===-1||__wbu.indexOf("/cdn-cgi/")!==-1){resolve(response);return;}
				const page = response.url.substring(response.url.indexOf("torn.com/") + 9, response.url.indexOf(".php"));
				let json = {};
				try {
					json = await response.clone().json();
				} catch {}
				let body = null;
				if (init) {
					if (typeof init.body === "object" && init.body?.constructor?.name === "FormData") {
						const newBody = {};
						for (const [key, value] of [...init.body]) if (isIntNumber(value)) newBody[key] = parseFloat(value);
						else newBody[key] = value;
						body = newBody;
					}
				}
				const url = response.url || input;
				const detail = {
					page,
					json,
					text: await response.clone().text(),
					fetch: {
						url,
						body,
						status: response.status
					}
				};
				window.dispatchEvent(new CustomEvent("tt-fetch", { detail }));
				resolve(response);
			}).catch((error) => {
				reject(error);
			});
		});
	}
	//#endregion
	//#region src/extension/entrypoints/fetch--inject.ts
	var fetch__inject_default = defineUnlistedScript(() => {
		setRuntimeInformation(DEFAULT_RUNTIME_INFORMATION);
		new RequestListenerInjector(injectFetchListeners).inject();
		console.log("Script Injected - Fetch Interception");
	});
	//#endregion
	//#region \0virtual:wxt-unlisted-script-entrypoint?/tmp/claude-0/-root/597a87b4-6cf4-448a-916a-cd272c67141a/scratchpad/tt-9.1.1/src/extension/entrypoints/fetch--inject.ts
	/** Wrapper around `console` with a "[wxt]" prefix */
	var logger = {
		debug: (...args) => ([...args], void 0),
		log: (...args) => ([...args], void 0),
		warn: (...args) => ([...args], void 0),
		error: (...args) => ([...args], void 0)
	};
	//#endregion
	return (() => {
		let result;
		try {
			result = fetch__inject_default.main();
			if (result instanceof Promise) result = result.catch((err) => {
				logger.error(`The unlisted script "fetch--inject" crashed on startup!`, err);
				throw err;
			});
		} catch (err) {
			logger.error(`The unlisted script "fetch--inject" crashed on startup!`, err);
			throw err;
		}
		return result;
	})();
})();

//# sourceMappingURL=fetch--inject.js.map