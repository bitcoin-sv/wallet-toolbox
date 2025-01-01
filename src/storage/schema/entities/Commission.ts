/* eslint-disable @typescript-eslint/no-unused-vars */
import { MerklePath } from "@bsv/sdk"
import { arraysEqual, entity, sdk, table, verifyId, verifyOneOrNone } from "../../..";
import { EntityBase } from ".";

export class Commission extends EntityBase<table.Commission> {
    constructor(api?: table.Commission) {
        const now = new Date()
        super(api || {
            commissionId: 0,
            created_at: now,
            updated_at: now,
            transactionId: 0,
            userId: 0,
            isRedeemed: false,
            keyOffset: "",
            lockingScript: [],
            satoshis: 0
        })
    }

    override updateApi(): void {
        /* nothing needed yet... */
    }

    get commissionId() { return this.api.commissionId }
    set commissionId(v: number) { this.api.commissionId = v }
    get created_at() { return this.api.created_at }
    set created_at(v: Date) { this.api.created_at = v }
    get updated_at() { return this.api.updated_at }
    set updated_at(v: Date) { this.api.updated_at = v }
    get transactionId() { return this.api.transactionId }
    set transactionId(v: number) { this.api.transactionId = v }
    get userId() { return this.api.userId }
    set userId(v: number) { this.api.userId = v }
    get isRedeemed() { return this.api.isRedeemed }
    set isRedeemed(v: boolean) { this.api.isRedeemed = v }
    get keyOffset() { return this.api.keyOffset }
    set keyOffset(v: string) { this.api.keyOffset = v }
    get lockingScript() { return this.api.lockingScript }
    set lockingScript(v: number[]) { this.api.lockingScript = v }
    get satoshis() { return this.api.satoshis }
    set satoshis(v: number) { this.api.satoshis = v }

    override get id(): number { return this.api.commissionId }
    override set id(v: number) { this.api.commissionId = v }
    override get entityName(): string { return 'Commission' }
    override get entityTable(): string { return 'commissions' }
    
    override equals(ei: table.Commission, syncMap?: entity.SyncMap | undefined): boolean {
        if (
            this.isRedeemed !== ei.isRedeemed ||
            this.transactionId !== (syncMap ? syncMap.transaction.idMap[ei.transactionId] : ei.transactionId) ||
            this.keyOffset !== ei.keyOffset ||
            !arraysEqual(this.lockingScript, ei.lockingScript) ||
            this.satoshis !== ei.satoshis
        )
            return false

        return true
    }

    static async mergeFind(storage: sdk.WalletStorage, userId: number, ei: table.Commission, syncMap: entity.SyncMap, trx?: sdk.TrxToken)
    : Promise<{ found: boolean, eo: entity.Commission, eiId: number }> {
        const transactionId = syncMap.transaction.idMap[ei.transactionId]
        const ef = verifyOneOrNone(await storage.findCommissions({ transactionId, userId }, undefined, undefined, trx))
        return {
            found: !!ef,
            eo: new entity.Commission(ef || { ...ei }),
            eiId: verifyId(ei.commissionId)
        }
    }

    override async mergeNew(storage: sdk.WalletStorage, userId: number, syncMap: entity.SyncMap, trx?: sdk.TrxToken): Promise<void> {
        if (this.transactionId) this.transactionId = syncMap.transaction.idMap[this.transactionId]
        this.userId = userId
        this.commissionId = 0
        this.commissionId = await storage.insertCommission(this.toApi(), trx)
    }

    override async mergeExisting(storage: sdk.WalletStorage, since: Date | undefined, ei: table.Commission, syncMap: entity.SyncMap, trx?: sdk.TrxToken): Promise<boolean> {
        let wasMerged = false
        if (ei.updated_at > this.updated_at) {
            this.isRedeemed = ei.isRedeemed
            this.updated_at = new Date()
            await storage.updateCommission(this.id, this.toApi(), trx)
            wasMerged = true
        }
        return wasMerged
    }
}