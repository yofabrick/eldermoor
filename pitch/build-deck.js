const pptxgen = require("pptxgenjs");
const path = require("path");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "Eldermoor Concept";
pres.title = "Eldermoor — Pitch Deck";
pres.subject = "Original wizard-fantasy survival sandbox";

const C = {
  bg: "0B0A12",
  panel: "161322",
  panel2: "1C1830",
  gold: "C9A227",
  goldSoft: "E8D48B",
  vita: "6BCB8A",
  mortis: "A78BFA",
  text: "F4F0E6",
  muted: "A39BB8",
  danger: "E85D5D",
  line: "2E2848",
};

const art = (name) => path.join(__dirname, "..", "art", name);

function bg(slide) {
  slide.background = { color: C.bg };
}

function footer(slide, n, total) {
  slide.addText("ELDERMOOR  ·  CONFIDENTIAL CONCEPT", {
    x: 0.5, y: 5.25, w: 7, h: 0.25,
    fontSize: 10, fontFace: "Calibri", color: C.muted, margin: 0,
  });
  slide.addText(`${n} / ${total}`, {
    x: 8.5, y: 5.25, w: 1, h: 0.25,
    fontSize: 10, fontFace: "Calibri", color: C.muted, align: "right", margin: 0,
  });
}

const TOTAL = 10;

// 1 Title
{
  const s = pres.addSlide();
  bg(s);
  try {
    s.addImage({
      path: art("key-art-eldermoor.jpg"),
      x: 0, y: 0, w: 10, h: 5.625,
      sizing: { type: "cover", w: 10, h: 5.625 },
    });
  } catch (_) {}
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 5.625,
    fill: { color: C.bg, transparency: 45 },
  });
  s.addText("ELDERMOOR", {
    x: 0.6, y: 1.7, w: 8.8, h: 0.8,
    fontSize: 48, fontFace: "Georgia", color: C.goldSoft, bold: true, margin: 0,
  });
  s.addText("The wilderness does not grade you.", {
    x: 0.6, y: 2.55, w: 8.8, h: 0.4,
    fontSize: 20, fontFace: "Georgia", color: C.text, italic: true, margin: 0,
  });
  s.addText("Open-world survival  ·  Beast economy  ·  Vita / Mortis  ·  Co-op  ·  War on the High Council", {
    x: 0.6, y: 3.3, w: 8.8, h: 0.35,
    fontSize: 13, fontFace: "Calibri", color: C.muted, margin: 0,
  });
  s.addText("Concept pitch v0.2  ·  Original IP", {
    x: 0.6, y: 4.8, w: 8.8, h: 0.3,
    fontSize: 12, fontFace: "Calibri", color: C.gold, margin: 0,
  });
}

// 2 The gap
{
  const s = pres.addSlide();
  bg(s);
  footer(s, 2, TOTAL);
  s.addText("The gap", {
    x: 0.5, y: 0.35, w: 9, h: 0.5,
    fontSize: 32, fontFace: "Georgia", color: C.goldSoft, margin: 0,
  });
  s.addText("Palworld proved what happens when a giant IP ignores adult fans.\nWizard fantasy has the same hole — still unfilled.", {
    x: 0.5, y: 0.95, w: 9, h: 0.55,
    fontSize: 14, fontFace: "Calibri", color: C.muted, margin: 0,
  });

  const cards = [
    { t: "What fans want", items: ["Creatures as systems", "Own base / academy", "Real multiplayer", "Free experimental magic", "Agency, not school rails"] },
    { t: "What they got", items: ["Strong SP story tour", "Beasts as side content", "Little co-op fantasy", "Fenced dark paths", "Institutional caution"] },
    { t: "What we ship", items: ["Beast labor economy", "Camp → private academy", "Co-op from day one", "Vita vs Mortis identity", "Council as endgame war"] },
  ];
  cards.forEach((c, i) => {
    const x = 0.5 + i * 3.1;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.7, w: 2.95, h: 3.2,
      fill: { color: C.panel },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.7, w: 2.95, h: 0.08,
      fill: { color: i === 2 ? C.gold : C.line },
    });
    s.addText(c.t, {
      x: x + 0.15, y: 1.95, w: 2.65, h: 0.4,
      fontSize: 16, fontFace: "Georgia", color: C.goldSoft, margin: 0,
    });
    s.addText(c.items.map((t, idx) => ({
      text: t,
      options: { bullet: true, breakLine: idx < c.items.length - 1 },
    })), {
      x: x + 0.15, y: 2.5, w: 2.65, h: 2.2,
      fontSize: 13, fontFace: "Calibri", color: C.text, paraSpaceAfter: 6,
    });
  });
}

// 3 Pitch
{
  const s = pres.addSlide();
  bg(s);
  footer(s, 3, TOTAL);
  s.addText("The game", {
    x: 0.5, y: 0.35, w: 5, h: 0.45,
    fontSize: 32, fontFace: "Georgia", color: C.goldSoft, margin: 0,
  });
  s.addText("You wake discarded in the unsealed Wild Arcana with a weak wand and broken memories. Bind original beasts as workers and weapons. Build an enclave. Choose Life or Death magic. When your power cannot be ignored, the High Council marches.", {
    x: 0.5, y: 1.0, w: 5.2, h: 1.6,
    fontSize: 15, fontFace: "Calibri", color: C.text, margin: 0,
  });
  const pillars = [
    ["01", "Beasts first"],
    ["02", "Your enclave"],
    ["03", "Vita / Mortis"],
    ["04", "Native multiplayer"],
    ["05", "Nobody → threat"],
  ];
  pillars.forEach((p, i) => {
    const y = 2.75 + i * 0.4;
    s.addText(p[0], {
      x: 0.5, y, w: 0.55, h: 0.35,
      fontSize: 14, fontFace: "Georgia", color: C.gold, margin: 0,
    });
    s.addText(p[1], {
      x: 1.1, y, w: 4.5, h: 0.35,
      fontSize: 15, fontFace: "Calibri", color: C.text, margin: 0,
    });
  });
  try {
    s.addImage({
      path: art("player-concept.jpg"),
      x: 6.1, y: 0.9, w: 3.3, h: 4.0,
      sizing: { type: "cover", w: 3.3, h: 4.0 },
    });
  } catch (_) {
    s.addShape(pres.shapes.RECTANGLE, {
      x: 6.1, y: 0.9, w: 3.3, h: 4.0,
      fill: { color: C.panel },
    });
  }
}

// 4 Loop
{
  const s = pres.addSlide();
  bg(s);
  footer(s, 4, TOTAL);
  s.addText("Core loop", {
    x: 0.5, y: 0.35, w: 9, h: 0.45,
    fontSize: 32, fontFace: "Georgia", color: C.goldSoft, margin: 0,
  });
  s.addText("Proven Palworld / Ark skeleton — wizard systems on top.", {
    x: 0.5, y: 0.9, w: 9, h: 0.35,
    fontSize: 14, fontFace: "Calibri", color: C.muted, margin: 0,
  });
  const steps = [
    { n: "1", t: "Base", d: "Reassign beasts\nCheck production\nRepair defenses" },
    { n: "2", t: "Prepare", d: "Potions & gear\nCapture tools\nPath rites" },
    { n: "3", t: "Expedition", d: "Biome routes\nFarm & scout\nRead the wilds" },
    { n: "4", t: "Capture", d: "Soften\nOpportunity window\nMethod commit" },
    { n: "5", t: "Process", d: "Craft & upgrade\nIntegrate beasts\nRaise Heat" },
  ];
  steps.forEach((st, i) => {
    const x = 0.4 + i * 1.9;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.6, w: 1.75, h: 2.9,
      fill: { color: C.panel },
    });
    s.addText(st.n, {
      x, y: 1.8, w: 1.75, h: 0.45,
      fontSize: 28, fontFace: "Georgia", color: C.gold, align: "center", margin: 0,
    });
    s.addText(st.t, {
      x: x + 0.08, y: 2.35, w: 1.6, h: 0.4,
      fontSize: 16, fontFace: "Georgia", color: C.text, align: "center", margin: 0,
    });
    s.addText(st.d, {
      x: x + 0.1, y: 2.9, w: 1.55, h: 1.3,
      fontSize: 12, fontFace: "Calibri", color: C.muted, align: "center", margin: 0,
    });
  });
}

// 5 Capture
{
  const s = pres.addSlide();
  bg(s);
  footer(s, 5, TOTAL);
  s.addText("Capture is skill", {
    x: 0.5, y: 0.35, w: 5, h: 0.45,
    fontSize: 32, fontFace: "Georgia", color: C.goldSoft, margin: 0,
  });
  s.addText("Not “HP low → ball.” Soften → opportunity window → commit method.", {
    x: 0.5, y: 0.95, w: 5.2, h: 0.5,
    fontSize: 14, fontFace: "Calibri", color: C.muted, margin: 0,
  });
  const methods = [
    ["Snare circle", "Placement & kite"],
    ["Bait offering", "Species knowledge"],
    ["Bonding focus", "Channel under fire"],
    ["Pact ritual", "Setup / co-op"],
    ["Dominance brand", "Mortis control"],
    ["Sever-bind", "High-risk last second"],
  ];
  methods.forEach((m, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.5 + col * 2.7;
    const y = 1.65 + row * 0.95;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 2.55, h: 0.85,
      fill: { color: C.panel },
    });
    s.addText(m[0], {
      x: x + 0.15, y: y + 0.12, w: 2.25, h: 0.3,
      fontSize: 14, fontFace: "Georgia", color: C.goldSoft, margin: 0,
    });
    s.addText(m[1], {
      x: x + 0.15, y: y + 0.42, w: 2.25, h: 0.3,
      fontSize: 12, fontFace: "Calibri", color: C.muted, margin: 0,
    });
  });
  try {
    s.addImage({
      path: art("moment-capture.jpg"),
      x: 6.0, y: 1.2, w: 3.5, h: 3.5,
      sizing: { type: "cover", w: 3.5, h: 3.5 },
    });
  } catch (_) {}
}

// 6 Vita Mortis
{
  const s = pres.addSlide();
  bg(s);
  footer(s, 6, TOTAL);
  s.addText("Vita  /  Mortis", {
    x: 0.5, y: 0.35, w: 9, h: 0.5,
    fontSize: 32, fontFace: "Georgia", color: C.goldSoft, margin: 0,
  });
  s.addText("A real identity fork — rewrites beasts, base, economy, heat, and endings.", {
    x: 0.5, y: 0.95, w: 9, h: 0.35,
    fontSize: 14, fontFace: "Calibri", color: C.muted, margin: 0,
  });
  // Vita panel
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 1.5, w: 4.35, h: 3.3,
    fill: { color: C.panel },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 1.5, w: 0.12, h: 3.3,
    fill: { color: C.vita },
  });
  s.addText("VITA — Life", {
    x: 0.9, y: 1.7, w: 3.7, h: 0.4,
    fontSize: 20, fontFace: "Georgia", color: C.vita, margin: 0,
  });
  s.addText([
    { text: "Pacts, healing, reclamation", options: { bullet: true, breakLine: true } },
    { text: "Loyal partners, breeding quality", options: { bullet: true, breakLine: true } },
    { text: "Stable compound growth", options: { bullet: true, breakLine: true } },
    { text: "Lower heat, sanctuary fantasy", options: { bullet: true } },
  ], {
    x: 0.9, y: 2.3, w: 3.7, h: 2.2,
    fontSize: 14, fontFace: "Calibri", color: C.text, paraSpaceAfter: 8,
  });
  // Mortis panel
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.15, y: 1.5, w: 4.35, h: 3.3,
    fill: { color: C.panel },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 5.15, y: 1.5, w: 0.12, h: 3.3,
    fill: { color: C.mortis },
  });
  s.addText("MORTIS — Death", {
    x: 5.55, y: 1.7, w: 3.7, h: 0.4,
    fontSize: 20, fontFace: "Georgia", color: C.mortis, margin: 0,
  });
  s.addText([
    { text: "Brands, sacrifice, corruption", options: { bullet: true, breakLine: true } },
    { text: "Thralls, mutations, spikes", options: { bullet: true, breakLine: true } },
    { text: "Aggressive shortcuts", options: { bullet: true, breakLine: true } },
    { text: "Higher heat, siege fantasy", options: { bullet: true } },
  ], {
    x: 5.55, y: 2.3, w: 3.7, h: 2.2,
    fontSize: 14, fontFace: "Calibri", color: C.text, paraSpaceAfter: 8,
  });
}

// 7 Story endgame
{
  const s = pres.addSlide();
  bg(s);
  footer(s, 7, TOTAL);
  s.addText("Story spine", {
    x: 0.5, y: 0.35, w: 9, h: 0.45,
    fontSize: 32, fontFace: "Georgia", color: C.goldSoft, margin: 0,
  });
  const beats = [
    { t: "Discarded", d: "Wake with fragments. Nobody." },
    { t: "Enclave", d: "Beasts + base. Optional memories." },
    { t: "Fork", d: "Vita or Mortis commitment." },
    { t: "Heat", d: "Watchers → Inquisitors." },
    { t: "War", d: "Armies. Academies. Council." },
    { t: "Aftermath", d: "Destroy / rule / reform / unseal." },
  ];
  beats.forEach((b, i) => {
    const x = 0.45 + (i % 3) * 3.15;
    const y = 1.15 + Math.floor(i / 3) * 1.85;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 3.0, h: 1.6,
      fill: { color: C.panel },
    });
    s.addText(`${i + 1}`, {
      x: x + 0.15, y: y + 0.2, w: 0.5, h: 0.35,
      fontSize: 18, fontFace: "Georgia", color: C.gold, margin: 0,
    });
    s.addText(b.t, {
      x: x + 0.15, y: y + 0.55, w: 2.7, h: 0.35,
      fontSize: 16, fontFace: "Georgia", color: C.text, margin: 0,
    });
    s.addText(b.d, {
      x: x + 0.15, y: y + 0.95, w: 2.7, h: 0.4,
      fontSize: 13, fontFace: "Calibri", color: C.muted, margin: 0,
    });
  });
}

// 8 Slice
{
  const s = pres.addSlide();
  bg(s);
  footer(s, 8, TOTAL);
  s.addText("Vertical slice — First Sealbreak", {
    x: 0.5, y: 0.35, w: 9, h: 0.5,
    fontSize: 28, fontFace: "Georgia", color: C.goldSoft, margin: 0,
  });
  const left = [
    "Thornwake Glade + Blackvein Mire",
    "12 catchable beasts (roster locked)",
    "Multi-method capture + opportunity window",
    "Base: shelter, 3 stations, pen, defenses",
    "Path fork ritual (Vita / Mortis)",
    "Co-op 1–4 on shared base",
    "Ashcrown elite encounter",
  ];
  const right = [
    "Full Council war",
    "Breeding / 100+ dex",
    "Megaserver politics",
    "Romance systems",
    "Live-ops battle pass",
  ];
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 1.1, w: 5.4, h: 3.7,
    fill: { color: C.panel },
  });
  s.addText("IN SCOPE", {
    x: 0.75, y: 1.3, w: 5, h: 0.35,
    fontSize: 14, fontFace: "Calibri", color: C.vita, bold: true, margin: 0,
  });
  s.addText(left.map((t, i) => ({
    text: t,
    options: { bullet: true, breakLine: i < left.length - 1 },
  })), {
    x: 0.75, y: 1.8, w: 4.9, h: 2.8,
    fontSize: 14, fontFace: "Calibri", color: C.text, paraSpaceAfter: 6,
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.15, y: 1.1, w: 3.35, h: 3.7,
    fill: { color: C.panel },
  });
  s.addText("OUT", {
    x: 6.4, y: 1.3, w: 2.9, h: 0.35,
    fontSize: 14, fontFace: "Calibri", color: C.danger, bold: true, margin: 0,
  });
  s.addText(right.map((t, i) => ({
    text: t,
    options: { bullet: true, breakLine: i < right.length - 1 },
  })), {
    x: 6.4, y: 1.8, w: 2.9, h: 2.6,
    fontSize: 14, fontFace: "Calibri", color: C.text, paraSpaceAfter: 8,
  });
}

// 9 Market
{
  const s = pres.addSlide();
  bg(s);
  footer(s, 9, TOTAL);
  s.addText("Positioning", {
    x: 0.5, y: 0.35, w: 9, h: 0.45,
    fontSize: 32, fontFace: "Georgia", color: C.goldSoft, margin: 0,
  });
  s.addTable([
    [
      { text: "Axis", options: { bold: true, color: C.goldSoft, fill: { color: C.panel2 } } },
      { text: "Legacy-likes", options: { bold: true, color: C.goldSoft, fill: { color: C.panel2 } } },
      { text: "Palworld-likes", options: { bold: true, color: C.goldSoft, fill: { color: C.panel2 } } },
      { text: "Eldermoor", options: { bold: true, color: C.goldSoft, fill: { color: C.panel2 } } },
    ],
    ["Creature core", "Light", "Yes", "Yes + magic methods"],
    ["Base automation", "No", "Yes", "Yes (path-themed)"],
    ["Multiplayer", "No / weak", "Yes", "Yes day-1"],
    ["Identity path", "Limited", "Tech/guns", "Vita / Mortis"],
    ["Endgame war", "Story boss", "Light", "Institutions"],
    ["IP risk", "Licensed", "Original", "Original"],
  ], {
    x: 0.5, y: 1.1, w: 9, h: 3.6,
    colW: [1.8, 2.2, 2.4, 2.6],
    border: { pt: 0.5, color: C.line },
    fontFace: "Calibri",
    fontSize: 12,
    color: C.text,
    align: "center",
    valign: "middle",
  });
}

// 10 Ask
{
  const s = pres.addSlide();
  bg(s);
  footer(s, 10, TOTAL);
  s.addText("Next / ask", {
    x: 0.5, y: 0.35, w: 9, h: 0.5,
    fontSize: 32, fontFace: "Georgia", color: C.goldSoft, margin: 0,
  });
  s.addText("Greenlight a vertical slice that proves one sentence:", {
    x: 0.5, y: 1.0, w: 9, h: 0.4,
    fontSize: 16, fontFace: "Calibri", color: C.muted, margin: 0,
  });
  s.addText("“I assigned a beast to work, caught something harder, and want one more expedition.”", {
    x: 0.5, y: 1.5, w: 9, h: 0.7,
    fontSize: 20, fontFace: "Georgia", color: C.text, italic: true, margin: 0,
  });
  const next = [
    { n: "01", t: "Engine + greybox loop" },
    { n: "02", t: "Capture window prototype" },
    { n: "03", t: "12-beast blockout" },
    { n: "04", t: "4p co-op soak test" },
    { n: "05", t: "Steam page from slice only" },
  ];
  next.forEach((item, i) => {
    const x = 0.5 + i * 1.85;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 2.5, w: 1.75, h: 1.8,
      fill: { color: C.panel },
    });
    s.addText(item.n, {
      x, y: 2.7, w: 1.75, h: 0.4,
      fontSize: 18, fontFace: "Georgia", color: C.gold, align: "center", margin: 0,
    });
    s.addText(item.t, {
      x: x + 0.1, y: 3.3, w: 1.55, h: 0.8,
      fontSize: 13, fontFace: "Calibri", color: C.text, align: "center", margin: 0,
    });
  });
  s.addText("Package: C:\\Users\\fabia\\mages  ·  Original IP  ·  PC Early Access intent", {
    x: 0.5, y: 4.6, w: 9, h: 0.3,
    fontSize: 12, fontFace: "Calibri", color: C.muted, margin: 0,
  });
}

pres.writeFile({ fileName: path.join(__dirname, "eldermoor-pitch-deck.pptx") })
  .then(() => console.log("Wrote eldermoor-pitch-deck.pptx"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
