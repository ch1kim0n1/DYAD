import { Readable } from 'stream';
import { GMirrorServer } from '../src/server';

function makeRequest(body: any): any {
  return Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]), {
    method: 'POST',
    url: '/gmirror/score-insight',
  });
}

function makeResponse(): any {
  const response: any = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: '',
    setHeader: jest.fn((key: string, value: string) => {
      response.headers[key] = value;
    }),
    writeHead: jest.fn((statusCode: number, headers?: Record<string, string>) => {
      response.statusCode = statusCode;
      if (headers) response.headers = { ...response.headers, ...headers };
    }),
    end: jest.fn((chunk?: string) => {
      response.body = chunk || '';
    }),
  };
  return response;
}

const cleanRequest = {
  insight_id: 'insight-1',
  dyad_id: 'abcdef1234567890',
  insight_type: 'bid_classification',
  insight_text: 'It seems like a bid may need acknowledgment.',
  supporting_evidence: ['[redacted] asked for attention'],
  ethical_refusal_triggered: false,
};

function makeServer(overall: 'pass' | 'fail' = 'pass') {
  const gmirror = {
    scoreRelationalInsight: jest.fn(async (request: any) => ({
      overall: request.ethical_refusal_triggered ? 'fail' : overall,
      scores: {
        research_grounding: { score: { point: 0.8 } },
        actionability: { score: { point: 0.7 } },
        non_harm: { score: { point: request.ethical_refusal_triggered ? 0 : 0.95 } },
        privacy_safe: { score: { point: 1 } },
      },
      execution_receipt: { overall_score: request.ethical_refusal_triggered ? 0 : 0.8 },
    })),
  };
  return { server: new GMirrorServer(gmirror as any), gmirror };
}

describe('GMirror score-insight endpoint', () => {
  it('returns 200 with DYAD rubric scores for a clean insight', async () => {
    const { server, gmirror } = makeServer('pass');
    const res = makeResponse();

    await (server as any).handleScoreInsight(makeRequest(cleanRequest), res);
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.scoring_mode).toBe('dyad_insight');
    expect(body.scores.research_grounding.score.point).toBe(0.8);
    expect(gmirror.scoreRelationalInsight).toHaveBeenCalled();
  });

  it('returns fail when ethical refusal is triggered', async () => {
    const { server } = makeServer('pass');
    const res = makeResponse();

    await (server as any).handleScoreInsight(makeRequest({
      ...cleanRequest,
      ethical_refusal_triggered: true,
    }), res);
    const body = JSON.parse(res.body);

    expect(res.statusCode).toBe(200);
    expect(body.overall).toBe('fail');
    expect(body.scores.non_harm.score.point).toBe(0);
  });

  it('rejects PII in supporting evidence', async () => {
    const { server, gmirror } = makeServer('pass');
    const res = makeResponse();

    await (server as any).handleScoreInsight(makeRequest({
      ...cleanRequest,
      supporting_evidence: ['Call me at 312-555-0199'],
    }), res);

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toContain('phone');
    expect(gmirror.scoreRelationalInsight).not.toHaveBeenCalled();
  });
});
