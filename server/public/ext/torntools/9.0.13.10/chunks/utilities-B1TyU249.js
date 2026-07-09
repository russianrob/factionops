//#region \0vite/modulepreload-polyfill.js
(function polyfill() {
	const relList = document.createElement("link").relList;
	if (relList && relList.supports && relList.supports("modulepreload")) return;
	for (const link of document.querySelectorAll("link[rel=\"modulepreload\"]")) processPreload(link);
	new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type !== "childList") continue;
			for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
		}
	}).observe(document, {
		childList: true,
		subtree: true
	});
	function getFetchOpts(link) {
		const fetchOpts = {};
		if (link.integrity) fetchOpts.integrity = link.integrity;
		if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
		if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
		else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
		else fetchOpts.credentials = "same-origin";
		return fetchOpts;
	}
	function processPreload(link) {
		if (link.ep) return;
		link.ep = true;
		const fetchOpts = getFetchOpts(link);
		fetch(link.href, fetchOpts);
	}
})();
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
var PHQuestion = svgImport(question_default);
svgImport(x_default);
var PHXCircle = svgImport(x_circle_default);
svgImport(arrow_bend_up_left_bold_default);
svgImport(arrow_clockwise_bold_default);
svgImport(arrow_down_bold_default);
svgImport(arrow_up_bold_default);
var PHBoldCheck = svgImport(check_bold_default);
svgImport(check_circle_bold_default);
var PHBoldCopy = svgImport(copy_bold_default);
svgImport(info_bold_default);
svgImport(warning_circle_bold_default);
svgImport(x_circle_bold_default);
var PHBoldSpinnerGap = svgImport(spinner_gap_bold_default);
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
function executeScript(filename, remove = true) {
	const script = elementBuilder({
		type: "script",
		attributes: {
			type: "text/javascript",
			src: filename
		}
	});
	requireCondition(() => !!document.head).then(() => {
		document.head.appendChild(script);
		if (remove) setTimeout(() => script.remove(), 2e3);
	});
}
function isElement(node) {
	return !!node && "nodeType" in node && node.nodeType === Node.ELEMENT_NODE && typeof node.className === "string";
}
function isHTMLElement(node) {
	return isElement(node) && "dataset" in node && "title" in node;
}
function isSVGElement(node) {
	return !!node && "nodeType" in node && node.nodeType === Node.ELEMENT_NODE && "ownerSVGElement" in node;
}
//#endregion
//#region src/common/utils/functions/utilities.ts
var MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December"
];
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
function sleep(millis) {
	return new Promise((resolve) => setTimeout(resolve, millis));
}
var TO_MILLIS = {
	SECONDS: 1e3,
	MINUTES: 1e3 * 60,
	HOURS: 1e3 * 60 * 60,
	DAYS: 1e3 * 60 * 60 * 24
};
function isIntNumber(number) {
	if (number === null) return false;
	if (number.match(/[a-zA-Z]/)) return false;
	const _number = parseFloat(number.toString());
	return !Number.isNaN(_number) && Number.isFinite(_number) && _number % 1 === 0;
}
function isToday(timestamp) {
	return (/* @__PURE__ */ new Date()).getDate() === new Date(timestamp).getDate();
}
function getCookie(cname) {
	const name = `${cname}=`;
	for (let cookie of decodeURIComponent(document.cookie).split(";")) {
		cookie = cookie.trimStart();
		if (cookie.includes(name)) return cookie.substring(name.length);
	}
	return "";
}
async function getValueAsync(x) {
	if (x.constructor.name === "AsyncFunction") return x();
	else {
		const value = x();
		if (value instanceof Promise) return value;
		else return value;
	}
}
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
function isNumber(x) {
	return typeof x === "number";
}
function isSpeechSynthesisAvailable() {
	return typeof SpeechSynthesisUtterance !== "undefined";
}
//#endregion
export { browser as A, PHBoldSpinnerGap as C, requireDOMContentLoaded as D, requireCondition as E, requireDOMInteractive as O, PHBoldCopy as S, PHXCircle as T, executeScript as _, getCookie as a, isHTMLElement as b, isNumber as c, isToday as d, objectsEquals as f, elementBuilder as g, checkDevice as h, arraysEquals as i, requireElement as k, isSpeechSynthesisAvailable as l, toClipboard as m, SCRIPT_TYPE as n, getValueAsync as o, sleep as p, TO_MILLIS as r, isIntNumber as s, MONTHS as t, isTabFocused as u, findAllElements as v, PHQuestion as w, PHBoldCheck as x, isElement as y };

//# sourceMappingURL=utilities-B1TyU249.js.map