import { readChunkFromByteStream } from "src/utils";

export class DataItemHeader {
  signatureType: string;
  signature: string;
  owner: string;
  target?: string;
  anchor?: string;
  tags: [];

  headerByteLength: number;

  static async deserialize(header: AsyncIterable<Buffer>): Promise<DataItemHeader> {
    const signatureType = await readChunkFromByteStream(header, 2);
    const signature = await readChunkFromByteStream(header, 5000);

    const owner = 
  }

  async serialize(): Promise<Uint8Array> {}
}
