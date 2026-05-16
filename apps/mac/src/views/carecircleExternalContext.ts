import type { CareProviderContext } from './carecircleRuntime.js';

export async function checkCareProviderContext(): Promise<CareProviderContext> {
  const liveContext = await tryProviderContextRoute();
  if (liveContext) return liveContext;

  await new Promise((resolve) => window.setTimeout(resolve, 700));
  return {
    status: 'ready',
    source: 'demo',
    summary: 'Provider handoff packet prepared. The message stays source-based and asks for guidance, not a diagnosis.',
    checkedAt: new Date().toISOString(),
    operationId: 'demo-provider-handoff',
    items: [
      {
        title: 'Recommended route',
        detail: 'Start with the local pharmacy for medication timing and side-effect guidance, then route to Dr. Chen if they recommend clinical follow-up.',
        sourceLabel: 'Provider routing',
      },
      {
        title: 'Call script',
        detail: '“Family notes mention dizziness twice after a medication change. We are not assuming causation. Should timing, dosage, or side effects be reviewed?”',
        sourceLabel: 'Approval-first draft',
      },
      {
        title: 'Do not say',
        detail: 'Do not say the medication caused symptoms, do not diagnose, and do not send without Maya approving the text.',
        sourceLabel: 'CareCircle safety boundary',
      },
    ],
  };
}

async function tryProviderContextRoute(): Promise<CareProviderContext | null> {
  try {
    const res = await fetch('/api/carecircle/provider-context', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: 'Linda blood pressure medication dizziness pharmacy handoff',
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as CareProviderContext;
  } catch {
    return null;
  }
}
