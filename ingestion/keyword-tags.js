// Backup tagger for when Claude isn't available: art forms and tags from words in the title,
// description and venue. Claude's enrichment (extract.js) does this better and runs on top when a key is set.

const FORMS = {
  printmaking: /\b(print(s|making)?|etching|lino(cut)?|screen ?print|risograph|riso|woodcut|editions?)\b/i,
  photography: /\b(photo(graph(s|y|ic)?)?|camera|lens)\b/i,
  painting: /\b(paint(ing|ings|er|ers)?|oil|watercolou?r|canvas)\b/i,
  sculpture: /\b(sculpt(ure|ures|ural|or)?|bronze|carv(ed|ing))\b/i,
  drawing: /\b(draw(ing|ings)?|sketch(ing)?|life drawing|charcoal)\b/i,
  ceramics: /\b(ceramic(s)?|clay|pottery|porcelain)\b/i,
  textiles: /\b(textile(s)?|weav(e|ing)|embroider(y|ed)|quilt|tapestry|carpet|rug)\b/i,
  film: /\b(film(s)?|cinema|video|moving image|screening)\b/i,
  performance: /\b(performance|perform(ing|ers)?|dance|theatre|choreograph)\b/i,
  installation: /\b(installation|immersive|site-specific)\b/i,
  digital: /\b(digital|ai|virtual|vr|net art|generative|game(s)?)\b/i,
  sound: /\b(sound|sonic|music|audio|listening)\b/i,
  illustration: /\b(illustrat(ion|ions|or)|comic(s)?|zine(s)?)\b/i,
};

const TAGS = {
  family: /\b(family|families|kids|children|child)\b/i,
  "hands-on": /\b(workshop|make|making|class|hands-on|drop-in)\b/i,
  community: /\b(community|local|neighbourhood|collective|open call)\b/i,
  free: /\bfree\b/i,
  late: /\b(late|lates|night|evening)\b/i,
  emerging: /\b(graduate|emerging|debut|first solo|young artists?)\b/i,
  political: /\b(protest|politic(s|al)|resistance|colonial|activis[mt])\b/i,
  outdoor: /\b(outdoor|garden|park|square|street|walk)\b/i,
};

// Big-name venues: worth tagging so "hate crowds" can steer away from them.
const BIG = /\b(tate|national gallery|british museum|v&a|victoria and albert|royal academy|hayward|barbican|saatchi|serpentine|national portrait|science museum|natural history museum|design museum|white cube|gagosian|zwirner|hauser)\b/i;

export function keywordTags(e) {
  const text = [e.title, e.description, e.venue_name].filter(Boolean).join(" ");
  const forms = Object.entries(FORMS).filter(([, re]) => re.test(text)).map(([k]) => k);
  if (e.event_type === "screening" && !forms.includes("film")) forms.push("film");
  if (e.event_type === "performance" && !forms.includes("performance")) forms.push("performance");
  const tags = Object.entries(TAGS).filter(([, re]) => re.test(text)).map(([k]) => k);
  if (e.event_type === "workshop" && !tags.includes("hands-on")) tags.push("hands-on");
  if (e.event_type === "private_view") tags.push("late");
  tags.push(BIG.test(e.venue_name || "") ? "blockbuster" : "independent");
  return {
    ...e,
    art_forms: [...new Set([...(e.art_forms || []), ...forms])],
    tags: [...new Set([...(e.tags || []), ...tags])],
  };
}
