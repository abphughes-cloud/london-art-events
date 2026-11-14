// Events read by Claude (Claude Code session, 14 Nov 2026) from venues' own what's-on pages saved by
// ingestion/fetch-pages.js. Only events stated on the page with a date; nothing inferred beyond type.
// Row: [title, type, start, end, start_time, end_time, price ("free" | number | null), url or null]
import fs from "node:fs";

const venues = [
  { v: "APT Gallery", pc: "SE8 4SA", area: "Deptford", url: "https://www.aptstudios.org/", tags: ["artist-run", "artist studios"], ev: [
    ["Common Ghosts", "exhibition", "2026-11-05", "2026-11-15", null, null, "free", "https://www.aptstudios.org/20262027commonghosts"],
    ["Uncanny Waters: Weathering", "exhibition", "2026-11-19", "2026-11-28", null, null, "free", null],
    ["Opening: Uncanny Waters: Weathering", "private_view", "2026-11-19", null, "18:00", "20:00", "free", null],
  ] },
  { v: "arebyte Gallery", pc: "E14 0LG", area: "London City Island", url: "https://www.arebyte.com/", tags: ["digital art", "independent"], ev: [
    ["Digital Worlds, Alternative Futures: Skawennati, Wendi Yan and Kinnari Saraiya", "talk", "2026-11-14", null, null, null, null, "https://www.arebyte.com/events/artist-talks-performance-slipstream"],
    ["Exhibition Tour – SLIPSTREAM: Uncharted Realities & the Eternal Now", "tour", "2026-11-28", null, null, null, null, "https://www.arebyte.com/events/slipstream-exhibition-tour2"],
    ["Introduction to Blender: Character Development with Sophie Rogers", "workshop", "2026-12-05", null, null, null, null, "https://www.arebyte.com/events/introduction-to-blender-sophie-rogers"],
  ] },
  { v: "Auto Italia", pc: "E2 9JS", area: "Bethnal Green", url: "https://autoitaliasoutheast.org/", tags: ["artist-run", "emerging artists"], ev: [
    ["SUUTOO: MAGIC SYSTEM", "exhibition", "2026-11-27", "2027-02-28", null, null, "free", "https://autoitaliasoutheast.org/projects/magic-system/"],
    ["Preview: MAGIC SYSTEM", "private_view", "2026-11-26", null, "18:00", "20:00", "free", "https://autoitaliasoutheast.org/events/preview-magic-system/"],
    ["Crip Scripts: writing workshop with Kat Benedict", "workshop", "2026-12-01", null, "18:30", "20:00", null, "https://autoitaliasoutheast.org/events/crip-scripts/"],
  ] },
  { v: "Autograph", pc: "EC2A 3BA", area: "Shoreditch", url: "https://autograph.org.uk/", tags: ["photography", "independent"], ev: [
    ["Voices for Dissent, Voices for Desire: Creative Writing Workshop", "workshop", "2026-11-14", null, null, null, 10, null],
    ["The Land and Body: Feminist and Indigenous Conversations", "talk", "2026-11-18", null, null, null, "free", "https://autograph.org.uk/events/land-and-body-feminist-and-indigenous-conversations"],
    ["Language, Law and Queer Belonging: Talk", "talk", "2026-12-09", null, null, null, 5, null],
  ] },
  { v: "Ben Uri Gallery", pc: "NW8 0RH", area: "St John's Wood", url: "https://benuri.org/", tags: ["independent"], ev: [
    ["The Abbey Art Centre as Postwar Refuge: 1946–56", "exhibition", "2026-10-07", "2026-12-18", null, null, null, null],
  ] },
  { v: "Blackhorse Workshop", pc: "E17 6BX", area: "Walthamstow", url: "https://www.blackhorseworkshop.co.uk/", tags: ["makers", "craft", "community workshop"], forms: ["craft"], ev: [
    ["Introduction to Woodturning", "workshop", "2026-11-14", "2026-11-15", "10:00", "16:30", 295, "https://www.blackhorseworkshop.co.uk/course/?id=984"],
    ["Blacksmithing Day (inc. Forge Induction)", "workshop", "2026-11-15", null, "10:00", "17:00", 195, "https://www.blackhorseworkshop.co.uk/course/?id=987"],
    ["Introduction to Machine Shop: Chopping Board", "workshop", "2026-11-15", null, "10:00", "16:30", 145, "https://www.blackhorseworkshop.co.uk/course/?id=976"],
    ["Introduction to Blacksmithing (three Tuesday evenings)", "workshop", "2026-11-10", "2026-11-24", "18:30", "21:30", 215, "https://www.blackhorseworkshop.co.uk/course/?id=993"],
    ["Blackhorse Workshop Xmas Makers Market 2026", "fair", "2026-12-02", null, "18:00", "21:00", "free", "https://www.blackhorseworkshop.co.uk/course/?id=1041"],
  ] },
  { v: "Camden Art Centre", pc: "NW3 6DG", area: "Hampstead", url: "https://camdenartcentre.org/", tags: [], ev: [
    ["Liz Larner: A hard line to bend", "exhibition", "2026-09-11", "2027-01-17", null, null, "free", "https://camdenartcentre.org/whats-on/a-hard-line-to-bend"],
    ["Life Drawing Short Course", "workshop", "2026-11-19", "2026-12-10", null, null, null, "https://camdenartcentre.org/whats-on/life-drawing-short-course-autumn-2026"],
    ["Zine Making Workshop", "workshop", "2026-11-21", null, null, null, null, "https://camdenartcentre.org/whats-on/zine-making-workshop-6"],
    ["Natural Dyes Study Group", "workshop", "2026-11-22", null, null, null, null, "https://camdenartcentre.org/whats-on/natural-dyes-study-group"],
    ["Ikebana-Inspired Wreath Making Workshop", "workshop", "2026-12-05", null, null, null, null, "https://camdenartcentre.org/whats-on/ikebana-inspired-wreath-making-workshop"],
    ["Introduction to Natural Dyes", "workshop", "2026-12-06", null, null, null, null, "https://camdenartcentre.org/whats-on/introduction-to-natural-dyes-2"],
  ] },
  { v: "Chisenhale Gallery", pc: "E3 5QZ", area: "Bow", url: "https://chisenhale.org.uk/", tags: ["emerging artists", "independent"], ev: [
    ["Wakaliga Uganda: Kibuuka Omumbaale", "exhibition", "2026-11-14", "2026-12-06", null, null, "free", "https://chisenhale.org.uk/project/wakaliga-uganda/"],
    ["Curatorial Tour: Kibuuka Omumbaale with Tosia Leniarska", "tour", "2026-12-03", null, "19:00", "20:30", null, "https://chisenhale.org.uk/whats-on/tour-of-kibuuka-omumbaale-with-tosia-leniarska-curator-exhibitions-and-events/"],
  ] },
  { v: "Drawing Room", pc: null, area: "Bermondsey", url: "https://drawingroom.org.uk/", tags: ["drawing", "independent"], forms: ["drawing"], ev: [
    ["Listening to the earth", "exhibition", "2026-09-24", "2026-12-13", null, null, "free", "https://drawingroom.org.uk/exhibition/listening-to-the-earth/"],
    ["In Conversation: Emii Alrai and Tanoa Sasraku", "talk", "2026-11-20", null, "17:00", "20:30", null, "https://drawingroom.org.uk/event/in-conversation-emii-alrai-and-tanoa-sasraku/"],
    ["Life Drawing with Early Masterworks: The Colour of Being", "workshop", "2026-11-27", null, "18:45", "21:00", null, "https://drawingroom.org.uk/event/life-drawing-the-colour-of-being-with-early-masterworks/"],
    ["Late Night: Ways of Listening", "other", "2026-12-03", null, "18:30", "21:30", null, "https://drawingroom.org.uk/event/late-night-ways-of-listening/"],
    ["RISO Greetings Cards and Envelopes Workshop with Chloe Cooper", "workshop", "2026-12-13", null, "14:00", "17:00", null, "https://drawingroom.org.uk/event/riso-card-and-envelope-workshop-with-chole-cooper/"],
  ] },
  { v: "East London Printmakers", pc: "E3 4RR", area: "Mile End", url: "https://www.eastlondonprintmakers.co.uk/", tags: ["print studio", "artist-run"], forms: ["printmaking"], ev: [
    ["East London Printmakers Winter Open Studio", "open_studio", "2026-11-22", null, "12:00", "16:00", "free", null],
  ] },
  { v: "Gasworks", pc: "SE11 5RH", area: "Vauxhall", url: "https://www.gasworks.org.uk/", tags: ["artist residencies", "emerging artists"], ev: [
    ["Paloma Contreras Lomas: Disco Inferno", "exhibition", "2026-10-01", "2026-12-13", null, null, "free", null],
    ["Gasworks Winter Open Studios 2026", "open_studio", "2026-12-05", null, null, null, "free", "https://www.gasworks.org.uk/events/winter-open-studios-2026/"],
  ] },
  { v: "Heatherley School of Fine Art", pc: "SW10 0RN", area: "Chelsea", url: "https://www.heatherleys.org/", tags: ["art school"], ev: [
    ["Artist In Conversation: Tim Benson", "talk", "2026-11-16", null, "17:00", "18:00", null, "https://www.heatherleys.org/events/artist-in-conversation-tim-benson/"],
  ] },
  { v: "Chelsea College of Arts", pc: "SW1P 4JU", area: "Pimlico", url: "https://iniva.org/", source: "iniva", tags: ["art school", "independent"], ev: [
    ["Andrew Pierre Hart: if you like rice, you’ll understand – Collective Noise", "exhibition", "2026-10-01", "2026-12-11", null, null, "free", "https://iniva.org/programme/projects/if-you-like-rice-youll-understand-collective-noise/"],
    ["TrAIN Open Lecture: Andrew Pierre Hart", "talk", "2026-11-25", null, null, null, null, "https://iniva.org/programme/events/train-open-lecture/"],
    ["Film Screening: The Stuart Hall Project (2013)", "screening", "2026-12-11", null, null, null, null, "https://iniva.org/programme/events/the-stuart-hall-project-2013/"],
  ] },
  { v: "Lauderdale House", pc: "N6 5HG", area: "Highgate", url: "https://www.lauderdalehouse.org.uk/", tags: ["community", "local artists"], ev: [
    ["Highgate Watercolour Group Exhibition 2026", "exhibition", "2026-10-21", "2026-11-16", null, null, "free", "https://www.lauderdalehouse.org.uk/whats-on/highgate-watercolour-group-2026"],
    ["Harington, Where We Grow", "exhibition", "2026-10-28", "2026-12-03", null, null, "free", "https://www.lauderdalehouse.org.uk/whats-on/harington-where-we-grow"],
    ["THIRTEEN 2026 (photography group show)", "exhibition", "2026-11-18", "2026-12-21", null, null, "free", "https://www.lauderdalehouse.org.uk/whats-on/thirteen-2026"],
  ] },
  { v: "Lewisham Arthouse", pc: "SE14 6PD", area: "New Cross", url: "https://www.lewishamarthouse.org.uk/", tags: ["artist-run", "community"], ev: [
    ["Botanical Illustration with Alison Day (Mondays)", "workshop", "2026-10-05", "2026-12-14", "13:00", "14:30", null, null],
  ] },
  { v: "Matt's Gallery", pc: "SW11 7AN", area: "Nine Elms", url: "https://www.mattsgallery.org/", tags: ["independent"], ev: [
    ["Imogen Stidworthy: Skydde", "exhibition", "2026-09-30", "2026-11-22", null, null, "free", "https://www.mattsgallery.org/exhibitions/imogen-stidworthy-"],
  ] },
  { v: "Old Diorama Arts Centre", pc: "NW1 3FE", area: "Euston", url: "https://www.olddiorama.com/upcoming-events", tags: ["community", "grassroots"], ev: [
    ["Arts & Homelessness International Scratch Night with One Roof", "performance", "2026-12-04", null, "18:30", null, null, null],
    ["Old Diorama Festive Gathering (Neighbourhood Makeshop)", "other", "2026-12-10", null, "18:00", null, "free", null],
  ] },
  { v: "Pitzhanger Manor & Gallery", pc: "W5 5EQ", area: "Ealing", url: "https://www.pitzhanger.org.uk/", tags: [], ev: [
    ["Peter Blake: In the Studio", "exhibition", "2026-11-25", "2027-04-18", null, null, null, "https://www.pitzhanger.org.uk/whatson/peter-blake/"],
  ] },
  { v: "Poplar Union", pc: "E14 6TL", area: "Poplar", url: "https://poplarunion.com/", tags: ["community", "family"], ev: [
    ["Big Ideas for Little Lives: Trash into Treasure!", "workshop", "2026-11-24", null, null, null, null, "https://poplarunion.com/event/big-ideas-for-little-lives-trash-into-treasure/"],
  ] },
  { v: "South London Gallery", pc: "SE5 8UH", area: "Peckham", url: "https://www.southlondongallery.org/", tags: [], ev: [
    ["Dispersion: Celebrating Practice-Led Research (MA Fine Art research festival)", "exhibition", "2026-11-13", "2026-11-15", "12:00", "18:00", "free", "https://www.southlondongallery.org/events/ma-fine-art-research-festival-2026/"],
    ["Film Screening: South by South", "screening", "2026-11-18", null, "18:30", "20:45", null, "https://www.southlondongallery.org/events/film-screening-south-by-south-2/"],
    ["Ways of Wellbeing: Art & Creative Health", "workshop", "2026-11-19", null, "10:00", "13:00", "free", "https://www.southlondongallery.org/events/ways-of-wellbeing-art-creative-health/"],
    ["Family Space with Sadie St Hilaire", "workshop", "2026-11-28", null, "11:00", "13:00", null, null],
    ["Kang Seung Lee: Weeds of Cultivation", "exhibition", "2026-12-11", "2027-03-28", null, null, "free", null],
  ] },
  { v: "Southwark Park Galleries", pc: "SE16 2UA", area: "Bermondsey", url: "https://southwarkparkgalleries.org/", tags: ["community", "open submission", "emerging artists"], ev: [
    ["Preview: Southwark Park Galleries Annual Open (42nd year)", "private_view", "2026-11-21", null, "13:00", "16:00", "free", null],
  ] },
  { v: "The Kiln Rooms", pc: null, area: "Peckham", url: "https://www.thekilnrooms.com/open-studios", tags: ["ceramics studio", "makers"], forms: ["ceramics"], ev: [
    ["The Kiln Rooms Christmas Sale", "fair", "2026-11-27", "2026-11-29", null, null, "free", "https://www.thekilnrooms.com/open-studios"],
  ] },
  { v: "The Koppel Project Annex", pc: "SE1 6NT", area: "Elephant and Castle", url: "https://thekoppelproject.com/events", source: "The Koppel Project", tags: ["artist studios", "emerging artists"], ev: [
    ["UP, LEFT, DOWN, RIGHT", "exhibition", "2026-12-03", "2026-12-08", null, null, "free", "https://thekoppelproject.com/events/up-left-down-right"],
    ["Private view: UP, LEFT, DOWN, RIGHT", "private_view", "2026-12-03", null, "18:00", "22:00", "free", null],
  ] },
  { v: "The Mosaic Rooms", pc: "SW5 0SW", area: "Earl's Court", url: "https://mosaicrooms.org/", tags: ["independent"], ev: [
    ["sounding towards - -", "exhibition", "2026-07-08", "2026-11-29", null, null, "free", null],
    ["Launch Event: Decolonizing the Page", "talk", "2026-11-14", null, "15:00", null, null, null],
    ["Performance: In the Presence of the Absent Bird by Hoda Siahtiri", "performance", "2026-11-25", null, "19:00", null, null, null],
    ["Tiny Fridays with Zareen Islam", "workshop", "2026-11-27", null, "12:00", "16:00", null, null],
    ["Workshop: Earl’s Court Soundwalk", "workshop", "2026-11-29", null, "12:00", null, null, null],
    ["Play Lab: Lum’a with Niki Kohandel", "workshop", "2026-12-04", "2026-12-05", "11:00", "18:00", null, null],
    ["Tiny Fridays with Zareen Islam", "workshop", "2026-12-11", null, "12:00", "16:00", null, null],
  ] },
  { v: "The Showroom", pc: "NW8 8PQ", area: "Marylebone", url: "https://www.theshowroom.org/", tags: ["independent"], ev: [
    ["Polisonics: Community Listening in Action", "talk", "2026-11-19", null, "18:30", "20:30", null, "https://theshowroom.org/events/polisonics-community-listening-in-action"],
    ["Gregory Sholette: The Radical Unpresent", "talk", "2026-12-03", null, "18:30", "20:30", null, "https://theshowroom.org/events/gregory-sholette-the-radical-unpresent"],
  ] },
  { v: "Camberwell College of Arts", pc: "SE5 8UF", area: "Camberwell", url: "https://www.arts.ac.uk/colleges/camberwell-college-of-arts/whats-on/camberwell-shows", source: "UAL Camberwell Shows", tags: ["art school", "student show", "emerging artists"], ev: [
    ["Private view (open to all): Camberwell Postgraduate Design Show", "private_view", "2026-11-24", null, "18:00", "21:00", "free", null],
  ] },
  { v: "Whitechapel Gallery", pc: "E1 7QX", area: "Whitechapel", url: "https://www.whitechapelgallery.org/", tags: [], ev: [
    ["Art Futures: Platforms for Dissent with Tania Bruguera and Pankaj Mishra", "talk", "2026-11-19", null, null, null, 15, "https://www.whitechapelgallery.org/events/art-futures-platforms-for-dissent/"],
    ["BSL Tour: Cecilia Vicuña", "tour", "2026-11-25", null, null, null, null, "https://www.whitechapelgallery.org/events/bsl-tour-cecilia-vicuna/"],
  ] },
];

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const events = [], sources = {};
for (const ven of venues) {
  const sourceName = ven.source || ven.v;
  sources[sourceName] = ven.url;
  for (const [title, type, start, end, st, et, price, url] of ven.ev) {
    events.push({
      title, event_type: type, start_date: start, end_date: end, start_time: st, end_time: et,
      venue_name: ven.v, postcode: ven.pc, area: ven.area,
      ...(price === "free" ? { price_type: "free", price_min_gbp: 0 } : typeof price === "number" ? { price_type: "paid", price_min_gbp: price } : {}),
      art_forms: ven.forms || [], tags: [...ven.tags, "read from venue page"],
      source_name: sourceName, source_url: url || `${ven.url}#${slug(title)}-${start}`,
    });
  }
}
fs.writeFileSync(new URL("../data/read-events.json", import.meta.url), JSON.stringify({
  note: "Events read from venues' own what's-on pages by Claude in a Claude Code session (no API). Page text saved by ingestion/fetch-pages.js.",
  read_at: "2026-11-14T12:00:00.000Z", sources, events,
}, null, 1) + "\n");
console.log(`${events.length} events from ${venues.length} venues`);
