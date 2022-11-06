import { randomBytes } from 'crypto';
import { ChunkBuffer } from './chunker';

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
