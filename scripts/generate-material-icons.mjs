// Generates src/app/material-icon-picker/material-icons.data.ts, the searchable index of
// Material Symbols. Run with `npm run generate:icons` after updating the icon packages.
//
// Sources:
// - @material-symbols/metadata: the canonical icon names (font ligatures).
// - @iconify-json/material-symbols: the category of each icon (the Google Fonts categories).
// - material-symbols-legacy-names.json: other ligatures in the Material Symbols font. Names that
//   draw the same icon as a canonical name (e.g. `push_pin` → `keep`) become aliases; the rest
//   (`extraIcons`, e.g. `expand_more`) are indexed as icons of their own. Extracted from the GSUB
//   ligatures of the material-symbols@0.48.3 outlined font.
// - material-icon-aliases.mjs: hand-written search aliases.

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { ICON_ALIASES, WORD_ALIASES, WORD_PATTERN_ALIASES } from './material-icon-aliases.mjs';

const require = createRequire(import.meta.url);
const versions = require('@material-symbols/metadata/versions.json');
const { categories } = require('@iconify-json/material-symbols/metadata.json');
const legacy = JSON.parse(
  readFileSync(new URL('./material-symbols-legacy-names.json', import.meta.url), 'utf8'),
);

const OUTPUT = new URL('../src/app/material-icon-picker/material-icons.data.ts', import.meta.url);
const MAX_ALIASES = 10;

/** Must match MATERIAL_ICON_CATEGORIES in src/app/material-icon-picker/material-icon.ts. */
const CATEGORIES = [
  'Actions',
  'Activities',
  'Android',
  'Audio & Video',
  'Business',
  'Communicate',
  'Hardware',
  'Home',
  'Household',
  'Images',
  'Maps',
  'Privacy',
  'Social',
  'Text',
  'Transit',
  'Travel',
  'UI Actions',
];

/** Categories for icons that the Iconify metadata does not categorize. */
const MANUAL_CATEGORIES = {
  ambient_screen: 'Hardware',
  assistant: 'Android',
  astrophotography_auto: 'Images',
  astrophotography_off: 'Images',
  auto_activity_zone: 'Hardware',
  auto_awesome: 'Images',
  auto_detect_voice: 'Audio & Video',
  auto_draw_solid: 'Text',
  auto_fix: 'Images',
  auto_fix_normal: 'Images',
  auto_fix_off: 'Images',
  auto_graph: 'Business',
  auto_label: 'Text',
  auto_meeting_room: 'Home',
  auto_mode: 'Actions',
  auto_schedule: 'Actions',
  auto_timer: 'Actions',
  auto_videocam: 'Audio & Video',
  autopay: 'Business',
  battery_saver: 'Hardware',
  battery_vert_005: 'Hardware',
  battery_vert_020: 'Hardware',
  battery_vert_050: 'Hardware',
  camera_enhance: 'Images',
  cloudy_snowing: 'Travel',
  do_disturb_alt: 'UI Actions',
  do_not_disturb: 'UI Actions',
  done_outline: 'UI Actions',
  drawing_recognition: 'Text',
  drive_file_rename_outline: 'Text',
  expand_less: 'UI Actions',
  expand_more: 'UI Actions',
  face_retouching_natural: 'Images',
  file_map: 'Maps',
  filter_list_alt: 'UI Actions',
  generating_tokens: 'Actions',
  handwriting_recognition: 'Text',
  image_not_supported: 'Images',
  insights: 'Business',
  local_airport: 'Travel',
  location_automation: 'Maps',
  magic_button: 'UI Actions',
  magic_exchange: 'Actions',
  magic_tether: 'Actions',
  movie_filter: 'Audio & Video',
  nest_wifi_gale: 'Home',
  offline_bolt: 'Actions',
  performance_max: 'Business',
  photo_filter: 'Images',
  play_shapes: 'Audio & Video',
  power: 'Home',
  power_off: 'Home',
  rate_review_rtl: 'Communicate',
  replay_circle_filled: 'Audio & Video',
  screenshot: 'Hardware',
  settings_suggest: 'Actions',
  shape_recognition: 'Text',
  sign_language_2: 'Social',
  sleep: 'Household',
  smart_button: 'UI Actions',
  tips_and_updates: 'Actions',
  transcribe: 'Audio & Video',
  width: 'Text',
  work_off: 'Business',
  youtube_activity: 'Audio & Video',
};

/** Words shown in upper case in display names. */
const ACRONYMS = new Set(
  (
    'ac ad adb adf ai api apk aod aq ar atm atr av avc bia cc co2 css csv dns dvr e911 ecg eda ' +
    'ent eu ev fmd gb gif gps hd hdmi hdr hevc hls hov html http hvac id ifl iot ip iq lan lda ' +
    'mfg mimo mma mms nat nfc ods odt orp p2p pdf php pip png qr rss rsvp rtl rtt rv sd sdk sim ' +
    'smb sms sos sql ssid toc tsv tty tv ugc uk upi us usb voc vpn vr wc wysiwyg xml'
  ).split(' '),
);
const SPECIAL_WORDS = { ios: 'iOS', spo2: 'SpO2', vo2: 'VO2', wifi: 'Wi-Fi', youtube: 'YouTube' };
const SMALL_WORDS = new Set(['a', 'and', 'by', 'for', 'in', 'of', 'or', 'the', 'to', 'with']);

/** `arrow_back` → `Arrow Back`, `usb_off` → `USB Off`, `4k_plus` → `4K Plus`. */
function displayName(name) {
  return name
    .split('_')
    .map((word, index) => {
      if (SPECIAL_WORDS[word]) return SPECIAL_WORDS[word];
      if (ACRONYMS.has(word)) return word.toUpperCase();
      if (/^\d/.test(word)) return word.toUpperCase();
      if (index > 0 && SMALL_WORDS.has(word)) return word;
      return word[0].toUpperCase() + word.slice(1);
    })
    .join(' ');
}

const SUFFIXES = ['', '-outline', '-rounded', '-sharp', '-outline-rounded', '-outline-sharp'];
const categoryByIconifyName = new Map(
  Object.entries(categories).flatMap(([category, names]) => names.map((n) => [n, category])),
);

function category(name) {
  if (MANUAL_CATEGORIES[name]) return MANUAL_CATEGORIES[name];
  const kebab = name.replaceAll('_', '-');
  for (const suffix of SUFFIXES) {
    const found = categoryByIconifyName.get(kebab + suffix);
    if (found) return found;
  }
  throw new Error(`No category for "${name}". Add it to MANUAL_CATEGORIES.`);
}

function wordAliases(word, name) {
  if (Object.hasOwn(WORD_ALIASES, word)) {
    // Keyboard arrows are arrows, not keyboards.
    return word === 'keyboard' && name.includes('arrow') ? [] : WORD_ALIASES[word];
  }
  return WORD_PATTERN_ALIASES.find(([pattern]) => pattern.test(word))?.[1] ?? [];
}

function aliases(name) {
  const words = name.split('_');
  const own = new Set([name.replaceAll('_', ' '), ...words]);
  const result = new Set();
  const add = (alias) => {
    const value = alias.toLowerCase();
    if (!own.has(value)) result.add(value);
  };
  (ICON_ALIASES[name] ?? []).forEach(add);
  (legacy.aliases[name] ?? [])
    // Skip style variants of the same name, such as `star_border` or `home_filled`.
    .filter((n) => !n.startsWith(`${name}_`) && !/purple|filled|outline|border/.test(n))
    .forEach((n) => add(n.replaceAll('_', ' ')));
  // Take the aliases of every word in turn, so each word contributes before the list is capped.
  const lists = words.map((word) => wordAliases(word, name));
  for (let i = 0; i < Math.max(0, ...lists.map((l) => l.length)); i++) {
    lists.forEach((list) => list[i] && add(list[i]));
  }
  return [...result].slice(0, MAX_ALIASES);
}

const names = [...new Set([...Object.keys(versions), ...legacy.extraIcons])].sort((a, b) =>
  a.localeCompare(b, 'en', { numeric: true }),
);
const icons = names.map((name) => ({
  name,
  displayName: displayName(name),
  category: category(name),
  aliases: aliases(name),
}));

for (const icon of icons) {
  if (!CATEGORIES.includes(icon.category)) {
    throw new Error(`Unknown category "${icon.category}" for "${icon.name}".`);
  }
}

const q = (value) => `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
const lines = icons.map(
  (icon) =>
    `  { name: ${q(icon.name)}, displayName: ${q(icon.displayName)}, category: ${q(icon.category)}, ` +
    `aliases: [${icon.aliases.map(q).join(', ')}] },`,
);

writeFileSync(
  OUTPUT,
  `// Generated by scripts/generate-material-icons.mjs from Material Symbols metadata. Do not edit.
// To change aliases, edit scripts/material-icon-aliases.mjs and run \`npm run generate:icons\`.

import type { MaterialIcon } from './material-icon';

export const MATERIAL_ICONS: readonly MaterialIcon[] = [
${lines.join('\n')}
];
`,
);

const withoutAliases = icons.filter((icon) => icon.aliases.length === 0);
console.log(
  `Wrote ${icons.length} icons (${withoutAliases.length} without aliases) to ${OUTPUT.pathname}`,
);
