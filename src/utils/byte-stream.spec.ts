import { createReadStream } from 'fs';
import { ReadableStreamBuffer } from 'stream-buffers';
import chunker from 'stream-chunker';
import { pipeline } from 'stream/promises';
import { readBigUIntLEFromByteStream } from '.';

describe('readBigUIntFromByteStream', () => {
  it('should read a unsigned big ints from a byte stream correctly', async () => {
    const data = Buffer.alloc(64);
    data.writeUInt8(15, 0);
    data.writeUInt8(1, 32);

    const byteStream = new ReadableStreamBuffer({
      frequency: 10,
      chunkSize: 1,
    });

    byteStream.put(data);
    byteStream.stop();

    /*await pipeline(byteStream, async function (source: AsyncGenerator<Buffer, Buffer>) {
      expect(readBigUIntLEFromByteStream(source, 32)).resolves.toBe(15n);
      expect(readBigUIntLEFromByteStream(source, 32)).resolves.toBe(1n);
    });*/
  });

  it('should read a unsigned big ints from a byte stream correctly', async () => {
    const bundlePath = './test/fixtures/mHCkMbR4-XTB8rWMeEjQyCmIw0vZSJqGg8-DXJYg2Eo';
    const bundleStream = createReadStream(bundlePath, { encoding: 'binary' });

    await pipeline(bundleStream, chunker(1), async function (source: AsyncGenerator<Buffer, Buffer>) {
      await expect(readBigUIntLEFromByteStream(source, 32)).resolves.toBe(1n);
    });
  });
});
