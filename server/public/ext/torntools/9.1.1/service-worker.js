(function() {
	//#region node_modules/wxt/dist/utils/define-unlisted-script.mjs
	function defineUnlistedScript(arg) {
		if (arg == null || typeof arg === "function") return { main: arg };
		return arg;
	}
	//#endregion
	//#region src/extension/entrypoints/service-worker.ts
	var service_worker_default = defineUnlistedScript(() => {
		const worker = self;
		worker.addEventListener("notificationclick", (event) => {
			event.notification.close();
			if (event.notification.data?.link) {
				const url = event.notification.data.link;
				worker.clients.openWindow(url).then((windowClient) => windowClient?.focus());
			}
		});
	});
	//#endregion
	//#region \0virtual:wxt-unlisted-script-entrypoint?/tmp/claude-0/-root/597a87b4-6cf4-448a-916a-cd272c67141a/scratchpad/tt-9.1.1/src/extension/entrypoints/service-worker.ts
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
			result = service_worker_default.main();
			if (result instanceof Promise) result = result.catch((err) => {
				logger.error(`The unlisted script "service-worker" crashed on startup!`, err);
				throw err;
			});
		} catch (err) {
			logger.error(`The unlisted script "service-worker" crashed on startup!`, err);
			throw err;
		}
		return result;
	})();
})();

//# sourceMappingURL=service-worker.js.map