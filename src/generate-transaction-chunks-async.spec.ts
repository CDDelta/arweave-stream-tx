import { generateTransactionChunks } from 'arweave/node/lib/merkle';
import { createReadStream } from 'fs';
import { readFile } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { generateTransactionChunksAsync } from './generate-transaction-chunks-async';

describe('generateTransactionChunksAsync', () => {
  it('should return the same results as the arweave-js implementation', async () => {
    const filePath = './test/fixtures/small-file.enc';

    const chunks = await pipeline(createReadStream(filePath), generateTransactionChunksAsync());

    const nativeGeneratedChunks = await readFile(filePath).then((data) => generateTransactionChunks(data));

    expect(chunks).toMatchObject(nativeGeneratedChunks);
  });

  it('should be able to generate chunks for files smaller than MIN_CHUNK_SIZE', async () => {
    const filePath = './test/fixtures/tiny-file.md';

    const chunks = await pipeline(createReadStream(filePath), generateTransactionChunksAsync());

    const nativeGeneratedChunks = await readFile(filePath).then((data) => generateTransactionChunks(data));

    expect(chunks).toMatchObject(nativeGeneratedChunks);
  });
});
