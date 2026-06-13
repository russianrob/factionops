import { At as snippet, Bt as comment, Ct as set_style, Dn as noop, Dt as action, En as reset, Ft as if_block, Ht as from_svg, It as mount, Lt as set_text, Mt as each, N as sleep, Nt as index, Ot as element, Pt as key, Sn as push, St as set_attribute, Tn as next, Tt as clsx, Ut as props_id, Vt as from_html, Wt as text, Z as ttCache, Zt as get, _n as writable, _t as bind_this, a as BACKGROUND_SERVICE, an as child, c as cn, cn as proxy, dn as state, ft as onMount, gn as store_get, gt as init, hn as setup_stores, ht as spread_props, i as exposeDebugObjects, j as isToday, kt as component, m as loadDatabase, mt as rest_props, n as setMode, nn as user_effect, on as first_child, p as initializeDatabase, pn as user_derived, pt as prop, rn as user_pre_effect, sn as sibling, t as Mode_watcher, tn as template_effect, un as set, ut as ttStorage, v as storageListeners, w as TO_MILLIS, wn as snapshot, wt as set_class, xn as pop, xt as attribute_effect, yt as bind_value, z as isHTMLElement, zt as append } from "./dist-X5FUUfHt.js";
import { t as browser } from "./browser-DV2XfOQj.js";
import { At as Context, B as getFirstNonCommentChild, Bt as formatDate, D as useId, Ft as applyPlural, Gt as Router, Ht as formatTime, It as capitalizeText, J as noop$1, Jt as router, Kt as link, Mt as mergeProps, Pt as boxWith, Rt as dropDecimals, St as attachRef, Tt as afterSleep, Ut as toSeconds, Vt as formatNumber, _ as tv, _t as createBitsAttrs, a as Tooltip_trigger, c as Tooltip, ct as HOME, d as Badge, et as ARROW_DOWN, h as Button, i as active, jt as srOnlyStyles, kt as watch, l as Sonner_1, m as getIconContext, mt as boolToStr, n as Input, nt as ARROW_RIGHT, o as Tooltip_provider, ot as ENTER, pt as boolToEmptyStrOrUndef, q as createId, qt as replace, r as registerExtensionContext, rt as ARROW_UP, s as Tooltip_content, t as TrashIcon, tt as ARROW_LEFT, u as Check, v as Separator, wt as afterTick } from "./TrashIcon-Do1I_oxJ.js";
import { A as getStockIncrement, D as getRequiredStocks, E as getNextChainBonus, M as isDividendStock, N as isSellable, O as getRewardValue, _ as Spinner, a as Card_description, i as Card_header, j as getStockReward, k as getStockBoughtPrice, l as fetchData, n as checkAPIPermission, o as Card_content, r as Card_title, s as Card, t as changeAPIKey, w as LINKS, y as ALL_ICONS } from "./api-key-C8elNCNX.js";
import { t as CaretDownIcon } from "./CaretDownIcon-BsYArTX4.js";
import { a as Table_body, i as Table_cell, n as Table_header, o as Table, r as Table_head, t as Table_row } from "./table-tdIg9jkX.js";
//#region node_modules/bits-ui/dist/bits/command/utils.js
function findNextSibling(el, selector) {
	let sibling = el.nextElementSibling;
	while (sibling) {
		if (sibling.matches(selector)) return sibling;
		sibling = sibling.nextElementSibling;
	}
}
function findPreviousSibling(el, selector) {
	let sibling = el.previousElementSibling;
	while (sibling) {
		if (sibling.matches(selector)) return sibling;
		sibling = sibling.previousElementSibling;
	}
}
//#endregion
//#region node_modules/bits-ui/dist/internal/css-escape.js
/**
* https://github.com/mathiasbynens/CSS.escape
*
* @param value - The value to escape for use as a CSS identifier
* @returns The escaped CSS identifier string
*/
function cssEscape(value) {
	if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
	const length = value.length;
	let index = -1;
	let codeUnit;
	let result = "";
	const firstCodeUnit = value.charCodeAt(0);
	if (length === 1 && firstCodeUnit === 45) return "\\" + value;
	while (++index < length) {
		codeUnit = value.charCodeAt(index);
		if (codeUnit === 0) {
			result += "�";
			continue;
		}
		if (codeUnit >= 1 && codeUnit <= 31 || codeUnit === 127 || index === 0 && codeUnit >= 48 && codeUnit <= 57 || index === 1 && codeUnit >= 48 && codeUnit <= 57 && firstCodeUnit === 45) {
			result += "\\" + codeUnit.toString(16) + " ";
			continue;
		}
		if (codeUnit >= 128 || codeUnit === 45 || codeUnit === 95 || codeUnit >= 48 && codeUnit <= 57 || codeUnit >= 65 && codeUnit <= 90 || codeUnit >= 97 && codeUnit <= 122) {
			result += value.charAt(index);
			continue;
		}
		result += "\\" + value.charAt(index);
	}
	return result;
}
//#endregion
//#region node_modules/bits-ui/dist/bits/command/command.svelte.js
var COMMAND_VALUE_ATTR = "data-value";
var commandAttrs = createBitsAttrs({
	component: "command",
	parts: [
		"root",
		"list",
		"input",
		"separator",
		"loading",
		"empty",
		"group",
		"group-items",
		"group-heading",
		"item",
		"viewport",
		"input-label"
	]
});
var COMMAND_GROUP_SELECTOR = commandAttrs.selector("group");
var COMMAND_GROUP_ITEMS_SELECTOR = commandAttrs.selector("group-items");
var COMMAND_GROUP_HEADING_SELECTOR = commandAttrs.selector("group-heading");
var COMMAND_ITEM_SELECTOR = commandAttrs.selector("item");
var COMMAND_VALID_ITEM_SELECTOR = `${commandAttrs.selector("item")}:not([aria-disabled="true"])`;
var CommandRootContext = new Context("Command.Root");
var CommandListContext = new Context("Command.List");
var CommandGroupContainerContext = new Context("Command.Group");
var defaultState = {
	search: "",
	value: "",
	filtered: {
		count: 0,
		items: /* @__PURE__ */ new Map(),
		groups: /* @__PURE__ */ new Set()
	}
};
var CommandRootState = class CommandRootState {
	static create(opts) {
		return CommandRootContext.set(new CommandRootState(opts));
	}
	opts;
	attachment;
	#updateScheduled = false;
	#isInitialMount = true;
	sortAfterTick = false;
	sortAndFilterAfterTick = false;
	allItems = /* @__PURE__ */ new Set();
	allGroups = /* @__PURE__ */ new Map();
	allIds = /* @__PURE__ */ new Map();
	#key = state(0);
	get key() {
		return get(this.#key);
	}
	set key(value) {
		set(this.#key, value, true);
	}
	#viewportNode = state(null);
	get viewportNode() {
		return get(this.#viewportNode);
	}
	set viewportNode(value) {
		set(this.#viewportNode, value, true);
	}
	#inputNode = state(null);
	get inputNode() {
		return get(this.#inputNode);
	}
	set inputNode(value) {
		set(this.#inputNode, value, true);
	}
	#labelNode = state(null);
	get labelNode() {
		return get(this.#labelNode);
	}
	set labelNode(value) {
		set(this.#labelNode, value, true);
	}
	#commandState = state(defaultState);
	get commandState() {
		return get(this.#commandState);
	}
	set commandState(value) {
		set(this.#commandState, value);
	}
	#_commandState = state(proxy(defaultState));
	get _commandState() {
		return get(this.#_commandState);
	}
	set _commandState(value) {
		set(this.#_commandState, value, true);
	}
	#snapshot() {
		return snapshot(this._commandState);
	}
	#scheduleUpdate() {
		if (this.#updateScheduled) return;
		this.#updateScheduled = true;
		afterTick(() => {
			this.#updateScheduled = false;
			const currentState = this.#snapshot();
			if (!Object.is(this.commandState, currentState)) {
				this.commandState = currentState;
				this.opts.onStateChange?.current?.(currentState);
			}
		});
	}
	setState(key, value, preventScroll) {
		if (Object.is(this._commandState[key], value)) return;
		this._commandState[key] = value;
		if (key === "search") {
			this.#filterItems();
			this.#sort();
		} else if (key === "value") {
			if (!preventScroll) this.#scrollSelectedIntoView();
		}
		this.#scheduleUpdate();
	}
	constructor(opts) {
		this.opts = opts;
		this.attachment = attachRef(this.opts.ref);
		const defaults = {
			...this._commandState,
			value: this.opts.value.current ?? ""
		};
		this._commandState = defaults;
		this.commandState = defaults;
		this.onkeydown = this.onkeydown.bind(this);
	}
	/**
	* Calculates score for an item based on search text and keywords.
	* Higher score = better match.
	*
	* @param value - Item's display text
	* @param keywords - Optional keywords to boost scoring
	* @returns Score from 0-1, where 0 = no match
	*/
	#score(value, keywords) {
		const filter = this.opts.filter.current ?? computeCommandScore;
		return value ? filter(value, this._commandState.search, keywords) : 0;
	}
	/**
	* Sorts items and groups based on search scores.
	* Groups are sorted by their highest scoring item.
	* When no search active, selects first item.
	*/
	#sort() {
		if (!this._commandState.search || this.opts.shouldFilter.current === false) {
			if (!this._commandState.value || !this.#isInitialMount) this.#selectFirstItem();
			else if (this.#isInitialMount && this._commandState.value) this.#scrollInitialValue();
			return;
		}
		const scores = this._commandState.filtered.items;
		const groups = [];
		for (const value of this._commandState.filtered.groups) {
			const items = this.allGroups.get(value);
			let max = 0;
			if (!items) {
				groups.push([value, max]);
				continue;
			}
			for (const item of items) {
				const score = scores.get(item);
				max = Math.max(score ?? 0, max);
			}
			groups.push([value, max]);
		}
		const listInsertionElement = this.viewportNode;
		const sorted = this.getValidItems().sort((a, b) => {
			const valueA = a.getAttribute("data-value");
			const valueB = b.getAttribute("data-value");
			const scoresA = scores.get(valueA) ?? 0;
			return (scores.get(valueB) ?? 0) - scoresA;
		});
		for (const item of sorted) {
			const group = item.closest(COMMAND_GROUP_ITEMS_SELECTOR);
			if (group) {
				const itemToAppend = item.parentElement === group ? item : item.closest(`${COMMAND_GROUP_ITEMS_SELECTOR} > *`);
				if (itemToAppend) group.appendChild(itemToAppend);
			} else {
				const itemToAppend = item.parentElement === listInsertionElement ? item : item.closest(`${COMMAND_GROUP_ITEMS_SELECTOR} > *`);
				if (itemToAppend) listInsertionElement?.appendChild(itemToAppend);
			}
		}
		const sortedGroups = groups.sort((a, b) => b[1] - a[1]);
		for (const group of sortedGroups) {
			const element = listInsertionElement?.querySelector(`${COMMAND_GROUP_SELECTOR}[${COMMAND_VALUE_ATTR}="${cssEscape(group[0])}"]`);
			element?.parentElement?.appendChild(element);
		}
		this.#selectFirstItem();
	}
	/**
	* Sets current value and triggers re-render if cleared.
	*
	* @param value - New value to set
	*/
	setValue(value, opts) {
		if (value !== this.opts.value.current && value === "") afterTick(() => {
			this.key++;
		});
		this.setState("value", value, opts);
		this.opts.value.current = value;
	}
	/**
	* Selects first non-disabled item on next tick.
	*/
	#selectFirstItem() {
		afterTick(() => {
			const value = this.getValidItems().find((item) => item.getAttribute("aria-disabled") !== "true")?.getAttribute(COMMAND_VALUE_ATTR);
			const shouldPreventScroll = this.#isInitialMount && this.opts.disableInitialScroll.current;
			this.setValue(value ?? "", shouldPreventScroll);
			this.#isInitialMount = false;
		});
	}
	/**
	* Scrolls the initial value into view if it exists and is not the first item.
	* Called during initial mount when a value is provided.
	*/
	#scrollInitialValue() {
		afterTick(() => {
			if (!this.opts.disableInitialScroll.current) this.#scrollSelectedIntoView();
			this.#isInitialMount = false;
		});
	}
	/**
	* Updates filtered items/groups based on search.
	* Recalculates scores and filtered count.
	*/
	#filterItems() {
		if (!this._commandState.search || this.opts.shouldFilter.current === false) {
			this._commandState.filtered.count = this.allItems.size;
			return;
		}
		this._commandState.filtered.groups = /* @__PURE__ */ new Set();
		let itemCount = 0;
		for (const id of this.allItems) {
			const value = this.allIds.get(id)?.value ?? "";
			const keywords = this.allIds.get(id)?.keywords ?? [];
			const rank = this.#score(value, keywords);
			this._commandState.filtered.items.set(id, rank);
			if (rank > 0) itemCount++;
		}
		for (const [groupId, group] of this.allGroups) for (const itemId of group) {
			const currItem = this._commandState.filtered.items.get(itemId);
			if (currItem && currItem > 0) {
				this._commandState.filtered.groups.add(groupId);
				break;
			}
		}
		this._commandState.filtered.count = itemCount;
	}
	/**
	* Gets all non-disabled, visible command items.
	*
	* @returns Array of valid item elements
	* @remarks Exposed for direct item access and bound checking
	*/
	getValidItems() {
		const node = this.opts.ref.current;
		if (!node) return [];
		return Array.from(node.querySelectorAll(COMMAND_VALID_ITEM_SELECTOR)).filter((el) => !!el);
	}
	/**
	* Gets all visible command items.
	*
	* @returns Array of valid item elements
	* @remarks Exposed for direct item access and bound checking
	*/
	getVisibleItems() {
		const node = this.opts.ref.current;
		if (!node) return [];
		return Array.from(node.querySelectorAll(COMMAND_ITEM_SELECTOR)).filter((el) => !!el);
	}
	/** Returns all visible items in a matrix structure
	*
	* @remarks Returns empty if the command isn't configured as a grid
	*
	* @returns
	*/
	get itemsGrid() {
		if (!this.isGrid) return [];
		const columns = this.opts.columns.current ?? 1;
		const items = this.getVisibleItems();
		const grid = [[]];
		let currentGroup = items[0]?.getAttribute("data-group");
		let column = 0;
		let row = 0;
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			const itemGroup = item?.getAttribute("data-group");
			if (currentGroup !== itemGroup) {
				currentGroup = itemGroup;
				column = 1;
				row++;
				grid.push([{
					index: i,
					firstRowOfGroup: true,
					ref: item
				}]);
			} else {
				column++;
				if (column > columns) {
					row++;
					column = 1;
					grid.push([]);
				}
				grid[row]?.push({
					index: i,
					firstRowOfGroup: grid[row]?.[0]?.firstRowOfGroup ?? i === 0,
					ref: item
				});
			}
		}
		return grid;
	}
	/**
	* Gets currently selected command item.
	*
	* @returns Selected element or undefined
	*/
	#getSelectedItem() {
		const node = this.opts.ref.current;
		if (!node) return;
		const selectedNode = node.querySelector(`${COMMAND_VALID_ITEM_SELECTOR}[data-selected]`);
		if (!selectedNode) return;
		return selectedNode;
	}
	/**
	* Scrolls selected item into view.
	* Special handling for first items in groups.
	*/
	#scrollSelectedIntoView() {
		afterTick(() => {
			const item = this.#getSelectedItem();
			if (!item) return;
			const grandparent = item.parentElement?.parentElement;
			if (!grandparent) return;
			if (this.isGrid) {
				const isFirstRowOfGroup = this.#itemIsFirstRowOfGroup(item);
				item.scrollIntoView({ block: "nearest" });
				if (isFirstRowOfGroup) {
					(item?.closest(COMMAND_GROUP_SELECTOR)?.querySelector(COMMAND_GROUP_HEADING_SELECTOR))?.scrollIntoView({ block: "nearest" });
					return;
				}
			} else {
				const firstChildOfParent = getFirstNonCommentChild(grandparent);
				if (firstChildOfParent && firstChildOfParent.dataset?.value === item.dataset?.value) {
					(item?.closest(COMMAND_GROUP_SELECTOR)?.querySelector(COMMAND_GROUP_HEADING_SELECTOR))?.scrollIntoView({ block: "nearest" });
					return;
				}
			}
			item.scrollIntoView({ block: "nearest" });
		});
	}
	#itemIsFirstRowOfGroup(item) {
		const grid = this.itemsGrid;
		if (grid.length === 0) return false;
		for (let r = 0; r < grid.length; r++) {
			const row = grid[r];
			if (row === void 0) continue;
			for (let c = 0; c < row.length; c++) {
				const column = row[c];
				if (column === void 0 || column.ref !== item) continue;
				return column.firstRowOfGroup;
			}
		}
		return false;
	}
	/**
	* Sets selection to item at specified index in valid items array.
	* If index is out of bounds, does nothing.
	*
	* @param index - Zero-based index of item to select
	* @remarks
	* Uses `getValidItems()` to get selectable items, filtering out disabled/hidden ones.
	* Access valid items directly via `getValidItems()` to check bounds before calling.
	*
	* @example
	* // get valid items length for bounds check
	* const items = getValidItems()
	* if (index < items.length) {
	*   updateSelectedToIndex(index)
	* }
	*/
	updateSelectedToIndex(index) {
		const item = this.getValidItems()[index];
		if (!item) return;
		this.setValue(item.getAttribute(COMMAND_VALUE_ATTR) ?? "");
	}
	/**
	* Updates selected item by moving up/down relative to current selection.
	* Handles wrapping when loop option is enabled.
	*
	* @param change - Direction to move: 1 for next item, -1 for previous item
	* @remarks
	* The loop behavior wraps:
	* - From last item to first when moving next
	* - From first item to last when moving previous
	*
	* Uses `getValidItems()` to get all selectable items, which filters out disabled/hidden items.
	* You can call `getValidItems()` directly to get the current valid items array.
	*
	* @example
	* // select next item
	* updateSelectedByItem(1)
	*
	* // get all valid items
	* const items = getValidItems()
	*/
	updateSelectedByItem(change) {
		const selected = this.#getSelectedItem();
		const items = this.getValidItems();
		const index = items.findIndex((item) => item === selected);
		let newSelected = items[index + change];
		if (this.opts.loop.current) newSelected = index + change < 0 ? items[items.length - 1] : index + change === items.length ? items[0] : items[index + change];
		if (newSelected) this.setValue(newSelected.getAttribute(COMMAND_VALUE_ATTR) ?? "");
	}
	/**
	* Moves selection to the first valid item in the next/previous group.
	* If no group is found, falls back to selecting the next/previous item globally.
	*
	* @param change - Direction to move: 1 for next group, -1 for previous group
	* @example
	* // move to first item in next group
	* updateSelectedByGroup(1)
	*
	* // move to first item in previous group
	* updateSelectedByGroup(-1)
	*/
	updateSelectedByGroup(change) {
		let group = this.#getSelectedItem()?.closest(COMMAND_GROUP_SELECTOR);
		let item;
		while (group && !item) {
			group = change > 0 ? findNextSibling(group, COMMAND_GROUP_SELECTOR) : findPreviousSibling(group, COMMAND_GROUP_SELECTOR);
			item = group?.querySelector(COMMAND_VALID_ITEM_SELECTOR);
		}
		if (item) this.setValue(item.getAttribute(COMMAND_VALUE_ATTR) ?? "");
		else this.updateSelectedByItem(change);
	}
	/**
	* Maps item id to display value and search keywords.
	* Returns cleanup function to remove mapping.
	*
	* @param id - Unique item identifier
	* @param value - Display text
	* @param keywords - Optional search boost terms
	* @returns Cleanup function
	*/
	registerValue(value, keywords) {
		if (!(value && value === this.allIds.get(value)?.value)) this.allIds.set(value, {
			value,
			keywords
		});
		this._commandState.filtered.items.set(value, this.#score(value, keywords));
		if (!this.sortAfterTick) {
			this.sortAfterTick = true;
			afterTick(() => {
				this.#sort();
				this.sortAfterTick = false;
			});
		}
		return () => {
			this.allIds.delete(value);
		};
	}
	/**
	* Registers item in command list and its group.
	* Handles filtering, sorting and selection updates.
	*
	* @param id - Item identifier
	* @param groupId - Optional group to add item to
	* @returns Cleanup function that handles selection
	*/
	registerItem(id, groupId) {
		this.allItems.add(id);
		if (groupId) if (!this.allGroups.has(groupId)) this.allGroups.set(groupId, new Set([id]));
		else this.allGroups.get(groupId).add(id);
		if (!this.sortAndFilterAfterTick) {
			this.sortAndFilterAfterTick = true;
			afterTick(() => {
				this.#filterItems();
				this.#sort();
				this.sortAndFilterAfterTick = false;
			});
		}
		this.#scheduleUpdate();
		return () => {
			const selectedItem = this.#getSelectedItem();
			this.allItems.delete(id);
			this.commandState.filtered.items.delete(id);
			this.#filterItems();
			if (selectedItem?.getAttribute("id") === id) this.#selectFirstItem();
			this.#scheduleUpdate();
		};
	}
	/**
	* Creates empty group if not exists.
	*
	* @param id - Group identifier
	* @returns Cleanup function
	*/
	registerGroup(id) {
		if (!this.allGroups.has(id)) this.allGroups.set(id, /* @__PURE__ */ new Set());
		return () => {
			this.allIds.delete(id);
			this.allGroups.delete(id);
		};
	}
	get isGrid() {
		return this.opts.columns.current !== null;
	}
	/**
	* Selects last valid item.
	*/
	#last() {
		return this.updateSelectedToIndex(this.getValidItems().length - 1);
	}
	/**
	* Handles next item selection:
	* - Meta: Jump to last
	* - Alt: Next group
	* - Default: Next item
	*
	* @param e - Keyboard event
	*/
	#next(e) {
		e.preventDefault();
		if (e.metaKey) this.#last();
		else if (e.altKey) this.updateSelectedByGroup(1);
		else this.updateSelectedByItem(1);
	}
	#down(e) {
		if (this.opts.columns.current === null) return;
		e.preventDefault();
		if (e.metaKey) this.updateSelectedByGroup(1);
		else this.updateSelectedByItem(this.#nextRowColumnOffset(e));
	}
	#getColumn(item, grid) {
		if (grid.length === 0) return null;
		for (let r = 0; r < grid.length; r++) {
			const row = grid[r];
			if (row === void 0) continue;
			for (let c = 0; c < row.length; c++) {
				const column = row[c];
				if (column === void 0 || column.ref !== item) continue;
				return {
					columnIndex: c,
					rowIndex: r
				};
			}
		}
		return null;
	}
	#nextRowColumnOffset(e) {
		const grid = this.itemsGrid;
		const selected = this.#getSelectedItem();
		if (!selected) return 0;
		const column = this.#getColumn(selected, grid);
		if (!column) return 0;
		let newItem = null;
		const skipRows = e.altKey ? 1 : 0;
		if (e.altKey && column.rowIndex === grid.length - 2 && !this.opts.loop.current) newItem = this.#findNextNonDisabledItem({
			start: grid.length - 1,
			end: grid.length,
			expectedColumnIndex: column.columnIndex,
			grid
		});
		else if (column.rowIndex === grid.length - 1) {
			if (!this.opts.loop.current) return 0;
			newItem = this.#findNextNonDisabledItem({
				start: 0 + skipRows,
				end: column.rowIndex,
				expectedColumnIndex: column.columnIndex,
				grid
			});
		} else {
			newItem = this.#findNextNonDisabledItem({
				start: column.rowIndex + 1 + skipRows,
				end: grid.length,
				expectedColumnIndex: column.columnIndex,
				grid
			});
			if (newItem === null && this.opts.loop.current) newItem = this.#findNextNonDisabledItem({
				start: 0,
				end: column.rowIndex,
				expectedColumnIndex: column.columnIndex,
				grid
			});
		}
		return this.#calculateOffset(selected, newItem);
	}
	/** Attempts to find the next non-disabled column that matches the expected column.
	*
	* @remarks
	* - Skips over disabled columns
	* - When a row is shorter than the expected column it defaults to the last item in the row
	*
	* @param param0
	* @returns
	*/
	#findNextNonDisabledItem({ start, end, grid, expectedColumnIndex }) {
		let newItem = null;
		for (let r = start; r < end; r++) {
			const row = grid[r];
			newItem = row[expectedColumnIndex]?.ref ?? null;
			if (newItem !== null && itemIsDisabled(newItem)) {
				newItem = null;
				continue;
			}
			if (newItem === null) for (let i = row.length - 1; i >= 0; i--) {
				const item = row[row.length - 1];
				if (item === void 0 || itemIsDisabled(item.ref)) continue;
				newItem = item.ref;
				break;
			}
			break;
		}
		return newItem;
	}
	#calculateOffset(selected, newSelected) {
		if (newSelected === null) return 0;
		const items = this.getValidItems();
		const ogIndex = items.findIndex((item) => item === selected);
		return items.findIndex((item) => item === newSelected) - ogIndex;
	}
	#up(e) {
		if (this.opts.columns.current === null) return;
		e.preventDefault();
		if (e.metaKey) this.updateSelectedByGroup(-1);
		else this.updateSelectedByItem(this.#previousRowColumnOffset(e));
	}
	#previousRowColumnOffset(e) {
		const grid = this.itemsGrid;
		const selected = this.#getSelectedItem();
		if (selected === void 0) return 0;
		const column = this.#getColumn(selected, grid);
		if (column === null) return 0;
		let newItem = null;
		const skipRows = e.altKey ? 1 : 0;
		if (e.altKey && column.rowIndex === 1 && this.opts.loop.current === false) newItem = this.#findNextNonDisabledItemDesc({
			start: 0,
			end: 0,
			expectedColumnIndex: column.columnIndex,
			grid
		});
		else if (column.rowIndex === 0) {
			if (this.opts.loop.current === false) return 0;
			newItem = this.#findNextNonDisabledItemDesc({
				start: grid.length - 1 - skipRows,
				end: column.rowIndex + 1,
				expectedColumnIndex: column.columnIndex,
				grid
			});
		} else {
			newItem = this.#findNextNonDisabledItemDesc({
				start: column.rowIndex - 1 - skipRows,
				end: 0,
				expectedColumnIndex: column.columnIndex,
				grid
			});
			if (newItem === null && this.opts.loop.current) newItem = this.#findNextNonDisabledItemDesc({
				start: grid.length - 1,
				end: column.rowIndex + 1,
				expectedColumnIndex: column.columnIndex,
				grid
			});
		}
		return this.#calculateOffset(selected, newItem);
	}
	/**
	* Attempts to find the next non-disabled column that matches the expected column.
	*
	* @remarks
	* - Skips over disabled columns
	* - When a row is shorter than the expected column it defaults to the last item in the row
	*/
	#findNextNonDisabledItemDesc({ start, end, grid, expectedColumnIndex }) {
		let newItem = null;
		for (let r = start; r >= end; r--) {
			const row = grid[r];
			if (row === void 0) continue;
			newItem = row[expectedColumnIndex]?.ref ?? null;
			if (newItem !== null && itemIsDisabled(newItem)) {
				newItem = null;
				continue;
			}
			if (newItem === null) for (let i = row.length - 1; i >= 0; i--) {
				const item = row[row.length - 1];
				if (item === void 0 || itemIsDisabled(item.ref)) continue;
				newItem = item.ref;
				break;
			}
			break;
		}
		return newItem;
	}
	/**
	* Handles previous item selection:
	* - Meta: Jump to first
	* - Alt: Previous group
	* - Default: Previous item
	*
	* @param e - Keyboard event
	*/
	#prev(e) {
		e.preventDefault();
		if (e.metaKey) this.updateSelectedToIndex(0);
		else if (e.altKey) this.updateSelectedByGroup(-1);
		else this.updateSelectedByItem(-1);
	}
	onkeydown(e) {
		const isVim = this.opts.vimBindings.current && e.ctrlKey;
		switch (e.key) {
			case "n":
			case "j":
				if (isVim) if (this.isGrid) this.#down(e);
				else this.#next(e);
				break;
			case "l":
				if (isVim) {
					if (this.isGrid) this.#next(e);
				}
				break;
			case ARROW_DOWN:
				if (this.isGrid) this.#down(e);
				else this.#next(e);
				break;
			case ARROW_RIGHT:
				if (!this.isGrid) break;
				this.#next(e);
				break;
			case "p":
			case "k":
				if (isVim) if (this.isGrid) this.#up(e);
				else this.#prev(e);
				break;
			case "h":
				if (isVim && this.isGrid) this.#prev(e);
				break;
			case ARROW_UP:
				if (this.isGrid) this.#up(e);
				else this.#prev(e);
				break;
			case ARROW_LEFT:
				if (!this.isGrid) break;
				this.#prev(e);
				break;
			case HOME:
				e.preventDefault();
				this.updateSelectedToIndex(0);
				break;
			case "End":
				e.preventDefault();
				this.#last();
				break;
			case ENTER:
 /**
			* Check if IME composition is finished before triggering the select event.
			* This prevents unwanted triggering while user is still inputting text with IME.
			* e.keyCode === 229 is for the Japanese IME && Safari as `isComposing` does not
			* work with Japanese IME and Safari in combination.
			*/
			if (!e.isComposing && e.keyCode !== 229) {
				e.preventDefault();
				const item = this.#getSelectedItem();
				if (item) item?.click();
			}
		}
	}
	#props = user_derived(() => ({
		id: this.opts.id.current,
		role: "application",
		[commandAttrs.root]: "",
		tabindex: -1,
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
function itemIsDisabled(item) {
	return item.getAttribute("aria-disabled") === "true";
}
var CommandEmptyState = class CommandEmptyState {
	static create(opts) {
		return new CommandEmptyState(opts, CommandRootContext.get());
	}
	opts;
	root;
	attachment;
	#shouldRender = user_derived(() => {
		return this.root._commandState.filtered.count === 0 && this.#isInitialRender === false || this.opts.forceMount.current;
	});
	get shouldRender() {
		return get(this.#shouldRender);
	}
	set shouldRender(value) {
		set(this.#shouldRender, value);
	}
	#isInitialRender = true;
	constructor(opts, root) {
		this.opts = opts;
		this.root = root;
		this.attachment = attachRef(this.opts.ref);
		user_pre_effect(() => {
			this.#isInitialRender = false;
		});
	}
	#props = user_derived(() => ({
		id: this.opts.id.current,
		role: "presentation",
		[commandAttrs.empty]: "",
		...this.attachment
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
var CommandGroupContainerState = class CommandGroupContainerState {
	static create(opts) {
		return CommandGroupContainerContext.set(new CommandGroupContainerState(opts, CommandRootContext.get()));
	}
	opts;
	root;
	attachment;
	#shouldRender = user_derived(() => {
		if (this.opts.forceMount.current) return true;
		if (this.root.opts.shouldFilter.current === false) return true;
		if (!this.root.commandState.search) return true;
		return this.root._commandState.filtered.groups.has(this.trueValue);
	});
	get shouldRender() {
		return get(this.#shouldRender);
	}
	set shouldRender(value) {
		set(this.#shouldRender, value);
	}
	#headingNode = state(null);
	get headingNode() {
		return get(this.#headingNode);
	}
	set headingNode(value) {
		set(this.#headingNode, value, true);
	}
	#trueValue = state("");
	get trueValue() {
		return get(this.#trueValue);
	}
	set trueValue(value) {
		set(this.#trueValue, value, true);
	}
	constructor(opts, root) {
		this.opts = opts;
		this.root = root;
		this.attachment = attachRef(this.opts.ref);
		this.trueValue = opts.value.current ?? opts.id.current;
		watch(() => this.trueValue, () => {
			return this.root.registerGroup(this.trueValue);
		});
		user_effect(() => {
			if (this.opts.value.current) {
				this.trueValue = this.opts.value.current;
				return this.root.registerValue(this.opts.value.current);
			} else if (this.headingNode && this.headingNode.textContent) {
				this.trueValue = this.headingNode.textContent.trim().toLowerCase();
				return this.root.registerValue(this.trueValue);
			} else {
				this.trueValue = `-----${this.opts.id.current}`;
				return this.root.registerValue(this.trueValue);
			}
		});
	}
	#props = user_derived(() => ({
		id: this.opts.id.current,
		role: "presentation",
		hidden: this.shouldRender ? void 0 : true,
		"data-value": this.trueValue,
		[commandAttrs.group]: "",
		...this.attachment
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
var CommandGroupHeadingState = class CommandGroupHeadingState {
	static create(opts) {
		return new CommandGroupHeadingState(opts, CommandGroupContainerContext.get());
	}
	opts;
	group;
	attachment;
	constructor(opts, group) {
		this.opts = opts;
		this.group = group;
		this.attachment = attachRef(this.opts.ref, (v) => this.group.headingNode = v);
	}
	#props = user_derived(() => ({
		id: this.opts.id.current,
		[commandAttrs["group-heading"]]: "",
		...this.attachment
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
var CommandGroupItemsState = class CommandGroupItemsState {
	static create(opts) {
		return new CommandGroupItemsState(opts, CommandGroupContainerContext.get());
	}
	opts;
	group;
	attachment;
	constructor(opts, group) {
		this.opts = opts;
		this.group = group;
		this.attachment = attachRef(this.opts.ref);
	}
	#props = user_derived(() => ({
		id: this.opts.id.current,
		role: "group",
		[commandAttrs["group-items"]]: "",
		"aria-labelledby": this.group.headingNode?.id ?? void 0,
		...this.attachment
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
var CommandInputState = class CommandInputState {
	static create(opts) {
		return new CommandInputState(opts, CommandRootContext.get());
	}
	opts;
	root;
	attachment;
	#selectedItemId = user_derived(() => {
		const item = this.root.viewportNode?.querySelector(`${COMMAND_ITEM_SELECTOR}[${COMMAND_VALUE_ATTR}="${cssEscape(this.root.opts.value.current)}"]`);
		if (item === void 0 || item === null) return;
		return item.getAttribute("id") ?? void 0;
	});
	constructor(opts, root) {
		this.opts = opts;
		this.root = root;
		this.attachment = attachRef(this.opts.ref, (v) => this.root.inputNode = v);
		watch(() => this.opts.ref.current, () => {
			const node = this.opts.ref.current;
			if (node && this.opts.autofocus.current) afterSleep(10, () => node.focus());
		});
		watch(() => this.opts.value.current, () => {
			if (this.root.commandState.search !== this.opts.value.current) this.root.setState("search", this.opts.value.current);
		});
	}
	#props = user_derived(() => ({
		id: this.opts.id.current,
		type: "text",
		[commandAttrs.input]: "",
		autocomplete: "off",
		autocorrect: "off",
		spellcheck: false,
		"aria-autocomplete": "list",
		role: "combobox",
		"aria-expanded": boolToStr(true),
		"aria-controls": this.root.viewportNode?.id ?? void 0,
		"aria-labelledby": this.root.labelNode?.id ?? void 0,
		"aria-activedescendant": get(this.#selectedItemId),
		...this.attachment
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
var CommandItemState = class CommandItemState {
	static create(opts) {
		const group = CommandGroupContainerContext.getOr(null);
		return new CommandItemState({
			...opts,
			group
		}, CommandRootContext.get());
	}
	opts;
	root;
	attachment;
	#group = null;
	#trueForceMount = user_derived(() => {
		return this.opts.forceMount.current || this.#group?.opts.forceMount.current === true;
	});
	#shouldRender = user_derived(() => {
		this.opts.ref.current;
		if (get(this.#trueForceMount) || this.root.opts.shouldFilter.current === false || !this.root.commandState.search) return true;
		const currentScore = this.root.commandState.filtered.items.get(this.trueValue);
		if (currentScore === void 0) return false;
		return currentScore > 0;
	});
	get shouldRender() {
		return get(this.#shouldRender);
	}
	set shouldRender(value) {
		set(this.#shouldRender, value);
	}
	#isSelected = user_derived(() => this.root.opts.value.current === this.trueValue && this.trueValue !== "");
	get isSelected() {
		return get(this.#isSelected);
	}
	set isSelected(value) {
		set(this.#isSelected, value);
	}
	#trueValue = state("");
	get trueValue() {
		return get(this.#trueValue);
	}
	set trueValue(value) {
		set(this.#trueValue, value, true);
	}
	constructor(opts, root) {
		this.opts = opts;
		this.root = root;
		this.#group = CommandGroupContainerContext.getOr(null);
		this.trueValue = opts.value.current;
		this.attachment = attachRef(this.opts.ref);
		watch([
			() => this.trueValue,
			() => this.#group?.trueValue,
			() => this.opts.forceMount.current
		], () => {
			if (this.opts.forceMount.current || !this.trueValue) return;
			return this.root.registerItem(this.trueValue, this.#group?.trueValue);
		});
		watch([() => this.opts.value.current, () => this.opts.ref.current], () => {
			if (this.opts.value.current) this.trueValue = this.opts.value.current;
			else if (this.opts.ref.current?.textContent) this.trueValue = this.opts.ref.current.textContent.trim();
			if (this.trueValue) {
				this.root.registerValue(this.trueValue, opts.keywords.current.map((kw) => kw.trim()));
				this.opts.ref.current?.setAttribute(COMMAND_VALUE_ATTR, this.trueValue);
			}
		});
		this.onclick = this.onclick.bind(this);
		this.onpointermove = this.onpointermove.bind(this);
	}
	#onSelect() {
		if (this.opts.disabled.current) return;
		this.#select();
		this.opts.onSelect?.current();
	}
	#select() {
		if (this.opts.disabled.current) return;
		this.root.setValue(this.trueValue, true);
	}
	onpointermove(_) {
		if (this.opts.disabled.current || this.root.opts.disablePointerSelection.current) return;
		this.#select();
	}
	onclick(_) {
		if (this.opts.disabled.current) return;
		this.#onSelect();
	}
	#props = user_derived(() => ({
		id: this.opts.id.current,
		"aria-disabled": boolToStr(this.opts.disabled.current),
		"aria-selected": boolToStr(this.isSelected),
		"data-disabled": boolToEmptyStrOrUndef(this.opts.disabled.current),
		"data-selected": boolToEmptyStrOrUndef(this.isSelected),
		"data-value": this.trueValue,
		"data-group": this.#group?.trueValue,
		[commandAttrs.item]: "",
		role: "option",
		onpointermove: this.onpointermove,
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
var CommandListState = class CommandListState {
	static create(opts) {
		return CommandListContext.set(new CommandListState(opts, CommandRootContext.get()));
	}
	opts;
	root;
	attachment;
	constructor(opts, root) {
		this.opts = opts;
		this.root = root;
		this.attachment = attachRef(this.opts.ref);
	}
	#props = user_derived(() => ({
		id: this.opts.id.current,
		role: "listbox",
		"aria-label": this.opts.ariaLabel.current,
		[commandAttrs.list]: "",
		...this.attachment
	}));
	get props() {
		return get(this.#props);
	}
	set props(value) {
		set(this.#props, value);
	}
};
var CommandLabelState = class CommandLabelState {
	static create(opts) {
		return new CommandLabelState(opts, CommandRootContext.get());
	}
	opts;
	root;
	attachment;
	constructor(opts, root) {
		this.opts = opts;
		this.root = root;
		this.attachment = attachRef(this.opts.ref, (v) => this.root.labelNode = v);
	}
	#props = user_derived(() => ({
		id: this.opts.id.current,
		[commandAttrs["input-label"]]: "",
		for: this.opts.for?.current,
		style: srOnlyStyles,
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
//#region node_modules/bits-ui/dist/bits/command/components/_command-label.svelte
var root$30 = from_html(`<label><!></label>`);
function _command_label($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"id",
		"ref",
		"children"
	]);
	const labelState = CommandLabelState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v))
	});
	const mergedProps = user_derived(() => mergeProps(restProps, labelState.props));
	var label = root$30();
	attribute_effect(label, () => ({ ...get(mergedProps) }));
	snippet(child(label), () => $$props.children ?? noop);
	reset(label);
	append($$anchor, label);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/command/components/command.svelte
var root_3$15 = from_html(`<!> <!>`, 1);
var root_4$13 = from_html(`<div><!> <!></div>`);
function Command$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	const Label = ($$anchor) => {
		_command_label($$anchor, {
			children: ($$anchor, $$slotProps) => {
				next();
				var text$16 = text();
				template_effect(() => set_text(text$16, label()));
				append($$anchor, text$16);
			},
			$$slots: { default: true }
		});
	};
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), value = prop($$props, "value", 15, ""), onValueChange = prop($$props, "onValueChange", 3, noop$1), onStateChange = prop($$props, "onStateChange", 3, noop$1), loop = prop($$props, "loop", 3, false), shouldFilter = prop($$props, "shouldFilter", 3, true), filter = prop($$props, "filter", 3, computeCommandScore), label = prop($$props, "label", 3, ""), vimBindings = prop($$props, "vimBindings", 3, true), disablePointerSelection = prop($$props, "disablePointerSelection", 3, false), disableInitialScroll = prop($$props, "disableInitialScroll", 3, false), columns = prop($$props, "columns", 3, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"id",
		"ref",
		"value",
		"onValueChange",
		"onStateChange",
		"loop",
		"shouldFilter",
		"filter",
		"label",
		"vimBindings",
		"disablePointerSelection",
		"disableInitialScroll",
		"columns",
		"children",
		"child"
	]);
	const rootState = CommandRootState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v)),
		filter: boxWith(() => filter()),
		shouldFilter: boxWith(() => shouldFilter()),
		loop: boxWith(() => loop()),
		value: boxWith(() => value(), (v) => {
			if (value() !== v) {
				value(v);
				onValueChange()(v);
			}
		}),
		vimBindings: boxWith(() => vimBindings()),
		disablePointerSelection: boxWith(() => disablePointerSelection()),
		disableInitialScroll: boxWith(() => disableInitialScroll()),
		onStateChange: boxWith(() => onStateChange()),
		columns: boxWith(() => columns())
	});
	/**
	* Sets selection to item at specified index in valid items array.
	* If index is out of bounds, does nothing.
	*
	* @param index - Zero-based index of item to select
	* @remarks
	* Uses `getValidItems()` to get selectable items, filtering out disabled/hidden ones.
	* Access valid items directly via `getValidItems()` to check bounds before calling.
	*
	* @example
	* // get valid items length for bounds check
	* const items = getValidItems()
	* if (index < items.length) {
	*   updateSelectedToIndex(index)
	* }
	*/
	const updateSelectedToIndex = (i) => rootState.updateSelectedToIndex(i);
	/**
	* Moves selection to the first valid item in the next/previous group.
	* If no group is found, falls back to selecting the next/previous item globally.
	*
	* @param change - Direction to move: 1 for next group, -1 for previous group
	* @example
	* // move to first item in next group
	* updateSelectedByGroup(1)
	*
	* // move to first item in previous group
	* updateSelectedByGroup(-1)
	*/
	const updateSelectedByGroup = (c) => rootState.updateSelectedByGroup(c);
	/**
	* Updates selected item by moving up/down relative to current selection.
	* Handles wrapping when loop option is enabled.
	*
	* @param change - Direction to move: 1 for next item, -1 for previous item
	* @remarks
	* The loop behavior wraps:
	* - From last item to first when moving next
	* - From first item to last when moving previous
	*
	* Uses `getValidItems()` to get all selectable items, which filters out disabled/hidden items.
	* You can call `getValidItems()` directly to get the current valid items array.
	*
	* @example
	* // select next item
	* updateSelectedByItem(1)
	*
	* // get all valid items
	* const items = getValidItems()
	*/
	const updateSelectedByItem = (c) => rootState.updateSelectedByItem(c);
	/**
	* Gets all non-disabled, visible command items.
	*
	* @returns Array of valid item elements
	* @remarks Exposed for direct item access and bound checking
	*/
	const getValidItems = () => rootState.getValidItems();
	const mergedProps = user_derived(() => mergeProps(restProps, rootState.props));
	var $$exports = {
		updateSelectedToIndex,
		updateSelectedByGroup,
		updateSelectedByItem,
		getValidItems
	};
	var fragment_2 = comment();
	var node = first_child(fragment_2);
	var consequent = ($$anchor) => {
		var fragment_3 = root_3$15();
		var node_1 = first_child(fragment_3);
		Label(node_1);
		snippet(sibling(node_1, 2), () => $$props.child, () => ({ props: get(mergedProps) }));
		append($$anchor, fragment_3);
	};
	var alternate = ($$anchor) => {
		var div = root_4$13();
		attribute_effect(div, () => ({ ...get(mergedProps) }));
		var node_3 = child(div);
		Label(node_3);
		snippet(sibling(node_3, 2), () => $$props.children ?? noop);
		reset(div);
		append($$anchor, div);
	};
	if_block(node, ($$render) => {
		if ($$props.child) $$render(consequent);
		else $$render(alternate, -1);
	});
	append($$anchor, fragment_2);
	return pop($$exports);
}
//#endregion
//#region node_modules/bits-ui/dist/bits/command/components/command-empty.svelte
var root_3$14 = from_html(`<div><!></div>`);
function Command_empty$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), forceMount = prop($$props, "forceMount", 3, false), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"id",
		"ref",
		"children",
		"child",
		"forceMount"
	]);
	const emptyState = CommandEmptyState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v)),
		forceMount: boxWith(() => forceMount())
	});
	const mergedProps = user_derived(() => mergeProps(emptyState.props, restProps));
	var fragment = comment();
	var node = first_child(fragment);
	var consequent_1 = ($$anchor) => {
		var fragment_1 = comment();
		var node_1 = first_child(fragment_1);
		var consequent = ($$anchor) => {
			var fragment_2 = comment();
			snippet(first_child(fragment_2), () => $$props.child, () => ({ props: get(mergedProps) }));
			append($$anchor, fragment_2);
		};
		var alternate = ($$anchor) => {
			var div = root_3$14();
			attribute_effect(div, () => ({ ...get(mergedProps) }));
			snippet(child(div), () => $$props.children ?? noop);
			reset(div);
			append($$anchor, div);
		};
		if_block(node_1, ($$render) => {
			if ($$props.child) $$render(consequent);
			else $$render(alternate, -1);
		});
		append($$anchor, fragment_1);
	};
	if_block(node, ($$render) => {
		if (emptyState.shouldRender) $$render(consequent_1);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/command/components/command-group.svelte
var root_2$16 = from_html(`<div><!></div>`);
function Command_group$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), value = prop($$props, "value", 3, ""), forceMount = prop($$props, "forceMount", 3, false), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"id",
		"ref",
		"value",
		"forceMount",
		"children",
		"child"
	]);
	const groupState = CommandGroupContainerState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v)),
		forceMount: boxWith(() => forceMount()),
		value: boxWith(() => value())
	});
	const mergedProps = user_derived(() => mergeProps(restProps, groupState.props));
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		var fragment_1 = comment();
		snippet(first_child(fragment_1), () => $$props.child, () => ({ props: get(mergedProps) }));
		append($$anchor, fragment_1);
	};
	var alternate = ($$anchor) => {
		var div = root_2$16();
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
//#region node_modules/bits-ui/dist/bits/command/components/command-group-heading.svelte
var root_2$15 = from_html(`<div><!></div>`);
function Command_group_heading($$anchor, $$props) {
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
	const headingState = CommandGroupHeadingState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v))
	});
	const mergedProps = user_derived(() => mergeProps(restProps, headingState.props));
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		var fragment_1 = comment();
		snippet(first_child(fragment_1), () => $$props.child, () => ({ props: get(mergedProps) }));
		append($$anchor, fragment_1);
	};
	var alternate = ($$anchor) => {
		var div = root_2$15();
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
//#region node_modules/bits-ui/dist/bits/command/components/command-group-items.svelte
var root_2$14 = from_html(`<div><!></div>`);
var root$29 = from_html(`<div style="display: contents;"><!></div>`);
function Command_group_items($$anchor, $$props) {
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
	const groupItemsState = CommandGroupItemsState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v))
	});
	const mergedProps = user_derived(() => mergeProps(restProps, groupItemsState.props));
	var div = root$29();
	var node = child(div);
	var consequent = ($$anchor) => {
		var fragment = comment();
		snippet(first_child(fragment), () => $$props.child, () => ({ props: get(mergedProps) }));
		append($$anchor, fragment);
	};
	var alternate = ($$anchor) => {
		var div_1 = root_2$14();
		attribute_effect(div_1, () => ({ ...get(mergedProps) }));
		snippet(child(div_1), () => $$props.children ?? noop);
		reset(div_1);
		append($$anchor, div_1);
	};
	if_block(node, ($$render) => {
		if ($$props.child) $$render(consequent);
		else $$render(alternate, -1);
	});
	reset(div);
	append($$anchor, div);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/command/components/command-input.svelte
var root_2$13 = from_html(`<input/>`);
function Command_input$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let value = prop($$props, "value", 15, ""), autofocus = prop($$props, "autofocus", 3, false), id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"value",
		"autofocus",
		"id",
		"ref",
		"child"
	]);
	const inputState = CommandInputState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v)),
		value: boxWith(() => value(), (v) => {
			value(v);
		}),
		autofocus: boxWith(() => autofocus() ?? false)
	});
	const mergedProps = user_derived(() => mergeProps(restProps, inputState.props));
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		var fragment_1 = comment();
		snippet(first_child(fragment_1), () => $$props.child, () => ({ props: get(mergedProps) }));
		append($$anchor, fragment_1);
	};
	var alternate = ($$anchor) => {
		var input = root_2$13();
		attribute_effect(input, () => ({ ...get(mergedProps) }), void 0, void 0, void 0, void 0, true);
		bind_value(input, value);
		append($$anchor, input);
	};
	if_block(node, ($$render) => {
		if ($$props.child) $$render(consequent);
		else $$render(alternate, -1);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/command/components/command-item.svelte
var root_4$12 = from_html(`<div><!></div>`);
var root_1$18 = from_html(`<div style="display: contents;" data-item-wrapper=""><!></div>`);
function Command_item$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), value = prop($$props, "value", 3, ""), disabled = prop($$props, "disabled", 3, false), onSelect = prop($$props, "onSelect", 3, noop$1), forceMount = prop($$props, "forceMount", 3, false), keywords = prop($$props, "keywords", 19, () => []), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"id",
		"ref",
		"value",
		"disabled",
		"children",
		"child",
		"onSelect",
		"forceMount",
		"keywords"
	]);
	const itemState = CommandItemState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v)),
		value: boxWith(() => value()),
		disabled: boxWith(() => disabled()),
		onSelect: boxWith(() => onSelect()),
		forceMount: boxWith(() => forceMount()),
		keywords: boxWith(() => keywords())
	});
	const mergedProps = user_derived(() => mergeProps(restProps, itemState.props));
	var fragment = comment();
	key(first_child(fragment), () => itemState.root.key, ($$anchor) => {
		var div = root_1$18();
		var node_1 = child(div);
		var consequent_1 = ($$anchor) => {
			var fragment_1 = comment();
			var node_2 = first_child(fragment_1);
			var consequent = ($$anchor) => {
				var fragment_2 = comment();
				snippet(first_child(fragment_2), () => $$props.child, () => ({ props: get(mergedProps) }));
				append($$anchor, fragment_2);
			};
			var alternate = ($$anchor) => {
				var div_1 = root_4$12();
				attribute_effect(div_1, () => ({ ...get(mergedProps) }));
				snippet(child(div_1), () => $$props.children ?? noop);
				reset(div_1);
				append($$anchor, div_1);
			};
			if_block(node_2, ($$render) => {
				if ($$props.child) $$render(consequent);
				else $$render(alternate, -1);
			});
			append($$anchor, fragment_1);
		};
		if_block(node_1, ($$render) => {
			if (itemState.shouldRender) $$render(consequent_1);
		});
		reset(div);
		template_effect(() => set_attribute(div, "data-value", itemState.trueValue));
		append($$anchor, div);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/command/components/command-list.svelte
var root_3$13 = from_html(`<div><!></div>`);
function Command_list$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"id",
		"ref",
		"child",
		"children",
		"aria-label"
	]);
	const listState = CommandListState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v)),
		ariaLabel: boxWith(() => $$props["aria-label"] ?? "Suggestions...")
	});
	const mergedProps = user_derived(() => mergeProps(restProps, listState.props));
	var fragment = comment();
	key(first_child(fragment), () => listState.root._commandState.search === "", ($$anchor) => {
		var fragment_1 = comment();
		var node_1 = first_child(fragment_1);
		var consequent = ($$anchor) => {
			var fragment_2 = comment();
			snippet(first_child(fragment_2), () => $$props.child, () => ({ props: get(mergedProps) }));
			append($$anchor, fragment_2);
		};
		var alternate = ($$anchor) => {
			var div = root_3$13();
			attribute_effect(div, () => ({ ...get(mergedProps) }));
			snippet(child(div), () => $$props.children ?? noop);
			reset(div);
			append($$anchor, div);
		};
		if_block(node_1, ($$render) => {
			if ($$props.child) $$render(consequent);
			else $$render(alternate, -1);
		});
		append($$anchor, fragment_1);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/command/compute-command-score.js
var SCORE_CONTINUE_MATCH = 1;
var SCORE_SPACE_WORD_JUMP = .9;
var SCORE_NON_SPACE_WORD_JUMP = .8;
var SCORE_CHARACTER_JUMP = .17;
var SCORE_TRANSPOSITION = .1;
var PENALTY_SKIPPED = .999;
var PENALTY_CASE_MISMATCH = .9999;
var PENALTY_NOT_COMPLETE = .99;
var IS_GAP_REGEXP = /[\\/_+.#"@[({&]/;
var COUNT_GAPS_REGEXP = /[\\/_+.#"@[({&]/g;
var IS_SPACE_REGEXP = /[\s-]/;
var COUNT_SPACE_REGEXP = /[\s-]/g;
function computeCommandScoreInner(string, abbreviation, lowerString, lowerAbbreviation, stringIndex, abbreviationIndex, memoizedResults) {
	if (abbreviationIndex === abbreviation.length) {
		if (stringIndex === string.length) return SCORE_CONTINUE_MATCH;
		return PENALTY_NOT_COMPLETE;
	}
	const memoizeKey = `${stringIndex},${abbreviationIndex}`;
	if (memoizedResults[memoizeKey] !== void 0) return memoizedResults[memoizeKey];
	const abbreviationChar = lowerAbbreviation.charAt(abbreviationIndex);
	let index = lowerString.indexOf(abbreviationChar, stringIndex);
	let highScore = 0;
	let score, transposedScore, wordBreaks, spaceBreaks;
	while (index >= 0) {
		score = computeCommandScoreInner(string, abbreviation, lowerString, lowerAbbreviation, index + 1, abbreviationIndex + 1, memoizedResults);
		if (score > highScore) {
			if (index === stringIndex) score *= SCORE_CONTINUE_MATCH;
			else if (IS_GAP_REGEXP.test(string.charAt(index - 1))) {
				score *= SCORE_NON_SPACE_WORD_JUMP;
				wordBreaks = string.slice(stringIndex, index - 1).match(COUNT_GAPS_REGEXP);
				if (wordBreaks && stringIndex > 0) score *= PENALTY_SKIPPED ** wordBreaks.length;
			} else if (IS_SPACE_REGEXP.test(string.charAt(index - 1))) {
				score *= SCORE_SPACE_WORD_JUMP;
				spaceBreaks = string.slice(stringIndex, index - 1).match(COUNT_SPACE_REGEXP);
				if (spaceBreaks && stringIndex > 0) score *= PENALTY_SKIPPED ** spaceBreaks.length;
			} else {
				score *= SCORE_CHARACTER_JUMP;
				if (stringIndex > 0) score *= PENALTY_SKIPPED ** (index - stringIndex);
			}
			if (string.charAt(index) !== abbreviation.charAt(abbreviationIndex)) score *= PENALTY_CASE_MISMATCH;
		}
		if (score < SCORE_TRANSPOSITION && lowerString.charAt(index - 1) === lowerAbbreviation.charAt(abbreviationIndex + 1) || lowerAbbreviation.charAt(abbreviationIndex + 1) === lowerAbbreviation.charAt(abbreviationIndex) && lowerString.charAt(index - 1) !== lowerAbbreviation.charAt(abbreviationIndex)) {
			transposedScore = computeCommandScoreInner(string, abbreviation, lowerString, lowerAbbreviation, index + 1, abbreviationIndex + 2, memoizedResults);
			if (transposedScore * SCORE_TRANSPOSITION > score) score = transposedScore * SCORE_TRANSPOSITION;
		}
		if (score > highScore) highScore = score;
		index = lowerString.indexOf(abbreviationChar, index + 1);
	}
	memoizedResults[memoizeKey] = highScore;
	return highScore;
}
/**
*
* @param string
* @returns
*/
function formatInput(string) {
	return string.toLowerCase().replace(COUNT_SPACE_REGEXP, " ");
}
/**
* Given a command, a search query, and (optionally) a list of keywords for the command,
* computes a score between 0 and 1 that represents how well the search query matches the
* abbreviation and keywords. 1 is a perfect match, 0 is no match.
*
* The score is calculated based on the following rules:
* - The scores are arranged so that a continuous match of characters will result in a total
* score of 1. The best case, this character is a match, and either this is the start of the string
* or the previous character was also a match.
* - A new match at the start of a word scores better than a new match elsewhere as it's more likely
* that the user will type the starts of fragments.
* - Word jumps between spaces are scored slightly higher than slashes, brackets, hyphens, etc.
* - A continuous match of characters will result in a total score of 1.
* - A new match at the start of a word scores better than a new match elsewhere as it's more likely that the user will type the starts of fragments.
* - Any other match isn't ideal, but we include it for completeness.
* - If the user transposed two letters, it should be significantly penalized.
* - The goodness of a match should decay slightly with each missing character.
* - Match higher for letters closer to the beginning of the word.
*
* @param command - The value to score against the search string (e.g. a command name like "Calculator")
* @param search - The search string to score against the value/aliases
* @param commandKeywords - An optional list of aliases/keywords to score against the search string - e.g. ["math", "add", "divide", "multiply", "subtract"]
* @returns A score between 0 and 1 that represents how well the search string matches the
* command (and keywords)
*/
function computeCommandScore(command, search, commandKeywords) {
	/**
	* NOTE: We used to do lower-casing on each recursive call, but this meant that `toLowerCase()`
	* was the dominating cost in the algorithm. Passing both is a little ugly, but considerably
	* faster.
	*/
	command = commandKeywords && commandKeywords.length > 0 ? `${`${command} ${commandKeywords?.join(" ")}`}` : command;
	return computeCommandScoreInner(command, search, formatInput(command), formatInput(search), 0, 0, {});
}
//#endregion
//#region src/extension/svelte/components/ui/command/command.svelte
function Command($$anchor, $$props) {
	push($$props, true);
	let api = prop($$props, "api", 15, null), ref = prop($$props, "ref", 15, null), value = prop($$props, "value", 15, ""), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"api",
		"ref",
		"value",
		"class"
	]);
	var fragment = comment();
	var node = first_child(fragment);
	{
		let $0 = user_derived(() => cn("bg-popover text-popover-foreground rounded-xl! p-1 flex size-full flex-col overflow-hidden", $$props.class));
		component(node, () => Command$1, ($$anchor, CommandPrimitive_Root) => {
			bind_this(CommandPrimitive_Root($$anchor, spread_props({
				"data-slot": "command",
				get class() {
					return get($0);
				}
			}, () => restProps, {
				get value() {
					return value();
				},
				set value($$value) {
					value($$value);
				},
				get ref() {
					return ref();
				},
				set ref($$value) {
					ref($$value);
				}
			})), ($$value) => api($$value), () => api());
		});
	}
	append($$anchor, fragment);
	pop();
}
from_html(`<!> <!>`, 1);
from_html(`<!> <!>`, 1);
//#endregion
//#region src/extension/svelte/components/ui/command/command-empty.svelte
function Command_empty($$anchor, $$props) {
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
		let $0 = user_derived(() => cn("py-6 text-center text-sm", $$props.class));
		component(node, () => Command_empty$1, ($$anchor, CommandPrimitive_Empty) => {
			CommandPrimitive_Empty($$anchor, spread_props({
				"data-slot": "command-empty",
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
//#region src/extension/svelte/components/ui/command/command-group.svelte
var root_1$16 = from_html(`<!> <!>`, 1);
function Command_group($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"children",
		"heading",
		"value"
	]);
	var fragment = comment();
	var node = first_child(fragment);
	{
		let $0 = user_derived(() => cn("text-foreground **:[[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1 **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium", $$props.class));
		let $1 = user_derived(() => $$props.value ?? $$props.heading ?? `----${useId()}`);
		component(node, () => Command_group$1, ($$anchor, CommandPrimitive_Group) => {
			CommandPrimitive_Group($$anchor, spread_props({
				"data-slot": "command-group",
				get class() {
					return get($0);
				},
				get value() {
					return get($1);
				}
			}, () => restProps, {
				get ref() {
					return ref();
				},
				set ref($$value) {
					ref($$value);
				},
				children: ($$anchor, $$slotProps) => {
					var fragment_1 = root_1$16();
					var node_1 = first_child(fragment_1);
					var consequent = ($$anchor) => {
						var fragment_2 = comment();
						component(first_child(fragment_2), () => Command_group_heading, ($$anchor, CommandPrimitive_GroupHeading) => {
							CommandPrimitive_GroupHeading($$anchor, {
								class: "text-muted-foreground px-2 py-1.5 text-xs font-medium",
								children: ($$anchor, $$slotProps) => {
									next();
									var text$14 = text();
									template_effect(() => set_text(text$14, $$props.heading));
									append($$anchor, text$14);
								},
								$$slots: { default: true }
							});
						});
						append($$anchor, fragment_2);
					};
					if_block(node_1, ($$render) => {
						if ($$props.heading) $$render(consequent);
					});
					component(sibling(node_1, 2), () => Command_group_items, ($$anchor, CommandPrimitive_GroupItems) => {
						CommandPrimitive_GroupItems($$anchor, { get children() {
							return $$props.children;
						} });
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
//#region src/extension/svelte/components/ui/input-group/input-group.svelte
var root$28 = from_html(`<div><!></div>`);
function Input_group($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), props = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"children"
	]);
	var div = root$28();
	attribute_effect(div, ($0) => ({
		"data-slot": "input-group",
		role: "group",
		class: $0,
		...props
	}), [() => cn("group/input-group border-input dark:bg-input/30 has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[[data-slot][aria-invalid=true]]:border-destructive dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40 has-disabled:bg-input/50 dark:has-disabled:bg-input/80 h-8 rounded-lg border transition-colors in-data-[slot=combobox-content]:focus-within:border-inherit in-data-[slot=combobox-content]:focus-within:ring-0 has-disabled:opacity-50 has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot][aria-invalid=true]]:ring-3 has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=inline-end]]:[&>input]:pr-1.5 has-[>[data-align=inline-start]]:[&>input]:pl-1.5 relative flex w-full min-w-0 items-center outline-none has-[>textarea]:h-auto", $$props.class)]);
	snippet(child(div), () => $$props.children ?? noop);
	reset(div);
	bind_this(div, ($$value) => ref($$value), () => ref());
	append($$anchor, div);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/input-group/input-group-addon.svelte
var inputGroupAddonVariants = tv({
	base: "text-muted-foreground h-auto gap-2 py-1.5 text-sm font-medium group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4 flex cursor-text items-center justify-center select-none",
	variants: { align: {
		"inline-start": "pl-2 has-[>button]:ml-[-0.3rem] has-[>kbd]:ml-[-0.15rem] order-first",
		"inline-end": "pr-2 has-[>button]:mr-[-0.3rem] has-[>kbd]:mr-[-0.15rem] order-last",
		"block-start": "px-2.5 pt-2 group-has-[>input]/input-group:pt-2 [.border-b]:pb-2 order-first w-full justify-start",
		"block-end": "px-2.5 pb-2 group-has-[>input]/input-group:pb-2 [.border-t]:pt-2 order-last w-full justify-start"
	} },
	defaultVariants: { align: "inline-start" }
});
var root$27 = from_html(`<div><!></div>`);
function Input_group_addon($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), align = prop($$props, "align", 3, "inline-start"), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"children",
		"align"
	]);
	var div = root$27();
	var event_handler = (e) => {
		if (e.target.closest("button")) return;
		e.currentTarget.parentElement?.querySelector("input")?.focus();
	};
	attribute_effect(div, ($0) => ({
		role: "group",
		"data-slot": "input-group-addon",
		"data-align": align(),
		class: $0,
		onclick: event_handler,
		...restProps
	}), [() => cn(inputGroupAddonVariants({ align: align() }), $$props.class)]);
	snippet(child(div), () => $$props.children ?? noop);
	reset(div);
	bind_this(div, ($$value) => ref($$value), () => ref());
	append($$anchor, div);
	pop();
}
tv({
	base: "gap-2 text-sm flex items-center shadow-none",
	variants: { size: {
		xs: "h-6 gap-1 rounded-[calc(var(--radius)-3px)] px-1.5 [&>svg:not([class*='size-'])]:size-3.5",
		sm: "cn-input-group-button-size-sm",
		"icon-xs": "size-6 rounded-[calc(var(--radius)-3px)] p-0 has-[>svg]:p-0",
		"icon-sm": "size-8 p-0 has-[>svg]:p-0"
	} },
	defaultVariants: { size: "xs" }
});
//#endregion
//#region src/extension/svelte/components/ui/input-group/input-group-input.svelte
function Input_group_input($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), value = prop($$props, "value", 15), props = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"value",
		"class"
	]);
	{
		let $0 = user_derived(() => cn("rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent flex-1", $$props.class));
		Input($$anchor, spread_props({
			"data-slot": "input-group-control",
			get class() {
				return get($0);
			}
		}, () => props, {
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
	}
	pop();
}
from_html(`<span><!></span>`);
//#endregion
//#region node_modules/phosphor-svelte/lib/MagnifyingGlass.svelte
var root_2$11 = from_svg(`<path d="M232.49,215.51,185,168a92.12,92.12,0,1,0-17,17l47.53,47.54a12,12,0,0,0,17-17ZM44,112a68,68,0,1,1,68,68A68.07,68.07,0,0,1,44,112Z"></path>`);
var root_3$12 = from_svg(`<path d="M192,112a80,80,0,1,1-80-80A80,80,0,0,1,192,112Z" opacity="0.2"></path><path d="M229.66,218.34,179.6,168.28a88.21,88.21,0,1,0-11.32,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"></path>`, 1);
var root_4$11 = from_svg(`<path d="M168,112a56,56,0,1,1-56-56A56,56,0,0,1,168,112Zm61.66,117.66a8,8,0,0,1-11.32,0l-50.06-50.07a88,88,0,1,1,11.32-11.31l50.06,50.06A8,8,0,0,1,229.66,229.66ZM112,184a72,72,0,1,0-72-72A72.08,72.08,0,0,0,112,184Z"></path>`);
var root_5$12 = from_svg(`<path d="M228.24,219.76l-51.38-51.38a86.15,86.15,0,1,0-8.48,8.48l51.38,51.38a6,6,0,0,0,8.48-8.48ZM38,112a74,74,0,1,1,74,74A74.09,74.09,0,0,1,38,112Z"></path>`);
var root_6$9 = from_svg(`<path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"></path>`);
var root_7$9 = from_svg(`<path d="M226.83,221.17l-52.7-52.7a84.1,84.1,0,1,0-5.66,5.66l52.7,52.7a4,4,0,0,0,5.66-5.66ZM36,112a76,76,0,1,1,76,76A76.08,76.08,0,0,1,36,112Z"></path>`);
var root$25 = from_svg(`<svg><!><rect width="256" height="256" fill="none"></rect><!></svg>`);
function MagnifyingGlass($$anchor, $$props) {
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
	var svg = root$25();
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
		append($$anchor, root_2$11());
	};
	var consequent_2 = ($$anchor) => {
		var fragment_1 = root_3$12();
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
		append($$anchor, root_6$9());
	};
	var consequent_6 = ($$anchor) => {
		append($$anchor, root_7$9());
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
//#region src/extension/svelte/components/ui/command/command-input.svelte
var root_1$15 = from_html(`<!> <!>`, 1);
var root$24 = from_html(`<div data-slot="command-input-wrapper" class="p-1 pb-0"><!></div>`);
function Command_input($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), value = prop($$props, "value", 15, ""), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"value"
	]);
	var div = root$24();
	component(child(div), () => Input_group, ($$anchor, InputGroup_Root) => {
		InputGroup_Root($$anchor, {
			class: "bg-input/30 border-input/30 h-8! rounded-lg! shadow-none! *:data-[slot=input-group-addon]:pl-2!",
			children: ($$anchor, $$slotProps) => {
				var fragment = root_1$15();
				var node_1 = first_child(fragment);
				{
					const child = ($$anchor, $$arg0) => {
						let props = () => $$arg0?.().props;
						var fragment_1 = comment();
						component(first_child(fragment_1), () => Input_group_input, ($$anchor, InputGroup_Input) => {
							InputGroup_Input($$anchor, spread_props(props, {
								get value() {
									return value();
								},
								set value($$value) {
									value($$value);
								},
								get ref() {
									return ref();
								},
								set ref($$value) {
									ref($$value);
								}
							}));
						});
						append($$anchor, fragment_1);
					};
					let $0 = user_derived(() => cn("w-full text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50", $$props.class));
					component(node_1, () => Command_input$1, ($$anchor, CommandPrimitive_Input) => {
						CommandPrimitive_Input($$anchor, spread_props({
							get value() {
								return value();
							},
							"data-slot": "command-input",
							get class() {
								return get($0);
							}
						}, () => restProps, {
							child,
							$$slots: { child: true }
						}));
					});
				}
				component(sibling(node_1, 2), () => Input_group_addon, ($$anchor, InputGroup_Addon) => {
					InputGroup_Addon($$anchor, {
						children: ($$anchor, $$slotProps) => {
							MagnifyingGlass($$anchor, { class: "size-4 shrink-0 opacity-50" });
						},
						$$slots: { default: true }
					});
				});
				append($$anchor, fragment);
			},
			$$slots: { default: true }
		});
	});
	reset(div);
	append($$anchor, div);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/command/command-item.svelte
var root_1$14 = from_html(`<!> <!>`, 1);
function Command_item($$anchor, $$props) {
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
	var node = first_child(fragment);
	{
		let $0 = user_derived(() => cn("group/command-item data-selected:bg-muted data-selected:text-foreground data-selected:*:[svg]:text-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none in-data-[slot=dialog-content]:rounded-lg! data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", $$props.class));
		component(node, () => Command_item$1, ($$anchor, CommandPrimitive_Item) => {
			CommandPrimitive_Item($$anchor, spread_props({
				"data-slot": "command-item",
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
					var fragment_1 = root_1$14();
					var node_1 = first_child(fragment_1);
					snippet(node_1, () => $$props.children ?? noop);
					Check(sibling(node_1, 2), { class: "cn-command-item-indicator ml-auto opacity-0 group-has-[[data-slot=command-shortcut]]/command-item:hidden group-data-[checked=true]/command-item:opacity-100" });
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
//#region src/extension/svelte/components/ui/command/command-list.svelte
function Command_list($$anchor, $$props) {
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
		let $0 = user_derived(() => cn("no-scrollbar max-h-72 scroll-py-1 outline-none overflow-x-hidden overflow-y-auto", $$props.class));
		component(node, () => Command_list$1, ($$anchor, CommandPrimitive_List) => {
			CommandPrimitive_List($$anchor, spread_props({
				"data-slot": "command-list",
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
//#region src/extension/svelte/components/ui/command/command-shortcut.svelte
var root$23 = from_html(`<span><!></span>`);
function Command_shortcut($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"children"
	]);
	var span = root$23();
	attribute_effect(span, ($0) => ({
		"data-slot": "command-shortcut",
		class: $0,
		...restProps
	}), [() => cn("text-muted-foreground group-data-selected/command-item:text-foreground ml-auto text-xs tracking-widest", $$props.class)]);
	snippet(child(span), () => $$props.children ?? noop);
	reset(span);
	bind_this(span, ($$value) => ref($$value), () => ref());
	append($$anchor, span);
	pop();
}
//#endregion
//#region src/extension/entrypoints/popup/stores/database-store.svelte.ts
var storesInitialized = state(false);
var settingsStore = writable();
var apiStore = writable();
var userdataStore = writable();
var torndataStore = writable();
var stockdataStore = writable();
var stakeoutsStore = writable();
var factionStakeoutsStore = writable();
var localdataStore = writable();
var notificationHistoryStore = writable();
function initializeDatabaseStore() {
	if (get(storesInitialized)) return;
	initializeDatabase();
	loadDatabaseStores().then(() => {
		set(storesInitialized, true);
	});
	storageListeners.settings.push((_oldSettings, newSettings) => settingsStore.set(newSettings));
	storageListeners.api.push((_oldApi, newApi) => apiStore.set(newApi));
	storageListeners.userdata.push((_oldUserdata, newUserdata) => userdataStore.set(newUserdata));
	storageListeners.torndata.push((_oldTorndata, newTorndata) => torndataStore.set(newTorndata));
	storageListeners.stockdata.push((_oldStockdata, newStockdata) => stockdataStore.set(newStockdata));
	storageListeners.stakeouts.push((_oldStakeouts, newStakeouts) => stakeoutsStore.set(newStakeouts));
	storageListeners.factionStakeouts.push((_oldStakeouts, newStakeouts) => factionStakeoutsStore.set(newStakeouts));
	storageListeners.localdata.push((_oldLocaldata, newLocaldata) => localdataStore.set(newLocaldata));
	storageListeners.notificationHistory.push((_oldNotificationHistory, newNotificationHistory) => notificationHistoryStore.set(newNotificationHistory));
}
async function loadDatabaseStores() {
	const [settings, api, userdata, torndata, stockdata, stakeouts, factionStakeouts, localdata, notificationHistory] = await ttStorage.get([
		"settings",
		"api",
		"userdata",
		"torndata",
		"stockdata",
		"stakeouts",
		"factionStakeouts",
		"localdata",
		"notificationHistory"
	]);
	settingsStore.set(settings);
	apiStore.set(api);
	userdataStore.set(userdata);
	torndataStore.set(torndata);
	stockdataStore.set(stockdata);
	stakeoutsStore.set(stakeouts);
	factionStakeoutsStore.set(factionStakeouts);
	localdataStore.set(localdata);
	notificationHistoryStore.set(notificationHistory);
}
//#endregion
//#region src/extension/entrypoints/popup/components/calculator/CalculatorInput.svelte
var root_7$8 = from_html(`<label class="truncate text-xs"> </label> <!>`, 1);
var root_3$11 = from_html(`<!> <!>`, 1);
var root_1$13 = from_html(`<!> <!>`, 1);
function CalculatorInput($$anchor, $$props) {
	push($$props, true);
	const $torndataStore = () => store_get(torndataStore, "$torndataStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let selectedItems = prop($$props, "selectedItems", 15);
	let query = state("");
	let commandRef = state(null);
	const items = user_derived(() => $torndataStore()?.items ?? []);
	const matches = user_derived(() => getMatches(get(items), get(query)));
	const listOpen = user_derived(() => !!get(query).trim());
	onMount(() => {
		function handlePointerDown(event) {
			if (!isHTMLElement(event.target) || get(commandRef)?.contains(event.target)) return;
			set(query, "");
		}
		document.addEventListener("pointerdown", handlePointerDown);
		return () => document.removeEventListener("pointerdown", handlePointerDown);
	});
	function getMatches(sourceItems, search) {
		const keyword = search.trim().toLowerCase();
		if (!keyword) return [];
		const id = Number.parseInt(keyword, 10);
		return sourceItems.filter((item) => item.name.toLowerCase().includes(keyword) || !Number.isNaN(id) && item.id === id).slice(0, 30);
	}
	async function setAmount(id, amount) {
		const nextItems = selectedItems().filter((item) => item.id !== id);
		if (amount > 0) nextItems.push({
			id,
			amount
		});
		selectedItems(nextItems);
		await ttStorage.change({ localdata: { popup: { calculatorItems: selectedItems() } } });
	}
	var fragment = comment();
	component(first_child(fragment), () => Command, ($$anchor, Command_Root) => {
		Command_Root($$anchor, {
			shouldFilter: false,
			class: "relative h-auto overflow-visible rounded-md bg-transparent p-0",
			get ref() {
				return get(commandRef);
			},
			set ref($$value) {
				set(commandRef, $$value, true);
			},
			children: ($$anchor, $$slotProps) => {
				var fragment_1 = root_1$13();
				var node_1 = first_child(fragment_1);
				component(node_1, () => Command_input, ($$anchor, Command_Input) => {
					Command_Input($$anchor, {
						placeholder: "Search item ...",
						get value() {
							return get(query);
						},
						set value($$value) {
							set(query, $$value, true);
						}
					});
				});
				var node_2 = sibling(node_1, 2);
				var consequent = ($$anchor) => {
					var fragment_2 = comment();
					component(first_child(fragment_2), () => Command_list, ($$anchor, Command_List) => {
						Command_List($$anchor, {
							class: "mt-1 max-h-52 w-full rounded-md bg-popover p-1 absolute top-full z-10",
							children: ($$anchor, $$slotProps) => {
								var fragment_3 = root_3$11();
								var node_4 = first_child(fragment_3);
								component(node_4, () => Command_empty, ($$anchor, Command_Empty) => {
									Command_Empty($$anchor, {
										class: "p-2",
										children: ($$anchor, $$slotProps) => {
											next();
											append($$anchor, text("No items found."));
										},
										$$slots: { default: true }
									});
								});
								component(sibling(node_4, 2), () => Command_group, ($$anchor, Command_Group) => {
									Command_Group($$anchor, {
										class: "p-0",
										children: ($$anchor, $$slotProps) => {
											var fragment_4 = comment();
											each(first_child(fragment_4), 17, () => get(matches), (item) => item.id, ($$anchor, item) => {
												var fragment_5 = comment();
												var node_7 = first_child(fragment_5);
												{
													let $0 = user_derived(() => `${get(item).id}-${get(item).name}`);
													component(node_7, () => Command_item, ($$anchor, Command_Item) => {
														Command_Item($$anchor, {
															get value() {
																return get($0);
															},
															class: "",
															children: ($$anchor, $$slotProps) => {
																var fragment_6 = root_7$8();
																var label = first_child(fragment_6);
																var text_1 = child(label, true);
																reset(label);
																component(sibling(label, 2), () => Command_shortcut, ($$anchor, Command_Shortcut) => {
																	Command_Shortcut($$anchor, {
																		class: "w-20 tracking-normal",
																		children: ($$anchor, $$slotProps) => {
																			{
																				let $0 = user_derived(() => `calculator-${get(item).id}`);
																				let $1 = user_derived(() => selectedItems().find((selected) => selected.id === get(item).id.toString())?.amount ?? "");
																				Input($$anchor, {
																					get id() {
																						return get($0);
																					},
																					type: "number",
																					min: "0",
																					class: "h-7 text-xs",
																					get value() {
																						return get($1);
																					},
																					oninput: (event) => setAmount(get(item).id.toString(), Number.parseInt(event.currentTarget.value) || 0)
																				});
																			}
																		},
																		$$slots: { default: true }
																	});
																});
																template_effect(() => {
																	set_attribute(label, "for", `calculator-${get(item).id}`);
																	set_text(text_1, get(item).name);
																});
																append($$anchor, fragment_6);
															},
															$$slots: { default: true }
														});
													});
												}
												append($$anchor, fragment_5);
											});
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
					append($$anchor, fragment_2);
				};
				if_block(node_2, ($$render) => {
					if (get(listOpen)) $$render(consequent);
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
//#region src/extension/entrypoints/popup/components/calculator/ItemList.svelte
var root_4$10 = from_html(`<div class="grid grid-cols-[64px_1fr_auto] gap-1"><span> </span> <span class="truncate"> </span> <span> </span></div>`);
var root_5$11 = from_html(`<div class="text-muted-foreground">No items selected.</div>`);
var root_6$8 = from_html(`<!> <div class="flex justify-between gap-1"><!> <div class="text-right font-bold"> </div></div>`, 1);
var root_2$10 = from_html(`<!> <!>`, 1);
function ItemList($$anchor, $$props) {
	push($$props, true);
	const $torndataStore = () => store_get(torndataStore, "$torndataStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let selectedItems = prop($$props, "selectedItems", 31, () => proxy([]));
	const itemsMap = user_derived(() => $torndataStore()?.itemsMap ?? {});
	const total = user_derived(() => selectedItems().reduce((sum, item) => sum + (get(itemsMap)[item.id]?.value?.market_price ?? 0) * item.amount, 0));
	async function clearItems() {
		selectedItems([]);
		await ttStorage.change({ localdata: { popup: { calculatorItems: [] } } });
	}
	Card($$anchor, {
		size: "sm",
		class: "rounded-lg mx-1",
		children: ($$anchor, $$slotProps) => {
			Card_content($$anchor, {
				class: "space-y-2 text-xs",
				children: ($$anchor, $$slotProps) => {
					var fragment_2 = root_2$10();
					var node = first_child(fragment_2);
					each(node, 17, selectedItems, (item) => item.id, ($$anchor, item) => {
						const tornItem = user_derived(() => get(itemsMap)[get(item).id]);
						var fragment_3 = comment();
						var node_1 = first_child(fragment_3);
						var consequent = ($$anchor) => {
							var div = root_4$10();
							var span = child(div);
							var text = child(span);
							reset(span);
							var span_1 = sibling(span, 2);
							var text_1 = child(span_1, true);
							reset(span_1);
							var span_2 = sibling(span_1, 2);
							var text_2 = child(span_2, true);
							reset(span_2);
							reset(div);
							template_effect(($0, $1) => {
								set_text(text, `${$0 ?? ""}x`);
								set_text(text_1, get(tornItem).name);
								set_text(text_2, $1);
							}, [() => formatNumber(get(item).amount), () => formatNumber(get(item).amount * get(tornItem).value.market_price, { currency: true })]);
							append($$anchor, div);
						};
						if_block(node_1, ($$render) => {
							if (get(tornItem)) $$render(consequent);
						});
						append($$anchor, fragment_3);
					}, ($$anchor) => {
						append($$anchor, root_5$11());
					});
					var node_2 = sibling(node, 2);
					var consequent_1 = ($$anchor) => {
						var fragment_4 = root_6$8();
						var node_3 = first_child(fragment_4);
						Separator(node_3, {});
						var div_2 = sibling(node_3, 2);
						var node_4 = child(div_2);
						Button(node_4, {
							size: "sm",
							variant: "outline",
							class: "h-6",
							onclick: clearItems,
							children: ($$anchor, $$slotProps) => {
								next();
								append($$anchor, text("Clear"));
							},
							$$slots: { default: true }
						});
						var div_3 = sibling(node_4, 2);
						var text_4 = child(div_3);
						reset(div_3);
						reset(div_2);
						template_effect(($0) => set_text(text_4, `Total: ${$0 ?? ""}`), [() => formatNumber(get(total), { currency: true })]);
						append($$anchor, fragment_4);
					};
					if_block(node_2, ($$render) => {
						if (selectedItems().length) $$render(consequent_1);
					});
					append($$anchor, fragment_2);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/popup/components/calculator/Calculator.svelte
var root$22 = from_html(`<div class="space-y-2 min-h-72"><!> <!></div>`);
function Calculator($$anchor, $$props) {
	push($$props, true);
	const $localdataStore = () => store_get(localdataStore, "$localdataStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let selectedItems = state(proxy([]));
	user_effect(() => {
		set(selectedItems, [...$localdataStore()?.popup?.calculatorItems ?? []], true);
	});
	var div = root$22();
	var node = child(div);
	CalculatorInput(node, {
		get selectedItems() {
			return get(selectedItems);
		},
		set selectedItems($$value) {
			set(selectedItems, $$value, true);
		}
	});
	ItemList(sibling(node, 2), {
		get selectedItems() {
			return get(selectedItems);
		},
		set selectedItems($$value) {
			set(selectedItems, $$value, true);
		}
	});
	reset(div);
	append($$anchor, div);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/popup/components/dashboard/Bars.svelte
var root_4$9 = from_html(`<a class="block space-y-1" target="_blank" rel="noreferrer"><div class="flex items-center justify-between text-xs"><span class="font-medium"> </span> <span class="text-foreground/80"> </span></div> <div class="h-1.5 overflow-hidden rounded-sm bg-muted"><div></div></div> <div class="flex justify-between gap-2 text-xs leading-none text-foreground/80"><span> </span> <span class="truncate text-right"> </span></div></a>`);
var root_5$10 = from_html(`<div class="text-xs text-foreground/80">No bar data available.</div>`);
function Bars($$anchor, $$props) {
	push($$props, true);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const $userdataStore = () => store_get(userdataStore, "$userdataStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const userSettings = user_derived(() => $settingsStore()?.apiUsage?.user);
	const bars = user_derived(() => getBars($userdataStore(), $settingsStore(), $$props.now));
	function getBars(userdata, settings, currentTime) {
		const result = [];
		if (!userdata) return result;
		if (settings?.apiUsage?.user?.bars) {
			result.push(getResourceBar("energy", "Energy", userdata.energy, LINKS.gym, "bg-[#7cc833]", userdata, settings, currentTime), getResourceBar("nerve", "Nerve", userdata.nerve, LINKS.crimes, "bg-[#b3382c]", userdata, settings, currentTime), getResourceBar("happy", "Happy", userdata.happy, LINKS.properties, "bg-[#d4c927]", userdata, settings, currentTime), getResourceBar("life", "Life", userdata.life, LINKS.items_medical, "bg-[#7b98ee]", userdata, settings, currentTime));
			const chainBar = getChainBar(userdata.chain, userdata, currentTime);
			if (chainBar) result.push(chainBar);
		}
		if (settings?.apiUsage?.user?.travel) {
			const travelBar = getTravelBar(userdata, currentTime);
			if (travelBar) result.push(travelBar);
		}
		return result;
	}
	function getResourceBar(id, label, bar, href, color, userdata, settings, currentTime) {
		const current = bar?.current ?? 0;
		const maximum = bar?.maximum ?? 100;
		const serverTime = userdata.server_time ?? Math.floor(currentTime / 1e3);
		const tickAt = (serverTime + (bar?.ticktime ?? 0)) * 1e3;
		let fullAt = (serverTime + (bar?.fulltime ?? 0)) * 1e3;
		if (current === maximum) fullAt = "full";
		else if (current > maximum) fullAt = "over";
		return {
			id,
			label,
			valueLabel: `${current}/${maximum}`,
			percent: clampPercent(current / maximum * 100),
			href,
			color,
			...getBarTimers(id, fullAt, tickAt, (bar?.interval ?? 0) * 1e3, currentTime, settings?.pages?.popup?.fullBarTime)
		};
	}
	function getChainBar(bar, userdata, currentTime) {
		const current = bar?.current ?? 0;
		if (!current) return null;
		const serverTime = userdata.server_time ?? Math.floor(currentTime / 1e3);
		const maximum = current === bar?.maximum ? bar.maximum : getNextChainBonus(current) ?? bar?.maximum ?? current;
		const isCooldown = !!bar?.cooldown;
		const fullAt = (serverTime + (isCooldown ? bar.cooldown : bar?.timeout ?? 0)) * 1e3;
		return {
			id: "chain",
			label: "Chain",
			valueLabel: `${current}/${maximum}`,
			percent: clampPercent(current / maximum * 100),
			href: "https://www.torn.com/factions.php?step=your",
			color: isCooldown ? "bg-muted-foreground" : "bg-foreground",
			...getBarTimers("chain", fullAt, fullAt, 0, currentTime, false, isCooldown)
		};
	}
	function getTravelBar(userdata, currentTime) {
		if (!userdata?.travel?.time_left) return null;
		const maximum = userdata.travel.arrival_at - userdata.travel.departed_at;
		const current = maximum - userdata.travel.time_left;
		const arrivalAt = userdata.travel.arrival_at * 1e3;
		return {
			id: "traveling",
			label: "Traveling",
			valueLabel: formatTime(arrivalAt),
			tickLabel: formatTime({ seconds: Math.max(toSeconds(arrivalAt - currentTime), 0) }, { type: "timer" }),
			fullLabel: `Landing in ${formatTime({ seconds: Math.max(toSeconds(arrivalAt - currentTime), 0) }, { type: "timer" })}`,
			percent: clampPercent(current / maximum * 100),
			href: "https://www.torn.com/index.php",
			color: "bg-[#d961ee]"
		};
	}
	function getBarTimers(id, fullAt, tickAt, tickTime, currentTime, showFullTime, isCooldown = false) {
		let nextTick = tickAt;
		if (nextTick <= currentTime && tickTime) nextTick += tickTime;
		const tickSeconds = Math.max(toSeconds(nextTick - currentTime), 0);
		let tickLabel = id === "chain" && isCooldown ? formatTime({ seconds: tickSeconds }, {
			type: "timer",
			daysToHours: true
		}) : formatTime({ seconds: tickSeconds }, {
			type: "timer",
			hideHours: id !== "traveling"
		});
		if (id === "traveling") tickLabel = formatTime({ seconds: tickSeconds }, { type: "timer" });
		let fullLabel;
		if (id === "happy" && fullAt === "over") fullLabel = `Resets in ${formatTime({ seconds: tickSeconds }, {
			type: "timer",
			hideHours: true
		})}`;
		else if (typeof fullAt === "string") fullLabel = "FULL";
		else if (id === "chain" && isCooldown) fullLabel = `Cooldown over in ${formatTime({ seconds: Math.max(toSeconds(fullAt - currentTime), 0) }, {
			type: "timer",
			daysToHours: true
		})}`;
		else if (id === "chain") fullLabel = formatTime({ seconds: Math.max(toSeconds(fullAt - currentTime), 0) }, {
			type: "timer",
			hideHours: true
		});
		else {
			fullLabel = `Full in ${formatTime({ seconds: Math.max(toSeconds(fullAt - currentTime), 0) }, {
				type: "timer",
				daysToHours: true
			})}`;
			if (showFullTime) fullLabel += ` (${formatTime({ milliseconds: fullAt }, { type: "normal" })})`;
		}
		return {
			tickLabel,
			fullLabel
		};
	}
	function clampPercent(value) {
		return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
	}
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		Card($$anchor, {
			size: "sm",
			class: "rounded-lg",
			children: ($$anchor, $$slotProps) => {
				Card_content($$anchor, {
					class: "space-y-1",
					children: ($$anchor, $$slotProps) => {
						var fragment_3 = comment();
						each(first_child(fragment_3), 17, () => get(bars), (bar) => bar.id, ($$anchor, bar) => {
							var a = root_4$9();
							var div = child(a);
							var span = child(div);
							var text = child(span, true);
							reset(span);
							var span_1 = sibling(span, 2);
							var text_1 = child(span_1, true);
							reset(span_1);
							reset(div);
							var div_1 = sibling(div, 2);
							var div_2 = child(div_1);
							let styles;
							reset(div_1);
							var div_3 = sibling(div_1, 2);
							var span_2 = child(div_3);
							var text_2 = child(span_2, true);
							reset(span_2);
							var span_3 = sibling(span_2, 2);
							var text_3 = child(span_3, true);
							reset(span_3);
							reset(div_3);
							reset(a);
							template_effect(() => {
								set_attribute(a, "href", get(bar).href);
								set_attribute(a, "title", get(bar).fullLabel);
								set_text(text, get(bar).label);
								set_text(text_1, get(bar).valueLabel);
								set_class(div_2, 1, `h-full max-w-full ${get(bar).color}`);
								styles = set_style(div_2, "", styles, { width: `${get(bar).percent}%` });
								set_text(text_2, get(bar).tickLabel);
								set_text(text_3, get(bar).fullLabel);
							});
							append($$anchor, a);
						}, ($$anchor) => {
							append($$anchor, root_5$10());
						});
						append($$anchor, fragment_3);
					},
					$$slots: { default: true }
				});
			},
			$$slots: { default: true }
		});
	};
	if_block(node, ($$render) => {
		if (get(userSettings)?.bars || get(userSettings)?.travel) $$render(consequent);
	});
	append($$anchor, fragment);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/popup/components/dashboard/Cooldowns.svelte
var root_2$9 = from_html(`<a class="rounded-lg bg-card border border-border/70 p-1 text-center text-xs hover:bg-muted" target="_blank" rel="noreferrer"><div> </div> <div class="text-foreground/80"> </div></a>`);
var root_1$12 = from_html(`<div class="grid grid-cols-3 gap-1"></div>`);
function Cooldowns($$anchor, $$props) {
	push($$props, true);
	const $userdataStore = () => store_get(userdataStore, "$userdataStore", $$stores);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const cooldowns = user_derived(() => getCooldowns($userdataStore(), $settingsStore(), $$props.now));
	function getCooldowns(userdata, settings, currentTime) {
		if (!settings?.apiUsage?.user?.cooldowns || !userdata?.cooldowns) return [];
		return [
			getCooldown("drug", "Drugs", userdata.cooldowns.drug, "https://www.torn.com/item.php#drugs-items", "text-green-500", userdata, currentTime),
			getCooldown("booster", "Boosters", userdata.cooldowns.booster, "https://www.torn.com/item.php#boosters-items", "text-orange-500", userdata, currentTime),
			getCooldown("medical", "Medical", userdata.cooldowns.medical, "https://www.torn.com/item.php#medical-items", "text-blue-500", userdata, currentTime)
		];
	}
	function getCooldown(id, label, cooldown, href, color, userdata, currentTime) {
		const completedAt = userdata.timestamp && cooldown ? (userdata.timestamp + cooldown) * 1e3 : 0;
		return {
			id,
			label,
			value: formatTime({ milliseconds: completedAt ? Math.max(completedAt - currentTime, 0) : 0 }, {
				type: "timer",
				daysToHours: true
			}),
			href,
			color
		};
	}
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		var div = root_1$12();
		each(div, 21, () => get(cooldowns), (cooldown) => cooldown.id, ($$anchor, cooldown) => {
			var a = root_2$9();
			var div_1 = child(a);
			var text = child(div_1, true);
			reset(div_1);
			var div_2 = sibling(div_1, 2);
			var text_1 = child(div_2, true);
			reset(div_2);
			reset(a);
			template_effect(($0) => {
				set_attribute(a, "href", get(cooldown).href);
				set_class(div_1, 1, $0);
				set_text(text, get(cooldown).label);
				set_text(text_1, get(cooldown).value);
			}, [() => clsx(cn("font-medium", get(cooldown).color))]);
			append($$anchor, a);
		});
		reset(div);
		append($$anchor, div);
	};
	if_block(node, ($$render) => {
		if (get(cooldowns).length) $$render(consequent);
	});
	append($$anchor, fragment);
	pop();
	$$cleanup();
}
//#endregion
//#region node_modules/phosphor-svelte/lib/BellIcon.svelte
var root_2$8 = from_svg(`<path d="M225.29,165.93C216.61,151,212,129.57,212,104a84,84,0,0,0-168,0c0,25.58-4.59,47-13.27,61.93A20.08,20.08,0,0,0,30.66,186,19.77,19.77,0,0,0,48,196H84.18a44,44,0,0,0,87.64,0H208a19.77,19.77,0,0,0,17.31-10A20.08,20.08,0,0,0,225.29,165.93ZM128,212a20,20,0,0,1-19.6-16h39.2A20,20,0,0,1,128,212ZM54.66,172C63.51,154,68,131.14,68,104a60,60,0,0,1,120,0c0,27.13,4.48,50,13.33,68Z"></path>`);
var root_3$10 = from_svg(`<path d="M208,192H48a8,8,0,0,1-6.88-12C47.71,168.6,56,139.81,56,104a72,72,0,0,1,144,0c0,35.82,8.3,64.6,14.9,76A8,8,0,0,1,208,192Z" opacity="0.2"></path><path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z"></path>`, 1);
var root_4$8 = from_svg(`<path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216Z"></path>`);
var root_5$9 = from_svg(`<path d="M220.07,176.94C214.41,167.2,206,139.73,206,104a78,78,0,1,0-156,0c0,35.74-8.42,63.2-14.08,72.94A14,14,0,0,0,48,198H90.48a38,38,0,0,0,75,0H208a14,14,0,0,0,12.06-21.06ZM128,218a26,26,0,0,1-25.29-20h50.58A26,26,0,0,1,128,218Zm81.71-33a1.9,1.9,0,0,1-1.7,1H48a1.9,1.9,0,0,1-1.7-1,2,2,0,0,1,0-2C53.87,170,62,139.69,62,104a66,66,0,1,1,132,0c0,35.68,8.14,65.95,15.71,79A2,2,0,0,1,209.71,185Z"></path>`);
var root_6$7 = from_svg(`<path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z"></path>`);
var root_7$7 = from_svg(`<path d="M218.35,178C212.58,168,204,140.13,204,104a76,76,0,1,0-152,0c0,36.13-8.59,64-14.36,73.95A12,12,0,0,0,48,196H92.23a36,36,0,0,0,71.54,0H208A12,12,0,0,0,218.35,178ZM128,220a28,28,0,0,1-27.71-24h55.42A28,28,0,0,1,128,220Zm83.45-34a3.91,3.91,0,0,1-3.44,2H48a3.91,3.91,0,0,1-3.44-2,4,4,0,0,1,0-4C52,169.17,60,139.32,60,104a68,68,0,1,1,136,0c0,35.31,8,65.17,15.44,78A4,4,0,0,1,211.45,186Z"></path>`);
var root$21 = from_svg(`<svg><!><rect width="256" height="256" fill="none"></rect><!></svg>`);
function BellIcon($$anchor, $$props) {
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
		append($$anchor, root_2$8());
	};
	var consequent_2 = ($$anchor) => {
		var fragment_1 = root_3$10();
		next();
		append($$anchor, fragment_1);
	};
	var consequent_3 = ($$anchor) => {
		append($$anchor, root_4$8());
	};
	var consequent_4 = ($$anchor) => {
		append($$anchor, root_5$9());
	};
	var consequent_5 = ($$anchor) => {
		append($$anchor, root_6$7());
	};
	var consequent_6 = ($$anchor) => {
		append($$anchor, root_7$7());
	};
	var alternate = ($$anchor) => {
		var text$11 = text();
		text$11.nodeValue = (console.error("Unsupported icon weight. Choose from \"thin\", \"light\", \"regular\", \"bold\", \"fill\", or \"duotone\"."), "");
		append($$anchor, text$11);
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
//#region node_modules/phosphor-svelte/lib/BellSlashIcon.svelte
var root_2$7 = from_svg(`<path d="M216.88,207.93l-160-176A12,12,0,1,0,39.12,48.07l14.8,16.29A83.58,83.58,0,0,0,44,104c0,25.58-4.59,47-13.27,61.93A20.08,20.08,0,0,0,30.68,186,19.75,19.75,0,0,0,48,196H84.19a44,44,0,0,0,87.62,0h1.79l25.52,28.07a12,12,0,0,0,17.76-16.14ZM68,104a59.84,59.84,0,0,1,3.52-20.29L151.78,172H54.68C63.52,154,68,131.14,68,104Zm60,108a20,20,0,0,1-19.6-16h39.2A20,20,0,0,1,128,212ZM88.89,42.35a12,12,0,0,1,6.37-15.73A84,84,0,0,1,212,104c0,18.68,2.38,34.93,7.07,48.28a12,12,0,1,1-22.64,8C190.83,144.32,188,125.4,188,104a60,60,0,0,0-83.38-55.28A12,12,0,0,1,88.89,42.35Z"></path>`);
var root_3$9 = from_svg(`<path d="M208,192H48a8,8,0,0,1-6.88-12C47.71,168.6,56,139.81,56,104a72,72,0,0,1,144,0c0,35.82,8.3,64.6,14.9,76A8,8,0,0,1,208,192Z" opacity="0.2"></path><path d="M53.92,34.62A8,8,0,1,0,42.08,45.38L58.82,63.8A79.59,79.59,0,0,0,48,104c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.8a40,40,0,0,0,78.4,0h15.44l19.44,21.38a8,8,0,1,0,11.84-10.76ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a63.65,63.65,0,0,1,6.26-27.62L168.09,184Zm166-4.73a8.13,8.13,0,0,1-2.93.55,8,8,0,0,1-7.44-5.08C196.35,156.19,192,129.75,192,104A64,64,0,0,0,96.43,48.31a8,8,0,0,1-7.9-13.91A80,80,0,0,1,208,104c0,35.35,8.05,58.59,10.52,64.88A8,8,0,0,1,214,179.25Z"></path>`, 1);
var root_4$7 = from_svg(`<path d="M221.84,192v0a1.85,1.85,0,0,1-3,.28L83.27,43.19a4,4,0,0,1,.8-6A79.55,79.55,0,0,1,129.17,24C173,24.66,207.8,61.1,208,104.92c.14,34.88,8.31,61.54,13.82,71A15.89,15.89,0,0,1,221.84,192Zm-7.92,18.62a8,8,0,0,1-11.85,10.76L182.62,200H167.16a40,40,0,0,1-78.41,0H47.91a15.78,15.78,0,0,1-13.59-7.59,16.42,16.42,0,0,1-.09-16.68c5.55-9.73,13.7-36.64,13.7-71.73A79.42,79.42,0,0,1,58.79,63.85L42,45.38A8,8,0,1,1,53.84,34.62ZM150.59,200H105.32a24,24,0,0,0,45.27,0Z"></path>`);
var root_5$8 = from_svg(`<path d="M52.44,36A6,6,0,0,0,43.56,44L61.31,63.56A77.45,77.45,0,0,0,50,104c0,35.74-8.42,63.2-14.08,72.94A14,14,0,0,0,48,198h42.5a38,38,0,0,0,75,0h18l20,22a6,6,0,0,0,8.88-8.08ZM128,218a26,26,0,0,1-25.29-20h50.58A26,26,0,0,1,128,218ZM48,186a1.9,1.9,0,0,1-1.7-1,2,2,0,0,1,0-2C53.86,170,62,139.69,62,104a65.63,65.63,0,0,1,7.78-31.12L172.62,186Zm165.29-8.62a5.88,5.88,0,0,1-2.2.42,6,6,0,0,1-5.58-3.81c-7.2-18.31-11.49-44.48-11.49-70A66,66,0,0,0,95.45,46.57a6,6,0,1,1-5.93-10.43A78,78,0,0,1,206,104c0,35.7,8.16,59.24,10.66,65.61A6,6,0,0,1,213.27,177.38Z"></path>`);
var root_6$6 = from_svg(`<path d="M53.92,34.62A8,8,0,1,0,42.08,45.38L58.82,63.8A79.59,79.59,0,0,0,48,104c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.8a40,40,0,0,0,78.4,0h15.44l19.44,21.38a8,8,0,1,0,11.84-10.76ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a63.65,63.65,0,0,1,6.26-27.62L168.09,184Zm166-4.73a8.13,8.13,0,0,1-2.93.55,8,8,0,0,1-7.44-5.08C196.35,156.19,192,129.75,192,104A64,64,0,0,0,96.43,48.31a8,8,0,0,1-7.9-13.91A80,80,0,0,1,208,104c0,35.35,8.05,58.59,10.52,64.88A8,8,0,0,1,214,179.25Z"></path>`);
var root_7$6 = from_svg(`<path d="M51,37.31A4,4,0,0,0,45,42.69L63.8,63.32A75.52,75.52,0,0,0,52,104c0,36.13-8.58,64-14.36,73.95A12,12,0,0,0,48,196H92.23a36,36,0,0,0,71.54,0h20.64L205,218.69a4,4,0,1,0,5.92-5.38ZM128,220a28,28,0,0,1-27.71-24h55.42A28,28,0,0,1,128,220ZM48,188a3.89,3.89,0,0,1-3.43-2,4,4,0,0,1,0-4C52,169.17,60,139.32,60,104a67.58,67.58,0,0,1,9.4-34.51L177.14,188Zm164.55-12.48a3.94,3.94,0,0,1-1.46.28,4,4,0,0,1-3.72-2.54C200.24,155.17,196,129.28,196,104A68,68,0,0,0,94.46,44.83a4,4,0,1,1-4-6.95A76,76,0,0,1,204,104c0,36.05,8.26,59.89,10.79,66.34A4,4,0,0,1,212.53,175.52Z"></path>`);
var root$20 = from_svg(`<svg><!><rect width="256" height="256" fill="none"></rect><!></svg>`);
function BellSlashIcon($$anchor, $$props) {
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
		append($$anchor, root_2$7());
	};
	var consequent_2 = ($$anchor) => {
		var fragment_1 = root_3$9();
		next();
		append($$anchor, fragment_1);
	};
	var consequent_3 = ($$anchor) => {
		append($$anchor, root_4$7());
	};
	var consequent_4 = ($$anchor) => {
		append($$anchor, root_5$8());
	};
	var consequent_5 = ($$anchor) => {
		append($$anchor, root_6$6());
	};
	var consequent_6 = ($$anchor) => {
		append($$anchor, root_7$6());
	};
	var alternate = ($$anchor) => {
		var text$10 = text();
		text$10.nodeValue = (console.error("Unsupported icon weight. Choose from \"thin\", \"light\", \"regular\", \"bold\", \"fill\", or \"duotone\"."), "");
		append($$anchor, text$10);
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
//#region src/extension/entrypoints/popup/components/dashboard/ExtraInformation.svelte
var root_1$11 = from_html(`<a class="rounded-lg bg-card border border-border/70 p-1 text-center text-xs hover:bg-muted" target="_blank" rel="noreferrer"><div class="font-medium"> </div> <div class="text-foreground/80"> </div></a>`);
var root$19 = from_html(`<div class="grid grid-cols-3 gap-1"></div> <div class="flex items-center justify-between text-xs text-foreground/80"><div class="flex items-center gap-1"><span>Updated</span> <span class="font-medium text-foreground"> </span></div> <!></div>`, 1);
function ExtraInformation($$anchor, $$props) {
	push($$props, true);
	const $userdataStore = () => store_get(userdataStore, "$userdataStore", $$stores);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const extraInformation = user_derived(() => getExtraInformation($userdataStore(), $settingsStore()));
	const lastUpdated = user_derived(() => getLastUpdated($userdataStore(), $$props.now));
	const notificationsEnabled = user_derived(() => !!$settingsStore()?.notifications?.types?.global);
	async function toggleNotifications() {
		await ttStorage.change({ settings: { notifications: { types: { global: !get(notificationsEnabled) } } } });
	}
	function getExtraInformation(userdata, settings) {
		return [
			{
				label: "Events",
				value: settings?.apiUsage.user.newevents ? (userdata?.notifications.events ?? 0).toString() : "N/A",
				href: "https://www.torn.com/events.php"
			},
			{
				label: "Messages",
				value: settings?.apiUsage.user.newmessages ? (userdata?.messages ?? []).filter((message) => !message.seen).length.toString() : "N/A",
				href: "https://www.torn.com/messages.php"
			},
			{
				label: "Wallet",
				value: settings?.apiUsage.user.money ? formatNumber(userdata?.money.wallet ?? 0, { currency: true }) : "N/A",
				href: "https://www.torn.com/properties.php#/p=options&tab=vault"
			}
		];
	}
	function getLastUpdated(userdata, currentTime) {
		return userdata?.date ? formatTime({ milliseconds: userdata.date }, {
			type: "ago",
			agoFilter: TO_MILLIS.SECONDS
		}) : "Never";
	}
	var fragment = root$19();
	var div = first_child(fragment);
	each(div, 21, () => get(extraInformation), (item) => item.label, ($$anchor, item) => {
		var a = root_1$11();
		var div_1 = child(a);
		var text = child(div_1, true);
		reset(div_1);
		var div_2 = sibling(div_1, 2);
		var text_1 = child(div_2, true);
		reset(div_2);
		reset(a);
		template_effect(() => {
			set_attribute(a, "href", get(item).href);
			set_text(text, get(item).label);
			set_text(text_1, get(item).value);
		});
		append($$anchor, a);
	});
	reset(div);
	var div_3 = sibling(div, 2);
	var div_4 = child(div_3);
	var span = sibling(child(div_4), 2);
	var text_2 = child(span, true);
	reset(span);
	reset(div_4);
	var node = sibling(div_4, 2);
	{
		let $0 = user_derived(() => get(notificationsEnabled) ? "secondary" : "outline");
		let $1 = user_derived(() => get(notificationsEnabled) ? "text-sidebar-primary" : "text-destructive");
		let $2 = user_derived(() => get(notificationsEnabled) ? "Disable notifications" : "Enable notifications");
		let $3 = user_derived(() => get(notificationsEnabled) ? "Notifications enabled" : "Notifications disabled");
		Button(node, {
			get variant() {
				return get($0);
			},
			size: "icon-sm",
			get class() {
				return get($1);
			},
			onclick: toggleNotifications,
			get "aria-label"() {
				return get($2);
			},
			get title() {
				return get($3);
			},
			children: ($$anchor, $$slotProps) => {
				var fragment_1 = comment();
				var node_1 = first_child(fragment_1);
				var consequent = ($$anchor) => {
					BellIcon($$anchor, {});
				};
				var alternate = ($$anchor) => {
					BellSlashIcon($$anchor, {});
				};
				if_block(node_1, ($$render) => {
					if (get(notificationsEnabled)) $$render(consequent);
					else $$render(alternate, -1);
				});
				append($$anchor, fragment_1);
			},
			$$slots: { default: true }
		});
	}
	reset(div_3);
	template_effect(() => set_text(text_2, get(lastUpdated)));
	append($$anchor, fragment);
	pop();
	$$cleanup();
}
//#endregion
//#region node_modules/phosphor-svelte/lib/CaretRightIcon.svelte
var root_2$6 = from_svg(`<path d="M184.49,136.49l-80,80a12,12,0,0,1-17-17L159,128,87.51,56.49a12,12,0,1,1,17-17l80,80A12,12,0,0,1,184.49,136.49Z"></path>`);
var root_3$8 = from_svg(`<path d="M176,128,96,208V48Z" opacity="0.2"></path><path d="M181.66,122.34l-80-80A8,8,0,0,0,88,48V208a8,8,0,0,0,13.66,5.66l80-80A8,8,0,0,0,181.66,122.34ZM104,188.69V67.31L164.69,128Z"></path>`, 1);
var root_4$6 = from_svg(`<path d="M181.66,133.66l-80,80A8,8,0,0,1,88,208V48a8,8,0,0,1,13.66-5.66l80,80A8,8,0,0,1,181.66,133.66Z"></path>`);
var root_5$7 = from_svg(`<path d="M180.24,132.24l-80,80a6,6,0,0,1-8.48-8.48L167.51,128,91.76,52.24a6,6,0,0,1,8.48-8.48l80,80A6,6,0,0,1,180.24,132.24Z"></path>`);
var root_6$5 = from_svg(`<path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z"></path>`);
var root_7$5 = from_svg(`<path d="M178.83,130.83l-80,80a4,4,0,0,1-5.66-5.66L170.34,128,93.17,50.83a4,4,0,0,1,5.66-5.66l80,80A4,4,0,0,1,178.83,130.83Z"></path>`);
var root$18 = from_svg(`<svg><!><rect width="256" height="256" fill="none"></rect><!></svg>`);
function CaretRightIcon($$anchor, $$props) {
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
	var svg = root$18();
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
		append($$anchor, root_2$6());
	};
	var consequent_2 = ($$anchor) => {
		var fragment_1 = root_3$8();
		next();
		append($$anchor, fragment_1);
	};
	var consequent_3 = ($$anchor) => {
		append($$anchor, root_4$6());
	};
	var consequent_4 = ($$anchor) => {
		append($$anchor, root_5$7());
	};
	var consequent_5 = ($$anchor) => {
		append($$anchor, root_6$5());
	};
	var consequent_6 = ($$anchor) => {
		append($$anchor, root_7$5());
	};
	var alternate = ($$anchor) => {
		var text$9 = text();
		text$9.nodeValue = (console.error("Unsupported icon weight. Choose from \"thin\", \"light\", \"regular\", \"bold\", \"fill\", or \"duotone\"."), "");
		append($$anchor, text$9);
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
//#region src/extension/entrypoints/popup/components/dashboard/FactionStakeouts.svelte
var root_7$4 = from_html(`<!> <!>`, 1);
var root_6$4 = from_html(`<div class="rounded-lg border bg-card p-2 text-xs"><div class="flex items-center gap-2"><a class="-m-1 grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1 rounded-md p-1 hover:bg-muted/60" target="_blank" rel="noreferrer"><span class="truncate font-medium"> </span> <!></a> <!></div></div>`);
var root_5$6 = from_html(`<div class="space-y-1"></div>`);
var root_1$10 = from_html(`<section class="space-y-1"><div class="flex items-center justify-between"><div class="text-xs font-medium">Faction Stakeouts</div> <!></div> <!></section>`);
function FactionStakeouts($$anchor, $$props) {
	push($$props, true);
	const $factionStakeoutsStore = () => store_get(factionStakeoutsStore, "$factionStakeoutsStore", $$stores);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let factionStakeoutsOpen = state(true);
	const factionStakeoutRows = user_derived(() => getFactionStakeoutRows($factionStakeoutsStore(), $settingsStore()));
	async function removeFactionStakeout(id) {
		if (!$factionStakeoutsStore()) return;
		const nextStakeouts = {
			...$factionStakeoutsStore(),
			list: ($factionStakeoutsStore()?.list ?? []).filter((e) => e.id !== id)
		};
		await ttStorage.set({ factionStakeouts: nextStakeouts });
	}
	function getFactionStakeoutRows(source, settings) {
		if (!settings?.pages?.popup?.showStakeouts || !source?.list?.length) return [];
		return source.list.toSorted((a, b) => a.order - b.order).map((stakeout) => ({
			id: stakeout.id,
			name: stakeout.info?.name ?? String(stakeout.id),
			respect: stakeout.info?.respect ?? 1,
			chain: stakeout.info?.chain ?? "N/A",
			members: stakeout.info?.members?.current ?? "N/A",
			maxMembers: stakeout.info?.members?.maximum ?? "N/A"
		}));
	}
	function getMembersLabel(row) {
		return row.members !== "N/A" ? `${row.members}/${row.maxMembers}` : "N/A";
	}
	function getChainLabel(chain) {
		const chainValue = Number(chain);
		return Number.isFinite(chainValue) && chainValue > 0 ? `${chainValue} chain` : "No chain";
	}
	var fragment = comment();
	var node = first_child(fragment);
	var consequent_3 = ($$anchor) => {
		var section = root_1$10();
		var div = child(section);
		Button(sibling(child(div), 2), {
			variant: "ghost",
			size: "icon-xs",
			onclick: () => set(factionStakeoutsOpen, !get(factionStakeoutsOpen)),
			"aria-label": "Toggle faction stakeouts",
			children: ($$anchor, $$slotProps) => {
				var fragment_1 = comment();
				var node_2 = first_child(fragment_1);
				var consequent = ($$anchor) => {
					CaretDownIcon($$anchor, {});
				};
				var alternate = ($$anchor) => {
					CaretRightIcon($$anchor, {});
				};
				if_block(node_2, ($$render) => {
					if (get(factionStakeoutsOpen)) $$render(consequent);
					else $$render(alternate, -1);
				});
				append($$anchor, fragment_1);
			},
			$$slots: { default: true }
		});
		reset(div);
		var node_3 = sibling(div, 2);
		var consequent_2 = ($$anchor) => {
			var div_1 = root_5$6();
			each(div_1, 21, () => get(factionStakeoutRows), (row) => row.id, ($$anchor, row) => {
				var div_2 = root_6$4();
				var div_3 = child(div_2);
				var a_1 = child(div_3);
				var span = child(a_1);
				var text$8 = child(span, true);
				reset(span);
				var node_4 = sibling(span, 2);
				var consequent_1 = ($$anchor) => {
					var fragment_4 = root_7$4();
					var node_5 = first_child(fragment_4);
					Badge(node_5, {
						variant: "outline",
						class: "shrink-0 whitespace-nowrap",
						children: ($$anchor, $$slotProps) => {
							next();
							var text_1 = text();
							template_effect(($0) => set_text(text_1, $0), [() => getMembersLabel(get(row))]);
							append($$anchor, text_1);
						},
						$$slots: { default: true }
					});
					Badge(sibling(node_5, 2), {
						variant: "secondary",
						class: "shrink-0 whitespace-nowrap",
						children: ($$anchor, $$slotProps) => {
							next();
							var text_2 = text();
							template_effect(($0) => set_text(text_2, $0), [() => getChainLabel(get(row).chain)]);
							append($$anchor, text_2);
						},
						$$slots: { default: true }
					});
					append($$anchor, fragment_4);
				};
				var alternate_1 = ($$anchor) => {
					Badge($$anchor, {
						variant: "destructive",
						class: "uppercase",
						children: ($$anchor, $$slotProps) => {
							next();
							append($$anchor, text("destroyed"));
						},
						$$slots: { default: true }
					});
				};
				if_block(node_4, ($$render) => {
					if (get(row).respect > 0) $$render(consequent_1);
					else $$render(alternate_1, -1);
				});
				reset(a_1);
				Button(sibling(a_1, 2), {
					variant: "ghost",
					size: "icon-xs",
					class: "text-destructive",
					onclick: () => removeFactionStakeout(get(row).id),
					"aria-label": "Remove faction stakeout",
					children: ($$anchor, $$slotProps) => {
						TrashIcon($$anchor, {});
					},
					$$slots: { default: true }
				});
				reset(div_3);
				reset(div_2);
				template_effect(() => {
					set_attribute(a_1, "href", `https://www.torn.com/factions.php?step=profile&ID=${get(row).id}#/`);
					set_text(text$8, get(row).name);
				});
				append($$anchor, div_2);
			});
			reset(div_1);
			append($$anchor, div_1);
		};
		if_block(node_3, ($$render) => {
			if (get(factionStakeoutsOpen)) $$render(consequent_2);
		});
		reset(section);
		append($$anchor, section);
	};
	if_block(node, ($$render) => {
		if (get(factionStakeoutRows).length) $$render(consequent_3);
	});
	append($$anchor, fragment);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/popup/components/dashboard/Overview.svelte
var root_4$5 = from_html(`<div> </div>`);
var root_3$7 = from_html(`<a class="hover:underline" target="_blank" rel="noreferrer"> </a> <!>`, 1);
var root_10 = from_html(`<span class="block size-4"></span>`);
var root_8$2 = from_html(`<!> <!>`, 1);
var root_1$9 = from_html(`<!> <!>`, 1);
function Overview($$anchor, $$props) {
	push($$props, true);
	const $userdataStore = () => store_get(userdataStore, "$userdataStore", $$stores);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const statusInformation = user_derived(() => getStatusInformation($userdataStore(), $settingsStore(), $$props.now));
	const visibleIcons = user_derived(() => getVisibleIcons($userdataStore(), $settingsStore(), $$props.now));
	function getStatusInformation(userdata, settings, currentTime) {
		if (!settings?.apiUsage?.user?.travel || !userdata?.travel) return {
			country: "Torn",
			status: null,
			href: "https://www.torn.com"
		};
		if (userdata.travel.time_left) return {
			country: `Traveling to ${userdata.travel.destination}`,
			status: null,
			href: "https://www.torn.com/index.php"
		};
		const rawStatus = userdata.profile?.status?.state?.toLowerCase?.() ?? "okay";
		const status = rawStatus === "abroad" ? "okay" : rawStatus;
		const until = userdata.profile?.status?.until ? userdata.profile.status.until * 1e3 : null;
		let label = capitalizeText(status);
		if (until && until > currentTime) {
			if (status === "jail") label = `Jailed for ${formatTime({ milliseconds: until - currentTime }, {
				type: "timer",
				showDays: true,
				short: true
			})}`;
			else if (status === "hospital") label = `Hospitalized for ${formatTime({ milliseconds: until - currentTime }, {
				type: "timer",
				showDays: true,
				short: true
			})}`;
		}
		return {
			country: userdata.travel.destination,
			status: {
				label,
				className: status === "hospital" ? "text-destructive" : status === "jail" ? "text-amber-600 dark:text-amber-400" : "text-primary"
			},
			href: "https://www.torn.com"
		};
	}
	function getVisibleIcons(userdata, settings, currentTime) {
		if (!settings?.apiUsage?.user?.icons || !settings?.pages?.popup?.showIcons || !userdata?.icons) return [];
		return ALL_ICONS.flatMap((icon) => {
			if (settings.hideIcons?.includes(icon.icon)) return [];
			const userdataIcon = userdata.icons.find((entry) => entry.id === icon.id);
			if (!userdataIcon) return [];
			const tooltipParts = [userdataIcon.title, userdataIcon.description].filter(Boolean);
			if (userdataIcon.until) tooltipParts.push(formatTime({ milliseconds: Math.max(userdataIcon.until * 1e3 - currentTime, 0) }, {
				type: "wordTimer",
				showDays: true
			}));
			return [{
				id: icon.id,
				icon: icon.icon,
				href: "url" in icon ? icon.url : void 0,
				tooltip: tooltipParts.join(" - ") || icon.description
			}];
		});
	}
	Card($$anchor, {
		size: "sm",
		class: "rounded-lg gap-2!",
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = root_1$9();
			var node = first_child(fragment_1);
			Card_header(node, {
				children: ($$anchor, $$slotProps) => {
					Card_title($$anchor, {
						class: "min-w-0 truncate flex flex-wrap items-center justify-between w-full",
						children: ($$anchor, $$slotProps) => {
							var fragment_3 = root_3$7();
							var a = first_child(fragment_3);
							var text = child(a, true);
							reset(a);
							var node_1 = sibling(a, 2);
							var consequent = ($$anchor) => {
								var div = root_4$5();
								var text_1 = child(div, true);
								reset(div);
								template_effect(() => {
									set_class(div, 1, `text-xs font-medium ${get(statusInformation).status.className}`);
									set_text(text_1, get(statusInformation).status.label);
								});
								append($$anchor, div);
							};
							if_block(node_1, ($$render) => {
								if (get(statusInformation).status) $$render(consequent);
							});
							template_effect(() => {
								set_attribute(a, "href", get(statusInformation).href);
								set_text(text, get(statusInformation).country);
							});
							append($$anchor, fragment_3);
						},
						$$slots: { default: true }
					});
				},
				$$slots: { default: true }
			});
			var node_2 = sibling(node, 2);
			var consequent_1 = ($$anchor) => {
				Card_content($$anchor, {
					class: "flex flex-wrap gap-1",
					children: ($$anchor, $$slotProps) => {
						var fragment_5 = comment();
						each(first_child(fragment_5), 17, () => get(visibleIcons), (icon) => icon.id, ($$anchor, icon) => {
							var fragment_6 = comment();
							component(first_child(fragment_6), () => Tooltip, ($$anchor, Tooltip_Root) => {
								Tooltip_Root($$anchor, {
									children: ($$anchor, $$slotProps) => {
										var fragment_7 = root_8$2();
										var node_5 = first_child(fragment_7);
										{
											const child = ($$anchor, $$arg0) => {
												let _props = () => $$arg0?.().props;
												var fragment_8 = comment();
												element(first_child(fragment_8), () => get(icon).href ? "a" : "span", false, ($$element, $$anchor) => {
													attribute_effect($$element, () => ({
														..._props(),
														href: get(icon).href,
														target: get(icon).href ? "_blank" : void 0,
														rel: get(icon).href ? "noreferrer" : void 0,
														"aria-label": get(icon).tooltip,
														class: "block size-4 shrink-0 overflow-hidden"
													}));
													var span = root_10();
													template_effect(() => set_style(span, `background:url(https://torn.com/images/v2/svg_icons/sprites/user_status_icons_sprite.svg);background-position:-${(get(icon).id - 1) * 18}px 0`));
													append($$anchor, span);
												});
												append($$anchor, fragment_8);
											};
											component(node_5, () => Tooltip_trigger, ($$anchor, Tooltip_Trigger) => {
												Tooltip_Trigger($$anchor, {
													child,
													$$slots: { child: true }
												});
											});
										}
										component(sibling(node_5, 2), () => Tooltip_content, ($$anchor, Tooltip_Content) => {
											Tooltip_Content($$anchor, {
												sideOffset: 4,
												children: ($$anchor, $$slotProps) => {
													next();
													var text_2 = text();
													template_effect(() => set_text(text_2, get(icon).tooltip));
													append($$anchor, text_2);
												},
												$$slots: { default: true }
											});
										});
										append($$anchor, fragment_7);
									},
									$$slots: { default: true }
								});
							});
							append($$anchor, fragment_6);
						});
						append($$anchor, fragment_5);
					},
					$$slots: { default: true }
				});
			};
			if_block(node_2, ($$render) => {
				if (get(visibleIcons).length) $$render(consequent_1);
			});
			append($$anchor, fragment_1);
		},
		$$slots: { default: true }
	});
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/popup/components/dashboard/StakeoutRow.svelte
var root_1$8 = from_html(`<span class="truncate text-foreground/65"> </span>`);
var root$17 = from_html(`<div class="rounded-lg border bg-card p-2 text-xs"><div class="flex items-start gap-2"><a class="-m-1 block min-w-0 flex-1 rounded-md p-1 hover:bg-muted/60" target="_blank" rel="noreferrer"><div class="flex items-center gap-1.5"><span></span> <span class="truncate font-medium"> </span> <!></div> <div class="mt-1 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 text-[10px] text-foreground/80"><span>Life</span> <div class="h-1.5 flex-1 overflow-hidden rounded-sm bg-muted"><div class="h-full bg-blue-500"></div></div> <span> </span></div> <div class="mt-1 flex items-center justify-between gap-2"><span> </span> <span class="shrink-0 text-foreground/80"> </span></div></a> <!></div></div>`);
function StakeoutRow($$anchor, $$props) {
	push($$props, true);
	const $stakeoutsStore = () => store_get(stakeoutsStore, "$stakeoutsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	async function removeStakeout(id) {
		if (!$stakeoutsStore()) return;
		const nextStakeouts = {
			...$stakeoutsStore(),
			list: ($stakeoutsStore().list ?? []).filter((e) => e.id !== id)
		};
		await ttStorage.set({ stakeouts: nextStakeouts });
	}
	function clampPercent(value) {
		if (!Number.isFinite(value)) return 0;
		return Math.max(0, Math.min(100, value));
	}
	function getStateClass(color) {
		if (color === "green") return "text-primary";
		if (color === "red") return "text-destructive";
		if (color === "blue") return "text-blue-500";
		return "text-foreground/80";
	}
	function getActivityClass(activity) {
		const normalized = activity.toLowerCase();
		if (normalized === "online") return "bg-primary";
		if (normalized === "idle") return "bg-amber-500";
		return "bg-muted-foreground";
	}
	var div = root$17();
	var div_1 = child(div);
	var a = child(div_1);
	var div_2 = child(a);
	var span = child(div_2);
	var span_1 = sibling(span, 2);
	var text = child(span_1, true);
	reset(span_1);
	var node = sibling(span_1, 2);
	var consequent = ($$anchor) => {
		var span_2 = root_1$8();
		var text_1 = child(span_2);
		reset(span_2);
		template_effect(() => set_text(text_1, `(${$$props.row.label ?? ""})`));
		append($$anchor, span_2);
	};
	if_block(node, ($$render) => {
		if ($$props.row.label) $$render(consequent);
	});
	reset(div_2);
	var div_3 = sibling(div_2, 2);
	var div_4 = sibling(child(div_3), 2);
	var div_5 = child(div_4);
	let styles;
	reset(div_4);
	var span_3 = sibling(div_4, 2);
	var text_2 = child(span_3);
	reset(span_3);
	reset(div_3);
	var div_6 = sibling(div_3, 2);
	var span_4 = child(div_6);
	var text_3 = child(span_4, true);
	reset(span_4);
	var span_5 = sibling(span_4, 2);
	var text_4 = child(span_5);
	reset(span_5);
	reset(div_6);
	reset(a);
	Button(sibling(a, 2), {
		variant: "ghost",
		size: "icon-xs",
		class: "text-destructive",
		onclick: () => removeStakeout($$props.row.id),
		"aria-label": "Remove stakeout",
		children: ($$anchor, $$slotProps) => {
			TrashIcon($$anchor, {});
		},
		$$slots: { default: true }
	});
	reset(div_1);
	reset(div);
	template_effect(($0, $1, $2) => {
		set_attribute(a, "href", `https://www.torn.com/profiles.php?XID=${$$props.row.id}`);
		set_class(span, 1, $0);
		set_text(text, $$props.row.name);
		styles = set_style(div_5, "", styles, $1);
		set_text(text_2, `${$$props.row.lifeCurrent ?? ""}/${$$props.row.lifeMaximum ?? ""}`);
		set_class(span_4, 1, $2);
		set_text(text_3, $$props.row.state);
		set_text(text_4, `Last action: ${$$props.row.lastAction ?? ""}`);
	}, [
		() => `size-2 shrink-0 rounded-full ${getActivityClass($$props.row.activity)}`,
		() => ({ width: `${clampPercent($$props.row.lifeCurrent / $$props.row.lifeMaximum * 100)}%` }),
		() => `truncate ${getStateClass($$props.row.stateColor)}`
	]);
	append($$anchor, div);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/popup/components/dashboard/Stakeouts.svelte
var root_5$5 = from_html(`<div class="space-y-1"></div>`);
var root_1$7 = from_html(`<section class="space-y-1"><div class="flex items-center justify-between"><a class="text-xs font-medium hover:underline" target="_blank" rel="noreferrer">Stakeouts</a> <!></div> <!></section>`);
function Stakeouts($$anchor, $$props) {
	push($$props, true);
	const $stakeoutsStore = () => store_get(stakeoutsStore, "$stakeoutsStore", $$stores);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let stakeoutsOpen = state(true);
	const stakeoutRows = user_derived(() => getStakeoutRows($stakeoutsStore(), $settingsStore()));
	const targetsUrl = user_derived(() => `${browser.runtime.getURL("/targets.html")}#/stakeouts`);
	function getStakeoutRows(source, settings) {
		if (!settings?.pages?.popup?.showStakeouts || !source?.list?.length) return [];
		return source.list.toSorted((a, b) => a.order - b.order).map((stakeout) => ({
			id: stakeout.id,
			name: stakeout.info?.name ?? String(stakeout.id),
			label: stakeout.label ?? "",
			activity: stakeout.info?.last_action?.status ?? "N/A",
			lastAction: stakeout.info?.last_action?.relative ?? "N/A",
			lifeCurrent: stakeout.info?.life?.current ?? 0,
			lifeMaximum: stakeout.info?.life?.maximum ?? 100,
			state: stakeout.info?.status?.description ?? "Unknown",
			stateColor: stakeout.info?.status?.color ?? "gray"
		}));
	}
	var fragment = comment();
	var node = first_child(fragment);
	var consequent_2 = ($$anchor) => {
		var section = root_1$7();
		var div = child(section);
		var a_1 = child(div);
		Button(sibling(a_1, 2), {
			variant: "ghost",
			size: "icon-xs",
			onclick: () => set(stakeoutsOpen, !get(stakeoutsOpen)),
			"aria-label": "Toggle stakeouts",
			children: ($$anchor, $$slotProps) => {
				var fragment_1 = comment();
				var node_2 = first_child(fragment_1);
				var consequent = ($$anchor) => {
					CaretDownIcon($$anchor, {});
				};
				var alternate = ($$anchor) => {
					CaretRightIcon($$anchor, {});
				};
				if_block(node_2, ($$render) => {
					if (get(stakeoutsOpen)) $$render(consequent);
					else $$render(alternate, -1);
				});
				append($$anchor, fragment_1);
			},
			$$slots: { default: true }
		});
		reset(div);
		var node_3 = sibling(div, 2);
		var consequent_1 = ($$anchor) => {
			var div_1 = root_5$5();
			each(div_1, 21, () => get(stakeoutRows), (row) => row.id, ($$anchor, row) => {
				StakeoutRow($$anchor, { get row() {
					return get(row);
				} });
			});
			reset(div_1);
			append($$anchor, div_1);
		};
		if_block(node_3, ($$render) => {
			if (get(stakeoutsOpen)) $$render(consequent_1);
		});
		reset(section);
		template_effect(() => set_attribute(a_1, "href", get(targetsUrl)));
		append($$anchor, section);
	};
	if_block(node, ($$render) => {
		if (get(stakeoutRows).length) $$render(consequent_2);
	});
	append($$anchor, fragment);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/popup/components/dashboard/Dashboard.svelte
var root$16 = from_html(`<div class="space-y-2"><!> <!> <!> <!> <!> <!></div>`);
function Dashboard($$anchor, $$props) {
	push($$props, true);
	let now = state(proxy(Date.now()));
	onMount(() => {
		const interval = window.setInterval(() => {
			set(now, Date.now(), true);
		}, 1e3);
		return () => window.clearInterval(interval);
	});
	var div = root$16();
	var node = child(div);
	Overview(node, { get now() {
		return get(now);
	} });
	var node_1 = sibling(node, 2);
	Bars(node_1, { get now() {
		return get(now);
	} });
	var node_2 = sibling(node_1, 2);
	Cooldowns(node_2, { get now() {
		return get(now);
	} });
	var node_3 = sibling(node_2, 2);
	ExtraInformation(node_3, { get now() {
		return get(now);
	} });
	var node_4 = sibling(node_3, 2);
	Stakeouts(node_4, {});
	FactionStakeouts(sibling(node_4, 2), {});
	reset(div);
	append($$anchor, div);
	pop();
}
//#endregion
//#region src/extension/entrypoints/popup/tabs.ts
var POPUP_TABS = [
	{
		key: "dashboard",
		label: "Dashboard",
		path: "/dashboard"
	},
	{
		key: "marketSearch",
		label: "Market",
		path: "/market"
	},
	{
		key: "calculator",
		label: "Calculator",
		path: "/calculator"
	},
	{
		key: "stocksOverview",
		label: "Stocks",
		path: "/stocks"
	},
	{
		key: "notifications",
		label: "Notifications",
		path: "/notifications"
	}
];
function getEnabledPopupTabs(settings) {
	if (!settings?.pages?.popup) return [];
	return POPUP_TABS.filter((tab) => settings.pages.popup[tab.key]);
}
function getStartupPath(settings, hasApiKey) {
	if (!hasApiKey) return "/initialize";
	const enabledTabs = getEnabledPopupTabs(settings);
	return enabledTabs.find((tab) => tab.key === settings?.pages?.popup?.defaultTab)?.path ?? enabledTabs[0]?.path ?? "/dashboard";
}
//#endregion
//#region src/extension/entrypoints/popup/components/GlobalLayout.svelte
var root_2$5 = from_html(`<div class="border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"> </div>`);
var root_5$4 = from_html(`<a class="rounded-sm px-1 py-0.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground whitespace-nowrap"> </a>`);
var root_3$6 = from_html(`<div class="border-b border-border p-1"><nav class="flex items-center gap-1 overflow-x-auto"><!> <!></nav></div>`);
var root_1$6 = from_html(`<div class="min-h-60 bg-background text-foreground"><!> <!> <main class="overflow-y-auto p-3"><!></main></div>`);
var root$15 = from_html(`<!> <!> <!>`, 1);
function GlobalLayout($$anchor, $$props) {
	push($$props, true);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const $apiStore = () => store_get(apiStore, "$apiStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let showNavigation = user_derived(() => router.location !== "/initialize");
	let enabledTabs = user_derived(() => getEnabledPopupTabs($settingsStore()));
	let popupWidth = state(432);
	onMount(() => {
		registerExtensionContext();
		exposeDebugObjects(BACKGROUND_SERVICE);
		set(popupWidth, Math.min(432, screen.availWidth), true);
		const unsubscribeTheme = settingsStore.subscribe((settings) => {
			const pageTheme = settings?.themes?.pages;
			if (!pageTheme) return;
			setMode(pageTheme === "default" ? "system" : pageTheme);
		});
		return () => {
			unsubscribeTheme();
		};
	});
	var fragment = root$15();
	var node = first_child(fragment);
	Mode_watcher(node, { track: false });
	var node_1 = sibling(node, 2);
	Sonner_1(node_1, { richColors: true });
	component(sibling(node_1, 2), () => Tooltip_provider, ($$anchor, Tooltip_Provider) => {
		Tooltip_Provider($$anchor, {
			children: ($$anchor, $$slotProps) => {
				var div = root_1$6();
				let styles;
				var node_3 = child(div);
				var consequent = ($$anchor) => {
					var div_1 = root_2$5();
					var text = child(div_1, true);
					reset(div_1);
					template_effect(() => set_text(text, $apiStore().torn.error));
					append($$anchor, div_1);
				};
				if_block(node_3, ($$render) => {
					if ($apiStore()?.torn?.error) $$render(consequent);
				});
				var node_4 = sibling(node_3, 2);
				var consequent_2 = ($$anchor) => {
					var div_2 = root_3$6();
					var nav = child(div_2);
					var node_5 = child(nav);
					var consequent_1 = ($$anchor) => {
						var fragment_1 = comment();
						each(first_child(fragment_1), 17, () => get(enabledTabs), (tab) => tab.path, ($$anchor, tab) => {
							var a = root_5$4();
							var text_1 = child(a, true);
							reset(a);
							action(a, ($$node) => link?.($$node));
							action(a, ($$node, $$action_arg) => active?.($$node, $$action_arg), () => ({
								path: get(tab).path,
								className: "bg-primary text-primary-foreground hover:bg-primary/90"
							}));
							template_effect(() => {
								set_attribute(a, "href", get(tab).path);
								set_text(text_1, get(tab).label);
							});
							append($$anchor, a);
						});
						append($$anchor, fragment_1);
					};
					if_block(node_5, ($$render) => {
						if ($apiStore()?.torn?.key) $$render(consequent_1);
					});
					Button(sibling(node_5, 2), {
						variant: "ghost",
						size: "sm",
						class: "ml-auto h-5 px-1 py-0.5 text-xs",
						onclick: () => browser.runtime.openOptionsPage(),
						children: ($$anchor, $$slotProps) => {
							next();
							append($$anchor, text("Settings"));
						},
						$$slots: { default: true }
					});
					reset(nav);
					reset(div_2);
					append($$anchor, div_2);
				};
				if_block(node_4, ($$render) => {
					if (get(showNavigation)) $$render(consequent_2);
				});
				var main = sibling(node_4, 2);
				snippet(child(main), () => $$props.children);
				reset(main);
				reset(div);
				template_effect(() => styles = set_style(div, "", styles, {
					width: `${get(popupWidth)}px`,
					"min-width": `${get(popupWidth)}px`
				}));
				append($$anchor, div);
			},
			$$slots: { default: true }
		});
	});
	append($$anchor, fragment);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/popup/components/initialize/Initialize.svelte
var root_3$5 = from_html(`Welcome to Torn<span class="text-primary">Tools</span>`, 1);
var root_5$3 = from_html(`<div class="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive"> </div>`);
var root_6$3 = from_html(`<div class="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300"> </div>`);
var root_4$4 = from_html(`<div class="space-y-1.5"><label for="api-key" class="text-xs font-medium">Please enter your API key:</label> <!></div> <!> <!> <div class="flex gap-2"><!> <!></div> <div class="text-xs text-muted-foreground">TornTools needs a <span class="text-amber-600 dark:text-amber-300">Limited Access</span> key.</div> <!> <a class="block text-xs text-muted-foreground hover:text-foreground" target="_blank" rel="noreferrer">Terms of Service</a>`, 1);
var root_1$5 = from_html(`<!> <!>`, 1);
function Initialize($$anchor, $$props) {
	push($$props, true);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let apiKey = state("");
	let error = state("");
	let permissionError = state("");
	let saving = state(false);
	async function setApiKey() {
		set(error, "");
		set(permissionError, "");
		set(saving, true);
		try {
			const { access } = await checkAPIPermission(get(apiKey).trim());
			if (!access) {
				set(permissionError, "TornTools needs a Limited Access key. This key does not have the correct API level.");
				setTimeout(() => {
					set(permissionError, "");
				}, 10 * TO_MILLIS.SECONDS);
				return;
			}
			await changeAPIKey(get(apiKey).trim());
			while (!(await loadDatabase(true)).userdata.timestamp) await sleep(TO_MILLIS.SECONDS);
			await replace(getStartupPath($settingsStore(), true));
		} catch (caughtError) {
			set(error, caughtError?.error ?? caughtError.message ?? "Unable to save API key.", true);
		} finally {
			set(saving, false);
		}
	}
	function openApiPage() {
		browser.tabs.update({ url: "https://www.torn.com/preferences.php#tab=api" });
	}
	function openImport() {
		window.open(browser.runtime.getURL("/options.html#/export"));
	}
	Card($$anchor, {
		size: "sm",
		class: "rounded-lg",
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = root_1$5();
			var node = first_child(fragment_1);
			Card_header(node, {
				class: "px-4",
				children: ($$anchor, $$slotProps) => {
					Card_title($$anchor, {
						class: "text-base",
						children: ($$anchor, $$slotProps) => {
							next();
							var fragment_3 = root_3$5();
							next();
							append($$anchor, fragment_3);
						},
						$$slots: { default: true }
					});
				},
				$$slots: { default: true }
			});
			Card_content(sibling(node, 2), {
				class: "space-y-3 px-4",
				children: ($$anchor, $$slotProps) => {
					var fragment_4 = root_4$4();
					var div = first_child(fragment_4);
					Input(sibling(child(div), 2), {
						id: "api-key",
						type: "text",
						autocomplete: "off",
						onkeydown: (event) => event.key === "Enter" && void setApiKey(),
						get value() {
							return get(apiKey);
						},
						set value($$value) {
							set(apiKey, $$value, true);
						}
					});
					reset(div);
					var node_3 = sibling(div, 2);
					var consequent = ($$anchor) => {
						var div_1 = root_5$3();
						var text = child(div_1, true);
						reset(div_1);
						template_effect(() => set_text(text, get(error)));
						append($$anchor, div_1);
					};
					if_block(node_3, ($$render) => {
						if (get(error)) $$render(consequent);
					});
					var node_4 = sibling(node_3, 2);
					var consequent_1 = ($$anchor) => {
						var div_2 = root_6$3();
						var text_1 = child(div_2, true);
						reset(div_2);
						template_effect(() => set_text(text_1, get(permissionError)));
						append($$anchor, div_2);
					};
					if_block(node_4, ($$render) => {
						if (get(permissionError)) $$render(consequent_1);
					});
					var div_3 = sibling(node_4, 2);
					var node_5 = child(div_3);
					{
						let $0 = user_derived(() => get(saving) || !get(apiKey).trim());
						Button(node_5, {
							size: "sm",
							class: "h-8 flex-1",
							onclick: setApiKey,
							get disabled() {
								return get($0);
							},
							children: ($$anchor, $$slotProps) => {
								next();
								var text_2 = text();
								template_effect(() => set_text(text_2, get(saving) ? "Setting..." : "Set"));
								append($$anchor, text_2);
							},
							$$slots: { default: true }
						});
					}
					Button(sibling(node_5, 2), {
						size: "sm",
						variant: "secondary",
						class: "h-8 flex-1",
						onclick: openApiPage,
						children: ($$anchor, $$slotProps) => {
							next();
							append($$anchor, text("Key page"));
						},
						$$slots: { default: true }
					});
					reset(div_3);
					var node_7 = sibling(div_3, 4);
					Button(node_7, {
						size: "sm",
						variant: "outline",
						class: "h-8 w-full",
						onclick: openImport,
						children: ($$anchor, $$slotProps) => {
							next();
							append($$anchor, text("Import previous settings"));
						},
						$$slots: { default: true }
					});
					var a = sibling(node_7, 2);
					template_effect(($0) => set_attribute(a, "href", $0), [() => browser.runtime.getURL("/tos.html")]);
					append($$anchor, fragment_4);
				},
				$$slots: { default: true }
			});
			append($$anchor, fragment_1);
		},
		$$slots: { default: true }
	});
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/popup/components/market/ItemSearch.svelte
var root_7$3 = from_html(`<span> </span> <!>`, 1);
var root_3$4 = from_html(`<!> <!>`, 1);
var root_1$4 = from_html(`<!> <!>`, 1);
function ItemSearch($$anchor, $$props) {
	push($$props, true);
	const $torndataStore = () => store_get(torndataStore, "$torndataStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let selectedItem = prop($$props, "selectedItem", 15, null);
	let search = state("");
	const items = user_derived(() => $torndataStore()?.items ?? []);
	const matches = user_derived(() => getMatches(get(items), get(search)));
	const listOpen = user_derived(() => !!get(search).trim());
	function getMatches(sourceItems, keyword) {
		const normalized = keyword.trim().toLowerCase();
		if (!normalized) return [];
		const id = Number.parseInt(normalized, 10);
		return sourceItems.filter((item) => item.name.toLowerCase().includes(normalized) || !Number.isNaN(id) && item.id === id).slice(0, 30);
	}
	function selectItem(item) {
		selectedItem(item);
		set(search, "");
	}
	var fragment = comment();
	component(first_child(fragment), () => Command, ($$anchor, Command_Root) => {
		Command_Root($$anchor, {
			shouldFilter: false,
			class: "relative h-auto overflow-visible rounded-md bg-transparent p-0",
			children: ($$anchor, $$slotProps) => {
				var fragment_1 = root_1$4();
				var node_1 = first_child(fragment_1);
				component(node_1, () => Command_input, ($$anchor, Command_Input) => {
					Command_Input($$anchor, {
						placeholder: "Search item...",
						onkeydown: (event) => {
							if (event.key === "Enter" && get(matches)[0]) selectItem(get(matches)[0]);
						},
						get value() {
							return get(search);
						},
						set value($$value) {
							set(search, $$value, true);
						}
					});
				});
				var node_2 = sibling(node_1, 2);
				var consequent = ($$anchor) => {
					var fragment_2 = comment();
					var node_3 = first_child(fragment_2);
					{
						let $0 = user_derived(() => cn("mt-1 max-h-42 w-full rounded-md bg-popover p-1", selectedItem() && "absolute top-full z-10"));
						component(node_3, () => Command_list, ($$anchor, Command_List) => {
							Command_List($$anchor, {
								get class() {
									return get($0);
								},
								children: ($$anchor, $$slotProps) => {
									var fragment_3 = root_3$4();
									var node_4 = first_child(fragment_3);
									component(node_4, () => Command_empty, ($$anchor, Command_Empty) => {
										Command_Empty($$anchor, {
											class: "p-2",
											children: ($$anchor, $$slotProps) => {
												next();
												append($$anchor, text("No items found."));
											},
											$$slots: { default: true }
										});
									});
									component(sibling(node_4, 2), () => Command_group, ($$anchor, Command_Group) => {
										Command_Group($$anchor, {
											class: "p-0",
											children: ($$anchor, $$slotProps) => {
												var fragment_4 = comment();
												each(first_child(fragment_4), 17, () => get(matches), (item) => item.id, ($$anchor, item) => {
													var fragment_5 = comment();
													var node_7 = first_child(fragment_5);
													{
														let $0 = user_derived(() => `${get(item).id}-${get(item).name}`);
														component(node_7, () => Command_item, ($$anchor, Command_Item) => {
															Command_Item($$anchor, {
																get value() {
																	return get($0);
																},
																onSelect: () => selectItem(get(item)),
																children: ($$anchor, $$slotProps) => {
																	var fragment_6 = root_7$3();
																	var span = first_child(fragment_6);
																	var text_1 = child(span, true);
																	reset(span);
																	component(sibling(span, 2), () => Command_shortcut, ($$anchor, Command_Shortcut) => {
																		Command_Shortcut($$anchor, {
																			children: ($$anchor, $$slotProps) => {
																				next();
																				var text_2 = text();
																				template_effect(() => set_text(text_2, `#${get(item).id ?? ""}`));
																				append($$anchor, text_2);
																			},
																			$$slots: { default: true }
																		});
																	});
																	template_effect(() => set_text(text_1, get(item).name));
																	append($$anchor, fragment_6);
																},
																$$slots: { default: true }
															});
														});
													}
													append($$anchor, fragment_5);
												});
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
					}
					append($$anchor, fragment_2);
				};
				if_block(node_2, ($$render) => {
					if (get(listOpen)) $$render(consequent);
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
//#region src/extension/entrypoints/popup/components/market/MarketPrice.svelte
var root_4$3 = from_html(`<!> <!>`, 1);
var root$14 = from_html(`<section class="space-y-1"><h2 class="text-xs font-bold"> </h2> <!></section>`);
function MarketPrice($$anchor, $$props) {
	push($$props, true);
	var section = root$14();
	var h2 = child(section);
	var text$6 = child(h2, true);
	reset(h2);
	component(sibling(h2, 2), () => Table, ($$anchor, Table_Root) => {
		Table_Root($$anchor, {
			children: ($$anchor, $$slotProps) => {
				var fragment = comment();
				component(first_child(fragment), () => Table_body, ($$anchor, Table_Body) => {
					Table_Body($$anchor, {
						children: ($$anchor, $$slotProps) => {
							var fragment_1 = comment();
							each(first_child(fragment_1), 17, () => $$props.listings, index, ($$anchor, listing) => {
								var fragment_2 = comment();
								component(first_child(fragment_2), () => Table_row, ($$anchor, Table_Row) => {
									Table_Row($$anchor, {
										children: ($$anchor, $$slotProps) => {
											var fragment_3 = root_4$3();
											var node_4 = first_child(fragment_3);
											component(node_4, () => Table_cell, ($$anchor, Table_Cell) => {
												Table_Cell($$anchor, {
													class: "p-1",
													children: ($$anchor, $$slotProps) => {
														next();
														var text_1 = text();
														template_effect(($0) => set_text(text_1, `${$0 ?? ""}x`), [() => formatNumber(get(listing).amount)]);
														append($$anchor, text_1);
													},
													$$slots: { default: true }
												});
											});
											component(sibling(node_4, 2), () => Table_cell, ($$anchor, Table_Cell_1) => {
												Table_Cell_1($$anchor, {
													class: "p-1 text-right font-medium",
													children: ($$anchor, $$slotProps) => {
														next();
														var text_2 = text();
														template_effect(($0) => set_text(text_2, $0), [() => formatNumber(get(listing).price, { currency: true })]);
														append($$anchor, text_2);
													},
													$$slots: { default: true }
												});
											});
											append($$anchor, fragment_3);
										},
										$$slots: { default: true }
									});
								});
								append($$anchor, fragment_2);
							}, ($$anchor) => {
								var fragment_6 = comment();
								component(first_child(fragment_6), () => Table_row, ($$anchor, Table_Row_1) => {
									Table_Row_1($$anchor, {
										children: ($$anchor, $$slotProps) => {
											var fragment_7 = comment();
											component(first_child(fragment_7), () => Table_cell, ($$anchor, Table_Cell_2) => {
												Table_Cell_2($$anchor, {
													colspan: 2,
													class: "p-1 text-center text-muted-foreground",
													children: ($$anchor, $$slotProps) => {
														next();
														append($$anchor, text("No listings found."));
													},
													$$slots: { default: true }
												});
											});
											append($$anchor, fragment_7);
										},
										$$slots: { default: true }
									});
								});
								append($$anchor, fragment_6);
							});
							append($$anchor, fragment_1);
						},
						$$slots: { default: true }
					});
				});
				append($$anchor, fragment);
			},
			$$slots: { default: true }
		});
	});
	reset(section);
	template_effect(() => set_text(text$6, $$props.title));
	append($$anchor, section);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/alert/helper.ts
var alertVariants = tv({
	base: "grid gap-0.5 rounded-lg border px-2.5 py-2 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4 group/alert relative w-full",
	variants: { variant: {
		default: "bg-card text-card-foreground",
		destructive: "text-destructive bg-card *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current"
	} },
	defaultVariants: { variant: "default" }
});
//#endregion
//#region src/extension/svelte/components/ui/alert/alert.svelte
var root$13 = from_html(`<div><!></div>`);
function Alert($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), variant = prop($$props, "variant", 3, "default"), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"variant",
		"children"
	]);
	var div = root$13();
	attribute_effect(div, ($0) => ({
		"data-slot": "alert",
		role: "alert",
		class: $0,
		...restProps
	}), [() => cn(alertVariants({ variant: variant() }), $$props.class)]);
	snippet(child(div), () => $$props.children ?? noop);
	reset(div);
	bind_this(div, ($$value) => ref($$value), () => ref());
	append($$anchor, div);
	pop();
}
from_html(`<div><!></div>`);
//#endregion
//#region src/extension/svelte/components/ui/alert/alert-description.svelte
var root$11 = from_html(`<div><!></div>`);
function Alert_description($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"children"
	]);
	var div = root$11();
	attribute_effect(div, ($0) => ({
		"data-slot": "alert-description",
		class: $0,
		...restProps
	}), [() => cn("text-muted-foreground text-sm text-balance md:text-pretty [&_p:not(:last-child)]:mb-4 [&_a]:hover:text-foreground [&_a]:underline [&_a]:underline-offset-3", $$props.class)]);
	snippet(child(div), () => $$props.children ?? noop);
	reset(div);
	bind_this(div, ($$value) => ref($$value), () => ref());
	append($$anchor, div);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/alert/alert-title.svelte
var root$10 = from_html(`<div><!></div>`);
function Alert_title($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"children"
	]);
	var div = root$10();
	attribute_effect(div, ($0) => ({
		"data-slot": "alert-title",
		class: $0,
		...restProps
	}), [() => cn("font-heading font-medium group-has-[>svg]/alert:col-start-2 [&_a]:hover:text-foreground [&_a]:underline [&_a]:underline-offset-3", $$props.class)]);
	snippet(child(div), () => $$props.children ?? noop);
	reset(div);
	bind_this(div, ($$value) => ref($$value), () => ref());
	append($$anchor, div);
	pop();
}
//#endregion
//#region src/extension/entrypoints/popup/components/market/SearchResult.svelte
var root_2$4 = from_html(`<!> <!>`, 1);
var root_8$1 = from_html(`<a class="hover:underline" target="_blank" rel="noreferrer"> </a>`);
var root_9$1 = from_html(`<!> <!> <!>`, 1);
var root_7$2 = from_html(`<img class="size-16 rounded-md border border-border object-contain"/> <div class="min-w-0 space-y-1"><!> <!> <div class="grid grid-cols-2 gap-2 pt-1 text-xs"><div><div class="text-muted-foreground">Circulation</div> <div> </div></div> <div><div class="text-muted-foreground">Market value</div> <div> </div></div></div></div>`, 1);
var root_16 = from_html(`<!> <!>`, 1);
var root_19 = from_html(`<div class="flex items-center gap-2 py-2 text-muted-foreground"><!> <span>Loading prices...</span></div>`);
var root_20 = from_html(`<div><!> <!></div>`);
var root_14 = from_html(`<!> <!>`, 1);
var root_6$2 = from_html(`<!> <!>`, 1);
var root$9 = from_html(`<!> <!>`, 1);
function SearchResult($$anchor, $$props) {
	push($$props, true);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let loading = state(false);
	let error = state("");
	let itemMarket = state(null);
	let tornW3bMarket = state(null);
	const tornListings = user_derived(() => get(itemMarket)?.itemmarket.listings ?? []);
	const tornW3bListings = user_derived(() => (get(tornW3bMarket)?.listings ?? []).slice(0, 3));
	const showExternalMarket = user_derived(() => !!$settingsStore()?.pages?.popup?.bazaarUsingExternal && !!$settingsStore()?.external?.tornw3b);
	user_effect(() => {
		set(error, "");
		set(itemMarket, null);
		set(tornW3bMarket, null);
		if (!$$props.selectedItem || !isSellable($$props.selectedItem.id)) return;
		set(loading, true);
		Promise.all([loadTornMarket($$props.selectedItem.id), get(showExternalMarket) ? loadTornW3bMarket($$props.selectedItem.id) : Promise.resolve({ listings: [] })]).then(([tornResult, tornW3bResult]) => {
			set(itemMarket, tornResult, true);
			set(tornW3bMarket, tornW3bResult, true);
		}).catch((err) => {
			set(error, err.message ?? "Unable to load market prices.", true);
		}).finally(() => {
			set(loading, false);
		});
	});
	async function loadTornMarket(itemId) {
		if (ttCache.hasValue("livePrice", itemId)) return ttCache.get("livePrice", itemId);
		const result = await fetchData("tornv2", {
			section: "market",
			id: itemId,
			selections: ["itemmarket"],
			params: { limit: 3 }
		});
		ttCache.set({ [itemId]: result }, TO_MILLIS.SECONDS * 30, "livePrice");
		return result;
	}
	async function loadTornW3bMarket(itemId) {
		if (ttCache.hasValue("tornw3bPrice", itemId)) return ttCache.get("tornw3bPrice", itemId);
		const result = await fetchData("tornw3b", { section: `marketplace/${itemId}` });
		ttCache.set({ [itemId]: result }, TO_MILLIS.SECONDS * 60, "tornw3bPrice");
		return result;
	}
	var fragment = root$9();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		Alert($$anchor, {
			variant: "destructive",
			children: ($$anchor, $$slotProps) => {
				var fragment_2 = root_2$4();
				var node_1 = first_child(fragment_2);
				Alert_title(node_1, {
					children: ($$anchor, $$slotProps) => {
						next();
						append($$anchor, text("Market lookup failed"));
					},
					$$slots: { default: true }
				});
				Alert_description(sibling(node_1, 2), {
					children: ($$anchor, $$slotProps) => {
						next();
						var text_1 = text();
						template_effect(() => set_text(text_1, get(error)));
						append($$anchor, text_1);
					},
					$$slots: { default: true }
				});
				append($$anchor, fragment_2);
			},
			$$slots: { default: true }
		});
	};
	if_block(node, ($$render) => {
		if (get(error)) $$render(consequent);
	});
	var node_3 = sibling(node, 2);
	var consequent_6 = ($$anchor) => {
		Card($$anchor, {
			size: "sm",
			class: "rounded-lg mx-1",
			children: ($$anchor, $$slotProps) => {
				var fragment_5 = root_6$2();
				var node_4 = first_child(fragment_5);
				Card_header(node_4, {
					class: "grid-cols-[4rem_1fr] gap-x-2",
					children: ($$anchor, $$slotProps) => {
						var fragment_6 = root_7$2();
						var img = first_child(fragment_6);
						var div = sibling(img, 2);
						var node_5 = child(div);
						Card_title(node_5, {
							children: ($$anchor, $$slotProps) => {
								var a = root_8$1();
								var text_2 = child(a, true);
								reset(a);
								template_effect(() => {
									set_attribute(a, "href", `https://www.torn.com/page.php?sid=ItemMarket#/market/view=search&itemID=${$$props.selectedItem.id}&itemName=${$$props.selectedItem.name}&itemType=${$$props.selectedItem.type}`);
									set_text(text_2, $$props.selectedItem.name);
								});
								append($$anchor, a);
							},
							$$slots: { default: true }
						});
						var node_6 = sibling(node_5, 2);
						Card_description(node_6, {
							class: "flex flex-wrap gap-1",
							children: ($$anchor, $$slotProps) => {
								var fragment_7 = root_9$1();
								var node_7 = first_child(fragment_7);
								Badge(node_7, {
									variant: "outline",
									children: ($$anchor, $$slotProps) => {
										next();
										var text_3 = text();
										template_effect(() => set_text(text_3, `#${$$props.selectedItem.id ?? ""}`));
										append($$anchor, text_3);
									},
									$$slots: { default: true }
								});
								var node_8 = sibling(node_7, 2);
								Badge(node_8, {
									variant: "secondary",
									children: ($$anchor, $$slotProps) => {
										next();
										var text_4 = text();
										template_effect(() => set_text(text_4, $$props.selectedItem.type));
										append($$anchor, text_4);
									},
									$$slots: { default: true }
								});
								var node_9 = sibling(node_8, 2);
								var consequent_1 = ($$anchor) => {
									Badge($$anchor, {
										variant: "secondary",
										children: ($$anchor, $$slotProps) => {
											next();
											var text_5 = text();
											template_effect(() => set_text(text_5, $$props.selectedItem.sub_type));
											append($$anchor, text_5);
										},
										$$slots: { default: true }
									});
								};
								if_block(node_9, ($$render) => {
									if ($$props.selectedItem.sub_type) $$render(consequent_1);
								});
								append($$anchor, fragment_7);
							},
							$$slots: { default: true }
						});
						var div_1 = sibling(node_6, 2);
						var div_2 = child(div_1);
						var div_3 = sibling(child(div_2), 2);
						var text_6 = child(div_3, true);
						reset(div_3);
						reset(div_2);
						var div_4 = sibling(div_2, 2);
						var div_5 = sibling(child(div_4), 2);
						var text_7 = child(div_5, true);
						reset(div_5);
						reset(div_4);
						reset(div_1);
						reset(div);
						template_effect(($0, $1) => {
							set_attribute(img, "src", $$props.selectedItem.image);
							set_attribute(img, "alt", $$props.selectedItem.name);
							set_text(text_6, $0);
							set_text(text_7, $1);
						}, [() => formatNumber($$props.selectedItem.circulation), () => formatNumber($$props.selectedItem.value.market_price, { currency: true })]);
						append($$anchor, fragment_6);
					},
					$$slots: { default: true }
				});
				Card_content(sibling(node_4, 2), {
					class: "space-y-3 px-3 text-xs",
					children: ($$anchor, $$slotProps) => {
						var fragment_12 = root_14();
						var node_11 = first_child(fragment_12);
						Separator(node_11, {});
						var node_12 = sibling(node_11, 2);
						var consequent_2 = ($$anchor) => {
							Alert($$anchor, {
								variant: "destructive",
								children: ($$anchor, $$slotProps) => {
									var fragment_14 = root_16();
									var node_13 = first_child(fragment_14);
									Alert_title(node_13, {
										children: ($$anchor, $$slotProps) => {
											next();
											append($$anchor, text("Not sellable"));
										},
										$$slots: { default: true }
									});
									Alert_description(sibling(node_13, 2), {
										children: ($$anchor, $$slotProps) => {
											next();
											append($$anchor, text("This item cannot be sold."));
										},
										$$slots: { default: true }
									});
									append($$anchor, fragment_14);
								},
								$$slots: { default: true }
							});
						};
						var d = user_derived(() => !isSellable($$props.selectedItem.id));
						var consequent_3 = ($$anchor) => {
							var div_6 = root_19();
							Spinner(child(div_6), { class: "size-4" });
							next(2);
							reset(div_6);
							append($$anchor, div_6);
						};
						var consequent_5 = ($$anchor) => {
							var div_7 = root_20();
							var node_16 = child(div_7);
							{
								let $0 = user_derived(() => get(tornListings).map((listing) => ({
									amount: listing.amount,
									price: listing.price
								})));
								MarketPrice(node_16, {
									title: "Item Market",
									get listings() {
										return get($0);
									}
								});
							}
							var node_17 = sibling(node_16, 2);
							var consequent_4 = ($$anchor) => {
								{
									let $0 = user_derived(() => get(tornW3bListings).map((listing) => ({
										amount: listing.quantity,
										price: listing.price
									})));
									MarketPrice($$anchor, {
										title: "TornW3B Bazaars",
										get listings() {
											return get($0);
										}
									});
								}
							};
							if_block(node_17, ($$render) => {
								if (get(showExternalMarket)) $$render(consequent_4);
							});
							reset(div_7);
							template_effect(($0) => set_class(div_7, 1, $0), [() => clsx(cn("grid gap-2", { "grid-cols-2": get(showExternalMarket) }))]);
							append($$anchor, div_7);
						};
						if_block(node_12, ($$render) => {
							if (get(d)) $$render(consequent_2);
							else if (get(loading)) $$render(consequent_3, 1);
							else if (get(itemMarket)) $$render(consequent_5, 2);
						});
						append($$anchor, fragment_12);
					},
					$$slots: { default: true }
				});
				append($$anchor, fragment_5);
			},
			$$slots: { default: true }
		});
	};
	if_block(node_3, ($$render) => {
		if ($$props.selectedItem) $$render(consequent_6);
	});
	append($$anchor, fragment);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/popup/components/market/Market.svelte
var root$8 = from_html(`<div class="space-y-2"><!> <!></div>`);
function Market($$anchor) {
	let selectedItem = state(null);
	var div = root$8();
	var node = child(div);
	ItemSearch(node, {
		get selectedItem() {
			return get(selectedItem);
		},
		set selectedItem($$value) {
			set(selectedItem, $$value, true);
		}
	});
	SearchResult(sibling(node, 2), { get selectedItem() {
		return get(selectedItem);
	} });
	reset(div);
	append($$anchor, div);
}
//#endregion
//#region src/extension/entrypoints/popup/components/notifications/Notification.svelte
var root_2$3 = from_html(`<a target="_blank" rel="noreferrer"><div class="flex justify-between"><span class="text-foreground font-bold"> </span> <span class="text-muted-foreground"><!></span></div> <div class="text-muted-foreground"> </div></a>`);
function Notification($$anchor, $$props) {
	push($$props, true);
	const displayTitle = user_derived(() => $$props.notification.title.replace("TornTools - ", ""));
	Card($$anchor, {
		size: "sm",
		class: "py-2!",
		children: ($$anchor, $$slotProps) => {
			Card_content($$anchor, {
				class: "text-xs px-2!",
				children: ($$anchor, $$slotProps) => {
					var a = root_2$3();
					var div = child(a);
					var span = child(div);
					var text$4 = child(span, true);
					reset(span);
					var span_1 = sibling(span, 2);
					var node = child(span_1);
					var consequent = ($$anchor) => {
						var text_1 = text();
						template_effect(($0) => set_text(text_1, $0), [() => formatTime($$props.notification.date)]);
						append($$anchor, text_1);
					};
					var d = user_derived(() => isToday($$props.notification.date));
					var alternate = ($$anchor) => {
						var text_2 = text();
						template_effect(($0, $1) => set_text(text_2, `${$0 ?? ""} ${$1 ?? ""}`), [() => formatDate($$props.notification.date), () => formatTime($$props.notification.date)]);
						append($$anchor, text_2);
					};
					if_block(node, ($$render) => {
						if (get(d)) $$render(consequent);
						else $$render(alternate, -1);
					});
					reset(span_1);
					reset(div);
					var div_1 = sibling(div, 2);
					var text_3 = child(div_1, true);
					reset(div_1);
					reset(a);
					template_effect(() => {
						set_attribute(a, "href", $$props.notification.url);
						set_text(text$4, get(displayTitle));
						set_text(text_3, $$props.notification.message);
					});
					append($$anchor, a);
				},
				$$slots: { default: true }
			});
		},
		$$slots: { default: true }
	});
	pop();
}
//#endregion
//#region src/extension/entrypoints/popup/components/notifications/Notifications.svelte
var root_2$2 = from_html(`<div class="text-sm text-muted-foreground">No notification history.</div>`);
var root$7 = from_html(`<div class="space-y-2"></div>`);
function Notifications($$anchor, $$props) {
	push($$props, true);
	const $notificationHistoryStore = () => store_get(notificationHistoryStore, "$notificationHistoryStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const notifications = user_derived(() => ($notificationHistoryStore() ?? []).filter(isStoredNotification));
	function isStoredNotification(notification) {
		return !("combined" in notification);
	}
	var div = root$7();
	each(div, 21, () => get(notifications), index, ($$anchor, notification) => {
		Notification($$anchor, { get notification() {
			return get(notification);
		} });
	}, ($$anchor) => {
		append($$anchor, root_2$2());
	});
	reset(div);
	append($$anchor, div);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/popup/components/PopupRedirect.svelte
var root$6 = from_html(`<div class="p-3 text-sm text-muted-foreground">Loading...</div>`);
function PopupRedirect($$anchor, $$props) {
	push($$props, false);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const $apiStore = () => store_get(apiStore, "$apiStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	onMount(() => {
		replace(getStartupPath($settingsStore(), !!$apiStore()?.torn?.key));
	});
	init();
	append($$anchor, root$6());
	pop();
	$$cleanup();
}
//#endregion
//#region node_modules/phosphor-svelte/lib/MagnifyingGlassIcon.svelte
var root_2$1 = from_svg(`<path d="M232.49,215.51,185,168a92.12,92.12,0,1,0-17,17l47.53,47.54a12,12,0,0,0,17-17ZM44,112a68,68,0,1,1,68,68A68.07,68.07,0,0,1,44,112Z"></path>`);
var root_3$3 = from_svg(`<path d="M192,112a80,80,0,1,1-80-80A80,80,0,0,1,192,112Z" opacity="0.2"></path><path d="M229.66,218.34,179.6,168.28a88.21,88.21,0,1,0-11.32,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"></path>`, 1);
var root_4$2 = from_svg(`<path d="M168,112a56,56,0,1,1-56-56A56,56,0,0,1,168,112Zm61.66,117.66a8,8,0,0,1-11.32,0l-50.06-50.07a88,88,0,1,1,11.32-11.31l50.06,50.06A8,8,0,0,1,229.66,229.66ZM112,184a72,72,0,1,0-72-72A72.08,72.08,0,0,0,112,184Z"></path>`);
var root_5$2 = from_svg(`<path d="M228.24,219.76l-51.38-51.38a86.15,86.15,0,1,0-8.48,8.48l51.38,51.38a6,6,0,0,0,8.48-8.48ZM38,112a74,74,0,1,1,74,74A74.09,74.09,0,0,1,38,112Z"></path>`);
var root_6$1 = from_svg(`<path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"></path>`);
var root_7$1 = from_svg(`<path d="M226.83,221.17l-52.7-52.7a84.1,84.1,0,1,0-5.66,5.66l52.7,52.7a4,4,0,0,0,5.66-5.66ZM36,112a76,76,0,1,1,76,76A76.08,76.08,0,0,1,36,112Z"></path>`);
var root$5 = from_svg(`<svg><!><rect width="256" height="256" fill="none"></rect><!></svg>`);
function MagnifyingGlassIcon($$anchor, $$props) {
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
	var svg = root$5();
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
		var fragment_1 = root_3$3();
		next();
		append($$anchor, fragment_1);
	};
	var consequent_3 = ($$anchor) => {
		append($$anchor, root_4$2());
	};
	var consequent_4 = ($$anchor) => {
		append($$anchor, root_5$2());
	};
	var consequent_5 = ($$anchor) => {
		append($$anchor, root_6$1());
	};
	var consequent_6 = ($$anchor) => {
		append($$anchor, root_7$1());
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
//#region src/extension/entrypoints/popup/components/stocks/StockSearch.svelte
var root_1$3 = from_html(`<!> <!>`, 1);
var root$4 = from_html(`<div class="p-1 pb-0"><!></div>`);
function StockSearch($$anchor, $$props) {
	push($$props, true);
	let query = prop($$props, "query", 15, "");
	var div = root$4();
	component(child(div), () => Input_group, ($$anchor, InputGroup_Root) => {
		InputGroup_Root($$anchor, {
			class: "bg-input/30 border-input/30",
			children: ($$anchor, $$slotProps) => {
				var fragment = root_1$3();
				var node_1 = first_child(fragment);
				component(node_1, () => Input_group_input, ($$anchor, InputGroup_Input) => {
					InputGroup_Input($$anchor, {
						placeholder: "Search stocks...",
						class: "text-sm",
						get value() {
							return query();
						},
						set value($$value) {
							query($$value);
						}
					});
				});
				component(sibling(node_1, 2), () => Input_group_addon, ($$anchor, InputGroup_Addon) => {
					InputGroup_Addon($$anchor, {
						children: ($$anchor, $$slotProps) => {
							MagnifyingGlassIcon($$anchor, { class: "size-4 opacity-50" });
						},
						$$slots: { default: true }
					});
				});
				append($$anchor, fragment);
			},
			$$slots: { default: true }
		});
	});
	reset(div);
	append($$anchor, div);
	pop();
}
//#endregion
//#region src/extension/entrypoints/popup/components/stocks/RoiTable.svelte
var root_3$2 = from_html(`<!> <!> <!> <!> <!>`, 1);
var root_11$1 = from_html(`<!> <!> <!> <!> <!>`, 1);
var root_1$2 = from_html(`<!> <!>`, 1);
function RoiTable($$anchor, $$props) {
	push($$props, true);
	const ownedLevel = user_derived(() => $$props.userStock ? getStockIncrement($$props.stock.benefit.requirement, $$props.userStock.shares) : 0);
	const activeLevel = user_derived(() => $$props.userStock?.bonus?.increment ?? 0);
	const rewardValue = user_derived(() => getRewardValue($$props.stock.benefit.description));
	const yearlyValue = user_derived(() => get(rewardValue) / $$props.stock.benefit.frequency * 365);
	Table($$anchor, {
		class: "text-xs leading-tight",
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = root_1$2();
			var node = first_child(fragment_1);
			Table_header(node, {
				children: ($$anchor, $$slotProps) => {
					Table_row($$anchor, {
						children: ($$anchor, $$slotProps) => {
							var fragment_3 = root_3$2();
							var node_1 = first_child(fragment_3);
							Table_head(node_1, {
								class: "h-5 p-1",
								children: ($$anchor, $$slotProps) => {
									next();
									append($$anchor, text("Incr."));
								},
								$$slots: { default: true }
							});
							var node_2 = sibling(node_1, 2);
							Table_head(node_2, {
								class: "h-5 p-1",
								children: ($$anchor, $$slotProps) => {
									next();
									append($$anchor, text("Stocks"));
								},
								$$slots: { default: true }
							});
							var node_3 = sibling(node_2, 2);
							Table_head(node_3, {
								class: "h-5 p-1",
								children: ($$anchor, $$slotProps) => {
									next();
									append($$anchor, text("Cost"));
								},
								$$slots: { default: true }
							});
							var node_4 = sibling(node_3, 2);
							Table_head(node_4, {
								class: "h-5 p-1",
								children: ($$anchor, $$slotProps) => {
									next();
									append($$anchor, text("Reward"));
								},
								$$slots: { default: true }
							});
							Table_head(sibling(node_4, 2), {
								class: "h-5 p-1",
								children: ($$anchor, $$slotProps) => {
									next();
									append($$anchor, text("ROI"));
								},
								$$slots: { default: true }
							});
							append($$anchor, fragment_3);
						},
						$$slots: { default: true }
					});
				},
				$$slots: { default: true }
			});
			Table_body(sibling(node, 2), {
				children: ($$anchor, $$slotProps) => {
					var fragment_4 = comment();
					each(first_child(fragment_4), 16, () => [
						1,
						2,
						3,
						4,
						5
					], (level) => level, ($$anchor, level) => {
						const stocks = user_derived(() => getRequiredStocks($$props.stock.benefit.requirement, level));
						const previousStocks = user_derived(() => getRequiredStocks($$props.stock.benefit.requirement, level - 1));
						const roi = user_derived(() => get(yearlyValue) / ((get(stocks) - get(previousStocks)) * $$props.stock.current_price) * 100);
						{
							let $0 = user_derived(() => level <= get(activeLevel) ? "text-primary" : level <= get(ownedLevel) ? "text-amber-600" : "");
							Table_row($$anchor, {
								get class() {
									return get($0);
								},
								children: ($$anchor, $$slotProps) => {
									var fragment_6 = root_11$1();
									var node_8 = first_child(fragment_6);
									Table_cell(node_8, {
										class: "p-1",
										children: ($$anchor, $$slotProps) => {
											next();
											var text_5 = text();
											template_effect(() => set_text(text_5, level));
											append($$anchor, text_5);
										},
										$$slots: { default: true }
									});
									var node_9 = sibling(node_8, 2);
									Table_cell(node_9, {
										class: "p-1",
										children: ($$anchor, $$slotProps) => {
											next();
											var text_6 = text();
											template_effect(($0) => set_text(text_6, $0), [() => formatNumber(get(stocks))]);
											append($$anchor, text_6);
										},
										$$slots: { default: true }
									});
									var node_10 = sibling(node_9, 2);
									Table_cell(node_10, {
										class: "p-1",
										children: ($$anchor, $$slotProps) => {
											next();
											var text_7 = text();
											template_effect(($0) => set_text(text_7, $0), [() => formatNumber(get(stocks) * $$props.stock.current_price, { currency: true })]);
											append($$anchor, text_7);
										},
										$$slots: { default: true }
									});
									var node_11 = sibling(node_10, 2);
									Table_cell(node_11, {
										class: "p-1",
										children: ($$anchor, $$slotProps) => {
											next();
											var text_8 = text();
											template_effect(($0) => set_text(text_8, $0), [() => getStockReward($$props.stock.benefit.description, level)]);
											append($$anchor, text_8);
										},
										$$slots: { default: true }
									});
									Table_cell(sibling(node_11, 2), {
										class: "p-1",
										children: ($$anchor, $$slotProps) => {
											next();
											var text_9 = text();
											template_effect(($0) => set_text(text_9, $0), [() => get(rewardValue) > 0 ? `${formatNumber(get(roi), { decimals: 1 })}%` : "N/A"]);
											append($$anchor, text_9);
										},
										$$slots: { default: true }
									});
									append($$anchor, fragment_6);
								},
								$$slots: { default: true }
							});
						}
					});
					append($$anchor, fragment_4);
				},
				$$slots: { default: true }
			});
			append($$anchor, fragment_1);
		},
		$$slots: { default: true }
	});
	pop();
}
//#endregion
//#region src/extension/entrypoints/popup/components/stocks/BenefitInformation.svelte
var root_1$1 = from_html(`<div><!></div> <!>`, 1);
var root_5$1 = from_html(`<span class="text-muted-foreground"> </span>`);
var root_4$1 = from_html(`<div> </div> <div><span> </span> <!></div>`, 1);
var root$3 = from_html(`<div class="space-y-1 rounded-md bg-muted p-2"><!></div>`);
function BenefitInformation($$anchor, $$props) {
	push($$props, true);
	function getNonDividendBenefitState(userStock, frequency) {
		if (userStock?.bonus?.increment) {
			if (userStock.bonus.available) return { status: "completed" };
			return {
				status: "awaiting",
				duration: `in ${userStock.bonus.progress}/${frequency} days.`
			};
		}
		return {
			status: "not-completed",
			duration: `after ${frequency} days.`
		};
	}
	function getDescriptionClass(status) {
		if (status === "completed") return "text-primary";
		else if (status === "awaiting") return "text-amber-600 dark:text-amber-400";
		else return "text-destructive";
	}
	const nonDividendBenefit = user_derived(() => getNonDividendBenefitState($$props.userStock, $$props.stock.benefit.frequency));
	const nonDividendDescriptionClass = user_derived(() => getDescriptionClass(get(nonDividendBenefit).status));
	var div = root$3();
	var node = child(div);
	var consequent_1 = ($$anchor) => {
		var fragment = root_1$1();
		var div_1 = first_child(fragment);
		var node_1 = child(div_1);
		var consequent = ($$anchor) => {
			var text$1 = text();
			template_effect(() => set_text(text$1, $$props.userStock.bonus.available ? "Ready now!" : `Available in ${$$props.stock.benefit.frequency - $$props.userStock.bonus.progress}/${$$props.stock.benefit.frequency} days.`));
			append($$anchor, text$1);
		};
		var alternate = ($$anchor) => {
			var text_1 = text();
			template_effect(() => set_text(text_1, `Available every ${$$props.stock.benefit.frequency ?? ""} days.`));
			append($$anchor, text_1);
		};
		if_block(node_1, ($$render) => {
			if ($$props.userStock?.bonus) $$render(consequent);
			else $$render(alternate, -1);
		});
		reset(div_1);
		RoiTable(sibling(div_1, 2), {
			get stock() {
				return $$props.stock;
			},
			get userStock() {
				return $$props.userStock;
			}
		});
		append($$anchor, fragment);
	};
	var d = user_derived(() => isDividendStock($$props.stock.stock_id));
	var alternate_1 = ($$anchor) => {
		var fragment_3 = root_4$1();
		var div_2 = first_child(fragment_3);
		var text_2 = child(div_2);
		reset(div_2);
		var div_3 = sibling(div_2, 2);
		var span = child(div_3);
		var text_3 = child(span, true);
		reset(span);
		var node_3 = sibling(span, 2);
		var consequent_2 = ($$anchor) => {
			var span_1 = root_5$1();
			var text_4 = child(span_1, true);
			reset(span_1);
			template_effect(() => set_text(text_4, get(nonDividendBenefit).duration));
			append($$anchor, span_1);
		};
		if_block(node_3, ($$render) => {
			if (get(nonDividendBenefit).duration) $$render(consequent_2);
		});
		reset(div_3);
		template_effect(($0, $1) => {
			set_text(text_2, `Required stocks: ${$0 ?? ""}${$1 ?? ""}`);
			set_class(span, 1, clsx(get(nonDividendDescriptionClass)));
			set_text(text_3, $$props.stock.benefit.description);
		}, [() => formatNumber($$props.userStock?.shares ?? $$props.stock.benefit.requirement), () => $$props.userStock ? `/${formatNumber($$props.stock.benefit.requirement)}` : ""]);
		append($$anchor, fragment_3);
	};
	if_block(node, ($$render) => {
		if (get(d)) $$render(consequent_1);
		else $$render(alternate_1, -1);
	});
	reset(div);
	append($$anchor, div);
	pop();
}
//#endregion
//#region src/extension/entrypoints/popup/components/stocks/StockSection.svelte
var root_1 = from_html(` <!>`, 1);
var root$2 = from_html(`<!> <!>`, 1);
function StockSection($$anchor, $$props) {
	let isOpen = state(false);
	var fragment = root$2();
	var node = first_child(fragment);
	Button(node, {
		variant: "ghost",
		size: "sm",
		class: "h-7 w-full justify-between px-2",
		onclick: () => set(isOpen, !get(isOpen)),
		children: ($$anchor, $$slotProps) => {
			next();
			var fragment_1 = root_1();
			var text = first_child(fragment_1);
			var node_1 = sibling(text);
			var consequent = ($$anchor) => {
				CaretDownIcon($$anchor, { size: 14 });
			};
			var alternate = ($$anchor) => {
				CaretRightIcon($$anchor, { size: 14 });
			};
			if_block(node_1, ($$render) => {
				if (get(isOpen)) $$render(consequent);
				else $$render(alternate, -1);
			});
			template_effect(() => set_text(text, `${$$props.label ?? ""} `));
			append($$anchor, fragment_1);
		},
		$$slots: { default: true }
	});
	var node_2 = sibling(node, 2);
	var consequent_1 = ($$anchor) => {
		var fragment_4 = comment();
		snippet(first_child(fragment_4), () => $$props.children);
		append($$anchor, fragment_4);
	};
	if_block(node_2, ($$render) => {
		if (get(isOpen)) $$render(consequent_1);
	});
	append($$anchor, fragment);
}
//#endregion
//#region src/extension/entrypoints/popup/components/stocks/StocksTable.svelte
var root_5 = from_html(`<span> </span>`);
var root_4 = from_html(`<a class="truncate text-foreground hover:underline" target="_blank" rel="noreferrer"> </a> <!>`, 1);
var root_6 = from_html(`<div class="text-xs text-muted-foreground"> </div>`);
var root_3$1 = from_html(`<!> <!>`, 1);
var root_9 = from_html(`<span> </span>`);
var root_8 = from_html(`<div class="grid grid-cols-2 gap-1 rounded-md bg-muted p-2"><span> </span> <span> </span> <!></div>`);
var root_11 = from_html(`<div class="grid grid-cols-[auto_1fr] items-center gap-2 rounded-md bg-muted p-2"><label>Price reaches</label> <!> <label>Price falls to</label> <!></div>`);
var root_7 = from_html(`<!> <!> <!>`, 1);
var root_2 = from_html(`<!> <!>`, 1);
var root_12 = from_html(`<div class="text-sm text-muted-foreground">No stocks found.</div>`);
var root$1 = from_html(`<div class="space-y-2 mx-1"></div>`);
function StocksTable($$anchor, $$props) {
	push($$props, true);
	const $stockdataStore = () => store_get(stockdataStore, "$stockdataStore", $$stores);
	const $userdataStore = () => store_get(userdataStore, "$userdataStore", $$stores);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const rows = user_derived(() => getRows($stockdataStore(), $userdataStore(), $settingsStore(), $$props.query));
	function getRows(stockdata, userdata, settings, search) {
		const keyword = search.trim().toLowerCase();
		return Object.entries(stockdata ?? {}).filter(([id]) => id !== "date").map(([id, stock]) => {
			if (typeof stock === "number") return null;
			const userStock = settings?.apiUsage?.user?.stocks ? (userdata?.stocks ?? []).find((entry) => entry.id === Number(id)) ?? null : null;
			return {
				id: Number(id),
				stock,
				userStock
			};
		}).filter((row) => !!row).filter((row) => {
			if (!keyword) return !!row.userStock;
			return keyword === "*" || `${row.stock.name} (${row.stock.acronym})`.toLowerCase().includes(keyword);
		});
	}
	async function setAlert(stockId, key, value) {
		await ttStorage.change({ settings: { notifications: { types: { stocks: { [stockId]: { [key]: value ? Number.parseFloat(value) : 0 } } } } } });
	}
	function getProfit(stock, userStock) {
		if (!userStock) return null;
		const boughtPrice = getStockBoughtPrice(userStock).boughtPrice;
		return {
			boughtPrice,
			value: dropDecimals((stock.current_price - boughtPrice) * userStock.shares)
		};
	}
	var div = root$1();
	each(div, 21, () => get(rows), (row) => row.id, ($$anchor, row) => {
		const profit = user_derived(() => getProfit(get(row).stock, get(row).userStock));
		Card($$anchor, {
			size: "sm",
			class: "rounded-lg",
			children: ($$anchor, $$slotProps) => {
				var fragment_1 = root_2();
				var node = first_child(fragment_1);
				Card_header(node, {
					children: ($$anchor, $$slotProps) => {
						var fragment_2 = root_3$1();
						var node_1 = first_child(fragment_2);
						Card_title(node_1, {
							class: "flex items-start justify-between gap-2 text-sm",
							children: ($$anchor, $$slotProps) => {
								var fragment_3 = root_4();
								var a = first_child(fragment_3);
								var text = child(a, true);
								reset(a);
								var node_2 = sibling(a, 2);
								var consequent = ($$anchor) => {
									var span = root_5();
									var text_1 = child(span);
									reset(span);
									template_effect(($0) => {
										set_class(span, 1, clsx(get(profit).value > 0 ? "text-primary" : get(profit).value < 0 ? "text-destructive" : "text-muted-foreground"));
										set_text(text_1, `${get(profit).value > 0 ? "+" : get(profit).value < 0 ? "-" : ""}${$0 ?? ""}`);
									}, [() => formatNumber(Math.abs(get(profit).value), { currency: true })]);
									append($$anchor, span);
								};
								if_block(node_2, ($$render) => {
									if (get(profit)) $$render(consequent);
								});
								template_effect(() => {
									set_attribute(a, "href", `https://www.torn.com/stockexchange.php?stock=${get(row).stock.acronym}`);
									set_text(text, get(row).stock.name.length > 35 ? get(row).stock.acronym : get(row).stock.name);
								});
								append($$anchor, fragment_3);
							},
							$$slots: { default: true }
						});
						var node_3 = sibling(node_1, 2);
						var consequent_1 = ($$anchor) => {
							var div_1 = root_6();
							var text_2 = child(div_1);
							reset(div_1);
							template_effect(($0, $1) => set_text(text_2, `(${$0 ?? ""} share${$1 ?? ""})`), [() => formatNumber(get(row).userStock.shares, { shorten: 2 }), () => applyPlural(get(row).userStock.shares)]);
							append($$anchor, div_1);
						};
						if_block(node_3, ($$render) => {
							if (get(row).userStock) $$render(consequent_1);
						});
						append($$anchor, fragment_2);
					},
					$$slots: { default: true }
				});
				Card_content(sibling(node, 2), {
					class: "space-y-1 text-xs",
					children: ($$anchor, $$slotProps) => {
						var fragment_4 = root_7();
						var node_5 = first_child(fragment_4);
						StockSection(node_5, {
							label: "Price Information",
							children: ($$anchor, $$slotProps) => {
								var div_2 = root_8();
								var span_1 = child(div_2);
								var text_3 = child(span_1);
								reset(span_1);
								var span_2 = sibling(span_1, 2);
								var text_4 = child(span_2);
								reset(span_2);
								var node_6 = sibling(span_2, 2);
								var consequent_2 = ($$anchor) => {
									var span_3 = root_9();
									var text_5 = child(span_3);
									reset(span_3);
									template_effect(($0) => set_text(text_5, `Bought at: ${$0 ?? ""}`), [() => formatNumber(get(profit).boughtPrice, {
										decimals: 2,
										currency: true
									})]);
									append($$anchor, span_3);
								};
								if_block(node_6, ($$render) => {
									if (get(profit)) $$render(consequent_2);
								});
								reset(div_2);
								template_effect(($0, $1) => {
									set_text(text_3, `Current price: ${$0 ?? ""}`);
									set_text(text_4, `Total shares: ${$1 ?? ""}`);
								}, [() => formatNumber(get(row).stock.current_price, {
									decimals: 2,
									currency: true
								}), () => formatNumber(get(row).stock.total_shares)]);
								append($$anchor, div_2);
							},
							$$slots: { default: true }
						});
						var node_7 = sibling(node_5, 2);
						StockSection(node_7, {
							label: "Benefit Information",
							children: ($$anchor, $$slotProps) => {
								BenefitInformation($$anchor, {
									get stock() {
										return get(row).stock;
									},
									get userStock() {
										return get(row).userStock;
									}
								});
							},
							$$slots: { default: true }
						});
						StockSection(sibling(node_7, 2), {
							label: "Alerts",
							children: ($$anchor, $$slotProps) => {
								var div_3 = root_11();
								var label = child(div_3);
								var node_9 = sibling(label, 2);
								{
									let $0 = user_derived(() => `stock-${get(row).id}-reaches`);
									let $1 = user_derived(() => $settingsStore()?.notifications?.types?.stocks?.[get(row).id]?.priceReaches ?? "");
									Input(node_9, {
										get id() {
											return get($0);
										},
										type: "number",
										min: "0",
										class: "h-7",
										get value() {
											return get($1);
										},
										onchange: (event) => setAlert(get(row).id, "priceReaches", event.currentTarget.value)
									});
								}
								var label_1 = sibling(node_9, 2);
								var node_10 = sibling(label_1, 2);
								{
									let $0 = user_derived(() => `stock-${get(row).id}-falls`);
									let $1 = user_derived(() => $settingsStore()?.notifications?.types?.stocks?.[get(row).id]?.priceFalls ?? "");
									Input(node_10, {
										get id() {
											return get($0);
										},
										type: "number",
										min: "0",
										class: "h-7",
										get value() {
											return get($1);
										},
										onchange: (event) => setAlert(get(row).id, "priceFalls", event.currentTarget.value)
									});
								}
								reset(div_3);
								template_effect(() => {
									set_attribute(label, "for", `stock-${get(row).id}-reaches`);
									set_attribute(label_1, "for", `stock-${get(row).id}-falls`);
								});
								append($$anchor, div_3);
							},
							$$slots: { default: true }
						});
						append($$anchor, fragment_4);
					},
					$$slots: { default: true }
				});
				append($$anchor, fragment_1);
			},
			$$slots: { default: true }
		});
	}, ($$anchor) => {
		append($$anchor, root_12());
	});
	reset(div);
	append($$anchor, div);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/popup/components/stocks/Stocks.svelte
var root = from_html(`<div class="space-y-2"><!> <!></div>`);
function Stocks($$anchor) {
	let query = state("");
	var div = root();
	var node = child(div);
	StockSearch(node, {
		get query() {
			return get(query);
		},
		set query($$value) {
			set(query, $$value, true);
		}
	});
	StocksTable(sibling(node, 2), { get query() {
		return get(query);
	} });
	reset(div);
	append($$anchor, div);
}
//#endregion
//#region src/extension/entrypoints/popup/Popup.svelte
var root_3 = from_html(`<div class="text-sm text-muted-foreground">Loading...</div>`);
function Popup($$anchor, $$props) {
	push($$props, true);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const $apiStore = () => store_get(apiStore, "$apiStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const routes = {
		"/initialize": Initialize,
		"/dashboard": Dashboard,
		"/market": Market,
		"/calculator": Calculator,
		"/stocks": Stocks,
		"/notifications": Notifications,
		"*": PopupRedirect
	};
	let initialized = state(false);
	const startupPath = user_derived(() => {
		if (!$settingsStore() || !$apiStore()) return null;
		return getStartupPath($settingsStore(), !!$apiStore()?.torn?.key);
	});
	user_effect(() => {
		if (!get(startupPath) || get(initialized)) return;
		if (router.location !== get(startupPath)) replace(get(startupPath));
		set(initialized, true);
	});
	onMount(() => {
		initializeDatabaseStore();
	});
	GlobalLayout($$anchor, {
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = comment();
			var node = first_child(fragment_1);
			var consequent = ($$anchor) => {
				Router($$anchor, { get routes() {
					return routes;
				} });
			};
			var alternate = ($$anchor) => {
				append($$anchor, root_3());
			};
			if_block(node, ($$render) => {
				if (get(initialized)) $$render(consequent);
				else $$render(alternate, -1);
			});
			append($$anchor, fragment_1);
		},
		$$slots: { default: true }
	});
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/popup/popup.ts
mount(Popup, { target: document.getElementById("app") });
//#endregion

//# sourceMappingURL=popup-Dyu6fx8W.js.map