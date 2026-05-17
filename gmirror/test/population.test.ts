import { PopulationManager } from '../src/core/population.js';
import { SyntheticUser } from '../src/types/index.js';

describe('PopulationManager', () => {
  let manager: PopulationManager;

  beforeEach(() => {
    manager = new PopulationManager();
  });

  it('getDefaultPopulation returns a population with at least 3 personas', () => {
    const pop = manager.getDefaultPopulation();
    expect(pop).toBeDefined();
    expect(pop.personas.length).toBeGreaterThanOrEqual(3);
  });

  it('drawPanel returns exactly n personas', () => {
    const panel = manager.drawPanel({ count: 2 });
    expect(panel).toHaveLength(2);
  });

  it('drawPanel count 0 returns empty array', () => {
    const panel = manager.drawPanel({ count: 0 });
    expect(panel).toHaveLength(0);
  });

  it('drawPanel count > population size returns all available personas', () => {
    const pop = manager.getDefaultPopulation();
    const panel = manager.drawPanel({ count: 1000 });
    expect(panel.length).toBeLessThanOrEqual(pop.personas.length);
  });

  it('drawPanel with persona_labels filter returns only matching personas', () => {
    const pop = manager.getDefaultPopulation();
    const labels = pop.personas.slice(0, 1).map(p => p.persona_label);
    const panel = manager.drawPanel({ count: 10, persona_labels: labels });
    expect(panel.every(p => labels.includes(p.persona_label))).toBe(true);
  });

  it('addPersona adds to the default population', () => {
    const before = manager.getDefaultPopulation().personas.length;
    manager.addPersona({
      user_id: '00000000-0000-0000-0000-999999999999',
      persona_label: 'test_added_persona',
      big_five: { openness: 0.5, conscientiousness: 0.5, extraversion: 0.5, agreeableness: 0.5, neuroticism: 0.5 },
      cognitive_load_baseline: 0.3,
      dual_process_bias: 0,
      trust_baseline: 0.6,
      frustration_threshold: 0.7,
      expertise: {},
      goals: [],
      constraints: [],
      history_seed: 'added',
      derivation: 'synthetic',
      source_evidence: [],
      created_at: new Date().toISOString(),
      version: 1,
    });
    const after = manager.getDefaultPopulation().personas.length;
    expect(after).toBe(before + 1);
  });

  it('drawDyadPanel returns default attachment distribution close to research norms', () => {
    const panel = manager.drawDyadPanel({ size: 20, include_therapy_experienced: false });
    const counts = panel.reduce<Record<string, number>>((acc, persona) => {
      acc[persona.attachment_style] = (acc[persona.attachment_style] || 0) + 1;
      return acc;
    }, {});

    expect(panel).toHaveLength(20);
    expect(counts.secure).toBe(10);
    expect(counts.anxious).toBe(4);
    expect(counts.avoidant).toBe(5);
    expect(counts.disorganized).toBe(1);
  });

  it('drawDyadPanel respects custom attachment distribution', () => {
    const panel = manager.drawDyadPanel({
      size: 10,
      include_therapy_experienced: false,
      attachment_distribution: { secure: 0.2, anxious: 0.3, avoidant: 0.5, disorganized: 0 },
    });

    expect(panel.filter(persona => persona.attachment_style === 'secure')).toHaveLength(2);
    expect(panel.filter(persona => persona.attachment_style === 'anxious')).toHaveLength(3);
    expect(panel.filter(persona => persona.attachment_style === 'avoidant')).toHaveLength(5);
    expect(panel.filter(persona => persona.attachment_style === 'disorganized')).toHaveLength(0);
  });

  it('drawDyadPanel can make prior therapy experience the majority', () => {
    const panel = manager.drawDyadPanel({ size: 9, include_therapy_experienced: true });
    expect(panel.filter(persona => persona.prior_therapy)).toHaveLength(6);
  });

  it('DYAD persona prompts vary by attachment style', () => {
    const panel = manager.drawDyadPanel({
      size: 4,
      include_therapy_experienced: false,
      attachment_distribution: { secure: 0.25, anxious: 0.25, avoidant: 0.25, disorganized: 0.25 },
    });
    const prompts = panel.map(persona => manager.buildDyadPersonaSystemPrompt(persona));

    expect(new Set(prompts).size).toBe(4);
    expect(prompts.some(prompt => prompt.includes('reassurance framing'))).toBe(true);
    expect(prompts.some(prompt => prompt.includes('concrete actions'))).toBe(true);
  });

  it('tracks panel frustration trend with insufficient, low, and high samples', () => {
    for (const value of [0.1, 0.2, 0.15]) manager.recordFrustration(value);
    expect(manager.getFrustrationTrend().drifted).toBe(false);
    expect(manager.getFrustrationTrend().sample_size).toBe(3);

    manager = new PopulationManager();
    for (let i = 0; i < 9; i++) manager.recordFrustration(0.2);
    manager.recordFrustration(0.3);
    expect(manager.getFrustrationTrend().drifted).toBe(false);

    manager = new PopulationManager();
    for (let i = 0; i < 9; i++) manager.recordFrustration(0.2);
    manager.recordFrustration(0.9);
    expect(manager.getFrustrationTrend().drifted).toBe(true);
  });
});
