#!/usr/bin/env bun
/**
 * Generate demo corpus for NOUS.
 * 
 * Creates a sample mentalization graph with pre-populated belief nodes
 * to demonstrate NOUS functionality without requiring full message history.
 */
import type { MentalizationGraph, BeliefNode, BeliefDimension } from '../packages/shared/src/nous-types.js';

const DEMO_GRAPH: MentalizationGraph = {
  dyad_id: 'demo-dyad',
  schema_version: 1,
  updated_at: new Date().toISOString(),
  nodes: {},
  edges: [],
};

// Demo belief nodes covering different dimensions
const demoNodes: BeliefNode[] = [
  {
    id: 'attachment-1',
    dimension: 'attachment',
    claim: 'Partner values emotional intimacy and close connection',
    alpha: 4,
    beta: 2,
    evidence_refs: [
      {
        kind: 'message',
        ref_id: 'msg-1',
        observed_at: new Date(Date.now() - 86400000).toISOString(),
        polarity: 'confirms',
        strength: 0.8,
      },
      {
        kind: 'message',
        ref_id: 'msg-2',
        observed_at: new Date(Date.now() - 43200000).toISOString(),
        polarity: 'confirms',
        strength: 0.6,
      },
    ],
    last_updated: new Date(Date.now() - 43200000).toISOString(),
    schema_version: 1,
  },
  {
    id: 'values-1',
    dimension: 'values',
    claim: 'Partner prioritizes honesty and transparency in the relationship',
    alpha: 3,
    beta: 1,
    evidence_refs: [
      {
        kind: 'message',
        ref_id: 'msg-3',
        observed_at: new Date(Date.now() - 172800000).toISOString(),
        polarity: 'confirms',
        strength: 0.9,
      },
    ],
    last_updated: new Date(Date.now() - 172800000).toISOString(),
    schema_version: 1,
  },
  {
    id: 'communication-1',
    dimension: 'communication',
    claim: 'Partner tends to withdraw when feeling stressed',
    alpha: 2,
    beta: 3,
    evidence_refs: [
      {
        kind: 'message',
        ref_id: 'msg-4',
        observed_at: new Date(Date.now() - 259200000).toISOString(),
        polarity: 'disconfirms',
        strength: 0.7,
      },
      {
        kind: 'message',
        ref_id: 'msg-5',
        observed_at: new Date(Date.now() - 86400000).toISOString(),
        polarity: 'disconfirms',
        strength: 0.5,
      },
    ],
    last_updated: new Date(Date.now() - 86400000).toISOString(),
    schema_version: 1,
  },
  {
    id: 'external_context-1',
    dimension: 'external_context',
    claim: 'Partner has been experiencing work stress recently',
    alpha: 5,
    beta: 2,
    evidence_refs: [
      {
        kind: 'hog_operation',
        ref_id: 'hog-1',
        observed_at: new Date(Date.now() - 604800000).toISOString(),
        polarity: 'confirms',
        strength: 0.8,
      },
    ],
    last_updated: new Date(Date.now() - 604800000).toISOString(),
    schema_version: 1,
  },
];

// Add nodes to graph
for (const node of demoNodes) {
  DEMO_GRAPH.nodes[node.id] = node;
}

// Write to local JSON file
const outputDir = process.env.HOME || '.';
const outputPath = `${outputDir}/.dyad/mentalization-graph-demo-dyad.json`;

import { writeFileSync, mkdirSync } from 'fs';
try {
  mkdirSync(`${outputDir}/.dyad`, { recursive: true });
  writeFileSync(outputPath, JSON.stringify(DEMO_GRAPH, null, 2));
  console.log(`Demo corpus written to: ${outputPath}`);
  console.log(`Generated ${demoNodes.length} belief nodes across 4 dimensions`);
} catch (err) {
  console.error('Failed to write demo corpus:', err);
  process.exit(1);
}
