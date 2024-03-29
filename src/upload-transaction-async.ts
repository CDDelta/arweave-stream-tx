import Arweave from 'arweave';
import { MAX_CHUNK_SIZE, validatePath } from 'arweave/node/lib/merkle';
import Transaction from 'arweave/node/lib/transaction';
import { b64UrlToBuffer, bufferTob64Url } from 'arweave/node/lib/utils';
import { backOff } from 'exponential-backoff';
import { pipeline } from 'stream/promises';
import { chunker } from './common';

// Copied from `arweave-js`.
const FATAL_CHUNK_UPLOAD_ERRORS = [
  'invalid_json',
  'chunk_too_big',
  'data_path_too_big',
  'offset_too_big',
  'data_size_too_big',
  'chunk_proof_ratio_not_attractive',
  'invalid_proof',
];

interface ChunkUploadPayload {
  data_root: string;
  data_size: string;
  data_path: string;
  offset: string;
  chunk: string;
}

const MAX_CONCURRENT_CHUNK_UPLOAD_COUNT = 128;

/**
 * Uploads the piped data to the specified transaction.
 *
 * @param createTx whether or not the passed transaction should be created on the network.
 * This can be false if we want to reseed an existing transaction,
 */
export function uploadTransactionAsync(tx: Transaction, arweave: Arweave, createTx = true) {
  return async (source: AsyncIterable<Buffer>): Promise<void> => {
    if (!tx.chunks) {
      throw Error('Transaction has no computed chunks!');
    }

    if (createTx) {
      // Ensure the transaction data field is blank.
      // We'll upload this data in chunks instead.
      tx.data = new Uint8Array(0);

      const createTxRes = await arweave.api.post(`tx`, tx);
      if (!(createTxRes.status >= 200 && createTxRes.status < 300)) {
        throw new Error(`Failed to create transaction: ${createTxRes.data}`);
      }
    }

    const txChunkData = tx.chunks;
    const { chunks, proofs } = txChunkData;

    function prepareChunkUploadPayload(chunkIndex: number, chunkData: Buffer): ChunkUploadPayload {
      const proof = proofs[chunkIndex];
      return {
        data_root: tx.data_root,
        data_size: tx.data_size,
        data_path: bufferTob64Url(proof.proof),
        offset: proof.offset.toString(),
        chunk: bufferTob64Url(chunkData),
      };
    }

    await pipeline(source, chunker(MAX_CHUNK_SIZE, { flush: true }), async (chunkedSource: AsyncIterable<Buffer>) => {
      let chunkIndex = 0;
      let dataRebalancedIntoFinalChunk: Buffer | undefined;

      const activeChunkUploads: Promise<any>[] = [];

      for await (const chunkData of chunkedSource) {
        const currentChunk = chunks[chunkIndex];
        const chunkSize = currentChunk.maxByteRange - currentChunk.minByteRange;
        const expectedToBeFinalRebalancedChunk = dataRebalancedIntoFinalChunk != null;

        let chunkPayload: ChunkUploadPayload;

        if (chunkData.byteLength === chunkSize) {
          // If the transaction data chunks was never rebalanced this is the only code path that
          // will execute as the incoming chunked data as the will always be equivalent to `chunkSize`.
          chunkPayload = prepareChunkUploadPayload(chunkIndex, chunkData);
        } else if (chunkData.byteLength > chunkSize) {
          // If the incoming chunk data is larger than the expected size of the current chunk
          // it means that the transaction had chunks that were rebalanced to meet the minimum chunk size.
          //
          // It also means that the chunk we're currently processing should be the second to last
          // chunk.
          chunkPayload = prepareChunkUploadPayload(chunkIndex, chunkData.slice(0, chunkSize));
          dataRebalancedIntoFinalChunk = chunkData.slice(chunkSize);
        } else if (chunkData.byteLength < chunkSize && expectedToBeFinalRebalancedChunk) {
          // If this is the final rebalanced chunk, create the upload payload by concatenating the previous
          // chunk's data that was moved into this and the remaining stream data.
          chunkPayload = prepareChunkUploadPayload(
            chunkIndex,
            Buffer.concat(
              [dataRebalancedIntoFinalChunk!, chunkData],
              dataRebalancedIntoFinalChunk!.length + chunkData.length,
            ),
          );
        } else {
          throw Error('Transaction data stream terminated incorrectly.');
        }

        const chunkValid = await validatePath(
          txChunkData.data_root,
          parseInt(chunkPayload.offset),
          0,
          parseInt(chunkPayload.data_size),
          b64UrlToBuffer(chunkPayload.data_path),
        );

        if (!chunkValid) {
          throw new Error(`Unable to validate chunk ${chunkIndex}.`);
        }

        // Upload multiple transaction chunks in parallel to speed up the upload.

        // If we are already at the maximum concurrent chunk upload limit,
        // wait till all of them to complete first before continuing.
        if (activeChunkUploads.length >= MAX_CONCURRENT_CHUNK_UPLOAD_COUNT) {
          await Promise.all(activeChunkUploads);
          // Clear the active chunk uploads array.
          activeChunkUploads.length = 0;
        }

        activeChunkUploads.push(
          backOff(() => arweave.api.post('chunk', chunkPayload), {
            retry: (err) => !FATAL_CHUNK_UPLOAD_ERRORS.includes(err.message),
          }),
        );

        chunkIndex++;
      }

      await Promise.all(activeChunkUploads);

      if (chunkIndex < chunks.length) {
        throw Error(`Transaction upload incomplete: ${chunkIndex + 1}/${chunks.length} chunks uploaded.`);
      }
    });
  };
}
