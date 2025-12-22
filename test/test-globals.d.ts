type TestMocks = Record<string, unknown>;

declare global {
  __simulateRequest ?: (...args: unknown[]) => Promise<unknown> | unknown;
  __setMocksDirect ?: (mocks: TestMocks) => boolean;
  __simulateRequest ?: (...args: any[]) => Promise<any> | any;
}
}

export { };

