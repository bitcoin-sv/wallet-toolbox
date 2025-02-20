import { Beef, HexString, Utils, WhatsOnChainConfig } from '@bsv/sdk'
import {
  asArray,
  asString,
  sdk,
  validateScriptHash,
  wait
} from '../../index.client'
import { convertProofToMerklePath } from '../../utility/tscProofToMerklePath'
import SdkWhatsOnChain from './SdkWhatsOnChain'

/**
 *
 */
export class WhatsOnChain extends SdkWhatsOnChain {
  constructor(chain: sdk.Chain = 'main', config: WhatsOnChainConfig = {}) {
    super(chain, config)
  }

  /**
   * 2025-02-16 throwing internal server error 500.
   * @param txid
   * @returns
   */
  async getTxPropagation(txid: string): Promise<number> {
    const requestOptions = {
      method: 'GET',
      headers: this.getHttpHeaders()
    }

    const response = await this.httpClient.request<string>(
      `${this.URL}/tx/hash/${txid}/propagation`,
      requestOptions
    )

    if (
      !response.data ||
      !response.ok ||
      response.status !== 200 ||
      response.statusText !== 'OK'
    )
      throw new sdk.WERR_INVALID_PARAMETER(
        'txid',
        `valid transaction. '${txid}' response ${response.statusText}`
      )

    return 0
  }

  /**
   * May return undefined for unmined transactions that are in the mempool.
   * @param txid
   * @returns raw transaction as hex string or undefined if txid not found in mined block.
   */
  async getRawTx(txid: string): Promise<string | undefined> {
    const headers = this.getHttpHeaders()
    headers['Cache-Control'] = 'no-cache'

    const requestOptions = {
      method: 'GET',
      headers
    }

    for (let retry = 0; retry < 2; retry++) {
      const response = await this.httpClient.request<string>(
        `${this.URL}/tx/${txid}/hex`,
        requestOptions
      )
      if (response.statusText === 'Too Many Requests' && retry < 2) {
        await wait(2000)
        continue
      }

      if (response.status === 404 && response.statusText === 'Not Found')
        return undefined

      if (
        !response.data ||
        !response.ok ||
        response.status !== 200 ||
        response.statusText !== 'OK'
      )
        throw new sdk.WERR_INVALID_PARAMETER(
          'txid',
          `valid transaction. '${txid}' response ${response.statusText}`
        )

      return response.data
    }
    throw new sdk.WERR_INTERNAL()
  }

  async getRawTxResult(txid: string): Promise<sdk.GetRawTxResult> {
    const r: sdk.GetRawTxResult = { name: 'WoC', txid: asString(txid) }

    try {
      const rawTxHex = await this.getRawTx(txid)
      if (rawTxHex) r.rawTx = asArray(rawTxHex)
    } catch (err: unknown) {
      r.error = sdk.WalletError.fromUnknown(err)
    }

    return r
  }

  /**
   * WhatsOnChain does not natively support a postBeef end-point aware of multiple txids of interest in the Beef.
   *
   * Send rawTx in `txids` order from beef.
   *
   * @param beef
   * @param txids
   * @returns
   */
  async postBeef(beef: Beef, txids: string[]): Promise<sdk.PostBeefResult> {
    const r: sdk.PostBeefResult = {
      name: 'WoC',
      status: 'success',
      txidResults: []
    }

    let delay = false

    for (const txid of txids) {
      const tr: sdk.PostTxResultForTxid = {
        txid,
        status: 'success'
      }

      const rawTx = Utils.toHex(beef.findTxid(txid)!.rawTx!)

      if (delay) {
        // For multiple txids, give WoC time to propagate each one.
        await wait(3000)
      }
      delay = true

      try {
        const wocTxid = await this.postRawTx(rawTx)
        if (txid !== wocTxid) {
          tr.status = 'error'
          tr.data = `woc returned txid ${wocTxid}, expected ${txid}`
        }
      } catch (eu: unknown) {
        const e = sdk.WalletError.fromUnknown(eu)
        tr.status = 'error'
        tr.data = `exception ${e.code} ${e.message}`
      }

      r.txidResults.push(tr)
    }

    return r
  }

  /**
   * @param rawTx raw transaction to broadcast as hex string
   * @returns txid returned by transaction processor of transaction broadcast
   */
  async postRawTx(rawTx: HexString): Promise<string> {
    const headers = this.getHttpHeaders()
    headers['Content-Type'] = 'application/json'
    headers['Accept'] = 'text/plain'

    const requestOptions = {
      method: 'POST',
      headers,
      data: { txhex: rawTx }
    }

    for (let retry = 0; retry < 2; retry++) {
      try {
        const response = await this.httpClient.request<string>(
          `${this.URL}/tx/raw`,
          requestOptions
        )
        if (response.statusText === 'Too Many Requests' && retry < 2) {
          await wait(2000)
          continue
        }
        if (response.ok) {
          const txid = response.data
          return txid
        } else {
          if (typeof response.data === 'string')
            throw new sdk.WERR_INVALID_PARAMETER(
              'rawTx',
              `valid. ${response.data}`
            )
          else
            throw new sdk.WERR_INVALID_PARAMETER(
              'rawTx',
              `valid. ${response.status} ${response.statusText}`
            )
        }
      } catch (eu: unknown) {
        if (eu instanceof sdk.WERR_INVALID_PARAMETER) throw eu
        const e = sdk.WalletError.fromUnknown(eu)
        throw new sdk.WERR_INVALID_PARAMETER(
          'rawTx',
          `valid rawTx. error ${e.code} ${e.message} ${rawTx}`
        )
      }
    }
    throw new sdk.WERR_INTERNAL()
  }

  /**
   * @param txid
   * @returns
   */
  async getMerklePath(
    txid: string,
    services: sdk.WalletServices
  ): Promise<sdk.GetMerklePathResult> {
    const r: sdk.GetMerklePathResult = { name: 'WoCTsc' }

    const headers = this.getHttpHeaders()
    const requestOptions = {
      method: 'GET',
      headers
    }

    for (let retry = 0; retry < 2; retry++) {
      try {
        const response = await this.httpClient.request<
          WhatsOnChainTscProof | WhatsOnChainTscProof[]
        >(`${this.URL}/tx/${txid}/proof/tsc`, requestOptions)
        if (response.statusText === 'Too Many Requests' && retry < 2) {
          await wait(2000)
          continue
        }

        if (response.status === 404 && response.statusText === 'Not Found')
          return r

        if (
          !response.ok ||
          response.status !== 200 ||
          response.statusText !== 'OK'
        )
          throw new sdk.WERR_INVALID_PARAMETER(
            'txid',
            `valid transaction. '${txid}' response ${response.statusText}`
          )

        if (!response.data) {
          // Unmined, proof not yet available.
          return r
        }

        if (!Array.isArray(response.data)) response.data = [response.data]

        if (response.data.length != 1) return r

        const p = response.data[0]
        const header = await services.hashToHeader(p.target)
        if (header) {
          const proof = {
            index: p.index,
            nodes: p.nodes,
            height: header.height
          }
          r.merklePath = convertProofToMerklePath(txid, proof)
          r.header = header
        } else {
          throw new sdk.WERR_INVALID_PARAMETER(
            'blockhash',
            'a valid on-chain block hash'
          )
        }
      } catch (err: unknown) {
        r.error = sdk.WalletError.fromUnknown(err)
      }
      return r
    }
    throw new sdk.WERR_INTERNAL()
  }

  async updateBsvExchangeRate(
    rate?: sdk.BsvExchangeRate,
    updateMsecs?: number
  ): Promise<sdk.BsvExchangeRate> {
    if (rate) {
      // Check if the rate we know is stale enough to update.
      updateMsecs ||= 1000 * 60 * 15
      if (new Date(Date.now() - updateMsecs) < rate.timestamp) return rate
    }

    const requestOptions = {
      method: 'GET',
      headers: this.getHttpHeaders()
    }

    for (let retry = 0; retry < 2; retry++) {
      const response = await this.httpClient.request<{
        rate: number
        time: number
        currency: string
      }>(`${this.URL}/exchangerate`, requestOptions)
      if (response.statusText === 'Too Many Requests' && retry < 2) {
        await wait(2000)
        continue
      }

      if (
        !response.data ||
        !response.ok ||
        response.status !== 200 ||
        response.statusText !== 'OK'
      )
        throw new sdk.WERR_INVALID_OPERATION(
          `WoC exchangerate response ${response.statusText}`
        )

      const wocrate = response.data
      if (wocrate.currency !== 'USD') wocrate.rate = NaN

      const newRate: sdk.BsvExchangeRate = {
        timestamp: new Date(),
        base: 'USD',
        rate: wocrate.rate
      }

      return newRate
    }
    throw new sdk.WERR_INTERNAL()
  }

  async getUtxoStatus(
    output: string,
    outputFormat?: sdk.GetUtxoStatusOutputFormat
  ): Promise<sdk.GetUtxoStatusResult> {
    const r: sdk.GetUtxoStatusResult = {
      name: 'WoC',
      status: 'error',
      error: new sdk.WERR_INTERNAL(),
      details: []
    }

    for (let retry = 0; ; retry++) {
      let url: string = ''

      try {
        const scriptHash = validateScriptHash(output, outputFormat)

        const requestOptions = {
          method: 'GET',
          headers: this.getHttpHeaders()
        }

        const response = await this.httpClient.request<
          WhatsOnChainUtxoStatus[]
        >(`${this.URL}/script/${scriptHash}/unspent`, requestOptions)
        if (response.statusText === 'Too Many Requests' && retry < 2) {
          await wait(2000)
          continue
        }

        if (
          !response.data ||
          !response.ok ||
          response.status !== 200 ||
          response.statusText !== 'OK'
        )
          throw new sdk.WERR_INVALID_OPERATION(
            `WoC exchangerate response ${response.statusText}`
          )

        if (Array.isArray(response.data)) {
          const data = response.data
          if (data.length === 0) {
            r.status = 'success'
            r.error = undefined
            r.isUtxo = false
          } else {
            r.status = 'success'
            r.error = undefined
            r.isUtxo = true
            for (const s of data) {
              r.details.push({
                txid: s.tx_hash,
                satoshis: s.value,
                height: s.height,
                index: s.tx_pos
              })
            }
          }
        } else {
          throw new sdk.WERR_INTERNAL('data is not an array')
        }

        return r
      } catch (eu: unknown) {
        const e = sdk.WalletError.fromUnknown(eu)
        if (e.code !== 'ECONNRESET' || retry > 2) {
          r.error = new sdk.WERR_INTERNAL(
            `service failure: ${url}, error: ${JSON.stringify(sdk.WalletError.fromUnknown(eu))}`
          )
          return r
        }
      }
    }
  }
}

interface WhatsOnChainTscProof {
  index: number
  nodes: string[]
  target: string
  txOrId: string
}

interface WhatsOnChainUtxoStatus {
  value: number
  height: number
  tx_pos: number
  tx_hash: string
}
