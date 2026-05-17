import * as fs from 'node:fs';
import * as path from 'node:path';

export interface CareCircleGBrainPage {
  id: string;
  kind: string;
  title: string;
  content: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export class CareCircleGBrainStore {
  private readonly pagesDir: string;

  constructor(homeDir: string) {
    this.pagesDir = path.join(homeDir, 'pages');
    if (!fs.existsSync(this.pagesDir)) {
      fs.mkdirSync(this.pagesDir, { recursive: true });
    }
  }

  upsertPage(page: Omit<CareCircleGBrainPage, 'created_at' | 'updated_at'>): CareCircleGBrainPage {
    const filePath = this.pagePath(page.id);
    const existing = this.getPage(page.id);
    const now = new Date().toISOString();
    const record: CareCircleGBrainPage = {
      ...page,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
    return record;
  }

  getPage(id: string): CareCircleGBrainPage | null {
    const filePath = this.pagePath(id);
    if (!fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as CareCircleGBrainPage;
    } catch {
      return null;
    }
  }

  listPages(kind?: string): CareCircleGBrainPage[] {
    if (!fs.existsSync(this.pagesDir)) return [];
    return fs
      .readdirSync(this.pagesDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(this.pagesDir, name), 'utf8')) as CareCircleGBrainPage;
        } catch {
          return null;
        }
      })
      .filter((page): page is CareCircleGBrainPage => page !== null)
      .filter((page) => (kind ? page.kind === kind : true));
  }

  countPages(kind?: string): number {
    return this.listPages(kind).length;
  }

  clear(): void {
    if (!fs.existsSync(this.pagesDir)) return;
    for (const name of fs.readdirSync(this.pagesDir)) {
      if (name.endsWith('.json')) fs.unlinkSync(path.join(this.pagesDir, name));
    }
  }

  clearKind(kind: string): number {
    const pages = this.listPages(kind);
    for (const page of pages) {
      const filePath = this.pagePath(page.id);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    return pages.length;
  }

  private pagePath(id: string): string {
    const safe = id.replace(/[^a-zA-Z0-9._-]+/g, '__');
    return path.join(this.pagesDir, `${safe}.json`);
  }
}

export function careCircleSourcePageId(docPath: string): string {
  return `carecircle::source::${docPath.replace(/\//g, '::')}`;
}
