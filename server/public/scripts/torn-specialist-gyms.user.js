// ==UserScript==
// @name         Torn Specialist Gyms
// @namespace    tornwar.com
// @version      0.1.1
// @description  Shows Required / Allowed stat thresholds for Torn specialist gyms (Balboas, Frontline, Gym 3000, Isoyamas, Rebound, Elites). Math ported verbatim from TornTools. v0.1.1: fix infinite-render loop that froze the PDA gym page.
// @author       warboard
// @match        https://www.torn.com/gym.php*
// @match        https://pda.torn.com/gym.php*
// @downloadURL  https://tornwar.com/scripts/torn-specialist-gyms.user.js
// @updateURL    https://tornwar.com/scripts/torn-specialist-gyms.meta.js
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function() {
	"use strict";

	const SCRIPT_VERSION = "0.1.1";
	const NONE = "none";
	const STORAGE_KEY_ONE = "tsg_specialist_1";
	const STORAGE_KEY_TWO = "tsg_specialist_2";
	const PANEL_ID = "tsg-specialist-panel";
	const STYLE_ID = "tsg-specialist-style";
	const GYM_CONTENT_SELECTOR = '[class*="gymContent___"]';

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

	const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

	let panelElement;
	let resultsElement;
	let selectOneElement;
	let selectTwoElement;
	let pageObserver;
	let statObservers = [];
	let statElementsMap = {};

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

			#${PANEL_ID} .tsg-top {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: 8px;
				padding-bottom: 8px;
				border-bottom: 1px solid rgba(42, 52, 71, 0.8);
			}

			#${PANEL_ID} .tsg-title {
				display: flex;
				align-items: center;
				gap: 8px;
				min-width: 0;
				font-weight: 700;
				letter-spacing: 0;
				color: #e6e8ee;
			}

			#${PANEL_ID} .tsg-title::before {
				content: "";
				width: 6px;
				height: 18px;
				border-radius: 999px;
				background: #6ee7b7;
				box-shadow: 0 0 14px rgba(110, 231, 183, 0.45);
				flex: 0 0 auto;
			}

			#${PANEL_ID} .tsg-version {
				color: #9ca3af;
				font-size: 11px;
				white-space: nowrap;
			}

			#${PANEL_ID} .tsg-controls {
				display: grid;
				grid-template-columns: repeat(2, minmax(0, 1fr));
				gap: 8px;
				margin: 10px 0;
			}

			#${PANEL_ID} .tsg-field {
				display: grid;
				gap: 4px;
				min-width: 0;
			}

			#${PANEL_ID} .tsg-label {
				color: #9ca3af;
				font-size: 11px;
				font-weight: 700;
				text-transform: uppercase;
				letter-spacing: 0;
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

			#${PANEL_ID} .tsg-message {
				padding: 10px;
				border: 1px solid #2a3447;
				border-radius: 6px;
				background: rgba(20, 26, 38, 0.72);
				color: #9ca3af;
				font-weight: 700;
			}

			#${PANEL_ID} .tsg-message.tsg-impossible {
				border-color: rgba(251, 113, 133, 0.52);
				color: #fb7185;
			}

			#${PANEL_ID} .tsg-grid {
				display: grid;
				grid-template-columns: minmax(46px, 0.62fr) repeat(3, minmax(72px, 1fr));
				gap: 1px;
				overflow: hidden;
				border: 1px solid #2a3447;
				border-radius: 6px;
				background: #2a3447;
			}

			#${PANEL_ID} .tsg-cell {
				min-width: 0;
				padding: 7px 8px;
				background: rgba(10, 13, 20, 0.98);
				color: #e6e8ee;
				font-variant-numeric: tabular-nums;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			#${PANEL_ID} .tsg-head {
				color: #9ca3af;
				font-size: 11px;
				font-weight: 700;
				text-transform: uppercase;
			}

			#${PANEL_ID} .tsg-stat {
				color: #6ee7b7;
				font-weight: 800;
			}

			#${PANEL_ID} .tsg-current {
				color: #fb923c;
				font-weight: 700;
			}

			#${PANEL_ID} .tsg-required {
				color: #fbbf24;
				font-weight: 700;
			}

			#${PANEL_ID} .tsg-allowed {
				color: #6ee7b7;
				font-weight: 700;
			}

			@media (max-width: 520px) {
				#${PANEL_ID} {
					width: 100%;
					padding: 8px;
				}

				#${PANEL_ID} .tsg-controls {
					grid-template-columns: 1fr;
				}

				#${PANEL_ID} .tsg-grid {
					grid-template-columns: 42px repeat(3, minmax(58px, 1fr));
				}

				#${PANEL_ID} .tsg-cell {
					padding: 6px 5px;
					font-size: 11px;
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

	function createPanel() {
		if (panelElement) {
			return panelElement;
		}

		panelElement = createElement("section");
		panelElement.id = PANEL_ID;
		panelElement.dataset.version = SCRIPT_VERSION;

		const top = createElement("div", "tsg-top");
		const title = createElement("div", "tsg-title", "Specialist Gyms");
		const version = createElement("div", "tsg-version", `v${SCRIPT_VERSION}`);
		top.append(title, version);

		const controls = createElement("div", "tsg-controls");
		const fieldOne = createElement("label", "tsg-field");
		fieldOne.appendChild(createElement("span", "tsg-label", "Gym 1"));
		selectOneElement = createSpecialistSelect(STORAGE_KEY_ONE);
		fieldOne.appendChild(selectOneElement);

		const fieldTwo = createElement("label", "tsg-field");
		fieldTwo.appendChild(createElement("span", "tsg-label", "Gym 2"));
		selectTwoElement = createSpecialistSelect(STORAGE_KEY_TWO);
		fieldTwo.appendChild(selectTwoElement);

		controls.append(fieldOne, fieldTwo);
		resultsElement = createElement("div", "tsg-results");

		panelElement.append(top, controls, resultsElement);
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
		parent.appendChild(createElement("div", `tsg-cell ${className}`, text));
	}

	function renderMessage(text, className) {
		resultsElement.textContent = "";
		resultsElement.appendChild(createElement("div", `tsg-message ${className || ""}`.trim(), text));
	}

	function renderSuccess(stats, result) {
		resultsElement.textContent = "";

		const grid = createElement("div", "tsg-grid");
		grid.setAttribute("role", "table");
		grid.setAttribute("aria-label", "Specialist gym stat thresholds");

		appendCell(grid, "tsg-head", "Stat");
		appendCell(grid, "tsg-head", "Current");
		appendCell(grid, "tsg-head", "Required");
		appendCell(grid, "tsg-head", "Allowed");

		Object.values(BATTLE_STAT).forEach((statName) => {
			appendCell(grid, "tsg-stat", STAT_ABBR[statName]);
			appendCell(grid, "tsg-current", formatNumber(stats[statName]));
			appendCell(grid, "tsg-required", formatNumber(result.missing[statName]));
			appendCell(grid, "tsg-allowed", formatNumber(result.missing[statName] + result.available[statName]));
		});

		resultsElement.appendChild(grid);
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
			renderMessage("No specialist gyms selected", "");
		} else if (result.type === "impossible") {
			renderMessage("This combination is impossible", "tsg-impossible");
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
