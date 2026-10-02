import cron from 'node-cron';
import { decodeEntities } from "./torn-api.js";
import axios from 'axios';
import { startHeatmapScraper } from './heatmap-scraper.js';
import * as store from './store.js';
import { startChainMonitor } from './chain-monitor.js';

// Dummy database service structure
const db = {
    getAllRegisteredFactions: async () => {
        return [
            { id: '42055', apiKey: '63CZ7jTvDghXLKDl' }
        ];
    }
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function scanFactions() {
    console.log('[WarScanner] Starting ranked war scan sweep...');
    
    try {
        const factions = await db.getAllRegisteredFactions();

        for (const faction of factions) {
            const factionIdStr = String(faction.id);
            
            try {
                console.log(`[WarScanner] Checking faction ${factionIdStr} for active wars...`);
                
                const url = `https://api.torn.com/faction/${factionIdStr}?selections=rankedwars&key=${faction.apiKey}&comment=wb-warscan`;
                const response = await axios.get(url);
                const data = response.data;

                if (data.error) {
                    console.error(`[WarScanner] Torn API Error for faction ${factionIdStr}:`, data.error);
                } else if (data.rankedwars) {
                    for (const [warId, warData] of Object.entries(data.rankedwars)) {
                        // Only process active ranked wars (winner is 0 or undefined)
                        if (warData.war && warData.war.winner && warData.war.winner !== 0) {
                            continue;
                        }

                        const participantIds = Object.keys(warData.factions || {});
                        const enemyId = participantIds.find(id => String(id) !== factionIdStr);

                        if (enemyId) {
                            // v1 HTML-escapes faction names ("Howler&#039;s
                            // Haven"). Decoded here because this is a WRITER of
                            // war.enemyFactionName: the boot-time repair kept
                            // fixing the record and this kept putting the entity
                            // back on the scanner's next pass, so the name
                            // oscillated and the War Scout rendered the entity.
                            const enemyName = decodeEntities(warData.factions[enemyId]?.name) || 'Unknown';
                            console.log(`[WarScanner] Active Ranked War detected! WarID: ${warId}, Enemy: ${enemyName} (${enemyId})`);
                            startHeatmapScraper(warId, enemyId, factionIdStr, faction.apiKey, enemyName);

                            // 2026-05-19: previously the scanner only kicked
                            // off the heatmap scraper, leaving war record
                            // creation to whoever happened to load the war
                            // page next. If nobody did, the new war was
                            // invisible to FactionOps until a client triggered
                            // it. Now we also create/refresh the war record
                            // and start chain-monitor immediately, so the
                            // server's view of the active war is current
                            // regardless of client traffic.
                            try {
                                const stableWarId = `war_${factionIdStr}`;
                                const war = store.getOrCreateWar(stableWarId, factionIdStr, String(enemyId));
                                // getOrCreateWar wipes enemyFactionName on
                                // enemy-change; refill from the scan result.
                                war.enemyFactionName = enemyName;
                                // Capture warStart + target if present so
                                // pre-war countdowns work without waiting on
                                // chain-monitor's first poll.
                                if (warData.war?.start) war.warStart = warData.war.start;
                                if (warData.war?.target) war.warOrigTarget = warData.war.target;
                                store.saveState();
                                startChainMonitor(null, stableWarId);
                                console.log(`[WarScanner] Created war record + started chain-monitor for ${stableWarId} (vs ${enemyName})`);
                            } catch (err) {
                                console.error(`[WarScanner] Failed to wire war record for ${factionIdStr}:`, err.message);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`[WarScanner] Request failed for faction ${factionIdStr}:`, error.message);
            }

            // CRITICAL: 1500ms delay to respect Torn API rate limits (100 requests / minute)
            await delay(1500);
        }
        
        console.log('[WarScanner] Sweep complete.');
    } catch (error) {
        console.error('[WarScanner] Critical failure during sweep:', error.message);
    }
}

// Every Tuesday at 14:00 UTC (Ranked War Matchmaking Day)
cron.schedule('0 14 * * 2', scanFactions, {
    timezone: 'UTC'
});

// Fallback every 4 hours
cron.schedule('0 */4 * * *', scanFactions, {
    timezone: 'UTC'
});

console.log('[WarScanner] Scheduled cron jobs: Tuesdays 14:00 UTC & Every 4 hours fallback.');
scanFactions();
