import { Beef, Script, Transaction, TransactionInput, TransactionOutput } from '@bsv/sdk'
import { asBsvSdkScript, sdk, verifyTruthy } from '../../index.client'
import { Wallet, PendingStorageInput } from '../../Wallet'
import { makeChangeLock } from './createAction'

export function buildSignableTransaction(
  dctr: sdk.StorageCreateActionResult,
  args: sdk.ValidCreateActionArgs,
  wallet: Wallet
): {
  tx: Transaction
  amount: number
  pdi: PendingStorageInput[]
  log: string
} {
  const changeKeys = wallet.getClientChangeKeyPair()

  const inputBeef = args.inputBEEF ? Beef.fromBinary(args.inputBEEF) : undefined

  const { inputs: storageInputs, outputs: storageOutputs } = dctr

  const tx = new Transaction(args.version, [], [], args.lockTime)

  // The order of outputs in storageOutputs is always:
  // CreateActionArgs.outputs in the original order
  // Commission output
  // Change outputs
  // The Vout values will be randomized if args.options.randomizeOutputs is true. Default is true.
  const voutToIndex = Array<number>(storageOutputs.length)
  for (let vout = 0; vout < storageOutputs.length; vout++) {
    const i = storageOutputs.findIndex(o => o.vout === vout)
    if (i < 0) throw new sdk.WERR_INVALID_PARAMETER('output.vout', `sequential. ${vout} is missing`)
    voutToIndex[vout] = i
  }

  //////////////
  // Add OUTPUTS
  /////////////
  for (let vout = 0; vout < storageOutputs.length; vout++) {
    const i = voutToIndex[vout]
    const out = storageOutputs[i]
    if (vout !== out.vout)
      throw new sdk.WERR_INVALID_PARAMETER('output.vout', `equal to array index. ${out.vout} !== ${vout}`)

    const change = out.providedBy === 'storage' && out.purpose === 'change'

    const lockingScript = change
      ? makeChangeLock(out, dctr, args, changeKeys, wallet)
      : asBsvSdkScript(out.lockingScript)

    const output: TransactionOutput = {
      satoshis: out.satoshis,
      lockingScript,
      change
    }
    tx.addOutput(output)
  }

  if (storageOutputs.length === 0) {
    // Add a dummy output to avoid transaction rejection by processors for having no outputs.
    const output: TransactionOutput = {
      satoshis: 0,
      lockingScript: Script.fromASM('OP_FALSE OP_RETURN 42'),
      change: false
    }
    tx.addOutput(output)
  }

  //////////////
  // Merge and sort INPUTS info by vin order.
  /////////////
  const inputs: {
    argsInput: sdk.ValidCreateActionInput | undefined
    storageInput: sdk.StorageCreateTransactionSdkInput
  }[] = []
  for (const storageInput of storageInputs) {
    const argsInput =
      storageInput.vin !== undefined && storageInput.vin < args.inputs.length
        ? args.inputs[storageInput.vin]
        : undefined
    inputs.push({ argsInput, storageInput })
  }
  inputs.sort((a, b) =>
    a.storageInput.vin! < b.storageInput.vin! ? -1 : a.storageInput.vin! === b.storageInput.vin! ? 0 : 1
  )

  const pendingStorageInputs: PendingStorageInput[] = []

  //////////////
  // Add INPUTS
  /////////////
  let totalChangeInputs = 0
  for (const { storageInput, argsInput } of inputs) {
    // Two types of inputs are handled: user specified wth/without unlockingScript and storage specified using SABPPP template.
    if (argsInput) {
      // Type 1: User supplied input, with or without an explicit unlockingScript.
      // If without, signAction must be used to provide the actual unlockScript.
      const hasUnlock = typeof argsInput.unlockingScript === 'string'
      const unlock = hasUnlock ? asBsvSdkScript(argsInput.unlockingScript!) : new Script()
      const sourceTransaction = args.isSignAction ? inputBeef?.findTxid(argsInput.outpoint.txid)?.tx : undefined
      const inputToAdd: TransactionInput = {
        sourceTXID: argsInput.outpoint.txid,
        sourceOutputIndex: argsInput.outpoint.vout,
        // Include the source transaction for access to the outputs locking script and output satoshis for user side fee calculation.
        // TODO: Make this conditional to improve performance when user can supply locking scripts themselves.
        sourceTransaction,
        unlockingScript: unlock,
        sequence: argsInput.sequenceNumber
      }
      tx.addInput(inputToAdd)
    } else {
      // Type2: SABPPP protocol inputs which are signed using ScriptTemplateBRC29.
      if (storageInput.type !== 'P2PKH')
        throw new sdk.WERR_INVALID_PARAMETER(
          'type',
          `vin ${storageInput.vin}, "${storageInput.type}" is not a supported unlocking script type.`
        )

      pendingStorageInputs.push({
        vin: tx.inputs.length,
        derivationPrefix: verifyTruthy(storageInput.derivationPrefix),
        derivationSuffix: verifyTruthy(storageInput.derivationSuffix),
        unlockerPubKey: storageInput.senderIdentityKey,
        sourceSatoshis: storageInput.sourceSatoshis,
        lockingScript: storageInput.sourceLockingScript
      })

      const inputToAdd: TransactionInput = {
        sourceTXID: storageInput.sourceTxid,
        sourceOutputIndex: storageInput.sourceVout,
        sourceTransaction: storageInput.sourceTransaction
          ? Transaction.fromBinary(storageInput.sourceTransaction)
          : undefined,
        unlockingScript: new Script(),
        sequence: 0xffffffff
      }
      tx.addInput(inputToAdd)
      totalChangeInputs += verifyTruthy(storageInput.sourceSatoshis)
    }
  }

  // The amount is the total of non-foreign inputs minus change outputs
  // Note that the amount can be negative when we are redeeming more inputs than we are spending
  const totalChangeOutputs = storageOutputs
    .filter(x => x.purpose === 'change')
    .reduce((acc, el) => acc + el.satoshis, 0)
  const amount = totalChangeInputs - totalChangeOutputs

  return {
    tx,
    amount,
    pdi: pendingStorageInputs,
    log: ''
  }
}
