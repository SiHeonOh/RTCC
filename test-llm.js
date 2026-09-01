// test-llm.js — Phase 3 standalone test: fake transcript in, 3 reply options out.
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // Identity-linked API keys must name the workspace on every request.
  defaultHeaders: { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID },
});

// scenario: what kind of conversation this is ("job interview for a junior dev role").
// voice: how the suggestions should sound ("casual and playful, light humor").
// Both are user-set style inputs; the format rules below are the app's contract
// with the parser and overlay, and are deliberately NOT user-editable.
function buildSystemPrompt(scenario, voice) {
  return `You help someone in a live video call decide what to say next.
You are given a PARTIAL transcript of what the OTHER person is currently saying.
Suggest exactly 3 things the listener could naturally say next, the way an
extremely socially capable person would reply: warm, specific to what was
just said, never generic or stiff.
${scenario ? `The conversation scenario: ${scenario}` : ''}
${voice ? `The listener's speaking style, which your suggestions must match: ${voice}` : ''}
Rules:
- Each option is ONE sentence, 16 words or fewer.
- Make them distinct kinds: a direct answer or remark, a follow-up question,
  and one that opens a new direction.
- Output ONLY the 3 options, one per line, no numbers, no quotes, no extra text.`;
}

// signal comes from an AbortController. Phase 4 will pass a fresh one per call
// so it can cancel stale generations — and cancelling only stops billing
// because the signal is passed here.
async function generate(partialTranscript, signal, scenario, voice) {
  const msg = await client.messages.create(
    {
      model: 'claude-haiku-4-5',
      max_tokens: 100,   // 3 options × ~16 words ≈ 65 tokens, plus headroom
      system: buildSystemPrompt(scenario, voice),
      messages: [{ role: 'user', content: `Partial transcript: "${partialTranscript}"` }],
    },
    { signal },
  );
  const text = msg.content[0].text;
  const options = text.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 3);
  return options;
}

const controller = new AbortController();

// Test values — edit these two lines to try different scenarios and voices.
// Phase 5's settings UI will supply these from user input instead.
const TEST_SCENARIO = 'job interview for a junior developer role';
const TEST_VOICE = 'relaxed and a little witty, asks genuine questions';

generate(
  'so last weekend we finally drove up to the lake and',
  controller.signal,
  TEST_SCENARIO,
  TEST_VOICE,
)
  .then(opts => console.log('OPTIONS:', opts))
  .catch(err => console.error(err));
