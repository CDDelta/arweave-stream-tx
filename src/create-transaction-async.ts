import Arweave from 'arweave';
import { CreateTransactionInterface } from 'arweave/node/common';
import Transaction, { TransactionInterface } from 'arweave/node/lib/transaction';
import { bufferTob64Url } from 'arweave/node/lib/utils';
import { JWKInterface } from 'arweave/node/lib/wallet';
import { pipeline } from 'stream/promises';
import { generateTransactionChunksAsync } from './generate-transaction-chunks-async';

/**
 * Creates an Arweave transaction from the piped data stream.
 */
export function createTransactionAsync(
  attributes: Partial<Omit<CreateTransactionInterface, 'data'>>,
  arweave: Arweave,
  jwk: JWKInterface | null | undefined,
) {
  return async (source: AsyncIterable<Buffer>): Promise<Transaction> => {
    const chunks = await pipeline(source, generateTransactionChunksAsync());

    const txAttrs = Object.assign({}, attributes);

    txAttrs.owner ??= jwk?.n;
    txAttrs.last_tx ??= await arweave.transactions.getTransactionAnchor();

    const lastChunk = chunks.chunks[chunks.chunks.length - 1];
    const dataByteLength = lastChunk.maxByteRange;

    txAttrs.reward ??= await arweave.transactions.getPrice(dataByteLength, txAttrs.target);

    txAttrs.data_size = dataByteLength.toString();

    const tx = new Transaction(txAttrs as TransactionInterface);

    tx.chunks = chunks;
    tx.data_root = bufferTob64Url(chunks.data_root);

    return tx;
  };
}
