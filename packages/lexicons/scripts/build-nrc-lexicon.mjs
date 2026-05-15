#!/usr/bin/env node
// Build a curated NRC-style emotion lexicon from compact tag lists.
// Each word maps to Plutchik's 8 + positive/negative polarity.
// This is not the full 14k-word NRC corpus — it's a hand-curated subset of
// the most-frequent affective words found in interpersonal conversation,
// licensed under the same MIT terms as this project.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, '..', 'src', 'nrc-emotion-lexicon.json');

// tag: [words...]
// Tags are joined per word; presence = 1, absence = 0.
const TAGS = {
  joy: ['happy','happiness','glad','joyful','joy','delight','delighted','pleased','cheerful','excited','thrilled','elated','content','satisfied','smile','smiling','laugh','laughing','laughter','fun','enjoy','enjoyed','wonderful','great','amazing','awesome','lovely','beautiful','cute','sweet','perfect','blessed','grateful','thankful','celebration','celebrate','win','winning','victory','success','succeed','triumph','party','vacation','holiday','playful','play','dance','dancing','sunshine','sunny','blissful','radiant','jubilant','euphoric','ecstatic','cheery','merry','gleeful','lighthearted','upbeat','optimistic','hopeful'],
  trust: ['trust','trusted','trusting','believe','believed','believing','faith','faithful','loyal','loyalty','honest','honesty','reliable','dependable','sincere','sincerity','genuine','authentic','open','vulnerable','intimate','intimacy','close','closeness','safe','safety','secure','security','support','supportive','accept','acceptance','respect','respected','admire','admiration','care','caring','kind','kindness','gentle','warm','warmth','tender','tenderness','love','loving','beloved','partner','friend','friendship','team','together','unity','bond','bonded','commitment','committed','promise','promised','vow','reliance','rely','depend','assurance','assured','allegiance'],
  fear: ['afraid','fear','fearful','scared','scary','frightened','frightening','terrified','terrifying','terror','dread','dreaded','dreadful','panic','panicked','anxious','anxiety','worry','worried','worrying','nervous','nervously','tense','tension','stress','stressed','stressful','threat','threatened','threatening','danger','dangerous','unsafe','insecure','vulnerable','helpless','overwhelmed','overwhelming','dread','dreading','nightmare','phobia','horror','horrific','horrible','alarming','alarmed','startled','startle','jittery','jumpy','timid','wary','apprehensive','uneasy','intimidated','distressed','distress'],
  surprise: ['surprise','surprised','surprising','shock','shocked','shocking','astonished','astonishing','amazed','amazing','stunned','stunning','startled','sudden','suddenly','unexpected','unexpectedly','wow','whoa','really','seriously','unbelievable','incredible','crazy','wild','speechless','flabbergasted','dumbfounded','bewildered','marvel','marvelous','wonder','wondering','awe','spectacular','remarkable','startling'],
  sadness: ['sad','sadness','sadly','unhappy','depressed','depression','depressing','blue','down','low','gloomy','gloom','miserable','misery','sorrow','sorrowful','grief','grieving','grieve','mourn','mourning','heartbroken','heartbreak','heartache','tear','tears','tearful','cry','crying','cried','weep','weeping','wept','lonely','loneliness','alone','isolated','isolation','empty','emptiness','hopeless','despair','despairing','dejected','dejection','melancholy','dismal','disappointed','disappointment','disappointing','regret','regretful','sorry','apologize','apologized','loss','lost','losing','missing','miss','missed','abandoned','abandonment','rejection','rejected','dismay','dismayed','forlorn','crestfallen','heartsick'],
  disgust: ['disgust','disgusted','disgusting','disgusts','revolt','revolting','revulsion','repulsed','repulsive','repugnant','sick','sickening','sickened','nauseate','nauseating','nausea','nauseated','vile','vulgar','gross','grossed','nasty','foul','rotten','filthy','dirty','contempt','contemptuous','despise','despised','loathe','loathed','loathing','hate','hated','hatred','abhor','abhorrent','distaste','distasteful','offensive','offended','offending','offence','offense','repulse','aversion','averted','yuck'],
  anger: ['angry','anger','mad','furious','fury','rage','raging','enraged','irate','livid','seething','outraged','outrage','wrath','wrathful','hostile','hostility','aggressive','aggression','aggravated','aggravating','annoyed','annoying','annoy','annoyance','irritated','irritating','irritation','frustrated','frustrating','frustration','resentful','resentment','resent','resented','bitter','bitterness','vindictive','vengeful','vengeance','revenge','spite','spiteful','jealous','jealousy','envious','envy','contempt','disdain','disgust','hate','hated','hatred','infuriated','provoked','provoking','seething','peeved','steaming','pissed'],
  anticipation: ['anticipate','anticipation','anticipating','expect','expected','expecting','expectation','hope','hopeful','hoping','plan','planning','planned','prepare','preparing','prepared','ready','await','awaiting','wait','waiting','soon','tomorrow','future','prospect','prospects','outlook','optimistic','optimism','eager','eagerness','impatient','impatience','curious','curiosity','wonder','wondering','intrigued','intriguing','intrigue','foresee','foreseeable','imagining','imagine','expectant','vigilant','watchful','poised','primed'],
  positive: ['good','great','wonderful','amazing','excellent','fantastic','fabulous','outstanding','superb','marvelous','terrific','lovely','beautiful','gorgeous','pleasant','pleasing','enjoyable','pleased','happy','joyful','delight','delightful','blessed','grateful','thankful','appreciation','appreciated','appreciate','positive','best','better','perfect','ideal','brilliant','smart','clever','wise','strong','strength','healthy','health','well','win','winning','victory','success','successful','succeed','progress','improvement','improve','improved','grow','growth','growing','heal','healing','recovered','recovery','peace','peaceful','calm','calming','relax','relaxed','relaxing','safe','secure','protected','love','loved','loving','beloved','cherish','cherished','treasure','treasured','adore','adored','adoring','smile','smiled','laugh','laughed','fun','enjoy','enjoyed','enjoying','celebrate','celebration','triumph','blessing','blessings','gift','reward','rewarding'],
  negative: ['bad','awful','terrible','horrible','horrid','dreadful','poor','worst','worse','negative','wrong','mistake','mistaken','fail','failed','failing','failure','lose','lost','losing','loss','broken','break','breaking','damage','damaged','damaging','hurt','hurting','pain','painful','suffer','suffered','suffering','sick','illness','ill','disease','sad','depressed','depression','anxious','anxiety','worry','worried','fear','afraid','scared','angry','mad','furious','frustrated','irritated','annoyed','disgusted','revolting','vile','nasty','filthy','dirty','rotten','foul','toxic','poisonous','harmful','harm','dangerous','danger','threat','threatening','crisis','disaster','catastrophe','catastrophic','tragic','tragedy','horror','horrible','nightmare','hopeless','despair','despairing','helpless','useless','worthless','unworthy','rejected','rejection','alone','lonely','isolated','abandoned','betrayed','betrayal','cheat','cheated','lie','lied','lying','liar','dishonest','deceit','deceived','fake','phony','false','wrong','bad','evil','wicked','cruel','cruelty','mean','meanness','rude','rudeness','disrespect','disrespectful','contempt','hate','hated','hatred','spite','spiteful'],
};

const all = new Set();
for (const list of Object.values(TAGS)) for (const w of list) all.add(w.toLowerCase());

const lexicon = {};
for (const word of Array.from(all).sort()) {
  const entry = {
    anger: 0, anticipation: 0, disgust: 0, fear: 0, joy: 0,
    negative: 0, positive: 0, sadness: 0, surprise: 0, trust: 0,
  };
  for (const [tag, list] of Object.entries(TAGS)) {
    if (list.includes(word)) entry[tag] = 1;
  }
  lexicon[word] = entry;
}

writeFileSync(out, JSON.stringify(lexicon, null, 2) + '\n');
console.log(`Wrote ${Object.keys(lexicon).length} entries to ${out}`);
