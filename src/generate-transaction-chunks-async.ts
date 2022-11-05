import Arweave from 'arweave';
import {
  buildLayers,
  Chunk,
  generateLeaves,
  generateProofs,
  MAX_CHUNK_SIZE,
  MIN_CHUNK_SIZE
} from 'arweave/node/lib/merkle';
import Transaction from 'arweave/node/lib/transaction';
import chunker from 'stream-chunker';
import { pipeline } from 'stream/promises';

/**
 * Generates the Arweave transaction chunk information from the piped data stream.
 */
export function generateTransactionChunksAsync() {
  return async (source: AsyncIterable<Buffer>): Promise<NonNullable<Transaction['chunks']>> => {
    const chunks: Chunk[] = [];

    /**
     * @param chunkByteIndex the index the start of the specified chunk is located at within its original data stream.
     */
    async function addChunk(chunkByteIndex: number, chunk: Buffer): Promise<Chunk> {
      const dataHash = await Arweave.crypto.hash(chunk);

      const chunkRep = {
        dataHash,
        minByteRange: chunkByteIndex,
        maxByteRange: chunkByteIndex + chunk.byteLength,
      };

      chunks.push(chunkRep);

      return chunkRep;
    }

    let chunkStreamByteIndex = 0;
    let previousDataChunk: Buffer | undefined;
    let expectChunkGenerationCompleted = false;

    await pipeline(
      source,
      chunker(MAX_CHUNK_SIZE, { flush: true }),
      async function (chunkedSource: AsyncIterable<Buffer>) {
        for await (const volatileChunk of chunkedSource) {
          async function processChunk(chunk: Buffer) {
            if (expectChunkGenerationCompleted) {
              throw Error('Expected chunk generation to have completed.');
            }
  
            if (chunk.byteLength >= MIN_CHUNK_SIZE && chunk.byteLength <= MAX_CHUNK_SIZE) {
              await addChunk(chunkStreamByteIndex, chunk);
            } else if (chunk.byteLength < MIN_CHUNK_SIZE) {
              if (previousDataChunk) {
                // If this final chunk is smaller than the minimum chunk size, rebalance this final chunk and
                // the previous chunk to keep the final chunk size above the minimum threshold.
                const remainingBytes = Buffer.concat(
                  [previousDataChunk, chunk],
                  previousDataChunk.byteLength + chunk.byteLength,
                );
                const rebalancedSizeForPreviousChunk = Math.ceil(remainingBytes.byteLength / 2);
  
                const previousChunk = chunks.pop()!;
                const rebalancedPreviousChunk = await addChunk(
                  previousChunk.minByteRange,
                  remainingBytes.slice(0, rebalancedSizeForPreviousChunk),
                );
  
                await addChunk(
                  rebalancedPreviousChunk.maxByteRange,
                  remainingBytes.slice(rebalancedSizeForPreviousChunk),
                );
              } else {
                // This entire stream should be smaller than the minimum chunk size, just add the chunk in.
                await addChunk(chunkStreamByteIndex, chunk);
              }
  
              expectChunkGenerationCompleted = true;
            } else if (chunk.byteLength > MAX_CHUNK_SIZE) {
              // This can happen when the read stream is flushed
              // In this case, process the head chunk and recurse through the tail
              const chunkHead = chunk.slice(0, MAX_CHUNK_SIZE)
              await processChunk(chunkHead);
              const chunkTail = chunk.slice(MAX_CHUNK_SIZE)
              await processChunk(chunkTail);
              // The rest of the function should not be called for oversized chunks
              return;
            }
  
            chunkStreamByteIndex += chunk.byteLength;
            previousDataChunk = chunk;
          }
          processChunk(volatileChunk);
        }
      },
    );

    const leaves = await generateLeaves(chunks);
    const root = await buildLayers(leaves);
    const proofs = generateProofs(root);

    return {
      data_root: root.id,
      chunks,
      proofs,
    };
  };
}
