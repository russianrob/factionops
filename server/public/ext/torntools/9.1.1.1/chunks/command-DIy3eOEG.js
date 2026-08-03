import { j as browser, n as SCRIPT_TYPE, o as getCookie, r as TO_MILLIS, s as isIntNumber, y as isElement } from "./utilities-DwImhkRX.js";
import { $t as snapshot, At as user_effect, C as DATA_FETCHER, D as RUNTIME_INFORMATION, E as OFFLOAD_SERVICE, Ft as sibling, G as bind_this, H as rest_props, It as proxy, Nt as child, Pt as first_child, R as ttStorage, Rt as set, T as ITEM_RESOLVER, Tt as get, U as spread_props, Ut as remove_textarea_child, V as prop, Vt as user_derived, X as set_attribute, Xt as pop, Y as attribute_effect, Zt as push, _ as torndata, _t as props_id, c as cn, ct as key, dt as set_text, en as next, gt as from_svg, h as settings, ht as from_html, it as snippet, jt as user_pre_effect, kt as template_effect, l as api, lt as if_block, mt as comment, nn as noop, pt as append, q as bind_value, rt as component, tn as reset, v as userdata, vt as text, zt as state } from "./dist-DM3lq6UN.js";
import { A as Escape_layer, B as createId, Bt as formatNumber, Ct as srOnlyStyles, D as useId, E as Scroll_lock, I as DialogCloseState, J as ARROW_RIGHT, K as ARROW_DOWN, L as DialogContentState, M as getFirstNonCommentChild, N as Portal, O as Text_selection_layer, P as Dialog_title$1, Q as ENTER, R as DialogRootState, St as Context, T as Dialog_overlay$1, V as noop$1, Y as ARROW_UP, _ as tv, _t as afterSleep, at as boolToEmptyStrOrUndef, et as HOME, gt as afterTick, h as Button, j as Dismissible_layer, k as Focus_scope, kt as boxWith, lt as createBitsAttrs, m as getIconContext, mt as attachRef, n as Input, ot as boolToStr, p as Spinner$1, q as ARROW_LEFT, u as Check, w as Dialog_description$1, wt as mergeProps, xt as watch, z as DialogTriggerState } from "./TrashIcon-DJq8vlLE.js";
//#region src/common/utils/functions/torn.ts
var LINKS = {
	auction: "https://www.torn.com/amarket.php",
	bank: "https://www.torn.com/bank.php",
	bazaar: "https://www.torn.com/bazaar.php",
	bounties: "https://www.torn.com/bounties.php#!p=main",
	chain: "https://www.torn.com/factions.php?step=your#/war/chain",
	church: "https://www.torn.com/church.php",
	committee: "https://www.torn.com/committee.php",
	companies: "https://www.torn.com/companies.php",
	companyEmployees: "https://www.torn.com/companies.php#/option=employees",
	crimes: "https://www.torn.com/crimes.php",
	donator: "https://www.torn.com/donator.php",
	education: "https://www.torn.com/page.php?sid=education",
	events: "https://www.torn.com/events.php#/step=all",
	faction: "https://www.torn.com/factions.php",
	faction__ranked_war: "https://www.torn.com/factions.php?step=your&type=1#/war/rank",
	faction_oc: "https://www.torn.com/factions.php?step=your#/tab=crimes",
	gym: "https://www.torn.com/gym.php",
	home: "https://www.torn.com/index.php",
	homepage: "https://www.torn.com/index.php",
	hospital: "https://www.torn.com/hospitalview.php",
	itemmarket: "https://www.torn.com/page.php?sid=ItemMarket",
	items: "https://www.torn.com/item.php",
	items_booster: "https://www.torn.com/item.php#boosters-items",
	items_candy: "https://www.torn.com/item.php#candy-items",
	items_drug: "https://www.torn.com/item.php#drugs-items",
	items_medical: "https://www.torn.com/item.php#medical-items",
	jailview: "https://www.torn.com/jailview.php",
	jobs: "https://www.torn.com/companies.php",
	loan: "https://www.torn.com/loan.php",
	messages: "https://www.torn.com/messages.php",
	missions: "https://www.torn.com/page.php?sid=missions",
	organizedCrimes: "https://www.torn.com/factions.php?step=your#/tab=crimes",
	pc: "https://www.torn.com/pc.php",
	points: "https://www.torn.com/page.php?sid=points",
	pointsmarket: "https://www.torn.com/pmarket.php",
	properties: "https://www.torn.com/properties.php",
	property_upkeep: "https://www.torn.com/properties.php#/p=options&tab=upkeep",
	property_vault: "https://www.torn.com/properties.php#/p=options&tab=vault",
	raceway: "https://www.torn.com/page.php?sid=racing",
	staff: "https://www.torn.com/staff.php",
	stocks: "https://www.torn.com/page.php?sid=stocks",
	trade: "https://www.torn.com/trade.php",
	travelagency: "https://www.torn.com/page.php?sid=travel"
};
var ALL_ICONS = [
	{
		id: 1,
		icon: "icon1",
		description: "Online"
	},
	{
		id: 62,
		icon: "icon62",
		description: "Idle"
	},
	{
		id: 2,
		icon: "icon2",
		description: "Offline"
	},
	{
		id: 6,
		icon: "icon6",
		description: "Male"
	},
	{
		id: 7,
		icon: "icon7",
		description: "Female"
	},
	{
		id: 87,
		icon: "icon87",
		description: "Enby"
	},
	{
		id: 72,
		icon: "icon72",
		description: "New player"
	},
	{
		id: 3,
		icon: "icon3",
		description: "Donator",
		url: LINKS.donator
	},
	{
		id: 4,
		icon: "icon4",
		description: "Subscriber",
		url: LINKS.donator
	},
	{
		id: 11,
		icon: "icon11",
		description: "Staff",
		url: LINKS.staff
	},
	{
		id: 10,
		icon: "icon10",
		description: "Committee",
		url: LINKS.committee
	},
	{
		id: 8,
		icon: "icon8",
		description: "Marriage",
		url: LINKS.church
	},
	{
		id: 5,
		icon: "icon5",
		description: "Level 100"
	},
	{
		id: 21,
		icon: "icon21",
		description: "Army job",
		url: LINKS.jobs
	},
	{
		id: 22,
		icon: "icon22",
		description: "Casino job",
		url: LINKS.jobs
	},
	{
		id: 23,
		icon: "icon23",
		description: "Medical job",
		url: LINKS.jobs
	},
	{
		id: 24,
		icon: "icon24",
		description: "Grocer job",
		url: LINKS.jobs
	},
	{
		id: 25,
		icon: "icon25",
		description: "Lawyer job",
		url: LINKS.jobs
	},
	{
		id: 26,
		icon: "icon26",
		description: "Education job",
		url: LINKS.jobs
	},
	{
		id: 73,
		icon: "icon73",
		description: "Company director",
		url: LINKS.companies
	},
	{
		id: 27,
		icon: "icon27",
		description: "Company employee",
		url: LINKS.companies
	},
	{
		id: 83,
		icon: "icon83",
		description: "Company recruit",
		url: LINKS.companies
	},
	{
		id: 74,
		icon: "icon74",
		description: "Faction leader / co-leader",
		url: LINKS.faction
	},
	{
		id: 9,
		icon: "icon9",
		description: "Faction member",
		url: LINKS.faction
	},
	{
		id: 81,
		icon: "icon81",
		description: "Faction recruit",
		url: LINKS.faction
	},
	{
		id: 75,
		icon: "icon75",
		description: "Territory war (defending)",
		url: LINKS.faction
	},
	{
		id: 76,
		icon: "icon76",
		description: "Territory war (assaulting)",
		url: LINKS.faction
	},
	{
		id: 19,
		icon: "icon19",
		description: "Education in progress",
		url: LINKS.education
	},
	{
		id: 20,
		icon: "icon20",
		description: "Education completed",
		url: LINKS.education
	},
	{
		id: 29,
		icon: "icon29",
		description: "Investment in progress",
		url: LINKS.bank
	},
	{
		id: 30,
		icon: "icon30",
		description: "Investment completed",
		url: LINKS.bank
	},
	{
		id: 31,
		icon: "icon31",
		description: "Cayman islands bank",
		url: LINKS.travelagency
	},
	{
		id: 32,
		icon: "icon32",
		description: "Property vault",
		url: LINKS.property_vault
	},
	{
		id: 33,
		icon: "icon33",
		description: "Loan",
		url: LINKS.loan
	},
	{
		id: 34,
		icon: "icon34",
		description: "Items in auction",
		url: LINKS.auction
	},
	{
		id: 35,
		icon: "icon35",
		description: "Items in bazaar",
		url: LINKS.bazaar
	},
	{
		id: 36,
		icon: "icon36",
		description: "Items in item market",
		url: LINKS.itemmarket
	},
	{
		id: 54,
		icon: "icon54",
		description: "Points market",
		url: LINKS.pointsmarket
	},
	{
		id: 38,
		icon: "icon38",
		description: "Stocks owned",
		url: LINKS.stocks
	},
	{
		id: 84,
		icon: "icon84",
		description: "Dividend collection ready",
		url: LINKS.stocks
	},
	{
		id: 37,
		icon: "icon37",
		description: "Trade in progress",
		url: LINKS.trade
	},
	{
		id: 68,
		icon: "icon68",
		description: "Reading book"
	},
	{
		id: 71,
		icon: "icon71",
		description: "Traveling",
		url: LINKS.homepage
	},
	{
		id: 17,
		icon: "icon17",
		description: "Racing in progress",
		url: LINKS.raceway
	},
	{
		id: 18,
		icon: "icon18",
		description: "Racing completed",
		url: LINKS.raceway
	},
	{
		id: 85,
		icon: "icon85",
		description: "Organized crime being planned",
		url: LINKS.faction_oc
	},
	{
		id: 86,
		icon: "icon86",
		description: "Organized crime ready",
		url: LINKS.faction_oc
	},
	{
		id: 89,
		icon: "icon89",
		description: "Organized crime recruiting",
		url: LINKS.faction_oc
	},
	{
		id: 90,
		icon: "icon90",
		description: "Organized crime completed",
		url: LINKS.faction_oc
	},
	{
		id: 13,
		icon: "icon13",
		description: "Bounty",
		url: LINKS.bounties
	},
	{
		id: 28,
		icon: "icon28",
		description: "Cashier's checks",
		url: LINKS.bank
	},
	{
		id: 55,
		icon: "icon55",
		description: "Auction high bidder",
		url: LINKS.auction
	},
	{
		id: 56,
		icon: "icon56",
		description: "Auction outbid",
		url: LINKS.auction
	},
	{
		id: 15,
		icon: "icon15",
		description: "Hospital",
		url: LINKS.hospital
	},
	{
		id: 82,
		icon: "icon82",
		description: "Hospital early discharge",
		url: LINKS.hospital
	},
	{
		id: 91,
		icon: "icon91",
		description: "Hospital radiation poisoning",
		url: LINKS.hospital
	},
	{
		id: 16,
		icon: "icon16",
		description: "Jail",
		url: LINKS.jailview
	},
	{
		id: 70,
		icon: "icon70",
		description: "Federal jail"
	},
	{
		id: 12,
		icon: "icon12",
		description: "Low life",
		url: LINKS.hospital
	},
	{
		id: 39,
		icon: "icon39",
		description: "Booster cooldown (0-6hr)",
		url: LINKS.items_booster
	},
	{
		id: 40,
		icon: "icon40",
		description: "Booster cooldown (6-12hr)",
		url: LINKS.items_booster
	},
	{
		id: 41,
		icon: "icon41",
		description: "Booster cooldown (12-18hr)",
		url: LINKS.items_booster
	},
	{
		id: 42,
		icon: "icon42",
		description: "Booster cooldown (18-24hr)",
		url: LINKS.items_booster
	},
	{
		id: 43,
		icon: "icon43",
		description: "Booster cooldown (24hr+)",
		url: LINKS.items_booster
	},
	{
		id: 44,
		icon: "icon44",
		description: "Medical cooldown (0-90m)",
		url: LINKS.items_medical
	},
	{
		id: 45,
		icon: "icon45",
		description: "Medical cooldown (90-180m)",
		url: LINKS.items_medical
	},
	{
		id: 46,
		icon: "icon46",
		description: "Medical cooldown (180m-270m)",
		url: LINKS.items_medical
	},
	{
		id: 47,
		icon: "icon47",
		description: "Medical cooldown (270-360m)",
		url: LINKS.items_medical
	},
	{
		id: 48,
		icon: "icon48",
		description: "Medical cooldown (360m+)",
		url: LINKS.items_medical
	},
	{
		id: 49,
		icon: "icon49",
		description: "Drug cooldown (0-10m)",
		url: LINKS.items_drug
	},
	{
		id: 50,
		icon: "icon50",
		description: "Drug cooldown (10-60m)",
		url: LINKS.items_drug
	},
	{
		id: 51,
		icon: "icon51",
		description: "Drug cooldown (1-2hr)",
		url: LINKS.items_drug
	},
	{
		id: 52,
		icon: "icon52",
		description: "Drug cooldown (2-5hr)",
		url: LINKS.items_drug
	},
	{
		id: 53,
		icon: "icon53",
		description: "Drug cooldown (5hr+)",
		url: LINKS.items_drug
	},
	{
		id: 57,
		icon: "icon57",
		description: "Drug addiction (1-4%)",
		url: LINKS.travelagency
	},
	{
		id: 58,
		icon: "icon58",
		description: "Drug addiction (5-9%)",
		url: LINKS.travelagency
	},
	{
		id: 59,
		icon: "icon59",
		description: "Drug addiction (10-19%)",
		url: LINKS.travelagency
	},
	{
		id: 60,
		icon: "icon60",
		description: "Drug addiction (20-29%)",
		url: LINKS.travelagency
	},
	{
		id: 61,
		icon: "icon61",
		description: "Drug addiction (30%+)",
		url: LINKS.travelagency
	},
	{
		id: 63,
		icon: "icon63",
		description: "Radiation sickness (1-17%)",
		url: LINKS.items_medical
	},
	{
		id: 64,
		icon: "icon64",
		description: "Radiation sickness (18-34%)",
		url: LINKS.items_medical
	},
	{
		id: 65,
		icon: "icon65",
		description: "Radiation sickness (35-50%)",
		url: LINKS.items_medical
	},
	{
		id: 66,
		icon: "icon66",
		description: "Radiation sickness (51-67%)",
		url: LINKS.items_medical
	},
	{
		id: 67,
		icon: "icon67",
		description: "Radiation sickness (68%+)",
		url: LINKS.items_medical
	},
	{
		id: 78,
		icon: "icon78",
		description: "Upkeep due (4-6%)",
		url: LINKS.property_upkeep
	},
	{
		id: 79,
		icon: "icon79",
		description: "Upkeep due (6-8%)",
		url: LINKS.property_upkeep
	},
	{
		id: 80,
		icon: "icon80",
		description: "Upkeep due (8%+)",
		url: LINKS.property_upkeep
	}
];
var ALL_AREAS = [
	{
		class: "home",
		text: "Home"
	},
	{
		class: "items",
		text: "Items"
	},
	{
		class: "city",
		text: "City"
	},
	{
		class: "job",
		text: "Job"
	},
	{
		class: "gym",
		text: "Gym"
	},
	{
		class: "properties",
		text: "Properties"
	},
	{
		class: "education",
		text: "Education"
	},
	{
		class: "crimes",
		text: "Crimes"
	},
	{
		class: "missions",
		text: "Missions"
	},
	{
		class: "newspaper",
		text: "Newspaper"
	},
	{
		class: "jail",
		text: "Jail"
	},
	{
		class: "hospital",
		text: "Hospital"
	},
	{
		class: "casino",
		text: "Casino"
	},
	{
		class: "forums",
		text: "Forums"
	},
	{
		class: "hall_of_fame",
		text: "Hall of Fame"
	},
	{
		class: "faction",
		text: "My Faction"
	},
	{
		class: "recruit_citizens",
		text: "Recruit Citizens"
	},
	{
		class: "competitions",
		text: "Competitions"
	},
	{
		class: "community_events",
		text: "Community Events"
	}
];
var CASINO_GAMES = [
	"slots",
	"roulette",
	"high-low",
	"keno",
	"craps",
	"bookie",
	"lottery",
	"blackjack",
	"poker",
	"r-roulete",
	"spin-the-wheel"
];
[
	{
		id: 1,
		reason: "Admin"
	},
	{
		id: 4,
		reason: "NPC"
	},
	{
		id: 7,
		reason: "NPC"
	},
	{
		id: 9,
		reason: "NPC"
	},
	{
		id: 10,
		reason: "NPC"
	},
	{
		id: 15,
		reason: "NPC"
	},
	{
		id: 17,
		reason: "NPC"
	},
	{
		id: 19,
		reason: "NPC"
	},
	{
		id: 20,
		reason: "NPC"
	},
	{
		id: 21,
		reason: "NPC"
	}
].map(({ id }) => id);
var CHAIN_BONUSES = [
	10,
	25,
	50,
	100,
	250,
	500,
	1e3,
	2500,
	5e3,
	1e4,
	25e3,
	5e4,
	1e5
];
function getNextChainBonus(current) {
	return CHAIN_BONUSES.find((bonus) => bonus > current);
}
function isSellable(id) {
	const item = ITEM_RESOLVER.getStaticItem(id);
	if (!item) return true;
	return item && !["Book", "Unused"].includes(item.type) && ![
		373,
		374,
		375,
		376,
		472,
		473,
		474,
		475,
		476,
		477,
		478,
		583,
		584,
		585,
		820,
		920,
		1003,
		1004,
		1005,
		1006,
		1007,
		1008,
		1009,
		1010,
		1011,
		1149
	].includes(parseInt(id.toString()));
}
function getRFC() {
	const rfc = getCookie("rfc_v");
	if (!rfc) for (const cookie of document.cookie.split("; ")) {
		const parts = cookie.split("=");
		if (parts[0] === "rfc_v") return parts[1];
	}
	return rfc;
}
function isDividendStock(id) {
	let _id;
	if (typeof id === "number") _id = id;
	else if (isIntNumber(id)) _id = parseInt(id);
	else return false;
	return [
		1,
		4,
		5,
		6,
		7,
		9,
		10,
		12,
		15,
		16,
		17,
		18,
		19,
		22,
		24,
		27,
		28,
		29,
		31,
		32,
		33,
		35
	].includes(_id);
}
function getRequiredStocks(required, increment) {
	return (2 ** increment - 1) * required;
}
function getStockIncrement(required, stocks) {
	return Math.log2(Math.floor(stocks / required) + 1);
}
function getStockReward(reward, increment) {
	let value;
	if (reward.startsWith("$")) value = formatNumber(parseInt(reward.replace("$", "").replaceAll(",", "")) * increment, { currency: true });
	else if (reward.match(/^\d+x? /i)) {
		const splitBenefit = reward.split(" ");
		const hasX = splitBenefit[0].endsWith("x");
		const amount = parseInt(splitBenefit.shift().replace("x", "")) * increment;
		const item = splitBenefit.join(" ");
		value = `${formatNumber(amount)}${hasX ? "x" : ""} ${item}`;
	} else value = "Unknown, please report this!";
	return value;
}
function getRewardValue(reward) {
	if (!ITEM_RESOLVER.hasFullItems()) return -1;
	let value;
	if (reward.startsWith("$")) value = parseInt(reward.replace("$", "").replaceAll(",", ""));
	else if (reward.match(/^\d+x? /i)) {
		const rewardItem = reward.split(" ").slice(1).join(" ");
		const item = ITEM_RESOLVER.getAllFullItems().find(({ name }) => name === rewardItem);
		if (item) value = item ? item.value.market_price : -1;
		else {
			let prices;
			switch (rewardItem) {
				case "Ammunition Pack": break;
				case "Clothing Cache":
					prices = [
						1057,
						1112,
						1113,
						1114,
						1115,
						1116,
						1117
					].map((id) => ITEM_RESOLVER.getFullItem(id).value.market_price);
					break;
				case "Random Property":
					prices = torndata.properties.map((property) => property.cost).filter((price) => !!price).map((price) => price * .75);
					break;
				case "points":
					value = torndata.stats.points_averagecost * 100;
					break;
				case "happiness":
				case "energy":
				case "nerve": break;
				default:
					value = -1;
					break;
			}
			if (prices !== void 0) value = prices.reduce((a, b) => a + b, 0) / prices.length;
		}
	} else value = -1;
	return value;
}
function getStockBoughtPrice(stock) {
	const boughtTotal = Object.values(stock.transactions).reduce((prev, trans) => prev + trans.price * trans.shares, 0);
	return {
		boughtTotal,
		boughtPrice: boughtTotal / stock.shares
	};
}
var CUSTOM_LINKS_PRESET = {
	"Auction House": { link: "https://www.torn.com/amarket.php" },
	"Bazaar : Management": { link: "https://www.torn.com/bazaar.php#/manage" },
	"Christmas Town : Maps": { link: "https://www.torn.com/christmas_town.php#/mymaps" },
	"Faction : Armory": { link: "https://www.torn.com/factions.php?step=your#/tab=armoury" },
	"Faction : Organized Crimes": { link: "https://www.torn.com/factions.php?step=your#/tab=crimes" },
	"Item Market": { link: "https://www.torn.com/page.php?sid=ItemMarket" },
	Museum: { link: "https://www.torn.com/museum.php" },
	Pharmacy: { link: "https://www.torn.com/shops.php?step=pharmacy" },
	"Points Market": { link: "https://www.torn.com/pmarket.php" },
	Raceway: { link: "https://www.torn.com/page.php?sid=racing" },
	"Travel Agency": { link: "https://www.torn.com/page.php?sid=travel" }
};
var HIGHLIGHT_PLACEHOLDERS = [{
	name: "$player",
	value: () => userdata?.profile?.name ?? null,
	description: "Your player name."
}];
var CHAT_TITLE_COLORS = {
	blue: ["rgb(10,60,173)", "rgb(22,109,236)"],
	brown: ["rgb(109,53,4)", "rgb(146,69,4)"],
	orange: ["rgb(227,130,5)", "rgb(234,164,50)"],
	purple: ["rgb(94,7,119)", "rgb(184,9,241)"],
	red: ["rgb(123,4,4)", "rgb(255,3,3)"]
};
var TORNTOOLS_FORUM_POST = "https://www.torn.com/forums.php#/p=threads&f=67&t=16243863";
//#endregion
//#region node_modules/bits-ui/dist/bits/dialog/components/dialog-trigger.svelte
var rest_excludes$40 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"id",
	"ref",
	"children",
	"child",
	"disabled"
]);
var root$29 = from_html(`<button><!></button>`);
function Dialog_trigger$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), disabled = prop($$props, "disabled", 3, false), restProps = rest_props($$props, rest_excludes$40);
	const triggerState = DialogTriggerState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v)),
		disabled: boxWith(() => Boolean(disabled()))
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
		var button = root$29();
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
		if (groupId) if (!this.allGroups.has(groupId)) this.allGroups.set(groupId, /* @__PURE__ */ new Set([id]));
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
var rest_excludes$39 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"id",
	"ref",
	"children"
]);
var root$28 = from_html(`<label><!></label>`);
function _command_label($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes$39);
	const labelState = CommandLabelState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v))
	});
	const mergedProps = user_derived(() => mergeProps(restProps, labelState.props));
	var label = root$28();
	attribute_effect(label, () => ({ ...get(mergedProps) }));
	snippet(child(label), () => $$props.children ?? noop);
	reset(label);
	append($$anchor, label);
	pop();
}
//#endregion
//#region node_modules/bits-ui/dist/bits/command/components/command.svelte
var rest_excludes$38 = /* @__PURE__ */ new Set([
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
var root$27 = from_html(`<!> <!>`, 1);
var root_1$8 = from_html(`<div><!> <!></div>`);
function Command$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	const Label = ($$anchor) => {
		_command_label($$anchor, {
			children: ($$anchor, $$slotProps) => {
				next();
				var text$7 = text();
				template_effect(() => set_text(text$7, label()));
				append($$anchor, text$7);
			},
			$$slots: { default: true }
		});
	};
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), value = prop($$props, "value", 15, ""), onValueChange = prop($$props, "onValueChange", 3, noop$1), onStateChange = prop($$props, "onStateChange", 3, noop$1), loop = prop($$props, "loop", 3, false), shouldFilter = prop($$props, "shouldFilter", 3, true), filter = prop($$props, "filter", 3, computeCommandScore), label = prop($$props, "label", 3, ""), vimBindings = prop($$props, "vimBindings", 3, true), disablePointerSelection = prop($$props, "disablePointerSelection", 3, false), disableInitialScroll = prop($$props, "disableInitialScroll", 3, false), columns = prop($$props, "columns", 3, null), restProps = rest_props($$props, rest_excludes$38);
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
		var fragment_3 = root$27();
		var node_1 = first_child(fragment_3);
		Label(node_1);
		snippet(sibling(node_1, 2), () => $$props.child, () => ({ props: get(mergedProps) }));
		append($$anchor, fragment_3);
	};
	var alternate = ($$anchor) => {
		var div = root_1$8();
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
var rest_excludes$37 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"id",
	"ref",
	"children",
	"child",
	"forceMount"
]);
var root$26 = from_html(`<div><!></div>`);
function Command_empty$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), forceMount = prop($$props, "forceMount", 3, false), restProps = rest_props($$props, rest_excludes$37);
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
			var div = root$26();
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
var rest_excludes$36 = /* @__PURE__ */ new Set([
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
var root$25 = from_html(`<div><!></div>`);
function Command_group$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), value = prop($$props, "value", 3, ""), forceMount = prop($$props, "forceMount", 3, false), restProps = rest_props($$props, rest_excludes$36);
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
		var div = root$25();
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
var rest_excludes$35 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"id",
	"ref",
	"children",
	"child"
]);
var root$24 = from_html(`<div><!></div>`);
function Command_group_heading($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes$35);
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
		var div = root$24();
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
var rest_excludes$34 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"id",
	"ref",
	"children",
	"child"
]);
var root$23 = from_html(`<div><!></div>`);
var root_1$7 = from_html(`<div style="display: contents;"><!></div>`);
function Command_group_items($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes$34);
	const groupItemsState = CommandGroupItemsState.create({
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v))
	});
	const mergedProps = user_derived(() => mergeProps(restProps, groupItemsState.props));
	var div = root_1$7();
	var node = child(div);
	var consequent = ($$anchor) => {
		var fragment = comment();
		snippet(first_child(fragment), () => $$props.child, () => ({ props: get(mergedProps) }));
		append($$anchor, fragment);
	};
	var alternate = ($$anchor) => {
		var div_1 = root$23();
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
var rest_excludes$33 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"value",
	"autofocus",
	"id",
	"ref",
	"child"
]);
var root$22 = from_html(`<input/>`);
function Command_input$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let value = prop($$props, "value", 15, ""), autofocus = prop($$props, "autofocus", 3, false), id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes$33);
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
		var input = root$22();
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
var rest_excludes$32 = /* @__PURE__ */ new Set([
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
var root$21 = from_html(`<div><!></div>`);
var root_1$6 = from_html(`<div style="display: contents;" data-item-wrapper=""><!></div>`);
function Command_item$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), value = prop($$props, "value", 3, ""), disabled = prop($$props, "disabled", 3, false), onSelect = prop($$props, "onSelect", 3, noop$1), forceMount = prop($$props, "forceMount", 3, false), keywords = prop($$props, "keywords", 19, () => []), restProps = rest_props($$props, rest_excludes$32);
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
		var div = root_1$6();
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
				var div_1 = root$21();
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
var rest_excludes$31 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"id",
	"ref",
	"child",
	"children",
	"aria-label"
]);
var root$20 = from_html(`<div><!></div>`);
function Command_list$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes$31);
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
			var div = root$20();
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
//#region node_modules/bits-ui/dist/bits/dialog/components/dialog.svelte
function Dialog$1($$anchor, $$props) {
	push($$props, true);
	let open = prop($$props, "open", 15, false), onOpenChange = prop($$props, "onOpenChange", 3, noop$1), onOpenChangeComplete = prop($$props, "onOpenChangeComplete", 3, noop$1);
	DialogRootState.create({
		variant: boxWith(() => "dialog"),
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
//#region node_modules/bits-ui/dist/bits/dialog/components/dialog-close.svelte
var rest_excludes$30 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"children",
	"child",
	"id",
	"ref",
	"disabled"
]);
var root$19 = from_html(`<button><!></button>`);
function Dialog_close($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), disabled = prop($$props, "disabled", 3, false), restProps = rest_props($$props, rest_excludes$30);
	const closeState = DialogCloseState.create({
		variant: boxWith(() => "close"),
		id: boxWith(() => id()),
		ref: boxWith(() => ref(), (v) => ref(v)),
		disabled: boxWith(() => Boolean(disabled()))
	});
	const mergedProps = user_derived(() => mergeProps(restProps, closeState.props));
	var fragment = comment();
	var node = first_child(fragment);
	var consequent = ($$anchor) => {
		var fragment_1 = comment();
		snippet(first_child(fragment_1), () => $$props.child, () => ({ props: get(mergedProps) }));
		append($$anchor, fragment_1);
	};
	var alternate = ($$anchor) => {
		var button = root$19();
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
//#region node_modules/bits-ui/dist/bits/dialog/components/dialog-content.svelte
var rest_excludes$29 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"id",
	"children",
	"child",
	"ref",
	"forceMount",
	"onCloseAutoFocus",
	"onOpenAutoFocus",
	"onEscapeKeydown",
	"onInteractOutside",
	"trapFocus",
	"preventScroll",
	"restoreScrollDelay"
]);
var root$18 = from_html(`<!> <!>`, 1);
var root_1$5 = from_html(`<!> <div><!></div>`, 1);
function Dialog_content$1($$anchor, $$props) {
	const uid = props_id();
	push($$props, true);
	let id = prop($$props, "id", 19, () => createId(uid)), ref = prop($$props, "ref", 15, null), forceMount = prop($$props, "forceMount", 3, false), onCloseAutoFocus = prop($$props, "onCloseAutoFocus", 3, noop$1), onOpenAutoFocus = prop($$props, "onOpenAutoFocus", 3, noop$1), onEscapeKeydown = prop($$props, "onEscapeKeydown", 3, noop$1), onInteractOutside = prop($$props, "onInteractOutside", 3, noop$1), trapFocus = prop($$props, "trapFocus", 3, true), preventScroll = prop($$props, "preventScroll", 3, true), restoreScrollDelay = prop($$props, "restoreScrollDelay", 3, null), restProps = rest_props($$props, rest_excludes$29);
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
				let focusScopeProps = () => ($$arg0?.()).props;
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
											var fragment_6 = root$18();
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
											var fragment_8 = root_1$5();
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
				get onOpenAutoFocus() {
					return onOpenAutoFocus();
				},
				get onCloseAutoFocus() {
					return onCloseAutoFocus();
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
//#region src/extension/svelte/components/ui/spinner/spinner.svelte
var rest_excludes$28 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"class",
	"role",
	"name",
	"color",
	"stroke",
	"aria-label"
]);
function Spinner($$anchor, $$props) {
	push($$props, true);
	let role = prop($$props, "role", 3, "status"), ariaLabel = prop($$props, "aria-label", 3, "Loading"), restProps = rest_props($$props, rest_excludes$28);
	{
		let $0 = user_derived(() => $$props.name === null ? void 0 : $$props.name);
		let $1 = user_derived(() => $$props.color === null ? void 0 : $$props.color);
		let $2 = user_derived(() => $$props.stroke === null ? void 0 : $$props.stroke);
		let $3 = user_derived(() => cn("size-4 animate-spin", $$props.class));
		Spinner$1($$anchor, spread_props({
			get role() {
				return role();
			},
			get name() {
				return get($0);
			},
			get color() {
				return get($1);
			},
			get stroke() {
				return get($2);
			},
			get "aria-label"() {
				return ariaLabel();
			},
			get class() {
				return get($3);
			}
		}, () => restProps));
	}
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/textarea/textarea.svelte
var rest_excludes$27 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"value",
	"class",
	"data-slot"
]);
var root$17 = from_html(`<textarea></textarea>`);
function Textarea($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), value = prop($$props, "value", 15), dataSlot = prop($$props, "data-slot", 3, "textarea"), restProps = rest_props($$props, rest_excludes$27);
	var textarea = root$17();
	remove_textarea_child(textarea);
	attribute_effect(textarea, ($0) => ({
		"data-slot": dataSlot(),
		class: $0,
		...restProps
	}), [() => cn("border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 placeholder:text-muted-foreground flex field-sizing-fixed min-h-16 w-full rounded-lg border bg-transparent px-2.5 py-2 text-base transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 md:text-sm", $$props.class)]);
	bind_this(textarea, ($$value) => ref($$value), () => ref());
	bind_value(textarea, value);
	append($$anchor, textarea);
	pop();
}
//#endregion
//#region node_modules/phosphor-svelte/lib/X.svelte
var rest_excludes$26 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"children"
]);
var root$16 = from_svg(`<path d="M208.49,191.51a12,12,0,0,1-17,17L128,145,64.49,208.49a12,12,0,0,1-17-17L111,128,47.51,64.49a12,12,0,0,1,17-17L128,111l63.51-63.52a12,12,0,0,1,17,17L145,128Z"></path>`);
var root_1$4 = from_svg(`<path d="M216,56V200a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V56A16,16,0,0,1,56,40H200A16,16,0,0,1,216,56Z" opacity="0.2"></path><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path>`, 1);
var root_2$2 = from_svg(`<path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM181.66,170.34a8,8,0,0,1-11.32,11.32L128,139.31,85.66,181.66a8,8,0,0,1-11.32-11.32L116.69,128,74.34,85.66A8,8,0,0,1,85.66,74.34L128,116.69l42.34-42.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path>`);
var root_3$2 = from_svg(`<path d="M204.24,195.76a6,6,0,1,1-8.48,8.48L128,136.49,60.24,204.24a6,6,0,0,1-8.48-8.48L119.51,128,51.76,60.24a6,6,0,0,1,8.48-8.48L128,119.51l67.76-67.75a6,6,0,0,1,8.48,8.48L136.49,128Z"></path>`);
var root_4$2 = from_svg(`<path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"></path>`);
var root_5$2 = from_svg(`<path d="M202.83,197.17a4,4,0,0,1-5.66,5.66L128,133.66,58.83,202.83a4,4,0,0,1-5.66-5.66L122.34,128,53.17,58.83a4,4,0,0,1,5.66-5.66L128,122.34l69.17-69.17a4,4,0,1,1,5.66,5.66L133.66,128Z"></path>`);
var root_6$2 = from_svg(`<svg><!><rect width="256" height="256" fill="none"></rect><!></svg>`);
function X($$anchor, $$props) {
	push($$props, true);
	const ctx = getIconContext();
	let props = rest_props($$props, rest_excludes$26);
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
		append($$anchor, root$16());
	};
	var consequent_2 = ($$anchor) => {
		var fragment_1 = root_1$4();
		next();
		append($$anchor, fragment_1);
	};
	var consequent_3 = ($$anchor) => {
		append($$anchor, root_2$2());
	};
	var consequent_4 = ($$anchor) => {
		append($$anchor, root_3$2());
	};
	var consequent_5 = ($$anchor) => {
		append($$anchor, root_4$2());
	};
	var consequent_6 = ($$anchor) => {
		append($$anchor, root_5$2());
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
//#region src/extension/svelte/components/ui/dialog/dialog-portal.svelte
var rest_excludes$25 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy"
]);
function Dialog_portal($$anchor, $$props) {
	let restProps = rest_props($$props, rest_excludes$25);
	var fragment = comment();
	component(first_child(fragment), () => Portal, ($$anchor, DialogPrimitive_Portal) => {
		DialogPrimitive_Portal($$anchor, spread_props(() => restProps));
	});
	append($$anchor, fragment);
}
//#endregion
//#region src/extension/svelte/components/ui/dialog/dialog-content.svelte
var rest_excludes$24 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class",
	"portalProps",
	"children",
	"showCloseButton"
]);
var root$15 = from_html(`<!> <span class="sr-only">Close</span>`, 1);
var root_1$3 = from_html(`<!> <!>`, 1);
function Dialog_content($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), showCloseButton = prop($$props, "showCloseButton", 3, true), restProps = rest_props($$props, rest_excludes$24);
	Dialog_portal($$anchor, spread_props(() => $$props.portalProps, {
		children: ($$anchor, $$slotProps) => {
			var fragment_1 = root_1$3();
			var node = first_child(fragment_1);
			component(node, () => Dialog_overlay, ($$anchor, Dialog_Overlay) => {
				Dialog_Overlay($$anchor, {});
			});
			var node_1 = sibling(node, 2);
			{
				let $0 = user_derived(() => cn("bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 ring-foreground/10 fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl p-4 text-sm ring-1 duration-100 outline-none sm:max-w-sm", $$props.class));
				component(node_1, () => Dialog_content$1, ($$anchor, DialogPrimitive_Content) => {
					DialogPrimitive_Content($$anchor, spread_props({
						"data-slot": "dialog-content",
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
							var fragment_2 = root_1$3();
							var node_2 = first_child(fragment_2);
							snippet(node_2, () => $$props.children ?? noop);
							var node_3 = sibling(node_2, 2);
							var consequent = ($$anchor) => {
								var fragment_3 = comment();
								var node_4 = first_child(fragment_3);
								{
									const child = ($$anchor, $$arg0) => {
										let props = () => ($$arg0?.()).props;
										Button($$anchor, spread_props({
											variant: "ghost",
											class: "absolute top-2 right-2",
											size: "icon-sm"
										}, props, {
											children: ($$anchor, $$slotProps) => {
												var fragment_5 = root$15();
												X(first_child(fragment_5), {});
												next(2);
												append($$anchor, fragment_5);
											},
											$$slots: { default: true }
										}));
									};
									component(node_4, () => Dialog_close, ($$anchor, DialogPrimitive_Close) => {
										DialogPrimitive_Close($$anchor, {
											"data-slot": "dialog-close",
											child,
											$$slots: { child: true }
										});
									});
								}
								append($$anchor, fragment_3);
							};
							if_block(node_3, ($$render) => {
								if (showCloseButton()) $$render(consequent);
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
	}));
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/dialog/dialog-description.svelte
var rest_excludes$23 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class"
]);
function Dialog_description($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes$23);
	var fragment = comment();
	var node = first_child(fragment);
	{
		let $0 = user_derived(() => cn("text-muted-foreground *:[a]:hover:text-foreground text-sm *:[a]:underline *:[a]:underline-offset-3", $$props.class));
		component(node, () => Dialog_description$1, ($$anchor, DialogPrimitive_Description) => {
			DialogPrimitive_Description($$anchor, spread_props({
				"data-slot": "dialog-description",
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
//#region src/extension/svelte/components/ui/dialog/dialog-footer.svelte
var rest_excludes$22 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class",
	"children",
	"showCloseButton"
]);
var root$14 = from_html(`<div><!> <!></div>`);
function Dialog_footer($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), showCloseButton = prop($$props, "showCloseButton", 3, false), restProps = rest_props($$props, rest_excludes$22);
	var div = root$14();
	attribute_effect(div, ($0) => ({
		"data-slot": "dialog-footer",
		class: $0,
		...restProps
	}), [() => cn("bg-muted/50 -mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t p-4 sm:flex-row sm:justify-end", $$props.class)]);
	var node = child(div);
	snippet(node, () => $$props.children ?? noop);
	var node_1 = sibling(node, 2);
	var consequent = ($$anchor) => {
		var fragment = comment();
		var node_2 = first_child(fragment);
		{
			const child = ($$anchor, $$arg0) => {
				let props = () => ($$arg0?.()).props;
				Button($$anchor, spread_props({ variant: "outline" }, props, {
					children: ($$anchor, $$slotProps) => {
						next();
						append($$anchor, text("Close"));
					},
					$$slots: { default: true }
				}));
			};
			component(node_2, () => Dialog_close, ($$anchor, DialogPrimitive_Close) => {
				DialogPrimitive_Close($$anchor, {
					child,
					$$slots: { child: true }
				});
			});
		}
		append($$anchor, fragment);
	};
	if_block(node_1, ($$render) => {
		if (showCloseButton()) $$render(consequent);
	});
	reset(div);
	bind_this(div, ($$value) => ref($$value), () => ref());
	append($$anchor, div);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/dialog/dialog-header.svelte
var rest_excludes$21 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class",
	"children"
]);
var root$13 = from_html(`<div><!></div>`);
function Dialog_header($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes$21);
	var div = root$13();
	attribute_effect(div, ($0) => ({
		"data-slot": "dialog-header",
		class: $0,
		...restProps
	}), [() => cn("flex flex-col gap-2", $$props.class)]);
	snippet(child(div), () => $$props.children ?? noop);
	reset(div);
	bind_this(div, ($$value) => ref($$value), () => ref());
	append($$anchor, div);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/dialog/dialog-overlay.svelte
var rest_excludes$20 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class"
]);
function Dialog_overlay($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes$20);
	var fragment = comment();
	var node = first_child(fragment);
	{
		let $0 = user_derived(() => cn("data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs", $$props.class));
		component(node, () => Dialog_overlay$1, ($$anchor, DialogPrimitive_Overlay) => {
			DialogPrimitive_Overlay($$anchor, spread_props({
				"data-slot": "dialog-overlay",
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
//#region src/extension/svelte/components/ui/dialog/dialog-title.svelte
var rest_excludes$19 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class"
]);
function Dialog_title($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes$19);
	var fragment = comment();
	var node = first_child(fragment);
	{
		let $0 = user_derived(() => cn("text-base leading-none font-medium", $$props.class));
		component(node, () => Dialog_title$1, ($$anchor, DialogPrimitive_Title) => {
			DialogPrimitive_Title($$anchor, spread_props({
				"data-slot": "dialog-title",
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
//#region src/extension/svelte/components/ui/dialog/dialog-trigger.svelte
var rest_excludes$18 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"type"
]);
function Dialog_trigger($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), type = prop($$props, "type", 3, "button"), restProps = rest_props($$props, rest_excludes$18);
	var fragment = comment();
	component(first_child(fragment), () => Dialog_trigger$1, ($$anchor, DialogPrimitive_Trigger) => {
		DialogPrimitive_Trigger($$anchor, spread_props({
			"data-slot": "dialog-trigger",
			get type() {
				return type();
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
	append($$anchor, fragment);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/dialog/dialog.svelte
var rest_excludes$17 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"open"
]);
function Dialog($$anchor, $$props) {
	push($$props, true);
	let open = prop($$props, "open", 15, false), restProps = rest_props($$props, rest_excludes$17);
	var fragment = comment();
	component(first_child(fragment), () => Dialog$1, ($$anchor, DialogPrimitive_Root) => {
		DialogPrimitive_Root($$anchor, spread_props(() => restProps, {
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
//#region src/common/utils/functions/extension.ts
var BADGE_TYPES = {
	default: {
		text: "",
		color: null
	},
	error: {
		text: "error",
		color: "#FF0000"
	},
	count: {
		text: async (options) => {
			if (options.events && options.messages) return `${options.events}/${options.messages}`;
			else if (options.events) return options.events.toString();
			else if (options.messages) return options.messages.toString();
			else return await getBadgeText() === "error" ? "error" : null;
		},
		color: async (options) => {
			if (options.events && options.messages) return "#1ed2ac";
			else if (options.events) return "#009eda";
			else if (options.messages) return "#84af03";
			else return await getBadgeText() === "error" ? "error" : null;
		}
	}
};
async function setBadge(type, partialOptions = {}) {
	if (SCRIPT_TYPE !== "BACKGROUND") return false;
	const options = {
		events: 0,
		messages: 0,
		...partialOptions
	};
	const badge = { ...BADGE_TYPES[type] };
	if (typeof badge.text === "function") badge.text = await badge.text(options);
	if (typeof badge.color === "function") badge.color = await badge.color(options);
	if (!badge.text) badge.text = "";
	browser.action.setBadgeText({ text: badge.text || "" });
	if (badge.color) browser.action.setBadgeBackgroundColor({ color: badge.color });
	return true;
}
function getBadgeText() {
	if (SCRIPT_TYPE !== "BACKGROUND") return Promise.resolve(null);
	return browser.action.getBadgeText({});
}
//#endregion
//#region src/common/utils/functions/api-fetcher.ts
var CUSTOM_API_ERROR = {
	NO_NETWORK: "tt-no_network",
	NO_PERMISSION: "tt-no_permission",
	CANCELLED: "tt-cancelled"
};
var FETCH_PLATFORMS = {
	tornv2: "https://api.torn.com/v2/",
	torn_direct: "https://www.torn.com/",
	yata: "https://yata.yt/",
	tornstats: "https://www.tornstats.com/",
	torntools: "https://torntools.gregork.com/",
	nukefamily: "https://nuke.family/",
	uhc: "https://tornuhc.eu/",
	stig: "https://api.no1irishstig.co.uk/",
	prometheus: "https://prombot.co.uk:8443/",
	lzpt: "https://api.lzpt.io/",
	wtf: "https://what-the-f.de/",
	tornw3b: "https://weav3r.dev/",
	ffscouter: "https://ffscouter.com/",
	laekna: "https://laekna-revive-bot.onrender.com/",
	tornintel: "https://torn-intel.com/",
	playground_torntools: "https://torntools.tornplayground.eu/"
};
var TORN_API_PLATFORMS = ["tornv2"];
var TEXT_RESPONSE_PLATFORMS = ["torn_direct", "laekna"];
async function fetchData(location, partialOptions = {}) {
	const options = mergeOptions(partialOptions);
	if (options.relay && SCRIPT_TYPE !== "BACKGROUND" && !RUNTIME_INFORMATION.isUserscript()) return relayToBackground(location, options);
	const request = buildFetchRequest(location, options);
	let result;
	try {
		result = parseFetchResponse(await DATA_FETCHER.fetch(request.url, {
			method: request.method,
			...request.method === "POST" ? { body: request.body } : {},
			headers: request.headers,
			timeout: decideTimeoutTimer(location)
		}), location);
	} catch (error) {
		return await handleError(location, options, error);
	}
	if (!result.success) return await handleError(location, options, result);
	else if (isApiErrorResponse(result.data)) return await handleError(location, options, result.data);
	await handleTornApiState(location, options);
	return result.data;
}
function mergeOptions(partial) {
	return {
		section: "",
		id: void 0,
		selections: [],
		legacySelections: [],
		key: void 0,
		action: void 0,
		method: "GET",
		body: void 0,
		silent: false,
		includeKey: false,
		relay: false,
		params: {},
		...partial
	};
}
async function relayToBackground(location, options) {
	return OFFLOAD_SERVICE.fetchRelay(location, {
		...options,
		relay: false
	});
}
function decideTimeoutTimer(location) {
	switch (location) {
		case "yata": return 30 * TO_MILLIS.SECONDS;
		default: return 10 * TO_MILLIS.SECONDS;
	}
}
function buildFetchRequest(location, options) {
	const url = buildUrl(location, options);
	const headers = buildHeaders(location, options);
	if (options.method === "POST") return {
		url,
		method: options.method,
		body: buildBody(options),
		headers
	};
	else return {
		url,
		method: options.method,
		headers
	};
}
function buildUrl(location, options) {
	let path, pathSections;
	let key;
	const params = new URLSearchParams();
	switch (location) {
		case "tornv2":
			path = `${options.section}/${options.id || ""}`;
			params.append("selections", [...options.selections, ...options.legacySelections].join(","));
			params.append("legacy", options.legacySelections.join(","));
			if (settings.apiUsage.comment) params.append("comment", settings.apiUsage.comment);
			break;
		case "torn_direct":
			path = options.action;
			params.set("rfcv", getRFC());
			break;
		case "tornstats":
			pathSections = [
				"api",
				"v2",
				options.key || api.tornstats.key || api.torn.key || ""
			];
			if (options.section) pathSections.push(options.section);
			if (options.id) pathSections.push(options.id);
			path = pathSections.join("/");
			break;
		case "yata":
			pathSections = [
				"api",
				"v1",
				options.section
			];
			if (options.id) pathSections.push(options.id, "");
			if (options.includeKey) key = api.yata.key;
			path = pathSections.join("/");
			break;
		case "prometheus":
			path = ["api", options.section].join("/");
			break;
		case "tornw3b":
			path = ["api", options.section].join("/");
			break;
		case "ffscouter":
			path = [
				"api",
				"v1",
				options.section
			].join("/");
			key = api.ffScouter.key;
			break;
		case "tornintel":
			path = ["api", options.section].join("/");
			break;
		case "playground_torntools":
			path = ["api", options.section].join("/");
			break;
		default:
			path = options.section;
			break;
	}
	if (options.includeKey) params.append("key", options.key || key || api.torn.key || "");
	if (options.params) for (const [key, value] of Object.entries(options.params)) params.append(key, value.toString());
	return `${FETCH_PLATFORMS[location]}${path}${params.toString() ? `?${params}` : ""}`;
}
function buildHeaders(location, options) {
	const headers = {};
	if (location === "tornv2") headers["Authorization"] = `ApiKey ${options.key || api.torn.key}`;
	if (options.method === "POST") {
		if (!(options.body instanceof URLSearchParams)) headers["content-type"] = "application/json";
		if (location === "torn_direct") headers["x-requested-with"] = "XMLHttpRequest";
	}
	return headers;
}
function buildBody(options) {
	if (options.method !== "POST") return null;
	return options.body instanceof URLSearchParams ? options.body : JSON.stringify(options.body);
}
function parseFetchResponse(response, location) {
	try {
		return {
			data: JSON.parse(response.text),
			success: true
		};
	} catch {
		if (TEXT_RESPONSE_PLATFORMS.includes(location)) return {
			data: response.text,
			success: true
		};
		if (response.ok) return { success: true };
		return {
			success: false,
			error: new HTTPException(response.status)
		};
	}
}
async function handleError(location, options, result) {
	if (result instanceof DOMException) return handleTimeoutError(location, options);
	if (result instanceof TypeError) return handleNetworkError(location, options, result.message);
	return handleApiError(location, options, result);
}
async function handleTimeoutError(location, options) {
	const error = "Request cancelled because it took too long.";
	await handleTornApiState(location, options, error);
	throw {
		error,
		isLocal: false,
		code: CUSTOM_API_ERROR.CANCELLED
	};
}
async function handleTornApiState(location, options, error, online = false) {
	if (!TORN_API_PLATFORMS.includes(location) || options.silent || SCRIPT_TYPE !== "BACKGROUND") return;
	if (error) {
		await ttStorage.change({ api: { torn: {
			online,
			error
		} } });
		await setBadge("error");
	} else {
		await getBadgeText().then((value) => {
			if (value === "error") return setBadge("default");
		}).catch(() => console.error("TT - Couldn't get the badge text."));
		await ttStorage.change({ api: { torn: {
			online: true,
			error: ""
		} } });
	}
}
async function handleNetworkError(location, options, message) {
	let error = message;
	let isLocal = false;
	let code;
	if (error === "Failed to fetch") {
		isLocal = true;
		if (!RUNTIME_INFORMATION.isUserscript() && SCRIPT_TYPE === "BACKGROUND" && !await hasOrigins(FETCH_PLATFORMS[location])) {
			error = "Permission issues";
			code = CUSTOM_API_ERROR.NO_PERMISSION;
		} else {
			error = "Network issues";
			code = CUSTOM_API_ERROR.NO_NETWORK;
		}
	}
	await handleTornApiState(location, options, error);
	throw {
		error,
		isLocal,
		code
	};
}
async function hasOrigins(...origins) {
	return browser.permissions.contains({ origins });
}
async function handleApiError(location, options, result) {
	if (TORN_API_PLATFORMS.includes(location)) {
		let error, online;
		if (result.error instanceof HTTPException) {
			error = result.error.toString();
			online = false;
		} else {
			error = result.error.error;
			online = result.error.code !== 9 && !(result instanceof HTTPException);
		}
		await handleTornApiState(location, options, error, online);
		throw result.error instanceof HTTPException ? result.error.asObject() : result.error;
	}
	throw { error: result.error };
}
function isApiErrorResponse(data) {
	return !!data && typeof data === "object" && "error" in data;
}
var HTTPException = class HTTPException {
	code;
	constructor(code) {
		this.code = code;
	}
	get message() {
		return this.code in HTTPException.codes ? HTTPException.codes[this.code] : `Unknown code (${this.code})`;
	}
	asObject() {
		return {
			code: this.code,
			message: this.message,
			http: true
		};
	}
	toString() {
		return `HTTP ${this.code}: ${this.message}`;
	}
	static get codes() {
		return {
			200: "OK",
			201: "Created",
			202: "Accepted",
			203: "Non-Authoritative Information",
			204: "No Content",
			205: "Reset Content",
			206: "Partial Content",
			300: "Multiple Choices",
			301: "Moved Permanently",
			302: "Found",
			303: "See Other",
			304: "Not Modified",
			305: "Use Proxy",
			306: "Unused",
			307: "Temporary Redirect",
			400: "Bad Request",
			401: "Unauthorized",
			402: "Payment Required",
			403: "Forbidden",
			404: "Not Found",
			405: "Method Not Allowed",
			406: "Not Acceptable",
			407: "Proxy Authentication Required",
			408: "Request Timeout",
			409: "Conflict",
			410: "Gone",
			411: "Length Required",
			412: "Precondition Required",
			413: "Request Entry Too Large",
			414: "Request-URI Too Long",
			415: "Unsupported Media Type",
			416: "Requested Range Not Satisfiable",
			417: "Expectation Failed",
			418: "I'm a teapot",
			429: "Too Many Requests",
			500: "Internal Server Error",
			501: "Not Implemented",
			502: "Bad Gateway",
			503: "Service Unavailable",
			504: "Gateway Timeout",
			505: "HTTP Version Not Supported"
		};
	}
};
//#endregion
//#region src/extension/svelte/components/ui/card/card-content.svelte
var rest_excludes$16 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class",
	"children"
]);
var root$12 = from_html(`<div><!></div>`);
function Card_content($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes$16);
	var div = root$12();
	attribute_effect(div, ($0) => ({
		"data-slot": "card-content",
		class: $0,
		...restProps
	}), [() => cn("px-4 group-data-[size=sm]/card:px-3", $$props.class)]);
	snippet(child(div), () => $$props.children ?? noop);
	reset(div);
	bind_this(div, ($$value) => ref($$value), () => ref());
	append($$anchor, div);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/card/card-description.svelte
var rest_excludes$15 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class",
	"children"
]);
var root$11 = from_html(`<p><!></p>`);
function Card_description($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes$15);
	var p = root$11();
	attribute_effect(p, ($0) => ({
		"data-slot": "card-description",
		class: $0,
		...restProps
	}), [() => cn("text-muted-foreground text-sm", $$props.class)]);
	snippet(child(p), () => $$props.children ?? noop);
	reset(p);
	bind_this(p, ($$value) => ref($$value), () => ref());
	append($$anchor, p);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/card/card-header.svelte
var rest_excludes$14 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class",
	"children"
]);
var root$10 = from_html(`<div><!></div>`);
function Card_header($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes$14);
	var div = root$10();
	attribute_effect(div, ($0) => ({
		"data-slot": "card-header",
		class: $0,
		...restProps
	}), [() => cn("group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-4 group-data-[size=sm]/card:px-3 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3", $$props.class)]);
	snippet(child(div), () => $$props.children ?? noop);
	reset(div);
	bind_this(div, ($$value) => ref($$value), () => ref());
	append($$anchor, div);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/card/card-title.svelte
var rest_excludes$13 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class",
	"children"
]);
var root$9 = from_html(`<div><!></div>`);
function Card_title($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes$13);
	var div = root$9();
	attribute_effect(div, ($0) => ({
		"data-slot": "card-title",
		class: $0,
		...restProps
	}), [() => cn("font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm", $$props.class)]);
	snippet(child(div), () => $$props.children ?? noop);
	reset(div);
	bind_this(div, ($$value) => ref($$value), () => ref());
	append($$anchor, div);
	pop();
}
//#endregion
//#region src/extension/svelte/components/ui/card/card.svelte
var rest_excludes$12 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class",
	"children",
	"size"
]);
var root$8 = from_html(`<div><!></div>`);
function Card($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), size = prop($$props, "size", 3, "default"), restProps = rest_props($$props, rest_excludes$12);
	var div = root$8();
	attribute_effect(div, ($0) => ({
		"data-slot": "card",
		"data-size": size(),
		class: $0,
		...restProps
	}), [() => cn("ring-foreground/10 bg-card text-card-foreground group/card flex flex-col gap-4 overflow-hidden rounded-xl py-4 text-sm ring-1 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl", $$props.class)]);
	snippet(child(div), () => $$props.children ?? noop);
	reset(div);
	bind_this(div, ($$value) => ref($$value), () => ref());
	append($$anchor, div);
	pop();
}
//#endregion
//#region src/common/utils/functions/api-key.ts
async function checkAPIPermission(key) {
	try {
		const { type, faction, company } = (await fetchData("tornv2", {
			section: "key",
			selections: ["info"],
			key,
			silent: true
		})).info.access;
		if (type === "Limited Access" || type === "Full Access") return {
			access: true,
			faction,
			company
		};
		else return { access: false };
	} catch (error) {
		throw error.error;
	}
}
async function changeAPIKey(key) {
	try {
		const data = await fetchData("tornv2", {
			section: "user",
			selections: ["basic"],
			key,
			silent: true
		});
		await ttStorage.change({ api: { torn: {
			key,
			owner: data.profile.id
		} } });
		await OFFLOAD_SERVICE.initialize();
	} catch (error) {
		throw error.error;
	}
}
//#endregion
//#region node_modules/phosphor-svelte/lib/MagnifyingGlassIcon.svelte
var rest_excludes$11 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"children"
]);
var root$7 = from_svg(`<path d="M232.49,215.51,185,168a92.12,92.12,0,1,0-17,17l47.53,47.54a12,12,0,0,0,17-17ZM44,112a68,68,0,1,1,68,68A68.07,68.07,0,0,1,44,112Z"></path>`);
var root_1$2 = from_svg(`<path d="M192,112a80,80,0,1,1-80-80A80,80,0,0,1,192,112Z" opacity="0.2"></path><path d="M229.66,218.34,179.6,168.28a88.21,88.21,0,1,0-11.32,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"></path>`, 1);
var root_2$1 = from_svg(`<path d="M168,112a56,56,0,1,1-56-56A56,56,0,0,1,168,112Zm61.66,117.66a8,8,0,0,1-11.32,0l-50.06-50.07a88,88,0,1,1,11.32-11.31l50.06,50.06A8,8,0,0,1,229.66,229.66ZM112,184a72,72,0,1,0-72-72A72.08,72.08,0,0,0,112,184Z"></path>`);
var root_3$1 = from_svg(`<path d="M228.24,219.76l-51.38-51.38a86.15,86.15,0,1,0-8.48,8.48l51.38,51.38a6,6,0,0,0,8.48-8.48ZM38,112a74,74,0,1,1,74,74A74.09,74.09,0,0,1,38,112Z"></path>`);
var root_4$1 = from_svg(`<path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"></path>`);
var root_5$1 = from_svg(`<path d="M226.83,221.17l-52.7-52.7a84.1,84.1,0,1,0-5.66,5.66l52.7,52.7a4,4,0,0,0,5.66-5.66ZM36,112a76,76,0,1,1,76,76A76.08,76.08,0,0,1,36,112Z"></path>`);
var root_6$1 = from_svg(`<svg><!><rect width="256" height="256" fill="none"></rect><!></svg>`);
function MagnifyingGlassIcon($$anchor, $$props) {
	push($$props, true);
	const ctx = getIconContext();
	let props = rest_props($$props, rest_excludes$11);
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
		append($$anchor, root$7());
	};
	var consequent_2 = ($$anchor) => {
		var fragment_1 = root_1$2();
		next();
		append($$anchor, fragment_1);
	};
	var consequent_3 = ($$anchor) => {
		append($$anchor, root_2$1());
	};
	var consequent_4 = ($$anchor) => {
		append($$anchor, root_3$1());
	};
	var consequent_5 = ($$anchor) => {
		append($$anchor, root_4$1());
	};
	var consequent_6 = ($$anchor) => {
		append($$anchor, root_5$1());
	};
	var alternate = ($$anchor) => {
		var text$4 = text();
		text$4.nodeValue = (console.error("Unsupported icon weight. Choose from \"thin\", \"light\", \"regular\", \"bold\", \"fill\", or \"duotone\"."), "");
		append($$anchor, text$4);
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
//#region src/extension/svelte/components/ui/command/command.svelte
var rest_excludes$10 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"api",
	"ref",
	"value",
	"class"
]);
function Command($$anchor, $$props) {
	push($$props, true);
	let api = prop($$props, "api", 15, null), ref = prop($$props, "ref", 15, null), value = prop($$props, "value", 15, ""), restProps = rest_props($$props, rest_excludes$10);
	var fragment = comment();
	var node = first_child(fragment);
	{
		let $0 = user_derived(() => cn("bg-popover text-popover-foreground flex size-full flex-col overflow-hidden rounded-xl! p-1", $$props.class));
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
//#endregion
//#region src/extension/svelte/components/ui/command/command-empty.svelte
var rest_excludes$9 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class"
]);
function Command_empty($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes$9);
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
var rest_excludes$8 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class",
	"children",
	"heading",
	"value"
]);
var root$6 = from_html(`<!> <!>`, 1);
function Command_group($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes$8);
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
					var fragment_1 = root$6();
					var node_1 = first_child(fragment_1);
					var consequent = ($$anchor) => {
						var fragment_2 = comment();
						component(first_child(fragment_2), () => Command_group_heading, ($$anchor, CommandPrimitive_GroupHeading) => {
							CommandPrimitive_GroupHeading($$anchor, {
								class: "text-muted-foreground px-2 py-1.5 text-xs font-medium",
								children: ($$anchor, $$slotProps) => {
									next();
									var text$2 = text();
									template_effect(() => set_text(text$2, $$props.heading));
									append($$anchor, text$2);
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
var rest_excludes$7 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class",
	"children",
	"align"
]);
var root$5 = from_html(`<div><!></div>`);
function Input_group_addon($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), align = prop($$props, "align", 3, "inline-start"), restProps = rest_props($$props, rest_excludes$7);
	var div = root$5();
	var event_handler = (e) => {
		if (!isElement(e.target) || e.target.closest("button")) return;
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
var rest_excludes$6 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"value",
	"class"
]);
function Input_group_input($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), value = prop($$props, "value", 15), props = rest_props($$props, rest_excludes$6);
	{
		let $0 = user_derived(() => cn("flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent", $$props.class));
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
//#endregion
//#region src/extension/svelte/components/ui/input-group/input-group.svelte
var rest_excludes$5 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class",
	"children"
]);
var root$4 = from_html(`<div><!></div>`);
function Input_group($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), props = rest_props($$props, rest_excludes$5);
	var div = root$4();
	attribute_effect(div, ($0) => ({
		"data-slot": "input-group",
		role: "group",
		class: $0,
		...props
	}), [() => cn("group/input-group border-input dark:bg-input/30 has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot][aria-invalid=true]]:ring-destructive/20 has-[[data-slot][aria-invalid=true]]:border-destructive dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40 has-disabled:bg-input/50 dark:has-disabled:bg-input/80 relative flex h-8 w-full min-w-0 items-center rounded-lg border transition-colors outline-none in-data-[slot=combobox-content]:focus-within:border-inherit in-data-[slot=combobox-content]:focus-within:ring-0 has-disabled:opacity-50 has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot][aria-invalid=true]]:ring-3 has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>textarea]:h-auto has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=inline-end]]:[&>input]:pr-1.5 has-[>[data-align=inline-start]]:[&>input]:pl-1.5", $$props.class)]);
	snippet(child(div), () => $$props.children ?? noop);
	reset(div);
	bind_this(div, ($$value) => ref($$value), () => ref());
	append($$anchor, div);
	pop();
}
//#endregion
//#region node_modules/phosphor-svelte/lib/MagnifyingGlass.svelte
var rest_excludes$4 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"children"
]);
var root$3 = from_svg(`<path d="M232.49,215.51,185,168a92.12,92.12,0,1,0-17,17l47.53,47.54a12,12,0,0,0,17-17ZM44,112a68,68,0,1,1,68,68A68.07,68.07,0,0,1,44,112Z"></path>`);
var root_1$1 = from_svg(`<path d="M192,112a80,80,0,1,1-80-80A80,80,0,0,1,192,112Z" opacity="0.2"></path><path d="M229.66,218.34,179.6,168.28a88.21,88.21,0,1,0-11.32,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"></path>`, 1);
var root_2 = from_svg(`<path d="M168,112a56,56,0,1,1-56-56A56,56,0,0,1,168,112Zm61.66,117.66a8,8,0,0,1-11.32,0l-50.06-50.07a88,88,0,1,1,11.32-11.31l50.06,50.06A8,8,0,0,1,229.66,229.66ZM112,184a72,72,0,1,0-72-72A72.08,72.08,0,0,0,112,184Z"></path>`);
var root_3 = from_svg(`<path d="M228.24,219.76l-51.38-51.38a86.15,86.15,0,1,0-8.48,8.48l51.38,51.38a6,6,0,0,0,8.48-8.48ZM38,112a74,74,0,1,1,74,74A74.09,74.09,0,0,1,38,112Z"></path>`);
var root_4 = from_svg(`<path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"></path>`);
var root_5 = from_svg(`<path d="M226.83,221.17l-52.7-52.7a84.1,84.1,0,1,0-5.66,5.66l52.7,52.7a4,4,0,0,0,5.66-5.66ZM36,112a76,76,0,1,1,76,76A76.08,76.08,0,0,1,36,112Z"></path>`);
var root_6 = from_svg(`<svg><!><rect width="256" height="256" fill="none"></rect><!></svg>`);
function MagnifyingGlass($$anchor, $$props) {
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
	var svg = root_6();
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
		append($$anchor, root$3());
	};
	var consequent_2 = ($$anchor) => {
		var fragment_1 = root_1$1();
		next();
		append($$anchor, fragment_1);
	};
	var consequent_3 = ($$anchor) => {
		append($$anchor, root_2());
	};
	var consequent_4 = ($$anchor) => {
		append($$anchor, root_3());
	};
	var consequent_5 = ($$anchor) => {
		append($$anchor, root_4());
	};
	var consequent_6 = ($$anchor) => {
		append($$anchor, root_5());
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
//#region src/extension/svelte/components/ui/command/command-input.svelte
var rest_excludes$3 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class",
	"value"
]);
var root$2 = from_html(`<!> <!>`, 1);
var root_1 = from_html(`<div data-slot="command-input-wrapper" class="p-1 pb-0"><!></div>`);
function Command_input($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), value = prop($$props, "value", 15, ""), restProps = rest_props($$props, rest_excludes$3);
	var div = root_1();
	component(child(div), () => Input_group, ($$anchor, InputGroup_Root) => {
		InputGroup_Root($$anchor, {
			class: "bg-input/30 border-input/30 h-8! rounded-lg! shadow-none! *:data-[slot=input-group-addon]:pl-2!",
			children: ($$anchor, $$slotProps) => {
				var fragment = root$2();
				var node_1 = first_child(fragment);
				{
					const child = ($$anchor, $$arg0) => {
						let props = () => ($$arg0?.()).props;
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
var rest_excludes$2 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class",
	"children"
]);
var root$1 = from_html(`<!> <!>`, 1);
function Command_item($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes$2);
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
					var fragment_1 = root$1();
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
var rest_excludes$1 = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class"
]);
function Command_list($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes$1);
	var fragment = comment();
	var node = first_child(fragment);
	{
		let $0 = user_derived(() => cn("no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none", $$props.class));
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
var rest_excludes = /* @__PURE__ */ new Set([
	"$$slots",
	"$$events",
	"$$legacy",
	"ref",
	"class",
	"children"
]);
var root = from_html(`<span><!></span>`);
function Command_shortcut($$anchor, $$props) {
	push($$props, true);
	let ref = prop($$props, "ref", 15, null), restProps = rest_props($$props, rest_excludes);
	var span = root();
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
export { ALL_AREAS as A, getRewardValue as B, Dialog_title as C, Dialog_content as D, Dialog_description as E, HIGHLIGHT_PLACEHOLDERS as F, isSellable as G, getStockIncrement as H, LINKS as I, TORNTOOLS_FORUM_POST as L, CASINO_GAMES as M, CHAT_TITLE_COLORS as N, Textarea as O, CUSTOM_LINKS_PRESET as P, getNextChainBonus as R, Dialog_trigger as S, Dialog_footer as T, getStockReward as U, getStockBoughtPrice as V, isDividendStock as W, Card_description as _, Input_group as a, fetchData as b, Command_group as c, MagnifyingGlassIcon as d, changeAPIKey as f, Card_header as g, Card_title as h, Command_input as i, ALL_ICONS as j, Spinner as k, Command_empty as l, Card as m, Command_list as n, Input_group_input as o, checkAPIPermission as p, Command_item as r, Input_group_addon as s, Command_shortcut as t, Command as u, Card_content as v, Dialog_header as w, Dialog as x, FETCH_PLATFORMS as y, getRequiredStocks as z };

//# sourceMappingURL=command-DIy3eOEG.js.map