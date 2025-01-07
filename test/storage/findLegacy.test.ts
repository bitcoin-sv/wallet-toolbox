import { _tu, TestSetup1, TestWalletNoSetup } from '../utils/TestUtilsWalletStorage'
import { randomBytesBase64, randomBytesHex, sdk, StorageBase, StorageKnex, table  } from "../../src"

describe('find tests', () => {
    jest.setTimeout(99999999)

    const env = _tu.getEnv('test')
    const ctxs: TestWalletNoSetup[] = []

    beforeAll(async () => {
        if (!env.noMySQL)
            ctxs.push(await _tu.createLegacyWalletMySQLCopy('abortActionTests'));
        ctxs.push(await _tu.createLegacyWalletSQLiteCopy('abortActionTests'))
    })

    afterAll(async () => {
        for (const ctx of ctxs) {
            await ctx.storage.destroy()
        }
    })


    test('0 find ProvenTx', async () => {
        for (const { storage } of ctxs) {
        }
    })

    test('1 find ProvenTxReq', async () => {
        for (const { storage } of ctxs) {
        }
    })

    test('2 find User', async () => {
    })

    test('3 find Certificate', async () => {
    })

    test('4 find CertificateField', async () => {
    })

    test('5 find OutputBasket', async () => {
    })

    test('6 find Transaction', async () => {
    })

    test('7 find Commission', async () => {
    })

    test('8 find Output', async () => {
        for (const { storage } of ctxs) {
            {
                const r = await storage.findOutputs({ partial: { userId: 1, basketId: 1 }, txStatus: ['sending'] })
                expect(r.length).toBe(1)
                expect(r[0].outputId).toBe(497)
            }
        }
    })

    test('9 find OutputTag', async () => {
    })

    test('10 find OutputTagMap', async () => {
    })
    
    test('11 find TxLabel', async () => {
    })

    test('12 find TxLabelMap', async () => {
    })

    test('13 find WatchmanEvent', async () => {
    })

    test('14 find SyncState', async () => {
    })
})