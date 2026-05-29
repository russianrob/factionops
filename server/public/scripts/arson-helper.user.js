// ==UserScript==
// @name         Torn Arson Helper
// @namespace    tornwar.com
// @version      1.2
// @description  Contextual tooltips for Arson crime materials, job requirements, and unique targets. Touch/PDA tap-to-toggle (hover never fires on a touchscreen) + tornwar.com auto-update. Original by PedroXimenez.
// @author       PedroXimenez
// @match        https://*.torn.com/page.php?sid=crimes*
// @license      MIT
// @grant        none
// @downloadURL  https://tornwar.com/scripts/arson-helper.user.js
// @updateURL    https://tornwar.com/scripts/arson-helper.meta.js
// ==/UserScript==

(function () {
    'use strict';

    // ── Data from cite.json ──────────────────────────────────────────────

    const ACCELERANTS = {
        "Gasoline": {
                "type": "Liquid",
                "intensity": "5%",
                "intensity_abs": 1.5,
                "momentum": "HIGH",
                "momentum_abs": 6,
                "spread": "37.5%",
                "ignition_risk": 1,
                "stoking_risk": 7,
                "suspicion": 9,
                "advice": "Use up to 1+Number of areas (max 6). Cheap but risky when stoking."
        },
        "Diesel": {
                "type": "Liquid",
                "intensity": "5.25%",
                "intensity_abs": 2,
                "momentum": "HIGH",
                "momentum_abs": 5,
                "spread": "16%",
                "ignition_risk": 0,
                "stoking_risk": 1,
                "suspicion": 7,
                "advice": "Lowers crit-rate on ignition, increases visibility. Best combined with solids."
        },
        "Kerosene": {
                "type": "Liquid",
                "intensity": "5.25%",
                "intensity_abs": 2,
                "momentum": "BEST",
                "momentum_abs": 10,
                "spread": "25%",
                "ignition_risk": 1,
                "stoking_risk": 3,
                "suspicion": 3,
                "advice": "Great as starter, insurance jobs, and small fires. Increases momentum in single area."
        },
        "Saltpetre": {
                "type": "Solid",
                "intensity": "31.25%",
                "intensity_abs": 10,
                "momentum": "HIGH",
                "momentum_abs": 6,
                "spread": "0%",
                "ignition_risk": 3,
                "stoking_risk": 1,
                "suspicion": 3,
                "advice": "Increases intensity by 25% of current intensity in single area."
        },
        "Magnesium": {
                "type": "Solid",
                "intensity": "27.5%",
                "intensity_abs": 8,
                "momentum": "HIGH",
                "momentum_abs": 6,
                "spread": "0%",
                "ignition_risk": 3,
                "stoking_risk": 4,
                "suspicion": 10,
                "advice": "Halves dampening effectiveness and intensity decay from firefighters. Increases visibility."
        },
        "Thermite": {
                "type": "Solid",
                "intensity": "22.5%",
                "intensity_abs": 7,
                "momentum": "MID",
                "momentum_abs": 4,
                "spread": "0%",
                "ignition_risk": 3,
                "stoking_risk": 7,
                "suspicion": 7,
                "advice": "Best as starter for total destruction. Multiplies damage rate for each use."
        },
        "Oxygen": {
                "type": "Gaseous",
                "intensity": "20%",
                "intensity_abs": 6,
                "momentum": "LOW",
                "momentum_abs": 2,
                "spread": "65%",
                "ignition_risk": 2,
                "stoking_risk": 1,
                "suspicion": 1,
                "advice": "Terrible starter, excellent for stoking size 4-5. Increases intensity by 25% of current in all areas."
        },
        "Methane": {
                "type": "Gaseous",
                "intensity": "15.6%",
                "intensity_abs": 4,
                "momentum": "LOW",
                "momentum_abs": 1,
                "spread": "84%",
                "ignition_risk": 2,
                "stoking_risk": 3,
                "suspicion": -3,
                "advice": "Excellent spread for large targets. Lowers accumulated suspicion."
        },
        "Hydrogen": {
                "type": "Gaseous",
                "intensity": "14%",
                "intensity_abs": 4,
                "momentum": "LOW",
                "momentum_abs": 1,
                "spread": "100%",
                "ignition_risk": 2,
                "stoking_risk": 3,
                "suspicion": 1,
                "advice": "Averages intensity and momentum across all areas. Best for size 3-5 targets."
        }
};

    const IGNITERS = {
        "Lighter": {
                "suspicion": 1,
                "advice": "Standard igniter. Provides 2.5% intensity when stoking."
        },
        "Molotov": {
                "suspicion": 6,
                "advice": "Moderately high intensity/momentum to area with lowest intensity. Fixed crit rate."
        },
        "Windproof Lighter": {
                "suspicion": 1,
                "advice": "Enhanced lighter. Same base stats as Lighter but works in adverse conditions."
        },
        "Flamethrower": {
                "suspicion": 8,
                "advice": "High intensity/momentum randomly across areas. Riskiest ignition choice."
        }
};

    const DAMPENERS = {
        "Blanket": {
                "effect": "-25% Intensity",
                "advice": "High crit rate (approx 1 in 5). dangerous at low skill."
        },
        "Sand": {
                "effect": "Negative momentum",
                "advice": "Unlocked at CS60. Effective for controlled burns."
        },
        "Fire Extinguisher": {
                "effect": "Negative momentum",
                "advice": "Unlocked at CS90. Safer and as effective as sand."
        }
};

    const BUILDINGS = {
        "Bazaar": {
                "areas": 1,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 4
        },
        "Beach Hut": {
                "areas": 1,
                "response_time": 120,
                "rurality": 3,
                "dps": "2/s",
                "flammability": 5,
                "urgency": 1
        },
        "Firework Store": {
                "areas": 1,
                "response_time": 60,
                "rurality": 2,
                "dps": null,
                "flammability": -1,
                "urgency": null
        },
        "Fishing Hut": {
                "areas": 1,
                "response_time": 480,
                "rurality": 5,
                "dps": "2/s",
                "flammability": 5,
                "urgency": 1
        },
        "Forgery Workshop": {
                "areas": 1,
                "response_time": 480,
                "rurality": 5,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 1
        },
        "Hunting Lodge": {
                "areas": 1,
                "response_time": 480,
                "rurality": 5,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 1
        },
        "Lifeguard Hut": {
                "areas": 1,
                "response_time": 120,
                "rurality": 3,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 2
        },
        "Mobile Home": {
                "areas": 1,
                "response_time": 120,
                "rurality": 3,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 2
        },
        "Restroom": {
                "areas": 1,
                "response_time": 120,
                "rurality": 3,
                "dps": "0.4/s",
                "flammability": 1,
                "urgency": 6
        },
        "Self Storage Container": {
                "areas": 1,
                "response_time": 240,
                "rurality": 4,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 1
        },
        "Shack": {
                "areas": 1,
                "response_time": 240,
                "rurality": 4,
                "dps": "2/s",
                "flammability": 5,
                "urgency": 1
        },
        "Tool Shed": {
                "areas": 1,
                "response_time": 120,
                "rurality": 3,
                "dps": "2/s",
                "flammability": 5,
                "urgency": 1
        },
        "Yurt": {
                "areas": 1,
                "response_time": 120,
                "rurality": 3,
                "dps": "2/s",
                "flammability": 5,
                "urgency": 1
        },
        "Adult Store": {
                "areas": 2,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 5
        },
        "Apartment": {
                "areas": 2,
                "response_time": 30,
                "rurality": 1,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 5
        },
        "Arcade": {
                "areas": 2,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 4
        },
        "Barbershop": {
                "areas": 2,
                "response_time": 60,
                "rurality": 2,
                "dps": "0.8/s",
                "flammability": 2,
                "urgency": 6
        },
        "Bookies": {
                "areas": 2,
                "response_time": 30,
                "rurality": 1,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 5
        },
        "Bordello": {
                "areas": 2,
                "response_time": 120,
                "rurality": 3,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 2
        },
        "Bungalow": {
                "areas": 2,
                "response_time": 120,
                "rurality": 3,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 2
        },
        "Cafe": {
                "areas": 2,
                "response_time": 120,
                "rurality": 3,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 2
        },
        "Candle Shop": {
                "areas": 2,
                "response_time": 60,
                "rurality": 2,
                "dps": "2/s",
                "flammability": 5,
                "urgency": 3
        },
        "Chiropractors Office": {
                "areas": 2,
                "response_time": 60,
                "rurality": 2,
                "dps": "0.8/s",
                "flammability": 2,
                "urgency": 6
        },
        "Cleaning Agency": {
                "areas": 2,
                "response_time": 120,
                "rurality": 3,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 2
        },
        "Clock Tower": {
                "areas": 2,
                "response_time": 30,
                "rurality": 1,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 5
        },
        "Clothing Store": {
                "areas": 2,
                "response_time": 30,
                "rurality": 1,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 5
        },
        "Community Center": {
                "areas": 2,
                "response_time": 30,
                "rurality": 1,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 5
        },
        "Cottage": {
                "areas": 2,
                "response_time": 240,
                "rurality": 4,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 1
        },
        "Cyber Cafe": {
                "areas": 2,
                "response_time": 30,
                "rurality": 1,
                "dps": "0.8/s",
                "flammability": 2,
                "urgency": 6
        },
        "Dental Surgery": {
                "areas": 2,
                "response_time": 60,
                "rurality": 2,
                "dps": null,
                "flammability": -1,
                "urgency": null
        },
        "Detective Agency": {
                "areas": 2,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 5
        },
        "Diner": {
                "areas": 2,
                "response_time": 240,
                "rurality": 4,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 1
        },
        "Drugs Lab": {
                "areas": 2,
                "response_time": 120,
                "rurality": 3,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 2
        },
        "Flower Shop": {
                "areas": 2,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 5
        },
        "Funeral Parlor": {
                "areas": 2,
                "response_time": 120,
                "rurality": 3,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 2
        },
        "Game Shop": {
                "areas": 2,
                "response_time": 60,
                "rurality": 2,
                "dps": "0.8/s",
                "flammability": 2,
                "urgency": 6
        },
        "Gas Station": {
                "areas": 2,
                "response_time": 60,
                "rurality": 2,
                "dps": "2/s",
                "flammability": 5,
                "urgency": 3
        },
        "Hair Salon": {
                "areas": 2,
                "response_time": 60,
                "rurality": 2,
                "dps": "0.8/s",
                "flammability": 2,
                "urgency": 6
        },
        "Hardware Store": {
                "areas": 2,
                "response_time": 120,
                "rurality": 3,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 2
        },
        "Homeless Camp": {
                "areas": 2,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 4
        },
        "Jewelry Store": {
                "areas": 2,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 5
        },
        "Lingerie Store": {
                "areas": 2,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 5
        },
        "Liquor Store": {
                "areas": 2,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 4
        },
        "Loanshark Office": {
                "areas": 2,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 5
        },
        "Mechanic Shop": {
                "areas": 2,
                "response_time": 120,
                "rurality": 3,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 2
        },
        "Music Store": {
                "areas": 2,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 5
        },
        "Pharmacy": {
                "areas": 2,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 5
        },
        "Police Safehouse": {
                "areas": 2,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 5
        },
        "Printing Store": {
                "areas": 2,
                "response_time": 60,
                "rurality": 2,
                "dps": "2/s",
                "flammability": 5,
                "urgency": 3
        },
        "Suburban Home": {
                "areas": 2,
                "response_time": 120,
                "rurality": 3,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 2
        },
        "Tattoo Parlor": {
                "areas": 2,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 4
        },
        "Toy Shop": {
                "areas": 2,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 4
        },
        "Travel Agent": {
                "areas": 2,
                "response_time": 30,
                "rurality": 1,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 5
        },
        "Art Gallery": {
                "areas": 3,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 4
        },
        "Bank": {
                "areas": 3,
                "response_time": 30,
                "rurality": 1,
                "dps": "0.8/s",
                "flammability": 2,
                "urgency": 6
        },
        "Barn": {
                "areas": 3,
                "response_time": 0,
                "rurality": -1,
                "dps": null,
                "flammability": -1,
                "urgency": null
        },
        "Bowling Alley": {
                "areas": 3,
                "response_time": 30,
                "rurality": 1,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 5
        },
        "Car Showroom": {
                "areas": 3,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 4
        },
        "Car Wash": {
                "areas": 3,
                "response_time": 120,
                "rurality": 3,
                "dps": "0.8/s",
                "flammability": 2,
                "urgency": 4
        },
        "Cinema": {
                "areas": 3,
                "response_time": 30,
                "rurality": 1,
                "dps": "2/s",
                "flammability": 5,
                "urgency": 5
        },
        "Distillery": {
                "areas": 3,
                "response_time": 240,
                "rurality": 4,
                "dps": "2/s",
                "flammability": 5,
                "urgency": 1
        },
        "Farmhouse": {
                "areas": 3,
                "response_time": 480,
                "rurality": 5,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 1
        },
        "Fire Station": {
                "areas": 3,
                "response_time": 60,
                "rurality": 2,
                "dps": "0.4/s",
                "flammability": 1,
                "urgency": 6
        },
        "Furniture Store": {
                "areas": 3,
                "response_time": 120,
                "rurality": 3,
                "dps": "2/s",
                "flammability": 5,
                "urgency": 1
        },
        "Grocery Store": {
                "areas": 3,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 5
        },
        "Gym": {
                "areas": 3,
                "response_time": 30,
                "rurality": 1,
                "dps": "0.8/s",
                "flammability": 2,
                "urgency": 6
        },
        "Laboratory": {
                "areas": 3,
                "response_time": 480,
                "rurality": 5,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 1
        },
        "Lakehouse": {
                "areas": 3,
                "response_time": 240,
                "rurality": 4,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 1
        },
        "Law Firm": {
                "areas": 3,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 5
        },
        "Library": {
                "areas": 3,
                "response_time": 120,
                "rurality": 3,
                "dps": "2/s",
                "flammability": 5,
                "urgency": 1
        },
        "Medical Center": {
                "areas": 3,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 5
        },
        "Motorcycle Club": {
                "areas": 3,
                "response_time": 240,
                "rurality": 4,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 1
        },
        "Newspaper Office": {
                "areas": 3,
                "response_time": 30,
                "rurality": 1,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 5
        },
        "Nightclub": {
                "areas": 3,
                "response_time": 30,
                "rurality": 1,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 5
        },
        "Office Block": {
                "areas": 3,
                "response_time": 30,
                "rurality": 1,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 5
        },
        "Penthouse": {
                "areas": 3,
                "response_time": 30,
                "rurality": 1,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 5
        },
        "Pest Control Hub": {
                "areas": 3,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 4
        },
        "Police Station": {
                "areas": 3,
                "response_time": 30,
                "rurality": 1,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 5
        },
        "Private Security": {
                "areas": 3,
                "response_time": 60,
                "rurality": 2,
                "dps": "0.8/s",
                "flammability": 2,
                "urgency": 6
        },
        "Pub": {
                "areas": 3,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 4
        },
        "Recording Studio": {
                "areas": 3,
                "response_time": 240,
                "rurality": 4,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 1
        },
        "Restaurant": {
                "areas": 3,
                "response_time": 30,
                "rurality": 1,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 5
        },
        "Strip Club": {
                "areas": 3,
                "response_time": 30,
                "rurality": 1,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 5
        },
        "Subway": {
                "areas": 3,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 5
        },
        "Townhouse": {
                "areas": 3,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 5
        },
        "Ad Agency": {
                "areas": 4,
                "response_time": 30,
                "rurality": 1,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 5
        },
        "Arms Warehouse": {
                "areas": 4,
                "response_time": 240,
                "rurality": 4,
                "dps": "2/s",
                "flammability": 5,
                "urgency": 1
        },
        "Bus Terminal": {
                "areas": 4,
                "response_time": 30,
                "rurality": 1,
                "dps": "0.8/s",
                "flammability": 2,
                "urgency": 6
        },
        "Chemical Plant": {
                "areas": 4,
                "response_time": 480,
                "rurality": 5,
                "dps": "2/s",
                "flammability": 5,
                "urgency": 1
        },
        "Church": {
                "areas": 4,
                "response_time": 120,
                "rurality": 3,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 2
        },
        "College": {
                "areas": 4,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 5
        },
        "Fertilizer Plant": {
                "areas": 4,
                "response_time": 480,
                "rurality": 5,
                "dps": "2/s",
                "flammability": 5,
                "urgency": 1
        },
        "Hotel": {
                "areas": 4,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 4
        },
        "Luxury Villa": {
                "areas": 4,
                "response_time": 240,
                "rurality": 4,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 1
        },
        "Manor House": {
                "areas": 4,
                "response_time": 240,
                "rurality": 4,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 1
        },
        "Paper Mill": {
                "areas": 4,
                "response_time": 240,
                "rurality": 4,
                "dps": "2/s",
                "flammability": 5,
                "urgency": 1
        },
        "Post Office": {
                "areas": 4,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 4
        },
        "Raceway": {
                "areas": 4,
                "response_time": 60,
                "rurality": 2,
                "dps": "2/s",
                "flammability": 5,
                "urgency": 3
        },
        "Ranch": {
                "areas": 4,
                "response_time": 480,
                "rurality": 5,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 1
        },
        "Recycling Facility": {
                "areas": 4,
                "response_time": 240,
                "rurality": 4,
                "dps": "2/s",
                "flammability": 5,
                "urgency": 1
        },
        "Slaughterhouse": {
                "areas": 4,
                "response_time": 240,
                "rurality": 4,
                "dps": "0.8/s",
                "flammability": 2,
                "urgency": 1
        },
        "Supermarket": {
                "areas": 4,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 4
        },
        "Theater": {
                "areas": 4,
                "response_time": 60,
                "rurality": 2,
                "dps": "2/s",
                "flammability": 5,
                "urgency": 3
        },
        "Warehouse": {
                "areas": 4,
                "response_time": 240,
                "rurality": 4,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 1
        },
        "Aircraft Hangar": {
                "areas": 5,
                "response_time": 480,
                "rurality": 5,
                "dps": "2/s",
                "flammability": 5,
                "urgency": 1
        },
        "Casino": {
                "areas": 5,
                "response_time": 30,
                "rurality": 1,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 5
        },
        "Castle": {
                "areas": 5,
                "response_time": 480,
                "rurality": 5,
                "dps": "0.8/s",
                "flammability": 2,
                "urgency": 1
        },
        "Cruise Line": {
                "areas": 5,
                "response_time": 30,
                "rurality": 1,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 5
        },
        "Data Center": {
                "areas": 5,
                "response_time": 480,
                "rurality": 5,
                "dps": "0.4/s",
                "flammability": 1,
                "urgency": 1
        },
        "Electrical Substation": {
                "areas": 5,
                "response_time": 240,
                "rurality": 4,
                "dps": "0.4/s",
                "flammability": 1,
                "urgency": 4
        },
        "Factory": {
                "areas": 5,
                "response_time": 240,
                "rurality": 4,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 1
        },
        "Foundry": {
                "areas": 5,
                "response_time": 240,
                "rurality": 4,
                "dps": "0.8/s",
                "flammability": 2,
                "urgency": 1
        },
        "Hospital": {
                "areas": 5,
                "response_time": 30,
                "rurality": 1,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 5
        },
        "Palace": {
                "areas": 5,
                "response_time": 480,
                "rurality": 5,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 1
        },
        "Shopping Mall": {
                "areas": 5,
                "response_time": 30,
                "rurality": 1,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 5
        },
        "Sports Arena": {
                "areas": 5,
                "response_time": 30,
                "rurality": 1,
                "dps": "1.6/s",
                "flammability": 4,
                "urgency": 5
        },
        "TV Studio": {
                "areas": 5,
                "response_time": 60,
                "rurality": 2,
                "dps": "1.2/s",
                "flammability": 3,
                "urgency": 5
        },
        "Waste Facility": {
                "areas": 5,
                "response_time": 480,
                "rurality": 5,
                "dps": "2/s",
                "flammability": 5,
                "urgency": 1
        }
};

    const JOBS = {
        "Smoke Out": {
                "location": "Shack",
                "reward": 20000,
                "evidence": null
        },
        "Cut to the Chase": {
                "location": "Shack",
                "reward": 90000,
                "evidence": null
        },
        "The Bad Samaritan": {
                "location": "Shack",
                "reward": 20000,
                "evidence": null
        },
        "Unpopular Mechanics": {
                "location": "Tool Shed",
                "reward": null,
                "evidence": null
        },
        "Eight Lives": {
                "location": "Tool Shed",
                "reward": 10000,
                "evidence": null
        },
        "Beach Bum": {
                "location": "Beach Hut",
                "reward": null,
                "evidence": null
        },
        "A Rash Decision": {
                "location": "Beach Hut",
                "reward": 19000,
                "evidence": null
        },
        "Naked Aggression": {
                "location": "Beach Hut",
                "reward": 20000,
                "evidence": null
        },
        "High Time": {
                "location": "Yurt",
                "reward": 10500,
                "evidence": null
        },
        "Smoke on the Water": {
                "location": "Fishing Hut",
                "reward": 10000,
                "evidence": null
        },
        "Bagged and Tagged": {
                "location": "Hunting Lodge",
                "reward": null,
                "evidence": null
        },
        "Hide and Seek": {
                "location": "Hunting Lodge",
                "reward": null,
                "evidence": null
        },
        "Pest Control": {
                "location": "Hunting Lodge",
                "reward": 40000,
                "evidence": null
        },
        "On Fire at the Box Office": {
                "location": "Hunting Lodge",
                "reward": null,
                "evidence": "Gaseous"
        },
        "Out With a Bang": {
                "location": "Mobile Home",
                "reward": 40000,
                "evidence": null
        },
        "Family Feud": {
                "location": "Mobile Home",
                "reward": null,
                "evidence": null
        },
        "Cooked and Burned": {
                "location": "Mobile Home",
                "reward": 50000,
                "evidence": "Ammonia"
        },
        "Hot Off the Press": {
                "location": "Mobile Home",
                "reward": null,
                "evidence": null
        },
        "Shielded From the Truth": {
                "location": "Forgery Workshop",
                "reward": null,
                "evidence": null
        },
        "Fire Sale": {
                "location": "Forgery Workshop",
                "reward": null,
                "evidence": null
        },
        "Smoldering Resentment": {
                "location": "Self Storage Container",
                "reward": 20000,
                "evidence": null
        },
        "Burned by Stupidity": {
                "location": "Self Storage Container",
                "reward": 68000,
                "evidence": null
        },
        "Bone of Contention": {
                "location": "Self Storage Container",
                "reward": null,
                "evidence": null
        },
        "Cooking the Books": {
                "location": "Drugs Lab",
                "reward": 40000,
                "evidence": null
        },
        "The Grass Ain't Greener": {
                "location": "Drugs Lab",
                "reward": 60000,
                "evidence": null
        },
        "For Closure": {
                "location": "Bungalow",
                "reward": 51000,
                "evidence": null
        },
        "That Place is History": {
                "location": "Bungalow",
                "reward": 80000,
                "evidence": null
        },
        "Burning Memory": {
                "location": "Bungalow",
                "reward": null,
                "evidence": null
        },
        "Open House": {
                "location": "Bungalow",
                "reward": null,
                "evidence": null
        },
        "Fan the Flames": {
                "location": "Cottage",
                "reward": null,
                "evidence": null
        },
        "A Hot Lead": {
                "location": "Cottage",
                "reward": 40000,
                "evidence": null
        },
        "Local Concerns": {
                "location": "Cottage",
                "reward": 40000,
                "evidence": null
        },
        "Dead Giveaway": {
                "location": "Cottage",
                "reward": 84000,
                "evidence": null
        },
        "Daddy's Girl": {
                "location": "Townhouse",
                "reward": null,
                "evidence": null
        },
        "A Problem Shared": {
                "location": "Townhouse",
                "reward": 125000,
                "evidence": null
        },
        "Loud and Clear": {
                "location": "Apartment",
                "reward": 125000,
                "evidence": null
        },
        "A Dirty Job": {
                "location": "Apartment",
                "reward": 74000,
                "evidence": null
        },
        "Burning Liability": {
                "location": "Apartment",
                "reward": null,
                "evidence": null
        },
        "Raze the Roof": {
                "location": "Apartment",
                "reward": null,
                "evidence": null
        },
        "Low Rent": {
                "location": "Apartment",
                "reward": null,
                "evidence": null
        },
        "Wet Behind the Ears": {
                "location": "Apartment",
                "reward": null,
                "evidence": null
        },
        "Hot Dog": {
                "location": "Apartment",
                "reward": null,
                "evidence": null
        },
        "Chasing Targets": {
                "location": "Suburban Home",
                "reward": 60000,
                "evidence": null
        },
        "Fight Fire With Fire": {
                "location": "Suburban Home",
                "reward": null,
                "evidence": null
        },
        "Cold Feet": {
                "location": "Suburban Home",
                "reward": 80000,
                "evidence": null
        },
        "Twisted Firestarter": {
                "location": "Suburban Home",
                "reward": 50000,
                "evidence": null
        },
        "In Your Debt": {
                "location": "Suburban Home",
                "reward": 130000,
                "evidence": null
        },
        "Political Firestorm": {
                "location": "Suburban Home",
                "reward": 55000,
                "evidence": null
        },
        "Heat the Rich": {
                "location": "Lakehouse",
                "reward": 70000,
                "evidence": null
        },
        "It's a Write Off": {
                "location": "Lakehouse",
                "reward": 145000,
                "evidence": null
        },
        "Burning Through Cash": {
                "location": "Lakehouse",
                "reward": null,
                "evidence": null
        },
        "Cleansed Through Fire": {
                "location": "Penthouse",
                "reward": null,
                "evidence": null
        },
        "Banking on It": {
                "location": "Penthouse",
                "reward": null,
                "evidence": "Stapler"
        },
        "Cut Corners": {
                "location": "Penthouse",
                "reward": null,
                "evidence": null
        },
        "Follow the Leader": {
                "location": "Luxury Villa",
                "reward": null,
                "evidence": "Gaseous"
        },
        "Cook it Rare": {
                "location": "Luxury Villa",
                "reward": null,
                "evidence": null
        },
        "Faction Fiction": {
                "location": "Luxury Villa",
                "reward": null,
                "evidence": null
        },
        "Off the Market": {
                "location": "Ranch",
                "reward": 145000,
                "evidence": null
        },
        "The Fire Chief": {
                "location": "Ranch",
                "reward": null,
                "evidence": null
        },
        "The Empyre Strikes Back": {
                "location": "Ranch",
                "reward": null,
                "evidence": null
        },
        "To the Manor Scorned": {
                "location": "Manor House",
                "reward": null,
                "evidence": null
        },
        "Kindling Spirits": {
                "location": "Manor House",
                "reward": 100000,
                "evidence": null
        },
        "Ash or Credit?": {
                "location": "Manor House",
                "reward": null,
                "evidence": null
        },
        "The Ashes of Empire": {
                "location": "Palace",
                "reward": null,
                "evidence": null
        },
        "Where There's a Will": {
                "location": "Castle",
                "reward": 120000,
                "evidence": null
        },
        "It Cuts Both Ways": {
                "location": "Barbershop",
                "reward": null,
                "evidence": null
        },
        "Hair Today...": {
                "location": "Hair Salon",
                "reward": null,
                "evidence": null
        },
        "Planted": {
                "location": "Flower Shop",
                "reward": null,
                "evidence": "Pele Charm"
        },
        "A Fungus Among Us": {
                "location": "Flower Shop",
                "reward": 58000,
                "evidence": null
        },
        "Point of No Return": {
                "location": "Travel Agent",
                "reward": 100000,
                "evidence": null
        },
        "The Plane Truth": {
                "location": "Travel Agent",
                "reward": null,
                "evidence": null
        },
        "Don't Hate the Player": {
                "location": "Game Shop",
                "reward": null,
                "evidence": null
        },
        "Second Hand Smoke": {
                "location": "Game Shop",
                "reward": null,
                "evidence": null
        },
        "Claim to Flame": {
                "location": "Adult Store",
                "reward": null,
                "evidence": null
        },
        "Oh God, Yes!": {
                "location": "Adult Store",
                "reward": null,
                "evidence": null
        },
        "The Male Gaze": {
                "location": "Lingerie Store",
                "reward": 90000,
                "evidence": null
        },
        "A Treat for the Tricked": {
                "location": "Candle Shop",
                "reward": 100000,
                "evidence": "Kabuki Mask"
        },
        "Rest in Peace": {
                "location": "Candle Shop",
                "reward": 30000,
                "evidence": null
        },
        "Child's Play": {
                "location": "Toy Shop",
                "reward": 44000,
                "evidence": null
        },
        "Blaze of Glory": {
                "location": "Toy Shop",
                "reward": 105000,
                "evidence": "Toothbrush"
        },
        "Crafty Devil": {
                "location": "Liquor Store",
                "reward": 83000,
                "evidence": null
        },
        "Cop Some Heat": {
                "location": "Liquor Store",
                "reward": 60000,
                "evidence": null
        },
        "Liquor on the Back Row": {
                "location": "Liquor Store",
                "reward": 50000,
                "evidence": null
        },
        "Swansong": {
                "location": "Music Store",
                "reward": null,
                "evidence": null
        },
        "The Savage Beast": {
                "location": "Music Store",
                "reward": 115000,
                "evidence": null
        },
        "Doxing Clever": {
                "location": "Cyber Cafe",
                "reward": null,
                "evidence": null
        },
        "Stink to High Heaven": {
                "location": "Cyber Cafe",
                "reward": null,
                "evidence": null
        },
        "Hot Pursuit": {
                "location": "Detective Agency",
                "reward": 70000,
                "evidence": null
        },
        "Turn up the Heat": {
                "location": "Detective Agency",
                "reward": null,
                "evidence": "Compass"
        },
        "A Black Mark": {
                "location": "Detective Agency",
                "reward": null,
                "evidence": null
        },
        "Back, Sack, and Crack": {
                "location": "Chiropractors Office",
                "reward": null,
                "evidence": null
        },
        "You're Fired!": {
                "location": "Law Firm",
                "reward": null,
                "evidence": "Lipstick"
        },
        "The Smoking Gun": {
                "location": "Law Firm",
                "reward": null,
                "evidence": null
        },
        "Under the Table": {
                "location": "Law Firm",
                "reward": null,
                "evidence": null
        },
        "Set 'Em Straight": {
                "location": "Ad Agency",
                "reward": null,
                "evidence": null
        },
        "From the Ashes": {
                "location": "Ad Agency",
                "reward": null,
                "evidence": null
        },
        "Gym'll Fix It": {
                "location": "Gym",
                "reward": null,
                "evidence": null
        },
        "Muscling In": {
                "location": "Gym",
                "reward": null,
                "evidence": "Syringe"
        },
        "Burning Calories": {
                "location": "Gym",
                "reward": null,
                "evidence": null
        },
        "Wedded to the Lie": {
                "location": "Strip Club",
                "reward": 100000,
                "evidence": null
        },
        "Dirty Money": {
                "location": "Strip Club",
                "reward": null,
                "evidence": null
        },
        "Pyro for Pornos": {
                "location": "Strip Club",
                "reward": null,
                "evidence": null
        },
        "Burnt Ends": {
                "location": "Restaurant",
                "reward": null,
                "evidence": null
        },
        "Fire Kills 99.9% of Bacteria": {
                "location": "Restaurant",
                "reward": null,
                "evidence": null
        },
        "Uber Heats": {
                "location": "Restaurant",
                "reward": null,
                "evidence": null
        },
        "Home and Dry": {
                "location": "Pub",
                "reward": 80000,
                "evidence": null
        },
        "The Declaration of Inebrience": {
                "location": "Pub",
                "reward": 100000,
                "evidence": null
        },
        "The Waiting Game": {
                "location": "Pub",
                "reward": null,
                "evidence": null
        },
        "Short Shelf Life": {
                "location": "Grocery Store",
                "reward": null,
                "evidence": null
        },
        "Hot Profit": {
                "location": "Grocery Store",
                "reward": null,
                "evidence": null
        },
        "Unspilled Beans": {
                "location": "Grocery Store",
                "reward": null,
                "evidence": null
        },
        "One Rotten Apple": {
                "location": "Grocery Store",
                "reward": null,
                "evidence": null
        },
        "Specter of Destruction": {
                "location": "Funeral Parlor",
                "reward": 100000,
                "evidence": "Elephant Statue"
        },
        "Body of Evidence": {
                "location": "Funeral Parlor",
                "reward": 70000,
                "evidence": null
        },
        "Beyond Repair": {
                "location": "Mechanic Shop",
                "reward": 57500,
                "evidence": null
        },
        "Like for Like": {
                "location": "Mechanic Shop",
                "reward": null,
                "evidence": null
        },
        "Disco Inferno": {
                "location": "Nightclub",
                "reward": null,
                "evidence": null
        },
        "Party Pooper": {
                "location": "Nightclub",
                "reward": 80000,
                "evidence": null
        },
        "Gentrifried": {
                "location": "Nightclub",
                "reward": null,
                "evidence": null
        },
        "Burn up the Dancefloor": {
                "location": "Nightclub",
                "reward": null,
                "evidence": null
        },
        "Sky High Prices": {
                "location": "Firework Store",
                "reward": 60000,
                "evidence": "Glitter Bomb"
        },
        "A Mug's Game": {
                "location": "Bazaar",
                "reward": 40000,
                "evidence": null
        },
        "Anon Starter": {
                "location": "Bazaar",
                "reward": 30000,
                "evidence": null
        },
        "Risky Business": {
                "location": "Bazaar",
                "reward": 70000,
                "evidence": null
        },
        "Bang For Your Buck": {
                "location": "Bazaar",
                "reward": 40000,
                "evidence": "Grenade"
        },
        "Clean Sweep": {
                "location": "Cleaning Agency",
                "reward": 100000,
                "evidence": null
        },
        "Out in the Wash": {
                "location": "Car Wash",
                "reward": null,
                "evidence": null
        },
        "Hot Trend": {
                "location": "Clothing Store",
                "reward": null,
                "evidence": null
        },
        "All Mouth and Trousers": {
                "location": "Clothing Store",
                "reward": null,
                "evidence": "Diamond Ring"
        },
        "Beat the Odds": {
                "location": "Private Security",
                "reward": null,
                "evidence": null
        },
        "Hire and Fire": {
                "location": "Private Security",
                "reward": null,
                "evidence": null
        },
        "Crisp Bills": {
                "location": "Printing Store",
                "reward": 50000,
                "evidence": null
        },
        "Hell Fire": {
                "location": "Bordello",
                "reward": 200000,
                "evidence": null
        },
        "Camera Tricks": {
                "location": "Bordello",
                "reward": 70000,
                "evidence": null
        },
        "Lover's Quarrel": {
                "location": "Bordello",
                "reward": null,
                "evidence": null
        },
        "Milk Milk, Lemonade": {
                "location": "Bordello",
                "reward": null,
                "evidence": null
        },
        "Always Read the Label": {
                "location": "Pharmacy",
                "reward": 105000,
                "evidence": null
        },
        "Stick to the Script": {
                "location": "Pharmacy",
                "reward": null,
                "evidence": null
        },
        "Burn Rubber": {
                "location": "Motorcycle Club",
                "reward": 89000,
                "evidence": "Mayan Statue"
        },
        "Raising Hell": {
                "location": "Motorcycle Club",
                "reward": null,
                "evidence": null
        },
        "Light Fingered": {
                "location": "Post Office",
                "reward": null,
                "evidence": null
        },
        "Hold Fire": {
                "location": "Post Office",
                "reward": null,
                "evidence": null
        },
        "Letter of the Law": {
                "location": "Post Office",
                "reward": null,
                "evidence": null
        },
        "Burning Ambition": {
                "location": "Office Block",
                "reward": null,
                "evidence": null
        },
        "Hostile Takeover": {
                "location": "Office Block",
                "reward": null,
                "evidence": null
        },
        "Workplace Burnout": {
                "location": "Office Block",
                "reward": null,
                "evidence": null
        },
        "Chance of Redemption": {
                "location": "Office Block",
                "reward": null,
                "evidence": null
        },
        "Sofa King Cheap": {
                "location": "Furniture Store",
                "reward": 100000,
                "evidence": null
        },
        "Hot Gossip": {
                "location": "Newspaper Office",
                "reward": null,
                "evidence": null
        },
        "Burn the Deck": {
                "location": "Casino",
                "reward": 125000,
                "evidence": null
        },
        "House Edge": {
                "location": "Casino",
                "reward": null,
                "evidence": null
        },
        "House of Cards": {
                "location": "Casino",
                "reward": null,
                "evidence": null
        },
        "Curtain Call": {
                "location": "Theater",
                "reward": null,
                "evidence": null
        },
        "Fire Burn and Cauldron Bubble": {
                "location": "Theater",
                "reward": 105000,
                "evidence": null
        },
        "Get Wrecked": {
                "location": "Distillery",
                "reward": 70000,
                "evidence": null
        },
        "Whiskey Business": {
                "location": "Distillery",
                "reward": null,
                "evidence": null
        },
        "Cooking Time": {
                "location": "Clock Tower",
                "reward": null,
                "evidence": null
        },
        "Ashes to Ancestors": {
                "location": "Farmhouse",
                "reward": 73000,
                "evidence": null
        },
        "Shaky Investment": {
                "location": "Farmhouse",
                "reward": null,
                "evidence": null
        },
        "Foul Play": {
                "location": "Sports Arena",
                "reward": null,
                "evidence": null
        },
        "Boxing Clever": {
                "location": "Sports Arena",
                "reward": null,
                "evidence": null
        },
        "A Burnt Child Dreads the Fire": {
                "location": "Warehouse",
                "reward": null,
                "evidence": null
        },
        "Going Viral": {
                "location": "Warehouse",
                "reward": null,
                "evidence": null
        },
        "Old School": {
                "location": "Warehouse",
                "reward": 69000,
                "evidence": null
        },
        "Lock, Stock, and Barrel": {
                "location": "Warehouse",
                "reward": null,
                "evidence": null
        },
        "Totally Armless": {
                "location": "Arms Warehouse",
                "reward": null,
                "evidence": null
        },
        "Smoke Without Fire": {
                "location": "Arms Warehouse",
                "reward": null,
                "evidence": null
        },
        "Holy Smokes": {
                "location": "Church",
                "reward": null,
                "evidence": null
        },
        "Carrying a Torch": {
                "location": "Church",
                "reward": 79000,
                "evidence": null
        },
        "Visions of the Savory": {
                "location": "Church",
                "reward": null,
                "evidence": "Family Picture"
        },
        "It's Not All White": {
                "location": "Paper Mill",
                "reward": 125000,
                "evidence": null
        },
        "Igniting Curiosity": {
                "location": "College",
                "reward": null,
                "evidence": "Sumo Doll"
        },
        "The Midnight Oil": {
                "location": "College",
                "reward": 100000,
                "evidence": null
        },
        "Searing Irony": {
                "location": "Hospital",
                "reward": null,
                "evidence": null
        },
        "Waist Not, Want Not": {
                "location": "Hospital",
                "reward": null,
                "evidence": null
        },
        "Make a Killing": {
                "location": "Hospital",
                "reward": null,
                "evidence": null
        },
        "Not a Leg to Stand on": {
                "location": "Hospital",
                "reward": null,
                "evidence": null
        },
        "Blown to High Heaven": {
                "location": "Gas Station",
                "reward": 90000,
                "evidence": null
        },
        "Hot on the Trail": {
                "location": "Bank",
                "reward": null,
                "evidence": null
        },
        "Smoke Screen": {
                "location": "Bank",
                "reward": null,
                "evidence": null
        },
        "Charcoal Sketch": {
                "location": "Art Gallery",
                "reward": null,
                "evidence": null
        },
        "The Devil's in the Details": {
                "location": "Art Gallery",
                "reward": 115000,
                "evidence": null
        },
        "Flame and Fortune": {
                "location": "TV Studio",
                "reward": null,
                "evidence": null
        },
        "Apart of the Problem": {
                "location": "Factory",
                "reward": null,
                "evidence": null
        },
        "The Fried Piper": {
                "location": "Factory",
                "reward": null,
                "evidence": null
        },
        "Playing With Fire": {
                "location": "Laboratory",
                "reward": 145000,
                "evidence": null
        },
        "Bald Faced Destruction": {
                "location": "Laboratory",
                "reward": null,
                "evidence": "Raw Ivory"
        },
        "Remote Possibility": {
                "location": "Subway",
                "reward": 100000,
                "evidence": null
        },
        "Last Lyft Home": {
                "location": "Subway",
                "reward": null,
                "evidence": null
        },
        "Stop, Drop and Lol": {
                "location": "Fire Station",
                "reward": null,
                "evidence": null
        },
        "Green With Envy": {
                "location": "Recycling Facility",
                "reward": 90000,
                "evidence": null
        },
        "Burn Notice": {
                "location": "Police Safehouse",
                "reward": null,
                "evidence": null
        },
        "Medium Rare": {
                "location": "Slaughterhouse",
                "reward": null,
                "evidence": null
        },
        "Raze the Steaks": {
                "location": "Slaughterhouse",
                "reward": null,
                "evidence": null
        },
        "Third-Degree Burn": {
                "location": "Community Center",
                "reward": null,
                "evidence": null
        },
        "Burned Cookies": {
                "location": "Data Center",
                "reward": null,
                "evidence": null
        },
        "Cache and Burn": {
                "location": "Data Center",
                "reward": null,
                "evidence": null
        },
        "Bummed Out": {
                "location": "Homeless Camp",
                "reward": null,
                "evidence": null
        },
        "The Bolted Horse": {
                "location": "Barn",
                "reward": 105000,
                "evidence": null
        },
        "A Bitter Taste": {
                "location": "Dental Surgery",
                "reward": 80000,
                "evidence": null
        },
        "Checking Out": {
                "location": "Hotel",
                "reward": null,
                "evidence": null
        },
        "Landmark Decision": {
                "location": "Hotel",
                "reward": null,
                "evidence": null
        },
        "Spirit Level": {
                "location": "Hotel",
                "reward": null,
                "evidence": null
        },
        "Roast Beef": {
                "location": "Recording Studio",
                "reward": 130000,
                "evidence": null
        },
        "Plane and Simple": {
                "location": "Aircraft Hangar",
                "reward": 165000,
                "evidence": null
        },
        "Hot Under the Collar": {
                "location": "Foundry",
                "reward": null,
                "evidence": null
        },
        "Bugging Me": {
                "location": "Pest Control Hub",
                "reward": null,
                "evidence": "Gaseous"
        },
        "Finish Line": {
                "location": "Raceway",
                "reward": null,
                "evidence": null
        },
        "Read The Room": {
                "location": "Library",
                "reward": 100000,
                "evidence": null
        },
        "Fire in the Belly": {
                "location": "Library",
                "reward": 44000,
                "evidence": null
        },
        "Dine and Dash": {
                "location": "Diner",
                "reward": null,
                "evidence": null
        },
        "Hot Dinners": {
                "location": "Diner",
                "reward": null,
                "evidence": null
        },
        "Bright Spark": {
                "location": "Car Showroom",
                "reward": null,
                "evidence": null
        },
        "Emotional Wreck": {
                "location": "Car Showroom",
                "reward": 100000,
                "evidence": null
        },
        "Final Cut": {
                "location": "Cinema",
                "reward": null,
                "evidence": null
        },
        "Burn After Screening": {
                "location": "Cinema",
                "reward": null,
                "evidence": "Liquid"
        },
        "Strike While it's Hot": {
                "location": "Bowling Alley",
                "reward": null,
                "evidence": null
        },
        "Long Pig": {
                "location": "Cafe",
                "reward": 100000,
                "evidence": null
        },
        "Cold Brew Reality": {
                "location": "Cafe",
                "reward": null,
                "evidence": null
        },
        "Stroke of Fortune": {
                "location": "Hardware Store",
                "reward": 80000,
                "evidence": null
        },
        "Womb With a View": {
                "location": "Medical Center",
                "reward": 105000,
                "evidence": null
        },
        "Clinical Exposure": {
                "location": "Medical Center",
                "reward": null,
                "evidence": "Opium"
        },
        "See No Evil": {
                "location": "Medical Center",
                "reward": 90000,
                "evidence": null
        },
        "Mental Block": {
                "location": "Hospital",
                "reward": null,
                "evidence": null
        },
        "Wired for War": {
                "location": "Electrical Substation",
                "reward": null,
                "evidence": null
        },
        "Rock the Boat": {
                "location": "Cruise Line",
                "reward": null,
                "evidence": null
        },
        "Taking out the Trash": {
                "location": "Waste Facility",
                "reward": null,
                "evidence": "Hard Drive"
        },
        "Smoke Signals": {
                "location": "Waste Facility",
                "reward": null,
                "evidence": null
        },
        "Gay Frogs": {
                "location": "Chemical Plant",
                "reward": 40000,
                "evidence": null
        },
        "Boom Industry": {
                "location": "Fertilizer Plant",
                "reward": 90000,
                "evidence": null
        },
        "Piggy in the Middle": {
                "location": "Police Station",
                "reward": null,
                "evidence": null
        },
        "Final Markdown": {
                "location": "Supermarket",
                "reward": 105000,
                "evidence": null
        },
        "Marx & Sparks": {
                "location": "Supermarket",
                "reward": null,
                "evidence": null
        },
        "Supermarket Sweep": {
                "location": "Supermarket",
                "reward": null,
                "evidence": null
        },
        "Baewatch": {
                "location": "Lifeguard Hut",
                "reward": 18000,
                "evidence": null
        },
        "Mallrats": {
                "location": "Shopping Mall",
                "reward": null,
                "evidence": null
        },
        "Fire and Brimstone": {
                "location": "Shopping Mall",
                "reward": null,
                "evidence": null
        },
        "Beggars Can't be Choosers": {
                "location": "Bus Terminal",
                "reward": null,
                "evidence": null
        },
        "End of the Line": {
                "location": "Bus Terminal",
                "reward": null,
                "evidence": null
        },
        "Ring of Fire": {
                "location": "Jewelry Store",
                "reward": null,
                "evidence": null
        },
        "Needles to Say": {
                "location": "Tattoo Parlor",
                "reward": null,
                "evidence": null
        },
        "Marked for Salvation": {
                "location": "Tattoo Parlor",
                "reward": null,
                "evidence": null
        },
        "Insert Coin to Continue": {
                "location": "Arcade",
                "reward": null,
                "evidence": null
        },
        "Hot out of the Gate": {
                "location": "Bookies",
                "reward": null,
                "evidence": "Gold Tooth"
        },
        "Improving the Odds": {
                "location": "Bookies",
                "reward": 340000,
                "evidence": null
        },
        "Damned If You Don't": {
                "location": "Loanshark Office",
                "reward": null,
                "evidence": null
        },
        "Shit Happens": {
                "location": "Restroom",
                "reward": null,
                "evidence": null
        }
};

    const JOB_REQUIREMENTS = {
        "Insurance claim": "Suspicion must be kept low, use low suspicion accelerants like Oxygen, Saltpetre and Kerosene, or use Methane to remove suspicion.",
        "Total destruction": "Destruction must reach 100%.",
        "Minimum damage": "Destruction must go past X% (reaching X% is fine).",
        "Maximum damage": "Destruction must NOT go past X% (reaching X% is fine).",
        "Damage range": "Destruction must be between X% and Y% (both %s are inclusive).",
        "Plant evidence": "A miscellaneous item must be placed in advance. This will vary depending on the job.",
        "Specific accelerant": "Accelerants of a type different from the one specified will fail the job. Igniters and dampeners are allowed regardless.",
        "Accidental cause": "Same as insurance but less strict, keep suspicion low by using Oxygen, Saltpetre, etc.",
        "Highly suspicious": "Opposite of accidental cause, suspicion must be high. Using Gasoline and Magnesium is recommended.",
        "High visibility": "Visibility must be high. Using Magnesium and Diesel is recommended."
};

    const UNIQUE_TARGET_ADVICE = {
        "Shack - Cut to the Chase": {
                "unlock": "Contact: Chase Swindlehurst",
                "cs_required": 1,
                "advice": "Easy job, throw a few canisters of Gasoline and you'll be done."
        },
        "Bordello - Hell Fire": {
                "unlock": "Contact: Marvelous Mudenda",
                "cs_required": 5,
                "advice": "Similar to Chase's, drop 3-4 canisters of Gasoline and it should be fine."
        },
        "Bookies - Improving the Odds": {
                "unlock": "Contact: Denise David",
                "cs_required": 48,
                "advice": "Start with Diesel and Magnesium, then stoke with Diesel throughout."
        },
        "Clock Tower - Cooking Time": {
                "unlock": "Contact: Ethan McChad",
                "cs_required": 50,
                "advice": "Same as Denise's."
        },
        "Dental Surgery - A Bitter Taste": {
                "unlock": "Material: Oxygen",
                "cs_required": 5,
                "advice": "Plenty of Gasoline should do it."
        },
        "Barn - The Bolted Horse": {
                "unlock": "Material: Saltpetre",
                "cs_required": 10,
                "advice": "You'll need a lot of Oxygen, both for starting and for stoking."
        },
        "Gas Station - Blown to High Heaven": {
                "unlock": "Material: Diesel",
                "cs_required": 15,
                "advice": "This one's quite difficult. I suggest starting with Oxygen and dampening immediately afterwards, don't wait even a second."
        },
        "Firework Store - Sky High Prices": {
                "unlock": "Material: Magnesium",
                "cs_required": 20,
                "advice": "Gasoline + Saltpetre should do it, be ready to stoke with more Saltpetre. You'll also need a Glitter Bomb."
        },
        "Restroom - Shit Happens": {
                "unlock": "Material: Methane",
                "cs_required": 25,
                "advice": "You cannot fail this job even if you tried - and I tried really hard."
        },
        "Recording Studio - Roast Beef": {
                "unlock": "Material: Molotov Cocktail",
                "cs_required": 30,
                "advice": "Either 4 Diesel and get ready to dampen near the end, or 1 Gasoline and stoke with Oxygen twice right after."
        },
        "Aircraft Hangar - Plane and Simple": {
                "unlock": "Material: Kerosene",
                "cs_required": 40,
                "advice": "A combination of Diesel/Methane as openers followed by some Oxygen should do it."
        },
        "Foundry - Hot Under the Collar": {
                "unlock": "Material: Thermite",
                "cs_required": 50,
                "advice": "Low flammability but high rurality, do it however you'd like - time is on your side."
        },
        "Raceway - Finish Line": {
                "unlock": "Material: Sand",
                "cs_required": 60,
                "advice": "A small amount of Kerosene and a single Saltpetre as starters, then stoking with a tank of Methane did it for me. You can probably go even lower if you just want Sand."
        },
        "Homeless Camp - Bummed Out": {
                "unlock": "Material: Hydrogen",
                "cs_required": 70,
                "advice": "Kerosene x3 and stoking once or twice with Methane near the end will do it."
        },
        "Pest Control Hub - Bugging Me": {
                "unlock": "Material: Flamethrower",
                "cs_required": 80,
                "advice": "You will need a LOT of Oxygen for this one. Start the fire with 2 or 3, then stoke it near the end, you might need to do this a few times for total destruction."
        },
        "Undetermined": {
                "unlock": "Material: Fire Extinguisher",
                "cs_required": null,
                "advice": ""
        }
};

    const MOTIVE_LABELS = new Set(["Vendetta","Business","Emotional","Intimidation","Cover-up","Criminal","Superstition","Ideological","Redevelopment","Fraud"]);

    // HTML material name → cite.json key
    const NAME_MAP = {
        "Potassium Nitrate": "Saltpetre",
        "Magnesium Shavings": "Magnesium",
        "Oxygen Tank": "Oxygen",
        "Methane Tank": "Methane",
        "Hydrogen Tank": "Hydrogen",
        "Molotov Cocktail": "Molotov",
        "Fire Blanket": "Blanket"
};

    // ── CSS ───────────────────────────────────────────────────────────────

    const style = document.createElement('style');
    style.textContent = `
        .arson-helper-tooltip {
            display: none;
            position: fixed;
            z-index: 999999;
            background: #1a1a2e;
            color: #e0e0e0;
            border: 1px solid #444;
            border-radius: 6px;
            padding: 8px 12px;
            max-width: 320px;
            font-size: 12px;
            line-height: 1.5;
            font-family: Arial, Helvetica, sans-serif;
            pointer-events: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }
        .arson-helper-tooltip.visible {
            display: block;
        }
        .arson-helper-tooltip .tt-title {
            font-weight: bold;
            color: #ffd700;
            margin-bottom: 4px;
            font-size: 13px;
        }
        .arson-helper-tooltip .tt-columns {
            display: flex;
            gap: 12px;
            margin-bottom: 6px;
        }
        .arson-helper-tooltip .tt-stats {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 2px 8px;
            margin-bottom: 6px;
        }
        .arson-helper-tooltip .tt-columns .tt-stats {
            margin-bottom: 0;
        }
        .arson-helper-tooltip .tt-label {
            color: #aaa;
        }
        .arson-helper-tooltip .tt-value {
            color: #fff;
        }
        .arson-helper-tooltip .tt-divider {
            border-top: 1px solid #333;
            margin: 4px 0;
        }
        .arson-helper-tooltip .tt-divider-strong {
            border-top: 2px solid #666;
            margin: 6px 0;
        }
        .arson-helper-tooltip .tt-stats-muted .tt-label,
        .arson-helper-tooltip .tt-stats-muted .tt-value {
            color: #888;
        }
        .arson-helper-tooltip .tt-advice {
            color: #8fc98f;
            font-style: italic;
            border-top: 1px solid #333;
            padding-top: 4px;
            margin-top: 4px;
        }
        .arson-helper-lightbulb {
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            background: rgba(255, 255, 255, 0.08);
            cursor: pointer;
            font-size: 28px;
            padding: 4px 10px;
            border-radius: 6px;
            filter: grayscale(1);
            transition: background 0.15s;
        }
        .arson-helper-lightbulb:hover {
            background: rgba(255, 255, 255, 0.15);
        }
    `;
    document.head.appendChild(style);

    // ── Tooltip element ──────────────────────────────────────────────────

    const tooltip = document.createElement('div');
    tooltip.className = 'arson-helper-tooltip';
    document.body.appendChild(tooltip);

    // Which element the tooltip is currently shown for (so a tap can toggle it
    // and tapping a different target switches instead of just hiding).
    let tooltipOwner = null;

    function showTooltip(el, html) {
        tooltip.innerHTML = html;
        tooltip.classList.add('visible');
        positionTooltip(el);
        tooltipOwner = el;
    }

    function hideTooltip() {
        tooltip.classList.remove('visible');
        tooltipOwner = null;
    }

    // Close the tooltip when tapping anywhere outside it / its owner. (On desktop
    // mouseleave handles this; touch devices have no mouseleave, so a tap-toggle
    // tooltip would otherwise stay stuck open.)
    document.addEventListener('click', (e) => {
        if (tooltipOwner && !tooltipOwner.contains(e.target) && !tooltip.contains(e.target)) {
            hideTooltip();
        }
    });

    function positionTooltip(el) {
        const rect = el.getBoundingClientRect();
        const tipRect = tooltip.getBoundingClientRect();
        let top = rect.bottom + 8;
        let left = rect.left + (rect.width / 2) - (tipRect.width / 2);

        // Clamp horizontal
        if (left < 4) left = 4;
        if (left + tipRect.width > window.innerWidth - 4) {
            left = window.innerWidth - tipRect.width - 4;
        }

        tooltip.style.top = top + 'px';
        tooltip.style.left = left + 'px';
    }

    function attachTooltip(el, html) {
        // Desktop: hover shows/hides.
        el.addEventListener('mouseenter', () => showTooltip(el, html));
        el.addEventListener('mouseleave', hideTooltip);
        // Touch/PDA: hover never fires, so TAP toggles the tooltip. (The original
        // click handler only ever HID it, so a tap could never reveal anything on
        // a touchscreen — this was why no tooltip showed on PDA.)
        // NOTE: no stopPropagation/preventDefault here — the material buttons are
        // real Torn (React) buttons using document-level event delegation, so the
        // tap must keep bubbling for material selection to still work. The
        // outside-tap-close handler already ignores taps on the current owner.
        el.addEventListener('click', () => {
            const showingThis = tooltip.classList.contains('visible') && tooltipOwner === el;
            hideTooltip();
            if (!showingThis) showTooltip(el, html);
        });
    }

    // ── findClass (from SKILL.md) ────────────────────────────────────────

    const classCache = {};

    function findClass(prefix) {
        if (classCache[prefix]) return classCache[prefix];

        if (document.querySelector('.' + prefix)) {
            classCache[prefix] = prefix;
            return prefix;
        }

        const el = document.querySelector('[class*="' + prefix + '___"]');
        if (el) {
            const match = el.className.match(new RegExp(prefix + '___\\w+'));
            if (match) {
                classCache[prefix] = match[0];
                return match[0];
            }
        }

        for (const sheet of document.styleSheets) {
            try {
                for (const rule of sheet.cssRules || []) {
                    if (rule.selectorText && rule.selectorText.includes(prefix + '___')) {
                        const match = rule.selectorText.match(new RegExp(prefix + '___\\w+'));
                        if (match) {
                            classCache[prefix] = match[0];
                            return match[0];
                        }
                    }
                }
            } catch (e) {
                // Cross-origin stylesheets will throw
            }
        }

        return null;
    }

    // ── Material name parsing ────────────────────────────────────────────

    function parseMaterialName(ariaLabel) {
        if (!ariaLabel || ariaLabel === 'Item locked') return null;
        // Patterns: "Gasoline 238 owned", "Methane Tank 73 owned recommended",
        //           "Windproof Lighter Igniting is unavailable at this stage",
        //           "Blanket Dampening is unavailable at this stage"
        // Strip trailing info after the item name
        const match = ariaLabel.match(/^(.+?)(?:\s+\d+\s+owned(?:\s+(?:recommended|requested))?|\s+(?:Igniting|Dampening|Stoking|Spreading)\s+is\s+unavailable.*)$/);
        if (match) return match[1].trim();
        return null;
    }

    function lookupMaterial(name) {
        const key = NAME_MAP[name] || name;
        if (ACCELERANTS[key]) return { category: 'accelerant', data: ACCELERANTS[key], name: key };
        if (IGNITERS[key]) return { category: 'igniter', data: IGNITERS[key], name: key };
        if (DAMPENERS[key]) return { category: 'dampener', data: DAMPENERS[key], name: key };
        return null;
    }

    function buildMaterialTooltipHTML(info) {
        const d = info.data;
        let html = '<div class="tt-title">' + escapeHTML(info.name) + '</div>';

        if (info.category === 'accelerant') {
            html += '<div class="tt-columns"><div class="tt-stats">';
            html += colorStat('Intensity', d.intensity + ' (' + d.intensity_abs + '/10)', valueColor(d.intensity_abs, 0, 10));
            if (d.momentum === 'BEST') {
                html += colorStat('Momentum', d.momentum + ' (' + d.momentum_abs + '/10)', '#b44dff');
            } else {
                html += colorStat('Momentum', d.momentum + ' (' + d.momentum_abs + '/10)', valueColor(d.momentum_abs, 1, 6));
            }
            html += colorStat('Spread', d.spread, valueColor(parseFloat(d.spread), 0, 100));
            html += '</div><div class="tt-stats">';
            html += colorStat('Ignition Risk', String(d.ignition_risk), valueColor(d.ignition_risk, 0, 10));
            html += colorStat('Stoking Risk', String(d.stoking_risk), valueColor(d.stoking_risk, 0, 10));
            html += colorStat('Suspicion', String(d.suspicion), valueColor(d.suspicion, 0, 10));
            html += '</div></div>';
        } else if (info.category === 'igniter') {
            html += '<div class="tt-stats">';
            html += colorStat('Suspicion', String(d.suspicion), valueColor(d.suspicion, 0, 10));
            html += '</div>';
        } else if (info.category === 'dampener') {
            html += '<div class="tt-stats">';
            html += stat('Effect', d.effect);
            html += '</div>';
        }
        html += '<div class="tt-advice">' + escapeHTML(d.advice) + '</div>';
        return html;
    }

    function stat(label, value) {
        return '<span class="tt-label">' + escapeHTML(label) + ':</span><span class="tt-value">' + escapeHTML(value) + '</span>';
    }

    function colorStat(label, value, color) {
        return '<span class="tt-label">' + escapeHTML(label) + ':</span><span class="tt-value" style="color:' + color + '">' + escapeHTML(value) + '</span>';
    }

    // grey (#aaa) → yellow (#ffd700) → red (#ff4444)
    function valueColor(val, min, max) {
        if (val < min) return '#8fc98f';
        const t = Math.max(0, Math.min(1, (val - min) / (max - min)));
        let r, g, b;
        if (t < 0.5) {
            const s = t * 2;
            r = Math.round(170 + 85 * s);
            g = Math.round(170 + 45 * s);
            b = Math.round(170 - 170 * s);
        } else {
            const s = (t - 0.5) * 2;
            r = 255;
            g = Math.round(215 - 147 * s);
            b = Math.round(68 - 68 * s);
        }
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    function urgencyColor(val) {
        if (val >= 6) return '#b44dff';
        if (val >= 5) return '#ff4444';
        if (val >= 4) return '#ffd700';
        return '#8fc98f';
    }

    function urgencyLabel(val) {
        if (val >= 6) return 'Very Urgent (use thermite)';
        if (val >= 5) return 'Urgent (tend closely or thermite)';
        if (val >= 4) return 'Tight (maybe thermite or magnesium)';
        if (val >= 3) return 'OK (no thermite needed)';
        if (val >= 2) return 'Low (plenty of wiggle room)';
        return 'Very Low (feel free to play around)';
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Unique target matching ───────────────────────────────────────────

    function findUniqueTarget(locationType, scenarioText) {
        const full = locationType + ' - ' + scenarioText;
        // Try "Location - Scenario" match (e.g. "Shack - Cut to the Chase")
        if (UNIQUE_TARGET_ADVICE[full]) return UNIQUE_TARGET_ADVICE[full];
        // Try "Location Scenario" without separator (e.g. "Bordello Hell Fire")
        const noSep = locationType + ' ' + scenarioText;
        if (UNIQUE_TARGET_ADVICE[noSep]) return UNIQUE_TARGET_ADVICE[noSep];
        return null;
    }

    function formatTime(seconds) {
        if (seconds < 60) return seconds + 's';
        var m = Math.floor(seconds / 60);
        var s = seconds % 60;
        return s ? m + 'm ' + s + 's' : m + 'm';
    }

    function buildJobTooltipHTML(scenarioText, locationType) {
        let html = '';
        const building = BUILDINGS[locationType];
        const job = JOBS[scenarioText];
        const unique = findUniqueTarget(locationType, scenarioText);

        // Building stats
        if (building) {
            html += '<div class="tt-title">' + escapeHTML(locationType) + '</div>';
            html += '<div class="tt-stats">';
            if (building.flammability >= 0) html += colorStat('Flammability', String(building.flammability), valueColor(building.flammability, 1, 5));
            if (building.urgency != null) html += colorStat('Urgency', building.urgency + ' - ' + urgencyLabel(building.urgency), urgencyColor(building.urgency));
            html += stat('Response', formatTime(building.response_time));
            html += '</div>';
        }

        // Job info
        if (job) {
            if (job.reward || job.evidence) {
                html += '<div class="tt-divider"></div>';
                html += '<div class="tt-stats tt-stats-muted">';
                if (job.reward) html += stat('Reward', '~$' + job.reward.toLocaleString());
                if (job.evidence) html += stat('Evidence', job.evidence);
                html += '</div>';
            }
        }

        // Unique target advice
        if (unique) {
            html += '<div class="tt-divider-strong"></div>';
            html += '<div class="tt-stats">';
            html += stat('Unlock', unique.unlock);
            html += stat('CS Required', unique.cs_required != null ? String(unique.cs_required) : 'Unknown');
            html += '</div>';
            if (unique.advice) {
                html += '<div class="tt-advice">' + escapeHTML(unique.advice) + '</div>';
            }
        }

        return html;
    }

    // ── doUpdate ─────────────────────────────────────────────────────────

    function doUpdate() {
        if (isUpdating) return;
        isUpdating = true;
        try {
            processRequestIcons();
            processMaterialButtons();
            processScenarios();
        } finally {
            isUpdating = false;
        }
    }

    function processRequestIcons() {
        const cls = findClass('requestIcon');
        if (!cls) return;
        const icons = document.querySelectorAll('div[role="img"].' + cls);
        for (const icon of icons) {
            if (icon.dataset.arsonHelper) continue;
            icon.dataset.arsonHelper = '1';
            const label = icon.getAttribute('aria-label');
            if (!label || MOTIVE_LABELS.has(label)) continue;
            // Strip " required" suffix to get the key
            const key = label.replace(/ (?:required|requested)$/, '');
            const advice = JOB_REQUIREMENTS[key];
            if (advice) {
                const html = '<div class="tt-title">' + escapeHTML(key) + '</div><div class="tt-advice">' + escapeHTML(advice) + '</div>';
                attachTooltip(icon, html);
            }
        }
    }

    function processMaterialButtons() {
        const selectorCls = findClass('itemSelector');
        if (!selectorCls) return;
        const selectors = document.querySelectorAll('.' + selectorCls);
        if (!selectors.length) return;

        const wrapCls = findClass('itemCellWrap');
        if (!wrapCls) return;

        for (const selector of selectors) {
            const wraps = selector.querySelectorAll('.' + wrapCls);
            for (const wrap of wraps) {
                const btn = wrap.querySelector('button');
                if (!btn || btn.dataset.arsonHelper) continue;
                btn.dataset.arsonHelper = '1';
                const ariaLabel = btn.getAttribute('aria-label');
                const name = parseMaterialName(ariaLabel);
                if (!name) continue;
                const info = lookupMaterial(name);
                if (!info) continue;
                const html = buildMaterialTooltipHTML(info);
                attachTooltip(btn, html);
            }
        }
    }

    function processScenarios() {
        const scenarioCls = findClass('scenario');
        if (!scenarioCls) return;
        const scenarios = document.querySelectorAll('.' + scenarioCls);

        for (const scenario of scenarios) {
            if (scenario.dataset.arsonHelper) continue;
            scenario.dataset.arsonHelper = '1';

            const scenarioText = scenario.textContent.trim();
            // The sibling div above the scenario contains the location type
            const locationDiv = scenario.previousElementSibling;
            const locationType = locationDiv ? locationDiv.textContent.trim() : '';

            const html = buildJobTooltipHTML(scenarioText, locationType);
            if (!html) continue;

            // Find the desktopStatusSection sibling to insert before it
            const statusCls = findClass('desktopStatusSection');
            const sectionsCls = findClass('sections');
            const sectionsContainer = scenario.closest(sectionsCls ? '.' + sectionsCls : '.crime-option-sections');
            if (!sectionsContainer) continue;

            const statusSection = statusCls
                ? sectionsContainer.querySelector('.' + statusCls)
                : null;

            const bulb = document.createElement('div');
            bulb.className = 'arson-helper-lightbulb';
            bulb.textContent = '\u{1F4A1}';
            bulb.title = 'Job info';
            bulb.dataset.arsonHelper = '1';

            if (statusSection) {
                sectionsContainer.insertBefore(bulb, statusSection);
            } else {
                sectionsContainer.appendChild(bulb);
            }

            attachTooltip(bulb, html);
        }
    }

    // ── Mutation observer (from SKILL.md) ────────────────────────────────

    const enqueueUpdate = typeof window.requestAnimationFrame === 'function'
        ? (cb) => window.requestAnimationFrame(cb)
        : (cb) => setTimeout(cb, 50);
    let isUpdating = false;
    let updateScheduled = false;

    function scheduleUpdate(runImmediately = false) {
        if (runImmediately) {
            updateScheduled = false;
            doUpdate();
            return;
        }
        if (updateScheduled) return;
        updateScheduled = true;
        enqueueUpdate(() => {
            updateScheduled = false;
            doUpdate();
        });
    }

    const observer = new MutationObserver(() => scheduleUpdate());

    function startObserver() {
        observer.observe(document.body, { childList: true, subtree: true });
        scheduleUpdate(true);
    }

    if (document.body) {
        startObserver();
    } else {
        document.addEventListener('DOMContentLoaded', startObserver);
    }
})();
