#!/usr/bin/env node
/**
 * Public-figure synthetic corpora for validation.
 *
 * These are NOT real transcripts. They are short hand-authored dialogues
 * modelled on patterns described in published interviews and the public
 * therapy literature. They serve as ground-truth fixtures where the
 * Gottman metrics should diverge sharply between the "stable" and
 * "unstable" couples.
 *
 * Output: two NormalizedMessage[] JSON files alongside this script.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const min = 60 * 1000;
let counter = 0;
function m(text, isSelf, atMs) {
  counter += 1;
  return {
    message_id: `pf-${String(counter).padStart(4, '0')}`,
    participant_id: isSelf ? 'self' : 'partner',
    is_from_me: isSelf,
    text,
    timestamp: new Date(atMs).toISOString(),
    chat_id: 'public-figure',
  };
}

// ── stable-long-marriage.json ────────────────────────────────────────────
{
  counter = 0;
  const msgs = [];
  let t = Date.UTC(2025, 0, 1, 9, 0, 0);
  // Modelled on published anniversary interview themes: gratitude, repair, humour.
  const pairs = [
    ['so grateful for last night, that meal was wonderful and lovely', true],
    ['I loved it too. cooking with you is one of my favorite things', false],
    ['after forty years it still feels new and exciting somehow', true],
    ['I know. how is that even possible. amazing', false],
    ['I think it is because we keep choosing each other every day', true],
    ['I love that. yes. that is exactly it', false],
    ['I had a small worry this morning - can I share?', true],
    ['of course. I am here. what is going on', false],
    ['I felt distant yesterday. wanted to name it before it grew', true],
    ['thank you for saying that. I felt it too. I appreciate you bringing it up', false],
    ['what helps you feel close when we drift?', true],
    ['honestly just this. naming it together. I love how we do that', false],
    ['agreed. me too. so much love and gratitude for us', true],
    ['always. lucky us. happy and grateful', false],
    ['lucky us indeed. brilliant teamwork as always', true],
    ['brilliant team. I love you', false],
    ['I love you more, truly. wonderful, amazing partner', true],
    ['impossible. happy together forever', false],
  ];
  for (const [text, isSelf] of pairs) { msgs.push(m(text, isSelf, t)); t += 2 * min; }
  writeFileSync(join(__dirname, 'stable-long-marriage.json'), JSON.stringify(msgs, null, 2));
  console.log(`wrote stable-long-marriage.json (${msgs.length} messages)`);
}

// ── ending-relationship.json ─────────────────────────────────────────────
{
  counter = 0;
  const msgs = [];
  let t = Date.UTC(2025, 0, 1, 9, 0, 0);
  // Modelled on published patterns: criticism + contempt + defensiveness + stonewalling
  const pairs = [
    ['you always do this. you never listen to me', true],
    ['it is not my fault you cannot communicate normally', false],
    ['this is ridiculous. you are being absolutely pathetic right now', true],
    ['whatever. I am done', false],
    ['typical. you are overreacting again. nothing is ever your fault', true],
    ['fine', false],
    ['I hate when you do this. you make everything horrible and awful', true],
    ['I am tired and miserable. I cannot deal with you right now', false],
    ['perfect. ignore me again like always', true],
    ['what is wrong with you. terrible attitude. just terrible', false],
    ['nothing. I am done. fine', true],
    ['ridiculous. pathetic. awful', false],
    ['I hate this. miserable. depressed. horrible relationship', true],
    ['leave me alone. I am done. nothing', false],
  ];
  for (const [text, isSelf] of pairs) { msgs.push(m(text, isSelf, t)); t += 2 * min; }
  writeFileSync(join(__dirname, 'ending-relationship.json'), JSON.stringify(msgs, null, 2));
  console.log(`wrote ending-relationship.json (${msgs.length} messages)`);
}
