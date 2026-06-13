import { At as snippet, Dn as noop, En as reset, Sn as push, Vt as from_html, _t as bind_this, an as child, c as cn, mt as rest_props, pt as prop, xn as pop, xt as attribute_effect, zt as append } from "./dist-X5FUUfHt.js";
//#region src/extension/svelte/components/ui/table/table.svelte
var root$7 = from_html(`<div data-slot="table-container" class="relative w-full overflow-x-auto"><table><!></table></div>`);
function Table($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"children"
	]);
	var div = root$7();
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
//#region src/extension/svelte/components/ui/table/table-body.svelte
var root$6 = from_html(`<tbody><!></tbody>`);
function Table_body($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"children"
	]);
	var tbody = root$6();
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
from_html(`<caption><!></caption>`);
//#endregion
//#region src/extension/svelte/components/ui/table/table-cell.svelte
var root$4 = from_html(`<td><!></td>`);
function Table_cell($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"children"
	]);
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
from_html(`<tfoot><!></tfoot>`);
//#endregion
//#region src/extension/svelte/components/ui/table/table-head.svelte
var root$2 = from_html(`<th><!></th>`);
function Table_head($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"children"
	]);
	var th = root$2();
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
var root$1 = from_html(`<thead><!></thead>`);
function Table_header($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"children"
	]);
	var thead = root$1();
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
var root = from_html(`<tr><!></tr>`);
function Table_row($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"children"
	]);
	var tr = root();
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
export { Table_body as a, Table_cell as i, Table_header as n, Table as o, Table_head as r, Table_row as t };

//# sourceMappingURL=table-tdIg9jkX.js.map