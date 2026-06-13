import { $t as untrack, At as snippet, Bt as comment, Ct as set_style, Dn as noop, Dt as action, En as reset, Ft as if_block, Gt as delegate, Ht as from_svg, I as elementBuilder, It as mount, Jt as on, Kt as delegated, Lt as set_text, Mt as each, Nt as index, On as to_array, P as toClipboard, S as MONTHS, Sn as push, St as set_attribute, Tn as next, Tt as clsx, Ut as props_id, Vt as from_html, Wt as text, Xt as deep_read_state, Zt as get, _n as writable, _t as bind_this, a as BACKGROUND_SERVICE, an as child, b as userdata, c as cn, cn as proxy, dn as state, dt as onDestroy, fn as derived_safe_equal, ft as onMount, gn as store_get, gt as init, hn as setup_stores, ht as spread_props, i as exposeDebugObjects, jt as html, k as isNumber, kt as component, ln as mutable_source, m as loadDatabase, mt as rest_props, n as setMode, nn as user_effect, on as first_child, p as initializeDatabase, pn as user_derived, pt as prop, rn as user_pre_effect, sn as sibling, t as Mode_watcher, tn as template_effect, un as set, ut as ttStorage, v as storageListeners, w as TO_MILLIS, wt as set_class, xn as pop, xt as attribute_effect, zt as append } from "./dist-X5FUUfHt.js";
import { t as browser } from "./browser-DV2XfOQj.js";
import { $ as isIOS, At as Context, Bt as formatDate, C as getFloatingContentCSSVars, Ct as DOMContext, Dt as onDestroyEffect, Et as onMountEffect, F as forward, Gt as Router, Ht as formatTime, I as getNextMatch, It as capitalizeText, J as noop$1, Jt as router, Kt as link, L as isValidIndex, Lt as daySuffix, M as DOMTypeahead, Mt as mergeProps, N as boxAutoReset, Nt as executeCallbacks, Ot as Previous, P as backward, Pt as boxWith, R as next$1, S as FloatingAnchorState, St as attachRef, Tt as afterSleep, V as Portal, Vt as formatNumber, Wt as hasAPIData, X as RovingFocusGroup, Y as PresenceManager, Z as isElementOrSVGElement, _ as tv, _t as createBitsAttrs, a as Tooltip_trigger, b as Popper_layer, bt as getDataOpenClosed, c as Tooltip, ct as HOME, d as Badge, dt as PAGE_UP, et as ARROW_DOWN, f as toast, gt as boolToTrueOrUndef, h as Button, ht as boolToStrTrueOrUndef, i as active, kt as watch, l as Sonner_1, m as getIconContext, mt as boolToStr, n as Input, nt as ARROW_RIGHT, o as Tooltip_provider, pt as boolToEmptyStrOrUndef, q as createId, qt as replace, r as registerExtensionContext, rt as ARROW_UP, s as Tooltip_content, t as TrashIcon, tt as ARROW_LEFT, u as Check, ut as PAGE_DOWN, v as Separator, vt as getAriaChecked, wt as afterTick, x as Floating_layer, xt as getDataTransitionAttrs, y as Popper_layer_force_mount, z as prev, zt as formatBytes } from "./TrashIcon-Do1I_oxJ.js";
import { C as HIGHLIGHT_PLACEHOLDERS, S as CUSTOM_LINKS_PRESET, T as TORNTOOLS_FORUM_POST, _ as Spinner, a as Card_description, b as CASINO_GAMES, c as FETCH_PLATFORMS, d as Dialog_header, f as Dialog_footer, g as Textarea, h as Dialog, i as Card_header, l as fetchData, m as Dialog_content, n as checkAPIPermission, o as Card_content, p as Dialog_description, r as Card_title, s as Card, t as changeAPIKey, u as Dialog_title, v as ALL_AREAS, x as CHAT_TITLE_COLORS, y as ALL_ICONS } from "./api-key-C8elNCNX.js";
import { i as Hidden_input, n as Switch, r as Checkbox, t as PlusIcon } from "./PlusIcon-DGt_yeIS.js";
//#region src/extension/svelte/components/ui/kbd/kbd.svelte
var root$65 = from_html(`<kbd><!></kbd>`);
function Kbd($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"children"
	]);
	var kbd = root$65();
	attribute_effect(kbd, ($0) => ({
		"data-slot": "kbd",
		class: $0,
		...restProps
	}), [() => cn("bg-muted text-muted-foreground in-data-[slot=tooltip-content]:bg-background/20 in-data-[slot=tooltip-content]:text-background dark:in-data-[slot=tooltip-content]:bg-background/10 h-5 w-fit min-w-5 gap-1 rounded-sm px-1 font-sans text-xs font-medium [&_svg:not([class*='size-'])]:size-3 pointer-events-none inline-flex items-center justify-center select-none", $$props.class)]);
	snippet(child(kbd), () => $$props.children ?? noop);
	reset(kbd);
	bind_this(kbd, ($$value) => ref($$value), () => ref());
	append($$anchor, kbd);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/kbd/kbd-group.svelte
var root$64 = from_html(`<kbd><!></kbd>`);
function Kbd_group($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"children"
	]);
	var kbd = root$64();
	attribute_effect(kbd, ($0) => ({
		"data-slot": "kbd-group",
		class: $0,
		...restProps
	}), [() => cn("gap-1 inline-flex items-center", $$props.class)]);
	snippet(child(kbd), () => $$props.children ?? noop);
	reset(kbd);
	bind_this(kbd, ($$value) => ref($$value), () => ref());
	append($$anchor, kbd);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/accordion/accordion.svelte.js
var accordionAttrs = createBitsAttrs({
	component: "accordion",
	parts: [
		"root",
		"trigger",
		"content",
		"item",
		"header"
	]
});
var AccordionRootContext = new Context("Accordion.Root");
var AccordionItemContext = new Context("Accordion.Item");
var AccordionBaseState = class {
	opts;
	rovingFocusGroup;
	attachment;
	constructor(opts) {
		this.opts = opts;
		this.rovingFocusGroup = new RovingFocusGroup({
			rootNode: this.opts.ref,
			candidateAttr: accordionAttrs.trigger,
			loop: this.opts.loop,
			orientation: this.opts.orientation
		});
		this.attachment = attachRef(this.opts.ref);
	}
	#props = user_derived(() => ({
		id: this.opts.id.current,
		"data-orientation": this.opts.orientation.current,
		"data-disabled": boolToEmptyStrOrUndef(this.opts.disabled.current),
		[accordionAttrs.root]: "",
		...this.attachment
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
var AccordionSingleState = class extends AccordionBaseState {
	opts;
	isMulti = false;
	constructor(opts) {
		super(opts);
		this.opts = opts;
		this.includesItem = this.includesItem.bind(this);
		this.toggleItem = this.toggleItem.bind(this);
	}
	includesItem(item) {
		return this.opts.value.current === item;
	}
	toggleItem(item) {
		this.opts.value.current = this.includesItem(item) ? "" : item;
	}
};
var AccordionMultiState = class extends AccordionBaseState {
	#value;
	isMulti = true;
	constructor(props) {
		super(props);
		this.#value = props.value;
		this.includesItem = this.includesItem.bind(this);
		this.toggleItem = this.toggleItem.bind(this);
	}
	includesItem(item) {
		return this.#value.current.includes(item);
	}
	toggleItem(item) {
		this.#value.current = this.includesItem(item) ? this.#value.current.filter((v) => v !== item) : [...this.#value.current, item];
	}
};
var AccordionRootState = class {
	static create(props) {
		const { type, ...rest } = props;
		const rootState = type === "single" ? new AccordionSingleState(rest) : new AccordionMultiState(rest);
		return AccordionRootContext.set(rootState);
	}
};
var AccordionItemState = class AccordionItemState {
	static create(props) {
		return AccordionItemContext.set(new AccordionItemState({
			...props,
			rootState: AccordionRootContext.get()
		}));
	}
	opts;
	root;
	#isActive = user_derived(() => this.root.includesItem(this.opts.value.current));
	get isActive() {
		return get(this.#isActive);
	}
	set isActive(value) {
		set(this.#isActive, value);
	}
	#isDisabled = user_derived(() => this.opts.disabled.current || this.root.opts.disabled.current);
	get isDisabled() {
		return get(this.#isDisabled);
	}
	set isDisabled(value) {
		set(this.#isDisabled, value);
	}
	attachment;
	#contentNode = state(null);
	get contentNode() {
		return get(this.#contentNode);
	}
	set contentNode(value) {
		set(this.#contentNode, value, true);
	}
	contentPresence;
	constructor(opts) {
		this.opts = opts;
		this.root = opts.rootState;
		this.updateValue = this.updateValue.bind(this);
		this.attachment = attachRef(this.opts.ref);
		this.contentPresence = new PresenceManager({
			ref: boxWith(() => this.contentNode),
			open: boxWith(() => this.isActive)
		});
	}
	updateValue() {
		this.root.toggleItem(this.opts.value.current);
	}
	#props = user_derived(() => ({
		id: this.opts.id.current,
		"data-state": getDataOpenClosed(this.isActive),
		"data-disabled": boolToEmptyStrOrUndef(this.isDisabled),
		"data-orientation": this.root.opts.orientation.current,
		[accordionAttrs.item]: "",
		...this.attachment
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
var AccordionTriggerState = class AccordionTriggerState {
	opts;
	itemState;
	#root;
	#isDisabled = user_derived(() => this.opts.disabled.current || this.itemState.opts.disabled.current || this.#root.opts.disabled.current);
	attachment;
	constructor(opts, itemState) {
		this.opts = opts;
		this.itemState = itemState;
		this.#root = itemState.root;
		this.onclick = this.onclick.bind(this);
		this.onkeydown = this.onkeydown.bind(this);
		this.attachment = attachRef(this.opts.ref);
	}
	static create(props) {
		return new AccordionTriggerState(props, AccordionItemContext.get());
	}
	onclick(e) {
		if (get(this.#isDisabled) || e.button !== 0) {
			e.preventDefault();
			return;
		}
		this.itemState.updateValue();
	}
	onkeydown(e) {
		if (get(this.#isDisabled)) return;
		if (e.key === " " || e.key === "Enter") {
			e.preventDefault();
			this.itemState.updateValue();
			return;
		}
		this.#root.rovingFocusGroup.handleKeydown(this.opts.ref.current, e);
	}
	#props = user_derived(() => ({
		id: this.opts.id.current,
		disabled: get(this.#isDisabled),
		"aria-expanded": boolToStr(this.itemState.isActive),
		"aria-disabled": boolToStr(get(this.#isDisabled)),
		"data-disabled": boolToEmptyStrOrUndef(get(this.#isDisabled)),
		"data-state": getDataOpenClosed(this.itemState.isActive),
		"data-orientation": this.#root.opts.orientation.current,
		[accordionAttrs.trigger]: "",
		tabindex: this.opts.tabindex.current,
		onclick: this.onclick,
		onkeydown: this.onkeydown,
		...this.attachment
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
var AccordionContentState = class AccordionContentState {
	opts;
	item;
	attachment;
	#originalStyles = void 0;
	#isMountAnimationPrevented = false;
	#dimensions = state(proxy({
		width: 0,
		height: 0
	}));
	#open = user_derived(() => {
		if (this.opts.hiddenUntilFound.current) return this.item.isActive;
		return this.opts.forceMount.current || this.item.isActive;
	});
	get open() {
		return get(this.#open);
	}
	set open(value) {
		set(this.#open, value);
	}
	constructor(opts, item) {
		this.opts = opts;
		this.item = item;
		this.#isMountAnimationPrevented = this.item.isActive;
		this.attachment = attachRef(this.opts.ref, (v) => this.item.contentNode = v);
		user_effect(() => {
			const rAF = requestAnimationFrame(() => {
				this.#isMountAnimationPrevented = false;
			});
			return () => cancelAnimationFrame(rAF);
		});
		watch.pre([() => this.opts.ref.current, () => this.opts.hiddenUntilFound.current], ([node, hiddenUntilFound]) => {
			if (!node || !hiddenUntilFound) return;
			const handleBeforeMatch = () => {
				if (this.item.isActive) return;
				requestAnimationFrame(() => {
					this.item.updateValue();
				});
			};
			return on(node, "beforematch", handleBeforeMatch);
		});
		watch([() => this.open, () => this.opts.ref.current], this.#updateDimensions);
	}
	static create(props) {
		return new AccordionContentState(props, AccordionItemContext.get());
	}
	#updateDimensions = ([_, node]) => {
		if (!node) return;
		afterTick(() => {
			const element = this.opts.ref.current;
			if (!element) return;
			this.#originalStyles ??= {
				transitionDuration: element.style.transitionDuration,
				animationName: element.style.animationName
			};
			element.style.transitionDuration = "0s";
			element.style.animationName = "none";
			const rect = element.getBoundingClientRect();
			set(this.#dimensions, {
				width: rect.width,
				height: rect.height
			}, true);
			if (!this.#isMountAnimationPrevented && this.#originalStyles) {
				element.style.transitionDuration = this.#originalStyles.transitionDuration;
				element.style.animationName = this.#originalStyles.animationName;
			}
		});
	};
	get shouldRender() {
		return this.item.contentPresence.shouldRender;
	}
	#snippetProps = user_derived(() => ({ open: this.item.isActive }));
	get snippetProps() {
		return get(this.#snippetProps);
	}
	set snippetProps(value) {
		set(this.#snippetProps, value);
	}
	#props = user_derived(() => ({
		id: this.opts.id.current,
		"data-state": getDataOpenClosed(this.item.isActive),
		...getDataTransitionAttrs(this.item.contentPresence.transitionStatus),
		"data-disabled": boolToEmptyStrOrUndef(this.item.isDisabled),
		"data-orientation": this.item.root.opts.orientation.current,
		[accordionAttrs.content]: "",
		style: {
			"--bits-accordion-content-height": `${get(this.#dimensions).height}px`,
			"--bits-accordion-content-width": `${get(this.#dimensions).width}px`
		},
		hidden: this.opts.hiddenUntilFound.current && !this.item.isActive ? "until-found" : void 0,
		...this.opts.hiddenUntilFound.current && !this.shouldRender ? {} : { hidden: this.opts.hiddenUntilFound.current ? !this.shouldRender : this.opts.forceMount.current ? void 0 : !this.shouldRender },
		...this.attachment
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
var AccordionHeaderState = class AccordionHeaderState {
	opts;
	item;
	attachment;
	constructor(opts, item) {
		this.opts = opts;
		this.item = item;
		this.attachment = attachRef(this.opts.ref);
	}
	static create(props) {
		return new AccordionHeaderState(props, AccordionItemContext.get());
	}
	#props = user_derived(() => ({
		id: this.opts.id.current,
		role: "heading",
		"aria-level": this.opts.level.current,
		"data-heading-level": this.opts.level.current,
		"data-state": getDataOpenClosed(this.item.isActive),
		"data-orientation": this.item.root.opts.orientation.current,
		[accordionAttrs.header]: "",
		...this.attachment
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
//#endregion
//#region node_modules/bits-ui/dist/bits/accordion/components/accordion.svelte
var root_2$61 = from_html(`<div><!></div>`);
function Accordion$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let disabled = prop($$props, "disabled", 3, false), value = prop($$props, "value", 15), ref = prop($$props, "ref", 15, null), id = prop($$props, "id", 19, () => createId(uid)), onValueChange = prop($$props, "onValueChange", 3, noop$1), loop = prop($$props, "loop", 3, true), orientation = prop($$props, "orientation", 3, "vertical"), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"disabled",
		"children",
		"child",
		"type",
		"value",
		"ref",
		"id",
		"onValueChange",
		"loop",
		"orientation"
	]);
	function handleDefaultValue() {
		if (value() !== void 0) return;
		value($$props.type === "single" ? "" : []);
	}
	handleDefaultValue();
	watch.pre(() => value(), () => {
		handleDefaultValue();
	});
	const rootState = AccordionRootState.create({
		type: $$props.type,
		value: boxWith(() => value(), (v) => {
			value(v);
			onValueChange()(v);
		}),
		id: boxWith(() => id()),
		disabled: boxWith(() => disabled()),
		loop: boxWith(() => loop()),
		orientation: boxWith(() => orientation()),
		ref: boxWith(() => ref(), (v) => ref(v))
	});
	const mergedProps = user_derived(() => mergeProps(restProps, rootState.props));
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		var fragment_1 = comment();
		snippet(first_child(fragment_1), () => $$props.child, () => ({ props: get(mergedProps) }));
		append($$anchor, fragment_1);
	};
	var alternate = ($$anchor) => {
		var div = root_2$61();
		attribute_effect(div, () => ({ ...get(mergedProps) }));
		snippet(child(div), () => $$props.children ?? noop);
		reset(div);
		append($$anchor, div);
	};
	if_block(node, ($$render) => {
		if ($$props.child) $$render(consequent);
		else $$render(alternate, -1);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/accordion/components/accordion-item.svelte
var root_2$60 = from_html(`<div><!></div>`);
function Accordion_item$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	const defaultId = createId(uid);
	let id = prop($$props, "id", 3, defaultId), disabled = prop($$props, "disabled", 3, false), value = prop($$props, "value", 3, defaultId), ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"id",
		"disabled",
		"value",
		"children",
		"child",
		"ref"
	]);
	const itemState = AccordionItemState.create({
		value: boxWith(() => value()),
		disabled: boxWith(() => disabled()),
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v))
	});
	const mergedProps = user_derived(() => mergeProps(restProps, itemState.props));
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		var fragment_1 = comment();
		snippet(first_child(fragment_1), () => $$props.child, () => ({ props: get(mergedProps) }));
		append($$anchor, fragment_1);
	};
	var alternate = ($$anchor) => {
		var div = root_2$60();
		attribute_effect(div, () => ({ ...get(mergedProps) }));
		snippet(child(div), () => $$props.children ?? noop);
		reset(div);
		append($$anchor, div);
	};
	if_block(node, ($$render) => {
		if ($$props.child) $$render(consequent);
		else $$render(alternate, -1);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/accordion/components/accordion-header.svelte
var root_2$59 = from_html(`<div><!></div>`);
function Accordion_header($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), level = prop($$props, "level", 3, 2), ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"id",
		"level",
		"children",
		"child",
		"ref"
	]);
	const headerState = AccordionHeaderState.create({
		id: boxWith(() => id()),
		level: boxWith(() => level()),
		ref: boxWith(() => ref(), (v) => ref(v))
	});
	const mergedProps = user_derived(() => mergeProps(restProps, headerState.props));
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		var fragment_1 = comment();
		snippet(first_child(fragment_1), () => $$props.child, () => ({ props: get(mergedProps) }));
		append($$anchor, fragment_1);
	};
	var alternate = ($$anchor) => {
		var div = root_2$59();
		attribute_effect(div, () => ({ ...get(mergedProps) }));
		snippet(child(div), () => $$props.children ?? noop);
		reset(div);
		append($$anchor, div);
	};
	if_block(node, ($$render) => {
		if ($$props.child) $$render(consequent);
		else $$render(alternate, -1);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/accordion/components/accordion-trigger.svelte
var root_2$58 = from_html(`<button><!></button>`);
function Accordion_trigger$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let disabled = prop($$props, "disabled", 3, false), ref = prop($$props, "ref", 15, null), id = prop($$props, "id", 19, () => createId(uid)), tabindex = prop($$props, "tabindex", 3, 0), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"disabled",
		"ref",
		"id",
		"tabindex",
		"children",
		"child"
	]);
	const triggerState = AccordionTriggerState.create({
		disabled: boxWith(() => disabled()),
		id: boxWith(() => id()),
		tabindex: boxWith(() => tabindex() ?? 0),
		ref: boxWith(() => ref(), (v) => ref(v))
	});
	const mergedProps = user_derived(() => mergeProps(restProps, triggerState.props));
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		var fragment_1 = comment();
		snippet(first_child(fragment_1), () => $$props.child, () => ({ props: get(mergedProps) }));
		append($$anchor, fragment_1);
	};
	var alternate = ($$anchor) => {
		var button = root_2$58();
		attribute_effect(button, () => ({
			type: "button",
			...get(mergedProps)
		}));
		snippet(child(button), () => $$props.children ?? noop);
		reset(button);
		append($$anchor, button);
	};
	if_block(node, ($$render) => {
		if ($$props.child) $$render(consequent);
		else $$render(alternate, -1);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/accordion/components/accordion-content.svelte
var root_2$57 = from_html(`<div><!></div>`);
function Accordion_content$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), id = prop($$props, "id", 19, () => createId(uid)), forceMount = prop($$props, "forceMount", 3, false), hiddenUntilFound = prop($$props, "hiddenUntilFound", 3, false), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"child",
		"ref",
		"id",
		"forceMount",
		"children",
		"hiddenUntilFound"
	]);
	const contentState = AccordionContentState.create({
		forceMount: boxWith(() => forceMount()),
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v)),
		hiddenUntilFound: boxWith(() => hiddenUntilFound())
	});
	const mergedProps = user_derived(() => mergeProps(restProps, contentState.props));
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		var fragment_1 = comment();
		var node_1 = first_child(fragment_1);
		{
			let $0 = user_derived(() => ({
				props: get(mergedProps),
				...contentState.snippetProps
			}));
			snippet(node_1, () => $$props.child, () => get($0));
		}
		append($$anchor, fragment_1);
	};
	var alternate = ($$anchor) => {
		var div = root_2$57();
		attribute_effect(div, () => ({ ...get(mergedProps) }));
		snippet(child(div), () => $$props.children ?? noop);
		reset(div);
		append($$anchor, div);
	};
	if_block(node, ($$render) => {
		if ($$props.child) $$render(consequent);
		else $$render(alternate, -1);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/internal/data-typeahead.svelte.js
var DataTypeahead = class {
	#opts;
	#candidateValues = user_derived(() => this.#opts.candidateValues());
	#search;
	constructor(opts) {
		this.#opts = opts;
		this.#search = boxAutoReset("", {
			afterMs: 1e3,
			getWindow: this.#opts.getWindow
		});
		this.handleTypeaheadSearch = this.handleTypeaheadSearch.bind(this);
		this.resetTypeahead = this.resetTypeahead.bind(this);
	}
	handleTypeaheadSearch(key) {
		if (!this.#opts.enabled() || !get(this.#candidateValues).length) return;
		this.#search.current = this.#search.current + key;
		const currentItem = this.#opts.getCurrentItem();
		const currentMatch = get(this.#candidateValues).find((item) => item === currentItem) ?? "";
		const nextMatch = getNextMatch(get(this.#candidateValues).map((item) => item ?? ""), this.#search.current, currentMatch);
		const newItem = get(this.#candidateValues).find((item) => item === nextMatch);
		if (newItem) this.#opts.onMatch(newItem);
		return newItem;
	}
	resetTypeahead() {
		this.#search.current = "";
	}
};
var FIRST_KEYS = [
	ARROW_DOWN,
	PAGE_UP,
	HOME
];
var LAST_KEYS = [
	ARROW_UP,
	PAGE_DOWN,
	"End"
];
var FIRST_LAST_KEYS = [...FIRST_KEYS, ...LAST_KEYS];
var selectAttrs = createBitsAttrs({
	component: "select",
	parts: [
		"trigger",
		"content",
		"item",
		"viewport",
		"scroll-up-button",
		"scroll-down-button",
		"group",
		"group-label",
		"separator",
		"arrow",
		"input",
		"content-wrapper",
		"item-text",
		"value"
	]
});
var SelectRootContext = new Context("Select.Root | Combobox.Root");
new Context("Select.Group | Combobox.Group");
var SelectContentContext = new Context("Select.Content | Combobox.Content");
var SelectBaseRootState = class {
	opts;
	#touchedInput = state(false);
	get touchedInput() {
		return get(this.#touchedInput);
	}
	set touchedInput(value) {
		set(this.#touchedInput, value, true);
	}
	#inputNode = state(null);
	get inputNode() {
		return get(this.#inputNode);
	}
	set inputNode(value) {
		set(this.#inputNode, value, true);
	}
	#contentNode = state(null);
	get contentNode() {
		return get(this.#contentNode);
	}
	set contentNode(value) {
		set(this.#contentNode, value, true);
	}
	contentPresence;
	#viewportNode = state(null);
	get viewportNode() {
		return get(this.#viewportNode);
	}
	set viewportNode(value) {
		set(this.#viewportNode, value, true);
	}
	#triggerNode = state(null);
	get triggerNode() {
		return get(this.#triggerNode);
	}
	set triggerNode(value) {
		set(this.#triggerNode, value, true);
	}
	#valueNode = state(null);
	get valueNode() {
		return get(this.#valueNode);
	}
	set valueNode(value) {
		set(this.#valueNode, value, true);
	}
	#valueId = state("");
	get valueId() {
		return get(this.#valueId);
	}
	set valueId(value) {
		set(this.#valueId, value, true);
	}
	#highlightedNode = state(null);
	get highlightedNode() {
		return get(this.#highlightedNode);
	}
	set highlightedNode(value) {
		set(this.#highlightedNode, value, true);
	}
	#highlightedValue = user_derived(() => {
		if (!this.highlightedNode) return null;
		return this.highlightedNode.getAttribute("data-value");
	});
	get highlightedValue() {
		return get(this.#highlightedValue);
	}
	set highlightedValue(value) {
		set(this.#highlightedValue, value);
	}
	#highlightedId = user_derived(() => {
		if (!this.highlightedNode) return void 0;
		return this.highlightedNode.id;
	});
	get highlightedId() {
		return get(this.#highlightedId);
	}
	set highlightedId(value) {
		set(this.#highlightedId, value);
	}
	#highlightedLabel = user_derived(() => {
		if (!this.highlightedNode) return null;
		return this.highlightedNode.getAttribute("data-label");
	});
	get highlightedLabel() {
		return get(this.#highlightedLabel);
	}
	set highlightedLabel(value) {
		set(this.#highlightedLabel, value);
	}
	#contentIsPositioned = state(false);
	get contentIsPositioned() {
		return get(this.#contentIsPositioned);
	}
	set contentIsPositioned(value) {
		set(this.#contentIsPositioned, value, true);
	}
	isUsingKeyboard = false;
	isCombobox = false;
	domContext = new DOMContext(() => null);
	constructor(opts) {
		this.opts = opts;
		this.isCombobox = opts.isCombobox;
		this.contentPresence = new PresenceManager({
			ref: boxWith(() => this.contentNode),
			open: this.opts.open,
			onComplete: () => {
				this.opts.onOpenChangeComplete.current(this.opts.open.current);
			}
		});
		user_pre_effect(() => {
			if (!this.opts.open.current) this.setHighlightedNode(null);
		});
	}
	setHighlightedNode(node, initial = false) {
		this.highlightedNode = node;
		if (node && (this.isUsingKeyboard || initial)) this.scrollHighlightedNodeIntoView(node);
	}
	scrollHighlightedNodeIntoView(node) {
		if (!this.viewportNode || !this.contentIsPositioned) return;
		node.scrollIntoView({ block: this.opts.scrollAlignment.current });
	}
	getCandidateNodes() {
		const node = this.contentNode;
		if (!node) return [];
		return Array.from(node.querySelectorAll(`[${this.getBitsAttr("item")}]:not([data-disabled])`));
	}
	setHighlightedToFirstCandidate(initial = false) {
		this.setHighlightedNode(null);
		let nodes = this.getCandidateNodes();
		if (!nodes.length) return;
		if (this.viewportNode) {
			const viewportRect = this.viewportNode.getBoundingClientRect();
			nodes = nodes.filter((node) => {
				if (!this.viewportNode) return false;
				const nodeRect = node.getBoundingClientRect();
				return nodeRect.right <= viewportRect.right && nodeRect.left >= viewportRect.left && nodeRect.bottom <= viewportRect.bottom && nodeRect.top >= viewportRect.top;
			});
		}
		this.setHighlightedNode(nodes[0], initial);
	}
	getNodeByValue(value) {
		return this.getCandidateNodes().find((node) => node.dataset.value === value) ?? null;
	}
	/**
	* Resolves the display label for a value: `items` entry when present, otherwise the
	* mounted item's `data-label` or its text content.
	*/
	getLabelForValue(value) {
		if (value === "") return "";
		const fromItems = this.opts.items.current.find((item) => item.value === value)?.label;
		if (fromItems !== void 0) return fromItems;
		const node = this.getNodeByValue(value);
		if (node) {
			const dataLabel = node.getAttribute("data-label");
			if (dataLabel !== null && dataLabel !== "") return dataLabel;
			return node.textContent?.trim() ?? value;
		}
		return value;
	}
	setOpen(open) {
		this.opts.open.current = open;
	}
	toggleOpen() {
		this.opts.open.current = !this.opts.open.current;
	}
	handleOpen() {
		this.setOpen(true);
	}
	handleClose() {
		this.setHighlightedNode(null);
		this.setOpen(false);
	}
	toggleMenu() {
		this.toggleOpen();
	}
	getBitsAttr = (part) => {
		return selectAttrs.getAttr(part, this.isCombobox ? "combobox" : void 0);
	};
};
var SelectSingleRootState = class extends SelectBaseRootState {
	opts;
	isMulti = false;
	#hasValue = user_derived(() => this.opts.value.current !== "");
	get hasValue() {
		return get(this.#hasValue);
	}
	set hasValue(value) {
		set(this.#hasValue, value);
	}
	#currentLabel = user_derived(() => {
		if (!this.opts.items.current.length) return "";
		return this.opts.items.current.find((item) => item.value === this.opts.value.current)?.label ?? "";
	});
	get currentLabel() {
		return get(this.#currentLabel);
	}
	set currentLabel(value) {
		set(this.#currentLabel, value);
	}
	#candidateLabels = user_derived(() => {
		if (!this.opts.items.current.length) return [];
		return this.opts.items.current.filter((item) => !item.disabled).map((item) => item.label);
	});
	get candidateLabels() {
		return get(this.#candidateLabels);
	}
	set candidateLabels(value) {
		set(this.#candidateLabels, value);
	}
	#dataTypeaheadEnabled = user_derived(() => {
		if (this.isMulti) return false;
		if (this.opts.items.current.length === 0) return false;
		return true;
	});
	get dataTypeaheadEnabled() {
		return get(this.#dataTypeaheadEnabled);
	}
	set dataTypeaheadEnabled(value) {
		set(this.#dataTypeaheadEnabled, value);
	}
	constructor(opts) {
		super(opts);
		this.opts = opts;
		user_effect(() => {
			if (!this.opts.open.current && this.highlightedNode) this.setHighlightedNode(null);
		});
		watch(() => this.opts.open.current, () => {
			if (!this.opts.open.current) return;
			this.setInitialHighlightedNode();
		});
	}
	includesItem(itemValue) {
		return this.opts.value.current === itemValue;
	}
	toggleItem(itemValue, itemLabel = itemValue) {
		const newValue = this.includesItem(itemValue) ? "" : itemValue;
		this.opts.value.current = newValue;
		if (newValue !== "") this.opts.inputValue.current = itemLabel;
	}
	setInitialHighlightedNode() {
		afterTick(() => {
			if (this.highlightedNode && this.domContext.getDocument().contains(this.highlightedNode)) return;
			if (this.opts.value.current !== "") {
				const node = this.getNodeByValue(this.opts.value.current);
				if (node) {
					this.setHighlightedNode(node, true);
					return;
				}
			}
			this.setHighlightedToFirstCandidate(true);
		});
	}
};
var SelectMultipleRootState = class extends SelectBaseRootState {
	opts;
	isMulti = true;
	#hasValue = user_derived(() => this.opts.value.current.length > 0);
	get hasValue() {
		return get(this.#hasValue);
	}
	set hasValue(value) {
		set(this.#hasValue, value);
	}
	constructor(opts) {
		super(opts);
		this.opts = opts;
		user_effect(() => {
			if (!this.opts.open.current && this.highlightedNode) this.setHighlightedNode(null);
		});
		watch(() => this.opts.open.current, () => {
			if (!this.opts.open.current) return;
			this.setInitialHighlightedNode();
		});
	}
	includesItem(itemValue) {
		return this.opts.value.current.includes(itemValue);
	}
	toggleItem(itemValue, itemLabel = itemValue) {
		if (this.includesItem(itemValue)) this.opts.value.current = this.opts.value.current.filter((v) => v !== itemValue);
		else this.opts.value.current = [...this.opts.value.current, itemValue];
		this.opts.inputValue.current = itemLabel;
	}
	setInitialHighlightedNode() {
		afterTick(() => {
			if (!this.domContext) return;
			if (this.highlightedNode && this.domContext.getDocument().contains(this.highlightedNode)) return;
			if (this.opts.value.current.length && this.opts.value.current[0] !== "") {
				const node = this.getNodeByValue(this.opts.value.current[0]);
				if (node) {
					this.setHighlightedNode(node, true);
					return;
				}
			}
			this.setHighlightedToFirstCandidate(true);
		});
	}
};
var SelectRootState = class {
	static create(props) {
		const { type, ...rest } = props;
		const rootState = type === "single" ? new SelectSingleRootState(rest) : new SelectMultipleRootState(rest);
		return SelectRootContext.set(rootState);
	}
};
var SelectTriggerState = class SelectTriggerState {
	static create(opts) {
		return new SelectTriggerState(opts, SelectRootContext.get());
	}
	opts;
	root;
	attachment;
	#domTypeahead;
	#dataTypeahead;
	constructor(opts, root) {
		this.opts = opts;
		this.root = root;
		this.attachment = attachRef(opts.ref, (v) => this.root.triggerNode = v);
		this.root.domContext = new DOMContext(opts.ref);
		this.#domTypeahead = new DOMTypeahead({
			getCurrentItem: () => this.root.highlightedNode,
			onMatch: (node) => {
				this.root.setHighlightedNode(node);
			},
			getActiveElement: () => this.root.domContext.getActiveElement(),
			getWindow: () => this.root.domContext.getWindow()
		});
		this.#dataTypeahead = new DataTypeahead({
			getCurrentItem: () => {
				if (this.root.isMulti) return "";
				return this.root.currentLabel;
			},
			onMatch: (label) => {
				if (this.root.isMulti) return;
				if (!this.root.opts.items.current) return;
				const matchedItem = this.root.opts.items.current.find((item) => item.label === label);
				if (!matchedItem) return;
				this.root.opts.value.current = matchedItem.value;
			},
			enabled: () => !this.root.isMulti && this.root.dataTypeaheadEnabled,
			candidateValues: () => this.root.isMulti ? [] : this.root.candidateLabels,
			getWindow: () => this.root.domContext.getWindow()
		});
		this.onkeydown = this.onkeydown.bind(this);
		this.onpointerdown = this.onpointerdown.bind(this);
		this.onpointerup = this.onpointerup.bind(this);
		this.onclick = this.onclick.bind(this);
	}
	#handleOpen() {
		this.root.opts.open.current = true;
		this.#dataTypeahead.resetTypeahead();
		this.#domTypeahead.resetTypeahead();
	}
	#handlePointerOpen(_) {
		this.#handleOpen();
	}
	/**
	* Logic used to handle keyboard selection/deselection.
	*
	* If it returns true, it means the item was selected and whatever is calling
	* this function should return early
	*
	*/
	#handleKeyboardSelection() {
		const isCurrentSelectedValue = this.root.highlightedValue === this.root.opts.value.current;
		if (!this.root.opts.allowDeselect.current && isCurrentSelectedValue && !this.root.isMulti) {
			this.root.handleClose();
			return true;
		}
		if (this.root.highlightedValue !== null) this.root.toggleItem(this.root.highlightedValue, this.root.highlightedLabel ?? void 0);
		if (!this.root.isMulti && !isCurrentSelectedValue) {
			this.root.handleClose();
			return true;
		}
		return false;
	}
	onkeydown(e) {
		this.root.isUsingKeyboard = true;
		if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
		if (!this.root.opts.open.current) {
			if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
				e.preventDefault();
				this.root.handleOpen();
			} else if (!this.root.isMulti && this.root.dataTypeaheadEnabled) {
				this.#dataTypeahead.handleTypeaheadSearch(e.key);
				return;
			}
			if (this.root.hasValue) return;
			const candidateNodes = this.root.getCandidateNodes();
			if (!candidateNodes.length) return;
			if (e.key === "ArrowDown") {
				const firstCandidate = candidateNodes[0];
				this.root.setHighlightedNode(firstCandidate);
			} else if (e.key === "ArrowUp") {
				const lastCandidate = candidateNodes[candidateNodes.length - 1];
				this.root.setHighlightedNode(lastCandidate);
			}
			return;
		}
		if (e.key === "Tab") {
			this.root.handleClose();
			return;
		}
		if ((e.key === "Enter" || e.key === " " && this.#domTypeahead.search === "") && !e.isComposing) {
			e.preventDefault();
			if (this.#handleKeyboardSelection()) return;
		}
		if (e.key === "ArrowUp" && e.altKey) this.root.handleClose();
		if (FIRST_LAST_KEYS.includes(e.key)) {
			e.preventDefault();
			const candidateNodes = this.root.getCandidateNodes();
			const currHighlightedNode = this.root.highlightedNode;
			const currIndex = currHighlightedNode ? candidateNodes.indexOf(currHighlightedNode) : -1;
			const loop = this.root.opts.loop.current;
			let nextItem;
			if (e.key === "ArrowDown") nextItem = next$1(candidateNodes, currIndex, loop);
			else if (e.key === "ArrowUp") nextItem = prev(candidateNodes, currIndex, loop);
			else if (e.key === "PageDown") nextItem = forward(candidateNodes, currIndex, 10, loop);
			else if (e.key === "PageUp") nextItem = backward(candidateNodes, currIndex, 10, loop);
			else if (e.key === "Home") nextItem = candidateNodes[0];
			else if (e.key === "End") nextItem = candidateNodes[candidateNodes.length - 1];
			if (!nextItem) return;
			this.root.setHighlightedNode(nextItem);
			return;
		}
		const isModifierKey = e.ctrlKey || e.altKey || e.metaKey;
		const isCharacterKey = e.key.length === 1;
		const isSpaceKey = e.key === " ";
		const candidateNodes = this.root.getCandidateNodes();
		if (e.key === "Tab") return;
		if (!isModifierKey && (isCharacterKey || isSpaceKey)) {
			if (!this.#domTypeahead.handleTypeaheadSearch(e.key, candidateNodes) && isSpaceKey) {
				e.preventDefault();
				this.#handleKeyboardSelection();
			}
			return;
		}
		if (!this.root.highlightedNode) this.root.setHighlightedToFirstCandidate();
	}
	onclick(e) {
		e.currentTarget.focus();
	}
	onpointerdown(e) {
		if (this.root.opts.disabled.current) return;
		if (e.pointerType === "touch") return e.preventDefault();
		const target = e.target;
		if (target?.hasPointerCapture(e.pointerId)) target?.releasePointerCapture(e.pointerId);
		if (e.button === 0 && e.ctrlKey === false) if (this.root.opts.open.current === false) this.#handlePointerOpen(e);
		else this.root.handleClose();
	}
	onpointerup(e) {
		if (this.root.opts.disabled.current) return;
		e.preventDefault();
		if (e.pointerType === "touch") if (this.root.opts.open.current === false) this.#handlePointerOpen(e);
		else this.root.handleClose();
	}
	#props = user_derived(() => ({
		id: this.opts.id.current,
		disabled: this.root.opts.disabled.current ? true : void 0,
		"aria-haspopup": "listbox",
		"aria-expanded": boolToStr(this.root.opts.open.current),
		"aria-activedescendant": this.root.highlightedId,
		"data-state": getDataOpenClosed(this.root.opts.open.current),
		"data-disabled": boolToEmptyStrOrUndef(this.root.opts.disabled.current),
		"data-placeholder": this.root.hasValue ? void 0 : "",
		[this.root.getBitsAttr("trigger")]: "",
		onpointerdown: this.onpointerdown,
		onkeydown: this.onkeydown,
		onclick: this.onclick,
		onpointerup: this.onpointerup,
		...this.attachment
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
var SelectContentState = class SelectContentState {
	static create(opts) {
		return SelectContentContext.set(new SelectContentState(opts, SelectRootContext.get()));
	}
	opts;
	root;
	attachment;
	#isPositioned = state(false);
	get isPositioned() {
		return get(this.#isPositioned);
	}
	set isPositioned(value) {
		set(this.#isPositioned, value, true);
	}
	domContext;
	constructor(opts, root) {
		this.opts = opts;
		this.root = root;
		this.attachment = attachRef(opts.ref, (v) => this.root.contentNode = v);
		this.domContext = new DOMContext(this.opts.ref);
		if (this.root.domContext === null) this.root.domContext = this.domContext;
		onDestroyEffect(() => {
			this.root.contentNode = null;
			this.root.contentIsPositioned = false;
			this.isPositioned = false;
		});
		watch(() => this.root.opts.open.current, () => {
			if (this.root.opts.open.current) return;
			this.root.contentIsPositioned = false;
			this.isPositioned = false;
		});
		watch([() => this.isPositioned, () => this.root.highlightedNode], () => {
			if (!this.isPositioned || !this.root.highlightedNode) return;
			this.root.scrollHighlightedNodeIntoView(this.root.highlightedNode);
		});
		this.onpointermove = this.onpointermove.bind(this);
	}
	onpointermove(_) {
		this.root.isUsingKeyboard = false;
	}
	#styles = user_derived(() => {
		return getFloatingContentCSSVars(this.root.isCombobox ? "combobox" : "select");
	});
	onInteractOutside = (e) => {
		if (e.target === this.root.triggerNode || e.target === this.root.inputNode) {
			e.preventDefault();
			return;
		}
		this.opts.onInteractOutside.current(e);
		if (e.defaultPrevented) return;
		this.root.handleClose();
	};
	onEscapeKeydown = (e) => {
		this.opts.onEscapeKeydown.current(e);
		if (e.defaultPrevented) return;
		this.root.handleClose();
	};
	onOpenAutoFocus = (e) => {
		e.preventDefault();
	};
	onCloseAutoFocus = (e) => {
		e.preventDefault();
	};
	get shouldRender() {
		return this.root.contentPresence.shouldRender;
	}
	#snippetProps = user_derived(() => ({ open: this.root.opts.open.current }));
	get snippetProps() {
		return get(this.#snippetProps);
	}
	set snippetProps(value) {
		set(this.#snippetProps, value);
	}
	#props = user_derived(() => ({
		id: this.opts.id.current,
		role: "listbox",
		"aria-multiselectable": this.root.isMulti ? "true" : void 0,
		"data-state": getDataOpenClosed(this.root.opts.open.current),
		...getDataTransitionAttrs(this.root.contentPresence.transitionStatus),
		[this.root.getBitsAttr("content")]: "",
		style: {
			display: "flex",
			flexDirection: "column",
			outline: "none",
			boxSizing: "border-box",
			pointerEvents: "auto",
			...get(this.#styles)
		},
		onpointermove: this.onpointermove,
		...this.attachment
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
	popperProps = {
		onInteractOutside: this.onInteractOutside,
		onEscapeKeydown: this.onEscapeKeydown,
		onOpenAutoFocus: this.onOpenAutoFocus,
		onCloseAutoFocus: this.onCloseAutoFocus,
		trapFocus: false,
		loop: false,
		onPlaced: () => {
			if (this.root.opts.open.current) {
				this.root.contentIsPositioned = true;
				this.isPositioned = true;
			}
		}
	};
};
var SelectItemState = class SelectItemState {
	static create(opts) {
		return new SelectItemState(opts, SelectRootContext.get());
	}
	opts;
	root;
	attachment;
	#isSelected = user_derived(() => this.root.includesItem(this.opts.value.current));
	get isSelected() {
		return get(this.#isSelected);
	}
	set isSelected(value) {
		set(this.#isSelected, value);
	}
	#isHighlighted = user_derived(() => this.root.highlightedValue === this.opts.value.current);
	get isHighlighted() {
		return get(this.#isHighlighted);
	}
	set isHighlighted(value) {
		set(this.#isHighlighted, value);
	}
	prevHighlighted = new Previous(() => this.isHighlighted);
	#mounted = state(false);
	get mounted() {
		return get(this.#mounted);
	}
	set mounted(value) {
		set(this.#mounted, value, true);
	}
	constructor(opts, root) {
		this.opts = opts;
		this.root = root;
		this.attachment = attachRef(opts.ref);
		watch([() => this.isHighlighted, () => this.prevHighlighted.current], () => {
			if (this.isHighlighted) this.opts.onHighlight.current();
			else if (this.prevHighlighted.current) this.opts.onUnhighlight.current();
		});
		watch(() => this.mounted, () => {
			if (!this.mounted) return;
			this.root.setInitialHighlightedNode();
		});
		this.onpointerdown = this.onpointerdown.bind(this);
		this.onpointerup = this.onpointerup.bind(this);
		this.onpointermove = this.onpointermove.bind(this);
	}
	handleSelect() {
		if (this.opts.disabled.current) return;
		const isCurrentSelectedValue = this.opts.value.current === this.root.opts.value.current;
		if (!this.root.opts.allowDeselect.current && isCurrentSelectedValue && !this.root.isMulti) {
			this.root.handleClose();
			return;
		}
		this.root.toggleItem(this.opts.value.current, this.opts.label.current);
		if (!this.root.isMulti && !isCurrentSelectedValue) this.root.handleClose();
	}
	#snippetProps = user_derived(() => ({
		selected: this.isSelected,
		highlighted: this.isHighlighted
	}));
	get snippetProps() {
		return get(this.#snippetProps);
	}
	set snippetProps(value) {
		set(this.#snippetProps, value);
	}
	onpointerdown(e) {
		e.preventDefault();
	}
	/**
	* Using `pointerup` instead of `click` allows power users to pointerdown
	* the trigger, then release pointerup on an item to select it vs having to do
	* multiple clicks.
	*/
	onpointerup(e) {
		if (e.defaultPrevented || !this.opts.ref.current) return;
		/**
		* For one reason or another, when it's a touch pointer and _not_ on IOS,
		* we need to listen for the immediate click event to handle the selection,
		* otherwise a click event will fire on the element _behind_ the item.
		*/
		if (e.pointerType === "touch" && !isIOS) {
			on(this.opts.ref.current, "click", () => {
				this.handleSelect();
				this.root.setHighlightedNode(this.opts.ref.current);
			}, { once: true });
			return;
		}
		e.preventDefault();
		this.handleSelect();
		if (e.pointerType === "touch") this.root.setHighlightedNode(this.opts.ref.current);
	}
	onpointermove(e) {
		/**
		* We don't want to highlight items on touch devices when scrolling,
		* as this is confusing behavior, so we return here and instead handle
		* the highlighting on the `pointerup` (or following `click`) event for
		* touch devices only.
		*/
		if (e.pointerType === "touch") return;
		if (this.root.highlightedNode !== this.opts.ref.current) this.root.setHighlightedNode(this.opts.ref.current);
	}
	#props = user_derived(() => ({
		id: this.opts.id.current,
		role: "option",
		"aria-selected": this.root.includesItem(this.opts.value.current) ? "true" : void 0,
		"data-value": this.opts.value.current,
		"data-disabled": boolToEmptyStrOrUndef(this.opts.disabled.current),
		"data-highlighted": this.root.highlightedValue === this.opts.value.current && !this.opts.disabled.current ? "" : void 0,
		"data-selected": this.root.includesItem(this.opts.value.current) ? "" : void 0,
		"data-label": this.opts.label.current,
		[this.root.getBitsAttr("item")]: "",
		onpointermove: this.onpointermove,
		onpointerdown: this.onpointerdown,
		onpointerup: this.onpointerup,
		...this.attachment
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
var SelectHiddenInputState = class SelectHiddenInputState {
	static create(opts) {
		return new SelectHiddenInputState(opts, SelectRootContext.get());
	}
	opts;
	root;
	#shouldRender = user_derived(() => this.root.opts.name.current !== "");
	get shouldRender() {
		return get(this.#shouldRender);
	}
	set shouldRender(value) {
		set(this.#shouldRender, value);
	}
	constructor(opts, root) {
		this.opts = opts;
		this.root = root;
		this.onfocus = this.onfocus.bind(this);
	}
	onfocus(e) {
		e.preventDefault();
		if (!this.root.isCombobox) this.root.triggerNode?.focus();
		else this.root.inputNode?.focus();
	}
	#props = user_derived(() => ({
		disabled: boolToTrueOrUndef(this.root.opts.disabled.current),
		required: boolToTrueOrUndef(this.root.opts.required.current),
		name: this.root.opts.name.current,
		value: this.opts.value.current,
		onfocus: this.onfocus
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
var SelectViewportState = class SelectViewportState {
	static create(opts) {
		return new SelectViewportState(opts, SelectContentContext.get());
	}
	opts;
	content;
	root;
	attachment;
	#prevScrollTop = state(0);
	get prevScrollTop() {
		return get(this.#prevScrollTop);
	}
	set prevScrollTop(value) {
		set(this.#prevScrollTop, value, true);
	}
	constructor(opts, content) {
		this.opts = opts;
		this.content = content;
		this.root = content.root;
		this.attachment = attachRef(opts.ref, (v) => {
			this.root.viewportNode = v;
		});
	}
	#props = user_derived(() => ({
		id: this.opts.id.current,
		role: "presentation",
		[this.root.getBitsAttr("viewport")]: "",
		style: {
			position: "relative",
			flex: 1,
			overflow: "auto"
		},
		...this.attachment
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
var SelectScrollButtonImplState = class {
	opts;
	content;
	root;
	attachment;
	autoScrollTimer = null;
	userScrollTimer = -1;
	isUserScrolling = false;
	onAutoScroll = noop$1;
	#mounted = state(false);
	get mounted() {
		return get(this.#mounted);
	}
	set mounted(value) {
		set(this.#mounted, value, true);
	}
	constructor(opts, content) {
		this.opts = opts;
		this.content = content;
		this.root = content.root;
		this.attachment = attachRef(opts.ref);
		watch([() => this.mounted], () => {
			if (!this.mounted) {
				this.isUserScrolling = false;
				return;
			}
			if (this.isUserScrolling) return;
		});
		user_effect(() => {
			if (this.mounted) return;
			this.clearAutoScrollInterval();
		});
		this.onpointerdown = this.onpointerdown.bind(this);
		this.onpointermove = this.onpointermove.bind(this);
		this.onpointerleave = this.onpointerleave.bind(this);
	}
	handleUserScroll() {
		this.content.domContext.clearTimeout(this.userScrollTimer);
		this.isUserScrolling = true;
		this.userScrollTimer = this.content.domContext.setTimeout(() => {
			this.isUserScrolling = false;
		}, 200);
	}
	clearAutoScrollInterval() {
		if (this.autoScrollTimer === null) return;
		this.content.domContext.clearTimeout(this.autoScrollTimer);
		this.autoScrollTimer = null;
	}
	onpointerdown(_) {
		if (this.autoScrollTimer !== null) return;
		const autoScroll = (tick) => {
			this.onAutoScroll();
			this.autoScrollTimer = this.content.domContext.setTimeout(() => autoScroll(tick + 1), this.opts.delay.current(tick));
		};
		this.autoScrollTimer = this.content.domContext.setTimeout(() => autoScroll(1), this.opts.delay.current(0));
	}
	onpointermove(e) {
		this.onpointerdown(e);
	}
	onpointerleave(_) {
		this.clearAutoScrollInterval();
	}
	#props = user_derived(() => ({
		id: this.opts.id.current,
		"aria-hidden": boolToStrTrueOrUndef(true),
		style: { flexShrink: 0 },
		onpointerdown: this.onpointerdown,
		onpointermove: this.onpointermove,
		onpointerleave: this.onpointerleave,
		...this.attachment
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
var SelectScrollDownButtonState = class SelectScrollDownButtonState {
	static create(opts) {
		return new SelectScrollDownButtonState(new SelectScrollButtonImplState(opts, SelectContentContext.get()));
	}
	scrollButtonState;
	content;
	root;
	#canScrollDown = state(false);
	get canScrollDown() {
		return get(this.#canScrollDown);
	}
	set canScrollDown(value) {
		set(this.#canScrollDown, value, true);
	}
	scrollIntoViewTimer = null;
	constructor(scrollButtonState) {
		this.scrollButtonState = scrollButtonState;
		this.content = scrollButtonState.content;
		this.root = scrollButtonState.root;
		this.scrollButtonState.onAutoScroll = this.handleAutoScroll;
		watch([() => this.root.viewportNode, () => this.content.isPositioned], () => {
			if (!this.root.viewportNode || !this.content.isPositioned) return;
			this.handleScroll(true);
			return on(this.root.viewportNode, "scroll", () => this.handleScroll());
		});
		/**
		* If the input value changes, this means that the filtered items may have changed,
		* so we need to re-evaluate the scroll-ability of the list.
		*/
		watch([
			() => this.root.opts.inputValue.current,
			() => this.root.viewportNode,
			() => this.content.isPositioned
		], () => {
			if (!this.root.viewportNode || !this.content.isPositioned) return;
			this.handleScroll(true);
		});
		watch(() => this.scrollButtonState.mounted, () => {
			if (!this.scrollButtonState.mounted) return;
			if (this.scrollIntoViewTimer) clearTimeout(this.scrollIntoViewTimer);
			this.scrollIntoViewTimer = afterSleep(5, () => {
				const activeItem = this.root.highlightedNode;
				if (!activeItem) return;
				this.root.scrollHighlightedNodeIntoView(activeItem);
			});
		});
	}
	/**
	* @param manual - if true, it means the function was invoked manually outside of an event
	* listener, so we don't call `handleUserScroll` to prevent the auto scroll from kicking in.
	*/
	handleScroll = (manual = false) => {
		if (!manual) this.scrollButtonState.handleUserScroll();
		if (!this.root.viewportNode) return;
		const maxScroll = this.root.viewportNode.scrollHeight - this.root.viewportNode.clientHeight;
		const paddingTop = Number.parseInt(getComputedStyle(this.root.viewportNode).paddingTop, 10);
		this.canScrollDown = Math.ceil(this.root.viewportNode.scrollTop) < maxScroll - paddingTop;
	};
	handleAutoScroll = () => {
		const viewport = this.root.viewportNode;
		const selectedItem = this.root.highlightedNode;
		if (!viewport || !selectedItem) return;
		viewport.scrollTop = viewport.scrollTop + selectedItem.offsetHeight;
	};
	#props = user_derived(() => ({
		...this.scrollButtonState.props,
		[this.root.getBitsAttr("scroll-down-button")]: ""
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
var SelectScrollUpButtonState = class SelectScrollUpButtonState {
	static create(opts) {
		return new SelectScrollUpButtonState(new SelectScrollButtonImplState(opts, SelectContentContext.get()));
	}
	scrollButtonState;
	content;
	root;
	#canScrollUp = state(false);
	get canScrollUp() {
		return get(this.#canScrollUp);
	}
	set canScrollUp(value) {
		set(this.#canScrollUp, value, true);
	}
	constructor(scrollButtonState) {
		this.scrollButtonState = scrollButtonState;
		this.content = scrollButtonState.content;
		this.root = scrollButtonState.root;
		this.scrollButtonState.onAutoScroll = this.handleAutoScroll;
		watch([() => this.root.viewportNode, () => this.content.isPositioned], () => {
			if (!this.root.viewportNode || !this.content.isPositioned) return;
			this.handleScroll(true);
			return on(this.root.viewportNode, "scroll", () => this.handleScroll());
		});
	}
	/**
	* @param manual - if true, it means the function was invoked manually outside of an event
	* listener, so we don't call `handleUserScroll` to prevent the auto scroll from kicking in.
	*/
	handleScroll = (manual = false) => {
		if (!manual) this.scrollButtonState.handleUserScroll();
		if (!this.root.viewportNode) return;
		const paddingTop = Number.parseInt(getComputedStyle(this.root.viewportNode).paddingTop, 10);
		this.canScrollUp = this.root.viewportNode.scrollTop - paddingTop > .1;
	};
	handleAutoScroll = () => {
		if (!this.root.viewportNode || !this.root.highlightedNode) return;
		this.root.viewportNode.scrollTop = this.root.viewportNode.scrollTop - this.root.highlightedNode.offsetHeight;
	};
	#props = user_derived(() => ({
		...this.scrollButtonState.props,
		[this.root.getBitsAttr("scroll-up-button")]: ""
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
//#endregion
//#region node_modules/bits-ui/dist/bits/select/components/select-hidden-input.svelte
function Select_hidden_input($$anchor, $$props) {
	push($$props, true);
	let value = prop($$props, "value", 15);
	const hiddenInputState = SelectHiddenInputState.create({ value: boxWith(() => value()) });
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		Hidden_input($$anchor, spread_props(() => hiddenInputState.props, {
			get autocomplete() {
				return $$props.autocomplete;
			},
			get value() {
				return value();
			},
			set value($$value) {
				value($$value);
			}
		}));
	};
	if_block(node, ($$render) => {
		if (hiddenInputState.shouldRender) $$render(consequent);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/utilities/floating-layer/components/floating-layer-anchor.svelte
function Floating_layer_anchor($$anchor, $$props) {
	push($$props, true);
	let tooltip = prop($$props, "tooltip", 3, false);
	FloatingAnchorState.create({
		id: boxWith(() => $$props.id),
		virtualEl: boxWith(() => $$props.virtualEl),
		ref: $$props.ref
	}, tooltip());
	var fragment = comment();
	snippet(first_child(fragment), () => $$props.children ?? noop);
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/select/components/select-content.svelte
var root_4$23 = from_html(`<div><div><!></div></div>`);
var root_8$7 = from_html(`<div><div><!></div></div>`);
function Select_content$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), forceMount = prop($$props, "forceMount", 3, false), side = prop($$props, "side", 3, "bottom"), onInteractOutside = prop($$props, "onInteractOutside", 3, noop$1), onEscapeKeydown = prop($$props, "onEscapeKeydown", 3, noop$1), preventScroll = prop($$props, "preventScroll", 3, false), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"id",
		"ref",
		"forceMount",
		"side",
		"onInteractOutside",
		"onEscapeKeydown",
		"children",
		"child",
		"preventScroll",
		"style"
	]);
	const contentState = SelectContentState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v)),
		onInteractOutside: boxWith(() => onInteractOutside()),
		onEscapeKeydown: boxWith(() => onEscapeKeydown())
	});
	const mergedProps = user_derived(() => mergeProps(restProps, contentState.props));
	var fragment = comment();
	var node = first_child(fragment);
	var consequent_1 = ($$anchor) => {
		{
			const popper = ($$anchor, $$arg0) => {
				let props = () => $$arg0?.().props;
				let wrapperProps = () => $$arg0?.().wrapperProps;
				const finalProps = user_derived(() => mergeProps(props(), { style: contentState.props.style }, { style: $$props.style }));
				var fragment_2 = comment();
				var node_1 = first_child(fragment_2);
				var consequent = ($$anchor) => {
					var fragment_3 = comment();
					var node_2 = first_child(fragment_3);
					{
						let $0 = user_derived(() => ({
							props: get(finalProps),
							wrapperProps: wrapperProps(),
							...contentState.snippetProps
						}));
						snippet(node_2, () => $$props.child, () => get($0));
					}
					append($$anchor, fragment_3);
				};
				var alternate = ($$anchor) => {
					var div = root_4$23();
					attribute_effect(div, () => ({ ...wrapperProps() }));
					var div_1 = child(div);
					attribute_effect(div_1, () => ({ ...get(finalProps) }));
					snippet(child(div_1), () => $$props.children ?? noop);
					reset(div_1);
					reset(div);
					append($$anchor, div);
				};
				if_block(node_1, ($$render) => {
					if ($$props.child) $$render(consequent);
					else $$render(alternate, -1);
				});
				append($$anchor, fragment_2);
			};
			Popper_layer_force_mount($$anchor, spread_props(() => get(mergedProps), () => contentState.popperProps, {
				get ref() {
					return contentState.opts.ref;
				},
				get side() {
					return side();
				},
				get enabled() {
					return contentState.root.opts.open.current;
				},
				get id() {
					return id();
				},
				get preventScroll() {
					return preventScroll();
				},
				forceMount: true,
				get shouldRender() {
					return contentState.shouldRender;
				},
				popper,
				$$slots: { popper: true }
			}));
		}
	};
	var consequent_3 = ($$anchor) => {
		{
			const popper = ($$anchor, $$arg0) => {
				let props = () => $$arg0?.().props;
				let wrapperProps = () => $$arg0?.().wrapperProps;
				const finalProps = user_derived(() => mergeProps(props(), { style: contentState.props.style }, { style: $$props.style }));
				var fragment_5 = comment();
				var node_4 = first_child(fragment_5);
				var consequent_2 = ($$anchor) => {
					var fragment_6 = comment();
					var node_5 = first_child(fragment_6);
					{
						let $0 = user_derived(() => ({
							props: get(finalProps),
							wrapperProps: wrapperProps(),
							...contentState.snippetProps
						}));
						snippet(node_5, () => $$props.child, () => get($0));
					}
					append($$anchor, fragment_6);
				};
				var alternate_1 = ($$anchor) => {
					var div_2 = root_8$7();
					attribute_effect(div_2, () => ({ ...wrapperProps() }));
					var div_3 = child(div_2);
					attribute_effect(div_3, () => ({ ...get(finalProps) }));
					snippet(child(div_3), () => $$props.children ?? noop);
					reset(div_3);
					reset(div_2);
					append($$anchor, div_2);
				};
				if_block(node_4, ($$render) => {
					if ($$props.child) $$render(consequent_2);
					else $$render(alternate_1, -1);
				});
				append($$anchor, fragment_5);
			};
			Popper_layer($$anchor, spread_props(() => get(mergedProps), () => contentState.popperProps, {
				get ref() {
					return contentState.opts.ref;
				},
				get side() {
					return side();
				},
				get open() {
					return contentState.root.opts.open.current;
				},
				get id() {
					return id();
				},
				get preventScroll() {
					return preventScroll();
				},
				forceMount: false,
				get shouldRender() {
					return contentState.shouldRender;
				},
				popper,
				$$slots: { popper: true }
			}));
		}
	};
	if_block(node, ($$render) => {
		if (forceMount()) $$render(consequent_1);
		else if (!forceMount()) $$render(consequent_3, 1);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/utilities/mounted.svelte
function Mounted($$anchor, $$props) {
	push($$props, true);
	let mounted = prop($$props, "mounted", 15, false), onMountedChange = prop($$props, "onMountedChange", 3, noop$1);
	onMountEffect(() => {
		mounted(true);
		onMountedChange()(true);
		return () => {
			mounted(false);
			onMountedChange()(false);
		};
	});
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/select/components/select-item.svelte
var root_2$56 = from_html(`<div><!></div>`);
var root$63 = from_html(`<!> <!>`, 1);
function Select_item$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), label = prop($$props, "label", 19, () => $$props.value), disabled = prop($$props, "disabled", 3, false), onHighlight = prop($$props, "onHighlight", 3, noop$1), onUnhighlight = prop($$props, "onUnhighlight", 3, noop$1), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"id",
		"ref",
		"value",
		"label",
		"disabled",
		"children",
		"child",
		"onHighlight",
		"onUnhighlight"
	]);
	const itemState = SelectItemState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v)),
		value: boxWith(() => $$props.value),
		disabled: boxWith(() => disabled()),
		label: boxWith(() => label()),
		onHighlight: boxWith(() => onHighlight()),
		onUnhighlight: boxWith(() => onUnhighlight())
	});
	const mergedProps = user_derived(() => mergeProps(restProps, itemState.props));
	var fragment = root$63();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		var fragment_1 = comment();
		var node_1 = first_child(fragment_1);
		{
			let $0 = user_derived(() => ({
				props: get(mergedProps),
				...itemState.snippetProps
			}));
			snippet(node_1, () => $$props.child, () => get($0));
		}
		append($$anchor, fragment_1);
	};
	var alternate = ($$anchor) => {
		var div = root_2$56();
		attribute_effect(div, () => ({ ...get(mergedProps) }));
		snippet(child(div), () => $$props.children ?? noop, () => itemState.snippetProps);
		reset(div);
		append($$anchor, div);
	};
	if_block(node, ($$render) => {
		if ($$props.child) $$render(consequent);
		else $$render(alternate, -1);
	});
	Mounted(sibling(node, 2), {
		get mounted() {
			return itemState.mounted;
		},
		set mounted($$value) {
			itemState.mounted = $$value;
		}
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/select/components/select-viewport.svelte
var root_2$55 = from_html(`<div><!></div>`);
function Select_viewport($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"id",
		"ref",
		"children",
		"child"
	]);
	const viewportState = SelectViewportState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v))
	});
	const mergedProps = user_derived(() => mergeProps(restProps, viewportState.props));
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		var fragment_1 = comment();
		snippet(first_child(fragment_1), () => $$props.child, () => ({ props: get(mergedProps) }));
		append($$anchor, fragment_1);
	};
	var alternate = ($$anchor) => {
		var div = root_2$55();
		attribute_effect(div, () => ({ ...get(mergedProps) }));
		snippet(child(div), () => $$props.children ?? noop);
		reset(div);
		append($$anchor, div);
	};
	if_block(node, ($$render) => {
		if ($$props.child) $$render(consequent);
		else $$render(alternate, -1);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/select/components/select-scroll-down-button.svelte
var root_3$36 = from_html(`<div><!></div>`);
var root_1$43 = from_html(`<!> <!>`, 1);
function Select_scroll_down_button$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), delay = prop($$props, "delay", 3, () => 50), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"id",
		"ref",
		"delay",
		"child",
		"children"
	]);
	const scrollButtonState = SelectScrollDownButtonState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v)),
		delay: boxWith(() => delay())
	});
	const mergedProps = user_derived(() => mergeProps(restProps, scrollButtonState.props));
	var fragment = comment();
	var node = first_child(fragment);
	var consequent_1 = ($$anchor) => {
		var fragment_1 = root_1$43();
		var node_1 = first_child(fragment_1);
		Mounted(node_1, {
			get mounted() {
				return scrollButtonState.scrollButtonState.mounted;
			},
			set mounted($$value) {
				scrollButtonState.scrollButtonState.mounted = $$value;
			}
		});
		var node_2 = sibling(node_1, 2);
		var consequent = ($$anchor) => {
			var fragment_2 = comment();
			snippet(first_child(fragment_2), () => $$props.child, () => ({ props: restProps }));
			append($$anchor, fragment_2);
		};
		var alternate = ($$anchor) => {
			var div = root_3$36();
			attribute_effect(div, () => ({ ...get(mergedProps) }));
			snippet(child(div), () => $$props.children ?? noop);
			reset(div);
			append($$anchor, div);
		};
		if_block(node_2, ($$render) => {
			if ($$props.child) $$render(consequent);
			else $$render(alternate, -1);
		});
		append($$anchor, fragment_1);
	};
	if_block(node, ($$render) => {
		if (scrollButtonState.canScrollDown) $$render(consequent_1);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/select/components/select-scroll-up-button.svelte
var root_3$35 = from_html(`<div><!></div>`);
var root_1$42 = from_html(`<!> <!>`, 1);
function Select_scroll_up_button$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), delay = prop($$props, "delay", 3, () => 50), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"id",
		"ref",
		"delay",
		"child",
		"children"
	]);
	const scrollButtonState = SelectScrollUpButtonState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v)),
		delay: boxWith(() => delay())
	});
	const mergedProps = user_derived(() => mergeProps(restProps, scrollButtonState.props));
	var fragment = comment();
	var node = first_child(fragment);
	var consequent_1 = ($$anchor) => {
		var fragment_1 = root_1$42();
		var node_1 = first_child(fragment_1);
		Mounted(node_1, {
			get mounted() {
				return scrollButtonState.scrollButtonState.mounted;
			},
			set mounted($$value) {
				scrollButtonState.scrollButtonState.mounted = $$value;
			}
		});
		var node_2 = sibling(node_1, 2);
		var consequent = ($$anchor) => {
			var fragment_2 = comment();
			snippet(first_child(fragment_2), () => $$props.child, () => ({ props: restProps }));
			append($$anchor, fragment_2);
		};
		var alternate = ($$anchor) => {
			var div = root_3$35();
			attribute_effect(div, () => ({ ...get(mergedProps) }));
			snippet(child(div), () => $$props.children ?? noop);
			reset(div);
			append($$anchor, div);
		};
		if_block(node_2, ($$render) => {
			if ($$props.child) $$render(consequent);
			else $$render(alternate, -1);
		});
		append($$anchor, fragment_1);
	};
	if_block(node, ($$render) => {
		if (scrollButtonState.canScrollUp) $$render(consequent_1);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/label/label.svelte.js
var labelAttrs = createBitsAttrs({
	component: "label",
	parts: ["root"]
});
var LabelRootState = class LabelRootState {
	static create(opts) {
		return new LabelRootState(opts);
	}
	opts;
	attachment;
	constructor(opts) {
		this.opts = opts;
		this.attachment = attachRef(this.opts.ref);
		this.onmousedown = this.onmousedown.bind(this);
	}
	onmousedown(e) {
		if (e.detail > 1) e.preventDefault();
	}
	#props = user_derived(() => ({
		id: this.opts.id.current,
		[labelAttrs.root]: "",
		onmousedown: this.onmousedown,
		...this.attachment
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
//#endregion
//#region node_modules/bits-ui/dist/bits/label/components/label.svelte
var root_2$54 = from_html(`<label><!></label>`);
function Label$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"children",
		"child",
		"id",
		"ref",
		"for"
	]);
	const rootState = LabelRootState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v))
	});
	const mergedProps = user_derived(() => mergeProps(restProps, rootState.props, { for: $$props.for }));
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		var fragment_1 = comment();
		snippet(first_child(fragment_1), () => $$props.child, () => ({ props: get(mergedProps) }));
		append($$anchor, fragment_1);
	};
	var alternate = ($$anchor) => {
		var label = root_2$54();
		attribute_effect(label, () => ({
			...get(mergedProps),
			for: $$props.for
		}));
		snippet(child(label), () => $$props.children ?? noop);
		reset(label);
		append($$anchor, label);
	};
	if_block(node, ($$render) => {
		if ($$props.child) $$render(consequent);
		else $$render(alternate, -1);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/internal/svelte-resize-observer.svelte.js
var SvelteResizeObserver = class {
	#node;
	#onResize;
	constructor(node, onResize) {
		this.#node = node;
		this.#onResize = onResize;
		this.handler = this.handler.bind(this);
		user_effect(this.handler);
	}
	handler() {
		let rAF = 0;
		const _node = this.#node();
		if (!_node) return;
		const resizeObserver = new ResizeObserver(() => {
			cancelAnimationFrame(rAF);
			rAF = window.requestAnimationFrame(this.#onResize);
		});
		resizeObserver.observe(_node);
		return () => {
			window.cancelAnimationFrame(rAF);
			resizeObserver.unobserve(_node);
		};
	}
};
//#endregion
//#region node_modules/bits-ui/dist/bits/radio-group/radio-group.svelte.js
var radioGroupAttrs = createBitsAttrs({
	component: "radio-group",
	parts: ["root", "item"]
});
var RadioGroupRootContext = new Context("RadioGroup.Root");
var RadioGroupRootState = class RadioGroupRootState {
	static create(opts) {
		return RadioGroupRootContext.set(new RadioGroupRootState(opts));
	}
	opts;
	#hasValue = user_derived(() => this.opts.value.current !== "");
	get hasValue() {
		return get(this.#hasValue);
	}
	set hasValue(value) {
		set(this.#hasValue, value);
	}
	rovingFocusGroup;
	attachment;
	constructor(opts) {
		this.opts = opts;
		this.attachment = attachRef(this.opts.ref);
		this.rovingFocusGroup = new RovingFocusGroup({
			rootNode: this.opts.ref,
			candidateAttr: radioGroupAttrs.item,
			loop: this.opts.loop,
			orientation: this.opts.orientation
		});
	}
	isChecked(value) {
		return this.opts.value.current === value;
	}
	setValue(value) {
		this.opts.value.current = value;
	}
	#props = user_derived(() => ({
		id: this.opts.id.current,
		role: "radiogroup",
		"aria-required": boolToStr(this.opts.required.current),
		"aria-disabled": boolToStr(this.opts.disabled.current),
		"aria-readonly": this.opts.readonly.current ? "true" : void 0,
		"data-disabled": boolToEmptyStrOrUndef(this.opts.disabled.current),
		"data-readonly": boolToEmptyStrOrUndef(this.opts.readonly.current),
		"data-orientation": this.opts.orientation.current,
		[radioGroupAttrs.root]: "",
		...this.attachment
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
var RadioGroupItemState = class RadioGroupItemState {
	static create(opts) {
		return new RadioGroupItemState(opts, RadioGroupRootContext.get());
	}
	opts;
	root;
	attachment;
	#checked = user_derived(() => this.root.opts.value.current === this.opts.value.current);
	get checked() {
		return get(this.#checked);
	}
	set checked(value) {
		set(this.#checked, value);
	}
	#isDisabled = user_derived(() => this.opts.disabled.current || this.root.opts.disabled.current);
	#isReadonly = user_derived(() => this.root.opts.readonly.current);
	#isChecked = user_derived(() => this.root.isChecked(this.opts.value.current));
	#tabIndex = state(-1);
	constructor(opts, root) {
		this.opts = opts;
		this.root = root;
		this.attachment = attachRef(this.opts.ref);
		if (this.opts.value.current === this.root.opts.value.current) {
			this.root.rovingFocusGroup.setCurrentTabStopId(this.opts.id.current);
			set(this.#tabIndex, 0);
		} else if (!this.root.opts.value.current) set(this.#tabIndex, 0);
		user_effect(() => {
			set(this.#tabIndex, this.root.rovingFocusGroup.getTabIndex(this.opts.ref.current), true);
		});
		watch([() => this.opts.value.current, () => this.root.opts.value.current], () => {
			if (this.opts.value.current === this.root.opts.value.current) {
				this.root.rovingFocusGroup.setCurrentTabStopId(this.opts.id.current);
				set(this.#tabIndex, 0);
			}
		});
		this.onclick = this.onclick.bind(this);
		this.onkeydown = this.onkeydown.bind(this);
		this.onfocus = this.onfocus.bind(this);
	}
	onclick(_) {
		if (this.opts.disabled.current || get(this.#isReadonly)) return;
		this.root.setValue(this.opts.value.current);
	}
	onfocus(_) {
		if (!this.root.hasValue || get(this.#isReadonly)) return;
		this.root.setValue(this.opts.value.current);
	}
	onkeydown(e) {
		if (get(this.#isDisabled)) return;
		if (e.key === " ") {
			e.preventDefault();
			if (!get(this.#isReadonly)) this.root.setValue(this.opts.value.current);
			return;
		}
		this.root.rovingFocusGroup.handleKeydown(this.opts.ref.current, e, true);
	}
	#snippetProps = user_derived(() => ({ checked: get(this.#isChecked) }));
	get snippetProps() {
		return get(this.#snippetProps);
	}
	set snippetProps(value) {
		set(this.#snippetProps, value);
	}
	#props = user_derived(() => ({
		id: this.opts.id.current,
		disabled: get(this.#isDisabled) ? true : void 0,
		"data-value": this.opts.value.current,
		"data-orientation": this.root.opts.orientation.current,
		"data-disabled": boolToEmptyStrOrUndef(get(this.#isDisabled)),
		"data-readonly": boolToEmptyStrOrUndef(get(this.#isReadonly)),
		"data-state": get(this.#isChecked) ? "checked" : "unchecked",
		"aria-checked": getAriaChecked(get(this.#isChecked), false),
		[radioGroupAttrs.item]: "",
		type: "button",
		role: "radio",
		tabindex: get(this.#tabIndex),
		onkeydown: this.onkeydown,
		onfocus: this.onfocus,
		onclick: this.onclick,
		...this.attachment
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
var RadioGroupInputState = class RadioGroupInputState {
	static create() {
		return new RadioGroupInputState(RadioGroupRootContext.get());
	}
	root;
	#shouldRender = user_derived(() => this.root.opts.name.current !== void 0);
	get shouldRender() {
		return get(this.#shouldRender);
	}
	set shouldRender(value) {
		set(this.#shouldRender, value);
	}
	constructor(root) {
		this.root = root;
		this.onfocus = this.onfocus.bind(this);
	}
	onfocus(_) {
		this.root.rovingFocusGroup.focusCurrentTabStop();
	}
	#props = user_derived(() => ({
		name: this.root.opts.name.current,
		value: this.root.opts.value.current,
		required: this.root.opts.required.current,
		disabled: this.root.opts.disabled.current,
		onfocus: this.onfocus
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
//#endregion
//#region node_modules/bits-ui/dist/bits/radio-group/components/radio-group-input.svelte
function Radio_group_input($$anchor, $$props) {
	push($$props, false);
	const inputState = RadioGroupInputState.create();
	init();
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		Hidden_input($$anchor, spread_props(() => inputState.props));
	};
	if_block(node, ($$render) => {
		if (inputState.shouldRender) $$render(consequent);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/radio-group/components/radio-group.svelte
var root_2$53 = from_html(`<div><!></div>`);
var root$62 = from_html(`<!> <!>`, 1);
function Radio_group$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let disabled = prop($$props, "disabled", 3, false), value = prop($$props, "value", 15, ""), ref = prop($$props, "ref", 15, null), orientation = prop($$props, "orientation", 3, "vertical"), loop = prop($$props, "loop", 3, true), name = prop($$props, "name", 3, void 0), required = prop($$props, "required", 3, false), readonly = prop($$props, "readonly", 3, false), id = prop($$props, "id", 19, () => createId(uid)), onValueChange = prop($$props, "onValueChange", 3, noop$1), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"disabled",
		"children",
		"child",
		"value",
		"ref",
		"orientation",
		"loop",
		"name",
		"required",
		"readonly",
		"id",
		"onValueChange"
	]);
	const rootState = RadioGroupRootState.create({
		orientation: boxWith(() => orientation()),
		disabled: boxWith(() => disabled()),
		loop: boxWith(() => loop()),
		name: boxWith(() => name()),
		required: boxWith(() => required()),
		readonly: boxWith(() => readonly()),
		id: boxWith(() => id()),
		value: boxWith(() => value(), (v) => {
			if (v === value()) return;
			value(v);
			onValueChange()?.(v);
		}),
		ref: boxWith(() => ref(), (v) => ref(v))
	});
	const mergedProps = user_derived(() => mergeProps(restProps, rootState.props));
	var fragment = root$62();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		var fragment_1 = comment();
		snippet(first_child(fragment_1), () => $$props.child, () => ({ props: get(mergedProps) }));
		append($$anchor, fragment_1);
	};
	var alternate = ($$anchor) => {
		var div = root_2$53();
		attribute_effect(div, () => ({ ...get(mergedProps) }));
		snippet(child(div), () => $$props.children ?? noop);
		reset(div);
		append($$anchor, div);
	};
	if_block(node, ($$render) => {
		if ($$props.child) $$render(consequent);
		else $$render(alternate, -1);
	});
	Radio_group_input(sibling(node, 2), {});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/radio-group/components/radio-group-item.svelte
var root_2$52 = from_html(`<button><!></button>`);
function Radio_group_item$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), disabled = prop($$props, "disabled", 3, false), ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"id",
		"children",
		"child",
		"value",
		"disabled",
		"ref"
	]);
	const itemState = RadioGroupItemState.create({
		value: boxWith(() => $$props.value),
		disabled: boxWith(() => disabled() ?? false),
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v))
	});
	const mergedProps = user_derived(() => mergeProps(restProps, itemState.props));
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		var fragment_1 = comment();
		var node_1 = first_child(fragment_1);
		{
			let $0 = user_derived(() => ({
				props: get(mergedProps),
				...itemState.snippetProps
			}));
			snippet(node_1, () => $$props.child, () => get($0));
		}
		append($$anchor, fragment_1);
	};
	var alternate = ($$anchor) => {
		var button = root_2$52();
		attribute_effect(button, () => ({ ...get(mergedProps) }));
		snippet(child(button), () => $$props.children ?? noop, () => itemState.snippetProps);
		reset(button);
		append($$anchor, button);
	};
	if_block(node, ($$render) => {
		if ($$props.child) $$render(consequent);
		else $$render(alternate, -1);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/select/components/select.svelte
var root$61 = from_html(`<!> <!>`, 1);
function Select$1($$anchor, $$props) {
	push($$props, true);
	let value = prop($$props, "value", 15), onValueChange = prop($$props, "onValueChange", 3, noop$1), name = prop($$props, "name", 3, ""), disabled = prop($$props, "disabled", 3, false), open = prop($$props, "open", 15, false), onOpenChange = prop($$props, "onOpenChange", 3, noop$1), onOpenChangeComplete = prop($$props, "onOpenChangeComplete", 3, noop$1), loop = prop($$props, "loop", 3, false), scrollAlignment = prop($$props, "scrollAlignment", 3, "nearest"), required = prop($$props, "required", 3, false), items = prop($$props, "items", 19, () => []), allowDeselect = prop($$props, "allowDeselect", 3, false);
	function handleDefaultValue() {
		if (value() !== void 0) return;
		value($$props.type === "single" ? "" : []);
	}
	handleDefaultValue();
	watch.pre(() => value(), () => {
		handleDefaultValue();
	});
	let inputValue = state("");
	const rootState = SelectRootState.create({
		type: $$props.type,
		value: boxWith(() => value(), (v) => {
			value(v);
			onValueChange()(v);
		}),
		disabled: boxWith(() => disabled()),
		required: boxWith(() => required()),
		open: boxWith(() => open(), (v) => {
			open(v);
			onOpenChange()(v);
		}),
		loop: boxWith(() => loop()),
		scrollAlignment: boxWith(() => scrollAlignment()),
		name: boxWith(() => name()),
		isCombobox: false,
		items: boxWith(() => items()),
		allowDeselect: boxWith(() => allowDeselect()),
		inputValue: boxWith(() => get(inputValue), (v) => set(inputValue, v, true)),
		onOpenChangeComplete: boxWith(() => onOpenChangeComplete())
	});
	var fragment = root$61();
	var node = first_child(fragment);
	Floating_layer(node, {
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = comment();
			snippet(first_child(fragment_1), () => $$props.children ?? noop);
			append($$anchor, fragment_1);
		},
		$$slots: { default: true }
	});
	var node_2 = sibling(node, 2);
	var consequent_1 = ($$anchor) => {
		var fragment_2 = comment();
		var node_3 = first_child(fragment_2);
		var consequent = ($$anchor) => {
			Select_hidden_input($$anchor, { get autocomplete() {
				return $$props.autocomplete;
			} });
		};
		var alternate = ($$anchor) => {
			var fragment_4 = comment();
			each(first_child(fragment_4), 16, () => rootState.opts.value.current, (item) => item, ($$anchor, item) => {
				Select_hidden_input($$anchor, {
					get value() {
						return item;
					},
					get autocomplete() {
						return $$props.autocomplete;
					}
				});
			});
			append($$anchor, fragment_4);
		};
		if_block(node_3, ($$render) => {
			if (rootState.opts.value.current.length === 0) $$render(consequent);
			else $$render(alternate, -1);
		});
		append($$anchor, fragment_2);
	};
	var d = user_derived(() => Array.isArray(rootState.opts.value.current));
	var alternate_1 = ($$anchor) => {
		Select_hidden_input($$anchor, {
			get autocomplete() {
				return $$props.autocomplete;
			},
			get value() {
				return rootState.opts.value.current;
			},
			set value($$value) {
				rootState.opts.value.current = $$value;
			}
		});
	};
	if_block(node_2, ($$render) => {
		if (get(d)) $$render(consequent_1);
		else $$render(alternate_1, -1);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/select/components/select-trigger.svelte
var root_3$34 = from_html(`<button><!></button>`);
function Select_trigger$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), type = prop($$props, "type", 3, "button"), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"id",
		"ref",
		"child",
		"children",
		"type"
	]);
	const triggerState = SelectTriggerState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v))
	});
	const mergedProps = user_derived(() => mergeProps(restProps, triggerState.props, { type: type() }));
	var fragment = comment();
	component(first_child(fragment), () => Floating_layer_anchor, ($$anchor, FloatingLayer_Anchor) => {
		FloatingLayer_Anchor($$anchor, {
			get id() {
				return id();
			},
			get ref() {
				return triggerState.opts.ref;
			},
			children: ($$anchor, $$slotProps) => {
				var fragment_1 = comment();
				var node_1 = first_child(fragment_1);
				var consequent = ($$anchor) => {
					var fragment_2 = comment();
					snippet(first_child(fragment_2), () => $$props.child, () => ({ props: get(mergedProps) }));
					append($$anchor, fragment_2);
				};
				var alternate = ($$anchor) => {
					var button = root_3$34();
					attribute_effect(button, () => ({ ...get(mergedProps) }));
					snippet(child(button), () => $$props.children ?? noop);
					reset(button);
					append($$anchor, button);
				};
				if_block(node_1, ($$render) => {
					if ($$props.child) $$render(consequent);
					else $$render(alternate, -1);
				});
				append($$anchor, fragment_1);
			},
			$$slots: { default: true }
		});
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/slider/helpers.js
function getRangeStyles(direction, min, max) {
	const styles = { position: "absolute" };
	if (direction === "lr") {
		styles.left = `${min}%`;
		styles.right = `${max}%`;
	} else if (direction === "rl") {
		styles.right = `${min}%`;
		styles.left = `${max}%`;
	} else if (direction === "bt") {
		styles.bottom = `${min}%`;
		styles.top = `${max}%`;
	} else {
		styles.top = `${min}%`;
		styles.bottom = `${max}%`;
	}
	return styles;
}
function getThumbStyles(direction, thumbPos) {
	const styles = { position: "absolute" };
	if (direction === "lr") {
		styles.left = `${thumbPos}%`;
		styles.translate = "-50% 0";
	} else if (direction === "rl") {
		styles.right = `${thumbPos}%`;
		styles.translate = "50% 0";
	} else if (direction === "bt") {
		styles.bottom = `${thumbPos}%`;
		styles.translate = "0 50%";
	} else {
		styles.top = `${thumbPos}%`;
		styles.translate = "0 -50%";
	}
	return styles;
}
function getTickStyles(direction, tickPosition, offsetPercentage) {
	const style = { position: "absolute" };
	if (direction === "lr") {
		style.left = `${tickPosition}%`;
		style.translate = `${offsetPercentage}% 0`;
	} else if (direction === "rl") {
		style.right = `${tickPosition}%`;
		style.translate = `${-offsetPercentage}% 0`;
	} else if (direction === "bt") {
		style.bottom = `${tickPosition}%`;
		style.translate = `0 ${-offsetPercentage}%`;
	} else {
		style.top = `${tickPosition}%`;
		style.translate = `0 ${offsetPercentage}%`;
	}
	return style;
}
/**
* Gets the number of decimal places in a number
*/
function getDecimalPlaces(num) {
	if (Math.floor(num) === num) return 0;
	const str = num.toString();
	if (str.indexOf(".") !== -1 && str.indexOf("e-") === -1) return str.split(".")[1].length;
	else if (str.indexOf("e-") !== -1) {
		const parts = str.split("e-");
		return parseInt(parts[1], 10);
	}
	return 0;
}
/**
* Rounds a number to the specified number of decimal places
*/
function roundToPrecision(num, precision) {
	const factor = Math.pow(10, precision);
	return Math.round(num * factor) / factor;
}
/**
* Normalizes step to always be a sorted array of valid values within min/max range
*/
function normalizeSteps(step, min, max) {
	if (typeof step === "number") {
		const difference = max - min;
		let count = Math.ceil(difference / step);
		const precision = getDecimalPlaces(step);
		const factor = Math.pow(10, precision);
		if (Math.round(difference * factor) % Math.round(step * factor) === 0) count++;
		const steps = [];
		for (let i = 0; i < count; i++) {
			const roundedValue = roundToPrecision(min + i * step, precision);
			steps.push(roundedValue);
		}
		return steps;
	}
	return [...new Set(step)].filter((value) => value >= min && value <= max).sort((a, b) => a - b);
}
/**
* Snaps a value to the nearest step in a custom steps array
*/
function snapValueToCustomSteps(value, steps) {
	if (steps.length === 0) return value;
	let closest = steps[0];
	let minDistance = Math.abs(value - closest);
	for (const step of steps) {
		const distance = Math.abs(value - step);
		if (distance < minDistance) {
			minDistance = distance;
			closest = step;
		}
	}
	return closest;
}
/**
* Gets the next/previous step value for keyboard navigation
*/
function getAdjacentStepValue(currentValue, steps, direction) {
	const currentIndex = steps.indexOf(currentValue);
	if (currentIndex === -1) return snapValueToCustomSteps(currentValue, steps);
	if (direction === "next") return currentIndex < steps.length - 1 ? steps[currentIndex + 1] : currentValue;
	else return currentIndex > 0 ? steps[currentIndex - 1] : currentValue;
}
//#endregion
//#region node_modules/bits-ui/dist/internal/math.js
function linearScale(domain, range, clamp = true) {
	const [d0, d1] = domain;
	const [r0, r1] = range;
	const slope = (r1 - r0) / (d1 - d0);
	return (x) => {
		const result = r0 + slope * (x - d0);
		if (!clamp) return result;
		if (result > Math.max(r0, r1)) return Math.max(r0, r1);
		if (result < Math.min(r0, r1)) return Math.min(r0, r1);
		return result;
	};
}
//#endregion
//#region node_modules/bits-ui/dist/bits/slider/slider.svelte.js
var sliderAttrs = createBitsAttrs({
	component: "slider",
	parts: [
		"root",
		"thumb",
		"range",
		"tick",
		"tick-label",
		"thumb-label"
	]
});
var SliderRootContext = new Context("Slider.Root");
var SliderBaseRootState = class {
	opts;
	attachment;
	#isActive = state(false);
	get isActive() {
		return get(this.#isActive);
	}
	set isActive(value) {
		set(this.#isActive, value, true);
	}
	#layoutVersion = state(0);
	#direction = user_derived(() => {
		if (this.opts.orientation.current === "horizontal") return this.opts.dir.current === "rtl" ? "rl" : "lr";
		else return this.opts.dir.current === "rtl" ? "tb" : "bt";
	});
	get direction() {
		return get(this.#direction);
	}
	set direction(value) {
		set(this.#direction, value);
	}
	#normalizedSteps = user_derived(() => {
		return normalizeSteps(this.opts.step.current, this.opts.min.current, this.opts.max.current);
	});
	get normalizedSteps() {
		return get(this.#normalizedSteps);
	}
	set normalizedSteps(value) {
		set(this.#normalizedSteps, value);
	}
	domContext;
	constructor(opts) {
		this.opts = opts;
		this.attachment = attachRef(opts.ref);
		this.domContext = new DOMContext(this.opts.ref);
		new SvelteResizeObserver(() => this.opts.ref.current, this.#handleLayoutChange);
	}
	#handleLayoutChange = () => {
		set(this.#layoutVersion, get(this.#layoutVersion) + 1);
	};
	isThumbActive(_index) {
		return this.isActive;
	}
	#touchAction = user_derived(() => {
		if (this.opts.disabled.current) return void 0;
		return this.opts.orientation.current === "horizontal" ? "pan-y" : "pan-x";
	});
	getAllThumbs = () => {
		const node = this.opts.ref.current;
		if (!node) return [];
		return Array.from(node.querySelectorAll(sliderAttrs.selector("thumb")));
	};
	getThumbScale = () => {
		get(this.#layoutVersion);
		const trackPadding = this.opts.trackPadding?.current;
		if (trackPadding !== void 0 && trackPadding > 0) return [trackPadding, 100 - trackPadding];
		if (this.opts.thumbPositioning.current === "exact") return [0, 100];
		const isVertical = this.opts.orientation.current === "vertical";
		const activeThumb = this.getAllThumbs()[0];
		const thumbSize = isVertical ? activeThumb?.offsetHeight : activeThumb?.offsetWidth;
		if (thumbSize === void 0 || Number.isNaN(thumbSize) || thumbSize === 0) return [0, 100];
		const trackSize = isVertical ? this.opts.ref.current?.offsetHeight : this.opts.ref.current?.offsetWidth;
		if (trackSize === void 0 || Number.isNaN(trackSize) || trackSize === 0) return [0, 100];
		const percentPadding = thumbSize / 2 / trackSize * 100;
		return [percentPadding, 100 - percentPadding];
	};
	getPositionFromValue = (thumbValue) => {
		const thumbScale = this.getThumbScale();
		return linearScale([this.opts.min.current, this.opts.max.current], thumbScale)(thumbValue);
	};
	#props = user_derived(() => ({
		id: this.opts.id.current,
		"data-orientation": this.opts.orientation.current,
		"data-disabled": boolToEmptyStrOrUndef(this.opts.disabled.current),
		style: { touchAction: get(this.#touchAction) },
		[sliderAttrs.root]: "",
		...this.attachment
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
var SliderSingleRootState = class extends SliderBaseRootState {
	opts;
	isMulti = false;
	constructor(opts) {
		super(opts);
		this.opts = opts;
		onMountEffect(() => {
			return executeCallbacks(on(this.domContext.getDocument(), "pointerdown", this.handlePointerDown), on(this.domContext.getDocument(), "pointerup", this.handlePointerUp), on(this.domContext.getDocument(), "pointermove", this.handlePointerMove), on(this.domContext.getDocument(), "pointerleave", this.handlePointerUp));
		});
		watch([
			() => this.opts.step.current,
			() => this.opts.min.current,
			() => this.opts.max.current,
			() => this.opts.value.current
		], ([step, min, max, value]) => {
			const steps = normalizeSteps(step, min, max);
			const isValidValue = (v) => {
				return steps.includes(v);
			};
			const gcv = (v) => {
				return snapValueToCustomSteps(v, steps);
			};
			if (!isValidValue(value)) this.opts.value.current = gcv(value);
		});
	}
	isTickValueSelected = (tickValue) => {
		return this.opts.value.current === tickValue;
	};
	applyPosition({ clientXY, start, end }) {
		const min = this.opts.min.current;
		const max = this.opts.max.current;
		const val = (clientXY - start) / (end - start) * (max - min) + min;
		if (val < min) this.updateValue(min);
		else if (val > max) this.updateValue(max);
		else {
			const steps = this.normalizedSteps;
			const newValue = snapValueToCustomSteps(val, steps);
			this.updateValue(newValue);
		}
	}
	updateValue = (newValue) => {
		this.opts.value.current = snapValueToCustomSteps(newValue, this.normalizedSteps);
	};
	handlePointerMove = (e) => {
		if (!this.isActive || this.opts.disabled.current) return;
		e.preventDefault();
		e.stopPropagation();
		const sliderNode = this.opts.ref.current;
		const activeThumb = this.getAllThumbs()[0];
		if (!sliderNode || !activeThumb) return;
		activeThumb.focus();
		const { left, right, top, bottom } = sliderNode.getBoundingClientRect();
		if (this.direction === "lr") this.applyPosition({
			clientXY: e.clientX,
			start: left,
			end: right
		});
		else if (this.direction === "rl") this.applyPosition({
			clientXY: e.clientX,
			start: right,
			end: left
		});
		else if (this.direction === "bt") this.applyPosition({
			clientXY: e.clientY,
			start: bottom,
			end: top
		});
		else if (this.direction === "tb") this.applyPosition({
			clientXY: e.clientY,
			start: top,
			end: bottom
		});
	};
	handlePointerDown = (e) => {
		if (e.button !== 0 || this.opts.disabled.current) return;
		const sliderNode = this.opts.ref.current;
		const closestThumb = this.getAllThumbs()[0];
		if (!closestThumb || !sliderNode) return;
		const target = e.composedPath()[0] ?? e.target;
		if (!isElementOrSVGElement(target) || !sliderNode.contains(target)) return;
		e.preventDefault();
		closestThumb.focus();
		this.isActive = true;
		this.handlePointerMove(e);
	};
	handlePointerUp = () => {
		if (this.opts.disabled.current) return;
		if (this.isActive) this.opts.onValueCommit.current(untrack(() => this.opts.value.current));
		this.isActive = false;
	};
	#thumbsPropsArr = user_derived(() => {
		const currValue = this.opts.value.current;
		return Array.from({ length: 1 }, () => {
			const thumbValue = currValue;
			const thumbPosition = this.getPositionFromValue(thumbValue);
			const style = getThumbStyles(this.direction, thumbPosition);
			return {
				role: "slider",
				"aria-valuemin": this.opts.min.current,
				"aria-valuemax": this.opts.max.current,
				"aria-valuenow": thumbValue,
				"aria-disabled": boolToStr(this.opts.disabled.current),
				"aria-orientation": this.opts.orientation.current,
				"data-value": thumbValue,
				"data-orientation": this.opts.orientation.current,
				style,
				[sliderAttrs.thumb]: ""
			};
		});
	});
	get thumbsPropsArr() {
		return get(this.#thumbsPropsArr);
	}
	set thumbsPropsArr(value) {
		set(this.#thumbsPropsArr, value);
	}
	#thumbsRenderArr = user_derived(() => {
		return this.thumbsPropsArr.map((_, i) => i);
	});
	get thumbsRenderArr() {
		return get(this.#thumbsRenderArr);
	}
	set thumbsRenderArr(value) {
		set(this.#thumbsRenderArr, value);
	}
	#ticksPropsArr = user_derived(() => {
		const steps = this.normalizedSteps;
		const currValue = this.opts.value.current;
		return steps.map((tickValue, i) => {
			const tickPosition = this.getPositionFromValue(tickValue);
			const isFirst = i === 0;
			const isLast = i === steps.length - 1;
			const offsetPercentage = isFirst ? 0 : isLast ? -100 : -50;
			const style = getTickStyles(this.direction, tickPosition, offsetPercentage);
			const bounded = tickValue <= currValue;
			return {
				"data-disabled": boolToEmptyStrOrUndef(this.opts.disabled.current),
				"data-orientation": this.opts.orientation.current,
				"data-bounded": bounded ? "" : void 0,
				"data-value": tickValue,
				"data-selected": this.isTickValueSelected(tickValue) ? "" : void 0,
				style,
				[sliderAttrs.tick]: ""
			};
		});
	});
	get ticksPropsArr() {
		return get(this.#ticksPropsArr);
	}
	set ticksPropsArr(value) {
		set(this.#ticksPropsArr, value);
	}
	#ticksRenderArr = user_derived(() => {
		return this.ticksPropsArr.map((_, i) => i);
	});
	get ticksRenderArr() {
		return get(this.#ticksRenderArr);
	}
	set ticksRenderArr(value) {
		set(this.#ticksRenderArr, value);
	}
	#tickItemsArr = user_derived(() => {
		return this.ticksPropsArr.map((tick, i) => ({
			value: tick["data-value"],
			index: i
		}));
	});
	get tickItemsArr() {
		return get(this.#tickItemsArr);
	}
	set tickItemsArr(value) {
		set(this.#tickItemsArr, value);
	}
	#thumbItemsArr = user_derived(() => {
		return [{
			value: this.opts.value.current,
			index: 0
		}];
	});
	get thumbItemsArr() {
		return get(this.#thumbItemsArr);
	}
	set thumbItemsArr(value) {
		set(this.#thumbItemsArr, value);
	}
	#snippetProps = user_derived(() => ({
		ticks: this.ticksRenderArr,
		thumbs: this.thumbsRenderArr,
		tickItems: this.tickItemsArr,
		thumbItems: this.thumbItemsArr
	}));
	get snippetProps() {
		return get(this.#snippetProps);
	}
	set snippetProps(value) {
		set(this.#snippetProps, value);
	}
};
var SliderMultiRootState = class extends SliderBaseRootState {
	opts;
	isMulti = true;
	#activeThumb = state(null);
	get activeThumb() {
		return get(this.#activeThumb);
	}
	set activeThumb(value) {
		set(this.#activeThumb, value, true);
	}
	#currentThumbIdx = state(0);
	get currentThumbIdx() {
		return get(this.#currentThumbIdx);
	}
	set currentThumbIdx(value) {
		set(this.#currentThumbIdx, value, true);
	}
	constructor(opts) {
		super(opts);
		this.opts = opts;
		onMountEffect(() => {
			return executeCallbacks(on(this.domContext.getDocument(), "pointerdown", this.handlePointerDown), on(this.domContext.getDocument(), "pointerup", this.handlePointerUp), on(this.domContext.getDocument(), "pointermove", this.handlePointerMove), on(this.domContext.getDocument(), "pointerleave", this.handlePointerUp));
		});
		watch([
			() => this.opts.step.current,
			() => this.opts.min.current,
			() => this.opts.max.current,
			() => this.opts.value.current
		], ([step, min, max, value]) => {
			const steps = normalizeSteps(step, min, max);
			const isValidValue = (v) => {
				return steps.includes(v);
			};
			const gcv = (v) => {
				return snapValueToCustomSteps(v, steps);
			};
			if (value.some((v) => !isValidValue(v))) this.opts.value.current = value.map(gcv);
		});
	}
	isTickValueSelected = (tickValue) => {
		return this.opts.value.current.includes(tickValue);
	};
	isThumbActive(index) {
		return this.isActive && this.activeThumb?.idx === index;
	}
	applyPosition({ clientXY, activeThumbIdx, start, end }) {
		const min = this.opts.min.current;
		const max = this.opts.max.current;
		const val = (clientXY - start) / (end - start) * (max - min) + min;
		if (val < min) this.updateValue(min, activeThumbIdx);
		else if (val > max) this.updateValue(max, activeThumbIdx);
		else {
			const steps = this.normalizedSteps;
			const newValue = snapValueToCustomSteps(val, steps);
			this.updateValue(newValue, activeThumbIdx);
		}
	}
	#getClosestThumb = (e) => {
		const thumbs = this.getAllThumbs();
		if (!thumbs.length) return;
		for (const thumb of thumbs) thumb.blur();
		const distances = thumbs.map((thumb) => {
			if (this.opts.orientation.current === "horizontal") {
				const { left, right } = thumb.getBoundingClientRect();
				return Math.abs(e.clientX - (left + right) / 2);
			} else {
				const { top, bottom } = thumb.getBoundingClientRect();
				return Math.abs(e.clientY - (top + bottom) / 2);
			}
		});
		const node = thumbs[distances.indexOf(Math.min(...distances))];
		return {
			node,
			idx: thumbs.indexOf(node)
		};
	};
	handlePointerMove = (e) => {
		if (!this.isActive || this.opts.disabled.current) return;
		e.preventDefault();
		e.stopPropagation();
		const sliderNode = this.opts.ref.current;
		const activeThumb = this.activeThumb;
		if (!sliderNode || !activeThumb) return;
		activeThumb.node.focus();
		const { left, right, top, bottom } = sliderNode.getBoundingClientRect();
		const direction = this.direction;
		if (direction === "lr") this.applyPosition({
			clientXY: e.clientX,
			activeThumbIdx: activeThumb.idx,
			start: left,
			end: right
		});
		else if (direction === "rl") this.applyPosition({
			clientXY: e.clientX,
			activeThumbIdx: activeThumb.idx,
			start: right,
			end: left
		});
		else if (direction === "bt") this.applyPosition({
			clientXY: e.clientY,
			activeThumbIdx: activeThumb.idx,
			start: bottom,
			end: top
		});
		else if (direction === "tb") this.applyPosition({
			clientXY: e.clientY,
			activeThumbIdx: activeThumb.idx,
			start: top,
			end: bottom
		});
	};
	handlePointerDown = (e) => {
		if (e.button !== 0 || this.opts.disabled.current) return;
		const sliderNode = this.opts.ref.current;
		const closestThumb = this.#getClosestThumb(e);
		if (!closestThumb || !sliderNode) return;
		const target = e.composedPath()[0] ?? e.target;
		if (!isElementOrSVGElement(target) || !sliderNode.contains(target)) return;
		e.preventDefault();
		this.activeThumb = closestThumb;
		closestThumb.node.focus();
		this.isActive = true;
		this.handlePointerMove(e);
	};
	handlePointerUp = () => {
		if (this.opts.disabled.current) return;
		if (this.isActive) this.opts.onValueCommit.current(untrack(() => this.opts.value.current));
		this.isActive = false;
	};
	getAllThumbs = () => {
		const node = this.opts.ref.current;
		if (!node) return [];
		return Array.from(node.querySelectorAll(sliderAttrs.selector("thumb")));
	};
	updateValue = (thumbValue, idx) => {
		const currValue = this.opts.value.current;
		if (!currValue.length) {
			this.opts.value.current.push(thumbValue);
			return;
		}
		if (currValue[idx] === thumbValue) return;
		const newValue = [...currValue];
		if (!isValidIndex(idx, newValue)) return;
		const direction = newValue[idx] > thumbValue ? -1 : 1;
		const swap = () => {
			const diffIndex = idx + direction;
			newValue[idx] = newValue[diffIndex];
			newValue[diffIndex] = thumbValue;
			const thumbs = this.getAllThumbs();
			if (!thumbs.length) return;
			thumbs[diffIndex]?.focus();
			this.activeThumb = {
				node: thumbs[diffIndex],
				idx: diffIndex
			};
		};
		if (this.opts.autoSort.current && (direction === -1 && thumbValue < newValue[idx - 1] || direction === 1 && thumbValue > newValue[idx + 1])) {
			swap();
			this.opts.value.current = newValue;
			return;
		}
		const steps = this.normalizedSteps;
		newValue[idx] = snapValueToCustomSteps(thumbValue, steps);
		this.opts.value.current = newValue;
	};
	#thumbsPropsArr = user_derived(() => {
		const currValue = this.opts.value.current;
		return Array.from({ length: currValue.length || 1 }, (_, i) => {
			const currThumb = untrack(() => this.currentThumbIdx);
			if (currThumb < currValue.length) untrack(() => {
				this.currentThumbIdx = currThumb + 1;
			});
			const thumbValue = currValue[i];
			const thumbPosition = this.getPositionFromValue(thumbValue ?? 0);
			const style = getThumbStyles(this.direction, thumbPosition);
			return {
				role: "slider",
				"aria-valuemin": this.opts.min.current,
				"aria-valuemax": this.opts.max.current,
				"aria-valuenow": thumbValue,
				"aria-disabled": boolToStr(this.opts.disabled.current),
				"aria-orientation": this.opts.orientation.current,
				"data-value": thumbValue,
				"data-orientation": this.opts.orientation.current,
				style,
				[sliderAttrs.thumb]: ""
			};
		});
	});
	get thumbsPropsArr() {
		return get(this.#thumbsPropsArr);
	}
	set thumbsPropsArr(value) {
		set(this.#thumbsPropsArr, value);
	}
	#thumbsRenderArr = user_derived(() => {
		return this.thumbsPropsArr.map((_, i) => i);
	});
	get thumbsRenderArr() {
		return get(this.#thumbsRenderArr);
	}
	set thumbsRenderArr(value) {
		set(this.#thumbsRenderArr, value);
	}
	#ticksPropsArr = user_derived(() => {
		const steps = this.normalizedSteps;
		const currValue = this.opts.value.current;
		return steps.map((tickValue, i) => {
			const tickPosition = this.getPositionFromValue(tickValue);
			const isFirst = i === 0;
			const isLast = i === steps.length - 1;
			const offsetPercentage = isFirst ? 0 : isLast ? -100 : -50;
			const style = getTickStyles(this.direction, tickPosition, offsetPercentage);
			const bounded = currValue.length === 1 ? tickValue <= currValue[0] : currValue[0] <= tickValue && tickValue <= currValue[currValue.length - 1];
			return {
				"data-disabled": boolToEmptyStrOrUndef(this.opts.disabled.current),
				"data-orientation": this.opts.orientation.current,
				"data-bounded": bounded ? "" : void 0,
				"data-value": tickValue,
				style,
				[sliderAttrs.tick]: ""
			};
		});
	});
	get ticksPropsArr() {
		return get(this.#ticksPropsArr);
	}
	set ticksPropsArr(value) {
		set(this.#ticksPropsArr, value);
	}
	#ticksRenderArr = user_derived(() => {
		return this.ticksPropsArr.map((_, i) => i);
	});
	get ticksRenderArr() {
		return get(this.#ticksRenderArr);
	}
	set ticksRenderArr(value) {
		set(this.#ticksRenderArr, value);
	}
	#tickItemsArr = user_derived(() => {
		return this.ticksPropsArr.map((tick, i) => ({
			value: tick["data-value"],
			index: i
		}));
	});
	get tickItemsArr() {
		return get(this.#tickItemsArr);
	}
	set tickItemsArr(value) {
		set(this.#tickItemsArr, value);
	}
	#thumbItemsArr = user_derived(() => {
		return this.opts.value.current.map((value, index) => ({
			value,
			index
		}));
	});
	get thumbItemsArr() {
		return get(this.#thumbItemsArr);
	}
	set thumbItemsArr(value) {
		set(this.#thumbItemsArr, value);
	}
	#snippetProps = user_derived(() => ({
		ticks: this.ticksRenderArr,
		thumbs: this.thumbsRenderArr,
		tickItems: this.tickItemsArr,
		thumbItems: this.thumbItemsArr
	}));
	get snippetProps() {
		return get(this.#snippetProps);
	}
	set snippetProps(value) {
		set(this.#snippetProps, value);
	}
};
var SliderRootState = class {
	static create(opts) {
		const { type, ...rest } = opts;
		const rootState = type === "single" ? new SliderSingleRootState(rest) : new SliderMultiRootState(rest);
		return SliderRootContext.set(rootState);
	}
};
var VALID_SLIDER_KEYS = [
	ARROW_LEFT,
	ARROW_RIGHT,
	ARROW_UP,
	ARROW_DOWN,
	HOME,
	"End"
];
var SliderRangeState = class SliderRangeState {
	static create(opts) {
		return new SliderRangeState(opts, SliderRootContext.get());
	}
	opts;
	root;
	attachment;
	constructor(opts, root) {
		this.opts = opts;
		this.root = root;
		this.attachment = attachRef(opts.ref);
	}
	#rangeStyles = user_derived(() => {
		if (Array.isArray(this.root.opts.value.current)) {
			const min = this.root.opts.value.current.length > 1 ? this.root.getPositionFromValue(Math.min(...this.root.opts.value.current) ?? 0) : 0;
			const max = 100 - this.root.getPositionFromValue(Math.max(...this.root.opts.value.current) ?? 0);
			return {
				position: "absolute",
				...getRangeStyles(this.root.direction, min, max)
			};
		} else {
			const trackPadding = this.root.opts.trackPadding?.current;
			const currentValue = this.root.opts.value.current;
			const maxValue = this.root.opts.max.current;
			const min = 0;
			const max = trackPadding !== void 0 && trackPadding > 0 && currentValue === maxValue ? 0 : 100 - this.root.getPositionFromValue(currentValue);
			return {
				position: "absolute",
				...getRangeStyles(this.root.direction, min, max)
			};
		}
	});
	get rangeStyles() {
		return get(this.#rangeStyles);
	}
	set rangeStyles(value) {
		set(this.#rangeStyles, value);
	}
	#props = user_derived(() => ({
		id: this.opts.id.current,
		"data-orientation": this.root.opts.orientation.current,
		"data-disabled": boolToEmptyStrOrUndef(this.root.opts.disabled.current),
		style: this.rangeStyles,
		[sliderAttrs.range]: "",
		...this.attachment
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
var SliderThumbState = class SliderThumbState {
	static create(opts) {
		return new SliderThumbState(opts, SliderRootContext.get());
	}
	opts;
	root;
	attachment;
	#isDisabled = user_derived(() => this.root.opts.disabled.current || this.opts.disabled.current);
	constructor(opts, root) {
		this.opts = opts;
		this.root = root;
		this.attachment = attachRef(opts.ref);
		this.onkeydown = this.onkeydown.bind(this);
	}
	#updateValue(newValue) {
		if (this.root.isMulti) this.root.updateValue(newValue, this.opts.index.current);
		else this.root.updateValue(newValue);
	}
	onkeydown(e) {
		if (get(this.#isDisabled)) return;
		const currNode = this.opts.ref.current;
		if (!currNode) return;
		const thumbs = this.root.getAllThumbs();
		if (!thumbs.length) return;
		const idx = thumbs.indexOf(currNode);
		if (this.root.isMulti) this.root.currentThumbIdx = idx;
		if (!VALID_SLIDER_KEYS.includes(e.key)) return;
		e.preventDefault();
		const min = this.root.opts.min.current;
		const max = this.root.opts.max.current;
		const value = this.root.opts.value.current;
		const thumbValue = Array.isArray(value) ? value[idx] : value;
		const orientation = this.root.opts.orientation.current;
		const direction = this.root.direction;
		const steps = this.root.normalizedSteps;
		switch (e.key) {
			case HOME:
				this.#updateValue(min);
				break;
			case "End":
				this.#updateValue(max);
				break;
			case ARROW_LEFT:
				if (orientation !== "horizontal") break;
				if (e.metaKey) {
					const newValue = direction === "rl" ? max : min;
					this.#updateValue(newValue);
				} else {
					const newValue = getAdjacentStepValue(thumbValue, steps, direction === "rl" ? "next" : "prev");
					this.#updateValue(newValue);
				}
				break;
			case ARROW_RIGHT:
				if (orientation !== "horizontal") break;
				if (e.metaKey) {
					const newValue = direction === "rl" ? min : max;
					this.#updateValue(newValue);
				} else {
					const newValue = getAdjacentStepValue(thumbValue, steps, direction === "rl" ? "prev" : "next");
					this.#updateValue(newValue);
				}
				break;
			case ARROW_UP:
				if (e.metaKey) {
					const newValue = direction === "tb" ? min : max;
					this.#updateValue(newValue);
				} else {
					const newValue = getAdjacentStepValue(thumbValue, steps, direction === "tb" ? "prev" : "next");
					this.#updateValue(newValue);
				}
				break;
			case ARROW_DOWN:
				if (e.metaKey) {
					const newValue = direction === "tb" ? max : min;
					this.#updateValue(newValue);
				} else {
					const newValue = getAdjacentStepValue(thumbValue, steps, direction === "tb" ? "next" : "prev");
					this.#updateValue(newValue);
				}
				break;
		}
		this.root.opts.onValueCommit.current(this.root.opts.value.current);
	}
	#props = user_derived(() => ({
		...this.root.thumbsPropsArr[this.opts.index.current],
		id: this.opts.id.current,
		onkeydown: this.onkeydown,
		"data-active": this.root.isThumbActive(this.opts.index.current) ? "" : void 0,
		"data-disabled": boolToEmptyStrOrUndef(this.opts.disabled.current || this.root.opts.disabled.current),
		tabindex: this.opts.disabled.current || this.root.opts.disabled.current ? -1 : 0,
		...this.attachment
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
//#endregion
//#region node_modules/bits-ui/dist/bits/slider/components/slider.svelte
var root_2$51 = from_html(`<span><!></span>`);
function Slider$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), value = prop($$props, "value", 15), onValueChange = prop($$props, "onValueChange", 3, noop$1), onValueCommit = prop($$props, "onValueCommit", 3, noop$1), disabled = prop($$props, "disabled", 3, false), step = prop($$props, "step", 3, 1), dir = prop($$props, "dir", 3, "ltr"), autoSort = prop($$props, "autoSort", 3, true), orientation = prop($$props, "orientation", 3, "horizontal"), thumbPositioning = prop($$props, "thumbPositioning", 3, "contain"), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"children",
		"child",
		"id",
		"ref",
		"value",
		"type",
		"onValueChange",
		"onValueCommit",
		"disabled",
		"min",
		"max",
		"step",
		"dir",
		"autoSort",
		"orientation",
		"thumbPositioning",
		"trackPadding"
	]);
	const min = user_derived(() => {
		if ($$props.min !== void 0) return $$props.min;
		if (Array.isArray(step())) return Math.min(...step());
		return 0;
	});
	const max = user_derived(() => {
		if ($$props.max !== void 0) return $$props.max;
		if (Array.isArray(step())) return Math.max(...step());
		return 100;
	});
	function handleDefaultValue() {
		if (value() !== void 0) return;
		if ($$props.type === "single") return get(min);
		return [];
	}
	handleDefaultValue();
	watch.pre(() => value(), () => {
		handleDefaultValue();
	});
	const rootState = SliderRootState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v)),
		value: boxWith(() => value(), (v) => {
			value(v);
			onValueChange()(v);
		}),
		onValueCommit: boxWith(() => onValueCommit()),
		disabled: boxWith(() => disabled()),
		min: boxWith(() => get(min)),
		max: boxWith(() => get(max)),
		step: boxWith(() => step()),
		dir: boxWith(() => dir()),
		autoSort: boxWith(() => autoSort()),
		orientation: boxWith(() => orientation()),
		thumbPositioning: boxWith(() => thumbPositioning()),
		type: $$props.type,
		trackPadding: boxWith(() => $$props.trackPadding)
	});
	const mergedProps = user_derived(() => mergeProps(restProps, rootState.props));
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		var fragment_1 = comment();
		var node_1 = first_child(fragment_1);
		{
			let $0 = user_derived(() => ({
				props: get(mergedProps),
				...rootState.snippetProps
			}));
			snippet(node_1, () => $$props.child, () => get($0));
		}
		append($$anchor, fragment_1);
	};
	var alternate = ($$anchor) => {
		var span = root_2$51();
		attribute_effect(span, () => ({ ...get(mergedProps) }));
		snippet(child(span), () => $$props.children ?? noop, () => rootState.snippetProps);
		reset(span);
		append($$anchor, span);
	};
	if_block(node, ($$render) => {
		if ($$props.child) $$render(consequent);
		else $$render(alternate, -1);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/slider/components/slider-range.svelte
var root_2$50 = from_html(`<span><!></span>`);
function Slider_range($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), id = prop($$props, "id", 19, () => createId(uid)), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"children",
		"child",
		"ref",
		"id"
	]);
	const rangeState = SliderRangeState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v))
	});
	const mergedProps = user_derived(() => mergeProps(restProps, rangeState.props));
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		var fragment_1 = comment();
		snippet(first_child(fragment_1), () => $$props.child, () => ({ props: get(mergedProps) }));
		append($$anchor, fragment_1);
	};
	var alternate = ($$anchor) => {
		var span = root_2$50();
		attribute_effect(span, () => ({ ...get(mergedProps) }));
		snippet(child(span), () => $$props.children ?? noop);
		reset(span);
		append($$anchor, span);
	};
	if_block(node, ($$render) => {
		if ($$props.child) $$render(consequent);
		else $$render(alternate, -1);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/slider/components/slider-thumb.svelte
var root_2$49 = from_html(`<span><!></span>`);
function Slider_thumb($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), id = prop($$props, "id", 19, () => createId(uid)), disabled = prop($$props, "disabled", 3, false), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"children",
		"child",
		"ref",
		"id",
		"index",
		"disabled"
	]);
	const thumbState = SliderThumbState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v)),
		index: boxWith(() => $$props.index),
		disabled: boxWith(() => disabled())
	});
	const mergedProps = user_derived(() => mergeProps(restProps, thumbState.props));
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		var fragment_1 = comment();
		var node_1 = first_child(fragment_1);
		{
			let $0 = user_derived(() => ({
				active: thumbState.root.isThumbActive(thumbState.opts.index.current),
				props: get(mergedProps)
			}));
			snippet(node_1, () => $$props.child, () => get($0));
		}
		append($$anchor, fragment_1);
	};
	var alternate = ($$anchor) => {
		var span = root_2$49();
		attribute_effect(span, () => ({ ...get(mergedProps) }));
		var node_2 = child(span);
		{
			let $0 = user_derived(() => ({ active: thumbState.root.isThumbActive(thumbState.opts.index.current) }));
			snippet(node_2, () => $$props.children ?? noop, () => get($0));
		}
		reset(span);
		append($$anchor, span);
	};
	if_block(node, ($$render) => {
		if ($$props.child) $$render(consequent);
		else $$render(alternate, -1);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/components/about/ContactLink.svelte
var root$60 = from_html(`<a class="text-primary underline-offset-1 hover:underline" target="_blank" rel="noreferrer"><!></a>`);
function ContactLink($$anchor, $$props) {
	var a = root$60();
	snippet(child(a), () => $$props.children ?? noop);
	reset(a);
	template_effect(() => set_attribute(a, "href", $$props.href));
	append($$anchor, a);
}
//#endregion
//#region src/extension/entrypoints/options/components/about/Contact.svelte
var root_5$26 = from_html(`<!> <!>`, 1);
var root$59 = from_html(`<section class="rounded-lg border border-border bg-card py-2 px-3"><h2 class="text-lg font-bold">Contact</h2> <div class="mt-2 space-y-1"><p>Our source code is available on <!> and licensed under the GNU General Public Licence. Our terms of service can be found <!>.</p> <p>We can be contacted through our <!> or <!>.</p> <!> <div><p>Suggestions and bug reports are important to keep improving TornTools. When reporting a bug, include:</p> <ul class="mt-1 pl-4 list-disc text-muted-foreground"><li>Screenshots of the bug in action.</li> <li>Screenshots of the console output. <ul class="pl-4 list-disc"><li>Console access via <!> , or right click -> inspect -> console.</li></ul></li></ul></div></div></section>`);
function Contact($$anchor) {
	var section = root$59();
	var div = sibling(child(section), 2);
	var p = child(div);
	var node = sibling(child(p));
	ContactLink(node, {
		href: "https://github.com/Mephiles/torntools_extension",
		children: ($$anchor, $$slotProps) => {
			next();
			append($$anchor, text("GitHub"));
		},
		$$slots: { default: true }
	});
	ContactLink(sibling(node, 2), {
		href: browser.runtime.getURL("/tos.html"),
		children: ($$anchor, $$slotProps) => {
			next();
			append($$anchor, text("here"));
		},
		$$slots: { default: true }
	});
	next();
	reset(p);
	var p_1 = sibling(p, 2);
	var node_2 = sibling(child(p_1));
	ContactLink(node_2, {
		href: "https://discord.gg/ukyK6f6",
		children: ($$anchor, $$slotProps) => {
			next();
			append($$anchor, text("Discord"));
		},
		$$slots: { default: true }
	});
	ContactLink(sibling(node_2, 2), {
		get href() {
			return TORNTOOLS_FORUM_POST;
		},
		children: ($$anchor, $$slotProps) => {
			next();
			append($$anchor, text("our forum post"));
		},
		$$slots: { default: true }
	});
	next();
	reset(p_1);
	var node_4 = sibling(p_1, 2);
	Separator(node_4, { class: "my-1" });
	var div_1 = sibling(node_4, 2);
	var ul = sibling(child(div_1), 2);
	var li = sibling(child(ul), 2);
	var ul_1 = sibling(child(li));
	var li_1 = child(ul_1);
	Kbd_group(sibling(child(li_1)), {
		children: ($$anchor, $$slotProps) => {
			var fragment = root_5$26();
			var node_6 = first_child(fragment);
			Kbd(node_6, {
				children: ($$anchor, $$slotProps) => {
					next();
					append($$anchor, text("Ctrl + Shift + J"));
				},
				$$slots: { default: true }
			});
			Kbd(sibling(node_6, 2), {
				children: ($$anchor, $$slotProps) => {
					next();
					append($$anchor, text("F12"));
				},
				$$slots: { default: true }
			});
			append($$anchor, fragment);
		},
		$$slots: { default: true }
	});
	next();
	reset(li_1);
	reset(ul_1);
	reset(li);
	reset(ul);
	reset(div_1);
	reset(div);
	reset(section);
	append($$anchor, section);
}
//#endregion
//#region src/common/utils/team.ts
var TEAM = [
	{
		name: "Mephiles",
		title: ["Creator", "Developer"],
		core: true,
		torn: 2087524,
		color: "green",
		donations: [{
			name: "PayPal",
			link: "https://paypal.me/gkaljulaid"
		}]
	},
	{
		name: "DeKleineKobini",
		title: "Maintainer / Developer",
		core: true,
		torn: 2114440,
		color: "orange",
		donations: [{
			name: "PayPal",
			link: "https://paypal.me/kkobini"
		}, {
			name: "Buy Me a Coffee",
			link: "https://www.buymeacoffee.com/dekleinekobini"
		}]
	},
	{
		name: "TheFoxMan",
		title: "Developer",
		core: true,
		torn: 1936821,
		color: "greenyellow"
	},
	{
		name: "Allo",
		title: "Community Admin",
		core: true,
		torn: 2316070,
		color: "royalblue"
	},
	{
		name: "AllMight",
		title: "Developer",
		core: false,
		torn: 1878147,
		color: "#ff3333"
	},
	{
		name: "wootty2000",
		title: "Developer",
		core: false,
		torn: 2344687,
		color: "red"
	},
	{
		name: "luke__",
		title: "Developer",
		core: false,
		torn: 3720006,
		color: "#f141ddff"
	},
	{
		name: "finally",
		title: "Developer",
		core: false,
		torn: 2060206,
		color: "purple"
	},
	{
		name: "Fogest",
		title: "Developer",
		core: false,
		torn: 2254826,
		color: "chartreuse"
	},
	{
		name: "smikula",
		title: "Developer",
		core: false,
		torn: null,
		color: "#fbff09"
	},
	{
		name: "kontamusse",
		title: "Developer",
		core: false,
		torn: 2408039,
		color: "#58e4e4"
	},
	{
		name: "Natty_Boh",
		title: "Developer",
		core: false,
		torn: 1651049,
		color: "blue"
	},
	{
		name: "h4xnoodle",
		title: "Developer",
		core: false,
		torn: 2315090,
		color: "teal"
	},
	{
		name: "Tesa",
		title: "Developer",
		core: false,
		torn: 2639608,
		color: "brown"
	},
	{
		name: "hvr-lust",
		title: "Developer",
		core: false,
		torn: null,
		color: "darkkhaki"
	},
	{
		name: "ORAN",
		title: "Developer",
		core: false,
		torn: 1778676,
		color: "mediumpurple"
	},
	{
		name: "dat-mule",
		title: "Developer",
		core: false,
		torn: 2043166,
		color: "cornflowerblue"
	},
	{
		name: "josephting",
		title: "Developer",
		core: false,
		torn: 2272298,
		color: "maroon"
	},
	{
		name: "Lazerpent",
		title: "Developer",
		core: false,
		torn: 2112641,
		color: "#7E46DA"
	},
	{
		name: "No1IrishStig",
		title: "Developer",
		core: false,
		torn: 2648238,
		color: "#a6282c"
	},
	{
		name: "Acarya",
		title: "Developer",
		core: false,
		torn: 2243227,
		color: "springgreen"
	},
	{
		name: "Kwack",
		title: "Developer",
		core: false,
		torn: 2190604,
		color: "deeppink"
	},
	{
		name: "Conrado",
		title: "Developer",
		core: false,
		torn: 2631918,
		color: "cyan"
	},
	{
		name: "Vrasp",
		title: "Developer",
		core: false,
		torn: 2627614,
		color: "#01b0aa"
	},
	{
		name: "Anti0815",
		title: "Developer",
		core: false,
		torn: 2793691,
		color: "#0081fe"
	},
	{
		name: "LePluB",
		title: "Developer",
		core: false,
		torn: 2890448,
		color: "orange"
	},
	{
		name: "ThtAstronautGuy",
		title: "Developer",
		core: false,
		torn: 1977683,
		color: "#841210"
	},
	{
		name: "zachwozn",
		title: "Developer",
		core: false,
		torn: 2301700,
		color: "#017BC7"
	},
	{
		name: "nao",
		title: "Developer",
		core: false,
		torn: 2669774,
		color: "#9B1C31"
	},
	{
		name: "tiksan",
		title: "Developer",
		core: false,
		torn: 2383326,
		color: "white"
	},
	{
		name: "TravisTheTechie",
		title: "Developer",
		core: false,
		torn: 3549588,
		color: "firebrick"
	},
	{
		name: "MOBermejo",
		title: "Developer",
		core: false,
		torn: 3385879,
		color: "#DAA520"
	},
	{
		name: "Hashibee",
		title: "Developer",
		core: false,
		torn: 2303184,
		color: "#6ACF65"
	},
	{
		name: "Phoenix",
		title: "Developer",
		core: false,
		torn: 85185,
		color: "#085185"
	},
	{
		name: "xentac",
		title: "Developer",
		core: false,
		torn: 3354782,
		color: "#a569bd"
	},
	{
		name: "Weav3r",
		title: "Developer",
		core: false,
		torn: 1853324,
		color: "blue"
	},
	{
		name: "XDeltaA77",
		title: "Developer",
		core: false,
		torn: 1892226,
		color: "#3dcc21"
	},
	{
		name: "StaticFree",
		title: "Developer",
		core: false,
		torn: 711045,
		color: "steelblue"
	},
	{
		name: "EazzyPeazzy",
		title: "Developer",
		core: false,
		torn: 2708376,
		color: "#65000b"
	},
	{
		name: "vALT0r",
		title: "Developer",
		core: false,
		torn: 767373,
		color: "#ff6b35"
	},
	{
		name: "Simpsons",
		title: "Developer",
		core: false,
		torn: 247677,
		color: "#008B8B"
	},
	{
		name: "Taznister",
		title: "Developer",
		core: false,
		torn: 3770016,
		color: "#53629E"
	},
	{
		name: "aHunterGatherer",
		title: "Developer",
		core: false,
		torn: 2657909,
		color: "#a0ec6d"
	},
	{
		name: "Will",
		title: "Developer",
		core: false,
		torn: 2057823,
		color: "#a6279b"
	},
	{
		name: "jensim",
		title: "Developer",
		core: false,
		torn: null,
		color: "darkkhaki"
	},
	{
		name: "mystify-321",
		title: "Developer",
		core: false,
		torn: 3737350,
		color: "darkkhaki"
	},
	{
		name: "RogerFar",
		title: "Developer",
		core: false,
		torn: 4166912,
		color: "#33873c"
	}
];
var CONTRIBUTORS = TEAM.filter(({ title, color }) => title.includes("Developer") || !!color).reduce((object, { name, torn, color }) => {
	object[name] = {
		id: torn,
		name,
		color
	};
	return object;
}, {});
//#endregion
//#region src/extension/entrypoints/options/components/about/TeamList.svelte
var root_2$48 = from_html(`<a class="text-lg text-primary font-bold underline-offset-2 hover:underline" target="_blank" rel="noreferrer"> </a>`);
var root_3$33 = from_html(`<p class="text-lg text-primary font-bold"> </p>`);
var root_5$25 = from_html(`<a class="underline-offset-1 hover:underline" target="_blank" rel="noreferrer"> </a>`);
var root_4$22 = from_html(`<div class="flex flex-col gap-0.5"></div>`);
var root_1$41 = from_html(`<div class="rounded-lg border border-border p-2"><!> <p class="text-muted-foreground"> </p> <!> <!></div>`);
var root$58 = from_html(`<div class="grid grid-cols-2 lg:grid-cols-4 gap-2 "></div>`);
function TeamList($$anchor, $$props) {
	function getTitle(title) {
		return Array.isArray(title) ? title.join(" + ") : title;
	}
	var div = root$58();
	each(div, 21, () => $$props.members, (member) => member.name, ($$anchor, member) => {
		var div_1 = root_1$41();
		var node = child(div_1);
		var consequent = ($$anchor) => {
			var a = root_2$48();
			var text = child(a, true);
			reset(a);
			template_effect(() => {
				set_attribute(a, "href", `https://www.torn.com/profiles.php?XID=${get(member).torn}`);
				set_text(text, get(member).name);
			});
			append($$anchor, a);
		};
		var alternate = ($$anchor) => {
			var p = root_3$33();
			var text_1 = child(p, true);
			reset(p);
			template_effect(() => set_text(text_1, get(member).name));
			append($$anchor, p);
		};
		if_block(node, ($$render) => {
			if (get(member).torn !== null) $$render(consequent);
			else $$render(alternate, -1);
		});
		var p_1 = sibling(node, 2);
		var text_2 = child(p_1, true);
		reset(p_1);
		var node_1 = sibling(p_1, 2);
		Separator(node_1, { class: "my-1" });
		var node_2 = sibling(node_1, 2);
		var consequent_1 = ($$anchor) => {
			var div_2 = root_4$22();
			each(div_2, 21, () => get(member).donations, (donation) => donation.link, ($$anchor, donation) => {
				var a_1 = root_5$25();
				var text_3 = child(a_1, true);
				reset(a_1);
				template_effect(() => {
					set_attribute(a_1, "href", get(donation).link);
					set_text(text_3, get(donation).name);
				});
				append($$anchor, a_1);
			});
			reset(div_2);
			append($$anchor, div_2);
		};
		if_block(node_2, ($$render) => {
			if (get(member).donations?.length) $$render(consequent_1);
		});
		reset(div_1);
		template_effect(($0) => set_text(text_2, $0), [() => getTitle(get(member).title)]);
		append($$anchor, div_1);
	});
	reset(div);
	append($$anchor, div);
}
//#endregion
//#region src/extension/entrypoints/options/components/about/CoreTeam.svelte
var root$57 = from_html(`<section class="rounded-lg border border-border bg-card py-2 px-3"><h2 class="text-lg font-bold">Team</h2> <p class="text-sm text-muted-foreground">TornTools is free to use but if you feel like giving back to the developers then feel free to donate in-game or via one of the donation links.</p> <div class="my-2"><!></div> <p class="text-sm text-muted-foreground">and everyone else who contributed to our codebase, helped us beta-test, provided feedback, suggestions and bug reports, or just generally helped out in the Discord.</p></section>`);
function CoreTeam($$anchor, $$props) {
	push($$props, false);
	init();
	var section = root$57();
	var div = sibling(child(section), 4);
	var node = child(div);
	{
		let $0 = derived_safe_equal(() => TEAM.filter((member) => member.core));
		TeamList(node, { get members() {
			return get($0);
		} });
	}
	reset(div);
	next(2);
	reset(section);
	append($$anchor, section);
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/stores/database-store.svelte.ts
var storesInitialized = state(false);
var settingsStore = writable();
var apiStore = writable();
var userdataStore = writable();
var torndataStore = writable();
var stockdataStore = writable();
var factiondataStore = writable();
var npcsStore = writable();
function initializeDatabaseStore() {
	if (get(storesInitialized)) return;
	initializeDatabase();
	loadDatabaseStores().then(() => {
		set(storesInitialized, true);
	});
	storageListeners.settings.push((_oldSettings, newSettings) => {
		settingsStore.set(newSettings);
	});
	storageListeners.api.push((_oldApi, newApi) => {
		apiStore.set(newApi);
	});
	storageListeners.userdata.push((_oldUserdata, newUserdata) => {
		userdataStore.set(newUserdata);
	});
	storageListeners.torndata.push((_oldTorndata, newTorndata) => {
		torndataStore.set(newTorndata);
	});
	storageListeners.stockdata.push((_oldStockdata, newStockdata) => {
		stockdataStore.set(newStockdata);
	});
	storageListeners.factiondata.push((_oldFactiondata, newFactiondata) => {
		factiondataStore.set(newFactiondata);
	});
	storageListeners.npcs.push((_oldNpcs, newNpcs) => {
		npcsStore.set(newNpcs);
	});
}
async function loadDatabaseStores() {
	const [settings, api, userdata, torndata, stockdata, factiondata, npcs] = await ttStorage.get([
		"settings",
		"api",
		"userdata",
		"torndata",
		"stockdata",
		"factiondata",
		"npcs"
	]);
	settingsStore.set(settings);
	apiStore.set(api);
	userdataStore.set(userdata);
	torndataStore.set(torndata);
	stockdataStore.set(stockdata);
	factiondataStore.set(factiondata);
	npcsStore.set(npcs);
}
function isStoresInitialized() {
	return get(storesInitialized);
}
//#endregion
//#region src/extension/entrypoints/options/components/about/DataHealthCheck.svelte
var root$56 = from_html(`<article><p class="rounded-lg border border-border p-2 text-sm"><strong class="text-sm"> </strong> <span> </span></p></article>`);
function DataHealthCheck($$anchor, $$props) {
	const statusText = user_derived(() => $$props.status === "checking" ? "checking..." : $$props.status === "healthy" ? "likely okay" : "possibly corrupted");
	const statusClass = user_derived(() => $$props.status === "healthy" ? "font-medium text-lime-600 dark:text-lime-400" : $$props.status === "corrupted" ? "font-medium text-red-600 dark:text-red-400" : "font-medium text-muted-foreground");
	var article = root$56();
	var p = child(article);
	var strong = child(p);
	var text = child(strong);
	reset(strong);
	var span = sibling(strong, 2);
	var text_1 = child(span, true);
	reset(span);
	reset(p);
	reset(article);
	template_effect(() => {
		set_attribute(article, "aria-label", `${$$props.label} data health`);
		set_text(text, `${$$props.label ?? ""}:`);
		set_class(span, 1, clsx(get(statusClass)));
		set_text(text_1, get(statusText));
	});
	append($$anchor, article);
}
//#endregion
//#region src/extension/entrypoints/options/components/about/data-health.ts
function getHealthStatus(value, isHealthy) {
	if (value === void 0) return "checking";
	return isHealthy(value) ? "healthy" : "corrupted";
}
function isUserdataHealthy(value) {
	return typeof value === "object" && value !== null && Object.keys(value).length > 5;
}
function isTorndataHealthy(value) {
	return typeof value === "object" && value !== null && "items" in value && Array.isArray(value.items) && value.items.length > 5;
}
function isStockdataHealthy(value) {
	return typeof value === "object" && value !== null && Object.keys(value).length > 5;
}
function isFactiondataHealthy(value) {
	return typeof value === "object" && value !== null && "access" in value && typeof value.access === "string";
}
//#endregion
//#region src/extension/entrypoints/options/components/about/DataHealth.svelte
var root_1$40 = from_html(`<div class="mt-2 gap-3 grid md:grid-cols-2"></div>`);
var root_3$32 = from_html(`<p class="mt-2 text-sm text-muted-foreground">Data health checks are not relevant without an API key configured.</p>`);
var root$55 = from_html(`<section class="rounded-lg border border-border bg-card py-2 px-3"><h2 class="text-lg font-bold">Data health</h2> <!></section>`);
function DataHealth($$anchor, $$props) {
	push($$props, true);
	const $userdataStore = () => store_get(userdataStore, "$userdataStore", $$stores);
	const $torndataStore = () => store_get(torndataStore, "$torndataStore", $$stores);
	const $stockdataStore = () => store_get(stockdataStore, "$stockdataStore", $$stores);
	const $factiondataStore = () => store_get(factiondataStore, "$factiondataStore", $$stores);
	const $apiStore = () => store_get(apiStore, "$apiStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const corruptionChecks = user_derived(() => [
		{
			label: "Userdata",
			status: getHealthStatus($userdataStore(), isUserdataHealthy)
		},
		{
			label: "Torndata",
			status: getHealthStatus($torndataStore(), isTorndataHealthy)
		},
		{
			label: "Stockdata",
			status: getHealthStatus($stockdataStore(), isStockdataHealthy)
		},
		{
			label: "Factiondata",
			status: getHealthStatus($factiondataStore(), isFactiondataHealthy)
		}
	]);
	const hasApiKey = user_derived(() => !!$apiStore()?.torn?.key);
	var section = root$55();
	var node = sibling(child(section), 2);
	var consequent = ($$anchor) => {
		var div = root_1$40();
		each(div, 21, () => get(corruptionChecks), (check) => check.label, ($$anchor, check) => {
			DataHealthCheck($$anchor, {
				get label() {
					return get(check).label;
				},
				get status() {
					return get(check).status;
				}
			});
		});
		reset(div);
		append($$anchor, div);
	};
	var alternate = ($$anchor) => {
		append($$anchor, root_3$32());
	};
	if_block(node, ($$render) => {
		if (get(hasApiKey)) $$render(consequent);
		else $$render(alternate, -1);
	});
	reset(section);
	append($$anchor, section);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/options/components/about/maintenance.ts
async function runMaintenanceAction(action) {
	try {
		if (action === "reinitialize-timers") {
			await BACKGROUND_SERVICE.reinitializeTimers();
			toast.success("Reset background timers.");
		} else if (action === "clear-cache") {
			await BACKGROUND_SERVICE.clearCache();
			toast.success("Cleared cache.");
		} else {
			const result = await BACKGROUND_SERVICE.forceUpdate(action);
			if (result.success === false) toast.error("message" in result ? result.message : getActionError(result.error, `Failed to fetch ${action}.`));
			else {
				await loadDatabaseStores();
				toast.success(`Fetched ${action}.`);
			}
		}
	} catch (error) {
		toast.error(error instanceof Error ? error.message : "Action failed.");
	}
}
function getActionError(error, fallback) {
	if (error instanceof Error && error.message) return error.message;
	return fallback;
}
//#endregion
//#region src/extension/entrypoints/options/components/about/MaintenanceActionButton.svelte
var root_1$39 = from_html(`<span> </span> <!>`, 1);
function MaintenanceActionButton($$anchor, $$props) {
	push($$props, true);
	let isBusy = state(false);
	async function handleClick() {
		if (get(isBusy)) return;
		set(isBusy, true);
		try {
			await runMaintenanceAction($$props.action);
		} finally {
			set(isBusy, false);
		}
	}
	Button($$anchor, {
		type: "button",
		get variant() {
			return $$props.variant;
		},
		get disabled() {
			return get(isBusy);
		},
		get "aria-busy"() {
			return get(isBusy);
		},
		class: "relative w-full justify-center cursor-pointer",
		onclick: handleClick,
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = root_1$39();
			var span = first_child(fragment_1);
			let classes;
			var text = child(span, true);
			reset(span);
			var node = sibling(span, 2);
			var consequent = ($$anchor) => {
				{
					let $0 = user_derived(() => `${$$props.label} in progress`);
					Spinner($$anchor, {
						class: "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
						get "aria-label"() {
							return get($0);
						}
					});
				}
			};
			if_block(node, ($$render) => {
				if (get(isBusy)) $$render(consequent);
			});
			template_effect(() => {
				classes = set_class(span, 1, "", null, classes, { invisible: get(isBusy) });
				set_text(text, $$props.label);
			});
			append($$anchor, fragment_1);
		},
		$$slots: { default: true }
	});
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/components/about/MaintenanceButtons.svelte
var root_1$38 = from_html(`<div class="grid gap-2 sm:grid-cols-2"><!> <!> <!> <!></div>`);
var root_2$47 = from_html(`<p class="text-sm text-muted-foreground">Data health checks are not relevant without an API key configured.</p>`);
var root$54 = from_html(`<section class="rounded-lg border border-border bg-card py-2 px-3"><h2 class="text-lg font-bold">Maintenance</h2> <div class="mt-2 grid gap-4 lg:grid-cols-[2fr_1fr]"><section class="space-y-2"><h3 class="text-sm font-bold">Force update</h3> <!></section> <section class="space-y-2"><h3 class="text-sm font-bold">Other</h3> <div class="grid gap-2"><!> <!></div></section></div></section>`);
function MaintenanceButtons($$anchor, $$props) {
	push($$props, true);
	const $apiStore = () => store_get(apiStore, "$apiStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const hasApiKey = user_derived(() => !!$apiStore()?.torn?.key);
	var section = root$54();
	var div = sibling(child(section), 2);
	var section_1 = child(div);
	var node = sibling(child(section_1), 2);
	var consequent = ($$anchor) => {
		var div_1 = root_1$38();
		var node_1 = child(div_1);
		MaintenanceActionButton(node_1, {
			action: "userdata",
			label: "Userdata"
		});
		var node_2 = sibling(node_1, 2);
		MaintenanceActionButton(node_2, {
			action: "torndata",
			label: "Torndata"
		});
		var node_3 = sibling(node_2, 2);
		MaintenanceActionButton(node_3, {
			action: "stocks",
			label: "Stocks"
		});
		MaintenanceActionButton(sibling(node_3, 2), {
			action: "factiondata",
			label: "Factiondata"
		});
		reset(div_1);
		append($$anchor, div_1);
	};
	var alternate = ($$anchor) => {
		append($$anchor, root_2$47());
	};
	if_block(node, ($$render) => {
		if (get(hasApiKey)) $$render(consequent);
		else $$render(alternate, -1);
	});
	reset(section_1);
	var section_2 = sibling(section_1, 2);
	var div_2 = sibling(child(section_2), 2);
	var node_5 = child(div_2);
	MaintenanceActionButton(node_5, {
		action: "reinitialize-timers",
		label: "Reinitialize timers",
		variant: "outline"
	});
	MaintenanceActionButton(sibling(node_5, 2), {
		action: "clear-cache",
		label: "Clear cache",
		variant: "destructive"
	});
	reset(div_2);
	reset(section_2);
	reset(div);
	reset(section);
	append($$anchor, section);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/options/components/about/VersionDisplay.svelte
var root_1$37 = from_html(`<span class="font-medium"> </span>`);
var root_2$46 = from_html(`<span> </span>`);
var root$53 = from_html(`<section class="rounded-lg border border-border bg-card py-2 px-3"><h2 class="text-lg font-bold">Version</h2> <div class="mt-2 space-y-2 text-sm"><p>Version: <span class="font-medium"> </span></p> <p class="flex items-center gap-1">Disk space used: <!></p></div></section>`);
function VersionDisplay($$anchor, $$props) {
	push($$props, true);
	let storageSize = state(null);
	let storageSizeError = state(null);
	const manifest = browser.runtime.getManifest();
	const displayVersion = manifest.version_name ?? manifest.version;
	onMount(async () => {
		set(storageSizeError, null);
		try {
			set(storageSize, formatBytes(await ttStorage.getSize()), true);
		} catch (error) {
			set(storageSize, null);
			set(storageSizeError, error instanceof Error ? error.message : "Failed to load disk usage.", true);
		}
	});
	var section = root$53();
	var div = sibling(child(section), 2);
	var p = child(div);
	var span = sibling(child(p));
	var text = child(span, true);
	reset(span);
	reset(p);
	var p_1 = sibling(p, 2);
	var node = sibling(child(p_1));
	var consequent = ($$anchor) => {
		var span_1 = root_1$37();
		var text_1 = child(span_1, true);
		reset(span_1);
		template_effect(() => set_text(text_1, get(storageSize)));
		append($$anchor, span_1);
	};
	var consequent_1 = ($$anchor) => {
		var span_2 = root_2$46();
		var text_2 = child(span_2, true);
		reset(span_2);
		template_effect(() => set_text(text_2, get(storageSizeError)));
		append($$anchor, span_2);
	};
	var alternate = ($$anchor) => {
		Spinner($$anchor, {});
	};
	if_block(node, ($$render) => {
		if (get(storageSize)) $$render(consequent);
		else if (get(storageSizeError)) $$render(consequent_1, 1);
		else $$render(alternate, -1);
	});
	reset(p_1);
	reset(div);
	reset(section);
	template_effect(() => set_text(text, displayVersion));
	append($$anchor, section);
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/components/about/About.svelte
var root$52 = from_html(`<section class="space-y-4"><!> <!> <!> <!> <!></section>`);
function About($$anchor) {
	var section = root$52();
	var node = child(section);
	VersionDisplay(node, {});
	var node_1 = sibling(node, 2);
	DataHealth(node_1, {});
	var node_2 = sibling(node_1, 2);
	MaintenanceButtons(node_2, {});
	var node_3 = sibling(node_2, 2);
	Contact(node_3, {});
	CoreTeam(sibling(node_3, 2), {});
	reset(section);
	append($$anchor, section);
}
//#endregion
//#region src/extension/assets/changelog.json
var changelog_default = /* @__PURE__ */ JSON.parse("[{\"version\":{\"major\":9,\"minor\":0,\"build\":6},\"date\":\"2026/06/13\",\"logs\":{\"features\":[{\"message\":\"Use Torn Intel as (opt-in) source for the 'Travel Table'.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show faction stakeouts on the targets page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show an indication for faction stakeouts that they are destroyed.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show the absolute time when a RW starts or OC is ready when hovering over the timer in the sidebar.\",\"contributor\":\"RogerFar\"}],\"fixes\":[{\"message\":\"Resolve an edge-case while force loading the database with an update already going on.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Expose missing debug objects again.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix the disabling of gym stats not saving persistently on very small devices.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Don't show the FF score filters when the external service isn't enabled.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors in a lot of faction page features when visiting a destroyed faction.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix the faction id not showing up for a destroyed faction.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Faction Stakeouts' not working properly for a destroyed faction.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Notifications for the faction stakeout alert for when member count dropped would never trigger.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Faction Member Filter' trying to wait on last action even if it's disabled.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Only show parts of the Abroad Items Filter when actually applicable.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Resolve an issue where requesting the missing permissions kept failing.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix the check in 'Highlight Cheap Items' to see if it's still enabled failing if is 0% configured.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Put defensive items in their own category in the 'Travel Table'.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"More storage update listeners to support more live updates.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Have the popup take up the entire screen for smaller devices.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Pull job point information regular instead of on load with caching.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Include faction stakeouts in the exports.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update our backup calendar to be up-to-date.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Use a static list of items from the V2 api when needed, decreasing dependency on an active api key.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Allow 'Auction House Filter' to work when there is no API data.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Allow 'Bazaar Sub Vendor Items' to work when there is no API data.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Allow 'Energy Warning' to work when there is no API data.\",\"contributor\":\"DeKleineKobini\"}],\"technical\":[{\"message\":\"Refactor the data fetching function completely in preparation of future updates.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Restructure the extension in preparation for our userscript ports.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Restructure the stakeout data in our storage.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Restructure the faction stakeout data in our storage.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":9,\"minor\":0,\"build\":5},\"date\":\"2026/06/02\",\"logs\":{\"features\":[{\"message\":\"Initial url that can be filled: profile send money.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"'FF Scouter' score filter for the faction member list.\",\"contributor\":\"mystify-321\"}],\"fixes\":[{\"message\":\"Resolve an edge case with faction stakeouts not updating when there is no data yet, and you have specific alerts enabled.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the 'Warn Crime' feature.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the 'User Alias - Userlist' feature on the factions page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix the 'Fold Faction Infobox' icon not visually showing up.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the XHR interceptor on Firefox.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the 'Hide Icons' feature.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the 'Average Personal Stat' feature.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Travel Cooldowns' appearing the bank investment error when switching target country.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Bazaar Fill Max' using the wrong item price on mobile due to the market value offset.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix an edge case with 'Blackjack Strategy'.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Hopefully avoid the initial page jump with 'Align Left' (and other features), attempt 2.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the 'Energy Warning' feature.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix dragging items to your faction quick items after page load.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the 'Stats Estimate' feature for ranked wars.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the 'Car Win Percentage' feature.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the 'War Finish Times' feature.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors on the factions page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the 'Item Values' feature on the faction armory page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the 'Last Action Faction' feature.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Don't run sidebar features on the fullscreen poker page, causing a lot of errors since there is no sidebar there.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Don't run the 'Hide Gym Highlight' feature on pages without sidebar.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"'Total Challenge Contributions' can now handle individual contributions above 1 million.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Don't show the only new feed icon more than once per feed.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the 'Property Values' feature.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the 'Property Happiness' feature.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Resolve there being no option to disable the revive request feature anymore.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Better source detection when showing errors for Firefox.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Define our data collection permissions for Firefox (which is 'none', as we don't do data collection).\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Export more data ('localdata' which includes resized chats and hidden forum feeds, and 'migrations' for internal logic).\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Shorten the default timeout for 'requireElement'.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Redesign our internal pages.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Rename the point value label to credit value in the mission rewards.\",\"contributor\":\"DeKleineKobini\"}],\"removed\":[{\"message\":\"No longer keep API usage records.\",\"contributor\":\"DeKleineKobini\"}],\"technical\":[{\"message\":\"Change the structure for how we save 'User Alias' entries.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Rewrote the internal pages in Svelte.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":9,\"minor\":0,\"build\":4},\"date\":\"2026/05/14\",\"logs\":{\"features\":[{\"message\":\"'FF Scouter' score filter for ranked wars.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Labels for stakeouts.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Added bazaarOpen filter on abroad people page\",\"contributor\":\"mystify-321\"},{\"message\":\"More special filters to the 'Userlist Filter': has bounties and bazaar open\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Modify TTS speaking rate for notifications.\",\"contributor\":\"DeKleineKobini\"}],\"fixes\":[{\"message\":\"Filtering on profit in the 'Stocks Filter' gave errors for stocks you don't own.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Resolve an issue where 'Travel Cooldowns' doesn't work when you have don't have an active bank investment.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"'Travel Cooldowns' didn't show education or bank investment warnings.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Another attempt at maybe resolving the 'Abroad Items Filter' issue where it doesn't always work.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the 'Faction ID' feature.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Hopefully avoid the initial page jump with 'Align Left'.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the 'Medical Life' feature.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Allow dragging items to the 'Faction Quick Items' container from within the actions.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the 'Energy Warning' feature.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the 'Bar Links' feature.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the 'Property Happiness' feature.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the 'Property Values' feature.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Only trigger 'Disable Ally Attacks' for attacks that have yet to start.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the 'Job Points Tooltip' feature.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Resolve issues in 'Trade Open Chat' when checking for elements.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the 'NPC Loot Times' feature.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix ff-score filter setting on abroad filter\",\"contributor\":\"mystify-321\"}],\"changes\":[{\"message\":\"Changes to the logging of failure cases while updating in the background.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"No longer round your 'Gym Progress' to the nearest multiple of 5, since company modifiers make that not accurate.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Move the fair fight results to right under the profile title.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":9,\"minor\":0,\"build\":3},\"date\":\"2026/05/08\",\"logs\":{\"fixes\":[{\"message\":\"Remove errors that were a debugging tool in 'City Items'.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Remove a race condition in the 'Display Case Worth'.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"'Disable Ally Attacks' didn't disable the attack early enough.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Hopefully remove a race condition with removing stakeouts.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Reintroduce missing achievements on various pages, but primarily for crimes.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"'Bazaar Fill Max' no longer showed up on smaller screens.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Travel Item Profits' applying from colors when taxes would impact the color.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"More lenient handling of errors in the XID extraction from the DOM.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid adding infinite stocks money inputs.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Only trigger 'Disable Ally Attacks' for attacks that have yet to start.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Center 'Disable Ally Attacks' display text.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Adapt 'Clean Flight' for the new travel update.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Adapt 'Travel Table' for the new travel update.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Handle empty NPC responses from Loot Ranger.\",\"contributor\":\"DeKleineKobini\"}],\"technical\":[{\"message\":\"Load the XHR and fetch script earlier, to catch more requests at the page load.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":9,\"minor\":0,\"build\":2},\"date\":\"2026/05/02\",\"logs\":{\"fixes\":[{\"message\":\"Show countdowns again for the popup icons.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"The feature manager doesn't show all features if the name is too similar.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"'OC Timer' doesn't show the proper OC Time for those still on OC1 and faction API Access.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the 'Only New Feed' feature.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Stats Estimate Faction Wars' no longer showing up.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the 'War Finish Times' feature.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Resolve visibility for the feature manager when chats would overlap.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Display achievements correctly again.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid issues with some racing features when opening the racing page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Racing Filter' not showing any races when all tracks are deselected.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Retry applying column names so the 'Abroad Items Filter' has a better chance of working.\",\"contributor\":\"DeKleineKobini\"}],\"removed\":[{\"message\":\"Remove auto reload when an update is detected, as it might have caused the reload loop.\",\"contributor\":\"DeKleineKobini\"}],\"technical\":[{\"message\":\"Improved storage for 'Resizable Chat' when there hasn't been a resize yet.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Apply a minimum size for 'Resizable Chat'.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":9,\"minor\":0,\"build\":1},\"date\":\"2026/05/01\",\"logs\":{\"fixes\":[{\"message\":\"When you 'Custom Links' contain links with custom links, they no longer showed up.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Round your 'Gym Progress' to the nearest multiple of 5.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":9,\"minor\":0,\"build\":0},\"title\":\"Another Rework: WXT\",\"date\":\"2026/05/01\",\"logs\":{\"features\":[{\"message\":\"'User Alias' for chat V3.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Allow more supply packs as 'quick items'.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Allow chat v3 text areas to be resized.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Include an option to disable the outside link alert.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show supply pack total value when opening them through 'Quick Items'.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show ranked war reward value per faction.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Allow needle boosters as quick items.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Timed notifications if you haven't used your refills yet.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Hide threads from your different forum feeds.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add total working stats as personal stat in the profile box.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show total challenge contributions.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Allow most filters to be disabled without losing the state of said filter.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Configurable TTS voice.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Sync travel data to Torn Intel.\",\"contributor\":\"DeKleineKobini\"}],\"fixes\":[{\"message\":\"Items in bazaars with prices lower than the city sell prices were not always highlighted.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"'Efficient Rehab' didn't always properly update the slider color.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Use broader safety check for event start time checks.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix popup not opening for a little bit after adding a new stakeout.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Resolve incompatibility between 'Stock Filer' and 'Hide Stocks'.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix Stats Estimates not showing on the HOF page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix popup icons scrolling being available unnecessarily.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Highlight blood bags in the faction armory again.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Hide completed education courses again.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix stats estimate styling on the enemies page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix temporary items no working in quick items anymore.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix stats estimate on the attack page for the attacker not working.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Resolve error when clicking the settings link in the popup.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Travel Table' for first time travelers.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid sending out duplicate notification on startup.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid doing too many api calls on startup.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Abroad People Filter' and 'Userlist Filter' not working if FFScouter is disabled.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors in 'User Alias - Chat' in private chats when chat bubbles are enabled.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix performance issues with 'FFScouter Gauge'.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix styling issues with 'Stocks Money Input' on mobile devices.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Stocks Money Input' disappearing after buying or selling a stock.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Gym Progress' styling issues on mobile.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Ally Faction' options not properly saving faction names if they begin with a number.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fallback in the fetch interceptor to avoid errors with there not being a url.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Non-stackable items in a trade of the same type wouldn't be counted in 'Trade Value' in the log.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Bank Investment Due Time' throwing an error when there is no active investment.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Disable Ally Attacks Loader' no longer loading.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Weapon Bonus Information' not loading for longer attack logs.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix mission page features not refreshing after an action.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid highlighting too much in the chat highlight when an highlight value is empty or non-existent.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"'Ranked War Filter' and 'Faction Member Filter' no longer worked with filtering on activity.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Replace all FontAwesome icons with others, mainly from Phosphor Icons.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Improved error handling for YATA in the travel table.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Completely different migration system for our storage\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Move more stuff to the V2 API.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Make a distinction in error handling for no internet vs YATA taking too long.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Allow requests to YATA to take longer (30s, from 10s).\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Use the profile information for initial stakeout data.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Make errors from FFScouter visible in the 'Gauge' feature.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Reapply user aliases in the chat on a reconnect.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Check for autocomplete in the chat again on a reconnect.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update bar links to open in new window on control click and new tab with shift.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Have custom links follow their configured preset when changed.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Rework the settings link to work better on the various screens, by having it take up the full screen.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Hold the stock sales tax into account for the 'Stocks Money Input'.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Round down the amount of stocks to buy with 'Stocks Money Input'.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Only show 'FF Scouter Gauge' on focused tabs, as part of performance fixes.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"As request by staff, disable 'Auto API Demo' by default and for all existing users.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Only select as much rehabs as you can afford in 'Efficient Rehab'.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Cleanup last references to the old loader.php page.\",\"contributor\":\"DeKleineKobini\"}],\"technical\":[{\"message\":\"Migrate to a web-extension framework: WXT.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":8,\"minor\":1,\"build\":4},\"date\":\"2026/04/08\",\"logs\":{\"features\":[{\"message\":\"Add FF Score filter to the user list filter.\",\"contributor\":\"jensim\"},{\"message\":\"Add FF Score filter to the abroad user filter.\",\"contributor\":\"jensim\"},{\"message\":\"Add money input to stock buying and selling.\",\"contributor\":\"TheFoxMan\"}],\"fixes\":[{\"message\":\"Fix the stats estimate for the faction wars.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix blood bag highlighting not working on the factions page.\",\"contributor\":\"jensim\"},{\"message\":\"Don't reduce the item value count for 'infinite use items' when using them.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix mission features no longer loading.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix bar link no longer working.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Improve popup on smaller devices.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Hide the radiation hospital icon.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update 'Motivator' mission hint to no longer state that timing out fails the mission.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Stop the popup status timer for counting into the negative.\",\"contributor\":\"DeKleineKobini\"}],\"removed\":[],\"technical\":[]}},{\"version\":{\"major\":8,\"minor\":1,\"build\":3},\"date\":\"2026/03/04\",\"logs\":{\"fixes\":[{\"message\":\"Resolve ff scouter errors on the profile blocking all actions.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix features that load before page load often failing.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix faction features appearing more than once on page load.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix job points on icon hover after using them.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix loading of FF_SCOUTER_SERVICE.\",\"contributor\":\"jensim\"},{\"message\":\"Fix an issue with the torndata update cycle running way too often.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Track arson skill for the achievements.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Track stock investment for the achievements.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"General improvements to the achievements feature.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Reload the extension to get the available update faster.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fetch required data immediately after importing your settings.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fetch data immediately after gaining connection again.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Increase cache time for FF-scouter results from 1 hour to 1 day\",\"contributor\":\"jensim\"}]}},{\"version\":{\"major\":8,\"minor\":1,\"build\":2},\"date\":\"2026/02/20\",\"logs\":{\"features\":[{\"message\":\"Show crime item values in crimes 2.0.\",\"contributor\":\"DeKleineKobini\"}],\"fixes\":[{\"message\":\"Fix the weapon and temporary weapon filters on the travel table.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix the weapon category filter on the armory filter.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix the weapon category filter on the auction house filter.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix oc1 timer if it's based on your icons.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Change torndata update rules to make sure we get up-to-date point stats.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Make the points value hover text change when the value changes.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"General improvements to the energy warning feature.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":8,\"minor\":1,\"build\":1},\"date\":\"2026/02/14\",\"logs\":{\"features\":[{\"message\":\"Ranked War timer in sidebar.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Virus timer in sidebar.\",\"contributor\":\"DeKleineKobini\"}],\"fixes\":[{\"message\":\"Don't show the FF column more than once on the faction info tab.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Reduce false positive errors from showing up.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix supply pack value not always showing up.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix faction quick items not being modifiable in the edit view.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Adapt to the most recent chat v3 version, which broke all chat features.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Hopefully fix both inactivity warnings showing a lot of false positives.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Don't run on the job listing and swagger pages.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix errors on the attack loader page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Proper error handling for FFScouter error responses.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix multiple revive providers no longer working properly, after they broke it by unilaterally changing their API without letting us known: Nuke, UHC, Laekna.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix cheap highlighted items to not be unhighlighted.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Improve faction tab detection to avoid running listeners twice.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Improve error showing in the feature manager.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Write a hint for the 'Inside Job' mission.\",\"contributor\":\"Taznister\"},{\"message\":\"Move more stuff to the V2 API.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Proper error handling for FFScouter error responses.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update Love Juice effects to reflect the changes.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Reject the update of torndata if Torns response is corrupted.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Additional check to not run an old oc1 feature on oc2.\",\"contributor\":\"DeKleineKobini\"}],\"removed\":[{\"message\":\"Remove block zalgo because it's no longer relevant.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Remove API markings because it's no longer very relevant due to API V2.\",\"contributor\":\"DeKleineKobini\"}],\"technical\":[{\"message\":\"No longer use any custom prototype functions.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":8,\"minor\":1,\"build\":0},\"date\":\"2026/01/31\",\"logs\":{\"fixes\":[{\"message\":\"Fix gym progress showing some weird characters.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix faction armory features no longer showing up.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix attack timeout warning not working after a reload.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix attack timeout warning sound not playing for custom sounds.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Travel Cooldowns' on horizontal tablet views'.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Flying Time' on horizontal tablet views'.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Highlight words even if there is punctuation at the end of the word.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Only play sounds and send a notification when your attack is going to timeout when the tab is focused, to be rule compliant.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Only highlight chat messages when the tab is focused, to be rule compliant.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Only highlight chat boxes when the tab is focused, to be rule compliant.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Only highlight cheap item market items when the tab is focused, to be rule compliant.\",\"contributor\":\"DeKleineKobini\"}],\"removed\":[{\"message\":\"Remove HeLa revives, since they no longer do those. By default 'Midnight X' will be the new provider if you had HeLa selected.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Temporary disable 'Enemy Filter' until we can find a compliant way to keep it or remove it.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Temporary disable 'Friend Filter' until we can find a compliant way to keep it or remove it.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Temporary disable 'Target Filter' until we can find a compliant way to keep it or remove it.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Temporary disable 'OC2 Filter' until we can find a compliant way to keep it or remove it.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Temporary disable 'Burglary Filter' until we can find a compliant way to keep it or remove it.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":8,\"minor\":0,\"build\":5},\"date\":\"2026/01/21\",\"logs\":{\"features\":[{\"message\":\"Extend Cooldown End Times to bars.\",\"contributor\":\"TheFoxMan\"}],\"fixes\":[{\"message\":\"Fix job points tooltip not always showing up.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Forum Menu' not working on the thread list.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Resolve a lot of features blocking after network issues (like a laptop in sleep mode).\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Resolve styling conflicts between Torn and FontAwesome (which we inject).\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix various issues with filters.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Only load 'Computer Link' on the travel pages.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Use MutationObserver for Cooldown End Times.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Only send travel data to YATA and Prometheus while the tab is active, to comply with new rule interprations.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Change the number formatting to round the number by default, to avoid issues with decimals.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Multiple improvements to filters.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":8,\"minor\":0,\"build\":4},\"date\":\"2026/01/13\",\"logs\":{\"fixes\":[{\"message\":\"Fix Weapon Bonus filters being completely broken and breaking the full filter with it.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix incorrect default value for bail cost in the jail filter.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix sound notifications.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix faction quick items not being able to be added.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Better error handling on the gym graph for when the external service is too slow.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix faction stakeouts triggering unnecessary.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix faction stakeouts not being saved properly.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Notifications in the popup weren't loading.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Switching travel type in the travel agency caused significant lag and even resulted in freezing in some cases.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors for the Item Market Fill Max by not running when you can't access the item market.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Block the bail cost field in the jail filter from going below 0.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Change 'Travel Table' external service order (prefer Prometheus over YATA).\",\"contributor\":\"DeKleineKobini\"}],\"technical\":[{\"message\":\"Better type checks for background messages.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":8,\"minor\":0,\"build\":3},\"date\":\"2026/01/08\",\"logs\":{\"features\":[{\"message\":\"Apply sales tax on the items abroad table.\",\"contributor\":\"aHunterGatherer\"},{\"message\":\"Apply sales tax on the values in the travel table.\",\"contributor\":\"aHunterGatherer\"},{\"message\":\"Show market values in the sell list of the city shops.\",\"contributor\":\"DeKleineKobini\"}],\"fixes\":[{\"message\":\"Fix 'Cooldown End Times' not being correct for all icons.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix profile box currency table cells not working\",\"contributor\":\"AllMight\"},{\"message\":\"Fix 'Travel Table' not being loaded correctly when YATA is slow.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Cooldown End Times' not properly displaying times when hovering over multiple icons in sequence.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Armory Filter' not saving the armor bonus value.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Armory Filter' not applying the armor bonus filter.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Auction House Filter' not saving the armor bonus and weapon quality values.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'NPC Loot Times' failing when the data is not yet available.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Gym Progress' no longer showing up.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix errors while in the travel agency.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix education completed detection being wrong in a lot of cases.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Jail Filter' not saving the bail cost.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Travel Item Profits' not showing the profit after buying an item or canceling.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors when buying an abroad item or canceling.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors while in the abroad item shop.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Bank Investment Due Time' giving errors when there isn't an investment going on.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix shop features not working correctly on the post office shop.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Improve element instance checking to avoid potential errors.\",\"contributor\":\"DeKleineKobini\"}],\"technical\":[{\"message\":\"Continue work on TypeScript migration.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Migrate specialist gyms to typescript\",\"contributor\":\"AllMight\"},{\"message\":\"Continue work on TypeScript migration.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Make it easier to work with getting all elements.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":8,\"minor\":0,\"build\":2},\"date\":\"2025/12/22\",\"logs\":{\"features\":[{\"message\":\"Filter abroad items on out of stock.\",\"contributor\":\"DeKleineKobini\"}],\"fixes\":[{\"message\":\"Fix 'Travel Item Profits' layout on mobile and tablet.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Racing Filter' not working when selecting a track.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors in 'Burglary Filter' when scouting.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix incorrect number parsing, breaking several features.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Improve 'Travel Item Profits' layout on desktop.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Reload Gym Graph right after updating battle stats on TornStats.\",\"contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":8,\"minor\":0,\"build\":1},\"date\":\"2025/12/19\",\"logs\":{\"fixes\":[{\"message\":\"'Live Networth' was no longer loading, which is now resolved.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Resolve race condition causing 'Highlight Cheap Items' to not always load.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Solve badge text getting stuck at some times.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Abroad Items Filter' visually for the new^2 layout.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix 'Abroad Auto Fill Max' for the new^2 layout.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix 'Travel Item Profits' for the new^2 layout.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Avoid errors when hovering over the organized crime icon.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Incorrect date was being shown in some cases.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Experiment to avoid custom links showing at the bottom of the page.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Update 'Travel Sync' to use the new new structure.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Only show last 93 days of battle stats history on the gym page.\",\"contributor\":\"DeKleineKobini\"}],\"removed\":[{\"message\":\"Remove 'Sort Travel Market' since it was natively implemented.\",\"contributor\":\"DeKleineKobini\"}],\"technical\":[{\"message\":\"Continue work on TypeScript migration.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":8,\"minor\":0,\"build\":0},\"title\":\"a technical leap: TypeScript\",\"date\":\"2025/12/14\",\"logs\":{\"features\":[{\"message\":\"Added travel timer in browser-tab\",\"contributor\":\"luke__\"}],\"fixes\":[{\"message\":\"Fix 'Bazaar Worth' not always staying visible.\",\"contributor\":\"AllMight\"}],\"changes\":[{\"message\":\"Fix event worth not rounding, resulting in a lot of decimals sometimes.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix most abroad features after changes by Torn, the others were removed/disabled.\",\"contributor\":\"DeKleineKobini\"}],\"technical\":[{\"message\":\"Initial work on TypeScript migration.\",\"contributor\":\"AllMight\"},{\"message\":\"Continue work on TypeScript migration.\",\"contributor\":\"DeKleineKobini\"}],\"removed\":[{\"message\":\"Temporary disable 'Abroad Buy No Confirm' until we can find a resolution or permanently remove it.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Temporary disable 'Abroad Fill Max' until we can find a resolution or permanently remove it.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Temporary disable 'Abroad Energy Warning' until we can find a resolution or permanently remove it.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Removed 'Drug Details' support while abroad.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Removed 'Stats Estimates' on the competition page due to performance concerns (it wasn't working for this year already).\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Removed 'Competition Filter' due to page changes and potential rule concerns.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":7,\"minor\":9,\"build\":3},\"date\":\"2025/12/02\",\"logs\":{\"features\":[{\"message\":\"Re-enable new specialists gym feature\",\"contributor\":\"AllMight\"}],\"fixes\":[{\"message\":\"Fix some errors causing errors of their own while trying to log them.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix some errors losing crucial information (the location where it originates).\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix specialist gyms overlapping single stat and two stats combinations.\",\"contributor\":\"AllMight\"},{\"message\":\"Don't show the bank investment due date when there is no active investment.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Corrected spelling of Sewage in the racing filter\",\"contributor\":\"XDeltaA77\"}],\"changes\":[{\"message\":\"Update travel sync logic.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Hint for 'Safari' mission\",\"contributor\":\"Taznister\"},{\"message\":\"Make 'Event Worth' work with item market sales.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":7,\"minor\":9,\"build\":2},\"date\":\"2025/11/05\",\"logs\":{\"fixes\":[{\"message\":\"Fix specialist gyms by reverting to the old version.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":7,\"minor\":9,\"build\":0},\"date\":\"2025/11/04\",\"logs\":{\"features\":[{\"message\":\"Specialist gyms live stats sync and new bottom box info with new algorithm.\",\"contributor\":\"AllMight\"},{\"message\":\"Added an advanced filter for Custom Races.\",\"contributor\":\"Simpsons\"},{\"message\":\"Notification at a set time when you are at the maximum mission amount.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Notification certain hours before a mission expires.\",\"contributor\":\"DeKleineKobini\"}],\"fixes\":[{\"message\":\"Show 'Faction Quick Items' on the 'Consumables' tab for the faction armory.\",\"contributor\":\"Simpsons\"},{\"message\":\"Extend supply pack animation wait delay.\",\"contributor\":\"AllMight\"},{\"message\":\"Fix 'disable ally attacks' after the profile update.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Specialist gyms refactor.\",\"contributor\":\"AllMight\"},{\"message\":\"Update can energy formula to take the event into account.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update alcohol nerve formula to take the events into account.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update candy happy formula to take the event into account.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Change cooldown end times to work on \\\"click\\\" on mobile.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Move last action to the new native element.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Move FFScouter in the mini profile to the status description instead of last action.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fetch mission data in the 'basic' userdata cycle.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Send notifications faster when queued outside the usual fetching cycle.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":7,\"minor\":8,\"build\":6},\"date\":\"2025/10/09\",\"logs\":{\"fixes\":[{\"message\":\"Fix some database migrations to resolve issues with several features.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix can energy formula to be accurate.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix bazaar fill max not working when clicking the actual icon.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Update can energy formula to take books into account.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":7,\"minor\":8,\"build\":5},\"date\":\"2025/10/06\",\"logs\":{\"features\":[{\"message\":\"Notification for being offline a certain amount of hours.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add crime status filter to OC2 filter (Paid/Unpaid/Chain/Failed) - appears on completed crimes tab.\",\"contributor\":\"vALT0r\"}],\"fixes\":[{\"message\":\"Hide burglary filter when no longer on the burglary page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Resolve chat highlight issue when there is no api key present.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix casino net total not being shown on all games anymore.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Don't break the travel table if an item no longer exists.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix travel table not showing up while flying if you reload the page.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Optimize item market API call by limiting it to the amount of items we show.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Move all API calls to the V2 API, using the legacy selections parameter instead to reduce the amount of calls we do again.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Minor improvement in the error handling of TornStats calls.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Improve job points tooltip to work while switching jobs.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Format job points in the tooltip with thousands separators.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Provide a button to clear your cache.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Automatically detect desynchronized times and reset all time related updates.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":7,\"minor\":8,\"build\":4},\"date\":\"2025/09/16\",\"logs\":{\"fixes\":[{\"message\":\"Fix 'basic userdata' not updating anymore, resulting in multiple features using outdated information.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Optimize stats estimate API call.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":7,\"minor\":8,\"build\":3},\"date\":\"2025/09/12\",\"logs\":{\"fixes\":[{\"message\":\"Fix OC 1 and OC2 timers no longer showing up.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix travel cooldowns no longer showing up.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix bank investment no longer showing up.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix money not showing correctly in the popup.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Solve another (unrelated) issue with stats estimates no longer working.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":7,\"minor\":8,\"build\":2},\"date\":\"2025/09/10\",\"logs\":{\"fixes\":[{\"message\":\"Solve issue with stats estimates no longer working.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Move more stuff to the V2 API.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":7,\"minor\":8,\"build\":0},\"date\":\"2025/09/03\",\"logs\":{\"features\":[{\"message\":\"Crimes 2.0 Burglary Targets filter.\",\"contributor\":\"TheFoxMan\"}],\"fixes\":[{\"message\":\"Fix your country not always being properly send when requesting a revive.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Bypass the API cache for V2 calls. This should result in new data properly flowing through.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix scrolling through the sidebar not being possible on the items page on mobile.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the 'Highlight Cheap Items' when there is no price element.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Link to the explosive grenades wiki page for the 'Loud and Clear' mission hint.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Align the page backdrops when using the align left feature.\"},{\"message\":\"Include Vanguard armor set in the faction armory filter.\",\"contributor\":\"DeKleineKobini\"}],\"removed\":[{\"message\":\"Remove 'Defender Last Action' due to the information no longer being available without many API calls.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":7,\"minor\":7,\"build\":4},\"date\":\"2025/07/12\",\"logs\":{\"features\":[{\"message\":\"Hide newspaper highlight.\",\"contributor\":\"DeKleineKobini\"}],\"fixes\":[{\"message\":\"Rename the 'Paralyzed' bonus to 'Paralyze.'\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Correctly calculate the player age.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix gym features not appearing when going back to the same gym while selecting another one.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix bazaar highlight of cheap items not working.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix drug details not working on the bazaar page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix respect not being tracked anymore in the attack history.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":7,\"minor\":7,\"build\":3},\"date\":\"2025/06/20\",\"logs\":{\"fixes\":[{\"message\":\"Fix gym features not appearing when going back to the same gym.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix api key validation being broken.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix abroad people filter no longer working.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix travel cooldowns not working properly on mobile.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Update 'Make it Slow' mission hint.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":7,\"minor\":7,\"build\":2},\"date\":\"2025/06/16\",\"logs\":{\"features\":[{\"message\":\"Add 'Laekna' as revive provider.\",\"contributor\":\"DeKleineKobini\"}],\"fixes\":[{\"message\":\"Fix FF Scouter failing when there isn't a result.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Correctly show 'network issues' again instead of 'permissions issues' when all permissions are in order.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix ranked war filter (and potentially other filters) ignoring stat estimates filters when updating on the timer.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix ranked war filter applying stat estimates filters on the normal faction members list.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix permissions when changing revive provider.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix the 'Show Faction Spy' feature incorrectly showing the mobile view.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix the 'Show Faction Spy' requiring both YATA and TornStats to be enabled.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix the 'Show Faction Spy' not showing the total when using YATA.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix compatibility between 'Show Faction Spy' and 'FF Scouter'.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix racing features not working on the new raceway page.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Show date of notifications in the popup, unless they were shown today.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Migrate key info over to API V2.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show the (important) reason of the hospitalization in the stakeout message.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Hovering over the 'Faction Spy' will now show the full stats.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Move links to the new raceway url.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Move and adjust links to the new item market url.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update 'A Thor Loser' mission task.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":7,\"minor\":7,\"build\":1},\"date\":\"2025/05/22\",\"logs\":{\"changes\":[{\"message\":\"Include item market personal stats in the profile box.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Rename profile box stats to be the same as in-game itself.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Remove permission 'tabs' that was accidentally left over from testing.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Include crimes 2 skills in the profile box.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":7,\"minor\":7,\"build\":0},\"date\":\"2025/05/21\",\"logs\":{\"features\":[{\"message\":\"Populate bazaar prices in the popup by using TornPal.\",\"contributor\":\"Weav3r\"},{\"message\":\"Make more efficient use of your rehabs.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Create a ToS page.\",\"contributor\":\"DeKleineKobini\"}],\"fixes\":[{\"message\":\"Fix OC1 detection not working properly.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix auction house filter breaking for weapon type when a weapon without type appears (like Bolas).\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Load faction features correctly when opening tabs in a new browser tab.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the faction member filter.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the jail filter.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the faction last action feature.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix faction fold infobox not always working.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors with the faction stats estimate filter.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix sidebar custom links placed above or below 'My Faction' not showing.\",\"contributor\":\"XDeltaA77\"},{\"message\":\"Fix 'FF Scouter' on Firefox causing visual issues on the RR page when honor were disabled.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update source for blackjack strategy to reflect hitting is authorized after split Aces.\",\"contributor\":\"EazzyPeazzy\"},{\"message\":\"Fix Blackjack script not proposing a strategy when splitting 2s and then being dealt another 2.\",\"contributor\":\"EazzyPeazzy\"},{\"message\":\"Fix Blackjack script not proposing the right play when splitting Aces and being dealt another Ace.\",\"contributor\":\"EazzyPeazzy\"},{\"message\":\"Move bazaar prices in the popup to using TornW3B.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix OC2 timer.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix some icons not being hidden properly.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Change the OC2 Highlight color on dark mode.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Allow level filters for friends, enemies, targets, user search and abroad go to 0 due to NPCs being level 0.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Allow filtering on temporary weapons in the auction house filter.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Trigger tablet more at 1000px instead of at 960px.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Apply ranked war filters on an interval to follow the live updates.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Adjust Trade Open Chat to work with Chat 3.0.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Adjust point cost of Mining Boom from 10 to 5\",\"contributor\":\"StaticFree\"},{\"message\":\"Improve compatability with the faction stats script for the ranked war filter.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Focus on the search input by default on our settings page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update the hint of 'Army of One' to make clear that the target doesn't need to be defeated.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Rework external services preference to link to the ToS of each applicable service.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Migrate FFScouter (the feature) from TornPal to FFScouter (the service).\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Improve sidebar information loading.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":7,\"minor\":6,\"build\":1},\"date\":\"2025/04/18\",\"logs\":{\"changes\":[{\"message\":\"Move drag-drop-touch to our own ownership, to be in compliance with Firefox 3rd-party library rules.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":7,\"minor\":6,\"build\":0},\"logs\":{\"features\":[{\"message\":\"Filter on OC2 crimes.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Warn when joining a crime without passing the conditions (only item for now).\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Filter on the friends page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Stats estimates on the targets page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Filter on the targets page.\",\"contributor\":\"DeKleineKobini\"}],\"fixes\":[{\"message\":\"Fix Travel Table appearing on Home page when not flying.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix achievements being broken when still on crimes 1.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix refills for faction quick items. Might need to read them though.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix travel time not showing up on mobile view.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix job specials not working when there is a company without a special for a certain level.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix the gym stat disable not allowing trains when deselecting the checkbox.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix debug info listing a useless browser brand.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix the auction house filter breaking for items without damage, accuracy or defence when the respective filter is configured.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix Easter Egg Hunt not running because of a time check being incorrect..\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Highlight your own OC2 crime.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Improve OC version detection.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Adjust block zalgo to work with the new chat 3.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Adjust chat autocomplete to work with the new chat 3.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Adjust chat highlight to work with the new chat 3.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Adjust colored chat to work with the new chat 3.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Adjust font size to work with the new chat 3.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Adjust hide chat to work with the new chat 3.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Adjust search chat to work with the new chat 3.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Adjust trade timer to work with the new chat 3.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Check Easter Egg Hunt times dynamically.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Option to disable the blocking Easter Egg Hunt alert.\",\"contributor\":\"DeKleineKobini\"}]},\"date\":\"2025/04/17\"},{\"version\":{\"major\":7,\"minor\":5,\"build\":3},\"date\":\"2025/03/17\",\"logs\":{\"features\":[{\"message\":\"Show last action of defender on attack page.\",\"contributor\":\"TheFoxMan\"}],\"fixes\":[{\"message\":\"Fix vault networth being shown twice with live networth.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix attack history not updating properly.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Faction Quick Items on mobile didn't seem to allow refills being added.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix adding points to faction quick items when they are refillable\",\"contributor\":\"xentac\"},{\"message\":\"Show the correct steadfast bonus when reading a stat specific book.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix Attack Page Title modification.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Enemies filter.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Enemies page Stats Estimates.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Completely disable the train button for disabled stats as extra measure.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Adjust FF Scouter for the reworked friends, enemies and target pages.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update book and item descriptions.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Adjust achievements to show on the new travel page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Adjust clean flight to work with the new travel page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Adjust computer link to work on the new travel page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Adjust flying and landing time to work on the new travel page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Adjust travel cooldown to work with the new travel page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Adjust travel table to work with the new travel page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Improve forum menu compatibility with dark mode.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Change (faction) quick items to work better without api key.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Disable more OC1 features when OC2 has been detected.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":7,\"minor\":5,\"build\":2},\"date\":\"2025/03/05\",\"logs\":{\"fixes\":[{\"message\":\"Fix the company id showing something wrong.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix the faction id not working for your own faction.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix faction last action not working for other factions.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix faction last action filter not appearing.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Change layout of preferences page on mobiles.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Correctly list Love Juice cooldown.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Option to highlight items in Bazaars that have a cost less than the vendor price.\",\"contributor\":\"TravisTheTechie\"},{\"message\":\"Update 'Painleth Dentitht' mission hint.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Prevent error on the faction page when member list is modified\",\"contributor\":\"MOBermejo\"},{\"message\":\"Migrate attacks over to API V2.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Migrate faction stakeouts over to API V2.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Migrate faction last action over to API V2.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Make icons in the popup clickable to open their corresponding pages.\",\"contributor\":\"Hashibee\"},{\"message\":\"Show some more networth types in live networth.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"More accurate/useful end time for OC2 countdown in sidebar\",\"contributor\":\"Phoenix\"}]}},{\"version\":{\"major\":7,\"minor\":5,\"build\":1},\"date\":\"2025/02/11\",\"logs\":{\"fixes\":[{\"message\":\"Fix custom sounds not working anymore.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Migrate the database when the background loads as well, if needed.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Solve the performance issue with FF Scouter gauges.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix the faction id feature not running when it should.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix background errors when only attacks are fetched.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix incorrect migration from personalstats.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Keep a consistent order within the sidebar information section.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Change some features to be compatible with older browsers again.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update the hardcoded items which we use as fallback.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Improve background performance.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update all company specials to avoid outdated specials being shown.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Improve the detection which faction id you are currently visiting.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Refactor the company id feature.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":7,\"minor\":5,\"build\":0},\"date\":\"2025/02/07\",\"logs\":{\"features\":[{\"message\":\"Sidebar timer for OC 2.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fill Max for Item Market 2.0.\",\"contributor\":\"TheFoxMan\"}],\"fixes\":[{\"message\":\"Split requests to TornPal if more scouts are needed than allowed in a single request.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Be more resilient when checking if the api key is present.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Correctly detect the background page on Firefox. This should fix multiple features, including the event badge.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid blocking FF scouter gauges on unconfigured pages.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Be more resilient when applying chat highlights.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Disable OC1 timer when detecting OC 2 data.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Disable Faction OC timer when detecting OC 2 data.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Better note about external services.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show FF scouter gauge on more pages when honor bars are disabled.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Filter on any weapon bonus in the faction armory.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add a button to force update your userdata.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Completely migrate over to API v2 for personalstats.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Adjust achievements for crimes 2.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Include some missing achievements like hospitals and jail visits and special ammo.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Improve page detection on 'loader.php'.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Check whether your data is corrupted on the about page.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":7,\"minor\":4,\"build\":2},\"date\":\"2025/01/15\",\"logs\":{\"features\":[{\"message\":\"Hide the recycle message on the item page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Hide the too many items warning on the item page.\",\"contributor\":\"DeKleineKobini\"}],\"fixes\":[{\"message\":\"Correctly count the supply pack value.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid an error on the item market when switching categories.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Actually show an error when the revive request fails instead of showing the success message.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Opening a mini profile while on a profile no longer results in the FF Scouter being shown on the profile.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Improved performance while using FF Scouter in some cases.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Route tornpal requests through the background to bypass Torn's CSP policy on Firefox.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid an error on the enemy page when switching pages.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid issues with FF scouter by loading a script earlier.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"FF Scouter gauges weren't showing when honor bars were disabled or on the bounties page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Personal stats no longer showed up in the profile box due to an API change.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Include some missing stats in the profile box.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Better optimize calls to tornpal.\",\"contributor\":\"DeKleineKobini\"}],\"removed\":[{\"message\":\"No longer send revive requests to The Imperium as it no longer worked.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":7,\"minor\":4,\"build\":1},\"date\":\"2025/01/03\",\"logs\":{\"fixes\":[{\"message\":\"Include personal stats on the profile box that were accidentally removed again.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Include missing personal stats on the profile box.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":7,\"minor\":4,\"build\":0},\"date\":\"2025/01/03\",\"logs\":{\"features\":[{\"message\":\"Option for moving the item market category list to the left.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add ranked war hits and wins to Profile Box.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Add easter eggs found and used, territory clears and raid hits to Profile Box.\",\"contributor\":\"DeKleineKobini\"},{\"message\":[\"FairFight Scouter ('FF Scouter') on various pages (profile, mini-profile, attack page and honor bars).\",\"Credits to Glasnost [1844049] for TornPal and rDacted [2670953] for the original script ('FF Scouter').\",\"Requires 'TornPal' to be enabled as external service.\"],\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add 'Wolverines X' as revive provider.\",\"contributor\":\"DeKleineKobini\"}],\"fixes\":[{\"message\":\"Fix personal stat average injection on Firefox.\",\"contributor\":\"tiksan\"},{\"message\":\"Fix jail score filter not working properly anymore.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix drug details not showing on the item page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Bugs & Issues forum warning wasn't showing up in all places anymore.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Link market icons to the new item market.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Link market icons for missing sets to the new item market.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Link popup items to the new item market.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Properly show links when using refills through faction quick items.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid errors on the bank page when there is no API key.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Only show seconds in the oc timer and faction oc timer when there is less than an hour left.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Filter on activity on the enemy list.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update our external library for sortable lists: SortableJS.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update our external library for icons: Font Awesome.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update our external library for charts: ChartJS.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update our external library for mobile drag and drop: DragDropTouch.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Use API v2 for the Profile Box in preparation for Torn's incoming changes to the personal stats API\",\"contributor\":\"Kwack\"},{\"message\":\"Show an indication when Loot Ranger has not included every NPC in their scheduled attack.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update the core team titles to reflect DeKleineKobini rejoining.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update the missing hint for 'estranged' to include feet.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Detect sidebar conditions better for some sidebar features.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Adjust revive request prices to be accurate. Prices are no longer the same for every revive provider.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add links to the external services, where applicable.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add support for Firefox for Android in manifest.json.\",\"contributor\":\"TheFoxMan\"}],\"removed\":[{\"message\":\"Removed bazaar prices from the popup, as they are set to be removed from the API.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"No longer show token refill as option in the profile box as it's no longer public data.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":7,\"minor\":3,\"build\":5},\"title\":\"Item market overhaul\",\"date\":\"2024/11/08\",\"logs\":{\"fixes\":[{\"message\":\"Display when Live Networth was last updated after 1 hour global cache.\",\"contributor\":\"Kwack\"},{\"message\":\"Fix stats estimates on the attack page not showing up.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix weapon experience on the attack page not showing up.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix fair fight modifier on the attack page not showing up.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix Popup Market Search for Torn v2 API.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Adapt cheap item highlights to work with the item market overhaul.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Adapt drug details to work with the item market overhaul.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update some mission hints and tasks.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Detect sidebar conditions better for the OC time feature.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Added a bail cost filter\",\"contributor\":\"nao\"},{\"message\":\"Added new feature to calculate the average in personal stats page, can be enabled from Profile page in Settings\",\"contributor\":\"nao\"}],\"removed\":[{\"message\":\"Remove the bazaar and item market redirect feature, due to the item market overhaul.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Remove the item market no confirm feature, due to the item market overhaul.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Remove the compact item market feature, due to the item market overhaul.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":7,\"minor\":3,\"build\":4},\"date\":\"2024/09/18\",\"logs\":{\"features\":[{\"message\":\"Show members stats spies on other faction's pages.\",\"contributor\":\"TheFoxMan\"}],\"fixes\":[{\"message\":\"Copy Post for Discord not working due to layout changes.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fixed a race condition breaking the Gym Graph on Firefox\",\"contributor\":\"Kwack\"}]}},{\"version\":{\"major\":7,\"minor\":3,\"build\":3},\"date\":\"2024/08/29\",\"logs\":{\"fixes\":[{\"message\":\"Avoid crashing the page when opening the torntools settings on some pages.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix query selectors on the gym page after Torn's frontend update.\",\"contributor\":\"Kwack\"},{\"message\":\"Fix Cooldown End Times after Torn's frontend update.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show the gym stat requirements per stat after switching gyms.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix Job Points Tooltip and show it on mobile.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Abroad Stock Table on People page.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Faction selection of a filter stays even when faction members do not exist in list.\",\"contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":7,\"minor\":3,\"build\":2},\"date\":\"2024/08/11\",\"logs\":{\"fixes\":[{\"message\":\"Fix Disable Gym Stats when switching gyms.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Add Vanguard armor set to Auction House Filter.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Employee Effectiveness Highlight after training an employee.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix High Low helper and other XHR related features.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Total Portfolio Value is now live and accurate unless stocks transactions are made.\",\"contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":7,\"minor\":3,\"build\":1},\"title\":\"TTS Fix & Supply Packs in Quick Items\",\"date\":\"2024/07/04\",\"logs\":{\"features\":[{\"message\":\"Added WHO as a global revive provider.\",\"contributor\":\"zachwozn\"},{\"message\":\"Allow Small Supply Packs in Quick Items.\",\"contributor\":\"TheFoxMan\"}],\"fixes\":[{\"message\":\"Updated NUKE Family permission in manifest.\",\"contributor\":\"zachwozn\"},{\"message\":\"Fix TTS not reading messages.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Notifications will now be immediate after a data update.\",\"contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":7,\"minor\":2,\"build\":4},\"title\":\"Total Value of Supply Pack\",\"date\":\"2024/06/26\",\"logs\":{\"features\":[{\"message\":\"Show total value of an opened supply pack.\",\"contributor\":\"Conrado\"}],\"fixes\":[{\"message\":\"Fixing (and then reverting) racing features.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Changing the Nuclear Family revive request API endpoint to use new URL\",\"contributor\":\"Fogest\"}]}},{\"version\":{\"major\":7,\"minor\":2,\"build\":3},\"title\":\"Firefox TS & YATA Fixes\",\"date\":\"2024/06/18\",\"logs\":{\"fixes\":[{\"message\":\"Fixed various TS features(Gym Graph, OC NNB, Profile Spies) not working.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Add option to force reset background update timers.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Add re-check and re-add for background update timers.\",\"contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":7,\"minor\":2,\"build\":2},\"title\":\"Notifications & Firefox Optional Permissions Fixes\",\"date\":\"2024/06/15\",\"logs\":{\"features\":[{\"message\":\"Added bounty filter in Abroad People Filter.\",\"contributor\":\"TheFoxMan\"}],\"fixes\":[{\"message\":\"Fixed Trade Open Chat.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fixed no notifications.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show days(if present) in popup for Jail and Hospital status.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"CORS error for Gym Graph on Firefox.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Optional permissions(for Global Revive Provider, TS and YATA) on Firefox.\",\"contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":7,\"minor\":2,\"build\":1},\"title\":\"Post-MV3\",\"date\":\"2024/06/14\",\"logs\":{\"fixes\":[{\"message\":\"Fixed Torn hanging for few players.\",\"contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":7,\"minor\":0,\"build\":0},\"date\":\"2024/06/05\",\"logs\":{\"fixes\":[{\"message\":\"Fixed chat highlight causing chat to scroll slightly upwards\",\"contributor\":\"Kwack\"},{\"message\":\"Fixed sidebar OC timer showing up even when user was not in a faction.\",\"contributor\":\"Conrado\"},{\"message\":\"Caching and minor fixes for both Faction and Company ID features\",\"contributor\":\"Kwack\"},{\"message\":\"Updated hardcoded fallbacks for torn's items and item categories post Crimes 2.0\",\"contributor\":\"Kwack\"},{\"message\":\"Fixed race condition for Feature Manager in *.entry.js features.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fixed Forum Warning and Add Debug Info features for forum input changes.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Migrated to manifest version 3.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Validate new key level in popup before using.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Added a text that indicates the total value of the opened items from a Supply Pack.\",\"contributor\":\"Conrado\"}]}},{\"version\":{\"major\":6,\"minor\":26,\"build\":0},\"date\":\"2024/03/29\",\"logs\":{\"fixes\":[{\"message\":\"Fix corruption of stakeouts with reset in Targets page.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Hide Chats feature.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix trade values not appearing due to XHR param change.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Easter Eggs date validation.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Chat Autocomplete when ping is at the end of message.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Alert options layout in stakeouts page.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"A Problem at the Tracks mission hint.\",\"contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":6,\"minor\":25,\"build\":0},\"date\":\"2024/02/23\",\"logs\":{\"features\":[{\"message\":\"Added 'in a faction' filter to hospital, jail, and travel pages.\",\"contributor\":\"ThtAstronautGuy\"}],\"fixes\":[{\"message\":\"Trade Item Values after Trade page redesign.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"RW Stats Estimates profile IDs.\",\"contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":6,\"minor\":24,\"build\":0},\"date\":\"2024/02/14\",\"logs\":{\"changes\":[{\"message\":\"Add possible fix for Job Points tooltip on other icons.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Change filter labels to use inline checkboxes instead of id attribute.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Make `userdata` update more resilient to null-ish values.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Add Crimes 2.0 stats to Profile Box.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Make Cooldown End Timers to be on by default.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Enable detailed logs only when developer option is ticked.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Mini Profile last action missing.\",\"contributor\":\"Kwack\"}]}},{\"version\":{\"major\":6,\"minor\":23,\"build\":0},\"date\":\"2024/01/04\",\"logs\":{\"features\":[{\"message\":\"Enable Sidebar Hide Icons for popup.\",\"contributor\":\"TheFoxMan\"}],\"fixes\":[{\"message\":\"Fix popup icons incorrect times and wrapping.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Add fallback fonts for popup.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Cloudflare challenge going out of screen when Align Left is enabled.\",\"contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":6,\"minor\":22,\"build\":0},\"date\":\"2023/12/30\",\"logs\":{\"features\":[{\"message\":\"Add button to add debugging information to TT Forum post.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show icons on popup dashboard.\",\"contributor\":\"TheFoxMan\"}],\"fixes\":[{\"message\":\"Fix cleanup function for Bazaar Worth.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Chat features after the addition of timestamps.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Add Segoe UI font in popup.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Preserve stack when reporting max cycles reached.\",\"contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":6,\"minor\":21,\"build\":0},\"date\":\"2023/12/01\",\"logs\":{\"fixes\":[{\"message\":\"Fix CSP error for Points Value.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Faction Member Filter for new activity icons.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Disable Gym Stats missing when switching gyms on mobile.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix attack log page features missing.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Education page features for page rebuild.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Load TT SVG logo before other files.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Optimize filter activity regexes.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Hide Refills section header in settings on mobiles.\",\"contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":6,\"minor\":20,\"build\":0},\"date\":\"2023/11/09\",\"logs\":{\"fixes\":[{\"message\":\"Chat Font Size will now change message sender name.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Change the location of Trade Chat Timer.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Maximum cycles error message will be shown only to developers.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Add spinner icon for just registered features.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Remove sidebar features on attack page.\",\"contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":6,\"minor\":19,\"build\":0},\"date\":\"2023/10/29\",\"logs\":{\"fixes\":[{\"message\":\"Blackjack strategy for new page URL.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Flowers/Plushies Missing Set uses on page data instead of Torn API data.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Change the element from where Quick Items takes XIDs.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Block Zalgo, Chat Autocomplete, Chat Highlight, Colored Chats, Hide Chats, Search Chats, User Alias, Chat Font Size for Chats 2.0.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Trade Chat Timer for Chats 2.0.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Change Computer Link to be available for everyone instead of checking PC/Laptop availability in inventory.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Remove total values from Item Values feature(on items, bazaar and display case pages).\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Remove quantity information from Quick Items(Torn API does not give items data now).\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Reduce and limit the frequency of requireElement.\",\"contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":6,\"minor\":18,\"build\":0},\"date\":\"2023/10/02\",\"logs\":{\"features\":[{\"message\":\"Customizable balance for Bank Investment Table.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Reformat both Faction and Company pages to include ID in name, similar to profiles\",\"contributor\":\"Kwack\"}],\"fixes\":[{\"message\":\"Fix Auction House filtering for new item images.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Casino High Low and other features for URL change.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Extend Item Market Redirect for touch devices.\",\"contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":6,\"minor\":17,\"build\":0},\"date\":\"2023/09/15\",\"logs\":{\"features\":[{\"message\":\"Stakeouts can be sorted(and should be saved) on targets page.\",\"contributor\":\"TheFoxMan\"}],\"fixes\":[{\"message\":\"Fixed job points tool tip for city jobs.\",\"contributor\":\"Conrado\"},{\"message\":\"Fixed Event Worth to changed page layout.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fixed City Shops Fill Max issues.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix items in the city no longer being detected.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Chat Search waits until chat root is found.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Redirect click on Energy bar to Hunting page when in South Africa.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Update job specials for Car Dealership and Theater.\",\"contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":6,\"minor\":16,\"build\":0},\"date\":\"2023/08/25\",\"logs\":{\"features\":[{\"message\":\"Added Recruit status filtering on the faction page.\",\"contributor\":\"LePluB\"},{\"message\":\"No Confirm for buying flowers and plushies abroad.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Added job points information in job/company sidebar icon tool tip\",\"contributor\":\"Conrado\"}],\"fixes\":[{\"message\":\"Fix extension icon missing number of new events and messages.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix travel cooldowns showing education cooldown when not taking any course.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Change Faction Member Filter to filter when player status updates automatically.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Add notes that TornTools uses Limited Access key.\",\"contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":6,\"minor\":15,\"build\":0},\"title\":\"Sidebar fixes\",\"date\":\"2023/07/11\",\"logs\":{\"fixes\":[{\"message\":\"Fix Abroad Auto Max Fill for Flower Shop employees(again).\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Sidebar Links.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix energy and nerve refill highlighting.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Cooldown End Times.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Hide Level Upgrade.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix any energy giving items taken through Quick Items.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Medical Life on HP items.\",\"contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":6,\"minor\":14,\"build\":0},\"date\":\"2023/07/07\",\"logs\":{\"features\":[{\"message\":\"Added filtering against Early Discharge status to the userlist page.\",\"contributor\":\"Vrasp\"}],\"fixes\":[{\"message\":\"Fix unread threads not being highlighted in forums.\",\"contributor\":\"Kwack\"},{\"message\":\"Fix melee Item Values overlapping in tablet mode.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix faction stakeouts not detecting faction ID properly.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix nerve notification opening blank page.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Abroad Auto Max Fill for Flower Shop and Toy Store employees.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Highlight Energy Refill error during cleanup.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Hide Chats early loading problem(only observed on Firefox).\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Item Equip No Confirm not working on Firefox.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Mini Profile last action missing.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Extend Drug Details to regular item market browsing.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Include few API edge cases in background script.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Change mission hint from 'him' to 'them'.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Extend Search Chat to newly opened chat boxes(if old closed chats are reopened).\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Extend Cooldown End Times to books, bank investment, OC.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Ensure that errors found before feature manager popup loaded are also logged.\",\"contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":6,\"minor\":13,\"build\":0},\"date\":\"2023/06/02\",\"logs\":{\"features\":[{\"message\":\"Added WTF as revive provider.\",\"contributor\":\"Anti0815\"}],\"fixes\":[{\"message\":\"Fix Auction House filtering for normal weapons.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix tablet layout of Travel Item Profits.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix incorrect travel CD investment message when switching travel types.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Drug Details not appearing.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Reset events data when there are no new events.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Change date difference formatting logic for Age To Words feature.\",\"contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":6,\"minor\":12,\"build\":0},\"date\":\"2023/04/30\",\"logs\":{\"features\":[{\"message\":\"Show next Faction OC in the sidebar.\",\"contributor\":\"Vrasp\"},{\"message\":\"Allow filtering the userlist page based on hospitalization reason.\",\"contributor\":\"Vrasp\"},{\"message\":\"Add quality filtering on Auction House page.\",\"contributor\":\"TheFoxMan\"}],\"fixes\":[{\"message\":\"Properly show company addiction in the sidebar.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fixed the OC timer desync that could occur when tabbing away for long periods of time.\",\"contributor\":\"Vrasp\"},{\"message\":\"Change the check for city jobs in Company Addiction sidebar.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Event Worth for the new events page layout.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Include sentinel armor for the filters.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update the core team titles to reflect DeKleineKobini quitting.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Change the background logic to reduce events call usage(by new limit).\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Change hospital filtering to reduce errors.\",\"contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":6,\"minor\":11,\"build\":2},\"date\":\"2023/03/19\",\"logs\":{\"features\":[{\"message\":\"Show employee drug addiction(in companies) in the sidebar.\",\"contributor\":\"Conrado\"}],\"fixes\":[{\"message\":\"Fix Faction Member Filter not working properly with fedded players.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Solve honor for 100 hits in a single chain being detected as one for total hits.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Improve the settings save button logic.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Move the start button for the high-low game, so you can keep clicking.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Disable the high-low helper by default, to avoid confusion.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Undo checking for corrupt torndata. This will likely result in more corrupted data, but we have our reasons for doing so.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":6,\"minor\":11,\"build\":1},\"date\":\"2023/03/01\",\"logs\":{\"features\":[{\"message\":\"Add Loot Rangers as NPC source.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Notify for a planned NPC attack. Only available for the Loot Rangers source.\",\"contributor\":\"DeKleineKobini\"}],\"fixes\":[{\"message\":\"Fix Edit option of Quick Crimes on mobiles & tablets.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Clean (faction) stakeout fields after disabling stakeout for that user or faction.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix stakeout faction notifications not properly resetting.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Change behavior for the faction stakeouts when chain reaches is set to 0, to show a notification if their chain drops.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Change NPC loot timer layout.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Don't require an API key for NPC alerts.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":6,\"minor\":11,\"build\":0},\"date\":\"2023/02/24\",\"logs\":{\"features\":[{\"message\":\"Filter on the enemies page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Stakeout factions.\",\"contributor\":\"DeKleineKobini\"}],\"fixes\":[{\"message\":\"Fix Auto Stock Fill.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix auction house filters when something isn't present.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix gym steadfast perk percentages in wrong position after changing gyms.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix bounty filter.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix collapible area to work with the changes.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix update notice.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Stop features from running on 2FA page.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Disable dragging for quick items and crimes on mobile and tablets.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show gym bonus from your job.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show total gym bonus.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show 'item' for singular city finds.\",\"contributor\":\"h4xnoodle\"},{\"message\":\"Improve handling of error 17.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Include a button to manually refresh the profile box spy when there is no prior spy.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Invalidate TornStats spy cache upon saving a spy to TornStats.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Decrease jail score filter step amount from 25 to 10.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add statistics for bounty filter.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Change torndata validity check to better avoid corrupt data, again.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add the option to not show the feature manager when there is nothing to show.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Filter on abroad status for faction members.\",\"contributor\":\"DeKleineKobini\"}],\"removed\":[{\"message\":\"Remove hide area feature because of Torn implementing it itself.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":6,\"minor\":10,\"build\":1},\"date\":\"2023/01/16\",\"logs\":{\"features\":[{\"message\":\"Filter on a lot of things in the faction armory.\",\"contributor\":\"DeKleineKobini\"}],\"fixes\":[{\"message\":\"Fix faction armory tab detection if a tab is empty.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix faction quick item error while setting up drag listeners.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix cooldowns that go over 24h to not show that.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Count book perks that are shown as perk for the merit.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix armor defence filter in the auction house not saving.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix armory filter loading on page load.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix chain CSV header missing.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Also show faction quick items on the points, cashes, cesium and deposit tabs.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Don't show the faction quick items on the temporary items page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show the armory filter on the temporary items page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add 22 missing weapon bonuses to the auction filter.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Allow refills to be added in the faction quick items.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":6,\"minor\":10,\"build\":0},\"date\":\"2023/01/11\",\"logs\":{\"features\":[{\"message\":\"Show last action on the OC page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Filter in the auction house.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Ignore single forum posts using the forum menu.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add Prometheus as alternative travel table source.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Quick items in the faction armory.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"No confirm buy points from the market.\",\"contributor\":\"DeKleineKobini\"}],\"fixes\":[{\"message\":\"Fix company stock button updating.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix city items when no API key is provided.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix item value for the first item of each category while adding items in your bazaar on mobile.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix item value for the first item of each category in your inventory on mobile.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix stats estimates on the HOF page.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Add Sellout Slayer mission hint.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update CSV export to reflect Torn changes (add 'best' and remove 'bonus').\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Change torndata validity check to better avoid corrupt data.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show item name when using quick items when no API key is provided.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Round can energy so it shows the actual amount of energy.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":6,\"minor\":9,\"build\":3},\"date\":\"2022/12/15\",\"logs\":{\"features\":[{\"message\":\"Show fair fight on the attack page.\",\"contributor\":\"DeKleineKobini\"}],\"fixes\":[{\"message\":\"Fix gym progress not taking the music store special into account anymore.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix banking helper no longer working.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix faction infobox folding after switching tabs.\",\"contributor\":\"Kwack\"},{\"message\":\"Fix total item value in the faction armory on mobile.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix cooldowns not showing on first load when business flight is default.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix stats estimates on the attack page not working on tablet and mobile.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix travel table count to be correct for business travel.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix hide chat position.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix trade value not working when there is a peace treaty included.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix stock alert reaches not working correctly.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix company perk not being correctly used for the travel table amount.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Improve feature manager overlaps.\",\"contributor\":\"Kwack\"},{\"message\":\"Don't run TornTools on the logout page.\",\"contributor\":\"Kwack\"},{\"message\":\"Allow filtering on fallen players on the search page and the faction member list.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Improve YATA error message for rate limit.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Remove Loud and Clear mission hint as it's outdated and the task itself should be clear enough.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add fair fight in the attack history.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Filter on abroad status for ranked wars.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Increase the profile box spy cache time.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Include a button to manually refresh the profile box spy.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Change chat hiding to not hide the notebook, but hide the people box.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Include PTS ROI in the popup.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add hint to graffiti mission.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":6,\"minor\":9,\"build\":2},\"date\":\"2022/10/15\",\"logs\":{\"fixes\":[{\"message\":\"Fix left align on attack pages.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":6,\"minor\":9,\"build\":1},\"date\":\"2022/10/14\",\"logs\":{\"fixes\":[{\"message\":\"Fix stakeouts reset accidentally causing settings reset.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix education notification issue.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Properly fix profits on abroad market pages on mobiles & tablets.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix travel table faction perks not being counted.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix align left no longer working.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Switch feature manager popup to new layout.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Update Logistics specials wording.\",\"contributor\":\"Acarya\"},{\"message\":\"Change item price layout on tablets.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Make cooldown end times available again on mobiles & tablets.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Allow requesting revives from Shadow Healers.\",\"contributor\":\"Lazerpent\"},{\"message\":\"Update HeLa revive request script.\",\"contributor\":\"Lazerpent\"},{\"message\":\"Message on force update.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":6,\"minor\":9,\"build\":0},\"date\":\"2022/09/16\",\"logs\":{\"fixes\":[{\"message\":\"Fix settings saving for Hide Icons and Custom Links.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Hospital & Jail filters on page changing on Firefox.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix custom notification sound messing settings.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix cleanup code in settings.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix item profits in market on tablet mode.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix Stats Estimates on Elimination page.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Add option to disable Quick Crimes.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Modify (disable) various features on tablet mode.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Update HeLa revive request script.\",\"contributor\":\"No1IrishStig\"}]}},{\"version\":{\"major\":6,\"minor\":8,\"build\":0},\"date\":\"2022/08/18\",\"logs\":{\"fixes\":[{\"message\":\"Fix NPC loot times not showing when YATA is disabled, even when using TS for it.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix open in new tab settings in sidebar custom links not saving properly.\",\"contributor\":\"josephting\"},{\"message\":\"Fix Jail and Hospital filters when changing pages.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Update mission tasks and hints.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Allow hiding of the Enby icon.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update HeLa revive request to support new endpoint.\",\"contributor\":\"Lazerpent\"}]}},{\"version\":{\"major\":6,\"minor\":7,\"build\":0},\"date\":\"2022/07/12\",\"logs\":{\"features\":[{\"message\":\"Stakeout notification when player becomes revivable (based on the setting, not hospital status).\",\"contributor\":\"DeKleineKobini\"}],\"fixes\":[{\"message\":\"Fix racing win percentage.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix bank investment table rounding.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix points values while flying.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix ranked war stats estimate filters.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix item values on tablet view.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix showing employee effectiveness if a new employee is present.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix travel agency selecting uk as country.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix abroad auto fill not working on Firefox.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Add the url to the notifications in the popup.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Change auto fill stock to have a button.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Rename TCB to TCI.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Don't duplicate url entries when copying forum posts for Discord.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add compatability with the faction stats script for the ranked war filter.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Allow requesting revives from HeLa.\",\"contributor\":\"dat-mule\"},{\"message\":\"Allow disabling notifications without removing timer numbers.\",\"contributor\":\"josephting\"}]}},{\"version\":{\"major\":6,\"minor\":6,\"build\":0},\"date\":\"2022/05/14\",\"logs\":{\"features\":[{\"message\":\"Filters for ranked wars.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Stats Estimates for ranked wars.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Company refill button.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show the life you'll get when taking a medical item.\",\"contributor\":\"DeKleineKobini\"}],\"fixes\":[{\"message\":\"Fix dark mode issues on quick items+crimes in edit mode.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix stats estimates on the HOF not always working properly.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix faction infobox folding.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix showing full faction infobox.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix faction features on other tabs.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Avoid NaN values in car win percentages.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix chat features.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix item features on the grid view.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix perks issues.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Show N/A as stat estimate on accounts that haven't been online since 2015 due to the old rank system.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Highlight easter eggs and show their location in the popup.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update faction update logic.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Use own tooltip instead of 3rd-party libraries.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update strip club specials.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":6,\"minor\":5,\"build\":2},\"date\":\"2022/04/03\",\"logs\":{\"fixes\":[{\"message\":\"Fix item value positioning on mobile.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix issue when there are no results in the userlist search.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix time formatting for days in certain cases.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix the cooldown timers going in the negative.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix trade timer position.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix travel sidebar stuff.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Remove the option to disable the B&I warning.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add a warning when clicking the post button in B&I.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Allow stock filtering on multiple names (comma-seperated).\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Ignore fallen players on some faction features.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update base respect calculations (war changes and warlord bonus).\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Allow searching on item id in the market popup tab.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Allow chat highlights on the rest ('*').\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Disable most features on the dirty bomb screen.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Change the popup stock ROI calculation to reflect only the single increment instead of the entire block.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":6,\"minor\":5,\"build\":1},\"date\":\"2022/02/09\",\"logs\":{\"fixes\":[{\"message\":\"Fix several faction page features being broken.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix an issue where travel table capacity ignored a company special.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix an issue with loading the icon on the profile box.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix bar notifications not working properly if another one is disabled.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix last action on the faction page not always hiding according to the filter.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix several features on the faction page regarding native filtering and sorting.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix wrong Opium cooldown time.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix travel cooldown box being duplicated.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Properly remove stat estimates from the faction list.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix hospital time filtering on smaller units.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix stock acronym filter only working with exact match.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix the userlist features being broken.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix item market values on mobile and tablet.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix the drug details not showing all the time.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix quick bail or quick bust messages not always showing correctly.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix filters not applying when changing pagination using the arrows.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix friendly fire with faction ids.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix chat input layout being broken.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":6,\"minor\":5,\"build\":0},\"date\":\"2022/01/25\",\"logs\":{\"fixes\":[{\"message\":\"Solve quick crimes not always showing on Firefox.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix item features not working when searching.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix book effect not showing.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Make sure item effects are loaded reliably on page load.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix travel cooldowns not showing after changing travel method.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix issue with the popup stocks.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Switch to TornStats' v2 api.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Improve TornStats error handling on the profile.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Allow stock search to work for acronyms.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":6,\"minor\":4,\"build\":0},\"date\":\"2022/01/17\",\"logs\":{\"features\":[{\"message\":\"Export ranked war report to CSV.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Export raid report to CSV.\",\"contributor\":\"DeKleineKobini\"}],\"fixes\":[{\"message\":\"Don't break item equiping with no confirm after using them in another tab.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Solve blackjack issue when you had A and 2 other cards or more.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Don't corrupt your data when the request takes too long.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix csv export for war report not working.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Actually clear popup calculator data.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Apply faction and company perks different while calculating nerve for alcohol.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Don't fetch attacks if they are simply ignored anyway.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix travel table not showing while in a race.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix race win percentage not showing after switching car pages.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix item total values on mobiles and tablets.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Solve cooldown times not being shown on icon hover.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Solve hide chat not working as it should.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Link to the new forum thread.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update time checking during the update cycle.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show names in chain CSV again after Torn removed them from the page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Have NPC times to come from TornStats instead of YATA. This is enabled by default.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":6,\"minor\":3,\"build\":1},\"date\":\"2021/12/27\",\"logs\":{\"fixes\":[{\"message\":\"Solve issue where the dump value honor was recognized as dump amount merit.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix CSV chain report when honorbars are disabled.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Reintroduce cheap item highlight after accidentally removing it.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Remove the lingering settings bar even after closing the in-game settings.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Solve issue when splitting is preferred in blackjack, after splitting once already.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix auto max buy while abroad.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix suggestion for blackjack on some soft values.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Split torndata and stocks to possibly avoid corruption of data\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Use The Imperiums new domain.\",\"contributor\":\"DeKleineKobini\"}],\"removed\":[{\"message\":\"Remove vault balance, as it was pretty broken.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":6,\"minor\":3,\"build\":0},\"date\":\"2021/12/19\",\"logs\":{\"features\":[{\"message\":\"Show end times for cooldowns on icon hover.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Display property happiness.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fill max when landing abroad.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Add option to make item market list compacter.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Keep notification history to show them in the popup.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Hide attack buttons.\",\"contributor\":\"TheFoxMan\"}],\"fixes\":[{\"message\":\"Fix trade value logs showing value of only one item.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix NaN in upgrade required respect.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix hide level also hiding the bank message.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix issue with the abroad people filter.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Solve issues with filters not saving correctly all the time.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Improve the clickable area of fill max in the city shops.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Solve permission asking issues in the ingame settings.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix mini profiles of users in a threatre while flying.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Possibly solve an issue with the blackjack helper when having the same cards after splitting once.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix CSV faction chain report.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix issues with stats estimates.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Include racing skill on the profile box.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Don't only check addiction for employee effectiveness reduction.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Make it possible to change the travel table country when selecting a country.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Allow the connect button to work with multiple keys.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show warning if an api key with bad permisisons is being used.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Allow setting different api keys for TornStats and YATA integration.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update weapon bonus effects.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Improve error handling for the profile box.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update motivitor mission hint.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":6,\"minor\":2,\"build\":0},\"date\":\"2021/10/24\",\"logs\":{\"features\":[{\"message\":\"Add auto fill for museum.\",\"contributor\":\"TheFoxMan\"}],\"fixes\":[{\"message\":\"Don't show stakeout landing notifications more than it should.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Don't break stakeouts when removing them from the profile.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix abroad filter loading and travel table item sorting.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Remember profile relative value preference.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Properly display relative values.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix employee inactivity warning on job page.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix no confirm on the item market in certain situations.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix profile box using older spy from YATA.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Improve click area on sidebar items.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Solve issue with city items ignoring the worth of duplicate items.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Allow requesting revives from The Imperium.\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":6,\"minor\":1,\"build\":0},\"date\":\"2021/10/01\",\"logs\":{\"features\":[{\"message\":\"Change some page titles to be more clear.\",\"contributor\":\"DeKleineKobini\"}],\"fixes\":[{\"message\":\"Solve issue with travel cooldowns using a single flight time.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update database migration to properly update from v5.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Don't show education warning when you've completed all educations.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Calculate value for items that contain an 'x' properly on the events page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Solve issue with the city shop filters on mobile and tablet views.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Solve issue with hiding some newer icons.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Solve issue with hiding areas on mobile.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Open correct bar link when using middle click.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Make sure chat search doesn't go over the chat width.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Make sure chat search doesn't go over the chat width.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show correct faction status for contribution csv.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Solve issue with showing the bazaar worth while editing.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show the quick items container even if there is a warning for too many items.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Align stock alert prices in the popup on mobile.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Solve issue with showing job specials.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Solve issue with energy/nerve/candy figures when in a company that provides any boost.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Properly display hidden casino games.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Make absolute sure that the settings are loaded before applying container styling.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix dark mode issue with sidebar notes.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix jail filter showing everone when score is set to 100.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Update 'Batshit Crazy' mission hint.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Don't show the ally blocking icon when the attack is already blocked.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show properly formatted date in the changelog.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Change notifications back to the previous system.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update massacrist mission hint.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Allow the extension to run in the background again.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Clarify bank investment message before flying.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Don't autofill the bazaar more than once.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add an option to disable autoscroll for bazaars.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add indication if a permission was granted or not.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Redirect user to normal settings page when there are permission issues.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Search settings while typing directly.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show settings save button as 'snackbar'.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Improve spies error handling.\",\"contributor\":\"DeKleineKobini\"}],\"removed\":[{\"message\":\"We've removed the feature to open an already existing tab when clicking a notification. Removing this allows us to remove the 'tabs' permission.\"}]}},{\"version\":{\"major\":6,\"minor\":0,\"build\":0},\"title\":\"Starting over.\",\"date\":\"2021/09/25\",\"logs\":{\"features\":[{\"message\":\"Live update settings.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Dark mode for our pages (popup, settings, etc.)\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Notifications a certain time before booster and medical cooldown.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show attack history and stakeouts on the target page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add stakeouts when health drops below a certain percentage.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Highlight specific chat titles.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Customizable api usage.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show muggable money when using a company special to show money on hand.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Calculate and remember partial spy result and export them to TornStats.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Display features on each page including their status.\",\"contributor\":\"Mephiles\"},{\"message\":\"Show a quick refresh button on the jail page.\",\"contributor\":\"AllMight\"},{\"message\":\"Show weapon bonus descriptions in attack logs.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Filter based on stats estimates.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Display the point values in the sidebar on hover.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show active steadfast bonus in the gym.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Highlight forum threads and/or posts from specific users.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show weapon experience during an attack.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Rewrite core system.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Rewrite and redesign many features. Features might also work on more pages when applicable.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Rewrite and redesign many features. Performance should be way better with this.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Rewrite and redesign some features.\",\"contributor\":\"AllMight\"},{\"message\":\"Don't make an additional api call for 'basic' userdata or the attack log.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Improve update notice so it only shows when another version was installed.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Prevent Zalgo overflow instead of fully replacing it.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show image, circulation and market value with market search in the popup.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add the ability to remove stakeouts from the popup.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Significantly improve OC timer: use icon to detect time, hide timer if wrong information is present and change the color to be more useful.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Apply notification volume for tts.\",\"contributor\":\"Tesa\"},{\"message\":\"Implement new jail score formula.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Search chat by username and id. ('by:...' or 'u:...')\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Load NNBs from YATA too.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show dates and time in TCT instead of local time.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Extend the warning of getting over the energy cap to other items as well.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Allow you to mute notification of all NPCs at once, without removing the information.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Move option for hiding chats to the chat settings of Torn.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Only show the revive request button when you are hospitalised.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Allow requesting revives from UHC.\",\"contributor\":\"DeKleineKobini\"}],\"removed\":[{\"message\":\"We've removed the safe crimes feature due to it being less useful than originally thought.\"},{\"message\":\"We've removed the loot times on the profile due to the NPCs being available in the sidebar.\"},{\"message\":\"Shortening of the faction armory news has now been officially removed. It was broken for a couple of months already due to changes where it no longer is page based.\"},{\"message\":\"All features that show a warning when stacked have been removed. We've planned a replacement for a future version.\"},{\"message\":\"All features that help with chains. We've planned a replacement for a future version.\"}]}},{\"version\":{\"major\":5,\"minor\":11,\"build\":1},\"date\":\"2021/07/28\",\"logs\":{\"fixes\":[{\"message\":\"Fix last action on mini profiles.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":5,\"minor\":11,\"build\":0},\"date\":\"2021/07/13\",\"logs\":{\"fixes\":[{\"message\":\"Potentially solve the issue where the database resets.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Improve bounty filter loading.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix sidebar issues.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Improve awards for visually impaired users.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":5,\"minor\":10,\"build\":1},\"date\":\"2021/06/25\",\"logs\":{\"fixes\":[{\"message\":\"Fix stock market total value not showing.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Use correct Cruise Line company name.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix TornStats error handling and caching while it shouldn't.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix stock market filter not working properly when you have a panel selected.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add some minor error handling in hopes of the profile page breaking less.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":5,\"minor\":10,\"build\":0},\"date\":\"2021/06/03\",\"logs\":{\"features\":[{\"message\":\"Added toggle to hide stakeout on profile page.\",\"contributor\":\"hvr-lust\"}],\"fixes\":[{\"message\":\"Apply proper rounding on the racing winning rate.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix max buy on mobile.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Settings sidebar link not going down when hospitalized or jailed.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix probability calculation in the high-low helper.\",\"contributor\":\"smikula\"},{\"message\":\"Various tweaks to dark mode.\",\"contributor\":\"Allo\"},{\"message\":\"Fix chat features.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Disable loot timers on mobile devices.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Change notification bar links.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show new lingerie store specials.\",\"contributor\":\"ORAN\"},{\"message\":\"Implement timeout on requests.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":5,\"minor\":9,\"build\":0},\"date\":\"2021/05/02\",\"logs\":{\"features\":[{\"message\":\"Filter faction members by position.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Battle stat on attack page.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Aliases for users in chatboxes and userlists.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Win percentage on racing upgrades.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Faction filter while  abroad.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Highlight properties if upkeep is due.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Display NPCs loot info on sidebar.\",\"contributor\":\"TheFoxMan\"}],\"fixes\":[{\"message\":\"Solve duplicate items on the map being ignored.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix showing hidden portfolio stocks.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Completed education courses not dimming.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Improve city finds alignment on mobile.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Don't warn when education course and bank investment are completed during travel.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix travel count not being correct.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Chat highlight not working.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"'fill max' not appearing on mobile.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Warn to check user faction chat when chain is near to bonus hit.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Add numbers to faction member list.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"TT Settings in dark mode.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Racing upgrades not appearing.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix hospital filter being broken on tablet mode.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Filters on stocks 3.0.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix faction enhancements on mobile.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"All items filters not working abroad.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Hide userinfo rows on the faction filter.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Dark mode for TornTools.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show travel table while racing.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show faction filter always when on jail page.\",\"contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":5,\"minor\":8,\"build\":0},\"date\":\"2021/03/25\",\"logs\":{\"features\":[{\"message\":\"Add revives skill to profile stat comparison table.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Export faction upgrade challenge contributions as CSV.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Add an arrow for folding faction description.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show warning when taking xanax while the user is already at 1000E.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Add setting to hide some portfolio and stock blocks.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Add Hospital filter to show only revive-enabled players.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show net total on casino statistics.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Add search in TT preferences page.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Warning when user if about to fly but education or bank investment or both would timeout before return.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show a timer between posts in trade chat.\",\"contributor\":\"TheFoxMan\"}],\"fixes\":[{\"message\":\"Battle stat disappeared from profile when sending user money.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix HighLow helper not working.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Add setting for 'Show flight times before flying'.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Update to new beta TS API.\",\"contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":5,\"minor\":7,\"build\":0},\"date\":\"2021/02/11\",\"logs\":{\"features\":[{\"message\":\"Add option to export war report as CSV.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show end time of wars on faction pages.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show employee effectiveness in red if has negatives in effectiveness.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show total price to buy an item in bazaar.\",\"contributor\":\"TheFoxMan\"}],\"fixes\":[{\"message\":\"Don't show the attack warning on attack logs.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix achievements section not showing.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show a warning when you try to train while stacking.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Fix an interaction between chrome, torn tools, the faction page, that would cause chrome to suggest addresses in the chat box.\",\"contributor\":\"WizardRubic\"},{\"message\":\"Fix 'fill max' button not working in bazaar.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Only highlight chain timers over a configurable amount.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Add 'I'm Chaining' button to stop warning for 30 minutes on attack page.\",\"contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":5,\"minor\":6,\"build\":1},\"date\":\"2021/01/29\",\"logs\":{\"fixes\":[{\"message\":\"Fix notes showing in the wrong location.\",\",contributor\":\"DeKleineKobini\"},{\"message\":\"Fix mission hints not showing.\",\",contributor\":\"DeKleineKobini\"},{\"message\":\"Fix achievements section not closing properly.\",\",contributor\":\"TheFoxMan\"},{\"message\":\"Add tt_itemprice & tt_itemid to URL not working in bazaar when right clicked.\",\",contributor\":\"TheFoxMan\"}]}},{\"version\":{\"major\":5,\"minor\":6,\"build\":0},\"date\":\"2021/01/27\",\"logs\":{\"features\":[{\"message\":\"Disable gym highlight.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show energy gains from cans.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show a warning when you try to attack while stacking.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Highlight chain timer when it's under a minute.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show happy gains from candy.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show nerve gains from alcohol.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show education course finish time.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show investment finish time.\",\"contributor\":\"TheFoxMan\"}],\"fixes\":[{\"message\":\"Fix full faction description not working.\",\"contributor\":\"TheFoxMan\"}],\"changes\":[{\"message\":\"Update Love Juice information to reflect the new change.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add ELO stat to stat list.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":5,\"minor\":5,\"build\":0},\"date\":\"2021/01/19\",\"logs\":{\"features\":[{\"message\":\"Show missing flowers and plushies in the inventory.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Disable some casino games.\",\"contributor\":\"TheFoxMan\"}],\"fixes\":[{\"message\":\"Use the new Torn class.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Solve some problems regarding the new class names.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Add ISO date formatting.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Switch to new YATA domain.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update company specials.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":5,\"minor\":4,\"build\":0},\"date\":\"2021/01/12\",\"logs\":{\"features\":[{\"message\":\"Show total portfolio value.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Allow chat filtering for people with recent interactions.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show age as words.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Hide completed education courses.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Disable attacks on allies.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show a TornTools warning on the Bugs & Issues subforum.\",\"contributor\":\"TheFoxMan\"},{\"message\":\"Show total value of properties.\",\"contributor\":\"TheFoxMan\"}],\"fixes\":[{\"message\":\"Use the new Torn class.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":5,\"minor\":3,\"build\":5},\"date\":\"2020/12/16\",\"logs\":{\"fixes\":[{\"message\":\"Fix armory shortening.\",\"contributor\":\"Mephiles\"}],\"changes\":[{\"message\":\"Remove proxy support.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":5,\"minor\":3,\"build\":4},\"date\":\"2020/11/29\",\"logs\":{\"fixes\":[{\"message\":\"Update 'Rising Costs' hint.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix an issue with an content_old rank name.\",\"contributor\":\"h4xnoodle\"},{\"message\":\"Add safety measure for factions filter when your computer clock is out of sync.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix wrong Piercing Weapons achievement 2,500 goal.\",\"contributor\":\"Mephiles\"},{\"message\":\"Fix trade logs showing money values for comments.\",\"contributor\":\"Mephiles\"},{\"message\":\"Fix trailing '.0,000,001' issues in trade calculations.\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":5,\"minor\":3,\"build\":3},\"date\":\"2020/11/11\",\"logs\":{\"fixes\":[{\"message\":\"Fix TT not working on a popped out poker window.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix travel table not loading while in Torn.\",\"contributor\":\"Fogest\"},{\"message\":\"Backport v6 left align to solve news ticker not left aligning.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":5,\"minor\":3,\"build\":2},\"date\":\"2020/11/06\",\"logs\":{\"fixes\":[{\"message\":\"Break the travel table less often when flying back from a country with spaces.\",\"contributor\":\"Fogest\"},{\"message\":\"Don't include your api key to YATA's API.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Stop hammering YATA's API when a YATA error occurred.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Switch to YATA's v1 abroad API.\",\"contributor\":\"Fogest\"}]}},{\"version\":{\"major\":5,\"minor\":3,\"build\":1},\"date\":\"2020/11/02\",\"logs\":{\"fixes\":[{\"message\":\"Fix Achievement check by including medals/honors.\",\"contributor\":\"finally\"},{\"message\":\"Fix 'Three-peat' mission hint.\",\"contributor\":\"smikula\"},{\"message\":\"Fix loading issues on the russian roulette and calendar pages.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Frenzy' and 'A Thor Loser' mission hints.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show correct stalemate count for achievements on the mission page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'Tree Huggers' mission hint.\",\"contributor\":\"kontamusse\"}],\"changes\":[{\"message\":\"Make left align also work on the popout poker.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Remove travel map auto country select.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Switch to YATA's v1 loot API.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":5,\"minor\":3,\"build\":0},\"date\":\"2020/10/16\",\"logs\":{\"features\":[{\"message\":\"Add popup mute button.\",\"contributor\":\"finally\"},{\"message\":\"Add forum enhancements, hide posts/threads, copy post for discord.\",\"contributor\":\"finally\"}],\"fixes\":[{\"message\":\"Fix item page crashing when the opening items too fast.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix rare condition where the database isn't loaded properly.\",\"contributor\":\"finally\"},{\"message\":\"Solve FontAwesome issues by switching to the CSS version again.\",\"contributor\":\"finally\"}]}},{\"version\":{\"major\":5,\"minor\":2,\"build\":1},\"date\":\"2020/10/13\",\"logs\":{\"fixes\":[{\"message\":\"Fix level filter abroad.\",\"contributor\":\"finally\"},{\"message\":\"Fix item market market value highlight settings.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add FontAwesome as JavaScript instead of CSS.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Make nuke family permission optional.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":5,\"minor\":2,\"build\":0},\"date\":\"2020/10/11\",\"logs\":{\"features\":[{\"message\":\"Auto-complete usernames in chat.\",\"contributor\":\"finally\"},{\"message\":\"Show bars in the icon.\",\"contributor\":\"finally\"},{\"message\":\"Add revive option for Nuclear Central Hospital.\",\"contributor\":\"Mephiles\"}],\"fixes\":[{\"message\":\"Properly display item values for weapons and other single items.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix chain notifications going out too early.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix icon margin on dynamic change.\",\"contributor\":\"finally\"},{\"message\":\"Fix hide chat hidden by chats.\",\"contributor\":\"finally\"},{\"message\":\"Update 'Critical Education' mission hints.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix stakeouts not working.\",\"contributor\":\"finally\"},{\"message\":\"Fix travel profit calculation while flying.\",\"contributor\":\"finally\"}],\"changes\":[{\"message\":\"Added sell points award and refill award trackers.\",\"contributor\":\"wootty2000\"},{\"message\":\"Added Shop to 'ignore max buy in bazaars' option.\",\"contributor\":\"Mephiles\"},{\"message\":\"Remove 'requires factions API access' description from Advanced OC option.\",\"contributor\":\"Mephiles\"},{\"message\":\"Improve alignleft script loading times.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Added item count to City Items value.\",\"contributor\":\"Mephiles\"},{\"message\":\"Allow stakeouts on hospital status.\",\"contributor\":\"finally\"},{\"message\":\"Change the notification system.\",\"contributor\":\"finally\"},{\"message\":\"Make notifications work in the background.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Added a setting to hide the 'Toggle Chat' button.\",\"contributor\":\"smikula\"}]}},{\"version\":{\"major\":5,\"minor\":1,\"build\":2},\"date\":\"2020/10/01\",\"logs\":{\"fixes\":[{\"message\":\"Show right temporary total value.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Improve mobile checking on Firefox, fixing the loading issue.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Improve mission information for several missions.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update FontAwesome.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":5,\"minor\":1,\"build\":1},\"date\":\"2020/09/26\",\"logs\":{\"changes\":[{\"message\":\"Change watchlist export to stakeouts.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":5,\"minor\":1,\"build\":0},\"date\":\"2020/09/24\",\"logs\":{\"features\":[{\"message\":\"Remove zalgo text from chat.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add specials info on company pages.\",\"contributor\":\"Mephiles\"},{\"message\":\"Highlight energy and nerve when their respective refills haven't been used yet.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"On the item market, highlight items under their market value.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show last action in the mini profile.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add mid-drug cooldown notification.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add filtering and sorting for items abroad.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add no confirm on trades.\",\"contributor\":\"DeKleineKobini\"}],\"fixes\":[{\"message\":\"Don't cache stats estimates if they are disabled on profiles.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix settings messages.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix target table when there are no targets.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix multiple mission hints.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix missions for the Anonymous agent.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix mission hints not showing when changing agents, accepting or completing a mission.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix the demo automatically opening and the markings when changing your api key on the API page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix the energy warning while abroad when you already spent that energy.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Detect mobile based on width instead of elements.\",\"contributor\":\"Mephiles\"},{\"message\":\"Don't show DoctorN NNB values if 'Force TT' has been enabled.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Improve medal and honor completion check so it doesn't show completed ones as non-completed.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Improve stats estimates caching.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add an option to only show stats estimates under a certain level.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Improve missing mission information message.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add an option to disable extension checking.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show stakeout list in the popup.\",\"contributor\":\"Mephiles\"},{\"message\":\"Prevent accidental loss of settings when you have unsaved settings.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Change chain notifications to seconds instead of minutes.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":5,\"minor\":0,\"build\":1},\"date\":\"2020/09/11\",\"logs\":{\"fixes\":[{\"message\":\"Fix trade open chat on Firefox.\",\"contributor\":\"DeKleineKobini\"}],\"changes\":[{\"message\":\"Add an option to disable stats estimates on competition page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add an option to not show the cached only text.\",\"contributor\":\"DeKleineKobini\"}]}},{\"version\":{\"major\":5,\"minor\":0,\"build\":0},\"date\":\"2020/09/10\",\"logs\":{\"features\":[{\"message\":\"Show an estimate of an user battle stats on various pages.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show forecast and available worth along with a filter on the stock page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show factions balance excess.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show user balance upon selecting their name on the give cash window.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show warnings if your cooldowns are ending during your flight.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Remove confirmation buttons for the item market, revives and item equipping.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show stat requirements for specialty gyms.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add a button to open chat in trades.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show individual price of an sold item or share on the event page on hover.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Make energy and nerve clickable to open their respective pages.\",\"contributor\":\"Mephiles\"},{\"message\":\"Add Landing time to Travel page.\",\"contributor\":\"Mephiles\"},{\"message\":\"Show mission hints and tips.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show banking investment table.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show a link to a computer while travelling if you don't have a laptop.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add an option to hide quite/leave buttons.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add personal notes on profiles.\",\"contributor\":\"wootty2000\"}],\"fixes\":[{\"message\":\"Don't apply the last action filter on other factions pages.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Don't break the profile page if a profile section is turned off.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Allow dragging links to the chat again.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show proper cons for Vicodin and Xanax.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix achievements update time showing wrong time.\",\"contributor\":\"Mephiles\"},{\"message\":\"Always show Recommended NNB in the right table.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix showing item value (which also broke max buy and YATA updating).\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Hide item highlighting when closing the container if the setting is enabled.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix advanced OC information not showing after starting and replanning an OC.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix TornTools not loading on the poker page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show the travel table more consistent.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show the gym information in jail gym.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix factions short news.\",\"contributor\":\"wootty2000\"}],\"changes\":[{\"message\":\"Change the caching system to allow for different times to keep it for.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Update the profile view to not completely fail upon any api error.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Sync the 15 minute updater to the stock ticks.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Ignore punctuation marks for word highlighting.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Include money value and stocks in trade value.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add a way to ignore cash on hand for max buy in bazaar.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Include a link to the OC in the information window.\",\"contributor\":\"Mephiles\"},{\"message\":\"Allow import and export via text.\",\"contributor\":\"Mephiles\"},{\"message\":\"Add more special filters for factions, search and overseas.\",\"contributor\":\"Mephiles\"},{\"message\":\"Only allow usable items to be added to Quick Items.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Reduce API fetches to reduce stress on API servers. Split userdata to Essential and Basic.\",\"contributor\":\"Mephiles\"},{\"message\":\"Shorten some mission numbers even more to let it fit the box.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Remove links from Achievement cells.\",\"contributor\":\"Mephiles\"},{\"message\":\"Adjust minimal 'show more'-button height on profiles.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show illegal product crimes achievements.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Combine event and messages notifications if there are multiple.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Improve the racing helper.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add preset custom links.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show full factions description for other factions too.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Change the profile show more/less button.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show trade value also for finished trades.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add a limit of 10,000 for bazaar max buy.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add a limit to flying items.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add link to target on target page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add last attack date on target page.\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show market value on blood bags if highlighting is enabled.\",\"contributor\":\"wootty2000\"},{\"message\":\"Added option for Travel Destination to default to the last selected.\",\"contributor\":\"wootty2000\"},{\"message\":\"Added education award tracker. Moved dump and bounty award trackers.\",\"contributor\":\"wootty2000\"}]}},{\"version\":{\"major\":4,\"minor\":10,\"build\":2},\"date\":\"2020/08/19\",\"logs\":{\"fixes\":[{\"message\":\"Fix OC data not updating.\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":4,\"minor\":10,\"build\":1},\"date\":\"2020/08/16\",\"logs\":{\"fixes\":[{\"message\":\"Fix Notifications not appearing on Firefox.\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":4,\"minor\":10,\"build\":0},\"date\":\"2020/08/14\",\"logs\":{\"features\":[{\"message\":\"Add OC timer to Information window\",\"contributor\":\"Mephiles\"},{\"message\":\"Add Chain timer notification\",\"contributor\":\"Mephiles\"},{\"message\":\"Add New Day notification\",\"contributor\":\"Mephiles\"},{\"message\":\"Add highlighting for your own OC\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add option to hide Areas links\",\"contributor\":\"Mephiles\"},{\"message\":\"Add Chain count notification\",\"contributor\":\"Mephiles\"},{\"message\":\"Add a Connect button to Torn Preferences page\",\"contributor\":\"Mephiles\"},{\"message\":\"Add option to change Chat Font size\",\"contributor\":\"Mephiles\"},{\"message\":\"Add support for Torn Proxy (you API key is still needed for fall-back if Proxy system fails)\",\"contributor\":\"Mephiles\"}],\"fixes\":[{\"message\":\"Fix Quick Items failing to load if an item has 0 quantity\",\"contributor\":\"Mephiles\"},{\"message\":\"Fix Profile script failing if player is not in a factions\",\"contributor\":\"Mephiles\"},{\"message\":\"Add missing keywords for Faction armory news shortening script\",\"contributor\":\"Mephiles\"},{\"message\":\"Fix Calculator popup gear icon not working\",\"contributor\":\"Mephiles\"},{\"message\":\"Fix Gym Estimate progress being off by 1 gym\",\"contributor\":\"Mephiles\"},{\"message\":\"Fix Quick Crimes/Items not working on some browsers\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix 'add api key' page loading in Popup when API key has been inserted\",\"contributor\":\"Mephiles\"},{\"message\":\"Fix Quick Bail/Bust not loading on pagination change\",\"contributor\":\"Mephiles\"}],\"changes\":[{\"message\":\"Add option to dismiss notifications rather than open the relevant page\",\"contributor\":\"Mephiles\"},{\"message\":\"Add option to display your own vault value in Information window (indicated by *)\",\"contributor\":\"Mephiles\"},{\"message\":\"Make Travel Destinations table available while flying\",\"contributor\":\"Mephiles\"},{\"message\":\"Add Data usage estimate on Firefox\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Allow whole numbers and percentages simultaneously for bar Notifications\",\"contributor\":\"Mephiles\"},{\"message\":\"Change userdata fetch from 15sec to 30sec to cut down on unnecessary API calls\",\"contributor\":\"Mephiles\"},{\"message\":\"Set 'Force TornTools' setting as default\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Make Travel Table update automatically\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Change 'Hide chats' icon\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Recode Settings page logic\",\"contributor\":\"Mephiles\"},{\"message\":\"Rework how Importing/Exporting works\",\"contributor\":\"Mephiles\"},{\"message\":\"Disable Item Market links on Mobile view\",\"contributor\":\"Mephiles\"},{\"message\":\"Add option to display relative values on Profile Stats\",\"contributor\":\"Mephiles\"},{\"message\":\"Add sorting capability for Profile chosen stats\",\"contributor\":\"Mephiles\"},{\"message\":\"Add images to Travel Table items\",\"contributor\":\"Mephiles\"},{\"message\":\"Disable Watch List option to avoid confusion (will be added in future updates)\",\"contributor\":\"Mephiles\"},{\"message\":\"Switched Travel Table items category options to checkboxes to allow different combinations\",\"contributor\":\"Mephiles\"},{\"message\":\"Changed fetching to be more consistent & to reduce load on YATA\",\"contributor\":\"Mephiles\"}],\"other\":[{\"message\":\"Add 'Open Source' disclaimer to Github Readme\",\"contributor\":\"Mephiles\"},{\"message\":\"Update the Privacy Policy for TornTools\",\"contributor\":\"Mephiles\"},{\"message\":\"Add 'Development focus' section to Github Readme\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":4,\"minor\":9,\"build\":0},\"date\":\"2020/07/29\",\"logs\":{\"features\":[{\"message\":\"Highlight good and bad blood bags on the item page and factions armory\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add a way to hide all chats\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add option to make Areas section collapsible\",\"contributor\":\"Mephiles\"},{\"message\":\"Add sortability option for Profile sections\",\"contributor\":\"Mephiles\"},{\"message\":\"Add exporting/importing for TornTools settings\",\"contributor\":\"Mephiles\"},{\"message\":\"Add Quick Bail & Bust and Scores\",\"contributor\":\"Mephiles\"}],\"fixes\":[{\"message\":\"Fix DoctorN detection not accounting disabled setting\",\"contributor\":\"Mephiles\"},{\"message\":\"Fix the buy max abroad to take already bought items into account\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Format rehab cost as currency\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix gym hiding not working after switching to another gym\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix item value and item market links not showing when scrolling through your items\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix API history cleaning to stop storage build-up\",\"contributor\":\"Mephiles\"},{\"message\":\"Fix NPC loot notifications Text-To-Speech saying 'meter' instead of 'minute'\",\"contributor\":\"Mephiles\"},{\"message\":\"Fix Gym Graph content_old data issue\",\"contributor\":\"Mephiles\"},{\"message\":\"Adjust Faction filter to Torn's new layout\",\"contributor\":\"Mephiles\"},{\"message\":\"Fix Company users' info not appearing\",\"contributor\":\"Mephiles\"},{\"message\":\"Fix Torn's data fetch not running correctly\",\"contributor\":\"Mephiles\"},{\"message\":\"Fix Achievements' tooltip appearing at the bottom of the page\",\"contributor\":\"Mephiles\"},{\"message\":\"Fix Faction announcement 'full page' option not loading when Chain tab was open\",\"contributor\":\"Mephiles\"},{\"message\":\"Fix Faction armory filter not loading for Mobile\",\"contributor\":\"Mephiles\"},{\"message\":\"Block Quick Items doubles\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix Quick Items item dragging\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Adjust Profile script to Torn's layout changes\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix Badge issues\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix Faction armory news\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fix Gym stats updating not showing all improved stats\",\"contributor\":\"Mephiles\"},{\"message\":\"Fix Travel Agency page artifacts on Mobile\",\"contributor\":\"Mephiles\"}],\"changes\":[{\"message\":\"Add a loading icon for networth on the Home page\",\"contributor\":\"Mephiles\"},{\"message\":\"Change popup alignleft point to improve speed\",\"contributor\":\"Mephiles\"},{\"message\":\"Decrease item quantity in Quick Items when sending or using an item\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Improve containers' design\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Show factions member information for other factions\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add an option to disable all notifications\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Add placeholders to chat highlights\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Highlight keywords in chats\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Make Networth fetching regular (10min interval)\",\"contributor\":\"Mephiles\"},{\"message\":\"Redesign Achievements' tooltip\",\"contributor\":\"Mephiles\"},{\"message\":\"Add link to Torn to Info popup's location text\",\"contributor\":\"Mephiles\"},{\"message\":\"Improve overall system performance and stability\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Improve Preferences page design\",\"contributor\":\"Mephiles\"},{\"message\":\"Enable Gym graph on Mobile\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":4,\"minor\":8,\"build\":0},\"date\":\"2020/07/29\",\"logs\":{\"features\":[{\"message\":\"Added Vault balance to Torn Information window\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to disable individual Gym stats training\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Item Market links to Items\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Faction Armory filter to hide items that are Unavailable\",\"contributor\":\"Mephiles\"},{\"message\":\"Show item quantities for Quick Items\",\"contributor\":\"Mephiles\"},{\"message\":\"Added basic statistics about Torn's API fetches made by TornTools\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Crimes stats to Profile Stats\",\"contributor\":\"Mephiles\"}],\"fixes\":[{\"message\":\"Remove LastPass icon from chat 'Find' field\",\"contributor\":\"Mephiles\"},{\"message\":\"Enabled Update TornStats button on mobile Gym page\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed displaying Faction Member info when honors are turned off\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed and redesigned Filters for Hospital, Jail, Faction, Player search, Bounties, Overseas player list (all enabled on Mobile now)\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed 'view full page' when visiting other Factions\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to disable 'find' feature in chat\",\"contributor\":\"Mephiles\"},{\"message\":\"Removed duplicates from Profile Stats\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Market Tab searching\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fixed OC Recommended NNB display when DoctorN is enabled\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Fixed Gym Estimated Energy script when unlocking the last gym\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Mobile content overflow\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed search bug in Stocks popup\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Firefox notification links not working\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed chain timer inaccuracy in Info popup\",\"contributor\":\"Mephiles\"},{\"message\":\"Removed an extra HR from Clean travel page\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Gym script failing to load completely when All gyms were unlocked\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Crimes script running when page was blocked\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed TornStats NNB visual issue\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Market tab not showing prices if either bazaar or itemmarket had 0 listings\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Info popup Events & Messages links stacking up\",\"contributor\":\"Mephiles\"}],\"changes\":[{\"message\":\"Disabled Profile Stats for your own profile\",\"contributor\":\"Mephiles\"},{\"message\":\"Improved TornTools containers' design\",\"contributor\":\"Mephiles\"},{\"message\":\"Containers now remember their last position\",\"contributor\":\"Mephiles\"},{\"message\":\"Added alternative way of adding Quick Crimes & Items in case dragging fails to work\",\"contributor\":\"Mephiles\"},{\"message\":\"Made Navigation Bar TornTools sections collapsible\",\"contributor\":\"Mephiles\"},{\"message\":\"Added EDIT button to add/remove Profile Stats to eliminate accidental moving\",\"contributor\":\"Mephiles\"},{\"message\":\"Removed Text-To-Speech from permissions (still usable)\",\"contributor\":\"Mephiles\"},{\"message\":\"Improved Travel Destinations table. Clicking on Country filters affects the map and vice-versa\",\"contributor\":\"Mephiles\"},{\"message\":\"Added link to TornTools preferences to Torn's Settings page\",\"contributor\":\"Mephiles\"},{\"message\":\"Removed options for DoctorN in settings. Auto-detection is enabled for Chrome and Firefox\",\"contributor\":\"DeKleineKobini\"},{\"message\":\"Adjusted 'buy' button position to reduce misclicking\",\"contributor\":\"Mephiles\"}],\"api system changes\":[{\"message\":\"Networth info is only fetched when visiting Home page with a cache time of 5 minutes\",\"contributor\":\"Mephiles\"},{\"message\":\"Stocks data is fetched every 15 minutes\",\"contributor\":\"Mephiles\"},{\"message\":\"Torn's data & OC info is fetched every 24 hours\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":4,\"minor\":7,\"build\":0},\"date\":\"2020/07/03\",\"logs\":{\"features\":[{\"message\":\"Added detailed info about Drugs on Items page & Faction armory\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to display full Announcements & Info containers on Faction page\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to enable Text-To-Speech for notifications\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to show Bazaar Value\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to show Faction Armory Value (does not take into count Cesium)\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to clean Flight page\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to show 'respect to go' info for Faction Upgrades\",\"contributor\":\"Mephiles\"},{\"message\":\"Added item highlighting when going from Item Market to someone's Bazaar\",\"contributor\":\"Mephiles\"},{\"message\":\"Added 'find' feature for chat boxes\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to display details about Faction members including Inactivity alerts (requires Faction API access)\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to display details about Company members including Inactivity alerts\",\"contributor\":\"Mephiles\"},{\"message\":\"Added 'members available' info for OCs\",\"contributor\":\"Mephiles\"},{\"message\":\"Added recommended NNB info for OCs\",\"contributor\":\"Mephiles\"},{\"message\":\"Added links to notifications\",\"contributor\":\"Mephiles\"}],\"fixes\":[{\"message\":\"Turned all container arrows the right way\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Info popup failing for Firefox when Traveling\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed OCs opening when their status was not Ready\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Info popup failing to load when no booster cooldown\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed notifications repeating after 15 minutes. Changed time to 24 hours\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed empty space on Mobile while Traveling\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed events and message Notifications not respecting preferences\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed script info stacking on Faction Crimes page\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed 12hour formatting showing time as 00:30 AM rather than 12:30 AM\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Stakeouts continuing requests if user was no longer watched\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed TTS working even when disabled\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Profile Stats view for Mobile users\",\"contributor\":\"Mephiles\"},{\"message\":\"Added all Profile Stats keys as normal text\",\"contributor\":\"Allo\"}],\"changes\":[{\"message\":\"Moved 'TornStats NNB', 'recommended NNB', 'auto-open OCs', 'show available member count' under single option: 'OC Advanced'\",\"contributor\":\"Mephiles\"},{\"message\":\"Made API marking optional (default: false)\",\"contributor\":\"Mephiles\"},{\"message\":\"Changed Notification cache to 7 days\",\"contributor\":\"Mephiles\"},{\"message\":\"Split up API settings\",\"contributor\":\"Mephiles\"},{\"message\":\"Re-designed Gym container to show progress from last update\",\"contributor\":\"Mephiles\"},{\"message\":\"Re-designed Profile Stats page to display Spy info\",\"contributor\":\"Mephiles\"},{\"message\":\"Profile script now takes into count if DoctorN is installed\",\"contributor\":\"Mephiles\"},{\"message\":\"Slightly improved Settings page design\",\"contributor\":\"Mephiles\"}],\"notifications\":[{\"message\":\"Switched notification system to allow clicking notifications to open Torn. Firefox users need to manually allow notifications on Preferences page\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":4,\"minor\":6,\"build\":0},\"date\":\"2020/06/28\",\"logs\":{\"discord\":[{\"message\":\"Join the Discord (https://discord.gg/ukyK6f6) to report bugs, give suggestions or just chat\",\"contributor\":\"Mephiles\"}],\"features\":[{\"message\":\"Added option to automatically open OCs that are ready to initiate (all players are Okay)\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Natural Nerve Bar info to OCs (powered by TornStats)\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to display acronyms on Stock Exchange page\",\"contributor\":\"Mephiles\"},{\"message\":\"Added links to Stocks popup stock names\",\"contributor\":\"Mephiles\"}],\"fixes\":[{\"message\":\"Fixed Bounty Filter not working well with DoctorN\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed TornStats integration not working on Firefox\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Notifications for events, messages, X minutes until landing, X minutes until out of hospital, Stakeouts, NPC loot times (notifications will repeat every 15minutes if time is over 15minutes)\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Quick Crimes failing to load sometimes\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Global Scripts (like chat filter) not running when traveling\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Travel Bar showing negative values in Info popup\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Faction Armory simplification double username. Added keywords 'lent', 'retrieved', 'returned'\",\"contributor\":\"Mephiles\"}],\"changes\":[{\"message\":\"Hopefully increased popup load speed\",\"contributor\":\"Mephiles\"},{\"message\":\"Improved layout and functionality of Travel Table. Filters work together now and save automatically\",\"contributor\":\"Mephiles\"}],\"mobile\":[{\"message\":\"Show Custom Links for mobile\",\"contributor\":\"Mephiles\"},{\"message\":\"Disabled Notes section for mobile\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Effective Battle Stats table for mobile\",\"contributor\":\"Mephiles\"},{\"message\":\"Disabled Achievements for mobile\",\"contributor\":\"Mephiles\"},{\"message\":\"Disabled Gym Graph on mobile\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Item Values for mobile\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Mission Values for mobile\",\"contributor\":\"Mephiles\"},{\"message\":\"Disabled Jail, Hospital, Faction filters for mobile (fill be re-added when fixed)\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Profile Stats design for mobile\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":4,\"minor\":5,\"build\":0},\"date\":\"2020/06/23\",\"logs\":{\"features\":[{\"message\":\"Added Update TornStats button to Gym graph\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to add notifications for X minutes left in hospital & landing in X minutes\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Bounty Filter to newspaper\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Stakeouts to profiles\",\"contributor\":\"Mephiles\"}],\"fixes\":[{\"message\":\"Fixed Gym graph labels not using commas\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Chain timer in Info popup not appearing\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Gym script not loading for players who have unlocked all gyms\",\"contributor\":\"Mephiles\"}],\"changes\":[{\"message\":\"Improved design of Info popup (removed unnecessary text & made 'update' text smaller)\",\"contributor\":\"Mephiles\"},{\"message\":\"Improved Player Stats readability\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":4,\"minor\":4,\"build\":0},\"date\":\"2020/06/20\",\"logs\":{\"features\":[{\"message\":\"Added percentages to Energy, Nerve, Happy, Life notifications\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Player Stats to Profile pages. To use, you need to have a TornStats account (https://www.tornstats.com/)\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Paypal donation button to Settings -> About page\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Fill Max button to Travel Market\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Gym Stats graph to Gym page. To use, you need to have a TornStats account ((https://www.tornstats.com/)\",\"contributor\":\"Mephiles\"}],\"fixes\":[{\"message\":\"Disabled Chat Highlighting when DoctorN is installed and TornTools is not forced\",\"contributor\":\"Mephiles\"},{\"message\":\"Disabled Quick Crimes & Quick Items if DoctorN is installed and TornTools is not forced\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Info popup showing only 0 messages & events\",\"contributor\":\"Mephiles\"}],\"changes\":[{\"message\":\"Added nerve indicator to Quick Crimes\",\"contributor\":\"Mephiles\"},{\"message\":\"Shop fill max takes into count the 100 item limit\",\"contributor\":\"Mephiles\"},{\"message\":\"Shop & bazaar fill max take into count user's money\",\"contributor\":\"Mephiles\"},{\"message\":\"Made Info popup bars a bit brighter and removed 'Status:' text\",\"contributor\":\"Mephiles\"},{\"message\":\"Disabled simplified header for Info popup\",\"contributor\":\"Mephiles\"},{\"message\":\"Added time of landing to Info popup travel bar\",\"contributor\":\"Mephiles\"},{\"message\":\"Updated API info (Profile Stats makes 1 request to Torn's API and 1 to TornStats' API (max 25/minute))\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":4,\"minor\":3,\"build\":1},\"date\":\"2020/06/15\",\"logs\":{\"fixes\":[{\"message\":\"Fixed Quick Crimes not appearing if user had 0 Quick Items\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Quick Items drag not working on Firefox\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":4,\"minor\":3,\"build\":0},\"date\":\"2020/06/15\",\"logs\":{\"features\":[{\"message\":\"Added Notes section to Navigation bar\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Fill Max button to city shops & bazaars\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Player filters to Faction Info page, Jail page & Hospital page\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Country filter to Travel Destinations table & made legend collapsible\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Badge notifications for Events & Messages\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Chain cooldown timer to Info popup\",\"contributor\":\"Mephiles\"}],\"fixes\":[{\"message\":\"Hopefully increased loading speeds for popups\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed double notifications for some messages & events\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed container collapse bubbling when loading site (changes are set before loading the container)\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Museum set message disappearing because of Upgrade button hide script\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed ERROR badge flashing for some users\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Energy Estimate script on Gym page for users who have company special (+30% experience gain)\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Quick crimes\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed People list breaking overseas because of the Item profits script\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Quick items not dragging well\",\"contributor\":\"Mephiles\"}],\"changes\":[{\"message\":\"Simplified links design in popups to reduce clutter\",\"contributor\":\"Mephiles\"},{\"message\":\"Separated Trade Item values & Total value to two different options to permanently disable item values\",\"contributor\":\"Mephiles\"},{\"message\":\"Removed 'Location:' text from Info popup\",\"contributor\":\"Mephiles\"}],\"thanks - rockyroxanne [2282703]\":[{\"message\":\"Changed bar colors in Info popup\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to Align Torn to left\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Happy reset timer to Info popup\",\"contributor\":\"Mephiles\"},{\"message\":\"Improved design of Preferences page (slightly increased white space around sections and made container bigger)\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Messages section to Info popup\",\"contributor\":\"Mephiles\"},{\"message\":\"Added links to Info popup messages & events\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Travel bar to Info popup\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":4,\"minor\":2,\"build\":0},\"date\":\"2020/06/10\",\"logs\":{\"features\":[{\"message\":\"Added Info tab popup to display bars, money, events, cooldowns\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Estimated Energy progress to Gym (based on estimated goals in wiki and percentage to next gym on Gym page)\",\"contributor\":\"Mephiles\"},{\"message\":\"Added notifications for new Events, Messages, Education finish, Cooldown end, Traveling, Bars full, Status change\",\"contributor\":\"Mephiles\"},{\"message\":\"Added update-available notifier with instructions to manually update on About page\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to hide Level Upgrade info (button and info on Home page)\",\"contributor\":\"Mephiles\"},{\"message\":\"Added item type sorting to Travel Destinations table\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to disable item highlighting on City Map if TornTools container is close (similar to DoctorN)\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to open Custom Links on same page\",\"contributor\":\"Mephiles\"},{\"message\":\"Added back Stock Search function\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to hide item values on Trade view to allow copy-pasting for traders\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to hide icons in navigation sidebar\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Quick items & crimes (might be a bit buggy, let me know)\",\"contributor\":\"Mephiles\"}],\"fixes\":[{\"message\":\"Fixed ERROR text not disappearing after API comes back online\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Chat Highlight not updating when sending a message\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Armory log script not working when waited too long\",\"contributor\":\"Mephiles\"},{\"message\":\"Improved load times of scripts\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Battle Stats NaN errors\",\"contributor\":\"Mephiles\"}],\"changes\":[{\"message\":\"Changed Networth comparing to Torn's own last known networth (the one shown under General Information)\",\"contributor\":\"Mephiles\"},{\"message\":\"Reformatted how Target List is updated. Removed the optional request.\",\"contributor\":\"Mephiles\"},{\"message\":\"Changed Travel Destinations table columns order\",\"contributor\":\"Mephiles\"},{\"message\":\"Removed 'remove info boxes' script completely\",\"contributor\":\"Mephiles\"}],\"important\":[{\"message\":\"Refactored how info is fetched from Torn. Total requests raised to 7 per minute to keep TornTools up-to-date with user's status, bars etc. for Info popup & notifications\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":4,\"minor\":1,\"build\":0},\"date\":\"2020/05/29\",\"logs\":{\"fixes\":[{\"message\":\"Fixed bug that halted all extension's process\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed DoctorN check not working correctly\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Mail Me link in settings\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed UAE travel achievement\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":4,\"minor\":0,\"build\":0},\"date\":\"2020/05/28\",\"logs\":{\"features\":[{\"message\":\"Added option to force TornTools over DoctorN where possible\",\"contributor\":\"Mephiles\"},{\"message\":\"Added custom Links to navigation panel\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Item Stock into Travel Destinations table (replaced flight time)\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to collapse TornTools containers (clicking on the heading works too)\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to show user's status indicator next to their name (page heading)\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Stocks price notifications (can set under stocks tab)\",\"contributor\":\"Mephiles\"},{\"message\":\"Added an error badge to extension icon if API is down\",\"contributor\":\"Mephiles\"},{\"message\":\"Added alerts for NPC loot times\",\"contributor\":\"Mephiles\"},{\"message\":\"Added a button to clear target list data\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Chat Highlighting\",\"contributor\":\"Mephiles\"}],\"fixes\":[{\"message\":\"IMPORTANT: Torn changed the formatting of dates in Vault transactions. Adjusted TornTools with that. (CLICK save to update the database with the latest correct date)\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Vault not updating User's shares when looping through content_old transactions\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed API errors not appearing on Stocks page\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed DoctorN always set as False on Firefox (set using/not using under settings)\",\"contributor\":\"Mephiles\"}],\"changes\":[{\"message\":\"Removed Hospital from 'remove info boxes' script\",\"contributor\":\"Mephiles\"},{\"message\":\"Simplified container headings (removed TornTools text)\",\"contributor\":\"Mephiles\"},{\"message\":\"Further improved design of City Items\",\"contributor\":\"Mephiles\"},{\"message\":\"Improved design of tables on Settings page (NPC Loot, Friendly Fire, Custom links)\",\"contributor\":\"Mephiles\"},{\"message\":\"Improved design of Settings page in smaller windows\",\"contributor\":\"Mephiles\"},{\"message\":\"Added current API key preview in Change API key input\",\"contributor\":\"Mephiles\"}]},\"title\":\"Taking over\"},{\"version\":{\"major\":3,\"minor\":8,\"build\":3},\"date\":\"2020/05/23\",\"logs\":{\"fixes\":[{\"message\":\"Added confirmation message when changing your API key\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed API online set to false when other API errors\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":3,\"minor\":8,\"build\":1},\"date\":\"2020/05/22\",\"logs\":{\"fixes\":[{\"message\":\"Fixed \\\"Remove info boxes on some pages\\\" option not disabling\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":3,\"minor\":8,\"build\":0},\"date\":\"2020/05/21\",\"logs\":{\"features\":[{\"message\":\"Added an Alternative Theme option (black background and green text)\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Disk Space Used info under About page (Chrome only)\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Date and Time formatting options (Added formatting to: Networth details)\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to Remove Info Boxes that are unnecessary on some pages\",\"contributor\":\"Mephiles\"},{\"message\":\"Added 'last updated' info icon for live Networth on Home page\",\"contributor\":\"Mephiles\"}],\"fixes\":[{\"message\":\"Hopefully fixed sometimes appearing slow popup window switch\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Trade Calculator showing incorrect total value\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Allies not saving\",\"contributor\":\"Mephiles\"}],\"changes\":[{\"message\":\"Removed some duplicated achievements (Items: Bazaar Customers, Points sold (both under Home page now))\",\"contributor\":\"Mephiles\"},{\"message\":\"Moved Stock Payouts achievement to Home page (previously under Items)\",\"contributor\":\"Mephiles\"},{\"message\":\"Changed Preferences' section positions\",\"contributor\":\"Mephiles\"},{\"message\":\"Improved the design of City Items (hovering on an item in the list now reveals it on the map also)\",\"contributor\":\"Mephiles\"},{\"message\":\"Updated icons (Settings, Portfolio, Search icon)\",\"contributor\":\"Mephiles\"}],\"credits and thanks to lugburz [2386297]\":[{\"message\":\"Added NPC loot times\",\"contributor\":\"Mephiles\"},{\"message\":\"Added OC finish times\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Faction Armory simplification\",\"contributor\":\"Mephiles\"},{\"message\":\"Licensed my extension under the GNU General Public License\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":3,\"minor\":7,\"build\":0},\"date\":\"2020/05/16\",\"logs\":{\"features\":[{\"message\":\"Added a Travel Destinations table to Travel Agency page\",\"contributor\":\"Mephiles\"},{\"message\":\"Accidentally added features in last update: Effective Battle Stats on Home page, Item profits in Travel Market, Item values on Items page\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to reformat Profile headings as USERNAME [ID]\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to Export Chain Report as CSV\",\"contributor\":\"Mephiles\"}],\"fixes\":[{\"message\":\"Added options for settings: Effective Battle Stats, Item profits in Travel Market, Item values on Items page\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed issue where Accessory pictures were blocking vision of HiLo suggested action (I prevented any items from appearing on screen)\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed disabling Gym buttons as clicking them still used energy before\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed issue where disabling/enabling Gym buttons would clear preferences\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed issue where Effective Battle Stats would show NaN\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Live Networth not showing if there are no details to show\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed HiLo multiple suggestions appearing\",\"contributor\":\"Mephiles\"}],\"changes\":[{\"message\":\"Improved design of Settings page\",\"contributor\":\"Mephiles\"},{\"message\":\"Changed the structure of Local Database (You might need to check your settings)\",\"contributor\":\"Mephiles\"},{\"message\":\"Reduced API requests needed by 1\",\"contributor\":\"Mephiles\"},{\"message\":\"Improved popups' designs\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":3,\"minor\":6,\"build\":1},\"date\":\"2020/04/30\",\"logs\":{\"features\":[{\"message\":\"Added new logo\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Target List to Settings page\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Blackjack and HiLo helpers to Casino\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to disable update notifications\",\"contributor\":\"Mephiles\"},{\"message\":\"Added option to disable Gym train buttons\",\"contributor\":\"Mephiles\"},{\"message\":\"Added attack history info about user on Profile page\",\"contributor\":\"Mephiles\"},{\"message\":\"Added percentage profit of items in stores (ie. 137% means that the market value is 137% of the store buy price)\",\"contributor\":\"Mephiles\"},{\"message\":\"Added info tooltips for achievements\",\"contributor\":\"Mephiles\"},{\"message\":\"Added detailed networth information on Home page\",\"contributor\":\"Mephiles\"},{\"message\":\"Added bounty reward (money) achievement\",\"contributor\":\"Mephiles\"}],\"fixes\":[{\"message\":\"Fixed some broken achievements (Home: activity, networth; Items: items dumped, cannabis; Missions: defends, assists)\",\"contributor\":\"Mephiles\"},{\"message\":\"Hide empty Awards sections\",\"contributor\":\"Mephiles\"}],\"changes\":[{\"message\":\"Improved Achievements' design\",\"contributor\":\"Mephiles\"},{\"message\":\"Improved Missions Reward design\",\"contributor\":\"Mephiles\"},{\"message\":\"Improved TornTools info containers\",\"contributor\":\"Mephiles\"},{\"message\":\"Highlight new settings on Settings page\",\"contributor\":\"Mephiles\"},{\"message\":\"Reset settings button resets extension's whole storage (except the API key)\",\"contributor\":\"Mephiles\"},{\"message\":\"Shortened '1000' to 'k'\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":3,\"minor\":5,\"build\":0},\"date\":\"2020/03/22\",\"logs\":{\"features\":[{\"message\":\"Create and update a target list based on attack history. (not available for use yet; coming with next update)\",\"contributor\":\"Mephiles\"},{\"message\":\"Moved City & Dump finds achievements to city.php\",\"contributor\":\"Mephiles\"},{\"message\":\"Moved items bought abroad achievement to travelagency.php\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Church donations achievement to church.php\",\"contributor\":\"Mephiles\"},{\"message\":\"Increase 'time ago' counter on achievement pages.\",\"contributor\":\"Mephiles\"}],\"fixes\":[{\"message\":\"Fixed settings resetting when closing and re-opening browser.\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed bug where Gym stats had a random comma after the decimal point. (all stats rounded down to a whole number)\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed double update notification on profile.php on Firefox\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed networth not showing for some users on home.php\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":3,\"minor\":4,\"build\":0},\"date\":\"2020/03/15\",\"logs\":{\"features\":[{\"message\":\"Added Fraud crimes to Crime achievements.\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Github link to the extension (at the bottom of the Settings page).\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":3,\"minor\":3,\"build\":0},\"date\":\"2020/03/01\",\"logs\":{\"features\":[{\"message\":\"Added more achievements on pages Home, Items, Missions, Jail, My Faction.\",\"contributor\":\"Mephiles\"},{\"message\":\"Added Racing achievements.\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Racing Upgrades not showing correct values.\",\"contributor\":\"Mephiles\"},{\"message\":\"Re-added notification when a new version of TornTools is installed.\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":3,\"minor\":2,\"build\":0},\"date\":\"2020/02/17\",\"logs\":{\"features\":[{\"message\":\"Show warning on player profiles when the player is in your factions or in an ally factions.\",\"contributor\":\"Mephiles\"},{\"message\":\"Show racing upgrade values.\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":3,\"minor\":1,\"build\":0},\"date\":\"2020/01/31\",\"logs\":{\"fixes\":[{\"message\":\"Fixed the extension not updating after an API outage.\",\"contributor\":\"Mephiles\"}]}},{\"version\":{\"major\":3,\"minor\":0,\"build\":0},\"date\":\"2020/01/26\",\"logs\":{\"features\":[{\"message\":\"I removed some features either because they were not needed anymore (Torn has them default) or they weren't worth it. (auction, bazaar, forums, mail, profile voting) Let me know of any thoughts or ideas about these.\",\"contributor\":\"Mephiles\"},{\"message\":\"Changed the system for saving settings so don't forget to press the Save button.\",\"contributor\":\"Mephiles\"}],\"fixes\":[{\"message\":\"Fixed long numbers on achievements (shortened to mil)\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed wrong prices in Market\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed Missions prices not appearing if the prices were split into 2 groups\",\"contributor\":\"Mephiles\"},{\"message\":\"Fixed API page not working properly (the API key was inserted as 'unknown')\",\"contributor\":\"Mephiles\"},{\"message\":\"Updated API request info\",\"contributor\":\"Mephiles\"}]},\"title\":\"Long time, no see(?)\"}]");
//#endregion
//#region src/extension/utils/changelog.ts
function readableChangelog() {
	return changelog_default.map((entry) => {
		const log = {
			...entry,
			date: false
		};
		if (typeof entry.date === "string") log.date = new Date(entry.date);
		Object.entries(entry.logs).filter(([, logs]) => !logs.length).forEach(([section]) => delete entry.logs[section]);
		return log;
	});
}
var DEFAULT_CONTRIBUTOR_COLOR = "gray";
function toDisplayableChangelogEntry(entry) {
	const version = concatenateVersion(entry.version);
	const contributors = Object.values(entry.logs).flat().map((log) => log.contributor).filter((value, i, self) => !!value && self.indexOf(value) === i).map((contributor) => {
		if (contributor in CONTRIBUTORS) return {
			key: contributor,
			...CONTRIBUTORS[contributor]
		};
		else return {
			key: contributor,
			name: contributor,
			color: DEFAULT_CONTRIBUTOR_COLOR
		};
	});
	const logs = Object.entries(entry.logs).map(([section, logs]) => {
		return [section, logs.map((log) => ({
			html: typeof log.message === "string" ? log.message : log.message.join("<br>"),
			color: contributors.find((c) => c.key === log.contributor)?.color ?? DEFAULT_CONTRIBUTOR_COLOR
		}))];
	}).reduce((obj, [section, logs]) => {
		obj[section] = logs;
		return obj;
	}, {});
	return {
		version,
		title: buildTitle(version, entry.date, entry.title),
		beta: entry.title?.toLowerCase() === "beta",
		contributors,
		logs
	};
}
function concatenateVersion(version) {
	const parts = [];
	parts.push(`v${version.major}`);
	parts.push(version.minor.toString());
	if (version.build) parts.push(version.build.toString());
	return parts.join(".");
}
function buildTitle(version, date, title) {
	const parts = [];
	parts.push(version);
	if (date) parts.push(`${MONTHS[date.getMonth()]}, ${daySuffix(date.getDate())} ${date.getFullYear()}`);
	if (title && title.toLowerCase() !== "beta") parts.push(title);
	return parts.join(" - ");
}
//#endregion
//#region src/extension/svelte/components/ui/accordion/accordion.svelte
function Accordion($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), value = prop($$props, "value", 15), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"value",
		"class"
	]);
	var fragment = comment();
	var node = first_child(fragment);
	{
		let $0 = user_derived(() => cn("cn-accordion flex w-full flex-col", $$props.class));
		component(node, () => Accordion$1, ($$anchor, AccordionPrimitive_Root) => {
			AccordionPrimitive_Root($$anchor, spread_props({
				"data-slot": "accordion",
				get class() {
					return get($0);
				}
			}, () => restProps, {
				get ref() {
					return ref();
				},
				set ref($$value) {
					ref($$value);
				},
				get value() {
					return value();
				},
				set value($$value) {
					value($$value);
				}
			}));
		});
	}
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/accordion/accordion-content.svelte
var root_1$36 = from_html(`<div><!></div>`);
function Accordion_content($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"children"
	]);
	var fragment = comment();
	component(first_child(fragment), () => Accordion_content$1, ($$anchor, AccordionPrimitive_Content) => {
		AccordionPrimitive_Content($$anchor, spread_props({
			"data-slot": "accordion-content",
			class: "data-open:animate-accordion-down data-closed:animate-accordion-up text-sm overflow-hidden"
		}, () => restProps, {
			get ref() {
				return ref();
			},
			set ref($$value) {
				ref($$value);
			},
			children: ($$anchor, $$slotProps) => {
				var div = root_1$36();
				snippet(child(div), () => $$props.children ?? noop);
				reset(div);
				template_effect(($0) => set_class(div, 1, $0), [() => clsx(cn("pt-0 pb-2.5 [&_a]:hover:text-foreground [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4", $$props.class))]);
				append($$anchor, div);
			},
			$$slots: { default: true }
		}));
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/accordion/accordion-item.svelte
function Accordion_item($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class"
	]);
	var fragment = comment();
	var node = first_child(fragment);
	{
		let $0 = user_derived(() => cn("not-last:border-b", $$props.class));
		component(node, () => Accordion_item$1, ($$anchor, AccordionPrimitive_Item) => {
			AccordionPrimitive_Item($$anchor, spread_props({
				"data-slot": "accordion-item",
				get class() {
					return get($0);
				}
			}, () => restProps, {
				get ref() {
					return ref();
				},
				set ref($$value) {
					ref($$value);
				}
			}));
		});
	}
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/phosphor-svelte/lib/CaretDown.svelte
var root_2$45 = from_svg(`<path d="M216.49,104.49l-80,80a12,12,0,0,1-17,0l-80-80a12,12,0,0,1,17-17L128,159l71.51-71.52a12,12,0,0,1,17,17Z"></path>`);
var root_3$31 = from_svg(`<path d="M208,96l-80,80L48,96Z" opacity="0.2"></path><path d="M215.39,92.94A8,8,0,0,0,208,88H48a8,8,0,0,0-5.66,13.66l80,80a8,8,0,0,0,11.32,0l80-80A8,8,0,0,0,215.39,92.94ZM128,164.69,67.31,104H188.69Z"></path>`, 1);
var root_4$21 = from_svg(`<path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,48,88H208a8,8,0,0,1,5.66,13.66Z"></path>`);
var root_5$24 = from_svg(`<path d="M212.24,100.24l-80,80a6,6,0,0,1-8.48,0l-80-80a6,6,0,0,1,8.48-8.48L128,167.51l75.76-75.75a6,6,0,0,1,8.48,8.48Z"></path>`);
var root_6$20 = from_svg(`<path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"></path>`);
var root_7$20 = from_svg(`<path d="M210.83,98.83l-80,80a4,4,0,0,1-5.66,0l-80-80a4,4,0,0,1,5.66-5.66L128,170.34l77.17-77.17a4,4,0,1,1,5.66,5.66Z"></path>`);
var root$51 = from_svg(`<svg><!><rect width="256" height="256" fill="none"></rect><!></svg>`);
function CaretDown($$anchor, $$props) {
	push($$props, true);
	const ctx = getIconContext();
	let props = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"children"
	]);
	let weight = user_derived(() => $$props.weight ?? ctx.weight ?? "regular");
	let color = user_derived(() => $$props.color ?? ctx.color ?? "currentColor");
	let size = user_derived(() => $$props.size ?? ctx.size ?? "1em");
	let mirrored = user_derived(() => $$props.mirrored ?? ctx.mirrored ?? false);
	function svgAttr(obj) {
		let { weight, color, size, mirrored, ...attrs } = obj;
		return attrs;
	}
	var svg = root$51();
	attribute_effect(svg, ($0, $1) => ({
		xmlns: "http://www.w3.org/2000/svg",
		role: "img",
		width: get(size),
		height: get(size),
		fill: get(color),
		transform: get(mirrored) ? "scale(-1, 1)" : void 0,
		viewBox: "0 0 256 256",
		...$0,
		...$1
	}), [() => svgAttr(ctx), () => svgAttr(props)]);
	var node = child(svg);
	var consequent = ($$anchor) => {
		var fragment = comment();
		snippet(first_child(fragment), () => $$props.children);
		append($$anchor, fragment);
	};
	if_block(node, ($$render) => {
		if ($$props.children) $$render(consequent);
	});
	var node_2 = sibling(node, 2);
	var consequent_1 = ($$anchor) => {
		append($$anchor, root_2$45());
	};
	var consequent_2 = ($$anchor) => {
		var fragment_1 = root_3$31();
		next();
		append($$anchor, fragment_1);
	};
	var consequent_3 = ($$anchor) => {
		append($$anchor, root_4$21());
	};
	var consequent_4 = ($$anchor) => {
		append($$anchor, root_5$24());
	};
	var consequent_5 = ($$anchor) => {
		append($$anchor, root_6$20());
	};
	var consequent_6 = ($$anchor) => {
		append($$anchor, root_7$20());
	};
	var alternate = ($$anchor) => {
		var text$34 = text();
		text$34.nodeValue = (console.error("Unsupported icon weight. Choose from \"thin\", \"light\", \"regular\", \"bold\", \"fill\", or \"duotone\"."), "");
		append($$anchor, text$34);
	};
	if_block(node_2, ($$render) => {
		if (get(weight) === "bold") $$render(consequent_1);
		else if (get(weight) === "duotone") $$render(consequent_2, 1);
		else if (get(weight) === "fill") $$render(consequent_3, 2);
		else if (get(weight) === "light") $$render(consequent_4, 3);
		else if (get(weight) === "regular") $$render(consequent_5, 4);
		else if (get(weight) === "thin") $$render(consequent_6, 5);
		else $$render(alternate, -1);
	});
	reset(svg);
	append($$anchor, svg);
	pop();
}
//#endregion
//#region node_modules/phosphor-svelte/lib/CaretUp.svelte
var root_2$44 = from_svg(`<path d="M216.49,168.49a12,12,0,0,1-17,0L128,97,56.49,168.49a12,12,0,0,1-17-17l80-80a12,12,0,0,1,17,0l80,80A12,12,0,0,1,216.49,168.49Z"></path>`);
var root_3$30 = from_svg(`<path d="M208,160H48l80-80Z" opacity="0.2"></path><path d="M213.66,154.34l-80-80a8,8,0,0,0-11.32,0l-80,80A8,8,0,0,0,48,168H208a8,8,0,0,0,5.66-13.66ZM67.31,152,128,91.31,188.69,152Z"></path>`, 1);
var root_4$20 = from_svg(`<path d="M215.39,163.06A8,8,0,0,1,208,168H48a8,8,0,0,1-5.66-13.66l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,215.39,163.06Z"></path>`);
var root_5$23 = from_svg(`<path d="M212.24,164.24a6,6,0,0,1-8.48,0L128,88.49,52.24,164.24a6,6,0,0,1-8.48-8.48l80-80a6,6,0,0,1,8.48,0l80,80A6,6,0,0,1,212.24,164.24Z"></path>`);
var root_6$19 = from_svg(`<path d="M213.66,165.66a8,8,0,0,1-11.32,0L128,91.31,53.66,165.66a8,8,0,0,1-11.32-11.32l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,213.66,165.66Z"></path>`);
var root_7$19 = from_svg(`<path d="M210.83,162.83a4,4,0,0,1-5.66,0L128,85.66,50.83,162.83a4,4,0,0,1-5.66-5.66l80-80a4,4,0,0,1,5.66,0l80,80A4,4,0,0,1,210.83,162.83Z"></path>`);
var root$50 = from_svg(`<svg><!><rect width="256" height="256" fill="none"></rect><!></svg>`);
function CaretUp($$anchor, $$props) {
	push($$props, true);
	const ctx = getIconContext();
	let props = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"children"
	]);
	let weight = user_derived(() => $$props.weight ?? ctx.weight ?? "regular");
	let color = user_derived(() => $$props.color ?? ctx.color ?? "currentColor");
	let size = user_derived(() => $$props.size ?? ctx.size ?? "1em");
	let mirrored = user_derived(() => $$props.mirrored ?? ctx.mirrored ?? false);
	function svgAttr(obj) {
		let { weight, color, size, mirrored, ...attrs } = obj;
		return attrs;
	}
	var svg = root$50();
	attribute_effect(svg, ($0, $1) => ({
		xmlns: "http://www.w3.org/2000/svg",
		role: "img",
		width: get(size),
		height: get(size),
		fill: get(color),
		transform: get(mirrored) ? "scale(-1, 1)" : void 0,
		viewBox: "0 0 256 256",
		...$0,
		...$1
	}), [() => svgAttr(ctx), () => svgAttr(props)]);
	var node = child(svg);
	var consequent = ($$anchor) => {
		var fragment = comment();
		snippet(first_child(fragment), () => $$props.children);
		append($$anchor, fragment);
	};
	if_block(node, ($$render) => {
		if ($$props.children) $$render(consequent);
	});
	var node_2 = sibling(node, 2);
	var consequent_1 = ($$anchor) => {
		append($$anchor, root_2$44());
	};
	var consequent_2 = ($$anchor) => {
		var fragment_1 = root_3$30();
		next();
		append($$anchor, fragment_1);
	};
	var consequent_3 = ($$anchor) => {
		append($$anchor, root_4$20());
	};
	var consequent_4 = ($$anchor) => {
		append($$anchor, root_5$23());
	};
	var consequent_5 = ($$anchor) => {
		append($$anchor, root_6$19());
	};
	var consequent_6 = ($$anchor) => {
		append($$anchor, root_7$19());
	};
	var alternate = ($$anchor) => {
		var text$33 = text();
		text$33.nodeValue = (console.error("Unsupported icon weight. Choose from \"thin\", \"light\", \"regular\", \"bold\", \"fill\", or \"duotone\"."), "");
		append($$anchor, text$33);
	};
	if_block(node_2, ($$render) => {
		if (get(weight) === "bold") $$render(consequent_1);
		else if (get(weight) === "duotone") $$render(consequent_2, 1);
		else if (get(weight) === "fill") $$render(consequent_3, 2);
		else if (get(weight) === "light") $$render(consequent_4, 3);
		else if (get(weight) === "regular") $$render(consequent_5, 4);
		else if (get(weight) === "thin") $$render(consequent_6, 5);
		else $$render(alternate, -1);
	});
	reset(svg);
	append($$anchor, svg);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/accordion/accordion-trigger.svelte
var root_2$43 = from_html(`<!> <!> <!>`, 1);
function Accordion_trigger($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), level = prop($$props, "level", 3, 3), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"level",
		"children"
	]);
	var fragment = comment();
	component(first_child(fragment), () => Accordion_header, ($$anchor, AccordionPrimitive_Header) => {
		AccordionPrimitive_Header($$anchor, {
			get level() {
				return level();
			},
			class: "flex",
			children: ($$anchor, $$slotProps) => {
				var fragment_1 = comment();
				var node_1 = first_child(fragment_1);
				{
					let $0 = user_derived(() => cn("focus-visible:ring-ring/50 focus-visible:border-ring focus-visible:after:border-ring **:data-[slot=accordion-trigger-icon]:text-muted-foreground rounded-lg py-2.5 text-left text-sm font-medium hover:underline focus-visible:ring-3 **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4 group/accordion-trigger relative flex flex-1 items-start justify-between border border-transparent transition-all outline-none disabled:pointer-events-none disabled:opacity-50", $$props.class));
					component(node_1, () => Accordion_trigger$1, ($$anchor, AccordionPrimitive_Trigger) => {
						AccordionPrimitive_Trigger($$anchor, spread_props({
							"data-slot": "accordion-trigger",
							get class() {
								return get($0);
							}
						}, () => restProps, {
							get ref() {
								return ref();
							},
							set ref($$value) {
								ref($$value);
							},
							children: ($$anchor, $$slotProps) => {
								var fragment_2 = root_2$43();
								var node_2 = first_child(fragment_2);
								snippet(node_2, () => $$props.children ?? noop);
								var node_3 = sibling(node_2, 2);
								CaretDown(node_3, {
									"data-slot": "accordion-trigger-icon",
									class: "cn-accordion-trigger-icon pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden"
								});
								CaretUp(sibling(node_3, 2), {
									"data-slot": "accordion-trigger-icon",
									class: "cn-accordion-trigger-icon pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline"
								});
								append($$anchor, fragment_2);
							},
							$$slots: { default: true }
						}));
					});
				}
				append($$anchor, fragment_1);
			},
			$$slots: { default: true }
		});
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/components/changelog/ChangelogSection.svelte
var root_1$35 = from_html(`<div class="ml-4"><span class="flex items-center before:content-[''] before:inline-block before:w-2 before:h-2 before:rounded-full before:mr-1 before:bg-(--contributor-color) before:border-2 before:border-(--contributor-color) before:align-middle"></span></div>`);
var root$49 = from_html(`<div class="mx-6 mb-2"><h3 class="font-bold"> </h3> <!></div>`);
function ChangelogSection($$anchor, $$props) {
	push($$props, false);
	let title = prop($$props, "title", 8);
	let logs = prop($$props, "logs", 8);
	init();
	var div = root$49();
	var h3 = child(div);
	var text = child(h3, true);
	reset(h3);
	each(sibling(h3, 2), 1, logs, index, ($$anchor, log) => {
		var div_1 = root_1$35();
		let styles;
		var span = child(div_1);
		html(span, () => (get(log), untrack(() => get(log).html)), true);
		reset(span);
		reset(div_1);
		template_effect(() => styles = set_style(div_1, "", styles, { "--contributor-color": (get(log), untrack(() => get(log).color)) }));
		append($$anchor, div_1);
	});
	reset(div);
	template_effect(($0) => set_text(text, $0), [() => (deep_read_state(capitalizeText), deep_read_state(title()), untrack(() => capitalizeText(title())))]);
	append($$anchor, div);
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/components/changelog/ContributorList.svelte
var root_2$42 = from_html(`<a target="_blank" rel="noopener noreferrer" class="flex items-center before:content-[''] before:inline-block before:w-2 before:h-2 before:rounded-full before:mr-1 before:bg-(--contributor-color) before:border-2 before:border-(--contributor-color) before:align-middle"> </a>`);
var root_3$29 = from_html(`<span class="flex items-center before:content-[''] before:inline-block before:w-2 before:h-2 before:rounded-full before:mr-1 before:bg-(--contributor-color) before:border-2 before:border-(--contributor-color) before:align-middle"> </span>`);
var root_1$34 = from_html(`<div class="ml-4"><!></div>`);
var root$48 = from_html(`<div class="mx-6 mb-2"><h3 class="font-bold">Contributors</h3> <!></div>`);
function ContributorList($$anchor, $$props) {
	let contributors = prop($$props, "contributors", 8);
	var div = root$48();
	each(sibling(child(div), 2), 1, contributors, index, ($$anchor, contributor) => {
		var div_1 = root_1$34();
		let styles;
		var node_1 = child(div_1);
		var consequent = ($$anchor) => {
			var a = root_2$42();
			var text = child(a);
			reset(a);
			template_effect(() => {
				set_attribute(a, "href", (get(contributor), untrack(() => `https://www.torn.com/profiles.php?XID=${get(contributor).id}`)));
				set_text(text, `${(get(contributor), untrack(() => get(contributor).name)) ?? ""} [${(get(contributor), untrack(() => get(contributor).id)) ?? ""}]`);
			});
			append($$anchor, a);
		};
		var alternate = ($$anchor) => {
			var span = root_3$29();
			var text_1 = child(span, true);
			reset(span);
			template_effect(() => set_text(text_1, (get(contributor), untrack(() => get(contributor).name))));
			append($$anchor, span);
		};
		if_block(node_1, ($$render) => {
			if (get(contributor), untrack(() => get(contributor).id)) $$render(consequent);
			else $$render(alternate, -1);
		});
		reset(div_1);
		template_effect(() => styles = set_style(div_1, "", styles, { "--contributor-color": (get(contributor), untrack(() => get(contributor).color)) }));
		append($$anchor, div_1);
	});
	reset(div);
	append($$anchor, div);
}
//#endregion
//#region src/extension/entrypoints/options/components/changelog/Changelog.svelte
var root_4$19 = from_html(` <!>`, 1);
var root_7$18 = from_html(`<!> <!>`, 1);
var root_3$28 = from_html(`<!> <!>`, 1);
function Changelog($$anchor, $$props) {
	push($$props, false);
	const changelog = readableChangelog().map(toDisplayableChangelogEntry);
	onMount(() => {
		ttStorage.change({ version: { showNotice: false } });
	});
	init();
	Accordion($$anchor, {
		type: "multiple",
		class: "gap-2",
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = comment();
			each(first_child(fragment_1), 3, () => changelog, (entry) => entry.version, ($$anchor, entry, index) => {
				Accordion_item($$anchor, {
					get value() {
						return get(entry).version;
					},
					class: "border rounded-lg",
					children: ($$anchor, $$slotProps) => {
						var fragment_3 = root_3$28();
						var node_1 = first_child(fragment_3);
						{
							let $0 = derived_safe_equal(() => cn("px-2.5", get(index) === 0 ? "text-red-600" : ""));
							Accordion_trigger(node_1, {
								get class() {
									return get($0);
								},
								children: ($$anchor, $$slotProps) => {
									next();
									var fragment_4 = root_4$19();
									var text$32 = first_child(fragment_4);
									var node_2 = sibling(text$32);
									var consequent = ($$anchor) => {
										Badge($$anchor, {
											variant: "secondary",
											class: "ml-1",
											children: ($$anchor, $$slotProps) => {
												next();
												append($$anchor, text("BETA"));
											},
											$$slots: { default: true }
										});
									};
									if_block(node_2, ($$render) => {
										if (get(entry).beta) $$render(consequent);
									});
									template_effect(() => set_text(text$32, `${get(entry).title ?? ""} `));
									append($$anchor, fragment_4);
								},
								$$slots: { default: true }
							});
						}
						Accordion_content(sibling(node_1, 2), {
							children: ($$anchor, $$slotProps) => {
								var fragment_6 = root_7$18();
								var node_4 = first_child(fragment_6);
								ContributorList(node_4, { get contributors() {
									return get(entry).contributors;
								} });
								each(sibling(node_4, 2), 1, () => Object.entries(get(entry).logs), ([title, logs]) => title, ($$anchor, $$item) => {
									var $$array = user_derived(() => to_array(get($$item), 2));
									let title = () => get($$array)[0];
									let logs = () => get($$array)[1];
									ChangelogSection($$anchor, {
										get title() {
											return title();
										},
										get logs() {
											return logs();
										}
									});
								});
								append($$anchor, fragment_6);
							},
							$$slots: { default: true }
						});
						append($$anchor, fragment_3);
					},
					$$slots: { default: true }
				});
			});
			append($$anchor, fragment_1);
		},
		$$slots: { default: true }
	});
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/components/export/ExportDialog.svelte
var root_3$27 = from_html(`<!> <!>`, 1);
var root_6$18 = from_html(`<label class="flex items-start gap-2 rounded-lg border border-border p-2 text-sm"><!> <span><span class="block font-medium">Include API key</span></span></label>`);
var root_2$41 = from_html(`<!> <div class="space-y-3"><div class="rounded-lg border border-border bg-muted/30 p-3 text-sm"><h3 class="font-medium">Includes:</h3> <ul class="mt-2 list-disc space-y-0.5 pl-5 text-muted-foreground"><li>User ID and username</li> <li>Client version and database size</li> <li>Export date and time</li> <li>Version notice</li> <li>Preferences</li> <li>Filters and sorting</li> <li>Stakeouts, notes and quick items</li></ul></div> <!> <!></div> <!>`, 1);
function ExportDialog($$anchor, $$props) {
	push($$props, true);
	let dialogOpen = prop($$props, "dialogOpen", 15, false), includeApi = prop($$props, "includeApi", 15, false);
	var fragment = comment();
	component(first_child(fragment), () => Dialog, ($$anchor, Dialog_Dialog) => {
		Dialog_Dialog($$anchor, {
			get open() {
				return dialogOpen();
			},
			set open($$value) {
				dialogOpen($$value);
			},
			children: ($$anchor, $$slotProps) => {
				var fragment_1 = comment();
				component(first_child(fragment_1), () => Dialog_content, ($$anchor, Dialog_Content) => {
					Dialog_Content($$anchor, {
						class: "sm:max-w-md",
						children: ($$anchor, $$slotProps) => {
							var fragment_2 = root_2$41();
							var node_2 = first_child(fragment_2);
							component(node_2, () => Dialog_header, ($$anchor, Dialog_Header) => {
								Dialog_Header($$anchor, {
									children: ($$anchor, $$slotProps) => {
										var fragment_3 = root_3$27();
										var node_3 = first_child(fragment_3);
										component(node_3, () => Dialog_title, ($$anchor, Dialog_Title) => {
											Dialog_Title($$anchor, {
												children: ($$anchor, $$slotProps) => {
													next();
													append($$anchor, text("Export"));
												},
												$$slots: { default: true }
											});
										});
										component(sibling(node_3, 2), () => Dialog_description, ($$anchor, Dialog_Description) => {
											Dialog_Description($$anchor, {
												children: ($$anchor, $$slotProps) => {
													next();
													append($$anchor, text("Review what will be included before creating the export."));
												},
												$$slots: { default: true }
											});
										});
										append($$anchor, fragment_3);
									},
									$$slots: { default: true }
								});
							});
							var div = sibling(node_2, 2);
							var node_5 = sibling(child(div), 2);
							snippet(node_5, () => $$props.warning ?? noop);
							var node_6 = sibling(node_5, 2);
							var consequent = ($$anchor) => {
								var label = root_6$18();
								Checkbox(child(label), {
									id: "include-api",
									get checked() {
										return includeApi();
									},
									set checked($$value) {
										includeApi($$value);
									}
								});
								next(2);
								reset(label);
								append($$anchor, label);
							};
							if_block(node_6, ($$render) => {
								if ($$props.allowApi) $$render(consequent);
							});
							reset(div);
							component(sibling(div, 2), () => Dialog_footer, ($$anchor, Dialog_Footer) => {
								Dialog_Footer($$anchor, {
									children: ($$anchor, $$slotProps) => {
										Button($$anchor, {
											size: "sm",
											get onclick() {
												return $$props.onConfirm;
											},
											children: ($$anchor, $$slotProps) => {
												next();
												append($$anchor, text("Confirm"));
											},
											$$slots: { default: true }
										});
									},
									$$slots: { default: true }
								});
							});
							append($$anchor, fragment_2);
						},
						$$slots: { default: true }
					});
				});
				append($$anchor, fragment_1);
			},
			$$slots: { default: true }
		});
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/components/export/ImportDialog.svelte
var root_3$26 = from_html(`<!> <!>`, 1);
var root_5$22 = from_html(`<li>API Key (if present in the export)</li>`);
var root_2$40 = from_html(`<!> <div class="space-y-3"><!> <div class="rounded-lg border border-border bg-muted/30 p-3 text-sm"><h3 class="font-medium">Following items will be overwritten:</h3> <ul class="mt-2 list-disc space-y-0.5 pl-5 text-muted-foreground"><li>Version notice</li> <li>Preferences</li> <li>Filters and sorting</li> <li>Stakeouts</li> <li>Notes</li> <li>Quick Items, crimes and jail bust / bail</li> <!></ul></div></div> <!>`, 1);
function ImportDialog($$anchor, $$props) {
	push($$props, true);
	let dialogOpen = prop($$props, "dialogOpen", 15, false);
	var fragment = comment();
	component(first_child(fragment), () => Dialog, ($$anchor, Dialog_Dialog) => {
		Dialog_Dialog($$anchor, {
			get open() {
				return dialogOpen();
			},
			set open($$value) {
				dialogOpen($$value);
			},
			children: ($$anchor, $$slotProps) => {
				var fragment_1 = comment();
				component(first_child(fragment_1), () => Dialog_content, ($$anchor, Dialog_Content) => {
					Dialog_Content($$anchor, {
						class: "sm:max-w-md",
						children: ($$anchor, $$slotProps) => {
							var fragment_2 = root_2$40();
							var node_2 = first_child(fragment_2);
							component(node_2, () => Dialog_header, ($$anchor, Dialog_Header) => {
								Dialog_Header($$anchor, {
									children: ($$anchor, $$slotProps) => {
										var fragment_3 = root_3$26();
										var node_3 = first_child(fragment_3);
										component(node_3, () => Dialog_title, ($$anchor, Dialog_Title) => {
											Dialog_Title($$anchor, {
												children: ($$anchor, $$slotProps) => {
													next();
													append($$anchor, text("Import"));
												},
												$$slots: { default: true }
											});
										});
										component(sibling(node_3, 2), () => Dialog_description, ($$anchor, Dialog_Description) => {
											Dialog_Description($$anchor, {});
										});
										append($$anchor, fragment_3);
									},
									$$slots: { default: true }
								});
							});
							var div = sibling(node_2, 2);
							var node_5 = child(div);
							snippet(node_5, () => $$props.extraInput ?? noop);
							var div_1 = sibling(node_5, 2);
							var ul = sibling(child(div_1), 2);
							var node_6 = sibling(child(ul), 12);
							var consequent = ($$anchor) => {
								append($$anchor, root_5$22());
							};
							if_block(node_6, ($$render) => {
								if ($$props.allowApi) $$render(consequent);
							});
							reset(ul);
							reset(div_1);
							reset(div);
							component(sibling(div, 2), () => Dialog_footer, ($$anchor, Dialog_Footer) => {
								Dialog_Footer($$anchor, {
									children: ($$anchor, $$slotProps) => {
										Button($$anchor, {
											size: "sm",
											get onclick() {
												return $$props.onConfirm;
											},
											children: ($$anchor, $$slotProps) => {
												next();
												append($$anchor, text("Import"));
											},
											$$slots: { default: true }
										});
									},
									$$slots: { default: true }
								});
							});
							append($$anchor, fragment_2);
						},
						$$slots: { default: true }
					});
				});
				append($$anchor, fragment_1);
			},
			$$slots: { default: true }
		});
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/components/export/ExportMethod.svelte
var root$47 = from_html(`<article class="flex h-full flex-col rounded-lg border border-border p-2"><div class="flex flex-wrap items-center gap-2"><h3 class="text-sm font-bold"> </h3> <!></div> <p class="mt-1 text-sm text-muted-foreground"> </p> <!> <div class="mt-auto pt-2 flex flex-wrap gap-2"><!> <!> <!></div></article> <!> <!>`, 1);
function ExportMethod($$anchor, $$props) {
	push($$props, true);
	let recommended = prop($$props, "recommended", 3, false), busy = prop($$props, "busy", 15, false);
	let exportDialog = state(false);
	let importDialog = state(false);
	let includeApi = state(false);
	async function confirmExport() {
		busy(true);
		try {
			await $$props.onExport(get(includeApi));
			set(exportDialog, false);
		} finally {
			busy(false);
		}
	}
	async function confirmImport() {
		busy(true);
		try {
			await $$props.onImport();
			set(importDialog, false);
		} finally {
			busy(false);
		}
	}
	var fragment = root$47();
	var article = first_child(fragment);
	var div = child(article);
	var h3 = child(div);
	var text$29 = child(h3, true);
	reset(h3);
	var node = sibling(h3, 2);
	var consequent = ($$anchor) => {
		Badge($$anchor, {
			variant: "secondary",
			class: "border-amber-300 bg-amber-100 text-amber-900 dark:border-transparent dark:bg-amber-950 dark:text-amber-200",
			children: ($$anchor, $$slotProps) => {
				next();
				append($$anchor, text("Recommended"));
			},
			$$slots: { default: true }
		});
	};
	if_block(node, ($$render) => {
		if (recommended()) $$render(consequent);
	});
	reset(div);
	var p = sibling(div, 2);
	var text_2 = child(p, true);
	reset(p);
	var node_1 = sibling(p, 2);
	snippet(node_1, () => $$props.information ?? noop);
	var div_1 = sibling(node_1, 2);
	var node_2 = child(div_1);
	Button(node_2, {
		size: "sm",
		get disabled() {
			return busy();
		},
		onclick: () => set(exportDialog, true),
		children: ($$anchor, $$slotProps) => {
			next();
			append($$anchor, text("Export"));
		},
		$$slots: { default: true }
	});
	var node_3 = sibling(node_2, 2);
	{
		let $0 = user_derived(() => busy() || $$props.disableImport);
		Button(node_3, {
			size: "sm",
			variant: "outline",
			get disabled() {
				return get($0);
			},
			onclick: () => set(importDialog, true),
			children: ($$anchor, $$slotProps) => {
				next();
				append($$anchor, text("Import"));
			},
			$$slots: { default: true }
		});
	}
	snippet(sibling(node_3, 2), () => $$props.extraButtons ?? noop);
	reset(div_1);
	reset(article);
	var node_5 = sibling(article, 2);
	{
		const warning = ($$anchor) => {
			var fragment_2 = comment();
			snippet(first_child(fragment_2), () => $$props.exportWarning ?? noop);
			append($$anchor, fragment_2);
		};
		ExportDialog(node_5, {
			get allowApi() {
				return $$props.allowApi;
			},
			onConfirm: confirmExport,
			get dialogOpen() {
				return get(exportDialog);
			},
			set dialogOpen($$value) {
				set(exportDialog, $$value, true);
			},
			get includeApi() {
				return get(includeApi);
			},
			set includeApi($$value) {
				set(includeApi, $$value, true);
			},
			warning,
			$$slots: { warning: true }
		});
	}
	var node_7 = sibling(node_5, 2);
	{
		const extraInput = ($$anchor) => {
			var fragment_3 = comment();
			snippet(first_child(fragment_3), () => $$props.extraImportInput ?? noop);
			append($$anchor, fragment_3);
		};
		ImportDialog(node_7, {
			get allowApi() {
				return $$props.allowApi;
			},
			onConfirm: confirmImport,
			get dialogOpen() {
				return get(importDialog);
			},
			set dialogOpen($$value) {
				set(importDialog, $$value, true);
			},
			extraInput,
			$$slots: { extraInput: true }
		});
	}
	template_effect(() => {
		set_text(text$29, $$props.title);
		set_text(text_2, $$props.description);
	});
	append($$anchor, fragment);
	pop();
}
var LOCAL_EXPORT_KEYS = [
	"version",
	"settings",
	"filters",
	"stakeouts",
	"factionStakeouts",
	"notes",
	"quick",
	"migrations",
	"localdata"
];
function isExportData(value) {
	if (!value || typeof value !== "object") return false;
	const candidate = value;
	return !!candidate.client && typeof candidate.date === "string" && !!candidate.database && typeof candidate.database === "object";
}
async function getExportData(includeApi) {
	const exportedKeys = [...LOCAL_EXPORT_KEYS];
	if (includeApi) exportedKeys.unshift("api");
	const values = await ttStorage.get(exportedKeys);
	const database = {};
	values.filter((value) => !isNumber(value)).forEach((value, index) => {
		database[exportedKeys[index]] = value;
	});
	return {
		user: hasAPIData() ? {
			id: userdata.profile.id,
			name: userdata.profile.name
		} : false,
		client: {
			version: browser.runtime.getManifest().version,
			space: await ttStorage.getSize()
		},
		date: (/* @__PURE__ */ new Date()).toString(),
		database
	};
}
async function importExportData(data) {
	if (!isExportData(data)) throw new Error("Imported data is not a valid TornTools export.");
	await ttStorage.change(data.database);
	if ("api" in data.database && !!data.database.api) await BACKGROUND_SERVICE.initialize();
	await loadDatabaseStores();
}
function parseImportText(text) {
	if (text.length > 5242880) throw new Error("Maximum file size exceeded. (5MB)");
	try {
		return JSON.parse(text);
	} catch {
		throw new Error("Couldn't read the imported data.");
	}
}
//#endregion
//#region src/extension/entrypoints/options/components/export/local/ClipboardMethod.svelte
function ClipboardMethod($$anchor, $$props) {
	push($$props, true);
	let importText = state("");
	async function exportData(includeApi) {
		if (!toClipboard(JSON.stringify(await getExportData(includeApi)))) {
			toast.error("Failed to copy the export to your clipboard.");
			return;
		}
		toast.success("Copied database to your clipboard.");
	}
	async function importData() {
		await handleImportData(parseImportText(get(importText)));
	}
	async function handleImportData(data) {
		try {
			await importExportData(data);
			toast.success("Imported data.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Couldn't save the imported database.");
		}
	}
	{
		const extraImportInput = ($$anchor) => {
			Textarea($$anchor, {
				rows: 6,
				class: "text-xs",
				placeholder: "Paste your exported JSON here.",
				get value() {
					return get(importText);
				},
				set value($$value) {
					set(importText, $$value, true);
				}
			});
		};
		ExportMethod($$anchor, {
			title: "Clipboard",
			description: "Copy a compact version of the database, or paste one back in manually.",
			allowApi: true,
			onExport: exportData,
			onImport: importData,
			extraImportInput,
			$$slots: { extraImportInput: true }
		});
	}
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/components/export/local/FileMethod.svelte
var root$46 = from_html(`<input class="hidden" type="file" accept=".json,application/json"/> <!>`, 1);
function FileMethod($$anchor, $$props) {
	push($$props, false);
	let fileInput = mutable_source(null);
	async function exportData(includeApi) {
		const data = JSON.stringify(await getExportData(includeApi), null, 4);
		const url = window.URL.createObjectURL(new Blob([data], { type: "application/json" }));
		elementBuilder({
			type: "a",
			href: url,
			attributes: { download: "torntools.json" }
		}).click();
		window.URL.revokeObjectURL(url);
	}
	async function importData() {
		get(fileInput)?.click();
	}
	async function handleFileChange(event) {
		const input = event.currentTarget;
		const file = input.files?.[0];
		if (!file) return;
		try {
			await handleImportData(parseImportText(await file.text()));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Import failed.");
		} finally {
			input.value = "";
		}
	}
	async function handleImportData(data) {
		try {
			await importExportData(data);
			toast.success("Imported data.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Couldn't save the imported database.");
		}
	}
	init();
	var fragment = root$46();
	var input_1 = first_child(fragment);
	bind_this(input_1, ($$value) => set(fileInput, $$value), () => get(fileInput));
	ExportMethod(sibling(input_1, 2), {
		title: "File",
		recommended: true,
		description: "Download a formatted file or import one from disk.",
		allowApi: true,
		onExport: exportData,
		onImport: importData
	});
	delegated("change", input_1, handleFileChange);
	append($$anchor, fragment);
	pop();
}
delegate(["change"]);
//#endregion
//#region src/extension/entrypoints/options/components/export/remote/ClearBrowserSyncDialog.svelte
var root_3$25 = from_html(`<!> <!>`, 1);
var root_2$39 = from_html(`<!> <!>`, 1);
function ClearBrowserSyncDialog($$anchor, $$props) {
	push($$props, true);
	let dialogOpen = prop($$props, "dialogOpen", 15, false);
	async function confirm() {
		await $$props.onConfirm();
		dialogOpen(false);
	}
	var fragment = comment();
	component(first_child(fragment), () => Dialog, ($$anchor, Dialog_Dialog) => {
		Dialog_Dialog($$anchor, {
			get open() {
				return dialogOpen();
			},
			set open($$value) {
				dialogOpen($$value);
			},
			children: ($$anchor, $$slotProps) => {
				var fragment_1 = comment();
				component(first_child(fragment_1), () => Dialog_content, ($$anchor, Dialog_Content) => {
					Dialog_Content($$anchor, {
						class: "sm:max-w-md",
						children: ($$anchor, $$slotProps) => {
							var fragment_2 = root_2$39();
							var node_2 = first_child(fragment_2);
							component(node_2, () => Dialog_header, ($$anchor, Dialog_Header) => {
								Dialog_Header($$anchor, {
									children: ($$anchor, $$slotProps) => {
										var fragment_3 = root_3$25();
										var node_3 = first_child(fragment_3);
										component(node_3, () => Dialog_title, ($$anchor, Dialog_Title) => {
											Dialog_Title($$anchor, {
												children: ($$anchor, $$slotProps) => {
													next();
													append($$anchor, text("Clear"));
												},
												$$slots: { default: true }
											});
										});
										component(sibling(node_3, 2), () => Dialog_description, ($$anchor, Dialog_Description) => {
											Dialog_Description($$anchor, {
												children: ($$anchor, $$slotProps) => {
													next();
													append($$anchor, text("Are you sure you want to clear the remote storage?"));
												},
												$$slots: { default: true }
											});
										});
										append($$anchor, fragment_3);
									},
									$$slots: { default: true }
								});
							});
							component(sibling(node_2, 2), () => Dialog_footer, ($$anchor, Dialog_Footer) => {
								Dialog_Footer($$anchor, {
									children: ($$anchor, $$slotProps) => {
										Button($$anchor, {
											size: "sm",
											variant: "destructive",
											onclick: confirm,
											children: ($$anchor, $$slotProps) => {
												next();
												append($$anchor, text("Confirm"));
											},
											$$slots: { default: true }
										});
									},
									$$slots: { default: true }
								});
							});
							append($$anchor, fragment_2);
						},
						$$slots: { default: true }
					});
				});
				append($$anchor, fragment_1);
			},
			$$slots: { default: true }
		});
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/components/export/remote/RemoteSyncInformation.svelte
var root_1$33 = from_html(`<p class="text-muted-foreground flex items-center gap-1"><!> Loading sync status...</p>`);
var root_2$38 = from_html(`<p>Last update: <span class="font-medium"> </span></p> <p>Version: <span class="font-medium"> </span></p> <p>Database size: <span class="font-medium"> </span></p>`, 1);
var root_3$24 = from_html(`<p class="text-muted-foreground"> </p>`);
var root$45 = from_html(`<div class="mt-1 text-xs"><!></div>`);
function RemoteSyncInformation($$anchor, $$props) {
	push($$props, true);
	var div = root$45();
	var node = child(div);
	var consequent = ($$anchor) => {
		var p = root_1$33();
		Spinner(child(p), {});
		next();
		reset(p);
		append($$anchor, p);
	};
	var consequent_1 = ($$anchor) => {
		var fragment = root_2$38();
		var p_1 = first_child(fragment);
		var span = sibling(child(p_1));
		var text = child(span);
		reset(span);
		reset(p_1);
		var p_2 = sibling(p_1, 2);
		var span_1 = sibling(child(p_2));
		var text_1 = child(span_1, true);
		reset(span_1);
		reset(p_2);
		var p_3 = sibling(p_2, 2);
		var span_2 = sibling(child(p_3));
		var text_2 = child(span_2, true);
		reset(span_2);
		reset(p_3);
		template_effect(($0, $1, $2) => {
			set_text(text, `${$0 ?? ""} ${$1 ?? ""}`);
			set_text(text_1, $$props.information.data.client.version);
			set_text(text_2, $2);
		}, [
			() => formatTime($$props.information.data.date),
			() => formatDate($$props.information.data.date, { showYear: true }),
			() => formatBytes($$props.information.data.client.space)
		]);
		append($$anchor, fragment);
	};
	var consequent_2 = ($$anchor) => {
		var p_4 = root_3$24();
		var text_3 = child(p_4, true);
		reset(p_4);
		template_effect(() => set_text(text_3, $$props.information.message));
		append($$anchor, p_4);
	};
	if_block(node, ($$render) => {
		if ($$props.loading) $$render(consequent);
		else if ($$props.information.available) $$render(consequent_1, 1);
		else if ("message" in $$props.information) $$render(consequent_2, 2);
	});
	reset(div);
	append($$anchor, div);
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/components/export/remote/remote-export.ts
var REMOTE_SYNC_SOUND_CUSTOM_LIMIT = 64 * 1024;
var REMOTE_SYNC_ITEM_LIMIT = 10 * 1024;
var REMOTE_SYNC_SCHEMA_VERSION = 1;
var REMOTE_SYNC_META_KEY = "__tt_export_meta";
var REMOTE_SYNC_CHUNK_KEY_PREFIX = "__tt_export_chunk_";
function isRemoteSyncMeta(value) {
	if (!value || typeof value !== "object") return false;
	const candidate = value;
	return candidate.schemaVersion === REMOTE_SYNC_SCHEMA_VERSION && typeof candidate.chunkCount === "number";
}
function getSyncItemSize(key, value) {
	return key.length + JSON.stringify(value).length;
}
function getSyncTotalSize(items) {
	return Object.entries(items).reduce((total, [key, value]) => total + getSyncItemSize(key, value), 0);
}
function getByteLength(value) {
	return new TextEncoder().encode(value).length;
}
function getChunkKey(index) {
	return `${REMOTE_SYNC_CHUNK_KEY_PREFIX}${index}`;
}
function getMaxChunkLength(key, raw, start, perItemLimit) {
	let low = start + 1;
	let high = raw.length;
	let best = start;
	while (low <= high) {
		const middle = Math.floor((low + high) / 2);
		if (getSyncItemSize(key, raw.slice(start, middle)) <= perItemLimit) {
			best = middle;
			low = middle + 1;
		} else high = middle - 1;
	}
	return best;
}
function createChunkItems(raw, keyFactory) {
	const perItemLimit = Math.min(browser.storage.sync.QUOTA_BYTES_PER_ITEM ?? REMOTE_SYNC_ITEM_LIMIT, REMOTE_SYNC_ITEM_LIMIT);
	const chunkValues = [];
	let chunkStart = 0;
	while (chunkStart < raw.length) {
		const key = keyFactory(chunkValues.length);
		const chunkEnd = getMaxChunkLength(key, raw, chunkStart, perItemLimit);
		if (chunkEnd === chunkStart) throw new Error(`Sync item '${key}' cannot fit within the ${perItemLimit} byte storage.sync item limit.`);
		chunkValues.push(raw.slice(chunkStart, chunkEnd));
		chunkStart = chunkEnd;
	}
	return chunkValues;
}
function createRemoteSyncItems(data) {
	const totalLimit = browser.storage.sync.QUOTA_BYTES ?? 102400;
	const chunks = createChunkItems(JSON.stringify(data), getChunkKey);
	const items = { [REMOTE_SYNC_META_KEY]: {
		schemaVersion: REMOTE_SYNC_SCHEMA_VERSION,
		chunkCount: chunks.length
	} };
	chunks.forEach((chunk, index) => {
		items[getChunkKey(index)] = chunk;
	});
	const totalSize = getSyncTotalSize(items);
	if (totalSize > totalLimit) throw new Error(`Sync export is ${totalSize} bytes, exceeding the ${totalLimit} byte storage.sync limit.`);
	return items;
}
function parseChunkedRemoteSyncData(items) {
	const meta = items[REMOTE_SYNC_META_KEY];
	if (!isRemoteSyncMeta(meta)) return null;
	const chunks = [];
	for (let index = 0; index < meta.chunkCount; index += 1) {
		const chunk = items[getChunkKey(index)];
		if (typeof chunk !== "string") return null;
		chunks.push(chunk);
	}
	try {
		const parsed = JSON.parse(chunks.join(""));
		return isExportData(parsed) ? parsed : null;
	} catch {
		return null;
	}
}
async function getRemoteSyncExportPreview() {
	const data = await getExportData(false);
	const soundCustom = data.database.settings?.notifications?.soundCustom;
	let omittedSoundCustom = false;
	if (typeof soundCustom === "string" && soundCustom.length > 0 && getByteLength(soundCustom) > 65536) {
		if (data.database.settings?.notifications) delete data.database.settings.notifications.soundCustom;
		omittedSoundCustom = true;
	}
	return {
		data,
		omittedSoundCustom
	};
}
async function loadRemoteSyncData() {
	const data = await browser.storage.sync.get(null);
	const chunkedData = parseChunkedRemoteSyncData(data);
	if (chunkedData) return {
		available: true,
		data: chunkedData
	};
	if (Object.keys(data).length && "database" in data && isExportData(data)) return {
		available: true,
		data
	};
	return {
		available: false,
		message: "No exported data."
	};
}
async function saveRemoteSyncData() {
	const preview = await getRemoteSyncExportPreview();
	await browser.storage.sync.clear();
	await browser.storage.sync.set(createRemoteSyncItems(preview.data));
	return {
		available: true,
		data: preview.data
	};
}
async function clearRemoteSyncData() {
	await browser.storage.sync.clear();
}
//#endregion
//#region src/extension/entrypoints/options/components/export/remote/BrowserSyncMethod.svelte
var root_5$21 = from_html(`<div class="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"> </div>`);
var root$44 = from_html(`<!> <!>`, 1);
function BrowserSyncMethod($$anchor, $$props) {
	push($$props, true);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let busy = state(false);
	let clearDialogOpen = state(false);
	let soundCustomByteLength = user_derived(() => {
		const soundCustom = $settingsStore()?.notifications?.soundCustom;
		if (typeof soundCustom !== "string" || soundCustom.length === 0) return 0;
		return getByteLength(soundCustom);
	});
	let showExportWarning = user_derived(() => get(soundCustomByteLength) > REMOTE_SYNC_SOUND_CUSTOM_LIMIT);
	let remoteState = state(proxy({
		available: false,
		message: "Loading sync status..."
	}));
	let stateLoading = state(true);
	onMount(async () => {
		await refreshRemoteState();
	});
	async function refreshRemoteState() {
		set(stateLoading, true);
		try {
			set(remoteState, await loadRemoteSyncData(), true);
		} catch (error) {
			set(remoteState, {
				available: false,
				message: "Failed to load sync data."
			}, true);
			toast.error(error instanceof Error ? error.message : "Failed to load sync data.");
		} finally {
			set(stateLoading, false);
		}
	}
	function exportData() {
		saveRemoteSyncData().then((data) => {
			set(remoteState, data, true);
			toast.success("Successfully saved your data to your browser sync.");
		}).catch(() => toast.error("Failed to export browser sync data."));
	}
	function importData() {
		loadRemoteSyncData().then((state) => {
			if (!state.available) throw new Error("Expected remote sync data.");
			return importExportData(state.data);
		}).then(() => toast.success("Successfully loaded your data from your browser sync.")).catch(() => toast.error("Failed to import browser sync data."));
	}
	async function clearData() {
		set(busy, true);
		clearRemoteSyncData().then(() => toast.success("Cleared browser sync data.")).catch(() => toast.error("Failed to clear browser sync data.")).finally(() => {
			refreshRemoteState();
			set(busy, false);
		});
	}
	var fragment = root$44();
	var node = first_child(fragment);
	{
		const information = ($$anchor) => {
			RemoteSyncInformation($$anchor, {
				get information() {
					return get(remoteState);
				},
				get loading() {
					return get(stateLoading);
				}
			});
		};
		const extraButtons = ($$anchor) => {
			{
				let $0 = user_derived(() => get(busy) || !get(remoteState).available);
				Button($$anchor, {
					size: "sm",
					variant: "destructive",
					get disabled() {
						return get($0);
					},
					onclick: () => set(clearDialogOpen, true),
					children: ($$anchor, $$slotProps) => {
						next();
						append($$anchor, text("Clear"));
					},
					$$slots: { default: true }
				});
			}
		};
		const exportWarning = ($$anchor) => {
			var fragment_3 = comment();
			var node_1 = first_child(fragment_3);
			var consequent = ($$anchor) => {
				var div = root_5$21();
				var text_1 = child(div);
				reset(div);
				template_effect(($0) => set_text(text_1, `Your custom notification sound is larger than ${$0 ?? ""} and will not
				be included in the browser sync export.`), [() => formatBytes(REMOTE_SYNC_SOUND_CUSTOM_LIMIT)]);
				append($$anchor, div);
			};
			if_block(node_1, ($$render) => {
				if (get(showExportWarning)) $$render(consequent);
			});
			append($$anchor, fragment_3);
		};
		let $0 = user_derived(() => !get(remoteState).available);
		ExportMethod(node, {
			title: "Browser Sync",
			description: "Use your browsers synchronized extension storage. Make sure extensions are synced.",
			allowApi: false,
			onExport: exportData,
			get disableImport() {
				return get($0);
			},
			onImport: importData,
			get busy() {
				return get(busy);
			},
			set busy($$value) {
				set(busy, $$value, true);
			},
			information,
			extraButtons,
			exportWarning,
			$$slots: {
				information: true,
				extraButtons: true,
				exportWarning: true
			}
		});
	}
	ClearBrowserSyncDialog(sibling(node, 2), {
		onConfirm: clearData,
		get dialogOpen() {
			return get(clearDialogOpen);
		},
		set dialogOpen($$value) {
			set(clearDialogOpen, $$value, true);
		}
	});
	append($$anchor, fragment);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/options/components/export/Export.svelte
var root$43 = from_html(`<section class="space-y-4"><section class="rounded-lg border border-border bg-card py-2 px-3"><h2 class="text-lg font-bold">Locally</h2> <div class="mt-2 grid gap-2 sm:grid-cols-2"><!> <!></div></section> <section class="rounded-lg border border-border bg-card py-2 px-3"><h2 class="text-lg font-bold">Remote</h2> <div class="mt-2 grid gap-2 sm:grid-cols-2"><!></div></section></section>`);
function Export($$anchor) {
	var section = root$43();
	var section_1 = child(section);
	var div = sibling(child(section_1), 2);
	var node = child(div);
	ClipboardMethod(node, {});
	FileMethod(sibling(node, 2), {});
	reset(div);
	reset(section_1);
	var section_2 = sibling(section_1, 2);
	var div_1 = sibling(child(section_2), 2);
	BrowserSyncMethod(child(div_1), {});
	reset(div_1);
	reset(section_2);
	reset(section);
	append($$anchor, section);
}
//#endregion
//#region src/extension/entrypoints/options/components/GlobalLayout.svelte
var root_2$37 = from_html(`<li><a class="px-2 py-1 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"> </a></li>`);
var root_1$32 = from_html(`<div class="flex flex-col min-h-screen"><header class="px-5 py-2 flex items-center justify-center gap-5"><nav><ul class="flex gap-4"></ul></nav> <div class="w-px h-6 bg-gray-300 dark:bg-gray-600"></div> <nav><ul class="flex gap-4"><li><a href="/targets.html" target="_blank" rel="noopener noreferrer" class="px-2 py-1 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-800">Targets</a></li></ul></nav></header> <!> <main class="p-8 max-w-5xl mx-auto w-full"><!></main></div>`);
var root$42 = from_html(`<!> <!> <!>`, 1);
function GlobalLayout($$anchor, $$props) {
	push($$props, true);
	const navigation = [
		{
			name: "Changelog",
			path: "/changelog"
		},
		{
			name: "Preferences",
			path: "/preferences",
			activePath: /^\/preferences(?:\/.*)?$/
		},
		{
			name: "Export",
			path: "/export"
		},
		{
			name: "About",
			path: "/about"
		}
	];
	onMount(() => {
		registerExtensionContext();
		exposeDebugObjects(BACKGROUND_SERVICE);
		initializeDatabaseStore();
		const unsubscribeTheme = settingsStore.subscribe((settings) => {
			const pageTheme = settings?.themes?.pages;
			if (!pageTheme) return;
			setMode(pageTheme === "default" ? "system" : pageTheme);
		});
		return () => {
			unsubscribeTheme();
		};
	});
	var fragment = root$42();
	var node = first_child(fragment);
	Mode_watcher(node, { track: false });
	var node_1 = sibling(node, 2);
	Sonner_1(node_1, { richColors: true });
	component(sibling(node_1, 2), () => Tooltip_provider, ($$anchor, Tooltip_Provider) => {
		Tooltip_Provider($$anchor, {
			children: ($$anchor, $$slotProps) => {
				var div = root_1$32();
				var header = child(div);
				var nav = child(header);
				var ul = child(nav);
				each(ul, 21, () => navigation, (item) => item.path, ($$anchor, item) => {
					var li = root_2$37();
					var a = child(li);
					var text = child(a, true);
					reset(a);
					action(a, ($$node) => link?.($$node));
					action(a, ($$node, $$action_arg) => active?.($$node, $$action_arg), () => ({
						path: get(item).activePath ?? get(item).path,
						className: "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-900"
					}));
					reset(li);
					template_effect(() => {
						set_attribute(a, "href", get(item).path);
						set_text(text, get(item).name);
					});
					append($$anchor, li);
				});
				reset(ul);
				reset(nav);
				next(4);
				reset(header);
				var node_3 = sibling(header, 2);
				Separator(node_3, { class: "bg-gray-300 dark:bg-gray-600" });
				var main = sibling(node_3, 2);
				snippet(child(main), () => $$props.children);
				reset(main);
				reset(div);
				append($$anchor, div);
			},
			$$slots: { default: true }
		});
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/PreferenceSectionCard.svelte
var root_2$36 = from_html(`<div><!> <!></div> <!>`, 1);
var root_1$31 = from_html(`<!> <!>`, 1);
function PreferenceSectionCard($$anchor, $$props) {
	push($$props, true);
	var fragment = comment();
	var node = first_child(fragment);
	{
		let $0 = user_derived(() => cn("gap-1 rounded-lg", $$props.title || $$props.description ? "py-2" : "py-1"));
		component(node, () => Card, ($$anchor, Card_Root) => {
			Card_Root($$anchor, {
				get class() {
					return get($0);
				},
				children: ($$anchor, $$slotProps) => {
					var fragment_1 = root_1$31();
					var node_1 = first_child(fragment_1);
					component(node_1, () => Card_header, ($$anchor, Card_Header) => {
						Card_Header($$anchor, {
							class: "px-3 flex justify-between gap-3",
							children: ($$anchor, $$slotProps) => {
								var fragment_2 = root_2$36();
								var div = first_child(fragment_2);
								var node_2 = child(div);
								var consequent = ($$anchor) => {
									var fragment_3 = comment();
									component(first_child(fragment_3), () => Card_title, ($$anchor, Card_Title) => {
										Card_Title($$anchor, {
											children: ($$anchor, $$slotProps) => {
												next();
												var text$26 = text();
												template_effect(() => set_text(text$26, $$props.title));
												append($$anchor, text$26);
											},
											$$slots: { default: true }
										});
									});
									append($$anchor, fragment_3);
								};
								if_block(node_2, ($$render) => {
									if ($$props.title) $$render(consequent);
								});
								var node_4 = sibling(node_2, 2);
								var consequent_1 = ($$anchor) => {
									var fragment_5 = comment();
									component(first_child(fragment_5), () => Card_description, ($$anchor, Card_Description) => {
										Card_Description($$anchor, {
											class: "text-xs",
											children: ($$anchor, $$slotProps) => {
												next();
												var text_1 = text();
												template_effect(() => set_text(text_1, $$props.description));
												append($$anchor, text_1);
											},
											$$slots: { default: true }
										});
									});
									append($$anchor, fragment_5);
								};
								if_block(node_4, ($$render) => {
									if ($$props.description) $$render(consequent_1);
								});
								reset(div);
								snippet(sibling(div, 2), () => $$props.action ?? noop);
								append($$anchor, fragment_2);
							},
							$$slots: { default: true }
						});
					});
					component(sibling(node_1, 2), () => Card_content, ($$anchor, Card_Content) => {
						Card_Content($$anchor, {
							class: "px-2",
							children: ($$anchor, $$slotProps) => {
								var fragment_7 = comment();
								snippet(first_child(fragment_7), () => $$props.children);
								append($$anchor, fragment_7);
							},
							$$slots: { default: true }
						});
					});
					append($$anchor, fragment_1);
				},
				$$slots: { default: true }
			});
		});
	}
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/field/field.svelte
var fieldVariants = tv({
	base: "data-[invalid=true]:text-destructive gap-2 group/field flex w-full",
	variants: { orientation: {
		vertical: "cn-field-orientation-vertical flex-col [&>*]:w-full [&>.sr-only]:w-auto",
		horizontal: "cn-field-orientation-horizontal flex-row items-center has-[>[data-slot=field-content]]:items-start [&>[data-slot=field-label]]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
		responsive: "cn-field-orientation-responsive flex-col @md/field-group:flex-row @md/field-group:items-center @md/field-group:has-[>[data-slot=field-content]]:items-start [&>*]:w-full @md/field-group:[&>*]:w-auto [&>.sr-only]:w-auto @md/field-group:[&>[data-slot=field-label]]:flex-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px"
	} },
	defaultVariants: { orientation: "vertical" }
});
var root$41 = from_html(`<div><!></div>`);
function Field($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), orientation = prop($$props, "orientation", 3, "vertical"), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"orientation",
		"children"
	]);
	var div = root$41();
	attribute_effect(div, ($0) => ({
		role: "group",
		"data-slot": "field",
		"data-orientation": orientation(),
		class: $0,
		...restProps
	}), [() => cn(fieldVariants({ orientation: orientation() }), $$props.class)]);
	snippet(child(div), () => $$props.children ?? noop);
	reset(div);
	bind_this(div, ($$value) => ref($$value), () => ref());
	append($$anchor, div);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/field/field-content.svelte
var root$40 = from_html(`<div><!></div>`);
function Field_content($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"children"
	]);
	var div = root$40();
	attribute_effect(div, ($0) => ({
		"data-slot": "field-content",
		class: $0,
		...restProps
	}), [() => cn("gap-0.5 group/field-content flex flex-1 flex-col leading-snug", $$props.class)]);
	snippet(child(div), () => $$props.children ?? noop);
	reset(div);
	bind_this(div, ($$value) => ref($$value), () => ref());
	append($$anchor, div);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/field/field-description.svelte
var root$39 = from_html(`<p><!></p>`);
function Field_description($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"children"
	]);
	var p = root$39();
	attribute_effect(p, ($0) => ({
		"data-slot": "field-description",
		class: $0,
		...restProps
	}), [() => cn("text-muted-foreground text-left text-sm [[data-variant=legend]+&]:-mt-1.5 leading-normal font-normal group-has-[[data-orientation=horizontal]]/field:text-balance", "last:mt-0 nth-last-2:-mt-1", "[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4", $$props.class)]);
	snippet(child(p), () => $$props.children ?? noop);
	reset(p);
	bind_this(p, ($$value) => ref($$value), () => ref());
	append($$anchor, p);
	pop();
}
from_html(`<li> </li>`);
from_html(`<ul class="ml-4 flex list-disc flex-col gap-1"></ul>`);
from_html(`<div><!></div>`);
from_html(`<div><!></div>`);
//#endregion
//#region src/extension/svelte/components/ui/label/label.svelte
function Label($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class"
	]);
	var fragment = comment();
	var node = first_child(fragment);
	{
		let $0 = user_derived(() => cn("gap-2 text-sm leading-none font-medium group-data-[disabled=true]:opacity-50 peer-disabled:opacity-50 flex items-center select-none group-data-[disabled=true]:pointer-events-none peer-disabled:cursor-not-allowed", $$props.class));
		component(node, () => Label$1, ($$anchor, LabelPrimitive_Root) => {
			LabelPrimitive_Root($$anchor, spread_props({
				"data-slot": "label",
				get class() {
					return get($0);
				}
			}, () => restProps, {
				get ref() {
					return ref();
				},
				set ref($$value) {
					ref($$value);
				}
			}));
		});
	}
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/field/field-label.svelte
function Field_label($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"children"
	]);
	{
		let $0 = user_derived(() => cn("has-data-checked:bg-primary/5 has-data-checked:border-primary/30 dark:has-data-checked:border-primary/20 dark:has-data-checked:bg-primary/10 gap-2 leading-snug group-data-[disabled=true]/field:opacity-50 has-[>[data-slot=field]]:rounded-lg has-[>[data-slot=field]]:border *:data-[slot=field]:p-2.5 group/field-label peer/field-label flex w-fit leading-snug", "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col", $$props.class));
		Label($$anchor, spread_props({
			"data-slot": "field-label",
			get class() {
				return get($0);
			}
		}, () => restProps, {
			get ref() {
				return ref();
			},
			set ref($$value) {
				ref($$value);
			},
			children: ($$anchor, $$slotProps) => {
				var fragment_1 = comment();
				snippet(first_child(fragment_1), () => $$props.children ?? noop);
				append($$anchor, fragment_1);
			},
			$$slots: { default: true }
		}));
	}
	pop();
}
from_html(`<legend><!></legend>`);
from_html(`<span class="text-muted-foreground px-2 bg-background relative mx-auto block w-fit" data-slot="field-separator-content"><!></span>`);
from_html(`<div><!> <!></div>`);
from_html(`<fieldset><!></fieldset>`);
from_html(`<div><!></div>`);
//#endregion
//#region node_modules/phosphor-svelte/lib/ArrowSquareOutIcon.svelte
var root_2$35 = from_svg(`<path d="M228,104a12,12,0,0,1-24,0V69l-59.51,59.51a12,12,0,0,1-17-17L187,52H152a12,12,0,0,1,0-24h64a12,12,0,0,1,12,12Zm-44,24a12,12,0,0,0-12,12v64H52V84h64a12,12,0,0,0,0-24H48A20,20,0,0,0,28,80V208a20,20,0,0,0,20,20H176a20,20,0,0,0,20-20V140A12,12,0,0,0,184,128Z"></path>`);
var root_3$23 = from_svg(`<path d="M184,80V208a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V80a8,8,0,0,1,8-8H176A8,8,0,0,1,184,80Z" opacity="0.2"></path><path d="M224,104a8,8,0,0,1-16,0V59.32l-66.33,66.34a8,8,0,0,1-11.32-11.32L196.68,48H152a8,8,0,0,1,0-16h64a8,8,0,0,1,8,8Zm-40,24a8,8,0,0,0-8,8v72H48V80h72a8,8,0,0,0,0-16H48A16,16,0,0,0,32,80V208a16,16,0,0,0,16,16H176a16,16,0,0,0,16-16V136A8,8,0,0,0,184,128Z"></path>`, 1);
var root_4$17 = from_svg(`<path d="M192,136v72a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V80A16,16,0,0,1,48,64h72a8,8,0,0,1,0,16H48V208H176V136a8,8,0,0,1,16,0Zm32-96a8,8,0,0,0-8-8H152a8,8,0,0,0-5.66,13.66L172.69,72l-42.35,42.34a8,8,0,0,0,11.32,11.32L184,83.31l26.34,26.35A8,8,0,0,0,224,104Z"></path>`);
var root_5$20 = from_svg(`<path d="M222,104a6,6,0,0,1-12,0V54.49l-69.75,69.75a6,6,0,0,1-8.48-8.48L201.51,46H152a6,6,0,0,1,0-12h64a6,6,0,0,1,6,6Zm-38,26a6,6,0,0,0-6,6v72a2,2,0,0,1-2,2H48a2,2,0,0,1-2-2V80a2,2,0,0,1,2-2h72a6,6,0,0,0,0-12H48A14,14,0,0,0,34,80V208a14,14,0,0,0,14,14H176a14,14,0,0,0,14-14V136A6,6,0,0,0,184,130Z"></path>`);
var root_6$16 = from_svg(`<path d="M224,104a8,8,0,0,1-16,0V59.32l-66.33,66.34a8,8,0,0,1-11.32-11.32L196.68,48H152a8,8,0,0,1,0-16h64a8,8,0,0,1,8,8Zm-40,24a8,8,0,0,0-8,8v72H48V80h72a8,8,0,0,0,0-16H48A16,16,0,0,0,32,80V208a16,16,0,0,0,16,16H176a16,16,0,0,0,16-16V136A8,8,0,0,0,184,128Z"></path>`);
var root_7$17 = from_svg(`<path d="M220,104a4,4,0,0,1-8,0V49.66l-73.16,73.17a4,4,0,0,1-5.66-5.66L206.34,44H152a4,4,0,0,1,0-8h64a4,4,0,0,1,4,4Zm-36,28a4,4,0,0,0-4,4v72a4,4,0,0,1-4,4H48a4,4,0,0,1-4-4V80a4,4,0,0,1,4-4h72a4,4,0,0,0,0-8H48A12,12,0,0,0,36,80V208a12,12,0,0,0,12,12H176a12,12,0,0,0,12-12V136A4,4,0,0,0,184,132Z"></path>`);
var root$33 = from_svg(`<svg><!><rect width="256" height="256" fill="none"></rect><!></svg>`);
function ArrowSquareOutIcon($$anchor, $$props) {
	push($$props, true);
	const ctx = getIconContext();
	let props = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"children"
	]);
	let weight = user_derived(() => $$props.weight ?? ctx.weight ?? "regular");
	let color = user_derived(() => $$props.color ?? ctx.color ?? "currentColor");
	let size = user_derived(() => $$props.size ?? ctx.size ?? "1em");
	let mirrored = user_derived(() => $$props.mirrored ?? ctx.mirrored ?? false);
	function svgAttr(obj) {
		let { weight, color, size, mirrored, ...attrs } = obj;
		return attrs;
	}
	var svg = root$33();
	attribute_effect(svg, ($0, $1) => ({
		xmlns: "http://www.w3.org/2000/svg",
		role: "img",
		width: get(size),
		height: get(size),
		fill: get(color),
		transform: get(mirrored) ? "scale(-1, 1)" : void 0,
		viewBox: "0 0 256 256",
		...$0,
		...$1
	}), [() => svgAttr(ctx), () => svgAttr(props)]);
	var node = child(svg);
	var consequent = ($$anchor) => {
		var fragment = comment();
		snippet(first_child(fragment), () => $$props.children);
		append($$anchor, fragment);
	};
	if_block(node, ($$render) => {
		if ($$props.children) $$render(consequent);
	});
	var node_2 = sibling(node, 2);
	var consequent_1 = ($$anchor) => {
		append($$anchor, root_2$35());
	};
	var consequent_2 = ($$anchor) => {
		var fragment_1 = root_3$23();
		next();
		append($$anchor, fragment_1);
	};
	var consequent_3 = ($$anchor) => {
		append($$anchor, root_4$17());
	};
	var consequent_4 = ($$anchor) => {
		append($$anchor, root_5$20());
	};
	var consequent_5 = ($$anchor) => {
		append($$anchor, root_6$16());
	};
	var consequent_6 = ($$anchor) => {
		append($$anchor, root_7$17());
	};
	var alternate = ($$anchor) => {
		var text$24 = text();
		text$24.nodeValue = (console.error("Unsupported icon weight. Choose from \"thin\", \"light\", \"regular\", \"bold\", \"fill\", or \"duotone\"."), "");
		append($$anchor, text$24);
	};
	if_block(node_2, ($$render) => {
		if (get(weight) === "bold") $$render(consequent_1);
		else if (get(weight) === "duotone") $$render(consequent_2, 1);
		else if (get(weight) === "fill") $$render(consequent_3, 2);
		else if (get(weight) === "light") $$render(consequent_4, 3);
		else if (get(weight) === "regular") $$render(consequent_5, 4);
		else if (get(weight) === "thin") $$render(consequent_6, 5);
		else $$render(alternate, -1);
	});
	reset(svg);
	append($$anchor, svg);
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/preference-storage.ts
function getPreferenceValue(source, path) {
	return path.split(".").reduce((value, key) => {
		if (!value || typeof value !== "object") return;
		return value[key];
	}, source);
}
async function updatePreferenceValue(path, value) {
	const [rootKey, ...pathSegments] = path.split(".");
	const patch = buildPatch(pathSegments, value);
	await ttStorage.change({ [rootKey]: patch });
}
function buildPatch(pathSegments, value) {
	const [key, ...remainingSegments] = pathSegments;
	if (!key) return value;
	return { [key]: buildPatch(remainingSegments, value) };
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/StorageText.svelte
var root_2$34 = from_html(`<!> <!>`, 1);
var root_1$28 = from_html(`<!> <!>`, 1);
function StorageText($$anchor, $$props) {
	push($$props, true);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const $apiStore = () => store_get(apiStore, "$apiStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let id = prop($$props, "id", 19, () => $$props.path.replaceAll(".", "-"));
	const storageSource = user_derived(() => ({
		settings: $settingsStore(),
		api: $apiStore()
	}));
	const value = user_derived(() => String(getPreferenceValue(get(storageSource), $$props.path) ?? ""));
	function updateValue(input) {
		updatePreferenceValue($$props.path, input);
	}
	var fragment = comment();
	component(first_child(fragment), () => Field, ($$anchor, Field_Field) => {
		Field_Field($$anchor, {
			orientation: "responsive",
			class: "rounded-md border border-border bg-background/60 p-2",
			children: ($$anchor, $$slotProps) => {
				var fragment_1 = root_1$28();
				var node_1 = first_child(fragment_1);
				component(node_1, () => Field_content, ($$anchor, Field_Content) => {
					Field_Content($$anchor, {
						children: ($$anchor, $$slotProps) => {
							var fragment_2 = root_2$34();
							var node_2 = first_child(fragment_2);
							component(node_2, () => Field_label, ($$anchor, Field_Label) => {
								Field_Label($$anchor, {
									get for() {
										return id();
									},
									children: ($$anchor, $$slotProps) => {
										next();
										var text$23 = text();
										template_effect(() => set_text(text$23, $$props.label));
										append($$anchor, text$23);
									},
									$$slots: { default: true }
								});
							});
							var node_3 = sibling(node_2, 2);
							var consequent = ($$anchor) => {
								var fragment_4 = comment();
								component(first_child(fragment_4), () => Field_description, ($$anchor, Field_Description) => {
									Field_Description($$anchor, {
										class: "text-xs",
										children: ($$anchor, $$slotProps) => {
											next();
											var text_1 = text();
											template_effect(() => set_text(text_1, $$props.description));
											append($$anchor, text_1);
										},
										$$slots: { default: true }
									});
								});
								append($$anchor, fragment_4);
							};
							if_block(node_3, ($$render) => {
								if ($$props.description) $$render(consequent);
							});
							append($$anchor, fragment_2);
						},
						$$slots: { default: true }
					});
				});
				Input(sibling(node_1, 2), {
					get id() {
						return id();
					},
					type: "text",
					get value() {
						return get(value);
					},
					oninput: (event) => updateValue(event.currentTarget.value)
				});
				append($$anchor, fragment_1);
			},
			$$slots: { default: true }
		});
	});
	append($$anchor, fragment);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/connections/ExternalServiceCard.svelte
var root_3$22 = from_html(`<a target="_blank" rel="noreferrer" class="flex items-center gap-1 text-xs text-primary hover:underline"> <!></a>`);
var root_2$33 = from_html(`<div class="flex flex-wrap gap-x-2 gap-y-1 px-1"></div>`);
var root_4$16 = from_html(`<!> <!>`, 1);
var root_1$27 = from_html(`<div class="grid gap-1"><!> <div class="rounded-md border border-border bg-background/60"><!></div> <!></div>`);
function ExternalServiceCard($$anchor, $$props) {
	push($$props, true);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const $apiStore = () => store_get(apiStore, "$apiStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let links = prop($$props, "links", 19, () => []), keyDescription = prop($$props, "keyDescription", 3, "Only required if you use a different key for this service. Will use known key otherwise.");
	let requestingPermission = state(false);
	const storageSource = user_derived(() => ({
		settings: $settingsStore(),
		api: $apiStore()
	}));
	const enabled = user_derived(() => Boolean(getPreferenceValue(get(storageSource), $$props.path)));
	async function updateEnabled(value) {
		if (get(requestingPermission)) return;
		if (!value) {
			await updatePreferenceValue($$props.path, false);
			return;
		}
		if (!browser.permissions) {
			toast.error("There was an issue when requesting additional permissions.");
			return;
		}
		set(requestingPermission, true);
		try {
			if (!await browser.permissions.request({ origins: [$$props.origin] })) {
				toast.error(`Can't enable ${$$props.title} without accepting the permission.`);
				return;
			}
			await updatePreferenceValue($$props.path, true);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to request permission.");
		} finally {
			set(requestingPermission, false);
		}
	}
	PreferenceSectionCard($$anchor, {
		get title() {
			return $$props.title;
		},
		get description() {
			return $$props.description;
		},
		children: ($$anchor, $$slotProps) => {
			var div = root_1$27();
			var node = child(div);
			var consequent = ($$anchor) => {
				var div_1 = root_2$33();
				each(div_1, 21, links, (link) => `${link.label}-${link.href}`, ($$anchor, link) => {
					var a = root_3$22();
					var text = child(a);
					ArrowSquareOutIcon(sibling(text), { "aria-hidden": "true" });
					reset(a);
					template_effect(() => {
						set_attribute(a, "href", get(link).href);
						set_text(text, `${get(link).label ?? ""} `);
					});
					append($$anchor, a);
				});
				reset(div_1);
				append($$anchor, div_1);
			};
			if_block(node, ($$render) => {
				if (links().length) $$render(consequent);
			});
			var div_2 = sibling(node, 2);
			component(child(div_2), () => Field, ($$anchor, Field_Field) => {
				Field_Field($$anchor, {
					orientation: "horizontal",
					class: "p-2",
					children: ($$anchor, $$slotProps) => {
						var fragment_1 = root_4$16();
						var node_3 = first_child(fragment_1);
						component(node_3, () => Field_content, ($$anchor, Field_Content) => {
							Field_Content($$anchor, {
								children: ($$anchor, $$slotProps) => {
									var fragment_2 = comment();
									var node_4 = first_child(fragment_2);
									{
										let $0 = user_derived(() => $$props.path.replaceAll(".", "-"));
										component(node_4, () => Field_label, ($$anchor, Field_Label) => {
											Field_Label($$anchor, {
												get for() {
													return get($0);
												},
												class: "w-full",
												children: ($$anchor, $$slotProps) => {
													next();
													var text_1 = text();
													template_effect(() => set_text(text_1, $$props.enableLabel));
													append($$anchor, text_1);
												},
												$$slots: { default: true }
											});
										});
									}
									append($$anchor, fragment_2);
								},
								$$slots: { default: true }
							});
						});
						var node_5 = sibling(node_3, 2);
						{
							let $0 = user_derived(() => $$props.path.replaceAll(".", "-"));
							Switch(node_5, {
								get id() {
									return get($0);
								},
								size: "sm",
								get checked() {
									return get(enabled);
								},
								get disabled() {
									return get(requestingPermission);
								},
								onCheckedChange: (value) => void updateEnabled(value)
							});
						}
						append($$anchor, fragment_1);
					},
					$$slots: { default: true }
				});
			});
			reset(div_2);
			var node_6 = sibling(div_2, 2);
			var consequent_1 = ($$anchor) => {
				StorageText($$anchor, {
					get path() {
						return $$props.keyPath;
					},
					label: "Alternative API key",
					get description() {
						return keyDescription();
					}
				});
			};
			if_block(node_6, ($$render) => {
				if ($$props.keyPath) $$render(consequent_1);
			});
			reset(div);
			append($$anchor, div);
		},
		$$slots: { default: true }
	});
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/connections/ConnectionsGroup.svelte
var root$32 = from_html(`<div class="space-y-2"><!> <!> <!> <!> <!> <!> <!> <!></div>`);
function ConnectionsGroup($$anchor, $$props) {
	push($$props, false);
	init();
	var div = root$32();
	var node = child(div);
	PreferenceSectionCard(node, {
		children: ($$anchor, $$slotProps) => {
			next();
			append($$anchor, text("By enabling these services, you agree to the usage of these services as they are provided."));
		},
		$$slots: { default: true }
	});
	var node_1 = sibling(node, 2);
	ExternalServiceCard(node_1, {
		title: "TornStats",
		description: "Your API key is used to authenticate.",
		path: "settings.external.tornstats",
		enableLabel: "Enable TornStats",
		get origin() {
			return FETCH_PLATFORMS.tornstats;
		},
		links: [{
			label: "Website",
			href: "https://tornstats.com/"
		}, {
			label: "Terms of Service",
			href: "https://tornstats.com/tos"
		}],
		keyPath: "api.tornstats.key",
		keyDescription: "Only required if you use a different key for TornStats. Will use known key otherwise."
	});
	var node_2 = sibling(node_1, 2);
	ExternalServiceCard(node_2, {
		title: "YATA",
		description: "Your API key is used to authenticate.",
		path: "settings.external.yata",
		enableLabel: "Enable YATA",
		get origin() {
			return FETCH_PLATFORMS.yata;
		},
		links: [{
			label: "Website",
			href: "https://yata.yt/"
		}, {
			label: "Terms of Service",
			href: "https://yata.yt/tos"
		}],
		keyPath: "api.yata.key",
		keyDescription: "Only required if you use a different key for YATA. Will use known key otherwise."
	});
	var node_3 = sibling(node_2, 2);
	ExternalServiceCard(node_3, {
		title: "Prometheus",
		description: "Your API key is not shared with this service.",
		path: "settings.external.prometheus",
		enableLabel: "Enable Prometheus",
		get origin() {
			return FETCH_PLATFORMS.prometheus;
		}
	});
	var node_4 = sibling(node_3, 2);
	ExternalServiceCard(node_4, {
		title: "LZPT",
		description: "Your API key is not shared with this service.",
		path: "settings.external.lzpt",
		enableLabel: "Enable LZPT",
		get origin() {
			return FETCH_PLATFORMS.lzpt;
		}
	});
	var node_5 = sibling(node_4, 2);
	ExternalServiceCard(node_5, {
		title: "TornW3B",
		description: "Your API key is not used to authenticate at this time, but it will be in the future as additional functionality is added.",
		path: "settings.external.tornw3b",
		enableLabel: "Enable TornW3B",
		get origin() {
			return FETCH_PLATFORMS.tornw3b;
		},
		links: [{
			label: "Website",
			href: "https://weav3r.dev"
		}, {
			label: "Terms of Service",
			href: "https://weav3r.dev/terms-of-service"
		}]
	});
	var node_6 = sibling(node_5, 2);
	ExternalServiceCard(node_6, {
		title: "FFScouter",
		description: "Your API key is used to authenticate.",
		path: "settings.external.ffScouter",
		enableLabel: "Enable FFScouter",
		get origin() {
			return FETCH_PLATFORMS.ffscouter;
		},
		links: [{
			label: "Website",
			href: "https://ffscouter.com"
		}, {
			label: "Terms of Service",
			href: "https://ffscouter.com"
		}],
		keyPath: "api.ffScouter.key",
		keyDescription: "Only required if you use a different key for FFScouter. Will use known key otherwise."
	});
	ExternalServiceCard(sibling(node_6, 2), {
		title: "Torn Intel",
		description: "Your API key is not shared with this service.",
		path: "settings.external.tornintel",
		enableLabel: "Enable Torn Intel",
		get origin() {
			return FETCH_PLATFORMS.tornintel;
		},
		links: [{
			label: "Website",
			href: "https://torn-intel.com"
		}, {
			label: "Terms of Service",
			href: "https://torn-intel.com/terms"
		}]
	});
	reset(div);
	append($$anchor, div);
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/SectionNotFound.svelte
var root$31 = from_html(`<section class="rounded-lg border border-border bg-card px-3 py-2"><h2 class="text-lg font-bold">Not Found - Section</h2> <p class="mt-1 text-sm text-muted-foreground">Couldn't find your requested preferences section in this group.</p></section>`);
function SectionNotFound($$anchor) {
	append($$anchor, root$31());
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/PreferenceSettingGroup.svelte
var root_1$26 = from_html(`<h3> </h3>`);
var root_2$32 = from_html(`<p class="text-xs text-muted-foreground"> </p>`);
var root$30 = from_html(`<div class="rounded-md border border-border bg-background/60 p-2"><div class="mb-1"><!> <!></div> <div><!></div></div>`);
function PreferenceSettingGroup($$anchor, $$props) {
	let contentClass = prop($$props, "contentClass", 3, "grid gap-1 md:grid-cols-2");
	var div = root$30();
	var div_1 = child(div);
	var node = child(div_1);
	var consequent = ($$anchor) => {
		var h3 = root_1$26();
		var text = child(h3, true);
		reset(h3);
		template_effect(() => set_text(text, $$props.title));
		append($$anchor, h3);
	};
	if_block(node, ($$render) => {
		if ($$props.title) $$render(consequent);
	});
	var node_1 = sibling(node, 2);
	var consequent_1 = ($$anchor) => {
		var p = root_2$32();
		var text_1 = child(p, true);
		reset(p);
		template_effect(() => set_text(text_1, $$props.description));
		append($$anchor, p);
	};
	if_block(node_1, ($$render) => {
		if ($$props.description) $$render(consequent_1);
	});
	reset(div_1);
	var div_2 = sibling(div_1, 2);
	snippet(child(div_2), () => $$props.children);
	reset(div_2);
	reset(div);
	template_effect(() => set_class(div_2, 1, clsx(contentClass())));
	append($$anchor, div);
}
//#endregion
//#region src/extension/svelte/components/ui/select/select.svelte
function Select($$anchor, $$props) {
	push($$props, true);
	let open = prop($$props, "open", 15, false), value = prop($$props, "value", 15), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"open",
		"value"
	]);
	var fragment = comment();
	component(first_child(fragment), () => Select$1, ($$anchor, SelectPrimitive_Root) => {
		SelectPrimitive_Root($$anchor, spread_props(() => restProps, {
			get open() {
				return open();
			},
			set open($$value) {
				open($$value);
			},
			get value() {
				return value();
			},
			set value($$value) {
				value($$value);
			}
		}));
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/select/select-portal.svelte
function Select_portal($$anchor, $$props) {
	let restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy"
	]);
	var fragment = comment();
	component(first_child(fragment), () => Portal, ($$anchor, SelectPrimitive_Portal) => {
		SelectPrimitive_Portal($$anchor, spread_props(() => restProps));
	});
	append($$anchor, fragment);
}
//#endregion
//#region src/extension/svelte/components/ui/select/select-scroll-down-button.svelte
function Select_scroll_down_button($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class"
	]);
	var fragment = comment();
	var node = first_child(fragment);
	{
		let $0 = user_derived(() => cn("bg-popover z-10 flex cursor-default items-center justify-center py-1 [&_svg:not([class*='size-'])]:size-4 bottom-0 w-full", $$props.class));
		component(node, () => Select_scroll_down_button$1, ($$anchor, SelectPrimitive_ScrollDownButton) => {
			SelectPrimitive_ScrollDownButton($$anchor, spread_props({
				"data-slot": "select-scroll-down-button",
				get class() {
					return get($0);
				}
			}, () => restProps, {
				get ref() {
					return ref();
				},
				set ref($$value) {
					ref($$value);
				},
				children: ($$anchor, $$slotProps) => {
					CaretDown($$anchor, {});
				},
				$$slots: { default: true }
			}));
		});
	}
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/select/select-scroll-up-button.svelte
function Select_scroll_up_button($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class"
	]);
	var fragment = comment();
	var node = first_child(fragment);
	{
		let $0 = user_derived(() => cn("bg-popover z-10 flex cursor-default items-center justify-center py-1 [&_svg:not([class*='size-'])]:size-4 top-0 w-full", $$props.class));
		component(node, () => Select_scroll_up_button$1, ($$anchor, SelectPrimitive_ScrollUpButton) => {
			SelectPrimitive_ScrollUpButton($$anchor, spread_props({
				"data-slot": "select-scroll-up-button",
				get class() {
					return get($0);
				}
			}, () => restProps, {
				get ref() {
					return ref();
				},
				set ref($$value) {
					ref($$value);
				},
				children: ($$anchor, $$slotProps) => {
					CaretUp($$anchor, {});
				},
				$$slots: { default: true }
			}));
		});
	}
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/select/select-content.svelte
var root_2$31 = from_html(`<!> <!> <!>`, 1);
function Select_content($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), sideOffset = prop($$props, "sideOffset", 3, 4), preventScroll = prop($$props, "preventScroll", 3, true), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"sideOffset",
		"portalProps",
		"children",
		"preventScroll"
	]);
	Select_portal($$anchor, spread_props(() => $$props.portalProps, {
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = comment();
			var node = first_child(fragment_1);
			{
				let $0 = user_derived(() => cn("bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 min-w-36 rounded-lg shadow-md ring-1 duration-100 data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2 relative isolate z-50 overflow-x-hidden overflow-y-auto", $$props.class));
				component(node, () => Select_content$1, ($$anchor, SelectPrimitive_Content) => {
					SelectPrimitive_Content($$anchor, spread_props({
						get sideOffset() {
							return sideOffset();
						},
						get preventScroll() {
							return preventScroll();
						},
						"data-slot": "select-content",
						get class() {
							return get($0);
						}
					}, () => restProps, {
						get ref() {
							return ref();
						},
						set ref($$value) {
							ref($$value);
						},
						children: ($$anchor, $$slotProps) => {
							var fragment_2 = root_2$31();
							var node_1 = first_child(fragment_2);
							Select_scroll_up_button(node_1, {});
							var node_2 = sibling(node_1, 2);
							{
								let $0 = user_derived(() => cn("h-(--bits-select-anchor-height) w-full min-w-(--bits-select-anchor-width) scroll-my-1"));
								component(node_2, () => Select_viewport, ($$anchor, SelectPrimitive_Viewport) => {
									SelectPrimitive_Viewport($$anchor, {
										get class() {
											return get($0);
										},
										children: ($$anchor, $$slotProps) => {
											var fragment_3 = comment();
											snippet(first_child(fragment_3), () => $$props.children ?? noop);
											append($$anchor, fragment_3);
										},
										$$slots: { default: true }
									});
								});
							}
							Select_scroll_down_button(sibling(node_2, 2), {});
							append($$anchor, fragment_2);
						},
						$$slots: { default: true }
					}));
				});
			}
			append($$anchor, fragment_1);
		},
		$$slots: { default: true }
	}));
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/select/select-item.svelte
var root_1$25 = from_html(`<span class="absolute end-2 flex size-3.5 items-center justify-center"><!></span> <!>`, 1);
function Select_item($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"value",
		"label",
		"children"
	]);
	var fragment = comment();
	var node = first_child(fragment);
	{
		const children = ($$anchor, $$arg0) => {
			let selected = () => $$arg0?.().selected;
			let highlighted = () => $$arg0?.().highlighted;
			var fragment_1 = root_1$25();
			var span = first_child(fragment_1);
			var node_1 = child(span);
			var consequent = ($$anchor) => {
				Check($$anchor, { class: "cn-select-item-indicator-icon" });
			};
			if_block(node_1, ($$render) => {
				if (selected()) $$render(consequent);
			});
			reset(span);
			var node_2 = sibling(span, 2);
			var consequent_1 = ($$anchor) => {
				var fragment_3 = comment();
				snippet(first_child(fragment_3), () => $$props.children, () => ({
					selected: selected(),
					highlighted: highlighted()
				}));
				append($$anchor, fragment_3);
			};
			var alternate = ($$anchor) => {
				var text$21 = text();
				template_effect(() => set_text(text$21, $$props.label || $$props.value));
				append($$anchor, text$21);
			};
			if_block(node_2, ($$render) => {
				if ($$props.children) $$render(consequent_1);
				else $$render(alternate, -1);
			});
			append($$anchor, fragment_1);
		};
		let $0 = user_derived(() => cn("focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2 focus:bg-accent data-highlighted:bg-accent data-highlighted:text-accent-foreground focus:text-accent-foreground relative flex w-full cursor-default items-center outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0", $$props.class));
		component(node, () => Select_item$1, ($$anchor, SelectPrimitive_Item) => {
			SelectPrimitive_Item($$anchor, spread_props({
				get value() {
					return $$props.value;
				},
				"data-slot": "select-item",
				get class() {
					return get($0);
				}
			}, () => restProps, {
				get ref() {
					return ref();
				},
				set ref($$value) {
					ref($$value);
				},
				children,
				$$slots: { default: true }
			}));
		});
	}
	append($$anchor, fragment);
	pop();
}
from_html(`<div><!></div>`);
//#endregion
//#region src/extension/svelte/components/ui/select/select-trigger.svelte
var root_1$24 = from_html(`<!> <!>`, 1);
function Select_trigger($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), size = prop($$props, "size", 3, "default"), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"children",
		"size"
	]);
	var fragment = comment();
	var node = first_child(fragment);
	{
		let $0 = user_derived(() => cn("border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 gap-1.5 rounded-lg border bg-transparent py-2 pr-2 pl-2.5 text-sm transition-colors select-none focus-visible:ring-3 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:flex *:data-[slot=select-value]:gap-1.5 [&_svg:not([class*='size-'])]:size-4 flex w-fit items-center justify-between whitespace-nowrap outline-none disabled:cursor-not-allowed disabled:opacity-50 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center [&_svg]:pointer-events-none [&_svg]:shrink-0", $$props.class));
		component(node, () => Select_trigger$1, ($$anchor, SelectPrimitive_Trigger) => {
			SelectPrimitive_Trigger($$anchor, spread_props({
				"data-slot": "select-trigger",
				get "data-size"() {
					return size();
				},
				get class() {
					return get($0);
				}
			}, () => restProps, {
				get ref() {
					return ref();
				},
				set ref($$value) {
					ref($$value);
				},
				children: ($$anchor, $$slotProps) => {
					var fragment_1 = root_1$24();
					var node_1 = first_child(fragment_1);
					snippet(node_1, () => $$props.children ?? noop);
					CaretDown(sibling(node_1, 2), { class: "text-muted-foreground size-4 pointer-events-none" });
					append($$anchor, fragment_1);
				},
				$$slots: { default: true }
			}));
		});
	}
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/ItemSelect.svelte
var root_1$23 = from_html(`<!> <!>`, 1);
function ItemSelect($$anchor, $$props) {
	push($$props, true);
	const triggerContent = user_derived(() => $$props.items.find((i) => i.value === $$props.value)?.label ?? $$props.placeholder);
	var fragment = comment();
	component(first_child(fragment), () => Select, ($$anchor, Select_Root) => {
		Select_Root($$anchor, {
			type: "single",
			get value() {
				return $$props.value;
			},
			get onValueChange() {
				return $$props.onValueChange;
			},
			children: ($$anchor, $$slotProps) => {
				var fragment_1 = root_1$23();
				var node_1 = first_child(fragment_1);
				component(node_1, () => Select_trigger, ($$anchor, Select_Trigger) => {
					Select_Trigger($$anchor, {
						size: "sm",
						class: "w-full",
						children: ($$anchor, $$slotProps) => {
							next();
							var text$20 = text();
							template_effect(() => set_text(text$20, get(triggerContent)));
							append($$anchor, text$20);
						},
						$$slots: { default: true }
					});
				});
				component(sibling(node_1, 2), () => Select_content, ($$anchor, Select_Content) => {
					Select_Content($$anchor, {
						class: "max-h-60",
						children: ($$anchor, $$slotProps) => {
							var fragment_3 = comment();
							each(first_child(fragment_3), 17, () => $$props.items, (item) => item.value, ($$anchor, item) => {
								var fragment_4 = comment();
								component(first_child(fragment_4), () => Select_item, ($$anchor, Select_Item) => {
									Select_Item($$anchor, {
										get value() {
											return get(item).value;
										},
										get label() {
											return get(item).label;
										},
										get disabled() {
											return get(item).disabled;
										},
										children: ($$anchor, $$slotProps) => {
											next();
											var text_1 = text();
											template_effect(() => set_text(text_1, get(item).label));
											append($$anchor, text_1);
										},
										$$slots: { default: true }
									});
								});
								append($$anchor, fragment_4);
							});
							append($$anchor, fragment_3);
						},
						$$slots: { default: true }
					});
				});
				append($$anchor, fragment_1);
			},
			$$slots: { default: true }
		});
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/StorageSelect.svelte
var root_2$30 = from_html(`<!> <!>`, 1);
var root_1$22 = from_html(`<!> <!>`, 1);
function StorageSelect($$anchor, $$props) {
	push($$props, true);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const $apiStore = () => store_get(apiStore, "$apiStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let id = prop($$props, "id", 19, () => $$props.path.replaceAll(".", "-"));
	const storageSource = user_derived(() => ({
		settings: $settingsStore(),
		api: $apiStore()
	}));
	const value = user_derived(() => String(getPreferenceValue(get(storageSource), $$props.path) ?? ""));
	async function updateValue(nextValue) {
		if ($$props.beforeValueChange && !await $$props.beforeValueChange(nextValue)) return;
		await updatePreferenceValue($$props.path, nextValue);
	}
	var fragment = comment();
	component(first_child(fragment), () => Field, ($$anchor, Field_Field) => {
		Field_Field($$anchor, {
			orientation: "responsive",
			class: "rounded-md border border-border bg-background/60 p-2",
			children: ($$anchor, $$slotProps) => {
				var fragment_1 = root_1$22();
				var node_1 = first_child(fragment_1);
				component(node_1, () => Field_content, ($$anchor, Field_Content) => {
					Field_Content($$anchor, {
						children: ($$anchor, $$slotProps) => {
							var fragment_2 = root_2$30();
							var node_2 = first_child(fragment_2);
							component(node_2, () => Field_label, ($$anchor, Field_Label) => {
								Field_Label($$anchor, {
									get for() {
										return id();
									},
									children: ($$anchor, $$slotProps) => {
										next();
										var text$19 = text();
										template_effect(() => set_text(text$19, $$props.label));
										append($$anchor, text$19);
									},
									$$slots: { default: true }
								});
							});
							var node_3 = sibling(node_2, 2);
							var consequent = ($$anchor) => {
								var fragment_4 = comment();
								component(first_child(fragment_4), () => Field_description, ($$anchor, Field_Description) => {
									Field_Description($$anchor, {
										class: "text-xs",
										children: ($$anchor, $$slotProps) => {
											next();
											var text_1 = text();
											template_effect(() => set_text(text_1, $$props.description));
											append($$anchor, text_1);
										},
										$$slots: { default: true }
									});
								});
								append($$anchor, fragment_4);
							};
							if_block(node_3, ($$render) => {
								if ($$props.description) $$render(consequent);
							});
							append($$anchor, fragment_2);
						},
						$$slots: { default: true }
					});
				});
				ItemSelect(sibling(node_1, 2), {
					get items() {
						return $$props.items;
					},
					placeholder: "Select a value",
					get value() {
						return get(value);
					},
					onValueChange: (nextValue) => void updateValue(nextValue)
				});
				append($$anchor, fragment_1);
			},
			$$slots: { default: true }
		});
	});
	append($$anchor, fragment);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/external-service-requirement.ts
var SERVICE_DETAILS = {
	tornstats: {
		name: "TornStats",
		icon: "/images/svg-icons/tornstats.svg"
	},
	yata: {
		name: "YATA",
		icon: "/images/svg-icons/yata.svg"
	},
	tornw3b: { name: "TornW3B" },
	lzpt: { name: "LZPT" },
	prometheus: { name: "Prometheus" },
	ffScouter: { name: "FFScouter" },
	tornintel: { name: "Torn Intel" }
};
//#endregion
//#region src/extension/entrypoints/options/components/preferences/ExternalServiceRequirement.svelte
var root_5$19 = from_html(`<img class="w-6"/>`);
var root_2$29 = from_html(`<span class="text-[10px] uppercase">Requires</span> <span class="flex gap-1"></span>`, 1);
var root_1$21 = from_html(`<!> <!>`, 1);
function ExternalServiceRequirement($$anchor, $$props) {
	push($$props, true);
	const requiredServices = user_derived(() => $$props.services.map((service) => SERVICE_DETAILS[service]));
	const serviceNames = user_derived(() => get(requiredServices).map((service) => service.name).join(", "));
	var fragment = comment();
	component(first_child(fragment), () => Tooltip, ($$anchor, Tooltip_Root) => {
		Tooltip_Root($$anchor, {
			children: ($$anchor, $$slotProps) => {
				var fragment_1 = root_1$21();
				var node_1 = first_child(fragment_1);
				component(node_1, () => Tooltip_trigger, ($$anchor, Tooltip_Trigger) => {
					Tooltip_Trigger($$anchor, {
						type: "button",
						class: "flex items-center gap-1 rounded-md border border-dashed border-border bg-muted/30 px-2 py-1 text-xs text-muted-foreground",
						children: ($$anchor, $$slotProps) => {
							var fragment_2 = root_2$29();
							var span = sibling(first_child(fragment_2), 2);
							each(span, 21, () => get(requiredServices), (service) => service.name, ($$anchor, service) => {
								Badge($$anchor, {
									variant: "outline",
									class: "h-4 px-1.5 text-[8px]",
									children: ($$anchor, $$slotProps) => {
										var fragment_4 = comment();
										var node_2 = first_child(fragment_4);
										var consequent = ($$anchor) => {
											var img = root_5$19();
											template_effect(() => {
												set_attribute(img, "src", get(service).icon);
												set_attribute(img, "alt", get(service).name);
											});
											append($$anchor, img);
										};
										var alternate = ($$anchor) => {
											var text$18 = text();
											template_effect(() => set_text(text$18, get(service).name));
											append($$anchor, text$18);
										};
										if_block(node_2, ($$render) => {
											if ("icon" in get(service)) $$render(consequent);
											else $$render(alternate, -1);
										});
										append($$anchor, fragment_4);
									},
									$$slots: { default: true }
								});
							});
							reset(span);
							append($$anchor, fragment_2);
						},
						$$slots: { default: true }
					});
				});
				component(sibling(node_1, 2), () => Tooltip_content, ($$anchor, Tooltip_Content) => {
					Tooltip_Content($$anchor, {
						children: ($$anchor, $$slotProps) => {
							next();
							var text_1 = text();
							template_effect(() => set_text(text_1, `At least one of the following external services need to be enabled: ${get(serviceNames) ?? ""}`));
							append($$anchor, text_1);
						},
						$$slots: { default: true }
					});
				});
				append($$anchor, fragment_1);
			},
			$$slots: { default: true }
		});
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/StorageSwitch.svelte
var root_2$28 = from_html(`<div class="flex flex-wrap items-center gap-2"><!> <!> <!></div> <!>`, 1);
var root_1$20 = from_html(`<!> <!>`, 1);
var root_7$16 = from_html(`<div class="grid gap-1 bg-muted/50 p-2"><!></div>`);
var root$28 = from_html(`<div><!> <!></div>`);
function StorageSwitch($$anchor, $$props) {
	push($$props, true);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const $apiStore = () => store_get(apiStore, "$apiStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let id = prop($$props, "id", 19, () => $$props.path.replaceAll(".", "-")), compact = prop($$props, "compact", 3, false), disabledProp = prop($$props, "disabled", 3, false), externalServices = prop($$props, "externalServices", 19, () => []);
	const storageSource = user_derived(() => ({
		settings: $settingsStore(),
		api: $apiStore()
	}));
	const checked = user_derived(() => Boolean(getPreferenceValue(get(storageSource), $$props.path)));
	const requirementMet = user_derived(() => externalServices().length === 0 || externalServices().some((service) => Boolean($settingsStore().external[service])));
	const disabled = user_derived(() => disabledProp() || !get(requirementMet));
	function updateChecked(value) {
		if (get(disabled)) return;
		updatePreferenceValue($$props.path, value);
	}
	var div = root$28();
	var node = child(div);
	component(node, () => Field, ($$anchor, Field_Field) => {
		Field_Field($$anchor, {
			orientation: "horizontal",
			class: "p-2",
			children: ($$anchor, $$slotProps) => {
				var fragment = root_1$20();
				var node_1 = first_child(fragment);
				component(node_1, () => Field_content, ($$anchor, Field_Content) => {
					Field_Content($$anchor, {
						children: ($$anchor, $$slotProps) => {
							var fragment_1 = root_2$28();
							var div_1 = first_child(fragment_1);
							var node_2 = child(div_1);
							component(node_2, () => Field_label, ($$anchor, Field_Label) => {
								Field_Label($$anchor, {
									get for() {
										return id();
									},
									class: "w-full",
									children: ($$anchor, $$slotProps) => {
										next();
										var text$17 = text();
										template_effect(() => set_text(text$17, $$props.label));
										append($$anchor, text$17);
									},
									$$slots: { default: true }
								});
							});
							var node_3 = sibling(node_2, 2);
							var consequent = ($$anchor) => {
								ExternalServiceRequirement($$anchor, { get services() {
									return externalServices();
								} });
							};
							if_block(node_3, ($$render) => {
								if (externalServices().length) $$render(consequent);
							});
							snippet(sibling(node_3, 2), () => $$props.titleAction ?? noop);
							reset(div_1);
							var node_5 = sibling(div_1, 2);
							var consequent_1 = ($$anchor) => {
								var fragment_4 = comment();
								component(first_child(fragment_4), () => Field_description, ($$anchor, Field_Description) => {
									Field_Description($$anchor, {
										class: "text-xs",
										children: ($$anchor, $$slotProps) => {
											next();
											var text_1 = text();
											template_effect(() => set_text(text_1, $$props.description));
											append($$anchor, text_1);
										},
										$$slots: { default: true }
									});
								});
								append($$anchor, fragment_4);
							};
							if_block(node_5, ($$render) => {
								if ($$props.description) $$render(consequent_1);
							});
							append($$anchor, fragment_1);
						},
						$$slots: { default: true }
					});
				});
				Switch(sibling(node_1, 2), {
					get id() {
						return id();
					},
					size: "sm",
					get checked() {
						return get(checked);
					},
					get disabled() {
						return get(disabled);
					},
					onCheckedChange: updateChecked
				});
				append($$anchor, fragment);
			},
			$$slots: { default: true }
		});
	});
	var node_8 = sibling(node, 2);
	var consequent_2 = ($$anchor) => {
		var div_2 = root_7$16();
		snippet(child(div_2), () => $$props.children);
		reset(div_2);
		append($$anchor, div_2);
	};
	if_block(node_8, ($$render) => {
		if ($$props.children) $$render(consequent_2);
	});
	reset(div);
	template_effect(($0) => set_class(div, 1, $0), [() => clsx(cn("rounded-md border", compact() ? "border-border bg-card" : "border-border bg-background/60", $$props.class))]);
	append($$anchor, div);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/financial/ItemsSection.svelte
var root_2$27 = from_html(`<!> <!> <!> <!> <!> <!> <!>`, 1);
var root_4$15 = from_html(`<!> <!>`, 1);
var root_6$15 = from_html(`<!> <!> <!> <!>`, 1);
var root$27 = from_html(`<div class="space-y-2"><!> <!> <!></div>`);
function ItemsSection($$anchor) {
	const bloodBagOptions = [
		{
			value: "none",
			label: "None"
		},
		{
			value: "o+",
			label: "O+"
		},
		{
			value: "o-",
			label: "O-"
		},
		{
			value: "a+",
			label: "A+"
		},
		{
			value: "a-",
			label: "A-"
		},
		{
			value: "b+",
			label: "B+"
		},
		{
			value: "b-",
			label: "B-"
		},
		{
			value: "ab+",
			label: "AB+"
		},
		{
			value: "ab-",
			label: "AB-"
		}
	];
	var div = root$27();
	var node = child(div);
	PreferenceSectionCard(node, {
		title: "Items",
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				children: ($$anchor, $$slotProps) => {
					var fragment_1 = root_2$27();
					var node_1 = first_child(fragment_1);
					StorageSwitch(node_1, {
						path: "settings.pages.items.quickItems",
						label: "Show the quick items container"
					});
					var node_2 = sibling(node_1, 2);
					StorageSwitch(node_2, {
						path: "settings.pages.items.drugDetails",
						label: "Show details about drugs",
						description: "Also affects other places where you can view item details."
					});
					var node_3 = sibling(node_2, 2);
					StorageSelect(node_3, {
						get items() {
							return bloodBagOptions;
						},
						path: "settings.pages.items.highlightBloodBags",
						label: "Highlight blood bags",
						description: "Also affects the faction armory."
					});
					var node_4 = sibling(node_3, 2);
					StorageSwitch(node_4, {
						path: "settings.pages.items.energyWarning",
						label: "Warn if an item gives you energy over 1000"
					});
					var node_5 = sibling(node_4, 2);
					StorageSwitch(node_5, {
						path: "settings.pages.items.medicalLife",
						label: "Show life information when consuming medical items"
					});
					var node_6 = sibling(node_5, 2);
					StorageSwitch(node_6, {
						path: "settings.pages.items.hideRecycleMessage",
						label: "Hide the recycle message"
					});
					StorageSwitch(sibling(node_6, 2), {
						path: "settings.pages.items.hideTooManyItemsWarning",
						label: "Hide the too many items warning"
					});
					append($$anchor, fragment_1);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	var node_8 = sibling(node, 2);
	PreferenceSectionCard(node_8, {
		title: "Museum Sets",
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				children: ($$anchor, $$slotProps) => {
					var fragment_3 = root_4$15();
					var node_9 = first_child(fragment_3);
					StorageSwitch(node_9, {
						path: "settings.pages.items.missingFlowers",
						label: "Display missing flowers for a complete set"
					});
					StorageSwitch(sibling(node_9, 2), {
						path: "settings.pages.items.missingPlushies",
						label: "Display missing plushies for a complete set"
					});
					append($$anchor, fragment_3);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	PreferenceSectionCard(sibling(node_8, 2), {
		title: "Item Effects",
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				children: ($$anchor, $$slotProps) => {
					var fragment_5 = root_6$15();
					var node_12 = first_child(fragment_5);
					StorageSwitch(node_12, {
						path: "settings.pages.items.bookEffects",
						label: "Show book effects"
					});
					var node_13 = sibling(node_12, 2);
					StorageSwitch(node_13, {
						path: "settings.pages.items.canGains",
						label: "Show energy drink gains"
					});
					var node_14 = sibling(node_13, 2);
					StorageSwitch(node_14, {
						path: "settings.pages.items.candyHappyGains",
						label: "Show candy happy gains"
					});
					StorageSwitch(sibling(node_14, 2), {
						path: "settings.pages.items.nerveGains",
						label: "Show alcohol nerve gains"
					});
					append($$anchor, fragment_5);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	reset(div);
	append($$anchor, div);
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/financial/MarketsSection.svelte
var root_2$26 = from_html(`<!> <!> <!> <!>`, 1);
var root_5$18 = from_html(`<!> <!> <!>`, 1);
var root_10$5 = from_html(`<!> <!>`, 1);
var root_9$5 = from_html(`<!> <!>`, 1);
var root_8$6 = from_html(`<!> <!> <!> <!>`, 1);
var root$26 = from_html(`<div class="space-y-2"><!> <!> <!></div>`);
function MarketsSection($$anchor, $$props) {
	push($$props, true);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const cheapItemThreshold = user_derived(() => String($settingsStore().pages.itemmarket.highlightCheapItems ?? ""));
	async function updateCheapItemThreshold(value) {
		const trimmedValue = value.trim();
		const nextValue = trimmedValue === "" ? "" : Number(trimmedValue);
		await ttStorage.change({ settings: { pages: { itemmarket: { highlightCheapItems: nextValue } } } });
	}
	var div = root$26();
	var node = child(div);
	PreferenceSectionCard(node, {
		title: "Bazaar",
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				children: ($$anchor, $$slotProps) => {
					var fragment_1 = root_2$26();
					var node_1 = first_child(fragment_1);
					StorageSwitch(node_1, {
						path: "settings.pages.bazaar.itemsCost",
						label: "Show the total cost of buying an item"
					});
					var node_2 = sibling(node_1, 2);
					StorageSwitch(node_2, {
						path: "settings.pages.bazaar.worth",
						label: "Show the worth of the visited bazaar"
					});
					var node_3 = sibling(node_2, 2);
					StorageSwitch(node_3, {
						path: "settings.pages.bazaar.fillMax",
						label: "Fill Max",
						children: ($$anchor, $$slotProps) => {
							StorageSwitch($$anchor, {
								path: "settings.pages.bazaar.maxBuyIgnoreCash",
								label: "Ignore cash on hand"
							});
						},
						$$slots: { default: true }
					});
					StorageSwitch(sibling(node_3, 2), {
						path: "settings.pages.bazaar.highlightSubVendorItems",
						label: "Highlight items less than the vendor sell price"
					});
					append($$anchor, fragment_1);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	var node_5 = sibling(node, 2);
	PreferenceSectionCard(node_5, {
		title: "Shops",
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				children: ($$anchor, $$slotProps) => {
					var fragment_4 = root_5$18();
					var node_6 = first_child(fragment_4);
					StorageSwitch(node_6, {
						path: "settings.pages.shops.fillMax",
						label: "Fill Max",
						children: ($$anchor, $$slotProps) => {
							StorageSwitch($$anchor, {
								path: "settings.pages.shops.maxBuyIgnoreCash",
								label: "Ignore cash on hand"
							});
						},
						$$slots: { default: true }
					});
					var node_7 = sibling(node_6, 2);
					StorageSwitch(node_7, {
						path: "settings.pages.shops.profit",
						label: "Item profits"
					});
					StorageSwitch(sibling(node_7, 2), {
						path: "settings.pages.shops.values",
						label: "Item market values"
					});
					append($$anchor, fragment_4);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	PreferenceSectionCard(sibling(node_5, 2), {
		title: "Item Market",
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				children: ($$anchor, $$slotProps) => {
					var fragment_7 = root_8$6();
					var node_10 = first_child(fragment_7);
					component(node_10, () => Field, ($$anchor, Field_Field) => {
						Field_Field($$anchor, {
							orientation: "responsive",
							class: "rounded-md border border-border bg-background/60 p-2",
							children: ($$anchor, $$slotProps) => {
								var fragment_8 = root_9$5();
								var node_11 = first_child(fragment_8);
								component(node_11, () => Field_content, ($$anchor, Field_Content) => {
									Field_Content($$anchor, {
										children: ($$anchor, $$slotProps) => {
											var fragment_9 = root_10$5();
											var node_12 = first_child(fragment_9);
											component(node_12, () => Field_label, ($$anchor, Field_Label) => {
												Field_Label($$anchor, {
													for: "financial-itemmarket-highlight-cheap-items",
													children: ($$anchor, $$slotProps) => {
														next();
														append($$anchor, text("Highlight items below value"));
													},
													$$slots: { default: true }
												});
											});
											component(sibling(node_12, 2), () => Field_description, ($$anchor, Field_Description) => {
												Field_Description($$anchor, {
													class: "text-xs",
													children: ($$anchor, $$slotProps) => {
														next();
														append($$anchor, text("Percentage below item value. Leave empty to disable the threshold."));
													},
													$$slots: { default: true }
												});
											});
											append($$anchor, fragment_9);
										},
										$$slots: { default: true }
									});
								});
								Input(sibling(node_11, 2), {
									id: "financial-itemmarket-highlight-cheap-items",
									type: "number",
									min: "0",
									max: "100",
									get value() {
										return get(cheapItemThreshold);
									},
									oninput: (event) => updateCheapItemThreshold(event.currentTarget.value)
								});
								append($$anchor, fragment_8);
							},
							$$slots: { default: true }
						});
					});
					var node_15 = sibling(node_10, 2);
					StorageSwitch(node_15, {
						path: "settings.pages.itemmarket.highlightCheapItemsSound",
						label: "Play a sound when highlighting cheap items"
					});
					var node_16 = sibling(node_15, 2);
					StorageSwitch(node_16, {
						path: "settings.pages.itemmarket.leftBar",
						label: "Move the market bar to the left"
					});
					StorageSwitch(sibling(node_16, 2), {
						path: "settings.pages.itemmarket.fillMax",
						label: "Fill Max"
					});
					append($$anchor, fragment_7);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	reset(div);
	append($$anchor, div);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/financial/MoneySection.svelte
var root_2$25 = from_html(`<!> <!> <!> <!>`, 1);
var root_3$21 = from_html(`<!> <!> <!> <!>`, 1);
var root_1$19 = from_html(`<!> <!>`, 1);
var root_5$17 = from_html(`<!> <!>`, 1);
var root_7$15 = from_html(`<!> <!> <!>`, 1);
var root_11$4 = from_html(`<!> <!>`, 1);
var root_10$4 = from_html(`<div class="rounded-md border border-border bg-background/60"><!></div>`);
var root_14$1 = from_html(`<p class="text-sm text-amber-600 dark:text-amber-400">Requires API data to be loaded.</p>`);
var root_6$14 = from_html(`<div class="grid gap-2"><!> <!></div>`);
var root_17$2 = from_html(`<a href="https://www.beatingbonuses.com/bjstrategy.php?decks=8&amp;soft17=stand&amp;doubleon=any2cards&amp;peek=off&amp;das=on&amp;dsa=on&amp;charlie=on&amp;surrender=earlyf&amp;opt=1&amp;btn=Generate+Strategy" target="_blank" rel="noreferrer" class="flex items-center gap-1 text-xs text-primary hover:underline">Strategy calculator <!></a>`);
var root_16$1 = from_html(`<!> <!> <!>`, 1);
var root_21$1 = from_html(`<!> <!>`, 1);
var root_20$1 = from_html(`<div class="rounded-md border border-border bg-background/60"><!></div>`);
var root_15 = from_html(`<div class="grid gap-2"><!> <!></div>`);
var root$25 = from_html(`<div class="space-y-2"><!> <!> <!> <!></div>`);
function MoneySection($$anchor, $$props) {
	push($$props, true);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const $stockdataStore = () => store_get(stockdataStore, "$stockdataStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const hiddenCasinoGames = user_derived(() => $settingsStore().hideCasinoGames ?? []);
	const hiddenStocks = user_derived(() => $settingsStore().hideStocks ?? []);
	const stockChoices = user_derived(() => {
		const source = $stockdataStore() ?? {};
		return Object.entries(source).filter((entry) => isStockEntry(entry[1])).map(([id, stock]) => ({
			id,
			name: stock.name
		}));
	});
	function isStockEntry(value) {
		return !!value && typeof value === "object" && "name" in value && typeof value.name === "string";
	}
	async function updateCasinoGameVisibility(game, hidden) {
		const nextHiddenGames = hidden ? [...get(hiddenCasinoGames), game] : get(hiddenCasinoGames).filter((hiddenGame) => hiddenGame !== game);
		await ttStorage.change({ settings: { hideCasinoGames: nextHiddenGames } });
	}
	async function updateStockVisibility(stockId, hidden) {
		const nextHiddenStocks = hidden ? [...get(hiddenStocks), stockId] : get(hiddenStocks).filter((hiddenStock) => hiddenStock !== stockId);
		await ttStorage.change({ settings: { hideStocks: nextHiddenStocks } });
	}
	var div = root$25();
	var node = child(div);
	PreferenceSectionCard(node, {
		children: ($$anchor, $$slotProps) => {
			var fragment = root_1$19();
			var node_1 = first_child(fragment);
			PreferenceSettingGroup(node_1, {
				children: ($$anchor, $$slotProps) => {
					var fragment_1 = root_2$25();
					var node_2 = first_child(fragment_1);
					StorageSwitch(node_2, {
						path: "settings.pages.events.worth",
						label: "Show worth of points, bazaar sales and item market sales on event hover"
					});
					var node_3 = sibling(node_2, 2);
					StorageSwitch(node_3, {
						path: "settings.pages.home.networthDetails",
						label: "Display networth details on the homepage"
					});
					var node_4 = sibling(node_3, 2);
					StorageSwitch(node_4, {
						path: "settings.pages.trade.itemValues",
						label: "Trade item value"
					});
					StorageSwitch(sibling(node_4, 2), {
						path: "settings.pages.displayCase.worth",
						label: "Display case worth"
					});
					append($$anchor, fragment_1);
				},
				$$slots: { default: true }
			});
			PreferenceSettingGroup(sibling(node_1, 2), {
				title: "Items",
				children: ($$anchor, $$slotProps) => {
					var fragment_2 = root_3$21();
					var node_7 = first_child(fragment_2);
					StorageSwitch(node_7, {
						path: "settings.pages.crimes2.value",
						label: "Total value for your crimes v2 item rewards"
					});
					var node_8 = sibling(node_7, 2);
					StorageSwitch(node_8, {
						path: "settings.pages.items.values",
						label: "Display item values"
					});
					var node_9 = sibling(node_8, 2);
					StorageSwitch(node_9, {
						path: "settings.pages.items.marketLinks",
						label: "Link to the item market"
					});
					StorageSwitch(sibling(node_9, 2), {
						path: "settings.pages.items.openedSupplyPackValue",
						label: "Total value of items for supply pack"
					});
					append($$anchor, fragment_2);
				},
				$$slots: { default: true }
			});
			append($$anchor, fragment);
		},
		$$slots: { default: true }
	});
	var node_11 = sibling(node, 2);
	PreferenceSectionCard(node_11, {
		title: "Bank Investments",
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				children: ($$anchor, $$slotProps) => {
					var fragment_4 = root_5$17();
					var node_12 = first_child(fragment_4);
					StorageSwitch(node_12, {
						path: "settings.pages.bank.investmentInfo",
						label: "Enable bank investment info"
					});
					StorageSwitch(sibling(node_12, 2), {
						path: "settings.pages.bank.investmentDueTime",
						label: "Enable bank investment due time"
					});
					append($$anchor, fragment_4);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	var node_14 = sibling(node_11, 2);
	PreferenceSectionCard(node_14, {
		title: "Stock Exchange",
		children: ($$anchor, $$slotProps) => {
			var div_1 = root_6$14();
			var node_15 = child(div_1);
			PreferenceSettingGroup(node_15, {
				children: ($$anchor, $$slotProps) => {
					var fragment_5 = root_7$15();
					var node_16 = first_child(fragment_5);
					StorageSwitch(node_16, {
						path: "settings.pages.stocks.acronyms",
						label: "Display acronyms beside stock names"
					});
					var node_17 = sibling(node_16, 2);
					StorageSwitch(node_17, {
						path: "settings.pages.stocks.moneyInput",
						label: "Display money input when buying and selling stock"
					});
					StorageSwitch(sibling(node_17, 2), {
						path: "settings.pages.stocks.valueAndProfit",
						label: "Display total value of portfolio and profits"
					});
					append($$anchor, fragment_5);
				},
				$$slots: { default: true }
			});
			PreferenceSettingGroup(sibling(node_15, 2), {
				title: "Hidden Stocks",
				contentClass: "grid gap-1 grid-cols-2 md:grid-cols-3",
				children: ($$anchor, $$slotProps) => {
					var fragment_6 = comment();
					var node_20 = first_child(fragment_6);
					var consequent = ($$anchor) => {
						var fragment_7 = comment();
						each(first_child(fragment_7), 17, () => get(stockChoices), (stock) => stock.id, ($$anchor, stock) => {
							const id = user_derived(() => `financial-hidden-stock-${get(stock).id}`);
							var div_2 = root_10$4();
							component(child(div_2), () => Field, ($$anchor, Field_Field) => {
								Field_Field($$anchor, {
									orientation: "horizontal",
									class: "p-2",
									children: ($$anchor, $$slotProps) => {
										var fragment_8 = root_11$4();
										var node_23 = first_child(fragment_8);
										component(node_23, () => Field_content, ($$anchor, Field_Content) => {
											Field_Content($$anchor, {
												children: ($$anchor, $$slotProps) => {
													var fragment_9 = comment();
													component(first_child(fragment_9), () => Field_label, ($$anchor, Field_Label) => {
														Field_Label($$anchor, {
															get for() {
																return get(id);
															},
															class: "w-full",
															children: ($$anchor, $$slotProps) => {
																next();
																var text$15 = text();
																template_effect(($0) => set_text(text$15, $0), [() => capitalizeText(get(stock).name)]);
																append($$anchor, text$15);
															},
															$$slots: { default: true }
														});
													});
													append($$anchor, fragment_9);
												},
												$$slots: { default: true }
											});
										});
										var node_25 = sibling(node_23, 2);
										{
											let $0 = user_derived(() => get(hiddenStocks).includes(get(stock).id));
											Switch(node_25, {
												get id() {
													return get(id);
												},
												size: "sm",
												get checked() {
													return get($0);
												},
												onCheckedChange: (hidden) => updateStockVisibility(get(stock).id, hidden)
											});
										}
										append($$anchor, fragment_8);
									},
									$$slots: { default: true }
								});
							});
							reset(div_2);
							append($$anchor, div_2);
						});
						append($$anchor, fragment_7);
					};
					var alternate = ($$anchor) => {
						append($$anchor, root_14$1());
					};
					if_block(node_20, ($$render) => {
						if (get(stockChoices).length) $$render(consequent);
						else $$render(alternate, -1);
					});
					append($$anchor, fragment_6);
				},
				$$slots: { default: true }
			});
			reset(div_1);
			append($$anchor, div_1);
		},
		$$slots: { default: true }
	});
	PreferenceSectionCard(sibling(node_14, 2), {
		title: "Casino",
		children: ($$anchor, $$slotProps) => {
			var div_3 = root_15();
			var node_27 = child(div_3);
			PreferenceSettingGroup(node_27, {
				children: ($$anchor, $$slotProps) => {
					var fragment_11 = root_16$1();
					var node_28 = first_child(fragment_11);
					StorageSwitch(node_28, {
						path: "settings.pages.casino.netTotal",
						label: "Show net total of casino game"
					});
					var node_29 = sibling(node_28, 2);
					StorageSwitch(node_29, {
						path: "settings.pages.casino.blackjack",
						label: "Show the optimal choice for blackjack",
						children: ($$anchor, $$slotProps) => {
							var a = root_17$2();
							ArrowSquareOutIcon(sibling(child(a)), { "aria-hidden": "true" });
							reset(a);
							append($$anchor, a);
						},
						$$slots: { default: true }
					});
					StorageSwitch(sibling(node_29, 2), {
						path: "settings.pages.casino.highlow",
						label: "Enable the high-low helper",
						children: ($$anchor, $$slotProps) => {
							StorageSwitch($$anchor, {
								path: "settings.pages.casino.highlowMovement",
								label: "Move the buttons to make it easier to click through it"
							});
						},
						$$slots: { default: true }
					});
					append($$anchor, fragment_11);
				},
				$$slots: { default: true }
			});
			PreferenceSettingGroup(sibling(node_27, 2), {
				title: "Hidden Casino Games",
				contentClass: "grid gap-1 grid-cols-2 md:grid-cols-3",
				children: ($$anchor, $$slotProps) => {
					var fragment_13 = comment();
					each(first_child(fragment_13), 16, () => CASINO_GAMES, (game) => game, ($$anchor, game) => {
						const id = user_derived(() => `financial-hidden-casino-game-${game}`);
						var div_4 = root_20$1();
						component(child(div_4), () => Field, ($$anchor, Field_Field_1) => {
							Field_Field_1($$anchor, {
								orientation: "horizontal",
								class: "p-2",
								children: ($$anchor, $$slotProps) => {
									var fragment_14 = root_21$1();
									var node_35 = first_child(fragment_14);
									component(node_35, () => Field_content, ($$anchor, Field_Content_1) => {
										Field_Content_1($$anchor, {
											children: ($$anchor, $$slotProps) => {
												var fragment_15 = comment();
												component(first_child(fragment_15), () => Field_label, ($$anchor, Field_Label_1) => {
													Field_Label_1($$anchor, {
														get for() {
															return get(id);
														},
														class: "w-full",
														children: ($$anchor, $$slotProps) => {
															next();
															var text_1 = text();
															template_effect(($0) => set_text(text_1, $0), [() => capitalizeText(game)]);
															append($$anchor, text_1);
														},
														$$slots: { default: true }
													});
												});
												append($$anchor, fragment_15);
											},
											$$slots: { default: true }
										});
									});
									var node_37 = sibling(node_35, 2);
									{
										let $0 = user_derived(() => get(hiddenCasinoGames).includes(game));
										Switch(node_37, {
											get id() {
												return get(id);
											},
											size: "sm",
											get checked() {
												return get($0);
											},
											onCheckedChange: (hidden) => updateCasinoGameVisibility(game, hidden)
										});
									}
									append($$anchor, fragment_14);
								},
								$$slots: { default: true }
							});
						});
						reset(div_4);
						append($$anchor, div_4);
					});
					append($$anchor, fragment_13);
				},
				$$slots: { default: true }
			});
			reset(div_3);
			append($$anchor, div_3);
		},
		$$slots: { default: true }
	});
	reset(div);
	append($$anchor, div);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/financial/FinancialGroup.svelte
function FinancialGroup($$anchor, $$props) {
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		MoneySection($$anchor, {});
	};
	var consequent_1 = ($$anchor) => {
		MarketsSection($$anchor, {});
	};
	var consequent_2 = ($$anchor) => {
		ItemsSection($$anchor, {});
	};
	var alternate = ($$anchor) => {
		SectionNotFound($$anchor, {});
	};
	if_block(node, ($$render) => {
		if ($$props.sectionId === "money") $$render(consequent);
		else if ($$props.sectionId === "markets") $$render(consequent_1, 1);
		else if ($$props.sectionId === "items") $$render(consequent_2, 2);
		else $$render(alternate, -1);
	});
	append($$anchor, fragment);
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/global/AdvancedSection.svelte
var root_3$20 = from_html(`<!> <!> <!>`, 1);
var root_2$24 = from_html(`<!> <!>`, 1);
var root_1$18 = from_html(`<div class="grid gap-1"><!></div>`);
function AdvancedSection($$anchor) {
	PreferenceSectionCard($$anchor, {
		title: "Debug Information",
		children: ($$anchor, $$slotProps) => {
			var div = root_1$18();
			PreferenceSettingGroup(child(div), {
				children: ($$anchor, $$slotProps) => {
					var fragment_1 = root_2$24();
					var node_1 = first_child(fragment_1);
					StorageSwitch(node_1, {
						path: "settings.developer",
						label: "Developer errors"
					});
					StorageSwitch(sibling(node_1, 2), {
						path: "settings.featureDisplay",
						label: "Feature manager",
						children: ($$anchor, $$slotProps) => {
							var fragment_2 = root_3$20();
							var node_3 = first_child(fragment_2);
							StorageSwitch(node_3, {
								path: "settings.featureDisplayOnlyFailed",
								label: "only failed"
							});
							var node_4 = sibling(node_3, 2);
							StorageSwitch(node_4, {
								path: "settings.featureDisplayHideDisabled",
								label: "hide disabled"
							});
							StorageSwitch(sibling(node_4, 2), {
								path: "settings.featureDisplayHideEmpty",
								label: "hide when empty"
							});
							append($$anchor, fragment_2);
						},
						$$slots: { default: true }
					});
					append($$anchor, fragment_1);
				},
				$$slots: { default: true }
			});
			reset(div);
			append($$anchor, div);
		},
		$$slots: { default: true }
	});
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/StorageNumber.svelte
var root_2$23 = from_html(`<!> <!>`, 1);
var root_1$17 = from_html(`<!> <!>`, 1);
function StorageNumber($$anchor, $$props) {
	push($$props, true);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const $apiStore = () => store_get(apiStore, "$apiStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let id = prop($$props, "id", 19, () => $$props.path.replaceAll(".", "-")), min = prop($$props, "min", 3, void 0), max = prop($$props, "max", 3, void 0), step = prop($$props, "step", 3, void 0), disabled = prop($$props, "disabled", 3, false);
	const storageSource = user_derived(() => ({
		settings: $settingsStore(),
		api: $apiStore()
	}));
	const value = user_derived(() => String(getPreferenceValue(get(storageSource), $$props.path) ?? ""));
	function updateValue(input) {
		updatePreferenceValue($$props.path, input.trim() === "" ? 0 : Number(input));
	}
	var fragment = comment();
	component(first_child(fragment), () => Field, ($$anchor, Field_Field) => {
		Field_Field($$anchor, {
			orientation: "responsive",
			class: "rounded-md border border-border bg-background/60 p-2",
			children: ($$anchor, $$slotProps) => {
				var fragment_1 = root_1$17();
				var node_1 = first_child(fragment_1);
				component(node_1, () => Field_content, ($$anchor, Field_Content) => {
					Field_Content($$anchor, {
						children: ($$anchor, $$slotProps) => {
							var fragment_2 = root_2$23();
							var node_2 = first_child(fragment_2);
							component(node_2, () => Field_label, ($$anchor, Field_Label) => {
								Field_Label($$anchor, {
									get for() {
										return id();
									},
									children: ($$anchor, $$slotProps) => {
										next();
										var text$14 = text();
										template_effect(() => set_text(text$14, $$props.label));
										append($$anchor, text$14);
									},
									$$slots: { default: true }
								});
							});
							var node_3 = sibling(node_2, 2);
							var consequent = ($$anchor) => {
								var fragment_4 = comment();
								component(first_child(fragment_4), () => Field_description, ($$anchor, Field_Description) => {
									Field_Description($$anchor, {
										class: "text-xs",
										children: ($$anchor, $$slotProps) => {
											next();
											var text_1 = text();
											template_effect(() => set_text(text_1, $$props.description));
											append($$anchor, text_1);
										},
										$$slots: { default: true }
									});
								});
								append($$anchor, fragment_4);
							};
							if_block(node_3, ($$render) => {
								if ($$props.description) $$render(consequent);
							});
							append($$anchor, fragment_2);
						},
						$$slots: { default: true }
					});
				});
				Input(sibling(node_1, 2), {
					get id() {
						return id();
					},
					type: "number",
					get min() {
						return min();
					},
					get max() {
						return max();
					},
					get step() {
						return step();
					},
					get disabled() {
						return disabled();
					},
					get value() {
						return get(value);
					},
					oninput: (event) => updateValue(event.currentTarget.value)
				});
				append($$anchor, fragment_1);
			},
			$$slots: { default: true }
		});
	});
	append($$anchor, fragment);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/global/ChatHighlights.svelte
var root_4$14 = from_html(`<li> </li>`);
var root_6$13 = from_html(`<div class="rounded-md border border-border bg-background/60 p-2"><div class="grid gap-2 md:grid-cols-[1fr_40px_28px]"><!> <!> <!></div></div>`);
var root_5$16 = from_html(`<div class="space-y-1"></div>`);
var root_8$5 = from_html(`<p class="rounded-md border border-dashed border-border p-2 text-center text-muted-foreground">No highlights configured.</p>`);
var root_3$19 = from_html(`<div class="p-2 text-muted-foreground text-xs">Placeholders: <ul class="pl-4 list-disc"></ul></div> <!>`, 1);
function ChatHighlights($$anchor, $$props) {
	push($$props, false);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	async function updateHighlights(newHighlights) {
		await ttStorage.change({ settings: { pages: { chat: { highlights: newHighlights } } } });
	}
	function addHighlight() {
		updateHighlights([...$settingsStore().pages.chat.highlights, {
			name: "",
			color: "#7ca900"
		}]);
	}
	function updateHighlight(index, newHighlight) {
		const newHighlights = [...$settingsStore().pages.chat.highlights];
		newHighlights[index] = newHighlight;
		updateHighlights(newHighlights);
	}
	function updateHighlightField(index, key, value) {
		const highlight = $settingsStore().pages.chat.highlights[index];
		if (!highlight) return;
		updateHighlight(index, {
			...highlight,
			[key]: value
		});
	}
	function removeHighlight(index) {
		updateHighlights($settingsStore().pages.chat.highlights.filter((_, i) => i !== index));
	}
	init();
	{
		const action = ($$anchor) => {
			Button($$anchor, {
				type: "button",
				size: "icon-xs",
				variant: "outline",
				onclick: addHighlight,
				children: ($$anchor, $$slotProps) => {
					PlusIcon($$anchor, {});
				},
				$$slots: { default: true }
			});
		};
		PreferenceSectionCard($$anchor, {
			title: "Highlights",
			action,
			children: ($$anchor, $$slotProps) => {
				var fragment_3 = root_3$19();
				var div = first_child(fragment_3);
				var ul = sibling(child(div));
				each(ul, 5, () => HIGHLIGHT_PLACEHOLDERS, index, ($$anchor, placeholder) => {
					var li = root_4$14();
					var text = child(li);
					reset(li);
					template_effect(() => set_text(text, `${get(placeholder).name ?? ""}: ${get(placeholder).description ?? ""}`));
					append($$anchor, li);
				});
				reset(ul);
				reset(div);
				var node = sibling(div, 2);
				var consequent = ($$anchor) => {
					var div_1 = root_5$16();
					each(div_1, 5, () => $settingsStore().pages.chat.highlights, index, ($$anchor, highlight, index) => {
						var div_2 = root_6$13();
						var div_3 = child(div_2);
						var node_1 = child(div_3);
						Input(node_1, {
							get value() {
								return get(highlight).name;
							},
							class: "h-7",
							placeholder: "Name",
							oninput: (event) => updateHighlightField(index, "name", event.currentTarget.value)
						});
						var node_2 = sibling(node_1, 2);
						Input(node_2, {
							get value() {
								return get(highlight).color;
							},
							class: "h-7",
							placeholder: "Color",
							type: "color",
							oninput: (event) => updateHighlightField(index, "color", event.currentTarget.value)
						});
						Button(sibling(node_2, 2), {
							type: "button",
							size: "icon-sm",
							variant: "destructive",
							onclick: () => removeHighlight(index),
							children: ($$anchor, $$slotProps) => {
								TrashIcon($$anchor, {});
							},
							$$slots: { default: true }
						});
						reset(div_3);
						reset(div_2);
						append($$anchor, div_2);
					});
					reset(div_1);
					append($$anchor, div_1);
				};
				var alternate = ($$anchor) => {
					append($$anchor, root_8$5());
				};
				if_block(node, ($$render) => {
					if ($settingsStore().pages.chat.highlights.length) $$render(consequent);
					else $$render(alternate, -1);
				});
				append($$anchor, fragment_3);
			},
			$$slots: {
				action: true,
				default: true
			}
		});
	}
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/global/ColoredChats.svelte
var root_5$15 = from_html(`<div class="rounded-md border border-border bg-background/60 p-2"><div class="grid gap-2 md:grid-cols-[repeat(2,1fr)_28px]"><!> <!> <!></div></div>`);
var root_4$13 = from_html(`<div class="space-y-1"></div>`);
var root_7$14 = from_html(`<p class="rounded-md border border-dashed border-border p-2 text-center text-muted-foreground">No colored chats configured.</p>`);
function ColoredChats($$anchor, $$props) {
	push($$props, false);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const colorOptions = Object.keys(CHAT_TITLE_COLORS).map((value) => ({
		value,
		label: value.replace(/^./, (letter) => letter.toUpperCase())
	}));
	async function updateColoredChats(nextLinks) {
		await ttStorage.change({ settings: { pages: { chat: { titleHighlights: nextLinks } } } });
	}
	function addColoredChat() {
		updateColoredChats([...$settingsStore().pages.chat.titleHighlights, {
			title: "",
			color: "blue"
		}]);
	}
	function updateColoredChat(index, newColoredChat) {
		const newColoredChats = [...$settingsStore().pages.chat.titleHighlights];
		newColoredChats[index] = newColoredChat;
		updateColoredChats(newColoredChats);
	}
	function updateColoredChatField(index, key, value) {
		const highlight = $settingsStore().pages.chat.titleHighlights[index];
		if (!highlight) return;
		updateColoredChat(index, {
			...highlight,
			[key]: value
		});
	}
	function removeColoredChat(index) {
		updateColoredChats($settingsStore().pages.chat.titleHighlights.filter((_, i) => i !== index));
	}
	init();
	{
		const action = ($$anchor) => {
			Button($$anchor, {
				type: "button",
				size: "icon-xs",
				variant: "outline",
				onclick: addColoredChat,
				children: ($$anchor, $$slotProps) => {
					PlusIcon($$anchor, {});
				},
				$$slots: { default: true }
			});
		};
		PreferenceSectionCard($$anchor, {
			title: "Colored Chats",
			action,
			children: ($$anchor, $$slotProps) => {
				var fragment_3 = comment();
				var node = first_child(fragment_3);
				var consequent = ($$anchor) => {
					var div = root_4$13();
					each(div, 5, () => $settingsStore().pages.chat.titleHighlights, index, ($$anchor, highlight, index) => {
						var div_1 = root_5$15();
						var div_2 = child(div_1);
						var node_1 = child(div_2);
						Input(node_1, {
							get value() {
								return get(highlight).title;
							},
							class: "h-7",
							placeholder: "Title",
							oninput: (event) => updateColoredChatField(index, "title", event.currentTarget.value)
						});
						var node_2 = sibling(node_1, 2);
						ItemSelect(node_2, {
							get items() {
								return colorOptions;
							},
							placeholder: "Color",
							get value() {
								return get(highlight).color;
							},
							onValueChange: (nextValue) => void updateColoredChatField(index, "color", nextValue)
						});
						Button(sibling(node_2, 2), {
							type: "button",
							size: "icon-sm",
							variant: "destructive",
							onclick: () => removeColoredChat(index),
							children: ($$anchor, $$slotProps) => {
								TrashIcon($$anchor, {});
							},
							$$slots: { default: true }
						});
						reset(div_2);
						reset(div_1);
						append($$anchor, div_1);
					});
					reset(div);
					append($$anchor, div);
				};
				var alternate = ($$anchor) => {
					append($$anchor, root_7$14());
				};
				if_block(node, ($$render) => {
					if ($settingsStore().pages.chat.titleHighlights.length) $$render(consequent);
					else $$render(alternate, -1);
				});
				append($$anchor, fragment_3);
			},
			$$slots: {
				action: true,
				default: true
			}
		});
	}
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/global/GlobalChatSection.svelte
var root_2$22 = from_html(`<!> <!> <!> <!> <!> <!>`, 1);
var root_1$16 = from_html(`<div class="grid gap-1"><!></div>`);
var root$24 = from_html(`<div class="space-y-2"><!> <!> <!></div>`);
function GlobalChatSection($$anchor) {
	var div = root$24();
	var node = child(div);
	PreferenceSectionCard(node, {
		children: ($$anchor, $$slotProps) => {
			var div_1 = root_1$16();
			PreferenceSettingGroup(child(div_1), {
				children: ($$anchor, $$slotProps) => {
					var fragment = root_2$22();
					var node_2 = first_child(fragment);
					StorageNumber(node_2, {
						path: "settings.pages.chat.fontSize",
						label: "Font size"
					});
					var node_3 = sibling(node_2, 2);
					StorageSwitch(node_3, {
						path: "settings.pages.chat.searchChat",
						label: "Search chat"
					});
					var node_4 = sibling(node_3, 2);
					StorageSwitch(node_4, {
						path: "settings.pages.chat.completeUsernames",
						label: "Autocomplete usernames"
					});
					var node_5 = sibling(node_4, 2);
					StorageSwitch(node_5, {
						path: "settings.pages.chat.tradeTimer",
						label: "Trade chat timer till next post"
					});
					var node_6 = sibling(node_5, 2);
					StorageSwitch(node_6, {
						path: "settings.pages.chat.hideChatButton",
						label: "Button for hiding chat"
					});
					StorageSwitch(sibling(node_6, 2), {
						path: "settings.pages.chat.resizable",
						label: "Make chats resizable"
					});
					append($$anchor, fragment);
				},
				$$slots: { default: true }
			});
			reset(div_1);
			append($$anchor, div_1);
		},
		$$slots: { default: true }
	});
	var node_8 = sibling(node, 2);
	ChatHighlights(node_8, {});
	ColoredChats(sibling(node_8, 2), {});
	reset(div);
	append($$anchor, div);
}
//#endregion
//#region src/common/utils/functions/api-external-revives.ts
var __DEFAULT_REVIVE_REQUEST = {
	method: "POST",
	relay: true,
	silent: true
};
function __requestStigFormat(vendor) {
	return (id, name, _country, _faction, source) => new Promise((resolve, reject) => {
		fetchData("stig", {
			...__DEFAULT_REVIVE_REQUEST,
			section: "request",
			body: {
				tornid: id.toString(),
				username: name,
				source,
				vendor,
				type: "revive"
			}
		}).then((response) => {
			if (Object.hasOwn(response, "contract")) resolve({
				response,
				contract: response["contract"]
			});
			else reject(response);
		}).catch((reason) => reject(reason));
	});
}
var REVIVE_PROVIDERS = [
	{
		provider: "nuke",
		name: "Nuke",
		origin: FETCH_PLATFORMS.nukefamily,
		doRequest: (id, name, country, _faction, source) => new Promise((resolve, reject) => {
			fetchData("nukefamily", {
				...__DEFAULT_REVIVE_REQUEST,
				section: "api/revive-request",
				body: {
					torn_player_id: id,
					torn_player_name: name,
					torn_player_country: country,
					app_info: source
				}
			}).then((response) => {
				if (response.success || response.data) resolve({ response });
				else reject(response);
			}).catch((reason) => reject(reason));
		}),
		price: {
			money: 18e5,
			xanax: 2
		}
	},
	{
		provider: "uhc",
		name: "UHC",
		origin: FETCH_PLATFORMS.uhc,
		doRequest: (id, name, _country, faction, source) => new Promise((resolve, reject) => {
			fetchData("uhc", {
				...__DEFAULT_REVIVE_REQUEST,
				section: "api/request",
				body: {
					userID: parseInt(id),
					userName: name,
					factionName: faction,
					source
				}
			}).then((response) => {
				if (response.success || !response.error) resolve({ response });
				else reject(response);
			}).catch((reason) => reject(reason));
		}),
		price: {
			money: 18e5,
			xanax: 2
		}
	},
	{
		provider: "wtf",
		name: "WTF",
		origin: FETCH_PLATFORMS.wtf,
		doRequest: (id, name, country, faction, source) => new Promise((resolve, reject) => {
			fetchData("wtf", {
				...__DEFAULT_REVIVE_REQUEST,
				section: "wtfapi/revive",
				body: {
					userID: id,
					userName: name,
					Faction: faction,
					Country: country,
					requestChannel: source
				}
			}).then((response) => {
				if (response.success) resolve({ response });
				else reject(response);
			}).catch((reason) => reject(reason));
		}),
		price: {
			money: 18e5,
			xanax: 2
		}
	},
	{
		provider: "shadow_healers",
		name: "Shadow Healers",
		origin: FETCH_PLATFORMS.stig,
		doRequest: __requestStigFormat("Shadow Healers"),
		price: {
			money: 18e5,
			xanax: 2
		}
	},
	{
		provider: "who",
		name: "The Wolverines",
		origin: FETCH_PLATFORMS.stig,
		doRequest: __requestStigFormat("The Wolverines"),
		price: {
			money: 1e6,
			xanax: 1
		}
	},
	{
		provider: "midnight_x",
		name: "Midnight X",
		origin: FETCH_PLATFORMS.stig,
		doRequest: __requestStigFormat("Midnight X"),
		price: {
			money: 18e5,
			xanax: 2
		}
	},
	{
		provider: "laekna",
		name: "Laekna",
		origin: FETCH_PLATFORMS.laekna,
		doRequest: (id, name, country, faction, source) => {
			return new Promise((resolve, reject) => {
				fetchData("laekna", {
					...__DEFAULT_REVIVE_REQUEST,
					section: "revive",
					body: {
						userID: id,
						userName: name,
						factionName: faction,
						travelLocation: country,
						source
					}
				}).then((response) => {
					if (response === "Posted" || response === "OK") resolve({ response: {} });
					else reject(response);
				}).catch((reason) => reject(reason));
			});
		},
		cooldown: TO_MILLIS.MINUTES * 2,
		price: {
			money: 18e5,
			xanax: 2
		}
	}
];
function calculateRevivePrice({ price }) {
	const parts = [];
	if (price?.money) parts.push(formatNumber(price.money, {
		currency: true,
		shorten: 3
	}));
	if (price?.xanax) parts.push(`${price.xanax} xan`);
	return parts.length > 0 ? parts.join(" or ") : "unknown";
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/PreferenceNote.svelte
var root$23 = from_html(`<span class="ml-2 mb-1 text-muted-foreground text-xs"> </span>`);
function PreferenceNote($$anchor, $$props) {
	var span = root$23();
	var text_1 = child(span, true);
	reset(span);
	template_effect(() => set_text(text_1, $$props.text));
	append($$anchor, span);
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/global/UserAliases.svelte
var root_5$14 = from_html(`<div class="rounded-md border border-border bg-background/60 p-2"><div class="grid gap-2 md:grid-cols-[8rem_1fr_1fr_28px]"><!> <!> <!> <!></div></div>`);
var root_7$13 = from_html(`<div class="rounded-md border border-border bg-background/60 p-2"><div class="grid gap-2 md:grid-cols-[8rem_1fr_1fr_28px]"><!> <!> <!> <!></div></div>`);
var root_4$12 = from_html(`<!> <!>`, 1);
var root_9$4 = from_html(`<p class="rounded-md border border-dashed border-border p-2 text-center text-muted-foreground">No aliases configured.</p>`);
var root_3$18 = from_html(`<div class="space-y-1"><!></div>`);
function UserAliases($$anchor, $$props) {
	push($$props, true);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let pendingAliases = state(proxy([]));
	let aliasIdDrafts = state(proxy({}));
	let nextPendingAliasId = 0;
	function parseUserId(value) {
		const trimmedValue = value.trim();
		if (!trimmedValue) return null;
		const userId = Number(trimmedValue);
		return Number.isInteger(userId) && userId > 0 ? userId : null;
	}
	function getAliasIdValue(index, userId) {
		return get(aliasIdDrafts)[index] ?? String(userId);
	}
	function hasInvalidAliasId(index) {
		return get(aliasIdDrafts)[index] !== void 0 && parseUserId(get(aliasIdDrafts)[index]) === null;
	}
	async function updateAliases(nextAliases) {
		await ttStorage.change({ settings: { userAlias: nextAliases } });
	}
	function addAlias() {
		set(pendingAliases, [...get(pendingAliases), {
			rowId: nextPendingAliasId++,
			userId: "",
			userName: "",
			alias: ""
		}], true);
	}
	function updateAlias(index, nextAlias) {
		const nextAliases = [...$settingsStore().userAlias];
		nextAliases[index] = nextAlias;
		updateAliases(nextAliases);
	}
	function updateAliasField(index, key, value) {
		const alias = $settingsStore().userAlias[index];
		if (!alias) return;
		updateAlias(index, {
			...alias,
			[key]: value
		});
	}
	function updateAliasUserId(index, value) {
		const alias = $settingsStore().userAlias[index];
		if (!alias) return;
		set(aliasIdDrafts, {
			...get(aliasIdDrafts),
			[index]: value
		}, true);
		const userId = parseUserId(value);
		if (userId === null) return;
		const { [index]: _savedDraft, ...nextDrafts } = get(aliasIdDrafts);
		set(aliasIdDrafts, nextDrafts, true);
		updateAlias(index, {
			...alias,
			userId
		});
	}
	function savePendingAlias(pendingAlias) {
		const userId = parseUserId(pendingAlias.userId);
		if (userId === null) return;
		updateAliases([...$settingsStore().userAlias, {
			userId,
			userName: pendingAlias.userName.trim() || null,
			alias: pendingAlias.alias
		}]);
		set(pendingAliases, get(pendingAliases).filter(({ rowId }) => rowId !== pendingAlias.rowId), true);
	}
	function savePendingAliasOnFocusOut(event, pendingAlias) {
		if (event.currentTarget instanceof HTMLElement && event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
		savePendingAlias(pendingAlias);
	}
	function removeAlias(index) {
		const { [index]: _removedDraft, ...nextDrafts } = get(aliasIdDrafts);
		set(aliasIdDrafts, nextDrafts, true);
		updateAliases($settingsStore().userAlias.filter((_, aliasIndex) => aliasIndex !== index));
	}
	function removePendingAlias(rowId) {
		set(pendingAliases, get(pendingAliases).filter((pendingAlias) => pendingAlias.rowId !== rowId), true);
	}
	function updatePendingAlias(rowId, key, value) {
		set(pendingAliases, get(pendingAliases).map((pendingAlias) => pendingAlias.rowId === rowId ? {
			...pendingAlias,
			[key]: value
		} : pendingAlias), true);
	}
	{
		const action = ($$anchor) => {
			Button($$anchor, {
				type: "button",
				size: "icon-xs",
				variant: "outline",
				onclick: addAlias,
				children: ($$anchor, $$slotProps) => {
					PlusIcon($$anchor, {});
				},
				$$slots: { default: true }
			});
		};
		PreferenceSectionCard($$anchor, {
			title: "User Aliases",
			action,
			children: ($$anchor, $$slotProps) => {
				var div = root_3$18();
				var node = child(div);
				var consequent = ($$anchor) => {
					var fragment_3 = root_4$12();
					var node_1 = first_child(fragment_3);
					each(node_1, 1, () => $settingsStore().userAlias, index, ($$anchor, alias, index) => {
						var div_1 = root_5$14();
						var div_2 = child(div_1);
						var node_2 = child(div_2);
						{
							let $0 = user_derived(() => getAliasIdValue(index, get(alias).userId));
							let $1 = user_derived(() => `h-7 ${hasInvalidAliasId(index) ? "border-destructive focus-visible:ring-destructive/30" : ""}`);
							Input(node_2, {
								get value() {
									return get($0);
								},
								get class() {
									return get($1);
								},
								placeholder: "User ID",
								inputmode: "numeric",
								oninput: (event) => updateAliasUserId(index, event.currentTarget.value)
							});
						}
						var node_3 = sibling(node_2, 2);
						{
							let $0 = user_derived(() => get(alias).userName ?? "");
							Input(node_3, {
								get value() {
									return get($0);
								},
								class: "h-7",
								placeholder: "Name",
								oninput: (event) => updateAliasField(index, "userName", event.currentTarget.value.trim() || null)
							});
						}
						var node_4 = sibling(node_3, 2);
						Input(node_4, {
							get value() {
								return get(alias).alias;
							},
							class: "h-7",
							placeholder: "Alias",
							oninput: (event) => updateAliasField(index, "alias", event.currentTarget.value)
						});
						Button(sibling(node_4, 2), {
							type: "button",
							size: "icon-sm",
							variant: "destructive",
							onclick: () => removeAlias(index),
							children: ($$anchor, $$slotProps) => {
								TrashIcon($$anchor, {});
							},
							$$slots: { default: true }
						});
						reset(div_2);
						reset(div_1);
						append($$anchor, div_1);
					});
					each(sibling(node_1, 2), 17, () => get(pendingAliases), (pendingAlias) => pendingAlias.rowId, ($$anchor, pendingAlias, $$index_1) => {
						var div_3 = root_7$13();
						var div_4 = child(div_3);
						var node_7 = child(div_4);
						{
							let $0 = user_derived(() => `h-7 ${parseUserId(get(pendingAlias).userId) === null ? "border-destructive focus-visible:ring-destructive/30" : ""}`);
							Input(node_7, {
								get class() {
									return get($0);
								},
								placeholder: "User ID",
								inputmode: "numeric",
								onkeydown: (event) => {
									if (event.key === "Enter") savePendingAlias(get(pendingAlias));
								},
								get value() {
									return get(pendingAlias).userId;
								},
								set value($$value) {
									get(pendingAlias).userId = $$value;
								}
							});
						}
						var node_8 = sibling(node_7, 2);
						Input(node_8, {
							get value() {
								return get(pendingAlias).userName;
							},
							class: "h-7",
							placeholder: "Name",
							oninput: (event) => updatePendingAlias(get(pendingAlias).rowId, "userName", event.currentTarget.value)
						});
						var node_9 = sibling(node_8, 2);
						Input(node_9, {
							get value() {
								return get(pendingAlias).alias;
							},
							class: "h-7",
							placeholder: "Alias",
							oninput: (event) => updatePendingAlias(get(pendingAlias).rowId, "alias", event.currentTarget.value)
						});
						Button(sibling(node_9, 2), {
							type: "button",
							size: "icon-sm",
							variant: "destructive",
							onclick: () => removePendingAlias(get(pendingAlias).rowId),
							children: ($$anchor, $$slotProps) => {
								TrashIcon($$anchor, {});
							},
							$$slots: { default: true }
						});
						reset(div_4);
						reset(div_3);
						delegated("focusout", div_3, (event) => savePendingAliasOnFocusOut(event, get(pendingAlias)));
						append($$anchor, div_3);
					});
					append($$anchor, fragment_3);
				};
				var alternate = ($$anchor) => {
					append($$anchor, root_9$4());
				};
				if_block(node, ($$render) => {
					if ($settingsStore().userAlias.length || get(pendingAliases).length) $$render(consequent);
					else $$render(alternate, -1);
				});
				reset(div);
				append($$anchor, div);
			},
			$$slots: {
				action: true,
				default: true
			}
		});
	}
	pop();
	$$cleanup();
}
delegate(["focusout"]);
//#endregion
//#region src/extension/entrypoints/options/components/preferences/global/GlobalSection.svelte
var root_2$21 = from_html(`<!> <!> <!> <!>`, 1);
var root_3$17 = from_html(`<!> <!> <!> <!> <!> <!> <!> <!> <!> <!> <!>`, 1);
var root_5$13 = from_html(`<!> <!> <!>`, 1);
var root_1$15 = from_html(`<!> <!> <!> <!>`, 1);
var root$22 = from_html(`<div class="space-y-2"><!> <!></div>`);
function GlobalSection($$anchor, $$props) {
	push($$props, false);
	const reviveOptions = [{
		value: "",
		label: "none"
	}, ...REVIVE_PROVIDERS.map((provider) => ({
		value: provider.provider,
		label: `${provider.name} (${calculateRevivePrice(provider)})`
	}))];
	async function requestReviveProviderPermission(provider) {
		if (!provider) return true;
		const origin = REVIVE_PROVIDERS.find((p) => p.provider === provider)?.origin;
		if (!origin) return false;
		if (!browser.permissions) {
			toast.error("There was an issue when requesting additional permissions. Please go to the normal settings page.");
			return false;
		}
		if (!await browser.permissions.request({ origins: [origin] })) {
			toast.error("Can't select this provider without accepting the permission.");
			return false;
		}
		return true;
	}
	init();
	var div = root$22();
	var node = child(div);
	PreferenceSectionCard(node, {
		title: "Global",
		children: ($$anchor, $$slotProps) => {
			var fragment = root_1$15();
			var node_1 = first_child(fragment);
			StorageSelect(node_1, {
				items: [{
					value: "default",
					label: "Default (green and black)"
				}, {
					value: "alternative",
					label: "Alternative (black and green)"
				}],
				path: "settings.themes.containers",
				label: "Container Theme"
			});
			var node_2 = sibling(node_1, 2);
			PreferenceSettingGroup(node_2, {
				title: "Formatting",
				children: ($$anchor, $$slotProps) => {
					var fragment_1 = root_2$21();
					var node_3 = first_child(fragment_1);
					StorageText(node_3, {
						path: "settings.csvDelimiter",
						label: "CSV Delimiter"
					});
					var node_4 = sibling(node_3, 2);
					StorageSelect(node_4, {
						items: [
							{
								value: "eu",
								label: "DD.MM.YYYY"
							},
							{
								value: "us",
								label: "MM/DD/YYYY"
							},
							{
								value: "iso",
								label: "YYYY-MM-DD"
							}
						],
						path: "settings.formatting.date",
						label: "Date Format"
					});
					var node_5 = sibling(node_4, 2);
					StorageSelect(node_5, {
						items: [{
							value: "eu",
							label: "24 hours"
						}, {
							value: "us",
							label: "12 hours"
						}],
						path: "settings.formatting.time",
						label: "Time Format"
					});
					StorageSwitch(sibling(node_5, 2), {
						path: "settings.formatting.tct",
						label: "Show times in TCT"
					});
					append($$anchor, fragment_1);
				},
				$$slots: { default: true }
			});
			var node_7 = sibling(node_2, 2);
			PreferenceSettingGroup(node_7, {
				children: ($$anchor, $$slotProps) => {
					var fragment_2 = root_3$17();
					var node_8 = first_child(fragment_2);
					StorageSwitch(node_8, {
						path: "settings.pages.global.alignLeft",
						label: "Align left"
					});
					var node_9 = sibling(node_8, 2);
					StorageSwitch(node_9, {
						path: "settings.pages.global.keepAttackHistory",
						label: "Keep attack history"
					});
					var node_10 = sibling(node_9, 2);
					StorageSwitch(node_10, {
						path: "settings.pages.global.hideLevelUpgrade",
						label: "Hide level upgrade"
					});
					var node_11 = sibling(node_10, 2);
					StorageSwitch(node_11, {
						path: "settings.pages.global.hideTutorials",
						label: "Hide tutorials"
					});
					var node_12 = sibling(node_11, 2);
					StorageSwitch(node_12, {
						path: "settings.pages.global.hideQuitButtons",
						label: "Hide leave and quit buttons"
					});
					var node_13 = sibling(node_12, 2);
					StorageSwitch(node_13, {
						path: "settings.pages.global.miniProfileLastAction",
						label: "Last action in mini profile"
					});
					var node_14 = sibling(node_13, 2);
					StorageSwitch(node_14, {
						path: "settings.pages.global.stackingMode",
						label: "Stacking mode",
						description: "This disables gym, attacks, revives, dump searching and hunting."
					});
					var node_15 = sibling(node_14, 2);
					StorageSwitch(node_15, {
						path: "settings.pages.global.noOutsideLinkAlert",
						label: "No outside link alert",
						description: "This disables the outside link protection by Torn, be careful about clicking links."
					});
					var node_16 = sibling(node_15, 2);
					StorageSwitch(node_16, {
						path: "settings.pages.global.pageTitles",
						label: "Clearer page titles"
					});
					var node_17 = sibling(node_16, 2);
					StorageSwitch(node_17, {
						path: "settings.pages.global.urlFill",
						label: "URL Fill",
						description: "Allow URLs to be prefilled for you with values."
					});
					StorageSwitch(sibling(node_17, 2), {
						path: "settings.pages.competitions.easterEggs",
						label: "Highlight Easter Eggs",
						description: "During the Easter event, highlight eggs that appear on your screen.",
						children: ($$anchor, $$slotProps) => {
							StorageSwitch($$anchor, {
								path: "settings.pages.competitions.easterEggsAlert",
								label: "with alert"
							});
						},
						$$slots: { default: true }
					});
					append($$anchor, fragment_2);
				},
				$$slots: { default: true }
			});
			PreferenceSettingGroup(sibling(node_7, 2), {
				title: "Revives",
				contentClass: "grid",
				children: ($$anchor, $$slotProps) => {
					var fragment_4 = root_5$13();
					var node_20 = first_child(fragment_4);
					PreferenceNote(node_20, { text: "Revive prices vary per revive provider. They can be changed at their will. We have no connection to any revive provider ourselves." });
					var node_21 = sibling(node_20, 2);
					PreferenceNote(node_21, { text: "Your API key is NOT shared with any of these services." });
					StorageSelect(sibling(node_21, 2), {
						get items() {
							return reviveOptions;
						},
						path: "settings.pages.global.reviveProvider",
						label: "Revive Provider",
						beforeValueChange: requestReviveProviderPermission
					});
					append($$anchor, fragment_4);
				},
				$$slots: { default: true }
			});
			append($$anchor, fragment);
		},
		$$slots: { default: true }
	});
	UserAliases(sibling(node, 2), {});
	reset(div);
	append($$anchor, div);
	pop();
}
//#endregion
//#region node_modules/phosphor-svelte/lib/ArrowDownIcon.svelte
var root_2$20 = from_svg(`<path d="M208.49,152.49l-72,72a12,12,0,0,1-17,0l-72-72a12,12,0,0,1,17-17L116,187V40a12,12,0,0,1,24,0V187l51.51-51.52a12,12,0,0,1,17,17Z"></path>`);
var root_3$16 = from_svg(`<path d="M200,144l-72,72L56,144Z" opacity="0.2"></path><path d="M207.39,140.94A8,8,0,0,0,200,136H136V40a8,8,0,0,0-16,0v96H56a8,8,0,0,0-5.66,13.66l72,72a8,8,0,0,0,11.32,0l72-72A8,8,0,0,0,207.39,140.94ZM128,204.69,75.31,152H180.69Z"></path>`, 1);
var root_4$11 = from_svg(`<path d="M205.66,149.66l-72,72a8,8,0,0,1-11.32,0l-72-72A8,8,0,0,1,56,136h64V40a8,8,0,0,1,16,0v96h64a8,8,0,0,1,5.66,13.66Z"></path>`);
var root_5$12 = from_svg(`<path d="M204.24,148.24l-72,72a6,6,0,0,1-8.48,0l-72-72a6,6,0,0,1,8.48-8.48L122,201.51V40a6,6,0,0,1,12,0V201.51l61.76-61.75a6,6,0,0,1,8.48,8.48Z"></path>`);
var root_6$12 = from_svg(`<path d="M205.66,149.66l-72,72a8,8,0,0,1-11.32,0l-72-72a8,8,0,0,1,11.32-11.32L120,196.69V40a8,8,0,0,1,16,0V196.69l58.34-58.35a8,8,0,0,1,11.32,11.32Z"></path>`);
var root_7$12 = from_svg(`<path d="M202.83,146.83l-72,72a4,4,0,0,1-5.66,0l-72-72a4,4,0,0,1,5.66-5.66L124,206.34V40a4,4,0,0,1,8,0V206.34l65.17-65.17a4,4,0,0,1,5.66,5.66Z"></path>`);
var root$21 = from_svg(`<svg><!><rect width="256" height="256" fill="none"></rect><!></svg>`);
function ArrowDownIcon($$anchor, $$props) {
	push($$props, true);
	const ctx = getIconContext();
	let props = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"children"
	]);
	let weight = user_derived(() => $$props.weight ?? ctx.weight ?? "regular");
	let color = user_derived(() => $$props.color ?? ctx.color ?? "currentColor");
	let size = user_derived(() => $$props.size ?? ctx.size ?? "1em");
	let mirrored = user_derived(() => $$props.mirrored ?? ctx.mirrored ?? false);
	function svgAttr(obj) {
		let { weight, color, size, mirrored, ...attrs } = obj;
		return attrs;
	}
	var svg = root$21();
	attribute_effect(svg, ($0, $1) => ({
		xmlns: "http://www.w3.org/2000/svg",
		role: "img",
		width: get(size),
		height: get(size),
		fill: get(color),
		transform: get(mirrored) ? "scale(-1, 1)" : void 0,
		viewBox: "0 0 256 256",
		...$0,
		...$1
	}), [() => svgAttr(ctx), () => svgAttr(props)]);
	var node = child(svg);
	var consequent = ($$anchor) => {
		var fragment = comment();
		snippet(first_child(fragment), () => $$props.children);
		append($$anchor, fragment);
	};
	if_block(node, ($$render) => {
		if ($$props.children) $$render(consequent);
	});
	var node_2 = sibling(node, 2);
	var consequent_1 = ($$anchor) => {
		append($$anchor, root_2$20());
	};
	var consequent_2 = ($$anchor) => {
		var fragment_1 = root_3$16();
		next();
		append($$anchor, fragment_1);
	};
	var consequent_3 = ($$anchor) => {
		append($$anchor, root_4$11());
	};
	var consequent_4 = ($$anchor) => {
		append($$anchor, root_5$12());
	};
	var consequent_5 = ($$anchor) => {
		append($$anchor, root_6$12());
	};
	var consequent_6 = ($$anchor) => {
		append($$anchor, root_7$12());
	};
	var alternate = ($$anchor) => {
		var text$13 = text();
		text$13.nodeValue = (console.error("Unsupported icon weight. Choose from \"thin\", \"light\", \"regular\", \"bold\", \"fill\", or \"duotone\"."), "");
		append($$anchor, text$13);
	};
	if_block(node_2, ($$render) => {
		if (get(weight) === "bold") $$render(consequent_1);
		else if (get(weight) === "duotone") $$render(consequent_2, 1);
		else if (get(weight) === "fill") $$render(consequent_3, 2);
		else if (get(weight) === "light") $$render(consequent_4, 3);
		else if (get(weight) === "regular") $$render(consequent_5, 4);
		else if (get(weight) === "thin") $$render(consequent_6, 5);
		else $$render(alternate, -1);
	});
	reset(svg);
	append($$anchor, svg);
	pop();
}
//#endregion
//#region node_modules/phosphor-svelte/lib/ArrowUpIcon.svelte
var root_2$19 = from_svg(`<path d="M208.49,120.49a12,12,0,0,1-17,0L140,69V216a12,12,0,0,1-24,0V69L64.49,120.49a12,12,0,0,1-17-17l72-72a12,12,0,0,1,17,0l72,72A12,12,0,0,1,208.49,120.49Z"></path>`);
var root_3$15 = from_svg(`<path d="M200,112H56l72-72Z" opacity="0.2"></path><path d="M205.66,106.34l-72-72a8,8,0,0,0-11.32,0l-72,72A8,8,0,0,0,56,120h64v96a8,8,0,0,0,16,0V120h64a8,8,0,0,0,5.66-13.66ZM75.31,104,128,51.31,180.69,104Z"></path>`, 1);
var root_4$10 = from_svg(`<path d="M207.39,115.06A8,8,0,0,1,200,120H136v96a8,8,0,0,1-16,0V120H56a8,8,0,0,1-5.66-13.66l72-72a8,8,0,0,1,11.32,0l72,72A8,8,0,0,1,207.39,115.06Z"></path>`);
var root_5$11 = from_svg(`<path d="M204.24,116.24a6,6,0,0,1-8.48,0L134,54.49V216a6,6,0,0,1-12,0V54.49L60.24,116.24a6,6,0,0,1-8.48-8.48l72-72a6,6,0,0,1,8.48,0l72,72A6,6,0,0,1,204.24,116.24Z"></path>`);
var root_6$11 = from_svg(`<path d="M205.66,117.66a8,8,0,0,1-11.32,0L136,59.31V216a8,8,0,0,1-16,0V59.31L61.66,117.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0l72,72A8,8,0,0,1,205.66,117.66Z"></path>`);
var root_7$11 = from_svg(`<path d="M202.83,114.83a4,4,0,0,1-5.66,0L132,49.66V216a4,4,0,0,1-8,0V49.66L58.83,114.83a4,4,0,0,1-5.66-5.66l72-72a4,4,0,0,1,5.66,0l72,72A4,4,0,0,1,202.83,114.83Z"></path>`);
var root$20 = from_svg(`<svg><!><rect width="256" height="256" fill="none"></rect><!></svg>`);
function ArrowUpIcon($$anchor, $$props) {
	push($$props, true);
	const ctx = getIconContext();
	let props = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"children"
	]);
	let weight = user_derived(() => $$props.weight ?? ctx.weight ?? "regular");
	let color = user_derived(() => $$props.color ?? ctx.color ?? "currentColor");
	let size = user_derived(() => $$props.size ?? ctx.size ?? "1em");
	let mirrored = user_derived(() => $$props.mirrored ?? ctx.mirrored ?? false);
	function svgAttr(obj) {
		let { weight, color, size, mirrored, ...attrs } = obj;
		return attrs;
	}
	var svg = root$20();
	attribute_effect(svg, ($0, $1) => ({
		xmlns: "http://www.w3.org/2000/svg",
		role: "img",
		width: get(size),
		height: get(size),
		fill: get(color),
		transform: get(mirrored) ? "scale(-1, 1)" : void 0,
		viewBox: "0 0 256 256",
		...$0,
		...$1
	}), [() => svgAttr(ctx), () => svgAttr(props)]);
	var node = child(svg);
	var consequent = ($$anchor) => {
		var fragment = comment();
		snippet(first_child(fragment), () => $$props.children);
		append($$anchor, fragment);
	};
	if_block(node, ($$render) => {
		if ($$props.children) $$render(consequent);
	});
	var node_2 = sibling(node, 2);
	var consequent_1 = ($$anchor) => {
		append($$anchor, root_2$19());
	};
	var consequent_2 = ($$anchor) => {
		var fragment_1 = root_3$15();
		next();
		append($$anchor, fragment_1);
	};
	var consequent_3 = ($$anchor) => {
		append($$anchor, root_4$10());
	};
	var consequent_4 = ($$anchor) => {
		append($$anchor, root_5$11());
	};
	var consequent_5 = ($$anchor) => {
		append($$anchor, root_6$11());
	};
	var consequent_6 = ($$anchor) => {
		append($$anchor, root_7$11());
	};
	var alternate = ($$anchor) => {
		var text$12 = text();
		text$12.nodeValue = (console.error("Unsupported icon weight. Choose from \"thin\", \"light\", \"regular\", \"bold\", \"fill\", or \"duotone\"."), "");
		append($$anchor, text$12);
	};
	if_block(node_2, ($$render) => {
		if (get(weight) === "bold") $$render(consequent_1);
		else if (get(weight) === "duotone") $$render(consequent_2, 1);
		else if (get(weight) === "fill") $$render(consequent_3, 2);
		else if (get(weight) === "light") $$render(consequent_4, 3);
		else if (get(weight) === "regular") $$render(consequent_5, 4);
		else if (get(weight) === "thin") $$render(consequent_6, 5);
		else $$render(alternate, -1);
	});
	reset(svg);
	append($$anchor, svg);
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/global/CustomLinks.svelte
var root_5$10 = from_html(`<div class="rounded-md border border-border bg-background/60 p-2"><div class="grid gap-2 lg:grid-cols-[12rem_15rem_1fr]"><!> <!> <!></div> <!> <div class="mt-2 flex flex-wrap gap-1.5"><!> <!> <!> <div class="flex items-center w-full max-w-sm gap-1.5"><!> <!></div></div></div>`);
var root_4$9 = from_html(`<div class="space-y-1"></div>`);
var root_11$3 = from_html(`<p class="rounded-md border border-dashed border-border p-2 text-center text-muted-foreground">No custom links configured.</p>`);
function CustomLinks($$anchor, $$props) {
	push($$props, false);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const locationOptions = [
		{
			value: "above",
			label: "Above all areas"
		},
		{
			value: "under",
			label: "Under all areas"
		},
		...ALL_AREAS.flatMap((area) => [{
			value: `above_${area.class}`,
			label: `Above ${area.text}`
		}, {
			value: `under_${area.class}`,
			label: `Under ${area.text}`
		}])
	];
	const presetOptions = [{
		value: "custom",
		label: "Custom"
	}, ...Object.keys(CUSTOM_LINKS_PRESET).map((preset) => ({
		value: preset,
		label: preset.replaceAll("_", " ")
	}))];
	async function updateCustomLinks(nextLinks) {
		await ttStorage.change({ settings: { customLinks: nextLinks } });
	}
	function addCustomLink() {
		updateCustomLinks([...$settingsStore().customLinks, {
			newTab: false,
			location: "above",
			name: "",
			href: ""
		}]);
	}
	function updateCustomLink(index, nextLink) {
		const nextLinks = [...$settingsStore().customLinks];
		nextLinks[index] = nextLink;
		updateCustomLinks(nextLinks);
	}
	function updateCustomLinkField(index, key, value) {
		const link = $settingsStore().customLinks[index];
		if (!link) return;
		updateCustomLink(index, {
			...link,
			[key]: value
		});
	}
	function updateCustomLinkHref(index, href) {
		const link = $settingsStore().customLinks[index];
		if (!link || !("href" in link)) return;
		updateCustomLink(index, {
			...link,
			href
		});
	}
	function updateCustomLinkPreset(index, preset) {
		const link = $settingsStore().customLinks[index];
		if (!link) return;
		if (preset === "custom") {
			updateCustomLink(index, {
				newTab: link.newTab,
				location: link.location,
				name: link.name,
				href: "href" in link ? link.href : ""
			});
			return;
		}
		updateCustomLink(index, {
			newTab: link.newTab,
			location: link.location,
			name: preset.replaceAll("_", " "),
			preset
		});
	}
	function moveCustomLink(index, direction) {
		const nextIndex = index + direction;
		if (nextIndex < 0 || nextIndex >= $settingsStore().customLinks.length) return;
		const nextLinks = [...$settingsStore().customLinks];
		[nextLinks[index], nextLinks[nextIndex]] = [nextLinks[nextIndex], nextLinks[index]];
		updateCustomLinks(nextLinks);
	}
	function removeCustomLink(index) {
		updateCustomLinks($settingsStore().customLinks.filter((_, linkIndex) => linkIndex !== index));
	}
	init();
	{
		const action = ($$anchor) => {
			Button($$anchor, {
				type: "button",
				size: "icon-xs",
				variant: "outline",
				onclick: addCustomLink,
				children: ($$anchor, $$slotProps) => {
					PlusIcon($$anchor, {});
				},
				$$slots: { default: true }
			});
		};
		PreferenceSectionCard($$anchor, {
			title: "Custom Links",
			action,
			children: ($$anchor, $$slotProps) => {
				var fragment_3 = comment();
				var node = first_child(fragment_3);
				var consequent_1 = ($$anchor) => {
					var div = root_4$9();
					each(div, 5, () => $settingsStore().customLinks, index, ($$anchor, link, index) => {
						var div_1 = root_5$10();
						var div_2 = child(div_1);
						var node_1 = child(div_2);
						ItemSelect(node_1, {
							get items() {
								return locationOptions;
							},
							placeholder: "Location",
							get value() {
								return get(link).location;
							},
							onValueChange: (value) => updateCustomLinkField(index, "location", value)
						});
						var node_2 = sibling(node_1, 2);
						{
							let $0 = derived_safe_equal(() => "preset" in get(link) ? get(link).preset : "custom");
							ItemSelect(node_2, {
								get items() {
									return presetOptions;
								},
								placeholder: "Preset",
								get value() {
									return get($0);
								},
								onValueChange: (value) => updateCustomLinkPreset(index, value)
							});
						}
						Input(sibling(node_2, 2), {
							get value() {
								return get(link).name;
							},
							class: "h-7",
							placeholder: "Label",
							oninput: (event) => updateCustomLinkField(index, "name", event.currentTarget.value)
						});
						reset(div_2);
						var node_4 = sibling(div_2, 2);
						var consequent = ($$anchor) => {
							Input($$anchor, {
								get value() {
									return get(link).href;
								},
								placeholder: "https://example.com/",
								oninput: (event) => updateCustomLinkHref(index, event.currentTarget.value),
								class: "mt-2"
							});
						};
						if_block(node_4, ($$render) => {
							if ("href" in get(link)) $$render(consequent);
						});
						var div_3 = sibling(node_4, 2);
						var node_5 = child(div_3);
						Button(node_5, {
							type: "button",
							size: "xs",
							variant: "outline",
							disabled: index === 0,
							onclick: () => moveCustomLink(index, -1),
							children: ($$anchor, $$slotProps) => {
								ArrowUpIcon($$anchor, {});
							},
							$$slots: { default: true }
						});
						var node_6 = sibling(node_5, 2);
						{
							let $0 = derived_safe_equal(() => index === $settingsStore().customLinks.length - 1);
							Button(node_6, {
								type: "button",
								size: "xs",
								variant: "outline",
								get disabled() {
									return get($0);
								},
								onclick: () => moveCustomLink(index, 1),
								children: ($$anchor, $$slotProps) => {
									ArrowDownIcon($$anchor, {});
								},
								$$slots: { default: true }
							});
						}
						var node_7 = sibling(node_6, 2);
						Button(node_7, {
							type: "button",
							size: "icon-xs",
							variant: "destructive",
							onclick: () => removeCustomLink(index),
							children: ($$anchor, $$slotProps) => {
								TrashIcon($$anchor, {});
							},
							$$slots: { default: true }
						});
						var div_4 = sibling(node_7, 2);
						var node_8 = child(div_4);
						Label(node_8, {
							for: `new-tab_${index}`,
							class: "text-xs",
							children: ($$anchor, $$slotProps) => {
								next();
								append($$anchor, text("New tab"));
							},
							$$slots: { default: true }
						});
						Switch(sibling(node_8, 2), {
							id: `new-tab_${index}`,
							size: "sm",
							get checked() {
								return get(link).newTab;
							},
							onCheckedChange: (checked) => updateCustomLinkField(index, "newTab", checked)
						});
						reset(div_4);
						reset(div_3);
						reset(div_1);
						append($$anchor, div_1);
					});
					reset(div);
					append($$anchor, div);
				};
				var alternate = ($$anchor) => {
					append($$anchor, root_11$3());
				};
				if_block(node, ($$render) => {
					if ($settingsStore().customLinks.length) $$render(consequent_1);
					else $$render(alternate, -1);
				});
				append($$anchor, fragment_3);
			},
			$$slots: {
				action: true,
				default: true
			}
		});
	}
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/global/OfficialIcon.svelte
var root$19 = from_html(`<span class="icon svelte-zigx8g"></span>`);
function OfficialIcon($$anchor, $$props) {
	let offset = user_derived(() => -(($$props.icon - 1) * 18));
	var span = root$19();
	template_effect(() => set_style(span, `background-position: ${get(offset) ?? ""}px 0`));
	append($$anchor, span);
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/global/GlobalSidebarSection.svelte
var root_2$18 = from_html(`<!> <!> <!> <!> <!> <!> <!> <!> <!>`, 1);
var root_5$9 = from_html(`<!> <!>`, 1);
var root_4$8 = from_html(`<!> <!> <!> <!> <!> <!>`, 1);
var root_6$10 = from_html(`<!> <!> <!> <!> <!>`, 1);
var root_7$10 = from_html(`<!> <!>`, 1);
var root_1$14 = from_html(`<div class="grid gap-1"><!> <!> <!> <!></div>`);
var root_12$1 = from_html(`<!> <!>`, 1);
var root_10$3 = from_html(`<div class="flex flex-wrap gap-1"></div>`);
var root$18 = from_html(`<div class="space-y-2"><!> <!> <!></div>`);
function GlobalSidebarSection($$anchor, $$props) {
	push($$props, true);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const npcServiceOptions = [
		{
			value: "tornstats",
			label: "TornStats"
		},
		{
			value: "yata",
			label: "YATA"
		},
		{
			value: "loot-ranger",
			label: "Loot Rangers (service = LZPT)"
		}
	];
	const hiddenIconCount = user_derived(() => $settingsStore().hideIcons.length);
	async function updateHiddenIcons(nextIcons) {
		await ttStorage.change({ settings: { hideIcons: nextIcons } });
	}
	function toggleHiddenIcon(icon) {
		const current = $settingsStore().hideIcons;
		updateHiddenIcons(current.includes(icon) ? current.filter((entry) => entry !== icon) : [...current, icon]);
	}
	var div = root$18();
	var node = child(div);
	PreferenceSectionCard(node, {
		children: ($$anchor, $$slotProps) => {
			var div_1 = root_1$14();
			var node_1 = child(div_1);
			PreferenceSettingGroup(node_1, {
				children: ($$anchor, $$slotProps) => {
					var fragment = root_2$18();
					var node_2 = first_child(fragment);
					StorageSwitch(node_2, {
						path: "settings.pages.sidebar.notes",
						label: "Sidebar notes"
					});
					var node_3 = sibling(node_2, 2);
					StorageSwitch(node_3, {
						path: "settings.pages.sidebar.companyAddictionLevel",
						label: "Company addiction level",
						description: "Only works if you are a company employee. Working in a city job or being a director doesn't provide this information."
					});
					var node_4 = sibling(node_3, 2);
					StorageSwitch(node_4, {
						path: "settings.pages.sidebar.showJobPointsToolTip",
						label: "Job points tooltip"
					});
					var node_5 = sibling(node_4, 2);
					StorageSwitch(node_5, {
						path: "settings.pages.sidebar.barLinks",
						label: "Make the energy and nerve bar link to a related page"
					});
					var node_6 = sibling(node_5, 2);
					StorageSwitch(node_6, {
						path: "settings.pages.sidebar.highlightEnergy",
						label: "Highlight energy when refill is unused"
					});
					var node_7 = sibling(node_6, 2);
					StorageSwitch(node_7, {
						path: "settings.pages.sidebar.highlightNerve",
						label: "Highlight nerve when refill is unused"
					});
					var node_8 = sibling(node_7, 2);
					StorageSwitch(node_8, {
						path: "settings.pages.sidebar.pointsValue",
						label: "Points value"
					});
					var node_9 = sibling(node_8, 2);
					StorageSwitch(node_9, {
						path: "settings.updateNotice",
						label: "Extension update notice"
					});
					StorageSwitch(sibling(node_9, 2), {
						path: "settings.scripts.achievements.show",
						label: "Display achievements",
						children: ($$anchor, $$slotProps) => {
							StorageSwitch($$anchor, {
								path: "settings.scripts.achievements.completed",
								label: "show completed"
							});
						},
						$$slots: { default: true }
					});
					append($$anchor, fragment);
				},
				$$slots: { default: true }
			});
			var node_11 = sibling(node_1, 2);
			PreferenceSettingGroup(node_11, {
				title: "Timers",
				children: ($$anchor, $$slotProps) => {
					var fragment_2 = root_4$8();
					var node_12 = first_child(fragment_2);
					StorageSwitch(node_12, {
						path: "settings.pages.sidebar.ocTimer",
						label: "OC 1.0 ready time"
					});
					var node_13 = sibling(node_12, 2);
					StorageSwitch(node_13, {
						path: "settings.pages.sidebar.oc2Timer",
						label: "OC 2.0 ready time",
						children: ($$anchor, $$slotProps) => {
							var fragment_3 = root_5$9();
							var node_14 = first_child(fragment_3);
							StorageSwitch(node_14, {
								path: "settings.pages.sidebar.oc2TimerLevel",
								label: "include crime level"
							});
							StorageSwitch(sibling(node_14, 2), {
								path: "settings.pages.sidebar.oc2TimerPosition",
								label: "include crime name and position"
							});
							append($$anchor, fragment_3);
						},
						$$slots: { default: true }
					});
					var node_16 = sibling(node_13, 2);
					StorageSwitch(node_16, {
						path: "settings.pages.sidebar.factionOCTimer",
						label: "Faction OC 1.0 ready time"
					});
					var node_17 = sibling(node_16, 2);
					StorageSwitch(node_17, {
						path: "settings.pages.sidebar.cooldownEndTimes",
						label: "Cooldown end times"
					});
					var node_18 = sibling(node_17, 2);
					StorageSwitch(node_18, {
						path: "settings.pages.sidebar.rwTimer",
						label: "Ranked war timer"
					});
					StorageSwitch(sibling(node_18, 2), {
						path: "settings.pages.sidebar.virusTimer",
						label: "Virus timer"
					});
					append($$anchor, fragment_2);
				},
				$$slots: { default: true }
			});
			var node_20 = sibling(node_11, 2);
			PreferenceSettingGroup(node_20, {
				title: "Areas",
				children: ($$anchor, $$slotProps) => {
					var fragment_4 = root_6$10();
					var node_21 = first_child(fragment_4);
					StorageSwitch(node_21, {
						path: "settings.pages.sidebar.collapseAreas",
						label: "Collapsible areas"
					});
					var node_22 = sibling(node_21, 2);
					StorageSwitch(node_22, {
						path: "settings.pages.sidebar.settingsLink",
						label: "TT settings link"
					});
					var node_23 = sibling(node_22, 2);
					StorageSwitch(node_23, {
						path: "settings.pages.sidebar.hideGymHighlight",
						label: "Hide gym highlight"
					});
					var node_24 = sibling(node_23, 2);
					StorageSwitch(node_24, {
						path: "settings.pages.sidebar.hideNewspaperHighlight",
						label: "Hide newspaper highlight"
					});
					StorageNumber(sibling(node_24, 2), {
						path: "settings.pages.sidebar.upkeepPropHighlight",
						label: "Property upkeep highlight",
						description: "Highlight the properties area when your upkeep is at or above this threshold. Use 0 to disable.",
						min: 0
					});
					append($$anchor, fragment_4);
				},
				$$slots: { default: true }
			});
			PreferenceSettingGroup(sibling(node_20, 2), {
				title: "NPCs",
				contentClass: "grid gap-1",
				children: ($$anchor, $$slotProps) => {
					var fragment_5 = root_7$10();
					var node_27 = first_child(fragment_5);
					StorageSwitch(node_27, {
						path: "settings.pages.sidebar.npcLootTimes",
						label: "NPC loot times",
						externalServices: [
							"tornstats",
							"yata",
							"lzpt"
						]
					});
					StorageSelect(sibling(node_27, 2), {
						get items() {
							return npcServiceOptions;
						},
						path: "settings.pages.sidebar.npcLootTimesService",
						label: "NPC loot source",
						description: "Used when more than one NPC loot service is enabled."
					});
					append($$anchor, fragment_5);
				},
				$$slots: { default: true }
			});
			reset(div_1);
			append($$anchor, div_1);
		},
		$$slots: { default: true }
	});
	var node_29 = sibling(node, 2);
	{
		const action = ($$anchor) => {
			{
				let $0 = user_derived(() => get(hiddenIconCount) ? "secondary" : "outline");
				Badge($$anchor, {
					get variant() {
						return get($0);
					},
					children: ($$anchor, $$slotProps) => {
						next();
						var text$10 = text();
						template_effect(() => set_text(text$10, `${get(hiddenIconCount) ?? ""} hidden`));
						append($$anchor, text$10);
					},
					$$slots: { default: true }
				});
			}
		};
		PreferenceSectionCard(node_29, {
			title: "Hidden Sidebar Icons",
			description: "Select Torn icons that should be hidden. Also affects the popup icons.",
			action,
			children: ($$anchor, $$slotProps) => {
				var div_2 = root_10$3();
				each(div_2, 21, () => ALL_ICONS, (icon) => icon.icon, ($$anchor, icon) => {
					var fragment_8 = comment();
					component(first_child(fragment_8), () => Tooltip, ($$anchor, Tooltip_Root) => {
						Tooltip_Root($$anchor, {
							children: ($$anchor, $$slotProps) => {
								var fragment_9 = root_12$1();
								var node_31 = first_child(fragment_9);
								{
									const child = ($$anchor, $$arg0) => {
										let _props = () => $$arg0?.().props;
										{
											let $0 = user_derived(() => $settingsStore().hideIcons.includes(get(icon).icon) ? "default" : "outline");
											Button($$anchor, spread_props(_props, {
												type: "button",
												size: "icon-xs",
												get variant() {
													return get($0);
												},
												onclick: () => toggleHiddenIcon(get(icon).icon),
												children: ($$anchor, $$slotProps) => {
													OfficialIcon($$anchor, { get icon() {
														return get(icon).id;
													} });
												},
												$$slots: { default: true }
											}));
										}
									};
									component(node_31, () => Tooltip_trigger, ($$anchor, Tooltip_Trigger) => {
										Tooltip_Trigger($$anchor, {
											child,
											$$slots: { child: true }
										});
									});
								}
								component(sibling(node_31, 2), () => Tooltip_content, ($$anchor, Tooltip_Content) => {
									Tooltip_Content($$anchor, {
										children: ($$anchor, $$slotProps) => {
											next();
											var text_1 = text();
											template_effect(() => set_text(text_1, get(icon).description));
											append($$anchor, text_1);
										},
										$$slots: { default: true }
									});
								});
								append($$anchor, fragment_9);
							},
							$$slots: { default: true }
						});
					});
					append($$anchor, fragment_8);
				});
				reset(div_2);
				append($$anchor, div_2);
			},
			$$slots: {
				action: true,
				default: true
			}
		});
	}
	CustomLinks(sibling(node_29, 2), {});
	reset(div);
	append($$anchor, div);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/global/GlobalGroup.svelte
function GlobalGroup($$anchor, $$props) {
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		GlobalSection($$anchor, {});
	};
	var consequent_1 = ($$anchor) => {
		GlobalSidebarSection($$anchor, {});
	};
	var consequent_2 = ($$anchor) => {
		GlobalChatSection($$anchor, {});
	};
	var consequent_3 = ($$anchor) => {
		AdvancedSection($$anchor, {});
	};
	var alternate = ($$anchor) => {
		SectionNotFound($$anchor, {});
	};
	if_block(node, ($$render) => {
		if ($$props.sectionId === "global") $$render(consequent);
		else if ($$props.sectionId === "sidebar") $$render(consequent_1, 1);
		else if ($$props.sectionId === "chat") $$render(consequent_2, 2);
		else if ($$props.sectionId === "advanced") $$render(consequent_3, 3);
		else $$render(alternate, -1);
	});
	append($$anchor, fragment);
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/internal/ApiKeyCard.svelte
var root_5$8 = from_html(`TornTools uses a <span class="text-yellow-400">Limited Access</span> key.`, 1);
var root_3$14 = from_html(`<!> <!>`, 1);
var root_2$17 = from_html(`<!> <div class="flex gap-1"><!> <!></div>`, 1);
var root_1$13 = from_html(`<!> <div class="mt-1 rounded-md border border-border bg-background/60 p-2 text-sm"><h3 class="font-bold">Disclaimer</h3> <div class="mt-1 space-y-1 text-muted-foreground"><p>The user is allowed to make 100 requests to Torn's API in a minute.</p> <p>The creators of this extension are not responsible if the user:</p> <ul class="list-disc pl-5"><li>spams requests too much</li> <li>tries to use the wrong API key too many times</li></ul> <p>If for some reason you do get your IP blocked because the extension had a bug or glitched or anything, our apologies. Please let us know of such incidents so we can avoid them in the future.</p></div></div>`, 1);
function ApiKeyCard($$anchor, $$props) {
	push($$props, true);
	const $apiStore = () => store_get(apiStore, "$apiStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let apiKey = state(proxy($apiStore().torn.key ?? ""));
	let updating = state(false);
	async function updateApiKey() {
		if (get(updating)) return;
		set(updating, true);
		try {
			const { access } = await checkAPIPermission(get(apiKey));
			await changeAPIKey(get(apiKey));
			if (access) toast.success("API key updated.");
			else toast.warning("Your API key is not the correct API level. This will affect a lot of features.");
		} catch (error) {
			set(apiKey, $apiStore().torn.key ?? "", true);
			toast.error(typeof error === "string" ? error : "Couldn't update API key.");
		} finally {
			set(updating, false);
		}
	}
	PreferenceSectionCard($$anchor, {
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = root_1$13();
			component(first_child(fragment_1), () => Field, ($$anchor, Field_Field) => {
				Field_Field($$anchor, {
					orientation: "responsive",
					class: "rounded-md border border-border bg-background/60 p-2",
					children: ($$anchor, $$slotProps) => {
						var fragment_2 = root_2$17();
						var node_1 = first_child(fragment_2);
						component(node_1, () => Field_content, ($$anchor, Field_Content) => {
							Field_Content($$anchor, {
								children: ($$anchor, $$slotProps) => {
									var fragment_3 = root_3$14();
									var node_2 = first_child(fragment_3);
									component(node_2, () => Field_label, ($$anchor, Field_Label) => {
										Field_Label($$anchor, {
											for: "api-key",
											children: ($$anchor, $$slotProps) => {
												next();
												append($$anchor, text("API key"));
											},
											$$slots: { default: true }
										});
									});
									component(sibling(node_2, 2), () => Field_description, ($$anchor, Field_Description) => {
										Field_Description($$anchor, {
											class: "text-xs",
											children: ($$anchor, $$slotProps) => {
												next();
												var fragment_4 = root_5$8();
												next(2);
												append($$anchor, fragment_4);
											},
											$$slots: { default: true }
										});
									});
									append($$anchor, fragment_3);
								},
								$$slots: { default: true }
							});
						});
						var div = sibling(node_1, 2);
						var node_4 = child(div);
						Input(node_4, {
							id: "api-key",
							type: "text",
							placeholder: "API key",
							get disabled() {
								return get(updating);
							},
							get value() {
								return get(apiKey);
							},
							set value($$value) {
								set(apiKey, $$value, true);
							}
						});
						Button(sibling(node_4, 2), {
							type: "button",
							variant: "outline",
							get disabled() {
								return get(updating);
							},
							onclick: () => void updateApiKey(),
							children: ($$anchor, $$slotProps) => {
								next();
								append($$anchor, text("Update"));
							},
							$$slots: { default: true }
						});
						reset(div);
						append($$anchor, fragment_2);
					},
					$$slots: { default: true }
				});
			});
			next(2);
			append($$anchor, fragment_1);
		},
		$$slots: { default: true }
	});
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/internal/InternalApiSection.svelte
var root_1$12 = from_html(`<!> <!> <!> <!> <!>`, 1);
var root$17 = from_html(`<div class="space-y-2"><!> <!> <!></div>`);
function InternalApiSection($$anchor) {
	const userSelections = [
		{
			path: "settings.apiUsage.user.bars",
			label: "Bars"
		},
		{
			path: "settings.apiUsage.user.cooldowns",
			label: "Cooldowns"
		},
		{
			path: "settings.apiUsage.user.travel",
			label: "Travel"
		},
		{
			path: "settings.apiUsage.user.newevents",
			label: "Unread events"
		},
		{
			path: "settings.apiUsage.user.newmessages",
			label: "Unread messages"
		},
		{
			path: "settings.apiUsage.user.refills",
			label: "Refills"
		},
		{
			path: "settings.apiUsage.user.stocks",
			label: "Stocks"
		},
		{
			path: "settings.apiUsage.user.education",
			label: "Education"
		},
		{
			path: "settings.apiUsage.user.networth",
			label: "Networth"
		},
		{
			path: "settings.apiUsage.user.jobpoints",
			label: "Job points"
		},
		{
			path: "settings.apiUsage.user.merits",
			label: "Merits"
		},
		{
			path: "settings.apiUsage.user.perks",
			label: "Perks"
		},
		{
			path: "settings.apiUsage.user.icons",
			label: "Icons"
		},
		{
			path: "settings.apiUsage.user.ammo",
			label: "Ammo"
		},
		{
			path: "settings.apiUsage.user.battlestats",
			label: "Battlestats"
		},
		{
			path: "settings.apiUsage.user.crimes",
			label: "Crimes"
		},
		{
			path: "settings.apiUsage.user.workstats",
			label: "Workstats"
		},
		{
			path: "settings.apiUsage.user.skills",
			label: "Skills"
		},
		{
			path: "settings.apiUsage.user.weaponexp",
			label: "Weapon experience"
		},
		{
			path: "settings.apiUsage.user.properties",
			label: "Properties"
		},
		{
			path: "settings.apiUsage.user.calendar",
			label: "Calendar"
		},
		{
			path: "settings.apiUsage.user.missions",
			label: "Missions"
		},
		{
			path: "settings.apiUsage.user.organizedcrime",
			label: "Organized crime"
		},
		{
			path: "settings.apiUsage.user.personalstats",
			label: "Personal stats"
		},
		{
			path: "settings.apiUsage.user.attacks",
			label: "Attacks"
		},
		{
			path: "settings.apiUsage.user.money",
			label: "Money"
		},
		{
			path: "settings.apiUsage.user.honors",
			label: "Honors"
		},
		{
			path: "settings.apiUsage.user.medals",
			label: "Medals"
		},
		{
			path: "settings.apiUsage.user.virus",
			label: "Virus"
		}
	];
	var div = root$17();
	var node = child(div);
	ApiKeyCard(node, {});
	var node_1 = sibling(node, 2);
	PreferenceSectionCard(node_1, {
		title: "API Usage",
		description: "All API usage is checked every 30 seconds.",
		children: ($$anchor, $$slotProps) => {
			var fragment = root_1$12();
			var node_2 = first_child(fragment);
			StorageText(node_2, {
				path: "settings.apiUsage.comment",
				label: "API call comment"
			});
			var node_3 = sibling(node_2, 2);
			StorageNumber(node_3, {
				path: "settings.apiUsage.delayEssential",
				label: "Essential userdata interval",
				min: 30
			});
			var node_4 = sibling(node_3, 2);
			StorageNumber(node_4, {
				path: "settings.apiUsage.delayBasic",
				label: "Basic userdata interval",
				min: 30
			});
			var node_5 = sibling(node_4, 2);
			StorageNumber(node_5, {
				path: "settings.apiUsage.delayPassive",
				label: "Passive userdata interval",
				min: 30
			});
			StorageNumber(sibling(node_5, 2), {
				path: "settings.apiUsage.delayStakeouts",
				label: "Stakeout interval",
				min: 30
			});
			append($$anchor, fragment);
		},
		$$slots: { default: true }
	});
	PreferenceSectionCard(sibling(node_1, 2), {
		title: "Selections",
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				title: "User Selections",
				description: "Disabling certain selections will silently disable certain features that rely on that api selection.",
				contentClass: "grid gap-1 grid-cols-2 md:grid-cols-3",
				children: ($$anchor, $$slotProps) => {
					var fragment_2 = comment();
					each(first_child(fragment_2), 1, () => userSelections, (selection) => selection.path, ($$anchor, selection) => {
						StorageSwitch($$anchor, {
							get path() {
								return get(selection).path;
							},
							get label() {
								return get(selection).label;
							},
							compact: true
						});
					});
					append($$anchor, fragment_2);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	reset(div);
	append($$anchor, div);
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/internal/notification-storage.ts
async function updateNotification(key, value) {
	await ttStorage.change({ settings: { notifications: { [key]: value } } });
}
async function updateNotificationType(key, value) {
	await ttStorage.change({ settings: { notifications: { types: { [key]: value } } } });
}
function parseNotificationList(value) {
	return value.split(",").map((entry) => entry.trim()).filter(Boolean).map((entry) => parseFloat(entry).toString() === entry ? parseFloat(entry) : entry);
}
function formatNotificationList(value) {
	return value.join(",");
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/internal/NotificationListInput.svelte
var root_2$16 = from_html(`<!> <!>`, 1);
var root_1$11 = from_html(`<!> <!>`, 1);
function NotificationListInput($$anchor, $$props) {
	push($$props, true);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let disabled = prop($$props, "disabled", 3, false), type = prop($$props, "type", 3, "text");
	const id = user_derived(() => `notification-${$$props.typeKey}`);
	const value = user_derived(() => formatNotificationList($settingsStore().notifications.types[$$props.typeKey]));
	function updateValue(input) {
		updateNotificationType($$props.typeKey, parseNotificationList(input));
	}
	var fragment = comment();
	component(first_child(fragment), () => Field, ($$anchor, Field_Field) => {
		Field_Field($$anchor, {
			orientation: "responsive",
			class: "rounded-md border border-border bg-background/60 p-2",
			children: ($$anchor, $$slotProps) => {
				var fragment_1 = root_1$11();
				var node_1 = first_child(fragment_1);
				component(node_1, () => Field_content, ($$anchor, Field_Content) => {
					Field_Content($$anchor, {
						children: ($$anchor, $$slotProps) => {
							var fragment_2 = root_2$16();
							var node_2 = first_child(fragment_2);
							component(node_2, () => Field_label, ($$anchor, Field_Label) => {
								Field_Label($$anchor, {
									get for() {
										return get(id);
									},
									children: ($$anchor, $$slotProps) => {
										next();
										var text$8 = text();
										template_effect(() => set_text(text$8, $$props.label));
										append($$anchor, text$8);
									},
									$$slots: { default: true }
								});
							});
							var node_3 = sibling(node_2, 2);
							var consequent = ($$anchor) => {
								var fragment_4 = comment();
								component(first_child(fragment_4), () => Field_description, ($$anchor, Field_Description) => {
									Field_Description($$anchor, {
										class: "text-xs",
										children: ($$anchor, $$slotProps) => {
											next();
											var text_1 = text();
											template_effect(() => set_text(text_1, $$props.description));
											append($$anchor, text_1);
										},
										$$slots: { default: true }
									});
								});
								append($$anchor, fragment_4);
							};
							if_block(node_3, ($$render) => {
								if ($$props.description) $$render(consequent);
							});
							append($$anchor, fragment_2);
						},
						$$slots: { default: true }
					});
				});
				Input(sibling(node_1, 2), {
					get id() {
						return get(id);
					},
					get type() {
						return type();
					},
					get disabled() {
						return disabled();
					},
					get value() {
						return get(value);
					},
					oninput: (event) => updateValue(event.currentTarget.value)
				});
				append($$anchor, fragment_1);
			},
			$$slots: { default: true }
		});
	});
	append($$anchor, fragment);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/internal/NotificationNpcAlerts.svelte
var root_6$9 = from_html(`<div class="grid gap-2 rounded-md border border-border bg-background/60 p-2 md:grid-cols-[minmax(0,1fr)_5rem_6rem_auto]"><!> <!> <!> <!></div>`);
var root_5$7 = from_html(`<div class="space-y-1"></div>`);
var root_8$4 = from_html(`<p class="rounded-md border border-dashed border-border p-2 text-center text-xs text-muted-foreground">No NPC alerts configured.</p>`);
var root_9$3 = from_html(`<p class="rounded-md border border-dashed border-border p-2 text-center text-xs text-muted-foreground">NPC data is not available yet.</p>`);
var root_3$13 = from_html(`<div class="grid gap-1"><!> <!> <!></div>`);
function NotificationNpcAlerts($$anchor, $$props) {
	push($$props, true);
	const $npcsStore = () => store_get(npcsStore, "$npcsStore", $$stores);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let disabled = prop($$props, "disabled", 3, false);
	const npcChoices = user_derived(() => Object.entries($npcsStore().targets ?? {}).map(([id, npc]) => ({
		id: Number(id),
		name: npc.name,
		order: npc.order ?? Number.MAX_SAFE_INTEGER
	})).sort((first, second) => first.order - second.order || first.name.localeCompare(second.name)));
	const npcOptions = user_derived(() => get(npcChoices).map((npc) => ({
		value: String(npc.id),
		label: npc.name
	})));
	const canAddNpc = user_derived(() => !disabled() && get(npcChoices).some(({ id }) => !$settingsStore().notifications.types.npcs.some((alert) => alert.id === id)));
	function updateNpcAlerts(nextAlerts) {
		updateNotificationType("npcs", nextAlerts);
	}
	function addNpcAlert() {
		const unusedNpc = get(npcChoices).find(({ id }) => !$settingsStore().notifications.types.npcs.some((alert) => alert.id === id));
		if (!unusedNpc) return;
		updateNpcAlerts([...$settingsStore().notifications.types.npcs, {
			id: unusedNpc.id,
			level: "",
			minutes: ""
		}]);
	}
	function updateNpcAlert(index, nextAlert) {
		const nextAlerts = [...$settingsStore().notifications.types.npcs];
		nextAlerts[index] = nextAlert;
		updateNpcAlerts(nextAlerts);
	}
	function updateNpcAlertField(index, key, value) {
		const alert = $settingsStore().notifications.types.npcs[index];
		if (!alert) return;
		updateNpcAlert(index, {
			...alert,
			[key]: value
		});
	}
	function updateNumberField(index, key, value) {
		const parsedValue = parseInt(value, 10);
		updateNpcAlertField(index, key, value === "" || Number.isNaN(parsedValue) ? "" : parsedValue);
	}
	function removeNpcAlert(index) {
		updateNpcAlerts($settingsStore().notifications.types.npcs.filter((_, alertIndex) => alertIndex !== index));
	}
	{
		const action = ($$anchor) => {
			{
				let $0 = user_derived(() => !get(canAddNpc));
				Button($$anchor, {
					type: "button",
					size: "icon-xs",
					variant: "outline",
					get disabled() {
						return get($0);
					},
					onclick: addNpcAlert,
					children: ($$anchor, $$slotProps) => {
						PlusIcon($$anchor, {});
					},
					$$slots: { default: true }
				});
			}
		};
		PreferenceSectionCard($$anchor, {
			title: "NPC Alerts",
			action,
			children: ($$anchor, $$slotProps) => {
				var div = root_3$13();
				var node = child(div);
				StorageSwitch(node, {
					path: "settings.notifications.types.npcsGlobal",
					label: "NPC alerts",
					get disabled() {
						return disabled();
					},
					externalServices: [
						"tornstats",
						"yata",
						"lzpt"
					]
				});
				var node_1 = sibling(node, 2);
				PreferenceSettingGroup(node_1, {
					title: "NPC levels",
					contentClass: "grid gap-1",
					children: ($$anchor, $$slotProps) => {
						var fragment_3 = comment();
						var node_2 = first_child(fragment_3);
						var consequent = ($$anchor) => {
							var div_1 = root_5$7();
							each(div_1, 7, () => $settingsStore().notifications.types.npcs, (alert) => alert.id, ($$anchor, alert, index) => {
								var div_2 = root_6$9();
								var node_3 = child(div_2);
								{
									let $0 = user_derived(() => String(get(alert).id));
									ItemSelect(node_3, {
										get items() {
											return get(npcOptions);
										},
										placeholder: "NPC",
										get value() {
											return get($0);
										},
										onValueChange: (value) => updateNpcAlertField(get(index), "id", Number(value))
									});
								}
								var node_4 = sibling(node_3, 2);
								{
									let $0 = user_derived(() => String(get(alert).level));
									Input(node_4, {
										type: "number",
										min: 1,
										max: 5,
										placeholder: "Level",
										get disabled() {
											return disabled();
										},
										get value() {
											return get($0);
										},
										oninput: (event) => updateNumberField(get(index), "level", event.currentTarget.value)
									});
								}
								var node_5 = sibling(node_4, 2);
								{
									let $0 = user_derived(() => String(get(alert).minutes));
									Input(node_5, {
										type: "number",
										min: 0,
										max: 450,
										placeholder: "Minutes",
										get disabled() {
											return disabled();
										},
										get value() {
											return get($0);
										},
										oninput: (event) => updateNumberField(get(index), "minutes", event.currentTarget.value)
									});
								}
								Button(sibling(node_5, 2), {
									type: "button",
									size: "icon",
									variant: "destructive",
									get disabled() {
										return disabled();
									},
									onclick: () => removeNpcAlert(get(index)),
									children: ($$anchor, $$slotProps) => {
										TrashIcon($$anchor, {});
									},
									$$slots: { default: true }
								});
								reset(div_2);
								append($$anchor, div_2);
							});
							reset(div_1);
							append($$anchor, div_1);
						};
						var consequent_1 = ($$anchor) => {
							append($$anchor, root_8$4());
						};
						var alternate = ($$anchor) => {
							append($$anchor, root_9$3());
						};
						if_block(node_2, ($$render) => {
							if (get(npcOptions).length && $settingsStore().notifications.types.npcs.length) $$render(consequent);
							else if (get(npcOptions).length) $$render(consequent_1, 1);
							else $$render(alternate, -1);
						});
						append($$anchor, fragment_3);
					},
					$$slots: { default: true }
				});
				StorageSwitch(sibling(node_1, 2), {
					path: "settings.notifications.types.npcPlannedEnabled",
					label: "Planned attack reminder",
					get disabled() {
						return disabled();
					},
					externalServices: ["lzpt"],
					children: ($$anchor, $$slotProps) => {
						{
							let $0 = user_derived(() => disabled() || !$settingsStore().notifications.types.npcPlannedEnabled);
							NotificationListInput($$anchor, {
								typeKey: "npcPlanned",
								label: "Minutes before planned attack",
								get disabled() {
									return get($0);
								}
							});
						}
					},
					$$slots: { default: true }
				});
				reset(div);
				append($$anchor, div);
			},
			$$slots: {
				action: true,
				default: true
			}
		});
	}
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/svelte/components/ui/slider/slider.svelte
var root_1$10 = from_html(`<span data-slot="slider-track"><!></span> <!>`, 1);
function Slider($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), value = prop($$props, "value", 15), orientation = prop($$props, "orientation", 3, "horizontal"), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"value",
		"orientation",
		"class"
	]);
	var fragment = comment();
	var node = first_child(fragment);
	{
		const children = ($$anchor, $$arg0) => {
			let thumbItems = () => $$arg0?.().thumbItems;
			var fragment_1 = root_1$10();
			var span = first_child(fragment_1);
			var node_1 = child(span);
			{
				let $0 = user_derived(() => cn("bg-primary absolute select-none data-horizontal:h-full data-vertical:w-full"));
				component(node_1, () => Slider_range, ($$anchor, SliderPrimitive_Range) => {
					SliderPrimitive_Range($$anchor, {
						"data-slot": "slider-range",
						get class() {
							return get($0);
						}
					});
				});
			}
			reset(span);
			each(sibling(span, 2), 17, thumbItems, (thumb) => thumb.index, ($$anchor, thumb) => {
				var fragment_2 = comment();
				component(first_child(fragment_2), () => Slider_thumb, ($$anchor, SliderPrimitive_Thumb) => {
					SliderPrimitive_Thumb($$anchor, {
						"data-slot": "slider-thumb",
						get index() {
							return get(thumb).index;
						},
						class: "border-ring ring-ring/50 relative size-3 rounded-full border bg-white transition-[color,box-shadow] after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 block shrink-0 select-none disabled:pointer-events-none disabled:opacity-50"
					});
				});
				append($$anchor, fragment_2);
			});
			template_effect(($0) => {
				set_attribute(span, "data-orientation", orientation());
				set_class(span, 1, $0);
			}, [() => clsx(cn("bg-muted rounded-full data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1 bg-muted relative grow overflow-hidden data-horizontal:w-full data-vertical:h-full"))]);
			append($$anchor, fragment_1);
		};
		let $0 = user_derived(() => cn("data-vertical:min-h-40 relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:w-auto data-vertical:flex-col", $$props.class));
		component(node, () => Slider$1, ($$anchor, SliderPrimitive_Root) => {
			SliderPrimitive_Root($$anchor, spread_props({
				"data-slot": "slider",
				get orientation() {
					return orientation();
				},
				get class() {
					return get($0);
				}
			}, () => restProps, {
				get ref() {
					return ref();
				},
				set ref($$value) {
					ref($$value);
				},
				get value() {
					return value();
				},
				set value($$value) {
					value($$value);
				},
				children,
				$$slots: { default: true }
			}));
		});
	}
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/phosphor-svelte/lib/PlayIcon.svelte
var root_2$15 = from_svg(`<path d="M234.49,111.07,90.41,22.94A20,20,0,0,0,60,39.87V216.13a20,20,0,0,0,30.41,16.93l144.08-88.13a19.82,19.82,0,0,0,0-33.86ZM84,208.85V47.15L216.16,128Z"></path>`);
var root_3$12 = from_svg(`<path d="M228.23,134.69,84.15,222.81A8,8,0,0,1,72,216.12V39.88a8,8,0,0,1,12.15-6.69l144.08,88.12A7.82,7.82,0,0,1,228.23,134.69Z" opacity="0.2"></path><path d="M232.4,114.49,88.32,26.35a16,16,0,0,0-16.2-.3A15.86,15.86,0,0,0,64,39.87V216.13A15.94,15.94,0,0,0,80,232a16.07,16.07,0,0,0,8.36-2.35L232.4,141.51a15.81,15.81,0,0,0,0-27ZM80,215.94V40l143.83,88Z"></path>`, 1);
var root_4$7 = from_svg(`<path d="M240,128a15.74,15.74,0,0,1-7.6,13.51L88.32,229.65a16,16,0,0,1-16.2.3A15.86,15.86,0,0,1,64,216.13V39.87a15.86,15.86,0,0,1,8.12-13.82,16,16,0,0,1,16.2.3L232.4,114.49A15.74,15.74,0,0,1,240,128Z"></path>`);
var root_5$6 = from_svg(`<path d="M231.36,116.19,87.28,28.06a14,14,0,0,0-14.18-.27A13.69,13.69,0,0,0,66,39.87V216.13a13.69,13.69,0,0,0,7.1,12.08,14,14,0,0,0,14.18-.27l144.08-88.13a13.82,13.82,0,0,0,0-23.62Zm-6.26,13.38L81,217.7a2,2,0,0,1-2.06,0,1.78,1.78,0,0,1-1-1.61V39.87a1.78,1.78,0,0,1,1-1.61A2.06,2.06,0,0,1,80,38a2,2,0,0,1,1,.31L225.1,126.43a1.82,1.82,0,0,1,0,3.14Z"></path>`);
var root_6$8 = from_svg(`<path d="M232.4,114.49,88.32,26.35a16,16,0,0,0-16.2-.3A15.86,15.86,0,0,0,64,39.87V216.13A15.94,15.94,0,0,0,80,232a16.07,16.07,0,0,0,8.36-2.35L232.4,141.51a15.81,15.81,0,0,0,0-27ZM80,215.94V40l143.83,88Z"></path>`);
var root_7$9 = from_svg(`<path d="M230.32,117.9,86.24,29.79a11.91,11.91,0,0,0-12.17-.23A11.71,11.71,0,0,0,68,39.89V216.11a11.71,11.71,0,0,0,6.07,10.33,11.91,11.91,0,0,0,12.17-.23L230.32,138.1a11.82,11.82,0,0,0,0-20.2Zm-4.18,13.37L82.06,219.39a4,4,0,0,1-4.07.07,3.77,3.77,0,0,1-2-3.35V39.89a3.77,3.77,0,0,1,2-3.35,4,4,0,0,1,4.07.07l144.08,88.12a3.8,3.8,0,0,1,0,6.54Z"></path>`);
var root$16 = from_svg(`<svg><!><rect width="256" height="256" fill="none"></rect><!></svg>`);
function PlayIcon($$anchor, $$props) {
	push($$props, true);
	const ctx = getIconContext();
	let props = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"children"
	]);
	let weight = user_derived(() => $$props.weight ?? ctx.weight ?? "regular");
	let color = user_derived(() => $$props.color ?? ctx.color ?? "currentColor");
	let size = user_derived(() => $$props.size ?? ctx.size ?? "1em");
	let mirrored = user_derived(() => $$props.mirrored ?? ctx.mirrored ?? false);
	function svgAttr(obj) {
		let { weight, color, size, mirrored, ...attrs } = obj;
		return attrs;
	}
	var svg = root$16();
	attribute_effect(svg, ($0, $1) => ({
		xmlns: "http://www.w3.org/2000/svg",
		role: "img",
		width: get(size),
		height: get(size),
		fill: get(color),
		transform: get(mirrored) ? "scale(-1, 1)" : void 0,
		viewBox: "0 0 256 256",
		...$0,
		...$1
	}), [() => svgAttr(ctx), () => svgAttr(props)]);
	var node = child(svg);
	var consequent = ($$anchor) => {
		var fragment = comment();
		snippet(first_child(fragment), () => $$props.children);
		append($$anchor, fragment);
	};
	if_block(node, ($$render) => {
		if ($$props.children) $$render(consequent);
	});
	var node_2 = sibling(node, 2);
	var consequent_1 = ($$anchor) => {
		append($$anchor, root_2$15());
	};
	var consequent_2 = ($$anchor) => {
		var fragment_1 = root_3$12();
		next();
		append($$anchor, fragment_1);
	};
	var consequent_3 = ($$anchor) => {
		append($$anchor, root_4$7());
	};
	var consequent_4 = ($$anchor) => {
		append($$anchor, root_5$6());
	};
	var consequent_5 = ($$anchor) => {
		append($$anchor, root_6$8());
	};
	var consequent_6 = ($$anchor) => {
		append($$anchor, root_7$9());
	};
	var alternate = ($$anchor) => {
		var text$7 = text();
		text$7.nodeValue = (console.error("Unsupported icon weight. Choose from \"thin\", \"light\", \"regular\", \"bold\", \"fill\", or \"duotone\"."), "");
		append($$anchor, text$7);
	};
	if_block(node_2, ($$render) => {
		if (get(weight) === "bold") $$render(consequent_1);
		else if (get(weight) === "duotone") $$render(consequent_2, 1);
		else if (get(weight) === "fill") $$render(consequent_3, 2);
		else if (get(weight) === "light") $$render(consequent_4, 3);
		else if (get(weight) === "regular") $$render(consequent_5, 4);
		else if (get(weight) === "thin") $$render(consequent_6, 5);
		else $$render(alternate, -1);
	});
	reset(svg);
	append($$anchor, svg);
	pop();
}
//#endregion
//#region node_modules/phosphor-svelte/lib/StopIcon.svelte
var root_2$14 = from_svg(`<path d="M200,36H56A20,20,0,0,0,36,56V200a20,20,0,0,0,20,20H200a20,20,0,0,0,20-20V56A20,20,0,0,0,200,36Zm-4,160H60V60H196Z"></path>`);
var root_3$11 = from_svg(`<path d="M208,56V200a8,8,0,0,1-8,8H56a8,8,0,0,1-8-8V56a8,8,0,0,1,8-8H200A8,8,0,0,1,208,56Z" opacity="0.2"></path><path d="M200,40H56A16,16,0,0,0,40,56V200a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,160H56V56H200V200Z"></path>`, 1);
var root_4$6 = from_svg(`<path d="M216,56V200a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V56A16,16,0,0,1,56,40H200A16,16,0,0,1,216,56Z"></path>`);
var root_5$5 = from_svg(`<path d="M200,42H56A14,14,0,0,0,42,56V200a14,14,0,0,0,14,14H200a14,14,0,0,0,14-14V56A14,14,0,0,0,200,42Zm2,158a2,2,0,0,1-2,2H56a2,2,0,0,1-2-2V56a2,2,0,0,1,2-2H200a2,2,0,0,1,2,2Z"></path>`);
var root_6$7 = from_svg(`<path d="M200,40H56A16,16,0,0,0,40,56V200a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,160H56V56H200V200Z"></path>`);
var root_7$8 = from_svg(`<path d="M200,44H56A12,12,0,0,0,44,56V200a12,12,0,0,0,12,12H200a12,12,0,0,0,12-12V56A12,12,0,0,0,200,44Zm4,156a4,4,0,0,1-4,4H56a4,4,0,0,1-4-4V56a4,4,0,0,1,4-4H200a4,4,0,0,1,4,4Z"></path>`);
var root$15 = from_svg(`<svg><!><rect width="256" height="256" fill="none"></rect><!></svg>`);
function StopIcon($$anchor, $$props) {
	push($$props, true);
	const ctx = getIconContext();
	let props = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"children"
	]);
	let weight = user_derived(() => $$props.weight ?? ctx.weight ?? "regular");
	let color = user_derived(() => $$props.color ?? ctx.color ?? "currentColor");
	let size = user_derived(() => $$props.size ?? ctx.size ?? "1em");
	let mirrored = user_derived(() => $$props.mirrored ?? ctx.mirrored ?? false);
	function svgAttr(obj) {
		let { weight, color, size, mirrored, ...attrs } = obj;
		return attrs;
	}
	var svg = root$15();
	attribute_effect(svg, ($0, $1) => ({
		xmlns: "http://www.w3.org/2000/svg",
		role: "img",
		width: get(size),
		height: get(size),
		fill: get(color),
		transform: get(mirrored) ? "scale(-1, 1)" : void 0,
		viewBox: "0 0 256 256",
		...$0,
		...$1
	}), [() => svgAttr(ctx), () => svgAttr(props)]);
	var node = child(svg);
	var consequent = ($$anchor) => {
		var fragment = comment();
		snippet(first_child(fragment), () => $$props.children);
		append($$anchor, fragment);
	};
	if_block(node, ($$render) => {
		if ($$props.children) $$render(consequent);
	});
	var node_2 = sibling(node, 2);
	var consequent_1 = ($$anchor) => {
		append($$anchor, root_2$14());
	};
	var consequent_2 = ($$anchor) => {
		var fragment_1 = root_3$11();
		next();
		append($$anchor, fragment_1);
	};
	var consequent_3 = ($$anchor) => {
		append($$anchor, root_4$6());
	};
	var consequent_4 = ($$anchor) => {
		append($$anchor, root_5$5());
	};
	var consequent_5 = ($$anchor) => {
		append($$anchor, root_6$7());
	};
	var consequent_6 = ($$anchor) => {
		append($$anchor, root_7$8());
	};
	var alternate = ($$anchor) => {
		var text$6 = text();
		text$6.nodeValue = (console.error("Unsupported icon weight. Choose from \"thin\", \"light\", \"regular\", \"bold\", \"fill\", or \"duotone\"."), "");
		append($$anchor, text$6);
	};
	if_block(node_2, ($$render) => {
		if (get(weight) === "bold") $$render(consequent_1);
		else if (get(weight) === "duotone") $$render(consequent_2, 1);
		else if (get(weight) === "fill") $$render(consequent_3, 2);
		else if (get(weight) === "light") $$render(consequent_4, 3);
		else if (get(weight) === "regular") $$render(consequent_5, 4);
		else if (get(weight) === "thin") $$render(consequent_6, 5);
		else $$render(alternate, -1);
	});
	reset(svg);
	append($$anchor, svg);
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/internal/NotificationSoundCard.svelte
var root_3$10 = from_html(`<!> <!>`, 1);
var root_2$13 = from_html(`<!> <!>`, 1);
var root_8$3 = from_html(`<!> <!>`, 1);
var root_7$7 = from_html(`<!> <!>`, 1);
var root_14 = from_html(`<!> <!>`, 1);
var root_17$1 = from_html(`<!> Play`, 1);
var root_18 = from_html(`<!> Stop`, 1);
var root_13$3 = from_html(`<!> <div class="grid gap-2"><!> <div class="flex gap-1.5 justify-end"><!> <!></div></div>`, 1);
var root_20 = from_html(`<!> <!>`, 1);
var root_19$1 = from_html(`<div class="grid grid-cols-2"><!> <!></div>`);
var root_1$9 = from_html(`<div class="grid gap-1 grid-cols-2"><!> <!> <!> <!></div>`);
function NotificationSoundCard($$anchor, $$props) {
	push($$props, true);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const soundOptions = [
		{
			value: "default",
			label: "OS default"
		},
		{
			value: "mute",
			label: "Mute"
		},
		{
			value: "1",
			label: "Sound 1"
		},
		{
			value: "2",
			label: "Sound 2"
		},
		{
			value: "3",
			label: "Sound 3"
		},
		{
			value: "4",
			label: "Sound 4"
		},
		{
			value: "5",
			label: "Sound 5"
		},
		{
			value: "custom",
			label: "Custom"
		}
	];
	let voices = state(proxy([{
		value: "default",
		label: "System Default"
	}]));
	const showPlayback = user_derived(() => !["mute", "default"].includes($settingsStore().notifications.sound));
	function loadVoices() {
		set(voices, [{
			value: "default",
			label: "System Default"
		}, ...window.speechSynthesis.getVoices().map((voice) => ({
			value: `${voice.name} (${voice.lang})`,
			label: `${voice.name} (${voice.lang})`
		}))], true);
	}
	async function playNotificationSound() {
		await BACKGROUND_SERVICE.stopNotificationSound();
		await BACKGROUND_SERVICE.playNotificationSound($settingsStore().notifications.sound, $settingsStore().notifications.volume, false);
	}
	function updateVolume(value) {
		updateNotification("volume", Array.isArray(value) ? value[0] : value);
	}
	function uploadCustomSound(event) {
		const file = event.currentTarget.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.addEventListener("load", (loadEvent) => {
			const result = loadEvent.target?.result;
			if (typeof result !== "string") return;
			if (result.length > 5242880) {
				toast.error("Maximum file size exceeded. (5MB)");
				return;
			}
			updateNotification("soundCustom", result);
			toast.success("Custom notification sound uploaded.");
		});
		reader.readAsDataURL(file);
	}
	onMount(() => {
		const previousVoicesChanged = window.speechSynthesis.onvoiceschanged;
		window.speechSynthesis.onvoiceschanged = () => {
			loadVoices();
			previousVoicesChanged?.call(window.speechSynthesis, new Event("voiceschanged"));
		};
		loadVoices();
		return () => {
			window.speechSynthesis.onvoiceschanged = previousVoicesChanged;
		};
	});
	onDestroy(() => {
		BACKGROUND_SERVICE.stopNotificationSound();
	});
	PreferenceSectionCard($$anchor, {
		title: "Sound",
		children: ($$anchor, $$slotProps) => {
			var div = root_1$9();
			var node = child(div);
			component(node, () => Field, ($$anchor, Field_Field) => {
				Field_Field($$anchor, {
					orientation: "responsive",
					class: "rounded-md border border-border bg-background/60 p-2",
					children: ($$anchor, $$slotProps) => {
						var fragment_1 = root_2$13();
						var node_1 = first_child(fragment_1);
						component(node_1, () => Field_content, ($$anchor, Field_Content) => {
							Field_Content($$anchor, {
								children: ($$anchor, $$slotProps) => {
									var fragment_2 = root_3$10();
									var node_2 = first_child(fragment_2);
									component(node_2, () => Field_label, ($$anchor, Field_Label) => {
										Field_Label($$anchor, {
											children: ($$anchor, $$slotProps) => {
												next();
												append($$anchor, text("Sound effect"));
											},
											$$slots: { default: true }
										});
									});
									component(sibling(node_2, 2), () => Field_description, ($$anchor, Field_Description) => {
										Field_Description($$anchor, {
											class: "text-xs",
											children: ($$anchor, $$slotProps) => {
												next();
												append($$anchor, text("Mute and OS default might not work in all browsers."));
											},
											$$slots: { default: true }
										});
									});
									append($$anchor, fragment_2);
								},
								$$slots: { default: true }
							});
						});
						ItemSelect(sibling(node_1, 2), {
							get items() {
								return soundOptions;
							},
							placeholder: "Select sound",
							get value() {
								return $settingsStore().notifications.sound;
							},
							onValueChange: (value) => void updateNotification("sound", value)
						});
						append($$anchor, fragment_1);
					},
					$$slots: { default: true }
				});
			});
			var node_5 = sibling(node, 2);
			var consequent_1 = ($$anchor) => {
				var fragment_3 = comment();
				component(first_child(fragment_3), () => Field, ($$anchor, Field_Field_1) => {
					Field_Field_1($$anchor, {
						orientation: "responsive",
						class: "rounded-md border border-border bg-background/60 p-2",
						children: ($$anchor, $$slotProps) => {
							var fragment_4 = root_7$7();
							var node_7 = first_child(fragment_4);
							component(node_7, () => Field_content, ($$anchor, Field_Content_1) => {
								Field_Content_1($$anchor, {
									children: ($$anchor, $$slotProps) => {
										var fragment_5 = root_8$3();
										var node_8 = first_child(fragment_5);
										component(node_8, () => Field_label, ($$anchor, Field_Label_1) => {
											Field_Label_1($$anchor, {
												for: "notification-custom-sound",
												children: ($$anchor, $$slotProps) => {
													next();
													append($$anchor, text("Custom sound"));
												},
												$$slots: { default: true }
											});
										});
										var node_9 = sibling(node_8, 2);
										var consequent = ($$anchor) => {
											var fragment_6 = comment();
											component(first_child(fragment_6), () => Field_description, ($$anchor, Field_Description_1) => {
												Field_Description_1($$anchor, {
													class: "text-xs",
													children: ($$anchor, $$slotProps) => {
														next();
														append($$anchor, text("A custom sound is currently stored."));
													},
													$$slots: { default: true }
												});
											});
											append($$anchor, fragment_6);
										};
										if_block(node_9, ($$render) => {
											if ($settingsStore().notifications.soundCustom) $$render(consequent);
										});
										append($$anchor, fragment_5);
									},
									$$slots: { default: true }
								});
							});
							Input(sibling(node_7, 2), {
								id: "notification-custom-sound",
								type: "file",
								accept: ".mp3,.ogg,.wav",
								onchange: uploadCustomSound
							});
							append($$anchor, fragment_4);
						},
						$$slots: { default: true }
					});
				});
				append($$anchor, fragment_3);
			};
			if_block(node_5, ($$render) => {
				if ($settingsStore().notifications.sound === "custom") $$render(consequent_1);
			});
			var node_12 = sibling(node_5, 2);
			var consequent_2 = ($$anchor) => {
				var fragment_7 = comment();
				component(first_child(fragment_7), () => Field, ($$anchor, Field_Field_2) => {
					Field_Field_2($$anchor, {
						orientation: "responsive",
						class: "rounded-md border border-border bg-background/60 p-2 col-span-2",
						children: ($$anchor, $$slotProps) => {
							var fragment_8 = root_13$3();
							var node_14 = first_child(fragment_8);
							component(node_14, () => Field_content, ($$anchor, Field_Content_2) => {
								Field_Content_2($$anchor, {
									children: ($$anchor, $$slotProps) => {
										var fragment_9 = root_14();
										var node_15 = first_child(fragment_9);
										component(node_15, () => Field_label, ($$anchor, Field_Label_2) => {
											Field_Label_2($$anchor, {
												children: ($$anchor, $$slotProps) => {
													next();
													append($$anchor, text("Volume"));
												},
												$$slots: { default: true }
											});
										});
										component(sibling(node_15, 2), () => Field_description, ($$anchor, Field_Description_2) => {
											Field_Description_2($$anchor, {
												class: "text-xs",
												children: ($$anchor, $$slotProps) => {
													next();
													var text_5 = text();
													template_effect(() => set_text(text_5, `${$settingsStore().notifications.volume ?? ""}%`));
													append($$anchor, text_5);
												},
												$$slots: { default: true }
											});
										});
										append($$anchor, fragment_9);
									},
									$$slots: { default: true }
								});
							});
							var div_1 = sibling(node_14, 2);
							var node_17 = child(div_1);
							Slider(node_17, {
								type: "single",
								get value() {
									return $settingsStore().notifications.volume;
								},
								min: 1,
								max: 100,
								step: 1,
								onValueChange: updateVolume
							});
							var div_2 = sibling(node_17, 2);
							var node_18 = child(div_2);
							Button(node_18, {
								type: "button",
								size: "xs",
								variant: "outline",
								onclick: () => void playNotificationSound(),
								children: ($$anchor, $$slotProps) => {
									var fragment_11 = root_17$1();
									PlayIcon(first_child(fragment_11), {});
									next();
									append($$anchor, fragment_11);
								},
								$$slots: { default: true }
							});
							Button(sibling(node_18, 2), {
								type: "button",
								size: "xs",
								variant: "outline",
								onclick: () => void BACKGROUND_SERVICE.stopNotificationSound(),
								children: ($$anchor, $$slotProps) => {
									var fragment_12 = root_18();
									StopIcon(first_child(fragment_12), {});
									next();
									append($$anchor, fragment_12);
								},
								$$slots: { default: true }
							});
							reset(div_2);
							reset(div_1);
							append($$anchor, fragment_8);
						},
						$$slots: { default: true }
					});
				});
				append($$anchor, fragment_7);
			};
			if_block(node_12, ($$render) => {
				if (get(showPlayback)) $$render(consequent_2);
			});
			StorageSwitch(sibling(node_12, 2), {
				path: "settings.notifications.tts",
				label: "Text-to-speech",
				class: "col-span-2",
				children: ($$anchor, $$slotProps) => {
					var div_3 = root_19$1();
					var node_23 = child(div_3);
					StorageNumber(node_23, {
						path: "settings.notifications.ttsRate",
						label: "Speech rate",
						min: .1,
						max: 10,
						step: .1,
						get disabled() {
							return $settingsStore().notifications.tts;
						}
					});
					component(sibling(node_23, 2), () => Field, ($$anchor, Field_Field_3) => {
						Field_Field_3($$anchor, {
							orientation: "responsive",
							class: "rounded-md border border-border bg-background/60 p-2",
							children: ($$anchor, $$slotProps) => {
								var fragment_13 = root_20();
								var node_25 = first_child(fragment_13);
								component(node_25, () => Field_content, ($$anchor, Field_Content_3) => {
									Field_Content_3($$anchor, {
										children: ($$anchor, $$slotProps) => {
											var fragment_14 = comment();
											component(first_child(fragment_14), () => Field_label, ($$anchor, Field_Label_3) => {
												Field_Label_3($$anchor, {
													children: ($$anchor, $$slotProps) => {
														next();
														append($$anchor, text("TTS voice"));
													},
													$$slots: { default: true }
												});
											});
											append($$anchor, fragment_14);
										},
										$$slots: { default: true }
									});
								});
								ItemSelect(sibling(node_25, 2), {
									get items() {
										return get(voices);
									},
									placeholder: "Select voice",
									get value() {
										return $settingsStore().notifications.ttsVoice;
									},
									onValueChange: (value) => void updateNotification("ttsVoice", value)
								});
								append($$anchor, fragment_13);
							},
							$$slots: { default: true }
						});
					});
					reset(div_3);
					append($$anchor, div_3);
				},
				$$slots: { default: true }
			});
			reset(div);
			append($$anchor, div);
		},
		$$slots: { default: true }
	});
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/internal/NotificationTimeInput.svelte
var root_2$12 = from_html(`<!> <!>`, 1);
var root_1$8 = from_html(`<!> <!>`, 1);
function NotificationTimeInput($$anchor, $$props) {
	push($$props, true);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let disabled = prop($$props, "disabled", 3, false);
	const id = user_derived(() => `notification-${$$props.typeKey}`);
	const value = user_derived(() => $settingsStore().notifications.types[$$props.typeKey]);
	function updateValue(input) {
		updateNotificationType($$props.typeKey, input);
	}
	var fragment = comment();
	component(first_child(fragment), () => Field, ($$anchor, Field_Field) => {
		Field_Field($$anchor, {
			orientation: "responsive",
			class: "rounded-md border border-border bg-background/60 p-2",
			children: ($$anchor, $$slotProps) => {
				var fragment_1 = root_1$8();
				var node_1 = first_child(fragment_1);
				component(node_1, () => Field_content, ($$anchor, Field_Content) => {
					Field_Content($$anchor, {
						children: ($$anchor, $$slotProps) => {
							var fragment_2 = root_2$12();
							var node_2 = first_child(fragment_2);
							component(node_2, () => Field_label, ($$anchor, Field_Label) => {
								Field_Label($$anchor, {
									get for() {
										return get(id);
									},
									children: ($$anchor, $$slotProps) => {
										next();
										var text$4 = text();
										template_effect(() => set_text(text$4, $$props.label));
										append($$anchor, text$4);
									},
									$$slots: { default: true }
								});
							});
							var node_3 = sibling(node_2, 2);
							var consequent = ($$anchor) => {
								var fragment_4 = comment();
								component(first_child(fragment_4), () => Field_description, ($$anchor, Field_Description) => {
									Field_Description($$anchor, {
										class: "text-xs",
										children: ($$anchor, $$slotProps) => {
											next();
											var text_1 = text();
											template_effect(() => set_text(text_1, $$props.description));
											append($$anchor, text_1);
										},
										$$slots: { default: true }
									});
								});
								append($$anchor, fragment_4);
							};
							if_block(node_3, ($$render) => {
								if ($$props.description) $$render(consequent);
							});
							append($$anchor, fragment_2);
						},
						$$slots: { default: true }
					});
				});
				Input(sibling(node_1, 2), {
					get id() {
						return get(id);
					},
					type: "time",
					get disabled() {
						return disabled();
					},
					get value() {
						return get(value);
					},
					oninput: (event) => updateValue(event.currentTarget.value)
				});
				append($$anchor, fragment_1);
			},
			$$slots: { default: true }
		});
	});
	append($$anchor, fragment);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/internal/InternalNotificationsSection.svelte
var root_1$7 = from_html(`<div class="grid gap-1"><!> <!> <!></div>`);
var root_3$9 = from_html(`<!> <!> <!> <!> <!> <!> <!> <div class="md:col-span-2"></div> <!> <!>`, 1);
var root_6$6 = from_html(`<!> <!> <!> <!> <!> <!>`, 1);
var root_9$2 = from_html(`<!> <!> <!> <!>`, 1);
var root_13$2 = from_html(`<!> <!>`, 1);
var root_16 = from_html(`<!> <!>`, 1);
var root_2$11 = from_html(`<div class="grid gap-1"><!> <!> <!> <!> <!></div>`);
var root$14 = from_html(`<div class="space-y-2"><!> <!> <!> <!></div>`);
function InternalNotificationsSection($$anchor, $$props) {
	push($$props, true);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const notificationsDisabled = user_derived(() => !$settingsStore().notifications.types.global);
	var div = root$14();
	var node = child(div);
	PreferenceSectionCard(node, {
		title: "Delivery",
		children: ($$anchor, $$slotProps) => {
			var div_1 = root_1$7();
			var node_1 = child(div_1);
			StorageSwitch(node_1, {
				path: "settings.notifications.types.global",
				label: "Overall Notifications"
			});
			var node_2 = sibling(node_1, 2);
			StorageSwitch(node_2, {
				path: "settings.notifications.link",
				label: "Open related page when clicking a notification",
				get disabled() {
					return get(notificationsDisabled);
				}
			});
			StorageSwitch(sibling(node_2, 2), {
				path: "settings.notifications.requireInteraction",
				label: "Keep notifications visible until clicked",
				get disabled() {
					return get(notificationsDisabled);
				}
			});
			reset(div_1);
			append($$anchor, div_1);
		},
		$$slots: { default: true }
	});
	var node_4 = sibling(node, 2);
	NotificationSoundCard(node_4, {});
	var node_5 = sibling(node_4, 2);
	PreferenceSectionCard(node_5, {
		title: "Notification Types",
		children: ($$anchor, $$slotProps) => {
			var div_2 = root_2$11();
			var node_6 = child(div_2);
			PreferenceSettingGroup(node_6, {
				contentClass: "grid gap-1 grid-cols-2 md:grid-cols-3",
				children: ($$anchor, $$slotProps) => {
					var fragment = root_3$9();
					var node_7 = first_child(fragment);
					StorageSwitch(node_7, {
						path: "settings.notifications.types.events",
						label: "Events",
						compact: true,
						get disabled() {
							return get(notificationsDisabled);
						}
					});
					var node_8 = sibling(node_7, 2);
					StorageSwitch(node_8, {
						path: "settings.notifications.types.messages",
						label: "Messages",
						compact: true,
						get disabled() {
							return get(notificationsDisabled);
						}
					});
					var node_9 = sibling(node_8, 2);
					StorageSwitch(node_9, {
						path: "settings.notifications.types.status",
						label: "Status change",
						compact: true,
						get disabled() {
							return get(notificationsDisabled);
						}
					});
					var node_10 = sibling(node_9, 2);
					StorageSwitch(node_10, {
						path: "settings.notifications.types.traveling",
						label: "Traveling",
						compact: true,
						get disabled() {
							return get(notificationsDisabled);
						}
					});
					var node_11 = sibling(node_10, 2);
					StorageSwitch(node_11, {
						path: "settings.notifications.types.education",
						label: "Education",
						compact: true,
						get disabled() {
							return get(notificationsDisabled);
						}
					});
					var node_12 = sibling(node_11, 2);
					StorageSwitch(node_12, {
						path: "settings.notifications.types.newDay",
						label: "New day",
						compact: true,
						get disabled() {
							return get(notificationsDisabled);
						}
					});
					var node_13 = sibling(node_12, 2);
					NotificationListInput(node_13, {
						typeKey: "offline",
						label: "Offline for over hours",
						get disabled() {
							return get(notificationsDisabled);
						}
					});
					var node_14 = sibling(node_13, 4);
					StorageSwitch(node_14, {
						path: "settings.notifications.types.leavingHospitalEnabled",
						label: "Leaving hospital",
						get disabled() {
							return get(notificationsDisabled);
						},
						children: ($$anchor, $$slotProps) => {
							{
								let $0 = user_derived(() => get(notificationsDisabled) || !$settingsStore().notifications.types.leavingHospitalEnabled);
								NotificationListInput($$anchor, {
									typeKey: "leavingHospital",
									label: "Minutes before leaving",
									get disabled() {
										return get($0);
									}
								});
							}
						},
						$$slots: { default: true }
					});
					StorageSwitch(sibling(node_14, 2), {
						path: "settings.notifications.types.landingEnabled",
						label: "Landing",
						get disabled() {
							return get(notificationsDisabled);
						},
						children: ($$anchor, $$slotProps) => {
							{
								let $0 = user_derived(() => get(notificationsDisabled) || !$settingsStore().notifications.types.landingEnabled);
								NotificationListInput($$anchor, {
									typeKey: "landing",
									label: "Minutes before landing",
									get disabled() {
										return get($0);
									}
								});
							}
						},
						$$slots: { default: true }
					});
					append($$anchor, fragment);
				},
				$$slots: { default: true }
			});
			var node_16 = sibling(node_6, 2);
			PreferenceSettingGroup(node_16, {
				title: "Bars",
				description: "Comma-separated values support percentages and absolute values.",
				contentClass: "grid gap-1 md:grid-cols-2",
				children: ($$anchor, $$slotProps) => {
					var fragment_3 = root_6$6();
					var node_17 = first_child(fragment_3);
					NotificationListInput(node_17, {
						typeKey: "energy",
						label: "Energy",
						get disabled() {
							return get(notificationsDisabled);
						}
					});
					var node_18 = sibling(node_17, 2);
					NotificationListInput(node_18, {
						typeKey: "nerve",
						label: "Nerve",
						get disabled() {
							return get(notificationsDisabled);
						}
					});
					var node_19 = sibling(node_18, 2);
					NotificationListInput(node_19, {
						typeKey: "happy",
						label: "Happy",
						get disabled() {
							return get(notificationsDisabled);
						}
					});
					var node_20 = sibling(node_19, 2);
					NotificationListInput(node_20, {
						typeKey: "life",
						label: "Life",
						get disabled() {
							return get(notificationsDisabled);
						}
					});
					var node_21 = sibling(node_20, 2);
					StorageSwitch(node_21, {
						path: "settings.notifications.types.refillEnergyEnabled",
						label: "Energy refill",
						get disabled() {
							return get(notificationsDisabled);
						},
						children: ($$anchor, $$slotProps) => {
							{
								let $0 = user_derived(() => get(notificationsDisabled) || !$settingsStore().notifications.types.refillEnergyEnabled);
								NotificationTimeInput($$anchor, {
									typeKey: "refillEnergy",
									label: "TCT reminder time",
									get disabled() {
										return get($0);
									}
								});
							}
						},
						$$slots: { default: true }
					});
					StorageSwitch(sibling(node_21, 2), {
						path: "settings.notifications.types.refillNerveEnabled",
						label: "Nerve refill",
						get disabled() {
							return get(notificationsDisabled);
						},
						children: ($$anchor, $$slotProps) => {
							{
								let $0 = user_derived(() => get(notificationsDisabled) || !$settingsStore().notifications.types.refillNerveEnabled);
								NotificationTimeInput($$anchor, {
									typeKey: "refillNerve",
									label: "TCT reminder time",
									get disabled() {
										return get($0);
									}
								});
							}
						},
						$$slots: { default: true }
					});
					append($$anchor, fragment_3);
				},
				$$slots: { default: true }
			});
			var node_23 = sibling(node_16, 2);
			PreferenceSettingGroup(node_23, {
				title: "Cooldowns",
				contentClass: "grid gap-1 md:grid-cols-2",
				children: ($$anchor, $$slotProps) => {
					var fragment_6 = root_9$2();
					var node_24 = first_child(fragment_6);
					StorageSwitch(node_24, {
						path: "settings.notifications.types.cooldowns",
						label: "Cooldowns",
						compact: true,
						get disabled() {
							return get(notificationsDisabled);
						},
						class: "md:col-span-2"
					});
					var node_25 = sibling(node_24, 2);
					StorageSwitch(node_25, {
						path: "settings.notifications.types.cooldownDrugEnabled",
						label: "Drug cooldown",
						get disabled() {
							return get(notificationsDisabled);
						},
						children: ($$anchor, $$slotProps) => {
							{
								let $0 = user_derived(() => get(notificationsDisabled) || !$settingsStore().notifications.types.cooldownDrugEnabled);
								NotificationListInput($$anchor, {
									typeKey: "cooldownDrug",
									label: "Minutes before ending",
									get disabled() {
										return get($0);
									}
								});
							}
						},
						$$slots: { default: true }
					});
					var node_26 = sibling(node_25, 2);
					StorageSwitch(node_26, {
						path: "settings.notifications.types.cooldownBoosterEnabled",
						label: "Booster cooldown",
						get disabled() {
							return get(notificationsDisabled);
						},
						children: ($$anchor, $$slotProps) => {
							{
								let $0 = user_derived(() => get(notificationsDisabled) || !$settingsStore().notifications.types.cooldownBoosterEnabled);
								NotificationListInput($$anchor, {
									typeKey: "cooldownBooster",
									label: "Minutes before ending",
									get disabled() {
										return get($0);
									}
								});
							}
						},
						$$slots: { default: true }
					});
					StorageSwitch(sibling(node_26, 2), {
						path: "settings.notifications.types.cooldownMedicalEnabled",
						label: "Medical cooldown",
						get disabled() {
							return get(notificationsDisabled);
						},
						children: ($$anchor, $$slotProps) => {
							{
								let $0 = user_derived(() => get(notificationsDisabled) || !$settingsStore().notifications.types.cooldownMedicalEnabled);
								NotificationListInput($$anchor, {
									typeKey: "cooldownMedical",
									label: "Minutes before ending",
									get disabled() {
										return get($0);
									}
								});
							}
						},
						$$slots: { default: true }
					});
					append($$anchor, fragment_6);
				},
				$$slots: { default: true }
			});
			var node_28 = sibling(node_23, 2);
			PreferenceSettingGroup(node_28, {
				title: "Missions",
				contentClass: "grid gap-1 md:grid-cols-2",
				children: ($$anchor, $$slotProps) => {
					var fragment_10 = root_13$2();
					var node_29 = first_child(fragment_10);
					StorageSwitch(node_29, {
						path: "settings.notifications.types.missionsExpireEnabled",
						label: "Mission expiry",
						get disabled() {
							return get(notificationsDisabled);
						},
						children: ($$anchor, $$slotProps) => {
							{
								let $0 = user_derived(() => get(notificationsDisabled) || !$settingsStore().notifications.types.missionsExpireEnabled);
								NotificationListInput($$anchor, {
									typeKey: "missionsExpire",
									label: "Hours before expiry",
									get disabled() {
										return get($0);
									}
								});
							}
						},
						$$slots: { default: true }
					});
					StorageSwitch(sibling(node_29, 2), {
						path: "settings.notifications.types.missionsLimitEnabled",
						label: "Mission limit",
						get disabled() {
							return get(notificationsDisabled);
						},
						children: ($$anchor, $$slotProps) => {
							{
								let $0 = user_derived(() => get(notificationsDisabled) || !$settingsStore().notifications.types.missionsLimitEnabled);
								NotificationTimeInput($$anchor, {
									typeKey: "missionsLimit",
									label: "TCT reminder time",
									get disabled() {
										return get($0);
									}
								});
							}
						},
						$$slots: { default: true }
					});
					append($$anchor, fragment_10);
				},
				$$slots: { default: true }
			});
			PreferenceSettingGroup(sibling(node_28, 2), {
				title: "Faction",
				contentClass: "grid gap-1 md:grid-cols-2",
				children: ($$anchor, $$slotProps) => {
					var fragment_13 = root_16();
					var node_32 = first_child(fragment_13);
					StorageSwitch(node_32, {
						path: "settings.notifications.types.chainTimerEnabled",
						label: "Chain timer",
						get disabled() {
							return get(notificationsDisabled);
						},
						children: ($$anchor, $$slotProps) => {
							{
								let $0 = user_derived(() => get(notificationsDisabled) || !$settingsStore().notifications.types.chainTimerEnabled);
								NotificationListInput($$anchor, {
									typeKey: "chainTimer",
									label: "Seconds before expiry",
									get disabled() {
										return get($0);
									}
								});
							}
						},
						$$slots: { default: true }
					});
					StorageSwitch(sibling(node_32, 2), {
						path: "settings.notifications.types.chainBonusEnabled",
						label: "Chain bonus",
						get disabled() {
							return get(notificationsDisabled);
						},
						children: ($$anchor, $$slotProps) => {
							{
								let $0 = user_derived(() => get(notificationsDisabled) || !$settingsStore().notifications.types.chainBonusEnabled);
								NotificationListInput($$anchor, {
									typeKey: "chainBonus",
									label: "Hits before threshold",
									get disabled() {
										return get($0);
									}
								});
							}
						},
						$$slots: { default: true }
					});
					append($$anchor, fragment_13);
				},
				$$slots: { default: true }
			});
			reset(div_2);
			append($$anchor, div_2);
		},
		$$slots: { default: true }
	});
	NotificationNpcAlerts(sibling(node_5, 2), { get disabled() {
		return get(notificationsDisabled);
	} });
	reset(div);
	append($$anchor, div);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/internal/InternalPopupSection.svelte
var root_2$10 = from_html(`<!> <!> <!> <!> <!>`, 1);
var root_1$6 = from_html(`<div class="grid gap-1"><!> <!> <!> <!> <!> <!></div>`);
var root_4$5 = from_html(`<!> <!> <!> <!> <!> <!>`, 1);
var root_3$8 = from_html(`<div class="grid gap-1"><!> <!></div>`);
var root$13 = from_html(`<div class="space-y-2"><!> <!></div>`);
function InternalPopupSection($$anchor, $$props) {
	push($$props, true);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const dashboardOptions = user_derived(() => [
		{
			value: "dashboard",
			label: "Dashboard",
			disabled: !$settingsStore().pages.popup.dashboard
		},
		{
			value: "marketSearch",
			label: "Market search",
			disabled: !$settingsStore().pages.popup.marketSearch
		},
		{
			value: "calculator",
			label: "Calculator",
			disabled: !$settingsStore().pages.popup.calculator
		},
		{
			value: "stocksOverview",
			label: "Stocks overview",
			disabled: !$settingsStore().pages.popup.stocksOverview
		},
		{
			value: "notifications",
			label: "Notifications history",
			disabled: !$settingsStore().pages.popup.notifications
		}
	]);
	var div = root$13();
	var node = child(div);
	PreferenceSectionCard(node, {
		title: "Popup",
		children: ($$anchor, $$slotProps) => {
			var div_1 = root_1$6();
			var node_1 = child(div_1);
			PreferenceSettingGroup(node_1, {
				title: "Tabs",
				contentClass: "grid gap-1 grid-cols-2 md:grid-cols-3",
				children: ($$anchor, $$slotProps) => {
					var fragment = root_2$10();
					var node_2 = first_child(fragment);
					StorageSwitch(node_2, {
						path: "settings.pages.popup.dashboard",
						label: "Dashboard",
						compact: true
					});
					var node_3 = sibling(node_2, 2);
					StorageSwitch(node_3, {
						path: "settings.pages.popup.marketSearch",
						label: "Market search",
						compact: true
					});
					var node_4 = sibling(node_3, 2);
					StorageSwitch(node_4, {
						path: "settings.pages.popup.calculator",
						label: "Calculator",
						compact: true
					});
					var node_5 = sibling(node_4, 2);
					StorageSwitch(node_5, {
						path: "settings.pages.popup.stocksOverview",
						label: "Stocks overview",
						compact: true
					});
					StorageSwitch(sibling(node_5, 2), {
						path: "settings.pages.popup.notifications",
						label: "Notifications",
						compact: true
					});
					append($$anchor, fragment);
				},
				$$slots: { default: true }
			});
			var node_7 = sibling(node_1, 2);
			StorageSelect(node_7, {
				get items() {
					return get(dashboardOptions);
				},
				path: "settings.pages.popup.defaultTab",
				label: "Default tab"
			});
			var node_8 = sibling(node_7, 2);
			StorageSwitch(node_8, {
				path: "settings.pages.popup.showStakeouts",
				label: "Show stakeouts"
			});
			var node_9 = sibling(node_8, 2);
			StorageSwitch(node_9, {
				path: "settings.pages.popup.showIcons",
				label: "Show status icons"
			});
			var node_10 = sibling(node_9, 2);
			StorageSwitch(node_10, {
				path: "settings.pages.popup.fullBarTime",
				label: "Show bar full time"
			});
			StorageSwitch(sibling(node_10, 2), {
				path: "settings.pages.popup.bazaarUsingExternal",
				label: "Populate bazaar prices using external services.",
				externalServices: ["tornw3b"]
			});
			reset(div_1);
			append($$anchor, div_1);
		},
		$$slots: { default: true }
	});
	PreferenceSectionCard(sibling(node, 2), {
		title: "Icon Bars",
		children: ($$anchor, $$slotProps) => {
			var div_2 = root_3$8();
			var node_13 = child(div_2);
			StorageSwitch(node_13, {
				path: "settings.pages.icon.global",
				label: "Icon bars"
			});
			PreferenceSettingGroup(sibling(node_13, 2), {
				title: "Bars",
				contentClass: "grid gap-1 grid-cols-2 md:grid-cols-3",
				children: ($$anchor, $$slotProps) => {
					var fragment_1 = root_4$5();
					var node_15 = first_child(fragment_1);
					StorageSwitch(node_15, {
						path: "settings.pages.icon.energy",
						label: "Energy",
						compact: true
					});
					var node_16 = sibling(node_15, 2);
					StorageSwitch(node_16, {
						path: "settings.pages.icon.nerve",
						label: "Nerve",
						compact: true
					});
					var node_17 = sibling(node_16, 2);
					StorageSwitch(node_17, {
						path: "settings.pages.icon.happy",
						label: "Happy",
						compact: true
					});
					var node_18 = sibling(node_17, 2);
					StorageSwitch(node_18, {
						path: "settings.pages.icon.life",
						label: "Life",
						compact: true
					});
					var node_19 = sibling(node_18, 2);
					StorageSwitch(node_19, {
						path: "settings.pages.icon.chain",
						label: "Chain",
						compact: true
					});
					StorageSwitch(sibling(node_19, 2), {
						path: "settings.pages.icon.travel",
						label: "Travel",
						compact: true
					});
					append($$anchor, fragment_1);
				},
				$$slots: { default: true }
			});
			reset(div_2);
			append($$anchor, div_2);
		},
		$$slots: { default: true }
	});
	reset(div);
	append($$anchor, div);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/svelte/components/ui/radio-group/radio-group.svelte
function Radio_group($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), value = prop($$props, "value", 15, ""), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"value"
	]);
	var fragment = comment();
	var node = first_child(fragment);
	{
		let $0 = user_derived(() => cn("grid gap-2 w-full", $$props.class));
		component(node, () => Radio_group$1, ($$anchor, RadioGroupPrimitive_Root) => {
			RadioGroupPrimitive_Root($$anchor, spread_props({
				"data-slot": "radio-group",
				get class() {
					return get($0);
				}
			}, () => restProps, {
				get ref() {
					return ref();
				},
				set ref($$value) {
					ref($$value);
				},
				get value() {
					return value();
				},
				set value($$value) {
					value($$value);
				}
			}));
		});
	}
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/phosphor-svelte/lib/Circle.svelte
var root_2$9 = from_svg(`<path d="M128,20A108,108,0,1,0,236,128,108.12,108.12,0,0,0,128,20Zm0,192a84,84,0,1,1,84-84A84.09,84.09,0,0,1,128,212Z"></path>`);
var root_3$7 = from_svg(`<path d="M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z" opacity="0.2"></path><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Z"></path>`, 1);
var root_4$4 = from_svg(`<path d="M232,128A104,104,0,1,1,128,24,104.13,104.13,0,0,1,232,128Z"></path>`);
var root_5$4 = from_svg(`<path d="M128,26A102,102,0,1,0,230,128,102.12,102.12,0,0,0,128,26Zm0,192a90,90,0,1,1,90-90A90.1,90.1,0,0,1,128,218Z"></path>`);
var root_6$5 = from_svg(`<path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Z"></path>`);
var root_7$6 = from_svg(`<path d="M128,28A100,100,0,1,0,228,128,100.11,100.11,0,0,0,128,28Zm0,192a92,92,0,1,1,92-92A92.1,92.1,0,0,1,128,220Z"></path>`);
var root$12 = from_svg(`<svg><!><rect width="256" height="256" fill="none"></rect><!></svg>`);
function Circle($$anchor, $$props) {
	push($$props, true);
	const ctx = getIconContext();
	let props = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"children"
	]);
	let weight = user_derived(() => $$props.weight ?? ctx.weight ?? "regular");
	let color = user_derived(() => $$props.color ?? ctx.color ?? "currentColor");
	let size = user_derived(() => $$props.size ?? ctx.size ?? "1em");
	let mirrored = user_derived(() => $$props.mirrored ?? ctx.mirrored ?? false);
	function svgAttr(obj) {
		let { weight, color, size, mirrored, ...attrs } = obj;
		return attrs;
	}
	var svg = root$12();
	attribute_effect(svg, ($0, $1) => ({
		xmlns: "http://www.w3.org/2000/svg",
		role: "img",
		width: get(size),
		height: get(size),
		fill: get(color),
		transform: get(mirrored) ? "scale(-1, 1)" : void 0,
		viewBox: "0 0 256 256",
		...$0,
		...$1
	}), [() => svgAttr(ctx), () => svgAttr(props)]);
	var node = child(svg);
	var consequent = ($$anchor) => {
		var fragment = comment();
		snippet(first_child(fragment), () => $$props.children);
		append($$anchor, fragment);
	};
	if_block(node, ($$render) => {
		if ($$props.children) $$render(consequent);
	});
	var node_2 = sibling(node, 2);
	var consequent_1 = ($$anchor) => {
		append($$anchor, root_2$9());
	};
	var consequent_2 = ($$anchor) => {
		var fragment_1 = root_3$7();
		next();
		append($$anchor, fragment_1);
	};
	var consequent_3 = ($$anchor) => {
		append($$anchor, root_4$4());
	};
	var consequent_4 = ($$anchor) => {
		append($$anchor, root_5$4());
	};
	var consequent_5 = ($$anchor) => {
		append($$anchor, root_6$5());
	};
	var consequent_6 = ($$anchor) => {
		append($$anchor, root_7$6());
	};
	var alternate = ($$anchor) => {
		var text$3 = text();
		text$3.nodeValue = (console.error("Unsupported icon weight. Choose from \"thin\", \"light\", \"regular\", \"bold\", \"fill\", or \"duotone\"."), "");
		append($$anchor, text$3);
	};
	if_block(node_2, ($$render) => {
		if (get(weight) === "bold") $$render(consequent_1);
		else if (get(weight) === "duotone") $$render(consequent_2, 1);
		else if (get(weight) === "fill") $$render(consequent_3, 2);
		else if (get(weight) === "light") $$render(consequent_4, 3);
		else if (get(weight) === "regular") $$render(consequent_5, 4);
		else if (get(weight) === "thin") $$render(consequent_6, 5);
		else $$render(alternate, -1);
	});
	reset(svg);
	append($$anchor, svg);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/radio-group/radio-group-item.svelte
var root_1$5 = from_html(`<div data-slot="radio-group-indicator" class="flex size-4 items-center justify-center"><!></div>`);
function Radio_group_item($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class"
	]);
	var fragment = comment();
	var node = first_child(fragment);
	{
		const children = ($$anchor, $$arg0) => {
			let checked = () => $$arg0?.().checked;
			var div = root_1$5();
			var node_1 = child(div);
			var consequent = ($$anchor) => {
				Circle($$anchor, { class: "bg-primary-foreground absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full" });
			};
			if_block(node_1, ($$render) => {
				if (checked()) $$render(consequent);
			});
			reset(div);
			append($$anchor, div);
		};
		let $0 = user_derived(() => cn("border-input dark:bg-input/30 data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary data-checked:border-primary aria-invalid:aria-checked:border-primary aria-invalid:border-destructive focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 dark:aria-invalid:border-destructive/50 flex size-4 rounded-full focus-visible:ring-3 aria-invalid:ring-3 group/radio-group-item peer relative aspect-square shrink-0 border outline-none after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:opacity-50", $$props.class));
		component(node, () => Radio_group_item$1, ($$anchor, RadioGroupPrimitive_Item) => {
			RadioGroupPrimitive_Item($$anchor, spread_props({
				"data-slot": "radio-group-item",
				get class() {
					return get($0);
				}
			}, () => restProps, {
				get ref() {
					return ref();
				},
				set ref($$value) {
					ref($$value);
				},
				children,
				$$slots: { default: true }
			}));
		});
	}
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/internal/InternalSection.svelte
var root_4$3 = from_html(`<p class="text-xs text-muted-foreground"> </p>`);
var root_3$6 = from_html(`<span class="block font-medium"> </span> <!>`, 1);
var root_2$8 = from_html(`<div class="flex items-center gap-2 rounded-sm border border-border px-2 py-1.5"><!> <!></div>`);
var root$11 = from_html(`<section class="rounded-lg border border-border bg-card px-3 py-2"><div class="space-y-3"><h3 class="text-sm font-semibold">Page Theme</h3> <!></div></section>`);
function InternalSection($$anchor, $$props) {
	push($$props, false);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const themeOptions = [
		{
			value: "default",
			label: "OS Default",
			description: "Follows your operating system preference when supported, defaults to light otherwise."
		},
		{
			value: "light",
			label: "Light"
		},
		{
			value: "dark",
			label: "Dark"
		}
	];
	async function updateTheme(theme) {
		if ($settingsStore()?.themes?.pages === theme) return;
		await ttStorage.change({ settings: { themes: { pages: theme } } });
	}
	init();
	var section = root$11();
	var div = child(section);
	Radio_group(sibling(child(div), 2), {
		get value() {
			return $settingsStore().themes.pages;
		},
		onValueChange: (value) => void updateTheme(value),
		children: ($$anchor, $$slotProps) => {
			var fragment = comment();
			each(first_child(fragment), 1, () => themeOptions, (option) => option.value, ($$anchor, option) => {
				var div_1 = root_2$8();
				var node_2 = child(div_1);
				{
					let $0 = derived_safe_equal(() => `internal-page-theme-${get(option).value}`);
					Radio_group_item(node_2, {
						get value() {
							return get(option).value;
						},
						get id() {
							return get($0);
						}
					});
				}
				var node_3 = sibling(node_2, 2);
				{
					let $0 = derived_safe_equal(() => `internal-page-theme-${get(option).value}`);
					Label(node_3, {
						class: "flex-1 cursor-pointer",
						get for() {
							return get($0);
						},
						children: ($$anchor, $$slotProps) => {
							var fragment_1 = root_3$6();
							var span = first_child(fragment_1);
							var text = child(span, true);
							reset(span);
							var node_4 = sibling(span, 2);
							var consequent = ($$anchor) => {
								var p = root_4$3();
								var text_1 = child(p, true);
								reset(p);
								template_effect(() => set_text(text_1, get(option).description));
								append($$anchor, p);
							};
							if_block(node_4, ($$render) => {
								if (get(option).description) $$render(consequent);
							});
							template_effect(() => set_text(text, get(option).label));
							append($$anchor, fragment_1);
						},
						$$slots: { default: true }
					});
				}
				reset(div_1);
				append($$anchor, div_1);
			});
			append($$anchor, fragment);
		},
		$$slots: { default: true }
	});
	reset(div);
	reset(section);
	append($$anchor, section);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/internal/InternalGroup.svelte
function InternalGroup($$anchor, $$props) {
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		InternalSection($$anchor, {});
	};
	var consequent_1 = ($$anchor) => {
		InternalPopupSection($$anchor, {});
	};
	var consequent_2 = ($$anchor) => {
		InternalNotificationsSection($$anchor, {});
	};
	var consequent_3 = ($$anchor) => {
		InternalApiSection($$anchor, {});
	};
	var alternate = ($$anchor) => {
		SectionNotFound($$anchor, {});
	};
	if_block(node, ($$render) => {
		if ($$props.sectionId === "internal") $$render(consequent);
		else if ($$props.sectionId === "popup") $$render(consequent_1, 1);
		else if ($$props.sectionId === "notifications") $$render(consequent_2, 2);
		else if ($$props.sectionId === "api") $$render(consequent_3, 3);
		else $$render(alternate, -1);
	});
	append($$anchor, fragment);
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/qol/FriendlyFireCard.svelte
var root_4$2 = from_html(`<!> <!>`, 1);
var root_6$4 = from_html(`<div class="grid gap-2 rounded-md border border-border bg-background/60 p-2 md:grid-cols-[1fr_28px]"><!> <!></div>`);
var root_8$2 = from_html(`<div class="grid gap-2 rounded-md border border-border bg-background/60 p-2 md:grid-cols-[1fr_28px]"><!> <!></div>`);
var root_5$3 = from_html(`<!> <!>`, 1);
var root_10$2 = from_html(`<div class="rounded-md border border-dashed border-border p-2 text-center text-muted-foreground">No allied factions configured.</div>`);
var root_3$5 = from_html(`<div class="space-y-1"><!> <!></div>`);
function FriendlyFireCard($$anchor, $$props) {
	push($$props, true);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let pendingAllies = state(proxy([]));
	let nextPendingAllyId = 0;
	function parseAllyFaction(value) {
		const trimmedValue = value.trim();
		if (!trimmedValue) return null;
		const numericValue = Number(trimmedValue);
		return Number.isNaN(numericValue) ? trimmedValue : numericValue;
	}
	async function updateAlliedFactions(nextAllies) {
		await ttStorage.change({ settings: { alliedFactions: nextAllies } });
	}
	function addAlliedFaction() {
		set(pendingAllies, [...get(pendingAllies), {
			rowId: nextPendingAllyId++,
			value: ""
		}], true);
	}
	function updateAlliedFaction(index, value) {
		const ally = parseAllyFaction(value);
		if (ally === null) return;
		const nextAllies = [...$settingsStore().alliedFactions];
		nextAllies[index] = ally;
		updateAlliedFactions(nextAllies);
	}
	function removeAlliedFaction(index) {
		updateAlliedFactions($settingsStore().alliedFactions.filter((_, allyIndex) => allyIndex !== index));
	}
	function savePendingAlly(pendingAlly) {
		const ally = parseAllyFaction(pendingAlly.value);
		if (ally === null) return;
		updateAlliedFactions([...$settingsStore().alliedFactions, ally]);
		set(pendingAllies, get(pendingAllies).filter(({ rowId }) => rowId !== pendingAlly.rowId), true);
	}
	function savePendingAllyOnFocusOut(event, pendingAlly) {
		if (event.currentTarget instanceof HTMLElement && event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
		savePendingAlly(pendingAlly);
	}
	function removePendingAlly(rowId) {
		set(pendingAllies, get(pendingAllies).filter((pendingAlly) => pendingAlly.rowId !== rowId), true);
	}
	function updatePendingAlly(rowId, value) {
		set(pendingAllies, get(pendingAllies).map((pendingAlly) => pendingAlly.rowId === rowId ? {
			...pendingAlly,
			value
		} : pendingAlly), true);
	}
	{
		const action = ($$anchor) => {
			Button($$anchor, {
				type: "button",
				size: "icon-xs",
				variant: "outline",
				onclick: addAlliedFaction,
				children: ($$anchor, $$slotProps) => {
					PlusIcon($$anchor, {});
				},
				$$slots: { default: true }
			});
		};
		PreferenceSectionCard($$anchor, {
			title: "Friendly Fire",
			action,
			children: ($$anchor, $$slotProps) => {
				var div = root_3$5();
				var node = child(div);
				PreferenceSettingGroup(node, {
					children: ($$anchor, $$slotProps) => {
						var fragment_3 = root_4$2();
						var node_1 = first_child(fragment_3);
						StorageSwitch(node_1, {
							path: "settings.pages.profile.showAllyWarning",
							label: "Show ally warning on profiles"
						});
						StorageSwitch(sibling(node_1, 2), {
							path: "settings.pages.profile.disableAllyAttacks",
							label: "Disable attack button on ally profile pages"
						});
						append($$anchor, fragment_3);
					},
					$$slots: { default: true }
				});
				var node_3 = sibling(node, 2);
				var consequent = ($$anchor) => {
					var fragment_4 = root_5$3();
					var node_4 = first_child(fragment_4);
					each(node_4, 1, () => $settingsStore().alliedFactions, index, ($$anchor, ally, index) => {
						var div_1 = root_6$4();
						var node_5 = child(div_1);
						{
							let $0 = user_derived(() => String(get(ally)));
							Input(node_5, {
								get value() {
									return get($0);
								},
								placeholder: "Ally faction name or ID",
								oninput: (event) => updateAlliedFaction(index, event.currentTarget.value)
							});
						}
						Button(sibling(node_5, 2), {
							type: "button",
							size: "icon",
							variant: "destructive",
							onclick: () => removeAlliedFaction(index),
							children: ($$anchor, $$slotProps) => {
								TrashIcon($$anchor, {});
							},
							$$slots: { default: true }
						});
						reset(div_1);
						append($$anchor, div_1);
					});
					each(sibling(node_4, 2), 17, () => get(pendingAllies), (pendingAlly) => pendingAlly.rowId, ($$anchor, pendingAlly) => {
						var div_2 = root_8$2();
						var node_8 = child(div_2);
						{
							let $0 = user_derived(() => parseAllyFaction(get(pendingAlly).value) === null ? "border-destructive focus-visible:ring-destructive/50" : "");
							Input(node_8, {
								get value() {
									return get(pendingAlly).value;
								},
								get class() {
									return get($0);
								},
								placeholder: "Ally faction name or ID",
								oninput: (event) => updatePendingAlly(get(pendingAlly).rowId, event.currentTarget.value),
								onkeydown: (event) => {
									if (event.key === "Enter") savePendingAlly(get(pendingAlly));
								}
							});
						}
						Button(sibling(node_8, 2), {
							type: "button",
							size: "icon",
							variant: "destructive",
							onclick: () => removePendingAlly(get(pendingAlly).rowId),
							children: ($$anchor, $$slotProps) => {
								TrashIcon($$anchor, {});
							},
							$$slots: { default: true }
						});
						reset(div_2);
						delegated("focusout", div_2, (event) => savePendingAllyOnFocusOut(event, get(pendingAlly)));
						append($$anchor, div_2);
					});
					append($$anchor, fragment_4);
				};
				var alternate = ($$anchor) => {
					append($$anchor, root_10$2());
				};
				if_block(node_3, ($$render) => {
					if ($settingsStore().alliedFactions.length || get(pendingAllies).length) $$render(consequent);
					else $$render(alternate, -1);
				});
				reset(div);
				append($$anchor, div);
			},
			$$slots: {
				action: true,
				default: true
			}
		});
	}
	pop();
	$$cleanup();
}
delegate(["focusout"]);
//#endregion
//#region src/extension/entrypoints/options/components/preferences/qol/CombatSection.svelte
var root_2$7 = from_html(`<!> <!> <!> <!> <!>`, 1);
var root_4$1 = from_html(`<!> <!> <!>`, 1);
var root_7$5 = from_html(`<!> <!>`, 1);
var root_6$3 = from_html(`<div class="rounded-md border border-border bg-background/60"><!></div>`);
var root_3$4 = from_html(`<div class="grid gap-2"><!> <!></div>`);
var root_11$2 = from_html(`<!> <!> <!> <!>`, 1);
var root_12 = from_html(`<!> <!> <!> <!> <!> <!> <!> <!> <!> <!> <!>`, 1);
var root_10$1 = from_html(`<div class="grid gap-1"><!> <!> <!></div>`);
var root$10 = from_html(`<div class="space-y-2"><!> <!> <!> <!></div>`);
function CombatSection($$anchor, $$props) {
	push($$props, true);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const attackOptions = [
		{
			value: "leave",
			label: "Leave"
		},
		{
			value: "mug",
			label: "Mug"
		},
		{
			value: "hospitalize",
			label: "Hospitalize"
		}
	];
	const hiddenAttackButtons = user_derived(() => $settingsStore().pages.attack.hideAttackButtons ?? []);
	async function updateHiddenAttackButton(option, hidden) {
		const nextHiddenAttackButtons = hidden ? [...get(hiddenAttackButtons), option] : get(hiddenAttackButtons).filter((hiddenAttackButton) => hiddenAttackButton !== option);
		await ttStorage.change({ settings: { pages: { attack: { hideAttackButtons: nextHiddenAttackButtons } } } });
	}
	var div = root$10();
	var node = child(div);
	PreferenceSectionCard(node, {
		title: "FF Scouter",
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				children: ($$anchor, $$slotProps) => {
					var fragment_1 = root_2$7();
					var node_1 = first_child(fragment_1);
					StorageSwitch(node_1, {
						path: "settings.scripts.ffScouter.miniProfile",
						label: "Mini profiles",
						externalServices: ["ffScouter"]
					});
					var node_2 = sibling(node_1, 2);
					StorageSwitch(node_2, {
						path: "settings.scripts.ffScouter.profile",
						label: "Profiles",
						externalServices: ["ffScouter"]
					});
					var node_3 = sibling(node_2, 2);
					StorageSwitch(node_3, {
						path: "settings.scripts.ffScouter.attack",
						label: "Attack page",
						externalServices: ["ffScouter"]
					});
					var node_4 = sibling(node_3, 2);
					StorageSwitch(node_4, {
						path: "settings.scripts.ffScouter.factionList",
						label: "Faction member lists",
						externalServices: ["ffScouter"]
					});
					StorageSwitch(sibling(node_4, 2), {
						path: "settings.scripts.ffScouter.gauge",
						label: "Honor bars and name displays",
						externalServices: ["ffScouter"]
					});
					append($$anchor, fragment_1);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	var node_6 = sibling(node, 2);
	PreferenceSectionCard(node_6, {
		title: "Attacks",
		children: ($$anchor, $$slotProps) => {
			var div_1 = root_3$4();
			var node_7 = child(div_1);
			PreferenceSettingGroup(node_7, {
				children: ($$anchor, $$slotProps) => {
					var fragment_2 = root_4$1();
					var node_8 = first_child(fragment_2);
					StorageSwitch(node_8, {
						path: "settings.pages.attack.timeoutWarning",
						label: "Play a sound when the time on your attack drops below 30 seconds"
					});
					var node_9 = sibling(node_8, 2);
					StorageSwitch(node_9, {
						path: "settings.pages.attack.fairAttack",
						label: "Show FF modifier",
						description: "Requires attack history to be kept."
					});
					StorageSwitch(sibling(node_9, 2), {
						path: "settings.pages.attack.bonusInformation",
						label: "Show information about weapon bonuses in the attack log"
					});
					append($$anchor, fragment_2);
				},
				$$slots: { default: true }
			});
			PreferenceSettingGroup(sibling(node_7, 2), {
				title: "Hide Attack Options",
				contentClass: "grid gap-1 grid-cols-2 sm:grid-cols-3",
				children: ($$anchor, $$slotProps) => {
					var fragment_3 = comment();
					each(first_child(fragment_3), 17, () => attackOptions, (option) => option.value, ($$anchor, option) => {
						const id = user_derived(() => `hidden-attack-option-${get(option).value}`);
						var div_2 = root_6$3();
						component(child(div_2), () => Field, ($$anchor, Field_Field) => {
							Field_Field($$anchor, {
								orientation: "horizontal",
								class: "p-2",
								children: ($$anchor, $$slotProps) => {
									var fragment_4 = root_7$5();
									var node_14 = first_child(fragment_4);
									component(node_14, () => Field_content, ($$anchor, Field_Content) => {
										Field_Content($$anchor, {
											children: ($$anchor, $$slotProps) => {
												var fragment_5 = comment();
												component(first_child(fragment_5), () => Field_label, ($$anchor, Field_Label) => {
													Field_Label($$anchor, {
														get for() {
															return get(id);
														},
														class: "w-full",
														children: ($$anchor, $$slotProps) => {
															next();
															var text$2 = text();
															template_effect(() => set_text(text$2, get(option).label));
															append($$anchor, text$2);
														},
														$$slots: { default: true }
													});
												});
												append($$anchor, fragment_5);
											},
											$$slots: { default: true }
										});
									});
									var node_16 = sibling(node_14, 2);
									{
										let $0 = user_derived(() => get(hiddenAttackButtons).includes(get(option).value));
										Switch(node_16, {
											get id() {
												return get(id);
											},
											size: "sm",
											get checked() {
												return get($0);
											},
											onCheckedChange: (hidden) => updateHiddenAttackButton(get(option).value, hidden)
										});
									}
									append($$anchor, fragment_4);
								},
								$$slots: { default: true }
							});
						});
						reset(div_2);
						append($$anchor, div_2);
					});
					append($$anchor, fragment_3);
				},
				$$slots: { default: true }
			});
			reset(div_1);
			append($$anchor, div_1);
		},
		$$slots: { default: true }
	});
	var node_17 = sibling(node_6, 2);
	FriendlyFireCard(node_17, {});
	PreferenceSectionCard(sibling(node_17, 2), {
		title: "Stats Estimate",
		children: ($$anchor, $$slotProps) => {
			var div_3 = root_10$1();
			var node_19 = child(div_3);
			StorageSwitch(node_19, {
				path: "settings.scripts.statsEstimate.global",
				label: "Stats Estimate"
			});
			var node_20 = sibling(node_19, 2);
			PreferenceSettingGroup(node_20, {
				children: ($$anchor, $$slotProps) => {
					var fragment_7 = root_11$2();
					var node_21 = first_child(fragment_7);
					StorageNumber(node_21, {
						path: "settings.scripts.statsEstimate.maxLevel",
						label: "Show estimates for users up to level",
						min: 1,
						max: 100
					});
					var node_22 = sibling(node_21, 2);
					StorageNumber(node_22, {
						path: "settings.scripts.statsEstimate.delay",
						label: "Delay requests",
						description: "Lowering this value might risk using too many API requests and getting blocked.",
						min: 1
					});
					var node_23 = sibling(node_22, 2);
					StorageSwitch(node_23, {
						path: "settings.scripts.statsEstimate.cachedOnly",
						label: "Only show cached results",
						description: "Ignored on profiles."
					});
					StorageSwitch(sibling(node_23, 2), {
						path: "settings.scripts.statsEstimate.displayNoResult",
						label: "Show a notice when there was no cached result"
					});
					append($$anchor, fragment_7);
				},
				$$slots: { default: true }
			});
			PreferenceSettingGroup(sibling(node_20, 2), {
				title: "Pages",
				contentClass: "grid gap-1 grid-cols-2 md:grid-cols-3",
				children: ($$anchor, $$slotProps) => {
					var fragment_8 = root_12();
					var node_26 = first_child(fragment_8);
					StorageSwitch(node_26, {
						path: "settings.scripts.statsEstimate.profiles",
						label: "Profiles",
						compact: true
					});
					var node_27 = sibling(node_26, 2);
					StorageSwitch(node_27, {
						path: "settings.scripts.statsEstimate.enemies",
						label: "Enemies list",
						compact: true
					});
					var node_28 = sibling(node_27, 2);
					StorageSwitch(node_28, {
						path: "settings.scripts.statsEstimate.targets",
						label: "Targets list",
						compact: true
					});
					var node_29 = sibling(node_28, 2);
					StorageSwitch(node_29, {
						path: "settings.scripts.statsEstimate.hof",
						label: "Hall of Fame",
						compact: true
					});
					var node_30 = sibling(node_29, 2);
					StorageSwitch(node_30, {
						path: "settings.scripts.statsEstimate.attacks",
						label: "Attacks page",
						compact: true
					});
					var node_31 = sibling(node_30, 2);
					StorageSwitch(node_31, {
						path: "settings.scripts.statsEstimate.userlist",
						label: "Userlist",
						compact: true
					});
					var node_32 = sibling(node_31, 2);
					StorageSwitch(node_32, {
						path: "settings.scripts.statsEstimate.bounties",
						label: "Bounties",
						compact: true
					});
					var node_33 = sibling(node_32, 2);
					StorageSwitch(node_33, {
						path: "settings.scripts.statsEstimate.factions",
						label: "Faction members",
						compact: true
					});
					var node_34 = sibling(node_33, 2);
					StorageSwitch(node_34, {
						path: "settings.scripts.statsEstimate.wars",
						label: "Faction wars",
						compact: true
					});
					var node_35 = sibling(node_34, 2);
					StorageSwitch(node_35, {
						path: "settings.scripts.statsEstimate.rankedWars",
						label: "Faction ranked wars",
						compact: true
					});
					StorageSwitch(sibling(node_35, 2), {
						path: "settings.scripts.statsEstimate.abroad",
						label: "Abroad",
						compact: true
					});
					append($$anchor, fragment_8);
				},
				$$slots: { default: true }
			});
			reset(div_3);
			append($$anchor, div_3);
		},
		$$slots: { default: true }
	});
	reset(div);
	append($$anchor, div);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/qol/CompaniesSection.svelte
var root_2$6 = from_html(`<!> <!> <!> <!> <!>`, 1);
var root_7$4 = from_html(`<div class="grid gap-2 rounded-md border border-border bg-background/60 p-2 md:grid-cols-[1fr_3rem_28px]"><!> <!> <!></div>`);
var root_6$2 = from_html(`<div class="space-y-1"></div>`);
var root_9$1 = from_html(`<p class="rounded-md border border-dashed border-border p-2 text-center text-muted-foreground">No inactivity warnings configured.</p>`);
var root$9 = from_html(`<div class="space-y-2"><!> <!></div>`);
function CompaniesSection($$anchor, $$props) {
	push($$props, false);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	function getWarningDraft(warning) {
		return warning.days === null || Number.isNaN(warning.days) ? "" : String(warning.days);
	}
	async function updateEmployeeInactivityWarning(nextWarnings) {
		await ttStorage.change({ settings: { employeeInactivityWarning: nextWarnings } });
	}
	function addEmployeeInactivityWarning() {
		updateEmployeeInactivityWarning([...$settingsStore().employeeInactivityWarning, {
			days: null,
			color: "#ff0000"
		}]);
	}
	function updateEmployeeInactivityWarningField(index, key, value) {
		const nextWarnings = [...$settingsStore().employeeInactivityWarning];
		const warning = nextWarnings[index];
		if (!warning) return;
		nextWarnings[index] = {
			...warning,
			[key]: value
		};
		updateEmployeeInactivityWarning(sortInactivityWarnings(nextWarnings));
	}
	function updateEmployeeInactivityWarningDays(index, value) {
		const parsedDays = parseInt(value, 10);
		updateEmployeeInactivityWarningField(index, "days", value === "" || Number.isNaN(parsedDays) ? null : parsedDays);
	}
	function removeEmployeeInactivityWarning(index) {
		updateEmployeeInactivityWarning($settingsStore().employeeInactivityWarning.filter((_, warningIndex) => warningIndex !== index));
	}
	function sortInactivityWarnings(warnings) {
		return [...warnings].sort((first, second) => (first.days ?? 0) - (second.days ?? 0));
	}
	init();
	var div = root$9();
	var node = child(div);
	PreferenceSectionCard(node, {
		title: "Companies",
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				children: ($$anchor, $$slotProps) => {
					var fragment_1 = root_2$6();
					var node_1 = first_child(fragment_1);
					StorageSwitch(node_1, {
						path: "settings.pages.companies.idBesideCompanyName",
						label: "Reformat company names as \"COMPANYNAME [ID]\""
					});
					var node_2 = sibling(node_1, 2);
					StorageSwitch(node_2, {
						path: "settings.pages.companies.specials",
						label: "Help with several different company specials",
						description: "Includes muggable cash, stat spy calculations, and TornStats stat spy sending where supported."
					});
					var node_3 = sibling(node_2, 2);
					StorageSwitch(node_3, {
						path: "settings.pages.joblist.specials",
						label: "Show company specials on the job list"
					});
					var node_4 = sibling(node_3, 2);
					StorageSwitch(node_4, {
						path: "settings.pages.companies.autoStockFill",
						label: "Automatically fill company stock based on previous day sales"
					});
					StorageNumber(sibling(node_4, 2), {
						path: "settings.pages.companies.employeeEffectiveness",
						label: "Employee effectiveness warning",
						description: "Color employees red when they reach this effectiveness reduction.",
						min: 0
					});
					append($$anchor, fragment_1);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	var node_6 = sibling(node, 2);
	{
		const action = ($$anchor) => {
			Button($$anchor, {
				type: "button",
				size: "icon-xs",
				variant: "outline",
				onclick: addEmployeeInactivityWarning,
				children: ($$anchor, $$slotProps) => {
					PlusIcon($$anchor, {});
				},
				$$slots: { default: true }
			});
		};
		PreferenceSectionCard(node_6, {
			title: "Employee Inactivity Warning",
			description: "Requires last action to be enabled.",
			action,
			children: ($$anchor, $$slotProps) => {
				var fragment_4 = comment();
				var node_7 = first_child(fragment_4);
				var consequent = ($$anchor) => {
					var div_1 = root_6$2();
					each(div_1, 5, () => $settingsStore().employeeInactivityWarning, index, ($$anchor, warning, index) => {
						var div_2 = root_7$4();
						var node_8 = child(div_2);
						{
							let $0 = derived_safe_equal(() => getWarningDraft(get(warning)));
							Input(node_8, {
								type: "number",
								min: 0,
								get value() {
									return get($0);
								},
								placeholder: "Days",
								oninput: (event) => updateEmployeeInactivityWarningDays(index, event.currentTarget.value)
							});
						}
						var node_9 = sibling(node_8, 2);
						Input(node_9, {
							type: "color",
							get value() {
								return get(warning).color;
							},
							oninput: (event) => updateEmployeeInactivityWarningField(index, "color", event.currentTarget.value)
						});
						Button(sibling(node_9, 2), {
							type: "button",
							size: "icon",
							variant: "destructive",
							onclick: () => removeEmployeeInactivityWarning(index),
							children: ($$anchor, $$slotProps) => {
								TrashIcon($$anchor, {});
							},
							$$slots: { default: true }
						});
						reset(div_2);
						append($$anchor, div_2);
					});
					reset(div_1);
					append($$anchor, div_1);
				};
				var alternate = ($$anchor) => {
					append($$anchor, root_9$1());
				};
				if_block(node_7, ($$render) => {
					if ($settingsStore().employeeInactivityWarning.length) $$render(consequent);
					else $$render(alternate, -1);
				});
				append($$anchor, fragment_4);
			},
			$$slots: {
				action: true,
				default: true
			}
		});
	}
	reset(div);
	append($$anchor, div);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/qol/FactionSection.svelte
var root_2$5 = from_html(`<!> <!> <!> <!> <!> <!> <!> <!> <!> <!> <!> <!>`, 1);
var root_3$3 = from_html(`<!> <!> <!> <!>`, 1);
var root_1$4 = from_html(`<!> <!>`, 1);
var root_5$2 = from_html(`<!> <!> <!> <!> <!> <!>`, 1);
var root_6$1 = from_html(`<!> <!>`, 1);
var root_4 = from_html(`<div class="grid gap-2"><!> <!> <!></div>`);
var root_11$1 = from_html(`<div class="grid gap-2 rounded-md border border-border bg-background/60 p-2 md:grid-cols-[1fr_3rem_28px]"><!> <!> <!></div>`);
var root_10 = from_html(`<div class="space-y-1"></div>`);
var root_13$1 = from_html(`<p class="rounded-md border border-dashed border-border p-2 text-center text-muted-foreground">No inactivity warnings configured.</p>`);
var root$8 = from_html(`<div class="space-y-2"><!> <!> <!></div>`);
function FactionSection($$anchor, $$props) {
	push($$props, false);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	function getWarningDraft(warning) {
		return warning.days === null || Number.isNaN(warning.days) ? "" : String(warning.days);
	}
	async function updateFactionInactivityWarning(nextWarnings) {
		await ttStorage.change({ settings: { factionInactivityWarning: nextWarnings } });
	}
	function addFactionInactivityWarning() {
		updateFactionInactivityWarning([...$settingsStore().factionInactivityWarning, {
			days: null,
			color: "#ff0000"
		}]);
	}
	function updateFactionInactivityWarningField(index, key, value) {
		const nextWarnings = [...$settingsStore().factionInactivityWarning];
		const warning = nextWarnings[index];
		if (!warning) return;
		nextWarnings[index] = {
			...warning,
			[key]: value
		};
		updateFactionInactivityWarning(sortFactionInactivityWarnings(nextWarnings));
	}
	function updateFactionInactivityWarningDays(index, value) {
		const parsedDays = parseInt(value, 10);
		updateFactionInactivityWarningField(index, "days", value === "" || Number.isNaN(parsedDays) ? null : parsedDays);
	}
	function removeFactionInactivityWarning(index) {
		updateFactionInactivityWarning($settingsStore().factionInactivityWarning.filter((_, warningIndex) => warningIndex !== index));
	}
	function sortFactionInactivityWarnings(warnings) {
		return [...warnings].sort((first, second) => (first.days ?? 0) - (second.days ?? 0));
	}
	init();
	var div = root$8();
	var node = child(div);
	PreferenceSectionCard(node, {
		title: "Faction",
		children: ($$anchor, $$slotProps) => {
			var fragment = root_1$4();
			var node_1 = first_child(fragment);
			PreferenceSettingGroup(node_1, {
				children: ($$anchor, $$slotProps) => {
					var fragment_1 = root_2$5();
					var node_2 = first_child(fragment_1);
					StorageSwitch(node_2, {
						path: "settings.pages.faction.idBesideFactionName",
						label: "Reformat faction names as \"FACTIONNAME [ID]\""
					});
					var node_3 = sibling(node_2, 2);
					StorageSwitch(node_3, {
						path: "settings.pages.faction.banker",
						label: "Show banker options"
					});
					var node_4 = sibling(node_3, 2);
					StorageSwitch(node_4, {
						path: "settings.pages.faction.showFullInfobox",
						label: "Show the option to show the description without scroll bar"
					});
					var node_5 = sibling(node_4, 2);
					StorageSwitch(node_5, {
						path: "settings.pages.faction.foldableInfobox",
						label: "Make infobox foldable"
					});
					var node_6 = sibling(node_5, 2);
					StorageSwitch(node_6, {
						path: "settings.pages.faction.numberMembers",
						label: "Add numbers to every member of faction"
					});
					var node_7 = sibling(node_6, 2);
					StorageSwitch(node_7, {
						path: "settings.pages.faction.warFinishTimes",
						label: "Show the finish time of wars"
					});
					var node_8 = sibling(node_7, 2);
					StorageSwitch(node_8, {
						path: "settings.pages.faction.armoryWorth",
						label: "Show total worth of faction armory",
						description: "Requires faction API access."
					});
					var node_9 = sibling(node_8, 2);
					StorageSwitch(node_9, {
						path: "settings.pages.faction.upgradeRequiredRespect",
						label: "Show respect required for a faction upgrade"
					});
					var node_10 = sibling(node_9, 2);
					StorageSwitch(node_10, {
						path: "settings.pages.faction.memberInfo",
						label: "Show money and points balance of members",
						description: "Requires faction API access."
					});
					var node_11 = sibling(node_10, 2);
					StorageSwitch(node_11, {
						path: "settings.pages.faction.quickItems",
						label: "Quick items in the armory"
					});
					var node_12 = sibling(node_11, 2);
					StorageSwitch(node_12, {
						path: "settings.pages.faction.showFactionSpy",
						label: "Show spy details of members of a faction you are viewing",
						description: "Only works if Stats Estimate is turned off for factions, wars and ranked wars.",
						externalServices: ["tornstats", "yata"]
					});
					StorageSwitch(sibling(node_12, 2), {
						path: "settings.pages.faction.totalChallengeContributions",
						label: "Show total challenge contributions"
					});
					append($$anchor, fragment_1);
				},
				$$slots: { default: true }
			});
			PreferenceSettingGroup(sibling(node_1, 2), {
				title: "CSV",
				children: ($$anchor, $$slotProps) => {
					var fragment_2 = root_3$3();
					var node_15 = first_child(fragment_2);
					StorageSwitch(node_15, {
						path: "settings.pages.faction.csvRankedWarReport",
						label: "Ranked war report"
					});
					var node_16 = sibling(node_15, 2);
					StorageSwitch(node_16, {
						path: "settings.pages.faction.csvWarReport",
						label: "War report"
					});
					var node_17 = sibling(node_16, 2);
					StorageSwitch(node_17, {
						path: "settings.pages.faction.csvChainReport",
						label: "Chain report"
					});
					StorageSwitch(sibling(node_17, 2), {
						path: "settings.pages.faction.csvChallengeContributions",
						label: "Challenge contributions"
					});
					append($$anchor, fragment_2);
				},
				$$slots: { default: true }
			});
			append($$anchor, fragment);
		},
		$$slots: { default: true }
	});
	var node_19 = sibling(node, 2);
	PreferenceSectionCard(node_19, {
		title: "OCs",
		children: ($$anchor, $$slotProps) => {
			var div_1 = root_4();
			var node_20 = child(div_1);
			StorageSwitch(node_20, {
				path: "settings.pages.faction.highlightOwn",
				label: "Highlight own OC"
			});
			var node_21 = sibling(node_20, 2);
			PreferenceSettingGroup(node_21, {
				title: "OCs v1",
				children: ($$anchor, $$slotProps) => {
					var fragment_3 = root_5$2();
					var node_22 = first_child(fragment_3);
					StorageSwitch(node_22, {
						path: "settings.pages.faction.openOc",
						label: "Open ready OCs"
					});
					var node_23 = sibling(node_22, 2);
					StorageSwitch(node_23, {
						path: "settings.pages.faction.availablePlayers",
						label: "Show amount of available players"
					});
					var node_24 = sibling(node_23, 2);
					StorageSwitch(node_24, {
						path: "settings.pages.faction.recommendedNnb",
						label: "Show recommended NNB per OC",
						description: "Based on the known Torn forum formula."
					});
					var node_25 = sibling(node_24, 2);
					StorageSwitch(node_25, {
						path: "settings.pages.faction.ocNnb",
						label: "Show a user's NNB",
						externalServices: ["yata", "tornstats"]
					});
					var node_26 = sibling(node_25, 2);
					StorageSwitch(node_26, {
						path: "settings.pages.faction.ocTimes",
						label: "Show OC times on the faction page"
					});
					StorageSwitch(sibling(node_26, 2), {
						path: "settings.pages.faction.ocLastAction",
						label: "Show last action on OC details"
					});
					append($$anchor, fragment_3);
				},
				$$slots: { default: true }
			});
			PreferenceSettingGroup(sibling(node_21, 2), {
				title: "OCs v2",
				children: ($$anchor, $$slotProps) => {
					var fragment_4 = root_6$1();
					var node_29 = first_child(fragment_4);
					StorageSwitch(node_29, {
						path: "settings.pages.faction.warnCrime",
						label: "Warn when joining a crime without passing the conditions"
					});
					StorageSwitch(sibling(node_29, 2), {
						path: "settings.pages.faction.rankedWarValue",
						label: "Show the total rewards for ranked wars"
					});
					append($$anchor, fragment_4);
				},
				$$slots: { default: true }
			});
			reset(div_1);
			append($$anchor, div_1);
		},
		$$slots: { default: true }
	});
	var node_31 = sibling(node_19, 2);
	{
		const action = ($$anchor) => {
			Button($$anchor, {
				type: "button",
				size: "icon-xs",
				variant: "outline",
				onclick: addFactionInactivityWarning,
				children: ($$anchor, $$slotProps) => {
					PlusIcon($$anchor, {});
				},
				$$slots: { default: true }
			});
		};
		PreferenceSectionCard(node_31, {
			title: "Faction Member Inactivity Warning",
			description: "Requires last action to be enabled.",
			action,
			children: ($$anchor, $$slotProps) => {
				var fragment_7 = comment();
				var node_32 = first_child(fragment_7);
				var consequent = ($$anchor) => {
					var div_2 = root_10();
					each(div_2, 5, () => $settingsStore().factionInactivityWarning, index, ($$anchor, warning, index) => {
						var div_3 = root_11$1();
						var node_33 = child(div_3);
						{
							let $0 = derived_safe_equal(() => getWarningDraft(get(warning)));
							Input(node_33, {
								type: "number",
								min: 0,
								get value() {
									return get($0);
								},
								placeholder: "Days",
								oninput: (event) => updateFactionInactivityWarningDays(index, event.currentTarget.value)
							});
						}
						var node_34 = sibling(node_33, 2);
						Input(node_34, {
							type: "color",
							get value() {
								return get(warning).color;
							},
							oninput: (event) => updateFactionInactivityWarningField(index, "color", event.currentTarget.value)
						});
						Button(sibling(node_34, 2), {
							type: "button",
							size: "icon",
							variant: "destructive",
							onclick: () => removeFactionInactivityWarning(index),
							children: ($$anchor, $$slotProps) => {
								TrashIcon($$anchor, {});
							},
							$$slots: { default: true }
						});
						reset(div_3);
						append($$anchor, div_3);
					});
					reset(div_2);
					append($$anchor, div_2);
				};
				var alternate = ($$anchor) => {
					append($$anchor, root_13$1());
				};
				if_block(node_32, ($$render) => {
					if ($settingsStore().factionInactivityWarning.length) $$render(consequent);
					else $$render(alternate, -1);
				});
				append($$anchor, fragment_7);
			},
			$$slots: {
				action: true,
				default: true
			}
		});
	}
	reset(div);
	append($$anchor, div);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/qol/GymSection.svelte
var root_2$4 = from_html(`<!> <!> <!> <!> <!>`, 1);
function GymSection($$anchor) {
	PreferenceSectionCard($$anchor, {
		title: "Gym",
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				children: ($$anchor, $$slotProps) => {
					var fragment_2 = root_2$4();
					var node = first_child(fragment_2);
					StorageSwitch(node, {
						path: "settings.pages.gym.specialist",
						label: "Show specialist gym requirements"
					});
					var node_1 = sibling(node, 2);
					StorageSwitch(node_1, {
						path: "settings.pages.gym.disableStats",
						label: "Allow stats to be disabled"
					});
					var node_2 = sibling(node_1, 2);
					StorageSwitch(node_2, {
						path: "settings.pages.gym.steadfast",
						label: "Show current steadfast bonus for each stat"
					});
					var node_3 = sibling(node_2, 2);
					StorageSwitch(node_3, {
						path: "settings.pages.gym.progress",
						label: "Display estimated gym energy progress"
					});
					StorageSwitch(sibling(node_3, 2), {
						path: "settings.pages.gym.graph",
						label: "Display stat graph",
						externalServices: ["tornstats"]
					});
					append($$anchor, fragment_2);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/qol/InformationSection.svelte
var root_2$3 = from_html(`<!> <!>`, 1);
var root_5$1 = from_html(`<!> <!> <!>`, 1);
var root_7$3 = from_html(`<!> <!>`, 1);
var root_9 = from_html(`<!> <!> <!>`, 1);
var root_11 = from_html(`<!> <!>`, 1);
var root_13 = from_html(`<!> <!>`, 1);
var root_17 = from_html(`<!> <!>`, 1);
var root_19 = from_html(`<!> <!> <!> <!>`, 1);
var root_22 = from_html(`<a href="https://www.torn.com/forums.php#/p=threads&amp;f=61&amp;t=16192039" target="_blank" rel="noreferrer" class="flex items-center gap-1 text-xs text-primary hover:underline">Score formula <!></a>`);
var root_21 = from_html(`<!> <!> <!> <!> <!> <!> <!> <!> <!> <!> <!> <!> <!> <!> <!> <!> <!> <!> <!>`, 1);
var root$7 = from_html(`<div class="space-y-2"><!> <!> <!> <!> <!> <!> <!> <!> <!> <!></div>`);
function InformationSection($$anchor) {
	var div = root$7();
	var node = child(div);
	PreferenceSectionCard(node, {
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				children: ($$anchor, $$slotProps) => {
					var fragment_1 = root_2$3();
					var node_1 = first_child(fragment_1);
					StorageSwitch(node_1, {
						path: "settings.pages.home.effectiveStats",
						label: "Show effective battle stats on the homepage"
					});
					StorageSwitch(sibling(node_1, 2), {
						path: "settings.pages.city.items",
						label: "Highlight items on the city map",
						children: ($$anchor, $$slotProps) => {
							StorageSwitch($$anchor, {
								path: "settings.pages.city.combineDuplicates",
								label: "Combine duplicate items"
							});
						},
						$$slots: { default: true }
					});
					append($$anchor, fragment_1);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	var node_3 = sibling(node, 2);
	PreferenceSectionCard(node_3, {
		title: "Last Action",
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				children: ($$anchor, $$slotProps) => {
					var fragment_4 = root_5$1();
					var node_4 = first_child(fragment_4);
					StorageSwitch(node_4, {
						path: "settings.scripts.lastAction.factionMember",
						label: "Faction members"
					});
					var node_5 = sibling(node_4, 2);
					StorageSwitch(node_5, {
						path: "settings.scripts.lastAction.companyOwn",
						label: "Own company employees"
					});
					StorageSwitch(sibling(node_5, 2), {
						path: "settings.scripts.lastAction.companyOther",
						label: "Other company employees",
						description: "This uses twice the API requests made when the company id isn't available."
					});
					append($$anchor, fragment_4);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	var node_7 = sibling(node_3, 2);
	PreferenceSectionCard(node_7, {
		title: "Properties",
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				children: ($$anchor, $$slotProps) => {
					var fragment_6 = root_7$3();
					var node_8 = first_child(fragment_6);
					StorageSwitch(node_8, {
						path: "settings.pages.property.value",
						label: "Show value of all properties"
					});
					StorageSwitch(sibling(node_8, 2), {
						path: "settings.pages.property.happy",
						label: "Show happiness of all properties"
					});
					append($$anchor, fragment_6);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	var node_10 = sibling(node_7, 2);
	PreferenceSectionCard(node_10, {
		title: "Forums",
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				children: ($$anchor, $$slotProps) => {
					var fragment_8 = root_9();
					var node_11 = first_child(fragment_8);
					StorageSwitch(node_11, {
						path: "settings.pages.forums.menu",
						label: "Show forum action menu"
					});
					var node_12 = sibling(node_11, 2);
					StorageSwitch(node_12, {
						path: "settings.pages.forums.debugInfoBtn",
						label: "Display button to add debugging information to TornTools forum thread"
					});
					StorageSwitch(sibling(node_12, 2), {
						path: "settings.pages.forums.onlyNewFeedButton",
						label: "Show a button to only show new items in a feed"
					});
					append($$anchor, fragment_8);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	var node_14 = sibling(node_10, 2);
	PreferenceSectionCard(node_14, {
		title: "Education",
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				children: ($$anchor, $$slotProps) => {
					var fragment_10 = root_11();
					var node_15 = first_child(fragment_10);
					StorageSwitch(node_15, {
						path: "settings.pages.education.greyOut",
						label: "Grey out completed education categories"
					});
					StorageSwitch(sibling(node_15, 2), {
						path: "settings.pages.education.finishTime",
						label: "Show education course finish time"
					});
					append($$anchor, fragment_10);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	var node_17 = sibling(node_14, 2);
	PreferenceSectionCard(node_17, {
		title: "Missions",
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				children: ($$anchor, $$slotProps) => {
					var fragment_12 = root_13();
					var node_18 = first_child(fragment_12);
					StorageSwitch(node_18, {
						path: "settings.pages.missions.hints",
						label: "Mission hints"
					});
					StorageSwitch(sibling(node_18, 2), {
						path: "settings.pages.missions.rewards",
						label: "Reward information"
					});
					append($$anchor, fragment_12);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	var node_20 = sibling(node_17, 2);
	PreferenceSectionCard(node_20, {
		title: "Museum",
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				children: ($$anchor, $$slotProps) => {
					StorageSwitch($$anchor, {
						path: "settings.pages.museum.autoFill",
						label: "Autofill number of sets in museum"
					});
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	var node_21 = sibling(node_20, 2);
	PreferenceSectionCard(node_21, {
		title: "Racing",
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				children: ($$anchor, $$slotProps) => {
					var fragment_16 = root_17();
					var node_22 = first_child(fragment_16);
					StorageSwitch(node_22, {
						path: "settings.pages.racing.winPercentage",
						label: "Show win percentage of each car"
					});
					StorageSwitch(sibling(node_22, 2), {
						path: "settings.pages.racing.upgrades",
						label: "Show racing upgrade values"
					});
					append($$anchor, fragment_16);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	var node_24 = sibling(node_21, 2);
	PreferenceSectionCard(node_24, {
		title: "API",
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				children: ($$anchor, $$slotProps) => {
					var fragment_18 = root_19();
					var node_25 = first_child(fragment_18);
					StorageSwitch(node_25, {
						path: "settings.pages.api.autoDemo",
						label: "Automatically show demo content",
						description: "Make sure to first read the different sections of the documentation as they define acceptable usage, guidelines, and more."
					});
					var node_26 = sibling(node_25, 2);
					StorageSwitch(node_26, {
						path: "settings.pages.api.autoFillKey",
						label: "Automatically fill your API key"
					});
					var node_27 = sibling(node_26, 2);
					StorageSwitch(node_27, {
						path: "settings.pages.api.autoPretty",
						label: "Automatically select pretty outputs"
					});
					StorageSwitch(sibling(node_27, 2), {
						path: "settings.pages.api.clickableSelections",
						label: "Make API selections clickable"
					});
					append($$anchor, fragment_18);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	PreferenceSectionCard(sibling(node_24, 2), {
		title: "Filters",
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				children: ($$anchor, $$slotProps) => {
					var fragment_20 = root_21();
					var node_30 = first_child(fragment_20);
					StorageSwitch(node_30, {
						path: "settings.pages.stocks.filter",
						label: "Stocks"
					});
					var node_31 = sibling(node_30, 2);
					StorageSwitch(node_31, {
						path: "settings.pages.auction.filter",
						label: "Auction House"
					});
					var node_32 = sibling(node_31, 2);
					StorageSwitch(node_32, {
						path: "settings.pages.bounties.filter",
						label: "Bounties"
					});
					var node_33 = sibling(node_32, 2);
					StorageSwitch(node_33, {
						path: "settings.pages.faction.armoryFilter",
						label: "Faction Armory"
					});
					var node_34 = sibling(node_33, 2);
					StorageSwitch(node_34, {
						path: "settings.pages.faction.memberFilter",
						label: "Faction Members"
					});
					var node_35 = sibling(node_34, 2);
					StorageSwitch(node_35, {
						path: "settings.pages.faction.rankedWarFilter",
						label: "Ranked War"
					});
					var node_36 = sibling(node_35, 2);
					StorageSwitch(node_36, {
						path: "settings.pages.faction.oc2Filter",
						label: "OC2 2",
						disabled: true,
						description: "Disabled until further notice."
					});
					var node_37 = sibling(node_36, 2);
					StorageSwitch(node_37, {
						path: "settings.pages.competition.filter",
						label: "Competition",
						disabled: true,
						description: "Disabled until further notice."
					});
					var node_38 = sibling(node_37, 2);
					StorageSwitch(node_38, {
						path: "settings.pages.crimes2.burglaryFilter",
						label: "Burglary",
						disabled: true,
						description: "Disabled until further notice."
					});
					var node_39 = sibling(node_38, 2);
					StorageSwitch(node_39, {
						path: "settings.pages.friends.filter",
						label: "Friends",
						disabled: true,
						description: "Disabled until further notice."
					});
					var node_40 = sibling(node_39, 2);
					StorageSwitch(node_40, {
						path: "settings.pages.enemies.filter",
						label: "Enemies",
						disabled: true,
						description: "Disabled until further notice."
					});
					var node_41 = sibling(node_40, 2);
					StorageSwitch(node_41, {
						path: "settings.pages.targets.filter",
						label: "Targets",
						disabled: true,
						description: "Disabled until further notice."
					});
					var node_42 = sibling(node_41, 2);
					StorageSwitch(node_42, {
						path: "settings.pages.hospital.filter",
						label: "Hospital"
					});
					var node_43 = sibling(node_42, 2);
					StorageSwitch(node_43, {
						path: "settings.pages.jail.filter",
						label: "Jail",
						children: ($$anchor, $$slotProps) => {
							var a = root_22();
							ArrowSquareOutIcon(sibling(child(a)), { "aria-hidden": "true" });
							reset(a);
							append($$anchor, a);
						},
						$$slots: { default: true }
					});
					var node_45 = sibling(node_43, 2);
					StorageSwitch(node_45, {
						path: "settings.pages.racing.filter",
						label: "Custom Races"
					});
					var node_46 = sibling(node_45, 2);
					StorageSwitch(node_46, {
						path: "settings.pages.shops.filters",
						label: "City Shops"
					});
					var node_47 = sibling(node_46, 2);
					StorageSwitch(node_47, {
						path: "settings.pages.travel.itemFilter",
						label: "Travel Items"
					});
					var node_48 = sibling(node_47, 2);
					StorageSwitch(node_48, {
						path: "settings.pages.travel.peopleFilter",
						label: "Travel People"
					});
					StorageSwitch(sibling(node_48, 2), {
						path: "settings.pages.userlist.filter",
						label: "Userlist"
					});
					append($$anchor, fragment_20);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	reset(div);
	append($$anchor, div);
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/qol/ProfileSection.svelte
var root_2$2 = from_html(`<!> <!> <!> <!> <!>`, 1);
var root_3$2 = from_html(`<!> <!> <!> <!> <!>`, 1);
var root_1$3 = from_html(`<div class="grid gap-1"><!> <!></div>`);
var root$6 = from_html(`<div class="space-y-2"><!></div>`);
function ProfileSection($$anchor) {
	var div = root$6();
	PreferenceSectionCard(child(div), {
		title: "Profile",
		children: ($$anchor, $$slotProps) => {
			var div_1 = root_1$3();
			var node_1 = child(div_1);
			PreferenceSettingGroup(node_1, {
				children: ($$anchor, $$slotProps) => {
					var fragment = root_2$2();
					var node_2 = first_child(fragment);
					StorageSwitch(node_2, {
						path: "settings.pages.profile.avgpersonalstats",
						label: "Calculate average personal stats"
					});
					var node_3 = sibling(node_2, 2);
					StorageSwitch(node_3, {
						path: "settings.pages.profile.idBesideProfileName",
						label: "Reformat profile page headings as \"USERNAME [ID]\""
					});
					var node_4 = sibling(node_3, 2);
					StorageSwitch(node_4, {
						path: "settings.pages.profile.statusIndicator",
						label: "Show user's status indicator next to their name"
					});
					var node_5 = sibling(node_4, 2);
					StorageSwitch(node_5, {
						path: "settings.pages.profile.notes",
						label: "Show profile notes"
					});
					StorageSwitch(sibling(node_5, 2), {
						path: "settings.pages.profile.ageToWords",
						label: "Show age of profile in words"
					});
					append($$anchor, fragment);
				},
				$$slots: { default: true }
			});
			StorageSwitch(sibling(node_1, 2), {
				path: "settings.pages.profile.box",
				label: "Show the profile box",
				children: ($$anchor, $$slotProps) => {
					var fragment_1 = root_3$2();
					var node_8 = first_child(fragment_1);
					StorageSwitch(node_8, {
						path: "settings.pages.profile.boxFetch",
						label: "Automatically fetch data from the API"
					});
					var node_9 = sibling(node_8, 2);
					StorageSwitch(node_9, {
						path: "settings.pages.profile.boxStats",
						label: "Display personal stats"
					});
					var node_10 = sibling(node_9, 2);
					StorageSwitch(node_10, {
						path: "settings.pages.profile.boxSpy",
						label: "Show known spy results"
					});
					var node_11 = sibling(node_10, 2);
					StorageSwitch(node_11, {
						path: "settings.pages.profile.boxStakeout",
						label: "Enable stakeout options"
					});
					StorageSwitch(sibling(node_11, 2), {
						path: "settings.pages.profile.boxAttackHistory",
						label: "Show your attack history"
					});
					append($$anchor, fragment_1);
				},
				$$slots: { default: true }
			});
			reset(div_1);
			append($$anchor, div_1);
		},
		$$slots: { default: true }
	});
	reset(div);
	append($$anchor, div);
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/qol/SpeedSection.svelte
var root_1$2 = from_html(`<!> <!>`, 1);
var root_3$1 = from_html(`<!> <!> <!> <!> <!>`, 1);
var root$5 = from_html(`<div class="space-y-2"><!> <!></div>`);
function SpeedSection($$anchor) {
	var div = root$5();
	var node = child(div);
	PreferenceSectionCard(node, {
		children: ($$anchor, $$slotProps) => {
			var fragment = root_1$2();
			var node_1 = first_child(fragment);
			StorageSwitch(node_1, {
				path: "settings.pages.crimes.quickCrimes",
				label: "Quick Crimes"
			});
			StorageSwitch(sibling(node_1, 2), {
				path: "settings.pages.trade.openChat",
				label: "Chat button in trades"
			});
			append($$anchor, fragment);
		},
		$$slots: { default: true }
	});
	PreferenceSectionCard(sibling(node, 2), {
		title: "No Confirm",
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				children: ($$anchor, $$slotProps) => {
					var fragment_2 = root_3$1();
					var node_4 = first_child(fragment_2);
					StorageSwitch(node_4, {
						path: "settings.scripts.noConfirm.itemEquip",
						label: "Equipping items"
					});
					var node_5 = sibling(node_4, 2);
					StorageSwitch(node_5, {
						path: "settings.scripts.noConfirm.tradeAccept",
						label: "Accepting trades"
					});
					var node_6 = sibling(node_5, 2);
					StorageSwitch(node_6, {
						path: "settings.scripts.noConfirm.pointsMarketBuy",
						label: "Buying points from the market"
					});
					var node_7 = sibling(node_6, 2);
					StorageSwitch(node_7, {
						path: "settings.scripts.noConfirm.pointsMarketRemove",
						label: "Removing points from the market"
					});
					StorageSwitch(sibling(node_7, 2), {
						path: "settings.scripts.noConfirm.abroadItemBuy",
						label: "Buying items aboard",
						disabled: true,
						description: "Disabled until further notice."
					});
					append($$anchor, fragment_2);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	reset(div);
	append($$anchor, div);
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/qol/TravelSection.svelte
var root_2$1 = from_html(`<!> <!> <!> <!>`, 1);
var root_5 = from_html(`<!> <!> <!>`, 1);
var root_7$2 = from_html(`<!> <!> <!>`, 1);
var root$4 = from_html(`<div class="space-y-2"><!> <!> <!></div>`);
function TravelSection($$anchor) {
	var div = root$4();
	var node = child(div);
	PreferenceSectionCard(node, {
		title: "Travel",
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				children: ($$anchor, $$slotProps) => {
					var fragment_1 = root_2$1();
					var node_1 = first_child(fragment_1);
					StorageSwitch(node_1, {
						path: "settings.pages.travel.computer",
						label: "Show a computer link while flying or abroad"
					});
					var node_2 = sibling(node_1, 2);
					StorageSwitch(node_2, {
						path: "settings.pages.travel.table",
						label: "Show a table of all countries with their item and stocks",
						externalServices: [
							"prometheus",
							"tornintel",
							"yata"
						],
						children: ($$anchor, $$slotProps) => {
							StorageSwitch($$anchor, {
								path: "settings.pages.travel.autoTravelTableCountry",
								label: "Update country in travel table filter as per map selections"
							});
						},
						$$slots: { default: true }
					});
					var node_3 = sibling(node_2, 2);
					StorageSwitch(node_3, {
						path: "settings.pages.travel.flyingTime",
						label: "Show the time when you would land when flying now"
					});
					StorageSwitch(sibling(node_3, 2), {
						path: "settings.pages.travel.cooldownWarnings",
						label: "Show warnings if cooldowns will be over when you land back in Torn"
					});
					append($$anchor, fragment_1);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	var node_5 = sibling(node, 2);
	PreferenceSectionCard(node_5, {
		title: "Flying",
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				children: ($$anchor, $$slotProps) => {
					var fragment_4 = root_5();
					var node_6 = first_child(fragment_4);
					StorageSwitch(node_6, {
						path: "settings.pages.travel.landingTime",
						label: "Show the landing time when flying"
					});
					var node_7 = sibling(node_6, 2);
					StorageSwitch(node_7, {
						path: "settings.pages.travel.cleanFlight",
						label: "Hide plane and funfact box while flying"
					});
					StorageSwitch(sibling(node_7, 2), {
						path: "settings.pages.travel.tabTitleTimer",
						label: "Show travel time in tab title"
					});
					append($$anchor, fragment_4);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	PreferenceSectionCard(sibling(node_5, 2), {
		title: "Abroad",
		children: ($$anchor, $$slotProps) => {
			PreferenceSettingGroup($$anchor, {
				children: ($$anchor, $$slotProps) => {
					var fragment_6 = root_7$2();
					var node_10 = first_child(fragment_6);
					StorageSwitch(node_10, {
						path: "settings.pages.travel.travelProfits",
						label: "Show profits of items in market"
					});
					var node_11 = sibling(node_10, 2);
					StorageSwitch(node_11, {
						path: "settings.pages.travel.fillMax",
						label: "Show fill max button",
						children: ($$anchor, $$slotProps) => {
							StorageSwitch($$anchor, {
								path: "settings.pages.travel.autoFillMax",
								label: "Automatically fill max amount of stock"
							});
						},
						$$slots: { default: true }
					});
					StorageSwitch(sibling(node_11, 2), {
						path: "settings.pages.travel.efficientRehab",
						label: "Efficiently rehab to not waste any natural decay",
						children: ($$anchor, $$slotProps) => {
							StorageSwitch($$anchor, {
								path: "settings.pages.travel.efficientRehabSelect",
								label: "Automatically set the slider to the current amount"
							});
						},
						$$slots: { default: true }
					});
					append($$anchor, fragment_6);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	reset(div);
	append($$anchor, div);
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/qol/QolGroup.svelte
function QolGroup($$anchor, $$props) {
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		InformationSection($$anchor, {});
	};
	var consequent_1 = ($$anchor) => {
		CombatSection($$anchor, {});
	};
	var consequent_2 = ($$anchor) => {
		TravelSection($$anchor, {});
	};
	var consequent_3 = ($$anchor) => {
		FactionSection($$anchor, {});
	};
	var consequent_4 = ($$anchor) => {
		ProfileSection($$anchor, {});
	};
	var consequent_5 = ($$anchor) => {
		CompaniesSection($$anchor, {});
	};
	var consequent_6 = ($$anchor) => {
		GymSection($$anchor, {});
	};
	var consequent_7 = ($$anchor) => {
		SpeedSection($$anchor, {});
	};
	var alternate = ($$anchor) => {
		SectionNotFound($$anchor, {});
	};
	if_block(node, ($$render) => {
		if ($$props.sectionId === "information") $$render(consequent);
		else if ($$props.sectionId === "combat") $$render(consequent_1, 1);
		else if ($$props.sectionId === "travel") $$render(consequent_2, 2);
		else if ($$props.sectionId === "faction") $$render(consequent_3, 3);
		else if ($$props.sectionId === "profile") $$render(consequent_4, 4);
		else if ($$props.sectionId === "companies") $$render(consequent_5, 5);
		else if ($$props.sectionId === "gym") $$render(consequent_6, 6);
		else if ($$props.sectionId === "speed") $$render(consequent_7, 7);
		else $$render(alternate, -1);
	});
	append($$anchor, fragment);
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/PreferencesContent.svelte
var root_7$1 = from_html(`<section class="rounded-lg border border-border bg-card px-3 py-2"><h2 class="text-lg font-bold">Not Found - Group</h2> <p class="mt-1 text-sm text-muted-foreground">Couldn't find your requested preferences group.</p></section>`);
var root_8$1 = from_html(`<div class="flex justify-center"><!></div>`);
function PreferencesContent($$anchor, $$props) {
	push($$props, true);
	var fragment = comment();
	var node = first_child(fragment);
	var consequent_5 = ($$anchor) => {
		var fragment_1 = comment();
		var node_1 = first_child(fragment_1);
		var consequent = ($$anchor) => {
			InternalGroup($$anchor, { get sectionId() {
				return $$props.sectionId;
			} });
		};
		var consequent_1 = ($$anchor) => {
			GlobalGroup($$anchor, { get sectionId() {
				return $$props.sectionId;
			} });
		};
		var consequent_2 = ($$anchor) => {
			FinancialGroup($$anchor, { get sectionId() {
				return $$props.sectionId;
			} });
		};
		var consequent_3 = ($$anchor) => {
			QolGroup($$anchor, { get sectionId() {
				return $$props.sectionId;
			} });
		};
		var consequent_4 = ($$anchor) => {
			ConnectionsGroup($$anchor, {});
		};
		var alternate = ($$anchor) => {
			append($$anchor, root_7$1());
		};
		if_block(node_1, ($$render) => {
			if ($$props.groupId === "internal") $$render(consequent);
			else if ($$props.groupId === "global") $$render(consequent_1, 1);
			else if ($$props.groupId === "financial") $$render(consequent_2, 2);
			else if ($$props.groupId === "qol") $$render(consequent_3, 3);
			else if ($$props.groupId === "connections") $$render(consequent_4, 4);
			else $$render(alternate, -1);
		});
		append($$anchor, fragment_1);
	};
	var d = user_derived(() => isStoresInitialized());
	var alternate_1 = ($$anchor) => {
		var div = root_8$1();
		Spinner(child(div), { class: "size-16" });
		reset(div);
		append($$anchor, div);
	};
	if_block(node, ($$render) => {
		if (get(d)) $$render(consequent_5);
		else $$render(alternate_1, -1);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/configuration.ts
var PREFERENCE_GROUPS = [
	{
		id: "internal",
		title: "Internal",
		sections: [
			{
				id: "internal",
				title: "Internal"
			},
			{
				id: "popup",
				title: "Popup"
			},
			{
				id: "notifications",
				title: "Notifications"
			},
			{
				id: "api",
				title: "API"
			}
		]
	},
	{
		id: "global",
		title: "Global",
		sections: [
			{
				id: "global",
				title: "Global"
			},
			{
				id: "sidebar",
				title: "Sidebar"
			},
			{
				id: "chat",
				title: "Chat"
			},
			{
				id: "advanced",
				title: "Advanced"
			}
		]
	},
	{
		id: "financial",
		title: "Financial",
		sections: [
			{
				id: "money",
				title: "Money"
			},
			{
				id: "markets",
				title: "Markets"
			},
			{
				id: "items",
				title: "Items"
			}
		]
	},
	{
		id: "qol",
		title: "QoL",
		sections: [
			{
				id: "information",
				title: "Information"
			},
			{
				id: "combat",
				title: "Combat"
			},
			{
				id: "travel",
				title: "Travel"
			},
			{
				id: "faction",
				title: "Faction"
			},
			{
				id: "profile",
				title: "Profile"
			},
			{
				id: "companies",
				title: "Companies"
			},
			{
				id: "gym",
				title: "Gym"
			},
			{
				id: "speed",
				title: "Speed"
			}
		]
	},
	{
		id: "connections",
		title: "Connections",
		sections: [{
			id: "services",
			title: "Services"
		}]
	}
];
//#endregion
//#region src/extension/entrypoints/options/components/preferences/preferences.ts
function getPreferenceGroup(id) {
	return PREFERENCE_GROUPS.find((group) => group.id === id) ?? PREFERENCE_GROUPS[0];
}
function getPreferenceSections(group) {
	return group.sections ?? [];
}
function getPreferenceSection(group, sectionId) {
	return getPreferenceSections(group).find((section) => section.id === sectionId);
}
function getPreferenceGroupRoute(groupId) {
	return groupId === "internal" ? "/preferences" : `/preferences/${groupId}`;
}
function getPreferenceSectionRoute(groupId, sectionId) {
	return `/preferences/${groupId}/${sectionId}`;
}
function resolvePreferenceRoute(groupId, sectionId) {
	const group = getPreferenceGroup(groupId);
	const sections = getPreferenceSections(group);
	const section = getPreferenceSection(group, sectionId) ?? sections[0];
	return {
		group,
		section,
		route: (section ? getPreferenceSectionRoute(group.id, section.id) : void 0) ?? getPreferenceGroupRoute(group.id)
	};
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/PreferencesNavigation.svelte
var root_1$1 = from_html(`<div><a> </a></div>`);
var root$3 = from_html(`<aside class="rounded-lg border border-sidebar bg-sidebar p-2 space-y-1"></aside>`);
function PreferencesNavigation($$anchor, $$props) {
	push($$props, true);
	var aside = root$3();
	each(aside, 21, () => PREFERENCE_GROUPS, (group) => group.id, ($$anchor, group) => {
		var div = root_1$1();
		var a = child(div);
		var text = child(a, true);
		reset(a);
		action(a, ($$node) => link?.($$node));
		reset(div);
		template_effect(($0) => {
			set_attribute(a, "href", $0);
			set_class(a, 1, `block rounded-md px-3 py-2 text-sm ${get(group).id === $$props.activeGroup ? "bg-accent text-accent-foreground" : "text-accent-foreground/50 hover:bg-accent/50 hover:text-accent-foreground/75"}`);
			set_text(text, get(group).title);
		}, [() => getPreferenceGroupRoute(get(group).id)]);
		append($$anchor, div);
	});
	reset(aside);
	append($$anchor, aside);
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/PreferencesSectionNavigation.svelte
var root_1 = from_html(`<a><span class="block font-medium"> </span></a>`);
var root$2 = from_html(`<section class="rounded-lg border border-border bg-card p-2"><div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"></div></section>`);
function PreferencesSectionNavigation($$anchor, $$props) {
	push($$props, true);
	var section_1 = root$2();
	var div = child(section_1);
	each(div, 21, () => $$props.sections, (section) => section.id, ($$anchor, section) => {
		var a = root_1();
		var span = child(a);
		var text = child(span, true);
		reset(span);
		reset(a);
		action(a, ($$node) => link?.($$node));
		template_effect(($0) => {
			set_attribute(a, "href", $0);
			set_class(a, 1, `rounded-md border px-3 py-2 text-sm transition-colors ${get(section).id === $$props.activeSection ? "border-gray-300 bg-gray-100 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" : "border-border text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"}`);
			set_text(text, get(section).title);
		}, [() => getPreferenceSectionRoute($$props.groupId, get(section).id)]);
		append($$anchor, a);
	});
	reset(div);
	reset(section_1);
	append($$anchor, section_1);
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/Preferences.svelte
var root$1 = from_html(`<section class="grid gap-2 lg:grid-cols-[10rem_1fr]"><!> <div class="space-y-2"><!> <!></div></section>`);
function Preferences($$anchor, $$props) {
	push($$props, true);
	const routeParts = user_derived(() => getRouteParts(router.location));
	const resolvedRoute = user_derived(() => resolvePreferenceRoute(get(routeParts).group, get(routeParts).section));
	const activeGroup = user_derived(() => get(resolvedRoute).group);
	const activeSections = user_derived(() => getPreferenceSections(get(activeGroup)));
	const activeSection = user_derived(() => get(resolvedRoute).section);
	user_effect(() => {
		if (!get(routeParts).isPreferencesRoute) return;
		if (get(resolvedRoute).route !== router.location) replace(get(resolvedRoute).route);
	});
	function getRouteParts(location) {
		const match = location.match(/^\/preferences(?:\/([^/]+))?(?:\/([^/]+))?$/);
		const [, group, section] = match ?? [];
		return {
			isPreferencesRoute: !!match,
			group,
			section
		};
	}
	var section_1 = root$1();
	var node = child(section_1);
	PreferencesNavigation(node, { get activeGroup() {
		return get(activeGroup).id;
	} });
	var div = sibling(node, 2);
	var node_1 = child(div);
	var consequent = ($$anchor) => {
		{
			let $0 = user_derived(() => get(activeSection)?.id);
			PreferencesSectionNavigation($$anchor, {
				get groupId() {
					return get(activeGroup).id;
				},
				get sections() {
					return get(activeSections);
				},
				get activeSection() {
					return get($0);
				}
			});
		}
	};
	if_block(node_1, ($$render) => {
		if (get(activeSections).length) $$render(consequent);
	});
	var node_2 = sibling(node_1, 2);
	{
		let $0 = user_derived(() => get(activeSection)?.id);
		PreferencesContent(node_2, {
			get groupId() {
				return get(activeGroup).id;
			},
			get sectionId() {
				return get($0);
			}
		});
	}
	reset(div);
	reset(section_1);
	append($$anchor, section_1);
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/components/preferences/PreferencesRedirect.svelte
function PreferencesRedirect($$anchor, $$props) {
	push($$props, false);
	onMount(() => void replace("/preferences"));
	init();
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/MissingPermissions.svelte
var root_3 = from_html(`<!> <!>`, 1);
var root_7 = from_html(`<li><span class="font-medium text-foreground"> </span> <span class="block break-all"> </span></li>`);
var root_6 = from_html(`<div class="rounded-lg border border-border bg-muted/30 p-2 text-sm"><h3 class="font-medium">Missing permissions:</h3> <ul class="mt-2 list-disc space-y-1 pl-5 text-muted-foreground"></ul></div>`);
var root_8 = from_html(`<!> <!>`, 1);
var root_2 = from_html(`<!> <!> <!>`, 1);
function MissingPermissions($$anchor, $$props) {
	push($$props, true);
	let openDialog = state(false);
	let missingOrigins = state(proxy([]));
	let requesting = state(false);
	onMount(() => {
		registerExtensionContext();
		checkMissingPermissions();
	});
	async function checkMissingPermissions() {
		if (!browser.permissions) return;
		const { settings } = await loadDatabase();
		const origins = [
			{
				enabled: settings.external.tornstats,
				label: "TornStats",
				origin: FETCH_PLATFORMS.tornstats
			},
			{
				enabled: settings.external.yata,
				label: "YATA",
				origin: FETCH_PLATFORMS.yata
			},
			{
				enabled: settings.external.prometheus,
				label: "Prometheus",
				origin: FETCH_PLATFORMS.prometheus
			},
			{
				enabled: settings.external.lzpt,
				label: "LZPT",
				origin: FETCH_PLATFORMS.lzpt
			},
			{
				enabled: settings.external.tornw3b,
				label: "Torn W3B",
				origin: FETCH_PLATFORMS.tornw3b
			},
			{
				enabled: settings.external.ffScouter,
				label: "FF Scouter",
				origin: FETCH_PLATFORMS.ffscouter
			},
			{
				enabled: settings.external.tornintel,
				label: "Torn Intel",
				origin: FETCH_PLATFORMS.tornintel
			}
		].filter(({ enabled }) => enabled).map(({ label, origin }) => ({
			label,
			origin
		}));
		const reviveProvider = settings.pages.global.reviveProvider;
		if (reviveProvider) {
			const provider = REVIVE_PROVIDERS.find((p) => p.provider === reviveProvider);
			if (provider) origins.push({
				label: provider.name,
				origin: provider.origin
			});
		}
		set(missingOrigins, await getMissingOrigins(origins), true);
		set(openDialog, get(missingOrigins).length > 0);
	}
	async function getMissingOrigins(origins) {
		return (await Promise.all([...origins.values()].map(async (origin) => ({
			...origin,
			granted: await browser.permissions.contains({ origins: [origin.origin] })
		})))).filter(({ granted }) => !granted).map(({ label, origin }) => ({
			label,
			origin
		}));
	}
	function denyRequest() {
		toast.error("These permissions are required for the enabled settings.");
		set(openDialog, false);
	}
	async function requestMissingPermissions() {
		if (!browser.permissions || get(missingOrigins).length === 0) return;
		set(requesting, true);
		try {
			if (await browser.permissions.request({ origins: get(missingOrigins).map(({ origin }) => origin) })) {
				set(missingOrigins, [], true);
				set(openDialog, false);
				toast.success("Permissions granted.");
				return;
			}
			toast.error("These permissions are required for the enabled settings.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to request permissions.");
		} finally {
			set(requesting, false);
		}
	}
	var fragment = comment();
	component(first_child(fragment), () => Dialog, ($$anchor, Dialog_Dialog) => {
		Dialog_Dialog($$anchor, {
			get open() {
				return get(openDialog);
			},
			set open($$value) {
				set(openDialog, $$value, true);
			},
			children: ($$anchor, $$slotProps) => {
				var fragment_1 = comment();
				component(first_child(fragment_1), () => Dialog_content, ($$anchor, Dialog_Content) => {
					Dialog_Content($$anchor, {
						class: "max-w-lg",
						children: ($$anchor, $$slotProps) => {
							var fragment_2 = root_2();
							var node_2 = first_child(fragment_2);
							component(node_2, () => Dialog_header, ($$anchor, Dialog_Header) => {
								Dialog_Header($$anchor, {
									children: ($$anchor, $$slotProps) => {
										var fragment_3 = root_3();
										var node_3 = first_child(fragment_3);
										component(node_3, () => Dialog_title, ($$anchor, Dialog_Title) => {
											Dialog_Title($$anchor, {
												children: ($$anchor, $$slotProps) => {
													next();
													append($$anchor, text("Permission Issue"));
												},
												$$slots: { default: true }
											});
										});
										component(sibling(node_3, 2), () => Dialog_description, ($$anchor, Dialog_Description) => {
											Dialog_Description($$anchor, {
												children: ($$anchor, $$slotProps) => {
													next();
													append($$anchor, text("There are settings enabled that require permissions to be given, but those permissions are missing."));
												},
												$$slots: { default: true }
											});
										});
										append($$anchor, fragment_3);
									},
									$$slots: { default: true }
								});
							});
							var node_5 = sibling(node_2, 2);
							var consequent = ($$anchor) => {
								var div = root_6();
								var ul = sibling(child(div), 2);
								each(ul, 21, () => get(missingOrigins), ({ label, origin }) => origin, ($$anchor, $$item) => {
									let label = () => get($$item).label;
									let origin = () => get($$item).origin;
									var li = root_7();
									var span = child(li);
									var text_2 = child(span, true);
									reset(span);
									var span_1 = sibling(span, 2);
									var text_3 = child(span_1, true);
									reset(span_1);
									reset(li);
									template_effect(() => {
										set_text(text_2, label());
										set_text(text_3, origin());
									});
									append($$anchor, li);
								});
								reset(ul);
								reset(div);
								append($$anchor, div);
							};
							if_block(node_5, ($$render) => {
								if (get(missingOrigins).length > 0) $$render(consequent);
							});
							component(sibling(node_5, 2), () => Dialog_footer, ($$anchor, Dialog_Footer) => {
								Dialog_Footer($$anchor, {
									children: ($$anchor, $$slotProps) => {
										var fragment_4 = root_8();
										var node_7 = first_child(fragment_4);
										Button(node_7, {
											size: "sm",
											variant: "destructive",
											get disabled() {
												return get(requesting);
											},
											onclick: denyRequest,
											children: ($$anchor, $$slotProps) => {
												next();
												append($$anchor, text("Later"));
											},
											$$slots: { default: true }
										});
										Button(sibling(node_7, 2), {
											size: "sm",
											get disabled() {
												return get(requesting);
											},
											onclick: requestMissingPermissions,
											children: ($$anchor, $$slotProps) => {
												next();
												var text_5 = text();
												template_effect(() => set_text(text_5, get(requesting) ? "Requesting..." : "Grant permissions"));
												append($$anchor, text_5);
											},
											$$slots: { default: true }
										});
										append($$anchor, fragment_4);
									},
									$$slots: { default: true }
								});
							});
							append($$anchor, fragment_2);
						},
						$$slots: { default: true }
					});
				});
				append($$anchor, fragment_1);
			},
			$$slots: { default: true }
		});
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region src/extension/entrypoints/options/Options.svelte
var root = from_html(`<!> <!>`, 1);
function Options($$anchor) {
	const routes = {
		"/changelog": Changelog,
		"/preferences": Preferences,
		"/preferences/*": Preferences,
		"/export": Export,
		"/about": About,
		"/": PreferencesRedirect
	};
	var fragment = root();
	var node = first_child(fragment);
	MissingPermissions(node, {});
	GlobalLayout(sibling(node, 2), {
		children: ($$anchor, $$slotProps) => {
			Router($$anchor, { get routes() {
				return routes;
			} });
		},
		$$slots: { default: true }
	});
	append($$anchor, fragment);
}
//#endregion
//#region src/extension/entrypoints/options/options.ts
mount(Options, { target: document.getElementById("app") });
//#endregion

//# sourceMappingURL=options-1WImVjra.js.map