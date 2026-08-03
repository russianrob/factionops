(function() {
	//#region node_modules/wxt/dist/utils/define-unlisted-script.mjs
	function defineUnlistedScript(arg) {
		if (arg == null || typeof arg === "function") return { main: arg };
		return arg;
	}
	//#endregion
	//#region src/extension/entrypoints/no-outside-link-alert--inject.ts
	var no_outside_link_alert__inject_default = defineUnlistedScript(() => {
		const originalConfirm = window.confirm;
		window.confirm = (message) => {
			if (!message || message.includes("This link leads outside")) return true;
			return originalConfirm(message);
		};
	});
	//#endregion
	//#region \0virtual:wxt-unlisted-script-entrypoint?/tmp/claude-0/-root/597a87b4-6cf4-448a-916a-cd272c67141a/scratchpad/tt-9.1.1/src/extension/entrypoints/no-outside-link-alert--inject.ts
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
			result = no_outside_link_alert__inject_default.main();
			if (result instanceof Promise) result = result.catch((err) => {
				logger.error(`The unlisted script "no-outside-link-alert--inject" crashed on startup!`, err);
				throw err;
			});
		} catch (err) {
			logger.error(`The unlisted script "no-outside-link-alert--inject" crashed on startup!`, err);
			throw err;
		}
		return result;
	})();
})();

//# sourceMappingURL=no-outside-link-alert--inject.js.map