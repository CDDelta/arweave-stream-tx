import { bufferTob64Url } from 'arweave/node/lib/utils';
import { readBigUIntLEFromByteStream, readChunkFromByteStream } from 'src/utils';

export class DataBundleHeader {
  constructor(public readonly dataItemOffsets: Map<string, bigint>) {}

  static async deserialize(header: AsyncIterable<Buffer>): Promise<DataBundleHeader> {
    const dataItemOffsets = new Map<string, bigint>();
    for await (const [itemId, itemOffset] of this.deserializeAsync(header)) {
      dataItemOffsets.set(itemId, itemOffset);
    }
    return new DataBundleHeader(dataItemOffsets);
  }

  static async *deserializeAsync(header: AsyncIterable<Buffer>): AsyncGenerator<[string, bigint], void, unknown> {
    const dataItemCount = await readBigUIntLEFromByteStream(header, 32);

    for (let i = 0; i < dataItemCount; i++) {
      const itemOffset = await readBigUIntLEFromByteStream(header, 32);
      const itemId = await readChunkFromByteStream(header, 32);
      yield [bufferTob64Url(itemId), itemOffset];
    }
  }
}
