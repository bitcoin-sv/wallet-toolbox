import {
  sdk,
  TableCertificate,
  TableCertificateField,
  TableCertificateX,
  TableCommission,
  TableOutput,
  TableOutputBasket,
  TableOutputTag,
  TableOutputTagMap,
  TableProvenTx,
  TableProvenTxReq,
  TableSettings,
  TableSyncState,
  TableTransaction,
  TableTxLabel,
  TableTxLabelMap,
  TableUser
} from '../index.client'

/**
 * This is the minimal interface required for a WalletStorageProvider to export data to another provider.
 */
export interface StorageSyncReader {
  isAvailable(): boolean
  makeAvailable(): Promise<TableSettings>

  destroy(): Promise<void>

  /////////////////
  //
  // READ OPERATIONS (state preserving methods)
  //
  /////////////////

  getSettings(): TableSettings

  findUserByIdentityKey(key: string): Promise<TableUser | undefined>

  findSyncStates(args: sdk.FindSyncStatesArgs): Promise<TableSyncState[]>

  findCertificateFields(
    args: sdk.FindCertificateFieldsArgs
  ): Promise<TableCertificateField[]>
  findCertificates(args: sdk.FindCertificatesArgs): Promise<TableCertificateX[]>
  findCommissions(args: sdk.FindCommissionsArgs): Promise<TableCommission[]>
  findOutputBaskets(
    args: sdk.FindOutputBasketsArgs
  ): Promise<TableOutputBasket[]>
  findOutputs(args: sdk.FindOutputsArgs): Promise<TableOutput[]>
  findOutputTags(args: sdk.FindOutputTagsArgs): Promise<TableOutputTag[]>
  findTransactions(args: sdk.FindTransactionsArgs): Promise<TableTransaction[]>
  findTxLabels(args: sdk.FindTxLabelsArgs): Promise<TableTxLabel[]>

  getProvenTxsForUser(
    args: sdk.FindForUserSincePagedArgs
  ): Promise<TableProvenTx[]>
  getProvenTxReqsForUser(
    args: sdk.FindForUserSincePagedArgs
  ): Promise<TableProvenTxReq[]>
  getTxLabelMapsForUser(
    args: sdk.FindForUserSincePagedArgs
  ): Promise<TableTxLabelMap[]>
  getOutputTagMapsForUser(
    args: sdk.FindForUserSincePagedArgs
  ): Promise<TableOutputTagMap[]>

  getSyncChunk(args: RequestSyncChunkArgs): Promise<SyncChunk>
}

/**
 * success: Last sync of this user from this storage was successful.
 *
 * error: Last sync protocol operation for this user to this storage threw and error.
 *
 * identified: Configured sync storage has been identified but not sync'ed.
 *
 * unknown: Sync protocol state is unknown.
 */
export type SyncStatus =
  | 'success'
  | 'error'
  | 'identified'
  | 'updated'
  | 'unknown'

export type SyncProtocolVersion = '0.1.0'

export interface RequestSyncChunkArgs {
  /**
   * The storageIdentityKey of the storage supplying the update SyncChunk data.
   */
  fromStorageIdentityKey: string
  /**
   * The storageIdentityKey of the storage consuming the update SyncChunk data.
   */
  toStorageIdentityKey: string

  /**
   * The identity of whose data is being requested
   */
  identityKey: string
  /**
   * The max updated_at time received from the storage service receiving the request.
   * Will be undefiend if this is the first request or if no data was previously sync'ed.
   *
   * `since` must include items if 'updated_at' is greater or equal. Thus, when not undefined, a sync request should always return at least one item already seen.
   */
  since?: Date
  /**
   * A rough limit on how large the response should be.
   * The item that exceeds the limit is included and ends adding more items.
   */
  maxRoughSize: number
  /**
   * The maximum number of items (records) to be returned.
   */
  maxItems: number
  /**
   * For each entity in dependency order, the offset at which to start returning items
   * from `since`.
   *
   * The entity order is:
   * 0 ProvenTxs
   * 1 ProvenTxReqs
   * 2 OutputBaskets
   * 3 TxLabels
   * 4 OutputTags
   * 5 Transactions
   * 6 TxLabelMaps
   * 7 Commissions
   * 8 Outputs
   * 9 OutputTagMaps
   * 10 Certificates
   * 11 CertificateFields
   */
  offsets: { name: string; offset: number }[]
}

/**
 * Result received from remote `WalletStorage` in response to a `RequestSyncChunkArgs` request.
 *
 * Each property is undefined if there was no attempt to update it. Typically this is caused by size and count limits on this result.
 *
 * If all properties are empty arrays the sync process has received all available new and updated items.
 */
export interface SyncChunk {
  fromStorageIdentityKey: string
  toStorageIdentityKey: string
  userIdentityKey: string

  user?: TableUser
  provenTxs?: TableProvenTx[]
  provenTxReqs?: TableProvenTxReq[]
  outputBaskets?: TableOutputBasket[]
  txLabels?: TableTxLabel[]
  outputTags?: TableOutputTag[]
  transactions?: TableTransaction[]
  txLabelMaps?: TableTxLabelMap[]
  commissions?: TableCommission[]
  outputs?: TableOutput[]
  outputTagMaps?: TableOutputTagMap[]
  certificates?: TableCertificate[]
  certificateFields?: TableCertificateField[]
}

export interface ProcessSyncChunkResult {
  done: boolean
  maxUpdated_at: Date | undefined
  updates: number
  inserts: number
  error?: sdk.WalletError
}
