/*
 * Acts 1-2 content and matching logic. IntroCore is pure (no DOM) so the
 * tests can drive the war-dialer and the research archive headless.
 * Requires parser.js (norm). The scenes in main.js render it.
 *
 * All phone numbers use the fictional (311) area code so nothing here
 * dials a real exchange.
 */

const IntroCore = (() => {
  const AREA = "(311)";
  const WOPR_NUMBER = AREA + " 399-2364";

  // The overnight sweep of the Sunnyvale 399 exchange. Exactly one entry
  // is the unmarked target (WOPR); the rest are flavor. Last-4 digits are
  // unique so a dialed number maps to one entry.
  const SCAN = [
    { num: "399-0017", result: "RING — NO ANSWER" },
    { num: "399-0941", result: "VOICE" },
    { num: "399-1450", result: "BUSY" },
    {
      num: "399-1972",
      result: "CONNECT 300",
      banner: "PAN-CONTINENTAL AIRLINES — RESERVATION SYSTEM",
    },
    { num: "399-2010", result: "NO CARRIER" },
    { num: "399-2364", result: "CONNECT 1200", banner: "(no system banner)", target: true },
    {
      num: "399-2911",
      result: "CONNECT 300",
      banner: "SUNNYVALE FIRST FEDERAL S&L — ENTER ACCOUNT + PIN",
    },
    {
      num: "399-3000",
      result: "VOICE",
      banner: '"...REACHED THE OFFICE OF DR. HALCYON, DDS. WE ARE CLOSED..."',
    },
    { num: "399-3141", result: "NO CARRIER" },
    {
      num: "399-4002",
      result: "NO CARRIER",
      banner: "PROTOVISION INC. — LINE DISCONNECTED",
    },
    { num: "399-4567", result: "RING — NO ANSWER" },
  ];

  const last4 = (s) => String(s).replace(/\D/g, "").slice(-4);

  function carriers() {
    return SCAN.filter((e) => /^CONNECT/.test(e.result) || e.target);
  }

  // Classify a dialed number: target | flavor | nocarrier | empty.
  function dialResult(input) {
    const digits = String(input).replace(/\D/g, "");
    if (!digits) return { type: "empty" };
    const key = last4(digits);
    const entry = SCAN.find((e) => last4(e.num) === key);
    if (!entry) return { type: "nocarrier" };
    if (entry.target) return { type: "target", entry };
    return { type: "flavor", entry };
  }

  // Research archive. Order matters: more specific topics are checked
  // first so "falken obituary" resolves to the obituary, not the profile.
  const ARTICLES = [
    {
      id: "joshua",
      aliases: [
        "joshua",
        "joshua falken",
        "obituary",
        "falken son",
        "falken obituary",
        "falkens son",
        "1973",
      ],
      title: "OBITUARY — KING COUNTY HERALD, 1973",
      body: [
        "FALKEN, JOSHUA. BELOVED SON OF STEPHEN W. FALKEN.",
        "BORN 1968. DIED 1973, AGE FIVE.",
        '"HE LOVED THE GAMES HIS FATHER MADE FOR HIM."',
      ],
      nudge:
        "Joshua. The dead son, and the name a grieving father would hide a door behind. Try JOSHUA at the LOGON prompt.",
      revealsPassword: true,
    },
    {
      id: "falken",
      aliases: ["falken", "stephen falken", "s falken", "dr falken", "the designer"],
      title: "PROFILE — STEPHEN W. FALKEN",
      body: [
        "FALKEN, STEPHEN W. RESEARCHER IN ARTIFICIAL INTELLIGENCE.",
        "PIONEERED PROGRAMS THAT LEARN FROM THEIR OWN PLAY. UNDER",
        "CONTRACT TO DEFENSE PROJECTS THROUGH THE 1970S.",
        "WITHDREW FROM PUBLIC LIFE AFTER A FAMILY TRAGEDY IN 1973.",
        "KNOWN TO NAME HIS PROGRAMS AFTER MEMBERS OF HIS FAMILY.",
        "SEE ALSO: FALKEN, JOSHUA (OBITUARY, 1973).",
      ],
      nudge:
        "He named his programs after family, and there's a 1973 obituary. RESEARCH JOSHUA.",
    },
    {
      id: "protovision",
      aliases: ["protovision", "proto vision", "the games", "video games"],
      title: "LISTING — PROTOVISION INC.",
      body: [
        "PROTOVISION INC. SUNNYVALE GAME STARTUP. UNRELEASED TITLES.",
        "TELEPHONE LINE DISCONNECTED.",
        "THE COMPANY YOU WENT LOOKING FOR IS A DEAD END.",
        "THE SYSTEM YOU FOUND INSTEAD IS NOT.",
      ],
    },
  ];

  function research(query) {
    const q = norm(query);
    if (!q) return null;
    // Match an article when the query equals an alias or contains one as a
    // whole phrase. Articles are checked most-specific first, so
    // "falken obituary" resolves to the obituary rather than the profile.
    for (const art of ARTICLES) {
      for (const alias of art.aliases) {
        const na = norm(alias);
        if (q === na || q.includes(na)) return art;
      }
    }
    return null;
  }

  const TOPICS = [
    ["FALKEN", "the name behind the system"],
    ["PROTOVISION", "the company you went looking for"],
  ];

  return { AREA, WOPR_NUMBER, SCAN, carriers, dialResult, research, ARTICLES, TOPICS, last4 };
})();
