// Builds the project report (DOCX). Run: node build_report.js  -> Agentic_Deepfake_Detection_Report.docx
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, Header, Footer, AlignmentType,
  HeadingLevel, BorderStyle, WidthType, ShadingType, VerticalAlign, PageNumber, NumberFormat, PageBreak, Tab,
  TabStopType, TableOfContents, SequentialIdentifier, LevelFormat, PageBorderDisplay, PageBorderOffsetFrom,
  PageBorderZOrder, TableLayoutType,
} = require("docx");

const FIG = path.join(__dirname, "figures");
const SIZES = JSON.parse(fs.readFileSync(path.join(FIG, "sizes.json"), "utf8"));
const NAVY = "1F3864", BLUE = "2E75B6", LIGHT = "DEEAF6", PALE = "F3F7FC", GREY = "595959";
const FONT = "Times New Roman";
const TW = 9026;                                  // text width in DXA (A4, 1.1in + 0.9in margins)

// ------------------------------------------------------------------------------------------- citations
const REFS = {
  tolosana: "R. Tolosana, R. Vera-Rodriguez, J. Fierrez, A. Morales and J. Ortega-Garcia, “DeepFakes and beyond: A survey of face manipulation and fake detection,” Information Fusion, vol. 64, pp. 131–148, 2020.",
  mirsky: "Y. Mirsky and W. Lee, “The creation and detection of deepfakes: A survey,” ACM Computing Surveys, vol. 54, no. 1, 2021.",
  gan: "I. J. Goodfellow et al., “Generative adversarial nets,” in Advances in Neural Information Processing Systems (NeurIPS), 2014.",
  szegedy: "C. Szegedy et al., “Intriguing properties of neural networks,” in Proc. International Conference on Learning Representations (ICLR), 2014.",
  fgsm: "I. J. Goodfellow, J. Shlens and C. Szegedy, “Explaining and harnessing adversarial examples,” in Proc. ICLR, 2015.",
  pgd: "A. Madry, A. Makelov, L. Schmidt, D. Tsipras and A. Vladu, “Towards deep learning models resistant to adversarial attacks,” in Proc. ICLR, 2018.",
  carlini_farid: "N. Carlini and H. Farid, “Evading deepfake-image detectors with white- and black-box attacks,” in Proc. IEEE/CVF CVPR Workshops, 2020.",
  hussain: "S. Hussain, P. Neekhara, M. Jere, F. Koushanfar and J. McAuley, “Adversarial deepfakes: Evaluating vulnerability of deepfake detectors to adversarial examples,” in Proc. IEEE/CVF WACV, 2021.",
  agents: "M. Wooldridge and N. R. Jennings, “Intelligent agents: Theory and practice,” The Knowledge Engineering Review, vol. 10, no. 2, pp. 115–152, 1995.",
  react: "S. Yao et al., “ReAct: Synergizing reasoning and acting in language models,” in Proc. ICLR, 2023.",
  langgraph: "LangChain Inc., “LangGraph: Build resilient agents as graphs,” 2024. [Online]. Available: https://github.com/langchain-ai/langgraph",
  ffpp: "A. Rössler, D. Cozzolino, L. Verdoliva, C. Riess, J. Thies and M. Nießner, “FaceForensics++: Learning to detect manipulated facial images,” in Proc. IEEE/CVF ICCV, 2019.",
  xception: "F. Chollet, “Xception: Deep learning with depthwise separable convolutions,” in Proc. IEEE CVPR, 2017.",
  efficientnet: "M. Tan and Q. V. Le, “EfficientNet: Rethinking model scaling for convolutional neural networks,” in Proc. International Conference on Machine Learning (ICML), 2019.",
  celebdf: "Y. Li, X. Yang, P. Sun, H. Qi and S. Lyu, “Celeb-DF: A large-scale challenging dataset for DeepFake forensics,” in Proc. IEEE/CVF CVPR, 2020.",
  dfdc: "B. Dolhansky et al., “The DeepFake Detection Challenge (DFDC) dataset,” arXiv preprint arXiv:2006.07397, 2020.",
  openforensics: "T.-N. Le, H. H. Nguyen, J. Yamagishi and I. Echizen, “OpenForensics: Large-scale challenging dataset for multi-face forgery detection and segmentation in-the-wild,” in Proc. IEEE/CVF ICCV, 2021.",
  durall: "R. Durall, M. Keuper and J. Keuper, “Watch your up-convolution: CNN based generative deep neural networks are failing to reproduce spectral distributions,” in Proc. IEEE/CVF CVPR, 2020.",
  blink: "Y. Li, M.-C. Chang and S. Lyu, “In ictu oculi: Exposing AI created fake videos by detecting eye blinking,” in Proc. IEEE International Workshop on Information Forensics and Security (WIFS), 2018.",
  univfd: "U. Ojha, Y. Li and Y. J. Lee, “Towards universal fake image detectors that generalize across generative models,” in Proc. IEEE/CVF CVPR, 2023.",
  transfer: "N. Papernot, P. McDaniel and I. Goodfellow, “Transferability in machine learning: From phenomena to black-box attacks using adversarial samples,” arXiv preprint arXiv:1605.07277, 2016.",
  fast_at: "E. Wong, L. Rice and J. Z. Kolter, “Fast is better than free: Revisiting adversarial training,” in Proc. ICLR, 2020.",
  guo: "C. Guo, M. Rana, M. Cissé and L. van der Maaten, “Countering adversarial images using input transformations,” in Proc. ICLR, 2018.",
  squeeze: "W. Xu, D. Evans and Y. Qi, “Feature squeezing: Detecting adversarial examples in deep neural networks,” in Proc. Network and Distributed System Security Symposium (NDSS), 2018.",
  ens_at: "F. Tramèr, A. Kurakin, N. Papernot, I. Goodfellow, D. Boneh and P. McDaniel, “Ensemble adversarial training: Attacks and defenses,” in Proc. ICLR, 2018.",
  vit_robust: "K. Mahmood, R. Mahmood and M. van Dijk, “On the robustness of vision transformers to adversarial examples,” in Proc. IEEE/CVF ICCV, 2021.",
  obfuscated: "A. Athalye, N. Carlini and D. Wagner, “Obfuscated gradients give a false sense of security: Circumventing defenses to adversarial examples,” in Proc. ICML, 2018.",
  not_easily: "N. Carlini and D. Wagner, “Adversarial examples are not easily detected: Bypassing ten detection methods,” in Proc. ACM Workshop on Artificial Intelligence and Security (AISec), 2017.",
  vit: "A. Dosovitskiy et al., “An image is worth 16x16 words: Transformers for image recognition at scale,” in Proc. ICLR, 2021.",
  deit: "H. Touvron, M. Cord, M. Douze, F. Massa, A. Sablayrolles and H. Jégou, “Training data-efficient image transformers & distillation through attention,” in Proc. ICML, 2021.",
  clip: "A. Radford et al., “Learning transferable visual models from natural language supervision,” in Proc. ICML, 2021.",
  rof: "L. I. Rudin, S. Osher and E. Fatemi, “Nonlinear total variation based noise removal algorithms,” Physica D: Nonlinear Phenomena, vol. 60, pp. 259–268, 1992.",
  chambolle: "A. Chambolle, “An algorithm for total variation minimization and applications,” Journal of Mathematical Imaging and Vision, vol. 20, pp. 89–97, 2004.",
  gbdt: "J. H. Friedman, “Greedy function approximation: A gradient boosting machine,” The Annals of Statistics, vol. 29, no. 5, pp. 1189–1232, 2001.",
  viola: "P. Viola and M. Jones, “Rapid object detection using a boosted cascade of simple features,” in Proc. IEEE CVPR, 2001.",
  kaggle: "M. Karki, “Deepfake and Real Images,” Kaggle dataset. [Online]. Available: https://www.kaggle.com/datasets/manjilkarki/deepfake-and-real-images",
  adamw: "I. Loshchilov and F. Hutter, “Decoupled weight decay regularization,” in Proc. ICLR, 2019.",
  onecycle: "L. N. Smith and N. Topin, “Super-convergence: Very fast training of neural networks using large learning rates,” in Proc. SPIE Artificial Intelligence and Machine Learning for Multi-Domain Operations Applications, 2019.",
  mixed: "P. Micikevicius et al., “Mixed precision training,” in Proc. ICLR, 2018.",
  pytorch: "A. Paszke et al., “PyTorch: An imperative style, high-performance deep learning library,” in Advances in NeurIPS, 2019.",
  timm: "R. Wightman, “PyTorch Image Models (timm),” GitHub repository, 2019. [Online]. Available: https://github.com/huggingface/pytorch-image-models",
  sklearn: "F. Pedregosa et al., “Scikit-learn: Machine learning in Python,” Journal of Machine Learning Research, vol. 12, pp. 2825–2830, 2011.",
  autoattack: "F. Croce and M. Hein, “Reliable evaluation of adversarial robustness with an ensemble of diverse parameter-free attacks,” in Proc. ICML, 2020.",
  smoothing: "J. Cohen, E. Rosenfeld and J. Z. Kolter, “Certified adversarial robustness via randomized smoothing,” in Proc. ICML, 2019.",
};
const citeOrder = [];
function cite(keys) {
  return "[" + keys.split(",").map(k => k.trim()).map(k => {
    if (!REFS[k]) throw new Error("unknown ref " + k);
    if (!citeOrder.includes(k)) citeOrder.push(k);
    return citeOrder.indexOf(k) + 1;
  }).join(", ") + "]";
}
const R = s => s.replace(/\{([a-z_,\s]+)\}/g, (_, k) => cite(k));   // "{fgsm,pgd}" -> "[3, 4]"

// ------------------------------------------------------------------------------------------- numbering of figures / tables
const FIG_FILES = { arch: "architecture", aug: "phone_aug", bench: "benchmark", cm: "agent1_cm", eps: "eps", div: "diversity", ver: "versions", example: "attack_example" };
const FIG_ORDER = ["arch", "aug", "bench", "cm", "eps", "div", "ver", "example"];
const TAB_ORDER = ["gap", "attackparams", "state", "features", "recipes", "pool", "clues", "data", "hyper", "trainres",
  "stack", "main", "agent1", "ens", "sanit", "versions", "gallery", "latency", "targets", "structure"];
const F = k => "Figure " + (FIG_ORDER.indexOf(k) + 1);
const T = k => "Table " + (TAB_ORDER.indexOf(k) + 1);
let figSeen = 0, tabSeen = 0;

// ------------------------------------------------------------------------------------------- text helpers
function runs(text, base = {}) {
  text = R(text);
  const out = [];
  for (const part of text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)) {
    if (!part) continue;
    if (part.startsWith("**")) out.push(new TextRun({ text: part.slice(2, -2), bold: true, font: FONT, ...base }));
    else if (part.startsWith("*")) out.push(new TextRun({ text: part.slice(1, -1), italics: true, font: FONT, ...base }));
    else if (part.startsWith("`")) out.push(new TextRun({ text: part.slice(1, -1), font: "Consolas", size: (base.size || 24) - 3, ...base, }));
    else out.push(new TextRun({ text: part, font: FONT, ...base }));
  }
  return out;
}
const P = (text, o = {}) => new Paragraph({ children: runs(text, o.run || {}), alignment: o.align || AlignmentType.JUSTIFIED,
  spacing: { after: o.after ?? 140, before: o.before ?? 0, line: o.line ?? 300 }, indent: o.indent, keepNext: o.keepNext,
  keepLines: o.keepLines, style: o.style });
const H1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t, font: FONT })] });
const H2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t, font: FONT })] });
const H3 = t => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: t, font: FONT })] });
const bullets = (items, ref = "bullets") => items.map(t => new Paragraph({ numbering: { reference: ref, level: 0 },
  children: runs(t), alignment: AlignmentType.JUSTIFIED, spacing: { after: 80, line: 290 } }));
let numInst = 0;
const numbered = items => { numInst++; return items.map(t => new Paragraph({ numbering: { reference: "numbers", level: 0, instance: numInst },
  children: runs(t), alignment: AlignmentType.JUSTIFIED, spacing: { after: 80, line: 290 } })); };

function caption(kind, text) {
  return new Paragraph({ style: "Caption", alignment: AlignmentType.CENTER, keepNext: kind === "Table",
    spacing: { before: kind === "Table" ? 160 : 80, after: kind === "Table" ? 80 : 220 },
    children: [new TextRun({ text: kind + " ", bold: true, font: FONT }), new SequentialIdentifier(kind),
      new TextRun({ text: ": ", bold: true, font: FONT }), ...runs(text, { size: 21 })] });
}
function figure(key, widthPx, text) {
  if (FIG_ORDER[figSeen++] !== key) throw new Error("figure order mismatch at " + key);
  const file = "fig_" + FIG_FILES[key];
  const [w, h] = SIZES[file];
  return [new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 60 },
    children: [new ImageRun({ type: "png", data: fs.readFileSync(path.join(FIG, file + ".png")),
      transformation: { width: widthPx, height: Math.round(widthPx * h / w) } })] }), caption("Figure", text)];
}
function equation(name, num, scale = 0.25) {
  const [w, h] = SIZES[name];
  let width = Math.round(w * scale), height = Math.round(h * scale);
  if (width > 520) { height = Math.round(height * 520 / width); width = 520; }
  return new Paragraph({ tabStops: [{ type: TabStopType.CENTER, position: TW / 2 }, { type: TabStopType.RIGHT, position: TW }],
    spacing: { before: 100, after: 140 }, keepLines: true,
    children: [new TextRun({ children: [new Tab()] }),
      new ImageRun({ type: "png", data: fs.readFileSync(path.join(FIG, name + ".png")), transformation: { width, height } }),
      new TextRun({ children: [new Tab(), `(${num})`], font: FONT })] });
}
const thin = { style: BorderStyle.SINGLE, size: 4, color: "A6A6A6" };
const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
function table(key, title, headers, rows, widths, o = {}) {
  if (TAB_ORDER[tabSeen++] !== key) throw new Error("table order mismatch at " + key);
  const total = widths.reduce((a, b) => a + b, 0);
  if (total !== TW && !o.allowWidth) throw new Error(`table ${key} width ${total} != ${TW}`);
  const fs_ = o.size || 20;
  const mk = (txt, i, head, rowIdx) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
    shading: { type: ShadingType.CLEAR, color: "auto", fill: head ? NAVY : (o.highlight && o.highlight(rowIdx) ? "E2F0D9" : (rowIdx % 2 ? PALE : "FFFFFF")) },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    borders: { top: thin, bottom: thin, left: thin, right: thin },
    children: [new Paragraph({ alignment: (head || (o.center && o.center.includes(i))) ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { after: 0, line: 252 },
      children: runs(String(txt), { size: fs_, bold: head || (o.boldFirst && i === 0) || undefined, color: head ? "FFFFFF" : undefined }) })],
  });
  return [caption("Table", title), new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths, alignment: AlignmentType.CENTER,
    rows: [new TableRow({ tableHeader: true, children: headers.map((h, i) => mk(h, i, true, -1)) }),
      ...rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((c, i) => mk(c, i, false, ri)) }))],
  }), new Paragraph({ spacing: { after: 120 }, children: [] })];
}
function callout(title, text) {
  return [new Table({ width: { size: TW, type: WidthType.DXA }, columnWidths: [TW], rows: [new TableRow({ cantSplit: true, children: [
    new TableCell({ width: { size: TW, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: "auto", fill: LIGHT },
      margins: { top: 100, bottom: 100, left: 180, right: 180 },
      borders: { left: { style: BorderStyle.SINGLE, size: 24, color: NAVY }, top: none, bottom: none, right: none },
      children: [new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: title, bold: true, color: NAVY, font: FONT })] }),
        new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 0, line: 290 }, children: runs(text, { size: 22 }) })] })] })] }),
    new Paragraph({ spacing: { after: 120 }, children: [] })];
}
function codeBox(lines) {
  return [new Table({ width: { size: TW, type: WidthType.DXA }, columnWidths: [TW], rows: [new TableRow({ cantSplit: true, children: [
    new TableCell({ width: { size: TW, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: "auto", fill: "F5F5F5" },
      margins: { top: 120, bottom: 120, left: 200, right: 200 },
      borders: { top: thin, bottom: thin, left: { style: BorderStyle.SINGLE, size: 18, color: BLUE }, right: thin },
      children: lines.map(l => new Paragraph({ spacing: { after: 0, line: 250 },
        children: [new TextRun({ text: l, font: "Consolas", size: 18, bold: /^(Algorithm|Input|Output)/.test(l) })] })) })] })] }),
    new Paragraph({ spacing: { after: 140 }, children: [] })];
}
const blank = (n = 1) => Array.from({ length: n }, () => new Paragraph({ children: [] }));
const center = (text, o = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: o.after ?? 80, before: o.before ?? 0 },
  children: [new TextRun({ text, font: FONT, size: o.size || 24, bold: o.bold, italics: o.italics, color: o.color, allCaps: o.caps })] });
const frontTitle = t => new Paragraph({ style: "FrontTitle", children: [new TextRun({ text: t, font: FONT })] });
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

// ------------------------------------------------------------------------------------------- page setup
const pageBorder = (style, size) => ({
  pageBorders: { display: PageBorderDisplay.ALL_PAGES, offsetFrom: PageBorderOffsetFrom.PAGE, zOrder: PageBorderZOrder.FRONT },
  pageBorderTop: { style, size, color: NAVY, space: 24 }, pageBorderBottom: { style, size, color: NAVY, space: 24 },
  pageBorderLeft: { style, size, color: NAVY, space: 24 }, pageBorderRight: { style, size, color: NAVY, space: 24 },
});
const pageCfg = (border, numbers) => ({
  size: { width: 11906, height: 16838 },
  margin: { top: 1440, right: 1296, bottom: 1440, left: 1584, header: 760, footer: 700 },
  borders: border, ...(numbers ? { pageNumbers: numbers } : {}),
});
const footer = () => new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
  children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 22 })] })] });
const header = () => new Header({ children: [new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 4 } },
  tabStops: [{ type: TabStopType.RIGHT, position: TW }], spacing: { after: 0 },
  children: [new TextRun({ text: "Minor Project Report · Dept. of IT, NIT Raipur", font: FONT, size: 18, color: GREY }),
    new TextRun({ children: [new Tab(), "Agentic AI-Based Adaptive Deepfake Detection"], font: FONT, size: 18, italics: true, color: GREY })] })] });

// =========================================================================================== CONTENT
const TITLE = "Agentic AI-Based Adaptive Deepfake Detection under Adversarial Attacks";
const STUDENTS = [["Akshat Mishra", "23118006"], ["Gourav Deep Shahni", "23118037"], ["Harsh Mehar", "23118039"]];
const GUIDE = "Dr. Suvendu Rup";

// ---------- cover
const LOGO = SIZES["nitrr_logo"];
const cover = [
  ...blank(2),
  center("NATIONAL INSTITUTE OF TECHNOLOGY RAIPUR", { size: 34, bold: true, color: NAVY, after: 60 }),
  center("Department of Information Technology", { size: 28, after: 520 }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 520 }, children: [new ImageRun({ type: "png",
    data: fs.readFileSync(path.join(FIG, "nitrr_logo.png")), transformation: { width: 175, height: Math.round(175 * LOGO[1] / LOGO[0]) } })] }),
  center("A Minor Project Report", { size: 28, after: 40 }),
  center("on", { size: 26, italics: true, after: 160 }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60, line: 360 },
    border: { top: { style: BorderStyle.SINGLE, size: 8, color: BLUE, space: 10 }, bottom: { style: BorderStyle.SINGLE, size: 8, color: BLUE, space: 10 } },
    children: [new TextRun({ text: "Agentic AI-Based Adaptive Deepfake Detection", font: FONT, size: 38, bold: true, color: NAVY }),
      new TextRun({ text: "under Adversarial Attacks", font: FONT, size: 38, bold: true, color: NAVY, break: 1 })] }),
  center("Submitted in partial fulfilment of the requirements for the award of the degree of", { size: 22, italics: true, before: 480, after: 20 }),
  center("Bachelor of Technology in Information Technology", { size: 24, bold: true, after: 640 }),
  new Table({ width: { size: TW, type: WidthType.DXA }, columnWidths: [5200, 3826], borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: 5200, type: WidthType.DXA }, borders: { top: none, bottom: none, left: none, right: none },
        children: [new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: "Submitted by:", bold: true, font: FONT, size: 24, color: NAVY })] }),
          ...STUDENTS.map(([n, r], i) => new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `${i + 1}.  ${n}  (${r})`, font: FONT, size: 24 })] }))] }),
      new TableCell({ width: { size: 3826, type: WidthType.DXA }, borders: { top: none, bottom: none, left: none, right: none },
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 100 }, children: [new TextRun({ text: "Under the guidance of:", bold: true, font: FONT, size: 24, color: NAVY })] }),
          new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: GUIDE, font: FONT, size: 24, bold: true })] }),
          new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Project Guide", font: FONT, size: 22, italics: true })] })] })] })] }),
  new Paragraph({ spacing: { before: 640, after: 40 }, children: [new TextRun({ text: "Branch: ", bold: true, font: FONT }), new TextRun({ text: "Information Technology", font: FONT })] }),
  new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "Course: ", bold: true, font: FONT }), new TextRun({ text: "B. Tech.", font: FONT })] }),
  new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "Semester: ", bold: true, font: FONT }), new TextRun({ text: "VII (Odd Semester, Session 2026–27)", font: FONT })] }),
  center("November 2026", { size: 24, bold: true, before: 640, color: NAVY }),
];

// ---------- front matter
const sign = (left, right) => new Table({ width: { size: TW, type: WidthType.DXA }, columnWidths: [4513, 4513],
  borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
  rows: [new TableRow({ children: [left, right].map((lines, i) => new TableCell({ width: { size: 4513, type: WidthType.DXA },
    borders: { top: none, bottom: none, left: none, right: none },
    children: lines.map((l, j) => new Paragraph({ alignment: i ? AlignmentType.RIGHT : AlignmentType.LEFT, spacing: { after: 20 },
      children: [new TextRun({ text: l, font: FONT, size: 23, bold: j === 1 })] })) })) })] });

const certificate = [
  frontTitle("CERTIFICATE"),
  P(`This is to certify that the minor project report entitled **“${TITLE}”**, submitted by **Akshat Mishra (23118006)**, **Gourav Deep Shahni (23118037)** and **Harsh Mehar (23118039)** to the Department of Information Technology, National Institute of Technology Raipur, in partial fulfilment of the requirements for the award of the degree of Bachelor of Technology in Information Technology, is a bonafide record of the work carried out by them under my supervision and guidance during the odd semester of the academic session 2026–27.`, { line: 360 }),
  P("To the best of my knowledge, the matter embodied in this report has not been submitted to any other university or institution for the award of any degree or diploma.", { line: 360 }),
  ...blank(4),
  sign(["________________________", GUIDE, "Project Guide", "Department of Information Technology", "NIT Raipur"],
    ["________________________", "Head of the Department", "Department of Information Technology", "NIT Raipur", ""]),
  ...blank(2),
  P("Place: Raipur", { after: 40 }), P("Date: ____________", { after: 40 }),
  pageBreak(),
];
const declaration = [
  frontTitle("DECLARATION"),
  P(`We hereby declare that the work presented in this minor project report entitled **“${TITLE}”** is an authentic record of our own work carried out under the guidance of **${GUIDE}**, Department of Information Technology, National Institute of Technology Raipur.`, { line: 360 }),
  P("The design, implementation, experiments and results reported here were produced by us. Wherever the work of others has been used, it has been duly acknowledged and cited. All reported numbers were measured on our own implementation; every design choice was tuned on a validation split and the final results were measured once on held-out test data. The matter embodied in this report has not been submitted, in part or in full, for the award of any other degree or diploma.", { line: 360 }),
  ...blank(3),
  new Table({ width: { size: TW, type: WidthType.DXA }, columnWidths: [3009, 3009, 3008],
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [new TableRow({ children: STUDENTS.map(([n, r]) => new TableCell({ width: { size: 3008, type: WidthType.DXA }, borders: { top: none, bottom: none, left: none, right: none },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "____________________", font: FONT })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: n, font: FONT, bold: true, size: 23 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r, font: FONT, size: 23 })] })] })) })] }),
  ...blank(2),
  P("Place: Raipur", { after: 40 }), P("Date: ____________", { after: 40 }),
  pageBreak(),
];
const acknowledgement = [
  frontTitle("ACKNOWLEDGEMENT"),
  P(`We express our sincere gratitude to our project guide, **${GUIDE}**, Department of Information Technology, National Institute of Technology Raipur, for the valuable guidance, constant encouragement and constructive criticism provided throughout this project. The emphasis on rigorous evaluation shaped the way we measured and reported every result.`, { line: 360 }),
  P("We are thankful to the Head of the Department and all faculty members of the Department of Information Technology for providing the academic environment and resources that made this work possible.", { line: 360 }),
  P("We also acknowledge the open-source and research communities whose public datasets, pre-trained models and software libraries — in particular the OpenForensics dataset, PyTorch, timm, OpenAI CLIP, LangGraph, scikit-learn, OpenCV and Streamlit — formed the foundation on which this project was built.", { line: 360 }),
  P("Finally, we thank our families and friends for their unwavering support and patience.", { line: 360 }),
  ...blank(2),
  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 30 }, children: [new TextRun({ text: "Akshat Mishra (23118006)", font: FONT, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 30 }, children: [new TextRun({ text: "Gourav Deep Shahni (23118037)", font: FONT, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 30 }, children: [new TextRun({ text: "Harsh Mehar (23118039)", font: FONT, bold: true })] }),
  pageBreak(),
];
const abstract = [
  new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: false, children: [new TextRun({ text: "Abstract", font: FONT })] }),
  P("Deepfakes — facial images and videos synthesised or manipulated by generative models — threaten trust in digital evidence, journalism and identity verification. Deep-learning detectors reach high accuracy on benchmark data, yet they share a critical weakness: tiny, carefully crafted *adversarial perturbations* can reverse their decisions. In our experiments, a Projected Gradient Descent (PGD) perturbation bounded by ε = 4/255 — invisible to the human eye — reduced a conventional EfficientNet-B0 detector from 88.7% to 0.4% accuracy.", { line: 330 }),
  P("This report presents an **Agentic AI-Based Adaptive Deepfake Detection** framework that treats robustness as a sequence of decisions rather than a property of a single model. Four cooperating agents, coordinated by a LangGraph state graph, (i) estimate the probability that an input has been adversarially manipulated using Fourier-domain, noise-residual and feature-squeezing evidence; (ii) adaptively purify suspicious inputs and verify their own success in a closed loop; (iii) route every input to a deliberately diverse pool of detectors — a conventional CNN, an adversarially trained CNN, a Vision Transformer and a CLIP-based detector; and (iv) verify the outcome with interpretable forensic cues, producing a calibrated confidence, a human-review flag and a complete audit report.", { line: 330 }),
  P("Evaluated on 256 held-out images from an OpenForensics-derived dataset, the system achieves **94.1% clean accuracy (AUC 0.987)** and **84.4% / 85.5% accuracy under FGSM / PGD attacks**, compared with 33.2% / 0.4% for the conventional detector, preventing 82–90% of the damage caused by the attacks. The attack-detection agent identifies 99–100% of attacked inputs, and the system maintains 89–91% accuracy for perturbation budgets from 1/255 to 12/255. Every design choice was tuned on a separate validation split. The entire system was trained in about one hour on a 4 GB laptop GPU and is delivered with an interactive dashboard, a REST API and a crash-safe, reproducible training pipeline.", { line: 330 }),
  new Paragraph({ spacing: { before: 160 }, alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text: "Keywords: ", bold: true, font: FONT }),
    new TextRun({ text: "deepfake detection, adversarial robustness, agentic AI, multi-agent systems, FGSM, PGD, adversarial training, input purification, Vision Transformer, CLIP, LangGraph.", italics: true, font: FONT })] }),
  pageBreak(),
];
const tocs = [
  frontTitle("CONTENTS"),
  new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }),
  pageBreak(),
  frontTitle("LIST OF FIGURES"),
  new TableOfContents("List of Figures", { hyperlink: true, captionLabelIncludingNumbers: "Figure" }),
  ...blank(1),
  frontTitle("LIST OF TABLES"),
  new TableOfContents("List of Tables", { hyperlink: true, captionLabelIncludingNumbers: "Table" }),
];
const ABBR = [["AI", "Artificial Intelligence"], ["AMP", "Automatic Mixed Precision"], ["API", "Application Programming Interface"],
  ["AUC", "Area Under the ROC Curve"], ["CLIP", "Contrastive Language–Image Pre-training"], ["CNN", "Convolutional Neural Network"],
  ["DeiT", "Data-efficient Image Transformer"], ["FFT", "Fast Fourier Transform"], ["FGSM", "Fast Gradient Sign Method"],
  ["FGSM-RS", "FGSM with Random Start (fast adversarial training)"], ["GAN", "Generative Adversarial Network"], ["GPU", "Graphics Processing Unit"],
  ["JPEG", "Joint Photographic Experts Group (lossy image compression)"], ["P(adv)", "Estimated probability that an input was adversarially attacked"],
  ["PGD", "Projected Gradient Descent"], ["PSNR", "Peak Signal-to-Noise Ratio"], ["ROC", "Receiver Operating Characteristic"],
  ["TV", "Total Variation"], ["ViT", "Vision Transformer"]];
const abbreviations = [
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "List of Abbreviations", font: FONT })] }),
  new Table({ width: { size: TW, type: WidthType.DXA }, columnWidths: [2000, 7026],
    rows: ABBR.map(([a, b], i) => new TableRow({ children: [
      new TableCell({ width: { size: 2000, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: "auto", fill: i % 2 ? PALE : "FFFFFF" },
        borders: { top: thin, bottom: thin, left: thin, right: thin }, margins: { top: 50, bottom: 50, left: 120, right: 100 },
        children: [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: a, bold: true, font: FONT, size: 22 })] })] }),
      new TableCell({ width: { size: 7026, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: "auto", fill: i % 2 ? PALE : "FFFFFF" },
        borders: { top: thin, bottom: thin, left: thin, right: thin }, margins: { top: 50, bottom: 50, left: 120, right: 100 },
        children: [new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: b, font: FONT, size: 22 })] })] })] })) }),
];

// ---------- chapter 1
const ch1 = [
  H1("1  Introduction"),
  H2("1.1  The Deepfake Threat"),
  P("Generative models such as Generative Adversarial Networks {gan} have made it possible to synthesise or alter human faces with a realism that routinely deceives human observers. These *deepfakes* are used for entertainment and creative work, but also for non-consensual imagery, political disinformation, financial fraud and the bypassing of face-based identity verification {tolosana,mirsky}. Because humans can no longer reliably tell genuine from manipulated faces, automated detection has become a security necessity."),
  P("Deep-learning detectors trained on curated forensic datasets such as FaceForensics++ {ffpp} learn subtle statistical traces — blending boundaries, texture inconsistencies, frequency-domain artefacts {durall} — and commonly report accuracies above 90%. A conventional detection pipeline therefore looks deceptively simple: detect and crop the face, pass it through a trained classifier, and output *real* or *fake*."),
  H2("1.2  Why Deepfake Detectors Can Be Fooled"),
  P("Deep neural networks are known to be vulnerable to *adversarial examples*: inputs modified by small, deliberately computed perturbations that cause confident misclassification {szegedy,fgsm}. An attacker who has access to a detector — or to a similar model — can compute such a perturbation using the detector’s own gradients and add it to a deepfake so that the detector labels it *real*, while the image looks unchanged to a person {carlini_farid,hussain}."),
  P("Our own measurements confirm how severe this is. A carefully trained EfficientNet-B0 detector that is 88.7% accurate on clean test images drops to **33.2%** under the one-step Fast Gradient Sign Method (FGSM) and to **0.4%** under the iterative Projected Gradient Descent (PGD) attack, with every pixel changed by at most 4/255 of its intensity range. In other words, a deployed single-model detector offers almost no protection against a model-aware adversary. Typical detectors also share three structural weaknesses: they treat every input identically, they never check whether an input has been tampered with, and they output a single score with no explanation or notion of uncertainty."),
  H2("1.3  Agentic AI as a Defence Paradigm"),
  P("An *agent* is an autonomous component that perceives its environment, reasons about it and acts towards a goal {agents}; modern agentic systems compose several such components with tools and explicit control flow {react,langgraph}. We apply this idea to forensic detection. Instead of trusting one model, the system first *inspects* the input for signs of manipulation, *decides* how to treat it, *acts* (by purifying it and choosing suitable experts), *checks* the outcome, and finally *explains* its decision. Each of these responsibilities is assigned to a dedicated agent, and a central orchestrator routes the input between them based on the evidence gathered so far."),
  H2("1.4  Objectives"),
  ...numbered([
    "To build a deepfake detector and to quantify its vulnerability to FGSM and PGD adversarial attacks.",
    "To design a multi-agent framework that detects adversarial manipulation, adaptively purifies inputs, dynamically selects robust models and verifies results with interpretable forensic evidence.",
    "To evaluate the framework rigorously against a traditional detector and simpler defences under several threat models, using held-out test data.",
    "To deliver a usable system — an interactive dashboard and a REST API — that produces a verdict, a calibrated confidence and an explainable audit report.",
  ]),
  H2("1.5  Contributions"),
  ...bullets([
    "**A four-agent detection architecture** (attack detection, adaptive sanitisation, dynamic model selection, forensic verification) orchestrated as a LangGraph state graph with conditional routing at P(adv) > 0.65.",
    "**A closed-loop sanitiser** that chooses an attack-specific purification recipe and asks the attack detector to re-check its output, escalating only when needed.",
    "**A deliberately diverse detector pool** — two CNNs, a Vision Transformer and a CLIP-based detector — and empirical evidence that architectural diversity is what defeats transferred attacks.",
    "**Safe-failure behaviour**: when detectors with different architectures strongly disagree, the system lowers its confidence and requests human review instead of issuing a confident wrong verdict.",
    "**A rigorous evaluation**: four conditions including an adaptive attack, an attack-strength sweep, ablations across four development versions, and honest case studies, with all tuning done on validation data.",
    "**Efficient, reproducible engineering**: the whole system trains in about one hour on a 4 GB laptop GPU, using crash-safe checkpointing that survived real thermal shutdowns.",
  ]),
  H2("1.6  Organisation of the Report"),
  P("Chapter 2 reviews related work and identifies the research gap. Chapter 3 formalises the problem and threat model. Chapter 4 describes the proposed architecture and each agent in detail. Chapter 5 covers the dataset and implementation, and Chapter 6 the experimental setup. Chapter 7 presents and analyses the results. Chapter 8 discusses why the approach works and where its guarantees end, Chapter 9 lists limitations and future work, and Chapter 10 concludes. The appendices explain how to run the project."),
];

// ---------- chapter 2
const ch2 = [
  H1("2  Background and Related Work"),
  H2("2.1  Deepfake Detection"),
  P("Early detectors relied on hand-crafted physiological and signal cues, such as abnormal eye-blinking {blink} or spectral artefacts introduced by the up-sampling layers of generative networks {durall}. The release of large benchmarks — FaceForensics++ {ffpp}, Celeb-DF {celebdf}, the DeepFake Detection Challenge {dfdc} and OpenForensics {openforensics} — enabled data-driven detectors. CNNs such as XceptionNet {xception} and EfficientNet {efficientnet} became standard baselines, and Vision Transformers {vit,deit} have since been applied as well."),
  P("A recurring problem is *generalisation*: detectors that excel on one dataset often fail on images from other sources, because they learn dataset-specific artefacts. Ojha *et al.* {univfd} showed that a frozen, general-purpose CLIP image encoder {clip} with only a linear classifier on top generalises far better than fully fine-tuned networks — an observation we exploit in our fourth detector."),
  H2("2.2  Adversarial Attacks"),
  P("Szegedy *et al.* {szegedy} first showed that imperceptible perturbations can fool deep networks. Goodfellow *et al.* {fgsm} introduced FGSM, a single gradient-sign step; Madry *et al.* {pgd} formalised robustness as a min–max problem and introduced PGD, an iterative and much stronger attack that is now the standard benchmark. Adversarial examples also *transfer*: perturbations crafted on one model often fool others trained for the same task {transfer}, although transfer is weaker between dissimilar architectures {vit_robust}. Carlini and Farid {carlini_farid} and Hussain *et al.* {hussain} demonstrated that state-of-the-art deepfake detectors can be reduced to near-zero accuracy by such attacks."),
  H2("2.3  Adversarial Defences"),
  P("**Adversarial training** {pgd} trains on attacked inputs; it is effective but expensive, and Wong *et al.* {fast_at} made it practical with a single FGSM step from a random start (FGSM-RS). **Input transformations** such as JPEG compression, bit-depth reduction and Total Variation minimisation {guo,rof,chambolle} remove part of the perturbation before classification. **Detection-based defences** decide whether an input is adversarial; *feature squeezing* {squeeze} compares a model’s prediction on the original and on “squeezed” versions of the input. **Ensembles** of diverse models reduce transferability {ens_at}. Each of these defences has known weaknesses when used alone: static transformations can be circumvented by adaptive attackers {obfuscated}, and detectors can be bypassed if the attacker targets them directly {not_easily}."),
  H2("2.4  Agentic AI and Multi-Agent Orchestration"),
  P("Classical multi-agent systems decompose a problem into autonomous, cooperating agents with local goals {agents}. Recent agentic frameworks interleave reasoning with tool use {react}, and libraries such as LangGraph {langgraph} express such workflows as explicit state graphs: nodes perform actions on a shared state and conditional edges choose the next node at run time. This is a natural fit for a forensic pipeline whose processing path should depend on what has been observed about the input."),
  H2("2.5  Research Gap"),
  P(`${T("gap")} compares the main families of approaches. Each existing defence addresses one aspect of the problem; none combines attack awareness, input-specific adaptation, model diversity and an explainable, uncertainty-aware output in one system. This gap motivates our design.`),
  ...table("gap", "Comparison of existing approaches with the proposed framework",
    ["Approach", "Detects the attack?", "Adapts per input?", "Model diversity", "Explainable output", "Main weakness"],
    [["Standard CNN detector {xception,efficientnet}", "No", "No", "No", "No", "Collapses under attack"],
      ["Adversarial training {pgd,fast_at}", "No", "No", "No", "No", "Costly; partial robustness"],
      ["Static input transformation {guo}", "No", "No", "No", "No", "Same filter for every input"],
      ["Feature-squeezing detector {squeeze}", "Yes", "No", "No", "Partial", "Detects but does not recover"],
      ["Model ensemble {ens_at}", "No", "No", "Yes", "No", "Always pays full cost"],
      ["**Proposed agentic framework**", "**Yes**", "**Yes**", "**Yes**", "**Yes**", "Higher latency on attacked inputs"]],
    [2426, 1100, 1100, 1100, 1200, 2100], { center: [1, 2, 3, 4], size: 19, highlight: r => r === 5 }),
];

// ---------- chapter 3
const ch3 = [
  H1("3  Problem Formulation and Threat Model"),
  H2("3.1  Deepfake Detection as Binary Classification"),
  P("Let x denote an RGB face crop of size 3×224×224 with pixel values scaled to [0, 1], and let y ∈ {0, 1} be its label (0 = real, 1 = fake). A detector f maps x to two logits; the softmax of the *fake* logit gives the probability p(x) that the face is a deepfake, and the predicted label is *fake* when p(x) ≥ 0.5. The goal of the defender is to keep this prediction correct even when x has been perturbed by an adversary."),
  H2("3.2  Threat Model"),
  P("We follow the threat model of the project proposal: the attacker is **model-aware**. It knows the deployed (traditional) detector, including its weights, and can compute gradients through it. Its goal is to flip the detector’s decision — typically to make a deepfake pass as real — while keeping the change imperceptible. Formally, the attacker solves"),
  equation("eq_threat", 1),
  P("where 𝓛 is the cross-entropy loss and the L∞ budget ε = 4/255 means that no pixel may change by more than 4 intensity levels out of 255 (about 1.6%). We additionally evaluate (i) a *stronger, adaptive* attacker who targets our adversarially trained model directly and (ii) budgets from ε = 1/255 to 12/255."),
  H2("3.3  Attack Algorithms"),
  P("**FGSM** {fgsm} takes one step of size ε in the direction of the sign of the loss gradient:"),
  equation("eq_fgsm", 2),
  P("**PGD** {pgd} repeats smaller steps of size α from a random starting point and projects back onto the ε-ball 𝓑ε(x) after every step:"),
  equation("eq_pgd", 3),
  P(`Both attacks were implemented from scratch in PyTorch. Their parameters are summarised in ${T("attackparams")}.`),
  ...table("attackparams", "Attack configurations used in this work",
    ["Attack", "Steps", "Step size α", "Budget ε", "Random start", "Target model"],
    [["FGSM", "1", "ε", "4/255", "No", "Traditional detector"], ["PGD", "10", "1/255", "4/255", "Yes", "Traditional detector"],
      ["PGD-adaptive", "10", "1/255", "4/255", "Yes", "Robust (adversarially trained) model"],
      ["PGD sweep", "10", "max(ε/4, 0.5/255)", "1–12 /255", "Yes", "Traditional detector"]],
    [1700, 900, 1700, 1300, 1300, 2126], { center: [1, 2, 3, 4], boldFirst: true }),
  H2("3.4  Design Goals"),
  ...bullets([
    "**G1 – Robustness:** remain accurate under FGSM and PGD attacks of practical strength.",
    "**G2 – Clean accuracy:** defending against attacks must not reduce accuracy on genuine, unattacked inputs.",
    "**G3 – Efficiency:** clean inputs should take a fast path; expensive defences should run only when needed.",
    "**G4 – Explainability:** every decision should come with a human-readable trace of what each agent observed and did.",
    "**G5 – Safe failure:** when the system is likely to be wrong, it should say so and request human review.",
  ]),
];

// ---------- chapter 4
const ch4 = [
  H1("4  Proposed System Architecture"),
  H2("4.1  Overview"),
  P(`${F("arch")} shows the complete architecture. An uploaded image or video is first processed by the media processor, which samples frames and crops faces. The central orchestrator then passes each face through four agents. Agent 1 estimates the probability P(adv) that the input has been adversarially attacked. If P(adv) exceeds 0.65, the input is routed to Agent 2, which purifies it and asks Agent 1 to re-check the result; otherwise it goes directly to Agent 3. Agent 3 selects which detectors from the model pool to consult and how to weight their votes. Agent 4 cross-checks the decision with independent forensic evidence and produces the final verdict, a confidence score, a human-review flag and a complete audit report.`),
  ...figure("arch", 520, "Architecture of the proposed agentic deepfake detection framework. Red arrows show the attack path, green the clean path; the dashed arrow is Agent 2’s self-verification loop."),
  H2("4.2  Central Orchestrator"),
  P(`The orchestrator is implemented as a LangGraph {langgraph} \`StateGraph\` with four nodes — \`attack_audit\`, \`sanitize\`, \`dispatch\` and \`verify\` — and one conditional edge after \`attack_audit\` that routes to \`sanitize\` when P(adv) > 0.65 and to \`dispatch\` otherwise. All agents read from and write to a shared state (${T("state")}), so later agents can base their decisions on what earlier agents observed. If LangGraph is unavailable, an API-compatible built-in state-graph engine with identical semantics is used, so the system always runs.`),
  ...table("state", "Fields of the shared orchestrator state",
    ["Field", "Written by", "Content"],
    [["`x`", "Media processor", "Face crop as a 1×3×224×224 tensor in [0, 1]"],
      ["`threat`", "Agent 1", "P(adv), attack type, per-class probabilities, routing decision"],
      ["`x_sanitized`, `sanitization`", "Agent 2", "Purified image and the list of cleaning attempts"],
      ["`selection`", "Agent 3", "Route taken, each model’s output, vote weights, disagreement flag"],
      ["`verdict`", "Agent 4", "Label, P(fake), confidence, forensic cues, notes, human-review flag"],
      ["`log`, `timings`", "All agents", "Human-readable trace and per-agent latency"]],
    [2600, 1700, 4726]),
  H2("4.3  Media Processor"),
  P("Faces are located with OpenCV’s Haar-cascade detector {viola}. The largest face is cropped with a 30% margin and resized to 224×224 pixels; inputs that are already tight face crops are used directly. For videos, 12 frames are sampled uniformly, and a separate pass over up to 20 seconds of footage estimates the blink rate."),
  H2("4.4  Agent 1: Noise and Attack Detector"),
  P("Agent 1 answers the question *“has this image been tampered with to fool the detector?”* before any detector is trusted. It combines three families of evidence:"),
  ...bullets([
    "**Feature squeezing** {squeeze}: adversarial perturbations are brittle. When the input is “squeezed” by JPEG compression (quality 75), a 3×3 median filter, 5-bit colour reduction or a light Gaussian blur, the traditional detector’s logit margin z(x) moves far more for an attacked image than for a natural one:",
  ]),
  equation("eq_squeeze", 4),
  ...bullets([
    "**Fourier analysis:** attack noise adds unusual high-frequency energy. Agent 1 measures the share of spectral energy at normalised radius r > 0.5 and the slope of the spectral tail:",
  ]),
  equation("eq_hf", 5),
  ...bullets(["**Noise residual:** the difference between the image and its median-filtered version, summarised by its standard deviation, mean absolute value and kurtosis."]),
  P(`The resulting 13 features (${T("features")}) feed a histogram gradient-boosting classifier {gbdt,sklearn} that outputs probabilities for *clean*, *FGSM* and *PGD*; P(adv) = 1 − P(clean). To prevent false alarms on ordinary photographs, JPEG-compressed and blurred clean images were included in the *clean* class during training.`),
  ...table("features", "The 13 features used by Agent 1",
    ["Group", "Features", "Intuition"],
    [["Detector behaviour", "logit margin z(x), confidence", "Attacks often push the detector to extreme confidence"],
      ["Feature squeezing", "shift under JPEG, median, 5-bit, blur; maximum shift; number of label flips", "Natural images are stable under squeezing; attacked images are not"],
      ["Fourier spectrum", "high-frequency energy ratio, spectral-tail slope", "Perturbations add fine high-frequency patterns"],
      ["Noise residual", "residual standard deviation, mean |residual|, kurtosis", "Perturbation noise differs from camera grain"]],
    [1900, 3726, 3400], { boldFirst: true }),
  H2("4.5  Agent 2: Adaptive Sanitizer"),
  P(`Agent 2 removes the perturbation while preserving forensic detail. It holds four purification recipes of increasing strength (${T("recipes")}). Total Variation (TV) denoising {rof} smooths noise while keeping edges, and is solved on the GPU with Chambolle’s projection algorithm {chambolle}:`),
  equation("eq_tv", 6),
  P("The sanitiser is *adaptive* in two ways. First, its starting recipe depends on the attack type reported by Agent 1: FGSM, which spreads full-budget noise over every pixel, starts with TV smoothing plus JPEG; PGD, whose finer structure is destroyed by compression, starts with a median filter plus JPEG. These choices were made on validation data (Section 7.5). Second, it is *self-verifying*: after each attempt it asks Agent 1 to re-score the cleaned image and escalates to a stronger recipe only if the residual P(adv) is still above 0.65 (at most three rounds). Image quality is logged as the PSNR between the cleaned and the received image:"),
  equation("eq_psnr", 7),
  ...table("recipes", "Purification recipes available to Agent 2",
    ["Level", "Recipe", "Operations", "Default start for"],
    [["1", "Light compression", "JPEG, quality 85", "—"], ["2", "Compression + noise filter", "3×3 median filter, then JPEG quality 70", "PGD"],
      ["3", "Smoothing + compression", "TV denoising (λ = 0.06), then JPEG quality 70", "FGSM"],
      ["4", "Strong smoothing + blur + compression", "TV (λ = 0.12), Gaussian blur (σ = 0.7), JPEG quality 60", "Escalation only"]],
    [800, 2700, 3826, 1700], { center: [0, 3] }),
  H2("4.6  Agent 3: Dynamic Model Selector"),
  P(`Agent 3 decides which detectors to trust for this particular input. The model pool (${T("pool")}) is deliberately diverse: two convolutional networks and two transformers, three fine-tuned and one used as a fixed feature extractor. The final score is a weighted vote:`),
  equation("eq_ensemble", 8),
  ...table("pool", "The detector pool used by Agent 3",
    ["Name", "Architecture", "Parameters", "Training", "Role"],
    [["Traditional", "EfficientNet-B0 {efficientnet}", "5.3 M", "Fine-tuned, 1 epoch", "Baseline; the model the attacker targets"],
      ["Robust", "EfficientNet-B0", "5.3 M", "Adversarial fine-tuning (FGSM-RS)", "Robustness specialist"],
      ["ViT", "DeiT-Tiny {deit}", "5.7 M", "Fine-tuned, 1 epoch", "Second opinion; resists transferred attacks"],
      ["CLIP", "CLIP ViT-B/16 {clip}", "86 M", "Encoder kept fixed; linear layer trained", "Generalises to unfamiliar photo styles"]],
    [1300, 2200, 1200, 2226, 2100], { boldFirst: true, center: [2] }),
  P("Three routes are possible:"),
  ...bullets([
    "**Quick check (clean, confident):** the Traditional model and the ViT are consulted. If they agree and both are confident, their average is returned. Two architecturally different models agreeing is strong evidence, so the larger models are skipped.",
    "**Full vote (clean, uncertain or disagreeing):** all four models vote with weights Traditional 0.25, ViT 0.25, Robust 0.10 and CLIP 0.40. If the models’ scores differ by more than 0.5, a *disagreement* is reported to Agent 4.",
    "**Attack path:** the Traditional model is considered compromised — the attacker computed the perturbation on it — and the Robust model shares its weights and architecture. The cleaned image is therefore judged by the ViT and CLIP with equal weight.",
  ]),
  P("All weights were selected on the validation split (Section 7.4) and are stored in a configuration file, so they can be changed without modifying code."),
  H2("4.7  Agent 4: Forensic Verifier"),
  P(`Agent 4 provides an independent, interpretable check. It measures six signal-level clues (${T("clues")}) and converts each into a *fakeness* score between 0 and 1 with a Gaussian likelihood ratio fitted on validation data:`),
  equation("eq_cue", 9),
  ...table("clues", "Forensic clues measured by Agent 4",
    ["Clue (dashboard name)", "Measurement", "Why it can indicate a deepfake"],
    [["Fine detail", "High-frequency spectral energy ratio", "Generators reproduce fine detail imperfectly {durall}"],
      ["Hidden patterns", "Slope of the high-frequency spectral tail", "Up-sampling layers leave periodic spectral fingerprints"],
      ["Camera grain", "Standard deviation of the noise residual", "Synthetic faces lack natural sensor noise"],
      ["Grain shape", "Kurtosis of the noise residual", "Natural sensor noise has a characteristic distribution"],
      ["Skin smoothness", "Variance of the Laplacian", "Synthetic skin is often overly smooth"],
      ["Lighting balance", "Left/right luminance asymmetry", "Pasted faces may be lit inconsistently with the scene"]],
    [2200, 3026, 3800], { boldFirst: true }),
  P("A logistic-regression model over the six clues gives an independent forensic score. Because these clues are weak on their own (Section 5.4), they never override confident models; they are used to break ties when the model score lies between 0.35 and 0.65, and to lower the confidence when they disagree. The final confidence is"),
  equation("eq_conf", 10),
  P("where a measures agreement between the consulted models, γf = 0.85 if the forensic clues disagree with the verdict (else 1) and γd = 0.6 if Agent 3 reported a strong disagreement (else 1). The verdict is flagged for **human review** when c < 0.3 or a strong disagreement occurred. For videos, Agent 4 additionally flags large frame-to-frame score fluctuations (standard deviation above 0.25) and abnormally low blink rates (below 4 blinks per minute, against a typical 8–30) {blink}."),
  H2("4.8  End-to-End Algorithm"),
  ...codeBox([
    "Algorithm 1: Agentic adaptive deepfake detection",
    "Input : image or video V;  threshold tau = 0.65",
    "Output: label, P(fake), confidence, human-review flag, audit report",
    "1  for each sampled frame of V:",
    "2      x <- crop_and_resize_face(frame)                  # media processor",
    "3      (p_adv, type) <- Agent1(x)                        # attack audit",
    "4      if p_adv > tau:                                   # conditional edge",
    "5          level <- start_level(type)                    # FGSM: 3, PGD: 2",
    "6          repeat up to 3 times:",
    "7              x_s <- RECIPE[level](x)",
    "8              if Agent1(x_s).p_adv < tau: break          # self-verification",
    "9              level <- level + 1",
    "10         p <- 0.5 * ViT(x_s) + 0.5 * CLIP(x_s)          # attack path",
    "11     else if Traditional and ViT agree confidently:",
    "12         p <- mean(Traditional(x), ViT(x))              # quick check",
    "13     else:",
    "14         p <- weighted vote of all four models          # full vote",
    "15     verdict <- Agent4(p, model outputs, forensic clues)",
    "16 aggregate frames (mean score, flicker, blink rate); return verdict + audit",
  ]),
];

// ---------- chapter 5
const ch5 = [
  H1("5  Dataset and Implementation"),
  H2("5.1  Dataset"),
  P(`We use the public *Deepfake and Real Images* dataset {kaggle}, derived from OpenForensics {openforensics}, an in-the-wild benchmark whose manipulated faces were produced by GAN-based face-synthesis methods. It contains 190,335 face crops of 256×256 pixels. Given a one-day development window and a 4 GB GPU, we used a balanced subset, as anticipated in the project proposal. Instead of downloading the full 1.8 GB archive, our downloader fetched only the required 100-image blocks from a Parquet mirror using parallel HTTP range requests (about 250 MB). The test images come from a disjoint portion of the dataset and were used only for final evaluation (${T("data")}).`),
  ...table("data", "Dataset splits used in this project",
    ["Split", "Real", "Fake", "Total", "Used for"],
    [["Train", "9,000", "9,000", "18,000", "Detector training (12,000 for the CNN/ViT models; 8,000 + 8,000 phone-style copies for CLIP)"],
      ["Validation", "2,467", "2,500", "4,967", "Model selection, Agent 1 and Agent 4 training, sanitiser and ensemble tuning"],
      ["Test", "1,000", "1,000", "2,000", "Final evaluation only (256 images in the main benchmark, 96 in the ε sweep)"]],
    [1300, 900, 900, 1000, 4926], { boldFirst: true, center: [1, 2, 3] }),
  P("**Adversarial samples are generated, not downloaded.** An adversarial perturbation is specific to the model it was computed on, so a pre-made dataset of attacked images would not test our detectors fairly. All attacked images were generated from the clean images with our own FGSM and PGD implementations — during adversarial training, for training Agent 1, for tuning, and for the final benchmark — exactly as outlined in the project proposal."),
  H2("5.2  Training the Detector Pool"),
  P(`All detectors are implemented in PyTorch {pytorch} and start from ImageNet-pretrained weights from the timm library {timm} and are fine-tuned for a single epoch, which is sufficient for pretrained backbones on this task. Training used AdamW {adamw}, a OneCycle learning-rate schedule {onecycle} and automatic mixed precision {mixed}; the hyperparameters are listed in ${T("hyper")}. The Robust model starts from the Traditional model’s weights and is fine-tuned with fast adversarial training (FGSM-RS) {fast_at}: in every batch, half of the images are replaced by adversarial versions generated on the fly,`),
  equation("eq_fgsmrs", 11),
  P("so the model learns to classify attacked faces correctly while the clean half preserves its clean accuracy. The Robust model and the ViT were also trained with random JPEG compression and blur so that they remain accurate on images cleaned by Agent 2."),
  ...table("hyper", "Training hyperparameters",
    ["Setting", "Traditional", "Robust", "ViT"],
    [["Backbone", "EfficientNet-B0", "EfficientNet-B0", "DeiT-Tiny/16"], ["Initialisation", "ImageNet", "Traditional model", "ImageNet"],
      ["Training images / epochs", "12,000 / 1", "12,000 / 1", "12,000 / 1"], ["Peak learning rate", "4×10⁻⁴", "2×10⁻⁴", "1×10⁻⁴"],
      ["Weight decay", "10⁻⁴", "10⁻⁴", "0.05"], ["Batch size / input size", "32 / 224×224", "32 / 224×224", "32 / 224×224"],
      ["Augmentation", "crop, flip, colour jitter", "+ random JPEG and blur", "+ random JPEG and blur"],
      ["Adversarial training", "—", "FGSM-RS, ε = 4/255, 50% of batch", "—"],
      ["Other", "label smoothing 0.05, gradient clipping 2.0, AMP", "same", "same"]],
    [2426, 2200, 2200, 2200], { boldFirst: true, center: [1, 2, 3], size: 19 }),
  ...table("trainres", "Detector training results (validation split)",
    ["Model", "Validation accuracy", "Validation AUC", "Training time"],
    [["Traditional", "94.7%", "0.987", "8.4 min"], ["Robust", "94.3%", "0.986", "9.4 min"], ["ViT", "94.1%", "0.989", "4.2 min"],
      ["CLIP (linear probe)", "91.3% (87.6% phone-style)", "0.966", "≈ 20 min (feature extraction)"]],
    [2426, 2600, 1800, 2200], { boldFirst: true, center: [1, 2, 3] }),
  H2("5.3  CLIP Detector and Phone-Style Augmentation"),
  P("During testing we observed that a genuine smartphone portrait was classified as fake with 97% confidence by both CNNs. Modern phone cameras apply portrait-mode background blur, skin smoothing and HDR tone mapping — exactly the kind of “too smooth” appearance that CNNs trained on a single dataset associate with deepfakes. We addressed this in two ways."),
  P(`First, we added a CLIP-based detector following UnivFD {univfd}. The CLIP ViT-B/16 image encoder, pre-trained on 400 million image–text pairs {clip}, is kept fixed and maps each face to a 768-dimensional feature vector φ(x); only a logistic-regression layer is trained on top:`),
  equation("eq_clip", 12),
  P(`Because the encoder is not fine-tuned on our small dataset, it cannot over-fit to dataset-specific artefacts. The regularisation strength was selected on validation data (C = 0.05), and the feature standardisation was folded into the linear layer so that the detector behaves like any other differentiable model. Second, we introduced a **phone-style augmentation** (${F("aug")}) that applies one to three random operations — portrait blur, bilateral skin smoothing, HDR-like tone and saturation changes, and low-resolution up-scaling with JPEG — to real *and* fake images alike, so that these effects carry no label information. The CLIP probe was trained on 8,000 images plus 8,000 augmented copies.`),
  ...figure("aug", 560, "Phone-style augmentation applied to a real training image. The same operations are applied to fake images, so smoothness and blur stop being a shortcut for “fake”."),
  H2("5.4  Training Agent 1 and Agent 4"),
  P("Agent 1’s classifier was trained on 1,800 validation images (900 real, 900 fake). For each image we generated five versions — the clean image, a JPEG-compressed copy (random quality 55–95), a blurred copy, an FGSM version and a PGD version — with ε drawn from {2, 3, 4, 6, 8}/255 and PGD steps from 5 to 15, giving 9,000 labelled feature vectors. Training on a range of attack strengths makes the detector robust to budgets it was not explicitly shown. Agent 4’s per-clue statistics and logistic regression were fitted on the clean versions of the same images; on their own the six forensic clues reach only 60.7% accuracy, which is why Agent 4 is used for verification and tie-breaking rather than as a primary detector."),
  H2("5.5  Crash-Safe Training on Constrained Hardware"),
  P("All development ran on a laptop with an NVIDIA GeForce RTX 2050 (4 GB). Under sustained load the GPU reached 90 °C and throttled its clock from up to 2,100 MHz to 210 MHz; the machine also shut down once during training. We therefore engineered the pipeline to be interruption-proof: training checkpoints are written atomically (temporary file, then rename) every 50 steps or 90 seconds with a backup copy; feature extraction and evaluation cache every batch to disk; finished stages are detected and skipped; and a single command (`resume.bat`) continues the whole pipeline from the last saved point. We also removed a memory-layout setting (channels-last) that made EfficientNet eight times slower on this GPU. With these measures the complete detector pool trained in about 22 minutes."),
  H2("5.6  Software Stack"),
  ...table("stack", "Software stack",
    ["Layer", "Technology", "Role in the project"],
    [["Agent orchestration", "LangGraph 0.6", "State graph, conditional routing, shared state"], ["Deep learning", "PyTorch 2.8 (CUDA 12.6), timm 1.0", "Detectors, attacks, GPU purification filters"],
      ["Foundation model", "OpenAI CLIP ViT-B/16 (via timm)", "Fixed feature extractor for the fourth detector"], ["Classical ML", "scikit-learn 1.6", "Agent 1 gradient boosting, Agent 4 and CLIP logistic regression"],
      ["Vision", "OpenCV 4.14, Pillow", "Face and eye detection, video frames, JPEG, augmentation"], ["Interface", "Streamlit 1.50, Plotly", "Interactive dashboard with charts and audit download"],
      ["Service", "FastAPI, Uvicorn", "REST endpoint `POST /analyze`"], ["Language / OS", "Python 3.9, Windows 11", "Development and deployment environment"]],
    [2200, 3226, 3600], { boldFirst: true }),
  H2("5.7  Interactive Dashboard and REST API"),
  P("The Streamlit dashboard has three pages. **Live Analysis** accepts an image, a video or a picture from a gallery of held-out test images, and includes a *red-team simulator* that attacks the chosen image with FGSM or PGD at a selectable ε. It shows the original, attacked, amplified-noise and cleaned images; the verdicts of the traditional detector and of our system side by side; the step-by-step trace of all four agents; a radar chart of Agent 4’s clues; a chart of which models voted and how much; and a downloadable JSON audit report. **Benchmark Results** presents the evaluation of Chapter 7, and **Architecture** shows the agent graph. All dashboard wording was written for non-specialist readers. A FastAPI service exposes the same pipeline through `POST /analyze` for integration with other systems."),
];

// ---------- chapter 6
const ch6 = [
  H1("6  Experimental Setup"),
  H2("6.1  Evaluation Protocol"),
  P("The main benchmark uses 256 images (128 real, 128 fake) from the held-out test split, none of which were seen during training or tuning. Each image is evaluated under four conditions: *no attack*; *FGSM* and *PGD* attacks (ε = 4/255) computed on the traditional detector; and *PGD-adaptive*, in which the attack is computed on the Robust model instead. A separate sweep evaluates 96 test images under PGD with ε ∈ {0, 1, 2, 4, 8, 12}/255. The full agentic pipeline is run once per image and condition, exactly as in deployment."),
  H2("6.2  Compared Systems"),
  ...bullets([
    "**Traditional model:** the EfficientNet-B0 detector used alone — the conventional approach.",
    "**Traditional + JPEG cleaning:** a static defence that always JPEG-compresses (quality 75) before classifying.",
    "**Robust model alone:** the adversarially trained EfficientNet-B0 without any agents.",
    "**Agentic AI (proposed):** the complete four-agent system.",
  ]),
  H2("6.3  Metrics"),
  ...bullets([
    "**Accuracy:** percentage of all images classified correctly.",
    "**Fake detection rate:** percentage of fake images classified as fake (recall on the fake class).",
    "**AUC:** area under the ROC curve; 1 means perfect separation of real and fake, 0.5 means guessing.",
    "**Attack detection rate:** percentage of inputs that Agent 1 marked as attacked (on clean images, this is the false-alarm rate).",
    "**Attack damage prevented** D: the share of the traditional detector’s accuracy loss that our system avoids,",
  ]),
  equation("eq_damage", 13),
  ...bullets(["**Latency:** mean end-to-end time per image for all agents, measured on the laptop GPU."]),
  P("With 256 images, a measured accuracy around 85% has a 95% confidence interval of roughly ±4.4 percentage points; differences smaller than this should be read as indicative rather than conclusive."),
  H2("6.4  Hardware"),
  P("All experiments ran on a laptop with an NVIDIA GeForce RTX 2050 (4 GB VRAM) under Windows 11. Because the GPU was frequently thermally throttled, the latency figures are conservative; a desktop or server GPU would be considerably faster."),
];

// ---------- chapter 7
const ch7 = [
  H1("7  Results and Analysis"),
  H2("7.1  Main Results"),
  P(`${T("main")} and ${F("bench")} summarise the benchmark. The traditional detector is 88.7% accurate on clean images but collapses under attack: 33.2% under FGSM and **0.4%** under PGD. Neither simple defence helps reliably — JPEG cleaning alone even lowers FGSM accuracy to 14.5%, and the Robust model alone reaches only 53.5% and 14.1%. The agentic system is the most accurate in **every** condition: 94.1% on clean images, **84.4%** under FGSM, **85.5%** under PGD and **84.0%** under the adaptive attack on the Robust model.`),
  ...table("main", "Main benchmark results on 256 held-out test images (ε = 4/255). Accuracy (%) with fake-detection rate (%) in brackets.",
    ["Test condition", "Traditional", "Traditional + JPEG", "Robust alone", "Agentic AI (ours)"],
    [["No attack", "88.7 (85.2)", "87.5 (81.2)", "88.3 (83.6)", "**94.1 (93.8)**"], ["FGSM", "33.2 (21.1)", "14.5 (10.9)", "53.5 (68.0)", "**84.4 (76.6)**"],
      ["PGD", "0.4 (0.8)", "15.2 (16.4)", "14.1 (7.8)", "**85.5 (77.3)**"], ["PGD on Robust (adaptive)", "19.9 (23.4)", "65.6 (66.4)", "0.0 (0.0)", "**84.0 (77.3)**"],
      ["AUC, no attack", "0.961", "0.959", "0.956", "**0.987**"]],
    [2426, 1600, 1700, 1600, 1700], { boldFirst: true, center: [1, 2, 3, 4] }),
  ...figure("bench", 580, "Accuracy of the four systems under each test condition (256 held-out images, ε = 4/255)."),
  P("Averaged over FGSM and PGD, the agentic system is **85.0%** accurate under attack versus 16.8% for the traditional detector, and it prevents **82.4%** (FGSM) and **90.3%** (PGD) of the accuracy loss the attacks cause. Its clean accuracy is also 5.4 points *higher* than the traditional detector’s, so robustness was gained without sacrificing clean performance (goal G2)."),
  ...callout("Key result", "An invisible perturbation that makes the traditional detector wrong on 99.6% of images leaves the agentic system correct on 85.5% of them — and the system is also more accurate than the traditional detector when there is no attack at all."),
  H2("7.2  Attack Detection Performance"),
  P(`Agent 1 is the gatekeeper of the whole system, so its accuracy is critical. On the held-out 20% of its training data (1,800 feature vectors), it identified the attack condition with the precision and recall shown in ${T("agent1")}; its confusion matrix is shown in ${F("cm")}. The area under the ROC curve for *attacked versus clean* is **0.9999**. Only 3 of 1,080 clean variants (0.3%) were falsely flagged, and the few remaining errors were mostly confusions between FGSM and PGD, which still route the input to the attack path.`),
  ...table("agent1", "Agent 1 classification performance (held-out 20% split)",
    ["Class", "Precision", "Recall", "F1-score", "Samples"],
    [["Clean (incl. JPEG / blur)", "99.3%", "99.7%", "99.5%", "1,080"], ["FGSM", "97.5%", "97.5%", "97.5%", "360"], ["PGD", "99.7%", "98.3%", "99.0%", "360"]],
    [2826, 1550, 1550, 1550, 1550], { boldFirst: true, center: [1, 2, 3, 4] }),
  ...figure("cm", 330, "Confusion matrix of Agent 1 on its held-out split."),
  P("On the benchmark test images, Agent 1 flagged 99.2% of FGSM, 100% of PGD and 97.3% of adaptive-PGD inputs. Its false-alarm rate on clean test images was 4.3% — higher than on validation data because the test images come from a different part of the dataset — but a false alarm is not harmful: the image is merely cleaned and judged by the ViT and CLIP, which classify clean images well."),
  H2("7.3  Robustness Across Attack Strengths"),
  P(`${F("eps")} shows accuracy as the PGD budget grows from 0 to 12/255. The traditional detector is already defeated at ε = 1/255 (0% accuracy) — a perturbation of a single intensity level. The agentic system stays between **88.5% and 90.6%** at every budget, and Agent 1 flags 100% of attacked inputs while raising no alarm on the clean images. The partial recovery of the traditional detector at ε = 12/255 (56%) is an artefact of the attack, not a strength of the detector: with large step sizes, ten PGD steps overshoot and fail to converge. A stronger attack with more steps would drive it back towards zero.`),
  ...figure("eps", 470, "Accuracy versus attack strength ε for PGD-10 on 96 held-out images. Grey squares show how often Agent 1 marked the input as attacked."),
  H2("7.4  Why Model Diversity Matters"),
  P(`${F("div")} shows each detector’s accuracy on 400 validation images under four conditions; the attacked images had already been cleaned by Agent 2. On clean images all four models perform similarly (92–94%). Under attack they diverge sharply: the two EfficientNet models — the attacked model itself and the Robust model derived from it — fall to 58–76%, whereas the **ViT (89–91%)** and **CLIP (84–86%)** remain accurate. Because perturbations are computed from one model’s gradients, they transfer poorly to models with entirely different architectures and weights {transfer,vit_robust}. The ViT and CLIP are also the best models on phone-style images (90.5% and 89.8%).`),
  ...figure("div", 560, "Single-model accuracy on the validation split for clean images, phone-style images and cleaned FGSM / PGD images."),
  P(`These observations determined Agent 3’s weights (${T("ens")}). Adding CLIP to the clean-path vote raised phone-style accuracy from 90.5% to 94.8%, and replacing the Robust model with CLIP on the attack path raised accuracy from 86.8% / 89.5% to 88.8% / 91.8%.`),
  ...table("ens", "Selection of Agent 3’s ensemble weights on the validation split (400 images)",
    ["Path", "Candidate weights", "Result 1", "Result 2"],
    [["Clean vote", "Traditional 0.40, ViT 0.35, Robust 0.25 (earlier version)", "96.8% clean", "90.5% phone-style"],
      ["Clean vote", "Traditional 0.30, ViT 0.30, CLIP 0.40", "97.2% clean", "94.0% phone-style"],
      ["Clean vote", "**Traditional 0.25, ViT 0.25, Robust 0.10, CLIP 0.40 (chosen)**", "**97.2% clean**", "**94.8% phone-style**"],
      ["Attack path", "Robust 0.35, ViT 0.65 (earlier version)", "86.8% FGSM", "89.5% PGD"],
      ["Attack path", "Robust 0.20, ViT 0.40, CLIP 0.40", "87.5% FGSM", "91.8% PGD"],
      ["Attack path", "**ViT 0.50, CLIP 0.50 (chosen)**", "**88.8% FGSM**", "**91.8% PGD**"]],
    [1500, 4126, 1700, 1700], { center: [2, 3], size: 19 }),
  P("A complementary check on 800 validation images showed why the clean path must never rely on one model: the 3-model vote reached 95.1% against 93.4% for the Traditional model alone, and on the 5% of images where the Traditional model and the ViT strongly disagreed, the Traditional model was right only 45% of the time. Conversely, when both agreed confidently (85% of images), their joint answer was 97.8% accurate — which justifies the quick-check route."),
  H2("7.5  Effect of Adaptive Sanitisation"),
  P(`${T("sanit")} shows how each purification recipe affects detection of attacked validation images (192 images). Two lessons emerge. First, the best recipe depends on the attack — TV smoothing plus JPEG works best against FGSM, while a median filter plus JPEG works best against PGD — which is why Agent 2 chooses its starting recipe from the attack type. Second, stronger is not better: the strongest recipe removes forensic detail together with the noise and lowers accuracy, which is why Agent 2 escalates only when its self-check fails.`),
  ...table("sanit", "Accuracy (%) after each purification recipe on attacked validation images",
    ["Recipe", "FGSM: Robust only", "FGSM: Robust + ViT", "PGD: Robust only", "PGD: Robust + ViT"],
    [["No cleaning", "64.6", "84.9", "16.7", "83.9"], ["Light compression", "68.2", "85.9", "42.2", "85.4"],
      ["Compression + noise filter", "62.5", "85.9", "78.1", "**90.1**"], ["Smoothing + compression", "74.5", "**89.1**", "81.8", "89.6"],
      ["Strong smoothing + blur + compression", "72.9", "81.8", "72.4", "83.3"]],
    [2826, 1550, 1550, 1550, 1550], { boldFirst: true, center: [1, 2, 3, 4] }),
  H2("7.6  Incremental Development and Ablation"),
  P(`The system was improved in four measured steps (${T("versions")}, ${F("ver")}). Each change was motivated by an observed weakness and tuned on validation data before being measured once on the test set. Version 1 was already robust to PGD but weak against FGSM (65.6%); attack-specific sanitisation and ViT-weighted voting (v2) fixed this (84.0%). The ViT cross-check (v3) addressed confident single-model mistakes, and adding CLIP with phone-style augmentation (v4) raised every metric, giving the final 94.1% clean accuracy.`),
  ...table("versions", "Agentic system accuracy (%) across development versions (test set)",
    ["Version", "Change", "No attack", "FGSM", "PGD", "PGD on Robust"],
    [["v1", "First agentic system", "91.8", "65.6", "84.0", "78.9"], ["v2", "Attack-specific sanitisation, ViT-weighted attack path", "91.8", "84.0", "83.6", "82.8"],
      ["v3", "ViT cross-check on clean path, human-review flag", "92.2", "84.0", "83.6", "82.8"],
      ["**v4**", "**+ CLIP detector and phone-style augmentation**", "**94.1**", "**84.4**", "**85.5**", "**84.0**"]],
    [900, 4126, 1000, 1000, 1000, 1000], { center: [0, 2, 3, 4, 5], size: 19 }),
  ...figure("ver", 540, "Accuracy of the agentic system across the four development versions."),
  H2("7.7  Qualitative Example"),
  P(`${F("example")} follows one deepfake through the pipeline. The traditional detector correctly scores it 94% fake. After FGSM it becomes uncertain (49%), and after PGD it is completely fooled (0% fake), although the attacked images are indistinguishable from the original. The amplified noise reveals the hidden perturbation. Agent 1 detects both attacks with P(adv) = 100%, Agent 2 cleans the image, and the ViT and CLIP restore the correct verdict with 99% fake probability.`),
  ...figure("example", 590, "One deepfake under FGSM (top) and PGD (bottom). Columns: original, attacked image, perturbation amplified ×32 (grey = unchanged), and image cleaned by Agent 2 with the final verdict."),
  H2("7.8  Case Studies"),
  H3("7.8.1  Sample gallery"),
  P(`The dashboard’s gallery contains 16 held-out test images. ${T("gallery")} compares both systems on them. The agentic system is correct on 15, 14 and 14 images under the three conditions, against 13, 7 and 3 for the traditional detector. All eight fake images are detected under every condition; the remaining errors occur on real images, and most of them are accompanied by a low confidence or a human-review flag.`),
  ...table("gallery", "Correct verdicts on the 16-image dashboard gallery",
    ["System", "No attack", "FGSM", "PGD"],
    [["Traditional model", "13 / 16", "7 / 16", "3 / 16"], ["**Agentic AI (ours)**", "**15 / 16**", "**14 / 16**", "**14 / 16**"]],
    [3026, 2000, 2000, 2000], { center: [1, 2, 3] }),
  H3("7.8.2  An in-the-wild smartphone photograph"),
  P("We also tested a genuine portrait photograph taken with a smartphone in portrait mode — an image from outside the training distribution. The Traditional and Robust models scored it 97% and 99% fake, the ViT 29% and CLIP 60%. Before our improvements, the system returned a confident but wrong *fake* verdict. The final system still labels it fake (score 65%), but with only **14% confidence and a human-review flag**, explicitly stating that the models disagree and that the photo may differ from the training images. This case illustrates both a limitation (generalisation to smartphone photography) and a strength: the system recognises and reports its own uncertainty instead of failing silently (goal G5)."),
  H2("7.9  Latency"),
  P(`${T("latency")} reports the mean time per image. Clean images take the cheaper route and are processed in about 0.65 s; attacked images require cleaning, re-checking and two larger models and take 1.1–1.3 s. These times were measured on a thermally throttled 4 GB laptop GPU, include all four agents, and are therefore conservative.`),
  ...table("latency", "Mean end-to-end latency per image (RTX 2050 laptop GPU)",
    ["Condition", "Route taken", "Mean latency"],
    [["No attack", "Quick check or full vote", "0.65 s"], ["FGSM", "Attack path with cleaning", "1.12 s"], ["PGD", "Attack path with cleaning", "1.24 s"], ["PGD on Robust", "Attack path with cleaning", "1.30 s"]],
    [2826, 3800, 2400], { boldFirst: true, center: [2] }),
  H2("7.10  Comparison with Project Targets"),
  P(`The project proposal stated expected figures before implementation. ${T("targets")} compares them with the measured results. The measured clean AUC (0.987) exceeds the target, and the traditional detector proved even more vulnerable than expected (0.4% under PGD). The agentic system’s accuracy under attack (84–86%) is below the proposed 89–94%, and clean accuracy is 94.1% rather than 98.4%. These targets were estimates; the measured values come from detectors trained for one epoch on 12,000 images on a laptop GPU, and Chapter 9 outlines how the gap can be closed.`),
  ...table("targets", "Expected (project proposal) versus measured results",
    ["Metric", "Expected", "Measured", "Status"],
    [["Clean accuracy", "98.4%", "94.1%", "Below target"], ["Traditional detector under FGSM / PGD", "24.1% / 12.3%", "33.2% / 0.4%", "Vulnerability confirmed"],
      ["Agentic accuracy under FGSM", "93.5%", "84.4%", "Below target"], ["Agentic accuracy under PGD", "89.2%", "85.5%", "Close to target"],
      ["Robust accuracy under attack (average)", "94.2%", "85.0%", "Below target"], ["Clean AUC-ROC", "0.978", "0.987", "**Exceeds target**"],
      ["Latency per image", "≈ 185 ms", "650 ms clean / 1.2 s attacked", "Laptop GPU, throttled"]],
    [3226, 1600, 2400, 1800], { boldFirst: true, center: [1, 2, 3] }),
];

// ---------- chapter 8
const ch8 = [
  H1("8  Discussion"),
  H2("8.1  What Makes the System Agentic"),
  P("The difference from a conventional pipeline is not the number of models but the presence of *decisions*. The processing path is chosen at run time from observed evidence (Agent 1’s conditional edge); the sanitiser chooses its tool from the attack type and verifies its own work in a loop; the selector chooses which experts to trust and when a cheap answer is sufficient; and the verifier decides how confident the system should be and whether a human must be involved. Each decision is recorded, so the final output explains itself — a property a single classifier cannot offer."),
  H2("8.2  Why the Defence Works"),
  P("The results point to three complementary mechanisms. (i) **Detection** — adversarial perturbations are statistically conspicuous, and feature squeezing exposes them reliably, so the system knows *when* to defend. (ii) **Purification** — attack-specific cleaning removes a large part of the perturbation without destroying the forensic signal. (iii) **Diversity** — and most importantly — the attack is computed on one model, and the system answers with models that share neither its architecture nor its weights. The ViT and CLIP were hardly affected by transferred perturbations, whereas the Robust model, initialised from the attacked model, inherited much of its vulnerability. Model diversity, not model strength, was the decisive factor."),
  H2("8.3  Honest Assessment of the Threat Model"),
  P("Our main evaluation uses a model-aware but *non-adaptive* attacker: it knows the deployed detector, not the defence. The adaptive-PGD condition shows that the system also holds when the robust model is targeted (84.0%), but an attacker who knows the entire pipeline could attempt to evade Agent 1 and to approximate gradients through the non-differentiable cleaning steps (BPDA) or average over randomness (EOT) {obfuscated}. Detection-based defences are known to be bypassable by such attackers {not_easily}. Our results should therefore be read as strong protection against the realistic scenario described in the proposal, not as a certified guarantee; Chapter 9 lists the stronger evaluations needed for the latter."),
  H2("8.4  Safe Failure and Explainability"),
  P("A forensic tool that is confidently wrong is more dangerous than one that admits uncertainty. The cross-check between architecturally different detectors turned out to be an effective uncertainty signal: strong disagreement occurs on only about 5% of validation images, yet on those the traditional detector is right less than half the time. Flagging exactly these cases for human review — as happened for the smartphone photograph — directs scarce human attention to the cases that need it. The audit report records every observation, route and score, allowing an investigator to reconstruct why a verdict was given."),
];

// ---------- chapter 9
const ch9 = [
  H1("9  Limitations and Future Work"),
  H2("9.1  Limitations"),
  ...bullets([
    "**Data scale and diversity:** training used a 12,000-image subset of one dataset for a single epoch. Accuracy on smartphone photographs and other unseen sources is limited, as the case study showed.",
    "**Image-level analysis of videos:** videos are analysed frame by frame with temporal-consistency and blink checks; no temporal deep model (e.g. a 3D-CNN) or audio–visual lip-sync check was trained.",
    "**Threat model:** fully adaptive attacks that target the whole pipeline (BPDA, EOT, AutoAttack {autoattack}) were not evaluated.",
    "**Weak forensic clues:** Agent 4’s hand-crafted clues reach only 60.7% accuracy on their own and serve as supporting evidence.",
    "**Latency:** adding CLIP increased latency, and the measurements were made on a throttled laptop GPU.",
    "**Statistical precision:** the 256-image test set gives confidence intervals of about ±4.4 percentage points.",
  ]),
  H2("9.2  Future Work"),
  ...bullets([
    "Train on the full OpenForensics data and on FaceForensics++ {ffpp}, Celeb-DF {celebdf} and DFDC {dfdc}, together with a curated set of real smartphone photographs, using cloud GPUs.",
    "Add a temporal video model and an audio–visual lip-synchronisation agent, as envisaged in the project proposal.",
    "Evaluate against fully adaptive attackers (BPDA/EOT, AutoAttack) and harden the system with randomised sanitisation and certified methods such as randomised smoothing {smoothing}.",
    "Replace the hand-crafted forensic clues with a small learned frequency-domain network, and add a language-model agent that writes natural-language explanations from the audit report.",
    "Scale the service with an asynchronous task queue (Celery and Redis), containerised deployment (Docker) and experiment tracking (MLflow), as planned in the proposal’s system stack.",
  ]),
];

// ---------- chapter 10
const ch10 = [
  H1("10  Conclusion"),
  P("This project set out to make deepfake detection dependable in the presence of a model-aware adversary. We first showed that the conventional approach is fragile: an invisible PGD perturbation reduced a well-trained EfficientNet-B0 detector from 88.7% to 0.4% accuracy, and a perturbation of only 1/255 was already enough."),
  P("We then designed and implemented an agentic framework in which four cooperating agents detect the attack, adaptively clean the input while verifying their own work, route it to a deliberately diverse pool of detectors, and verify and explain the final decision. On held-out data the system achieved 94.1% clean accuracy (AUC 0.987) and 84.4% / 85.5% accuracy under FGSM / PGD, preventing 82–90% of the attacks’ damage, detecting 99–100% of attacks, and remaining stable across attack strengths from 1/255 to 12/255. Our analysis identified architectural diversity as the decisive defence mechanism, and the system’s uncertainty-aware design makes it report doubt — and request human review — when it is likely to be wrong."),
  P("The complete system — trained in about one hour on a laptop GPU and delivered with an interactive dashboard, a REST API and a reproducible, crash-safe pipeline — demonstrates that organising detection as a set of reasoning, acting and self-checking agents yields a forensic tool that is markedly more robust, more efficient and more transparent than a single detector. With larger and more diverse training data and evaluation against fully adaptive attackers, we believe this architecture can form the basis of practical, trustworthy deepfake forensics."),
];

// ---------- references + appendices
const references = () => [
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "References", font: FONT })] }),
  ...citeOrder.map((k, i) => new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 90, line: 270 },
    indent: { left: 560, hanging: 560 }, children: [new TextRun({ text: `[${i + 1}]`, font: FONT, size: 22 }),
      new TextRun({ children: [new Tab(), REFS[k]], font: FONT, size: 22 })], tabStops: [{ type: TabStopType.LEFT, position: 560 }] })),
];
const appA = [
  H1("Appendix A  How to Run the Project"),
  P("The trained models are included with the project, so the dashboard can be started immediately."),
  H2("A.1  Starting the dashboard"),
  ...numbered([
    "Open PowerShell and change to the project folder: `cd C:\\Users\\PC-ACER\\AgenticDeepfakeShield`.",
    "Activate the virtual environment: `.\\.venv\\Scripts\\activate`.",
    "Start the dashboard: `streamlit run app.py` (or double-click `run_app.bat`).",
    "Open `http://localhost:8501` in a web browser. The first analysis takes 10–20 seconds while the models load.",
  ]),
  H2("A.2  Demonstration steps"),
  ...numbered([
    "On **Live Analysis**, choose **Sample gallery** and select an image.",
    "In the sidebar, set **Simulate attacker** to PGD or FGSM and, optionally, change ε.",
    "Click **Run agentic pipeline** and compare the Traditional and Agentic gauges, the agent trace and the charts.",
    "Open **Benchmark Results** for the full evaluation and **Architecture** for the agent graph.",
  ]),
  H2("A.3  REST API and retraining"),
  P("The REST API is started with `uvicorn api:app --port 8000`; interactive documentation is then available at `http://127.0.0.1:8000/docs`. To rebuild everything from scratch — dataset download, detector training, CLIP probe, Agent 1 and Agent 4, benchmark and demo samples — run `resume.bat`. Completed stages are skipped, and an interrupted run continues from its last checkpoint."),
];
const appB = [
  H1("Appendix B  Project Structure"),
  ...table("structure", "Main source files of the project",
    ["Path", "Purpose"],
    [["`agents/orchestrator.py`", "LangGraph state graph, conditional routing, image and video analysis, audit report"],
      ["`agents/noise_detector.py`", "Agent 1: feature extraction and attack classification"], ["`agents/sanitizer.py`", "Agent 2: adaptive, self-verifying purification"],
      ["`agents/model_selector.py`", "Agent 3: quick check, full vote and attack-path routing"], ["`agents/verifier.py`", "Agent 4: forensic clues, confidence, human-review flag"],
      ["`core/attacks.py`", "FGSM and PGD implemented from scratch"], ["`core/sanitize.py`", "JPEG, median, bit-depth, Gaussian and GPU Total-Variation filters"],
      ["`core/forensics.py`", "Fourier, noise-residual, texture and lighting measurements"], ["`core/face.py`", "Face and eye detection, frame sampling, blink analysis"],
      ["`scripts/train_detectors.py`", "Crash-safe training of the Traditional, Robust and ViT models"], ["`scripts/train_clip_detector.py`", "CLIP linear probe with phone-style augmentation"],
      ["`scripts/train_attack_detector.py`", "Agent 1 classifier and Agent 4 calibration"], ["`scripts/tune_ensemble.py`", "Validation-based selection of ensemble weights"],
      ["`scripts/evaluate.py`, `scripts/eps_sweep.py`", "Benchmark and attack-strength sweep"], ["`app.py`, `api.py`", "Streamlit dashboard and FastAPI service"],
      ["`weights/`, `results/`", "Trained models, ensemble configuration, measured results"]],
    [3800, 5226]),
];

// =========================================================================================== DOCUMENT
const mainChildren = [...ch1, ...ch2, ...ch3, ...ch4, ...ch5, ...ch6, ...ch7, ...ch8, ...ch9, ...ch10];
const refsBlock = references();                    // after chapters, so citation order is final
if (figSeen !== FIG_ORDER.length) throw new Error(`figures used ${figSeen}/${FIG_ORDER.length}`);

const headingStyle = (size, before, after, color, pageBreak) => ({ run: { font: FONT, size, bold: true, color },
  paragraph: { spacing: { before, after }, keepNext: true, keepLines: true, pageBreakBefore: pageBreak } });
const doc = new Document({
  creator: "Akshat Mishra, Gourav Deep Shahni, Harsh Mehar", title: TITLE,
  description: "Minor project report, Department of Information Technology, NIT Raipur",
  styles: {
    default: {
      document: { run: { font: FONT, size: 24 } },
      heading1: headingStyle(32, 0, 280, NAVY, true),
      heading2: headingStyle(27, 260, 120, NAVY, false),
      heading3: headingStyle(24, 200, 100, BLUE, false),
    },
    paragraphStyles: [
      { id: "FrontTitle", name: "Front Title", basedOn: "Normal", run: { font: FONT, size: 30, bold: true, color: NAVY },
        paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 120, after: 360 } } },
      { id: "Caption", name: "caption", basedOn: "Normal", run: { font: FONT, size: 21 }, paragraph: { alignment: AlignmentType.CENTER } },
    ],
  },
  numbering: { config: [
    { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u25AA", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 540, hanging: 300 } }, run: { color: NAVY } } }] },
    { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] },
  ] },
  sections: [
    { properties: { page: pageCfg(pageBorder(BorderStyle.THICK_THIN_MEDIUM_GAP, 24)) }, children: cover },
    { properties: { page: pageCfg(pageBorder(BorderStyle.SINGLE, 12), { start: 1, formatType: NumberFormat.LOWER_ROMAN }) },
      footers: { default: footer() },
      children: [...certificate, ...declaration, ...acknowledgement, ...abstract, ...tocs, ...abbreviations] },
    { properties: { page: pageCfg(pageBorder(BorderStyle.SINGLE, 12), { start: 1, formatType: NumberFormat.DECIMAL }) },
      headers: { default: header() }, footers: { default: footer() },
      children: [...mainChildren, ...refsBlock, ...appA, ...appB] },
  ],
});
if (tabSeen !== TAB_ORDER.length) throw new Error(`tables used ${tabSeen}/${TAB_ORDER.length}`);
const unused = Object.keys(REFS).filter(k => !citeOrder.includes(k));
if (unused.length) console.log("note: uncited references omitted:", unused.join(", "));
Packer.toBuffer(doc).then(buf => {
  const out = path.join(__dirname, "Agentic_Deepfake_Detection_Report.docx");
  fs.writeFileSync(out, buf);
  console.log("written", out, "| refs", citeOrder.length, "| figures", figSeen, "| tables", tabSeen);
});
