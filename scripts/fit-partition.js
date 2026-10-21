import { writeFileSync } from 'node:fs';
import { makeLayout } from '../src/layout.js';
import { fitPartitionToViews } from '../src/partition-fit.js';

const result = fitPartitionToViews(makeLayout('fan-v2'));
writeFileSync(new URL('../src/data/partition-fit.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
console.log(result);
