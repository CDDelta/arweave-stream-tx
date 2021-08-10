import Arweave from 'arweave';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { generateTransactionChunksAsync } from './generate-transaction-chunks-async';
import { uploadTransactionAsync } from './upload-transaction-async';

describe('uploadTransactionAsync', () => {
  const arweave = new Arweave({
    host: 'arweave.net',
    protocol: 'https',
    port: 443,
    logging: false,
    timeout: 15000,
  });

  it('should successfully seed existing small transactions', async () => {
    jest.setTimeout(15 * 1000);

    const existingTxId = '0dfg6H6aNXX0w_RswU_pshG20qFs0dsOypcf-V1VDYk';
    const tx = await arweave.transactions.get(existingTxId);
    const txData = (await arweave.transactions.getData(existingTxId, {
      decode: true,
    })) as Uint8Array;

    await tx.prepareChunks(txData);

    const txDataStream = new Readable({
      read() {
        this.push(txData);
        this.push(null);
      },
    });

    const uploadOp = pipeline(txDataStream, uploadTransactionAsync(tx, arweave, false));

    await expect(uploadOp).resolves.not.toThrow();
  });

  it('should successfully seed existing large transaction', async () => {
    jest.setTimeout(120 * 1000);

    const existingTxId = 'vw1HlPla-_VLM3vz4qNj_TqEXdMk17DXU1NvHTxptE4';
    const txDataFilePath = './test/fixtures/vw1HlPla-_VLM3vz4qNj_TqEXdMk17DXU1NvHTxptE4';

    const tx = await arweave.transactions.get(existingTxId);

    const txDataStreamForChunks = createReadStream(txDataFilePath);
    tx.chunks = await pipeline(txDataStreamForChunks, generateTransactionChunksAsync());

    const txDataStreamForUpload = createReadStream(txDataFilePath);
    const uploadOp = pipeline(txDataStreamForUpload, uploadTransactionAsync(tx, arweave, false));

    await expect(uploadOp).resolves.not.toThrow();
  });

  it.skip('should error when provided invalid data', async () => {
    jest.setTimeout(15 * 1000);

    const existingTxId = '0dfg6H6aNXX0w_RswU_pshG20qFs0dsOypcf-V1VDYk';
    const tx = await arweave.transactions.get(existingTxId);
    const txData = (await arweave.transactions.getData(existingTxId, {
      decode: true,
    })) as Uint8Array;

    await tx.prepareChunks(txData);

    txData.fill(0, 0, 126);

    const txDataStream = new Readable({
      read() {
        this.push(txData);
        this.push(null);
      },
    });

    const uploadOp = pipeline(txDataStream, uploadTransactionAsync(tx, arweave, false));
    await expect(uploadOp).rejects.toBeDefined();
  });
});
