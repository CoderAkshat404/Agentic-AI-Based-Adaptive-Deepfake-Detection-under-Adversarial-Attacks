// Builds the group presentation. Run: node build_deck.js  -> Agentic_Deepfake_Detection_Presentation.pptx
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const React = require("react");
const RDS = require("react-dom/server");
const sharp = require("sharp");
const Fa = require("react-icons/fa");
// Optional helper that writes the theme colours into the .pptx (set APPLY_THEME_JS to its path); the deck builds without it.
let applyTheme = null;
try { applyTheme = require(process.env.APPLY_THEME_JS || "./apply_theme.js").applyTheme; } catch (e) { console.warn("apply_theme.js not found - theme colours fall back to Office defaults for scheme colours"); }

const A = f => path.join(__dirname, "assets", f);
const META = JSON.parse(fs.readFileSync(A("meta.json"), "utf8"));
const LOGO = path.join(__dirname, "..", "figures", "nitrr_logo.png");
const OUTFILE = path.join(__dirname, "Agentic_Deepfake_Detection_Presentation.pptx");

const THEME = {
  name: "Agentic Shield", headFontFace: "Arial", bodyFontFace: "Calibri",
  colors: { dk1: "0B1220", lt1: "F1F5F9", dk2: "16213A", lt2: "94A3B8", accent1: "22D3EE", accent2: "3B82F6",
    accent3: "F43F5E", accent4: "22C55E", accent5: "F59E0B", accent6: "A78BFA", hlink: "22D3EE", folHlink: "A78BFA" },
};
const BG = "0B1220";
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";                                  // 13.333 x 7.5 in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Agentic AI-Based Adaptive Deepfake Detection under Adversarial Attacks";
pres.author = "Akshat Mishra, Gourav Deep Shahni, Harsh Mehar";
pres.company = "NIT Raipur";
const C = pres.SchemeColor;
const TXT = C.background1, MUTED = C.background2, PANEL = C.text2, CYAN = C.accent1, BLUE = C.accent2,
  RED = C.accent3, GREEN = C.accent4, AMBER = C.accent5;
const W = 13.333;

// ------------------------------------------------------------------------------------------------ icons
async function icon(name, color = "#0B1220", size = 256) {
  const svg = RDS.renderToStaticMarkup(React.createElement(Fa[name], { color, size: String(size) }));
  return "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
}

// ------------------------------------------------------------------------------------------------ layouts
const FOOT = "Agentic AI-Based Adaptive Deepfake Detection under Adversarial Attacks  |  NIT Raipur";
const footerObjs = [{ text: { text: FOOT, options: { x: 0.6, y: 7.02, w: 9, h: 0.3, fontSize: 10, color: MUTED, margin: 0 } } }];
const titlePh = { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.35, w: 12.1, h: 0.85, fontSize: 32,
  bold: true, color: TXT, fontFace: "Arial", valign: "middle", align: "left", margin: 0 }, text: "" } };
pres.defineSlideMaster({ title: "Title Dark", background: { color: BG }, objects: [] });
pres.defineSlideMaster({ title: "Section", background: { color: BG },
  objects: [{ placeholder: { options: { name: "title", type: "title", x: 1.2, y: 2.75, w: 10.5, h: 1.2, fontSize: 44, bold: true,
    color: TXT, fontFace: "Arial", align: "left", margin: 0 }, text: "" } },
  { placeholder: { options: { name: "body", type: "body", x: 1.2, y: 4.05, w: 10.5, h: 0.9, fontSize: 20, color: MUTED, align: "left", margin: 0 }, text: "" } }] });
pres.defineSlideMaster({ title: "Content", background: { color: BG }, objects: [titlePh, ...footerObjs],
  slideNumber: { x: 12.2, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: MUTED, align: "right" } });
pres.defineSlideMaster({ title: "Content Open", background: { color: BG },
  objects: [titlePh, ...footerObjs, { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 1.45, w: 12.1, h: 5.3,
    fontSize: 18, color: TXT, valign: "top", align: "left" }, text: "Add your content here" } }],
  slideNumber: { x: 12.2, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: MUTED, align: "right" } });

// ------------------------------------------------------------------------------------------------ helpers
const shadow = () => ({ type: "outer", blur: 8, offset: 3, angle: 90, color: "000000", opacity: 0.35 });
function card(s, x, y, w, h, o = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: o.fill || PANEL },
    line: o.line ? { color: o.line, width: o.lw || 1.5 } : { type: "none" }, shadow: o.noShadow ? undefined : shadow() });
}
function text(s, t, x, y, w, h, o = {}) {
  s.addText(t, { x, y, w, h, isTextBox: true, margin: o.margin ?? 0, fontFace: o.font, fontSize: o.size || 16, color: o.color || TXT,
    bold: o.bold, italic: o.italic, align: o.align || "left", valign: o.valign || "top", lineSpacingMultiple: o.ls, paraSpaceAfter: o.psa });
}
function frame(s, img, x, y, w, h, color = CYAN) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - 0.06, y: y - 0.06, w: w + 0.12, h: h + 0.12, rectRadius: 0.08,
    fill: { color: PANEL }, line: { color, width: 2 } });
  s.addImage({ path: img, x, y, w, h });
}
function iconCircle(s, data, x, y, d, fill = CYAN) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { type: "none" } });
  s.addImage({ data, x: x + d * 0.24, y: y + d * 0.24, w: d * 0.52, h: d * 0.52 });
}
function arrow(s, x1, y1, x2, y2, color = CYAN, width = 2.5) {
  s.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
    flipH: x2 < x1, flipV: y2 < y1, line: { color, width, endArrowType: "triangle" } });
}
function chip(s, t, x, y, w, fill, color = "0B1220", size = 14) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.42, rectRadius: 0.2, fill: { color: fill }, line: { type: "none" } });
  text(s, t, x, y, w, 0.42, { size, bold: true, color, align: "center", valign: "middle" });
}
const pct = p => `${Math.round(p * 100)}%`;

// ================================================================================================ SLIDES
(async () => {
  const I = {};
  for (const [k, n, c] of [["robot", "FaRobot", "#0B1220"], ["money", "FaMoneyBillWave", "#0B1220"], ["news", "FaNewspaper", "#0B1220"],
    ["id", "FaIdCard", "#0B1220"], ["search", "FaSearch", "#0B1220"], ["crop", "FaCropAlt", "#0B1220"], ["brain", "FaBrain", "#0B1220"],
    ["check", "FaCheckCircle", "#0B1220"], ["book", "FaBookOpen", "#0B1220"], ["eye", "FaEye", "#0B1220"], ["balance", "FaBalanceScale", "#0B1220"],
    ["image", "FaImage", "#0B1220"], ["compass", "FaCompass", "#0B1220"], ["plusminus", "FaPlusCircle", "#0B1220"], ["bolt", "FaBolt", "#0B1220"],
    ["random", "FaRandom", "#0B1220"], ["redo", "FaRedo", "#0B1220"], ["fence", "FaBorderAll", "#0B1220"], ["shield", "FaShieldAlt", "#0B1220"],
    ["broom", "FaBroom", "#0B1220"], ["users", "FaUsers", "#0B1220"], ["comment", "FaCommentDots", "#0B1220"], ["question", "FaQuestion", "#22D3EE"],
    ["warn", "FaExclamationTriangle", "#0B1220"], ["play", "FaChartLine", "#0B1220"], ["layers", "FaLayerGroup", "#0B1220"]]) I[k] = await icon(n, c);

  // ---------------------------------------------------------------------------------------------- PART 1 (Akshat)
  pres.addSection({ title: "Part 1 – The Problem (Akshat Mishra)" });

  // 1. Title
  let s = pres.addSlide({ masterName: "Title Dark", sectionTitle: "Part 1 – The Problem (Akshat Mishra)" });
  s.addImage({ path: LOGO, x: 0.7, y: 0.55, w: 0.93, h: 1.0 });
  text(s, "National Institute of Technology Raipur", 1.8, 0.66, 6, 0.4, { size: 18, bold: true });
  text(s, "Department of Information Technology", 1.8, 1.06, 6, 0.4, { size: 15, color: MUTED });
  s.addText([{ text: "Agentic AI-Based Adaptive", options: { breakLine: true } }, { text: "Deepfake Detection", options: { breakLine: true } },
    { text: "under Adversarial Attacks", options: { color: CYAN } }],
  { x: 0.7, y: 1.95, w: 7.6, h: 2.3, isTextBox: true, margin: 0, fontFace: "Arial", fontSize: 40, bold: true, color: TXT, valign: "top" });
  text(s, "Minor Project  ·  B.Tech Information Technology  ·  Semester VII", 0.7, 4.35, 7.6, 0.4, { size: 16, color: MUTED });
  [["Akshat Mishra", "23118006"], ["Gourav Deep Shahni", "23118037"], ["Harsh Mehar", "23118039"]].forEach(([n, r], i) => {
    card(s, 0.7 + i * 2.55, 5.05, 2.35, 0.95);
    text(s, n, 0.82 + i * 2.55, 5.14, 2.15, 0.45, { size: 15, bold: true, align: "center", valign: "middle" });
    text(s, r, 0.82 + i * 2.55, 5.52, 2.15, 0.35, { size: 13, color: MUTED, align: "center" });
  });
  text(s, [{ text: "Guided by: ", options: { color: MUTED } }, { text: "Dr. Suvendu Rup", options: { bold: true } }], 0.7, 6.3, 7.5, 0.4, { size: 16 });
  frame(s, A("face_original.png"), 8.75, 1.15, 3.9, 3.9);
  chip(s, "REAL or FAKE?", 9.45, 4.7, 2.5, CYAN, "0B1220", 16);
  text(s, "And can an attacker fool the AI that decides?", 8.6, 5.55, 4.2, 0.8, { size: 15, italic: true, color: MUTED, align: "center" });
  s.addNotes("Good morning. We are Akshat, Gourav and Harsh, and our project is Agentic AI-Based Adaptive Deepfake Detection under Adversarial Attacks, guided by Dr. Suvendu Rup. In simple words: we built an AI system that detects fake faces, and that keeps working even when an attacker tries to trick it. I will start with the problem.");

  // 2. Roadmap
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Part 1 – The Problem (Akshat Mishra)" });
  s.addText("Today's Journey", { placeholder: "title" });
  const road = [["01", "The Problem", ["What deepfakes are", "How traditional detection works", "How FGSM and PGD attacks fool it"], I.warn, RED],
    ["02", "Our Solution", ["Agentic AI: 4 cooperating agents", "Detect → clean → re-route → verify", "4 different AI models"], I.users, CYAN],
    ["03", "Results & Demo", ["Traditional vs Agentic AI", "Live dashboard demo", "Limitations and future work"], I.play, GREEN]];
  road.forEach(([num, head, items, ic, col], i) => {
    const x = 0.6 + i * 4.18;
    card(s, x, 1.55, 3.75, 4.6, i === 0 ? { line: CYAN, lw: 2.5 } : {});
    iconCircle(s, ic, x + 0.35, 1.9, 0.95, col);
    text(s, num, x + 2.55, 1.95, 0.9, 0.8, { size: 36, bold: true, color: MUTED, align: "right", font: "Arial" });
    text(s, head, x + 0.35, 3.05, 3.1, 0.55, { size: 24, bold: true, font: "Arial" });
    s.addText(items.map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < items.length - 1 } })),
      { x: x + 0.35, y: 3.75, w: 3.15, h: 1.9, isTextBox: true, fontSize: 16, color: TXT, paraSpaceAfter: 8, margin: 0, valign: "top" });
    if (i < 2) arrow(s, x + 3.82, 3.85, x + 4.12, 3.85, CYAN, 3);
  });
  chip(s, "You are here", 1.38, 5.6, 2.2, CYAN, "0B1220", 14);
  s.addNotes("Our talk has three parts. First, I will explain the problem: what deepfakes are, how a normal detector works, and how two attacks called FGSM and PGD can fool it. Then my teammates will present our solution, the four AI agents, and finally the results and a live demo.");

  // 3. Section divider
  s = pres.addSlide({ masterName: "Section", sectionTitle: "Part 1 – The Problem (Akshat Mishra)" });
  s.addImage({ path: A("noise_pgd.png"), x: 8.4, y: 0, w: 4.933, h: 7.5, transparency: 70, sizing: { type: "cover", w: 4.933, h: 7.5 } });
  text(s, "01", 1.2, 1.35, 3, 1.3, { size: 80, bold: true, color: CYAN, font: "Arial" });
  s.addText("The Problem", { placeholder: "title" });
  s.addText("Introduction  ·  Traditional detection  ·  FGSM & PGD attacks", { placeholder: "body" });
  text(s, "Presented by Akshat Mishra (23118006)", 1.2, 5.2, 7, 0.4, { size: 16, color: TXT, bold: true });
  s.addNotes("Part one: the problem.");

  // 4. What is a deepfake
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Part 1 – The Problem (Akshat Mishra)" });
  s.addText("What is a Deepfake?", { placeholder: "title" });
  card(s, 0.6, 1.5, 6.1, 1.35, { fill: PANEL, line: CYAN });
  text(s, [{ text: "A deepfake is a ", options: {} }, { text: "fake photo or video of a person", options: { bold: true, color: CYAN } },
    { text: ", made by AI, that looks completely real.", options: {} }], 0.85, 1.62, 5.7, 1.1, { size: 20, valign: "middle" });
  [[I.money, "Fraud and scams", "Fake video calls pretending to be a boss or a family member"],
    [I.news, "Fake news", "Leaders shown 'saying' things they never said"],
    [I.id, "Identity theft", "Fooling face-unlock and online identity (KYC) checks"]].forEach(([ic, h, d], i) => {
    const y = 3.2 + i * 1.18;
    iconCircle(s, ic, 0.6, y, 0.85, i === 0 ? AMBER : i === 1 ? RED : BLUE);
    text(s, h, 1.65, y + 0.02, 5, 0.4, { size: 18, bold: true });
    text(s, d, 1.65, y + 0.42, 5.05, 0.5, { size: 15, color: MUTED });
  });
  frame(s, "C:/Users/PC-ACER/AgenticDeepfakeShield/samples/real_08.jpg", 7.35, 1.7, 2.3, 2.3, GREEN);
  frame(s, "C:/Users/PC-ACER/AgenticDeepfakeShield/samples/fake_01.jpg", 10.4, 1.7, 2.3, 2.3, RED);
  iconCircle(s, I.robot, 9.69, 2.42, 0.68, CYAN);
  chip(s, "REAL photo", 7.6, 4.2, 1.8, GREEN);
  chip(s, "DEEPFAKE", 10.65, 4.2, 1.8, RED, "FFFFFF");
  card(s, 7.3, 4.95, 5.45, 1.75, { noShadow: true });
  text(s, [{ text: "How are they made? ", options: { bold: true, color: CYAN } },
    { text: "An AI (for example a GAN) learns what real faces look like, then creates or swaps faces so well that people cannot tell the difference.", options: {} }],
  7.5, 5.08, 5.1, 1.5, { size: 15, valign: "middle" });
  s.addNotes("A deepfake is a fake photo or video of a person that is made by AI but looks completely real. The AI, for example a GAN, learns what real faces look like and then creates or swaps faces. Deepfakes are used for scams, like fake video calls from your boss, for fake news, and to fool face-unlock and online identity checks. Because people cannot tell them apart, we need AI to detect them.");

  // 5. Quiz
  const Q = META.quiz;
  const gridPos = i => ({ x: 0.75 + (i % 3) * 2.3, y: 1.55 + Math.floor(i / 3) * 2.62 });
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Part 1 – The Problem (Akshat Mishra)" });
  s.addText("Can You Spot the Deepfake?", { placeholder: "title" });
  Q.forEach((q, i) => {
    const { x, y } = gridPos(i);
    frame(s, A(`quiz_${q.name}.png`), x, y, 2.0, 2.0, "475569");
    s.addShape(pres.shapes.OVAL, { x: x - 0.15, y: y - 0.15, w: 0.5, h: 0.5, fill: { color: CYAN }, line: { color: BG, width: 2 } });
    text(s, String(i + 1), x - 0.15, y - 0.15, 0.5, 0.5, { size: 16, bold: true, color: "0B1220", align: "center", valign: "middle" });
  });
  card(s, 7.85, 1.55, 4.85, 4.62);
  s.addImage({ data: I.question, x: 9.68, y: 1.85, w: 1.2, h: 1.2 });
  text(s, "3 of these 6 faces are fake.", 8.1, 3.25, 4.35, 0.5, { size: 22, bold: true, align: "center" });
  text(s, "Which ones?", 8.1, 3.75, 4.35, 0.5, { size: 22, bold: true, color: CYAN, align: "center" });
  text(s, "Take 10 seconds. Modern deepfakes are so realistic that most people can only guess.", 8.15, 4.55, 4.3, 1.2, { size: 16, color: MUTED, align: "center" });
  s.addNotes("Let us try a quick test. Three of these six faces are fake. Can you spot them? Take ten seconds. Most people can only guess, and this is exactly why we need an AI detector.");

  // 6. Reveal
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Part 1 – The Problem (Akshat Mishra)" });
  s.addText("The Answer: The AI Can See What We Can't", { placeholder: "title" });
  Q.forEach((q, i) => {
    const { x, y } = gridPos(i);
    const fake = q.truth === "FAKE";
    frame(s, A(`quiz_${q.name}.png`), x, y, 2.0, 2.0, fake ? RED : GREEN);
    chip(s, fake ? "FAKE" : "REAL", x + 0.45, y + 1.68, 1.1, fake ? RED : GREEN, fake ? "FFFFFF" : "0B1220", 13);
    text(s, `AI fake score: ${pct(q.p_fake)}`, x - 0.05, y + 2.14, 2.1, 0.32, { size: 12, color: MUTED, align: "center" });
  });
  card(s, 7.85, 1.55, 4.85, 4.62);
  iconCircle(s, I.check, 9.75, 1.8, 1.05, GREEN);
  text(s, "Our trained AI model got all 6 right.", 8.1, 3.05, 4.35, 0.8, { size: 20, bold: true, align: "center" });
  s.addText([{ text: "It notices tiny clues our eyes miss:", options: { breakLine: true, color: MUTED } },
    { text: "skin texture", options: { bullet: true, breakLine: true } }, { text: "blending edges around the face", options: { bullet: true, breakLine: true } },
    { text: "lighting and fine pixel patterns", options: { bullet: true } }],
  { x: 8.25, y: 3.95, w: 4.2, h: 1.9, isTextBox: true, fontSize: 16, color: TXT, paraSpaceAfter: 4, margin: 0, valign: "top" });
  s.addNotes("Here is the answer: numbers 2, 4 and 6 are fake. Our trained AI model, the traditional detector, got all six right. It notices tiny clues our eyes miss, like skin texture, blending edges and lighting. So AI detection works, at least when nobody is attacking it.");

  // 7. Traditional detection flow
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Part 1 – The Problem (Akshat Mishra)" });
  s.addText("How Traditional Detection Works", { placeholder: "title" });
  const flow = [["Input photo", null, A("quiz_fake_07.png")], ["Find the face", I.search], ["Crop & resize\n224 × 224", I.crop],
    ["AI model (CNN)\nEfficientNet-B0", I.brain], [`Verdict:\nFAKE (${(Q[3].p_fake * 100).toFixed(1)}%)`, I.check]];
  flow.forEach(([lab, ic, img], i) => {
    const x = 0.6 + i * 2.5;
    card(s, x, 1.5, 2.0, 2.45, i === 4 ? { line: RED, lw: 2 } : {});
    if (img) s.addImage({ path: img, x: x + 0.35, y: 1.68, w: 1.3, h: 1.3 });
    else iconCircle(s, ic, x + 0.45, 1.68, 1.1, i === 4 ? RED : CYAN);
    text(s, lab, x + 0.1, 3.08, 1.8, 0.8, { size: 15, bold: true, align: "center", valign: "middle" });
    if (i < 4) arrow(s, x + 2.05, 2.72, x + 2.45, 2.72, CYAN, 3);
  });
  [[I.book, "1. Learn from examples", "Trained on 12,000 real and fake faces, each labelled with the right answer"],
    [I.eye, "2. Spot hidden clues", "Learns patterns in skin texture, face edges, lighting and tiny pixel details"],
    [I.balance, "3. Decide", "Gives a fake score from 0–100%. Score of 50% or more means FAKE, otherwise REAL"]].forEach(([ic, h, d], i) => {
    const x = 0.6 + i * 4.18;
    card(s, x, 4.35, 3.75, 2.3, { noShadow: true });
    iconCircle(s, ic, x + 0.25, 4.6, 0.75, BLUE);
    text(s, h, x + 1.15, 4.65, 2.5, 0.65, { size: 17, bold: true, valign: "middle" });
    text(s, d, x + 0.25, 5.45, 3.3, 1.1, { size: 14, color: MUTED });
  });
  s.addNotes("This is how a traditional detector works. We take the input photo, find the face, crop it and resize it to 224 by 224 pixels. Then one AI model, a CNN called EfficientNet-B0, gives a fake score. It learns by seeing 12,000 labelled real and fake faces, it picks up hidden clues like skin texture and lighting, and if the score is 50 percent or more, it says FAKE.");

  // 8. Inside the model
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Part 1 – The Problem (Akshat Mishra)" });
  s.addText("Inside the Traditional Model", { placeholder: "title" });
  text(s, "A CNN looks at the image in layers:", 0.6, 1.45, 5.6, 0.4, { size: 16, color: MUTED });
  const layers = [["Layer 1", "Edges and colours", 5.4, "3B82F6"], ["Layer 2", "Textures: skin, hair", 4.7, "2563EB"],
    ["Layer 3", "Face parts: eyes, mouth", 4.0, "1D4ED8"], ["Output", "REAL or FAKE?", 3.3, "F43F5E"]];
  layers.forEach(([a, b, w, col], i) => {
    const x = 0.6 + (5.4 - w) / 2, y = 1.95 + i * 0.95;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.72, rectRadius: 0.1, fill: { color: col }, line: { type: "none" } });
    text(s, [{ text: a + ":  ", options: { bold: true } }, { text: b }], x + 0.15, y, w - 0.3, 0.72, { size: 15, color: "FFFFFF", align: "center", valign: "middle" });
  });
  [["94.7%", "accuracy on check images"], ["88.7%", "accuracy on final test images"], ["8.4 min", "training time on a laptop"]].forEach(([v, l], i) => {
    const x = 0.6 + i * 1.9;
    card(s, x, 5.85, 1.75, 0.95, { noShadow: true });
    text(s, v, x, 5.9, 1.75, 0.5, { size: 22, bold: true, color: CYAN, align: "center", font: "Arial" });
    text(s, l, x + 0.05, 6.38, 1.65, 0.4, { size: 11, color: MUTED, align: "center" });
  });
  text(s, "Where the model looks (heatmap)", 6.65, 1.45, 6.1, 0.4, { size: 18, bold: true });
  frame(s, A("cam_fake.png"), 6.7, 2.0, 2.85, 2.85, RED);
  frame(s, A("cam_real.png"), 9.85, 2.0, 2.85, 2.85, GREEN);
  chip(s, `Fake face → ${pct(META.cam_fake)} fake`, 6.75, 5.0, 2.75, RED, "FFFFFF", 13);
  chip(s, `Real face → ${pct(META.cam_real)} fake`, 9.9, 5.0, 2.75, GREEN, "0B1220", 13);
  text(s, "Red = the area the AI focuses on most when it decides. It focuses on the person, not the background.", 6.7, 5.65, 6.0, 0.8, { size: 14, color: MUTED });
  s.addNotes("Inside, the CNN looks at the image in layers: first edges and colours, then textures like skin and hair, then face parts like eyes and mouth, and finally it decides real or fake. The heatmaps show where our model looks: the red area is where it focuses, and it focuses on the face, not the background. It reached 94.7 percent on check images and 88.7 percent on the final test images, after only 8.4 minutes of training.");

  // 9. Hidden weakness
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Part 1 – The Problem (Akshat Mishra)" });
  s.addText("The Hidden Weakness: Adversarial Attacks", { placeholder: "title" });
  const eq = [[A("face_original.png"), GREEN, "Original deepfake", `AI says: ${pct(META.p_clean)} FAKE ✓`, GREEN],
    [A("noise_pgd.png"), CYAN, "Hidden noise", "(enlarged ×32 so we can see it)", MUTED],
    [A("face_pgd.png"), RED, "Attacked image", "AI says: 0% FAKE → \"REAL\" ✗", RED]];
  eq.forEach(([img, col, h, sub, sc], i) => {
    const x = 0.95 + i * 4.25;
    frame(s, img, x, 1.55, 2.95, 2.95, col);
    text(s, h, x - 0.2, 4.62, 3.35, 0.4, { size: 18, bold: true, align: "center" });
    text(s, sub, x - 0.2, 5.0, 3.35, 0.4, { size: 15, bold: i !== 1, color: sc, align: "center" });
  });
  text(s, "+", 4.0, 2.55, 1.0, 0.9, { size: 54, bold: true, color: CYAN, align: "center", valign: "middle" });
  text(s, "=", 8.25, 2.55, 1.0, 0.9, { size: 54, bold: true, color: CYAN, align: "center", valign: "middle" });
  card(s, 0.6, 5.65, 12.1, 1.1, { fill: PANEL, line: AMBER });
  text(s, [{ text: "Adversarial attack: ", options: { bold: true, color: AMBER } },
    { text: "tiny, carefully calculated changes that trick an AI. Here every pixel changes by at most 4 out of 255 (about 1.6%). Our eyes see no difference, but the AI is completely fooled.", options: {} }],
  0.85, 5.72, 11.6, 0.95, { size: 16, valign: "middle" });
  s.addNotes("But there is a hidden weakness. This deepfake is correctly detected as 94 percent fake. Now an attacker adds this hidden noise, which I enlarged 32 times so you can see it. The result on the right looks exactly the same to us, but the AI now says 0 percent fake, so it calls the deepfake real. This is called an adversarial attack: tiny, carefully calculated changes that trick an AI. Every pixel changed by at most 4 out of 255.");

  // 10. FGSM
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Part 1 – The Problem (Akshat Mishra)" });
  s.addText("Attack 1: FGSM (Fast Gradient Sign Method)", { placeholder: "title" });
  const fsteps = [[I.image, "Show the image to the AI", ""], [I.compass, "Find which pixel changes hurt the AI most", "this is the 'gradient'"],
    [I.plusminus, "Keep only the direction: brighter (+) or darker (−)", "this is the 'sign'"],
    [I.bolt, "Push EVERY pixel by ε = 4/255 in ONE step", "one step, so it is 'fast'"]];
  fsteps.forEach(([ic, h, sub], i) => {
    const y = 1.45 + i * 1.3;
    card(s, 0.6, y, 5.6, 1.05, i === 3 ? { line: AMBER, lw: 2 } : {});
    iconCircle(s, ic, 0.78, y + 0.17, 0.7, i === 3 ? AMBER : CYAN);
    text(s, h, 1.65, y + 0.1, 4.4, sub ? 0.55 : 0.85, { size: 15, bold: true, valign: sub ? "bottom" : "middle" });
    if (sub) text(s, sub, 1.65, y + 0.64, 4.4, 0.35, { size: 13, italic: true, color: MUTED });
    if (i < 3) arrow(s, 3.4, y + 1.07, 3.4, y + 1.28, CYAN, 2.5);
  });
  s.addImage({ path: A("illus_fgsm.png"), x: 6.75, y: 1.35, w: 5.9, h: 3.68 });
  frame(s, A("face_original.png"), 6.85, 5.3, 1.35, 1.35, GREEN);
  arrow(s, 8.35, 5.97, 8.85, 5.97, AMBER, 3);
  frame(s, A("face_fgsm.png"), 9.0, 5.3, 1.35, 1.35, AMBER);
  text(s, [{ text: `${pct(META.p_clean)} → ${pct(META.fgsm.trad)}`, options: { bold: true, color: AMBER, breakLine: true } },
    { text: "fake score after FGSM", options: { color: MUTED, fontSize: 12 } }], 10.55, 5.3, 2.2, 0.75, { size: 22 });
  text(s, [{ text: "Accuracy: 88.7% → 33.2%", options: { bold: true } }], 10.55, 6.12, 2.2, 0.5, { size: 14 });
  s.addNotes("The first attack is FGSM, the Fast Gradient Sign Method. Step one: show the image to the AI. Step two: calculate which pixel changes would hurt the AI the most. This is called the gradient. Step three: keep only the direction for each pixel, brighter or darker. This is the sign. Step four: push every pixel by 4 out of 255 in that direction, all in one step, which is why it is fast. Think of the AI standing at the correct answer at the bottom of a valley; FGSM makes one big jump uphill. On this image the fake score dropped from 94 to 49 percent, and on our whole test set the traditional model's accuracy fell from 88.7 to 33.2 percent.");

  // 11. PGD
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Part 1 – The Problem (Akshat Mishra)" });
  s.addText("Attack 2: PGD (Projected Gradient Descent)", { placeholder: "title" });
  const psteps = [[I.random, "Random start: add a tiny bit of random noise", AMBER], [I.compass, "Take a SMALL step (1/255) in the most harmful direction", CYAN],
    [I.redo, "Re-check the direction at the new position", CYAN], [I.fence, "Crossed the limit (ε = 4/255)? Pull it back (projection)", CYAN]];
  psteps.forEach(([ic, h, col], i) => {
    const y = 1.45 + i * 1.18;
    card(s, 0.6, y, 5.0, 0.92);
    iconCircle(s, ic, 0.76, y + 0.14, 0.64, col);
    text(s, h, 1.55, y + 0.06, 3.95, 0.8, { size: 15, bold: true, valign: "middle" });
    if (i < 3) arrow(s, 3.1, y + 0.94, 3.1, y + 1.16, CYAN, 2.5);
  });
  s.addShape(pres.shapes.LINE, { x: 5.6, y: 5.0, w: 0.45, h: 0, line: { color: RED, width: 2.5 } });
  s.addShape(pres.shapes.LINE, { x: 6.05, y: 3.09, w: 0, h: 1.91, line: { color: RED, width: 2.5 } });
  arrow(s, 6.05, 3.09, 5.62, 3.09, RED, 2.5);
  text(s, "repeat\n×10", 6.12, 3.7, 0.8, 0.75, { size: 14, bold: true, color: RED });
  card(s, 0.6, 6.25, 5.0, 0.6, { line: RED, lw: 2 });
  text(s, "Result: a much stronger attacked image", 0.6, 6.25, 5.0, 0.6, { size: 15, bold: true, color: RED, align: "center", valign: "middle" });
  arrow(s, 3.1, 5.66, 3.1, 6.22, RED, 2.5);
  s.addImage({ path: A("illus_pgd.png"), x: 6.95, y: 1.3, w: 5.0, h: 3.7 });
  frame(s, A("face_original.png"), 6.85, 5.3, 1.35, 1.35, GREEN);
  arrow(s, 8.35, 5.97, 8.85, 5.97, RED, 3);
  frame(s, A("face_pgd.png"), 9.0, 5.3, 1.35, 1.35, RED);
  text(s, [{ text: `${pct(META.p_clean)} → 0%`, options: { bold: true, color: RED, breakLine: true } },
    { text: "fake score after PGD", options: { color: MUTED, fontSize: 12 } }], 10.55, 5.3, 2.2, 0.75, { size: 22 });
  text(s, "Accuracy: 88.7% → 0.4%", 10.55, 6.12, 2.2, 0.5, { size: 14, bold: true });
  s.addNotes("The second attack is PGD, Projected Gradient Descent. It is like FGSM but much smarter. It starts with a little random noise, then takes a small step in the most harmful direction, then re-checks the direction, and repeats this ten times. There is a fence: no pixel may change more than 4 out of 255. If a step crosses the fence, the pixel is pulled back to the fence. That pulling back is called projection. Because it keeps re-checking, PGD finds a much more harmful change within the same limit. On this image the fake score went from 94 percent to 0, and on the full test set the traditional model's accuracy fell to just 0.4 percent: it was fooled on 255 of 256 images.");

  // 12. FGSM vs PGD
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Part 1 – The Problem (Akshat Mishra)" });
  s.addText("FGSM vs PGD", { placeholder: "title" });
  const hdr = (t, col) => ({ text: t, options: { bold: true, color: col === RED ? "FFFFFF" : "0B1220", fill: { color: col }, align: "center", fontSize: 16 } });
  const cell = (t, o = {}) => ({ text: t, options: { color: TXT, fill: { color: PANEL }, fontSize: 15, align: o.align || "center", bold: o.bold } });
  const rows = [["Steps", "1 big step", "10 small steps"], ["Re-checks direction", "No", "Yes, every step"], ["Random start", "No", "Yes"],
    ["Max change per pixel", "4/255", "4/255 (same!)"], ["Speed", "Very fast", "About 10× slower"], ["Strength", "Weaker", "Much stronger"],
    ["Like…", "One big jump", "A careful climb"]];
  s.addTable([[cell("", {}), hdr("FGSM", AMBER), hdr("PGD", RED)], ...rows.map(r => [cell(r[0], { align: "left", bold: true }), cell(r[1]), cell(r[2])])],
    { x: 0.6, y: 1.5, w: 6.5, colW: [2.3, 2.1, 2.1], rowH: 0.62, border: { type: "solid", pt: 1, color: "0B1220" }, margin: 0.08, valign: "middle" });
  s.addChart(pres.charts.BAR, [{ name: "Traditional model accuracy", labels: ["No attack", "FGSM", "PGD"], values: [88.7, 33.2, 0.4] }], {
    x: 7.5, y: 1.4, w: 5.2, h: 4.6, barDir: "col", chartColors: ["22C55E", "F59E0B", "F43F5E"], showTitle: true,
    title: "Traditional model accuracy (%)", titleColor: "F1F5F9", titleFontSize: 16, titleFontFace: "+mn-lt",
    showValue: true, dataLabelPosition: "outEnd", dataLabelColor: "F1F5F9", dataLabelFontSize: 16, dataLabelFontBold: true, dataLabelFontFace: "+mn-lt",
    dataLabelFormatCode: "0.0", catAxisLabelColor: "94A3B8", catAxisLabelFontSize: 14, catAxisLabelFontFace: "+mn-lt", valAxisHidden: true,
    valAxisMaxVal: 100, valAxisMinVal: 0, valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, barGapWidthPct: 60 });
  text(s, "Same invisible limit, but PGD uses it far more cleverly.", 7.5, 6.15, 5.2, 0.6, { size: 15, italic: true, color: MUTED, align: "center" });
  s.addNotes("Here is the comparison. FGSM takes one big step; PGD takes ten small steps and re-checks the direction each time, starting from a random point. Importantly, both have the same limit: no pixel changes more than 4 out of 255. PGD is about ten times slower, but much stronger. The chart shows the traditional model's accuracy: 88.7 percent with no attack, 33.2 percent under FGSM, and only 0.4 percent under PGD.");

  // 13. How bad is it
  const SW = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "results", "eps_sweep.json"), "utf8")).results;
  const eps = ["0", "1", "2", "4", "8"];
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Part 1 – The Problem (Akshat Mishra)" });
  s.addText("Even a Tiny Attack Breaks It", { placeholder: "title" });
  s.addChart(pres.charts.LINE, [{ name: "Traditional model", labels: eps.map(e => (e === "0" ? "No attack" : `ε = ${e}/255`)), values: eps.map(e => Math.round(SW[e].traditional * 1000) / 10) }], {
    x: 0.6, y: 1.4, w: 7.4, h: 5.2, chartColors: ["F43F5E"], lineSize: 4, lineDataSymbol: "circle", lineDataSymbolSize: 11,
    showTitle: true, title: "Traditional model accuracy (%) as the PGD attack gets stronger", titleColor: "F1F5F9", titleFontSize: 15, titleFontFace: "+mn-lt",
    showValue: true, dataLabelPosition: "t", dataLabelColor: "F1F5F9", dataLabelFontSize: 14, dataLabelFontBold: true, dataLabelFormatCode: "0.0", dataLabelFontFace: "+mn-lt",
    catAxisLabelColor: "94A3B8", catAxisLabelFontSize: 13, catAxisLabelFontFace: "+mn-lt", valAxisLabelColor: "94A3B8", valAxisLabelFontSize: 12,
    valAxisLabelFontFace: "+mn-lt", valAxisMaxVal: 100, valAxisMinVal: 0, valAxisMajorUnit: 25, valGridLine: { color: "1E293B", size: 1 },
    catGridLine: { style: "none" }, showLegend: false });
  card(s, 8.4, 1.5, 4.3, 2.6, { line: RED, lw: 2 });
  text(s, "1/255", 8.4, 1.62, 4.3, 1.0, { size: 54, bold: true, color: RED, align: "center", font: "Arial" });
  text(s, "A change of just ONE brightness level per pixel drops the traditional model to 0% accuracy.", 8.65, 2.7, 3.8, 1.25, { size: 16, align: "center" });
  card(s, 8.4, 4.4, 4.3, 2.2);
  iconCircle(s, I.warn, 8.65, 4.62, 0.75, AMBER);
  text(s, "The real problem", 9.55, 4.65, 3.0, 0.6, { size: 18, bold: true, color: AMBER, valign: "middle" });
  text(s, "One model + no checks = easily fooled. It never asks: \"Was this image tampered with?\"", 8.65, 5.45, 3.85, 1.05, { size: 15, color: TXT });
  s.addNotes("How strong does the attack need to be? We tested different strengths. Even at 1 out of 255, which is a change of just one brightness level per pixel, the traditional model drops to zero percent. So the real problem is: one model with no checks is easily fooled. It never asks whether the image was tampered with.");

  // 14. Summary + handoff
  s = pres.addSlide({ masterName: "Title Dark", sectionTitle: "Part 1 – The Problem (Akshat Mishra)" });
  text(s, "So what do we need?", 0.6, 0.55, 12.1, 0.8, { size: 36, bold: true, font: "Arial" });
  text(s, "A detector that thinks like an investigator, not a single model that can be tricked:", 0.6, 1.35, 12.1, 0.5, { size: 18, color: MUTED });
  const needs = [[I.search, "Notice", "Check whether the image was attacked", CYAN], [I.broom, "Clean", "Remove the hidden attack noise", AMBER],
    [I.users, "Ask different experts", "Use AI models the attack was not made for", GREEN], [I.comment, "Explain", "Say how sure it is, and ask a human when unsure", "A78BFA"]];
  needs.forEach(([ic, h, d, col], i) => {
    const x = 0.6 + i * 3.1;
    card(s, x, 2.25, 2.8, 3.0);
    iconCircle(s, ic, x + 0.9, 2.55, 1.0, col);
    text(s, h, x + 0.15, 3.75, 2.5, 0.5, { size: 20, bold: true, align: "center" });
    text(s, d, x + 0.2, 4.3, 2.4, 0.85, { size: 15, color: MUTED, align: "center" });
    if (i < 3) arrow(s, x + 2.83, 3.75, x + 3.07, 3.75, CYAN, 3);
  });
  card(s, 2.9, 5.75, 7.5, 1.0, { fill: CYAN, noShadow: true });
  text(s, "Next: our Agentic AI solution  →", 2.9, 5.75, 7.5, 1.0, { size: 24, bold: true, color: "0B1220", align: "center", valign: "middle", font: "Arial" });
  s.addNotes("To sum up: deepfakes fool people, AI detectors catch them, but invisible attacks fool those detectors completely. So we need a detector that thinks like an investigator: it should notice an attack, clean it, ask different AI experts that the attack was not designed for, and explain how sure it is. That is exactly our Agentic AI system, which my teammate will now present.");

  // ---------------------------------------------------------------------------------------------- PART 2 & 3 (teammates: headings only)
  const open = (sec, title) => {
    const sl = pres.addSlide({ masterName: "Content Open", sectionTitle: sec });
    sl.addText(title, { placeholder: "title" });
    sl.addText("", { placeholder: "body" });
    sl.addNotes("Speaker notes for this slide.");
    return sl;
  };
  const divider = (sec, num, title, sub) => {
    const sl = pres.addSlide({ masterName: "Section", sectionTitle: sec });
    text(sl, num, 1.2, 1.35, 3, 1.3, { size: 80, bold: true, color: CYAN, font: "Arial" });
    sl.addText(title, { placeholder: "title" });
    sl.addText(sub, { placeholder: "body" });
  };
  const P2 = "Part 2 – Our Solution";
  pres.addSection({ title: P2 });
  divider(P2, "02", "Our Solution: Agentic AI", "Four cooperating agents  ·  How they work together");
  ["Agentic Integration Strategy", "Multi-Agent System Architecture", "Agent 1: Noise & Attack Detector", "Agent 2: Adaptive Sanitizer",
    "Agent 3: Dynamic Model Selector", "Agent 4: Forensic Verifier", "Tech Stack"].forEach(t => open(P2, t));
  const P3 = "Part 3 – Implementation & Results";
  pres.addSection({ title: P3 });
  divider(P3, "03", "Implementation & Results", "Dataset  ·  Training  ·  Results  ·  Demo");
  ["Dataset", "Training the Models", "Results: Traditional vs Agentic AI", "Live Demo", "Limitations & Future Work", "Conclusion"].forEach(t => open(P3, t));

  // closing
  s = pres.addSlide({ masterName: "Title Dark", sectionTitle: P3 });
  s.addImage({ path: LOGO, x: 6.2, y: 0.7, w: 0.93, h: 1.0 });
  text(s, "Thank You", 0.6, 1.95, 12.1, 1.2, { size: 54, bold: true, align: "center", font: "Arial" });
  text(s, "Questions?", 0.6, 3.1, 12.1, 0.7, { size: 28, color: CYAN, align: "center", bold: true });
  [["Akshat Mishra", "23118006"], ["Gourav Deep Shahni", "23118037"], ["Harsh Mehar", "23118039"]].forEach(([n, r], i) => {
    card(s, 2.15 + i * 3.1, 4.4, 2.85, 1.0);
    text(s, n, 2.2 + i * 3.1, 4.48, 2.75, 0.45, { size: 16, bold: true, align: "center", valign: "middle" });
    text(s, r, 2.2 + i * 3.1, 4.9, 2.75, 0.35, { size: 13, color: MUTED, align: "center" });
  });
  text(s, [{ text: "Guided by ", options: { color: MUTED } }, { text: "Dr. Suvendu Rup", options: { bold: true } },
    { text: "   ·   Department of Information Technology, NIT Raipur", options: { color: MUTED } }], 0.6, 5.9, 12.1, 0.5, { size: 16, align: "center" });

  await pres.writeFile({ fileName: OUTFILE });
  if (applyTheme) await applyTheme(OUTFILE, THEME);
  console.log("written", OUTFILE);
})().catch(e => { console.error(e); process.exit(1); });
