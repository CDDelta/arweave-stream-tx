import Arweave from 'arweave';
import { CreateTransactionInterface } from 'arweave/node/common';
import { JWKInterface } from 'arweave/node/lib/wallet';
import { createReadStream } from 'fs';
import { readFile } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { createTransactionAsync } from './create-transaction-async';

describe('createTransactionAsync', () => {
  let wallet: JWKInterface;

  beforeAll(async () => {
    wallet = await arweave.wallets.generate();
  });

  const arweave = new Arweave({
    host: 'arweave.net',
    protocol: 'https',
    port: 443,
    logging: false,
    timeout: 15000,
  });

  it('should successfully create a transactions', async () => {
    const filePath = './test/fixtures/small-file.enc';
    const fileStream = createReadStream(filePath);

    const tx = await pipeline(fileStream, createTransactionAsync({}, arweave, wallet));
    expect(tx.last_tx).toBeTruthy();
    expect(tx.owner).toBeTruthy();

    expect(BigInt(tx.reward)).toBeGreaterThan(0);
    expect(BigInt(tx.data_size)).toBeGreaterThan(0);

    expect(tx.chunks).toBeTruthy();
    expect(tx.data_root).toBeTruthy();

    await arweave.transactions.sign(tx, wallet);
    expect(arweave.transactions.verify(tx)).resolves.toBe(true);
  });

  it('should create transactions that match arweave-js', async () => {
    const filePath = './test/fixtures/small-file.enc';
    const fileStream = createReadStream(filePath);

    const txAttrs = <Partial<CreateTransactionInterface>>{
      last_tx: 'MOCK_TX_ID',
      reward: '1',
    };

    const nativeTx = await arweave.createTransaction({ ...txAttrs, data: await readFile(filePath) }, wallet);
    await arweave.transactions.sign(nativeTx, wallet);

    const tx = await pipeline(fileStream, createTransactionAsync(txAttrs, arweave, wallet));
    await arweave.transactions.sign(tx, wallet);

    // Reset the data field from the `arweave-js` transaction as streamed transactions will not have this field.
    nativeTx.data = new Uint8Array(0);

    // Ignore the id and signature of the native transaction when comparing to our implementation.
    const { id: nativeTxId, signature: nativeTxSignature, ...nativeTxSubset } = nativeTx;
    expect(tx).toMatchObject(nativeTxSubset);

    expect(arweave.transactions.verify(tx)).resolves.toBeTruthy();
  });
});
