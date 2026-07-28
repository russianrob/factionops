var itemNoConfirmInject = (function() {
	//#region node_modules/wxt/dist/utils/define-unlisted-script.mjs
	function defineUnlistedScript(arg) {
		if (arg == null || typeof arg === "function") return { main: arg };
		return arg;
	}
	//#endregion
	//#region src/extension/entrypoints/item-no-confirm--inject.ts
	var item_no_confirm__inject_default = defineUnlistedScript(() => {
		if (typeof window.xhrSendAdjustments === "undefined") window.xhrSendAdjustments = {};
		function getParams(body) {
			const params = {};
			for (const param of body.split("&")) {
				const split = param.split("=");
				params[split[0]] = split[1];
			}
			return params;
		}
		function paramsToBody(params) {
			const _params = [];
			for (const key in params) _params.push(`${key}=${params[key]}`);
			return _params.join("&");
		}
		window.xhrSendAdjustments.noconfirm_items = (_xhr, body) => {
			if (!body) return body;
			const { step, action, confirm } = getParams(body);
			if (step !== "actionForm" || action !== "equip" || confirm === "1") return body;
			return paramsToBody({
				...getParams(body),
				confirm: 1
			});
		};
	});
	//#endregion
	//#region \0virtual:wxt-unlisted-script-entrypoint?/tmp/claude-0/-root/6677d539-882b-490d-8422-4a3633676fc6/scratchpad/tt-9.0.13/src/extension/entrypoints/item-no-confirm--inject.ts
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
			result = item_no_confirm__inject_default.main();
			if (result instanceof Promise) result = result.catch((err) => {
				logger.error(`The unlisted script "item-no-confirm--inject" crashed on startup!`, err);
				throw err;
			});
		} catch (err) {
			logger.error(`The unlisted script "item-no-confirm--inject" crashed on startup!`, err);
			throw err;
		}
		return result;
	})();
})();

itemNoConfirmInject;
//# sourceMappingURL=item-no-confirm--inject.js.map