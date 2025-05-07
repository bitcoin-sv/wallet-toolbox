import {
  Transaction,
  AbortActionResult,
  Beef,
  InternalizeActionArgs,
  InternalizeActionResult,
  ListActionsResult,
  ListOutputsResult,
  PubKeyHex,
  ListCertificatesResult,
  TrustSelf,
  RelinquishCertificateArgs,
  RelinquishOutputArgs,
  AbortActionArgs
} from '@bsv/sdk'
import {
  TableCertificateX,
  TableMonitorEvent,
  TableOutput,
  TableOutputBasket,
  TableOutputTag,
  TableOutputX,
  TableProvenTxReq,
  TableProvenTxReqDynamics,
  TableTransaction,
  TableTxLabel,
} from './schema/tables'
import {
  verifyId,
  verifyOne,
  verifyOneOrNone,
  verifyTruthy } from '../utility/utilityHelpers'
import * as sdk from '../sdk/index'
import { asArray, asString } from '../utility/utilityHelpers.noBuffer'
import { getBeefForTransaction } from './methods/getBeefForTransaction'
import { GetReqsAndBeefDetail, GetReqsAndBeefResult, processAction } from './methods/processAction'
import { attemptToPostReqsToNetwork, PostReqsToNetworkResult } from './methods/attemptToPostReqsToNetwork'
import { listCertificates } from './methods/listCertificates'
import { createAction } from './methods/createAction'
import { internalizeAction } from './methods/internalizeAction'
import { StorageReaderWriter, StorageReaderWriterOptions } from './StorageReaderWriter'
import { EntityProvenTx, EntityProvenTxReq, EntitySyncState, EntityTransaction } from './schema/entities'

export abstract class StorageProvider extends StorageReaderWriter implements sdk.WalletStorageProvider {
  isDirty = false
  _services?: sdk.WalletServices
  feeModel: sdk.StorageFeeModel
  commissionSatoshis: number
  commissionPubKeyHex?: PubKeyHex
  maxRecursionDepth?: number

  static defaultOptions() {
    return {
      feeModel: <sdk.StorageFeeModel>{ model: 'sat/kb', value: 1 },
      commissionSatoshis: 0,
      commissionPubKeyHex: undefined
    }
  }

  static createStorageBaseOptions(chain: sdk.Chain): StorageProviderOptions {
    const options: StorageProviderOptions = {
      ...StorageProvider.defaultOptions(),
      chain
    }
    return options
  }

  constructor(options: StorageProviderOptions) {
    super(options)
    this.feeModel = options.feeModel
    this.commissionPubKeyHex = options.commissionPubKeyHex
    this.commissionSatoshis = options.commissionSatoshis
  }

  abstract reviewStatus(args: { agedLimit: Date; trx?: sdk.TrxToken }): Promise<{ log: string }>

  abstract purgeData(params: sdk.PurgeParams, trx?: sdk.TrxToken): Promise<sdk.PurgeResults>

  abstract allocateChangeInput(
    userId: number,
    basketId: number,
    targetSatoshis: number,
    exactSatoshis: number | undefined,
    excludeSending: boolean,
    transactionId: number
  ): Promise<TableOutput | undefined>

  abstract getProvenOrRawTx(txid: string, trx?: sdk.TrxToken): Promise<sdk.ProvenOrRawTx>
  abstract getRawTxOfKnownValidTransaction(
    txid?: string,
    offset?: number,
    length?: number,
    trx?: sdk.TrxToken
  ): Promise<number[] | undefined>

  abstract getLabelsForTransactionId(transactionId?: number, trx?: sdk.TrxToken): Promise<TableTxLabel[]>
  abstract getTagsForOutputId(outputId: number, trx?: sdk.TrxToken): Promise<TableOutputTag[]>

  abstract listActions(auth: sdk.AuthId, args: sdk.ValidListActionsArgs): Promise<ListActionsResult>
  abstract listOutputs(auth: sdk.AuthId, args: sdk.ValidListOutputsArgs): Promise<ListOutputsResult>

  abstract countChangeInputs(userId: number, basketId: number, excludeSending: boolean): Promise<number>

  abstract findCertificatesAuth(auth: sdk.AuthId, args: sdk.FindCertificatesArgs): Promise<TableCertificateX[]>
  abstract findOutputBasketsAuth(auth: sdk.AuthId, args: sdk.FindOutputBasketsArgs): Promise<TableOutputBasket[]>
  abstract findOutputsAuth(auth: sdk.AuthId, args: sdk.FindOutputsArgs): Promise<TableOutput[]>
  abstract insertCertificateAuth(auth: sdk.AuthId, certificate: TableCertificateX): Promise<number>

  abstract adminStats(adminIdentityKey: string): Promise<StorageAdminStats>

  override isStorageProvider(): boolean {
    return true
  }

  setServices(v: sdk.WalletServices) {
    this._services = v
  }
  getServices(): sdk.WalletServices {
    if (!this._services) throw new sdk.WERR_INVALID_OPERATION('Must setServices first.')
    return this._services
  }

  async abortAction(auth: sdk.AuthId, args: AbortActionArgs): Promise<AbortActionResult> {
    if (!auth.userId) throw new sdk.WERR_INVALID_PARAMETER('auth.userId', 'valid')

    const userId = auth.userId
    let reference: string | undefined = args.reference
    let txid: string | undefined = undefined

    const r = await this.transaction(async trx => {
      let tx = verifyOneOrNone(
        await this.findTransactions({
          partial: { reference, userId },
          noRawTx: true,
          trx
        })
      )
      if (!tx && args.reference.length === 64) {
        // reference may also be a txid
        txid = reference
        reference = undefined
        tx = verifyOneOrNone(
          await this.findTransactions({
            partial: { txid, userId },
            noRawTx: true,
            trx
          })
        )
      }
      const unAbortableStatus: sdk.TransactionStatus[] = ['completed', 'failed', 'sending', 'unproven']
      if (!tx || !tx.isOutgoing || -1 < unAbortableStatus.findIndex(s => s === tx.status))
        throw new sdk.WERR_INVALID_PARAMETER(
          'reference',
          'an inprocess, outgoing action that has not been signed and shared to the network.'
        )
      await this.updateTransactionStatus('failed', tx.transactionId, userId, reference, trx)
      if (tx.txid) {
        const req = await EntityProvenTxReq.fromStorageTxid(this, tx.txid, trx)
        if (req) {
          req.addHistoryNote({ what: 'abortAction', reference: args.reference })
          req.status = 'invalid'
          await req.updateStorageDynamicProperties(this, trx)
        }
      }
      const r: AbortActionResult = {
        aborted: true
      }
      return r
    })
    return r
  }

  async internalizeAction(auth: sdk.AuthId, args: InternalizeActionArgs): Promise<InternalizeActionResult> {
    return await internalizeAction(this, auth, args)
  }

  /**
   * Given an array of transaction txids with current ProvenTxReq ready-to-share status,
   * lookup their ProvenTxReqApi req records.
   * For the txids with reqs and status still ready to send construct a single merged beef.
   *
   * @param txids
   * @param knownTxids
   * @param trx
   */
  async getReqsAndBeefToShareWithWorld(
    txids: string[],
    knownTxids: string[],
    trx?: sdk.TrxToken
  ): Promise<GetReqsAndBeefResult> {
    const r: GetReqsAndBeefResult = {
      beef: new Beef(),
      details: []
    }

    for (const txid of txids) {
      const d: GetReqsAndBeefDetail = {
        txid,
        status: 'unknown'
      }
      r.details.push(d)
      try {
        d.proven = verifyOneOrNone(await this.findProvenTxs({ partial: { txid }, trx }))
        if (d.proven) d.status = 'alreadySent'
        else {
          const alreadySentStatus = ['unmined', 'callback', 'unconfirmed', 'completed']
          const readyToSendStatus = ['sending', 'unsent', 'nosend', 'unprocessed']
          const errorStatus = ['unknown', 'nonfinal', 'invalid', 'doubleSpend']

          d.req = verifyOneOrNone(await this.findProvenTxReqs({ partial: { txid }, trx }))
          if (!d.req) {
            d.status = 'error'
            d.error = `ERR_UNKNOWN_TXID: ${txid} was not found.`
          } else if (errorStatus.indexOf(d.req.status) > -1) {
            d.status = 'error'
            d.error = `ERR_INVALID_PARAMETER: ${txid} is not ready to send.`
          } else if (alreadySentStatus.indexOf(d.req.status) > -1) {
            d.status = 'alreadySent'
          } else if (readyToSendStatus.indexOf(d.req.status) > -1) {
            if (!d.req.rawTx || !d.req.inputBEEF) {
              d.status = 'error'
              d.error = `ERR_INTERNAL: ${txid} req is missing rawTx or beef.`
            } else d.status = 'readyToSend'
          } else {
            d.status = 'error'
            d.error = `ERR_INTERNAL: ${txid} has unexpected req status ${d.req.status}`
          }

          if (d.status === 'readyToSend') {
            await this.mergeReqToBeefToShareExternally(d.req!, r.beef, knownTxids, trx)
          }
        }
      } catch (eu: unknown) {
        const e = sdk.WalletError.fromUnknown(eu)
        d.error = `${e.name}: ${e.message}`
      }
    }
    return r
  }

  async mergeReqToBeefToShareExternally(
    req: TableProvenTxReq,
    mergeToBeef: Beef,
    knownTxids: string[],
    trx?: sdk.TrxToken
  ): Promise<void> {
    const { rawTx, inputBEEF: beef } = req
    if (!rawTx || !beef) throw new sdk.WERR_INTERNAL(`req rawTx and beef must be valid.`)
    mergeToBeef.mergeRawTx(asArray(rawTx))
    mergeToBeef.mergeBeef(asArray(beef))
    const tx = Transaction.fromBinary(asArray(rawTx))
    for (const input of tx.inputs) {
      if (!input.sourceTXID) throw new sdk.WERR_INTERNAL(`req all transaction inputs must have valid sourceTXID`)
      const txid = input.sourceTXID
      const btx = mergeToBeef.findTxid(txid)
      if (!btx) {
        if (knownTxids && knownTxids.indexOf(txid) > -1) mergeToBeef.mergeTxidOnly(txid)
        else await this.getValidBeefForKnownTxid(txid, mergeToBeef, undefined, knownTxids, trx)
      }
    }
  }

  /**
   * Checks if txid is a known valid ProvenTx and returns it if found.
   * Next checks if txid is a current ProvenTxReq and returns that if found.
   * If `newReq` is provided and an existing ProvenTxReq isn't found,
   * use `newReq` to create a new ProvenTxReq.
   *
   * This is safe "findOrInsert" operation using retry if unique index constraint
   * is violated by a race condition insert.
   *
   * @param txid
   * @param newReq
   * @param trx
   * @returns
   */
  async getProvenOrReq(txid: string, newReq?: TableProvenTxReq, trx?: sdk.TrxToken): Promise<sdk.StorageProvenOrReq> {
    if (newReq && txid !== newReq.txid) throw new sdk.WERR_INVALID_PARAMETER('newReq', `same txid`)

    const r: sdk.StorageProvenOrReq = { proven: undefined, req: undefined }

    r.proven = verifyOneOrNone(await this.findProvenTxs({ partial: { txid }, trx }))
    if (r.proven) return r

    for (let retry = 0; ; retry++) {
      try {
        r.req = verifyOneOrNone(await this.findProvenTxReqs({ partial: { txid }, trx }))
        if (!r.req && !newReq) break
        if (!r.req && newReq) {
          await this.insertProvenTxReq(newReq, trx)
        }
        if (r.req && newReq) {
          // Merge history and notify into existing
          const req1 = new EntityProvenTxReq(r.req)
          req1.mergeHistory(newReq, undefined, true)
          req1.mergeNotifyTransactionIds(newReq)
          await req1.updateStorageDynamicProperties(this, trx)
        }
        break
      } catch (eu: unknown) {
        if (retry > 0) throw eu
      }
    }

    return r
  }

  async updateTransactionsStatus(
    transactionIds: number[],
    status: sdk.TransactionStatus,
    trx?: sdk.TrxToken
  ): Promise<void> {
    await this.transaction(async trx => {
      for (const id of transactionIds) {
        await this.updateTransactionStatus(status, id, undefined, undefined, trx)
      }
    }, trx)
  }

  /**
   * For all `status` values besides 'failed', just updates the transaction records status property.
   *
   * For 'status' of 'failed', attempts to make outputs previously allocated as inputs to this transaction usable again.
   *
   * @param status
   * @param transactionId
   * @param userId
   * @param reference
   * @param trx
   */
  async updateTransactionStatus(
    status: sdk.TransactionStatus,
    transactionId?: number,
    userId?: number,
    reference?: string,
    trx?: sdk.TrxToken
  ): Promise<void> {
    if (!transactionId && !(userId && reference))
      throw new sdk.WERR_MISSING_PARAMETER('either transactionId or userId and reference')

    await this.transaction(async trx => {
      const where: Partial<TableTransaction> = {}
      if (transactionId) where.transactionId = transactionId
      if (userId) where.userId = userId
      if (reference) where.reference = reference

      const tx = verifyOne(await this.findTransactions({ partial: where, noRawTx: true, trx }))

      //if (tx.status === status)
      // no change required. Assume inputs and outputs spendable and spentBy are valid for status.
      //return

      // Once completed, this method cannot be used to "uncomplete" transaction.
      if ((status !== 'completed' && tx.status === 'completed') || tx.provenTxId)
        throw new sdk.WERR_INVALID_OPERATION('The status of a "completed" transaction cannot be changed.')
      // It is not possible to un-fail a transaction. Information is lost and not recoverable.
      if (status !== 'failed' && tx.status === 'failed')
        throw new sdk.WERR_INVALID_OPERATION(`A "failed" transaction may not be un-failed by this method.`)

      switch (status) {
        case 'failed':
          {
            // Attempt to make outputs previously allocated as inputs to this transaction usable again.
            // Only clear input's spentBy and reset spendable = true if it references this transaction
            const t = new EntityTransaction(tx)
            const inputs = await t.getInputs(this, trx)
            for (const input of inputs) {
              // input is a prior output belonging to userId that reference this transaction either by `spentBy`
              // or by txid and vout.
              await this.updateOutput(verifyId(input.outputId), { spendable: true, spentBy: undefined }, trx)
            }
          }
          break
        case 'nosend':
        case 'unsigned':
        case 'unprocessed':
        case 'sending':
        case 'unproven':
        case 'completed':
          break
        default:
          throw new sdk.WERR_INVALID_PARAMETER('status', `not be ${status}`)
      }

      await this.updateTransaction(tx.transactionId, { status }, trx)
    }, trx)
  }

  async createAction(auth: sdk.AuthId, args: sdk.ValidCreateActionArgs): Promise<sdk.StorageCreateActionResult> {
    if (!auth.userId) throw new sdk.WERR_UNAUTHORIZED()
    return await createAction(this, auth, args)
  }
  async processAction(auth: sdk.AuthId, args: sdk.StorageProcessActionArgs): Promise<sdk.StorageProcessActionResults> {
    if (!auth.userId) throw new sdk.WERR_UNAUTHORIZED()
    return await processAction(this, auth, args)
  }

  async attemptToPostReqsToNetwork(reqs: EntityProvenTxReq[], trx?: sdk.TrxToken): Promise<PostReqsToNetworkResult> {
    return await attemptToPostReqsToNetwork(this, reqs, trx)
  }

  async listCertificates(auth: sdk.AuthId, args: sdk.ValidListCertificatesArgs): Promise<ListCertificatesResult> {
    return await listCertificates(this, auth, args)
  }

  async verifyKnownValidTransaction(txid: string, trx?: sdk.TrxToken): Promise<boolean> {
    const { proven, rawTx } = await this.getProvenOrRawTx(txid, trx)
    return proven != undefined || rawTx != undefined
  }

  async getValidBeefForKnownTxid(
    txid: string,
    mergeToBeef?: Beef,
    trustSelf?: TrustSelf,
    knownTxids?: string[],
    trx?: sdk.TrxToken
  ): Promise<Beef> {
    const beef = await this.getValidBeefForTxid(txid, mergeToBeef, trustSelf, knownTxids, trx)
    if (!beef) throw new sdk.WERR_INVALID_PARAMETER('txid', `${txid} is not known to storage.`)
    return beef
  }

  async getValidBeefForTxid(
    txid: string,
    mergeToBeef?: Beef,
    trustSelf?: TrustSelf,
    knownTxids?: string[],
    trx?: sdk.TrxToken
  ): Promise<Beef | undefined> {
    const beef = mergeToBeef || new Beef()

    const r = await this.getProvenOrRawTx(txid, trx)
    if (r.proven) {
      if (trustSelf === 'known') beef.mergeTxidOnly(txid)
      else {
        beef.mergeRawTx(r.proven.rawTx)
        const mp = new EntityProvenTx(r.proven).getMerklePath()
        beef.mergeBump(mp)
        return beef
      }
    }

    if (r.rawTx && r.inputBEEF) {
      if (trustSelf === 'known') beef.mergeTxidOnly(txid)
      else {
        beef.mergeRawTx(r.rawTx)
        beef.mergeBeef(r.inputBEEF)
        const tx = Transaction.fromBinary(r.rawTx)
        for (const input of tx.inputs) {
          const btx = beef.findTxid(input.sourceTXID!)
          if (!btx) {
            if (knownTxids && knownTxids.indexOf(input.sourceTXID!) > -1) beef.mergeTxidOnly(input.sourceTXID!)
            else await this.getValidBeefForKnownTxid(input.sourceTXID!, beef, trustSelf, knownTxids, trx)
          }
        }
        return beef
      }
    }

    return undefined
  }

  async getBeefForTransaction(txid: string, options: sdk.StorageGetBeefOptions): Promise<Beef> {
    return await getBeefForTransaction(this, txid, options)
  }

  async findMonitorEventById(id: number, trx?: sdk.TrxToken): Promise<TableMonitorEvent | undefined> {
    return verifyOneOrNone(await this.findMonitorEvents({ partial: { id }, trx }))
  }

  async relinquishCertificate(auth: sdk.AuthId, args: RelinquishCertificateArgs): Promise<number> {
    const vargs = sdk.validateRelinquishCertificateArgs(args)
    const cert = verifyOne(
      await this.findCertificates({
        partial: {
          certifier: vargs.certifier,
          serialNumber: vargs.serialNumber,
          type: vargs.type
        }
      })
    )
    return await this.updateCertificate(cert.certificateId, {
      isDeleted: true
    })
  }

  async relinquishOutput(auth: sdk.AuthId, args: RelinquishOutputArgs): Promise<number> {
    const vargs = sdk.validateRelinquishOutputArgs(args)
    const { txid, vout } = sdk.parseWalletOutpoint(vargs.output)
    const output = verifyOne(await this.findOutputs({ partial: { txid, vout } }))
    return await this.updateOutput(output.outputId, { basketId: undefined })
  }

  async processSyncChunk(args: sdk.RequestSyncChunkArgs, chunk: sdk.SyncChunk): Promise<sdk.ProcessSyncChunkResult> {
    const user = verifyTruthy(await this.findUserByIdentityKey(args.identityKey))
    const ss = new EntitySyncState(
      verifyOne(
        await this.findSyncStates({
          partial: {
            storageIdentityKey: args.fromStorageIdentityKey,
            userId: user.userId
          }
        })
      )
    )
    const r = await ss.processSyncChunk(this, args, chunk)
    return r
  }

  /**
   * Handles storage changes when a valid MerklePath and mined block header are found for a ProvenTxReq txid.
   *
   * Performs the following storage updates (typically):
   * 1. Lookup the exising `ProvenTxReq` record for its rawTx
   * 2. Insert a new ProvenTx record using properties from `args` and rawTx, yielding a new provenTxId
   * 3. Update ProvenTxReq record with status 'completed' and new provenTxId value (and history of status changed)
   * 4. Unpack notify transactionIds from req and update each transaction's status to 'completed', provenTxId value.
   * 5. Update ProvenTxReq history again to record that transactions have been notified.
   * 6. Return results...
   *
   * Alterations of "typically" to handle:
   */
  async updateProvenTxReqWithNewProvenTx(
    args: sdk.UpdateProvenTxReqWithNewProvenTxArgs
  ): Promise<sdk.UpdateProvenTxReqWithNewProvenTxResult> {
    const req = await EntityProvenTxReq.fromStorageId(this, args.provenTxReqId)
    let proven: EntityProvenTx
    if (req.provenTxId) {
      // Someone beat us to it, grab what we need for results...
      proven = new EntityProvenTx(verifyOne(await this.findProvenTxs({ partial: { txid: args.txid } })))
    } else {
      let isNew: boolean
      ;({ proven, isNew } = await this.transaction(async trx => {
        const { proven: api, isNew } = await this.findOrInsertProvenTx(
          {
            created_at: new Date(),
            updated_at: new Date(),
            provenTxId: 0,
            txid: args.txid,
            height: args.height,
            index: args.index,
            merklePath: args.merklePath,
            rawTx: req.rawTx,
            blockHash: args.blockHash,
            merkleRoot: args.merkleRoot
          },
          trx
        )
        proven = new EntityProvenTx(api)
        if (isNew) {
          req.status = 'completed'
          req.provenTxId = proven.provenTxId
          await req.updateStorageDynamicProperties(this, trx)
          // upate the transaction notifications outside of storage transaction....
        }
        return { proven, isNew }
      }))
      if (isNew) {
        const ids = req.notify.transactionIds || []
        if (ids.length > 0) {
          for (const id of ids) {
            try {
              await this.updateTransaction(id, {
                provenTxId: proven.provenTxId,
                status: 'completed'
              })
              req.addHistoryNote({ what: 'notifyTxOfProof', transactionId: id })
            } catch (eu: unknown) {
              const { code, description } = sdk.WalletError.fromUnknown(eu)
              const { provenTxId } = proven
              req.addHistoryNote({ what: 'notifyTxOfProofError', id, provenTxId, code, description })
            }
          }
          await req.updateStorageDynamicProperties(this)
        }
      }
    }
    const r: sdk.UpdateProvenTxReqWithNewProvenTxResult = {
      status: req.status,
      history: req.apiHistory,
      provenTxId: proven.provenTxId
    }
    return r
  }

  /**
   * For each spendable output in the 'default' basket of the authenticated user,
   * verify that the output script, satoshis, vout and txid match that of an output
   * still in the mempool of at least one service provider.
   *
   * @returns object with invalidSpendableOutputs array. A good result is an empty array.
   */
  async confirmSpendableOutputs(): Promise<{
    invalidSpendableOutputs: TableOutput[]
  }> {
    const invalidSpendableOutputs: TableOutput[] = []
    const users = await this.findUsers({ partial: {} })
    for (const { userId } of users) {
      const defaultBasket = verifyOne(await this.findOutputBaskets({ partial: { userId, name: 'default' } }))
      const where: Partial<TableOutput> = {
        userId,
        basketId: defaultBasket.basketId,
        spendable: true
      }
      const outputs = await this.findOutputs({ partial: where })
      const services = this.getServices()
      for (let i = outputs.length - 1; i >= 0; i--) {
        const o = outputs[i]
        const oid = verifyId(o.outputId)
        if (o.spendable) {
          let ok = false
          if (o.lockingScript && o.lockingScript.length > 0) {
            const hash = services.hashOutputScript(asString(o.lockingScript))
            const r = await services.getUtxoStatus(hash, undefined, `${o.txid}.${o.vout}`)
            if (r.isUtxo === true) ok = true
          }
          if (!ok) invalidSpendableOutputs.push(o)
        }
      }
    }
    return { invalidSpendableOutputs }
  }

  async updateProvenTxReqDynamics(
    id: number,
    update: Partial<TableProvenTxReqDynamics>,
    trx?: sdk.TrxToken
  ): Promise<number> {
    const partial: Partial<TableProvenTxReq> = {}
    if (update['updated_at']) partial['updated_at'] = update['updated_at']
    if (update['provenTxId']) partial['provenTxId'] = update['provenTxId']
    if (update['status']) partial['status'] = update['status']
    if (Number.isInteger(update['attempts'])) partial['attempts'] = update['attempts']
    if (update['notified'] !== undefined) partial['notified'] = update['notified']
    if (update['batch']) partial['batch'] = update['batch']
    if (update['history']) partial['history'] = update['history']
    if (update['notify']) partial['notify'] = update['notify']

    return await this.updateProvenTxReq(id, partial, trx)
  }

  async extendOutput(
    o: TableOutput,
    includeBasket = false,
    includeTags = false,
    trx?: sdk.TrxToken
  ): Promise<TableOutputX> {
    const ox = o as TableOutputX
    if (includeBasket && ox.basketId) ox.basket = await this.findOutputBasketById(o.basketId!, trx)
    if (includeTags) {
      ox.tags = await this.getTagsForOutputId(o.outputId)
    }
    return o
  }

  async validateOutputScript(o: TableOutput, trx?: sdk.TrxToken): Promise<void> {
    // without offset and length values return what we have (make no changes)
    if (!o.scriptLength || !o.scriptOffset || !o.txid) return
    // if there is an outputScript and its length is the expected length return what we have.
    if (o.lockingScript && o.lockingScript.length === o.scriptLength) return

    // outputScript is missing or has incorrect length...

    const script = await this.getRawTxOfKnownValidTransaction(o.txid, o.scriptOffset, o.scriptLength, trx)
    if (!script) return
    o.lockingScript = script
  }
}

export interface StorageProviderOptions extends StorageReaderWriterOptions {
  chain: sdk.Chain
  feeModel: sdk.StorageFeeModel
  /**
   * Transactions created by this Storage can charge a fee per transaction.
   * A value of zero disables commission fees.
   */
  commissionSatoshis: number
  /**
   * If commissionSatoshis is greater than zero, must be a valid public key hex string.
   * The actual locking script for each commission will use a public key derived
   * from this key by information stored in the commissions table.
   */
  commissionPubKeyHex?: PubKeyHex
}

export function validateStorageFeeModel(v?: sdk.StorageFeeModel): sdk.StorageFeeModel {
  const r: sdk.StorageFeeModel = {
    model: 'sat/kb',
    value: 1
  }
  if (typeof v === 'object') {
    if (v.model !== 'sat/kb') throw new sdk.WERR_INVALID_PARAMETER('StorageFeeModel.model', `"sat/kb"`)
    if (typeof v.value === 'number') {
      r.value = v.value
    }
  }
  return r
}

export interface StorageAdminStats {
  requestedBy: string
  when: string
  usersDay: number
  usersWeek: number
  usersMonth: number
  usersTotal: number
  transactionsDay: number
  transactionsWeek: number
  transactionsMonth: number
  transactionsTotal: number
  txCompletedDay: number
  txCompletedWeek: number
  txCompletedMonth: number
  txCompletedTotal: number
  txFailedDay: number
  txFailedWeek: number
  txFailedMonth: number
  txFailedTotal: number
  txUnprocessedDay: number
  txUnprocessedWeek: number
  txUnprocessedMonth: number
  txUnprocessedTotal: number
  txSendingDay: number
  txSendingWeek: number
  txSendingMonth: number
  txSendingTotal: number
  txUnprovenDay: number
  txUnprovenWeek: number
  txUnprovenMonth: number
  txUnprovenTotal: number
  txUnsignedDay: number
  txUnsignedWeek: number
  txUnsignedMonth: number
  txUnsignedTotal: number
  txNosendDay: number
  txNosendWeek: number
  txNosendMonth: number
  txNosendTotal: number
  txNonfinalDay: number
  txNonfinalWeek: number
  txNonfinalMonth: number
  txNonfinalTotal: number
  txUnfailDay: number
  txUnfailWeek: number
  txUnfailMonth: number
  txUnfailTotal: number
  satoshisDefaultDay: number
  satoshisDefaultWeek: number
  satoshisDefaultMonth: number
  satoshisDefaultTotal: number
  satoshisOtherDay: number
  satoshisOtherWeek: number
  satoshisOtherMonth: number
  satoshisOtherTotal: number
  basketsDay: number
  basketsWeek: number
  basketsMonth: number
  basketsTotal: number
  labelsDay: number
  labelsWeek: number
  labelsMonth: number
  labelsTotal: number
  tagsDay: number
  tagsWeek: number
  tagsMonth: number
  tagsTotal: number
}
