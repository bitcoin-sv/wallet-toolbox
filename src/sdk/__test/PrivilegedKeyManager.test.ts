import { PrivilegedKeyManager } from '../PrivilegedKeyManager'
import { Utils, PrivateKey, Hash, Random } from '@bsv/sdk'

const sampleData = [3, 1, 4, 1, 5, 9]

// A helper function to get a 32-byte hex
function getRandom32ByteHex(): string {
    const rawBytes = Random(32);
    return Utils.toHex(rawBytes);
}

describe('PrivilegedKeyManager', () => {
    it('Validates the BRC-3 compliance vector', async () => {
        const wallet = new PrivilegedKeyManager(async () => new PrivateKey(1))
        const { valid } = await wallet.verifySignature({
            data: Utils.toArray('BRC-3 Compliance Validated!', 'utf8'),
            signature: [48, 68, 2, 32, 43, 34, 58, 156, 219, 32, 50, 70, 29, 240, 155, 137, 88, 60, 200, 95, 243, 198, 201, 21, 56, 82, 141, 112, 69, 196, 170, 73, 156, 6, 44, 48, 2, 32, 118, 125, 254, 201, 44, 87, 177, 170, 93, 11, 193, 134, 18, 70, 9, 31, 234, 27, 170, 177, 54, 96, 181, 140, 166, 196, 144, 14, 230, 118, 106, 105],
            protocolID: [2, 'BRC3 Test'],
            keyID: '42',
            counterparty: '0294c479f762f6baa97fbcd4393564c1d7bd8336ebd15928135bbcf575cd1a71a1'
        })
        expect(valid).toBe(true)
    })
    it('Validates the BRC-2 HMAC compliance vector', async () => {
        const wallet = new PrivilegedKeyManager(async () => new PrivateKey('6a2991c9de20e38b31d7ea147bf55f5039e4bbc073160f5e0d541d1f17e321b8', 'hex'))
        const { valid } = await wallet.verifyHmac({
            data: Utils.toArray('BRC-2 HMAC Compliance Validated!', 'utf8'),
            hmac: [81, 240, 18, 153, 163, 45, 174, 85, 9, 246, 142, 125, 209, 133, 82, 76, 254, 103, 46, 182, 86, 59, 219, 61, 126, 30, 176, 232, 233, 100, 234, 14],
            protocolID: [2, 'BRC2 Test'],
            keyID: '42',
            counterparty: '0294c479f762f6baa97fbcd4393564c1d7bd8336ebd15928135bbcf575cd1a71a1'
        })
        expect(valid).toBe(true)
    })
    it('Validates the BRC-2 Encryption compliance vector', async () => {
        const wallet = new PrivilegedKeyManager(async () => new PrivateKey('6a2991c9de20e38b31d7ea147bf55f5039e4bbc073160f5e0d541d1f17e321b8', 'hex'))
        const { plaintext } = await wallet.decrypt({
            ciphertext: [252, 203, 216, 184, 29, 161, 223, 212, 16, 193, 94, 99, 31, 140, 99, 43, 61, 236, 184, 67, 54, 105, 199, 47, 11, 19, 184, 127, 2, 165, 125, 9, 188, 195, 196, 39, 120, 130, 213, 95, 186, 89, 64, 28, 1, 80, 20, 213, 159, 133, 98, 253, 128, 105, 113, 247, 197, 152, 236, 64, 166, 207, 113, 134, 65, 38, 58, 24, 127, 145, 140, 206, 47, 70, 146, 84, 186, 72, 95, 35, 154, 112, 178, 55, 72, 124],
            protocolID: [2, 'BRC2 Test'],
            keyID: '42',
            counterparty: '0294c479f762f6baa97fbcd4393564c1d7bd8336ebd15928135bbcf575cd1a71a1'
        })
        expect(Utils.toUTF8(plaintext)).toEqual('BRC-2 Encryption Compliance Validated!')
    })
    it('Encrypts messages decryptable by the counterparty', async () => {
        const userKey = PrivateKey.fromRandom()
        const counterpartyKey = PrivateKey.fromRandom()
        const user = new PrivilegedKeyManager(async () => userKey)
        const counterparty = new PrivilegedKeyManager(async () => counterpartyKey)
        const { ciphertext } = await user.encrypt({
            plaintext: sampleData,
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: counterpartyKey.toPublicKey().toString()
        })
        const { plaintext } = await counterparty.decrypt({
            ciphertext,
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: userKey.toPublicKey().toString()
        })
        expect(plaintext).toEqual(sampleData)
        expect(ciphertext).not.toEqual(plaintext)
    })
    it('Fails to decryupt messages for the wrong protocol, key, and counterparty', async () => {
        const userKey = PrivateKey.fromRandom()
        const counterpartyKey = PrivateKey.fromRandom()
        const user = new PrivilegedKeyManager(async () => userKey)
        const counterparty = new PrivilegedKeyManager(async () => counterpartyKey)
        const { ciphertext } = await user.encrypt({
            plaintext: sampleData,
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: counterpartyKey.toPublicKey().toString()
        })
        await expect(async () => await counterparty.decrypt({
            ciphertext,
            protocolID: [1, 'tests'],
            keyID: '4',
            counterparty: userKey.toPublicKey().toString()
        })).rejects.toThrow()
        await expect(async () => await counterparty.decrypt({
            ciphertext,
            protocolID: [2, 'tests'],
            keyID: '5',
            counterparty: userKey.toPublicKey().toString()
        })).rejects.toThrow()
        await expect(async () => await counterparty.decrypt({
            ciphertext,
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: counterpartyKey.toPublicKey().toString()
        })).rejects.toThrow()
    })
    it('Correctly derives keys for a counterparty', async () => {
        const userKey = PrivateKey.fromRandom()
        const counterpartyKey = PrivateKey.fromRandom()
        const user = new PrivilegedKeyManager(async () => userKey)
        const counterparty = new PrivilegedKeyManager(async () => counterpartyKey)
        const { publicKey: identityKey } = await user.getPublicKey({
            identityKey: true
        })
        expect(identityKey).toEqual(userKey.toPublicKey().toString())
        const { publicKey: derivedForCounterparty } = await user.getPublicKey({
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: counterpartyKey.toPublicKey().toString()
        })
        const { publicKey: derivedByCounterparty } = await counterparty.getPublicKey({
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: userKey.toPublicKey().toString(),
            forSelf: true
        })
        expect(derivedForCounterparty).toEqual(derivedByCounterparty)
    })
    it('Signs messages verifiable by the counterparty', async () => {
        const userKey = PrivateKey.fromRandom()
        const counterpartyKey = PrivateKey.fromRandom()
        const user = new PrivilegedKeyManager(async () => userKey)
        const counterparty = new PrivilegedKeyManager(async () => counterpartyKey)
        const { signature } = await user.createSignature({
            data: sampleData,
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: counterpartyKey.toPublicKey().toString()
        })
        const { valid } = await counterparty.verifySignature({
            signature,
            data: sampleData,
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: userKey.toPublicKey().toString()
        })
        expect(valid).toEqual(true)
        expect(signature.length).not.toEqual(0)
    })
    it('Directly signs hash of message verifiable by the counterparty', async () => {
        const userKey = PrivateKey.fromRandom()
        const counterpartyKey = PrivateKey.fromRandom()
        const user = new PrivilegedKeyManager(async () => userKey)
        const counterparty = new PrivilegedKeyManager(async () => counterpartyKey)
        const { signature } = await user.createSignature({
            hashToDirectlySign: Hash.sha256(sampleData),
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: counterpartyKey.toPublicKey().toString()
        })
        const { valid } = await counterparty.verifySignature({
            signature,
            data: sampleData,
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: userKey.toPublicKey().toString()
        })
        expect(valid).toEqual(true)
        const { valid: hashValid } = await counterparty.verifySignature({
            signature,
            hashToDirectlyVerify: Hash.sha256(sampleData),
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: userKey.toPublicKey().toString()
        })
        expect(hashValid).toEqual(true)
        expect(signature.length).not.toEqual(0)
    })
    it('Fails to verify signature for the wrong data, protocol, key, and counterparty', async () => {
        const userKey = PrivateKey.fromRandom()
        const counterpartyKey = PrivateKey.fromRandom()
        const user = new PrivilegedKeyManager(async () => userKey)
        const counterparty = new PrivilegedKeyManager(async () => counterpartyKey)
        const { signature } = await user.createSignature({
            data: sampleData,
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: counterpartyKey.toPublicKey().toString()
        })
        await expect(async () => await counterparty.verifySignature({
            signature,
            data: [0, ...sampleData],
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: userKey.toPublicKey().toString()
        })).rejects.toThrow()
        await expect(async () => await counterparty.verifySignature({
            signature,
            data: sampleData,
            protocolID: [2, 'wrong'],
            keyID: '4',
            counterparty: userKey.toPublicKey().toString()
        })).rejects.toThrow()
        await expect(async () => await counterparty.verifySignature({
            signature,
            data: sampleData,
            protocolID: [2, 'tests'],
            keyID: '2',
            counterparty: userKey.toPublicKey().toString()
        })).rejects.toThrow()
        await expect(async () => await counterparty.verifySignature({
            signature,
            data: sampleData,
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: counterpartyKey.toPublicKey().toString()
        })).rejects.toThrow()
    })
    it('Computes HMAC over messages verifiable by the counterparty', async () => {
        const userKey = PrivateKey.fromRandom()
        const counterpartyKey = PrivateKey.fromRandom()
        const user = new PrivilegedKeyManager(async () => userKey)
        const counterparty = new PrivilegedKeyManager(async () => counterpartyKey)
        const { hmac } = await user.createHmac({
            data: sampleData,
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: counterpartyKey.toPublicKey().toString()
        })
        const { valid } = await counterparty.verifyHmac({
            hmac,
            data: sampleData,
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: userKey.toPublicKey().toString()
        })
        expect(valid).toEqual(true)
        expect(hmac.length).toEqual(32)
    })
    it('Fails to verify HMAC for the wrong data, protocol, key, and counterparty', async () => {
        const userKey = PrivateKey.fromRandom()
        const counterpartyKey = PrivateKey.fromRandom()
        const user = new PrivilegedKeyManager(async () => userKey)
        const counterparty = new PrivilegedKeyManager(async () => counterpartyKey)
        const { hmac } = await user.createHmac({
            data: sampleData,
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: counterpartyKey.toPublicKey().toString()
        })
        await expect(async () => await counterparty.verifyHmac({
            hmac,
            data: [0, ...sampleData],
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: userKey.toPublicKey().toString()
        })).rejects.toThrow()
        await expect(async () => await counterparty.verifyHmac({
            hmac,
            data: sampleData,
            protocolID: [2, 'wrong'],
            keyID: '4',
            counterparty: userKey.toPublicKey().toString()
        })).rejects.toThrow()
        await expect(async () => await counterparty.verifyHmac({
            hmac,
            data: sampleData,
            protocolID: [2, 'tests'],
            keyID: '2',
            counterparty: userKey.toPublicKey().toString()
        })).rejects.toThrow()
        await expect(async () => await counterparty.verifyHmac({
            hmac,
            data: sampleData,
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: counterpartyKey.toPublicKey().toString()
        })).rejects.toThrow()
    })
    it('Uses anyone for creating signatures and self for other operations if no counterparty is provided', async () => {
        const userKey = PrivateKey.fromRandom()
        const user = new PrivilegedKeyManager(async () => userKey)
        const { hmac } = await user.createHmac({
            data: sampleData,
            protocolID: [2, 'tests'],
            keyID: '4'
        })
        const { valid: hmacValid } = await user.verifyHmac({
            hmac,
            data: sampleData,
            protocolID: [2, 'tests'],
            keyID: '4'
        })
        expect(hmacValid).toEqual(true)
        const { valid: explicitSelfHmacValid } = await user.verifyHmac({
            hmac,
            data: sampleData,
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: 'self'
        })
        expect(explicitSelfHmacValid).toEqual(true)
        expect(hmac.length).toEqual(32)
        const { signature: anyoneSig } = await user.createSignature({
            data: sampleData,
            protocolID: [2, 'tests'],
            keyID: '4'
            // counterparty=anyone is implicit for creating signatures
        })
        const anyone = new PrivilegedKeyManager(async () => new PrivateKey(1))
        const { valid: anyoneSigValid } = await anyone.verifySignature({
            signature: anyoneSig,
            data: sampleData,
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: userKey.toPublicKey().toString()
        })
        expect(anyoneSigValid).toEqual(true)
        const { signature: selfSig } = await user.createSignature({
            data: sampleData,
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: 'self'
        })
        const { valid: selfSigValid } = await user.verifySignature({
            signature: selfSig,
            data: sampleData,
            protocolID: [2, 'tests'],
            keyID: '4'
            // Self is implicit when verifying signatures
        })
        expect(selfSigValid).toEqual(true)
        const { valid: explicitSelfSigValid } = await user.verifySignature({
            signature: selfSig,
            data: sampleData,
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: 'self'
        })
        expect(explicitSelfSigValid).toEqual(true)
        const { publicKey } = await user.getPublicKey({
            protocolID: [2, 'tests'],
            keyID: '4'
        })
        const { publicKey: explicitSelfPublicKey } = await user.getPublicKey({
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: 'self'
        })
        expect(publicKey).toEqual(explicitSelfPublicKey)
        const { ciphertext } = await user.encrypt({
            plaintext: sampleData,
            protocolID: [2, 'tests'],
            keyID: '4'
        })
        const { plaintext } = await user.decrypt({
            ciphertext,
            protocolID: [2, 'tests'],
            keyID: '4'
        })
        const { plaintext: explicitSelfPlaintext } = await user.decrypt({
            ciphertext,
            protocolID: [2, 'tests'],
            keyID: '4',
            counterparty: 'self'
        })
        expect(plaintext).toEqual(explicitSelfPlaintext)
        expect(plaintext).toEqual(sampleData)
    })
    describe('PrivilegedKeyManager Key Linkage Revelation', () => {
        it('Validates the revealCounterpartyKeyLinkage function', async () => {
            // Initialize keys
            const proverKey = PrivateKey.fromRandom()
            const counterpartyKey = PrivateKey.fromRandom()
            const verifierKey = PrivateKey.fromRandom()

            // Initialize wallets
            const proverWallet = new PrivilegedKeyManager(async () => proverKey)
            const verifierWallet = new PrivilegedKeyManager(async () => verifierKey)

            // Prover reveals counterparty key linkage
            const revelation = await proverWallet.revealCounterpartyKeyLinkage({
                counterparty: counterpartyKey.toPublicKey().toString(),
                verifier: verifierKey.toPublicKey().toString()
            })

            // Verifier decrypts the encrypted linkage
            const { plaintext: linkage } = await verifierWallet.decrypt({
                ciphertext: revelation.encryptedLinkage,
                protocolID: [2, 'counterparty linkage revelation'],
                keyID: revelation.revelationTime,
                counterparty: proverKey.toPublicKey().toString()
            })

            // Compute expected linkage
            const expectedLinkage = proverKey.deriveSharedSecret(counterpartyKey.toPublicKey()).encode(true)

            // Compare linkage and expectedLinkage
            expect(linkage).toEqual(expectedLinkage)
        })

        it('Validates the revealSpecificKeyLinkage function', async () => {
            // Initialize keys
            const proverKey = PrivateKey.fromRandom()
            const counterpartyKey = PrivateKey.fromRandom()
            const verifierKey = PrivateKey.fromRandom()

            // Initialize wallets
            const proverWallet = new PrivilegedKeyManager(async () => proverKey)
            const verifierWallet = new PrivilegedKeyManager(async () => verifierKey)

            const protocolID: [0 | 1 | 2, string] = [0, 'tests']
            const keyID = 'test key id'

            // Prover reveals specific key linkage
            const revelation = await proverWallet.revealSpecificKeyLinkage({
                counterparty: counterpartyKey.toPublicKey().toString(),
                verifier: verifierKey.toPublicKey().toString(),
                protocolID,
                keyID
            })

            // Verifier decrypts the encrypted linkage
            const { plaintext: linkage } = await verifierWallet.decrypt({
                ciphertext: revelation.encryptedLinkage,
                protocolID: [2, `specific linkage revelation ${protocolID[0]} ${protocolID[1]}`],
                keyID,
                counterparty: proverKey.toPublicKey().toString()
            })

            // Compute expected linkage
            const sharedSecret = proverKey.deriveSharedSecret(counterpartyKey.toPublicKey()).encode(true)

            // Function to compute the invoice number
            const computeInvoiceNumber = function (protocolID, keyID) {
                const securityLevel = protocolID[0]
                if (!Number.isInteger(securityLevel) || securityLevel < 0 || securityLevel > 2) {
                    throw new Error('Protocol security level must be 0, 1, or 2')
                }
                const protocolName = protocolID[1].toLowerCase().trim()
                if (keyID.length > 800) {
                    throw new Error('Key IDs must be 800 characters or less')
                }
                if (keyID.length < 1) {
                    throw new Error('Key IDs must be 1 character or more')
                }
                if (protocolName.length > 400) {
                    throw new Error('Protocol names must be 400 characters or less')
                }
                if (protocolName.length < 5) {
                    throw new Error('Protocol names must be 5 characters or more')
                }
                if (protocolName.includes('  ')) {
                    throw new Error('Protocol names cannot contain multiple consecutive spaces ("  ")')
                }
                if (!/^[a-z0-9 ]+$/g.test(protocolName)) {
                    throw new Error('Protocol names can only contain letters, numbers and spaces')
                }
                if (protocolName.endsWith(' protocol')) {
                    throw new Error('No need to end your protocol name with " protocol"')
                }
                return `${securityLevel}-${protocolName}-${keyID}`
            }
            const invoiceNumber = computeInvoiceNumber(protocolID, keyID)
            const invoiceNumberBin = Utils.toArray(invoiceNumber, 'utf8')

            // Compute expected linkage
            const expectedLinkage = Hash.sha256hmac(sharedSecret, invoiceNumberBin)

            // Compare linkage and expectedLinkage
            expect(linkage).toEqual(expectedLinkage)
        })
    })
    describe('PrivilegedKeyManager - Internal Logic Tests', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });
        afterEach(() => {
            jest.clearAllTimers();
            jest.useRealTimers();
        });
        it('Calls keyGetter only once if getPrivilegedKey is invoked multiple times within retention period', async () => {
            // Create a mock keyGetter that returns a PrivateKey
            const keyGetterMock = jest.fn(async (reason: string) => {
                return new PrivateKey(getRandom32ByteHex(), 'hex');
            });

            // Retention period is 100 ms for testing
            const km = new PrivilegedKeyManager(keyGetterMock, 100);

            // 1) First call, should call keyGetter once
            const key1 = await (km as any).getPrivilegedKey('first reason');
            expect(keyGetterMock).toHaveBeenCalledTimes(1);

            // 2) Second call, if within retention, should NOT call keyGetter again
            const key2 = await (km as any).getPrivilegedKey('second reason');
            expect(keyGetterMock).toHaveBeenCalledTimes(1);

            // 3) Check that both keys match the same underlying private key
            expect(key1.toHex()).toBe(key2.toHex());
        });

        it('Destroys key after retention period elapses', async () => {
            const keyGetterMock = jest.fn(async (reason: string) => {
                return new PrivateKey(getRandom32ByteHex(), 'hex');
            });

            const retentionMs = 200;
            const km = new PrivilegedKeyManager(keyGetterMock, retentionMs);

            // Acquire the key
            await (km as any).getPrivilegedKey('test reason');

            // We have chunkPropNames set
            expect((km as any).chunkPropNames.length).toBeGreaterThan(0);

            // Fast-forward time beyond the retention period
            jest.advanceTimersByTime(retentionMs + 1);

            // The destroyKey logic should have run
            expect((km as any).chunkPropNames.length).toBe(0);
            expect((km as any).chunkPadPropNames.length).toBe(0);
            expect((km as any).decoyPropNamesDestroy.length).toBe(0);
        });

        it('Explicitly calls destroyKey() and removes all chunk properties', async () => {
            const keyGetterMock = jest.fn(async (reason: string) => {
                return new PrivateKey(getRandom32ByteHex(), 'hex');
            });
            const km = new PrivilegedKeyManager(keyGetterMock, 5000);

            // Acquire the key
            await (km as any).getPrivilegedKey('destroy test');

            // Verify chunk props exist
            expect((km as any).chunkPropNames.length).toBeGreaterThan(0);
            expect((km as any).chunkPadPropNames.length).toBeGreaterThan(0);

            // Explicitly call destroyKey
            (km as any).destroyKey();

            // Now chunkPropNames and chunkPadPropNames should be cleared
            expect((km as any).chunkPropNames.length).toBe(0);
            expect((km as any).chunkPadPropNames.length).toBe(0);
        });

        it('Reuses in-memory obfuscated key if data is valid, otherwise fetches a new key', async () => {
            const mockHex = getRandom32ByteHex();
            const keyGetterMock = jest.fn(async () => new PrivateKey(mockHex, 'hex'));

            const km = new PrivilegedKeyManager(keyGetterMock, 5000);

            // 1) First retrieval => calls keyGetter
            const key1 = await (km as any).getPrivilegedKey('reuse test');
            expect(keyGetterMock).toHaveBeenCalledTimes(1);
            expect(key1.toHex()).toBe(mockHex);

            // 2) Tamper with chunk data so reassembleKeyFromChunks returns null
            // We can zero out one chunk or remove it
            (km as any)[(km as any).chunkPropNames[0]] = undefined;

            // 3) Second retrieval => chunk data is invalid => calls keyGetter again
            const key2 = await (km as any).getPrivilegedKey('reuse test 2');
            expect(keyGetterMock).toHaveBeenCalledTimes(2);
            // The newly fetched key must still match mockHex,
            // because the mock always returns the same key.
            expect(key2.toHex()).toBe(mockHex);
        });

        it('Ensures chunk-splitting logic is correct for a 32-byte key', () => {
            const km = new PrivilegedKeyManager(async () => new PrivateKey(1), 5000);

            const testBytes = new Uint8Array(32);
            // Fill with some pattern, e.g. 0..31
            testBytes.forEach((_, i) => { testBytes[i] = i; });

            const chunks = (km as any).splitKeyIntoChunks(testBytes);
            expect(chunks.length).toBe((km as any).CHUNK_COUNT);

            // By default CHUNK_COUNT = 4
            // Typically each chunk would be 8 bytes (for a 32-byte key).
            chunks.forEach((chunk: Uint8Array, i: number) => {
                if (i < 3) {
                    expect(chunk.length).toBe(8);
                } else {
                    // last chunk picks up leftover
                    expect(chunk.length).toBe(8);
                }
            });

            // Reassemble logic typically is done by reassembleKeyFromChunks,
            // but let's test it in isolation. We'll XOR with random pads,
            // store them, reassemble, etc.

            // For demonstration, we can do a quick test:
            const pad = chunks.map((c: Uint8Array) => Uint8Array.from(Random(c.length)));
            const obfuscated = chunks.map((c: Uint8Array, i: number) => (km as any).xorBytes(c, pad[i]));

            // Then "store" and reassemble
            (km as any).chunkPropNames = [];
            (km as any).chunkPadPropNames = [];
            obfuscated.forEach((obf: Uint8Array, i: number) => {
                const chunkProp = `chunk${i}`;
                const padProp = `pad${i}`;
                (km as any).chunkPropNames.push(chunkProp);
                (km as any).chunkPadPropNames.push(padProp);
                (km as any)[chunkProp] = obf;
                (km as any)[padProp] = pad[i];
            });
            const reassembled = (km as any).reassembleKeyFromChunks();
            expect(reassembled.length).toBe(32);
            expect(Array.from(reassembled)).toEqual(Array.from(testBytes));
        });

        it('XOR function works as expected', () => {
            const km = new PrivilegedKeyManager(async () => new PrivateKey(1), 5000);
            const a = Uint8Array.from([0, 1, 255]);
            const b = Uint8Array.from([255, 1, 0]);

            const result = (km as any).xorBytes(a, b);
            // 0 ^ 255 = 255, 1 ^ 1 = 0, 255 ^ 0 = 255
            expect(Array.from(result)).toEqual([255, 0, 255]);

            // XOR with zero array => same array
            const zero = new Uint8Array(3);
            const result2 = (km as any).xorBytes(a, zero);
            expect(Array.from(result2)).toEqual([0, 1, 255]);
        });

        it('Generates random property names', () => {
            const km = new PrivilegedKeyManager(async () => new PrivateKey(1), 5000);
            const prop1 = (km as any).generateRandomPropName();
            const prop2 = (km as any).generateRandomPropName();
            expect(prop1).not.toBe(prop2);
            // Just check format (roughly)
            expect(prop1).toMatch(/^_[0-9a-f]{8}_[0-9]{1,6}$/);
            expect(prop2).toMatch(/^_[0-9a-f]{8}_[0-9]{1,6}$/);
        });

        it('Sets up initial decoy properties in the constructor', () => {
            const km = new PrivilegedKeyManager(async () => new PrivateKey(1), 5000);
            // decoyPropNamesRemain has length 2
            expect((km as any).decoyPropNamesRemain.length).toBe(2);
            // Validate those properties actually exist on the object
            for (const propName of (km as any).decoyPropNamesRemain) {
                expect((km as any)[propName]).toBeInstanceOf(Uint8Array);
                expect((km as any)[propName].length).toBe(16);
            }
        });

        it('New decoy properties are created on each key fetch and destroyed on destroy', async () => {
            const km = new PrivilegedKeyManager(async () => new PrivateKey(1), 5000);
            await (km as any).getPrivilegedKey('decoy test');

            // We should have 2 decoy props that remain, plus 2 that are "destroyable"
            expect((km as any).decoyPropNamesRemain.length).toBe(2);
            expect((km as any).decoyPropNamesDestroy.length).toBe(2);

            // Destroy them
            (km as any).destroyKey();
            expect((km as any).decoyPropNamesDestroy.length).toBe(0);
        });
    });
})