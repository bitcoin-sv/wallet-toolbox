import { AtomicBEEF, Beef, SendWithResult, SignActionArgs, SignActionResult, TXIDHexString } from '@bsv/sdk'
import { sdk, Wallet } from '../../index.client'
import { processAction } from './createAction'
import { ReviewActionResult } from '../../sdk/WalletStorage.interfaces'
import { validateSignActionArgs } from '../../sdk'
import { completeSignedTransaction, verifyUnlockScripts } from './completeSignedTransaction'
import { makeAtomicBeef } from '../../utility/utilityHelpers'

export interface SignActionResultX extends SignActionResult {
  txid?: TXIDHexString
  tx?: AtomicBEEF
  sendWithResults?: SendWithResult[]
  notDelayedResults?: ReviewActionResult[]
}

export async function signAction(wallet: Wallet, auth: sdk.AuthId, args: SignActionArgs): Promise<SignActionResultX> {
  const prior = wallet.pendingSignActions[args.reference]
  if (!prior)
    throw new sdk.WERR_NOT_IMPLEMENTED('recovery of out-of-session signAction reference data is not yet implemented.')
  if (!prior.dcr.inputBeef) throw new sdk.WERR_INTERNAL('prior.dcr.inputBeef must be valid')

  const vargs = mergePriorOptions(prior.args, args)

  prior.tx = await completeSignedTransaction(prior, vargs.spends, wallet)

  const { sendWithResults, notDelayedResults } = await processAction(prior, wallet, auth, vargs)

  const txid = prior.tx.id('hex')
  const beef = Beef.fromBinary(prior.dcr.inputBeef)
  beef.mergeTransaction(prior.tx)

  verifyUnlockScripts(txid, beef)

  const r: SignActionResultX = {
    txid: prior.tx.id('hex'),
    tx: vargs.options.returnTXIDOnly ? undefined : beef.toBinaryAtomic(txid),
    sendWithResults,
    notDelayedResults
  }

  return r
}

function mergePriorOptions(caVargs: sdk.ValidCreateActionArgs, saArgs: SignActionArgs): sdk.ValidSignActionArgs {
  const saOptions = (saArgs.options ||= {})
  if (saOptions.acceptDelayedBroadcast === undefined)
    saOptions.acceptDelayedBroadcast = caVargs.options.acceptDelayedBroadcast
  if (saOptions.returnTXIDOnly === undefined) saOptions.returnTXIDOnly = caVargs.options.returnTXIDOnly
  if (saOptions.noSend === undefined) saOptions.noSend = caVargs.options.noSend
  if (saOptions.sendWith === undefined) saOptions.sendWith = caVargs.options.sendWith
  return validateSignActionArgs(saArgs)
}
