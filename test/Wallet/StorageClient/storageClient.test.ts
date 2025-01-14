/* eslint-disable @typescript-eslint/no-unused-vars */
import * as bsv from '@bsv/sdk'
import { sdk, StorageClient } from '../../../src'
import { _tu, expectToThrowWERR, TestWalletNoSetup } from '../../utils/TestUtilsWalletStorage'

const noLog = false

describe('walletStorageClient test', () => {
    jest.setTimeout(99999999)

    const env = _tu.getEnv('test')
    const testName = () => expect.getState().currentTestName || 'test'

    const ctxs: TestWalletNoSetup[] = []

    beforeAll(async () => {
        ctxs.push(await _tu.createLegacyWalletSQLiteCopy('walletStorageClient'))
        _tu.mockPostServicesAsSuccess(ctxs)
    })

    afterAll(async () => {
        for (const ctx of ctxs) {
            await ctx.storage.destroy()
        }
    })

    test('1_backup to client', async () => {
        for (const { wallet, storage } of ctxs) {
            {
                const client = new StorageClient(wallet as unknown as bsv.Wallet, 'https://staging-dojo.babbage.systems')
                const s = await client.makeAvailable()
                storage.stores.push(client)
                await storage.updateBackups()
            }
        }
    })
})