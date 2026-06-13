var fetchInject = (function() {
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
	var SCRIPT_INJECTOR;
	var RUNTIME_INFORMATION;
	function setScriptInjector(scriptInjector) {
		SCRIPT_INJECTOR = scriptInjector;
	}
	//#endregion
	//#region src/common/utils/data/cache.ts
	var TornToolsCache = class {
		_cache;
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
		async remove(section, key) {
			if (!key) {
				key = section;
				section = null;
			}
			if (section && !this.hasValue(section, key) || !section && !this.hasValue(key.toString())) return;
			if (section) delete this.cache[section][key];
			else delete this.cache[key];
			await ttStorage.set({ cache: this.cache });
		}
		hasValue(section, key) {
			return this.getCacheValue(section, key) !== null;
		}
		getCacheValue(section, key) {
			if (!key) {
				key = section;
				section = null;
			}
			let value = null;
			if (section) {
				if (section in this.cache && key in this.cache[section]) value = this.cache[section][key];
			} else if (key in this.cache) value = this.cache[key];
			if (value === null || !("value" in value)) return null;
			if ("indefinite" in value) return value;
			else return value.timeout > Date.now() ? value : null;
		}
		async set(object, ttl, section) {
			return this._set(object, ttl, section);
		}
		setIndefinite(object, section) {
			return this._set(object, null, section);
		}
		async _set(object, ttl, section) {
			const timeout = ttl === null ? null : Date.now() + ttl;
			if (section) {
				if (!(section in this.cache)) this.cache[section] = {};
				for (const [key, value] of Object.entries(object)) this.cache[section][key] = this.createCacheValue(value, timeout);
			} else for (const [key, value] of Object.entries(object)) this.cache[key] = this.createCacheValue(value, timeout);
			await ttStorage.set({ cache: this.cache });
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
				await ttStorage.set({ cache: this.cache });
			} else ttStorage.set({ cache: {} }).then(() => this.cache = {});
		}
		async refresh() {
			let hasChanged = false;
			const now = Date.now();
			refreshObject(this.cache);
			for (const section in this.cache) if (!Object.keys(this.cache[section]).length) delete this.cache[section];
			if (hasChanged) await ttStorage.set({ cache: this.cache });
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
	};
	new TornToolsCache();
	//#endregion
	//#region src/common/utils/data/default-database.ts
	var DefaultSetting = class {
		type;
		defaultValue;
		constructor(type, defaultValue) {
			this.type = type;
			this.defaultValue = defaultValue;
		}
	};
	new DefaultSetting("string", () => RUNTIME_INFORMATION.getVersion()), new DefaultSetting("string", () => RUNTIME_INFORMATION.getVersion()), new DefaultSetting("string"), new DefaultSetting("boolean", true), new DefaultSetting("string"), new DefaultSetting("boolean", true), new DefaultSetting("string"), new DefaultSetting("string"), new DefaultSetting("string"), new DefaultSetting("string"), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("string", "bottom-left"), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("string", "eu"), new DefaultSetting("string", "eu"), new DefaultSetting("string", ""), new DefaultSetting("string", "none"), new DefaultSetting("string", "default"), new DefaultSetting("string", ""), new DefaultSetting("boolean", false), new DefaultSetting("string", "default"), new DefaultSetting("number", 1), new DefaultSetting("boolean", true), new DefaultSetting("number", 100), new DefaultSetting("boolean", false), new DefaultSetting("boolean", () => typeof Notification !== "undefined" && Notification.permission === "granted"), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("array", ["100%"]), new DefaultSetting("array", ["100%"]), new DefaultSetting("array", ["100%"]), new DefaultSetting("array", ["100%"]), new DefaultSetting("array", []), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("object", {}), new DefaultSetting("boolean", false), new DefaultSetting("string", ""), new DefaultSetting("boolean", false), new DefaultSetting("array", []), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("boolean", true), new DefaultSetting("string", ""), new DefaultSetting("boolean", true), new DefaultSetting("string", ""), new DefaultSetting("string", "TornTools"), new DefaultSetting("number", 30), new DefaultSetting("number", 120), new DefaultSetting("number", 3600), new DefaultSetting("number", 30), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("string", "default"), new DefaultSetting("string", "default"), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("string", ";"), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("string", ""), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("number", 12), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("array", [{
		name: "$player",
		color: "#7ca900"
	}]), new DefaultSetting("array", []), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("number", 0), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("string", "tornstats"), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("string", "dashboard"), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("string", "none"), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("number", 18), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("number|empty", ""), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("number", 1500), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("number", 100), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("number", 0), new DefaultSetting("number", 100), new DefaultSetting("number", 0), new DefaultSetting("number", 100), new DefaultSetting("string", ""), new DefaultSetting("array", []), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("string", "All"), new DefaultSetting("number", 0), new DefaultSetting("number", 100), new DefaultSetting("number", 1), new DefaultSetting("number", 100), new DefaultSetting("number", 0), new DefaultSetting("number", 5e3), new DefaultSetting("number", -1), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("number", 0), new DefaultSetting("number", 48), new DefaultSetting("number", 2), new DefaultSetting("number", 100), new DefaultSetting("number", 1), new DefaultSetting("number", 100), new DefaultSetting("array", []), new DefaultSetting("string", ""), new DefaultSetting("object", {}), new DefaultSetting("boolean", false), new DefaultSetting("string", "basic"), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("number", 0), new DefaultSetting("number", 100), new DefaultSetting("string", ""), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("array", []), new DefaultSetting("number", null), new DefaultSetting("number", null), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("boolean", false), new DefaultSetting("string", "none"), new DefaultSetting("string", "none"), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("number", 100), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("number", 0), new DefaultSetting("number", 100), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("array", []), new DefaultSetting("number", null), new DefaultSetting("number", null), new DefaultSetting("boolean", true), new DefaultSetting("string", ""), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("number", 1), new DefaultSetting("number", 100), new DefaultSetting("number", 0), new DefaultSetting("number", -1), new DefaultSetting("array", []), new DefaultSetting("string", ""), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("string", "both"), new DefaultSetting("number", null), new DefaultSetting("number", null), new DefaultSetting("boolean", true), new DefaultSetting("boolean", false), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("array", []), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("number", 1), new DefaultSetting("number", 100), new DefaultSetting("array", []), new DefaultSetting("number", null), new DefaultSetting("number", null), new DefaultSetting("boolean", false), new DefaultSetting("array", []), new DefaultSetting("number", 1), new DefaultSetting("number", 100), new DefaultSetting("array", []), new DefaultSetting("boolean", false), new DefaultSetting("boolean", false), new DefaultSetting("boolean", true), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("array", []), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("string", ""), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("number", 0), new DefaultSetting("number", 100), new DefaultSetting("array", []), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("number", 0), new DefaultSetting("number", 100), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("number", 0), new DefaultSetting("number", 100), new DefaultSetting("array", []), new DefaultSetting("string", ""), new DefaultSetting("array", []), new DefaultSetting("boolean", true), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("object", { date: -1 }), new DefaultSetting("object", { date: -2 }), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("number", 0), new DefaultSetting("array", []), new DefaultSetting("boolean", false), new DefaultSetting("string", ""), new DefaultSetting("number", 0), new DefaultSetting("number", 0), new DefaultSetting("number", 0), new DefaultSetting("number", 0), new DefaultSetting("number", 0), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("array", []), new DefaultSetting("object", { list: [] }), new DefaultSetting("object", { list: [] }), new DefaultSetting("boolean", true), new DefaultSetting("number", 0), new DefaultSetting("object", {}), new DefaultSetting("string", ""), new DefaultSetting("string", "22px"), new DefaultSetting("object", {}), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("array", []), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("array", []), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("object", {}), new DefaultSetting("array", []);
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
	//#region node_modules/@phosphor-icons/core/assets/bold/arrow-bend-up-left-bold.svg
	var arrow_bend_up_left_bold_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M236,200a12,12,0,0,1-24,0,84.09,84.09,0,0,0-84-84H61l27.52,27.51a12,12,0,0,1-17,17l-48-48a12,12,0,0,1,0-17l48-48a12,12,0,0,1,17,17L61,92h67A108.12,108.12,0,0,1,236,200Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/bold/arrow-clockwise-bold.svg
	var arrow_clockwise_bold_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M244,56v48a12,12,0,0,1-12,12H184a12,12,0,1,1,0-24H201.1l-19-17.38c-.13-.12-.26-.24-.38-.37A76,76,0,1,0,127,204h1a75.53,75.53,0,0,0,52.15-20.72,12,12,0,0,1,16.49,17.45A99.45,99.45,0,0,1,128,228h-1.37A100,100,0,1,1,198.51,57.06L220,76.72V56a12,12,0,0,1,24,0Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/bold/arrow-down-bold.svg
	var arrow_down_bold_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M208.49,152.49l-72,72a12,12,0,0,1-17,0l-72-72a12,12,0,0,1,17-17L116,187V40a12,12,0,0,1,24,0V187l51.51-51.52a12,12,0,0,1,17,17Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/bold/arrow-up-bold.svg
	var arrow_up_bold_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M208.49,120.49a12,12,0,0,1-17,0L140,69V216a12,12,0,0,1-24,0V69L64.49,120.49a12,12,0,0,1-17-17l72-72a12,12,0,0,1,17,0l72,72A12,12,0,0,1,208.49,120.49Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/bold/check-bold.svg
	var check_bold_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/bold/check-circle-bold.svg
	var check_circle_bold_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M176.49,95.51a12,12,0,0,1,0,17l-56,56a12,12,0,0,1-17,0l-24-24a12,12,0,1,1,17-17L112,143l47.51-47.52A12,12,0,0,1,176.49,95.51ZM236,128A108,108,0,1,1,128,20,108.12,108.12,0,0,1,236,128Zm-24,0a84,84,0,1,0-84,84A84.09,84.09,0,0,0,212,128Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/bold/copy-bold.svg
	var copy_bold_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M216,28H88A12,12,0,0,0,76,40V76H40A12,12,0,0,0,28,88V216a12,12,0,0,0,12,12H168a12,12,0,0,0,12-12V180h36a12,12,0,0,0,12-12V40A12,12,0,0,0,216,28ZM156,204H52V100H156Zm48-48H180V88a12,12,0,0,0-12-12H100V52H204Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/bold/info-bold.svg
	var info_bold_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M108,84a16,16,0,1,1,16,16A16,16,0,0,1,108,84Zm128,44A108,108,0,1,1,128,20,108.12,108.12,0,0,1,236,128Zm-24,0a84,84,0,1,0-84,84A84.09,84.09,0,0,0,212,128Zm-72,36.68V132a20,20,0,0,0-20-20,12,12,0,0,0-4,23.32V168a20,20,0,0,0,20,20,12,12,0,0,0,4-23.32Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/bold/spinner-gap-bold.svg
	var spinner_gap_bold_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M140,32V64a12,12,0,0,1-24,0V32a12,12,0,0,1,24,0Zm84,84H192a12,12,0,0,0,0,24h32a12,12,0,0,0,0-24Zm-42.26,48.77a12,12,0,1,0-17,17l22.63,22.63a12,12,0,0,0,17-17ZM128,180a12,12,0,0,0-12,12v32a12,12,0,0,0,24,0V192A12,12,0,0,0,128,180ZM74.26,164.77,51.63,187.4a12,12,0,0,0,17,17l22.63-22.63a12,12,0,1,0-17-17ZM76,128a12,12,0,0,0-12-12H32a12,12,0,0,0,0,24H64A12,12,0,0,0,76,128ZM68.6,51.63a12,12,0,1,0-17,17L74.26,91.23a12,12,0,0,0,17-17Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/bold/warning-circle-bold.svg
	var warning_circle_bold_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M128,20A108,108,0,1,0,236,128,108.12,108.12,0,0,0,128,20Zm0,192a84,84,0,1,1,84-84A84.09,84.09,0,0,1,128,212Zm-12-80V80a12,12,0,0,1,24,0v52a12,12,0,0,1-24,0Zm28,40a16,16,0,1,1-16-16A16,16,0,0,1,144,172Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/bold/x-circle-bold.svg
	var x_circle_bold_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M168.49,104.49,145,128l23.52,23.51a12,12,0,0,1-17,17L128,145l-23.51,23.52a12,12,0,0,1-17-17L111,128,87.51,104.49a12,12,0,0,1,17-17L128,111l23.51-23.52a12,12,0,0,1,17,17ZM236,128A108,108,0,1,1,128,20,108.12,108.12,0,0,1,236,128Zm-24,0a84,84,0,1,0-84,84A84.09,84.09,0,0,0,212,128Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/fill/airplane-fill.svg
	var airplane_fill_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M240,136v32a8,8,0,0,1-8,8,7.61,7.61,0,0,1-1.57-.16L156,161v23.73l17.66,17.65A8,8,0,0,1,176,208v24a8,8,0,0,1-11,7.43l-37-14.81L91,239.43A8,8,0,0,1,80,232V208a8,8,0,0,1,2.34-5.66L100,184.69V161L25.57,175.84A7.61,7.61,0,0,1,24,176a8,8,0,0,1-8-8V136a8,8,0,0,1,4.42-7.16L100,89.06V44a28,28,0,0,1,56,0V89.06l79.58,39.78A8,8,0,0,1,240,136Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/fill/arrows-out-cardinal-fill.svg
	var arrows_out_cardinal_fill_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M96,136H64v24a8,8,0,0,1-13.66,5.66l-32-32a8,8,0,0,1,0-11.32l32-32A8,8,0,0,1,64,96v24H96a8,8,0,0,1,0,16Zm0-72h24V96a8,8,0,0,0,16,0V64h24a8,8,0,0,0,5.66-13.66l-32-32a8,8,0,0,0-11.32,0l-32,32A8,8,0,0,0,96,64Zm141.66,58.34-32-32A8,8,0,0,0,192,96v24H160a8,8,0,0,0,0,16h32v24a8,8,0,0,0,13.66,5.66l32-32A8,8,0,0,0,237.66,122.34ZM160,192H136V160a8,8,0,0,0-16,0v32H96a8,8,0,0,0-5.66,13.66l32,32a8,8,0,0,0,11.32,0l32-32A8,8,0,0,0,160,192Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/fill/bell-fill.svg
	var bell_fill_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/fill/bell-slash-fill.svg
	var bell_slash_fill_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M221.84,192v0a1.85,1.85,0,0,1-3,.28L83.27,43.19a4,4,0,0,1,.8-6A79.55,79.55,0,0,1,129.17,24C173,24.66,207.8,61.1,208,104.92c.14,34.88,8.31,61.54,13.82,71A15.89,15.89,0,0,1,221.84,192Zm-7.92,18.62a8,8,0,0,1-11.85,10.76L182.62,200H167.16a40,40,0,0,1-78.41,0H47.91a15.78,15.78,0,0,1-13.59-7.59,16.42,16.42,0,0,1-.09-16.68c5.55-9.73,13.7-36.64,13.7-71.73A79.42,79.42,0,0,1,58.79,63.85L42,45.38A8,8,0,1,1,53.84,34.62ZM150.59,200H105.32a24,24,0,0,0,45.27,0Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/fill/caret-down-fill.svg
	var caret_down_fill_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,48,88H208a8,8,0,0,1,5.66,13.66Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/fill/caret-right-fill.svg
	var caret_right_fill_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M181.66,133.66l-80,80A8,8,0,0,1,88,208V48a8,8,0,0,1,13.66-5.66l80,80A8,8,0,0,1,181.66,133.66Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/fill/caret-up-fill.svg
	var caret_up_fill_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M215.39,163.06A8,8,0,0,1,208,168H48a8,8,0,0,1-5.66-13.66l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,215.39,163.06Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/fill/funnel-fill.svg
	var funnel_fill_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M227.81,66.76l-.08.09L160,139.17v55.49A16,16,0,0,1,152.87,208l-32,21.34A16,16,0,0,1,96,216V139.17L28.27,66.85l-.08-.09A16,16,0,0,1,40,40H216a16,16,0,0,1,11.84,26.76Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/fill/funnel-x-fill.svg
	var funnel_x_fill_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M227.73,66.85,160,139.17v55.49A16,16,0,0,1,152.87,208l-32,21.34A16,16,0,0,1,96,216V139.17L28.27,66.85l-.08-.09A16,16,0,0,1,40,40H216a16,16,0,0,1,11.84,26.76ZM227.31,192l18.35-18.34a8,8,0,0,0-11.32-11.32L216,180.69l-18.34-18.35a8,8,0,0,0-11.32,11.32L204.69,192l-18.35,18.34a8,8,0,0,0,11.32,11.32L216,203.31l18.34,18.35a8,8,0,0,0,11.32-11.32Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/fill/gear-fill.svg
	var gear_fill_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M216,130.16q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.6,107.6,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.29,107.29,0,0,0-26.25-10.86,8,8,0,0,0-7.06,1.48L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.6,107.6,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/fill/info-fill.svg
	var info_fill_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm-4,48a12,12,0,1,1-12,12A12,12,0,0,1,124,72Zm12,112a16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40a8,8,0,0,1,0,16Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/fill/plus-fill.svg
	var plus_fill_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM184,136H136v48a8,8,0,0,1-16,0V136H72a8,8,0,0,1,0-16h48V72a8,8,0,0,1,16,0v48h48a8,8,0,0,1,0,16Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/fill/stethoscope-fill.svg
	var stethoscope_fill_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M240,160a32,32,0,1,0-39.93,31,8,8,0,0,0-.07,1,32,32,0,0,1-32,32H144a32,32,0,0,1-32-32V151.48c31.47-4,56-31.47,56-64.31V40a8,8,0,0,0-8-8H136a8,8,0,0,0,0,16h16V87.17c0,26.58-21.25,48.49-47.36,48.83A48,48,0,0,1,56,88V48H72a8,8,0,0,0,0-16H48a8,8,0,0,0-8,8V88a64,64,0,0,0,56,63.49V192a48.05,48.05,0,0,0,48,48h24a48.05,48.05,0,0,0,48-48,8,8,0,0,0-.07-1A32,32,0,0,0,240,160Zm-32,8a8,8,0,1,1,8-8A8,8,0,0,1,208,168Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/fill/table-fill.svg
	var table_fill_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48ZM40,112H80v32H40Zm56,0H216v32H96ZM40,160H80v32H40Zm176,32H96V160H216v32Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/regular/caret-down.svg
	var caret_down_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/regular/eye.svg
	var eye_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128C223.84,141.46,192.43,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/regular/eye-slash.svg
	var eye_slash_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M53.92,34.62A8,8,0,1,0,42.08,45.38L61.32,66.55C25,88.84,9.38,123.2,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208a127.11,127.11,0,0,0,52.07-10.83l22,24.21a8,8,0,1,0,11.84-10.76Zm47.33,75.84,41.67,45.85a32,32,0,0,1-41.67-45.85ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.16,133.16,0,0,1,25,128c4.69-8.79,19.66-33.39,47.35-49.38l18,19.75a48,48,0,0,0,63.66,70l14.73,16.2A112,112,0,0,1,128,192Zm6-95.43a8,8,0,0,1,3-15.72,48.16,48.16,0,0,1,38.77,42.64,8,8,0,0,1-7.22,8.71,6.39,6.39,0,0,1-.75,0,8,8,0,0,1-8-7.26A32.09,32.09,0,0,0,134,96.57Zm113.28,34.69c-.42.94-10.55,23.37-33.36,43.8a8,8,0,1,1-10.67-11.92A132.77,132.77,0,0,0,231.05,128a133.15,133.15,0,0,0-23.12-30.77C185.67,75.19,158.78,64,128,64a118.37,118.37,0,0,0-19.36,1.57A8,8,0,1,1,106,49.79,134,134,0,0,1,128,48c34.88,0,66.57,13.26,91.66,38.35,18.83,18.83,27.3,37.62,27.65,38.41A8,8,0,0,1,247.31,131.26Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/regular/plus.svg
	var plus_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/regular/question.svg
	var question_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M140,180a12,12,0,1,1-12-12A12,12,0,0,1,140,180ZM128,72c-22.06,0-40,16.15-40,36v4a8,8,0,0,0,16,0v-4c0-11,10.77-20,24-20s24,9,24,20-10.77,20-24,20a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-.72c18.24-3.35,32-17.9,32-35.28C168,88.15,150.06,72,128,72Zm104,56A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/regular/trash.svg
	var trash_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/regular/x.svg
	var x_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z'/%3e%3c/svg%3e";
	//#endregion
	//#region node_modules/@phosphor-icons/core/assets/regular/x-circle.svg
	var x_circle_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M165.66,101.66,139.31,128l26.35,26.34a8,8,0,0,1-11.32,11.32L128,139.31l-26.34,26.35a8,8,0,0,1-11.32-11.32L116.69,128,90.34,101.66a8,8,0,0,1,11.32-11.32L128,116.69l26.34-26.35a8,8,0,0,1,11.32,11.32ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z'/%3e%3c/svg%3e";
	svgImport(caret_down_default);
	svgImport(eye_default);
	svgImport(eye_slash_default);
	svgImport(plus_default);
	svgImport(trash_default);
	svgImport(question_default);
	svgImport(x_default);
	svgImport(x_circle_default);
	svgImport(arrow_bend_up_left_bold_default);
	svgImport(arrow_clockwise_bold_default);
	svgImport(arrow_down_bold_default);
	svgImport(arrow_up_bold_default);
	svgImport(check_bold_default);
	svgImport(check_circle_bold_default);
	svgImport(copy_bold_default);
	svgImport(info_bold_default);
	svgImport(warning_circle_bold_default);
	svgImport(x_circle_bold_default);
	svgImport(spinner_gap_bold_default);
	svgImport(arrows_out_cardinal_fill_default);
	svgImport(airplane_fill_default);
	svgImport(bell_fill_default);
	svgImport(bell_slash_fill_default);
	svgImport(caret_down_fill_default);
	svgImport(caret_right_fill_default);
	svgImport(caret_up_fill_default);
	svgImport(info_fill_default);
	svgImport(funnel_fill_default);
	svgImport(funnel_x_fill_default);
	svgImport(gear_fill_default);
	svgImport(plus_fill_default);
	svgImport(stethoscope_fill_default);
	svgImport(table_fill_default);
	//#endregion
	//#region src/common/utils/functions/dom.ts
	function elementBuilder(options) {
		if (typeof options === "string") return document.createElement(options);
		else if (typeof options === "object") {
			options = {
				type: "div",
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
			for (const child of options.children.filter((child) => !!child) || []) if (typeof child === "string") newElement.appendChild(document.createTextNode(child));
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
	function isSVGElement(node) {
		return node && "nodeType" in node && node.nodeType === Node.ELEMENT_NODE && "ownerSVGElement" in node;
	}
	(() => {
		if (typeof window === "undefined" || window.location.href.endsWith("/_generated_background_page.html")) return "BACKGROUND";
		else if (typeof browser === "object" && browser.action) return "POPUP";
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
		const oldFetch = SCRIPT_INJECTOR.getWindow().fetch;
		SCRIPT_INJECTOR.getWindow().fetch = (input, init) => new Promise((resolve, reject) => {
			oldFetch(input, init).then(async (response) => {
				const page = response.url.substring(response.url.indexOf("torn.com/") + 9, response.url.indexOf(".php"));
				let json = {};
				try {
					json = await response.clone().json();
				} catch {}
				let body = null;
				if (init) {
					body = init.body;
					if (body !== null && typeof body === "object" && body?.constructor?.name === "FormData") {
						const newBody = {};
						for (const [key, value] of [...body]) if (isIntNumber(value)) newBody[key] = parseFloat(value);
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
		setScriptInjector({
			getWindow: () => window,
			injectXHR: () => {},
			injectFetch: () => {}
		});
		new RequestListenerInjector(injectFetchListeners).inject();
		console.log("Script Injected - Fetch Interception");
	});
	//#endregion
	//#region \0virtual:wxt-unlisted-script-entrypoint?/home/runner/work/torntools_extension/torntools_extension/src/extension/entrypoints/fetch--inject.ts
	function print(method, ...args) {}
	/** Wrapper around `console` with a "[wxt]" prefix */
	var logger = {
		debug: (...args) => print(console.debug, ...args),
		log: (...args) => print(console.log, ...args),
		warn: (...args) => print(console.warn, ...args),
		error: (...args) => print(console.error, ...args)
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

fetchInject;
//# sourceMappingURL=fetch--inject.js.map