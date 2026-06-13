import { At as snippet, Bt as comment, Dn as noop, Dt as action, En as reset, Ft as if_block, Gt as delegate, Ht as from_svg, It as mount, Kt as delegated, Lt as set_text, Mt as each, Sn as push, St as set_attribute, Tn as next, Ut as props_id, Vt as from_html, Wt as text$1, Zt as get, _n as writable, _t as bind_this, a as BACKGROUND_SERVICE, an as child, c as cn, cn as proxy, dn as state, ft as onMount, gn as store_get, gt as init, hn as setup_stores, ht as spread_props, i as exposeDebugObjects, kt as component, mt as rest_props, n as setMode, on as first_child, p as initializeDatabase, pn as user_derived, pt as prop, rn as user_pre_effect, sn as sibling, t as Mode_watcher, tn as template_effect, un as set, ut as ttStorage, v as storageListeners, wt as set_class, xn as pop, xt as attribute_effect, zt as append } from "./dist-X5FUUfHt.js";
import "./browser-DV2XfOQj.js";
import { A as Escape_layer, Bt as formatDate, E as Scroll_lock, G as DialogContentState, Gt as Router, H as Dialog_title, Ht as formatTime, J as noop$1, K as DialogRootState, Kt as link, Mt as mergeProps, O as Text_selection_layer, Pt as boxWith, T as Dialog_overlay, Tt as afterSleep, U as AlertDialogCancelState, V as Portal, d as Badge, f as toast, g as buttonVariants, h as Button, i as active, j as Dismissible_layer, k as Focus_scope, l as Sonner_1, m as getIconContext, n as Input, o as Tooltip_provider, q as createId, qt as replace, r as registerExtensionContext, t as TrashIcon, v as Separator, w as Dialog_description } from "./TrashIcon-Do1I_oxJ.js";
import { n as Switch, r as Checkbox, t as PlusIcon } from "./PlusIcon-DGt_yeIS.js";
import { t as CaretDownIcon } from "./CaretDownIcon-BsYArTX4.js";
import { a as Table_body, i as Table_cell, n as Table_header, o as Table, r as Table_head, t as Table_row } from "./table-tdIg9jkX.js";
//#region node_modules/bits-ui/dist/bits/alert-dialog/components/alert-dialog.svelte
function Alert_dialog$1($$anchor, $$props) {
	push($$props, true);
	let open = prop($$props, "open", 15, false), onOpenChange = prop($$props, "onOpenChange", 3, noop$1), onOpenChangeComplete = prop($$props, "onOpenChangeComplete", 3, noop$1);
	DialogRootState.create({
		variant: boxWith(() => "alert-dialog"),
		open: boxWith(() => open(), (v) => {
			open(v);
			onOpenChange()(v);
		}),
		onOpenChangeComplete: boxWith(() => onOpenChangeComplete())
	});
	var fragment = comment();
	snippet(first_child(fragment), () => $$props.children ?? noop);
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/alert-dialog/components/alert-dialog-cancel.svelte
var root_2$2 = from_html(`<button><!></button>`);
function Alert_dialog_cancel$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), disabled = prop($$props, "disabled", 3, false), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"id",
		"ref",
		"children",
		"child",
		"disabled"
	]);
	const cancelState = AlertDialogCancelState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v)),
		disabled: boxWith(() => Boolean(disabled()))
	});
	const mergedProps = user_derived(() => mergeProps(restProps, cancelState.props));
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		var fragment_1 = comment();
		snippet(first_child(fragment_1), () => $$props.child, () => ({ props: get(mergedProps) }));
		append($$anchor, fragment_1);
	};
	var alternate = ($$anchor) => {
		var button = root_2$2();
		attribute_effect(button, () => ({ ...get(mergedProps) }));
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
//#region node_modules/bits-ui/dist/bits/alert-dialog/components/alert-dialog-content.svelte
var root_6$1 = from_html(`<!> <!>`, 1);
var root_8$1 = from_html(`<!> <div><!></div>`, 1);
function Alert_dialog_content$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), forceMount = prop($$props, "forceMount", 3, false), interactOutsideBehavior = prop($$props, "interactOutsideBehavior", 3, "ignore"), onCloseAutoFocus = prop($$props, "onCloseAutoFocus", 3, noop$1), onEscapeKeydown = prop($$props, "onEscapeKeydown", 3, noop$1), onOpenAutoFocus = prop($$props, "onOpenAutoFocus", 3, noop$1), onInteractOutside = prop($$props, "onInteractOutside", 3, noop$1), preventScroll = prop($$props, "preventScroll", 3, true), trapFocus = prop($$props, "trapFocus", 3, true), restoreScrollDelay = prop($$props, "restoreScrollDelay", 3, null), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"id",
		"children",
		"child",
		"ref",
		"forceMount",
		"interactOutsideBehavior",
		"onCloseAutoFocus",
		"onEscapeKeydown",
		"onOpenAutoFocus",
		"onInteractOutside",
		"preventScroll",
		"trapFocus",
		"restoreScrollDelay"
	]);
	const contentState = DialogContentState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v))
	});
	const mergedProps = user_derived(() => mergeProps(restProps, contentState.props));
	var fragment = comment();
	var node = first_child(fragment);
	var consequent_2 = ($$anchor) => {
		{
			const focusScope = ($$anchor, $$arg0) => {
				let focusScopeProps = () => $$arg0?.().props;
				Escape_layer($$anchor, spread_props(() => get(mergedProps), {
					get enabled() {
						return contentState.root.opts.open.current;
					},
					get ref() {
						return contentState.opts.ref;
					},
					onEscapeKeydown: (e) => {
						onEscapeKeydown()(e);
						if (e.defaultPrevented) return;
						contentState.root.handleClose();
					},
					children: ($$anchor, $$slotProps) => {
						Dismissible_layer($$anchor, spread_props(() => get(mergedProps), {
							get ref() {
								return contentState.opts.ref;
							},
							get enabled() {
								return contentState.root.opts.open.current;
							},
							get interactOutsideBehavior() {
								return interactOutsideBehavior();
							},
							onInteractOutside: (e) => {
								onInteractOutside()(e);
								if (e.defaultPrevented) return;
								contentState.root.handleClose();
							},
							children: ($$anchor, $$slotProps) => {
								Text_selection_layer($$anchor, spread_props(() => get(mergedProps), {
									get ref() {
										return contentState.opts.ref;
									},
									get enabled() {
										return contentState.root.opts.open.current;
									},
									children: ($$anchor, $$slotProps) => {
										var fragment_5 = comment();
										var node_1 = first_child(fragment_5);
										var consequent_1 = ($$anchor) => {
											var fragment_6 = root_6$1();
											var node_2 = first_child(fragment_6);
											var consequent = ($$anchor) => {
												Scroll_lock($$anchor, {
													get preventScroll() {
														return preventScroll();
													},
													get restoreScrollDelay() {
														return restoreScrollDelay();
													}
												});
											};
											if_block(node_2, ($$render) => {
												if (contentState.root.opts.open.current) $$render(consequent);
											});
											var node_3 = sibling(node_2, 2);
											{
												let $0 = user_derived(() => ({
													props: mergeProps(get(mergedProps), focusScopeProps()),
													...contentState.snippetProps
												}));
												snippet(node_3, () => $$props.child, () => get($0));
											}
											append($$anchor, fragment_6);
										};
										var alternate = ($$anchor) => {
											var fragment_8 = root_8$1();
											var node_4 = first_child(fragment_8);
											Scroll_lock(node_4, { get preventScroll() {
												return preventScroll();
											} });
											var div = sibling(node_4, 2);
											attribute_effect(div, ($0) => ({ ...$0 }), [() => mergeProps(get(mergedProps), focusScopeProps())]);
											snippet(child(div), () => $$props.children ?? noop);
											reset(div);
											append($$anchor, fragment_8);
										};
										if_block(node_1, ($$render) => {
											if ($$props.child) $$render(consequent_1);
											else $$render(alternate, -1);
										});
										append($$anchor, fragment_5);
									},
									$$slots: { default: true }
								}));
							},
							$$slots: { default: true }
						}));
					},
					$$slots: { default: true }
				}));
			};
			Focus_scope($$anchor, {
				get ref() {
					return contentState.opts.ref;
				},
				loop: true,
				get trapFocus() {
					return trapFocus();
				},
				get enabled() {
					return contentState.root.opts.open.current;
				},
				get onCloseAutoFocus() {
					return onCloseAutoFocus();
				},
				onOpenAutoFocus: (e) => {
					onOpenAutoFocus()(e);
					if (e.defaultPrevented) return;
					e.preventDefault();
					afterSleep(0, () => contentState.opts.ref.current?.focus());
				},
				focusScope,
				$$slots: { focusScope: true }
			});
		}
	};
	if_block(node, ($$render) => {
		if (contentState.shouldRender || forceMount()) $$render(consequent_2);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region src/extension/entrypoints/targets/components/attackhistory/AttackHistoryRedirect.svelte
function AttackHistoryRedirect($$anchor, $$props) {
	push($$props, false);
	onMount(() => void replace("/attackhistory"));
	init();
	pop();
}
//#endregion
//#region src/extension/entrypoints/targets/stores/database-store.svelte.ts
var storesInitialized = state(false);
var settingsStore = writable();
var attackHistoryStore = writable();
var stakeoutsStore = writable();
var factionStakeoutsStore = writable();
function initializeDatabaseStore() {
	if (get(storesInitialized)) return;
	initializeDatabase();
	loadDatabaseStores().then(() => {
		set(storesInitialized, true);
	});
	storageListeners.settings.push((_oldData, newData) => {
		settingsStore.set(newData);
	});
	storageListeners.attackHistory.push((_oldData, newData) => {
		attackHistoryStore.set(newData);
	});
	storageListeners.stakeouts.push((_oldData, newData) => {
		stakeoutsStore.set(newData);
	});
	storageListeners.factionStakeouts.push((_oldData, newData) => {
		factionStakeoutsStore.set(newData);
	});
}
async function loadDatabaseStores() {
	const [settings, attackHistory, stakeouts, factionStakeouts] = await ttStorage.get([
		"settings",
		"attackHistory",
		"stakeouts",
		"factionStakeouts"
	]);
	settingsStore.set(settings);
	attackHistoryStore.set(attackHistory);
	stakeoutsStore.set(stakeouts);
	factionStakeoutsStore.set(factionStakeouts);
}
//#endregion
//#region src/extension/entrypoints/targets/components/GlobalLayout.svelte
var root_2$1 = from_html(`<li><a class="px-2 py-1 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"> </a></li>`);
var root_1$7 = from_html(`<div class="flex flex-col min-h-screen"><header class="px-5 py-2 flex items-center justify-center gap-5"><nav><ul class="flex gap-4"></ul></nav> <div class="w-px h-6 bg-gray-300 dark:bg-gray-600"></div> <nav><ul class="flex gap-4"><li><a href="/options.html" target="_blank" rel="noopener noreferrer" class="px-2 py-1 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-800">Settings</a></li></ul></nav></header> <!> <main class="p-8 max-w-6xl mx-auto w-full"><!></main></div>`);
var root$12 = from_html(`<!> <!> <!>`, 1);
function GlobalLayout($$anchor, $$props) {
	push($$props, true);
	const navigation = [
		{
			name: "Attack History",
			path: "/attackhistory"
		},
		{
			name: "Stakeouts",
			path: "/stakeouts"
		},
		{
			name: "Faction Stakeouts",
			path: "/factionstakeouts"
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
	var fragment = root$12();
	var node = first_child(fragment);
	Mode_watcher(node, { track: false });
	var node_1 = sibling(node, 2);
	Sonner_1(node_1, { richColors: true });
	component(sibling(node_1, 2), () => Tooltip_provider, ($$anchor, Tooltip_Provider) => {
		Tooltip_Provider($$anchor, {
			children: ($$anchor, $$slotProps) => {
				var div = root_1$7();
				var header = child(div);
				var nav = child(header);
				var ul = child(nav);
				each(ul, 21, () => navigation, (item) => item.path, ($$anchor, item) => {
					var li = root_2$1();
					var a = child(li);
					var text = child(a, true);
					reset(a);
					action(a, ($$node) => link?.($$node));
					action(a, ($$node, $$action_arg) => active?.($$node, $$action_arg), () => ({
						path: get(item).path,
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
//#region src/extension/svelte/components/ui/alert-dialog/alert-dialog.svelte
function Alert_dialog($$anchor, $$props) {
	push($$props, true);
	let open = prop($$props, "open", 15, false), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"open"
	]);
	var fragment = comment();
	component(first_child(fragment), () => Alert_dialog$1, ($$anchor, AlertDialogPrimitive_Root) => {
		AlertDialogPrimitive_Root($$anchor, spread_props(() => restProps, {
			get open() {
				return open();
			},
			set open($$value) {
				open($$value);
			}
		}));
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/alert-dialog/alert-dialog-cancel.svelte
function Alert_dialog_cancel($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), variant = prop($$props, "variant", 3, "outline"), size = prop($$props, "size", 3, "default"), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"variant",
		"size"
	]);
	var fragment = comment();
	var node = first_child(fragment);
	{
		let $0 = user_derived(() => cn(buttonVariants({
			variant: variant(),
			size: size()
		}), "cn-alert-dialog-cancel", $$props.class));
		component(node, () => Alert_dialog_cancel$1, ($$anchor, AlertDialogPrimitive_Cancel) => {
			AlertDialogPrimitive_Cancel($$anchor, spread_props({
				"data-slot": "alert-dialog-cancel",
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
//#region src/extension/svelte/components/ui/alert-dialog/alert-dialog-overlay.svelte
function Alert_dialog_overlay($$anchor, $$props) {
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
		let $0 = user_derived(() => cn("data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-50", $$props.class));
		component(node, () => Dialog_overlay, ($$anchor, AlertDialogPrimitive_Overlay) => {
			AlertDialogPrimitive_Overlay($$anchor, spread_props({
				"data-slot": "alert-dialog-overlay",
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
//#region src/extension/svelte/components/ui/alert-dialog/alert-dialog-portal.svelte
function Alert_dialog_portal($$anchor, $$props) {
	let restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy"
	]);
	var fragment = comment();
	component(first_child(fragment), () => Portal, ($$anchor, AlertDialogPrimitive_Portal) => {
		AlertDialogPrimitive_Portal($$anchor, spread_props(() => restProps));
	});
	append($$anchor, fragment);
}
//#endregion
//#region src/extension/svelte/components/ui/alert-dialog/alert-dialog-content.svelte
var root_1$6 = from_html(`<!> <!>`, 1);
function Alert_dialog_content($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), size = prop($$props, "size", 3, "default"), restProps = rest_props($$props, [
		"$$slots",
		"$$events",
		"$$legacy",
		"ref",
		"class",
		"size",
		"portalProps"
	]);
	Alert_dialog_portal($$anchor, spread_props(() => $$props.portalProps, {
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = root_1$6();
			var node = first_child(fragment_1);
			Alert_dialog_overlay(node, {});
			var node_1 = sibling(node, 2);
			{
				let $0 = user_derived(() => cn("data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 bg-popover text-popover-foreground ring-foreground/10 gap-4 rounded-xl p-4 ring-1 duration-100 data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-sm group/alert-dialog-content fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 outline-none", $$props.class));
				component(node_1, () => Alert_dialog_content$1, ($$anchor, AlertDialogPrimitive_Content) => {
					AlertDialogPrimitive_Content($$anchor, spread_props({
						"data-slot": "alert-dialog-content",
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
						}
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
//#region src/extension/svelte/components/ui/alert-dialog/alert-dialog-description.svelte
function Alert_dialog_description($$anchor, $$props) {
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
		let $0 = user_derived(() => cn("text-muted-foreground *:[a]:hover:text-foreground text-sm text-balance md:text-pretty *:[a]:underline *:[a]:underline-offset-3", $$props.class));
		component(node, () => Dialog_description, ($$anchor, AlertDialogPrimitive_Description) => {
			AlertDialogPrimitive_Description($$anchor, spread_props({
				"data-slot": "alert-dialog-description",
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
//#region src/extension/svelte/components/ui/alert-dialog/alert-dialog-footer.svelte
var root$11 = from_html(`<div><!></div>`);
function Alert_dialog_footer($$anchor, $$props) {
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
		"data-slot": "alert-dialog-footer",
		class: $0,
		...restProps
	}), [() => cn("bg-muted/50 -mx-4 -mb-4 rounded-b-xl border-t p-4 flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end", $$props.class)]);
	snippet(child(div), () => $$props.children ?? noop);
	reset(div);
	bind_this(div, ($$value) => ref($$value), () => ref());
	append($$anchor, div);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/alert-dialog/alert-dialog-header.svelte
var root$10 = from_html(`<div><!></div>`);
function Alert_dialog_header($$anchor, $$props) {
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
		"data-slot": "alert-dialog-header",
		class: $0,
		...restProps
	}), [() => cn("grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-4 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]", $$props.class)]);
	snippet(child(div), () => $$props.children ?? noop);
	reset(div);
	bind_this(div, ($$value) => ref($$value), () => ref());
	append($$anchor, div);
	pop();
}
from_html(`<div><!></div>`);
//#endregion
//#region src/extension/svelte/components/ui/alert-dialog/alert-dialog-title.svelte
function Alert_dialog_title($$anchor, $$props) {
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
		let $0 = user_derived(() => cn("font-heading text-base font-medium sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2", $$props.class));
		component(node, () => Dialog_title, ($$anchor, AlertDialogPrimitive_Title) => {
			AlertDialogPrimitive_Title($$anchor, spread_props({
				"data-slot": "alert-dialog-title",
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
//#region src/extension/entrypoints/targets/components/ResetAction.svelte
var root_4$1 = from_html(`<!> <!>`, 1);
var root_7$2 = from_html(`<!> <!>`, 1);
var root_3$1 = from_html(`<!> <!>`, 1);
var root_1$5 = from_html(`<!> <!>`, 1);
function ResetAction($$anchor, $$props) {
	push($$props, true);
	let dialogOpen = state(false);
	async function confirm() {
		await $$props.onConfirm();
		set(dialogOpen, false);
	}
	var fragment = comment();
	component(first_child(fragment), () => Alert_dialog, ($$anchor, AlertDialog_Root) => {
		AlertDialog_Root($$anchor, {
			get open() {
				return get(dialogOpen);
			},
			set open($$value) {
				set(dialogOpen, $$value, true);
			},
			children: ($$anchor, $$slotProps) => {
				var fragment_1 = root_1$5();
				var node_1 = first_child(fragment_1);
				Button(node_1, {
					variant: "destructive",
					onclick: () => set(dialogOpen, true),
					children: ($$anchor, $$slotProps) => {
						next();
						append($$anchor, text$1("Reset"));
					},
					$$slots: { default: true }
				});
				component(sibling(node_1, 2), () => Alert_dialog_content, ($$anchor, AlertDialog_Content) => {
					AlertDialog_Content($$anchor, {
						children: ($$anchor, $$slotProps) => {
							var fragment_2 = root_3$1();
							var node_3 = first_child(fragment_2);
							component(node_3, () => Alert_dialog_header, ($$anchor, AlertDialog_Header) => {
								AlertDialog_Header($$anchor, {
									children: ($$anchor, $$slotProps) => {
										var fragment_3 = root_4$1();
										var node_4 = first_child(fragment_3);
										component(node_4, () => Alert_dialog_title, ($$anchor, AlertDialog_Title) => {
											AlertDialog_Title($$anchor, {
												children: ($$anchor, $$slotProps) => {
													next();
													var text_1 = text$1();
													template_effect(() => set_text(text_1, $$props.title));
													append($$anchor, text_1);
												},
												$$slots: { default: true }
											});
										});
										component(sibling(node_4, 2), () => Alert_dialog_description, ($$anchor, AlertDialog_Description) => {
											AlertDialog_Description($$anchor, {
												children: ($$anchor, $$slotProps) => {
													next();
													var text_2 = text$1();
													template_effect(() => set_text(text_2, $$props.description));
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
							component(sibling(node_3, 2), () => Alert_dialog_footer, ($$anchor, AlertDialog_Footer) => {
								AlertDialog_Footer($$anchor, {
									children: ($$anchor, $$slotProps) => {
										var fragment_6 = root_7$2();
										var node_7 = first_child(fragment_6);
										component(node_7, () => Alert_dialog_cancel, ($$anchor, AlertDialog_Cancel) => {
											AlertDialog_Cancel($$anchor, {
												children: ($$anchor, $$slotProps) => {
													next();
													append($$anchor, text$1("Cancel"));
												},
												$$slots: { default: true }
											});
										});
										Button(sibling(node_7, 2), {
											variant: "destructive",
											onclick: confirm,
											children: ($$anchor, $$slotProps) => {
												next();
												append($$anchor, text$1("Reset"));
											},
											$$slots: { default: true }
										});
										append($$anchor, fragment_6);
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
//#region src/extension/entrypoints/targets/components/attackhistory/columns.ts
var columns$2 = [
	createColumn$3("id", "ID"),
	createColumn$3("name", "Name"),
	createColumn$3("lastAttack", "Last Attack"),
	createColumn$3("win", "Wins"),
	createColumn$3("mug", "Mugs"),
	createColumn$3("leave", "Leaves"),
	createColumn$3("hospitalise", "Hosps"),
	createColumn$3("arrest", "Arrests"),
	createColumn$3("special", "Specials"),
	createColumn$3("stealth", "Stealths"),
	createColumn$3("assist", "Assists"),
	createColumn$3("defend", "Defends"),
	createColumn$3("lose", "Losses"),
	createColumn$3("stalemate", "Stalemates"),
	createColumn$3("escapes", "Escapes"),
	createColumn$3("defend_lost", "Defends Lost"),
	createColumn$3("respect", "Respect"),
	createColumn$3("fair_fight", "FF")
];
function createColumn$3(id, header) {
	return {
		accessorKey: id,
		header,
		enableSorting: true,
		sortDescFirst: id !== "id" && id !== "name",
		cell: ({ column, row }) => getCellLabel(row.original, column.id)
	};
}
function getCellLabel(row, columnId) {
	switch (columnId) {
		case "mug":
		case "leave":
		case "hospitalise":
		case "arrest":
		case "special":
		case "stealth":
		case "respect": return row[`${columnId}Label`];
		case "fair_fight": return row.fairFightLabel;
		default: return row[columnId];
	}
}
//#endregion
//#region node_modules/@tanstack/table-core/build/lib/index.mjs
function functionalUpdate(updater, input) {
	return typeof updater === "function" ? updater(input) : updater;
}
function makeStateUpdater(key, instance) {
	return (updater) => {
		instance.setState((old) => {
			return {
				...old,
				[key]: functionalUpdate(updater, old[key])
			};
		});
	};
}
function isFunction(d) {
	return d instanceof Function;
}
function isNumberArray(d) {
	return Array.isArray(d) && d.every((val) => typeof val === "number");
}
function flattenBy(arr, getChildren) {
	const flat = [];
	const recurse = (subArr) => {
		subArr.forEach((item) => {
			flat.push(item);
			const children = getChildren(item);
			if (children != null && children.length) recurse(children);
		});
	};
	recurse(arr);
	return flat;
}
function memo(getDeps, fn, opts) {
	let deps = [];
	let result;
	return (depArgs) => {
		let depTime;
		if (opts.key && opts.debug) depTime = Date.now();
		const newDeps = getDeps(depArgs);
		if (!(newDeps.length !== deps.length || newDeps.some((dep, index) => deps[index] !== dep))) return result;
		deps = newDeps;
		let resultTime;
		if (opts.key && opts.debug) resultTime = Date.now();
		result = fn(...newDeps);
		opts == null || opts.onChange == null || opts.onChange(result);
		if (opts.key && opts.debug) {
			if (opts != null && opts.debug()) {
				const depEndTime = Math.round((Date.now() - depTime) * 100) / 100;
				const resultEndTime = Math.round((Date.now() - resultTime) * 100) / 100;
				const resultFpsPercentage = resultEndTime / 16;
				const pad = (str, num) => {
					str = String(str);
					while (str.length < num) str = " " + str;
					return str;
				};
				console.info(`%c⏱ ${pad(resultEndTime, 5)} /${pad(depEndTime, 5)} ms`, `
            font-size: .6rem;
            font-weight: bold;
            color: hsl(${Math.max(0, Math.min(120 - 120 * resultFpsPercentage, 120))}deg 100% 31%);`, opts == null ? void 0 : opts.key);
			}
		}
		return result;
	};
}
function getMemoOptions(tableOptions, debugLevel, key, onChange) {
	return {
		debug: () => {
			var _tableOptions$debugAl;
			return (_tableOptions$debugAl = tableOptions == null ? void 0 : tableOptions.debugAll) != null ? _tableOptions$debugAl : tableOptions[debugLevel];
		},
		key: false,
		onChange
	};
}
function createCell(table, row, column, columnId) {
	const getRenderValue = () => {
		var _cell$getValue;
		return (_cell$getValue = cell.getValue()) != null ? _cell$getValue : table.options.renderFallbackValue;
	};
	const cell = {
		id: `${row.id}_${column.id}`,
		row,
		column,
		getValue: () => row.getValue(columnId),
		renderValue: getRenderValue,
		getContext: memo(() => [
			table,
			column,
			row,
			cell
		], (table, column, row, cell) => ({
			table,
			column,
			row,
			cell,
			getValue: cell.getValue,
			renderValue: cell.renderValue
		}), getMemoOptions(table.options, "debugCells", "cell.getContext"))
	};
	table._features.forEach((feature) => {
		feature.createCell == null || feature.createCell(cell, column, row, table);
	}, {});
	return cell;
}
function createColumn$2(table, columnDef, depth, parent) {
	var _ref, _resolvedColumnDef$id;
	const resolvedColumnDef = {
		...table._getDefaultColumnDef(),
		...columnDef
	};
	const accessorKey = resolvedColumnDef.accessorKey;
	let id = (_ref = (_resolvedColumnDef$id = resolvedColumnDef.id) != null ? _resolvedColumnDef$id : accessorKey ? typeof String.prototype.replaceAll === "function" ? accessorKey.replaceAll(".", "_") : accessorKey.replace(/\./g, "_") : void 0) != null ? _ref : typeof resolvedColumnDef.header === "string" ? resolvedColumnDef.header : void 0;
	let accessorFn;
	if (resolvedColumnDef.accessorFn) accessorFn = resolvedColumnDef.accessorFn;
	else if (accessorKey) if (accessorKey.includes(".")) accessorFn = (originalRow) => {
		let result = originalRow;
		for (const key of accessorKey.split(".")) {
			var _result;
			result = (_result = result) == null ? void 0 : _result[key];
		}
		return result;
	};
	else accessorFn = (originalRow) => originalRow[resolvedColumnDef.accessorKey];
	if (!id) throw new Error();
	let column = {
		id: `${String(id)}`,
		accessorFn,
		parent,
		depth,
		columnDef: resolvedColumnDef,
		columns: [],
		getFlatColumns: memo(() => [true], () => {
			var _column$columns;
			return [column, ...(_column$columns = column.columns) == null ? void 0 : _column$columns.flatMap((d) => d.getFlatColumns())];
		}, getMemoOptions(table.options, "debugColumns", "column.getFlatColumns")),
		getLeafColumns: memo(() => [table._getOrderColumnsFn()], (orderColumns) => {
			var _column$columns2;
			if ((_column$columns2 = column.columns) != null && _column$columns2.length) return orderColumns(column.columns.flatMap((column) => column.getLeafColumns()));
			return [column];
		}, getMemoOptions(table.options, "debugColumns", "column.getLeafColumns"))
	};
	for (const feature of table._features) feature.createColumn == null || feature.createColumn(column, table);
	return column;
}
var debug = "debugHeaders";
function createHeader(table, column, options) {
	var _options$id;
	let header = {
		id: (_options$id = options.id) != null ? _options$id : column.id,
		column,
		index: options.index,
		isPlaceholder: !!options.isPlaceholder,
		placeholderId: options.placeholderId,
		depth: options.depth,
		subHeaders: [],
		colSpan: 0,
		rowSpan: 0,
		headerGroup: null,
		getLeafHeaders: () => {
			const leafHeaders = [];
			const recurseHeader = (h) => {
				if (h.subHeaders && h.subHeaders.length) h.subHeaders.map(recurseHeader);
				leafHeaders.push(h);
			};
			recurseHeader(header);
			return leafHeaders;
		},
		getContext: () => ({
			table,
			header,
			column
		})
	};
	table._features.forEach((feature) => {
		feature.createHeader == null || feature.createHeader(header, table);
	});
	return header;
}
var Headers = { createTable: (table) => {
	table.getHeaderGroups = memo(() => [
		table.getAllColumns(),
		table.getVisibleLeafColumns(),
		table.getState().columnPinning.left,
		table.getState().columnPinning.right
	], (allColumns, leafColumns, left, right) => {
		var _left$map$filter, _right$map$filter;
		const leftColumns = (_left$map$filter = left == null ? void 0 : left.map((columnId) => leafColumns.find((d) => d.id === columnId)).filter(Boolean)) != null ? _left$map$filter : [];
		const rightColumns = (_right$map$filter = right == null ? void 0 : right.map((columnId) => leafColumns.find((d) => d.id === columnId)).filter(Boolean)) != null ? _right$map$filter : [];
		const centerColumns = leafColumns.filter((column) => !(left != null && left.includes(column.id)) && !(right != null && right.includes(column.id)));
		return buildHeaderGroups(allColumns, [
			...leftColumns,
			...centerColumns,
			...rightColumns
		], table);
	}, getMemoOptions(table.options, debug, "getHeaderGroups"));
	table.getCenterHeaderGroups = memo(() => [
		table.getAllColumns(),
		table.getVisibleLeafColumns(),
		table.getState().columnPinning.left,
		table.getState().columnPinning.right
	], (allColumns, leafColumns, left, right) => {
		leafColumns = leafColumns.filter((column) => !(left != null && left.includes(column.id)) && !(right != null && right.includes(column.id)));
		return buildHeaderGroups(allColumns, leafColumns, table, "center");
	}, getMemoOptions(table.options, debug, "getCenterHeaderGroups"));
	table.getLeftHeaderGroups = memo(() => [
		table.getAllColumns(),
		table.getVisibleLeafColumns(),
		table.getState().columnPinning.left
	], (allColumns, leafColumns, left) => {
		var _left$map$filter2;
		return buildHeaderGroups(allColumns, (_left$map$filter2 = left == null ? void 0 : left.map((columnId) => leafColumns.find((d) => d.id === columnId)).filter(Boolean)) != null ? _left$map$filter2 : [], table, "left");
	}, getMemoOptions(table.options, debug, "getLeftHeaderGroups"));
	table.getRightHeaderGroups = memo(() => [
		table.getAllColumns(),
		table.getVisibleLeafColumns(),
		table.getState().columnPinning.right
	], (allColumns, leafColumns, right) => {
		var _right$map$filter2;
		return buildHeaderGroups(allColumns, (_right$map$filter2 = right == null ? void 0 : right.map((columnId) => leafColumns.find((d) => d.id === columnId)).filter(Boolean)) != null ? _right$map$filter2 : [], table, "right");
	}, getMemoOptions(table.options, debug, "getRightHeaderGroups"));
	table.getFooterGroups = memo(() => [table.getHeaderGroups()], (headerGroups) => {
		return [...headerGroups].reverse();
	}, getMemoOptions(table.options, debug, "getFooterGroups"));
	table.getLeftFooterGroups = memo(() => [table.getLeftHeaderGroups()], (headerGroups) => {
		return [...headerGroups].reverse();
	}, getMemoOptions(table.options, debug, "getLeftFooterGroups"));
	table.getCenterFooterGroups = memo(() => [table.getCenterHeaderGroups()], (headerGroups) => {
		return [...headerGroups].reverse();
	}, getMemoOptions(table.options, debug, "getCenterFooterGroups"));
	table.getRightFooterGroups = memo(() => [table.getRightHeaderGroups()], (headerGroups) => {
		return [...headerGroups].reverse();
	}, getMemoOptions(table.options, debug, "getRightFooterGroups"));
	table.getFlatHeaders = memo(() => [table.getHeaderGroups()], (headerGroups) => {
		return headerGroups.map((headerGroup) => {
			return headerGroup.headers;
		}).flat();
	}, getMemoOptions(table.options, debug, "getFlatHeaders"));
	table.getLeftFlatHeaders = memo(() => [table.getLeftHeaderGroups()], (left) => {
		return left.map((headerGroup) => {
			return headerGroup.headers;
		}).flat();
	}, getMemoOptions(table.options, debug, "getLeftFlatHeaders"));
	table.getCenterFlatHeaders = memo(() => [table.getCenterHeaderGroups()], (left) => {
		return left.map((headerGroup) => {
			return headerGroup.headers;
		}).flat();
	}, getMemoOptions(table.options, debug, "getCenterFlatHeaders"));
	table.getRightFlatHeaders = memo(() => [table.getRightHeaderGroups()], (left) => {
		return left.map((headerGroup) => {
			return headerGroup.headers;
		}).flat();
	}, getMemoOptions(table.options, debug, "getRightFlatHeaders"));
	table.getCenterLeafHeaders = memo(() => [table.getCenterFlatHeaders()], (flatHeaders) => {
		return flatHeaders.filter((header) => {
			var _header$subHeaders;
			return !((_header$subHeaders = header.subHeaders) != null && _header$subHeaders.length);
		});
	}, getMemoOptions(table.options, debug, "getCenterLeafHeaders"));
	table.getLeftLeafHeaders = memo(() => [table.getLeftFlatHeaders()], (flatHeaders) => {
		return flatHeaders.filter((header) => {
			var _header$subHeaders2;
			return !((_header$subHeaders2 = header.subHeaders) != null && _header$subHeaders2.length);
		});
	}, getMemoOptions(table.options, debug, "getLeftLeafHeaders"));
	table.getRightLeafHeaders = memo(() => [table.getRightFlatHeaders()], (flatHeaders) => {
		return flatHeaders.filter((header) => {
			var _header$subHeaders3;
			return !((_header$subHeaders3 = header.subHeaders) != null && _header$subHeaders3.length);
		});
	}, getMemoOptions(table.options, debug, "getRightLeafHeaders"));
	table.getLeafHeaders = memo(() => [
		table.getLeftHeaderGroups(),
		table.getCenterHeaderGroups(),
		table.getRightHeaderGroups()
	], (left, center, right) => {
		var _left$0$headers, _left$, _center$0$headers, _center$, _right$0$headers, _right$;
		return [
			...(_left$0$headers = (_left$ = left[0]) == null ? void 0 : _left$.headers) != null ? _left$0$headers : [],
			...(_center$0$headers = (_center$ = center[0]) == null ? void 0 : _center$.headers) != null ? _center$0$headers : [],
			...(_right$0$headers = (_right$ = right[0]) == null ? void 0 : _right$.headers) != null ? _right$0$headers : []
		].map((header) => {
			return header.getLeafHeaders();
		}).flat();
	}, getMemoOptions(table.options, debug, "getLeafHeaders"));
} };
function buildHeaderGroups(allColumns, columnsToGroup, table, headerFamily) {
	var _headerGroups$0$heade, _headerGroups$;
	let maxDepth = 0;
	const findMaxDepth = function(columns, depth) {
		if (depth === void 0) depth = 1;
		maxDepth = Math.max(maxDepth, depth);
		columns.filter((column) => column.getIsVisible()).forEach((column) => {
			var _column$columns;
			if ((_column$columns = column.columns) != null && _column$columns.length) findMaxDepth(column.columns, depth + 1);
		}, 0);
	};
	findMaxDepth(allColumns);
	let headerGroups = [];
	const createHeaderGroup = (headersToGroup, depth) => {
		const headerGroup = {
			depth,
			id: [headerFamily, `${depth}`].filter(Boolean).join("_"),
			headers: []
		};
		const pendingParentHeaders = [];
		headersToGroup.forEach((headerToGroup) => {
			const latestPendingParentHeader = [...pendingParentHeaders].reverse()[0];
			const isLeafHeader = headerToGroup.column.depth === headerGroup.depth;
			let column;
			let isPlaceholder = false;
			if (isLeafHeader && headerToGroup.column.parent) column = headerToGroup.column.parent;
			else {
				column = headerToGroup.column;
				isPlaceholder = true;
			}
			if (latestPendingParentHeader && (latestPendingParentHeader == null ? void 0 : latestPendingParentHeader.column) === column) latestPendingParentHeader.subHeaders.push(headerToGroup);
			else {
				const header = createHeader(table, column, {
					id: [
						headerFamily,
						depth,
						column.id,
						headerToGroup == null ? void 0 : headerToGroup.id
					].filter(Boolean).join("_"),
					isPlaceholder,
					placeholderId: isPlaceholder ? `${pendingParentHeaders.filter((d) => d.column === column).length}` : void 0,
					depth,
					index: pendingParentHeaders.length
				});
				header.subHeaders.push(headerToGroup);
				pendingParentHeaders.push(header);
			}
			headerGroup.headers.push(headerToGroup);
			headerToGroup.headerGroup = headerGroup;
		});
		headerGroups.push(headerGroup);
		if (depth > 0) createHeaderGroup(pendingParentHeaders, depth - 1);
	};
	createHeaderGroup(columnsToGroup.map((column, index) => createHeader(table, column, {
		depth: maxDepth,
		index
	})), maxDepth - 1);
	headerGroups.reverse();
	const recurseHeadersForSpans = (headers) => {
		return headers.filter((header) => header.column.getIsVisible()).map((header) => {
			let colSpan = 0;
			let rowSpan = 0;
			let childRowSpans = [0];
			if (header.subHeaders && header.subHeaders.length) {
				childRowSpans = [];
				recurseHeadersForSpans(header.subHeaders).forEach((_ref) => {
					let { colSpan: childColSpan, rowSpan: childRowSpan } = _ref;
					colSpan += childColSpan;
					childRowSpans.push(childRowSpan);
				});
			} else colSpan = 1;
			const minChildRowSpan = Math.min(...childRowSpans);
			rowSpan = rowSpan + minChildRowSpan;
			header.colSpan = colSpan;
			header.rowSpan = rowSpan;
			return {
				colSpan,
				rowSpan
			};
		});
	};
	recurseHeadersForSpans((_headerGroups$0$heade = (_headerGroups$ = headerGroups[0]) == null ? void 0 : _headerGroups$.headers) != null ? _headerGroups$0$heade : []);
	return headerGroups;
}
var createRow = (table, id, original, rowIndex, depth, subRows, parentId) => {
	let row = {
		id,
		index: rowIndex,
		original,
		depth,
		parentId,
		_valuesCache: {},
		_uniqueValuesCache: {},
		getValue: (columnId) => {
			if (row._valuesCache.hasOwnProperty(columnId)) return row._valuesCache[columnId];
			const column = table.getColumn(columnId);
			if (!(column != null && column.accessorFn)) return;
			row._valuesCache[columnId] = column.accessorFn(row.original, rowIndex);
			return row._valuesCache[columnId];
		},
		getUniqueValues: (columnId) => {
			if (row._uniqueValuesCache.hasOwnProperty(columnId)) return row._uniqueValuesCache[columnId];
			const column = table.getColumn(columnId);
			if (!(column != null && column.accessorFn)) return;
			if (!column.columnDef.getUniqueValues) {
				row._uniqueValuesCache[columnId] = [row.getValue(columnId)];
				return row._uniqueValuesCache[columnId];
			}
			row._uniqueValuesCache[columnId] = column.columnDef.getUniqueValues(row.original, rowIndex);
			return row._uniqueValuesCache[columnId];
		},
		renderValue: (columnId) => {
			var _row$getValue;
			return (_row$getValue = row.getValue(columnId)) != null ? _row$getValue : table.options.renderFallbackValue;
		},
		subRows: subRows != null ? subRows : [],
		getLeafRows: () => flattenBy(row.subRows, (d) => d.subRows),
		getParentRow: () => row.parentId ? table.getRow(row.parentId, true) : void 0,
		getParentRows: () => {
			let parentRows = [];
			let currentRow = row;
			while (true) {
				const parentRow = currentRow.getParentRow();
				if (!parentRow) break;
				parentRows.push(parentRow);
				currentRow = parentRow;
			}
			return parentRows.reverse();
		},
		getAllCells: memo(() => [table.getAllLeafColumns()], (leafColumns) => {
			return leafColumns.map((column) => {
				return createCell(table, row, column, column.id);
			});
		}, getMemoOptions(table.options, "debugRows", "getAllCells")),
		_getAllCellsByColumnId: memo(() => [row.getAllCells()], (allCells) => {
			return allCells.reduce((acc, cell) => {
				acc[cell.column.id] = cell;
				return acc;
			}, {});
		}, getMemoOptions(table.options, "debugRows", "getAllCellsByColumnId"))
	};
	for (let i = 0; i < table._features.length; i++) {
		const feature = table._features[i];
		feature == null || feature.createRow == null || feature.createRow(row, table);
	}
	return row;
};
var ColumnFaceting = { createColumn: (column, table) => {
	column._getFacetedRowModel = table.options.getFacetedRowModel && table.options.getFacetedRowModel(table, column.id);
	column.getFacetedRowModel = () => {
		if (!column._getFacetedRowModel) return table.getPreFilteredRowModel();
		return column._getFacetedRowModel();
	};
	column._getFacetedUniqueValues = table.options.getFacetedUniqueValues && table.options.getFacetedUniqueValues(table, column.id);
	column.getFacetedUniqueValues = () => {
		if (!column._getFacetedUniqueValues) return /* @__PURE__ */ new Map();
		return column._getFacetedUniqueValues();
	};
	column._getFacetedMinMaxValues = table.options.getFacetedMinMaxValues && table.options.getFacetedMinMaxValues(table, column.id);
	column.getFacetedMinMaxValues = () => {
		if (!column._getFacetedMinMaxValues) return;
		return column._getFacetedMinMaxValues();
	};
} };
var includesString = (row, columnId, filterValue) => {
	var _filterValue$toString, _row$getValue;
	const search = filterValue == null || (_filterValue$toString = filterValue.toString()) == null ? void 0 : _filterValue$toString.toLowerCase();
	return Boolean((_row$getValue = row.getValue(columnId)) == null || (_row$getValue = _row$getValue.toString()) == null || (_row$getValue = _row$getValue.toLowerCase()) == null ? void 0 : _row$getValue.includes(search));
};
includesString.autoRemove = (val) => testFalsey(val);
var includesStringSensitive = (row, columnId, filterValue) => {
	var _row$getValue2;
	return Boolean((_row$getValue2 = row.getValue(columnId)) == null || (_row$getValue2 = _row$getValue2.toString()) == null ? void 0 : _row$getValue2.includes(filterValue));
};
includesStringSensitive.autoRemove = (val) => testFalsey(val);
var equalsString = (row, columnId, filterValue) => {
	var _row$getValue3;
	return ((_row$getValue3 = row.getValue(columnId)) == null || (_row$getValue3 = _row$getValue3.toString()) == null ? void 0 : _row$getValue3.toLowerCase()) === (filterValue == null ? void 0 : filterValue.toLowerCase());
};
equalsString.autoRemove = (val) => testFalsey(val);
var arrIncludes = (row, columnId, filterValue) => {
	var _row$getValue4;
	return (_row$getValue4 = row.getValue(columnId)) == null ? void 0 : _row$getValue4.includes(filterValue);
};
arrIncludes.autoRemove = (val) => testFalsey(val);
var arrIncludesAll = (row, columnId, filterValue) => {
	return !filterValue.some((val) => {
		var _row$getValue5;
		return !((_row$getValue5 = row.getValue(columnId)) != null && _row$getValue5.includes(val));
	});
};
arrIncludesAll.autoRemove = (val) => testFalsey(val) || !(val != null && val.length);
var arrIncludesSome = (row, columnId, filterValue) => {
	return filterValue.some((val) => {
		var _row$getValue6;
		return (_row$getValue6 = row.getValue(columnId)) == null ? void 0 : _row$getValue6.includes(val);
	});
};
arrIncludesSome.autoRemove = (val) => testFalsey(val) || !(val != null && val.length);
var equals = (row, columnId, filterValue) => {
	return row.getValue(columnId) === filterValue;
};
equals.autoRemove = (val) => testFalsey(val);
var weakEquals = (row, columnId, filterValue) => {
	return row.getValue(columnId) == filterValue;
};
weakEquals.autoRemove = (val) => testFalsey(val);
var inNumberRange = (row, columnId, filterValue) => {
	let [min, max] = filterValue;
	const rowValue = row.getValue(columnId);
	return rowValue >= min && rowValue <= max;
};
inNumberRange.resolveFilterValue = (val) => {
	let [unsafeMin, unsafeMax] = val;
	let parsedMin = typeof unsafeMin !== "number" ? parseFloat(unsafeMin) : unsafeMin;
	let parsedMax = typeof unsafeMax !== "number" ? parseFloat(unsafeMax) : unsafeMax;
	let min = unsafeMin === null || Number.isNaN(parsedMin) ? -Infinity : parsedMin;
	let max = unsafeMax === null || Number.isNaN(parsedMax) ? Infinity : parsedMax;
	if (min > max) {
		const temp = min;
		min = max;
		max = temp;
	}
	return [min, max];
};
inNumberRange.autoRemove = (val) => testFalsey(val) || testFalsey(val[0]) && testFalsey(val[1]);
var filterFns = {
	includesString,
	includesStringSensitive,
	equalsString,
	arrIncludes,
	arrIncludesAll,
	arrIncludesSome,
	equals,
	weakEquals,
	inNumberRange
};
function testFalsey(val) {
	return val === void 0 || val === null || val === "";
}
var ColumnFiltering = {
	getDefaultColumnDef: () => {
		return { filterFn: "auto" };
	},
	getInitialState: (state) => {
		return {
			columnFilters: [],
			...state
		};
	},
	getDefaultOptions: (table) => {
		return {
			onColumnFiltersChange: makeStateUpdater("columnFilters", table),
			filterFromLeafRows: false,
			maxLeafRowFilterDepth: 100
		};
	},
	createColumn: (column, table) => {
		column.getAutoFilterFn = () => {
			const firstRow = table.getCoreRowModel().flatRows[0];
			const value = firstRow == null ? void 0 : firstRow.getValue(column.id);
			if (typeof value === "string") return filterFns.includesString;
			if (typeof value === "number") return filterFns.inNumberRange;
			if (typeof value === "boolean") return filterFns.equals;
			if (value !== null && typeof value === "object") return filterFns.equals;
			if (Array.isArray(value)) return filterFns.arrIncludes;
			return filterFns.weakEquals;
		};
		column.getFilterFn = () => {
			var _table$options$filter, _table$options$filter2;
			return isFunction(column.columnDef.filterFn) ? column.columnDef.filterFn : column.columnDef.filterFn === "auto" ? column.getAutoFilterFn() : (_table$options$filter = (_table$options$filter2 = table.options.filterFns) == null ? void 0 : _table$options$filter2[column.columnDef.filterFn]) != null ? _table$options$filter : filterFns[column.columnDef.filterFn];
		};
		column.getCanFilter = () => {
			var _column$columnDef$ena, _table$options$enable, _table$options$enable2;
			return ((_column$columnDef$ena = column.columnDef.enableColumnFilter) != null ? _column$columnDef$ena : true) && ((_table$options$enable = table.options.enableColumnFilters) != null ? _table$options$enable : true) && ((_table$options$enable2 = table.options.enableFilters) != null ? _table$options$enable2 : true) && !!column.accessorFn;
		};
		column.getIsFiltered = () => column.getFilterIndex() > -1;
		column.getFilterValue = () => {
			var _table$getState$colum;
			return (_table$getState$colum = table.getState().columnFilters) == null || (_table$getState$colum = _table$getState$colum.find((d) => d.id === column.id)) == null ? void 0 : _table$getState$colum.value;
		};
		column.getFilterIndex = () => {
			var _table$getState$colum2, _table$getState$colum3;
			return (_table$getState$colum2 = (_table$getState$colum3 = table.getState().columnFilters) == null ? void 0 : _table$getState$colum3.findIndex((d) => d.id === column.id)) != null ? _table$getState$colum2 : -1;
		};
		column.setFilterValue = (value) => {
			table.setColumnFilters((old) => {
				const filterFn = column.getFilterFn();
				const previousFilter = old == null ? void 0 : old.find((d) => d.id === column.id);
				const newFilter = functionalUpdate(value, previousFilter ? previousFilter.value : void 0);
				if (shouldAutoRemoveFilter(filterFn, newFilter, column)) {
					var _old$filter;
					return (_old$filter = old == null ? void 0 : old.filter((d) => d.id !== column.id)) != null ? _old$filter : [];
				}
				const newFilterObj = {
					id: column.id,
					value: newFilter
				};
				if (previousFilter) {
					var _old$map;
					return (_old$map = old == null ? void 0 : old.map((d) => {
						if (d.id === column.id) return newFilterObj;
						return d;
					})) != null ? _old$map : [];
				}
				if (old != null && old.length) return [...old, newFilterObj];
				return [newFilterObj];
			});
		};
	},
	createRow: (row, _table) => {
		row.columnFilters = {};
		row.columnFiltersMeta = {};
	},
	createTable: (table) => {
		table.setColumnFilters = (updater) => {
			const leafColumns = table.getAllLeafColumns();
			const updateFn = (old) => {
				var _functionalUpdate;
				return (_functionalUpdate = functionalUpdate(updater, old)) == null ? void 0 : _functionalUpdate.filter((filter) => {
					const column = leafColumns.find((d) => d.id === filter.id);
					if (column) {
						if (shouldAutoRemoveFilter(column.getFilterFn(), filter.value, column)) return false;
					}
					return true;
				});
			};
			table.options.onColumnFiltersChange == null || table.options.onColumnFiltersChange(updateFn);
		};
		table.resetColumnFilters = (defaultState) => {
			var _table$initialState$c, _table$initialState;
			table.setColumnFilters(defaultState ? [] : (_table$initialState$c = (_table$initialState = table.initialState) == null ? void 0 : _table$initialState.columnFilters) != null ? _table$initialState$c : []);
		};
		table.getPreFilteredRowModel = () => table.getCoreRowModel();
		table.getFilteredRowModel = () => {
			if (!table._getFilteredRowModel && table.options.getFilteredRowModel) table._getFilteredRowModel = table.options.getFilteredRowModel(table);
			if (table.options.manualFiltering || !table._getFilteredRowModel) return table.getPreFilteredRowModel();
			return table._getFilteredRowModel();
		};
	}
};
function shouldAutoRemoveFilter(filterFn, value, column) {
	return (filterFn && filterFn.autoRemove ? filterFn.autoRemove(value, column) : false) || typeof value === "undefined" || typeof value === "string" && !value;
}
var sum = (columnId, _leafRows, childRows) => {
	return childRows.reduce((sum, next) => {
		const nextValue = next.getValue(columnId);
		return sum + (typeof nextValue === "number" ? nextValue : 0);
	}, 0);
};
var min = (columnId, _leafRows, childRows) => {
	let min;
	childRows.forEach((row) => {
		const value = row.getValue(columnId);
		if (value != null && (min > value || min === void 0 && value >= value)) min = value;
	});
	return min;
};
var max = (columnId, _leafRows, childRows) => {
	let max;
	childRows.forEach((row) => {
		const value = row.getValue(columnId);
		if (value != null && (max < value || max === void 0 && value >= value)) max = value;
	});
	return max;
};
var extent = (columnId, _leafRows, childRows) => {
	let min;
	let max;
	childRows.forEach((row) => {
		const value = row.getValue(columnId);
		if (value != null) if (min === void 0) {
			if (value >= value) min = max = value;
		} else {
			if (min > value) min = value;
			if (max < value) max = value;
		}
	});
	return [min, max];
};
var mean = (columnId, leafRows) => {
	let count = 0;
	let sum = 0;
	leafRows.forEach((row) => {
		let value = row.getValue(columnId);
		if (value != null && (value = +value) >= value) ++count, sum += value;
	});
	if (count) return sum / count;
};
var median = (columnId, leafRows) => {
	if (!leafRows.length) return;
	const values = leafRows.map((row) => row.getValue(columnId));
	if (!isNumberArray(values)) return;
	if (values.length === 1) return values[0];
	const mid = Math.floor(values.length / 2);
	const nums = values.sort((a, b) => a - b);
	return values.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
};
var unique = (columnId, leafRows) => {
	return Array.from(new Set(leafRows.map((d) => d.getValue(columnId))).values());
};
var uniqueCount = (columnId, leafRows) => {
	return new Set(leafRows.map((d) => d.getValue(columnId))).size;
};
var count = (_columnId, leafRows) => {
	return leafRows.length;
};
var aggregationFns = {
	sum,
	min,
	max,
	extent,
	mean,
	median,
	unique,
	uniqueCount,
	count
};
var ColumnGrouping = {
	getDefaultColumnDef: () => {
		return {
			aggregatedCell: (props) => {
				var _toString, _props$getValue;
				return (_toString = (_props$getValue = props.getValue()) == null || _props$getValue.toString == null ? void 0 : _props$getValue.toString()) != null ? _toString : null;
			},
			aggregationFn: "auto"
		};
	},
	getInitialState: (state) => {
		return {
			grouping: [],
			...state
		};
	},
	getDefaultOptions: (table) => {
		return {
			onGroupingChange: makeStateUpdater("grouping", table),
			groupedColumnMode: "reorder"
		};
	},
	createColumn: (column, table) => {
		column.toggleGrouping = () => {
			table.setGrouping((old) => {
				if (old != null && old.includes(column.id)) return old.filter((d) => d !== column.id);
				return [...old != null ? old : [], column.id];
			});
		};
		column.getCanGroup = () => {
			var _column$columnDef$ena, _table$options$enable;
			return ((_column$columnDef$ena = column.columnDef.enableGrouping) != null ? _column$columnDef$ena : true) && ((_table$options$enable = table.options.enableGrouping) != null ? _table$options$enable : true) && (!!column.accessorFn || !!column.columnDef.getGroupingValue);
		};
		column.getIsGrouped = () => {
			var _table$getState$group;
			return (_table$getState$group = table.getState().grouping) == null ? void 0 : _table$getState$group.includes(column.id);
		};
		column.getGroupedIndex = () => {
			var _table$getState$group2;
			return (_table$getState$group2 = table.getState().grouping) == null ? void 0 : _table$getState$group2.indexOf(column.id);
		};
		column.getToggleGroupingHandler = () => {
			const canGroup = column.getCanGroup();
			return () => {
				if (!canGroup) return;
				column.toggleGrouping();
			};
		};
		column.getAutoAggregationFn = () => {
			const firstRow = table.getCoreRowModel().flatRows[0];
			const value = firstRow == null ? void 0 : firstRow.getValue(column.id);
			if (typeof value === "number") return aggregationFns.sum;
			if (Object.prototype.toString.call(value) === "[object Date]") return aggregationFns.extent;
		};
		column.getAggregationFn = () => {
			var _table$options$aggreg, _table$options$aggreg2;
			if (!column) throw new Error();
			return isFunction(column.columnDef.aggregationFn) ? column.columnDef.aggregationFn : column.columnDef.aggregationFn === "auto" ? column.getAutoAggregationFn() : (_table$options$aggreg = (_table$options$aggreg2 = table.options.aggregationFns) == null ? void 0 : _table$options$aggreg2[column.columnDef.aggregationFn]) != null ? _table$options$aggreg : aggregationFns[column.columnDef.aggregationFn];
		};
	},
	createTable: (table) => {
		table.setGrouping = (updater) => table.options.onGroupingChange == null ? void 0 : table.options.onGroupingChange(updater);
		table.resetGrouping = (defaultState) => {
			var _table$initialState$g, _table$initialState;
			table.setGrouping(defaultState ? [] : (_table$initialState$g = (_table$initialState = table.initialState) == null ? void 0 : _table$initialState.grouping) != null ? _table$initialState$g : []);
		};
		table.getPreGroupedRowModel = () => table.getFilteredRowModel();
		table.getGroupedRowModel = () => {
			if (!table._getGroupedRowModel && table.options.getGroupedRowModel) table._getGroupedRowModel = table.options.getGroupedRowModel(table);
			if (table.options.manualGrouping || !table._getGroupedRowModel) return table.getPreGroupedRowModel();
			return table._getGroupedRowModel();
		};
	},
	createRow: (row, table) => {
		row.getIsGrouped = () => !!row.groupingColumnId;
		row.getGroupingValue = (columnId) => {
			if (row._groupingValuesCache.hasOwnProperty(columnId)) return row._groupingValuesCache[columnId];
			const column = table.getColumn(columnId);
			if (!(column != null && column.columnDef.getGroupingValue)) return row.getValue(columnId);
			row._groupingValuesCache[columnId] = column.columnDef.getGroupingValue(row.original);
			return row._groupingValuesCache[columnId];
		};
		row._groupingValuesCache = {};
	},
	createCell: (cell, column, row, table) => {
		cell.getIsGrouped = () => column.getIsGrouped() && column.id === row.groupingColumnId;
		cell.getIsPlaceholder = () => !cell.getIsGrouped() && column.getIsGrouped();
		cell.getIsAggregated = () => {
			var _row$subRows;
			return !cell.getIsGrouped() && !cell.getIsPlaceholder() && !!((_row$subRows = row.subRows) != null && _row$subRows.length);
		};
	}
};
function orderColumns(leafColumns, grouping, groupedColumnMode) {
	if (!(grouping != null && grouping.length) || !groupedColumnMode) return leafColumns;
	const nonGroupingColumns = leafColumns.filter((col) => !grouping.includes(col.id));
	if (groupedColumnMode === "remove") return nonGroupingColumns;
	return [...grouping.map((g) => leafColumns.find((col) => col.id === g)).filter(Boolean), ...nonGroupingColumns];
}
var ColumnOrdering = {
	getInitialState: (state) => {
		return {
			columnOrder: [],
			...state
		};
	},
	getDefaultOptions: (table) => {
		return { onColumnOrderChange: makeStateUpdater("columnOrder", table) };
	},
	createColumn: (column, table) => {
		column.getIndex = memo((position) => [_getVisibleLeafColumns(table, position)], (columns) => columns.findIndex((d) => d.id === column.id), getMemoOptions(table.options, "debugColumns", "getIndex"));
		column.getIsFirstColumn = (position) => {
			var _columns$;
			return ((_columns$ = _getVisibleLeafColumns(table, position)[0]) == null ? void 0 : _columns$.id) === column.id;
		};
		column.getIsLastColumn = (position) => {
			var _columns;
			const columns = _getVisibleLeafColumns(table, position);
			return ((_columns = columns[columns.length - 1]) == null ? void 0 : _columns.id) === column.id;
		};
	},
	createTable: (table) => {
		table.setColumnOrder = (updater) => table.options.onColumnOrderChange == null ? void 0 : table.options.onColumnOrderChange(updater);
		table.resetColumnOrder = (defaultState) => {
			var _table$initialState$c;
			table.setColumnOrder(defaultState ? [] : (_table$initialState$c = table.initialState.columnOrder) != null ? _table$initialState$c : []);
		};
		table._getOrderColumnsFn = memo(() => [
			table.getState().columnOrder,
			table.getState().grouping,
			table.options.groupedColumnMode
		], (columnOrder, grouping, groupedColumnMode) => (columns) => {
			let orderedColumns = [];
			if (!(columnOrder != null && columnOrder.length)) orderedColumns = columns;
			else {
				const columnOrderCopy = [...columnOrder];
				const columnsCopy = [...columns];
				while (columnsCopy.length && columnOrderCopy.length) {
					const targetColumnId = columnOrderCopy.shift();
					const foundIndex = columnsCopy.findIndex((d) => d.id === targetColumnId);
					if (foundIndex > -1) orderedColumns.push(columnsCopy.splice(foundIndex, 1)[0]);
				}
				orderedColumns = [...orderedColumns, ...columnsCopy];
			}
			return orderColumns(orderedColumns, grouping, groupedColumnMode);
		}, getMemoOptions(table.options, "debugTable", "_getOrderColumnsFn"));
	}
};
var getDefaultColumnPinningState = () => ({
	left: [],
	right: []
});
var ColumnPinning = {
	getInitialState: (state) => {
		return {
			columnPinning: getDefaultColumnPinningState(),
			...state
		};
	},
	getDefaultOptions: (table) => {
		return { onColumnPinningChange: makeStateUpdater("columnPinning", table) };
	},
	createColumn: (column, table) => {
		column.pin = (position) => {
			const columnIds = column.getLeafColumns().map((d) => d.id).filter(Boolean);
			table.setColumnPinning((old) => {
				var _old$left3, _old$right3;
				if (position === "right") {
					var _old$left, _old$right;
					return {
						left: ((_old$left = old == null ? void 0 : old.left) != null ? _old$left : []).filter((d) => !(columnIds != null && columnIds.includes(d))),
						right: [...((_old$right = old == null ? void 0 : old.right) != null ? _old$right : []).filter((d) => !(columnIds != null && columnIds.includes(d))), ...columnIds]
					};
				}
				if (position === "left") {
					var _old$left2, _old$right2;
					return {
						left: [...((_old$left2 = old == null ? void 0 : old.left) != null ? _old$left2 : []).filter((d) => !(columnIds != null && columnIds.includes(d))), ...columnIds],
						right: ((_old$right2 = old == null ? void 0 : old.right) != null ? _old$right2 : []).filter((d) => !(columnIds != null && columnIds.includes(d)))
					};
				}
				return {
					left: ((_old$left3 = old == null ? void 0 : old.left) != null ? _old$left3 : []).filter((d) => !(columnIds != null && columnIds.includes(d))),
					right: ((_old$right3 = old == null ? void 0 : old.right) != null ? _old$right3 : []).filter((d) => !(columnIds != null && columnIds.includes(d)))
				};
			});
		};
		column.getCanPin = () => {
			return column.getLeafColumns().some((d) => {
				var _d$columnDef$enablePi, _ref, _table$options$enable;
				return ((_d$columnDef$enablePi = d.columnDef.enablePinning) != null ? _d$columnDef$enablePi : true) && ((_ref = (_table$options$enable = table.options.enableColumnPinning) != null ? _table$options$enable : table.options.enablePinning) != null ? _ref : true);
			});
		};
		column.getIsPinned = () => {
			const leafColumnIds = column.getLeafColumns().map((d) => d.id);
			const { left, right } = table.getState().columnPinning;
			const isLeft = leafColumnIds.some((d) => left == null ? void 0 : left.includes(d));
			const isRight = leafColumnIds.some((d) => right == null ? void 0 : right.includes(d));
			return isLeft ? "left" : isRight ? "right" : false;
		};
		column.getPinnedIndex = () => {
			var _table$getState$colum, _table$getState$colum2;
			const position = column.getIsPinned();
			return position ? (_table$getState$colum = (_table$getState$colum2 = table.getState().columnPinning) == null || (_table$getState$colum2 = _table$getState$colum2[position]) == null ? void 0 : _table$getState$colum2.indexOf(column.id)) != null ? _table$getState$colum : -1 : 0;
		};
	},
	createRow: (row, table) => {
		row.getCenterVisibleCells = memo(() => [
			row._getAllVisibleCells(),
			table.getState().columnPinning.left,
			table.getState().columnPinning.right
		], (allCells, left, right) => {
			const leftAndRight = [...left != null ? left : [], ...right != null ? right : []];
			return allCells.filter((d) => !leftAndRight.includes(d.column.id));
		}, getMemoOptions(table.options, "debugRows", "getCenterVisibleCells"));
		row.getLeftVisibleCells = memo(() => [row._getAllVisibleCells(), table.getState().columnPinning.left], (allCells, left) => {
			return (left != null ? left : []).map((columnId) => allCells.find((cell) => cell.column.id === columnId)).filter(Boolean).map((d) => ({
				...d,
				position: "left"
			}));
		}, getMemoOptions(table.options, "debugRows", "getLeftVisibleCells"));
		row.getRightVisibleCells = memo(() => [row._getAllVisibleCells(), table.getState().columnPinning.right], (allCells, right) => {
			return (right != null ? right : []).map((columnId) => allCells.find((cell) => cell.column.id === columnId)).filter(Boolean).map((d) => ({
				...d,
				position: "right"
			}));
		}, getMemoOptions(table.options, "debugRows", "getRightVisibleCells"));
	},
	createTable: (table) => {
		table.setColumnPinning = (updater) => table.options.onColumnPinningChange == null ? void 0 : table.options.onColumnPinningChange(updater);
		table.resetColumnPinning = (defaultState) => {
			var _table$initialState$c, _table$initialState;
			return table.setColumnPinning(defaultState ? getDefaultColumnPinningState() : (_table$initialState$c = (_table$initialState = table.initialState) == null ? void 0 : _table$initialState.columnPinning) != null ? _table$initialState$c : getDefaultColumnPinningState());
		};
		table.getIsSomeColumnsPinned = (position) => {
			var _pinningState$positio;
			const pinningState = table.getState().columnPinning;
			if (!position) {
				var _pinningState$left, _pinningState$right;
				return Boolean(((_pinningState$left = pinningState.left) == null ? void 0 : _pinningState$left.length) || ((_pinningState$right = pinningState.right) == null ? void 0 : _pinningState$right.length));
			}
			return Boolean((_pinningState$positio = pinningState[position]) == null ? void 0 : _pinningState$positio.length);
		};
		table.getLeftLeafColumns = memo(() => [table.getAllLeafColumns(), table.getState().columnPinning.left], (allColumns, left) => {
			return (left != null ? left : []).map((columnId) => allColumns.find((column) => column.id === columnId)).filter(Boolean);
		}, getMemoOptions(table.options, "debugColumns", "getLeftLeafColumns"));
		table.getRightLeafColumns = memo(() => [table.getAllLeafColumns(), table.getState().columnPinning.right], (allColumns, right) => {
			return (right != null ? right : []).map((columnId) => allColumns.find((column) => column.id === columnId)).filter(Boolean);
		}, getMemoOptions(table.options, "debugColumns", "getRightLeafColumns"));
		table.getCenterLeafColumns = memo(() => [
			table.getAllLeafColumns(),
			table.getState().columnPinning.left,
			table.getState().columnPinning.right
		], (allColumns, left, right) => {
			const leftAndRight = [...left != null ? left : [], ...right != null ? right : []];
			return allColumns.filter((d) => !leftAndRight.includes(d.id));
		}, getMemoOptions(table.options, "debugColumns", "getCenterLeafColumns"));
	}
};
function safelyAccessDocument(_document) {
	return _document || (typeof document !== "undefined" ? document : null);
}
var defaultColumnSizing = {
	size: 150,
	minSize: 20,
	maxSize: Number.MAX_SAFE_INTEGER
};
var getDefaultColumnSizingInfoState = () => ({
	startOffset: null,
	startSize: null,
	deltaOffset: null,
	deltaPercentage: null,
	isResizingColumn: false,
	columnSizingStart: []
});
var ColumnSizing = {
	getDefaultColumnDef: () => {
		return defaultColumnSizing;
	},
	getInitialState: (state) => {
		return {
			columnSizing: {},
			columnSizingInfo: getDefaultColumnSizingInfoState(),
			...state
		};
	},
	getDefaultOptions: (table) => {
		return {
			columnResizeMode: "onEnd",
			columnResizeDirection: "ltr",
			onColumnSizingChange: makeStateUpdater("columnSizing", table),
			onColumnSizingInfoChange: makeStateUpdater("columnSizingInfo", table)
		};
	},
	createColumn: (column, table) => {
		column.getSize = () => {
			var _column$columnDef$min, _ref, _column$columnDef$max;
			const columnSize = table.getState().columnSizing[column.id];
			return Math.min(Math.max((_column$columnDef$min = column.columnDef.minSize) != null ? _column$columnDef$min : defaultColumnSizing.minSize, (_ref = columnSize != null ? columnSize : column.columnDef.size) != null ? _ref : defaultColumnSizing.size), (_column$columnDef$max = column.columnDef.maxSize) != null ? _column$columnDef$max : defaultColumnSizing.maxSize);
		};
		column.getStart = memo((position) => [
			position,
			_getVisibleLeafColumns(table, position),
			table.getState().columnSizing
		], (position, columns) => columns.slice(0, column.getIndex(position)).reduce((sum, column) => sum + column.getSize(), 0), getMemoOptions(table.options, "debugColumns", "getStart"));
		column.getAfter = memo((position) => [
			position,
			_getVisibleLeafColumns(table, position),
			table.getState().columnSizing
		], (position, columns) => columns.slice(column.getIndex(position) + 1).reduce((sum, column) => sum + column.getSize(), 0), getMemoOptions(table.options, "debugColumns", "getAfter"));
		column.resetSize = () => {
			table.setColumnSizing((_ref2) => {
				let { [column.id]: _, ...rest } = _ref2;
				return rest;
			});
		};
		column.getCanResize = () => {
			var _column$columnDef$ena, _table$options$enable;
			return ((_column$columnDef$ena = column.columnDef.enableResizing) != null ? _column$columnDef$ena : true) && ((_table$options$enable = table.options.enableColumnResizing) != null ? _table$options$enable : true);
		};
		column.getIsResizing = () => {
			return table.getState().columnSizingInfo.isResizingColumn === column.id;
		};
	},
	createHeader: (header, table) => {
		header.getSize = () => {
			let sum = 0;
			const recurse = (header) => {
				if (header.subHeaders.length) header.subHeaders.forEach(recurse);
				else {
					var _header$column$getSiz;
					sum += (_header$column$getSiz = header.column.getSize()) != null ? _header$column$getSiz : 0;
				}
			};
			recurse(header);
			return sum;
		};
		header.getStart = () => {
			if (header.index > 0) {
				const prevSiblingHeader = header.headerGroup.headers[header.index - 1];
				return prevSiblingHeader.getStart() + prevSiblingHeader.getSize();
			}
			return 0;
		};
		header.getResizeHandler = (_contextDocument) => {
			const column = table.getColumn(header.column.id);
			const canResize = column == null ? void 0 : column.getCanResize();
			return (e) => {
				if (!column || !canResize) return;
				e.persist == null || e.persist();
				if (isTouchStartEvent(e)) {
					if (e.touches && e.touches.length > 1) return;
				}
				const startSize = header.getSize();
				const columnSizingStart = header ? header.getLeafHeaders().map((d) => [d.column.id, d.column.getSize()]) : [[column.id, column.getSize()]];
				const clientX = isTouchStartEvent(e) ? Math.round(e.touches[0].clientX) : e.clientX;
				const newColumnSizing = {};
				const updateOffset = (eventType, clientXPos) => {
					if (typeof clientXPos !== "number") return;
					table.setColumnSizingInfo((old) => {
						var _old$startOffset, _old$startSize;
						const deltaDirection = table.options.columnResizeDirection === "rtl" ? -1 : 1;
						const deltaOffset = (clientXPos - ((_old$startOffset = old == null ? void 0 : old.startOffset) != null ? _old$startOffset : 0)) * deltaDirection;
						const deltaPercentage = Math.max(deltaOffset / ((_old$startSize = old == null ? void 0 : old.startSize) != null ? _old$startSize : 0), -.999999);
						old.columnSizingStart.forEach((_ref3) => {
							let [columnId, headerSize] = _ref3;
							newColumnSizing[columnId] = Math.round(Math.max(headerSize + headerSize * deltaPercentage, 0) * 100) / 100;
						});
						return {
							...old,
							deltaOffset,
							deltaPercentage
						};
					});
					if (table.options.columnResizeMode === "onChange" || eventType === "end") table.setColumnSizing((old) => ({
						...old,
						...newColumnSizing
					}));
				};
				const onMove = (clientXPos) => updateOffset("move", clientXPos);
				const onEnd = (clientXPos) => {
					updateOffset("end", clientXPos);
					table.setColumnSizingInfo((old) => ({
						...old,
						isResizingColumn: false,
						startOffset: null,
						startSize: null,
						deltaOffset: null,
						deltaPercentage: null,
						columnSizingStart: []
					}));
				};
				const contextDocument = safelyAccessDocument(_contextDocument);
				const mouseEvents = {
					moveHandler: (e) => onMove(e.clientX),
					upHandler: (e) => {
						contextDocument?.removeEventListener("mousemove", mouseEvents.moveHandler);
						contextDocument?.removeEventListener("mouseup", mouseEvents.upHandler);
						onEnd(e.clientX);
					}
				};
				const touchEvents = {
					moveHandler: (e) => {
						if (e.cancelable) {
							e.preventDefault();
							e.stopPropagation();
						}
						onMove(e.touches[0].clientX);
						return false;
					},
					upHandler: (e) => {
						var _e$touches$;
						contextDocument?.removeEventListener("touchmove", touchEvents.moveHandler);
						contextDocument?.removeEventListener("touchend", touchEvents.upHandler);
						if (e.cancelable) {
							e.preventDefault();
							e.stopPropagation();
						}
						onEnd((_e$touches$ = e.touches[0]) == null ? void 0 : _e$touches$.clientX);
					}
				};
				const passiveIfSupported = passiveEventSupported() ? { passive: false } : false;
				if (isTouchStartEvent(e)) {
					contextDocument?.addEventListener("touchmove", touchEvents.moveHandler, passiveIfSupported);
					contextDocument?.addEventListener("touchend", touchEvents.upHandler, passiveIfSupported);
				} else {
					contextDocument?.addEventListener("mousemove", mouseEvents.moveHandler, passiveIfSupported);
					contextDocument?.addEventListener("mouseup", mouseEvents.upHandler, passiveIfSupported);
				}
				table.setColumnSizingInfo((old) => ({
					...old,
					startOffset: clientX,
					startSize,
					deltaOffset: 0,
					deltaPercentage: 0,
					columnSizingStart,
					isResizingColumn: column.id
				}));
			};
		};
	},
	createTable: (table) => {
		table.setColumnSizing = (updater) => table.options.onColumnSizingChange == null ? void 0 : table.options.onColumnSizingChange(updater);
		table.setColumnSizingInfo = (updater) => table.options.onColumnSizingInfoChange == null ? void 0 : table.options.onColumnSizingInfoChange(updater);
		table.resetColumnSizing = (defaultState) => {
			var _table$initialState$c;
			table.setColumnSizing(defaultState ? {} : (_table$initialState$c = table.initialState.columnSizing) != null ? _table$initialState$c : {});
		};
		table.resetHeaderSizeInfo = (defaultState) => {
			var _table$initialState$c2;
			table.setColumnSizingInfo(defaultState ? getDefaultColumnSizingInfoState() : (_table$initialState$c2 = table.initialState.columnSizingInfo) != null ? _table$initialState$c2 : getDefaultColumnSizingInfoState());
		};
		table.getTotalSize = () => {
			var _table$getHeaderGroup, _table$getHeaderGroup2;
			return (_table$getHeaderGroup = (_table$getHeaderGroup2 = table.getHeaderGroups()[0]) == null ? void 0 : _table$getHeaderGroup2.headers.reduce((sum, header) => {
				return sum + header.getSize();
			}, 0)) != null ? _table$getHeaderGroup : 0;
		};
		table.getLeftTotalSize = () => {
			var _table$getLeftHeaderG, _table$getLeftHeaderG2;
			return (_table$getLeftHeaderG = (_table$getLeftHeaderG2 = table.getLeftHeaderGroups()[0]) == null ? void 0 : _table$getLeftHeaderG2.headers.reduce((sum, header) => {
				return sum + header.getSize();
			}, 0)) != null ? _table$getLeftHeaderG : 0;
		};
		table.getCenterTotalSize = () => {
			var _table$getCenterHeade, _table$getCenterHeade2;
			return (_table$getCenterHeade = (_table$getCenterHeade2 = table.getCenterHeaderGroups()[0]) == null ? void 0 : _table$getCenterHeade2.headers.reduce((sum, header) => {
				return sum + header.getSize();
			}, 0)) != null ? _table$getCenterHeade : 0;
		};
		table.getRightTotalSize = () => {
			var _table$getRightHeader, _table$getRightHeader2;
			return (_table$getRightHeader = (_table$getRightHeader2 = table.getRightHeaderGroups()[0]) == null ? void 0 : _table$getRightHeader2.headers.reduce((sum, header) => {
				return sum + header.getSize();
			}, 0)) != null ? _table$getRightHeader : 0;
		};
	}
};
var passiveSupported = null;
function passiveEventSupported() {
	if (typeof passiveSupported === "boolean") return passiveSupported;
	let supported = false;
	try {
		const options = { get passive() {
			supported = true;
			return false;
		} };
		const noop = () => {};
		window.addEventListener("test", noop, options);
		window.removeEventListener("test", noop);
	} catch (err) {
		supported = false;
	}
	passiveSupported = supported;
	return passiveSupported;
}
function isTouchStartEvent(e) {
	return e.type === "touchstart";
}
var ColumnVisibility = {
	getInitialState: (state) => {
		return {
			columnVisibility: {},
			...state
		};
	},
	getDefaultOptions: (table) => {
		return { onColumnVisibilityChange: makeStateUpdater("columnVisibility", table) };
	},
	createColumn: (column, table) => {
		column.toggleVisibility = (value) => {
			if (column.getCanHide()) table.setColumnVisibility((old) => ({
				...old,
				[column.id]: value != null ? value : !column.getIsVisible()
			}));
		};
		column.getIsVisible = () => {
			var _ref, _table$getState$colum;
			const childColumns = column.columns;
			return (_ref = childColumns.length ? childColumns.some((c) => c.getIsVisible()) : (_table$getState$colum = table.getState().columnVisibility) == null ? void 0 : _table$getState$colum[column.id]) != null ? _ref : true;
		};
		column.getCanHide = () => {
			var _column$columnDef$ena, _table$options$enable;
			return ((_column$columnDef$ena = column.columnDef.enableHiding) != null ? _column$columnDef$ena : true) && ((_table$options$enable = table.options.enableHiding) != null ? _table$options$enable : true);
		};
		column.getToggleVisibilityHandler = () => {
			return (e) => {
				column.toggleVisibility == null || column.toggleVisibility(e.target.checked);
			};
		};
	},
	createRow: (row, table) => {
		row._getAllVisibleCells = memo(() => [row.getAllCells(), table.getState().columnVisibility], (cells) => {
			return cells.filter((cell) => cell.column.getIsVisible());
		}, getMemoOptions(table.options, "debugRows", "_getAllVisibleCells"));
		row.getVisibleCells = memo(() => [
			row.getLeftVisibleCells(),
			row.getCenterVisibleCells(),
			row.getRightVisibleCells()
		], (left, center, right) => [
			...left,
			...center,
			...right
		], getMemoOptions(table.options, "debugRows", "getVisibleCells"));
	},
	createTable: (table) => {
		const makeVisibleColumnsMethod = (key, getColumns) => {
			return memo(() => [getColumns(), getColumns().filter((d) => d.getIsVisible()).map((d) => d.id).join("_")], (columns) => {
				return columns.filter((d) => d.getIsVisible == null ? void 0 : d.getIsVisible());
			}, getMemoOptions(table.options, "debugColumns", key));
		};
		table.getVisibleFlatColumns = makeVisibleColumnsMethod("getVisibleFlatColumns", () => table.getAllFlatColumns());
		table.getVisibleLeafColumns = makeVisibleColumnsMethod("getVisibleLeafColumns", () => table.getAllLeafColumns());
		table.getLeftVisibleLeafColumns = makeVisibleColumnsMethod("getLeftVisibleLeafColumns", () => table.getLeftLeafColumns());
		table.getRightVisibleLeafColumns = makeVisibleColumnsMethod("getRightVisibleLeafColumns", () => table.getRightLeafColumns());
		table.getCenterVisibleLeafColumns = makeVisibleColumnsMethod("getCenterVisibleLeafColumns", () => table.getCenterLeafColumns());
		table.setColumnVisibility = (updater) => table.options.onColumnVisibilityChange == null ? void 0 : table.options.onColumnVisibilityChange(updater);
		table.resetColumnVisibility = (defaultState) => {
			var _table$initialState$c;
			table.setColumnVisibility(defaultState ? {} : (_table$initialState$c = table.initialState.columnVisibility) != null ? _table$initialState$c : {});
		};
		table.toggleAllColumnsVisible = (value) => {
			var _value;
			value = (_value = value) != null ? _value : !table.getIsAllColumnsVisible();
			table.setColumnVisibility(table.getAllLeafColumns().reduce((obj, column) => ({
				...obj,
				[column.id]: !value ? !(column.getCanHide != null && column.getCanHide()) : value
			}), {}));
		};
		table.getIsAllColumnsVisible = () => !table.getAllLeafColumns().some((column) => !(column.getIsVisible != null && column.getIsVisible()));
		table.getIsSomeColumnsVisible = () => table.getAllLeafColumns().some((column) => column.getIsVisible == null ? void 0 : column.getIsVisible());
		table.getToggleAllColumnsVisibilityHandler = () => {
			return (e) => {
				var _target;
				table.toggleAllColumnsVisible((_target = e.target) == null ? void 0 : _target.checked);
			};
		};
	}
};
function _getVisibleLeafColumns(table, position) {
	return !position ? table.getVisibleLeafColumns() : position === "center" ? table.getCenterVisibleLeafColumns() : position === "left" ? table.getLeftVisibleLeafColumns() : table.getRightVisibleLeafColumns();
}
var GlobalFaceting = { createTable: (table) => {
	table._getGlobalFacetedRowModel = table.options.getFacetedRowModel && table.options.getFacetedRowModel(table, "__global__");
	table.getGlobalFacetedRowModel = () => {
		if (table.options.manualFiltering || !table._getGlobalFacetedRowModel) return table.getPreFilteredRowModel();
		return table._getGlobalFacetedRowModel();
	};
	table._getGlobalFacetedUniqueValues = table.options.getFacetedUniqueValues && table.options.getFacetedUniqueValues(table, "__global__");
	table.getGlobalFacetedUniqueValues = () => {
		if (!table._getGlobalFacetedUniqueValues) return /* @__PURE__ */ new Map();
		return table._getGlobalFacetedUniqueValues();
	};
	table._getGlobalFacetedMinMaxValues = table.options.getFacetedMinMaxValues && table.options.getFacetedMinMaxValues(table, "__global__");
	table.getGlobalFacetedMinMaxValues = () => {
		if (!table._getGlobalFacetedMinMaxValues) return;
		return table._getGlobalFacetedMinMaxValues();
	};
} };
var GlobalFiltering = {
	getInitialState: (state) => {
		return {
			globalFilter: void 0,
			...state
		};
	},
	getDefaultOptions: (table) => {
		return {
			onGlobalFilterChange: makeStateUpdater("globalFilter", table),
			globalFilterFn: "auto",
			getColumnCanGlobalFilter: (column) => {
				var _table$getCoreRowMode;
				const value = (_table$getCoreRowMode = table.getCoreRowModel().flatRows[0]) == null || (_table$getCoreRowMode = _table$getCoreRowMode._getAllCellsByColumnId()[column.id]) == null ? void 0 : _table$getCoreRowMode.getValue();
				return typeof value === "string" || typeof value === "number";
			}
		};
	},
	createColumn: (column, table) => {
		column.getCanGlobalFilter = () => {
			var _column$columnDef$ena, _table$options$enable, _table$options$enable2, _table$options$getCol;
			return ((_column$columnDef$ena = column.columnDef.enableGlobalFilter) != null ? _column$columnDef$ena : true) && ((_table$options$enable = table.options.enableGlobalFilter) != null ? _table$options$enable : true) && ((_table$options$enable2 = table.options.enableFilters) != null ? _table$options$enable2 : true) && ((_table$options$getCol = table.options.getColumnCanGlobalFilter == null ? void 0 : table.options.getColumnCanGlobalFilter(column)) != null ? _table$options$getCol : true) && !!column.accessorFn;
		};
	},
	createTable: (table) => {
		table.getGlobalAutoFilterFn = () => {
			return filterFns.includesString;
		};
		table.getGlobalFilterFn = () => {
			var _table$options$filter, _table$options$filter2;
			const { globalFilterFn } = table.options;
			return isFunction(globalFilterFn) ? globalFilterFn : globalFilterFn === "auto" ? table.getGlobalAutoFilterFn() : (_table$options$filter = (_table$options$filter2 = table.options.filterFns) == null ? void 0 : _table$options$filter2[globalFilterFn]) != null ? _table$options$filter : filterFns[globalFilterFn];
		};
		table.setGlobalFilter = (updater) => {
			table.options.onGlobalFilterChange == null || table.options.onGlobalFilterChange(updater);
		};
		table.resetGlobalFilter = (defaultState) => {
			table.setGlobalFilter(defaultState ? void 0 : table.initialState.globalFilter);
		};
	}
};
var RowExpanding = {
	getInitialState: (state) => {
		return {
			expanded: {},
			...state
		};
	},
	getDefaultOptions: (table) => {
		return {
			onExpandedChange: makeStateUpdater("expanded", table),
			paginateExpandedRows: true
		};
	},
	createTable: (table) => {
		let registered = false;
		let queued = false;
		table._autoResetExpanded = () => {
			var _ref, _table$options$autoRe;
			if (!registered) {
				table._queue(() => {
					registered = true;
				});
				return;
			}
			if ((_ref = (_table$options$autoRe = table.options.autoResetAll) != null ? _table$options$autoRe : table.options.autoResetExpanded) != null ? _ref : !table.options.manualExpanding) {
				if (queued) return;
				queued = true;
				table._queue(() => {
					table.resetExpanded();
					queued = false;
				});
			}
		};
		table.setExpanded = (updater) => table.options.onExpandedChange == null ? void 0 : table.options.onExpandedChange(updater);
		table.toggleAllRowsExpanded = (expanded) => {
			if (expanded != null ? expanded : !table.getIsAllRowsExpanded()) table.setExpanded(true);
			else table.setExpanded({});
		};
		table.resetExpanded = (defaultState) => {
			var _table$initialState$e, _table$initialState;
			table.setExpanded(defaultState ? {} : (_table$initialState$e = (_table$initialState = table.initialState) == null ? void 0 : _table$initialState.expanded) != null ? _table$initialState$e : {});
		};
		table.getCanSomeRowsExpand = () => {
			return table.getPrePaginationRowModel().flatRows.some((row) => row.getCanExpand());
		};
		table.getToggleAllRowsExpandedHandler = () => {
			return (e) => {
				e.persist == null || e.persist();
				table.toggleAllRowsExpanded();
			};
		};
		table.getIsSomeRowsExpanded = () => {
			const expanded = table.getState().expanded;
			return expanded === true || Object.values(expanded).some(Boolean);
		};
		table.getIsAllRowsExpanded = () => {
			const expanded = table.getState().expanded;
			if (typeof expanded === "boolean") return expanded === true;
			if (!Object.keys(expanded).length) return false;
			if (table.getRowModel().flatRows.some((row) => !row.getIsExpanded())) return false;
			return true;
		};
		table.getExpandedDepth = () => {
			let maxDepth = 0;
			(table.getState().expanded === true ? Object.keys(table.getRowModel().rowsById) : Object.keys(table.getState().expanded)).forEach((id) => {
				const splitId = id.split(".");
				maxDepth = Math.max(maxDepth, splitId.length);
			});
			return maxDepth;
		};
		table.getPreExpandedRowModel = () => table.getSortedRowModel();
		table.getExpandedRowModel = () => {
			if (!table._getExpandedRowModel && table.options.getExpandedRowModel) table._getExpandedRowModel = table.options.getExpandedRowModel(table);
			if (table.options.manualExpanding || !table._getExpandedRowModel) return table.getPreExpandedRowModel();
			return table._getExpandedRowModel();
		};
	},
	createRow: (row, table) => {
		row.toggleExpanded = (expanded) => {
			table.setExpanded((old) => {
				var _expanded;
				const exists = old === true ? true : !!(old != null && old[row.id]);
				let oldExpanded = {};
				if (old === true) Object.keys(table.getRowModel().rowsById).forEach((rowId) => {
					oldExpanded[rowId] = true;
				});
				else oldExpanded = old;
				expanded = (_expanded = expanded) != null ? _expanded : !exists;
				if (!exists && expanded) return {
					...oldExpanded,
					[row.id]: true
				};
				if (exists && !expanded) {
					const { [row.id]: _, ...rest } = oldExpanded;
					return rest;
				}
				return old;
			});
		};
		row.getIsExpanded = () => {
			var _table$options$getIsR;
			const expanded = table.getState().expanded;
			return !!((_table$options$getIsR = table.options.getIsRowExpanded == null ? void 0 : table.options.getIsRowExpanded(row)) != null ? _table$options$getIsR : expanded === true || (expanded == null ? void 0 : expanded[row.id]));
		};
		row.getCanExpand = () => {
			var _table$options$getRow, _table$options$enable, _row$subRows;
			return (_table$options$getRow = table.options.getRowCanExpand == null ? void 0 : table.options.getRowCanExpand(row)) != null ? _table$options$getRow : ((_table$options$enable = table.options.enableExpanding) != null ? _table$options$enable : true) && !!((_row$subRows = row.subRows) != null && _row$subRows.length);
		};
		row.getIsAllParentsExpanded = () => {
			let isFullyExpanded = true;
			let currentRow = row;
			while (isFullyExpanded && currentRow.parentId) {
				currentRow = table.getRow(currentRow.parentId, true);
				isFullyExpanded = currentRow.getIsExpanded();
			}
			return isFullyExpanded;
		};
		row.getToggleExpandedHandler = () => {
			const canExpand = row.getCanExpand();
			return () => {
				if (!canExpand) return;
				row.toggleExpanded();
			};
		};
	}
};
var defaultPageIndex = 0;
var defaultPageSize = 10;
var getDefaultPaginationState = () => ({
	pageIndex: defaultPageIndex,
	pageSize: defaultPageSize
});
var RowPagination = {
	getInitialState: (state) => {
		return {
			...state,
			pagination: {
				...getDefaultPaginationState(),
				...state == null ? void 0 : state.pagination
			}
		};
	},
	getDefaultOptions: (table) => {
		return { onPaginationChange: makeStateUpdater("pagination", table) };
	},
	createTable: (table) => {
		let registered = false;
		let queued = false;
		table._autoResetPageIndex = () => {
			var _ref, _table$options$autoRe;
			if (!registered) {
				table._queue(() => {
					registered = true;
				});
				return;
			}
			if ((_ref = (_table$options$autoRe = table.options.autoResetAll) != null ? _table$options$autoRe : table.options.autoResetPageIndex) != null ? _ref : !table.options.manualPagination) {
				if (queued) return;
				queued = true;
				table._queue(() => {
					table.resetPageIndex();
					queued = false;
				});
			}
		};
		table.setPagination = (updater) => {
			const safeUpdater = (old) => {
				return functionalUpdate(updater, old);
			};
			return table.options.onPaginationChange == null ? void 0 : table.options.onPaginationChange(safeUpdater);
		};
		table.resetPagination = (defaultState) => {
			var _table$initialState$p;
			table.setPagination(defaultState ? getDefaultPaginationState() : (_table$initialState$p = table.initialState.pagination) != null ? _table$initialState$p : getDefaultPaginationState());
		};
		table.setPageIndex = (updater) => {
			table.setPagination((old) => {
				let pageIndex = functionalUpdate(updater, old.pageIndex);
				const maxPageIndex = typeof table.options.pageCount === "undefined" || table.options.pageCount === -1 ? Number.MAX_SAFE_INTEGER : table.options.pageCount - 1;
				pageIndex = Math.max(0, Math.min(pageIndex, maxPageIndex));
				return {
					...old,
					pageIndex
				};
			});
		};
		table.resetPageIndex = (defaultState) => {
			var _table$initialState$p2, _table$initialState;
			table.setPageIndex(defaultState ? defaultPageIndex : (_table$initialState$p2 = (_table$initialState = table.initialState) == null || (_table$initialState = _table$initialState.pagination) == null ? void 0 : _table$initialState.pageIndex) != null ? _table$initialState$p2 : defaultPageIndex);
		};
		table.resetPageSize = (defaultState) => {
			var _table$initialState$p3, _table$initialState2;
			table.setPageSize(defaultState ? defaultPageSize : (_table$initialState$p3 = (_table$initialState2 = table.initialState) == null || (_table$initialState2 = _table$initialState2.pagination) == null ? void 0 : _table$initialState2.pageSize) != null ? _table$initialState$p3 : defaultPageSize);
		};
		table.setPageSize = (updater) => {
			table.setPagination((old) => {
				const pageSize = Math.max(1, functionalUpdate(updater, old.pageSize));
				const topRowIndex = old.pageSize * old.pageIndex;
				const pageIndex = Math.floor(topRowIndex / pageSize);
				return {
					...old,
					pageIndex,
					pageSize
				};
			});
		};
		table.setPageCount = (updater) => table.setPagination((old) => {
			var _table$options$pageCo;
			let newPageCount = functionalUpdate(updater, (_table$options$pageCo = table.options.pageCount) != null ? _table$options$pageCo : -1);
			if (typeof newPageCount === "number") newPageCount = Math.max(-1, newPageCount);
			return {
				...old,
				pageCount: newPageCount
			};
		});
		table.getPageOptions = memo(() => [table.getPageCount()], (pageCount) => {
			let pageOptions = [];
			if (pageCount && pageCount > 0) pageOptions = [...new Array(pageCount)].fill(null).map((_, i) => i);
			return pageOptions;
		}, getMemoOptions(table.options, "debugTable", "getPageOptions"));
		table.getCanPreviousPage = () => table.getState().pagination.pageIndex > 0;
		table.getCanNextPage = () => {
			const { pageIndex } = table.getState().pagination;
			const pageCount = table.getPageCount();
			if (pageCount === -1) return true;
			if (pageCount === 0) return false;
			return pageIndex < pageCount - 1;
		};
		table.previousPage = () => {
			return table.setPageIndex((old) => old - 1);
		};
		table.nextPage = () => {
			return table.setPageIndex((old) => {
				return old + 1;
			});
		};
		table.firstPage = () => {
			return table.setPageIndex(0);
		};
		table.lastPage = () => {
			return table.setPageIndex(table.getPageCount() - 1);
		};
		table.getPrePaginationRowModel = () => table.getExpandedRowModel();
		table.getPaginationRowModel = () => {
			if (!table._getPaginationRowModel && table.options.getPaginationRowModel) table._getPaginationRowModel = table.options.getPaginationRowModel(table);
			if (table.options.manualPagination || !table._getPaginationRowModel) return table.getPrePaginationRowModel();
			return table._getPaginationRowModel();
		};
		table.getPageCount = () => {
			var _table$options$pageCo2;
			return (_table$options$pageCo2 = table.options.pageCount) != null ? _table$options$pageCo2 : Math.ceil(table.getRowCount() / table.getState().pagination.pageSize);
		};
		table.getRowCount = () => {
			var _table$options$rowCou;
			return (_table$options$rowCou = table.options.rowCount) != null ? _table$options$rowCou : table.getPrePaginationRowModel().rows.length;
		};
	}
};
var getDefaultRowPinningState = () => ({
	top: [],
	bottom: []
});
var RowPinning = {
	getInitialState: (state) => {
		return {
			rowPinning: getDefaultRowPinningState(),
			...state
		};
	},
	getDefaultOptions: (table) => {
		return { onRowPinningChange: makeStateUpdater("rowPinning", table) };
	},
	createRow: (row, table) => {
		row.pin = (position, includeLeafRows, includeParentRows) => {
			const leafRowIds = includeLeafRows ? row.getLeafRows().map((_ref) => {
				let { id } = _ref;
				return id;
			}) : [];
			const parentRowIds = includeParentRows ? row.getParentRows().map((_ref2) => {
				let { id } = _ref2;
				return id;
			}) : [];
			const rowIds = new Set([
				...parentRowIds,
				row.id,
				...leafRowIds
			]);
			table.setRowPinning((old) => {
				var _old$top3, _old$bottom3;
				if (position === "bottom") {
					var _old$top, _old$bottom;
					return {
						top: ((_old$top = old == null ? void 0 : old.top) != null ? _old$top : []).filter((d) => !(rowIds != null && rowIds.has(d))),
						bottom: [...((_old$bottom = old == null ? void 0 : old.bottom) != null ? _old$bottom : []).filter((d) => !(rowIds != null && rowIds.has(d))), ...Array.from(rowIds)]
					};
				}
				if (position === "top") {
					var _old$top2, _old$bottom2;
					return {
						top: [...((_old$top2 = old == null ? void 0 : old.top) != null ? _old$top2 : []).filter((d) => !(rowIds != null && rowIds.has(d))), ...Array.from(rowIds)],
						bottom: ((_old$bottom2 = old == null ? void 0 : old.bottom) != null ? _old$bottom2 : []).filter((d) => !(rowIds != null && rowIds.has(d)))
					};
				}
				return {
					top: ((_old$top3 = old == null ? void 0 : old.top) != null ? _old$top3 : []).filter((d) => !(rowIds != null && rowIds.has(d))),
					bottom: ((_old$bottom3 = old == null ? void 0 : old.bottom) != null ? _old$bottom3 : []).filter((d) => !(rowIds != null && rowIds.has(d)))
				};
			});
		};
		row.getCanPin = () => {
			var _ref3;
			const { enableRowPinning, enablePinning } = table.options;
			if (typeof enableRowPinning === "function") return enableRowPinning(row);
			return (_ref3 = enableRowPinning != null ? enableRowPinning : enablePinning) != null ? _ref3 : true;
		};
		row.getIsPinned = () => {
			const rowIds = [row.id];
			const { top, bottom } = table.getState().rowPinning;
			const isTop = rowIds.some((d) => top == null ? void 0 : top.includes(d));
			const isBottom = rowIds.some((d) => bottom == null ? void 0 : bottom.includes(d));
			return isTop ? "top" : isBottom ? "bottom" : false;
		};
		row.getPinnedIndex = () => {
			var _ref4, _visiblePinnedRowIds$;
			const position = row.getIsPinned();
			if (!position) return -1;
			const visiblePinnedRowIds = (_ref4 = position === "top" ? table.getTopRows() : table.getBottomRows()) == null ? void 0 : _ref4.map((_ref5) => {
				let { id } = _ref5;
				return id;
			});
			return (_visiblePinnedRowIds$ = visiblePinnedRowIds == null ? void 0 : visiblePinnedRowIds.indexOf(row.id)) != null ? _visiblePinnedRowIds$ : -1;
		};
	},
	createTable: (table) => {
		table.setRowPinning = (updater) => table.options.onRowPinningChange == null ? void 0 : table.options.onRowPinningChange(updater);
		table.resetRowPinning = (defaultState) => {
			var _table$initialState$r, _table$initialState;
			return table.setRowPinning(defaultState ? getDefaultRowPinningState() : (_table$initialState$r = (_table$initialState = table.initialState) == null ? void 0 : _table$initialState.rowPinning) != null ? _table$initialState$r : getDefaultRowPinningState());
		};
		table.getIsSomeRowsPinned = (position) => {
			var _pinningState$positio;
			const pinningState = table.getState().rowPinning;
			if (!position) {
				var _pinningState$top, _pinningState$bottom;
				return Boolean(((_pinningState$top = pinningState.top) == null ? void 0 : _pinningState$top.length) || ((_pinningState$bottom = pinningState.bottom) == null ? void 0 : _pinningState$bottom.length));
			}
			return Boolean((_pinningState$positio = pinningState[position]) == null ? void 0 : _pinningState$positio.length);
		};
		table._getPinnedRows = (visibleRows, pinnedRowIds, position) => {
			var _table$options$keepPi;
			return (((_table$options$keepPi = table.options.keepPinnedRows) != null ? _table$options$keepPi : true) ? (pinnedRowIds != null ? pinnedRowIds : []).map((rowId) => {
				const row = table.getRow(rowId, true);
				return row.getIsAllParentsExpanded() ? row : null;
			}) : (pinnedRowIds != null ? pinnedRowIds : []).map((rowId) => visibleRows.find((row) => row.id === rowId))).filter(Boolean).map((d) => ({
				...d,
				position
			}));
		};
		table.getTopRows = memo(() => [table.getRowModel().rows, table.getState().rowPinning.top], (allRows, topPinnedRowIds) => table._getPinnedRows(allRows, topPinnedRowIds, "top"), getMemoOptions(table.options, "debugRows", "getTopRows"));
		table.getBottomRows = memo(() => [table.getRowModel().rows, table.getState().rowPinning.bottom], (allRows, bottomPinnedRowIds) => table._getPinnedRows(allRows, bottomPinnedRowIds, "bottom"), getMemoOptions(table.options, "debugRows", "getBottomRows"));
		table.getCenterRows = memo(() => [
			table.getRowModel().rows,
			table.getState().rowPinning.top,
			table.getState().rowPinning.bottom
		], (allRows, top, bottom) => {
			const topAndBottom = new Set([...top != null ? top : [], ...bottom != null ? bottom : []]);
			return allRows.filter((d) => !topAndBottom.has(d.id));
		}, getMemoOptions(table.options, "debugRows", "getCenterRows"));
	}
};
var RowSelection = {
	getInitialState: (state) => {
		return {
			rowSelection: {},
			...state
		};
	},
	getDefaultOptions: (table) => {
		return {
			onRowSelectionChange: makeStateUpdater("rowSelection", table),
			enableRowSelection: true,
			enableMultiRowSelection: true,
			enableSubRowSelection: true
		};
	},
	createTable: (table) => {
		table.setRowSelection = (updater) => table.options.onRowSelectionChange == null ? void 0 : table.options.onRowSelectionChange(updater);
		table.resetRowSelection = (defaultState) => {
			var _table$initialState$r;
			return table.setRowSelection(defaultState ? {} : (_table$initialState$r = table.initialState.rowSelection) != null ? _table$initialState$r : {});
		};
		table.toggleAllRowsSelected = (value) => {
			table.setRowSelection((old) => {
				value = typeof value !== "undefined" ? value : !table.getIsAllRowsSelected();
				const rowSelection = { ...old };
				const preGroupedFlatRows = table.getPreGroupedRowModel().flatRows;
				if (value) preGroupedFlatRows.forEach((row) => {
					if (!row.getCanSelect()) return;
					rowSelection[row.id] = true;
				});
				else preGroupedFlatRows.forEach((row) => {
					delete rowSelection[row.id];
				});
				return rowSelection;
			});
		};
		table.toggleAllPageRowsSelected = (value) => table.setRowSelection((old) => {
			const resolvedValue = typeof value !== "undefined" ? value : !table.getIsAllPageRowsSelected();
			const rowSelection = { ...old };
			table.getRowModel().rows.forEach((row) => {
				mutateRowIsSelected(rowSelection, row.id, resolvedValue, true, table);
			});
			return rowSelection;
		});
		table.getPreSelectedRowModel = () => table.getCoreRowModel();
		table.getSelectedRowModel = memo(() => [table.getState().rowSelection, table.getCoreRowModel()], (rowSelection, rowModel) => {
			if (!Object.keys(rowSelection).length) return {
				rows: [],
				flatRows: [],
				rowsById: {}
			};
			return selectRowsFn(table, rowModel);
		}, getMemoOptions(table.options, "debugTable", "getSelectedRowModel"));
		table.getFilteredSelectedRowModel = memo(() => [table.getState().rowSelection, table.getFilteredRowModel()], (rowSelection, rowModel) => {
			if (!Object.keys(rowSelection).length) return {
				rows: [],
				flatRows: [],
				rowsById: {}
			};
			return selectRowsFn(table, rowModel);
		}, getMemoOptions(table.options, "debugTable", "getFilteredSelectedRowModel"));
		table.getGroupedSelectedRowModel = memo(() => [table.getState().rowSelection, table.getSortedRowModel()], (rowSelection, rowModel) => {
			if (!Object.keys(rowSelection).length) return {
				rows: [],
				flatRows: [],
				rowsById: {}
			};
			return selectRowsFn(table, rowModel);
		}, getMemoOptions(table.options, "debugTable", "getGroupedSelectedRowModel"));
		table.getIsAllRowsSelected = () => {
			const preGroupedFlatRows = table.getFilteredRowModel().flatRows;
			const { rowSelection } = table.getState();
			let isAllRowsSelected = Boolean(preGroupedFlatRows.length && Object.keys(rowSelection).length);
			if (isAllRowsSelected) {
				if (preGroupedFlatRows.some((row) => row.getCanSelect() && !rowSelection[row.id])) isAllRowsSelected = false;
			}
			return isAllRowsSelected;
		};
		table.getIsAllPageRowsSelected = () => {
			const paginationFlatRows = table.getPaginationRowModel().flatRows.filter((row) => row.getCanSelect());
			const { rowSelection } = table.getState();
			let isAllPageRowsSelected = !!paginationFlatRows.length;
			if (isAllPageRowsSelected && paginationFlatRows.some((row) => !rowSelection[row.id])) isAllPageRowsSelected = false;
			return isAllPageRowsSelected;
		};
		table.getIsSomeRowsSelected = () => {
			var _table$getState$rowSe;
			const totalSelected = Object.keys((_table$getState$rowSe = table.getState().rowSelection) != null ? _table$getState$rowSe : {}).length;
			return totalSelected > 0 && totalSelected < table.getFilteredRowModel().flatRows.length;
		};
		table.getIsSomePageRowsSelected = () => {
			const paginationFlatRows = table.getPaginationRowModel().flatRows;
			return table.getIsAllPageRowsSelected() ? false : paginationFlatRows.filter((row) => row.getCanSelect()).some((d) => d.getIsSelected() || d.getIsSomeSelected());
		};
		table.getToggleAllRowsSelectedHandler = () => {
			return (e) => {
				table.toggleAllRowsSelected(e.target.checked);
			};
		};
		table.getToggleAllPageRowsSelectedHandler = () => {
			return (e) => {
				table.toggleAllPageRowsSelected(e.target.checked);
			};
		};
	},
	createRow: (row, table) => {
		row.toggleSelected = (value, opts) => {
			const isSelected = row.getIsSelected();
			table.setRowSelection((old) => {
				var _opts$selectChildren;
				value = typeof value !== "undefined" ? value : !isSelected;
				if (row.getCanSelect() && isSelected === value) return old;
				const selectedRowIds = { ...old };
				mutateRowIsSelected(selectedRowIds, row.id, value, (_opts$selectChildren = opts == null ? void 0 : opts.selectChildren) != null ? _opts$selectChildren : true, table);
				return selectedRowIds;
			});
		};
		row.getIsSelected = () => {
			const { rowSelection } = table.getState();
			return isRowSelected(row, rowSelection);
		};
		row.getIsSomeSelected = () => {
			const { rowSelection } = table.getState();
			return isSubRowSelected(row, rowSelection) === "some";
		};
		row.getIsAllSubRowsSelected = () => {
			const { rowSelection } = table.getState();
			return isSubRowSelected(row, rowSelection) === "all";
		};
		row.getCanSelect = () => {
			var _table$options$enable;
			if (typeof table.options.enableRowSelection === "function") return table.options.enableRowSelection(row);
			return (_table$options$enable = table.options.enableRowSelection) != null ? _table$options$enable : true;
		};
		row.getCanSelectSubRows = () => {
			var _table$options$enable2;
			if (typeof table.options.enableSubRowSelection === "function") return table.options.enableSubRowSelection(row);
			return (_table$options$enable2 = table.options.enableSubRowSelection) != null ? _table$options$enable2 : true;
		};
		row.getCanMultiSelect = () => {
			var _table$options$enable3;
			if (typeof table.options.enableMultiRowSelection === "function") return table.options.enableMultiRowSelection(row);
			return (_table$options$enable3 = table.options.enableMultiRowSelection) != null ? _table$options$enable3 : true;
		};
		row.getToggleSelectedHandler = () => {
			const canSelect = row.getCanSelect();
			return (e) => {
				var _target;
				if (!canSelect) return;
				row.toggleSelected((_target = e.target) == null ? void 0 : _target.checked);
			};
		};
	}
};
var mutateRowIsSelected = (selectedRowIds, id, value, includeChildren, table) => {
	var _row$subRows;
	const row = table.getRow(id, true);
	if (value) {
		if (!row.getCanMultiSelect()) Object.keys(selectedRowIds).forEach((key) => delete selectedRowIds[key]);
		if (row.getCanSelect()) selectedRowIds[id] = true;
	} else delete selectedRowIds[id];
	if (includeChildren && (_row$subRows = row.subRows) != null && _row$subRows.length && row.getCanSelectSubRows()) row.subRows.forEach((row) => mutateRowIsSelected(selectedRowIds, row.id, value, includeChildren, table));
};
function selectRowsFn(table, rowModel) {
	const rowSelection = table.getState().rowSelection;
	const newSelectedFlatRows = [];
	const newSelectedRowsById = {};
	const recurseRows = function(rows, depth) {
		return rows.map((row) => {
			var _row$subRows2;
			const isSelected = isRowSelected(row, rowSelection);
			if (isSelected) {
				newSelectedFlatRows.push(row);
				newSelectedRowsById[row.id] = row;
			}
			if ((_row$subRows2 = row.subRows) != null && _row$subRows2.length) row = {
				...row,
				subRows: recurseRows(row.subRows)
			};
			if (isSelected) return row;
		}).filter(Boolean);
	};
	return {
		rows: recurseRows(rowModel.rows),
		flatRows: newSelectedFlatRows,
		rowsById: newSelectedRowsById
	};
}
function isRowSelected(row, selection) {
	var _selection$row$id;
	return (_selection$row$id = selection[row.id]) != null ? _selection$row$id : false;
}
function isSubRowSelected(row, selection, table) {
	var _row$subRows3;
	if (!((_row$subRows3 = row.subRows) != null && _row$subRows3.length)) return false;
	let allChildrenSelected = true;
	let someSelected = false;
	row.subRows.forEach((subRow) => {
		if (someSelected && !allChildrenSelected) return;
		if (subRow.getCanSelect()) if (isRowSelected(subRow, selection)) someSelected = true;
		else allChildrenSelected = false;
		if (subRow.subRows && subRow.subRows.length) {
			const subRowChildrenSelected = isSubRowSelected(subRow, selection);
			if (subRowChildrenSelected === "all") someSelected = true;
			else if (subRowChildrenSelected === "some") {
				someSelected = true;
				allChildrenSelected = false;
			} else allChildrenSelected = false;
		}
	});
	return allChildrenSelected ? "all" : someSelected ? "some" : false;
}
var reSplitAlphaNumeric = /([0-9]+)/gm;
var alphanumeric = (rowA, rowB, columnId) => {
	return compareAlphanumeric(toString(rowA.getValue(columnId)).toLowerCase(), toString(rowB.getValue(columnId)).toLowerCase());
};
var alphanumericCaseSensitive = (rowA, rowB, columnId) => {
	return compareAlphanumeric(toString(rowA.getValue(columnId)), toString(rowB.getValue(columnId)));
};
var text = (rowA, rowB, columnId) => {
	return compareBasic(toString(rowA.getValue(columnId)).toLowerCase(), toString(rowB.getValue(columnId)).toLowerCase());
};
var textCaseSensitive = (rowA, rowB, columnId) => {
	return compareBasic(toString(rowA.getValue(columnId)), toString(rowB.getValue(columnId)));
};
var datetime = (rowA, rowB, columnId) => {
	const a = rowA.getValue(columnId);
	const b = rowB.getValue(columnId);
	return a > b ? 1 : a < b ? -1 : 0;
};
var basic = (rowA, rowB, columnId) => {
	return compareBasic(rowA.getValue(columnId), rowB.getValue(columnId));
};
function compareBasic(a, b) {
	return a === b ? 0 : a > b ? 1 : -1;
}
function toString(a) {
	if (typeof a === "number") {
		if (isNaN(a) || a === Infinity || a === -Infinity) return "";
		return String(a);
	}
	if (typeof a === "string") return a;
	return "";
}
function compareAlphanumeric(aStr, bStr) {
	const a = aStr.split(reSplitAlphaNumeric).filter(Boolean);
	const b = bStr.split(reSplitAlphaNumeric).filter(Boolean);
	while (a.length && b.length) {
		const aa = a.shift();
		const bb = b.shift();
		const an = parseInt(aa, 10);
		const bn = parseInt(bb, 10);
		const combo = [an, bn].sort();
		if (isNaN(combo[0])) {
			if (aa > bb) return 1;
			if (bb > aa) return -1;
			continue;
		}
		if (isNaN(combo[1])) return isNaN(an) ? -1 : 1;
		if (an > bn) return 1;
		if (bn > an) return -1;
	}
	return a.length - b.length;
}
var sortingFns = {
	alphanumeric,
	alphanumericCaseSensitive,
	text,
	textCaseSensitive,
	datetime,
	basic
};
var builtInFeatures = [
	Headers,
	ColumnVisibility,
	ColumnOrdering,
	ColumnPinning,
	ColumnFaceting,
	ColumnFiltering,
	GlobalFaceting,
	GlobalFiltering,
	{
		getInitialState: (state) => {
			return {
				sorting: [],
				...state
			};
		},
		getDefaultColumnDef: () => {
			return {
				sortingFn: "auto",
				sortUndefined: 1
			};
		},
		getDefaultOptions: (table) => {
			return {
				onSortingChange: makeStateUpdater("sorting", table),
				isMultiSortEvent: (e) => {
					return e.shiftKey;
				}
			};
		},
		createColumn: (column, table) => {
			column.getAutoSortingFn = () => {
				const firstRows = table.getFilteredRowModel().flatRows.slice(10);
				let isString = false;
				for (const row of firstRows) {
					const value = row == null ? void 0 : row.getValue(column.id);
					if (Object.prototype.toString.call(value) === "[object Date]") return sortingFns.datetime;
					if (typeof value === "string") {
						isString = true;
						if (value.split(reSplitAlphaNumeric).length > 1) return sortingFns.alphanumeric;
					}
				}
				if (isString) return sortingFns.text;
				return sortingFns.basic;
			};
			column.getAutoSortDir = () => {
				const firstRow = table.getFilteredRowModel().flatRows[0];
				if (typeof (firstRow == null ? void 0 : firstRow.getValue(column.id)) === "string") return "asc";
				return "desc";
			};
			column.getSortingFn = () => {
				var _table$options$sortin, _table$options$sortin2;
				if (!column) throw new Error();
				return isFunction(column.columnDef.sortingFn) ? column.columnDef.sortingFn : column.columnDef.sortingFn === "auto" ? column.getAutoSortingFn() : (_table$options$sortin = (_table$options$sortin2 = table.options.sortingFns) == null ? void 0 : _table$options$sortin2[column.columnDef.sortingFn]) != null ? _table$options$sortin : sortingFns[column.columnDef.sortingFn];
			};
			column.toggleSorting = (desc, multi) => {
				const nextSortingOrder = column.getNextSortingOrder();
				const hasManualValue = typeof desc !== "undefined" && desc !== null;
				table.setSorting((old) => {
					const existingSorting = old == null ? void 0 : old.find((d) => d.id === column.id);
					const existingIndex = old == null ? void 0 : old.findIndex((d) => d.id === column.id);
					let newSorting = [];
					let sortAction;
					let nextDesc = hasManualValue ? desc : nextSortingOrder === "desc";
					if (old != null && old.length && column.getCanMultiSort() && multi) if (existingSorting) sortAction = "toggle";
					else sortAction = "add";
					else if (old != null && old.length && existingIndex !== old.length - 1) sortAction = "replace";
					else if (existingSorting) sortAction = "toggle";
					else sortAction = "replace";
					if (sortAction === "toggle") {
						if (!hasManualValue) {
							if (!nextSortingOrder) sortAction = "remove";
						}
					}
					if (sortAction === "add") {
						var _table$options$maxMul;
						newSorting = [...old, {
							id: column.id,
							desc: nextDesc
						}];
						newSorting.splice(0, newSorting.length - ((_table$options$maxMul = table.options.maxMultiSortColCount) != null ? _table$options$maxMul : Number.MAX_SAFE_INTEGER));
					} else if (sortAction === "toggle") newSorting = old.map((d) => {
						if (d.id === column.id) return {
							...d,
							desc: nextDesc
						};
						return d;
					});
					else if (sortAction === "remove") newSorting = old.filter((d) => d.id !== column.id);
					else newSorting = [{
						id: column.id,
						desc: nextDesc
					}];
					return newSorting;
				});
			};
			column.getFirstSortDir = () => {
				var _ref, _column$columnDef$sor;
				return ((_ref = (_column$columnDef$sor = column.columnDef.sortDescFirst) != null ? _column$columnDef$sor : table.options.sortDescFirst) != null ? _ref : column.getAutoSortDir() === "desc") ? "desc" : "asc";
			};
			column.getNextSortingOrder = (multi) => {
				var _table$options$enable, _table$options$enable2;
				const firstSortDirection = column.getFirstSortDir();
				const isSorted = column.getIsSorted();
				if (!isSorted) return firstSortDirection;
				if (isSorted !== firstSortDirection && ((_table$options$enable = table.options.enableSortingRemoval) != null ? _table$options$enable : true) && (multi ? (_table$options$enable2 = table.options.enableMultiRemove) != null ? _table$options$enable2 : true : true)) return false;
				return isSorted === "desc" ? "asc" : "desc";
			};
			column.getCanSort = () => {
				var _column$columnDef$ena, _table$options$enable3;
				return ((_column$columnDef$ena = column.columnDef.enableSorting) != null ? _column$columnDef$ena : true) && ((_table$options$enable3 = table.options.enableSorting) != null ? _table$options$enable3 : true) && !!column.accessorFn;
			};
			column.getCanMultiSort = () => {
				var _ref2, _column$columnDef$ena2;
				return (_ref2 = (_column$columnDef$ena2 = column.columnDef.enableMultiSort) != null ? _column$columnDef$ena2 : table.options.enableMultiSort) != null ? _ref2 : !!column.accessorFn;
			};
			column.getIsSorted = () => {
				var _table$getState$sorti;
				const columnSort = (_table$getState$sorti = table.getState().sorting) == null ? void 0 : _table$getState$sorti.find((d) => d.id === column.id);
				return !columnSort ? false : columnSort.desc ? "desc" : "asc";
			};
			column.getSortIndex = () => {
				var _table$getState$sorti2, _table$getState$sorti3;
				return (_table$getState$sorti2 = (_table$getState$sorti3 = table.getState().sorting) == null ? void 0 : _table$getState$sorti3.findIndex((d) => d.id === column.id)) != null ? _table$getState$sorti2 : -1;
			};
			column.clearSorting = () => {
				table.setSorting((old) => old != null && old.length ? old.filter((d) => d.id !== column.id) : []);
			};
			column.getToggleSortingHandler = () => {
				const canSort = column.getCanSort();
				return (e) => {
					if (!canSort) return;
					e.persist == null || e.persist();
					column.toggleSorting == null || column.toggleSorting(void 0, column.getCanMultiSort() ? table.options.isMultiSortEvent == null ? void 0 : table.options.isMultiSortEvent(e) : false);
				};
			};
		},
		createTable: (table) => {
			table.setSorting = (updater) => table.options.onSortingChange == null ? void 0 : table.options.onSortingChange(updater);
			table.resetSorting = (defaultState) => {
				var _table$initialState$s, _table$initialState;
				table.setSorting(defaultState ? [] : (_table$initialState$s = (_table$initialState = table.initialState) == null ? void 0 : _table$initialState.sorting) != null ? _table$initialState$s : []);
			};
			table.getPreSortedRowModel = () => table.getGroupedRowModel();
			table.getSortedRowModel = () => {
				if (!table._getSortedRowModel && table.options.getSortedRowModel) table._getSortedRowModel = table.options.getSortedRowModel(table);
				if (table.options.manualSorting || !table._getSortedRowModel) return table.getPreSortedRowModel();
				return table._getSortedRowModel();
			};
		}
	},
	ColumnGrouping,
	RowExpanding,
	RowPagination,
	RowPinning,
	RowSelection,
	ColumnSizing
];
function createTable(options) {
	var _options$_features, _options$initialState;
	const _features = [...builtInFeatures, ...(_options$_features = options._features) != null ? _options$_features : []];
	let table = { _features };
	const defaultOptions = table._features.reduce((obj, feature) => {
		return Object.assign(obj, feature.getDefaultOptions == null ? void 0 : feature.getDefaultOptions(table));
	}, {});
	const mergeOptions = (options) => {
		if (table.options.mergeOptions) return table.options.mergeOptions(defaultOptions, options);
		return {
			...defaultOptions,
			...options
		};
	};
	let initialState = { ...(_options$initialState = options.initialState) != null ? _options$initialState : {} };
	table._features.forEach((feature) => {
		var _feature$getInitialSt;
		initialState = (_feature$getInitialSt = feature.getInitialState == null ? void 0 : feature.getInitialState(initialState)) != null ? _feature$getInitialSt : initialState;
	});
	const queued = [];
	let queuedTimeout = false;
	const coreInstance = {
		_features,
		options: {
			...defaultOptions,
			...options
		},
		initialState,
		_queue: (cb) => {
			queued.push(cb);
			if (!queuedTimeout) {
				queuedTimeout = true;
				Promise.resolve().then(() => {
					while (queued.length) queued.shift()();
					queuedTimeout = false;
				}).catch((error) => setTimeout(() => {
					throw error;
				}));
			}
		},
		reset: () => {
			table.setState(table.initialState);
		},
		setOptions: (updater) => {
			table.options = mergeOptions(functionalUpdate(updater, table.options));
		},
		getState: () => {
			return table.options.state;
		},
		setState: (updater) => {
			table.options.onStateChange == null || table.options.onStateChange(updater);
		},
		_getRowId: (row, index, parent) => {
			var _table$options$getRow;
			return (_table$options$getRow = table.options.getRowId == null ? void 0 : table.options.getRowId(row, index, parent)) != null ? _table$options$getRow : `${parent ? [parent.id, index].join(".") : index}`;
		},
		getCoreRowModel: () => {
			if (!table._getCoreRowModel) table._getCoreRowModel = table.options.getCoreRowModel(table);
			return table._getCoreRowModel();
		},
		getRowModel: () => {
			return table.getPaginationRowModel();
		},
		getRow: (id, searchAll) => {
			let row = (searchAll ? table.getPrePaginationRowModel() : table.getRowModel()).rowsById[id];
			if (!row) {
				row = table.getCoreRowModel().rowsById[id];
				if (!row) throw new Error();
			}
			return row;
		},
		_getDefaultColumnDef: memo(() => [table.options.defaultColumn], (defaultColumn) => {
			var _defaultColumn;
			defaultColumn = (_defaultColumn = defaultColumn) != null ? _defaultColumn : {};
			return {
				header: (props) => {
					const resolvedColumnDef = props.header.column.columnDef;
					if (resolvedColumnDef.accessorKey) return resolvedColumnDef.accessorKey;
					if (resolvedColumnDef.accessorFn) return resolvedColumnDef.id;
					return null;
				},
				cell: (props) => {
					var _props$renderValue$to, _props$renderValue;
					return (_props$renderValue$to = (_props$renderValue = props.renderValue()) == null || _props$renderValue.toString == null ? void 0 : _props$renderValue.toString()) != null ? _props$renderValue$to : null;
				},
				...table._features.reduce((obj, feature) => {
					return Object.assign(obj, feature.getDefaultColumnDef == null ? void 0 : feature.getDefaultColumnDef());
				}, {}),
				...defaultColumn
			};
		}, getMemoOptions(options, "debugColumns", "_getDefaultColumnDef")),
		_getColumnDefs: () => table.options.columns,
		getAllColumns: memo(() => [table._getColumnDefs()], (columnDefs) => {
			const recurseColumns = function(columnDefs, parent, depth) {
				if (depth === void 0) depth = 0;
				return columnDefs.map((columnDef) => {
					const column = createColumn$2(table, columnDef, depth, parent);
					const groupingColumnDef = columnDef;
					column.columns = groupingColumnDef.columns ? recurseColumns(groupingColumnDef.columns, column, depth + 1) : [];
					return column;
				});
			};
			return recurseColumns(columnDefs);
		}, getMemoOptions(options, "debugColumns", "getAllColumns")),
		getAllFlatColumns: memo(() => [table.getAllColumns()], (allColumns) => {
			return allColumns.flatMap((column) => {
				return column.getFlatColumns();
			});
		}, getMemoOptions(options, "debugColumns", "getAllFlatColumns")),
		_getAllFlatColumnsById: memo(() => [table.getAllFlatColumns()], (flatColumns) => {
			return flatColumns.reduce((acc, column) => {
				acc[column.id] = column;
				return acc;
			}, {});
		}, getMemoOptions(options, "debugColumns", "getAllFlatColumnsById")),
		getAllLeafColumns: memo(() => [table.getAllColumns(), table._getOrderColumnsFn()], (allColumns, orderColumns) => {
			return orderColumns(allColumns.flatMap((column) => column.getLeafColumns()));
		}, getMemoOptions(options, "debugColumns", "getAllLeafColumns")),
		getColumn: (columnId) => {
			return table._getAllFlatColumnsById()[columnId];
		}
	};
	Object.assign(table, coreInstance);
	for (let index = 0; index < table._features.length; index++) {
		const feature = table._features[index];
		feature == null || feature.createTable == null || feature.createTable(table);
	}
	return table;
}
function getCoreRowModel() {
	return (table) => memo(() => [table.options.data], (data) => {
		const rowModel = {
			rows: [],
			flatRows: [],
			rowsById: {}
		};
		const accessRows = function(originalRows, depth, parentRow) {
			if (depth === void 0) depth = 0;
			const rows = [];
			for (let i = 0; i < originalRows.length; i++) {
				const row = createRow(table, table._getRowId(originalRows[i], i, parentRow), originalRows[i], i, depth, void 0, parentRow == null ? void 0 : parentRow.id);
				rowModel.flatRows.push(row);
				rowModel.rowsById[row.id] = row;
				rows.push(row);
				if (table.options.getSubRows) {
					var _row$originalSubRows;
					row.originalSubRows = table.options.getSubRows(originalRows[i], i);
					if ((_row$originalSubRows = row.originalSubRows) != null && _row$originalSubRows.length) row.subRows = accessRows(row.originalSubRows, depth + 1, row);
				}
			}
			return rows;
		};
		rowModel.rows = accessRows(data);
		return rowModel;
	}, getMemoOptions(table.options, "debugTable", "getRowModel", () => table._autoResetPageIndex()));
}
function getSortedRowModel() {
	return (table) => memo(() => [table.getState().sorting, table.getPreSortedRowModel()], (sorting, rowModel) => {
		if (!rowModel.rows.length || !(sorting != null && sorting.length)) return rowModel;
		const sortingState = table.getState().sorting;
		const sortedFlatRows = [];
		const availableSorting = sortingState.filter((sort) => {
			var _table$getColumn;
			return (_table$getColumn = table.getColumn(sort.id)) == null ? void 0 : _table$getColumn.getCanSort();
		});
		const columnInfoById = {};
		availableSorting.forEach((sortEntry) => {
			const column = table.getColumn(sortEntry.id);
			if (!column) return;
			columnInfoById[sortEntry.id] = {
				sortUndefined: column.columnDef.sortUndefined,
				invertSorting: column.columnDef.invertSorting,
				sortingFn: column.getSortingFn()
			};
		});
		const sortData = (rows) => {
			const sortedData = rows.map((row) => ({ ...row }));
			sortedData.sort((rowA, rowB) => {
				for (let i = 0; i < availableSorting.length; i += 1) {
					var _sortEntry$desc;
					const sortEntry = availableSorting[i];
					const columnInfo = columnInfoById[sortEntry.id];
					const sortUndefined = columnInfo.sortUndefined;
					const isDesc = (_sortEntry$desc = sortEntry == null ? void 0 : sortEntry.desc) != null ? _sortEntry$desc : false;
					let sortInt = 0;
					if (sortUndefined) {
						const aValue = rowA.getValue(sortEntry.id);
						const bValue = rowB.getValue(sortEntry.id);
						const aUndefined = aValue === void 0;
						const bUndefined = bValue === void 0;
						if (aUndefined || bUndefined) {
							if (sortUndefined === "first") return aUndefined ? -1 : 1;
							if (sortUndefined === "last") return aUndefined ? 1 : -1;
							sortInt = aUndefined && bUndefined ? 0 : aUndefined ? sortUndefined : -sortUndefined;
						}
					}
					if (sortInt === 0) sortInt = columnInfo.sortingFn(rowA, rowB, sortEntry.id);
					if (sortInt !== 0) {
						if (isDesc) sortInt *= -1;
						if (columnInfo.invertSorting) sortInt *= -1;
						return sortInt;
					}
				}
				return rowA.index - rowB.index;
			});
			sortedData.forEach((row) => {
				var _row$subRows;
				sortedFlatRows.push(row);
				if ((_row$subRows = row.subRows) != null && _row$subRows.length) row.subRows = sortData(row.subRows);
			});
			return sortedData;
		};
		return {
			rows: sortData(rowModel.rows),
			flatRows: sortedFlatRows,
			rowsById: rowModel.rowsById
		};
	}, getMemoOptions(table.options, "debugTable", "getSortedRowModel", () => table._autoResetPageIndex()));
}
//#endregion
//#region src/extension/svelte/components/ui/data-table/data-table.svelte.ts
function createSvelteTable(options) {
	const resolvedOptions = mergeObjects({
		state: {},
		onStateChange() {},
		renderFallbackValue: null,
		mergeOptions: (defaultOptions, options) => {
			return mergeObjects(defaultOptions, options);
		}
	}, options);
	const table = createTable(resolvedOptions);
	let state$1 = state(proxy(table.initialState));
	function updateOptions() {
		table.setOptions(() => {
			return mergeObjects(resolvedOptions, options, {
				state: mergeObjects(get(state$1), options.state || {}),
				onStateChange: (updater) => {
					if (updater instanceof Function) set(state$1, updater(get(state$1)), true);
					else set(state$1, mergeObjects(get(state$1), updater), true);
					options.onStateChange?.(updater);
				}
			});
		});
	}
	updateOptions();
	user_pre_effect(() => {
		updateOptions();
	});
	return table;
}
/**
* Lazily merges several objects (or thunks) while preserving
* getter semantics from every source.
*
* Proxy-based to avoid known WebKit recursion issue.
*/
function mergeObjects(...sources) {
	const resolve = (src) => typeof src === "function" ? src() ?? void 0 : src;
	const findSourceWithKey = (key) => {
		for (let i = sources.length - 1; i >= 0; i--) {
			const obj = resolve(sources[i]);
			if (obj && key in obj) return obj;
		}
	};
	return new Proxy(Object.create(null), {
		get(_, key) {
			return findSourceWithKey(key)?.[key];
		},
		has(_, key) {
			return !!findSourceWithKey(key);
		},
		ownKeys() {
			const all = /* @__PURE__ */ new Set();
			for (const s of sources) {
				const obj = resolve(s);
				if (obj) for (const k of Reflect.ownKeys(obj)) all.add(k);
			}
			return [...all];
		},
		getOwnPropertyDescriptor(_, key) {
			const src = findSourceWithKey(key);
			if (!src) return void 0;
			return {
				configurable: true,
				enumerable: true,
				value: src[key],
				writable: true
			};
		}
	});
}
//#endregion
//#region src/extension/svelte/components/ui/data-table/render-helpers.ts
/**
* A helper class to make it easy to identify Svelte components in
* `columnDef.cell` and `columnDef.header` properties.
*
* > NOTE: This class should only be used internally by the adapter. If you're
* reading this and you don't know what this is for, you probably don't need it.
*
* @example
* ```svelte
* {@const result = content(context as any)}
* {#if result instanceof RenderComponentConfig}
*   {@const { component: Component, props } = result}
*   <Component {...props} />
* {/if}
* ```
*/
var RenderComponentConfig = class {
	component;
	props;
	constructor(component, props = {}) {
		this.component = component;
		this.props = props;
	}
};
/**
* A helper class to make it easy to identify Svelte Snippets in `columnDef.cell` and `columnDef.header` properties.
*
* > NOTE: This class should only be used internally by the adapter. If you're
* reading this and you don't know what this is for, you probably don't need it.
*
* @example
* ```svelte
* {@const result = content(context as any)}
* {#if result instanceof RenderSnippetConfig}
*   {@const { snippet, params } = result}
*   {@render snippet(params)}
* {/if}
* ```
*/
var RenderSnippetConfig = class {
	snippet;
	params;
	constructor(snippet, params) {
		this.snippet = snippet;
		this.params = params;
	}
};
//#endregion
//#region src/extension/svelte/components/ui/data-table/flex-render.svelte
function Flex_render($$anchor, $$props) {
	push($$props, true);
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		var text = text$1();
		template_effect(() => set_text(text, $$props.content));
		append($$anchor, text);
	};
	var consequent_3 = ($$anchor) => {
		const result = user_derived(() => $$props.content($$props.context));
		var fragment_2 = comment();
		var node_1 = first_child(fragment_2);
		var consequent_1 = ($$anchor) => {
			const computed_const = user_derived(() => {
				const { component: Component, props } = get(result);
				return {
					Component,
					props
				};
			});
			var fragment_3 = comment();
			component(first_child(fragment_3), () => get(computed_const).Component, ($$anchor, Component_1) => {
				Component_1($$anchor, spread_props(() => get(computed_const).props, { get attach() {
					return $$props.attach;
				} }));
			});
			append($$anchor, fragment_3);
		};
		var consequent_2 = ($$anchor) => {
			const computed_const_1 = user_derived(() => {
				const { snippet, params } = get(result);
				return {
					snippet,
					params
				};
			});
			var fragment_4 = comment();
			var node_3 = first_child(fragment_4);
			{
				let $0 = user_derived(() => ({
					...get(computed_const_1).params,
					attach: $$props.attach
				}));
				snippet(node_3, () => get(computed_const_1).snippet, () => get($0));
			}
			append($$anchor, fragment_4);
		};
		var alternate = ($$anchor) => {
			var text_1 = text$1();
			template_effect(() => set_text(text_1, get(result)));
			append($$anchor, text_1);
		};
		if_block(node_1, ($$render) => {
			if (get(result) instanceof RenderComponentConfig) $$render(consequent_1);
			else if (get(result) instanceof RenderSnippetConfig) $$render(consequent_2, 1);
			else $$render(alternate, -1);
		});
		append($$anchor, fragment_2);
	};
	if_block(node, ($$render) => {
		if (typeof $$props.content === "string") $$render(consequent);
		else if ($$props.content instanceof Function) $$render(consequent_3, 1);
	});
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region node_modules/phosphor-svelte/lib/CaretUpIcon.svelte
var root_2 = from_svg(`<path d="M216.49,168.49a12,12,0,0,1-17,0L128,97,56.49,168.49a12,12,0,0,1-17-17l80-80a12,12,0,0,1,17,0l80,80A12,12,0,0,1,216.49,168.49Z"></path>`);
var root_3 = from_svg(`<path d="M208,160H48l80-80Z" opacity="0.2"></path><path d="M213.66,154.34l-80-80a8,8,0,0,0-11.32,0l-80,80A8,8,0,0,0,48,168H208a8,8,0,0,0,5.66-13.66ZM67.31,152,128,91.31,188.69,152Z"></path>`, 1);
var root_4 = from_svg(`<path d="M215.39,163.06A8,8,0,0,1,208,168H48a8,8,0,0,1-5.66-13.66l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,215.39,163.06Z"></path>`);
var root_5 = from_svg(`<path d="M212.24,164.24a6,6,0,0,1-8.48,0L128,88.49,52.24,164.24a6,6,0,0,1-8.48-8.48l80-80a6,6,0,0,1,8.48,0l80,80A6,6,0,0,1,212.24,164.24Z"></path>`);
var root_6 = from_svg(`<path d="M213.66,165.66a8,8,0,0,1-11.32,0L128,91.31,53.66,165.66a8,8,0,0,1-11.32-11.32l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,213.66,165.66Z"></path>`);
var root_7$1 = from_svg(`<path d="M210.83,162.83a4,4,0,0,1-5.66,0L128,85.66,50.83,162.83a4,4,0,0,1-5.66-5.66l80-80a4,4,0,0,1,5.66,0l80,80A4,4,0,0,1,210.83,162.83Z"></path>`);
var root$8 = from_svg(`<svg><!><rect width="256" height="256" fill="none"></rect><!></svg>`);
function CaretUpIcon($$anchor, $$props) {
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
	var svg = root$8();
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
		append($$anchor, root_7$1());
	};
	var alternate = ($$anchor) => {
		var text = text$1();
		text.nodeValue = (console.error("Unsupported icon weight. Choose from \"thin\", \"light\", \"regular\", \"bold\", \"fill\", or \"duotone\"."), "");
		append($$anchor, text);
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
//#region src/extension/entrypoints/targets/components/attackhistory/data-table.svelte
var root_8 = from_html(`<span class="flex items-center justify-center"><!></span>`);
var root_7 = from_html(`<button class="flex items-center gap-0.5 font-medium leading-none hover:text-primary disabled:pointer-events-none" type="button"><!> <!></button>`);
var root_16$2 = from_html(`<a class="hover:underline" target="_blank" rel="noreferrer"> </a>`);
var root_17 = from_html(`<a class="hover:underline" target="_blank" rel="noreferrer"> </a>`);
var root_18$1 = from_html(`<a class="hover:underline" target="_blank" rel="noreferrer"> </a>`);
var root_1$4 = from_html(`<!> <!>`, 1);
var root$7 = from_html(`<div class="overflow-hidden rounded-sm border bg-card"><!></div>`);
function Data_table$2($$anchor, $$props) {
	push($$props, true);
	let sorting = state(proxy([{
		id: "lastAttack",
		desc: true
	}]));
	const table = createSvelteTable({
		get data() {
			return $$props.data;
		},
		get columns() {
			return $$props.columns;
		},
		getRowId: (row) => row.id,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		state: { get sorting() {
			return get(sorting);
		} },
		onSortingChange: (updater) => {
			set(sorting, typeof updater === "function" ? updater(get(sorting)) : updater, true);
		}
	});
	function getHeaderAlignment(columnId) {
		return columnId === "name" || columnId === "lastAttack" ? "text-left" : "text-center";
	}
	function getHeaderClass(columnId) {
		return cn([
			getHeaderAlignment(columnId),
			"h-6",
			"py-1",
			{
				"px-0": ![
					"id",
					"name",
					"lastAttack"
				].includes(columnId),
				"px-1": [
					"id",
					"name",
					"lastAttack"
				].includes(columnId),
				"pl-1": [
					"win",
					"lose",
					"respect"
				].includes(columnId),
				"pr-1": ["fair_fight"].includes(columnId),
				"border-l": [
					"win",
					"lose",
					"respect"
				].includes(columnId)
			}
		]);
	}
	function getCellClass(columnId) {
		return cn([
			getHeaderAlignment(columnId),
			"py-1",
			{
				"px-0": ![
					"id",
					"name",
					"lastAttack"
				].includes(columnId),
				"px-1": [
					"id",
					"name",
					"lastAttack"
				].includes(columnId),
				"pl-1": [
					"win",
					"lose",
					"respect"
				].includes(columnId),
				"pr-1": ["fair_fight"].includes(columnId),
				"border-l": [
					"win",
					"lose",
					"respect"
				].includes(columnId),
				"text-emerald-500": [
					"win",
					"mug",
					"leave",
					"hospitalise",
					"arrest",
					"special",
					"stealth",
					"assist",
					"defend"
				].includes(columnId),
				"text-red-400": [
					"lose",
					"stalemate",
					"escapes",
					"defend_lost"
				].includes(columnId)
			}
		]);
	}
	function toggleSorting(columnId) {
		table.getColumn(columnId)?.toggleSorting(void 0, false);
	}
	var div = root$7();
	component(child(div), () => Table, ($$anchor, Table_Root) => {
		Table_Root($$anchor, {
			class: "text-xs",
			children: ($$anchor, $$slotProps) => {
				var fragment = root_1$4();
				var node_1 = first_child(fragment);
				component(node_1, () => Table_header, ($$anchor, Table_Header) => {
					Table_Header($$anchor, {
						class: "bg-muted",
						children: ($$anchor, $$slotProps) => {
							var fragment_1 = comment();
							each(first_child(fragment_1), 17, () => table.getHeaderGroups(), (headerGroup) => headerGroup.id, ($$anchor, headerGroup) => {
								var fragment_2 = comment();
								component(first_child(fragment_2), () => Table_row, ($$anchor, Table_Row) => {
									Table_Row($$anchor, {
										children: ($$anchor, $$slotProps) => {
											var fragment_3 = comment();
											each(first_child(fragment_3), 17, () => get(headerGroup).headers, (header) => header.id, ($$anchor, header) => {
												var fragment_4 = comment();
												var node_5 = first_child(fragment_4);
												{
													let $0 = user_derived(() => getHeaderClass(get(header).column.id));
													component(node_5, () => Table_head, ($$anchor, Table_Head) => {
														Table_Head($$anchor, {
															get colspan() {
																return get(header).colSpan;
															},
															get class() {
																return get($0);
															},
															children: ($$anchor, $$slotProps) => {
																var fragment_5 = comment();
																var node_6 = first_child(fragment_5);
																var consequent_3 = ($$anchor) => {
																	var button = root_7();
																	var node_7 = child(button);
																	{
																		let $0 = user_derived(() => get(header).getContext());
																		Flex_render(node_7, {
																			get content() {
																				return get(header).column.columnDef.header;
																			},
																			get context() {
																				return get($0);
																			}
																		});
																	}
																	var node_8 = sibling(node_7, 2);
																	var consequent_2 = ($$anchor) => {
																		var span = root_8();
																		var node_9 = child(span);
																		var consequent = ($$anchor) => {
																			CaretUpIcon($$anchor, {
																				class: "size-2.5",
																				weight: "fill"
																			});
																		};
																		var d = user_derived(() => get(header).column.getIsSorted() === "asc");
																		var consequent_1 = ($$anchor) => {
																			CaretDownIcon($$anchor, {
																				class: "size-2.5",
																				weight: "fill"
																			});
																		};
																		var d_1 = user_derived(() => get(header).column.getIsSorted() === "desc");
																		if_block(node_9, ($$render) => {
																			if (get(d)) $$render(consequent);
																			else if (get(d_1)) $$render(consequent_1, 1);
																		});
																		reset(span);
																		append($$anchor, span);
																	};
																	var d_2 = user_derived(() => get(header).column.getIsSorted());
																	if_block(node_8, ($$render) => {
																		if (get(d_2)) $$render(consequent_2);
																	});
																	reset(button);
																	template_effect(($0) => button.disabled = $0, [() => !get(header).column.getCanSort()]);
																	delegated("click", button, () => toggleSorting(get(header).column.id));
																	append($$anchor, button);
																};
																if_block(node_6, ($$render) => {
																	if (!get(header).isPlaceholder) $$render(consequent_3);
																});
																append($$anchor, fragment_5);
															},
															$$slots: { default: true }
														});
													});
												}
												append($$anchor, fragment_4);
											});
											append($$anchor, fragment_3);
										},
										$$slots: { default: true }
									});
								});
								append($$anchor, fragment_2);
							});
							append($$anchor, fragment_1);
						},
						$$slots: { default: true }
					});
				});
				component(sibling(node_1, 2), () => Table_body, ($$anchor, Table_Body) => {
					Table_Body($$anchor, {
						children: ($$anchor, $$slotProps) => {
							var fragment_8 = comment();
							each(first_child(fragment_8), 17, () => table.getRowModel().rows, (row) => row.id, ($$anchor, row) => {
								var fragment_9 = comment();
								component(first_child(fragment_9), () => Table_row, ($$anchor, Table_Row_1) => {
									Table_Row_1($$anchor, {
										children: ($$anchor, $$slotProps) => {
											var fragment_10 = comment();
											each(first_child(fragment_10), 17, () => get(row).getVisibleCells(), (cell) => cell.id, ($$anchor, cell) => {
												var fragment_11 = comment();
												var node_14 = first_child(fragment_11);
												{
													let $0 = user_derived(() => getCellClass(get(cell).column.id));
													component(node_14, () => Table_cell, ($$anchor, Table_Cell) => {
														Table_Cell($$anchor, {
															get class() {
																return get($0);
															},
															children: ($$anchor, $$slotProps) => {
																var fragment_12 = comment();
																var node_15 = first_child(fragment_12);
																var consequent_4 = ($$anchor) => {
																	var a = root_16$2();
																	var text = child(a, true);
																	reset(a);
																	template_effect(() => {
																		set_attribute(a, "href", `https://www.torn.com/profiles.php?XID=${get(row).original.id}`);
																		set_text(text, get(row).original.id);
																	});
																	append($$anchor, a);
																};
																var consequent_5 = ($$anchor) => {
																	var a_1 = root_17();
																	var text_1 = child(a_1, true);
																	reset(a_1);
																	template_effect(() => {
																		set_attribute(a_1, "href", `https://www.torn.com/profiles.php?XID=${get(row).original.id}`);
																		set_text(text_1, get(row).original.name);
																	});
																	append($$anchor, a_1);
																};
																var consequent_6 = ($$anchor) => {
																	var a_2 = root_18$1();
																	var text_2 = child(a_2, true);
																	reset(a_2);
																	template_effect(() => {
																		set_attribute(a_2, "href", `https://www.torn.com/page.php?sid=attackLog&ID=${get(row).original.lastAttackCode}`);
																		set_text(text_2, get(row).original.lastAttackLabel);
																	});
																	append($$anchor, a_2);
																};
																var alternate = ($$anchor) => {
																	{
																		let $0 = user_derived(() => get(cell).getContext());
																		Flex_render($$anchor, {
																			get content() {
																				return get(cell).column.columnDef.cell;
																			},
																			get context() {
																				return get($0);
																			}
																		});
																	}
																};
																if_block(node_15, ($$render) => {
																	if (get(cell).column.id === "id") $$render(consequent_4);
																	else if (get(cell).column.id === "name") $$render(consequent_5, 1);
																	else if (get(cell).column.id === "lastAttack" && get(row).original.lastAttackCode) $$render(consequent_6, 2);
																	else $$render(alternate, -1);
																});
																append($$anchor, fragment_12);
															},
															$$slots: { default: true }
														});
													});
												}
												append($$anchor, fragment_11);
											});
											append($$anchor, fragment_10);
										},
										$$slots: { default: true }
									});
								});
								append($$anchor, fragment_9);
							}, ($$anchor) => {
								var fragment_14 = comment();
								component(first_child(fragment_14), () => Table_row, ($$anchor, Table_Row_2) => {
									Table_Row_2($$anchor, {
										children: ($$anchor, $$slotProps) => {
											var fragment_15 = comment();
											component(first_child(fragment_15), () => Table_cell, ($$anchor, Table_Cell_1) => {
												Table_Cell_1($$anchor, {
													get colspan() {
														return $$props.columns.length;
													},
													class: "p-4 text-center text-muted-foreground",
													children: ($$anchor, $$slotProps) => {
														next();
														append($$anchor, text$1("No attack history stored."));
													},
													$$slots: { default: true }
												});
											});
											append($$anchor, fragment_15);
										},
										$$slots: { default: true }
									});
								});
								append($$anchor, fragment_14);
							});
							append($$anchor, fragment_8);
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
delegate(["click"]);
//#endregion
//#region src/extension/entrypoints/targets/components/attackhistory/HistoryTable.svelte
function HistoryTable($$anchor, $$props) {
	push($$props, true);
	const $attackHistoryStore = () => store_get(attackHistoryStore, "$attackHistoryStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let showPercentages = prop($$props, "showPercentages", 3, false);
	const data = user_derived(() => Object.entries($attackHistoryStore()?.history ?? {}).map(([id, attack]) => createHistoryRow(id, attack, showPercentages())));
	function createHistoryRow(id, data, showPercentageValues) {
		const respect = getRespectValue(data);
		return {
			id,
			name: data.name,
			lastAttack: data.lastAttack,
			lastAttackLabel: getLastAttackLabel(data.lastAttack),
			lastAttackCode: data.lastAttackCode,
			win: data.win,
			mug: getSwitchableSortValue(data, "mug", showPercentageValues),
			mugLabel: getSwitchableLabel(data, "mug", showPercentageValues),
			leave: getSwitchableSortValue(data, "leave", showPercentageValues),
			leaveLabel: getSwitchableLabel(data, "leave", showPercentageValues),
			hospitalise: getSwitchableSortValue(data, "hospitalise", showPercentageValues),
			hospitaliseLabel: getSwitchableLabel(data, "hospitalise", showPercentageValues),
			arrest: getSwitchableSortValue(data, "arrest", showPercentageValues),
			arrestLabel: getSwitchableLabel(data, "arrest", showPercentageValues),
			special: getSwitchableSortValue(data, "special", showPercentageValues),
			specialLabel: getSwitchableLabel(data, "special", showPercentageValues),
			stealth: getSwitchableSortValue(data, "stealth", showPercentageValues),
			stealthLabel: getSwitchableLabel(data, "stealth", showPercentageValues),
			assist: data.assist,
			defend: data.defend,
			lose: data.lose,
			stalemate: data.stalemate,
			escapes: data.escapes,
			defend_lost: data.defend_lost,
			respect,
			respectLabel: getRespectLabel(data),
			fair_fight: data.latestFairFightModifier ?? -1,
			fairFightLabel: data.latestFairFightModifier?.toString() ?? "-"
		};
	}
	function getAverage(values) {
		return Number((values.reduce((total, value) => total + value, 0) / values.length || 0).toFixed(2));
	}
	function getLastAttackLabel(timestamp) {
		return `${formatDate({ milliseconds: timestamp }, { showYear: true })}, ${formatTime({ milliseconds: timestamp })}`;
	}
	function getRespectValue(data) {
		if (data.respect_base.length) return getAverage(data.respect_base);
		if (data.respect.length) return getAverage(data.respect);
		return -1;
	}
	function getRespectLabel(data) {
		if (data.respect_base.length) return getAverage(data.respect_base).toString();
		if (data.respect.length) return `${getAverage(data.respect)}*`;
		return "-";
	}
	function getSwitchableSortValue(data, key, showPercentageValues) {
		if (!showPercentageValues) return data[key];
		return Math.round(data[key] / data.win * 100) || 0;
	}
	function getSwitchableLabel(data, key, showPercentageValues) {
		const value = getSwitchableSortValue(data, key, showPercentageValues);
		return showPercentageValues ? `${value}%` : value.toString();
	}
	Data_table$2($$anchor, {
		get data() {
			return get(data);
		},
		get columns() {
			return columns$2;
		}
	});
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/targets/components/attackhistory/AttackHistory.svelte
var root$6 = from_html(`<div class="space-y-2"><div class="flex flex-wrap items-center justify-between gap-2"><div><h1 class="text-2xl font-bold">Attack History</h1> <p class="text-sm text-muted-foreground"> </p></div> <div class="flex items-center gap-2"><label class="flex items-center gap-2 text-sm"><!> <span>Show percentages</span></label> <!></div></div> <!></div>`);
function AttackHistory($$anchor, $$props) {
	push($$props, true);
	const $attackHistoryStore = () => store_get(attackHistoryStore, "$attackHistoryStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let showPercentages = state(false);
	const amountOfRows = user_derived(() => Object.keys($attackHistoryStore()?.history ?? {}).length);
	async function resetHistory() {
		const lastAttack = $attackHistoryStore().lastAttack;
		await ttStorage.set({ attackHistory: {
			fetchData: true,
			lastAttack,
			history: {}
		} });
		toast.success("Attack history reset.");
	}
	var div = root$6();
	var div_1 = child(div);
	var div_2 = child(div_1);
	var p = sibling(child(div_2), 2);
	var text = child(p);
	reset(p);
	reset(div_2);
	var div_3 = sibling(div_2, 2);
	var label = child(div_3);
	Switch(child(label), {
		size: "sm",
		get checked() {
			return get(showPercentages);
		},
		set checked($$value) {
			set(showPercentages, $$value, true);
		}
	});
	next(2);
	reset(label);
	ResetAction(sibling(label, 2), {
		title: "Reset attack history",
		description: "Are you sure you want to delete the attack history?",
		onConfirm: resetHistory
	});
	reset(div_3);
	reset(div_1);
	HistoryTable(sibling(div_1, 2), { get showPercentages() {
		return get(showPercentages);
	} });
	reset(div);
	template_effect(() => set_text(text, `${get(amountOfRows) ?? ""} stored ${get(amountOfRows) === 1 ? "target" : "targets"}`));
	append($$anchor, div);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/targets/components/faction-stakeouts/columns.ts
var columns$1 = [
	createColumn$1("id", "ID"),
	createColumn$1("name", "Name"),
	createColumn$1("chain", "Chain"),
	createColumn$1("members", "Members"),
	createColumn$1("respect", "Respect"),
	createColumn$1("remove", "Remove"),
	createColumn$1("notifications", "Notifications")
];
function createColumn$1(id, header) {
	return {
		id,
		header
	};
}
//#endregion
//#region src/extension/entrypoints/targets/components/faction-stakeouts/AlertCheckbox.svelte
var root$5 = from_html(`<label class="flex items-center gap-1 text-xs"><!> <span> </span></label>`);
function AlertCheckbox$1($$anchor, $$props) {
	push($$props, true);
	var label_1 = root$5();
	var node = child(label_1);
	Checkbox(node, {
		get id() {
			return $$props.id;
		},
		get checked() {
			return $$props.checked;
		},
		onCheckedChange: (value) => $$props.onchange(Boolean(value))
	});
	var span = sibling(node, 2);
	var text = child(span, true);
	reset(span);
	reset(label_1);
	template_effect(() => {
		set_attribute(label_1, "for", $$props.id);
		set_text(text, $$props.label);
	});
	append($$anchor, label_1);
	pop();
}
//#endregion
//#region src/extension/entrypoints/targets/components/faction-stakeouts/data-table.svelte
var root_13$1 = from_html(`<a class="hover:underline" target="_blank" rel="noreferrer"> </a>`);
var root_15$1 = from_html(`<a class="hover:underline" target="_blank" rel="noreferrer"> </a>`);
var root_16$1 = from_html(`<span class="text-muted-foreground"> </span>`);
var root_23$1 = from_html(`<span> </span>`);
var root_24 = from_html(`<span class="text-muted-foreground">N/A</span>`);
var root_30 = from_html(`<span class="text-muted-foreground">N/A</span>`);
var root_33 = from_html(`<div class="grid grid-cols-2 gap-x-2 gap-y-0.5"><label class="flex items-center gap-1 text-xs"><span>chain reaches</span> <!></label> <label class="flex items-center gap-1 text-xs"><span>members drop below</span> <!></label> <!> <!> <!></div>`);
var root_1$3 = from_html(`<!> <!>`, 1);
var root$4 = from_html(`<div class="overflow-hidden rounded-lg border bg-card"><!></div>`);
function Data_table$1($$anchor, $$props) {
	push($$props, true);
	const table = createSvelteTable({
		get data() {
			return $$props.data;
		},
		get columns() {
			return $$props.columns;
		},
		getRowId: (row) => String(row.id),
		getCoreRowModel: getCoreRowModel()
	});
	function getHeaderClass(columnId) {
		return columnId === "id" || columnId === "remove" ? "px-2 py-2 text-center" : "px-2 py-2 text-left";
	}
	function getCellClass(columnId) {
		return cn(["px-2", {
			"py-1.5": columnId !== "notifications",
			"py-2": columnId === "notifications",
			"text-center": columnId === "id" || columnId === "remove"
		}]);
	}
	var div = root$4();
	component(child(div), () => Table, ($$anchor, Table_Root) => {
		Table_Root($$anchor, {
			children: ($$anchor, $$slotProps) => {
				var fragment = root_1$3();
				var node_1 = first_child(fragment);
				component(node_1, () => Table_header, ($$anchor, Table_Header) => {
					Table_Header($$anchor, {
						class: "bg-muted/60",
						children: ($$anchor, $$slotProps) => {
							var fragment_1 = comment();
							each(first_child(fragment_1), 17, () => table.getHeaderGroups(), (headerGroup) => headerGroup.id, ($$anchor, headerGroup) => {
								var fragment_2 = comment();
								component(first_child(fragment_2), () => Table_row, ($$anchor, Table_Row) => {
									Table_Row($$anchor, {
										children: ($$anchor, $$slotProps) => {
											var fragment_3 = comment();
											each(first_child(fragment_3), 17, () => get(headerGroup).headers, (header) => header.id, ($$anchor, header) => {
												var fragment_4 = comment();
												var node_5 = first_child(fragment_4);
												{
													let $0 = user_derived(() => getHeaderClass(get(header).column.id));
													component(node_5, () => Table_head, ($$anchor, Table_Head) => {
														Table_Head($$anchor, {
															get colspan() {
																return get(header).colSpan;
															},
															get class() {
																return get($0);
															},
															children: ($$anchor, $$slotProps) => {
																var fragment_5 = comment();
																var node_6 = first_child(fragment_5);
																var consequent = ($$anchor) => {
																	{
																		let $0 = user_derived(() => get(header).getContext());
																		Flex_render($$anchor, {
																			get content() {
																				return get(header).column.columnDef.header;
																			},
																			get context() {
																				return get($0);
																			}
																		});
																	}
																};
																if_block(node_6, ($$render) => {
																	if (!get(header).isPlaceholder) $$render(consequent);
																});
																append($$anchor, fragment_5);
															},
															$$slots: { default: true }
														});
													});
												}
												append($$anchor, fragment_4);
											});
											append($$anchor, fragment_3);
										},
										$$slots: { default: true }
									});
								});
								append($$anchor, fragment_2);
							});
							append($$anchor, fragment_1);
						},
						$$slots: { default: true }
					});
				});
				component(sibling(node_1, 2), () => Table_body, ($$anchor, Table_Body) => {
					Table_Body($$anchor, {
						children: ($$anchor, $$slotProps) => {
							var fragment_7 = comment();
							each(first_child(fragment_7), 17, () => table.getRowModel().rows, (tableRow) => tableRow.id, ($$anchor, tableRow) => {
								const row = user_derived(() => get(tableRow).original);
								var fragment_8 = comment();
								component(first_child(fragment_8), () => Table_row, ($$anchor, Table_Row_1) => {
									Table_Row_1($$anchor, {
										get "data-id"() {
											return get(row).id;
										},
										children: ($$anchor, $$slotProps) => {
											var fragment_9 = comment();
											each(first_child(fragment_9), 17, () => get(tableRow).getVisibleCells(), (cell) => cell.id, ($$anchor, cell) => {
												var fragment_10 = comment();
												var node_11 = first_child(fragment_10);
												{
													let $0 = user_derived(() => getCellClass(get(cell).column.id));
													component(node_11, () => Table_cell, ($$anchor, Table_Cell) => {
														Table_Cell($$anchor, {
															get class() {
																return get($0);
															},
															children: ($$anchor, $$slotProps) => {
																var fragment_11 = comment();
																var node_12 = first_child(fragment_11);
																var consequent_1 = ($$anchor) => {
																	var a = root_13$1();
																	var text = child(a, true);
																	reset(a);
																	template_effect(() => {
																		set_attribute(a, "href", `https://www.torn.com/factions.php?step=profile&ID=${get(row).id}`);
																		set_text(text, get(row).id);
																	});
																	append($$anchor, a);
																};
																var consequent_3 = ($$anchor) => {
																	var fragment_12 = comment();
																	var node_13 = first_child(fragment_12);
																	var consequent_2 = ($$anchor) => {
																		var a_1 = root_15$1();
																		var text_1 = child(a_1, true);
																		reset(a_1);
																		template_effect(() => {
																			set_attribute(a_1, "href", `https://www.torn.com/factions.php?step=profile&ID=${get(row).id}`);
																			set_text(text_1, get(row).info.name);
																		});
																		append($$anchor, a_1);
																	};
																	var alternate = ($$anchor) => {
																		var span = root_16$1();
																		var text_2 = child(span, true);
																		reset(span);
																		template_effect(() => set_text(text_2, get(row).isNew ? "Pending save" : "Unknown"));
																		append($$anchor, span);
																	};
																	if_block(node_13, ($$render) => {
																		if (get(row).info?.name) $$render(consequent_2);
																		else $$render(alternate, -1);
																	});
																	append($$anchor, fragment_12);
																};
																var consequent_5 = ($$anchor) => {
																	var fragment_13 = comment();
																	var node_14 = first_child(fragment_13);
																	var consequent_4 = ($$anchor) => {
																		Badge($$anchor, {
																			variant: "secondary",
																			children: ($$anchor, $$slotProps) => {
																				next();
																				var text_3 = text$1();
																				template_effect(() => set_text(text_3, `${get(row).info.chain ?? ""} chain`));
																				append($$anchor, text_3);
																			},
																			$$slots: { default: true }
																		});
																	};
																	var alternate_1 = ($$anchor) => {
																		Badge($$anchor, {
																			variant: "outline",
																			children: ($$anchor, $$slotProps) => {
																				next();
																				append($$anchor, text$1("No chain"));
																			},
																			$$slots: { default: true }
																		});
																	};
																	if_block(node_14, ($$render) => {
																		if (get(row).info && get(row).info.chain > 0) $$render(consequent_4);
																		else $$render(alternate_1, -1);
																	});
																	append($$anchor, fragment_13);
																};
																var consequent_7 = ($$anchor) => {
																	var fragment_17 = comment();
																	var node_15 = first_child(fragment_17);
																	var consequent_6 = ($$anchor) => {
																		var span_1 = root_23$1();
																		var text_5 = child(span_1);
																		reset(span_1);
																		template_effect(() => set_text(text_5, `${get(row).info.members.current ?? ""}/${get(row).info.members.maximum ?? ""}`));
																		append($$anchor, span_1);
																	};
																	var alternate_2 = ($$anchor) => {
																		append($$anchor, root_24());
																	};
																	if_block(node_15, ($$render) => {
																		if (get(row).info?.members) $$render(consequent_6);
																		else $$render(alternate_2, -1);
																	});
																	append($$anchor, fragment_17);
																};
																var consequent_10 = ($$anchor) => {
																	var fragment_18 = comment();
																	var node_16 = first_child(fragment_18);
																	var consequent_8 = ($$anchor) => {
																		Badge($$anchor, {
																			variant: "secondary",
																			children: ($$anchor, $$slotProps) => {
																				next();
																				var text_6 = text$1();
																				template_effect(() => set_text(text_6, get(row).info.respect));
																				append($$anchor, text_6);
																			},
																			$$slots: { default: true }
																		});
																	};
																	var consequent_9 = ($$anchor) => {
																		Badge($$anchor, {
																			variant: "destructive",
																			class: "uppercase",
																			children: ($$anchor, $$slotProps) => {
																				next();
																				append($$anchor, text$1("destroyed"));
																			},
																			$$slots: { default: true }
																		});
																	};
																	var alternate_3 = ($$anchor) => {
																		append($$anchor, root_30());
																	};
																	if_block(node_16, ($$render) => {
																		if (get(row).info && get(row).info.respect > 0) $$render(consequent_8);
																		else if (get(row).info) $$render(consequent_9, 1);
																		else $$render(alternate_3, -1);
																	});
																	append($$anchor, fragment_18);
																};
																var consequent_11 = ($$anchor) => {
																	{
																		let $0 = user_derived(() => `Remove faction ${get(row).id}`);
																		Button($$anchor, {
																			variant: "ghost",
																			size: "icon",
																			get "aria-label"() {
																				return get($0);
																			},
																			onclick: () => $$props.onRemove(get(row).id),
																			children: ($$anchor, $$slotProps) => {
																				TrashIcon($$anchor, {
																					class: "size-4 text-destructive",
																					"aria-hidden": "true"
																				});
																			},
																			$$slots: { default: true }
																		});
																	}
																};
																var consequent_12 = ($$anchor) => {
																	var div_1 = root_33();
																	var label = child(div_1);
																	var node_17 = sibling(child(label), 2);
																	{
																		let $0 = user_derived(() => get(row).alerts.chainReaches === false ? "" : get(row).alerts.chainReaches);
																		Input(node_17, {
																			class: "h-5 w-12 px-1 text-xs",
																			type: "number",
																			min: "0",
																			get value() {
																				return get($0);
																			},
																			oninput: (event) => $$props.onNumberAlertChange(get(row).id, "chainReaches", event.currentTarget.value)
																		});
																	}
																	reset(label);
																	var label_1 = sibling(label, 2);
																	var node_18 = sibling(child(label_1), 2);
																	{
																		let $0 = user_derived(() => get(row).alerts.memberCountDrops === false ? "" : get(row).alerts.memberCountDrops);
																		Input(node_18, {
																			class: "h-5 w-12 px-1 text-xs",
																			type: "number",
																			min: "0",
																			get value() {
																				return get($0);
																			},
																			oninput: (event) => $$props.onNumberAlertChange(get(row).id, "memberCountDrops", event.currentTarget.value)
																		});
																	}
																	reset(label_1);
																	var node_19 = sibling(label_1, 2);
																	{
																		let $0 = user_derived(() => `rankedWarStarts-${get(row).id}`);
																		AlertCheckbox$1(node_19, {
																			get id() {
																				return get($0);
																			},
																			label: "ranked war starts",
																			get checked() {
																				return get(row).alerts.rankedWarStarts;
																			},
																			onchange: (value) => $$props.onBooleanAlertChange(get(row).id, "rankedWarStarts", value)
																		});
																	}
																	var node_20 = sibling(node_19, 2);
																	{
																		let $0 = user_derived(() => `inRaid-${get(row).id}`);
																		AlertCheckbox$1(node_20, {
																			get id() {
																				return get($0);
																			},
																			label: "is in raid",
																			get checked() {
																				return get(row).alerts.inRaid;
																			},
																			onchange: (value) => $$props.onBooleanAlertChange(get(row).id, "inRaid", value)
																		});
																	}
																	var node_21 = sibling(node_20, 2);
																	{
																		let $0 = user_derived(() => `inTerritoryWar-${get(row).id}`);
																		AlertCheckbox$1(node_21, {
																			get id() {
																				return get($0);
																			},
																			label: "in territory war",
																			get checked() {
																				return get(row).alerts.inTerritoryWar;
																			},
																			onchange: (value) => $$props.onBooleanAlertChange(get(row).id, "inTerritoryWar", value)
																		});
																	}
																	reset(div_1);
																	append($$anchor, div_1);
																};
																if_block(node_12, ($$render) => {
																	if (get(cell).column.id === "id") $$render(consequent_1);
																	else if (get(cell).column.id === "name") $$render(consequent_3, 1);
																	else if (get(cell).column.id === "chain") $$render(consequent_5, 2);
																	else if (get(cell).column.id === "members") $$render(consequent_7, 3);
																	else if (get(cell).column.id === "respect") $$render(consequent_10, 4);
																	else if (get(cell).column.id === "remove") $$render(consequent_11, 5);
																	else if (get(cell).column.id === "notifications") $$render(consequent_12, 6);
																});
																append($$anchor, fragment_11);
															},
															$$slots: { default: true }
														});
													});
												}
												append($$anchor, fragment_10);
											});
											append($$anchor, fragment_9);
										},
										$$slots: { default: true }
									});
								});
								append($$anchor, fragment_8);
							}, ($$anchor) => {
								var fragment_24 = comment();
								component(first_child(fragment_24), () => Table_row, ($$anchor, Table_Row_2) => {
									Table_Row_2($$anchor, {
										children: ($$anchor, $$slotProps) => {
											var fragment_25 = comment();
											component(first_child(fragment_25), () => Table_cell, ($$anchor, Table_Cell_1) => {
												Table_Cell_1($$anchor, {
													get colspan() {
														return $$props.columns.length;
													},
													class: "p-4 text-center text-muted-foreground",
													children: ($$anchor, $$slotProps) => {
														next();
														append($$anchor, text$1("No faction stakeouts configured."));
													},
													$$slots: { default: true }
												});
											});
											append($$anchor, fragment_25);
										},
										$$slots: { default: true }
									});
								});
								append($$anchor, fragment_24);
							});
							append($$anchor, fragment_7);
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
//#region src/extension/entrypoints/targets/components/faction-stakeouts/helpers.ts
function getFactionStakeoutRows(source) {
	return (source?.list ?? []).toSorted((a, b) => a.order - b.order).map((entry) => getFactionStakeoutRow(entry.id, entry, false));
}
function getFactionStakeoutRow(id, entry, isNew) {
	return {
		id,
		info: entry.info ?? null,
		alerts: getAlerts$1(entry.alerts),
		isNew
	};
}
function getStoredFactionStakeouts(sourceRows, currentDate = 0) {
	const now = Date.now();
	return {
		date: currentDate,
		list: sourceRows.map((row) => ({
			id: row.id,
			order: now,
			info: row.info,
			alerts: row.alerts
		}))
	};
}
function getAlerts$1(alerts) {
	return {
		chainReaches: typeof alerts?.chainReaches === "number" ? alerts.chainReaches : false,
		memberCountDrops: typeof alerts?.memberCountDrops === "number" ? alerts.memberCountDrops : false,
		rankedWarStarts: Boolean(alerts?.rankedWarStarts),
		inRaid: Boolean(alerts?.inRaid),
		inTerritoryWar: Boolean(alerts?.inTerritoryWar)
	};
}
//#endregion
//#region src/extension/entrypoints/targets/components/faction-stakeouts/FactionStakeoutsTable.svelte
function FactionStakeoutsTable($$anchor, $$props) {
	push($$props, true);
	const $factionStakeoutsStore = () => store_get(factionStakeoutsStore, "$factionStakeoutsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const rows = user_derived(() => getFactionStakeoutRows($factionStakeoutsStore()));
	function updateRows(nextRows) {
		const nextStakeouts = getStoredFactionStakeouts(nextRows, $factionStakeoutsStore()?.date ?? 0);
		ttStorage.set({ factionStakeouts: nextStakeouts });
	}
	function removeFactionStakeout(id) {
		updateRows(get(rows).filter((row) => row.id !== id));
	}
	function updateBooleanAlert(id, key, value) {
		updateRows(get(rows).map((row) => row.id === id ? {
			...row,
			alerts: {
				...row.alerts,
				[key]: value
			}
		} : row));
	}
	function updateNumberAlert(id, key, value) {
		const nextValue = Number.parseInt(value, 10);
		updateRows(get(rows).map((row) => row.id === id ? {
			...row,
			alerts: {
				...row.alerts,
				[key]: Number.isNaN(nextValue) ? false : nextValue
			}
		} : row));
	}
	Data_table$1($$anchor, {
		get data() {
			return get(rows);
		},
		get columns() {
			return columns$1;
		},
		onRemove: removeFactionStakeout,
		onBooleanAlertChange: updateBooleanAlert,
		onNumberAlertChange: updateNumberAlert
	});
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/targets/components/faction-stakeouts/FactionStakeouts.svelte
var root_1$2 = from_html(`<!> Add`, 1);
var root$3 = from_html(`<div class="space-y-2"><div class="flex flex-wrap items-center justify-between gap-2"><div><h1 class="text-2xl font-bold">Faction Stakeouts</h1> <p class="text-sm text-muted-foreground"> </p></div> <div class="flex flex-wrap items-center gap-2"><!> <!> <!></div></div> <!></div>`);
function FactionStakeouts($$anchor, $$props) {
	push($$props, true);
	const $factionStakeoutsStore = () => store_get(factionStakeoutsStore, "$factionStakeoutsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const amountOfRows = user_derived(() => $factionStakeoutsStore()?.list?.length ?? 0);
	let factionId = state(null);
	async function resetFactionStakeouts() {
		await ttStorage.reset("factionStakeouts");
		toast.success("Faction stakeouts reset.");
	}
	function addFactionStakeout() {
		if (!get(factionId) || Number.isNaN(get(factionId))) {
			toast.error("Enter a valid faction ID.");
			return;
		}
		const rows = getFactionStakeoutRows($factionStakeoutsStore());
		if (rows.some((row) => row.id === get(factionId))) {
			toast.error("This faction already has a stakeout.");
			return;
		}
		const nextStakeouts = getStoredFactionStakeouts([...rows, getFactionStakeoutRow(get(factionId), null, true)], $factionStakeoutsStore()?.date ?? 0);
		ttStorage.set({ factionStakeouts: nextStakeouts }).catch(console.error);
		set(factionId, null);
	}
	var div = root$3();
	var div_1 = child(div);
	var div_2 = child(div_1);
	var p = sibling(child(div_2), 2);
	var text = child(p);
	reset(p);
	reset(div_2);
	var div_3 = sibling(div_2, 2);
	var node = child(div_3);
	Input(node, {
		class: "w-36",
		type: "number",
		min: "1",
		placeholder: "Faction ID",
		onkeydown: (event) => event.key === "Enter" && addFactionStakeout(),
		get value() {
			return get(factionId);
		},
		set value($$value) {
			set(factionId, $$value, true);
		}
	});
	var node_1 = sibling(node, 2);
	Button(node_1, {
		onclick: addFactionStakeout,
		children: ($$anchor, $$slotProps) => {
			var fragment = root_1$2();
			PlusIcon(first_child(fragment), { class: "size-4" });
			next();
			append($$anchor, fragment);
		},
		$$slots: { default: true }
	});
	ResetAction(sibling(node_1, 2), {
		title: "Reset faction stakeouts",
		description: "Are you sure you want to delete all faction stakeouts?",
		onConfirm: resetFactionStakeouts
	});
	reset(div_3);
	reset(div_1);
	FactionStakeoutsTable(sibling(div_1, 2), {});
	reset(div);
	template_effect(() => set_text(text, `${get(amountOfRows) ?? ""} tracked ${get(amountOfRows) === 1 ? "faction" : "factions"}`));
	append($$anchor, div);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/targets/components/stakeouts/helpers.ts
function getStakeoutRows(source) {
	return (source?.list ?? []).toSorted((a, b) => a.order - b.order).map((entry) => getStakeoutRow(entry.id, entry, false));
}
function getStakeoutRow(id, stakeout, isNew) {
	return {
		id,
		info: stakeout.info ?? null,
		label: stakeout.label ?? "",
		alerts: getAlerts(stakeout.alerts),
		isNew
	};
}
function getStoredStakeouts(sourceRows, currentDate = 0) {
	return {
		date: currentDate,
		list: sourceRows.map((row) => ({
			id: row.id,
			order: Date.now(),
			info: row.info,
			alerts: row.alerts,
			label: row.label
		}))
	};
}
function getAlerts(alerts) {
	return {
		okay: alerts?.okay,
		hospital: alerts?.hospital,
		landing: alerts?.landing,
		online: alerts?.online,
		life: alerts?.life,
		offline: typeof alerts?.offline === "number" ? alerts.offline : false,
		revivable: Boolean(alerts?.revivable)
	};
}
//#endregion
//#region src/extension/entrypoints/targets/components/stakeouts/columns.ts
var columns = [
	createColumn("id", "ID"),
	createColumn("name", "Name"),
	createColumn("label", "Label"),
	createColumn("status", "Status"),
	createColumn("lastAction", "Last Action"),
	createColumn("remove", "Remove"),
	createColumn("notifications", "Notifications")
];
function createColumn(id, header) {
	return {
		id,
		header
	};
}
//#endregion
//#region src/extension/entrypoints/targets/components/stakeouts/AlertCheckbox.svelte
var root$2 = from_html(`<label class="flex items-center gap-1 text-xs"><!> <span> </span></label>`);
function AlertCheckbox($$anchor, $$props) {
	push($$props, true);
	var label_1 = root$2();
	var node = child(label_1);
	Checkbox(node, {
		get id() {
			return $$props.id;
		},
		get checked() {
			return $$props.checked;
		},
		onCheckedChange: (value) => $$props.onchange(Boolean(value))
	});
	var span = sibling(node, 2);
	var text = child(span, true);
	reset(span);
	reset(label_1);
	template_effect(() => {
		set_attribute(label_1, "for", $$props.id);
		set_text(text, $$props.label);
	});
	append($$anchor, label_1);
	pop();
}
//#endregion
//#region src/extension/entrypoints/targets/components/stakeouts/data-table.svelte
var root_13 = from_html(`<a class="hover:underline" target="_blank" rel="noreferrer"> </a>`);
var root_15 = from_html(`<a class="hover:underline" target="_blank" rel="noreferrer"> </a>`);
var root_16 = from_html(`<span class="text-muted-foreground"> </span>`);
var root_19 = from_html(`<span class="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"><span></span> </span>`);
var root_18 = from_html(`<div><!></div>`);
var root_23 = from_html(`<div class="grid grid-cols-2 gap-x-2 gap-y-0.5"><!> <!> <!> <!> <label class="flex items-center gap-1 text-xs"><span>life drops below</span> <!> <span>%</span></label> <label class="flex items-center gap-1 text-xs"><span>offline over</span> <!> <span>hours</span></label> <!></div>`);
var root_1$1 = from_html(`<!> <!>`, 1);
var root$1 = from_html(`<div class="overflow-hidden rounded-lg border bg-card"><!></div>`);
function Data_table($$anchor, $$props) {
	push($$props, true);
	const table = createSvelteTable({
		get data() {
			return $$props.data;
		},
		get columns() {
			return $$props.columns;
		},
		getRowId: (row) => String(row.id),
		getCoreRowModel: getCoreRowModel()
	});
	function getStatusSortValue(info) {
		switch (info?.last_action.status.toLowerCase()) {
			case "online": return 1;
			case "idle": return 2;
			case "offline": return 3;
			default: return 0;
		}
	}
	function getStatusDotClass(status) {
		const normalizedStatus = status.toLowerCase();
		if (normalizedStatus === "online") return "bg-green-500";
		if (normalizedStatus === "idle") return "bg-orange-400";
		return "bg-white";
	}
	function getHeaderClass(columnId) {
		return columnId === "id" || columnId === "remove" ? "px-2 py-2 text-center" : "px-2 py-2 text-left";
	}
	function getCellClass(columnId) {
		return cn(["px-2", {
			"py-1.5": columnId !== "notifications",
			"py-2": columnId === "notifications",
			"text-center": columnId === "id" || columnId === "remove"
		}]);
	}
	var div = root$1();
	component(child(div), () => Table, ($$anchor, Table_Root) => {
		Table_Root($$anchor, {
			children: ($$anchor, $$slotProps) => {
				var fragment = root_1$1();
				var node_1 = first_child(fragment);
				component(node_1, () => Table_header, ($$anchor, Table_Header) => {
					Table_Header($$anchor, {
						class: "bg-muted/60",
						children: ($$anchor, $$slotProps) => {
							var fragment_1 = comment();
							each(first_child(fragment_1), 17, () => table.getHeaderGroups(), (headerGroup) => headerGroup.id, ($$anchor, headerGroup) => {
								var fragment_2 = comment();
								component(first_child(fragment_2), () => Table_row, ($$anchor, Table_Row) => {
									Table_Row($$anchor, {
										children: ($$anchor, $$slotProps) => {
											var fragment_3 = comment();
											each(first_child(fragment_3), 17, () => get(headerGroup).headers, (header) => header.id, ($$anchor, header) => {
												var fragment_4 = comment();
												var node_5 = first_child(fragment_4);
												{
													let $0 = user_derived(() => getHeaderClass(get(header).column.id));
													component(node_5, () => Table_head, ($$anchor, Table_Head) => {
														Table_Head($$anchor, {
															get colspan() {
																return get(header).colSpan;
															},
															get class() {
																return get($0);
															},
															children: ($$anchor, $$slotProps) => {
																var fragment_5 = comment();
																var node_6 = first_child(fragment_5);
																var consequent = ($$anchor) => {
																	{
																		let $0 = user_derived(() => get(header).getContext());
																		Flex_render($$anchor, {
																			get content() {
																				return get(header).column.columnDef.header;
																			},
																			get context() {
																				return get($0);
																			}
																		});
																	}
																};
																if_block(node_6, ($$render) => {
																	if (!get(header).isPlaceholder) $$render(consequent);
																});
																append($$anchor, fragment_5);
															},
															$$slots: { default: true }
														});
													});
												}
												append($$anchor, fragment_4);
											});
											append($$anchor, fragment_3);
										},
										$$slots: { default: true }
									});
								});
								append($$anchor, fragment_2);
							});
							append($$anchor, fragment_1);
						},
						$$slots: { default: true }
					});
				});
				component(sibling(node_1, 2), () => Table_body, ($$anchor, Table_Body) => {
					Table_Body($$anchor, {
						children: ($$anchor, $$slotProps) => {
							var fragment_7 = comment();
							each(first_child(fragment_7), 17, () => table.getRowModel().rows, (tableRow) => tableRow.id, ($$anchor, tableRow) => {
								const row = user_derived(() => get(tableRow).original);
								var fragment_8 = comment();
								component(first_child(fragment_8), () => Table_row, ($$anchor, Table_Row_1) => {
									Table_Row_1($$anchor, {
										get "data-id"() {
											return get(row).id;
										},
										children: ($$anchor, $$slotProps) => {
											var fragment_9 = comment();
											each(first_child(fragment_9), 17, () => get(tableRow).getVisibleCells(), (cell) => cell.id, ($$anchor, cell) => {
												var fragment_10 = comment();
												var node_11 = first_child(fragment_10);
												{
													let $0 = user_derived(() => getCellClass(get(cell).column.id));
													component(node_11, () => Table_cell, ($$anchor, Table_Cell) => {
														Table_Cell($$anchor, {
															get class() {
																return get($0);
															},
															children: ($$anchor, $$slotProps) => {
																var fragment_11 = comment();
																var node_12 = first_child(fragment_11);
																var consequent_1 = ($$anchor) => {
																	var a = root_13();
																	var text = child(a, true);
																	reset(a);
																	template_effect(() => {
																		set_attribute(a, "href", `https://www.torn.com/profiles.php?XID=${get(row).id}`);
																		set_text(text, get(row).id);
																	});
																	append($$anchor, a);
																};
																var consequent_3 = ($$anchor) => {
																	var fragment_12 = comment();
																	var node_13 = first_child(fragment_12);
																	var consequent_2 = ($$anchor) => {
																		var a_1 = root_15();
																		var text_1 = child(a_1, true);
																		reset(a_1);
																		template_effect(() => {
																			set_attribute(a_1, "href", `https://www.torn.com/profiles.php?XID=${get(row).id}`);
																			set_text(text_1, get(row).info.name);
																		});
																		append($$anchor, a_1);
																	};
																	var alternate = ($$anchor) => {
																		var span = root_16();
																		var text_2 = child(span, true);
																		reset(span);
																		template_effect(() => set_text(text_2, get(row).isNew ? "Pending save" : "Unknown"));
																		append($$anchor, span);
																	};
																	if_block(node_13, ($$render) => {
																		if (get(row).info?.name) $$render(consequent_2);
																		else $$render(alternate, -1);
																	});
																	append($$anchor, fragment_12);
																};
																var consequent_4 = ($$anchor) => {
																	Input($$anchor, {
																		get value() {
																			return get(row).label;
																		},
																		placeholder: "label...",
																		oninput: (event) => $$props.onLabelChange(get(row).id, event.currentTarget.value)
																	});
																};
																var consequent_6 = ($$anchor) => {
																	var div_1 = root_18();
																	var node_14 = child(div_1);
																	var consequent_5 = ($$anchor) => {
																		const lastActionStatus = user_derived(() => get(row).info.last_action.status);
																		var span_1 = root_19();
																		var span_2 = child(span_1);
																		var text_3 = sibling(span_2);
																		reset(span_1);
																		template_effect(($0) => {
																			set_class(span_2, 1, $0);
																			set_text(text_3, ` ${get(row).info.last_action.status ?? ""}`);
																		}, [() => `size-2.5 rounded-full ${getStatusDotClass(get(lastActionStatus))}`]);
																		append($$anchor, span_1);
																	};
																	if_block(node_14, ($$render) => {
																		if (get(row).info?.last_action.status) $$render(consequent_5);
																	});
																	reset(div_1);
																	template_effect(($0) => set_attribute(div_1, "data-value", $0), [() => getStatusSortValue(get(row).info)]);
																	append($$anchor, div_1);
																};
																var consequent_7 = ($$anchor) => {
																	var text_4 = text$1();
																	template_effect(() => set_text(text_4, get(row).info?.last_action.relative ?? ""));
																	append($$anchor, text_4);
																};
																var consequent_8 = ($$anchor) => {
																	{
																		let $0 = user_derived(() => `Remove ${get(row).id}`);
																		Button($$anchor, {
																			variant: "ghost",
																			size: "icon",
																			get "aria-label"() {
																				return get($0);
																			},
																			onclick: () => $$props.onRemove(get(row).id),
																			children: ($$anchor, $$slotProps) => {
																				TrashIcon($$anchor, {
																					class: "size-4 text-destructive",
																					"aria-hidden": "true"
																				});
																			},
																			$$slots: { default: true }
																		});
																	}
																};
																var consequent_9 = ($$anchor) => {
																	var div_2 = root_23();
																	var node_15 = child(div_2);
																	{
																		let $0 = user_derived(() => `okay-${get(row).id}`);
																		AlertCheckbox(node_15, {
																			get id() {
																				return get($0);
																			},
																			label: "is okay",
																			get checked() {
																				return get(row).alerts.okay;
																			},
																			onchange: (value) => $$props.onBooleanAlertChange(get(row).id, "okay", value)
																		});
																	}
																	var node_16 = sibling(node_15, 2);
																	{
																		let $0 = user_derived(() => `hospital-${get(row).id}`);
																		AlertCheckbox(node_16, {
																			get id() {
																				return get($0);
																			},
																			label: "is in hospital",
																			get checked() {
																				return get(row).alerts.hospital;
																			},
																			onchange: (value) => $$props.onBooleanAlertChange(get(row).id, "hospital", value)
																		});
																	}
																	var node_17 = sibling(node_16, 2);
																	{
																		let $0 = user_derived(() => `landing-${get(row).id}`);
																		AlertCheckbox(node_17, {
																			get id() {
																				return get($0);
																			},
																			label: "lands",
																			get checked() {
																				return get(row).alerts.landing;
																			},
																			onchange: (value) => $$props.onBooleanAlertChange(get(row).id, "landing", value)
																		});
																	}
																	var node_18 = sibling(node_17, 2);
																	{
																		let $0 = user_derived(() => `online-${get(row).id}`);
																		AlertCheckbox(node_18, {
																			get id() {
																				return get($0);
																			},
																			label: "comes online",
																			get checked() {
																				return get(row).alerts.online;
																			},
																			onchange: (value) => $$props.onBooleanAlertChange(get(row).id, "online", value)
																		});
																	}
																	var label = sibling(node_18, 2);
																	var node_19 = sibling(child(label), 2);
																	{
																		let $0 = user_derived(() => get(row).alerts.life || "");
																		Input(node_19, {
																			class: "h-5 w-12 px-1 text-xs",
																			type: "number",
																			min: "1",
																			max: "100",
																			get value() {
																				return get($0);
																			},
																			oninput: (event) => $$props.onNumberAlertChange(get(row).id, "life", event.currentTarget.value)
																		});
																	}
																	next(2);
																	reset(label);
																	var label_1 = sibling(label, 2);
																	var node_20 = sibling(child(label_1), 2);
																	{
																		let $0 = user_derived(() => get(row).alerts.offline || "");
																		Input(node_20, {
																			class: "h-5 w-12 px-1 text-xs",
																			type: "number",
																			min: "1",
																			get value() {
																				return get($0);
																			},
																			oninput: (event) => $$props.onNumberAlertChange(get(row).id, "offline", event.currentTarget.value)
																		});
																	}
																	next(2);
																	reset(label_1);
																	var node_21 = sibling(label_1, 2);
																	{
																		let $0 = user_derived(() => `revivable-${get(row).id}`);
																		AlertCheckbox(node_21, {
																			get id() {
																				return get($0);
																			},
																			label: "is revivable",
																			get checked() {
																				return get(row).alerts.revivable;
																			},
																			onchange: (value) => $$props.onBooleanAlertChange(get(row).id, "revivable", value)
																		});
																	}
																	reset(div_2);
																	append($$anchor, div_2);
																};
																if_block(node_12, ($$render) => {
																	if (get(cell).column.id === "id") $$render(consequent_1);
																	else if (get(cell).column.id === "name") $$render(consequent_3, 1);
																	else if (get(cell).column.id === "label") $$render(consequent_4, 2);
																	else if (get(cell).column.id === "status") $$render(consequent_6, 3);
																	else if (get(cell).column.id === "lastAction") $$render(consequent_7, 4);
																	else if (get(cell).column.id === "remove") $$render(consequent_8, 5);
																	else if (get(cell).column.id === "notifications") $$render(consequent_9, 6);
																});
																append($$anchor, fragment_11);
															},
															$$slots: { default: true }
														});
													});
												}
												append($$anchor, fragment_10);
											});
											append($$anchor, fragment_9);
										},
										$$slots: { default: true }
									});
								});
								append($$anchor, fragment_8);
							}, ($$anchor) => {
								var fragment_17 = comment();
								component(first_child(fragment_17), () => Table_row, ($$anchor, Table_Row_2) => {
									Table_Row_2($$anchor, {
										children: ($$anchor, $$slotProps) => {
											var fragment_18 = comment();
											component(first_child(fragment_18), () => Table_cell, ($$anchor, Table_Cell_1) => {
												Table_Cell_1($$anchor, {
													get colspan() {
														return $$props.columns.length;
													},
													class: "p-4 text-center text-muted-foreground",
													children: ($$anchor, $$slotProps) => {
														next();
														append($$anchor, text$1("No stakeouts configured."));
													},
													$$slots: { default: true }
												});
											});
											append($$anchor, fragment_18);
										},
										$$slots: { default: true }
									});
								});
								append($$anchor, fragment_17);
							});
							append($$anchor, fragment_7);
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
//#region src/extension/entrypoints/targets/components/stakeouts/StakeoutsTable.svelte
function StakeoutsTable($$anchor, $$props) {
	push($$props, true);
	const $stakeoutsStore = () => store_get(stakeoutsStore, "$stakeoutsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const rows = user_derived(() => getStakeoutRows($stakeoutsStore()));
	function updateRows(nextRows) {
		const nextStakeouts = getStoredStakeouts(nextRows);
		ttStorage.set({ stakeouts: nextStakeouts });
	}
	function removeStakeout(id) {
		updateRows(get(rows).filter((row) => row.id !== id));
	}
	function updateLabel(id, label) {
		updateRows(get(rows).map((row) => row.id === id ? {
			...row,
			label
		} : row));
	}
	function updateBooleanAlert(id, key, value) {
		updateRows(get(rows).map((row) => row.id === id ? {
			...row,
			alerts: {
				...row.alerts,
				[key]: value
			}
		} : row));
	}
	function updateNumberAlert(id, key, value) {
		const nextValue = Number.parseInt(value, 10);
		updateRows(get(rows).map((row) => row.id === id ? {
			...row,
			alerts: {
				...row.alerts,
				[key]: Number.isNaN(nextValue) ? false : nextValue
			}
		} : row));
	}
	Data_table($$anchor, {
		get data() {
			return get(rows);
		},
		get columns() {
			return columns;
		},
		onRemove: removeStakeout,
		onLabelChange: updateLabel,
		onBooleanAlertChange: updateBooleanAlert,
		onNumberAlertChange: updateNumberAlert
	});
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/targets/components/stakeouts/Stakeouts.svelte
var root_1 = from_html(`<!> Add`, 1);
var root = from_html(`<div class="space-y-2"><div class="flex flex-wrap items-center justify-between gap-2"><div><h1 class="text-2xl font-bold">Stakeouts</h1> <p class="text-sm text-muted-foreground"> </p></div> <div class="flex flex-wrap items-center gap-2"><!> <!> <!></div></div> <!></div>`);
function Stakeouts($$anchor, $$props) {
	push($$props, true);
	const $stakeoutsStore = () => store_get(stakeoutsStore, "$stakeoutsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const amountOfRows = user_derived(() => $stakeoutsStore()?.list?.length ?? 0);
	let stakeoutId = state(null);
	async function resetStakeouts() {
		await ttStorage.reset("stakeouts");
		toast.success("Stakeouts reset.");
	}
	function addStakeout() {
		if (!get(stakeoutId) || Number.isNaN(get(stakeoutId))) {
			toast.error("Enter a valid user ID.");
			return;
		}
		const rows = getStakeoutRows($stakeoutsStore());
		if (rows.some((row) => row.id === get(stakeoutId))) {
			toast.error("This user already has a stakeout.");
			return;
		}
		const nextStakeouts = getStoredStakeouts([...rows, getStakeoutRow(get(stakeoutId), null, true)], $stakeoutsStore()?.date ?? 0);
		ttStorage.set({ stakeouts: nextStakeouts }).catch(console.error);
		set(stakeoutId, null);
	}
	var div = root();
	var div_1 = child(div);
	var div_2 = child(div_1);
	var p = sibling(child(div_2), 2);
	var text = child(p);
	reset(p);
	reset(div_2);
	var div_3 = sibling(div_2, 2);
	var node = child(div_3);
	Input(node, {
		class: "w-36",
		type: "number",
		min: "1",
		placeholder: "User ID",
		onkeydown: (event) => event.key === "Enter" && addStakeout(),
		get value() {
			return get(stakeoutId);
		},
		set value($$value) {
			set(stakeoutId, $$value, true);
		}
	});
	var node_1 = sibling(node, 2);
	Button(node_1, {
		onclick: addStakeout,
		children: ($$anchor, $$slotProps) => {
			var fragment = root_1();
			PlusIcon(first_child(fragment), { class: "size-4" });
			next();
			append($$anchor, fragment);
		},
		$$slots: { default: true }
	});
	ResetAction(sibling(node_1, 2), {
		title: "Reset stakeouts",
		description: "Are you sure you want to delete all stakeouts?",
		onConfirm: resetStakeouts
	});
	reset(div_3);
	reset(div_1);
	StakeoutsTable(sibling(div_1, 2), {});
	reset(div);
	template_effect(() => set_text(text, `${get(amountOfRows) ?? ""} tracked ${get(amountOfRows) === 1 ? "player" : "players"}`));
	append($$anchor, div);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/targets/Targets.svelte
function Targets($$anchor) {
	const routes = {
		"/attackhistory": AttackHistory,
		"/stakeouts": Stakeouts,
		"/factionstakeouts": FactionStakeouts,
		"/": AttackHistoryRedirect
	};
	GlobalLayout($$anchor, {
		children: ($$anchor, $$slotProps) => {
			Router($$anchor, { get routes() {
				return routes;
			} });
		},
		$$slots: { default: true }
	});
}
//#endregion
//#region src/extension/entrypoints/targets/targets.ts
mount(Targets, { target: document.getElementById("app") });
//#endregion

//# sourceMappingURL=targets-VxRjW4UW.js.map