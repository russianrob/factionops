var cityItemsInject = (function() {
	//#region node_modules/wxt/dist/utils/define-unlisted-script.mjs
	function defineUnlistedScript(arg) {
		if (arg == null || typeof arg === "function") return { main: arg };
		return arg;
	}
	//#endregion
	//#region src/common/features/city-items/city-items-map.ts
	var CITY_ITEMS_MAP_EVENTS = {
		SET_ITEMS: "tt-city-items:set-items",
		REQUEST_MODEL_ITEMS: "tt-city-items:request-model-items",
		MODEL_ITEMS: "tt-city-items:model-items",
		CLEAR: "tt-city-items:clear"
	};
	var BASE_HIGHLIGHT_SIZE = 38;
	var SYNC_ATTEMPT_INTERVAL = 250;
	var SYNC_ATTEMPT_LIMIT = 80;
	function injectCityItemsMapListeners(pageWindow = window) {
		if (pageWindow.__ttCityItemsMap?.injected) return;
		const state = {
			injected: true,
			entries: [],
			overlays: /* @__PURE__ */ new Map()
		};
		pageWindow.__ttCityItemsMap = state;
		pageWindow.addEventListener(CITY_ITEMS_MAP_EVENTS.SET_ITEMS, handleSetItemsEvent);
		pageWindow.addEventListener(CITY_ITEMS_MAP_EVENTS.REQUEST_MODEL_ITEMS, () => {
			const items = getModelItems();
			dispatchPageEvent(CITY_ITEMS_MAP_EVENTS.MODEL_ITEMS, { items });
		});
		pageWindow.addEventListener(CITY_ITEMS_MAP_EVENTS.CLEAR, clearOverlays);
		function handleSetItemsEvent(event) {
			const detail = parseEventDetail(event);
			if (!detail) return;
			state.entries = Array.isArray(detail.entries) ? detail.entries.filter(isCityItemsMapEntry) : [];
			scheduleSync();
		}
		function scheduleSync() {
			let attempts = 0;
			syncOverlays();
			if (state.syncTimer) return;
			state.syncTimer = pageWindow.setInterval(() => {
				attempts++;
				if (syncOverlays() || attempts >= SYNC_ATTEMPT_LIMIT || !state.entries.length) {
					if (state.syncTimer) pageWindow.clearInterval(state.syncTimer);
					state.syncTimer = void 0;
				}
			}, SYNC_ATTEMPT_INTERVAL);
		}
		function syncOverlays() {
			const map = getMap();
			const leaflet = pageWindow.L;
			if (!map || !isLeafletOverlayRuntime(leaflet)) return false;
			const activeEntryIds = new Set(state.entries.map((entry) => entry.entryId));
			for (const [entryId, record] of state.overlays) if (!activeEntryIds.has(entryId)) {
				removeOverlay(record);
				state.overlays.delete(entryId);
			}
			for (const entry of state.entries) {
				let record = state.overlays.get(entry.entryId);
				const latLng = getLatLngForEntry(entry);
				if (!latLng) continue;
				if (!record) {
					record = {
						entry,
						marker: null,
						latLng
					};
					state.overlays.set(entry.entryId, record);
				} else {
					record.entry = entry;
					record.latLng = latLng;
				}
				ensureOverlay(record, map, leaflet);
			}
			return state.entries.every((entry) => !!state.overlays.get(entry.entryId)?.marker);
		}
		function ensureOverlay(record, map, leaflet) {
			const latLng = record.latLng;
			if (!latLng) return;
			try {
				if (record.marker?._map && record.marker._map !== map) removeOverlay(record);
				if (record.marker) {
					record.marker.setLatLng?.(latLng);
					updateOverlayElement(record);
					return;
				}
				const icon = leaflet.divIcon({
					className: "tt-city-item-overlay city-item",
					html: `<span class="tt-city-item-overlay-content"><img src="${getItemImageUrl(record.entry.itemId)}" alt=""></span>`,
					iconSize: [BASE_HIGHLIGHT_SIZE, BASE_HIGHLIGHT_SIZE],
					iconAnchor: [BASE_HIGHLIGHT_SIZE / 2, BASE_HIGHLIGHT_SIZE / 2]
				});
				const marker = leaflet.marker(latLng, {
					icon,
					interactive: true,
					keyboard: false,
					zIndexOffset: 1e3
				});
				if (typeof marker.addTo !== "function") return;
				marker.addTo(map);
				record.marker = marker;
				updateOverlayElement(record);
			} catch {
				record.marker = null;
			}
		}
		function updateOverlayElement(record) {
			const element = record.marker?.getElement?.();
			if (!element) return;
			element.classList.add("tt-city-item-overlay", "city-item");
			element.dataset.id = record.entry.itemId.toString();
			element.dataset.itemId = record.entry.itemId.toString();
			element.dataset.entryId = record.entry.entryId;
			element.dataset.td = record.entry.td;
			element.removeAttribute("title");
		}
		function clearOverlays() {
			state.entries = [];
			if (state.syncTimer) {
				pageWindow.clearInterval(state.syncTimer);
				state.syncTimer = void 0;
			}
			for (const record of state.overlays.values()) removeOverlay(record);
			state.overlays.clear();
		}
		function removeOverlay(record) {
			if (!record.marker) return;
			try {
				if (record.marker.remove) record.marker.remove();
				else record.marker.removeFrom?.(getMap());
			} catch {
				try {
					record.marker._map?.removeLayer?.(record.marker);
				} catch {}
			}
			record.marker = null;
		}
		function getMap() {
			const mapElement = pageWindow.document.querySelector("#map");
			const map = getTornRuntime()?.map?.lmap ?? mapElement?._leaflet_map;
			return isLeafletMap(map) ? map : null;
		}
		function getLatLngForEntry(entry) {
			if (!Number.isFinite(entry.x) || !Number.isFinite(entry.y)) return null;
			const tornMap = getTornRuntime()?.map;
			const leaflet = pageWindow.L;
			try {
				if (tornMap?.getLPoint && leaflet?.CRS?.EPSG3857?.pointToLatLng) {
					const point = [entry.x / 2, entry.y / 2];
					const leafletPoint = tornMap.getLPoint(point);
					return normalizeLatLng(leaflet.CRS.EPSG3857.pointToLatLng(leafletPoint, tornMap.minZoom));
				}
			} catch {}
			return null;
		}
		function getModelItems() {
			const model = getTornRuntime()?.model;
			if (!model) return [];
			try {
				const fullModel = model.get();
				if (Array.isArray(fullModel?.territoryUserItems)) return fullModel.territoryUserItems;
			} catch {}
			try {
				const userItems = model.get("territoryUserItems");
				if (Array.isArray(userItems)) return userItems;
			} catch {}
			return [];
		}
		function getTornRuntime() {
			const torn = pageWindow.torn;
			return isTornRuntime(torn) ? torn : null;
		}
		function dispatchPageEvent(name, detail) {
			pageWindow.dispatchEvent(new CustomEvent(name, { detail: serializeEventDetail(detail) }));
		}
	}
	function parseEventDetail(event) {
		if (!isCustomEvent(event)) return null;
		if (typeof event.detail === "string") try {
			return JSON.parse(event.detail);
		} catch {
			return null;
		}
		return event.detail;
	}
	function serializeEventDetail(detail) {
		if (detail === void 0) return void 0;
		try {
			return JSON.stringify(detail);
		} catch {
			return;
		}
	}
	function isCustomEvent(event) {
		return "detail" in event;
	}
	function isCityItemsMapEntry(value) {
		return isRecord(value) && typeof value.entryId === "string" && typeof value.itemId === "number" && Number.isFinite(value.itemId) && typeof value.name === "string" && typeof value.td === "string" && typeof value.x === "number" && Number.isFinite(value.x) && typeof value.y === "number" && Number.isFinite(value.y);
	}
	function isRecord(value) {
		return typeof value === "object" && value !== null;
	}
	function isTornRuntime(value) {
		return isRecord(value) && (!("map" in value) || value.map == null || isTornMapRuntime(value.map)) && (!("model" in value) || value.model == null || isTornModelRuntime(value.model));
	}
	function isTornMapRuntime(value) {
		return isRecord(value) && (!("lmap" in value) || value.lmap == null || isLeafletMap(value.lmap)) && (!("minZoom" in value) || value.minZoom == null || typeof value.minZoom === "number") && (!("getLPoint" in value) || value.getLPoint == null || typeof value.getLPoint === "function");
	}
	function isTornModelRuntime(value) {
		return isRecord(value) && typeof value.get === "function";
	}
	function isLeafletMap(value) {
		return isRecord(value) && typeof value.addLayer === "function";
	}
	function isLeafletOverlayRuntime(value) {
		return isRecord(value) && typeof value.divIcon === "function" && typeof value.marker === "function";
	}
	function normalizeLatLng(latLng) {
		if (!latLng) return null;
		if (Array.isArray(latLng)) {
			const [lat, lng] = latLng;
			return Number.isFinite(lat) && Number.isFinite(lng) ? latLng : null;
		}
		return Number.isFinite(latLng.lat) && Number.isFinite(latLng.lng) ? latLng : null;
	}
	function getItemImageUrl(itemId) {
		return `https://www.torn.com/images/items/${itemId}/small.png`;
	}
	//#endregion
	//#region src/extension/entrypoints/city-items--inject.ts
	var city_items__inject_default = defineUnlistedScript(() => {
		injectCityItemsMapListeners();
		console.log("Script Injected - City Items Map Hooks");
	});
	//#endregion
	//#region \0virtual:wxt-unlisted-script-entrypoint?/tmp/tt-9.0.13/src/extension/entrypoints/city-items--inject.ts
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
			result = city_items__inject_default.main();
			if (result instanceof Promise) result = result.catch((err) => {
				logger.error(`The unlisted script "city-items--inject" crashed on startup!`, err);
				throw err;
			});
		} catch (err) {
			logger.error(`The unlisted script "city-items--inject" crashed on startup!`, err);
			throw err;
		}
		return result;
	})();
})();

cityItemsInject;
//# sourceMappingURL=city-items--inject.js.map