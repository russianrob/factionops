(function() {
	//#region node_modules/wxt/dist/utils/define-content-script.mjs
	function defineContentScript(definition) {
		return definition;
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
	var EVENT_HANDLER;
	function setTTStorage(storage) {
		ttStorage = storage;
	}
	function setRuntimeInformation(runtimeInformation) {
		RUNTIME_INFORMATION = runtimeInformation;
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
	function executeScript(filename, remove = true, unique = false) {
		const script = elementBuilder({
			type: "script",
			attributes: {
				type: "text/javascript",
				src: filename
			}
		});
		requireCondition(() => !!document.head).then(() => {
			if (unique && document.head.querySelector(`:scope > script[src='${filename}']`)) return;
			document.head.appendChild(script);
			if (remove) setTimeout(() => script.remove(), 2e3);
		});
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
	var TO_MILLIS = {
		SECONDS: 1e3,
		MINUTES: 1e3 * 60,
		HOURS: 1e3 * 60 * 60,
		DAYS: 1e3 * 60 * 60 * 24
	};
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
	function isTabFocused() {
		return document.hasFocus();
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
	//#endregion
	//#region src/common/features/api-demo/api-demo.ts
	function loadAPIDemo() {
		if (!settings.pages.api.autoDemo) return;
		document.getElementById("documentation").style.setProperty("display", "none");
		document.getElementById("demo").style.removeProperty("display");
	}
	//#endregion
	//#region src/common/features/api-selections/api-selections.ts
	async function loadAPISelections() {
		if (!settings.pages.api.clickableSelections) return;
		document.body.classList.add("tt-api-selections-clickable");
		await requireElement("p[class*='_fields']");
		findAllElements("p[class*='_fields']").forEach((fields) => {
			fields.addEventListener("click", (event) => {
				const s = window.getSelection();
				if (!s) return;
				const range = s.getRangeAt(0);
				const node = s.anchorNode;
				if (!node) return;
				while (range.startOffset !== 0 && range.toString().indexOf(",") !== 0 && range.toString().indexOf(":") === -1) range.setStart(node, range.startOffset - 1);
				if (range.startOffset !== 0) range.setStart(node, range.startOffset + 1);
				do
					range.setEnd(node, range.endOffset + 1);
				while (range.endOffset < node.textContent.length && range.toString().indexOf(",") === -1 && range.toString().trim() !== "");
				const selection = range.toString().replaceAll(",", "").trim();
				const panel = event.target.closest("div.panel-group");
				const selectionsInput = panel.querySelector("input[id*=selections]");
				if (event.ctrlKey) {
					if (selectionsInput.value.trim() === "") selectionsInput.value = selection;
					else if (!selectionsInput.value.includes(selection)) selectionsInput.value += `,${selection}`;
				} else {
					selectionsInput.value = selection;
					panel.querySelector("button")?.click();
				}
			});
		});
	}
	//#endregion
	//#region src/common/utils/functions/api.ts
	function hasAPIData() {
		const hasKey = !!api?.torn?.key;
		const hasError = !!api?.torn?.error && !api.torn.error.includes("Backend error") && api.torn.error !== "Network issues";
		const hasUserdata = !!(userdata && Object.keys(userdata).length);
		return hasKey && !hasError && hasUserdata;
	}
	//#endregion
	//#region src/common/features/auto-api-fill/auto-api-fill.ts
	function loadAutoAPIFill() {
		if (!hasAPIData()) return;
		if (!settings.pages.api.autoFillKey) return;
		const input = document.querySelector("#api_key");
		if (!input || input.value) return;
		input.value = api.torn.key;
		executeScript(browser.runtime.getURL("/api-key-focus--inject.js"));
	}
	//#endregion
	//#region src/common/features/auto-pretty/auto-pretty.ts
	function loadAPIPretty() {
		if (!settings.pages.api.autoPretty) return;
		findAllElements("input[value=pretty]").forEach((p) => p.checked = true);
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
	//#endregion
	//#region src/extension/services/proxy-service-keys.ts
	var SOURCE_SERVICE_KEY = "source-service";
	var BACKGROUND_SERVICE_KEY = "background-service";
	//#endregion
	//#region src/extension/services/proxy-services.ts
	var SOURCE_SERVICE = createProxyService(SOURCE_SERVICE_KEY);
	createProxyService(BACKGROUND_SERVICE_KEY);
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
	//#endregion
	//#region src/extension/entrypoints/api-features.content.ts
	var api_features_content_default = defineContentScript({
		matches: ["https://*.torn.com/api.html*"],
		runAt: "document_end",
		async main() {
			registerExtensionContext();
			await loadDatabase();
			loadAPISelections().catch((err) => console.error(err));
			loadAutoAPIFill();
			loadAPIDemo();
			loadAPIPretty();
		}
	});
	//#endregion
	//#region node_modules/wxt/dist/utils/internal/logger.mjs
	/** Wrapper around `console` with a "[wxt]" prefix */
	var logger$1 = {
		debug: (...args) => ([...args], void 0),
		log: (...args) => ([...args], void 0),
		warn: (...args) => ([...args], void 0),
		error: (...args) => ([...args], void 0)
	};
	//#endregion
	//#region node_modules/wxt/dist/utils/internal/custom-events.mjs
	var WxtLocationChangeEvent = class WxtLocationChangeEvent extends Event {
		static EVENT_NAME = getUniqueEventName("wxt:locationchange");
		constructor(newUrl, oldUrl) {
			super(WxtLocationChangeEvent.EVENT_NAME, {});
			this.newUrl = newUrl;
			this.oldUrl = oldUrl;
		}
	};
	/**
	* Returns an event name unique to the extension and content script that's
	* running.
	*/
	function getUniqueEventName(eventName) {
		return `${browser?.runtime?.id}:api-features:${eventName}`;
	}
	//#endregion
	//#region node_modules/wxt/dist/utils/internal/location-watcher.mjs
	var supportsNavigationApi = typeof globalThis.navigation?.addEventListener === "function";
	/**
	* Create a util that watches for URL changes, dispatching the custom event when
	* detected. Stops watching when content script is invalidated. Uses Navigation
	* API when available, otherwise falls back to polling.
	*/
	function createLocationWatcher(ctx) {
		let lastUrl;
		let watching = false;
		return { run() {
			if (watching) return;
			watching = true;
			lastUrl = new URL(location.href);
			if (supportsNavigationApi) globalThis.navigation.addEventListener("navigate", (event) => {
				const newUrl = new URL(event.destination.url);
				if (newUrl.href === lastUrl.href) return;
				window.dispatchEvent(new WxtLocationChangeEvent(newUrl, lastUrl));
				lastUrl = newUrl;
			}, { signal: ctx.signal });
			else ctx.setInterval(() => {
				const newUrl = new URL(location.href);
				if (newUrl.href !== lastUrl.href) {
					window.dispatchEvent(new WxtLocationChangeEvent(newUrl, lastUrl));
					lastUrl = newUrl;
				}
			}, 1e3);
		} };
	}
	//#endregion
	//#region node_modules/wxt/dist/utils/content-script-context.mjs
	/**
	* Implements
	* [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController).
	* Used to detect and stop content script code when the script is invalidated.
	*
	* It also provides several utilities like `ctx.setTimeout` and
	* `ctx.setInterval` that should be used in content scripts instead of
	* `window.setTimeout` or `window.setInterval`.
	*
	* To create context for testing, you can use the class's constructor:
	*
	* ```ts
	* import { ContentScriptContext } from 'wxt/utils/content-scripts-context';
	*
	* test('storage listener should be removed when context is invalidated', () => {
	*   const ctx = new ContentScriptContext('test');
	*   const item = storage.defineItem('local:count', { defaultValue: 0 });
	*   const watcher = vi.fn();
	*
	*   const unwatch = item.watch(watcher);
	*   ctx.onInvalidated(unwatch); // Listen for invalidate here
	*
	*   await item.setValue(1);
	*   expect(watcher).toBeCalledTimes(1);
	*   expect(watcher).toBeCalledWith(1, 0);
	*
	*   ctx.notifyInvalidated(); // Use this function to invalidate the context
	*   await item.setValue(2);
	*   expect(watcher).toBeCalledTimes(1);
	* });
	* ```
	*/
	var ContentScriptContext = class ContentScriptContext {
		static SCRIPT_STARTED_MESSAGE_TYPE = getUniqueEventName("wxt:content-script-started");
		id;
		abortController;
		locationWatcher = createLocationWatcher(this);
		constructor(contentScriptName, options) {
			this.contentScriptName = contentScriptName;
			this.options = options;
			this.id = Math.random().toString(36).slice(2);
			this.abortController = new AbortController();
			this.stopOldScripts();
			this.listenForNewerScripts();
		}
		get signal() {
			return this.abortController.signal;
		}
		abort(reason) {
			return this.abortController.abort(reason);
		}
		get isInvalid() {
			if (browser.runtime?.id == null) this.notifyInvalidated();
			return this.signal.aborted;
		}
		get isValid() {
			return !this.isInvalid;
		}
		/**
		* Add a listener that is called when the content script's context is
		* invalidated.
		*
		* @example
		*   browser.runtime.onMessage.addListener(cb);
		*   const removeInvalidatedListener = ctx.onInvalidated(() => {
		*     browser.runtime.onMessage.removeListener(cb);
		*   });
		*   // ...
		*   removeInvalidatedListener();
		*
		* @returns A function to remove the listener.
		*/
		onInvalidated(cb) {
			this.signal.addEventListener("abort", cb);
			return () => this.signal.removeEventListener("abort", cb);
		}
		/**
		* Return a promise that never resolves. Useful if you have an async function
		* that shouldn't run after the context is expired.
		*
		* @example
		*   const getValueFromStorage = async () => {
		*     if (ctx.isInvalid) return ctx.block();
		*
		*     // ...
		*   };
		*/
		block() {
			return new Promise(() => {});
		}
		/**
		* Wrapper around `window.setInterval` that automatically clears the interval
		* when invalidated.
		*
		* Intervals can be cleared by calling the normal `clearInterval` function.
		*/
		setInterval(handler, timeout) {
			const id = setInterval(() => {
				if (this.isValid) handler();
			}, timeout);
			this.onInvalidated(() => clearInterval(id));
			return id;
		}
		/**
		* Wrapper around `window.setTimeout` that automatically clears the interval
		* when invalidated.
		*
		* Timeouts can be cleared by calling the normal `setTimeout` function.
		*/
		setTimeout(handler, timeout) {
			const id = setTimeout(() => {
				if (this.isValid) handler();
			}, timeout);
			this.onInvalidated(() => clearTimeout(id));
			return id;
		}
		/**
		* Wrapper around `window.requestAnimationFrame` that automatically cancels
		* the request when invalidated.
		*
		* Callbacks can be canceled by calling the normal `cancelAnimationFrame`
		* function.
		*/
		requestAnimationFrame(callback) {
			const id = requestAnimationFrame((...args) => {
				if (this.isValid) callback(...args);
			});
			this.onInvalidated(() => cancelAnimationFrame(id));
			return id;
		}
		/**
		* Wrapper around `window.requestIdleCallback` that automatically cancels the
		* request when invalidated.
		*
		* Callbacks can be canceled by calling the normal `cancelIdleCallback`
		* function.
		*/
		requestIdleCallback(callback, options) {
			const id = requestIdleCallback((...args) => {
				if (!this.signal.aborted) callback(...args);
			}, options);
			this.onInvalidated(() => cancelIdleCallback(id));
			return id;
		}
		addEventListener(target, type, handler, options) {
			if (type === "wxt:locationchange") {
				if (this.isValid) this.locationWatcher.run();
			}
			target.addEventListener?.(type.startsWith("wxt:") ? getUniqueEventName(type) : type, handler, {
				...options,
				signal: this.signal
			});
		}
		/**
		* @internal
		* Abort the abort controller and execute all `onInvalidated` listeners.
		*/
		notifyInvalidated() {
			this.abort("Content script context invalidated");
			logger$1.debug(`Content script "${this.contentScriptName}" context invalidated`);
		}
		stopOldScripts() {
			document.dispatchEvent(new CustomEvent(ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE, { detail: {
				contentScriptName: this.contentScriptName,
				messageId: this.id
			} }));
			if (!this.options?.noScriptStartedPostMessage) window.postMessage({
				type: ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE,
				contentScriptName: this.contentScriptName,
				messageId: this.id
			}, "*");
		}
		verifyScriptStartedEvent(event) {
			const isSameContentScript = event.detail?.contentScriptName === this.contentScriptName;
			const isFromSelf = event.detail?.messageId === this.id;
			return isSameContentScript && !isFromSelf;
		}
		listenForNewerScripts() {
			const cb = (event) => {
				if (!(event instanceof CustomEvent) || !this.verifyScriptStartedEvent(event)) return;
				this.notifyInvalidated();
			};
			document.addEventListener(ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE, cb);
			this.onInvalidated(() => document.removeEventListener(ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE, cb));
		}
	};
	//#endregion
	//#region \0virtual:wxt-content-script-isolated-world-entrypoint?/tmp/claude-0/-root/597a87b4-6cf4-448a-916a-cd272c67141a/scratchpad/tt-9.1.1/src/extension/entrypoints/api-features.content.ts
	/** Wrapper around `console` with a "[wxt]" prefix */
	var logger = {
		debug: (...args) => ([...args], void 0),
		log: (...args) => ([...args], void 0),
		warn: (...args) => ([...args], void 0),
		error: (...args) => ([...args], void 0)
	};
	//#endregion
	return (async () => {
		try {
			const { main, ...options } = api_features_content_default;
			return await main(new ContentScriptContext("api-features", options));
		} catch (err) {
			logger.error(`The content script "api-features" crashed on startup!`, err);
			throw err;
		}
	})();
})();

//# sourceMappingURL=api-features.js.map