import { sdk } from '..';
import { ChaintracksServiceClient } from './chaintracker';


export function createDefaultWalletServicesOptions(chain: sdk.Chain): sdk.WalletServicesOptions {
    const o: sdk.WalletServicesOptions = {
        chain,
        taalApiKey: chain === 'main' ? "mainnet_9596de07e92300c6287e4393594ae39c" // Tone's key, no plan
            : "testnet_0e6cf72133b43ea2d7861da2a38684e3", // Tone's personal "starter" key
        bsvExchangeRate: {
            timestamp: new Date('2023-12-13'),
            base: "USD",
            rate: 47.52
        },
        bsvUpdateMsecs: 1000 * 60 * 15, // 15 minutes
        fiatExchangeRates: {
            timestamp: new Date('2023-12-13'),
            base: "USD",
            rates: {
                "USD": 1,
                "GBP": 0.8,
                "EUR": 0.93
            }
        },
        fiatUpdateMsecs: 1000 * 60 * 60 * 24, // 24 hours
        disableMapiCallback: true, // Rely on DojoWatchman by default.
        exchangeratesapiKey: 'bd539d2ff492bcb5619d5f27726a766f',
        chaintracksFiatExchangeRatesUrl: `https://npm-registry.babbage.systems:${chain === 'main' ? 8084 : 8083}/getFiatExchangeRates`,
        chaintracks: new ChaintracksServiceClient(chain, `https://npm-registry.babbage.systems:${chain === 'main' ? 8084 : 8083}`)
    };
    return o;
}