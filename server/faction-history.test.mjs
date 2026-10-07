// Faction history aggregation — the arithmetic and the text parsing.
//
// The fetch layer is thin and untestable without the network; everything that
// can actually be WRONG is pure, so that is what is tested here. Two places
// earn most of these cases:
//
//   parseMembershipNews  Torn writes six different sentences for what are
//                        really four events, and in half of them the first
//                        name in the sentence is the ADMIN, not the member.
//                        A naive "first word is the player" parser counts the
//                        recruiter as joining, every time.
//   buildRespectSeries   a cumulative curve reconstructed from three event
//                        streams, which must stay ordered and must declare
//                        what it could not account for rather than quietly
//                        drawing a line that stops short of the real total.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLifetime, buildRespectSeries, buildWarRecord, parseMembershipNews,
} from './faction-history.js';

// ── parseMembershipNews ────────────────────────────────────────────────
// Verbatim shapes pulled from 42055's own news, 2020-2026.
const NEWS = [
  { id: '1', timestamp: 1600000000, news: 'BKM1995 has applied to join the faction' },
  { id: '2', timestamp: 1600000100, news: "Nicolaz has accepted bokwatl's application to join the Faction." },
  { id: '3', timestamp: 1600000200, news: "Deathy has declined _Hayden's application to join the Faction" },
  { id: '4', timestamp: 1600000300, news: 'Wisterina left the faction' },
  { id: '5', timestamp: 1600000400, news: 'cherrieddrugs was kicked out of the faction by Deathy' },
  { id: '6', timestamp: 1600000500, news: "TwoHawks's position changed from Recruit to 30 Day Trial." },
  { id: '7', timestamp: 1600000600, news: "Deathy changed Noche-Eterna's position from 30 Day Trial to Reaper." },
  { id: '8', timestamp: 1600000700, news: "Alascato's position changed from Leader to Member." },
  { id: '9', timestamp: 1600000800, news: "RegulusJ changed Irix's position from Member to Leader." },
];

test('an accepted application credits the APPLICANT, not the admin', () => {
  const { events } = parseMembershipNews(NEWS);
  const joined = events.filter((e) => e.type === 'joined');
  assert.deepEqual(joined.map((e) => e.who), ['bokwatl']);
  assert.equal(joined[0].by, 'Nicolaz');
});

test('applying and being declined are not joins', () => {
  const { events } = parseMembershipNews(NEWS);
  assert.equal(events.filter((e) => e.type === 'joined').length, 1);
  assert.equal(events.find((e) => e.who === 'BKM1995').type, 'applied');
  assert.equal(events.find((e) => e.who === '_Hayden').type, 'declined');
});

test('leaving and being kicked are counted apart', () => {
  const { events } = parseMembershipNews(NEWS);
  const left = events.find((e) => e.type === 'left');
  const kicked = events.find((e) => e.type === 'kicked');
  assert.equal(left.who, 'Wisterina');
  assert.equal(kicked.who, 'cherrieddrugs');
  assert.equal(kicked.by, 'Deathy');
});

test('position changes parse in both the self form and the admin form', () => {
  const { events } = parseMembershipNews(NEWS);
  const self = events.find((e) => e.who === 'TwoHawks');
  const byAdmin = events.find((e) => e.who === 'Noche-Eterna');
  assert.equal(self.type, 'position');
  assert.deepEqual([self.from, self.to], ['Recruit', '30 Day Trial']);
  assert.equal(byAdmin.by, 'Deathy');
  assert.deepEqual([byAdmin.from, byAdmin.to], ['30 Day Trial', 'Reaper']);
});

test('only Leader/Co-leader moves reach the leadership timeline', () => {
  const { leadership } = parseMembershipNews(NEWS);
  assert.deepEqual(leadership.map((l) => `${l.who}:${l.from}->${l.to}`),
    ['Alascato:Leader->Member', 'Irix:Member->Leader']);
  // A Recruit -> 30 Day Trial move is not leadership, however it is phrased.
  assert.ok(!leadership.some((l) => l.who === 'TwoHawks'));
});

test('churn buckets by month and keeps leaves and kicks separate', () => {
  const { monthly } = parseMembershipNews(NEWS);
  assert.equal(monthly.length, 1);
  assert.equal(monthly[0].month, '2020-09');
  assert.deepEqual(
    { joined: monthly[0].joined, left: monthly[0].left, kicked: monthly[0].kicked },
    { joined: 1, left: 1, kicked: 1 });
});

test('an unrecognised sentence is surfaced, never silently dropped', () => {
  const { unparsed } = parseMembershipNews(
    [...NEWS, { id: '99', timestamp: 1600000900, news: 'Something entirely new happened' }]);
  assert.deepEqual(unparsed, ['Something entirely new happened']);
});

test('HTML in the news text is stripped before parsing', () => {
  const { events } = parseMembershipNews(
    [{ id: '1', timestamp: 1, news: '<a href="x">Wisterina</a> left the faction' }]);
  assert.equal(events[0].who, 'Wisterina');
});

// ── buildLifetime ──────────────────────────────────────────────────────
const STATS = {
  gymstrength: 100, gymspeed: 200, gymdefense: 300, gymdexterity: 400,
  gymtrains: 100, attackswon: 50, attackslost: 20, attacksmug: 7,
  organisedcrimerespect: 11, territoryrespect: 5, bestchain: 9000,
};
const BASIC = { respect: 1000, days_old: 10, rank: { name: 'Diamond', wins: 42 } };

test('trained energy is the four gym stats summed, with a per-train rate', () => {
  const l = buildLifetime({ stats: STATS, basic: BASIC, contributors: {} });
  assert.equal(l.trainedEnergy.total, 1000);
  assert.equal(l.trainedEnergy.perTrain, 10);
  assert.equal(l.trainedEnergy.byStat.defense, 300);
});

test('gymenergy is ignored — it is a dead counter that reads 0', () => {
  const l = buildLifetime({ stats: { ...STATS, gymenergy: 999999 }, basic: BASIC, contributors: {} });
  assert.equal(l.trainedEnergy.total, 1000);
});

test('contributor energy splits current roster from departed members', () => {
  const contributors = {
    defense: [
      { id: 1, username: 'Here', value: 200, in_faction: true },
      { id: 2, username: 'Gone', value: 100, in_faction: false },
    ],
  };
  const l = buildLifetime({ stats: STATS, basic: BASIC, contributors });
  const m = l.members.find((x) => x.username === 'Here');
  assert.equal(m.total, 200);
  assert.equal(l.memberEnergy.current, 200);
  assert.equal(l.memberEnergy.departed, 100);
});

test('creation date is derived from days_old', () => {
  const l = buildLifetime({ stats: STATS, basic: BASIC, contributors: {}, now: Date.UTC(2026, 0, 11) });
  assert.equal(l.createdAt, '2026-01-01');
});

// ── buildRespectSeries ─────────────────────────────────────────────────
test('respect accumulates in time order across all three sources', () => {
  const s = buildRespectSeries({
    chains: [{ start: 300, respect: 3 }, { start: 100, respect: 1 }],
    warRespect: [{ t: 200, respect: 10 }],
    crimeRespect: [{ t: 400, respect: 100 }],
    currentTotal: 114,
  });
  assert.deepEqual(s.points.map((p) => p.t), [100, 200, 300, 400]);
  assert.deepEqual(s.points.map((p) => p.cumulative), [1, 11, 14, 114]);
  assert.deepEqual(s.points.map((p) => p.source), ['chain', 'war', 'chain', 'oc']);
});

test('the gap against the real total is reported, not hidden', () => {
  const s = buildRespectSeries({
    chains: [{ start: 1, respect: 10 }], warRespect: [], crimeRespect: [],
    currentTotal: 250,
  });
  assert.equal(s.tracked, 10);
  assert.equal(s.unaccounted, 240);
});

// ── buildWarRecord ─────────────────────────────────────────────────────
test('wars tally by winner, and an unfinished war counts as neither', () => {
  const w = buildWarRecord({
    factionId: 42055,
    wars: [
      { id: 1, start: 10, winner: 42055 },
      { id: 2, start: 20, winner: 999 },
      { id: 3, start: 30, winner: null },
    ],
    reports: {},
  });
  assert.deepEqual({ won: w.won, lost: w.lost, ongoing: w.ongoing }, { won: 1, lost: 1, ongoing: 1 });
});

test('the rank timeline reads our own side of each war report', () => {
  const w = buildWarRecord({
    factionId: 42055,
    wars: [{ id: 7, start: 10, winner: 42055 }],
    reports: {
      7: [
        { id: 8205, rank: { before: 'Diamond', after: 'Platinum III' } },
        { id: 42055, rank: { before: 'Diamond', after: 'Diamond' } },
      ],
    },
  });
  assert.deepEqual(w.rankTimeline, [{ t: 10, warId: 7, before: 'Diamond', after: 'Diamond' }]);
});

// ── parseLeadershipNews ────────────────────────────────────────────────
// mainnews records handovers EXPLICITLY, which membershipnews does not: a
// faction changing hands produces "Leadership was transferred to X" and no
// position-change row at all. Inferring leaders from position changes missed
// every actual handover and reported the sitting leader as never appointed.
import { parseLeadershipNews } from './faction-history.js';

const MAIN = [
  { timestamp: 100, news: 'Leadership was transferred to RedRocket--Rev.' },
  { timestamp: 200, news: 'Co-leadership of Arsonists Endeavour has been given to TH3BEAST96 by Gaz-86.' },
  { timestamp: 300, news: 'Co-leadership of Arsonists Endeavour has been transferred from TH3BEAST96 to RedRocket--Rev by Gaz-86.' },
  { timestamp: 400, news: 'RedRocket--Rev has been removed from co-leadership of Arsonists Endeavour by Gaz-86.' },
  { timestamp: 500, news: 'Leadership was transferred to Deathy.' },
  { timestamp: 600, news: 'Deathy changed the faction name to: Dead Fragment.' },
  { timestamp: 700, news: 'Achieved a chain of 25 and 91.78 respect' },
];

test('a leadership transfer closes the sitting term and opens the next', () => {
  const { leaders } = parseLeadershipNews(MAIN);
  const l = leaders.filter((x) => x.role === 'Leader');
  assert.deepEqual(l.map((x) => [x.who, x.from, x.to]),
    [['RedRocket--Rev', 100, 500], ['Deathy', 500, null]]);
  assert.equal(l[1].current, true);
});

test('co-leadership given, transferred and removed all move the chair', () => {
  const { leaders } = parseLeadershipNews(MAIN);
  const c = leaders.filter((x) => x.role === 'Co-leader');
  assert.deepEqual(c.map((x) => [x.who, x.from, x.to]),
    [['TH3BEAST96', 200, 300], ['RedRocket--Rev', 300, 400]]);
  assert.equal(c[1].current, false);
});

test('faction renames are picked up as their own history', () => {
  const { names } = parseLeadershipNews(MAIN);
  assert.deepEqual(names, [{ t: 600, name: 'Dead Fragment', by: 'Deathy' }]);
});

test('ordinary faction news is ignored, not misread as leadership', () => {
  const { leaders, names } = parseLeadershipNews(
    [{ timestamp: 1, news: 'Achieved a chain of 25 and 91.78 respect' }]);
  assert.deepEqual([leaders, names], [[], []]);
});

test('both wordings of applying are the same event', () => {
  // Torn uses two sentences for one action; 37 of 42055's rows use the second.
  const { events } = parseMembershipNews([
    { id: 1, timestamp: 10, news: 'BKM1995 has applied to join the faction' },
    { id: 2, timestamp: 20, news: 'JoKong69 sent an application to join the Faction.' },
  ]);
  assert.deepEqual(events.map((e) => [e.type, e.who]), [['applied', 'BKM1995'], ['applied', 'JoKong69']]);
});

test('faction housekeeping is ignored, not reported as unparsed', () => {
  // Recruitment toggles are not membership events. Counting them as parse
  // failures makes a healthy parser look broken and hides the real misses.
  const { events, unparsed, ignored } = parseMembershipNews([
    { id: 1, timestamp: 10, news: "Hermaeus-Mora set Faction status to 'Looking for members'." },
    { id: 2, timestamp: 20, news: 'Rare-Hipster has unlocked applications to join the Faction' },
    { id: 3, timestamp: 30, news: 'Something genuinely new happened' },
  ]);
  assert.deepEqual(events, []);
  assert.equal(ignored, 2);
  assert.deepEqual(unparsed, ['Something genuinely new happened']);
});

// ── bucketRespect ──────────────────────────────────────────────────────
// "How much respect did we make last month, and how does that compare to the
// year before?" The trap is that early periods are INCOMPLETE rather than
// small: war respect starts Mar 2022 and OC respect only exists from OC 2.0,
// so a year-on-year chart drawn from totals alone shows coverage growing and
// calls it the faction improving. Every bucket therefore carries its source
// split, and comparisons are flagged when the sources differ.
import { bucketRespect } from './faction-history.js';

const P = (iso, delta, source) => ({ t: Date.parse(iso + 'T12:00:00Z') / 1000, delta, source, cumulative: 0 });

test('buckets by UTC year with a per-source split', () => {
  const b = bucketRespect([
    P('2024-03-01', 10, 'chain'), P('2024-07-01', 5, 'war'), P('2025-01-02', 7, 'oc'),
  ], 'year');
  assert.deepEqual(b.map((x) => [x.key, x.total]), [['2024', 15], ['2025', 7]]);
  assert.deepEqual(b[0].bySource, { chain: 10, war: 5, oc: 0 });
});

test('buckets by month, and a month with no respect is still reported', () => {
  // A silent gap must read as a zero bar, not vanish and shift the chart.
  const b = bucketRespect([P('2024-01-10', 4, 'chain'), P('2024-03-10', 6, 'chain')], 'month');
  assert.deepEqual(b.map((x) => [x.key, x.total]), [['2024-01', 4], ['2024-02', 0], ['2024-03', 6]]);
});

test('weeks start Monday in UTC', () => {
  // 2024-03-07 is a Thursday; its week is the Monday before it.
  const b = bucketRespect([P('2024-03-07', 3, 'chain')], 'week');
  assert.equal(b[0].key, '2024-03-04');
});

test('a local-midnight event does not land in the wrong bucket', () => {
  // Bucketing with local getters files this under 2023 west of UTC.
  const b = bucketRespect([{ t: Date.parse('2024-01-01T00:30:00Z') / 1000, delta: 1, source: 'chain' }], 'year');
  assert.equal(b[0].key, '2024');
});

test('each bucket carries the change on the one before it', () => {
  const b = bucketRespect([P('2024-01-10', 100, 'chain'), P('2025-01-10', 150, 'chain')], 'year');
  assert.equal(b[1].changePct, 50);
  assert.equal(b[0].changePct, null);
});

test('a comparison across different sources is flagged as not like-for-like', () => {
  // 2021 is chains only; 2024 has war respect too. Same number, different
  // meaning — the page must be able to say so.
  const b = bucketRespect([P('2021-06-01', 50, 'chain'), P('2024-06-01', 50, 'war')], 'year');
  assert.equal(b[1].comparable, false);
  assert.equal(b[0].comparable, null);
});

test('the period still in progress is marked partial', () => {
  // 7 days into October reads as a 72% collapse against September. It is not
  // a collapse, it is a month that has not happened yet — and that is the
  // single most misleading number a "progress" chart can show.
  const now = Date.parse('2026-10-07T00:00:00Z') / 1000;
  const b = bucketRespect(
    [P('2026-09-10', 100, 'chain'), P('2026-10-03', 20, 'chain')], 'month', now);
  assert.equal(b[0].partial, false);
  assert.equal(b[1].partial, true);
  // A partial period gets no change figure — comparing part of a month to a
  // whole one is the same error wearing a percentage sign.
  assert.equal(b[1].changePct, null);
});

test('a completed period is not marked partial', () => {
  const now = Date.parse('2026-10-07T00:00:00Z') / 1000;
  const b = bucketRespect([P('2026-08-10', 10, 'chain'), P('2026-09-10', 20, 'chain')], 'month', now);
  assert.equal(b[0].partial, false);
  assert.equal(b[1].partial, false);
  assert.equal(b[1].changePct, 100);
});

test('a bucket counts awards per source, not just their value', () => {
  // "47,000 from chains" is less use than "47,000 from 12 chains" — one big
  // chain and twelve small ones are different weeks.
  const b = bucketRespect([
    P('2024-03-01', 10, 'chain'), P('2024-03-02', 20, 'chain'), P('2024-03-03', 5, 'war'),
  ], 'month');
  assert.deepEqual(b[0].countBySource, { chain: 2, war: 1, oc: 0 });
  assert.equal(b[0].count, 3);
});

// ── buildAttackRespect ─────────────────────────────────────────────────
// /faction/attacks returns BOTH directions, and respect_gain on an incoming
// attack is the enemy's. Summing the feed unfiltered credits our members with
// respect our opponents took off us.
import { buildAttackRespect } from './faction-history.js';

const atk = (name, gain, result = 'Attacked', fid = 42055) => ({
  // Distinct id per name: name.length collapsed 'A' and 'B' into one member
  // and the merge looked like an aggregation bug in the code under test.
  attacker: name == null ? null : { id: name.charCodeAt(0), name, faction: { id: fid } },
  defender: { faction: { id: fid === 42055 ? 999 : 42055 } },
  respect_gain: gain, result, started: 1000,
});

test('only our own faction\'s attackers are counted', () => {
  const r = buildAttackRespect([atk('Us', 10), atk('Them', 99, 'Attacked', 999)], 42055);
  assert.deepEqual(r.members.map((m) => m.name), ['Us']);
  assert.equal(r.members[0].respect, 10);
});

test('respect and attack count accumulate per member, with an average', () => {
  const r = buildAttackRespect([atk('A', 10), atk('A', 20), atk('B', 5)], 42055);
  const a = r.members.find((m) => m.name === 'A');
  assert.deepEqual([a.respect, a.attacks, a.avg], [30, 2, 15]);
});

test('members are ranked by respect gained', () => {
  const r = buildAttackRespect([atk('Low', 1), atk('High', 100)], 42055);
  assert.deepEqual(r.members.map((m) => m.name), ['High', 'Low']);
});

test('a stealthed attack is reported as unattributed, not dropped', () => {
  // 7 of every 100 rows hide the attacker. Silently dropping them makes the
  // leaderboard total disagree with the faction total for no visible reason.
  const r = buildAttackRespect([atk('A', 10), atk(null, 25)], 42055);
  assert.equal(r.unattributed.attacks, 1);
  assert.equal(r.unattributed.respect, 25);
  assert.equal(r.totalRespect, 35);
});

test('each member keeps the spread of outcomes behind their number', () => {
  const r = buildAttackRespect([atk('A', 10, 'Mugged'), atk('A', 0, 'Lost')], 42055);
  assert.deepEqual(r.members[0].results, { Mugged: 1, Lost: 1 });
});
