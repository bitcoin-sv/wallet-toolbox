import { Transaction, WalletOutput } from '@bsv/sdk'
import {
  sdk,
  Services,
  Setup,
  StorageKnex,
  TableOutput,
  TableTransaction,
  TableUser,
  verifyOne,
  verifyOneOrNone
} from '../../../src'
import { _tu, TuEnv } from '../../utils/TestUtilsWalletStorage'
import { specOpInvalidChange, ValidListOutputsArgs } from '../../../src/sdk'
import { LocalWalletTestOptions } from '../../utils/localWalletMethods'

import * as dotenv from 'dotenv'
dotenv.config()

const chain: sdk.Chain = 'main'

const options: LocalWalletTestOptions = {
  setActiveClient: true,
  useMySQLConnectionForClient: true,
  useTestIdentityKey: false,
  useIdentityKey2: false
}

describe('operations.man tests', () => {
  jest.setTimeout(99999999)

  test('0 review and release all production invalid change utxos', async () => {
    const { env, storage } = await createMainReviewSetup()
    const users = await storage.findUsers({ partial: {} })
    const withInvalid: Record<number, { user: TableUser; outputs: WalletOutput[]; total: number }> = {}
    const vargs: ValidListOutputsArgs = {
      basket: specOpInvalidChange,
      tags: ['release'],
      tagQueryMode: 'all',
      includeLockingScripts: false,
      includeTransactions: false,
      includeCustomInstructions: false,
      includeTags: false,
      includeLabels: false,
      limit: 0,
      offset: 0,
      seekPermission: false,
      knownTxids: []
    }
    let log = ''
    for (const user of users) {
      const { userId } = user
      const auth = { userId, identityKey: '' }
      let r = await storage.listOutputs(auth, vargs)
      if (r.totalOutputs > 0) {
        const total: number = r.outputs.reduce((s, o) => (s += o.satoshis), 0)
        let l = `userId ${userId}: ${r.totalOutputs} utxos updated, total ${total}, ${user.identityKey}\n`
        for (const o of r.outputs) {
          l += `  ${o.outpoint} ${o.satoshis} now ${o.spendable ? 'spendable' : 'spent'}\n`
        }
        console.log(l)
        log += l
        withInvalid[userId] = { user, outputs: r.outputs, total }
      }
    }
    console.log(log || 'Found zero invalid change outputs.')
    await storage.destroy()
  })

  test.skip('0a review all spendable outputs for userId', async () => {
    const { env, storage } = await createMainReviewSetup()
    const users = await storage.findUsers({ partial: {} })
    const withInvalid: Record<number, { user: TableUser; outputs: WalletOutput[]; total: number }> = {}
    const vargs: ValidListOutputsArgs = {
      basket: specOpInvalidChange,
      tags: ['release', 'all'],
      tagQueryMode: 'all',
      includeLockingScripts: false,
      includeTransactions: false,
      includeCustomInstructions: false,
      includeTags: false,
      includeLabels: false,
      limit: 0,
      offset: 0,
      seekPermission: false,
      knownTxids: []
    }
    let log = ''
    for (const user of users) {
      const { userId } = user
      const auth = { userId, identityKey: '' }
      let r = await storage.listOutputs(auth, vargs)
      if (r.totalOutputs > 0) {
        const total: number = r.outputs.reduce((s, o) => (s += o.satoshis), 0)
        log += `userId ${userId}: ${r.totalOutputs} unspendable utxos, total ${total}, ${user.identityKey}\n`
        for (const o of r.outputs) {
          log += `  ${o.outpoint} ${o.satoshis}\n`
        }
        withInvalid[userId] = { user, outputs: r.outputs, total }
      }
    }
    console.log(log || 'Found zero invalid change outputs.')
    await storage.destroy()
  })

  test('1 review and unfail false doubleSpends', async () => {
    const { env, storage, services } = await createMainReviewSetup()
    let offset = 2400
    const limit = 100
    let allUnfails: number[] = []
    for (;;) {
      let log = ''
      const unfails: number[] = []
      const reqs = await storage.findProvenTxReqs({ partial: { status: 'doubleSpend' }, paged: { limit, offset } })
      for (const req of reqs) {
        const gsr = await services.getStatusForTxids([req.txid])
        if (gsr.results[0].status !== 'unknown') {
          log += `unfail ${req.provenTxReqId} ${req.txid}\n`
          unfails.push(req.provenTxReqId)
        }
      }
      console.log(`DoubleSpends OFFSET: ${offset} ${unfails.length} unfails\n${log}`)
      allUnfails = allUnfails.concat(unfails)
      if (reqs.length < limit) break
      offset += reqs.length
    }
    for (const id of allUnfails) {
      await storage.updateProvenTxReq(id, { status: 'unfail' })
    }
    await storage.destroy()
  })

  test('2 review and unfail false invalids', async () => {
    const { env, storage, services } = await createMainReviewSetup()
    let offset = 700
    const limit = 100
    let allUnfails: number[] = []
    for (;;) {
      let log = ''
      const unfails: number[] = []
      const reqs = await storage.findProvenTxReqs({ partial: { status: 'invalid' }, paged: { limit, offset } })
      for (const req of reqs) {
        if (!req.txid || !req.rawTx) continue
        const gsr = await services.getStatusForTxids([req.txid])
        if (gsr.results[0].status !== 'unknown') {
          log += `unfail ${req.provenTxReqId} ${req.txid}\n`
          unfails.push(req.provenTxReqId)
        }
      }
      console.log(`Failed OFFSET: ${offset} ${unfails.length} unfails\n${log}`)
      allUnfails = allUnfails.concat(unfails)
      if (reqs.length < limit) break
      offset += reqs.length
    }
    for (const id of allUnfails) {
      await storage.updateProvenTxReq(id, { status: 'unfail' })
    }
    await storage.destroy()
  })

  test.skip('8 re-internalize failed WUI exports', async () => {
    const { env, storage, services } = await createMainReviewSetup()
    const user0 = verifyOne(await storage.findUsers({ partial: { userId: 2 } }))
    const users = await storage.findUsers({ partial: { userId: 141 } }) // 111, 141
    for (const user of users) {
      const { userId, identityKey } = user
      const [outputs] = await storage.knex.raw<TableOutput[][]>(`
        SELECT f.* FROM outputs as f where f.userId = 2 and not f.customInstructions is null
        and JSON_EXTRACT(f.customInstructions, '$.payee') = '${identityKey}'
        and not exists(select * from outputs as r where r.userId = ${userId} and r.txid = f.txid)
        `)
      if (outputs.length > 0) console.log(`userId ${userId} ${identityKey} ${outputs.length} outputs`)
      for (const output of outputs) {
        const req = verifyOneOrNone(
          await storage.findProvenTxReqs({ partial: { txid: output.txid, status: 'completed' } })
        )
        const { type, derivationPrefix, derivationSuffix, payee } = JSON.parse(output.customInstructions!)
        if (req && type === 'BRC29' && derivationPrefix && derivationSuffix) {
          const beef = await storage.getBeefForTransaction(req.txid, {})
          // {"type":"BRC29","derivationPrefix":"LDFooHSsXzw=","derivationSuffix":"4f4ixKv+6SY=","payee":"0352caa755d5b6279e15e47e096db908e7c4a73a31775e7e8720bdd4cf2d44873a"}
          await storage.internalizeAction(
            { userId, identityKey: user.identityKey },
            {
              tx: beef.toBinaryAtomic(req.txid),
              outputs: [
                {
                  outputIndex: 0,
                  protocol: 'wallet payment',
                  paymentRemittance: {
                    derivationPrefix: derivationPrefix,
                    derivationSuffix: derivationSuffix,
                    senderIdentityKey: user0.identityKey
                  }
                }
              ],
              description: 'Internalizing export funds tx into foreign wallet'
            }
          )
          console.log('internalize', userId, output.txid)
        }
      }
    }
    /*
     */
    await storage.destroy()
  })
  test('9 review recent transaction change use', async () => {
    const { env, storage, services } = await createMainReviewSetup()
    const countTxs = await storage.countTransactions({
      partial: { userId: 311 },
      status: ['completed', 'unproven', 'failed']
    })
    const txs = await storage.findTransactions({
      partial: { userId: 311 },
      status: ['unproven', 'completed', 'failed'],
      paged: { limit: 100, offset: Math.max(0, countTxs - 100) }
    })
    for (const tx of txs) {
      const ls = await toLogString(tx, storage)
      console.log(ls)
    }
    const countReqs = await storage.countProvenTxReqs({ partial: {}, status: ['completed', 'unmined'] })
    const reqs = await storage.findProvenTxReqs({
      partial: {},
      status: ['unmined', 'completed'],
      paged: { limit: 100, offset: countReqs - 100 }
    })
    await storage.destroy()
  })
})

async function createMainReviewSetup(): Promise<{
  env: TuEnv
  storage: StorageKnex
  services: Services
}> {
  const env = _tu.getEnv('main')
  const knex = Setup.createMySQLKnex(process.env.MAIN_CLOUD_MYSQL_CONNECTION!)
  const storage = new StorageKnex({
    chain: env.chain,
    knex: knex,
    commissionSatoshis: 0,
    commissionPubKeyHex: undefined,
    feeModel: { model: 'sat/kb', value: 1 }
  })
  const servicesOptions = Services.createDefaultOptions(env.chain)
  if (env.whatsonchainApiKey) servicesOptions.whatsOnChainApiKey = env.whatsonchainApiKey
  const services = new Services(servicesOptions)
  storage.setServices(services)
  await storage.makeAvailable()
  return { env, storage, services }
}

async function toLogString(tx: TableTransaction, storage: StorageKnex): Promise<string> {
  const rawTx = await storage.getRawTxOfKnownValidTransaction(tx.txid)
  const btx = Transaction.fromBinary(rawTx!)
  let log = `tx ${tx.txid} ${tx.status} s:${tx.satoshis} uid:${tx.userId} tid:${tx.transactionId}\n`
  for (let i = 0; i < Math.max(btx.inputs.length, btx.outputs.length); i++) {
    let ilog: string = ''
    let olog: string = ''
    if (i < btx.inputs.length) {
      const input = btx.inputs[i]
      ilog = `${logTxid(input.sourceTXID!)}.${input.sourceOutputIndex}`
    }
    if (i < btx.outputs.length) {
      const output = btx.outputs[i]
      olog = `${ar('' + output.satoshis, 9)} ${output.lockingScript.toHex().length / 2}`
    }
    log += `${ar('' + i, 5)} ${al(ilog, 20)} ${olog}\n`
  }
  return log

  function logTxid(txid: string): string {
    return `${txid.slice(0, 6)}..${txid.slice(-6)}`
  }
  function al(v: string | number, w: number): string {
    return v.toString().padEnd(w)
  }
  function ar(v: string | number, w: number): string {
    return v.toString().padStart(w)
  }
}
