import { generateTransactionChunks, MAX_CHUNK_SIZE, MIN_CHUNK_SIZE } from 'arweave/node/lib/merkle';
import { createReadStream, existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { ReadableStreamBuffer } from 'stream-buffers';
import { pipeline } from 'stream/promises';
import { promisify } from 'util';
import { generateTransactionChunksAsync } from './generate-transaction-chunks-async';

const exec = promisify(require('child_process').exec);

describe('generateTransactionChunksAsync', () => {
  it('should return the same results as the arweave-js implementation', async () => {
    const filePath = './test/fixtures/small-file.enc';

    const chunks = await pipeline(createReadStream(filePath), generateTransactionChunksAsync());
    const nativeGeneratedChunks = await readFile(filePath).then((data) => generateTransactionChunks(data));

    expect(chunks).toMatchObject(nativeGeneratedChunks);
  });

  it('should balance chunks for data with a chunk smaller than MIN_CHUNK_SIZE correctly', async () => {
    const data = Buffer.alloc(MAX_CHUNK_SIZE * 2 + MIN_CHUNK_SIZE - 1);
    const dataStream = new ReadableStreamBuffer({
      frequency: 10,
      chunkSize: MIN_CHUNK_SIZE,
    });

    dataStream.put(data);
    dataStream.stop();

    const chunks = await pipeline(dataStream, generateTransactionChunksAsync());
    const nativeGeneratedChunks = await generateTransactionChunks(data);

    expect(chunks).toMatchObject(nativeGeneratedChunks);
  });

  it('should be able to generate chunks for files smaller than MIN_CHUNK_SIZE', async () => {
    const filePath = './test/fixtures/tiny-file.md';

    const chunks = await pipeline(createReadStream(filePath), generateTransactionChunksAsync());
    const nativeGeneratedChunks = await readFile(filePath).then((data) => generateTransactionChunks(data));

    expect(chunks).toMatchObject(nativeGeneratedChunks);
  });

  it('should be able to generate chunks for really large files', async () => {
    jest.setTimeout(60 * 1000);

    const filePath = './test/fixtures/large-file.bin';
    if (!existsSync(filePath)) {
      await exec(`fallocate -l 5G ${filePath}`);
    }

    const chunks = await pipeline(createReadStream(filePath), generateTransactionChunksAsync());

    expect(chunks.data_root).toBeTruthy();
  });
});
