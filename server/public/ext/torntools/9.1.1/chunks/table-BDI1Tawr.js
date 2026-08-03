import { G as bind_this, H as rest_props, Nt as child, V as prop, Xt as pop, Y as attribute_effect, Zt as push, c as cn, ht as from_html, it as snippet, nn as noop, pt as append, tn as reset } from "./dist-DM3lq6UN.js";
//#region src/extension/svelte/components/ui/table/table-body.svelte
var rest_excludes$5 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class",
	"children"
]);
var root$5 = from_html(`<tbody><!></tbody>`);
function Table_body($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes$5);
	var tbody = root$5();
	attribute_effect(tbody, ($0) => ({
		"data-slot": "table-body",
		class: $0,
		...restProps
	}), [() => cn("[&_tr:last-child]:border-0", $$props.class)]);
	snippet(child(tbody), () => $$props.children ?? noop);
	reset(tbody);
	bind_this(tbody, ($$value) => ref($$value), () => ref());
	append($$anchor, tbody);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/table/table-cell.svelte
var rest_excludes$4 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class",
	"children"
]);
var root$4 = from_html(`<td><!></td>`);
function Table_cell($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes$4);
	var td = root$4();
	attribute_effect(td, ($0) => ({
		"data-slot": "table-cell",
		class: $0,
		...restProps
	}), [() => cn("p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0", $$props.class)]);
	snippet(child(td), () => $$props.children ?? noop);
	reset(td);
	bind_this(td, ($$value) => ref($$value), () => ref());
	append($$anchor, td);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/table/table-head.svelte
var rest_excludes$3 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class",
	"children"
]);
var root$3 = from_html(`<th><!></th>`);
function Table_head($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes$3);
	var th = root$3();
	attribute_effect(th, ($0) => ({
		"data-slot": "table-head",
		class: $0,
		...restProps
	}), [() => cn("text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0", $$props.class)]);
	snippet(child(th), () => $$props.children ?? noop);
	reset(th);
	bind_this(th, ($$value) => ref($$value), () => ref());
	append($$anchor, th);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/table/table-header.svelte
var rest_excludes$2 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class",
	"children"
]);
var root$2 = from_html(`<thead><!></thead>`);
function Table_header($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes$2);
	var thead = root$2();
	attribute_effect(thead, ($0) => ({
		"data-slot": "table-header",
		class: $0,
		...restProps
	}), [() => cn("[&_tr]:border-b", $$props.class)]);
	snippet(child(thead), () => $$props.children ?? noop);
	reset(thead);
	bind_this(thead, ($$value) => ref($$value), () => ref());
	append($$anchor, thead);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/table/table-row.svelte
var rest_excludes$1 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class",
	"children"
]);
var root$1 = from_html(`<tr><!></tr>`);
function Table_row($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes$1);
	var tr = root$1();
	attribute_effect(tr, ($0) => ({
		"data-slot": "table-row",
		class: $0,
		...restProps
	}), [() => cn("hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors", $$props.class)]);
	snippet(child(tr), () => $$props.children ?? noop);
	reset(tr);
	bind_this(tr, ($$value) => ref($$value), () => ref());
	append($$anchor, tr);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/table/table.svelte
var rest_excludes = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class",
	"children"
]);
var root = from_html(`<div data-slot="table-container" class="relative w-full overflow-x-auto"><table><!></table></div>`);
function Table($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes);
	var div = root();
	var table = child(div);
	attribute_effect(table, ($0) => ({
		"data-slot": "table",
		class: $0,
		...restProps
	}), [() => cn("w-full caption-bottom text-sm", $$props.class)]);
	snippet(child(table), () => $$props.children ?? noop);
	reset(table);
	bind_this(table, ($$value) => ref($$value), () => ref());
	reset(div);
	append($$anchor, div);
	pop();
}
//#endregion
export { Table_cell as a, Table_head as i, Table_row as n, Table_body as o, Table_header as r, Table as t };

//# sourceMappingURL=table-BDI1Tawr.js.map