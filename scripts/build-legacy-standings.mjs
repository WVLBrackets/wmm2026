/**
 * Build frozen standings JSON from Webnode final-page markdown or HTML.
 *
 * Usage:
 *   node scripts/build-legacy-standings.mjs 2019
 *   node scripts/build-legacy-standings.mjs 2024
 *   node scripts/build-legacy-standings.mjs all
 */
import fs from "node:fs";
import path from "node:path";

const UPLOADS =
  process.env.LEGACY_MD_DIR ||
  path.join(
    process.env.USERPROFILE || "",
    ".cursor/projects/c-Users-wvand-CursorProjects-wmm2026/uploads",
  );

const OUT_DIR = path.join("src/lib/legacyStandings/data");

/** ESPN id → display name (extend as years add new logos). */
const ID_TO_NAME = {
  "2": "Auburn",
  "8": "Arkansas",
  "9": "Arizona State",
  "12": "Arizona",
  "21": "San Diego State",
  "26": "UCLA",
  "28": "UC San Diego",
  "30": "USC",
  "36": "Colorado State",
  "38": "Colorado",
  "41": "Connecticut",
  "42": "Hartford",
  "43": "Yale",
  "46": "Georgetown",
  "52": "Florida State",
  "57": "Florida",
  "59": "Georgia Tech",
  "61": "Georgia",
  "66": "Iowa State",
  "68": "Boise State",
  "77": "Northwestern",
  "84": "Indiana",
  "87": "Notre Dame",
  "93": "Murray State",
  "96": "Kentucky",
  "97": "Louisville",
  "99": "LSU",
  "120": "Maryland",
  "127": "Michigan State",
  "130": "Michigan",
  "135": "Minnesota",
  "142": "Missouri",
  "145": "Ole Miss",
  "149": "Montana",
  "150": "Duke",
  "152": "NC State",
  "153": "North Carolina",
  "156": "Creighton",
  "158": "Nebraska",
  "163": "Princeton",
  "167": "New Mexico",
  "183": "Syracuse",
  "194": "Ohio State",
  "195": "Ohio",
  "197": "Oklahoma State",
  "198": "Oral Roberts",
  "201": "Oklahoma",
  "204": "Oregon State",
  "213": "Penn State",
  "219": "Pennsylvania",
  "222": "Villanova",
  "228": "Clemson",
  "232": "Charleston",
  "235": "Memphis",
  "238": "Vanderbilt",
  "239": "Baylor",
  "245": "Texas A&M",
  "248": "Houston",
  "251": "Texas",
  "252": "BYU",
  "256": "James Madison",
  "258": "Virginia",
  "259": "Virginia Tech",
  "261": "Vermont",
  "264": "Washington",
  "265": "Washington State",
  "269": "Marquette",
  "275": "Wisconsin",
  "276": "Marshall",
  "277": "West Virginia",
  "328": "Utah State",
  "333": "Alabama",
  "344": "Mississippi State",
  "356": "Illinois",
  "2000": "Abilene Christian",
  "2083": "Bucknell",
  "2084": "Buffalo",
  "2086": "Butler",
  "2132": "Cincinnati",
  "2142": "Colgate",
  "2166": "Davidson",
  "2181": "Drake",
  "2226": "Florida Atlantic",
  "2250": "Gonzaga",
  "2253": "Grand Canyon",
  "2294": "Iowa",
  "2305": "Kansas",
  "2306": "Kansas State",
  "2335": "Liberty",
  "2350": "Loyola Chicago",
  "2377": "McNeese",
  "2378": "UMBC",
  "2390": "Miami",
  "2437": "Omaha",
  "2440": "Nevada",
  "2473": "Oakland",
  "2483": "Oregon",
  "2507": "Providence",
  "2509": "Purdue",
  "2567": "SMU",
  "2579": "South Carolina",
  "2599": "St. John's",
  "2608": "Saint Mary's",
  "2628": "TCU",
  "2633": "Tennessee",
  "2641": "Texas Tech",
  "2670": "VCU",
  "2724": "Wichita State",
  "2747": "Wofford",
  "2752": "Xavier",
};

/** Webnode text abbreviations → display names (2017–2019). */
const ABBR_TO_NAME = {
  "A&M": "Texas A&M",
  "K St.": "Kansas State",
  Ark: "Arkansas",
  Aub: "Auburn",
  Az: "Arizona",
  Bama: "Alabama",
  Bay: "Baylor",
  Buck: "Bucknell",
  Buff: "Buffalo",
  But: "Butler",
  Char: "Charleston",
  Cin: "Cincinnati",
  Cincy: "Cincinnati",
  Clem: "Clemson",
  Dav: "Davidson",
  Duke: "Duke",
  FF1: "FF1",
  FF2: "FF2",
  FF4: "FF4",
  FSU: "Florida State",
  Flo: "Florida",
  Gon: "Gonzaga",
  Gonz: "Gonzaga",
  Hou: "Houston",
  ISU: "Iowa State",
  Iowa: "Iowa",
  KU: "Kansas",
  KSU: "Kansas State",
  Kan: "Kansas",
  LSU: "LSU",
  Lou: "Louisville",
  Loy: "Loyola Chicago",
  MSU: "Michigan State",
  Mar: "Marshall",
  Marq: "Marquette",
  Mary: "Maryland",
  Mia: "Miami",
  MicSt: "Michigan State",
  Minn: "Minnesota",
  MisSt: "Mississippi State",
  Miss: "Missouri",
  Mon: "Montana",
  MurSt: "Murray State",
  Murr: "Murray State",
  NCS: "NC State",
  ND: "Notre Dame",
  Nev: "Nevada",
  Nova: "Villanova",
  OU: "Oklahoma",
  OSU: "Ohio State",
  Ore: "Oregon",
  Penn: "Pennsylvania",
  Prov: "Providence",
  Pur: "Purdue",
  SM: "Saint Mary's",
  SMU: "SMU",
  Syr: "Syracuse",
  TCU: "TCU",
  TT: "Texas Tech",
  Tenn: "Tennessee",
  UA: "Arizona",
  UCLA: "UCLA",
  UF: "Florida",
  UK: "Kentucky",
  UM: "Michigan",
  UMBC: "UMBC",
  UNC: "North Carolina",
  UT: "Texas",
  UVA: "Virginia",
  VT: "Virginia Tech",
  Vand: "Vanderbilt",
  Vill: "Villanova",
  WV: "West Virginia",
  WVU: "West Virginia",
  Wash: "Washington",
  Wich: "Wichita State",
  Wis: "Wisconsin",
  Wof: "Wofford",
  Xav: "Xavier",
};

/**
 * Hardcoded KEY chrome from NCAA results + Webnode column order
 * (TL/BL/TR/BR = logo slots 0–3).
 */
const YEAR_KEY = {
  2017: {
    regionalChampionKey: [
      "South Carolina",
      "Gonzaga",
      "Oregon",
      "North Carolina",
    ],
    semifinalKey: ["Gonzaga", "North Carolina"],
    finalWinner: "North Carolina",
    eliminatedTeams: ["South Carolina", "Gonzaga", "Oregon"],
    lastUpdated: "2017-04-04T00:00:00.000Z",
    layout: "html-abbr",
    md: "2017final.html",
  },
  2018: {
    regionalChampionKey: [
      "Loyola Chicago",
      "Michigan",
      "Villanova",
      "Kansas",
    ],
    semifinalKey: ["Michigan", "Villanova"],
    finalWinner: "Villanova",
    eliminatedTeams: ["Loyola Chicago", "Michigan", "Kansas"],
    lastUpdated: "2018-04-03T00:00:00.000Z",
    layout: "html-abbr",
    md: "2018final.html",
  },
  2019: {
    regionalChampionKey: [
      "Michigan State",
      "Texas Tech",
      "Virginia",
      "Auburn",
    ],
    semifinalKey: ["Texas Tech", "Virginia"],
    finalWinner: "Virginia",
    eliminatedTeams: ["Michigan State", "Texas Tech", "Auburn"],
    lastUpdated: "2019-04-09T00:00:00.000Z",
    layout: "abbr",
    md: "2019final-0.md",
  },
  2021: {
    regionalChampionKey: ["Gonzaga", "UCLA", "Baylor", "Houston"],
    semifinalKey: ["Gonzaga", "Baylor"],
    finalWinner: "Baylor",
    eliminatedTeams: ["Gonzaga", "UCLA", "Houston"],
    lastUpdated: "2021-04-06T00:00:00.000Z",
    layout: "wide",
    md: "2021final-2.md",
  },
  2022: {
    regionalChampionKey: ["Duke", "North Carolina", "Villanova", "Kansas"],
    semifinalKey: ["North Carolina", "Kansas"],
    finalWinner: "Kansas",
    eliminatedTeams: ["Duke", "North Carolina", "Villanova"],
    lastUpdated: "2022-04-05T00:00:00.000Z",
    layout: "wide",
    md: "2022final-1.md",
  },
  2023: {
    regionalChampionKey: [
      "San Diego State",
      "Florida Atlantic",
      "Miami",
      "Connecticut",
    ],
    semifinalKey: ["San Diego State", "Connecticut"],
    finalWinner: "Connecticut",
    eliminatedTeams: ["San Diego State", "Florida Atlantic", "Miami"],
    lastUpdated: "2023-04-04T00:00:00.000Z",
    layout: "html-compact",
    md: "2023final.html",
  },
  2024: {
    regionalChampionKey: [
      "Connecticut",
      "Alabama",
      "NC State",
      "Purdue",
    ],
    semifinalKey: ["Connecticut", "Purdue"],
    finalWinner: "Connecticut",
    eliminatedTeams: ["Alabama", "NC State", "Purdue"],
    lastUpdated: "2024-04-09T00:00:00.000Z",
    layout: "html-compact",
    md: "2024final.html",
  },
  2025: {
    regionalChampionKey: ["Auburn", "Florida", "Duke", "Houston"],
    semifinalKey: ["Florida", "Houston"],
    finalWinner: "Florida",
    eliminatedTeams: ["Auburn", "Duke", "Houston"],
    lastUpdated: "2025-04-08T00:00:00.000Z",
    layout: "html-compact",
    md: "2025final.html",
  },
};

/**
 * @param {string} id
 */
function nameFor(id) {
  const n = ID_TO_NAME[id];
  if (!n) throw new Error(`Unknown ESPN team id ${id} — add to ID_TO_NAME`);
  return n;
}

const NAME_TO_ID = Object.fromEntries(
  Object.entries(ID_TO_NAME).map(([id, name]) => [name, id]),
);

/** First Four / unknown-slot placeholders with no ESPN logo id. */
const PLACEHOLDER_TEAMS = new Set(["FF1", "FF2", "FF4"]);

/**
 * @param {string} abbr
 */
function nameFromAbbr(abbr) {
  const key = abbr.trim();
  const n = ABBR_TO_NAME[key];
  if (!n) throw new Error(`Unknown abbr ${key} — add to ABBR_TO_NAME`);
  return n;
}

/**
 * 2018 Webnode HTML wide abbr rows:
 * Rank|Player|Pts|TB Diff|FF×4|Finals×2|Champ|TB|Paid (Wcell/Lcell / Pcell/NPcell)
 * @param {string} html
 */
function parseHtmlAbbr(html) {
  const rows = [];
  // TB Diff may be empty (`<TD class=Scell></TD>`) on some 2017 rows.
  const rowRe =
    /<TR><TD class=Scell>(\d+)<\/TD><TD class=(?:P|NP)cell>([^<]*)<\/TD><TD class=Scell>(\d+)<\/TD><TD class=Scell>(\d*)<\/TD><TD class=[WL]cell>([^<]*)<\/TD><TD class=[WL]cell>([^<]*)<\/TD><TD class=[WL]cell>([^<]*)<\/TD><TD class=[WL]cell>([^<]*)<\/TD><TD class=[WL]cell>([^<]*)<\/TD><TD class=[WL]cell>([^<]*)<\/TD><TD class=[WL]cell>([^<]*)<\/TD><TD class=Scell>(\d+)<\/TD><TD class=(?:P|NP)cell>([YN])<\/TD><\/TR>/gi;
  let m;
  while ((m = rowRe.exec(html))) {
    const ffAbbrs = [m[5], m[6], m[7], m[8]];
    const finalsAbbrs = [m[9], m[10]];
    const champAbbr = m[11];
    rows.push({
      rank: Number(m[1]),
      player: m[2].replace(/\\_/g, "_").trim(),
      points: Number(m[3]),
      ffNames: ffAbbrs.map(nameFromAbbr),
      finalsNames: finalsAbbrs.map(nameFromAbbr),
      champName: champAbbr ? nameFromAbbr(champAbbr) : "",
      tb: Number(m[12]) || 0,
      paid: m[13].toUpperCase() === "Y",
    });
  }
  return rows;
}

/**
 * Abbr text layout (2019): Rank|Player|Pts|TB Diff|FF×4|Finals×2|Champ|TB|Paid
 * @param {string} md
 */
function parseAbbr(md) {
  const rows = [];
  for (const line of md.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    if (
      line.includes("---") ||
      line.includes("Player") ||
      line.includes("Rank")
    )
      continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((_, i, arr) => i > 0 && i < arr.length - 1);
    const rank = Number(cells[0]);
    if (!Number.isFinite(rank)) continue;
    const player = cells[1].replace(/\\_/g, "_").trim();
    const points = Number(cells[2]);
    const ffAbbrs = cells.slice(4, 8);
    const finalsAbbrs = cells.slice(8, 10);
    const champAbbr = cells[10] || "";
    const tb = Number(cells[11]) || 0;
    rows.push({
      rank,
      player,
      points,
      ffNames: ffAbbrs.map(nameFromAbbr),
      finalsNames: finalsAbbrs.map(nameFromAbbr),
      champName: champAbbr ? nameFromAbbr(champAbbr) : "",
      tb,
      paid: true,
    });
  }
  return rows;
}

/**
 * Finalist frames from compact Webnode FF cells: *2cell = 3px black border;
 * *4cell = white border (not a finalist). Returns up to two ESPN ids in
 * left-then-right encounter order.
 * @param {string} ffHtml
 * @returns {[string, string]}
 */
function finalsIdsFromFfCell(ffHtml) {
  const finals = [];
  const re = /class=["']?[WLU]2cell["']?[\s\S]*?\/(\d+)\.png/gi;
  let m;
  while ((m = re.exec(ffHtml))) {
    finals.push(m[1]);
  }
  while (finals.length < 2) finals.push("");
  return /** @type {[string, string]} */ (finals.slice(0, 2));
}

/**
 * Webnode HTML compact layout (2023–2025): Numcell|P/NPcell|Scell|FFcell×4|W1/L1 champ+TB.
 * Finalist frames come from W2/L2/U2 cell classes inside the FF nested table.
 * @param {string} html
 */
function parseHtmlCompact(html) {
  const rows = [];
  const rowRe =
    /<tr>\s*<td\s+class=["']?Numcell["']?[^>]*>\s*(\d+)\s*<\/td>\s*<td\s+class=["']?(Pcell|NPcell)["']?[^>]*>([^<]*)<\/td>\s*<td\s+class=["']?Scell["']?[^>]*>(\d+)<br[\s\S]*?<td\s+class=["']?FFcell["']?[^>]*>([\s\S]*?)<\/table>\s*<\/td>\s*<td\s+class=["']?[WL]1cell["']?[^>]*>[\s\S]*?\/(\d+)\.png[\s\S]*?<i[^>]*>(\d+)<\/i>/gi;
  let m;
  while ((m = rowRe.exec(html))) {
    const ffHtml = m[5];
    const ffIds = [...ffHtml.matchAll(/\/(\d+)\.png/g)].map((x) => x[1]);
    rows.push({
      rank: Number(m[1]),
      player: m[3].replace(/\\_/g, "_").trim(),
      points: Number(m[4]),
      ffIds,
      finalsIds: finalsIdsFromFfCell(ffHtml),
      champId: m[6],
      tb: Number(m[7]) || 0,
      paid: m[2].toLowerCase() === "pcell",
    });
  }
  return rows;
}

/**
 * Compact layout (2023/2025): rank | name | pts_gap | FF×4 | champ_TB
 * @param {string} md
 */
function parseCompact(md) {
  const rows = [];
  for (const line of md.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    if (line.includes("---") || /Name_green|Name green/i.test(line)) continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((_, i, arr) => i > 0 && i < arr.length - 1);
    const rank = Number(cells[0]);
    if (!Number.isFinite(rank)) continue;
    const player = cells[1].replace(/\\_/g, "_").trim();
    const ptsMatch = cells[2].match(/^(\d+)/);
    const points = ptsMatch ? Number(ptsMatch[1]) : NaN;
    const ids = [...line.matchAll(/\/(\d+)\.png/g)].map((m) => m[1]);
    const ffIds = ids.slice(0, 4);
    const champId = ids[4] || "";
    const tbMatch = cells[4]?.match(/_(\d+)_/) || cells[4]?.match(/\b(\d+)\b/);
    const tb = tbMatch ? Number(tbMatch[1]) : 0;
    rows.push({
      rank,
      player,
      points,
      ffIds,
      finalsIds: ["", ""],
      champId,
      tb,
      paid: true,
    });
  }
  return rows;
}

/**
 * Wide layout (2021/2022): Rnk|Player|Pts|Diff|FF×4|Finals×2|Champ|TB|Paid
 * @param {string} md
 */
function parseWide(md) {
  const rows = [];
  for (const line of md.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    if (line.includes("---") || line.includes("Player") || line.includes("Rnk"))
      continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((_, i, arr) => i > 0 && i < arr.length - 1);
    const rank = Number(cells[0]);
    if (!Number.isFinite(rank)) continue;
    const player = cells[1].replace(/\\_/g, "_").trim();
    const points = Number(cells[2]);
    const ids = [...line.matchAll(/\/(\d+)\.png/g)].map((m) => m[1]);
    const ffIds = ids.slice(0, 4);
    const finalsIds = ids.slice(4, 6);
    const champId = ids[6] || "";
    const tb = Number(cells[11]) || 0;
    rows.push({
      rank,
      player,
      points,
      ffIds,
      finalsIds,
      champId,
      tb,
      paid: true,
    });
  }
  return rows;
}

/**
 * @param {number} year
 */
function buildYear(year) {
  const meta = YEAR_KEY[year];
  if (!meta) throw new Error(`No YEAR_KEY config for ${year}`);
  const mdPath = path.join(UPLOADS, meta.md);
  if (!fs.existsSync(mdPath)) {
    throw new Error(`Missing markdown: ${mdPath}`);
  }
  const md = fs.readFileSync(mdPath, "utf8");
  const raw =
    meta.layout === "wide"
      ? parseWide(md)
      : meta.layout === "abbr"
        ? parseAbbr(md)
        : meta.layout === "html-abbr"
          ? parseHtmlAbbr(md)
          : meta.layout === "html-compact"
            ? parseHtmlCompact(md)
            : parseCompact(md);
  if (raw.length < 10) {
    throw new Error(`${year}: parsed only ${raw.length} rows — check layout`);
  }

  const isAbbrLayout =
    meta.layout === "abbr" || meta.layout === "html-abbr";
  if (!isAbbrLayout) {
    const missing = new Set();
    for (const r of raw) {
      for (const id of [...r.ffIds, ...r.finalsIds, r.champId]) {
        if (id && !ID_TO_NAME[id]) missing.add(id);
      }
    }
    if (missing.size) {
      throw new Error(`${year}: unknown ESPN ids: ${[...missing].join(", ")}`);
    }
  } else {
    const missingNames = new Set();
    for (const r of raw) {
      for (const name of [...r.ffNames, ...r.finalsNames, r.champName]) {
        if (
          name &&
          !NAME_TO_ID[name] &&
          !PLACEHOLDER_TEAMS.has(name)
        ) {
          missingNames.add(name);
        }
      }
    }
    if (missingNames.size) {
      throw new Error(
        `${year}: no ESPN id for names: ${[...missingNames].join(", ")}`,
      );
    }
  }

  const teamLogos = {};
  for (const [id, name] of Object.entries(ID_TO_NAME)) {
    teamLogos[name] = `/logos/teams/${id}.png`;
  }

  /**
   * Product rule (Warren): every ≤2025 archive entry is Paid Yes on Standings,
   * even when Webnode used NPcell / Paid?=N for a few rows.
   */
  const entries = raw.map((r) => {
    if (isAbbrLayout) {
      const finalFour = [...r.ffNames];
      while (finalFour.length < 4) finalFour.push("");
      const finals = [...r.finalsNames];
      while (finals.length < 2) finals.push("");
      return {
        rank: r.rank,
        player: r.player,
        points: r.points,
        tbDiff: 0,
        finalFour: finalFour.slice(0, 4),
        finals: finals.slice(0, 2),
        champion: r.champName || "",
        tb: r.tb,
        paid: true,
      };
    }
    const finalFour = r.ffIds.map(nameFor);
    while (finalFour.length < 4) finalFour.push("");
    const finals = (r.finalsIds || []).map((id) => (id ? nameFor(id) : ""));
    while (finals.length < 2) finals.push("");
    return {
      rank: r.rank,
      player: r.player,
      points: r.points,
      tbDiff: 0,
      finalFour: finalFour.slice(0, 4),
      finals: finals.slice(0, 2),
      champion: r.champId ? nameFor(r.champId) : "",
      tb: r.tb,
      paid: true,
    };
  });

  const standingsData = {
    teamLogos,
    day: "Final",
    entries,
    lastUpdated: meta.lastUpdated,
    regionalChampionKey: meta.regionalChampionKey,
    quarterfinalWinners: [...meta.regionalChampionKey],
    semifinalWinners: [...meta.semifinalKey],
    semifinalKey: meta.semifinalKey,
    finalWinner: meta.finalWinner,
    eliminatedTeams: meta.eliminatedTeams,
    keyTieBreakerPopulated: false,
    legacyArchive: true,
  };

  const out = path.join(OUT_DIR, `${year}.json`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(out, JSON.stringify(standingsData, null, 2));
  console.log(`${year}: ${entries.length} entries → ${out}`);
  console.log(
    `  KEY FF: ${meta.regionalChampionKey.join(" | ")} → ${meta.finalWinner}`,
  );
  console.log(`  leader: ${entries[0].player} (${entries[0].points})`);
}

const arg = process.argv[2] || "all";
const years =
  arg === "all"
    ? [2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025]
    : [Number(arg)].filter(Boolean);

for (const y of years) {
  buildYear(y);
}
