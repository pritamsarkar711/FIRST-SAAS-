// Flat vector illustration generator - UXpert-style characters, theme-aware.
// Outputs light SVGs to public/illustrations and dark variants to public/illustrations/dark.
// Run: node scripts/gen-illustrations.mjs
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outLight = join(root, "public", "illustrations");
const outDark = join(root, "public", "illustrations", "dark");
mkdirSync(outLight, { recursive: true });
mkdirSync(outDark, { recursive: true });

// ---------- palette ----------
const P = {
  light: {
    band: "#E0EAF3",      // hero blue-gray blob
    ink: "#1D1D1D",
    inkSoft: "#56616B",
    skin1: "#F4C79E",     // light skin
    skin2: "#C98A58",     // medium skin
    skin3: "#8A5A2B",     // deep skin
    hair: "#232323",
    hair2: "#4A2F1D",
    coral: "#F86642",
    coralDeep: "#D9532F",
    navy: "#26303B",
    teal: "#2F8F83",
    amber: "#FFB84C",
    white: "#FFFFFF",
    line: "#C9D6E2",
    green: "#2E9E6B",
    red: "#D64545",
    shadow: "#CBD9E6",
    glass: "#FFFFFF",
    warn: "#C77700",
  },
  dark: {
    band: "#232B36",
    ink: "#ECEFF2",
    inkSoft: "#9AA7B4",
    skin1: "#E8B586",
    skin2: "#B87A4C",
    skin3: "#7C4E24",
    hair: "#111418",
    hair2: "#3A2617",
    coral: "#FF7A50",
    coralDeep: "#D9532F",
    navy: "#31404F",
    teal: "#3AA396",
    amber: "#FFC266",
    white: "#1A2028",
    line: "#465361",
    green: "#43B57F",
    red: "#E0604A",
    shadow: "#1B222B",
    glass: "#232B36",
    warn: "#E08F2F",
  },
};

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" fill="none">${body}</svg>`;

// rounded blob band behind the scene
const band = (p, w = 620, h = 500, rx = 36) =>
  `<rect x="10" y="10" width="${w - 20}" height="${h - 20}" rx="${rx}" fill="${p.band}"/>`;
const floorShadow = (p, cx, cy, rx = 120) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="14" fill="${p.shadow}"/>`;

// ---------- character kit ----------
function head({ x, y, p, skin, hair, hairStyle = "short", s = 1, glasses = false, smile = true }) {
  const r = 26 * s;
  let g = `<g transform="translate(${x} ${y}) scale(${s})">`;
  if (hairStyle === "afro") {
    g += `<circle cx="0" cy="-6" r="${r + 12}" fill="${hair}"/>`;
    g += `<circle cx="-18" cy="4" r="${r + 4}" fill="${hair}"/>`;
    g += `<circle cx="18" cy="4" r="${r + 4}" fill="${hair}"/>`;
  }
  if (hairStyle === "hijab") {
    g += `<path d="M -30 8 Q -30 -34 0 -34 Q 30 -34 30 8 Q 30 18 22 18 L 22 -2 Q 22 -24 0 -24 Q -22 -24 -22 -2 L -22 18 Q -30 18 -30 8 Z" fill="${hair}"/>`;
  }
  // face
  g += `<circle cx="0" cy="0" r="${r}" fill="${skin}"/>`;
  if (hairStyle === "bob") {
    g += `<path d="M -27 -6 Q -27 -30 0 -30 Q 27 -30 27 -6 L 27 10 Q 27 14 22 12 L 22 -4 Q 12 2 0 2 Q -12 2 -22 -4 L -22 12 Q -27 14 -27 10 Z" fill="${hair}"/>`;
  } else if (hairStyle === "short") {
    g += `<path d="M -26 -8 Q -26 -30 0 -30 Q 26 -30 26 -8 Q 14 -18 0 -18 Q -14 -18 -26 -8 Z" fill="${hair}"/>`;
  } else if (hairStyle === "bun") {
    g += `<circle cx="0" cy="-34" r="11" fill="${hair}"/>`;
    g += `<path d="M -26 -8 Q -26 -30 0 -30 Q 26 -30 26 -8 Q 14 -18 0 -18 Q -14 -18 -26 -8 Z" fill="${hair}"/>`;
  } else if (hairStyle === "cap") {
    g += `<path d="M -27 -10 Q -27 -30 0 -30 Q 27 -30 27 -10 L 27 -12 Q 0 -22 -27 -12 Z" fill="${p.coral}"/>`;
    g += `<path d="M -34 -12 L 27 -12 Q 30 -12 29 -8 L -30 -8 Q -34 -9 -34 -12 Z" fill="${p.coralDeep}"/>`;
  }
  // eyes + smile
  const eye = p === P.dark ? "#14181D" : "#1D1D1D";
  g += `<circle cx="-9" cy="-2" r="2.6" fill="${eye}"/><circle cx="9" cy="-2" r="2.6" fill="${eye}"/>`;
  if (glasses) {
    g += `<circle cx="-9" cy="-2" r="7.5" stroke="${eye}" stroke-width="2"/><circle cx="9" cy="-2" r="7.5" stroke="${eye}" stroke-width="2"/><path d="M -1.5 -2 L 1.5 -2" stroke="${eye}" stroke-width="2"/>`;
  }
  if (smile) g += `<path d="M -7 9 Q 0 14 7 9" stroke="${eye}" stroke-width="2.4" stroke-linecap="round"/>`;
  g += `</g>`;
  return g;
}

/** torso with arms. pose: 'stand' | 'point-up' | 'wave' | 'carry' */
function torso({ x, y, p, shirt, skin, pose = "stand", w = 64, h = 78, flip = false }) {
  const dir = flip ? -1 : 1;
  let arms = "";
  const arm = (d) =>
    `<path d="${d}" stroke="${shirt}" stroke-width="16" stroke-linecap="round" fill="none"/>`;
  const hand = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="8.5" fill="${skin}"/>`;
  if (pose === "stand") {
    arms = arm(`M ${-w / 2 + 6} 18 L ${-w / 2 - 10} 62`) + arm(`M ${w / 2 - 6} 18 L ${w / 2 + 10} 62`);
    arms += hand(-w / 2 - 10, 66) + hand(w / 2 + 10, 66);
  } else if (pose === "point-up") {
    arms = arm(`M ${-w / 2 + 6} 18 L ${-w / 2 - 12} 58`) + arm(`M ${w / 2 - 6} 14 L ${w / 2 + 26 * dir} -26`);
    arms += hand(-w / 2 - 12, 62) + hand(w / 2 + 28 * dir, -30);
  } else if (pose === "wave") {
    arms = arm(`M ${-w / 2 + 6} 18 L ${-w / 2 - 12} 58`) + arm(`M ${w / 2 - 8} 14 L ${w / 2 + 20} -30`);
    arms += hand(-w / 2 - 12, 62) + hand(w / 2 + 22, -34);
  } else if (pose === "carry") {
    arms = arm(`M ${-w / 2 + 8} 16 L ${-w / 2 + 2} 52`) + arm(`M ${w / 2 - 8} 16 L ${w / 2 - 2} 52`);
    arms += hand(-w / 2 + 2, 56) + hand(w / 2 - 2, 56);
  }
  return `<g transform="translate(${x} ${y})">
    <path d="M ${-w / 2} ${h} L ${-w / 2} 26 Q ${-w / 2} 0 0 0 Q ${w / 2} 0 ${w / 2} 26 L ${w / 2} ${h} Z" fill="${shirt}"/>
    ${arms}
  </g>`;
}

/** legs + shoes */
function legs({ x, y, p, pants, w = 58, h = 54, shoe }) {
  const half = w / 2;
  return `<g transform="translate(${x} ${y})">
    <path d="M ${-half + 8} 0 L ${-half + 8} ${h - 8} L ${-half + 22} ${h - 8} L ${-half + 22} 0" fill="${pants}"/>
    <path d="M ${half - 8} 0 L ${half - 8} ${h - 8} L ${half - 22} ${h - 8} L ${half - 22} 0" fill="${pants}"/>
    <rect x="${-half + 4}" y="${h - 12}" width="26" height="12" rx="6" fill="${shoe}"/>
    <rect x="${half - 30}" y="${h - 12}" width="26" height="12" rx="6" fill="${shoe}"/>
  </g>`;
}

/** full standing character */
function person({ x, y, p, skin, hair, hairStyle, shirt, pants, shoe, pose = "stand", s = 1, glasses, flip }) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    ${legs({ x: 0, y: 74, p, pants, shoe })}
    ${torso({ x: 0, y: 0, p, shirt, skin, pose, flip })}
    ${head({ x: 0, y: -30, p, skin, hair, hairStyle, glasses })}
  </g>`;
}

// ---------- shared props ----------
function browserWindow(p, { x, y, w = 190, h = 140, fill }) {
  return `<g transform="translate(${x} ${y})">
    <rect width="${w}" height="${h}" rx="10" fill="${fill || p.white}" stroke="${p.line}" stroke-width="2"/>
    <line x1="0" y1="26" x2="${w}" y2="26" stroke="${p.line}" stroke-width="2"/>
    <circle cx="16" cy="13" r="4" fill="${p.red}"/><circle cx="30" cy="13" r="4" fill="${p.amber}"/><circle cx="44" cy="13" r="4" fill="${p.green}"/>
  </g>`;
}
const textLine = (p, x, y, w, c) =>
  `<rect x="${x}" y="${y}" width="${w}" height="7" rx="3.5" fill="${c || p.line}"/>`;
const checkDot = (p, x, y, c) =>
  `<circle cx="${x}" cy="${y}" r="9" fill="${c || p.green}"/><path d="M ${x - 4} ${y} L ${x - 1} ${y + 3} L ${x + 4.5} ${y - 3.5}" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
const magnifier = (p, x, y, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})">
    <circle cx="0" cy="0" r="34" fill="${p.glass}" stroke="${p.ink}" stroke-width="9"/>
    <line x1="24" y1="24" x2="48" y2="48" stroke="${p.ink}" stroke-width="11" stroke-linecap="round"/>
  </g>`;
const coin = (p, x, y, r = 12) =>
  `<g><circle cx="${x}" cy="${y}" r="${r}" fill="${p.amber}" stroke="${p.coralDeep}" stroke-width="2.5"/><path d="M ${x} ${y - r + 4} L ${x} ${y + r - 4} M ${x - 4} ${y - 2} L ${x + 4} ${y - 2}" stroke="${p.coralDeep}" stroke-width="2.4" stroke-linecap="round"/></g>`;

// ---------- scenes ----------
// 1. hero-people: three characters, center one waving
const heroPeople = (p) =>
  svg(640, 500,
    band(p) +
    floorShadow(p, 320, 448, 210) +
    person({ x: 165, y: 300, p, skin: p.skin2, hair: p.hair2, hairStyle: "bob", shirt: p.teal, pants: p.navy, shoe: p.white, s: 1.28 }) +
    person({ x: 320, y: 278, p, skin: p.skin3, hair: p.hair, hairStyle: "afro", shirt: p.coral, pants: p.navy, shoe: p.white, pose: "wave", s: 1.42, glasses: true }) +
    person({ x: 475, y: 300, p, skin: p.skin1, hair: p.hair, hairStyle: "bun", shirt: p.amber, pants: p.navy, shoe: p.white, s: 1.28 }) +
    coin(p, 108, 210, 11) + coin(p, 540, 190, 13) + coin(p, 508, 250, 9)
  );

// 2. audit-desk: character pointing at browser with magnifier
const auditDesk = (p) => {
  const win = browserWindow(p, { x: 268, y: 96, w: 240, h: 178 });
  return svg(640, 500,
    band(p) +
    floorShadow(p, 300, 452, 190) +
    win +
    textLine(p, 292, 48, 90, p.coral) +
    textLine(p, 292, 142, 130) + textLine(p, 292, 162, 170) + textLine(p, 292, 182, 110) +
    checkDot(p, 292, 224) + textLine(p, 310, 220, 120) +
    checkDot(p, 292, 250, p.warn) + textLine(p, 310, 246, 90) +
    magnifier(p, 452, 210, 1.05) +
    person({ x: 152, y: 268, p, skin: p.skin1, hair: p.hair, hairStyle: "short", shirt: p.navy, pants: p.navy, shoe: p.coral, pose: "point-up", s: 1.34 })
  );
};

// 3. report: character carrying a big report card with score
const report = (p) => {
  const card = `<g transform="translate(352 96)">
    <rect width="216" height="280" rx="14" fill="${p.white}" stroke="${p.line}" stroke-width="2"/>
    <rect x="24" y="26" width="76" height="76" rx="38" fill="${p.green}"/>
    <text x="62" y="76" font-family="Arial" font-size="34" font-weight="bold" fill="#fff" text-anchor="middle">86</text>
    ${textLine(p, 118, 44, 74, p.coral)}
    ${textLine(p, 118, 66, 58)}
    ${checkDot(p, 30, 142)} ${textLine(p, 48, 138, 130)}
    ${checkDot(p, 30, 176)} ${textLine(p, 48, 172, 106)}
    ${checkDot(p, 30, 210, p.warn)} ${textLine(p, 48, 206, 122)}
    ${checkDot(p, 30, 244, p.red)} ${textLine(p, 48, 240, 84)}
  </g>`;
  return svg(640, 500,
    band(p) +
    floorShadow(p, 262, 452, 170) +
    card +
    person({ x: 218, y: 262, p, skin: p.skin2, hair: p.hair, hairStyle: "cap", shirt: p.coral, pants: p.navy, shoe: p.white, pose: "carry", s: 1.36 })
  );
};

// 4. writer: character at laptop with floating article lines
const writer = (p) => {
  const desk = `<g transform="translate(196 330)">
    <rect x="0" y="0" width="330" height="14" rx="7" fill="${p.navy}"/>
    <rect x="26" y="14" width="12" height="108" fill="${p.navy}"/>
    <rect x="292" y="14" width="12" height="108" fill="${p.navy}"/>
  </g>`;
  const laptop = `<g transform="translate(300 268)">
    <rect width="110" height="62" rx="6" fill="${p.ink}"/>
    <rect x="49" y="62" width="12" height="10" fill="${p.ink}"/>
    <rect x="40" y="70" width="30" height="6" rx="3" fill="${p.ink}"/>
  </g>`;
  return svg(640, 500,
    band(p) +
    floorShadow(p, 320, 462, 200) +
    desk + laptop +
    textLine(p, 130, 120, 120, p.coral) +
    textLine(p, 130, 150, 200) + textLine(p, 130, 174, 170) +
    person({ x: 226, y: 214, p, skin: p.skin3, hair: p.hair, hairStyle: "short", shirt: p.teal, pants: p.navy, shoe: p.coral, s: 1.3 })
  );
};

// 5. growth: rising bars + coins + character pointing up
const growth = (p) => {
  const bars = `<g transform="translate(340 190)">
    <rect x="0" y="150" width="44" height="60" rx="6" fill="${p.line}"/>
    <rect x="56" y="110" width="44" height="100" rx="6" fill="${p.amber}"/>
    <rect x="112" y="66" width="44" height="144" rx="6" fill="${p.teal}"/>
    <rect x="168" y="18" width="44" height="192" rx="6" fill="${p.coral}"/>
    <path d="M 8 130 Q 90 60 190 8" stroke="${p.ink}" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 12"/>
  </g>`;
  return svg(640, 500,
    band(p) +
    floorShadow(p, 250, 452, 180) +
    bars +
    coin(p, 350, 150, 14) + coin(p, 452, 96, 12) + coin(p, 530, 60, 10) +
    person({ x: 180, y: 258, p, skin: p.skin1, hair: p.hair2, hairStyle: "bun", shirt: p.coral, pants: p.navy, shoe: p.white, pose: "point-up", s: 1.36 })
  );
};

// 6. index-rocket: rocket launching out of a browser window
const indexRocket = (p) => {
  const rocket = `<g transform="translate(400 120) rotate(35)">
    <path d="M 0 -66 Q 26 -34 26 8 L 26 34 L -26 34 L -26 8 Q -26 -34 0 -66 Z" fill="${p.white}" stroke="${p.ink}" stroke-width="4"/>
    <path d="M -26 14 L -48 44 L -26 36 Z" fill="${p.coral}"/>
    <path d="M 26 14 L 48 44 L 26 36 Z" fill="${p.coral}"/>
    <circle cx="0" cy="-6" r="12" fill="${p.teal}" stroke="${p.ink}" stroke-width="4"/>
    <path d="M -10 38 Q 0 84 10 38" fill="${p.amber}"/>
  </g>`;
  const win = browserWindow(p, { x: 150, y: 230, w: 250, h: 170 });
  return svg(640, 500,
    band(p) +
    floorShadow(p, 320, 452, 190) +
    win +
    textLine(p, 174, 286, 90) + textLine(p, 174, 310, 150) +
    checkDot(p, 174, 352) + textLine(p, 192, 348, 110) +
    checkDot(p, 174, 380) + textLine(p, 192, 376, 86) +
    rocket +
    person({ x: 496, y: 300, p, skin: p.skin2, hair: p.hair, hairStyle: "afro", shirt: p.navy, pants: p.navy, shoe: p.coral, pose: "wave", s: 1.18 })
  );
};

// 7. support: character with headset and waving hand
const support = (p) => {
  const headset = `<g transform="translate(320 178)">
    <path d="M -34 4 Q -34 -34 0 -34 Q 34 -34 34 4" stroke="${p.ink}" stroke-width="7" fill="none" stroke-linecap="round"/>
    <rect x="-44" y="-4" width="14" height="26" rx="7" fill="${p.coral}"/>
    <rect x="30" y="-4" width="14" height="26" rx="7" fill="${p.coral}"/>
    <path d="M 37 18 Q 30 44 4 46" stroke="${p.ink}" stroke-width="4" fill="none" stroke-linecap="round"/>
  </g>`;
  return svg(640, 500,
    band(p) +
    floorShadow(p, 320, 448, 180) +
    person({ x: 320, y: 252, p, skin: p.skin1, hair: p.hair, hairStyle: "bob", shirt: p.coral, pants: p.navy, shoe: p.white, pose: "wave", s: 1.5 }) +
    headset +
    coin(p, 150, 180, 10) + coin(p, 500, 160, 12) +
    `<g transform="translate(120 250)"><rect width="70" height="52" rx="12" fill="${p.white}" stroke="${p.line}" stroke-width="2"/><path d="M 18 18 L 52 18 M 18 30 L 44 30" stroke="${p.line}" stroke-width="5" stroke-linecap="round"/></g>` +
    `<g transform="translate(452 260)"><rect width="70" height="52" rx="12" fill="${p.white}" stroke="${p.line}" stroke-width="2"/><path d="M 18 18 L 52 18 M 18 30 L 44 30" stroke="${p.line}" stroke-width="5" stroke-linecap="round"/></g>`
  );
};

// 8. monitor: character + shield clock over dashboard window
const monitor = (p) => {
  const win = browserWindow(p, { x: 210, y: 110, w: 260, h: 180 });
  const shield = `<g transform="translate(470 210)">
    <path d="M 0 -44 Q 30 -34 44 -40 Q 46 4 0 40 Q -46 4 -44 -40 Q -30 -34 0 -44 Z" fill="${p.teal}" stroke="${p.ink}" stroke-width="4"/>
    <circle cx="0" cy="-4" r="16" fill="${p.white}"/>
    <path d="M 0 -12 L 0 -4 L 8 0" stroke="${p.ink}" stroke-width="3.4" stroke-linecap="round"/>
  </g>`;
  return svg(640, 500,
    band(p) +
    floorShadow(p, 320, 452, 190) +
    win +
    textLine(p, 234, 156, 80, p.coral) +
    `<rect x="234" y="176" width="90" height="70" rx="8" fill="${p.band}" stroke="${p.line}" stroke-width="2"/>` +
    `<path d="M 244 232 L 264 204 L 282 220 L 310 186" stroke="${p.green}" stroke-width="4" fill="none" stroke-linecap="round"/>` +
    textLine(p, 340, 186, 110) + textLine(p, 340, 210, 80) + textLine(p, 340, 234, 96) +
    shield +
    person({ x: 148, y: 262, p, skin: p.skin2, hair: p.hair, hairStyle: "short", shirt: p.amber, pants: p.navy, shoe: p.white, pose: "stand", s: 1.32 })
  );
};

// ---------- write files ----------
const scenes = {
  "hero-people": heroPeople,
  "audit-desk": auditDesk,
  "report": report,
  "writer": writer,
  "growth": growth,
  "index-rocket": indexRocket,
  "support": support,
  "monitor": monitor,
};

for (const [name, fn] of Object.entries(scenes)) {
  writeFileSync(join(outLight, `${name}.svg`), fn(P.light));
  writeFileSync(join(outDark, `${name}.svg`), fn(P.dark));
  console.log(`wrote ${name}.svg (light + dark)`);
}
console.log("done");
