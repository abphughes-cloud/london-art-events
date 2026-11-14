// One taste vocabulary for artworks and events, so swipes on art can rank events.
// Tags are stored in the existing `tags` array with a prefix: medium:, style:, subject:, mood:, period:
// (events also get format: and scale:). Rules read the words we have; when nothing matches, a best guess
// is made from the medium and kind of event, so every row has at least one tag per dimension.
// No imports: the app can use this file directly.

export const TAXONOMY = {
  medium: ["painting", "drawing", "printmaking", "photography", "sculpture", "ceramics", "textiles", "installation", "film and video", "digital", "performance", "illustration", "craft and design", "mixed media"],
  style: ["abstract", "figurative", "conceptual", "minimal", "expressive", "surreal", "pop and graphic", "documentary", "decorative and pattern", "street and urban", "folk and outsider"],
  subject: ["portrait and body", "landscape and nature", "city and architecture", "identity and community", "politics and protest", "everyday life", "myth and spirituality", "science and technology", "pure form and colour"],
  mood: ["calm", "playful", "dark", "provocative", "intimate", "spectacular"],
  period: ["historic", "modern", "contemporary", "emerging"],
  format: ["look", "make", "listen", "meet"],
  scale: ["grassroots", "independent", "institution"],
};

const RULES = {
  medium: {
    painting: /\b(paint\w*|oil on|oils?\b|watercolou?rs?|acrylic|canvas|gouache|tempera|fresco)/,
    drawing: /\b(draw\w*|sketch\w*|charcoal|pencil|pastel|chalk|ink on|life drawing)/,
    printmaking: /\b(print(s|making|makers?|ed)?\b|lino\w*|etching|engraving|woodcut|lithograph\w*|screen ?print\w*|riso\w*|monotype|monoprint\w*|mezzotint|aquatint)/,
    photography: /\b(photo\w*|camera|cyanotype|daguerreotype|lens|darkroom)/,
    sculpture: /\b(sculpt\w*|bronze|marble|carving|statue|cast\b)/,
    ceramics: /\b(ceramic\w*|clay|potter\w*|kiln|porcelain|stoneware)/,
    textiles: /\b(textile\w*|weav\w*|knit\w*|embroider\w*|quilt\w*|fabric|silk|dye\w*|tapestr\w*|crochet|fashion|costume)/,
    installation: /\b(installation\w*|immersive|site-specific|environment)\b/,
    "film and video": /\b(film\w*|video|screening|moving image|cinema|animation)/,
    digital: /\b(digital|virtual|ai\b|blender|3d\b|game\w*|vr\b|internet|computer\w*|sonic|sound|listening)/,
    performance: /\b(performance|live art|dance|scratch night|theatre|puppet\w*)/,
    illustration: /\b(illustrat\w*|cartoon\w*|comic\w*|zine\w*|caricature|picture book)/,
    "craft and design": /\b(craft\w*|design\w*|makers?\b|jewellery|wood\w*|blacksmith\w*|furniture|wreath|bauble|mosaic\w*|enamel|resin|bookbinding|book arts|architecture)/,
  },
  style: {
    abstract: /\b(abstract\w*|geometric|colour field|non-objective|gestural)/,
    figurative: /\b(figur\w*|portrait\w*|life drawing|nude|the body|person|people|woman|man\b|men\b|women|child\w*|girl|boy|sitter)/,
    conceptual: /\b(conceptual|archive\w*|research|text-based|critical|institution\w*|systems?|speculative|practice-led|curat\w*)/,
    minimal: /\b(minimal\w*|monochrome|sparse|pared|silence)/,
    expressive: /\b(expressi\w*|raw\b|visceral|bold|energetic|vivid|dramatic)/,
    surreal: /\b(surreal\w*|dream\w*|uncanny|fantas\w*|magic\w*|strange|otherworld\w*|eerie)/,
    "pop and graphic": /\b(pop\b|graphic\w*|poster\w*|typograph\w*|font|cartoon\w*|comic\w*|riso\w*|screen ?print\w*|zine\w*)/,
    documentary: /\b(documentary|photojournal\w*|reportage|histor\w*|record\w*|testimon\w*|portraits of|heritage)/,
    "decorative and pattern": /\b(pattern\w*|decorat\w*|floral|flowers?|ornament\w*|ornate|intricate|wallpaper|morris|botanical|wreath)/,
    "street and urban": /\b(street art|graffiti|mural\w*|skate\w*|grime)/,
    "folk and outsider": /\b(folk|outsider|self-taught|na[iï]ve|madhubani|vernacular|unrecorded maker)/,
  },
  subject: {
    "portrait and body": /\b(portrait\w*|the body|bodies|figure\w*|face\w*|nude|self-portrait|sitter|life drawing|woman|man\b|child\w*|girl|boy)/,
    "landscape and nature": /\b(landscape\w*|nature|natural|garden\w*|tree\w*|flowers?|floral|botanical|river|sea\b|ocean|coast\w*|mountain\w*|earth|ecolog\w*|weather\w*|animals?|birds?|plants?|sky|forest)/,
    "city and architecture": /\b(city|cities|urban|architect\w*|building\w*|street\w*|london|housing|interior\w*|rooms?\b|east end)/,
    "identity and community": /\b(identity|communit\w*|diaspora\w*|migra\w*|queer|trans\b|lgbt\w*|black\b|feminis\w*|women|heritage|belonging|family|families|neighbour\w*|local)/,
    "politics and protest": /\b(politic\w*|protest|dissent|radical|activis\w*|resist\w*|decoloni\w*|war\b|rights|liberat\w*|revolution\w*|power|labour|work(ers)?\b)/,
    "everyday life": /\b(everyday|domestic|home\b|still life|food|table|kitchen|ordinary|daily|market|objects?)/,
    "myth and spirituality": /\b(myth\w*|spirit\w*|sacred|religio\w*|ritual\w*|saints?|madonna|angel\w*|christ|god\w*|tarot|magic\w*|death|afterlife|biblical|holy)/,
    "science and technology": /\b(science|scien\w*|technolog\w*|digital|ai\b|data|machine\w*|computer\w*|internet|medical|health)/,
    "pure form and colour": /\b(abstract\w*|colou?r\b|colours|form\b|shape\w*|geometric|material\w*|line\b|pigment\w*)/,
  },
  mood: {
    calm: /\b(calm|serene|quiet|still\w*|meditat\w*|wellbeing|gentle|peaceful|luminous|soft|listening|slow)/,
    playful: /\b(play\w*|fun\b|family|families|kids|children|festive|christmas|xmas|party|vibrant|colou?rful|joy\w*|humou?r\w*|cartoon\w*|comic\w*)/,
    dark: /\b(dark\w*|death|grief|ghost\w*|war\b|inferno|horror|eerie|melanchol\w*|sorrow\w*|haunt\w*|night|mourning)/,
    provocative: /\b(protest|dissent|radical|queer|politic\w*|feminis\w*|decoloni\w*|resist\w*|unruly|provocat\w*|taboo|fetish|propaganda)/,
    intimate: /\b(intimate|small|personal|memory|memories|home\b|tender\w*|care\b|conversation|diary|private|romantic)/,
    spectacular: /\b(immersive|spectac\w*|major|landmark|blockbuster|festival|large-scale|monumental|dramatic|epic|grand)/,
  },
};

// Best guesses when the words give nothing away.
const STYLE_BY_MEDIUM = {
  photography: "documentary", painting: "figurative", drawing: "figurative", printmaking: "pop and graphic", illustration: "pop and graphic",
  ceramics: "decorative and pattern", textiles: "decorative and pattern", "craft and design": "decorative and pattern",
  installation: "conceptual", "film and video": "conceptual", digital: "conceptual", performance: "conceptual", sculpture: "abstract", "mixed media": "conceptual",
};
const SUBJECT_BY_STYLE = { figurative: "portrait and body", documentary: "everyday life", abstract: "pure form and colour", "decorative and pattern": "pure form and colour", "pop and graphic": "everyday life", conceptual: "identity and community" };
const INSTITUTION = /\b(tate|national gallery|national portrait|v&a|victoria and albert|royal academy|barbican|hayward|serpentine|whitechapel gallery|british museum|british library|wellcome|design museum|saatchi|somerset house|courtauld|wallace collection|dulwich picture|science museum|photographers' gallery|southbank|museum of london|horniman|estorick)\b/i;
const GRASSROOTS = /\b(community|grassroots|artist-run|art school|student show|student|makers|drawing group|creative community|artist studios|read from venue page|drop-in|open submission)\b/i;

const match = (dim, text, max) => Object.entries(RULES[dim]).filter(([, re]) => re.test(text)).map(([k]) => k).slice(0, max);

function core(text, { mediumHint = [], moodHint = [], period }) {
  const t = ` ${text.toLowerCase()} `;
  let medium = [...new Set([...mediumHint, ...match("medium", t, 3)])].slice(0, 3);
  if (!medium.length) medium = ["mixed media"];
  let style = match("style", t, 2);
  if (!style.length) style = [STYLE_BY_MEDIUM[medium[0]] || "conceptual"];
  let subject = match("subject", t, 2);
  if (!subject.length) subject = [SUBJECT_BY_STYLE[style[0]] || "pure form and colour"];
  let mood = [...new Set([...moodHint, ...match("mood", t, 2)])].slice(0, 2);
  return { medium, style, subject, mood, period };
}

const prefixed = (o) => Object.entries(o).flatMap(([dim, vals]) => [].concat(vals || []).map((v) => `${dim}:${v}`));
const unprefixed = (tags) => (tags || []).filter((t) => !/^(medium|style|subject|mood|period|format|scale):/.test(t));

const MEDIUM_ALIAS = { print: "printmaking", prints: "printmaking", "life drawing": "drawing", craft: "craft and design", design: "craft and design", film: "film and video", video: "film and video", "digital art": "digital" };
const asMedium = (s) => { const v = MEDIUM_ALIAS[s] || s; return TAXONOMY.medium.includes(v) ? v : null; };

const FORMAT = { exhibition: "look", workshop: "make", talk: "listen", tour: "listen", screening: "listen", performance: "listen", private_view: "meet", open_studio: "meet", fair: "meet", other: "meet" };

export function tasteTagsForEvent(e) {
  const text = [e.title, e.description, (e.art_forms || []).join(" "), unprefixed(e.tags).join(" ")].filter(Boolean).join(" ");
  const tagText = unprefixed(e.tags).join(" ");
  const emerging = /\b(student|graduate|degree show|postgraduate|\bma\b|\bba\b|emerging|art school|open call|annual open|new contemporaries|early-career|residenc\w*)\b/i.test(`${e.title} ${tagText}`);
  const historic = /\b(1[0-8]\d\d|\d\dth[- ]century|old masters?|victorian|renaissance|medieval|georgian|baroque|ancient)\b/i.test(text);
  const modern = /\b(19[0-6]\d|modernis\w*|post-?war|bauhaus|impressionis\w*|surrealis\w*|cubis\w*)\b/i.test(text);
  const period = emerging ? "emerging" : historic ? "historic" : modern ? "modern" : "contemporary";
  const c = core(text, { mediumHint: (e.art_forms || []).map(asMedium).filter(Boolean), period });
  const scale = INSTITUTION.test(e.venue_name || "") ? "institution" : GRASSROOTS.test(`${tagText} ${e.source_name}`) || emerging ? "grassroots" : "independent";
  if (!c.mood.length) {
    c.mood = [e.event_type === "workshop" ? "playful" : ["talk", "private_view", "open_studio", "tour"].includes(e.event_type) ? "intimate" : scale === "institution" ? "spectacular" : "calm"];
  }
  return [...unprefixed(e.tags), ...prefixed({ ...c, format: FORMAT[e.event_type] || "meet", scale })];
}

// Artwork rows from the app's `artworks` table (title, medium, media_type, date_sort, tags, visual_description, story).
const ART_MOOD = { intimate: "intimate", romantic: "intimate", playful: "playful", vibrant: "playful", calm: "calm", serene: "calm", luminous: "calm", dramatic: "spectacular", monumental: "spectacular", eerie: "dark", melancholy: "dark" };

export function tasteTagsForArtwork(a) {
  const own = unprefixed(a.tags);
  const text = [a.title, a.medium, a.visual_description, own.join(" ")].filter(Boolean).join(" ");
  const y = a.date_sort;
  const period = !y ? "historic" : y < 1900 ? "historic" : y <= 1970 ? "modern" : "contemporary";
  // The catalogue's own type is reliable; words in the description only add to it.
  const typed = asMedium(a.media_type);
  const c = core(text, { mediumHint: typed ? [typed] : [], moodHint: [...new Set(own.map((t) => ART_MOOD[t]).filter(Boolean))], period });
  if (typed) c.medium = [typed];
  if (own.includes("spiritual") && !c.subject.includes("myth and spirituality")) c.subject = ["myth and spirituality", ...c.subject].slice(0, 2);
  if (own.includes("minimal") && !c.style.includes("minimal")) c.style = [...c.style, "minimal"].slice(0, 2);
  if (!c.mood.length) c.mood = ["calm"];
  return [...own, ...prefixed(c)];
}

// "medium:painting" tags -> { medium: ["painting"], … }, for matching.
export function tasteVector(tags) {
  const v = {};
  for (const t of tags || []) {
    const m = t.match(/^(medium|style|subject|mood|period|format|scale):(.+)$/);
    if (m) (v[m[1]] ||= []).push(m[2]);
  }
  return v;
}
