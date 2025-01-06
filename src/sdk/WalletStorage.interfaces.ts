import * as bsv from '@bsv/sdk'
import { sdk, table } from "..";

export interface WalletStorage extends sdk.StorageSyncReader {

   destroy(): Promise<void>

   dropAllData(): Promise<void>
   migrate(storageName: string): Promise<string>
   purgeData(params: sdk.PurgeParams, trx?: sdk.TrxToken): Promise<sdk.PurgeResults>

   getServices() : sdk.WalletServices
   setServices(v: sdk.WalletServices) : void

   /////////////////
   //
   // WRITE OPERATIONS (state modifying methods)
   //
   /////////////////


   updateTransactionStatus(status: sdk.TransactionStatus, transactionId?: number, userId?: number, reference?: string, trx?: sdk.TrxToken)
   
   internalizeActionSdk(sargs: sdk.StorageInternalizeActionArgs, originator?: sdk.OriginatorDomainNameStringUnder250Bytes) : Promise<sdk.InternalizeActionResult>
   createTransactionSdk(args: sdk.ValidCreateActionArgs, originator?: sdk.OriginatorDomainNameStringUnder250Bytes): Promise<sdk.StorageCreateTransactionSdkResult>
   processActionSdk(params: sdk.StorageProcessActionSdkParams, originator?: sdk.OriginatorDomainNameStringUnder250Bytes): Promise<sdk.StorageProcessActionSdkResults>
   abortActionSdk(vargs: sdk.ValidAbortActionArgs, originator?: sdk.OriginatorDomainNameStringUnder250Bytes): Promise<sdk.AbortActionResult>

   getProvenOrReq(txid: string, newReq?: table.ProvenTxReq, trx?: sdk.TrxToken) : Promise<sdk.StorageProvenOrReq>
   findOrInsertTransaction(newTx: table.Transaction, trx?: sdk.TrxToken) : Promise<{ tx: table.Transaction, isNew: boolean}>
   findOrInsertOutputBasket(userId: number, name: string, trx?: sdk.TrxToken) : Promise<table.OutputBasket>
   findOrInsertTxLabel(userId: number, label: string, trx?: sdk.TrxToken) : Promise<table.TxLabel>
   findOrInsertTxLabelMap(transactionId: number, txLabelId: number, trx?: sdk.TrxToken) : Promise<table.TxLabelMap>
   findOrInsertOutputTag(userId: number, tag: string, trx?: sdk.TrxToken): Promise<table.OutputTag>
   findOrInsertOutputTagMap(outputId: number, outputTagId: number, trx?: sdk.TrxToken): Promise<table.OutputTagMap>
   tagOutput(partial: Partial<table.Output>, tag: string, trx?: sdk.TrxToken) : Promise<void>

   insertCertificate(certificate: table.CertificateX, trx?: sdk.TrxToken): Promise<number>
   insertCertificateField(certificateField: table.CertificateField, trx?: sdk.TrxToken): Promise<void>
   insertCommission(commission: table.Commission, trx?: sdk.TrxToken): Promise<number>
   insertOutput(output: table.Output, trx?: sdk.TrxToken): Promise<number>
   insertOutputBasket(basket: table.OutputBasket, trx?: sdk.TrxToken): Promise<number>
   insertOutputTag(tag: table.OutputTag, trx?: sdk.TrxToken): Promise<number>
   insertOutputTagMap(tagMap: table.OutputTagMap, trx?: sdk.TrxToken): Promise<void>
   insertProvenTx(tx: table.ProvenTx, trx?: sdk.TrxToken): Promise<number>
   insertProvenTxReq(tx: table.ProvenTxReq, trx?: sdk.TrxToken): Promise<number>
   insertSyncState(syncState: table.SyncState, trx?: sdk.TrxToken) : Promise<number>
   insertTransaction(tx: table.Transaction, trx?: sdk.TrxToken): Promise<number>
   insertTxLabel(label: table.TxLabel, trx?: sdk.TrxToken): Promise<number>
   insertTxLabelMap(labelMap: table.TxLabelMap, trx?: sdk.TrxToken): Promise<void>
   insertUser(user: table.User, trx?: sdk.TrxToken): Promise<number>
   insertWatchmanEvent(event: table.WatchmanEvent, trx?: sdk.TrxToken) : Promise<number>

   updateCertificate(id: number, update: Partial<table.Certificate>, trx?: sdk.TrxToken) : Promise<number>
   updateCertificateField(certificateId: number, fieldName: string, update: Partial<table.CertificateField>, trx?: sdk.TrxToken) : Promise<number>
   updateCommission(id: number, update: Partial<table.Commission>, trx?: sdk.TrxToken) : Promise<number>
   updateOutput(id: number, update: Partial<table.Output>, trx?: sdk.TrxToken) : Promise<number>
   updateOutputBasket(id: number, update: Partial<table.OutputBasket>, trx?: sdk.TrxToken) : Promise<number>
   updateOutputTag(id: number, update: Partial<table.OutputTag>, trx?: sdk.TrxToken) : Promise<number>
   updateOutputTagMap(outputId: number, tagId: number, update: Partial<table.OutputTagMap>, trx?: sdk.TrxToken) : Promise<number>
   updateProvenTx(id: number, update: Partial<table.ProvenTx>, trx?: sdk.TrxToken): Promise<number> 
   updateProvenTxReq(id: number, update: Partial<table.ProvenTxReq>, trx?: sdk.TrxToken) : Promise<number>
   updateSyncState(id: number, update: Partial<table.SyncState>, trx?: sdk.TrxToken): Promise<number>
   updateTransaction(id: number, update: Partial<table.Transaction>, trx?: sdk.TrxToken) : Promise<number>
   updateTxLabel(id: number, update: Partial<table.TxLabel>, trx?: sdk.TrxToken) : Promise<number>
   updateTxLabelMap(transactionId: number, txLabelId: number, update: Partial<table.TxLabelMap>, trx?: sdk.TrxToken) : Promise<number>
   updateUser(id: number, update: Partial<table.User>, trx?: sdk.TrxToken) : Promise<number>
   updateWatchmanEvent(id: number, update: Partial<table.WatchmanEvent>, trx?: sdk.TrxToken): Promise<number> 

   /////////////////
   //
   // READ OPERATIONS (state preserving methods)
   //
   /////////////////

   getSettings(trx?: sdk.TrxToken): Promise<table.Settings>

   getProvenOrRawTx(txid: string, trx?: sdk.TrxToken)
   getRawTxOfKnownValidTransaction(txid?: string, offset?: number, length?: number, trx?: sdk.TrxToken)

   getProvenTxsForUser(userId: number, since?: Date, paged?: sdk.Paged, trx?: sdk.TrxToken) : Promise<table.ProvenTx[]>
   getProvenTxReqsForUser(userId: number, since?: Date, paged?: sdk.Paged, trx?: sdk.TrxToken) : Promise<table.ProvenTxReq[]>
   getTxLabelMapsForUser(userId: number, since?: Date, paged?: sdk.Paged, trx?: sdk.TrxToken) : Promise<table.TxLabelMap[]>
   getOutputTagMapsForUser(userId: number, since?: Date, paged?: sdk.Paged, trx?: sdk.TrxToken) : Promise<table.OutputTagMap[]>

   getLabelsForTransactionId(transactionId?: number, trx?: sdk.TrxToken): Promise<table.TxLabel[]>
   getTagsForOutputId(outputId: number, trx?: sdk.TrxToken) : Promise<table.OutputTag[]>

   transaction<T>(scope: (trx: sdk.TrxToken) => Promise<T>, trx?: sdk.TrxToken): Promise<T>

   listActionsSdk(vargs: sdk.ValidListActionsArgs, originator?: sdk.OriginatorDomainNameStringUnder250Bytes): Promise<sdk.ListActionsResult>
   listOutputsSdk(vargs: sdk.ValidListOutputsArgs, originator?: sdk.OriginatorDomainNameStringUnder250Bytes): Promise<sdk.ListOutputsResult>
   listCertificatesSdk(vargs: sdk.ValidListCertificatesArgs, originator?: sdk.OriginatorDomainNameStringUnder250Bytes): Promise<sdk.ListCertificatesResult>

   findCertificateFields(partial: Partial<table.CertificateField>, since?: Date, paged?: sdk.Paged, trx?: sdk.TrxToken): Promise<table.CertificateField[]>
   findCertificates(partial: Partial<table.Certificate>, certifiers?: string[], types?: string[], since?: Date, paged?: sdk.Paged, trx?: sdk.TrxToken): Promise<table.Certificate[]>
   findCommissions(partial: Partial<table.Commission>, since?: Date, paged?: sdk.Paged, trx?: sdk.TrxToken): Promise<table.Commission[]>
   findOutputBaskets(partial: Partial<table.OutputBasket>, since?: Date, paged?: sdk.Paged, trx?: sdk.TrxToken): Promise<table.OutputBasket[]>
   findOutputs(partial: Partial<table.Output>, noScript?: boolean, since?: Date, paged?: sdk.Paged, trx?: sdk.TrxToken): Promise<table.Output[]>
   findOutputTagMaps(partial: Partial<table.OutputTagMap>, tagIds?: number[], since?: Date, paged?: sdk.Paged, trx?: sdk.TrxToken): Promise<table.OutputTagMap[]>
   findOutputTags(partial: Partial<table.OutputTag>, since?: Date, paged?: sdk.Paged, trx?: sdk.TrxToken): Promise<table.OutputTag[]>
   findProvenTxReqs(partial: Partial<table.ProvenTxReq>, status?: sdk.ProvenTxReqStatus[], txids?: string[], since?: Date, paged?: sdk.Paged, trx?: sdk.TrxToken): Promise<table.ProvenTxReq[]>
   findProvenTxs(partial: Partial<table.ProvenTx>, since?: Date, paged?: sdk.Paged, trx?: sdk.TrxToken): Promise<table.ProvenTx[]>
   findSyncStates(partial: Partial<table.SyncState>, since?: Date, paged?: sdk.Paged, trx?: sdk.TrxToken): Promise<table.SyncState[]>
   findTransactions(partial: Partial<table.Transaction>, status?: sdk.TransactionStatus[], noRawTx?: boolean, since?: Date, paged?: sdk.Paged, trx?: sdk.TrxToken): Promise<table.Transaction[]>
   findTxLabelMaps(partial: Partial<table.TxLabelMap>, labelIds?: number[], since?: Date, paged?: sdk.Paged, trx?: sdk.TrxToken): Promise<table.TxLabelMap[]>
   findTxLabels(partial: Partial<table.TxLabel>, since?: Date, paged?: sdk.Paged, trx?: sdk.TrxToken): Promise<table.TxLabel[]>
   findUsers(partial: Partial<table.User>, since?: Date, paged?: sdk.Paged, trx?: sdk.TrxToken): Promise<table.User[]>
   findWatchmanEvents(partial: Partial<table.WatchmanEvent>, since?: Date, paged?: sdk.Paged, trx?: sdk.TrxToken): Promise<table.WatchmanEvent[]>

   findUserByIdentityKey(key: string, trx?: sdk.TrxToken) : Promise<table.User| undefined>

   findCertificateById(id: number, trx?: sdk.TrxToken) : Promise<table.Certificate| undefined>
   findCommissionById(id: number, trx?: sdk.TrxToken) : Promise<table.Commission| undefined>
   findOutputBasketById(id: number, trx?: sdk.TrxToken) : Promise<table.OutputBasket| undefined>
   findOutputById(id: number, trx?: sdk.TrxToken, noScript?: boolean) : Promise<table.Output| undefined>
   findOutputTagById(id: number, trx?: sdk.TrxToken) : Promise<table.OutputTag| undefined>
   findProvenTxById(id: number, trx?: sdk.TrxToken | undefined): Promise<table.ProvenTx| undefined>
   findProvenTxReqById(id: number, trx?: sdk.TrxToken | undefined): Promise<table.ProvenTxReq| undefined>
   findSyncStateById(id: number, trx?: sdk.TrxToken): Promise<table.SyncState| undefined>
   findTransactionById(id: number, trx?: sdk.TrxToken, noRawTx?: boolean) : Promise<table.Transaction| undefined>
   findTxLabelById(id: number, trx?: sdk.TrxToken) : Promise<table.TxLabel| undefined>
   findUserById(id: number, trx?: sdk.TrxToken) : Promise<table.User| undefined>
   findWatchmanEventById(id: number, trx?: sdk.TrxToken): Promise<table.WatchmanEvent| undefined>

   countCertificateFields(partial: Partial<table.CertificateField>, since?: Date, trx?: sdk.TrxToken): Promise<number>
   countCertificates(partial: Partial<table.Certificate>, certifiers?: string[], types?: string[], since?: Date, trx?: sdk.TrxToken): Promise<number>
   countCommissions(partial: Partial<table.Commission>, since?: Date, trx?: sdk.TrxToken): Promise<number>
   countOutputBaskets(partial: Partial<table.OutputBasket>, since?: Date, trx?: sdk.TrxToken): Promise<number>
   countOutputs(partial: Partial<table.Output>, since?: Date, trx?: sdk.TrxToken): Promise<number>
   countOutputTagMaps(partial: Partial<table.OutputTagMap>, tagIds?: number[], since?: Date, trx?: sdk.TrxToken): Promise<number>
   countOutputTags(partial: Partial<table.OutputTag>, since?: Date, trx?: sdk.TrxToken): Promise<number>
   countProvenTxReqs(partial: Partial<table.ProvenTxReq>, status?: sdk.ProvenTxReqStatus[], txids?: string[], since?: Date, trx?: sdk.TrxToken): Promise<number>
   countProvenTxs(partial: Partial<table.ProvenTx>, since?: Date, trx?: sdk.TrxToken): Promise<number>
   countSyncStates(partial: Partial<table.SyncState>, since?: Date, trx?: sdk.TrxToken): Promise<number>
   countTransactions(partial: Partial<table.Transaction>, status?: sdk.TransactionStatus[], since?: Date, trx?: sdk.TrxToken): Promise<number>
   countTxLabelMaps(partial: Partial<table.TxLabelMap>, labelIds?: number[], since?: Date, trx?: sdk.TrxToken): Promise<number>
   countTxLabels(partial: Partial<table.TxLabel>, since?: Date, trx?: sdk.TrxToken): Promise<number>
   countUsers(partial: Partial<table.User>, since?: Date, trx?: sdk.TrxToken): Promise<number>
   countWatchmanEvents(partial: Partial<table.WatchmanEvent>, since?: Date, trx?: sdk.TrxToken): Promise<number>
}

/**
 * Place holder for the transaction control object used by actual storage provider implementation.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TrxToken {
}

export type StorageProvidedBy = 'you' | 'storage' | 'you-and-storage'

export interface StorageCreateTransactionSdkInput {
   vin: number
   sourceTxid: string
   sourceVout: number
   sourceSatoshis: number
   sourceLockingScript: string
   unlockingScriptLength: number
   providedBy: StorageProvidedBy
   type: string
   spendingDescription?: string
   derivationPrefix?: string
   derivationSuffix?: string
   senderIdentityKey?: string
}

export interface StorageCreateTransactionSdkOutput extends sdk.ValidCreateActionOutput {
   vout: number
   providedBy: StorageProvidedBy
   purpose?: string
   derivationSuffix?: string
}

export interface StorageCreateTransactionSdkResult {
   inputBeef?: number[]
   inputs: StorageCreateTransactionSdkInput[]
   outputs: StorageCreateTransactionSdkOutput[]
   noSendChangeOutputVouts?: number[]
   derivationPrefix: string
   version: number
   lockTime: number
   reference: string
}

export interface StorageProcessActionSdkParams {
   isNewTx: boolean
   isSendWith: boolean
   isNoSend: boolean
   isDelayed: boolean
   reference?: string
   txid?: string
   rawTx?: number[]
   sendWith: string[]
   log?: string
}

export interface StorageProcessActionSdkResults {
   sendWithResults?: sdk.SendWithResult[]
   log?: string
}

export interface ProvenOrRawTx { proven?: table.ProvenTx, rawTx?: number[], inputBEEF?: number[] }

export interface PurgeParams {
   purgeCompleted: boolean
   purgeFailed: boolean
   purgeSpent: boolean

   /**
    * Minimum age in msecs for transient completed transaction data purge.
    * Default is 14 days.
    */
   purgeCompletedAge?: number
   /**
    * Minimum age in msecs for failed transaction data purge.
    * Default is 14 days.
    */
   purgeFailedAge?: number
   /**
    * Minimum age in msecs for failed transaction data purge.
    * Default is 14 days.
    */
   purgeSpentAge?: number
}

export interface PurgeResults {
   count: number,
   log: string
}

export interface StorageInternalizeActionArgs extends sdk.ValidInternalizeActionArgs {
    commonDerivationPrefix: string | undefined
}

export interface StorageProvenOrReq { proven?: table.ProvenTx, req?: table.ProvenTxReq }

/**
 * Specifies the available options for computing transaction fees.
 */
export interface StorageFeeModel {
   /**
    * Available models. Currently only "sat/kb" is supported.
    */
   model: 'sat/kb'
   /**
    * When "fee.model" is "sat/kb", this is an integer representing the number of satoshis per kb of block space
    * the transaction will pay in fees.
    * 
    * If undefined, the default value is used.
    */
   value?: number
}

export interface StorageGetBeefOptions {
   /** if 'known', txids known to local storage as valid are included as txidOnly */
   trustSelf?: 'known'
   /** list of txids to be included as txidOnly if referenced. Validity is known to caller. */
   knownTxids?: string[]
   /** optional. If defined, raw transactions and merkle paths required by txid are merged to this instance and returned. Otherwise a new Beef is constructed and returned. */
   mergeToBeef?: bsv.Beef | number[]
   /** optional. Default is false. `dojo.storage` is used for raw transaction and merkle proof lookup */
   ignoreStorage?: boolean
   /** optional. Default is false. `dojo.getServices` is used for raw transaction and merkle proof lookup */
   ignoreServices?: boolean
   /** optional. Default is false. If true, raw transactions with proofs missing from `dojo.storage` and obtained from `dojo.getServices` are not inserted to `dojo.storage`. */
   ignoreNewProven?: boolean
   /** optional. Default is zero. Ignores available merkle paths until recursion detpth equals or exceeds value  */
   minProofLevel?: number
}

export interface StorageSyncReaderOptions {
    chain: sdk.Chain
}