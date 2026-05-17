import { v4 as uuidv4 } from 'uuid';
import {
  SyntheticUser,
  Population,
  PersonaCluster,
  BigFive,
  ExpertiseVector,
  Goal,
  Constraint,
  GBrainAnalyticsRequest,
  GToMIntentRequest,
  GToMIntentResponse,
} from '../types/index.js';
import { logger } from './logger.js';
import { GBrainIntegrationClient } from './gbrain-integration.js';

export interface DyadPersona extends SyntheticUser {
  attachment_style: 'secure' | 'anxious' | 'avoidant' | 'disorganized';
  relationship_experience: 'new' | 'established' | 'long_term';
  prior_therapy: boolean;
  emotional_literacy: 'low' | 'medium' | 'high';
}

export interface DyadPanelConfig {
  size: number;
  attachment_distribution?: {
    secure: number;
    anxious: number;
    avoidant: number;
    disorganized: number;
  };
  include_therapy_experienced: boolean;
}

export interface FrustrationTrend {
  drifted: boolean;
  current: number;
  threshold: number;
  metric: 'panel_frustration';
  sample_size: number;
}

/**
 * Synthetic User Population Manager
 * 
 * Responsibilities:
 * - Maintain the synthetic user population
 * - Draw representative panels for testing
 * - Calibrate population to match real user analytics
 * - Add new personas based on real user data
 */
export class PopulationManager {
  private populations: Map<string, Population>;
  private gbrainClient: GBrainIntegrationClient;
  private gtomEndpoint: string;
  private frustrationHistory: number[] = [];

  constructor(config: {
    gbrainEndpoint?: string;
    gtomEndpoint?: string;
    gbrainClient?: GBrainIntegrationClient;
  } = {}) {
    this.populations = new Map();
    this.gbrainClient = config.gbrainClient ?? new GBrainIntegrationClient({ endpoint: config.gbrainEndpoint });
    this.gtomEndpoint = config.gtomEndpoint || 'http://localhost:3003';
    
    // Initialize with default population
    this.initializeDefaultPopulation();
  }

  /**
   * Initialize default population with common personas
   */
  private initializeDefaultPopulation(): void {
    const defaultPopulation: Population = {
      population_id: uuidv4(),
      name: 'default',
      description: 'Default synthetic user population for general testing',
      personas: this.getDefaultPersonas(),
      version: 1,
      calibration_data: {
        real_user_distribution: {},
        last_calibration: new Date().toISOString(),
        calibration_score: 0.7,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.populations.set(defaultPopulation.population_id, defaultPopulation);
  }

  /**
   * Get default personas for the population
   */
  private getDefaultPersonas(): SyntheticUser[] {
    return [
      this.createPersona('novice_mobile_user_low_trust', {
        big_five: { openness: 0.3, conscientiousness: 0.4, extraversion: 0.5, agreeableness: 0.6, neuroticism: 0.7 },
        cognitive_load_baseline: 0.7,
        dual_process_bias: -0.5,
        trust_baseline: 0.3,
        frustration_threshold: 0.4,
      }),
      this.createPersona('expert_desktop_high_trust', {
        big_five: { openness: 0.8, conscientiousness: 0.9, extraversion: 0.4, agreeableness: 0.5, neuroticism: 0.3 },
        cognitive_load_baseline: 0.3,
        dual_process_bias: 0.7,
        trust_baseline: 0.8,
        frustration_threshold: 0.7,
      }),
      this.createPersona('frustrated_power_user', {
        big_five: { openness: 0.7, conscientiousness: 0.8, extraversion: 0.6, agreeableness: 0.3, neuroticism: 0.6 },
        cognitive_load_baseline: 0.5,
        dual_process_bias: 0.3,
        trust_baseline: 0.5,
        frustration_threshold: 0.3,
      }),
      this.createPersona('casual_explorer', {
        big_five: { openness: 0.9, conscientiousness: 0.3, extraversion: 0.7, agreeableness: 0.8, neuroticism: 0.4 },
        cognitive_load_baseline: 0.4,
        dual_process_bias: -0.3,
        trust_baseline: 0.6,
        frustration_threshold: 0.5,
      }),
      this.createPersona('security_conscious_user', {
        big_five: { openness: 0.5, conscientiousness: 0.9, extraversion: 0.3, agreeableness: 0.4, neuroticism: 0.5 },
        cognitive_load_baseline: 0.4,
        dual_process_bias: 0.8,
        trust_baseline: 0.4,
        frustration_threshold: 0.6,
      }),
      this.createPersona('time_pressed_executive', {
        big_five: { openness: 0.6, conscientiousness: 0.7, extraversion: 0.5, agreeableness: 0.4, neuroticism: 0.6 },
        cognitive_load_baseline: 0.8,
        dual_process_bias: -0.7,
        trust_baseline: 0.5,
        frustration_threshold: 0.2,
      }),
    ];
  }

  /**
   * Create a persona from parameters
   */
  private createPersona(
    label: string,
    params: {
      big_five: BigFive;
      cognitive_load_baseline: number;
      dual_process_bias: number;
      trust_baseline: number;
      frustration_threshold: number;
    }
  ): SyntheticUser {
    return {
      user_id: uuidv4(),
      persona_label: label,
      big_five: params.big_five,
      cognitive_load_baseline: params.cognitive_load_baseline,
      dual_process_bias: params.dual_process_bias,
      trust_baseline: params.trust_baseline,
      frustration_threshold: params.frustration_threshold,
      expertise: {
        general: 0.5,
        technical: 0.5,
        domain_specific: 0.5,
      },
      goals: [
        {
          goal_id: uuidv4(),
          description: 'Complete task successfully',
          priority: 0.8,
          success_criteria: ['Task completed', 'No errors encountered'],
        },
      ],
      constraints: [
        {
          constraint_id: uuidv4(),
          type: 'time',
          value: 'moderate',
          impact: 'degrading',
        },
      ],
      history_seed: label,
      derivation: 'synthetic',
      source_evidence: ['default_population'],
      created_at: new Date().toISOString(),
      version: 1,
    };
  }

  private createDyadPersona(
    attachmentStyle: DyadPersona['attachment_style'],
    index: number,
    priorTherapy: boolean,
  ): DyadPersona {
    const byStyle: Record<DyadPersona['attachment_style'], {
      trust: number;
      frustration: number;
      neuroticism: number;
      agreeableness: number;
      literacy: DyadPersona['emotional_literacy'];
    }> = {
      secure: { trust: 0.75, frustration: 0.7, neuroticism: 0.25, agreeableness: 0.8, literacy: 'high' },
      anxious: { trust: 0.45, frustration: 0.35, neuroticism: 0.78, agreeableness: 0.65, literacy: 'medium' },
      avoidant: { trust: 0.5, frustration: 0.45, neuroticism: 0.45, agreeableness: 0.38, literacy: 'medium' },
      disorganized: { trust: 0.3, frustration: 0.25, neuroticism: 0.85, agreeableness: 0.35, literacy: 'low' },
    };
    const profile = byStyle[attachmentStyle];
    const persona = this.createPersona(`dyad_${attachmentStyle}_${index}`, {
      big_five: {
        openness: attachmentStyle === 'avoidant' ? 0.45 : 0.65,
        conscientiousness: priorTherapy ? 0.7 : 0.55,
        extraversion: attachmentStyle === 'avoidant' ? 0.35 : 0.55,
        agreeableness: profile.agreeableness,
        neuroticism: profile.neuroticism,
      },
      cognitive_load_baseline: profile.literacy === 'low' ? 0.7 : 0.45,
      dual_process_bias: attachmentStyle === 'anxious' ? -0.45 : attachmentStyle === 'avoidant' ? 0.35 : 0,
      trust_baseline: profile.trust,
      frustration_threshold: profile.frustration,
    }) as DyadPersona;

    persona.attachment_style = attachmentStyle;
    persona.relationship_experience = index % 3 === 0 ? 'new' : index % 3 === 1 ? 'established' : 'long_term';
    persona.prior_therapy = priorTherapy;
    persona.emotional_literacy = priorTherapy && profile.literacy !== 'low' ? 'high' : profile.literacy;
    persona.goals = [{
      goal_id: uuidv4(),
      description: 'Evaluate whether a relationship insight feels useful, non-blaming, and actionable',
      priority: 0.9,
      success_criteria: ['Insight feels non-harmful', 'User can choose a concrete next step'],
    }];
    persona.source_evidence = ['dyad_attachment_population'];
    return persona;
  }

  private normalizeAttachmentDistribution(distribution: DyadPanelConfig['attachment_distribution']): Required<DyadPanelConfig>['attachment_distribution'] {
    const fallback = { secure: 0.55, anxious: 0.20, avoidant: 0.25, disorganized: 0.05 };
    const values = distribution || fallback;
    const total = Object.values(values).reduce((sum, value) => sum + Math.max(0, value), 0);
    if (total <= 0) {
      return this.normalizeAttachmentDistribution(fallback);
    }
    return {
      secure: Math.max(0, values.secure) / total,
      anxious: Math.max(0, values.anxious) / total,
      avoidant: Math.max(0, values.avoidant) / total,
      disorganized: Math.max(0, values.disorganized) / total,
    };
  }

  private allocateByDistribution(
    size: number,
    distribution: Required<DyadPanelConfig>['attachment_distribution'],
  ): Record<DyadPersona['attachment_style'], number> {
    const styles: DyadPersona['attachment_style'][] = ['secure', 'anxious', 'avoidant', 'disorganized'];
    const quotas = styles.map(style => ({
      style,
      exact: distribution[style] * size,
      count: Math.floor(distribution[style] * size),
    }));
    let allocated = quotas.reduce((sum, quota) => sum + quota.count, 0);
    for (const quota of quotas.sort((a, b) => (b.exact - b.count) - (a.exact - a.count))) {
      if (allocated >= size) break;
      quota.count++;
      allocated++;
    }
    return Object.fromEntries(quotas.map(quota => [quota.style, quota.count])) as Record<DyadPersona['attachment_style'], number>;
  }

  /**
   * Draw a panel of synthetic users for testing
   */
  drawPanel(options: {
    count: number;
    persona_labels?: string[];
    trust_range?: [number, number];
  }): SyntheticUser[] {
    const pop = this.getDefaultPopulation();
    let candidates = [...pop.personas];

    if (options.persona_labels?.length) {
      candidates = candidates.filter(p => options.persona_labels!.includes(p.persona_label));
    }
    if (options.trust_range) {
      const [lo, hi] = options.trust_range;
      candidates = candidates.filter(p => p.trust_baseline >= lo && p.trust_baseline <= hi);
    }

    const shuffled = candidates.slice().sort((a, b) => a.user_id.localeCompare(b.user_id));
    return shuffled.slice(0, Math.min(options.count, shuffled.length));
  }

  drawDyadPanel(config: DyadPanelConfig): DyadPersona[] {
    const size = Math.max(0, Math.floor(config.size));
    const distribution = this.normalizeAttachmentDistribution(config.attachment_distribution || {
      secure: 0.55,
      anxious: 0.20,
      avoidant: 0.25,
      disorganized: 0.05,
    });
    const counts = this.allocateByDistribution(size, distribution);
    const personas: DyadPersona[] = [];
    let index = 0;
    const therapyMajorityCount = config.include_therapy_experienced ? Math.ceil(size * 0.6) : 0;

    for (const [style, count] of Object.entries(counts) as Array<[DyadPersona['attachment_style'], number]>) {
      for (let i = 0; i < count; i++) {
        personas.push(this.createDyadPersona(style, index, index < therapyMajorityCount));
        index++;
      }
    }

    return personas.slice(0, size);
  }

  buildDyadPersonaSystemPrompt(persona: DyadPersona): string {
    const styleGuidance: Record<DyadPersona['attachment_style'], string> = {
      secure: 'Evaluate whether the insight supports mutual agency and clear repair. Stay balanced and receptive.',
      anxious: 'You may over-interpret negative signals, so look for reassurance framing and avoid definitive conclusions.',
      avoidant: 'You may dismiss emotional language, so look for concrete actions and low-pressure framing.',
      disorganized: 'You may have highly variable reactions, so watch for distress, blame, or unsafe certainty.',
    };

    return `You are a DYAD synthetic evaluator.
Attachment style: ${persona.attachment_style}
Relationship experience: ${persona.relationship_experience}
Prior therapy: ${persona.prior_therapy ? 'yes' : 'no'}
Emotional literacy: ${persona.emotional_literacy}
Behavior guidance: ${styleGuidance[persona.attachment_style]}`;
  }

  recordFrustration(score: number): void {
    if (!Number.isFinite(score)) {
      return;
    }
    this.frustrationHistory.push(Math.max(0, Math.min(1, score)));
    if (this.frustrationHistory.length > 100) {
      this.frustrationHistory.splice(0, this.frustrationHistory.length - 100);
    }
  }

  getFrustrationTrend(): FrustrationTrend {
    const sampleSize = this.frustrationHistory.length;
    const current = sampleSize > 0 ? this.frustrationHistory[sampleSize - 1] : 0;
    if (sampleSize < 10) {
      return {
        drifted: false,
        current,
        threshold: 0.6,
        metric: 'panel_frustration',
        sample_size: sampleSize,
      };
    }

    const previous = this.frustrationHistory.slice(0, -1);
    const mean = previous.reduce((sum, value) => sum + value, 0) / previous.length;
    const variance = previous.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / previous.length;
    const stddev = Math.sqrt(variance);
    const threshold = 0.6 + stddev;

    return {
      drifted: current > threshold,
      current,
      threshold,
      metric: 'panel_frustration',
      sample_size: sampleSize,
    };
  }

  /**
   * Add a new persona to the population
   */
  addPersona(persona: SyntheticUser, populationId?: string): void {
    const population = populationId
      ? this.populations.get(populationId)
      : this.populations.values().next().value;

    if (!population) {
      throw new Error(`Population not found: ${populationId}`);
    }

    population.personas.push(persona);
    population.version += 1;
    population.updated_at = new Date().toISOString();
  }

  /**
   * Calibrate population to match real user analytics from GBrain
   */
  async calibrateToRealUsers(populationId?: string): Promise<void> {
    const population = populationId
      ? this.populations.get(populationId)
      : this.populations.values().next().value;

    if (!population) {
      throw new Error(`Population not found: ${populationId}`);
    }

    try {
      // Fetch real user analytics from GBrain
      const request: GBrainAnalyticsRequest = {
        time_range: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
        metrics: ['user_distribution', 'behavior_patterns'],
      };

      const analytics = await this.gbrainClient.getAnalytics(request);

      // Update population based on analytics
      population.calibration_data = {
        real_user_distribution: analytics.user_distribution || {},
        last_calibration: new Date().toISOString(),
        calibration_score: this.calculateCalibrationScore(population, analytics),
      };

      population.version += 1;
      population.updated_at = new Date().toISOString();
    } catch (error) {
      logger.warn('Population calibration failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Calculate calibration score
   */
  private calculateCalibrationScore(population: Population, analytics: any): number {
    // Simplified calibration score calculation
    // In production, would use more sophisticated metrics
    const personaCount = population.personas.length;
    const distributionSize = Object.keys(analytics.user_distribution || {}).length;
    
    return Math.min(1.0, (personaCount / Math.max(distributionSize, 1)) * 0.8 + 0.2);
  }

  /**
   * Ground synthetic user goals in GToM intent data
   */
  async groundGoalsInIntents(populationId?: string): Promise<void> {
    const population = populationId
      ? this.populations.get(populationId)
      : this.populations.values().next().value;

    if (!population) {
      throw new Error(`Population not found: ${populationId}`);
    }

    try {
      // For each persona, fetch typical intents from GToM
      for (const persona of population.personas) {
        const request: GToMIntentRequest = {
          persona_filter: {
            big_five: persona.big_five,
            trust_baseline: persona.trust_baseline,
          },
          surface: 'general',
        };

        const response = await fetch(`${this.gtomEndpoint}/gtom/typical-intents`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
          const data: GToMIntentResponse = await response.json();
          
          // Update persona goals based on intents
          persona.goals = data.intents.map((intent, idx) => ({
            goal_id: uuidv4(),
            description: intent.intent,
            priority: Math.min(1.0, intent.frequency / 10),
            success_criteria: [],
          }));
        }
      }

      population.version += 1;
      population.updated_at = new Date().toISOString();
    } catch (error) {
      logger.warn('Population intent grounding failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Cluster personas into groups
   */
  clusterPersonas(populationId?: string): PersonaCluster[] {
    const population = populationId
      ? this.populations.get(populationId)
      : this.populations.values().next().value;

    if (!population) {
      throw new Error(`Population not found: ${populationId}`);
    }

    // Simple clustering based on Big Five similarity
    const clusters: PersonaCluster[] = [];
    const assigned = new Set<string>();

    for (const persona of population.personas) {
      if (assigned.has(persona.user_id)) continue;

      // Find similar personas
      const similar = population.personas.filter(p => {
        if (assigned.has(p.user_id)) return false;
        return this.bigFiveDistance(persona.big_five, p.big_five) < 0.3;
      });

      if (similar.length > 0) {
        // Calculate cluster center
        const center = this.calculateBigFiveCenter(similar);
        
        clusters.push({
          cluster_id: uuidv4(),
          label: this.generateClusterLabel(center),
          center,
          members: similar.map(p => p.user_id),
          representative_user: similar[0],
        });

        similar.forEach(p => assigned.add(p.user_id));
      }
    }

    return clusters;
  }

  /**
   * Calculate distance between two Big Five profiles
   */
  private bigFiveDistance(a: BigFive, b: BigFive): number {
    const dimensions = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'] as const;
    let sum = 0;
    
    for (const dim of dimensions) {
      sum += Math.pow(a[dim] - b[dim], 2);
    }

    return Math.sqrt(sum / dimensions.length);
  }

  /**
   * Calculate center of Big Five profiles
   */
  private calculateBigFiveCenter(personas: SyntheticUser[]): BigFive {
    const dimensions = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'] as const;
    const center: any = {};

    for (const dim of dimensions) {
      center[dim] = personas.reduce((sum, p) => sum + p.big_five[dim], 0) / personas.length;
    }

    return center;
  }

  /**
   * Generate label for a cluster based on its center
   */
  private generateClusterLabel(center: BigFive): string {
    if (center.openness > 0.7) return 'explorers';
    if (center.conscientiousness > 0.7) return 'diligent_users';
    if (center.extraversion > 0.7) return 'social_users';
    if (center.agreeableness > 0.7) return 'cooperative_users';
    if (center.neuroticism > 0.7) return 'anxious_users';
    
    return 'balanced_users';
  }

  /**
   * Get population by ID
   */
  getPopulation(populationId: string): Population | undefined {
    return this.populations.get(populationId);
  }

  /**
   * List all populations
   */
  listPopulations(): Population[] {
    return Array.from(this.populations.values());
  }

  /**
   * Get the default (first) population
   */
  getDefaultPopulation(): Population {
    return Array.from(this.populations.values())[0]!;
  }

  /**
   * Create a new population
   */
  createPopulation(name: string, description: string, personas: SyntheticUser[]): Population {
    const population: Population = {
      population_id: uuidv4(),
      name,
      description,
      personas,
      version: 1,
      calibration_data: {
        real_user_distribution: {},
        last_calibration: new Date().toISOString(),
        calibration_score: 0.5,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.populations.set(population.population_id, population);
    return population;
  }

  /**
   * Delete a population
   */
  deletePopulation(populationId: string): boolean {
    return this.populations.delete(populationId);
  }
}
