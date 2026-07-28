var apiKeyFocusInject = (function() {
	//#region node_modules/wxt/dist/utils/define-unlisted-script.mjs
	function defineUnlistedScript(arg) {
		if (arg == null || typeof arg === "function") return { main: arg };
		return arg;
	}
	//#endregion
	//#region src/extension/entrypoints/api-key-focus--inject.ts
	var api_key_focus__inject_default = defineUnlistedScript(() => {
		$("#api_key").focusout();
	});
	//#endregion
	//#region \0virtual:wxt-unlisted-script-entrypoint?/tmp/claude-0/-root/6677d539-882b-490d-8422-4a3633676fc6/scratchpad/tt-9.0.13/src/extension/entrypoints/api-key-focus--inject.ts
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
			result = api_key_focus__inject_default.main();
			if (result instanceof Promise) result = result.catch((err) => {
				logger.error(`The unlisted script "api-key-focus--inject" crashed on startup!`, err);
				throw err;
			});
		} catch (err) {
			logger.error(`The unlisted script "api-key-focus--inject" crashed on startup!`, err);
			throw err;
		}
		return result;
	})();
})();

apiKeyFocusInject;
//# sourceMappingURL=api-key-focus--inject.js.map