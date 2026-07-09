var pointsValueInject = (function() {
	//#region node_modules/wxt/dist/utils/define-unlisted-script.mjs
	function defineUnlistedScript(arg) {
		if (arg == null || typeof arg === "function") return { main: arg };
		return arg;
	}
	//#endregion
	//#region src/extension/entrypoints/points-value--inject.ts
	var points_value__inject_default = defineUnlistedScript(() => {
		window.initializeTooltip(".tt-points-value", "white-tooltip");
	});
	//#endregion
	//#region \0virtual:wxt-unlisted-script-entrypoint?/tmp/claude-0/-root/6677d539-882b-490d-8422-4a3633676fc6/scratchpad/tt-9.0.13/src/extension/entrypoints/points-value--inject.ts
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
			result = points_value__inject_default.main();
			if (result instanceof Promise) result = result.catch((err) => {
				logger.error(`The unlisted script "points-value--inject" crashed on startup!`, err);
				throw err;
			});
		} catch (err) {
			logger.error(`The unlisted script "points-value--inject" crashed on startup!`, err);
			throw err;
		}
		return result;
	})();
})();

pointsValueInject;
//# sourceMappingURL=points-value--inject.js.map