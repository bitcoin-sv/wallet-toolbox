import { getHeight, getNetwork } from '@babbage/sdk-ts';
import { sdk } from '../../src';
import { Wallet } from '../../src/Wallet';
import { jest } from '@jest/globals';

/**
 * Logging Utility
 * Centralized logging for debugging test cases.
 */
let logEnabled: boolean = true;

export const setLogging = (enabled: boolean): void => {
    logEnabled = enabled;
};

export const log = (message: string, ...optionalParams: any[]): void => {
    if (logEnabled) {
        console.log(`[LOG] ${message}`, ...optionalParams);
    }
};

/**
 * Mock Utilities
 * Provides reusable mock implementations for WalletSigner and KeyDeriver.
 */
export const mockWalletSigner = (): any => ({
    isAuthenticated: jest.fn().mockReturnValue(true),
    storageIdentity: { storageIdentityKey: 'mockStorageKey' },
    getClientChangeKeyPair: jest.fn().mockReturnValue({ publicKey: 'mockPublicKey' }),
    chain: 'test',
    getChain: jest.fn(),
    getHeaderForHeight: jest.fn(),
    getHeight: jest.fn(),
    getNetwork: jest.fn(),
    listCertificatesSdk: jest.fn(),
    acquireCertificateSdk: jest.fn(),
    relinquishCertificateSdk: jest.fn(),
    proveCertificateSdk: jest.fn(),
    discoverByIdentityKeySdk: jest.fn(),
    discoverByAttributesSdk: jest.fn(),
});


export const mockKeyDeriver = (): any => ({
    rootKey: {
        deriveChild: jest.fn(),
        toPublicKey: jest.fn(() => ({ toString: jest.fn().mockReturnValue('mockIdentityKey') })),
    },
    identityKey: 'mockIdentityKey',
    derivePublicKey: jest.fn(),
    derivePrivateKey: jest.fn(),
    deriveSymmetricKey: jest.fn(),
    revealCounterpartySecret: jest.fn(),
    revealSpecificSecret: jest.fn(),
});

/**
 * Argument and Response Generators
 * Creates reusable test data for arguments and expected responses.
 */
export const generateListCertificatesArgs = (overrides = {}): sdk.ListCertificatesArgs => ({
    certifiers: [],
    types: [],
    limit: 10,
    offset: 0,
    privileged: false,
    ...overrides,
});

export const generateMockCertificatesResponse = (overrides = {}): any => ({
    certificates: [],
    ...overrides,
});

export const generateAcquireCertificateArgs = (overrides = {}): sdk.AcquireCertificateArgs => ({
    type: 'mockType', // Base64String: A valid certificate type
    certifier: 'mockCertifier', // PubKeyHex: Certifier's public key
    acquisitionProtocol: 'direct', // AcquisitionProtocol: 'direct' or 'issuance'
    fields: { fieldName: 'mockValue' }, // Record of CertificateFieldNameUnder50Bytes to string
    serialNumber: 'mockSerialNumber', // Optional: Base64String for the serial number
    revocationOutpoint: 'mockTxid.0', // Optional: OutpointString for revocation
    signature: 'mockSignature', // Optional: HexString for signature
    keyringRevealer: 'certifier', // Optional: KeyringRevealer
    keyringForSubject: { fieldName: 'mockKeyringValue' }, // Optional: Record for keyring
    privileged: false, // Optional: BooleanDefaultFalse for privileged access
    privilegedReason: 'Testing', // Optional: DescriptionString5to50Bytes for privileged reason
    ...overrides, // Allow overrides for specific test cases
});


export const generateMockAcquireCertificateResponse = (overrides = {}): any => ({
    success: true,
    ...overrides,
});

export const generateRelinquishCertificateArgs = (overrides = {}): sdk.RelinquishCertificateArgs => ({
    type: 'mockType', // Base64String: A valid certificate type
    serialNumber: 'mockSerialNumber', // Base64String: The certificate's serial number
    certifier: 'mockCertifier', // PubKeyHex: Certifier's public key
    ...overrides, // Allow overrides for specific test cases
});


export const generateMockRelinquishCertificateResponse = (overrides = {}): any => ({
    success: true,
    ...overrides,
});

export const generateProveCertificateArgs = (overrides = {}): sdk.ProveCertificateArgs => ({
    certificate: {
        type: 'mockType',
        certifier: 'mockCertifier',
        serialNumber: 'mockSerialNumber',
    }, // Mock partial WalletCertificate
    fieldsToReveal: ['name', 'email'], // Mock fields to reveal (adjust as per valid field names in your schema)
    verifier: 'mockVerifierPublicKey', // Mock verifier's public key
    privileged: false, // Default to non-privileged
    privilegedReason: 'Testing', // Reason for privileged access (if needed)
    ...overrides, // Allow specific overrides for testing
});



export const generateMockProveCertificateResponse = (overrides = {}): any => ({
    proof: 'mockProof',
    ...overrides,
});

export const generateDiscoverByIdentityKeyArgs = (overrides = {}): sdk.DiscoverByIdentityKeyArgs => ({
    identityKey: 'mockIdentityKey',
    ...overrides,
});

export const generateMockDiscoverByIdentityKeyResponse = (overrides = {}): any => ({
    certificates: [],
    ...overrides,
});

export const generateDiscoverByAttributesArgs = (overrides = {}): sdk.DiscoverByAttributesArgs => ({
    attributes: { mockAttribute: 'value' },
    ...overrides,
});

export const generateMockDiscoverByAttributesResponse = (overrides = {}): any => ({
    certificates: [],
    ...overrides,
});

/**
 * Validation Helpers
 * Provides functions to validate results and handle errors in tests.
 */
export const validateCertificatesResponse = (result: any, expected: any): void => {
    expect(result).toEqual(expected);
};

export const validateAcquireCertificateResponse = (result: any, expected: any): void => {
    expect(result).toEqual(expected);
};

export const validateRelinquishCertificateResponse = (result: any, expected: any): void => {
    expect(result).toEqual(expected);
};

export const validateProveCertificateResponse = (result: any, expected: any): void => {
    expect(result).toEqual(expected);
};

export const validateDiscoverByIdentityKeyResponse = (result: any, expected: any): void => {
    expect(result).toEqual(expected);
};

export const validateDiscoverByAttributesResponse = (result: any, expected: any): void => {
    expect(result).toEqual(expected);
};

/**
 * Test Utilities
 * Sets up a mock Wallet instance and associated dependencies for tests.
 */
export const setupTestWallet = (): { wallet: Wallet; mockSigner: any; mockKeyDeriver: any } => {
    const mockSigner = mockWalletSigner();
    const mockKeyDeriverInstance = mockKeyDeriver();
    const wallet = new Wallet(mockSigner, mockKeyDeriverInstance);
    return { wallet, mockSigner, mockKeyDeriver: mockKeyDeriverInstance };
};