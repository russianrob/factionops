import { At as snippet, Bt as comment, Dn as noop, En as reset, Ft as if_block, Ht as from_svg, Sn as push, Tn as next, Ut as props_id, Vt as from_html, Wt as text, Zt as get, an as child, c as cn, gt as init, ht as spread_props, kt as component, mt as rest_props, on as first_child, pn as user_derived, pt as prop, sn as sibling, un as set, wn as snapshot, xn as pop, xt as attribute_effect, yt as bind_value, zt as append } from "./dist-X5FUUfHt.js";
import { At as Context, J as noop$1, Mt as mergeProps, Pt as boxWith, Q as isHTMLElement, St as attachRef, _t as createBitsAttrs, gt as boolToTrueOrUndef, jt as srOnlyStyles, kt as watch, m as getIconContext, mt as boolToStr, pt as boolToEmptyStrOrUndef, q as createId, u as Check, vt as getAriaChecked, yt as getDataChecked } from "./TrashIcon-Do1I_oxJ.js";
//#region node_modules/bits-ui/dist/bits/checkbox/checkbox.svelte.js
var checkboxAttrs = createBitsAttrs({
	component: "checkbox",
	parts: [
		"root",
		"group",
		"group-label",
		"input"
	]
});
var CheckboxGroupContext = new Context("Checkbox.Group");
var CheckboxRootContext = new Context("Checkbox.Root");
var CheckboxRootState = class CheckboxRootState {
	static create(opts, group = null) {
		return CheckboxRootContext.set(new CheckboxRootState(opts, group));
	}
	opts;
	group;
	#trueName = user_derived(() => {
		if (this.group && this.group.opts.name.current) return this.group.opts.name.current;
		return this.opts.name.current;
	});
	get trueName() {
		return get(this.#trueName);
	}
	set trueName(value) {
		set(this.#trueName, value);
	}
	#trueRequired = user_derived(() => {
		if (this.group && this.group.opts.required.current) return true;
		return this.opts.required.current;
	});
	get trueRequired() {
		return get(this.#trueRequired);
	}
	set trueRequired(value) {
		set(this.#trueRequired, value);
	}
	#trueDisabled = user_derived(() => {
		if (this.group && this.group.opts.disabled.current) return true;
		return this.opts.disabled.current;
	});
	get trueDisabled() {
		return get(this.#trueDisabled);
	}
	set trueDisabled(value) {
		set(this.#trueDisabled, value);
	}
	#trueReadonly = user_derived(() => {
		if (this.group && this.group.opts.readonly.current) return true;
		return this.opts.readonly.current;
	});
	get trueReadonly() {
		return get(this.#trueReadonly);
	}
	set trueReadonly(value) {
		set(this.#trueReadonly, value);
	}
	attachment;
	constructor(opts, group) {
		this.opts = opts;
		this.group = group;
		this.attachment = attachRef(this.opts.ref);
		this.onkeydown = this.onkeydown.bind(this);
		this.onclick = this.onclick.bind(this);
		watch.pre([() => snapshot(this.group?.opts.value.current), () => this.opts.value.current], ([groupValue, value]) => {
			if (!groupValue || !value) return;
			this.opts.checked.current = groupValue.includes(value);
		});
		watch.pre(() => this.opts.checked.current, (checked) => {
			if (!this.group) return;
			if (checked) this.group?.addValue(this.opts.value.current);
			else this.group?.removeValue(this.opts.value.current);
		});
	}
	onkeydown(e) {
		if (this.trueDisabled || this.trueReadonly) return;
		if (e.key === "Enter") {
			e.preventDefault();
			if (this.opts.type.current === "submit") e.currentTarget.closest("form")?.requestSubmit();
			return;
		}
		if (e.key === " ") {
			e.preventDefault();
			this.#toggle();
		}
	}
	#toggle() {
		if (this.opts.indeterminate.current) {
			this.opts.indeterminate.current = false;
			this.opts.checked.current = true;
		} else this.opts.checked.current = !this.opts.checked.current;
	}
	onclick(e) {
		if (this.trueDisabled || this.trueReadonly) return;
		if (this.opts.type.current === "submit") {
			this.#toggle();
			return;
		}
		e.preventDefault();
		this.#toggle();
	}
	#snippetProps = user_derived(() => ({
		checked: this.opts.checked.current,
		indeterminate: this.opts.indeterminate.current
	}));
	get snippetProps() {
		return get(this.#snippetProps);
	}
	set snippetProps(value) {
		set(this.#snippetProps, value);
	}
	#props = user_derived(() => ({
		id: this.opts.id.current,
		role: "checkbox",
		type: this.opts.type.current,
		disabled: this.trueDisabled,
		"aria-checked": getAriaChecked(this.opts.checked.current, this.opts.indeterminate.current),
		"aria-required": boolToStr(this.trueRequired),
		"aria-readonly": boolToStr(this.trueReadonly),
		"data-disabled": boolToEmptyStrOrUndef(this.trueDisabled),
		"data-readonly": boolToEmptyStrOrUndef(this.trueReadonly),
		"data-state": getCheckboxDataState(this.opts.checked.current, this.opts.indeterminate.current),
		[checkboxAttrs.root]: "",
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
var CheckboxInputState = class CheckboxInputState {
	static create() {
		return new CheckboxInputState(CheckboxRootContext.get());
	}
	root;
	#trueChecked = user_derived(() => {
		if (!this.root.group) return this.root.opts.checked.current;
		if (this.root.opts.value.current !== void 0 && this.root.group.opts.value.current.includes(this.root.opts.value.current)) return true;
		return false;
	});
	get trueChecked() {
		return get(this.#trueChecked);
	}
	set trueChecked(value) {
		set(this.#trueChecked, value);
	}
	#shouldRender = user_derived(() => Boolean(this.root.trueName));
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
		if (!isHTMLElement(this.root.opts.ref.current)) return;
		this.root.opts.ref.current.focus();
	}
	#props = user_derived(() => ({
		type: "checkbox",
		checked: this.root.opts.checked.current === true,
		disabled: this.root.trueDisabled,
		required: this.root.trueRequired,
		name: this.root.trueName,
		value: this.root.opts.value.current,
		readonly: this.root.trueReadonly,
		onfocus: this.onfocus
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
function getCheckboxDataState(checked, indeterminate) {
	if (indeterminate) return "indeterminate";
	return checked ? "checked" : "unchecked";
}
//#endregion
//#region node_modules/bits-ui/dist/bits/utilities/hidden-input.svelte
var root_1$1 = from_html(`<input/>`);
var root_2$5 = from_html(`<input/>`);
function Hidden_input($$anchor, $$props) {
	push($$props, true);
	let value = prop($$props, "value", 15), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"value"
	]);
	const mergedProps = user_derived(() => mergeProps(restProps, {
		"aria-hidden": "true",
		tabindex: -1,
		style: {
			...srOnlyStyles,
			position: "absolute",
			top: "0",
			left: "0"
		}
	}));
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		var input = root_1$1();
		attribute_effect(input, () => ({
			...get(mergedProps),
			value: value()
		}), void 0, void 0, void 0, void 0, true);
		append($$anchor, input);
	};
	var alternate = ($$anchor) => {
		var input_1 = root_2$5();
		attribute_effect(input_1, () => ({ ...get(mergedProps) }), void 0, void 0, void 0, void 0, true);
		bind_value(input_1, value);
		append($$anchor, input_1);
	};
	if_block(node, ($$render) => {
		if (get(mergedProps).type === "checkbox") $$render(consequent);
		else $$render(alternate, -1);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/checkbox/components/checkbox-input.svelte
function Checkbox_input($$anchor, $$props) {
	push($$props, false);
	const inputState = CheckboxInputState.create();
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
//#region node_modules/bits-ui/dist/bits/checkbox/components/checkbox.svelte
var root_2$4 = from_html(`<button><!></button>`);
var root$3 = from_html(`<!> <!>`, 1);
function Checkbox$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let checked = prop($$props, "checked", 15, false), ref = prop($$props, "ref", 15, null), disabled = prop($$props, "disabled", 3, false), required = prop($$props, "required", 3, false), name = prop($$props, "name", 3, void 0), value = prop($$props, "value", 3, "on"), id = prop($$props, "id", 19, () => createId(uid)), indeterminate = prop($$props, "indeterminate", 15, false), type = prop($$props, "type", 3, "button"), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"checked",
		"ref",
		"onCheckedChange",
		"children",
		"disabled",
		"required",
		"name",
		"value",
		"id",
		"indeterminate",
		"onIndeterminateChange",
		"child",
		"type",
		"readonly"
	]);
	const group = CheckboxGroupContext.getOr(null);
	if (group && value()) if (group.opts.value.current.includes(value())) checked(true);
	else checked(false);
	watch.pre(() => value(), () => {
		if (group && value()) if (group.opts.value.current.includes(value())) checked(true);
		else checked(false);
	});
	const rootState = CheckboxRootState.create({
		checked: boxWith(() => checked(), (v) => {
			checked(v);
			$$props.onCheckedChange?.(v);
		}),
		disabled: boxWith(() => disabled() ?? false),
		required: boxWith(() => required()),
		name: boxWith(() => name()),
		value: boxWith(() => value()),
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v)),
		indeterminate: boxWith(() => indeterminate(), (v) => {
			indeterminate(v);
			$$props.onIndeterminateChange?.(v);
		}),
		type: boxWith(() => type()),
		readonly: boxWith(() => Boolean($$props.readonly))
	}, group);
	const mergedProps = user_derived(() => mergeProps({ ...restProps }, rootState.props));
	var fragment = root$3();
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
		var button = root_2$4();
		attribute_effect(button, () => ({ ...get(mergedProps) }));
		snippet(child(button), () => $$props.children ?? noop, () => rootState.snippetProps);
		reset(button);
		append($$anchor, button);
	};
	if_block(node, ($$render) => {
		if ($$props.child) $$render(consequent);
		else $$render(alternate, -1);
	});
	Checkbox_input(sibling(node, 2), {});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/switch/switch.svelte.js
var switchAttrs = createBitsAttrs({
	component: "switch",
	parts: ["root", "thumb"]
});
var SwitchRootContext = new Context("Switch.Root");
var SwitchRootState = class SwitchRootState {
	static create(opts) {
		return SwitchRootContext.set(new SwitchRootState(opts));
	}
	opts;
	attachment;
	constructor(opts) {
		this.opts = opts;
		this.attachment = attachRef(opts.ref);
		this.onkeydown = this.onkeydown.bind(this);
		this.onclick = this.onclick.bind(this);
	}
	#toggle() {
		this.opts.checked.current = !this.opts.checked.current;
	}
	onkeydown(e) {
		if (!(e.key === "Enter" || e.key === " ") || this.opts.disabled.current) return;
		e.preventDefault();
		this.#toggle();
	}
	onclick(_) {
		if (this.opts.disabled.current) return;
		this.#toggle();
	}
	#sharedProps = user_derived(() => ({
		"data-disabled": boolToEmptyStrOrUndef(this.opts.disabled.current),
		"data-state": getDataChecked(this.opts.checked.current),
		"data-required": boolToEmptyStrOrUndef(this.opts.required.current)
	}));
	get sharedProps() {
		return get(this.#sharedProps);
	}
	set sharedProps(value) {
		set(this.#sharedProps, value);
	}
	#snippetProps = user_derived(() => ({ checked: this.opts.checked.current }));
	get snippetProps() {
		return get(this.#snippetProps);
	}
	set snippetProps(value) {
		set(this.#snippetProps, value);
	}
	#props = user_derived(() => ({
		...this.sharedProps,
		id: this.opts.id.current,
		role: "switch",
		disabled: boolToTrueOrUndef(this.opts.disabled.current),
		"aria-checked": getAriaChecked(this.opts.checked.current, false),
		"aria-required": boolToStr(this.opts.required.current),
		[switchAttrs.root]: "",
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
var SwitchInputState = class SwitchInputState {
	static create() {
		return new SwitchInputState(SwitchRootContext.get());
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
	}
	#props = user_derived(() => ({
		type: "checkbox",
		name: this.root.opts.name.current,
		value: this.root.opts.value.current,
		checked: this.root.opts.checked.current,
		disabled: this.root.opts.disabled.current,
		required: this.root.opts.required.current
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
var SwitchThumbState = class SwitchThumbState {
	static create(opts) {
		return new SwitchThumbState(opts, SwitchRootContext.get());
	}
	opts;
	root;
	attachment;
	constructor(opts, root) {
		this.opts = opts;
		this.root = root;
		this.attachment = attachRef(opts.ref);
	}
	#snippetProps = user_derived(() => ({ checked: this.root.opts.checked.current }));
	get snippetProps() {
		return get(this.#snippetProps);
	}
	set snippetProps(value) {
		set(this.#snippetProps, value);
	}
	#props = user_derived(() => ({
		...this.root.sharedProps,
		id: this.opts.id.current,
		[switchAttrs.thumb]: "",
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
//#region node_modules/bits-ui/dist/bits/switch/components/switch-input.svelte
function Switch_input($$anchor, $$props) {
	push($$props, false);
	const inputState = SwitchInputState.create();
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
//#region node_modules/bits-ui/dist/bits/switch/components/switch.svelte
var root_2$3 = from_html(`<button><!></button>`);
var root$2 = from_html(`<!> <!>`, 1);
function Switch$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), id = prop($$props, "id", 19, () => createId(uid)), disabled = prop($$props, "disabled", 3, false), required = prop($$props, "required", 3, false), checked = prop($$props, "checked", 15, false), value = prop($$props, "value", 3, "on"), name = prop($$props, "name", 3, void 0), type = prop($$props, "type", 3, "button"), onCheckedChange = prop($$props, "onCheckedChange", 3, noop$1), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"child",
		"children",
		"ref",
		"id",
		"disabled",
		"required",
		"checked",
		"value",
		"name",
		"type",
		"onCheckedChange"
	]);
	const rootState = SwitchRootState.create({
		checked: boxWith(() => checked(), (v) => {
			checked(v);
			onCheckedChange()?.(v);
		}),
		disabled: boxWith(() => disabled() ?? false),
		required: boxWith(() => required()),
		value: boxWith(() => value()),
		name: boxWith(() => name()),
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v))
	});
	const mergedProps = user_derived(() => mergeProps(restProps, rootState.props, { type: type() }));
	var fragment = root$2();
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
		var button = root_2$3();
		attribute_effect(button, () => ({ ...get(mergedProps) }));
		snippet(child(button), () => $$props.children ?? noop, () => rootState.snippetProps);
		reset(button);
		append($$anchor, button);
	};
	if_block(node, ($$render) => {
		if ($$props.child) $$render(consequent);
		else $$render(alternate, -1);
	});
	Switch_input(sibling(node, 2), {});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/switch/components/switch-thumb.svelte
var root_2$2 = from_html(`<span><!></span>`);
function Switch_thumb($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), id = prop($$props, "id", 19, () => createId(uid)), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"child",
		"children",
		"ref",
		"id"
	]);
	const thumbState = SwitchThumbState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v))
	});
	const mergedProps = user_derived(() => mergeProps(restProps, thumbState.props));
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		var fragment_1 = comment();
		var node_1 = first_child(fragment_1);
		{
			let $0 = user_derived(() => ({
				props: get(mergedProps),
				...thumbState.snippetProps
			}));
			snippet(node_1, () => $$props.child, () => get($0));
		}
		append($$anchor, fragment_1);
	};
	var alternate = ($$anchor) => {
		var span = root_2$2();
		attribute_effect(span, () => ({ ...get(mergedProps) }));
		snippet(child(span), () => $$props.children ?? noop, () => thumbState.snippetProps);
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
//#region node_modules/phosphor-svelte/lib/Minus.svelte
var root_2$1 = from_svg(`<path d="M228,128a12,12,0,0,1-12,12H40a12,12,0,0,1,0-24H216A12,12,0,0,1,228,128Z"></path>`);
var root_3$1 = from_svg(`<path d="M216,56V200a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V56A16,16,0,0,1,56,40H200A16,16,0,0,1,216,56Z" opacity="0.2"></path><path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128Z"></path>`, 1);
var root_4$1 = from_svg(`<path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM184,136H72a8,8,0,0,1,0-16H184a8,8,0,0,1,0,16Z"></path>`);
var root_5$1 = from_svg(`<path d="M222,128a6,6,0,0,1-6,6H40a6,6,0,0,1,0-12H216A6,6,0,0,1,222,128Z"></path>`);
var root_6$1 = from_svg(`<path d="M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128Z"></path>`);
var root_7$1 = from_svg(`<path d="M220,128a4,4,0,0,1-4,4H40a4,4,0,0,1,0-8H216A4,4,0,0,1,220,128Z"></path>`);
var root$1 = from_svg(`<svg><!><rect width="256" height="256" fill="none"></rect><!></svg>`);
function Minus($$anchor, $$props) {
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
	var svg = root$1();
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
		append($$anchor, root_2$1());
	};
	var consequent_2 = ($$anchor) => {
		var fragment_1 = root_3$1();
		next();
		append($$anchor, fragment_1);
	};
	var consequent_3 = ($$anchor) => {
		append($$anchor, root_4$1());
	};
	var consequent_4 = ($$anchor) => {
		append($$anchor, root_5$1());
	};
	var consequent_5 = ($$anchor) => {
		append($$anchor, root_6$1());
	};
	var consequent_6 = ($$anchor) => {
		append($$anchor, root_7$1());
	};
	var alternate = ($$anchor) => {
		var text$2 = text();
		text$2.nodeValue = (console.error("Unsupported icon weight. Choose from \"thin\", \"light\", \"regular\", \"bold\", \"fill\", or \"duotone\"."), "");
		append($$anchor, text$2);
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
//#region src/extension/svelte/components/ui/checkbox/checkbox.svelte
var root_1 = from_html(`<div data-slot="checkbox-indicator" class="[&amp;>svg]:size-3.5 grid place-content-center text-current transition-none"><!></div>`);
function Checkbox($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), checked = prop($$props, "checked", 15, false), indeterminate = prop($$props, "indeterminate", 15, false), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"checked",
		"indeterminate",
		"class"
	]);
	var fragment = comment();
	var node = first_child(fragment);
	{
		const children = ($$anchor, $$arg0) => {
			let checked = () => $$arg0?.().checked;
			let indeterminate = () => $$arg0?.().indeterminate;
			var div = root_1();
			var node_1 = child(div);
			var consequent = ($$anchor) => {
				Check($$anchor, {});
			};
			var consequent_1 = ($$anchor) => {
				Minus($$anchor, {});
			};
			if_block(node_1, ($$render) => {
				if (checked()) $$render(consequent);
				else if (indeterminate()) $$render(consequent_1, 1);
			});
			reset(div);
			append($$anchor, div);
		};
		let $0 = user_derived(() => cn("border-input dark:bg-input/30 data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary data-checked:border-primary aria-invalid:aria-checked:border-primary aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 flex size-4 items-center justify-center rounded-[4px] border transition-colors group-has-disabled/field:opacity-50 focus-visible:ring-3 aria-invalid:ring-3 peer relative shrink-0 outline-none after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:opacity-50", $$props.class));
		component(node, () => Checkbox$1, ($$anchor, CheckboxPrimitive_Root) => {
			CheckboxPrimitive_Root($$anchor, spread_props({
				"data-slot": "checkbox",
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
				get checked() {
					return checked();
				},
				set checked($$value) {
					checked($$value);
				},
				get indeterminate() {
					return indeterminate();
				},
				set indeterminate($$value) {
					indeterminate($$value);
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
//#region src/extension/svelte/components/ui/switch/switch.svelte
function Switch($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), checked = prop($$props, "checked", 15, false), size = prop($$props, "size", 3, "default"), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"checked",
		"size"
	]);
	var fragment = comment();
	var node = first_child(fragment);
	{
		let $0 = user_derived(() => cn("data-checked:bg-primary data-unchecked:bg-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 dark:data-unchecked:bg-input/80 shrink-0 rounded-full border border-transparent focus-visible:ring-3 aria-invalid:ring-3 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] peer group/switch relative inline-flex items-center transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 data-disabled:cursor-not-allowed data-disabled:opacity-50", $$props.class));
		component(node, () => Switch$1, ($$anchor, SwitchPrimitive_Root) => {
			SwitchPrimitive_Root($$anchor, spread_props({
				"data-slot": "switch",
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
				get checked() {
					return checked();
				},
				set checked($$value) {
					checked($$value);
				},
				children: ($$anchor, $$slotProps) => {
					var fragment_1 = comment();
					component(first_child(fragment_1), () => Switch_thumb, ($$anchor, SwitchPrimitive_Thumb) => {
						SwitchPrimitive_Thumb($$anchor, {
							"data-slot": "switch-thumb",
							class: "bg-background dark:data-unchecked:bg-foreground dark:data-checked:bg-primary-foreground rounded-full group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 pointer-events-none block ring-0 transition-transform rtl:data-[state=checked]:translate-x-[calc(-100%)]"
						});
					});
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
//#region node_modules/phosphor-svelte/lib/PlusIcon.svelte
var root_2 = from_svg(`<path d="M228,128a12,12,0,0,1-12,12H140v76a12,12,0,0,1-24,0V140H40a12,12,0,0,1,0-24h76V40a12,12,0,0,1,24,0v76h76A12,12,0,0,1,228,128Z"></path>`);
var root_3 = from_svg(`<path d="M216,56V200a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V56A16,16,0,0,1,56,40H200A16,16,0,0,1,216,56Z" opacity="0.2"></path><path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"></path>`, 1);
var root_4 = from_svg(`<path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM184,136H136v48a8,8,0,0,1-16,0V136H72a8,8,0,0,1,0-16h48V72a8,8,0,0,1,16,0v48h48a8,8,0,0,1,0,16Z"></path>`);
var root_5 = from_svg(`<path d="M222,128a6,6,0,0,1-6,6H134v82a6,6,0,0,1-12,0V134H40a6,6,0,0,1,0-12h82V40a6,6,0,0,1,12,0v82h82A6,6,0,0,1,222,128Z"></path>`);
var root_6 = from_svg(`<path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"></path>`);
var root_7 = from_svg(`<path d="M220,128a4,4,0,0,1-4,4H132v84a4,4,0,0,1-8,0V132H40a4,4,0,0,1,0-8h84V40a4,4,0,0,1,8,0v84h84A4,4,0,0,1,220,128Z"></path>`);
var root = from_svg(`<svg><!><rect width="256" height="256" fill="none"></rect><!></svg>`);
function PlusIcon($$anchor, $$props) {
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
	var svg = root();
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
		append($$anchor, root_2());
	};
	var consequent_2 = ($$anchor) => {
		var fragment_1 = root_3();
		next();
		append($$anchor, fragment_1);
	};
	var consequent_3 = ($$anchor) => {
		append($$anchor, root_4());
	};
	var consequent_4 = ($$anchor) => {
		append($$anchor, root_5());
	};
	var consequent_5 = ($$anchor) => {
		append($$anchor, root_6());
	};
	var consequent_6 = ($$anchor) => {
		append($$anchor, root_7());
	};
	var alternate = ($$anchor) => {
		var text$1 = text();
		text$1.nodeValue = (console.error("Unsupported icon weight. Choose from \"thin\", \"light\", \"regular\", \"bold\", \"fill\", or \"duotone\"."), "");
		append($$anchor, text$1);
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
export { Hidden_input as i, Switch as n, Checkbox as r, PlusIcon as t };

//# sourceMappingURL=PlusIcon-DGt_yeIS.js.map