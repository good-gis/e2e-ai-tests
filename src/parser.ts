import { readFile } from 'fs/promises';
import type { ParsedTest } from './interfaces/parsed-test.interface.js';

interface TestJson {
  name: string;
  description?: string;
  url: string;
  steps: string[];
  expectedResults: string[];
  preconditions?: string[];
}

export async function parseTestFile(filePath: string): Promise<ParsedTest> {
  const content = await readFile(filePath, 'utf-8');

  let test: TestJson;
  try {
    test = JSON.parse(content);
  } catch {
    throw new Error(`Invalid JSON in test file ${filePath}`);
  }

  if (!test.name) {
    throw new Error(`Test file ${filePath} must have a "name" field`);
  }

  if (!test.url) {
    throw new Error(`Test file ${filePath} must have a "url" field`);
  }

  if (!Array.isArray(test.steps) || test.steps.length === 0) {
    throw new Error(`Test file ${filePath} must have at least one step`);
  }

  if (!Array.isArray(test.expectedResults) || test.expectedResults.length === 0) {
    throw new Error(`Test file ${filePath} must have expected results`);
  }

  return {
    name: test.name,
    description: test.description,
    url: test.url,
    steps: test.steps,
    expectedResults: test.expectedResults,
    preconditions: test.preconditions,
    filePath,
  };
}
