var addDebugInfoInject = (function() {
	//#region node_modules/wxt/dist/utils/define-unlisted-script.mjs
	function defineUnlistedScript(arg) {
		if (arg == null || typeof arg === "function") return { main: arg };
		return arg;
	}
	//#endregion
	//#region src/extension/entrypoints/add-debug-info--inject.ts
	var add_debug_info__inject_default = defineUnlistedScript(() => {
		$("#editor-wrapper .editor-content.mce-content-body").keyup();
	});
	//#endregion
	//#region \0virtual:wxt-unlisted-script-entrypoint?/tmp/tt-9.0.13/src/extension/entrypoints/add-debug-info--inject.ts
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
			result = add_debug_info__inject_default.main();
			if (result instanceof Promise) result = result.catch((err) => {
				logger.error(`The unlisted script "add-debug-info--inject" crashed on startup!`, err);
				throw err;
			});
		} catch (err) {
			logger.error(`The unlisted script "add-debug-info--inject" crashed on startup!`, err);
			throw err;
		}
		return result;
	})();
})();

addDebugInfoInject;
//# sourceMappingURL=add-debug-info--inject.js.map