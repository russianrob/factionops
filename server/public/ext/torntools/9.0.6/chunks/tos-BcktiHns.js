import { Dn as noop, En as reset, Ft as if_block, It as mount, Lt as set_text, Sn as push, Tn as next, Vt as from_html, Wt as text, Zt as get, _n as writable, a as BACKGROUND_SERVICE, an as child, dn as state, ft as onMount, gt as init, i as exposeDebugObjects, n as setMode, on as first_child, p as initializeDatabase, sn as sibling, t as Mode_watcher, tn as template_effect, un as set, ut as ttStorage, v as storageListeners, xn as pop, zt as append } from "./dist-X5FUUfHt.js";
import "./browser-DV2XfOQj.js";
import { a as Table_body, i as Table_cell, n as Table_header, o as Table, r as Table_head, t as Table_row } from "./table-tdIg9jkX.js";
//#region src/extension/entrypoints/tos/stores/database-store.svelte.ts
var storesInitialized = state(false);
var settingsStore = writable();
function initializeDatabaseStore() {
	if (get(storesInitialized)) return;
	initializeDatabase();
	loadDatabaseStores().then(() => {
		set(storesInitialized, true);
	});
	storageListeners.settings.push((_oldSettings, newSettings) => {
		settingsStore.set(newSettings);
	});
}
async function loadDatabaseStores() {
	const [settings] = await ttStorage.get([
		"settings",
		"attackHistory",
		"stakeouts"
	]);
	settingsStore.set(settings);
}
//#endregion
//#region src/extension/entrypoints/tos/TOS.svelte
var head = ($$anchor, _text = noop) => {
	Table_head($$anchor, {
		class: "p-2 text-center",
		children: ($$anchor, $$slotProps) => {
			next();
			var text$1 = text();
			template_effect(() => set_text(text$1, _text()));
			append($$anchor, text$1);
		},
		$$slots: { default: true }
	});
};
var question = ($$anchor, _text = noop) => {
	Table_cell($$anchor, {
		class: "p-2 align-top whitespace-normal",
		children: ($$anchor, $$slotProps) => {
			next();
			var text_1 = text();
			template_effect(() => set_text(text_1, _text()));
			append($$anchor, text_1);
		},
		$$slots: { default: true }
	});
};
var answer = ($$anchor, _text = noop, _subtext = noop) => {
	Table_cell($$anchor, {
		class: "p-2 align-top whitespace-normal",
		children: ($$anchor, $$slotProps) => {
			var fragment_5 = root_6();
			var code = first_child(fragment_5);
			var text_2 = child(code, true);
			reset(code);
			var node = sibling(code, 2);
			var consequent = ($$anchor) => {
				var p = root_7();
				var text_3 = child(p, true);
				reset(p);
				template_effect(() => set_text(text_3, _subtext()));
				append($$anchor, p);
			};
			if_block(node, ($$render) => {
				if (_subtext()) $$render(consequent);
			});
			template_effect(() => set_text(text_2, _text()));
			append($$anchor, fragment_5);
		},
		$$slots: { default: true }
	});
};
var root_7 = from_html(`<p class="mt-1 text-muted-foreground"> </p>`);
var root_6 = from_html(`<code class="block rounded bg-muted p-1 whitespace-normal wrap-break-word"> </code> <!>`, 1);
var root_10 = from_html(`<!> <!> <!> <!> <!>`, 1);
var root_12 = from_html(`<!> <!> <!> <!> <!>`, 1);
var root_13 = from_html(`<!> <!> <!> <!> <!>`, 1);
var root_11 = from_html(`<!> <!>`, 1);
var root_8 = from_html(`<!> <!>`, 1);
var root = from_html(`<!>  <main class="min-h-screen p-8 max-w-6xl mx-auto w-full"><h1 class="text-2xl font-bold text-center">Terms of Service</h1> <section class="mt-4 space-y-4"><div class="rounded-lg border border-border bg-card p-2"><h2 class="text-lg font-bold">Data Collection</h2> <p class="text-sm text-muted-foreground">TornTools collects and stores data only locally. External services might require your API key and store the data differently. All external
				services are opt in, and we'll list to the terms of service for each service when opting in.</p> <div class="mt-1 rounded-sm border bg-card"><!></div></div></section></main>`, 1);
function TOS($$anchor, $$props) {
	push($$props, false);
	onMount(() => {
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
	init();
	var fragment_6 = root();
	var node_1 = first_child(fragment_6);
	Mode_watcher(node_1, { track: false });
	var main = sibling(node_1, 2);
	var section = sibling(child(main), 2);
	var div = child(section);
	var div_1 = sibling(child(div), 4);
	Table(child(div_1), {
		class: "table-fixed w-full text-xs",
		children: ($$anchor, $$slotProps) => {
			var fragment_7 = root_8();
			var node_3 = first_child(fragment_7);
			Table_header(node_3, {
				class: "bg-muted",
				children: ($$anchor, $$slotProps) => {
					Table_row($$anchor, {
						children: ($$anchor, $$slotProps) => {
							var fragment_9 = root_10();
							var node_4 = first_child(fragment_9);
							head(node_4, () => "Data Storage");
							var node_5 = sibling(node_4, 2);
							head(node_5, () => "Data Sharing");
							var node_6 = sibling(node_5, 2);
							head(node_6, () => "Purpose of Use");
							var node_7 = sibling(node_6, 2);
							head(node_7, () => "Key Storage & Sharing");
							head(sibling(node_7, 2), () => "Key Access Level");
							append($$anchor, fragment_9);
						},
						$$slots: { default: true }
					});
				},
				$$slots: { default: true }
			});
			Table_body(sibling(node_3, 2), {
				children: ($$anchor, $$slotProps) => {
					var fragment_10 = root_11();
					var node_10 = first_child(fragment_10);
					Table_row(node_10, {
						class: "text-muted-foreground",
						children: ($$anchor, $$slotProps) => {
							var fragment_11 = root_12();
							var node_11 = first_child(fragment_11);
							question(node_11, () => "Will the data be stored for any purpose?");
							var node_12 = sibling(node_11, 2);
							question(node_12, () => "Who can access the data besides the end user?");
							var node_13 = sibling(node_12, 2);
							question(node_13, () => "What is the stored data being used for?");
							var node_14 = sibling(node_13, 2);
							question(node_14, () => "Will the API key be stored securely and who can access it?");
							question(sibling(node_14, 2), () => "What key access level or specific selections are required?");
							append($$anchor, fragment_11);
						},
						$$slots: { default: true }
					});
					Table_row(sibling(node_10, 2), {
						children: ($$anchor, $$slotProps) => {
							var fragment_12 = root_13();
							var node_17 = first_child(fragment_12);
							answer(node_17, () => "Only locally");
							var node_18 = sibling(node_17, 2);
							answer(node_18, () => "Nobody");
							var node_19 = sibling(node_18, 2);
							answer(node_19, () => "Not eligible - only end user has access");
							var node_20 = sibling(node_19, 2);
							answer(node_20, () => "Stored locally / Not shared", () => "except for opt-in services, as listed on the respective places");
							answer(sibling(node_20, 2), () => "Limited Access");
							append($$anchor, fragment_12);
						},
						$$slots: { default: true }
					});
					append($$anchor, fragment_10);
				},
				$$slots: { default: true }
			});
			append($$anchor, fragment_7);
		},
		$$slots: { default: true }
	});
	reset(div_1);
	reset(div);
	reset(section);
	reset(main);
	append($$anchor, fragment_6);
	pop();
}
//#endregion
//#region src/extension/entrypoints/tos/tos.ts
mount(TOS, { target: document.getElementById("app") });
//#endregion

//# sourceMappingURL=tos-BcktiHns.js.map