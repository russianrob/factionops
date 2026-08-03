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
//#region src/common/utils/functions/browser.ts
function usingFirefox() {
	return navigator.userAgent.includes("Firefox");
}
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
//#region node_modules/@phosphor-icons/core/assets/bold/check-bold.svg
var check_bold_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z'/%3e%3c/svg%3e";
//#endregion
//#region node_modules/@phosphor-icons/core/assets/bold/copy-bold.svg
var copy_bold_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M216,28H88A12,12,0,0,0,76,40V76H40A12,12,0,0,0,28,88V216a12,12,0,0,0,12,12H168a12,12,0,0,0,12-12V180h36a12,12,0,0,0,12-12V40A12,12,0,0,0,216,28ZM156,204H52V100H156Zm48-48H180V88a12,12,0,0,0-12-12H100V52H204Z'/%3e%3c/svg%3e";
//#endregion
//#region node_modules/@phosphor-icons/core/assets/bold/spinner-gap-bold.svg
var spinner_gap_bold_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M140,32V64a12,12,0,0,1-24,0V32a12,12,0,0,1,24,0Zm84,84H192a12,12,0,0,0,0,24h32a12,12,0,0,0,0-24Zm-42.26,48.77a12,12,0,1,0-17,17l22.63,22.63a12,12,0,0,0,17-17ZM128,180a12,12,0,0,0-12,12v32a12,12,0,0,0,24,0V192A12,12,0,0,0,128,180ZM74.26,164.77,51.63,187.4a12,12,0,0,0,17,17l22.63-22.63a12,12,0,1,0-17-17ZM76,128a12,12,0,0,0-12-12H32a12,12,0,0,0,0,24H64A12,12,0,0,0,76,128ZM68.6,51.63a12,12,0,1,0-17,17L74.26,91.23a12,12,0,0,0,17-17Z'/%3e%3c/svg%3e";
//#endregion
//#region node_modules/@phosphor-icons/core/assets/regular/question.svg
var question_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M140,180a12,12,0,1,1-12-12A12,12,0,0,1,140,180ZM128,72c-22.06,0-40,16.15-40,36v4a8,8,0,0,0,16,0v-4c0-11,10.77-20,24-20s24,9,24,20-10.77,20-24,20a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-.72c18.24-3.35,32-17.9,32-35.28C168,88.15,150.06,72,128,72Zm104,56A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z'/%3e%3c/svg%3e";
//#endregion
//#region node_modules/@phosphor-icons/core/assets/regular/x-circle.svg
var x_circle_default = "data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20256%20256'%20fill='currentColor'%3e%3cpath%20d='M165.66,101.66,139.31,128l26.35,26.34a8,8,0,0,1-11.32,11.32L128,139.31l-26.34,26.35a8,8,0,0,1-11.32-11.32L116.69,128,90.34,101.66a8,8,0,0,1,11.32-11.32L128,116.69l26.34-26.35a8,8,0,0,1,11.32,11.32ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z'/%3e%3c/svg%3e";
//#endregion
//#region src/common/utils/icons/phosphor-icons.ts
var lazyImport = (svgData) => {
	let factory;
	return (attributes) => {
		factory ??= svgImport(svgData);
		return factory(attributes);
	};
};
var PHQuestion = lazyImport(question_default);
var PHXCircle = lazyImport(x_circle_default);
var PHBoldCheck = lazyImport(check_bold_default);
var PHBoldCopy = lazyImport(copy_bold_default);
var PHBoldSpinnerGap = lazyImport(spinner_gap_bold_default);
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
function executeScript(filename, remove = true, unique = false) {
	const script = elementBuilder({
		type: "script",
		attributes: {
			type: "text/javascript",
			src: filename
		}
	});
	requireCondition(() => !!document.head).then(() => {
		if (unique && document.head.querySelector(`:scope > script[src='${filename}']`)) return;
		document.head.appendChild(script);
		if (remove) setTimeout(() => script.remove(), 2e3);
	});
}
function isElement(node) {
	return !!node && node instanceof Element;
}
function isHTMLElement(node) {
	return !!node && node instanceof HTMLElement;
}
function isSVGElement(node) {
	return !!node && node instanceof SVGElement;
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
function contextSafeCustomEvent(event, detail) {
	const safeDetail = usingFirefox() ? document.defaultView.structuredClone(detail) : detail;
	return new CustomEvent(event, { detail: safeDetail });
}
//#endregion
export { usingFirefox as A, PHBoldSpinnerGap as C, requireDOMContentLoaded as D, requireCondition as E, requireDOMInteractive as O, PHBoldCopy as S, PHXCircle as T, executeScript as _, contextSafeCustomEvent as a, isHTMLElement as b, isNumber as c, isToday as d, objectsEquals as f, elementBuilder as g, checkDevice as h, arraysEquals as i, browser as j, requireElement as k, isSpeechSynthesisAvailable as l, toClipboard as m, SCRIPT_TYPE as n, getCookie as o, sleep as p, TO_MILLIS as r, isIntNumber as s, MONTHS as t, isTabFocused as u, findAllElements as v, PHQuestion as w, PHBoldCheck as x, isElement as y };

//# sourceMappingURL=utilities-DwImhkRX.js.map