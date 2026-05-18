/**
 * Lazy Loading for Large Datasets
 * 
 * Provides lazy loading, pagination, and streaming capabilities
 * for handling large datasets efficiently.
 */

export interface LazyLoadOptions<T> {
  batchSize: number;
  prefetchCount: number;
  cacheSize: number;
}

export interface Page<T> {
  data: T[];
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface LazyLoader<T> {
  getPage(pageNumber: number, pageSize?: number): Promise<Page<T>>;
  stream(callback: (item: T) => void): Promise<void>;
  getAll(): AsyncGenerator<T>;
}

export class LazyArray<T> implements LazyLoader<T> {
  private data: T[];
  private loadedPages: Map<number, T[]> = new Map();
  private options: LazyLoadOptions<T>;
  private totalItems: number;

  constructor(data: T[], options: Partial<LazyLoadOptions<T>> = {}) {
    this.data = data;
    this.totalItems = data.length;
    this.options = {
      batchSize: options.batchSize || 100,
      prefetchCount: options.prefetchCount || 2,
      cacheSize: options.cacheSize || 10,
    };
  }

  async getPage(pageNumber: number, pageSize?: number): Promise<Page<T>> {
    const size = pageSize || this.options.batchSize;
    const startIndex = pageNumber * size;
    const endIndex = Math.min(startIndex + size, this.totalItems);

    // Check cache
    if (this.loadedPages.has(pageNumber)) {
      const cachedData = this.loadedPages.get(pageNumber)!;
      return this.createPage(cachedData, pageNumber, size);
    }

    // Load page
    const pageData = this.data.slice(startIndex, endIndex);
    
    // Cache page
    this.loadedPages.set(pageNumber, pageData);
    
    // Prefetch next pages
    this.prefetch(pageNumber, size);

    return this.createPage(pageData, pageNumber, size);
  }

  private createPage(data: T[], pageNumber: number, pageSize: number): Page<T> {
    const totalPages = Math.ceil(this.totalItems / pageSize);
    
    return {
      data,
      pageNumber,
      pageSize,
      totalPages,
      totalItems: this.totalItems,
      hasNext: pageNumber < totalPages - 1,
      hasPrevious: pageNumber > 0,
    };
  }

  private async prefetch(pageNumber: number, pageSize: number): Promise<void> {
    for (let i = 1; i <= this.options.prefetchCount; i++) {
      const nextPage = pageNumber + i;
      if (!this.loadedPages.has(nextPage)) {
        const startIndex = nextPage * pageSize;
        const endIndex = Math.min(startIndex + pageSize, this.totalItems);
        const pageData = this.data.slice(startIndex, endIndex);
        this.loadedPages.set(nextPage, pageData);
      }
    }

    // Evict old pages if cache is full
    while (this.loadedPages.size > this.options.cacheSize) {
      const oldestPage = this.findOldestPage(pageNumber);
      if (oldestPage !== null) {
        this.loadedPages.delete(oldestPage);
      }
    }
  }

  private findOldestPage(currentPage: number): number | null {
    let oldestPage: number | null = null;
    let maxDistance = 0;

    for (const page of this.loadedPages.keys()) {
      const distance = Math.abs(page - currentPage);
      if (distance > maxDistance) {
        maxDistance = distance;
        oldestPage = page;
      }
    }

    return oldestPage;
  }

  async stream(callback: (item: T) => void): Promise<void> {
    for (const item of this.data) {
      callback(item);
    }
  }

  async *getAll(): AsyncGenerator<T> {
    for (const item of this.data) {
      yield item;
    }
  }

  clearCache(): void {
    this.loadedPages.clear();
  }
}

// Async lazy loader for data sources that support pagination
export class AsyncLazyLoader<T> implements LazyLoader<T> {
  private loader: (page: number, size: number) => Promise<T[]>;
  private totalItems: number;
  private options: LazyLoadOptions<T>;
  private loadedPages: Map<number, T[]> = new Map();

  constructor(
    loader: (page: number, size: number) => Promise<T[]>,
    totalItems: number,
    options: Partial<LazyLoadOptions<T>> = {}
  ) {
    this.loader = loader;
    this.totalItems = totalItems;
    this.options = {
      batchSize: options.batchSize || 100,
      prefetchCount: options.prefetchCount || 2,
      cacheSize: options.cacheSize || 10,
    };
  }

  async getPage(pageNumber: number, pageSize?: number): Promise<Page<T>> {
    const size = pageSize || this.options.batchSize;

    // Check cache
    if (this.loadedPages.has(pageNumber)) {
      const cachedData = this.loadedPages.get(pageNumber)!;
      return this.createPage(cachedData, pageNumber, size);
    }

    // Load page
    const pageData = await this.loader(pageNumber, size);
    
    // Cache page
    this.loadedPages.set(pageNumber, pageData);
    
    // Prefetch next pages
    await this.prefetch(pageNumber, size);

    return this.createPage(pageData, pageNumber, size);
  }

  private createPage(data: T[], pageNumber: number, pageSize: number): Page<T> {
    const totalPages = Math.ceil(this.totalItems / pageSize);
    
    return {
      data,
      pageNumber,
      pageSize,
      totalPages,
      totalItems: this.totalItems,
      hasNext: pageNumber < totalPages - 1,
      hasPrevious: pageNumber > 0,
    };
  }

  private async prefetch(pageNumber: number, pageSize: number): Promise<void> {
    const prefetchPromises = [];
    
    for (let i = 1; i <= this.options.prefetchCount; i++) {
      const nextPage = pageNumber + i;
      if (!this.loadedPages.has(nextPage)) {
        prefetchPromises.push(
          this.loader(nextPage, pageSize).then(data => {
            this.loadedPages.set(nextPage, data);
          })
        );
      }
    }

    await Promise.all(prefetchPromises);

    // Evict old pages if cache is full
    while (this.loadedPages.size > this.options.cacheSize) {
      const oldestPage = this.findOldestPage(pageNumber);
      if (oldestPage !== null) {
        this.loadedPages.delete(oldestPage);
      }
    }
  }

  private findOldestPage(currentPage: number): number | null {
    let oldestPage: number | null = null;
    let maxDistance = 0;

    for (const page of this.loadedPages.keys()) {
      const distance = Math.abs(page - currentPage);
      if (distance > maxDistance) {
        maxDistance = distance;
        oldestPage = page;
      }
    }

    return oldestPage;
  }

  async stream(callback: (item: T) => void): Promise<void> {
    const pageSize = this.options.batchSize;
    const totalPages = Math.ceil(this.totalItems / pageSize);

    for (let page = 0; page < totalPages; page++) {
      const pageData = await this.getPage(page, pageSize);
      for (const item of pageData.data) {
        callback(item);
      }
    }
  }

  async *getAll(): AsyncGenerator<T> {
    const pageSize = this.options.batchSize;
    const totalPages = Math.ceil(this.totalItems / pageSize);

    for (let page = 0; page < totalPages; page++) {
      const pageData = await this.getPage(page, pageSize);
      for (const item of pageData.data) {
        yield item;
      }
    }
  }

  clearCache(): void {
    this.loadedPages.clear();
  }
}

// Streaming lazy loader for very large datasets
export class StreamingLoader<T> {
  private streamGenerator: () => AsyncGenerator<T>;
  private batchSize: number;

  constructor(streamGenerator: () => AsyncGenerator<T>, batchSize: number = 100) {
    this.streamGenerator = streamGenerator;
    this.batchSize = batchSize;
  }

  async stream(callback: (item: T) => void): Promise<void> {
    const generator = this.streamGenerator();
    
    for await (const item of generator) {
      callback(item);
    }
  }

  async *getAll(): AsyncGenerator<T> {
    const generator = this.streamGenerator();
    
    for await (const item of generator) {
      yield item;
    }
  }

  async *getBatches(): AsyncGenerator<T[]> {
    const generator = this.streamGenerator();
    const batch: T[] = [];

    for await (const item of generator) {
      batch.push(item);
      if (batch.length >= this.batchSize) {
        yield [...batch];
        batch.length = 0;
      }
    }

    if (batch.length > 0) {
      yield batch;
    }
  }

  async *getPage(pageNumber: number, pageSize: number): AsyncGenerator<T> {
    const generator = this.streamGenerator();
    let currentIndex = 0;
    const startIndex = pageNumber * pageSize;
    const endIndex = startIndex + pageSize;

    for await (const item of generator) {
      if (currentIndex >= startIndex && currentIndex < endIndex) {
        yield item;
      }
      currentIndex++;
      if (currentIndex >= endIndex) {
        break;
      }
    }
  }
}
