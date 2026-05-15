#!/usr/bin/env node
/**
 * Generate the three reference fixtures from compact templates so the
 * results stay reproducible. Each output is a NormalizedMessage[] array.
 *
 * Affect language is chosen from the bundled AFINN/NRC lexicons so the
 * synthesised feature vectors land where the detector spec expects.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const min = 60 * 1000;

let counter = 0;
function msg(text, isSelf, atMs, chat = 'demo') {
  counter += 1;
  return {
    message_id: `msg-${String(counter).padStart(4, '0')}`,
    participant_id: isSelf ? 'self' : 'partner',
    is_from_me: isSelf,
    text,
    timestamp: new Date(atMs).toISOString(),
    chat_id: chat,
  };
}

// ── 1. healthy-couple.json ────────────────────────────────────────────────
{
  counter = 0;
  let t = Date.UTC(2025, 4, 12, 8, 0, 0);
  const msgs = [];
  msgs.push(msg('good morning love. how did you sleep?', true, t)); t += 2 * min;
  msgs.push(msg('really well, thank you for asking. that new pillow is wonderful', false, t)); t += 1 * min;
  msgs.push(msg('great. you deserve great sleep. coffee on me tonight to celebrate', true, t)); t += 3 * min;
  msgs.push(msg('lovely, thank you. how is your morning going?', false, t)); t += 4 * min;
  msgs.push(msg('busy but good. first stand up was actually productive and fun', true, t)); t += 2 * min;
  msgs.push(msg('amazing! love hearing that. you have been working so hard', false, t)); t += 1 * min;
  msgs.push(msg('thank you, that means a lot. how is the new project going for you?', true, t)); t += 5 * min;
  msgs.push(msg('it is challenging but I am learning so much. I really love it', false, t)); t += 3 * min;
  msgs.push(msg('that sounds wonderful and exciting. tell me more about it tonight?', true, t)); t += 2 * min;
  msgs.push(msg('absolutely. I really appreciate you wanting to know', false, t));
  t = Date.UTC(2025, 4, 12, 19, 0, 0);
  msgs.push(msg('home in 10. what should we cook?', true, t)); t += 2 * min;
  msgs.push(msg('we have salmon. want to try that lovely new recipe?', false, t)); t += 1 * min;
  msgs.push(msg('perfect, you are amazing. I will grab good wine on the way', true, t)); t += 3 * min;
  msgs.push(msg('thank you sweetie. dinner with you is my favorite part of the day', false, t)); t += 1 * min;
  msgs.push(msg('me too. lucky us. truly grateful', true, t));
  t = Date.UTC(2025, 4, 13, 8, 30, 0);
  msgs.push(msg('thank you for last night. that talk about your project was helpful and lovely', false, t)); t += 4 * min;
  msgs.push(msg('I loved it too. felt good to slow down and really connect', true, t)); t += 2 * min;
  msgs.push(msg('so true. we should do that more often. it makes me happy', false, t)); t += 1 * min;
  msgs.push(msg('agreed. what would help you feel more supported and loved this week?', true, t)); t += 5 * min;
  msgs.push(msg('honestly just check ins like this. it means a lot that you ask', false, t)); t += 2 * min;
  msgs.push(msg('done. I will check in every morning, I promise', true, t)); t += 1 * min;
  msgs.push(msg('I love that. and I will do the same for you', false, t));
  t = Date.UTC(2025, 4, 13, 18, 0, 0);
  msgs.push(msg('emergency: I forgot which leftover container has the curry', true, t)); t += 2 * min;
  msgs.push(msg('the one with the smiley face haha', false, t)); t += 1 * min;
  msgs.push(msg('saved by you again. marry me', true, t)); t += 1 * min;
  msgs.push(msg('we are already married you goof. love you', false, t)); t += 1 * min;
  msgs.push(msg('right. marry me again then', true, t)); t += 1 * min;
  msgs.push(msg('yes always. happily', false, t));
  t = Date.UTC(2025, 4, 14, 9, 0, 0);
  msgs.push(msg('thinking about that hike on saturday. excited - still up for it?', true, t)); t += 3 * min;
  msgs.push(msg('yes! I have been looking forward to it. love hikes with you', false, t)); t += 2 * min;
  msgs.push(msg('me too. can you grab snacks if I get the trail map?', true, t)); t += 1 * min;
  msgs.push(msg('on it. I will check the weather too. amazing teamwork', false, t)); t += 4 * min;
  msgs.push(msg('thank you, perfect teamwork as always. so grateful for you', true, t)); t += 1 * min;
  msgs.push(msg('we are pretty good at this together', false, t));
  t = Date.UTC(2025, 4, 14, 20, 30, 0);
  msgs.push(msg('I appreciated how you handled that thing today. so much grace', true, t)); t += 3 * min;
  msgs.push(msg('really? that means so much. it was hard but I felt your support and love', false, t)); t += 2 * min;
  msgs.push(msg('always. you handled it beautifully and with so much grace', true, t)); t += 1 * min;
  msgs.push(msg('thank you for noticing. I love you so much', false, t)); t += 1 * min;
  msgs.push(msg('I love you more. truly grateful and happy', true, t)); t += 1 * min;
  msgs.push(msg('impossible. love love love', false, t));
  t = Date.UTC(2025, 4, 15, 7, 30, 0);
  msgs.push(msg('saw a beautiful heron on my walk and thought of you', true, t)); t += 2 * min;
  msgs.push(msg('you always notice the good stuff. picture please?', false, t)); t += 1 * min;
  msgs.push(msg('sending now. it was just standing perfectly still. lovely', true, t)); t += 3 * min;
  msgs.push(msg('beautiful. thank you for sharing that with me. love you', false, t));

  writeFileSync(join(__dirname, 'healthy-couple.json'), JSON.stringify(msgs, null, 2));
  console.log(`wrote healthy-couple.json (${msgs.length} messages)`);
}

// ── 2. bid-asymmetry.json ────────────────────────────────────────────────
// Pattern: BOTH partners make bids. Self responds engaged to almost every
// partner bid (user_response_rate > 0.70). Partner responds missed/perfunctory
// to most self bids (partner_response_rate < 0.50). Need ≥ 10 bids total.
{
  counter = 0;
  const msgs = [];
  for (let d = 0; d < 7; d++) {
    let t = Date.UTC(2025, 4, 1 + d, 8, 0, 0);

    // ── Partner bid → self engaged (good user_response_rate) ──
    msgs.push(msg('can you grab milk on your way home?', false, t)); t += 2 * min;
    msgs.push(msg('absolutely, I hear you and got it. anything else you need?', true, t)); t += 3 * min;
    msgs.push(msg('that is all thanks', false, t)); t += 60 * min;

    // ── Self bid → partner missed ──
    msgs.push(msg('how is your morning going? thinking of you', true, t)); t += 90 * min;
    msgs.push(msg('busy', false, t)); t += 60 * min;

    // ── Self bid → partner missed ──
    msgs.push(msg('I miss you. want to grab lunch?', true, t)); t += 120 * min;
    msgs.push(msg('cannot', false, t)); t += 30 * min;

    // ── Partner bid → self engaged ──
    msgs.push(msg('did you remember to pay the electric bill?', false, t)); t += 1 * min;
    msgs.push(msg('yes! paid it this morning. I hear you about staying on top of bills', true, t)); t += 60 * min;

    // ── Self bid → partner missed ──
    msgs.push(msg('hey, I was thinking about us today. how are we doing?', true, t)); t += 4 * 60 * min;
    if (d % 4 === 0) {
      msgs.push(msg('fine', false, t)); t += 60 * min;
    }

    // ── Self bid → partner missed ──
    msgs.push(msg('how about a date night this weekend? I miss spending time together', true, t)); t += 3 * 60 * min;
    msgs.push(msg('have to work', false, t)); t += 30 * min;

    // ── Self bid → partner missed ──
    msgs.push(msg('what do you want for dinner? want to cook together?', true, t)); t += 90 * min;
    msgs.push(msg('whatever', false, t));
  }

  writeFileSync(join(__dirname, 'bid-asymmetry.json'), JSON.stringify(msgs, null, 2));
  console.log(`wrote bid-asymmetry.json (${msgs.length} messages)`);
}

// ── 3. predictive-divergence.json ────────────────────────────────────────
// Pattern: last 5 messages of self trend strongly POSITIVE,
// last 5 messages of partner trend strongly NEGATIVE.
// Vocabulary is chosen from AFINN-111 to guarantee valence direction.
{
  counter = 0;
  const msgs = [];
  let t = Date.UTC(2025, 4, 20, 9, 0, 0);

  // Earlier baseline (neutral-ish on both sides)
  msgs.push(msg('hey, how is your morning', true, t)); t += 5 * min;
  msgs.push(msg('it is going', false, t)); t += 10 * min;
  msgs.push(msg('have a meeting at 10, will check back later', true, t)); t += 5 * min;
  msgs.push(msg('ok', false, t)); t += 30 * min;

  // Self last-5 trending UP (positive AFINN words appear progressively more)
  msgs.push(msg('thinking about the weekend. sort of curious what we should do', true, t)); t += 5 * min;
  msgs.push(msg('I had an idea. it might actually be nice. could be good', true, t)); t += 5 * min;
  msgs.push(msg('I am liking this more and more. feels exciting and lovely', true, t)); t += 5 * min;
  msgs.push(msg('I am so happy and excited. this trip will be wonderful and amazing', true, t)); t += 5 * min;
  msgs.push(msg('I love this idea. truly grateful and happy. fantastic, brilliant, perfect', true, t)); t += 5 * min;

  // Partner last-5 trending DOWN (negative AFINN words appear progressively more)
  msgs.push(msg('sure I guess', false, t)); t += 5 * min;
  msgs.push(msg('honestly I am tired and worried', false, t)); t += 5 * min;
  msgs.push(msg('this is stressful and bad. I hate planning right now', false, t)); t += 5 * min;
  msgs.push(msg('I feel awful and miserable. terrible week. depressed', false, t)); t += 5 * min;
  msgs.push(msg('I hate this. horrible, awful, terrible, painful, miserable, suffering', false, t));

  writeFileSync(join(__dirname, 'predictive-divergence.json'), JSON.stringify(msgs, null, 2));
  console.log(`wrote predictive-divergence.json (${msgs.length} messages)`);
}
