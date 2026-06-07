// Generates Evenly's app icons from a single parametric mark: a white division
// sign (÷ — "split") on the app's indigo→pink brand gradient. Run with:
//   node scripts/make-icons.mjs
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";

const BRAND = "#5B5BD6";
const MID = "#7A5BD6";
const ACCENT = "#EC4899";

// The ÷ glyph, centered in an SxS box. Ratios are fixed so every size matches.
function glyph(S, fill = "#FFFFFF") {
  const c = S / 2;
  const dotR = S * 0.0567;
  const dotOff = S * 0.164;
  const barW = S * 0.41;
  const barH = S * 0.082;
  return `
    <g fill="${fill}">
      <circle cx="${c}" cy="${c - dotOff}" r="${dotR}"/>
      <rect x="${c - barW / 2}" y="${c - barH / 2}" width="${barW}" height="${barH}" rx="${barH / 2}"/>
      <circle cx="${c}" cy="${c + dotOff}" r="${dotR}"/>
    </g>`;
}

// Full tile: brand gradient background + glyph (for the iOS/web icon).
function tile(S) {
  return `<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="${S}" y2="${S}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="${BRAND}"/>
        <stop offset="0.55" stop-color="${MID}"/>
        <stop offset="1" stop-color="${ACCENT}"/>
      </linearGradient>
    </defs>
    <rect width="${S}" height="${S}" fill="url(#g)"/>
    ${glyph(S)}
  </svg>`;
}

// Glyph only, transparent background (Android adaptive foreground / splash).
function mark(S, fill = "#FFFFFF") {
  return `<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg">
    ${glyph(S, fill)}
  </svg>`;
}

function render(svg, size, out) {
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
  })
    .render()
    .asPng();
  writeFileSync(out, png);
  console.log(`wrote ${out} (${size}px)`);
}

const dir = "assets/images";
render(tile(1024), 1024, `${dir}/icon.png`);
render(tile(48), 48, `${dir}/favicon.png`);
// Android adaptive foreground/monochrome want the glyph in the safe zone, so
// render the mark on a padded canvas (glyph ~ inner 66%).
render(mark(512), 512, `${dir}/android-icon-foreground.png`);
render(mark(512), 512, `${dir}/android-icon-monochrome.png`);
// Splash: a transparent white mark, shown centered on the brand background.
render(mark(288), 288, `${dir}/splash-icon.png`);
