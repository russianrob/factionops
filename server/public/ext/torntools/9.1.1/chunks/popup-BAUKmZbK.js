import { b as isHTMLElement, d as isToday, j as browser, p as sleep, r as TO_MILLIS } from "./utilities-DwImhkRX.js";
import { $ as clsx, At as user_effect, B as onMount, Ft as sibling, G as bind_this, Gt as store_get, H as rest_props, It as proxy, Kt as writable, Nt as child, Pt as first_child, Q as set_class, R as ttStorage, Rt as set, S as ttCache, Tt as get, V as prop, Vt as user_derived, W as init, Wt as setup_stores, X as set_attribute, Xt as pop, Y as attribute_effect, Z as set_style, Zt as push, a as BACKGROUND_SERVICE, c as cn, d as initializeDatabase, dt as set_text, en as next, f as loadDatabase, g as storageListeners, gt as from_svg, ht as from_html, i as exposeDebugObjects, it as snippet, kt as template_effect, lt as if_block, mt as comment, n as setMode, nn as noop, nt as element, ot as each, pt as append, rt as component, st as index, t as Mode_watcher, tn as reset, tt as action, ut as mount, vt as text, zt as state } from "./dist-DM3lq6UN.js";
import { Bt as formatNumber, Ft as capitalizeText, Gt as link, Ht as toSeconds, Jt as router, Lt as dropDecimals, Pt as applyPlural, Vt as formatTime, Wt as Router, _ as tv, a as Tooltip, c as Tooltip_content, d as Badge, h as Button, i as active, l as Sonner_1, m as getIconContext, n as Input, o as Tooltip_trigger, qt as replace, r as registerExtensionContext, s as Tooltip_provider, t as TrashIcon, v as Separator, zt as formatDate } from "./TrashIcon-DJq8vlLE.js";
import { B as getRewardValue, G as isSellable, H as getStockIncrement, I as LINKS, R as getNextChainBonus, U as getStockReward, V as getStockBoughtPrice, W as isDividendStock, _ as Card_description, a as Input_group, b as fetchData, c as Command_group, d as MagnifyingGlassIcon, f as changeAPIKey, g as Card_header, h as Card_title, i as Command_input, j as ALL_ICONS, k as Spinner, l as Command_empty, m as Card, n as Command_list, o as Input_group_input, p as checkAPIPermission, r as Command_item, s as Input_group_addon, t as Command_shortcut, u as Command, v as Card_content, z as getRequiredStocks } from "./command-DIy3eOEG.js";
import { t as CaretDownIcon } from "./CaretDownIcon-tH-TmQfe.js";
import { a as Table_cell, i as Table_head, n as Table_row, o as Table_body, r as Table_header, t as Table } from "./table-BDI1Tawr.js";
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
var root$32 = from_html(`<label class="truncate text-xs"> </label> <!>`, 1);
var root_1$22 = from_html(`<!> <!>`, 1);
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
				var fragment_1 = root_1$22();
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
							class: "bg-popover absolute top-full z-10 mt-1 max-h-52 w-full rounded-md p-1",
							children: ($$anchor, $$slotProps) => {
								var fragment_3 = root_1$22();
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
																var fragment_6 = root$32();
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
																					pattern: "\\d*",
																					inputmode: "numeric",
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
var root$31 = from_html(`<div class="grid grid-cols-[64px_1fr_auto] gap-1"><span> </span> <span class="truncate"> </span> <span> </span></div>`);
var root_1$21 = from_html(`<div class="text-muted-foreground">No items selected.</div>`);
var root_2$10 = from_html(`<!> <div class="flex justify-between gap-1"><!> <div class="text-right font-bold"> </div></div>`, 1);
var root_3$10 = from_html(`<!> <!>`, 1);
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
		class: "mx-1 rounded-lg",
		children: ($$anchor, $$slotProps) => {
			Card_content($$anchor, {
				class: "space-y-2 text-xs",
				children: ($$anchor, $$slotProps) => {
					var fragment_2 = root_3$10();
					var node = first_child(fragment_2);
					each(node, 17, selectedItems, (item) => item.id, ($$anchor, item) => {
						const tornItem = user_derived(() => get(itemsMap)[get(item).id]);
						var fragment_3 = comment();
						var node_1 = first_child(fragment_3);
						var consequent = ($$anchor) => {
							var div = root$31();
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
						append($$anchor, root_1$21());
					});
					var node_2 = sibling(node, 2);
					var consequent_1 = ($$anchor) => {
						var fragment_4 = root_2$10();
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
var root$30 = from_html(`<div class="min-h-72 space-y-2"><!> <!></div>`);
function Calculator($$anchor, $$props) {
	push($$props, true);
	const $localdataStore = () => store_get(localdataStore, "$localdataStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	let selectedItems = state(proxy([]));
	user_effect(() => {
		set(selectedItems, [...$localdataStore()?.popup?.calculatorItems ?? []], true);
	});
	var div = root$30();
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
var root$29 = from_html(`<a class="block space-y-1" target="_blank" rel="noreferrer"><div class="flex items-center justify-between text-xs"><span class="font-medium"> </span> <span class="text-foreground/80"> </span></div> <div class="bg-muted h-1.5 overflow-hidden rounded-sm"><div></div></div> <div class="text-foreground/80 flex justify-between gap-2 text-xs leading-none"><span> </span> <span class="truncate text-right"> </span></div></a>`);
var root_1$20 = from_html(`<div class="text-foreground/80 text-xs">No bar data available.</div>`);
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
			result.push(getResourceBar("energy", "Energy", userdata.bars.energy, LINKS.gym, "bg-[#7cc833]", settings, currentTime), getResourceBar("nerve", "Nerve", userdata.bars.nerve, LINKS.crimes, "bg-[#b3382c]", settings, currentTime), getResourceBar("happy", "Happy", userdata.bars.happy, LINKS.properties, "bg-[#d4c927]", settings, currentTime), getResourceBar("life", "Life", userdata.bars.life, LINKS.items_medical, "bg-[#7b98ee]", settings, currentTime));
			const chainBar = getChainBar(userdata.bars.chain, currentTime);
			if (chainBar) result.push(chainBar);
		}
		if (settings?.apiUsage?.user?.travel) {
			const travelBar = getTravelBar(userdata, currentTime);
			if (travelBar) result.push(travelBar);
		}
		return result;
	}
	function getResourceBar(id, label, bar, href, color, settings, currentTime) {
		const current = bar?.current ?? 0;
		const maximum = bar?.maximum ?? 100;
		const serverTime = Math.floor(currentTime / 1e3);
		const tickAt = (serverTime + (bar?.tick_time ?? 0)) * 1e3;
		let fullAt = (serverTime + (bar?.full_time ?? 0)) * 1e3;
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
	function getChainBar(bar, currentTime) {
		const current = bar?.current ?? 0;
		if (!current) return null;
		const serverTime = Math.floor(currentTime / 1e3);
		const maximum = current === bar?.max ? bar.max : getNextChainBonus(current) ?? bar?.max ?? current;
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
							var a = root$29();
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
							append($$anchor, root_1$20());
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
var root$28 = from_html(`<a class="bg-card border-border/70 hover:bg-muted rounded-lg border p-1 text-center text-xs" target="_blank" rel="noreferrer"><div> </div> <div class="text-foreground/80"> </div></a>`);
var root_1$19 = from_html(`<div class="grid grid-cols-3 gap-1"></div>`);
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
		var div = root_1$19();
		each(div, 21, () => get(cooldowns), (cooldown) => cooldown.id, ($$anchor, cooldown) => {
			var a = root$28();
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
var rest_excludes$5 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"children"
]);
var root$27 = from_svg(`<path d="M225.29,165.93C216.61,151,212,129.57,212,104a84,84,0,0,0-168,0c0,25.58-4.59,47-13.27,61.93A20.08,20.08,0,0,0,30.66,186,19.77,19.77,0,0,0,48,196H84.18a44,44,0,0,0,87.64,0H208a19.77,19.77,0,0,0,17.31-10A20.08,20.08,0,0,0,225.29,165.93ZM128,212a20,20,0,0,1-19.6-16h39.2A20,20,0,0,1,128,212ZM54.66,172C63.51,154,68,131.14,68,104a60,60,0,0,1,120,0c0,27.13,4.48,50,13.33,68Z"></path>`);
var root_1$18 = from_svg(`<path d="M208,192H48a8,8,0,0,1-6.88-12C47.71,168.6,56,139.81,56,104a72,72,0,0,1,144,0c0,35.82,8.3,64.6,14.9,76A8,8,0,0,1,208,192Z" opacity="0.2"></path><path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z"></path>`, 1);
var root_2$9 = from_svg(`<path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216Z"></path>`);
var root_3$9 = from_svg(`<path d="M220.07,176.94C214.41,167.2,206,139.73,206,104a78,78,0,1,0-156,0c0,35.74-8.42,63.2-14.08,72.94A14,14,0,0,0,48,198H90.48a38,38,0,0,0,75,0H208a14,14,0,0,0,12.06-21.06ZM128,218a26,26,0,0,1-25.29-20h50.58A26,26,0,0,1,128,218Zm81.71-33a1.9,1.9,0,0,1-1.7,1H48a1.9,1.9,0,0,1-1.7-1,2,2,0,0,1,0-2C53.87,170,62,139.69,62,104a66,66,0,1,1,132,0c0,35.68,8.14,65.95,15.71,79A2,2,0,0,1,209.71,185Z"></path>`);
var root_4$6 = from_svg(`<path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z"></path>`);
var root_5$4 = from_svg(`<path d="M218.35,178C212.58,168,204,140.13,204,104a76,76,0,1,0-152,0c0,36.13-8.59,64-14.36,73.95A12,12,0,0,0,48,196H92.23a36,36,0,0,0,71.54,0H208A12,12,0,0,0,218.35,178ZM128,220a28,28,0,0,1-27.71-24h55.42A28,28,0,0,1,128,220Zm83.45-34a3.91,3.91,0,0,1-3.44,2H48a3.91,3.91,0,0,1-3.44-2,4,4,0,0,1,0-4C52,169.17,60,139.32,60,104a68,68,0,1,1,136,0c0,35.31,8,65.17,15.44,78A4,4,0,0,1,211.45,186Z"></path>`);
var root_6$3 = from_svg(`<svg><!><rect width="256" height="256" fill="none"></rect><!></svg>`);
function BellIcon($$anchor, $$props) {
	push($$props, true);
	const ctx = getIconContext();
	let props = rest_props($$props, rest_excludes$5);
	let weight = user_derived(() => $$props.weight ?? ctx.weight ?? "regular");
	let color = user_derived(() => $$props.color ?? ctx.color ?? "currentColor");
	let size = user_derived(() => $$props.size ?? ctx.size ?? "1em");
	let mirrored = user_derived(() => $$props.mirrored ?? ctx.mirrored ?? false);
	function svgAttr(obj) {
		let { weight, color, size, mirrored, ...attrs } = obj;
		return attrs;
	}
	var svg = root_6$3();
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
		append($$anchor, root$27());
	};
	var consequent_2 = ($$anchor) => {
		var fragment_1 = root_1$18();
		next();
		append($$anchor, fragment_1);
	};
	var consequent_3 = ($$anchor) => {
		append($$anchor, root_2$9());
	};
	var consequent_4 = ($$anchor) => {
		append($$anchor, root_3$9());
	};
	var consequent_5 = ($$anchor) => {
		append($$anchor, root_4$6());
	};
	var consequent_6 = ($$anchor) => {
		append($$anchor, root_5$4());
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
//#region node_modules/phosphor-svelte/lib/BellSlashIcon.svelte
var rest_excludes$4 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"children"
]);
var root$26 = from_svg(`<path d="M216.88,207.93l-160-176A12,12,0,1,0,39.12,48.07l14.8,16.29A83.58,83.58,0,0,0,44,104c0,25.58-4.59,47-13.27,61.93A20.08,20.08,0,0,0,30.68,186,19.75,19.75,0,0,0,48,196H84.19a44,44,0,0,0,87.62,0h1.79l25.52,28.07a12,12,0,0,0,17.76-16.14ZM68,104a59.84,59.84,0,0,1,3.52-20.29L151.78,172H54.68C63.52,154,68,131.14,68,104Zm60,108a20,20,0,0,1-19.6-16h39.2A20,20,0,0,1,128,212ZM88.89,42.35a12,12,0,0,1,6.37-15.73A84,84,0,0,1,212,104c0,18.68,2.38,34.93,7.07,48.28a12,12,0,1,1-22.64,8C190.83,144.32,188,125.4,188,104a60,60,0,0,0-83.38-55.28A12,12,0,0,1,88.89,42.35Z"></path>`);
var root_1$17 = from_svg(`<path d="M208,192H48a8,8,0,0,1-6.88-12C47.71,168.6,56,139.81,56,104a72,72,0,0,1,144,0c0,35.82,8.3,64.6,14.9,76A8,8,0,0,1,208,192Z" opacity="0.2"></path><path d="M53.92,34.62A8,8,0,1,0,42.08,45.38L58.82,63.8A79.59,79.59,0,0,0,48,104c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.8a40,40,0,0,0,78.4,0h15.44l19.44,21.38a8,8,0,1,0,11.84-10.76ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a63.65,63.65,0,0,1,6.26-27.62L168.09,184Zm166-4.73a8.13,8.13,0,0,1-2.93.55,8,8,0,0,1-7.44-5.08C196.35,156.19,192,129.75,192,104A64,64,0,0,0,96.43,48.31a8,8,0,0,1-7.9-13.91A80,80,0,0,1,208,104c0,35.35,8.05,58.59,10.52,64.88A8,8,0,0,1,214,179.25Z"></path>`, 1);
var root_2$8 = from_svg(`<path d="M221.84,192v0a1.85,1.85,0,0,1-3,.28L83.27,43.19a4,4,0,0,1,.8-6A79.55,79.55,0,0,1,129.17,24C173,24.66,207.8,61.1,208,104.92c.14,34.88,8.31,61.54,13.82,71A15.89,15.89,0,0,1,221.84,192Zm-7.92,18.62a8,8,0,0,1-11.85,10.76L182.62,200H167.16a40,40,0,0,1-78.41,0H47.91a15.78,15.78,0,0,1-13.59-7.59,16.42,16.42,0,0,1-.09-16.68c5.55-9.73,13.7-36.64,13.7-71.73A79.42,79.42,0,0,1,58.79,63.85L42,45.38A8,8,0,1,1,53.84,34.62ZM150.59,200H105.32a24,24,0,0,0,45.27,0Z"></path>`);
var root_3$8 = from_svg(`<path d="M52.44,36A6,6,0,0,0,43.56,44L61.31,63.56A77.45,77.45,0,0,0,50,104c0,35.74-8.42,63.2-14.08,72.94A14,14,0,0,0,48,198h42.5a38,38,0,0,0,75,0h18l20,22a6,6,0,0,0,8.88-8.08ZM128,218a26,26,0,0,1-25.29-20h50.58A26,26,0,0,1,128,218ZM48,186a1.9,1.9,0,0,1-1.7-1,2,2,0,0,1,0-2C53.86,170,62,139.69,62,104a65.63,65.63,0,0,1,7.78-31.12L172.62,186Zm165.29-8.62a5.88,5.88,0,0,1-2.2.42,6,6,0,0,1-5.58-3.81c-7.2-18.31-11.49-44.48-11.49-70A66,66,0,0,0,95.45,46.57a6,6,0,1,1-5.93-10.43A78,78,0,0,1,206,104c0,35.7,8.16,59.24,10.66,65.61A6,6,0,0,1,213.27,177.38Z"></path>`);
var root_4$5 = from_svg(`<path d="M53.92,34.62A8,8,0,1,0,42.08,45.38L58.82,63.8A79.59,79.59,0,0,0,48,104c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.8a40,40,0,0,0,78.4,0h15.44l19.44,21.38a8,8,0,1,0,11.84-10.76ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a63.65,63.65,0,0,1,6.26-27.62L168.09,184Zm166-4.73a8.13,8.13,0,0,1-2.93.55,8,8,0,0,1-7.44-5.08C196.35,156.19,192,129.75,192,104A64,64,0,0,0,96.43,48.31a8,8,0,0,1-7.9-13.91A80,80,0,0,1,208,104c0,35.35,8.05,58.59,10.52,64.88A8,8,0,0,1,214,179.25Z"></path>`);
var root_5$3 = from_svg(`<path d="M51,37.31A4,4,0,0,0,45,42.69L63.8,63.32A75.52,75.52,0,0,0,52,104c0,36.13-8.58,64-14.36,73.95A12,12,0,0,0,48,196H92.23a36,36,0,0,0,71.54,0h20.64L205,218.69a4,4,0,1,0,5.92-5.38ZM128,220a28,28,0,0,1-27.71-24h55.42A28,28,0,0,1,128,220ZM48,188a3.89,3.89,0,0,1-3.43-2,4,4,0,0,1,0-4C52,169.17,60,139.32,60,104a67.58,67.58,0,0,1,9.4-34.51L177.14,188Zm164.55-12.48a3.94,3.94,0,0,1-1.46.28,4,4,0,0,1-3.72-2.54C200.24,155.17,196,129.28,196,104A68,68,0,0,0,94.46,44.83a4,4,0,1,1-4-6.95A76,76,0,0,1,204,104c0,36.05,8.26,59.89,10.79,66.34A4,4,0,0,1,212.53,175.52Z"></path>`);
var root_6$2 = from_svg(`<svg><!><rect width="256" height="256" fill="none"></rect><!></svg>`);
function BellSlashIcon($$anchor, $$props) {
	push($$props, true);
	const ctx = getIconContext();
	let props = rest_props($$props, rest_excludes$4);
	let weight = user_derived(() => $$props.weight ?? ctx.weight ?? "regular");
	let color = user_derived(() => $$props.color ?? ctx.color ?? "currentColor");
	let size = user_derived(() => $$props.size ?? ctx.size ?? "1em");
	let mirrored = user_derived(() => $$props.mirrored ?? ctx.mirrored ?? false);
	function svgAttr(obj) {
		let { weight, color, size, mirrored, ...attrs } = obj;
		return attrs;
	}
	var svg = root_6$2();
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
		append($$anchor, root$26());
	};
	var consequent_2 = ($$anchor) => {
		var fragment_1 = root_1$17();
		next();
		append($$anchor, fragment_1);
	};
	var consequent_3 = ($$anchor) => {
		append($$anchor, root_2$8());
	};
	var consequent_4 = ($$anchor) => {
		append($$anchor, root_3$8());
	};
	var consequent_5 = ($$anchor) => {
		append($$anchor, root_4$5());
	};
	var consequent_6 = ($$anchor) => {
		append($$anchor, root_5$3());
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
//#region src/extension/entrypoints/popup/components/dashboard/ExtraInformation.svelte
var root$25 = from_html(`<a class="bg-card border-border/70 hover:bg-muted rounded-lg border p-1 text-center text-xs" target="_blank" rel="noreferrer"><div class="font-medium"> </div> <div class="text-foreground/80"> </div></a>`);
var root_1$16 = from_html(`<div class="grid grid-cols-3 gap-1"></div> <div class="text-foreground/80 flex items-center justify-between text-xs"><div class="flex items-center gap-1"><span>Updated</span> <span class="text-foreground font-medium"> </span></div> <!></div>`, 1);
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
	var fragment = root_1$16();
	var div = first_child(fragment);
	each(div, 21, () => get(extraInformation), (item) => item.label, ($$anchor, item) => {
		var a = root$25();
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
var rest_excludes$3 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"children"
]);
var root$24 = from_svg(`<path d="M184.49,136.49l-80,80a12,12,0,0,1-17-17L159,128,87.51,56.49a12,12,0,1,1,17-17l80,80A12,12,0,0,1,184.49,136.49Z"></path>`);
var root_1$15 = from_svg(`<path d="M176,128,96,208V48Z" opacity="0.2"></path><path d="M181.66,122.34l-80-80A8,8,0,0,0,88,48V208a8,8,0,0,0,13.66,5.66l80-80A8,8,0,0,0,181.66,122.34ZM104,188.69V67.31L164.69,128Z"></path>`, 1);
var root_2$7 = from_svg(`<path d="M181.66,133.66l-80,80A8,8,0,0,1,88,208V48a8,8,0,0,1,13.66-5.66l80,80A8,8,0,0,1,181.66,133.66Z"></path>`);
var root_3$7 = from_svg(`<path d="M180.24,132.24l-80,80a6,6,0,0,1-8.48-8.48L167.51,128,91.76,52.24a6,6,0,0,1,8.48-8.48l80,80A6,6,0,0,1,180.24,132.24Z"></path>`);
var root_4$4 = from_svg(`<path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z"></path>`);
var root_5$2 = from_svg(`<path d="M178.83,130.83l-80,80a4,4,0,0,1-5.66-5.66L170.34,128,93.17,50.83a4,4,0,0,1,5.66-5.66l80,80A4,4,0,0,1,178.83,130.83Z"></path>`);
var root_6$1 = from_svg(`<svg><!><rect width="256" height="256" fill="none"></rect><!></svg>`);
function CaretRightIcon($$anchor, $$props) {
	push($$props, true);
	const ctx = getIconContext();
	let props = rest_props($$props, rest_excludes$3);
	let weight = user_derived(() => $$props.weight ?? ctx.weight ?? "regular");
	let color = user_derived(() => $$props.color ?? ctx.color ?? "currentColor");
	let size = user_derived(() => $$props.size ?? ctx.size ?? "1em");
	let mirrored = user_derived(() => $$props.mirrored ?? ctx.mirrored ?? false);
	function svgAttr(obj) {
		let { weight, color, size, mirrored, ...attrs } = obj;
		return attrs;
	}
	var svg = root_6$1();
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
		append($$anchor, root$24());
	};
	var consequent_2 = ($$anchor) => {
		var fragment_1 = root_1$15();
		next();
		append($$anchor, fragment_1);
	};
	var consequent_3 = ($$anchor) => {
		append($$anchor, root_2$7());
	};
	var consequent_4 = ($$anchor) => {
		append($$anchor, root_3$7());
	};
	var consequent_5 = ($$anchor) => {
		append($$anchor, root_4$4());
	};
	var consequent_6 = ($$anchor) => {
		append($$anchor, root_5$2());
	};
	var alternate = ($$anchor) => {
		var text$8 = text();
		text$8.nodeValue = (console.error("Unsupported icon weight. Choose from \"thin\", \"light\", \"regular\", \"bold\", \"fill\", or \"duotone\"."), "");
		append($$anchor, text$8);
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
var root$23 = from_html(`<!> <!>`, 1);
var root_1$14 = from_html(`<div class="bg-card rounded-lg border p-2 text-xs"><div class="flex items-center gap-2"><a class="hover:bg-muted/60 -m-1 grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1 rounded-md p-1" target="_blank" rel="noreferrer"><span class="truncate font-medium"> </span> <!></a> <!></div></div>`);
var root_2$6 = from_html(`<div class="space-y-1"></div>`);
var root_3$6 = from_html(`<section class="space-y-1"><div class="flex items-center justify-between"><div class="text-xs font-medium">Faction Stakeouts</div> <!></div> <!></section>`);
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
		var section = root_3$6();
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
			var div_1 = root_2$6();
			each(div_1, 21, () => get(factionStakeoutRows), (row) => row.id, ($$anchor, row) => {
				var div_2 = root_1$14();
				var div_3 = child(div_2);
				var a_1 = child(div_3);
				var span = child(a_1);
				var text$7 = child(span, true);
				reset(span);
				var node_4 = sibling(span, 2);
				var consequent_1 = ($$anchor) => {
					var fragment_4 = root$23();
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
					set_text(text$7, get(row).name);
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
var root$22 = from_html(`<div> </div>`);
var root_1$13 = from_html(`<a class="hover:underline" target="_blank" rel="noreferrer"> </a> <!>`, 1);
var root_2$5 = from_html(`<span class="block size-4"></span>`);
var root_3$5 = from_html(`<!> <!>`, 1);
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
		class: "gap-2! rounded-lg",
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = root_3$5();
			var node = first_child(fragment_1);
			Card_header(node, {
				children: ($$anchor, $$slotProps) => {
					Card_title($$anchor, {
						class: "flex w-full min-w-0 flex-wrap items-center justify-between truncate",
						children: ($$anchor, $$slotProps) => {
							var fragment_3 = root_1$13();
							var a = first_child(fragment_3);
							var text = child(a, true);
							reset(a);
							var node_1 = sibling(a, 2);
							var consequent = ($$anchor) => {
								var div = root$22();
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
										var fragment_7 = root_3$5();
										var node_5 = first_child(fragment_7);
										{
											const child = ($$anchor, $$arg0) => {
												let _props = () => ($$arg0?.()).props;
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
													var span = root_2$5();
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
var root$21 = from_html(`<span class="text-foreground/65 truncate"> </span>`);
var root_1$12 = from_html(`<div class="bg-card rounded-lg border p-2 text-xs"><div class="flex items-start gap-2"><a class="hover:bg-muted/60 -m-1 block min-w-0 flex-1 rounded-md p-1" target="_blank" rel="noreferrer"><div class="flex items-center gap-1.5"><span></span> <span class="truncate font-medium"> </span> <!></div> <div class="text-foreground/80 mt-1 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 text-[10px]"><span>Life</span> <div class="bg-muted h-1.5 flex-1 overflow-hidden rounded-sm"><div class="h-full bg-blue-500"></div></div> <span> </span></div> <div class="mt-1 flex items-center justify-between gap-2"><span> </span> <span class="text-foreground/80 shrink-0"> </span></div></a> <!></div></div>`);
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
	var div = root_1$12();
	var div_1 = child(div);
	var a = child(div_1);
	var div_2 = child(a);
	var span = child(div_2);
	var span_1 = sibling(span, 2);
	var text = child(span_1, true);
	reset(span_1);
	var node = sibling(span_1, 2);
	var consequent = ($$anchor) => {
		var span_2 = root$21();
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
var root$20 = from_html(`<div class="space-y-1"></div>`);
var root_1$11 = from_html(`<section class="space-y-1"><div class="flex items-center justify-between"><a class="text-xs font-medium hover:underline" target="_blank" rel="noreferrer">Stakeouts</a> <!></div> <!></section>`);
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
		var section = root_1$11();
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
			var div_1 = root$20();
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
var root$19 = from_html(`<div class="space-y-2"><!> <!> <!> <!> <!> <!></div>`);
function Dashboard($$anchor, $$props) {
	push($$props, true);
	let now = state(proxy(Date.now()));
	onMount(() => {
		const interval = window.setInterval(() => {
			set(now, Date.now(), true);
		}, 1e3);
		return () => window.clearInterval(interval);
	});
	var div = root$19();
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
var root$18 = from_html(`<div class="border-destructive/30 bg-destructive/10 text-destructive border-b px-3 py-2 text-xs"> </div>`);
var root_1$10 = from_html(`<a class="hover:bg-accent hover:text-accent-foreground rounded-sm px-1 py-0.5 text-xs whitespace-nowrap transition-colors"> </a>`);
var root_2$4 = from_html(`<div class="border-border border-b p-1"><nav class="flex items-center gap-1 overflow-x-auto"><!> <!></nav></div>`);
var root_3$4 = from_html(`<div class="bg-background text-foreground min-h-60"><!> <!> <main class="overflow-y-auto p-3"><!></main></div>`);
var root_4$3 = from_html(`<!> <!> <!>`, 1);
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
	var fragment = root_4$3();
	var node = first_child(fragment);
	Mode_watcher(node, { track: false });
	var node_1 = sibling(node, 2);
	Sonner_1(node_1, { richColors: true });
	component(sibling(node_1, 2), () => Tooltip_provider, ($$anchor, Tooltip_Provider) => {
		Tooltip_Provider($$anchor, {
			children: ($$anchor, $$slotProps) => {
				var div = root_3$4();
				let styles;
				var node_3 = child(div);
				var consequent = ($$anchor) => {
					var div_1 = root$18();
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
					var div_2 = root_2$4();
					var nav = child(div_2);
					var node_5 = child(nav);
					var consequent_1 = ($$anchor) => {
						var fragment_1 = comment();
						each(first_child(fragment_1), 17, () => get(enabledTabs), (tab) => tab.path, ($$anchor, tab) => {
							var a = root_1$10();
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
var root$17 = from_html(`Welcome to Torn<span class="text-primary">Tools</span>`, 1);
var root_1$9 = from_html(`<div class="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-2 py-1.5 text-xs"> </div>`);
var root_2$3 = from_html(`<div class="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300"> </div>`);
var root_3$3 = from_html(`<div class="space-y-1.5"><label for="api-key" class="text-xs font-medium">Please enter your API key:</label> <!></div> <!> <!> <div class="flex gap-2"><!> <!></div> <div class="text-muted-foreground text-xs">TornTools needs a <span class="text-amber-600 dark:text-amber-300">Limited Access</span> key.</div> <!> <a class="text-muted-foreground hover:text-foreground block text-xs" target="_blank" rel="noreferrer">Terms of Service</a>`, 1);
var root_4$2 = from_html(`<!> <!>`, 1);
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
			var fragment_1 = root_4$2();
			var node = first_child(fragment_1);
			Card_header(node, {
				class: "px-4",
				children: ($$anchor, $$slotProps) => {
					Card_title($$anchor, {
						class: "text-base",
						children: ($$anchor, $$slotProps) => {
							next();
							var fragment_3 = root$17();
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
					var fragment_4 = root_3$3();
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
						var div_1 = root_1$9();
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
						var div_2 = root_2$3();
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
var root$16 = from_html(`<span> </span> <!>`, 1);
var root_1$8 = from_html(`<!> <!>`, 1);
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
				var fragment_1 = root_1$8();
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
						let $0 = user_derived(() => cn("bg-popover mt-1 max-h-42 w-full rounded-md p-1", selectedItem() && "absolute top-full z-10"));
						component(node_3, () => Command_list, ($$anchor, Command_List) => {
							Command_List($$anchor, {
								get class() {
									return get($0);
								},
								children: ($$anchor, $$slotProps) => {
									var fragment_3 = root_1$8();
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
																	var fragment_6 = root$16();
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
var root$15 = from_html(`<!> <!>`, 1);
var root_1$7 = from_html(`<section class="space-y-1"><h2 class="text-xs font-bold"> </h2> <!></section>`);
function MarketPrice($$anchor, $$props) {
	push($$props, true);
	var section = root_1$7();
	var h2 = child(section);
	var text$5 = child(h2, true);
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
											var fragment_3 = root$15();
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
													class: "text-muted-foreground p-1 text-center",
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
	template_effect(() => set_text(text$5, $$props.title));
	append($$anchor, section);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/alert/alert-description.svelte
var rest_excludes$2 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class",
	"children"
]);
var root$14 = from_html(`<div><!></div>`);
function Alert_description($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes$2);
	var div = root$14();
	attribute_effect(div, ($0) => ({
		"data-slot": "alert-description",
		class: $0,
		...restProps
	}), [() => cn("text-muted-foreground [&_a]:hover:text-foreground text-sm text-balance md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4", $$props.class)]);
	snippet(child(div), () => $$props.children ?? noop);
	reset(div);
	bind_this(div, ($$value) => ref($$value), () => ref());
	append($$anchor, div);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/alert/alert-title.svelte
var rest_excludes$1 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class",
	"children"
]);
var root$13 = from_html(`<div><!></div>`);
function Alert_title($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes$1);
	var div = root$13();
	attribute_effect(div, ($0) => ({
		"data-slot": "alert-title",
		class: $0,
		...restProps
	}), [() => cn("font-heading [&_a]:hover:text-foreground font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3", $$props.class)]);
	snippet(child(div), () => $$props.children ?? noop);
	reset(div);
	bind_this(div, ($$value) => ref($$value), () => ref());
	append($$anchor, div);
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
var rest_excludes = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class",
	"variant",
	"children"
]);
var root$12 = from_html(`<div><!></div>`);
function Alert($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), variant = prop($$props, "variant", 3, "default"), restProps = rest_props($$props, rest_excludes);
	var div = root$12();
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
//#endregion
//#region src/extension/entrypoints/popup/components/market/SearchResult.svelte
var root$11 = from_html(`<!> <!>`, 1);
var root_1$6 = from_html(`<a class="hover:underline" target="_blank" rel="noreferrer"> </a>`);
var root_2$2 = from_html(`<!> <!> <!>`, 1);
var root_3$2 = from_html(`<img class="border-border size-16 rounded-md border object-contain"/> <div class="min-w-0 space-y-1"><!> <!> <div class="grid grid-cols-2 gap-2 pt-1 text-xs"><div><div class="text-muted-foreground">Circulation</div> <div> </div></div> <div><div class="text-muted-foreground">Market value</div> <div> </div></div></div></div>`, 1);
var root_4$1 = from_html(`<div class="text-muted-foreground flex items-center gap-2 py-2"><!> <span>Loading prices...</span></div>`);
var root_5$1 = from_html(`<div><!> <!></div>`);
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
	var fragment = root$11();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		Alert($$anchor, {
			variant: "destructive",
			children: ($$anchor, $$slotProps) => {
				var fragment_2 = root$11();
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
			class: "mx-1 rounded-lg",
			children: ($$anchor, $$slotProps) => {
				var fragment_5 = root$11();
				var node_4 = first_child(fragment_5);
				Card_header(node_4, {
					class: "grid-cols-[4rem_1fr] gap-x-2",
					children: ($$anchor, $$slotProps) => {
						var fragment_6 = root_3$2();
						var img = first_child(fragment_6);
						var div = sibling(img, 2);
						var node_5 = child(div);
						Card_title(node_5, {
							children: ($$anchor, $$slotProps) => {
								var a = root_1$6();
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
								var fragment_7 = root_2$2();
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
						var fragment_12 = root$11();
						var node_11 = first_child(fragment_12);
						Separator(node_11, {});
						var node_12 = sibling(node_11, 2);
						var consequent_2 = ($$anchor) => {
							Alert($$anchor, {
								variant: "destructive",
								children: ($$anchor, $$slotProps) => {
									var fragment_14 = root$11();
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
							var div_6 = root_4$1();
							Spinner(child(div_6), { class: "size-4" });
							next(2);
							reset(div_6);
							append($$anchor, div_6);
						};
						var consequent_5 = ($$anchor) => {
							var div_7 = root_5$1();
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
var root$10 = from_html(`<div class="space-y-2"><!> <!></div>`);
function Market($$anchor) {
	let selectedItem = state(null);
	var div = root$10();
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
var root$9 = from_html(`<a target="_blank" rel="noreferrer"><div class="flex justify-between"><span class="text-foreground font-bold"> </span> <span class="text-muted-foreground"><!></span></div> <div class="text-muted-foreground"> </div></a>`);
function Notification($$anchor, $$props) {
	push($$props, true);
	const displayTitle = user_derived(() => $$props.notification.title.replace("TornTools - ", ""));
	Card($$anchor, {
		size: "sm",
		class: "py-2!",
		children: ($$anchor, $$slotProps) => {
			Card_content($$anchor, {
				class: "px-2! text-xs",
				children: ($$anchor, $$slotProps) => {
					var a = root$9();
					var div = child(a);
					var span = child(div);
					var text$3 = child(span, true);
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
						set_text(text$3, get(displayTitle));
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
var root$8 = from_html(`<div class="text-muted-foreground text-sm">No notification history.</div>`);
var root_1$5 = from_html(`<div class="space-y-2"></div>`);
function Notifications($$anchor, $$props) {
	push($$props, true);
	const $notificationHistoryStore = () => store_get(notificationHistoryStore, "$notificationHistoryStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const notifications = user_derived(() => ($notificationHistoryStore() ?? []).filter(isStoredNotification));
	function isStoredNotification(notification) {
		return !("combined" in notification);
	}
	var div = root_1$5();
	each(div, 21, () => get(notifications), index, ($$anchor, notification) => {
		Notification($$anchor, { get notification() {
			return get(notification);
		} });
	}, ($$anchor) => {
		append($$anchor, root$8());
	});
	reset(div);
	append($$anchor, div);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/popup/components/PopupRedirect.svelte
var root$7 = from_html(`<div class="text-muted-foreground p-3 text-sm">Loading...</div>`);
function PopupRedirect($$anchor, $$props) {
	push($$props, false);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const $apiStore = () => store_get(apiStore, "$apiStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	onMount(() => {
		replace(getStartupPath($settingsStore(), !!$apiStore()?.torn?.key));
	});
	init();
	append($$anchor, root$7());
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/popup/components/stocks/StockSearch.svelte
var root$6 = from_html(`<!> <!>`, 1);
var root_1$4 = from_html(`<div class="p-1 pb-0"><!></div>`);
function StockSearch($$anchor, $$props) {
	push($$props, true);
	let query = prop($$props, "query", 15, "");
	var div = root_1$4();
	component(child(div), () => Input_group, ($$anchor, InputGroup_Root) => {
		InputGroup_Root($$anchor, {
			class: "bg-input/30 border-input/30",
			children: ($$anchor, $$slotProps) => {
				var fragment = root$6();
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
var root$5 = from_html(`<!> <!> <!> <!> <!>`, 1);
var root_1$3 = from_html(`<!> <!>`, 1);
function RoiTable($$anchor, $$props) {
	push($$props, true);
	const ownedLevel = user_derived(() => $$props.userStock ? getStockIncrement($$props.stock.bonus.requirement, $$props.userStock.shares) : 0);
	const activeLevel = user_derived(() => $$props.userStock?.bonus?.increment ?? 0);
	const rewardValue = user_derived(() => getRewardValue($$props.stock.bonus.description));
	const yearlyValue = user_derived(() => get(rewardValue) / $$props.stock.bonus.frequency * 365);
	Table($$anchor, {
		class: "text-xs leading-tight",
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = root_1$3();
			var node = first_child(fragment_1);
			Table_header(node, {
				children: ($$anchor, $$slotProps) => {
					Table_row($$anchor, {
						children: ($$anchor, $$slotProps) => {
							var fragment_3 = root$5();
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
						const stocks = user_derived(() => getRequiredStocks($$props.stock.bonus.requirement, level));
						const previousStocks = user_derived(() => getRequiredStocks($$props.stock.bonus.requirement, level - 1));
						const roi = user_derived(() => get(yearlyValue) / ((get(stocks) - get(previousStocks)) * $$props.stock.market.price) * 100);
						{
							let $0 = user_derived(() => level <= get(activeLevel) ? "text-primary" : level <= get(ownedLevel) ? "text-amber-600" : "");
							Table_row($$anchor, {
								get class() {
									return get($0);
								},
								children: ($$anchor, $$slotProps) => {
									var fragment_6 = root$5();
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
											template_effect(($0) => set_text(text_7, $0), [() => formatNumber(get(stocks) * $$props.stock.market.price, { currency: true })]);
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
											template_effect(($0) => set_text(text_8, $0), [() => getStockReward($$props.stock.bonus.description, level)]);
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
var root$4 = from_html(`<div><!></div> <!>`, 1);
var root_1$2 = from_html(`<span class="text-muted-foreground"> </span>`);
var root_2$1 = from_html(`<div> </div> <div><span> </span> <!></div>`, 1);
var root_3$1 = from_html(`<div class="bg-muted space-y-1 rounded-md p-2"><!></div>`);
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
	const nonDividendBenefit = user_derived(() => getNonDividendBenefitState($$props.userStock, $$props.stock.bonus.frequency));
	const nonDividendDescriptionClass = user_derived(() => getDescriptionClass(get(nonDividendBenefit).status));
	var div = root_3$1();
	var node = child(div);
	var consequent_1 = ($$anchor) => {
		var fragment = root$4();
		var div_1 = first_child(fragment);
		var node_1 = child(div_1);
		var consequent = ($$anchor) => {
			var text$1 = text();
			template_effect(() => set_text(text$1, $$props.userStock.bonus.available ? "Ready now!" : `Available in ${$$props.stock.bonus.frequency - $$props.userStock.bonus.progress}/${$$props.stock.bonus.frequency} days.`));
			append($$anchor, text$1);
		};
		var alternate = ($$anchor) => {
			var text_1 = text();
			template_effect(() => set_text(text_1, `Available every ${$$props.stock.bonus.frequency ?? ""} days.`));
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
	var d = user_derived(() => isDividendStock($$props.stock.id));
	var alternate_1 = ($$anchor) => {
		var fragment_3 = root_2$1();
		var div_2 = first_child(fragment_3);
		var text_2 = child(div_2);
		reset(div_2);
		var div_3 = sibling(div_2, 2);
		var span = child(div_3);
		var text_3 = child(span, true);
		reset(span);
		var node_3 = sibling(span, 2);
		var consequent_2 = ($$anchor) => {
			var span_1 = root_1$2();
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
			set_text(text_3, $$props.stock.bonus.description);
		}, [() => formatNumber($$props.userStock?.shares ?? $$props.stock.bonus.requirement), () => $$props.userStock ? `/${formatNumber($$props.stock.bonus.requirement)}` : ""]);
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
var root$3 = from_html(` <!>`, 1);
var root_1$1 = from_html(`<!> <!>`, 1);
function StockSection($$anchor, $$props) {
	let isOpen = state(false);
	var fragment = root_1$1();
	var node = first_child(fragment);
	Button(node, {
		variant: "ghost",
		size: "sm",
		class: "h-7 w-full justify-between px-2",
		onclick: () => set(isOpen, !get(isOpen)),
		children: ($$anchor, $$slotProps) => {
			next();
			var fragment_1 = root$3();
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
var root$2 = from_html(`<span> </span>`);
var root_1 = from_html(`<a class="text-foreground truncate hover:underline" target="_blank" rel="noreferrer"> </a> <!>`, 1);
var root_2 = from_html(`<div class="text-muted-foreground text-xs"> </div>`);
var root_3 = from_html(`<!> <!>`, 1);
var root_4 = from_html(`<div class="bg-muted grid grid-cols-2 gap-1 rounded-md p-2"><span> </span> <span> </span> <!></div>`);
var root_5 = from_html(`<div class="bg-muted grid grid-cols-[auto_1fr] items-center gap-2 rounded-md p-2"><label>Price reaches</label> <!> <label>Price falls to</label> <!></div>`);
var root_6 = from_html(`<!> <!> <!>`, 1);
var root_7 = from_html(`<div class="text-muted-foreground text-sm">No stocks found.</div>`);
var root_8 = from_html(`<div class="mx-1 space-y-2"></div>`);
function StocksTable($$anchor, $$props) {
	push($$props, true);
	const $stockdataStore = () => store_get(stockdataStore, "$stockdataStore", $$stores);
	const $userdataStore = () => store_get(userdataStore, "$userdataStore", $$stores);
	const $settingsStore = () => store_get(settingsStore, "$settingsStore", $$stores);
	const [$$stores, $$cleanup] = setup_stores();
	const rows = user_derived(() => getRows($stockdataStore(), $userdataStore(), $settingsStore(), $$props.query));
	function getRows(stockdata, userdata, settings, search) {
		const keyword = search.trim().toLowerCase();
		return stockdata.stocks.map((stock) => {
			const userStock = settings?.apiUsage?.user?.stocks ? (userdata?.stocks ?? []).find((entry) => entry.id === stock.id) ?? null : null;
			return {
				id: stock.id,
				stock,
				userStock
			};
		}).filter((row) => {
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
			value: dropDecimals((stock.market.price - boughtPrice) * userStock.shares)
		};
	}
	var div = root_8();
	each(div, 21, () => get(rows), (row) => row.id, ($$anchor, row) => {
		const profit = user_derived(() => getProfit(get(row).stock, get(row).userStock));
		Card($$anchor, {
			size: "sm",
			class: "rounded-lg",
			children: ($$anchor, $$slotProps) => {
				var fragment_1 = root_3();
				var node = first_child(fragment_1);
				Card_header(node, {
					children: ($$anchor, $$slotProps) => {
						var fragment_2 = root_3();
						var node_1 = first_child(fragment_2);
						Card_title(node_1, {
							class: "flex items-start justify-between gap-2 text-sm",
							children: ($$anchor, $$slotProps) => {
								var fragment_3 = root_1();
								var a = first_child(fragment_3);
								var text = child(a, true);
								reset(a);
								var node_2 = sibling(a, 2);
								var consequent = ($$anchor) => {
									var span = root$2();
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
							var div_1 = root_2();
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
						var fragment_4 = root_6();
						var node_5 = first_child(fragment_4);
						StockSection(node_5, {
							label: "Price Information",
							children: ($$anchor, $$slotProps) => {
								var div_2 = root_4();
								var span_1 = child(div_2);
								var text_3 = child(span_1);
								reset(span_1);
								var span_2 = sibling(span_1, 2);
								var text_4 = child(span_2);
								reset(span_2);
								var node_6 = sibling(span_2, 2);
								var consequent_2 = ($$anchor) => {
									var span_3 = root$2();
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
								}, [() => formatNumber(get(row).stock.market.price, {
									decimals: 2,
									currency: true
								}), () => formatNumber(get(row).stock.market.shares)]);
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
								var div_3 = root_5();
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
										pattern: "\\d*",
										inputmode: "numeric",
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
										pattern: "\\d*",
										inputmode: "numeric",
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
		append($$anchor, root_7());
	});
	reset(div);
	append($$anchor, div);
	pop();
	$$cleanup();
}
//#endregion
//#region src/extension/entrypoints/popup/components/stocks/Stocks.svelte
var root$1 = from_html(`<div class="space-y-2"><!> <!></div>`);
function Stocks($$anchor) {
	let query = state("");
	var div = root$1();
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
var root = from_html(`<div class="text-muted-foreground text-sm">Loading...</div>`);
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
				append($$anchor, root());
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

//# sourceMappingURL=popup-BAUKmZbK.js.map