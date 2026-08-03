import "./utilities-DwImhkRX.js";
import { B as onMount, Ft as sibling, Kt as writable, Nt as child, Pt as first_child, R as ttStorage, Rt as set, Tt as get, W as init, Xt as pop, Zt as push, a as BACKGROUND_SERVICE, d as initializeDatabase, dt as set_text, en as next, g as storageListeners, ht as from_html, i as exposeDebugObjects, kt as template_effect, lt as if_block, n as setMode, nn as noop, pt as append, t as Mode_watcher, tn as reset, ut as mount, vt as text, zt as state } from "./dist-DM3lq6UN.js";
import { a as Table_cell, i as Table_head, n as Table_row, o as Table_body, r as Table_header, t as Table } from "./table-BDI1Tawr.js";
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
			var fragment_5 = root_1();
			var code = first_child(fragment_5);
			var text_2 = child(code, true);
			reset(code);
			var node = sibling(code, 2);
			var consequent = ($$anchor) => {
				var p = root();
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
var root = from_html(`<p class="text-muted-foreground mt-1"> </p>`);
var root_1 = from_html(`<code class="bg-muted block rounded p-1 wrap-break-word whitespace-normal"> </code> <!>`, 1);
var root_2 = from_html(`<!> <!> <!> <!> <!>`, 1);
var root_3 = from_html(`<!> <!>`, 1);
var root_4 = from_html(`<!>  <main class="mx-auto min-h-screen w-full max-w-6xl p-8"><h1 class="text-center text-2xl font-bold">Terms of Service</h1> <section class="mt-4 space-y-4"><div class="border-border bg-card rounded-lg border p-2"><h2 class="text-lg font-bold">Data Collection</h2> <p class="text-muted-foreground text-sm">TornTools collects and stores data only locally. External services might require your API key and store the data differently. All external
				services are opt in, and we'll list to the terms of service for each service when opting in.</p> <div class="bg-card mt-1 rounded-sm border"><!></div></div></section></main>`, 1);
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
	var fragment_6 = root_4();
	var node_1 = first_child(fragment_6);
	Mode_watcher(node_1, { track: false });
	var main = sibling(node_1, 2);
	var section = sibling(child(main), 2);
	var div = child(section);
	var div_1 = sibling(child(div), 4);
	Table(child(div_1), {
		class: "w-full table-fixed text-xs",
		children: ($$anchor, $$slotProps) => {
			var fragment_7 = root_3();
			var node_3 = first_child(fragment_7);
			Table_header(node_3, {
				class: "bg-muted",
				children: ($$anchor, $$slotProps) => {
					Table_row($$anchor, {
						children: ($$anchor, $$slotProps) => {
							var fragment_9 = root_2();
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
					var fragment_10 = root_3();
					var node_10 = first_child(fragment_10);
					Table_row(node_10, {
						class: "text-muted-foreground",
						children: ($$anchor, $$slotProps) => {
							var fragment_11 = root_2();
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
							var fragment_12 = root_2();
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

//# sourceMappingURL=tos-CXR_jH-u.js.map