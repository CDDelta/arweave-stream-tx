import { randomBytes } from 'crypto';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { ChunkBuffer, chunker } from './chunker';

describe('ChunkBuffer', () => {
  test('should be able to chunk a single buffer', () => {
    const chunkBuffer = new ChunkBuffer();
    const data = randomBytes(32);
    chunkBuffer.push(data);

    expect(chunkBuffer.pop(8)).toEqual(data.slice(0, 8));
    expect(chunkBuffer.pop(8)).toEqual(data.slice(8, 16));
    expect(chunkBuffer.pop(16)).toEqual(data.slice(16, 32));
    expect(chunkBuffer.flush()).toEqual(Buffer.alloc(0));
  });

  test('should be able to chunk multiple aligned buffers', () => {
    const chunkBuffer = new ChunkBuffer();
    const data = randomBytes(32);
    chunkBuffer.push(data.slice(0, 16));
    chunkBuffer.push(data.slice(16, 32));

    expect(chunkBuffer.pop(16)).toEqual(data.slice(0, 16));
    expect(chunkBuffer.pop(16)).toEqual(data.slice(16, 32));
    expect(chunkBuffer.flush()).toEqual(Buffer.alloc(0));
  });

  test('should be able to chunk multiple unaligned buffers', () => {
    const chunkBuffer = new ChunkBuffer();
    const data = randomBytes(32);
    chunkBuffer.push(data.slice(0, 16));
    chunkBuffer.push(data.slice(16, 32));

    expect(chunkBuffer.pop(8)).toEqual(data.slice(0, 8));
    expect(chunkBuffer.pop(7)).toEqual(data.slice(8, 15));
    expect(chunkBuffer.pop(12)).toEqual(data.slice(15, 27));
    expect(chunkBuffer.flush()).toEqual(data.slice(27, 32));
  });
});

describe('chunker', () => {
  const dataPath = './test/fixtures/vw1HlPla-_VLM3vz4qNj_TqEXdMk17DXU1NvHTxptE4';

  test('should be able to chunk stream without flushing', async () => {
    const data = randomBytes(1026);
    const chunks = await pipeline(bufferToStream(data), chunker(256, { flush: false }), asyncIterableToArray<Buffer>());
    expect(chunks).toEqual([data.slice(0, 256), data.slice(256, 512), data.slice(512, 768), data.slice(768, 1024)]);
  });

  test('should be able to chunk stream and flush at the end', async () => {
    const data = randomBytes(1026);
    const chunks = await pipeline(bufferToStream(data), chunker(256, { flush: true }), asyncIterableToArray<Buffer>());
    expect(chunks).toEqual([
      data.slice(0, 256),
      data.slice(256, 512),
      data.slice(512, 768),
      data.slice(768, 1024),
      data.slice(1024, 1026),
    ]);
  });

  test('should not flush with empty buffer at end of stream', async () => {
    const data = randomBytes(1024);
    const chunks = await pipeline(bufferToStream(data), chunker(256, { flush: true }), asyncIterableToArray<Buffer>());
    expect(chunks).toEqual([data.slice(0, 256), data.slice(256, 512), data.slice(512, 768), data.slice(768, 1024)]);
  });
});

function asyncIterableToArray<T>() {
  return async (iterable: AsyncIterable<T>): Promise<T[]> => {
    const array: T[] = [];
    for await (const item of iterable) {
      array.push(item);
    }
    return array;
  };
}

function bufferToStream(buffer: Buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}
