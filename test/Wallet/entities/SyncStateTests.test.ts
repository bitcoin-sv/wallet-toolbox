import { SyncState } from '../../../src/storage/schema/entities/SyncState'
import { _tu, expectToThrowWERR, TestWalletNoSetup } from '../../utils/TestUtilsStephen'
import { entity, sdk, table } from '../../../src'

describe('SyncState class method tests', () => {
  jest.setTimeout(99999999)

  const env = _tu.getEnv('test')
  const ctxs: TestWalletNoSetup[] = []
  const ctxs2: TestWalletNoSetup[] = []

  beforeAll(async () => {
    if (!env.noMySQL) {
      ctxs.push(await _tu.createLegacyWalletMySQLCopy('SyncStateTests'))
    }
    ctxs.push(await _tu.createLegacyWalletSQLiteCopy('SyncStateTests'))
  })

  afterAll(async () => {
    for (const ctx of ctxs) {
      await ctx.storage.destroy()
    }
  })

  // Test: Insert a new SyncState when id is 0
  test('0_inserts_new_sync_state', async () => {
    const ctx = ctxs[0]
    const syncState = new SyncState()
    syncState.id = 0

    // Assign a unique value to refNum and valid userId
    syncState.userId = 1
    syncState.refNum = `testRefNum-${Date.now()}`

    // Insert the SyncState into storage
    await syncState.updateStorage(ctx.activeStorage)

    // Find the SyncState using FindSyncStatesArgs
    const findArgs: sdk.FindSyncStatesArgs = {
      partial: { syncStateId: syncState.id }
    }

    const fetchedSyncStates = await ctx.activeStorage.findSyncStates(findArgs)

    // Handle array response
    expect(fetchedSyncStates).toBeTruthy()
    expect(fetchedSyncStates.length).toBeGreaterThan(0)

    const fetchedSyncState = fetchedSyncStates[0]
    expect(fetchedSyncState.syncStateId).toBeGreaterThan(0)
  })

  // Test: Update an existing SyncState
  test('1_updates_existing_sync_state', async () => {
    const ctx = ctxs[0]
    const syncState = new SyncState()
    syncState.id = 0
    // Assign a unique value to refNum and valid userId
    syncState.userId = 1
    syncState.refNum = `testRefNum-${Date.now()}`

    // Insert the SyncState into storage
    await syncState.updateStorage(ctx.activeStorage)

    // Update the SyncState with a valid status
    syncState.status = 'updated' // Use a valid SyncStatus value
    await syncState.updateStorage(ctx.activeStorage)

    // Find the SyncState using FindSyncStatesArgs
    const findArgs: sdk.FindSyncStatesArgs = {
      partial: { syncStateId: syncState.id }
    }

    const fetchedSyncStates = await ctx.activeStorage.findSyncStates(findArgs)

    // Handle array response
    const fetchedSyncState = fetchedSyncStates[0]
    expect(fetchedSyncState.status).toBe('updated') // Verify the status is updated
  })

  // Test: Merge ID maps correctly
  test('2_merges_id_maps_correctly', async () => {
    const syncState = new SyncState()

    // Complete SyncMap with all required properties
    const inputSyncMap: entity.SyncMap = {
      provenTx: { idMap: { 1: 2 }, entityName: 'provenTx', count: 1 },
      outputBasket: { idMap: {}, entityName: 'outputBasket', count: 0 },
      transaction: { idMap: { 3: 4 }, entityName: 'transaction', count: 1 },
      provenTxReq: { idMap: {}, entityName: 'provenTxReq', count: 0 },
      txLabel: { idMap: {}, entityName: 'txLabel', count: 0 },
      txLabelMap: { idMap: {}, entityName: 'txLabelMap', count: 0 },
      output: { idMap: {}, entityName: 'output', count: 0 },
      outputTag: { idMap: {}, entityName: 'outputTag', count: 0 },
      outputTagMap: { idMap: {}, entityName: 'outputTagMap', count: 0 },
      certificate: { idMap: {}, entityName: 'certificate', count: 0 },
      certificateField: { idMap: {}, entityName: 'certificateField', count: 0 },
      commission: { idMap: {}, entityName: 'commission', count: 0 }
    }

    syncState.syncMap = {
      provenTx: { idMap: { 1: 2 }, entityName: 'provenTx', count: 1 },
      outputBasket: { idMap: {}, entityName: 'outputBasket', count: 0 },
      transaction: { idMap: { 5: 6 }, entityName: 'transaction', count: 1 },
      provenTxReq: { idMap: {}, entityName: 'provenTxReq', count: 0 },
      txLabel: { idMap: {}, entityName: 'txLabel', count: 0 },
      txLabelMap: { idMap: {}, entityName: 'txLabelMap', count: 0 },
      output: { idMap: {}, entityName: 'output', count: 0 },
      outputTag: { idMap: {}, entityName: 'outputTag', count: 0 },
      outputTagMap: { idMap: {}, entityName: 'outputTagMap', count: 0 },
      certificate: { idMap: {}, entityName: 'certificate', count: 0 },
      certificateField: { idMap: {}, entityName: 'certificateField', count: 0 },
      commission: { idMap: {}, entityName: 'commission', count: 0 }
    }

    syncState.mergeSyncMap(inputSyncMap)

    // Assertions
    expect(syncState.syncMap.provenTx.idMap[1]).toBe(2)
    expect(syncState.syncMap.transaction.idMap[3]).toBe(4)
    expect(syncState.syncMap.transaction.idMap[5]).toBe(6)
  })

  // Test: Throw error on conflicting mappings
  test('3_throws_error_on_conflicting_mappings', () => {
    const syncState = new SyncState()

    syncState.syncMap = {
      provenTx: { idMap: { 1: 2 }, entityName: 'provenTx', count: 1 },
      outputBasket: { idMap: {}, entityName: 'outputBasket', count: 0 },
      transaction: { idMap: { 3: 4 }, entityName: 'transaction', count: 1 },
      provenTxReq: { idMap: {}, entityName: 'provenTxReq', count: 0 },
      txLabel: { idMap: {}, entityName: 'txLabel', count: 0 },
      txLabelMap: { idMap: {}, entityName: 'txLabelMap', count: 0 },
      output: { idMap: {}, entityName: 'output', count: 0 },
      outputTag: { idMap: {}, entityName: 'outputTag', count: 0 },
      outputTagMap: { idMap: {}, entityName: 'outputTagMap', count: 0 },
      certificate: { idMap: {}, entityName: 'certificate', count: 0 },
      certificateField: { idMap: {}, entityName: 'certificateField', count: 0 },
      commission: { idMap: {}, entityName: 'commission', count: 0 }
    }

    const conflictingSyncMap: entity.SyncMap = {
      provenTx: { idMap: { 1: 3 }, entityName: 'provenTx', count: 1 },
      outputBasket: { idMap: {}, entityName: 'outputBasket', count: 0 },
      transaction: { idMap: { 3: 4 }, entityName: 'transaction', count: 1 },
      provenTxReq: { idMap: {}, entityName: 'provenTxReq', count: 0 },
      txLabel: { idMap: {}, entityName: 'txLabel', count: 0 },
      txLabelMap: { idMap: {}, entityName: 'txLabelMap', count: 0 },
      output: { idMap: {}, entityName: 'output', count: 0 },
      outputTag: { idMap: {}, entityName: 'outputTag', count: 0 },
      outputTagMap: { idMap: {}, entityName: 'outputTagMap', count: 0 },
      certificate: { idMap: {}, entityName: 'certificate', count: 0 },
      certificateField: { idMap: {}, entityName: 'certificateField', count: 0 },
      commission: { idMap: {}, entityName: 'commission', count: 0 }
    }

    expect(() => syncState.mergeSyncMap(conflictingSyncMap)).toThrow()
  })

  // Test: Process a sync chunk correctly and update storage
  test('4_processes_sync_chunk_correctly', async () => {
    const ctx = ctxs[0]
    const syncState = new SyncState()

    // Assign a unique value to refNum and valid userId
    syncState.userId = 1
    syncState.refNum = `testRefNum-${Date.now()}`

    // Define the chunk object with all required properties
    const chunk: sdk.SyncChunk = {
      fromStorageIdentityKey: 'fromKey',
      toStorageIdentityKey: 'toKey',
      userIdentityKey: 'testIdentityKey',
      user: {
        userId: 1,
        identityKey: 'testIdentityKey',
        created_at: new Date(), // Add required property
        updated_at: new Date() // Add required property
      },
      provenTxs: [],
      provenTxReqs: [],
      outputBaskets: [],
      txLabels: [],
      outputTags: [],
      transactions: [],
      txLabelMaps: [],
      commissions: [],
      outputs: [],
      outputTagMaps: [],
      certificates: [],
      certificateFields: []
    }

    const args: sdk.RequestSyncChunkArgs = {
      identityKey: 'testIdentityKey',
      maxRoughSize: 20000000,
      maxItems: 1000,
      offsets: [],
      since: undefined,
      fromStorageIdentityKey: 'fromKey',
      toStorageIdentityKey: 'toKey'
    }

    const result = await syncState.processSyncChunk(ctx.activeStorage, args, chunk)

    expect(result.done).toBe(true)
    expect(result.updates).toBe(0)
    expect(result.inserts).toBe(0)
  })

  // Test: equals method always returns false
  test('6_equals_method_always_returns_false', () => {
    const syncState = new SyncState()
    expect(syncState.equals({} as table.SyncState)).toBe(false)
  })

  // Test: Getters and setters for SyncState properties
  test('7_getters_and_setters', () => {
    const syncState = new SyncState()

    // Test created_at and updated_at
    const now = new Date()
    syncState.created_at = now
    syncState.updated_at = now
    expect(syncState.created_at).toBe(now)
    expect(syncState.updated_at).toBe(now)

    // Test userId
    syncState.userId = 123
    expect(syncState.userId).toBe(123)

    // Test storageIdentityKey
    syncState.storageIdentityKey = 'testStorageIdentityKey'
    expect(syncState.storageIdentityKey).toBe('testStorageIdentityKey')

    // Test storageName
    syncState.storageName = 'testStorageName'
    expect(syncState.storageName).toBe('testStorageName')

    // Test init
    syncState.init = true
    expect(syncState.init).toBe(true)

    // Test refNum
    syncState.refNum = 'testRefNum'
    expect(syncState.refNum).toBe('testRefNum')

    // Test status
    syncState.status = 'success'
    expect(syncState.status).toBe('success')

    // Test when
    const whenDate = new Date()
    syncState.when = whenDate
    expect(syncState.when).toBe(whenDate)

    // Test satoshis
    syncState.satoshis = 1000
    expect(syncState.satoshis).toBe(1000)
  })

  // Test: Derived properties apiErrorLocal, apiErrorOther, and apiSyncMap
  test('8_derived_properties', () => {
    const syncState = new SyncState()

    // Test apiErrorLocal and apiErrorOther
    syncState.errorLocal = { code: 'test_code', description: 'test_description', stack: 'test_stack' }
    syncState.errorOther = { code: 'test_code2', description: 'test_description2', stack: 'test_stack2' }
    expect(syncState.apiErrorLocal).toBe(JSON.stringify(syncState.errorLocal))
    expect(syncState.apiErrorOther).toBe(JSON.stringify(syncState.errorOther))

    // Test apiSyncMap with inline syncMap definition
    const syncMap: entity.SyncMap = {
      provenTx: { idMap: { 1: 2 }, entityName: 'provenTx', count: 1 },
      outputBasket: { idMap: {}, entityName: 'outputBasket', count: 0 },
      transaction: { idMap: { 3: 4 }, entityName: 'transaction', count: 1 },
      provenTxReq: { idMap: {}, entityName: 'provenTxReq', count: 0 },
      txLabel: { idMap: {}, entityName: 'txLabel', count: 0 },
      txLabelMap: { idMap: {}, entityName: 'txLabelMap', count: 0 },
      output: { idMap: {}, entityName: 'output', count: 0 },
      outputTag: { idMap: {}, entityName: 'outputTag', count: 0 },
      outputTagMap: { idMap: {}, entityName: 'outputTagMap', count: 0 },
      certificate: { idMap: {}, entityName: 'certificate', count: 0 },
      certificateField: { idMap: {}, entityName: 'certificateField', count: 0 },
      commission: { idMap: {}, entityName: 'commission', count: 0 }
    }
    syncState.syncMap = syncMap
    expect(syncState.apiSyncMap).toBe(JSON.stringify(syncMap))
  })

  // Test: id, entityName, and entityTable getters
  test('9_id_entityName_entityTable', () => {
    const syncState = new SyncState()

    // Test id getter and setter
    syncState.id = 42
    expect(syncState.id).toBe(42)

    // Test entityName
    expect(syncState.entityName).toBe('table.SyncState')

    // Test entityTable
    expect(syncState.entityTable).toBe('sync_states')
  })

  // Test: mergeNew method (does not perform any operations)
  test('10_mergeNew_does_nothing', async () => {
    const syncState = new SyncState()
    const mockStorage: entity.EntityStorage = {} as entity.EntityStorage

    const syncMap: entity.SyncMap = {
      provenTx: { idMap: {}, entityName: 'provenTx', count: 0 },
      outputBasket: { idMap: {}, entityName: 'outputBasket', count: 0 },
      transaction: { idMap: {}, entityName: 'transaction', count: 0 },
      provenTxReq: { idMap: {}, entityName: 'provenTxReq', count: 0 },
      txLabel: { idMap: {}, entityName: 'txLabel', count: 0 },
      txLabelMap: { idMap: {}, entityName: 'txLabelMap', count: 0 },
      output: { idMap: {}, entityName: 'output', count: 0 },
      outputTag: { idMap: {}, entityName: 'outputTag', count: 0 },
      outputTagMap: { idMap: {}, entityName: 'outputTagMap', count: 0 },
      certificate: { idMap: {}, entityName: 'certificate', count: 0 },
      certificateField: { idMap: {}, entityName: 'certificateField', count: 0 },
      commission: { idMap: {}, entityName: 'commission', count: 0 }
    }

    await expect(syncState.mergeNew(mockStorage, 1, syncMap, undefined)).resolves.toBeUndefined()
  })

  // Test: mergeExisting method (always returns false)
  test('11_mergeExisting_always_returns_false', async () => {
    const syncState = new SyncState()
    const mockStorage: entity.EntityStorage = {} as entity.EntityStorage

    const syncMap: entity.SyncMap = {
      provenTx: { idMap: {}, entityName: 'provenTx', count: 0 },
      outputBasket: { idMap: {}, entityName: 'outputBasket', count: 0 },
      transaction: { idMap: {}, entityName: 'transaction', count: 0 },
      provenTxReq: { idMap: {}, entityName: 'provenTxReq', count: 0 },
      txLabel: { idMap: {}, entityName: 'txLabel', count: 0 },
      txLabelMap: { idMap: {}, entityName: 'txLabelMap', count: 0 },
      output: { idMap: {}, entityName: 'output', count: 0 },
      outputTag: { idMap: {}, entityName: 'outputTag', count: 0 },
      outputTagMap: { idMap: {}, entityName: 'outputTagMap', count: 0 },
      certificate: { idMap: {}, entityName: 'certificate', count: 0 },
      certificateField: { idMap: {}, entityName: 'certificateField', count: 0 },
      commission: { idMap: {}, entityName: 'commission', count: 0 }
    }

    const result = await syncState.mergeExisting(mockStorage, new Date(), {} as table.SyncState, syncMap, undefined)
    expect(result).toBe(false)
  })
})