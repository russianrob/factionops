(function() {
	//#region node_modules/wxt/dist/utils/define-unlisted-script.mjs
	function defineUnlistedScript(arg) {
		if (arg == null || typeof arg === "function") return { main: arg };
		return arg;
	}
	//#endregion
	//#region src/common/features/efficient-rehab/efficient-rehab-listeners.ts
	function injectEfficientRehabListeners(pageWindow = window) {
		pageWindow.addEventListener("tt-efficient-rehab", (event) => {
			const $slider = $("#rehub-progress .ui-slider");
			const rehabPercentages = JSON.parse($slider.attr("data-percentages")) || [];
			const { ticks } = event.detail;
			if (!(ticks in rehabPercentages)) {
				console.warn("TornTools - Failed to update the rehab amount due to it being an invalid amount of ticks");
				return;
			}
			const percentage = rehabPercentages[ticks];
			$slider.slider("value", percentage).slider("option", "slide")({}, { value: $slider.slider("value") });
		});
		pageWindow.dispatchEvent(new CustomEvent("tt-injected--efficient-rehab"));
	}
	//#endregion
	//#region src/extension/entrypoints/efficient-rehab--inject.ts
	var efficient_rehab__inject_default = defineUnlistedScript(() => {
		injectEfficientRehabListeners();
	});
	//#endregion
	//#region \0virtual:wxt-unlisted-script-entrypoint?/tmp/claude-0/-root/597a87b4-6cf4-448a-916a-cd272c67141a/scratchpad/tt-9.1.1/src/extension/entrypoints/efficient-rehab--inject.ts
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
			result = efficient_rehab__inject_default.main();
			if (result instanceof Promise) result = result.catch((err) => {
				logger.error(`The unlisted script "efficient-rehab--inject" crashed on startup!`, err);
				throw err;
			});
		} catch (err) {
			logger.error(`The unlisted script "efficient-rehab--inject" crashed on startup!`, err);
			throw err;
		}
		return result;
	})();
})();

//# sourceMappingURL=efficient-rehab--inject.js.map