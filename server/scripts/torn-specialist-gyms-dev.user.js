// ==UserScript==
// @name         Torn Specialist Gyms (DEV)
// @namespace    tornwar.com/dev
// @version      0.2.2
// @description  DEV FORK with loud auto-switch diagnostics — logs script load, every fetch URL it sees (capped), and every XHR URL too, so we can pin down why train requests aren't reaching the hook.
// @author       warboard
// @match        https://www.torn.com/gym.php*
// @match        https://pda.torn.com/gym.php*
// @downloadURL  https://tornwar.com/scripts/torn-specialist-gyms-dev.user.js
// @updateURL    https://tornwar.com/scripts/torn-specialist-gyms-dev.meta.js
// @grant        unsafeWindow
// @run-at       document-start
// @noframes
// ==/UserScript==

(function() {
	"use strict";

	const SCRIPT_VERSION = "0.2.2";
	const NONE = "none";
	const STORAGE_KEY_ONE = "tsg_dev_specialist_1";
	const STORAGE_KEY_TWO = "tsg_dev_specialist_2";
	const AUTO_SWITCH_STORAGE_KEY = "tsg_dev_autoswitch_enabled";
	const PANEL_ID = "tsg-dev-specialist-panel";
	const STYLE_ID = "tsg-dev-specialist-style";
	const GYM_CONTENT_SELECTOR = '[class*="gymContent___"]';
	const ACTIVE_GYM_SELECTOR = "[class*='active'][class^='gymButton']";
	const GYM_ID_SELECTOR_PREFIX = "[class*='gym-";

	const GYM_CATALOG = [
		{ id: 1, name: "Premier Fitness", stage: 1, energy: 5, str: 20, spe: 20, def: 20, dex: 20, note: "" },
		{ id: 2, name: "Average Joes", stage: 1, energy: 5, str: 24, spe: 24, def: 28, dex: 24, note: "" },
		{ id: 3, name: "Woody's Workout Club", stage: 1, energy: 5, str: 28, spe: 32, def: 30, dex: 28, note: "" },
		{ id: 4, name: "Beach Bods", stage: 1, energy: 5, str: 32, spe: 32, def: 32, dex: 0, note: "" },
		{ id: 5, name: "Silver Gym", stage: 1, energy: 5, str: 34, spe: 36, def: 34, dex: 32, note: "" },
		{ id: 6, name: "Pour Femme", stage: 1, energy: 5, str: 34, spe: 36, def: 36, dex: 38, note: "" },
		{ id: 7, name: "Davies Den", stage: 1, energy: 5, str: 37, spe: 0, def: 37, dex: 37, note: "" },
		{ id: 8, name: "Global Gym", stage: 1, energy: 5, str: 40, spe: 40, def: 40, dex: 40, note: "" },
		{ id: 9, name: "Knuckle Heads", stage: 2, energy: 10, str: 48, spe: 44, def: 40, dex: 42, note: "" },
		{ id: 10, name: "Pioneer Fitness", stage: 2, energy: 10, str: 44, spe: 45, def: 48, dex: 44, note: "" },
		{ id: 11, name: "Anabolic Anomalies", stage: 2, energy: 10, str: 50, spe: 45, def: 52, dex: 45, note: "" },
		{ id: 12, name: "Core", stage: 2, energy: 10, str: 50, spe: 52, def: 50, dex: 50, note: "" },
		{ id: 13, name: "Racing Fitness", stage: 2, energy: 10, str: 50, spe: 54, def: 48, dex: 52, note: "" },
		{ id: 14, name: "Complete Cardio", stage: 2, energy: 10, str: 55, spe: 58, def: 55, dex: 52, note: "" },
		{ id: 15, name: "Legs, Bums and Tums", stage: 2, energy: 10, str: 0, spe: 56, def: 56, dex: 58, note: "" },
		{ id: 16, name: "Deep Burn", stage: 2, energy: 10, str: 60, spe: 60, def: 60, dex: 60, note: "" },
		{ id: 17, name: "Apollo Gym", stage: 3, energy: 10, str: 60, spe: 62, def: 64, dex: 62, note: "" },
		{ id: 18, name: "Gun Shop", stage: 3, energy: 10, str: 66, spe: 64, def: 62, dex: 62, note: "" },
		{ id: 19, name: "Force Training", stage: 3, energy: 10, str: 64, spe: 66, def: 64, dex: 68, note: "" },
		{ id: 20, name: "Cha Cha's", stage: 3, energy: 10, str: 64, spe: 64, def: 68, dex: 70, note: "" },
		{ id: 21, name: "Atlas", stage: 3, energy: 10, str: 70, spe: 64, def: 64, dex: 66, note: "" },
		{ id: 22, name: "Last Round", stage: 3, energy: 10, str: 68, spe: 66, def: 70, dex: 66, note: "" },
		{ id: 23, name: "The Edge", stage: 3, energy: 10, str: 68, spe: 70, def: 70, dex: 68, note: "" },
		{ id: 24, name: "George's", stage: 3, energy: 10, str: 73, spe: 73, def: 73, dex: 73, note: "" },
		{ id: 25, name: "Balboas Gym", stage: 4, energy: 25, str: 0, spe: 0, def: 75, dex: 75, note: "Requirements must be maintained to preserve access to this gym" },
		{ id: 26, name: "Frontline Fitness", stage: 4, energy: 25, str: 75, spe: 75, def: 0, dex: 0, note: "Requirements must be maintained to preserve access to this gym" },
		{ id: 27, name: "Gym 3000", stage: 4, energy: 50, str: 80, spe: 0, def: 0, dex: 0, note: "Requirements must be maintained to preserve access to this gym" },
		{ id: 28, name: "Mr. Isoyamas", stage: 4, energy: 50, str: 0, spe: 0, def: 80, dex: 0, note: "Requirements must be maintained to preserve access to this gym" },
		{ id: 29, name: "Total Rebound", stage: 4, energy: 50, str: 0, spe: 80, def: 0, dex: 0, note: "Requirements must be maintained to preserve access to this gym" },
		{ id: 30, name: "Elites", stage: 4, energy: 50, str: 0, spe: 0, def: 0, dex: 80, note: "Requirements must be maintained to preserve access to this gym" },
		{ id: 31, name: "The Sports Science Lab", stage: 4, energy: 25, str: 90, spe: 90, def: 90, dex: 90, note: "The use of drugs may result in the loss of membership without refunds" },
		{ id: 32, name: "Unknown", stage: 4, energy: 10, str: 100, spe: 100, def: 100, dex: 100, note: "Membership by invite only" },
		{ id: 33, name: "The Jail Gym", stage: 0, energy: 5, str: 34, spe: 34, def: 45, dex: 0, note: "" },
	];

	const BATTLE_STAT = {
		STR: "Strength",
		DEF: "Defense",
		SPD: "Speed",
		DEX: "Dexterity",
	};

	const SPECIAL_GYM = {
		BALBOAS: "balboas",
		FRONTLINE: "frontline",
		GYM3000: "gym3000",
		ISOYAMAS: "isoyamas",
		REBOUND: "rebound",
		ELITES: "elites",
	};

	const SPECIAL_GYM_TYPE = {
		SINGLE_STAT: "singleStat",
		TWO_STATS: "twoStats",
	};

	const specialGymDescMap = {
		[SPECIAL_GYM.BALBOAS]: "Balboas Gym (def/dex)",
		[SPECIAL_GYM.FRONTLINE]: "Frontline Fitness (str/spd)",
		[SPECIAL_GYM.GYM3000]: "Gym 3000 (str)",
		[SPECIAL_GYM.ISOYAMAS]: "Mr. Isoyamas (def)",
		[SPECIAL_GYM.REBOUND]: "Total Rebound (spd)",
		[SPECIAL_GYM.ELITES]: "Elites (dex)",
	};

	const specialGymInfo = {
		[SPECIAL_GYM.BALBOAS]: {
			type: SPECIAL_GYM_TYPE.TWO_STATS,
			statOneName: BATTLE_STAT.DEF,
			statTwoName: BATTLE_STAT.DEX,
		},
		[SPECIAL_GYM.FRONTLINE]: {
			type: SPECIAL_GYM_TYPE.TWO_STATS,
			statOneName: BATTLE_STAT.STR,
			statTwoName: BATTLE_STAT.SPD,
		},
		[SPECIAL_GYM.GYM3000]: {
			type: SPECIAL_GYM_TYPE.SINGLE_STAT,
			statName: BATTLE_STAT.STR,
		},
		[SPECIAL_GYM.ISOYAMAS]: {
			type: SPECIAL_GYM_TYPE.SINGLE_STAT,
			statName: BATTLE_STAT.DEF,
		},
		[SPECIAL_GYM.REBOUND]: {
			type: SPECIAL_GYM_TYPE.SINGLE_STAT,
			statName: BATTLE_STAT.SPD,
		},
		[SPECIAL_GYM.ELITES]: {
			type: SPECIAL_GYM_TYPE.SINGLE_STAT,
			statName: BATTLE_STAT.DEX,
		},
	};

	function toRecord(values, mapper) {
		return Object.fromEntries(values.map(mapper));
	}

	function calculateSingleStatGym(mainStat, otherStats) {
		const highestOther = Math.max(...otherStats);
		const missingMain = Math.max(0, highestOther * 1.25 - mainStat);

		return {
			missing: {
				mainStat: Math.ceil(missingMain),
				otherStats: otherStats.map(() => 0),
			},
			available: {
				mainStat: Infinity,
				otherStats: otherStats.map((otherStat) => Math.floor(Math.max(0, (mainStat + missingMain) / 1.25 - otherStat))),
			},
		};
	}

	function calculateTwoStatsGym(mainStat1, mainStat2, otherStats) {
		let newMainStat1 = mainStat1;
		let newMainStat2 = mainStat2;

		const otherStatsSum = otherStats.reduce((a, b) => a + b, 0);

		if (otherStatsSum * 1.25 > newMainStat1 + newMainStat2) {
			const extra = otherStatsSum * 1.25 - newMainStat1 - newMainStat2;
			const addToMainStat1 = Math.min(extra, Math.max(0, (newMainStat2 + extra - newMainStat1) / 2));

			newMainStat1 += addToMainStat1;
			newMainStat2 += extra - addToMainStat1;
		}

		return {
			missing: {
				mainStat1: Math.ceil(newMainStat1 - mainStat1),
				mainStat2: Math.ceil(newMainStat2 - mainStat2),
				otherStats: otherStats.map(() => 0),
			},
			available: {
				mainStat1: Infinity,
				mainStat2: Infinity,
				otherStats: otherStats.map(() => Math.floor(Math.max(0, (newMainStat1 + newMainStat2) / 1.25 - otherStatsSum))),
			},
		};
	}

	function calculateSingleStatAndTwoStatsOverlappingGyms(mainStat, secondaryStat, neglectedStat1, neglectedStat2) {
		let newMainStat = mainStat;
		let newSecondaryStat = secondaryStat;
		const newNeglectedStat1 = neglectedStat1;
		const newNeglectedStat2 = neglectedStat2;

		while (true) {
			const highestNonMainStat = Math.max(newSecondaryStat, newNeglectedStat1, newNeglectedStat2);

			if (highestNonMainStat * 1.25 > newMainStat) {
				newMainStat += highestNonMainStat * 1.25 - newMainStat;

				continue;
			}

			if ((newNeglectedStat1 + newNeglectedStat2) * 1.25 > newMainStat + newSecondaryStat) {
				const extra = (newNeglectedStat1 + newNeglectedStat2) * 1.25 - newMainStat - newSecondaryStat;
				const addToMainStat = Math.min(extra, Math.max(0, (1.25 * (newSecondaryStat + extra) - newMainStat) / (1 + 1.25)));

				newMainStat += addToMainStat;
				newSecondaryStat += extra - addToMainStat;

				continue;
			}

			return {
				missing: {
					mainStat: Math.ceil(newMainStat - mainStat),
					secondaryStat: Math.ceil(newSecondaryStat - secondaryStat),
					neglectedStat1: Math.ceil(newNeglectedStat1 - neglectedStat1),
					neglectedStat2: Math.ceil(newNeglectedStat2 - neglectedStat2),
				},
				available: {
					mainStat: Infinity,
					secondaryStat: Math.floor(Math.max(0, newMainStat / 1.25 - newSecondaryStat)),
					neglectedStat1: Math.floor(
						Math.max(
							0,
							Math.min((newMainStat + newSecondaryStat) / 1.25 - newNeglectedStat1 - newNeglectedStat2, newMainStat / 1.25 - newNeglectedStat1),
						),
					),
					neglectedStat2: Math.floor(
						Math.max(
							0,
							Math.min((newMainStat + newSecondaryStat) / 1.25 - newNeglectedStat1 - newNeglectedStat2, newMainStat / 1.25 - newNeglectedStat2),
						),
					),
				},
			};
		}
	}

	function calculateSingleStatAndTwoStatsGyms(mainStat, secondaryStat1, secondaryStat2, neglectedStat) {
		let newMainStat = mainStat;
		let newSecondaryStat1 = secondaryStat1;
		let newSecondaryStat2 = secondaryStat2;
		const newNeglectedStat = neglectedStat;

		while (true) {
			const highestNonMainStat = Math.max(newSecondaryStat1, newSecondaryStat2, newNeglectedStat);

			if (highestNonMainStat * 1.25 > newMainStat) {
				newMainStat += highestNonMainStat * 1.25 - newMainStat;

				continue;
			}

			if ((newMainStat + newNeglectedStat) * 1.25 > newSecondaryStat1 + newSecondaryStat2) {
				const extra = (newMainStat + newNeglectedStat) * 1.25 - newSecondaryStat1 - newSecondaryStat2;
				const addToSecondaryStat1 = Math.min(extra, Math.max(0, (newSecondaryStat2 + extra - newSecondaryStat1) / 2));

				newSecondaryStat1 += addToSecondaryStat1;
				newSecondaryStat2 += extra - addToSecondaryStat1;

				continue;
			}

			return {
				missing: {
					mainStat: Math.ceil(newMainStat - mainStat),
					secondaryStat1: Math.ceil(newSecondaryStat1 - secondaryStat1),
					secondaryStat2: Math.ceil(newSecondaryStat2 - secondaryStat2),
					neglectedStat: Math.ceil(newNeglectedStat - neglectedStat),
				},
				available: {
					mainStat: Math.floor(Math.max(0, (newSecondaryStat1 + newSecondaryStat2) / 1.25 - newNeglectedStat - newMainStat)),
					secondaryStat1: Math.floor(Math.max(0, newMainStat / 1.25 - newSecondaryStat1)),
					secondaryStat2: Math.floor(Math.max(0, newMainStat / 1.25 - newSecondaryStat2)),
					neglectedStat: Math.floor(
						Math.max(0, Math.min(newMainStat / 1.25, (newSecondaryStat1 + newSecondaryStat2) / 1.25 - newMainStat) - newNeglectedStat),
					),
				},
			};
		}
	}

	function calculateSpecialGymsData(
		stats,
		selectionOne,
		selectionTwo,
	) {
		if (selectionOne === NONE && selectionTwo === NONE) {
			return { type: NONE };
		}

		if (selectionOne === NONE || selectionTwo === NONE || selectionOne === selectionTwo) {
			const relevantSelection = selectionOne === NONE ? selectionTwo : selectionOne;
			const selectionSpecialGymInfo = specialGymInfo[relevantSelection];

			if (selectionSpecialGymInfo.type === SPECIAL_GYM_TYPE.SINGLE_STAT) {
				const otherStatNames = Object.values(BATTLE_STAT).filter((statName) => statName !== selectionSpecialGymInfo.statName);

				const result = calculateSingleStatGym(
					stats[selectionSpecialGymInfo.statName],
					otherStatNames.map((statName) => stats[statName]),
				);

				return {
					type: "success",
					missing: {
						[selectionSpecialGymInfo.statName]: result.missing.mainStat,
						...toRecord(otherStatNames, (statName, index) => [statName, result.missing.otherStats[index]]),
					},
					available: {
						[selectionSpecialGymInfo.statName]: result.available.mainStat,
						...toRecord(otherStatNames, (statName, index) => [statName, result.available.otherStats[index]]),
					},
				};
			} else {
				const otherStatNames = Object.values(BATTLE_STAT).filter(
					(statName) => statName !== selectionSpecialGymInfo.statOneName && statName !== selectionSpecialGymInfo.statTwoName,
				);

				const result = calculateTwoStatsGym(
					stats[selectionSpecialGymInfo.statOneName],
					stats[selectionSpecialGymInfo.statTwoName],
					otherStatNames.map((statName) => stats[statName]),
				);

				return {
					type: "success",
					missing: {
						[selectionSpecialGymInfo.statOneName]: result.missing.mainStat1,
						[selectionSpecialGymInfo.statTwoName]: result.missing.mainStat2,
						...toRecord(otherStatNames, (statName, index) => [statName, result.missing.otherStats[index]]),
					},
					available: {
						[selectionSpecialGymInfo.statOneName]: result.available.mainStat1,
						[selectionSpecialGymInfo.statTwoName]: result.available.mainStat2,
						...toRecord(otherStatNames, (statName, index) => [statName, result.available.otherStats[index]]),
					},
				};
			}
		}

		const selectionOneSpecialGymInfo = specialGymInfo[selectionOne];
		const selectionTwoSpecialGymInfo = specialGymInfo[selectionTwo];

		if (selectionOneSpecialGymInfo.type === selectionTwoSpecialGymInfo.type) {
			return { type: "impossible" };
		}

		const singleStatConfig =
			selectionOneSpecialGymInfo.type === SPECIAL_GYM_TYPE.SINGLE_STAT
				? selectionOneSpecialGymInfo
				: selectionTwoSpecialGymInfo;
		const twoStatsConfig =
			selectionOneSpecialGymInfo.type === SPECIAL_GYM_TYPE.SINGLE_STAT ? selectionTwoSpecialGymInfo : selectionOneSpecialGymInfo;

		if (twoStatsConfig.statOneName === singleStatConfig.statName || twoStatsConfig.statTwoName === singleStatConfig.statName) {
			const secondaryStatName = twoStatsConfig.statOneName === singleStatConfig.statName ? twoStatsConfig.statTwoName : twoStatsConfig.statOneName;
			const neglectedStatsNames = Object.values(BATTLE_STAT).filter(
				(statName) => statName !== twoStatsConfig.statOneName && statName !== twoStatsConfig.statTwoName,
			);
			const result = calculateSingleStatAndTwoStatsOverlappingGyms(
				stats[singleStatConfig.statName],
				stats[secondaryStatName],
				stats[neglectedStatsNames[0]],
				stats[neglectedStatsNames[1]],
			);

			return {
				type: "success",
				missing: {
					[singleStatConfig.statName]: result.missing.mainStat,
					[secondaryStatName]: result.missing.secondaryStat,
					[neglectedStatsNames[0]]: result.missing.neglectedStat1,
					[neglectedStatsNames[1]]: result.missing.neglectedStat2,
				},
				available: {
					[singleStatConfig.statName]: result.available.mainStat,
					[secondaryStatName]: result.available.secondaryStat,
					[neglectedStatsNames[0]]: result.available.neglectedStat1,
					[neglectedStatsNames[1]]: result.available.neglectedStat2,
				},
			};
		}

		const neglectedStatName = Object.values(BATTLE_STAT).find(
			(statName) => statName !== singleStatConfig.statName && statName !== twoStatsConfig.statOneName && statName !== twoStatsConfig.statTwoName,
		);

		const result = calculateSingleStatAndTwoStatsGyms(
			stats[singleStatConfig.statName],
			stats[twoStatsConfig.statOneName],
			stats[twoStatsConfig.statTwoName],
			stats[neglectedStatName],
		);

		return {
			type: "success",
			missing: {
				[singleStatConfig.statName]: result.missing.mainStat,
				[twoStatsConfig.statOneName]: result.missing.secondaryStat1,
				[twoStatsConfig.statTwoName]: result.missing.secondaryStat2,
				[neglectedStatName]: result.missing.neglectedStat,
			},
			available: {
				[singleStatConfig.statName]: result.available.mainStat,
				[twoStatsConfig.statOneName]: result.available.secondaryStat1,
				[twoStatsConfig.statTwoName]: result.available.secondaryStat2,
				[neglectedStatName]: result.available.neglectedStat,
			},
		};
	}

	const STAT_ABBR = {
		[BATTLE_STAT.STR]: "STR",
		[BATTLE_STAT.DEF]: "DEF",
		[BATTLE_STAT.SPD]: "SPD",
		[BATTLE_STAT.DEX]: "DEX",
	};

	const STAT_META = {
		str: { name: BATTLE_STAT.STR, label: "STR", aliases: ["strength", "str"] },
		spe: { name: BATTLE_STAT.SPD, label: "SPD", aliases: ["speed", "spd", "spe"] },
		def: { name: BATTLE_STAT.DEF, label: "DEF", aliases: ["defense", "defence", "def"] },
		dex: { name: BATTLE_STAT.DEX, label: "DEX", aliases: ["dexterity", "dex"] },
	};

	const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
	const compactNumberFormatter = new Intl.NumberFormat("en-US", {
		compactDisplay: "short",
		maximumFractionDigits: 1,
		notation: "compact",
	});

	let panelElement;
	let resultsElement;
	let selectOneElement;
	let selectTwoElement;
	let autoSwitchCheckboxElement;
	let pageObserver;
	let statObservers = [];
	let statElementsMap = {};
	// v0.2.1: hook the page's fetch BEFORE Torn captures its reference.
	// v0.2.2: loud diagnostics so we can see whether the hook is even
	// reaching page-world fetch, and whether train requests come through
	// fetch or XHR or some other channel.
	const pageWindow = (typeof unsafeWindow !== "undefined") ? unsafeWindow : window;
	const realFetch = pageWindow.fetch.bind(pageWindow);

	const D = (...a) => { try { console.log("[tsg-dev]", ...a); } catch (_) {} };
	D("script load v" + SCRIPT_VERSION,
	  "pageWindow===window:", pageWindow === window,
	  "unsafeWindow defined:", (typeof unsafeWindow !== "undefined"),
	  "doc.readyState:", document.readyState,
	  "url:", location.href);

	// Tap XHR too so we can see if Torn migrated training to XHR.
	try {
		const RealXHROpen = pageWindow.XMLHttpRequest.prototype.open;
		let xhrCount = 0;
		pageWindow.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
			if (xhrCount++ < 40) D("xhr", method, String(url).slice(0, 120));
			return RealXHROpen.call(this, method, url, ...rest);
		};
		D("xhr hook installed");
	} catch (e) { D("xhr hook FAILED", e && e.message); }

	let fetchCount = 0;

	function formatNumber(value) {
		if (value === Infinity) {
			return "∞";
		}

		if (!Number.isFinite(value)) {
			return "—";
		}

		return numberFormatter.format(value);
	}

	function safeSelection(value) {
		return value === NONE || Object.values(SPECIAL_GYM).includes(value) ? value : NONE;
	}

	function getStoredSelection(key) {
		return safeSelection(localStorage.getItem(key) || NONE);
	}

	function getStoredAutoSwitchEnabled() {
		return localStorage.getItem(AUTO_SWITCH_STORAGE_KEY) === "1";
	}

	function createElement(type, className, text) {
		const element = document.createElement(type);

		if (className) {
			element.className = className;
		}

		if (text !== undefined) {
			element.textContent = text;
		}

		return element;
	}

	function getGymMarker(gymId) {
		return document.querySelector(`${GYM_ID_SELECTOR_PREFIX}${gymId}']`);
	}

	function getGymButtonContainer(gymId) {
		return getGymMarker(gymId)?.parentElement || null;
	}

	function hasLockedClass(element) {
		return Boolean(element && Array.from(element.classList).some((className) => className.startsWith("locked")));
	}

	function isGymLocked(gymId) {
		return hasLockedClass(getGymButtonContainer(gymId));
	}

	function isGymAvailableForAutoSwitch(gymId) {
		const buttonContainer = getGymButtonContainer(gymId);
		return Boolean(buttonContainer && !hasLockedClass(buttonContainer));
	}

	function getGymIdFromElement(element) {
		if (!element) {
			return null;
		}

		for (const className of element.classList) {
			const match = className.match(/^gym-(\d+)/);

			if (match) {
				return Number(match[1]);
			}
		}

		return null;
	}

	function getCurrentGymId() {
		const activeButton = document.querySelector(ACTIVE_GYM_SELECTOR);
		const activeParent = activeButton?.parentElement || null;
		const candidates = [
			activeParent?.querySelector("[class*='gym-']"),
			activeButton?.querySelector("[class*='gym-']"),
			activeButton,
			activeButton?.previousElementSibling,
			activeButton?.nextElementSibling,
		];

		for (const candidate of candidates) {
			const gymId = getGymIdFromElement(candidate);

			if (gymId) {
				return gymId;
			}
		}

		return null;
	}

	function readCandidateText(element) {
		if (!element) {
			return "";
		}

		return [
			element.getAttribute("aria-label"),
			element.getAttribute("title"),
			element.getAttribute("data-tooltip"),
			element.textContent,
		].filter(Boolean).join(" ");
	}

	function getRequirementText(gymId) {
		const marker = getGymMarker(gymId);
		const buttonContainer = marker?.parentElement || null;
		const roots = [
			marker,
			buttonContainer,
			buttonContainer?.parentElement,
			buttonContainer?.parentElement?.parentElement,
		].filter(Boolean);
		const snippets = [];
		const requirementSelectors = [
			"[aria-label*='require' i]",
			"[title*='require' i]",
			"[data-tooltip*='require' i]",
			"[class*='tooltip' i]",
			"[class*='require' i]",
			"[class*='locked' i]",
		];

		for (const root of roots) {
			snippets.push(readCandidateText(root));

			for (const selector of requirementSelectors) {
				root.querySelectorAll?.(selector).forEach((element) => {
					snippets.push(readCandidateText(element));
				});
			}
		}

		return snippets.filter(Boolean).join(" ");
	}

	function parseHumanNumber(rawValue) {
		const match = String(rawValue).trim().match(/^([\d,.]+)\s*([kmbt])?$/i);

		if (!match) {
			return null;
		}

		const numericValue = Number(match[1].replace(/,/g, ""));
		const multiplier = {
			k: 1e3,
			m: 1e6,
			b: 1e9,
			t: 1e12,
		}[match[2]?.toLowerCase()] || 1;

		return Number.isFinite(numericValue) ? numericValue * multiplier : null;
	}

	function parseUnlockShortfall(requirementText, stats) {
		const text = requirementText.replace(/\s+/g, " ");
		const candidates = [];

		for (const statKey of Object.keys(STAT_META)) {
			const statMeta = STAT_META[statKey];

			for (const alias of statMeta.aliases) {
				const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
				const patterns = [
					new RegExp(`\\b${escapedAlias}\\b\\D{0,80}([\\d,.]+\\s*[kmbt]?)`, "gi"),
					new RegExp(`([\\d,.]+\\s*[kmbt]?)\\D{0,80}\\b${escapedAlias}\\b`, "gi"),
				];

				for (const pattern of patterns) {
					let match;

					while ((match = pattern.exec(text))) {
						const threshold = parseHumanNumber(match[1]);

						if (!threshold) {
							continue;
						}

						const shortfall = threshold - stats[statMeta.name];

						if (shortfall > 0) {
							candidates.push({
								amount: Math.ceil(shortfall),
								label: statMeta.label,
							});
						}
					}
				}
			}
		}

		return candidates.sort((a, b) => a.amount - b.amount)[0] || null;
	}

	function formatCompactNumber(value) {
		return compactNumberFormatter.format(value).replace(/\.0([KMBT])$/, "$1");
	}

	function formatGymDots(value) {
		return (value / 10).toFixed(1);
	}

	function getGymRatingsText(gym) {
		return Object.keys(STAT_META)
			.filter((statKey) => gym[statKey] > 0)
			.map((statKey) => `${STAT_META[statKey].label} ${formatGymDots(gym[statKey])}`)
			.join(" · ");
	}

	function getLockedGymRows(stats) {
		return GYM_CATALOG
			.filter((gym) => isGymLocked(gym.id))
			.map((gym) => {
				const shortfall = parseUnlockShortfall(getRequirementText(gym.id), stats);

				return {
					gym,
					shortfall,
				};
			})
			.sort((a, b) => {
				if (!a.shortfall && !b.shortfall) return a.gym.id - b.gym.id;
				if (!a.shortfall) return 1;
				if (!b.shortfall) return -1;
				return a.shortfall.amount - b.shortfall.amount;
			});
	}

	function getRequestPath(requestInput) {
		const rawUrl = typeof requestInput === "string" ? requestInput : requestInput?.url;

		if (!rawUrl) {
			return "";
		}

		try {
			const url = new URL(rawUrl, window.location.origin);
			return `${url.pathname}${url.search}`;
		} catch {
			return rawUrl;
		}
	}

	function getTrainStatKey(args) {
		try {
			const body = args[1]?.body;
			const statKey = JSON.parse(body).stat.substring(0, 3).toLowerCase();
			return Object.prototype.hasOwnProperty.call(STAT_META, statKey) ? statKey : null;
		} catch {
			return null;
		}
	}

	function getBestUnlockedGym(statKey) {
		return GYM_CATALOG
			.filter((gym) => gym[statKey] > 0 && isGymAvailableForAutoSwitch(gym.id))
			.sort((a, b) => b[statKey] - a[statKey] || b.stage - a.stage || b.id - a.id)[0] || null;
	}

	function buildChangeGymInit(sourceInit, gymId) {
		const headers = new Headers(sourceInit?.headers || {});

		if (!headers.has("content-type")) {
			headers.set("content-type", "application/json");
		}

		return {
			credentials: sourceInit?.credentials || "same-origin",
			headers,
			method: "POST",
			body: JSON.stringify({ step: "changeGym", gymID: gymId }),
		};
	}

	// v0.2.1: install ONCE at script load (document-start). The toggle
	// only flips a flag; we don't re-patch on toggle because by then
	// Torn has captured its own local fetch reference and a late patch
	// would be invisible.
	pageWindow.fetch = async function(...args) {
		const requestPath = getRequestPath(args[0]);
		if (fetchCount++ < 40) D("fetch", requestPath.slice(0, 120));
		if (requestPath.startsWith("/gym.php?step=train")) {
			D("TRAIN INTERCEPTED — autoSwitchEnabled=" + getStoredAutoSwitchEnabled(),
			  "body=" + (typeof args[1]?.body === "string" ? args[1].body.slice(0, 120) : typeof args[1]?.body));
		}
		if (getStoredAutoSwitchEnabled()) {
			try {
				if (requestPath.startsWith("/gym.php?step=train")) {
					const statKey = getTrainStatKey(args);
					const bestGym = statKey ? getBestUnlockedGym(statKey) : null;
					const currentGymId = getCurrentGymId();
					D("autoswap: stat=" + statKey + " bestGym=" + (bestGym && bestGym.id) + " currentGym=" + currentGymId);
					if (bestGym && bestGym.id !== currentGymId) {
						D("posting changeGym → " + bestGym.id);
						const r = await realFetch("/gym.php?step=changeGym", buildChangeGymInit(args[1], bestGym.id));
						D("changeGym response status=" + r.status);
					}
				}
			} catch (e) {
				D("auto-switch error:", e && e.message);
			}
		}
		return realFetch(...args);
	};
	D("fetch hook installed on pageWindow");

	function syncAutoSwitchHook() { /* no-op; hook is permanent, toggle is read live */ }

	function injectStyles() {
		if (document.getElementById(STYLE_ID)) {
			return;
		}

		const style = document.createElement("style");
		style.id = STYLE_ID;
		style.textContent = `
			#${PANEL_ID},
			#${PANEL_ID} * {
				box-sizing: border-box;
			}

			#${PANEL_ID} {
				width: min(100%, 760px);
				margin: 10px 0;
				padding: 10px;
				border: 1px solid #2a3447;
				border-radius: 8px;
				background: rgba(10, 13, 20, 0.94);
				box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.04);
				color: #e6e8ee;
				font: 12px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
				backdrop-filter: blur(8px);
			}

			#${PANEL_ID} .tsg-dev-top {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 8px;
				padding-bottom: 8px;
				border-bottom: 1px solid rgba(42, 52, 71, 0.8);
			}

			#${PANEL_ID} .tsg-dev-title {
				display: flex;
				align-items: center;
				gap: 8px;
				min-width: 0;
				font-weight: 700;
				letter-spacing: 0;
				color: #e6e8ee;
			}

			#${PANEL_ID} .tsg-dev-title::before {
				content: "";
				width: 6px;
				height: 18px;
				border-radius: 999px;
				background: #6ee7b7;
				box-shadow: 0 0 14px rgba(110, 231, 183, 0.45);
				flex: 0 0 auto;
			}

			#${PANEL_ID} .tsg-dev-version {
				color: #9ca3af;
				font-size: 11px;
				white-space: nowrap;
			}

			#${PANEL_ID} .tsg-dev-badge {
				display: inline-flex;
				align-items: center;
				min-height: 18px;
				padding: 2px 6px;
				border: 1px solid rgba(251, 191, 36, 0.52);
				border-radius: 999px;
				background: rgba(251, 191, 36, 0.12);
				color: #fbbf24;
				font-size: 10px;
				font-weight: 800;
				line-height: 1;
			}

			#${PANEL_ID} .tsg-dev-controls {
				display: grid;
				grid-template-columns: repeat(2, minmax(0, 1fr));
				gap: 8px;
				margin: 10px 0;
			}

			#${PANEL_ID} .tsg-dev-field {
				display: grid;
				gap: 4px;
				min-width: 0;
			}

			#${PANEL_ID} .tsg-dev-label {
				color: #9ca3af;
				font-size: 11px;
				font-weight: 700;
				text-transform: uppercase;
				letter-spacing: 0;
			}

			#${PANEL_ID} .tsg-dev-autoswitch {
				display: inline-flex;
				align-items: center;
				gap: 8px;
				margin: 0 0 10px;
				color: #e6e8ee;
				font-weight: 700;
				user-select: none;
			}

			#${PANEL_ID} .tsg-dev-autoswitch input {
				width: 16px;
				height: 16px;
				margin: 0;
				accent-color: #6ee7b7;
			}

			#${PANEL_ID} select {
				width: 100%;
				min-height: 32px;
				padding: 6px 30px 6px 8px;
				border: 1px solid #2a3447;
				border-radius: 6px;
				background: #0a0d14;
				color: #e6e8ee;
				font: inherit;
				outline: none;
			}

			#${PANEL_ID} select:focus {
				border-color: #6ee7b7;
				box-shadow: 0 0 0 2px rgba(110, 231, 183, 0.16);
			}

			#${PANEL_ID} .tsg-dev-message {
				padding: 10px;
				border: 1px solid #2a3447;
				border-radius: 6px;
				background: rgba(20, 26, 38, 0.72);
				color: #9ca3af;
				font-weight: 700;
			}

			#${PANEL_ID} .tsg-dev-message.tsg-dev-impossible {
				border-color: rgba(251, 113, 133, 0.52);
				color: #fb7185;
			}

			#${PANEL_ID} .tsg-dev-grid {
				display: grid;
				grid-template-columns: minmax(46px, 0.62fr) repeat(3, minmax(72px, 1fr));
				gap: 1px;
				overflow: hidden;
				border: 1px solid #2a3447;
				border-radius: 6px;
				background: #2a3447;
			}

			#${PANEL_ID} .tsg-dev-cell {
				min-width: 0;
				padding: 7px 8px;
				background: rgba(10, 13, 20, 0.98);
				color: #e6e8ee;
				font-variant-numeric: tabular-nums;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			#${PANEL_ID} .tsg-dev-head {
				color: #9ca3af;
				font-size: 11px;
				font-weight: 700;
				text-transform: uppercase;
			}

			#${PANEL_ID} .tsg-dev-stat {
				color: #6ee7b7;
				font-weight: 800;
			}

			#${PANEL_ID} .tsg-dev-current {
				color: #fb923c;
				font-weight: 700;
			}

			#${PANEL_ID} .tsg-dev-required {
				color: #fbbf24;
				font-weight: 700;
			}

			#${PANEL_ID} .tsg-dev-allowed {
				color: #6ee7b7;
				font-weight: 700;
			}

			#${PANEL_ID} .tsg-dev-locked-section {
				margin-top: 10px;
			}

			#${PANEL_ID} .tsg-dev-section-title {
				margin: 0 0 6px;
				color: #e6e8ee;
				font-size: 12px;
				font-weight: 800;
			}

			#${PANEL_ID} .tsg-dev-locked-list {
				display: grid;
				gap: 6px;
			}

			#${PANEL_ID} .tsg-dev-locked-row {
				display: grid;
				grid-template-columns: minmax(140px, 1.1fr) minmax(160px, 1.4fr) auto minmax(110px, 0.8fr);
				gap: 8px;
				align-items: center;
				padding: 7px 8px;
				border: 1px solid #2a3447;
				border-radius: 6px;
				background: rgba(10, 13, 20, 0.98);
			}

			#${PANEL_ID} .tsg-dev-locked-name {
				min-width: 0;
				color: #e6e8ee;
				font-weight: 800;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			#${PANEL_ID} .tsg-dev-stage {
				margin-left: 5px;
				color: #9ca3af;
				font-size: 10px;
				font-weight: 800;
			}

			#${PANEL_ID} .tsg-dev-ratings,
			#${PANEL_ID} .tsg-dev-energy,
			#${PANEL_ID} .tsg-dev-shortfall {
				color: #9ca3af;
				font-variant-numeric: tabular-nums;
			}

			#${PANEL_ID} .tsg-dev-shortfall {
				color: #fbbf24;
				font-weight: 800;
				text-align: right;
			}

			@media (max-width: 520px) {
				#${PANEL_ID} {
					width: 100%;
					padding: 8px;
				}

				#${PANEL_ID} .tsg-dev-controls {
					grid-template-columns: 1fr;
				}

				#${PANEL_ID} .tsg-dev-grid {
					grid-template-columns: 42px repeat(3, minmax(58px, 1fr));
				}

				#${PANEL_ID} .tsg-dev-cell {
					padding: 6px 5px;
					font-size: 11px;
				}

				#${PANEL_ID} .tsg-dev-locked-row {
					grid-template-columns: 1fr;
					gap: 4px;
				}

				#${PANEL_ID} .tsg-dev-shortfall {
					text-align: left;
				}
			}
		`;
		document.head.appendChild(style);
	}

	function createSpecialistSelect(storageKey) {
		const select = document.createElement("select");

		[
			{ value: NONE, description: "None" },
			...Object.values(SPECIAL_GYM).map((specialGym) => ({
				value: specialGym,
				description: specialGymDescMap[specialGym],
			})),
		].forEach((optionData) => {
			const option = document.createElement("option");
			option.value = optionData.value;
			option.textContent = optionData.description;
			select.appendChild(option);
		});

		select.value = getStoredSelection(storageKey);
		select.addEventListener("change", () => {
			select.value = safeSelection(select.value);
			localStorage.setItem(storageKey, select.value);
			updatePanel();
		});

		return select;
	}

	function createAutoSwitchControl() {
		const label = createElement("label", "tsg-dev-autoswitch");
		autoSwitchCheckboxElement = document.createElement("input");
		autoSwitchCheckboxElement.type = "checkbox";
		autoSwitchCheckboxElement.checked = getStoredAutoSwitchEnabled();
		autoSwitchCheckboxElement.addEventListener("change", () => {
			localStorage.setItem(AUTO_SWITCH_STORAGE_KEY, autoSwitchCheckboxElement.checked ? "1" : "0");
			syncAutoSwitchHook();
			updatePanel();
		});

		label.append(autoSwitchCheckboxElement, createElement("span", "", "Auto-switch to best gym before training"));
		return label;
	}

	function createPanel() {
		if (panelElement) {
			return panelElement;
		}

		panelElement = createElement("section");
		panelElement.id = PANEL_ID;
		panelElement.dataset.version = SCRIPT_VERSION;

		const top = createElement("div", "tsg-dev-top");
		const title = createElement("div", "tsg-dev-title", "Specialist Gyms");
		title.appendChild(createElement("span", "tsg-dev-badge", "(DEV)"));
		const version = createElement("div", "tsg-dev-version", `v${SCRIPT_VERSION}`);
		top.append(title, version);

		const controls = createElement("div", "tsg-dev-controls");
		const fieldOne = createElement("label", "tsg-dev-field");
		fieldOne.appendChild(createElement("span", "tsg-dev-label", "Gym 1"));
		selectOneElement = createSpecialistSelect(STORAGE_KEY_ONE);
		fieldOne.appendChild(selectOneElement);

		const fieldTwo = createElement("label", "tsg-dev-field");
		fieldTwo.appendChild(createElement("span", "tsg-dev-label", "Gym 2"));
		selectTwoElement = createSpecialistSelect(STORAGE_KEY_TWO);
		fieldTwo.appendChild(selectTwoElement);

		controls.append(fieldOne, fieldTwo);
		const autoSwitchControl = createAutoSwitchControl();
		resultsElement = createElement("div", "tsg-dev-results");

		panelElement.append(top, controls, autoSwitchControl, resultsElement);
		syncAutoSwitchHook();
		return panelElement;
	}

	function getStatSelector(statName) {
		return `${GYM_CONTENT_SELECTOR} [class*="${statName.toLowerCase()}___"] [class*="propertyTitle___"] [class*="propertyValue___"]`;
	}

	function getStatElements() {
		return toRecord(Object.values(BATTLE_STAT), (statName) => [statName, document.querySelector(getStatSelector(statName))]);
	}

	function readStats() {
		const stats = {};

		for (const statName of Object.values(BATTLE_STAT)) {
			const element = statElementsMap[statName];
			const value = parseInt((element?.textContent || "").replace(/,/g, ""), 10);

			if (!Number.isFinite(value)) {
				return null;
			}

			stats[statName] = value;
		}

		return stats;
	}

	function appendCell(parent, className, text) {
		parent.appendChild(createElement("div", `tsg-dev-cell ${className}`, text));
	}

	function appendLockedGymsSection(stats) {
		const lockedGyms = getLockedGymRows(stats);

		if (!lockedGyms.length) {
			return;
		}

		const section = createElement("section", "tsg-dev-locked-section");
		section.appendChild(createElement("h3", "tsg-dev-section-title", "Locked gyms"));

		const list = createElement("div", "tsg-dev-locked-list");

		lockedGyms.forEach(({ gym, shortfall }) => {
			const row = createElement("div", "tsg-dev-locked-row");
			const name = createElement("div", "tsg-dev-locked-name", gym.name);
			name.appendChild(createElement("span", "tsg-dev-stage", `S${gym.stage}`));
			row.appendChild(name);
			row.appendChild(createElement("div", "tsg-dev-ratings", getGymRatingsText(gym)));
			row.appendChild(createElement("div", "tsg-dev-energy", `E${gym.energy}`));
			row.appendChild(createElement(
				"div",
				"tsg-dev-shortfall",
				shortfall ? `+${formatCompactNumber(shortfall.amount)} ${shortfall.label} to unlock` : "locked",
			));
			list.appendChild(row);
		});

		section.appendChild(list);
		resultsElement.appendChild(section);
	}

	function renderMessage(text, className, stats) {
		resultsElement.textContent = "";
		resultsElement.appendChild(createElement("div", `tsg-dev-message ${className || ""}`.trim(), text));

		if (stats) {
			appendLockedGymsSection(stats);
		}
	}

	function renderSuccess(stats, result) {
		resultsElement.textContent = "";

		const grid = createElement("div", "tsg-dev-grid");
		grid.setAttribute("role", "table");
		grid.setAttribute("aria-label", "Specialist gym stat thresholds");

		appendCell(grid, "tsg-dev-head", "Stat");
		appendCell(grid, "tsg-dev-head", "Current");
		appendCell(grid, "tsg-dev-head", "Required");
		appendCell(grid, "tsg-dev-head", "Allowed");

		Object.values(BATTLE_STAT).forEach((statName) => {
			appendCell(grid, "tsg-dev-stat", STAT_ABBR[statName]);
			appendCell(grid, "tsg-dev-current", formatNumber(stats[statName]));
			appendCell(grid, "tsg-dev-required", formatNumber(result.missing[statName]));
			appendCell(grid, "tsg-dev-allowed", formatNumber(result.missing[statName] + result.available[statName]));
		});

		resultsElement.appendChild(grid);
		appendLockedGymsSection(stats);
	}

	function updatePanel() {
		if (!resultsElement) {
			return;
		}

		const stats = readStats();

		if (!stats) {
			renderMessage("Waiting for Torn stat values", "");
			return;
		}

		const result = calculateSpecialGymsData(stats, safeSelection(selectOneElement.value), safeSelection(selectTwoElement.value));

		if (result.type === NONE) {
			renderMessage("No specialist gyms selected", "", stats);
		} else if (result.type === "impossible") {
			renderMessage("This combination is impossible", "tsg-dev-impossible", stats);
		} else {
			renderSuccess(stats, result);
		}
	}

	function insertPanel(gymContent) {
		const panel = createPanel();

		if (panel.isConnected) {
			return;
		}

		const gymRoot = document.querySelector("#gymroot");
		const anchor = gymRoot || gymContent;

		if (anchor) {
			anchor.insertAdjacentElement("afterend", panel);
		}
	}

	function disconnectStatObservers() {
		statObservers.forEach((observer) => observer.disconnect());
		statObservers = [];
	}

	function sameStatElements(nextStatElementsMap) {
		return Object.values(BATTLE_STAT).every((statName) => statElementsMap[statName] === nextStatElementsMap[statName]);
	}

	function watchStatElements(nextStatElementsMap) {
		if (sameStatElements(nextStatElementsMap)) {
			return;
		}

		disconnectStatObservers();
		statElementsMap = nextStatElementsMap;

		Object.values(BATTLE_STAT).forEach((statName) => {
			const observer = new MutationObserver(updatePanel);
			observer.observe(statElementsMap[statName], { characterData: true, childList: true, subtree: true });
			statObservers.push(observer);
		});
	}

	// v0.1.1: once the panel is mounted and stat-element MutationObservers
	// are attached, those observers handle all subsequent updates. The
	// page-wide observer is only needed to detect the initial gym render
	// (Torn lazy-renders /gym.php). Re-running tryMount on every body
	// mutation caused an infinite update→re-render→observe loop that
	// froze the page on PDA WebView.
	let mounted = false;

	function tryMount() {
		if (mounted) return;
		const gymContent = document.querySelector(GYM_CONTENT_SELECTOR);
		if (!gymContent) return;

		const nextStatElementsMap = getStatElements();
		const hasAllStats = Object.values(BATTLE_STAT).every((statName) => nextStatElementsMap[statName]);
		if (!hasAllStats) return;

		insertPanel(gymContent);
		watchStatElements(nextStatElementsMap);
		updatePanel();
		mounted = true;
		if (pageObserver) {
			pageObserver.disconnect();
			pageObserver = null;
		}
	}

	function start() {
		injectStyles();
		syncAutoSwitchHook();
		tryMount();
		if (mounted) return;

		// Debounce: PDA fires hundreds of mutations during gym tab render;
		// without throttling we'd hammer tryMount and re-trigger ourselves.
		let debounceT = null;
		pageObserver = new MutationObserver(() => {
			if (debounceT) return;
			debounceT = setTimeout(() => { debounceT = null; tryMount(); }, 250);
		});
		pageObserver.observe(document.body, { childList: true, subtree: true });
	}

	if (document.body) {
		start();
	} else {
		document.addEventListener("DOMContentLoaded", start, { once: true });
	}
})();
