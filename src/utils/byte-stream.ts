export async function readChunkFromByteStream(
  byteStream: ReadableStreamReader<Uint8Array>,
  byteLength: number,
): Promise<Buffer> {
  const bytes = Buffer.alloc(byteLength);
  for (let i = 0; i < byteLength; i++) {
    byteStream.getReader();
    const byte = await byteStream.next();
    bytes.writeUInt8(byte.value.readUInt8(), i);
  }
  return bytes;
}

/** Reads an unsigned, little endian of `byteLength` bytes long from the provided byte stream. */
export async function readBigUIntLEFromByteStream(
  byteStream: AsyncGenerator<Buffer, Buffer>,
  byteLength: number,
): Promise<bigint> {
  const chunk = await readChunkFromByteStream(byteStream, byteLength);
  let value = 0n;
  for (let i = chunk.byteLength - 1; i >= 0; i--) {
    const byte = chunk.readUInt8(i);
    value = value * 256n + BigInt(byte);
  }
  return value;
}
