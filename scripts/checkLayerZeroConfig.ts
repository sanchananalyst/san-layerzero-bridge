import { publicKey } from '@metaplex-foundation/umi'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { Connection, PublicKey } from '@solana/web3.js'
import { ethers } from 'ethers'

import { EndpointPDADeriver, EndpointProgram, UlnPDADeriver, UlnProgram } from '@layerzerolabs/lz-solana-sdk-v2'
import { defaultFetchMetadata } from '@layerzerolabs/metadata-tools'
import { OftPDA, oft } from '@layerzerolabs/oft-v2-solana-sdk'

import {
    BridgeObservation,
    ChainObservation,
    SAN_LAYERZERO_POLICY,
    UlnObservation,
    validateLayerZeroObservation,
} from './layerZeroConfigPolicy'
import { SolanaCommonContextSnapshot, SolanaContextAccountRequest, toUmiRpcAccount } from './solanaCommonContext'

const SOLANA_EID = 30168
const ROBINHOOD_EID = 30416
const SOLANA_ENDPOINT = new PublicKey('76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6')
const SOLANA_OFT_PROGRAM = new PublicKey('9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD')
const SOLANA_MESSAGE_LIB = '2XgGZG4oP29U3w5h4nTk1V2LFHL23zKDPJjs3psGzLKQ'
export const PINNED_ROBINHOOD_ENDPOINT = '0x6f475642a6e85809b1c36fa62763669b1b48dd5b'
const METADATA_URL = 'https://metadata.layerzero-api.com/v1/metadata'

const requiredEnv = (name: string): string => {
    const value = process.env[name]?.trim()
    if (!value) throw new Error(`${name} is required; no SAN deployment is assumed`)
    return value
}

const asBigInt = (value: { toString(): string } | bigint | number): bigint => BigInt(value.toString())
const asAddress = (value: { toBase58(): string } | string): string =>
    typeof value === 'string' ? value : value.toBase58()

const normalizeSolanaUln = (state: any): UlnObservation => ({
    confirmations: asBigInt(state.uln.confirmations),
    requiredDvns: state.uln.requiredDvns.map(asAddress),
    optionalDvns: state.uln.optionalDvns.map(asAddress),
    optionalThreshold: state.uln.optionalDvnThreshold,
    explicitNoRequired: state.uln.requiredDvnCount === 255,
    explicitConfirmations: asBigInt(state.uln.confirmations) > 0n,
    explicitOptionalDvns:
        state.uln.optionalDvnCount > 0 && state.uln.optionalDvnCount === state.uln.optionalDvns.length,
})

const bytes32FromSolana = (address: string): string =>
    ethers.utils.hexlify(new PublicKey(address).toBytes()).toLowerCase()
const bytes32FromEvm = (address: string): string => ethers.utils.hexZeroPad(address, 32).toLowerCase()

export const inspectRobinhoodLayerZero = async (
    rpcUrl: string,
    oftAddress: string,
    endpointAddress: string,
    blockTag?: number
): Promise<ChainObservation> => {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
    if ((await provider.getNetwork()).chainId !== 4663) throw new Error('Robinhood RPC chainId is not 4663')
    const endpoint = new ethers.Contract(
        endpointAddress,
        [
            'function getSendLibrary(address,uint32) view returns(address)',
            'function isDefaultSendLibrary(address,uint32) view returns(bool)',
            'function getReceiveLibrary(address,uint32) view returns(address,bool)',
        ],
        provider
    )
    const call = blockTag == null ? {} : { blockTag }
    const sendLibrary: string = await endpoint.getSendLibrary(oftAddress, SOLANA_EID, call)
    const sendLibraryIsDefault: boolean = await endpoint.isDefaultSendLibrary(oftAddress, SOLANA_EID, call)
    const receiveResult = await endpoint.getReceiveLibrary(oftAddress, SOLANA_EID, call)
    const receiveLibrary: string = receiveResult[0]
    const ulnAbi = [
        'function getUlnConfig(address,uint32) view returns ((uint64 confirmations,uint8 requiredDVNCount,uint8 optionalDVNCount,uint8 optionalDVNThreshold,address[] requiredDVNs,address[] optionalDVNs))',
        'function getAppUlnConfig(address,uint32) view returns ((uint64 confirmations,uint8 requiredDVNCount,uint8 optionalDVNCount,uint8 optionalDVNThreshold,address[] requiredDVNs,address[] optionalDVNs))',
        'function getExecutorConfig(address,uint32) view returns ((uint32 maxMessageSize,address executor))',
        'function executorConfigs(address,uint32) view returns (uint32 maxMessageSize,address executor)',
    ]
    const normalize = async (library: string): Promise<UlnObservation> => {
        const contract = new ethers.Contract(library, ulnAbi, provider)
        const finalConfig = await contract.getUlnConfig(oftAddress, SOLANA_EID, call)
        const rawConfig = await contract.getAppUlnConfig(oftAddress, SOLANA_EID, call)
        const finalOptional = finalConfig.optionalDVNs.map((value: string) => value.toLowerCase())
        const rawOptional = rawConfig.optionalDVNs.map((value: string) => value.toLowerCase())
        return {
            confirmations: BigInt(finalConfig.confirmations.toString()),
            requiredDvns: finalConfig.requiredDVNs,
            optionalDvns: finalConfig.optionalDVNs,
            optionalThreshold: finalConfig.optionalDVNThreshold,
            explicitNoRequired: Number(rawConfig.requiredDVNCount) === 255,
            explicitConfirmations:
                BigInt(rawConfig.confirmations.toString()) > 0n &&
                BigInt(rawConfig.confirmations.toString()) === BigInt(finalConfig.confirmations.toString()),
            explicitOptionalDvns:
                Number(rawConfig.optionalDVNCount) > 0 &&
                Number(rawConfig.optionalDVNCount) === Number(finalConfig.optionalDVNCount) &&
                Number(rawConfig.optionalDVNThreshold) === Number(finalConfig.optionalDVNThreshold) &&
                JSON.stringify(rawOptional) === JSON.stringify(finalOptional),
        }
    }
    const sendContract = new ethers.Contract(sendLibrary, ulnAbi, provider)
    const executorConfig = await sendContract.getExecutorConfig(oftAddress, SOLANA_EID, call)
    const rawExecutorConfig = await sendContract.executorConfigs(oftAddress, SOLANA_EID, call)
    const oapp = new ethers.Contract(oftAddress, ['function peers(uint32) view returns(bytes32)'], provider)
    return {
        sendLibrary,
        receiveLibrary,
        executor: executorConfig.executor,
        sendLibraryExplicit: !sendLibraryIsDefault,
        receiveLibraryExplicit: !receiveResult[1],
        executorExplicit:
            Number(rawExecutorConfig.maxMessageSize) > 0 &&
            ethers.utils.getAddress(rawExecutorConfig.executor) !== ethers.constants.AddressZero &&
            ethers.utils.getAddress(rawExecutorConfig.executor) === ethers.utils.getAddress(executorConfig.executor),
        peer: (await oapp.peers(SOLANA_EID, call)).toLowerCase(),
        send: await normalize(sendLibrary),
        receive: await normalize(receiveLibrary),
    }
}

export const inspectSolanaLayerZero = async (
    rpcUrl: string,
    oftStoreAddress: string,
    minContextSlot?: number,
    snapshot?: SolanaCommonContextSnapshot
): Promise<ChainObservation> => {
    if (snapshot) return inspectSolanaLayerZeroSnapshot(oftStoreAddress, snapshot)
    const connection = new Connection(rpcUrl, 'finalized')
    const accountConfig = { commitment: 'finalized' as const, minContextSlot }
    const store = new PublicKey(oftStoreAddress)
    const endpoint = new EndpointProgram.Endpoint(SOLANA_ENDPOINT)
    const uln = new UlnProgram.Uln(new PublicKey(SAN_LAYERZERO_POLICY.solana.sendLibrary))
    const sendLibrary = await endpoint.getSendLibrary(connection, store, ROBINHOOD_EID, accountConfig)
    const receiveLibrary = await endpoint.getReceiveLibrary(connection, store, ROBINHOOD_EID, accountConfig)
    const send = await uln.getSendConfigState(connection, store, ROBINHOOD_EID, accountConfig)
    const receive = await uln.getReceiveConfigState(connection, store, ROBINHOOD_EID, accountConfig)
    if (!send || !receive) throw new Error('Solana custom send/receive ULN config is missing')
    if (!sendLibrary || !receiveLibrary) throw new Error('Solana send/receive library is missing')
    if (
        sendLibrary.msgLib.toBase58() !== SOLANA_MESSAGE_LIB ||
        receiveLibrary.msgLib.toBase58() !== SOLANA_MESSAGE_LIB
    ) {
        throw new Error('Solana resolved message-library PDA differs')
    }
    const umi = createUmi(rpcUrl)
    const peer = await oft.getPeerAddress(
        umi.rpc,
        publicKey(oftStoreAddress),
        ROBINHOOD_EID,
        publicKey(SOLANA_OFT_PROGRAM.toBase58())
    )
    return {
        sendLibrary: sendLibrary.programId.toBase58(),
        receiveLibrary: receiveLibrary.programId.toBase58(),
        executor: send.executor.executor.toBase58(),
        sendLibraryExplicit: !sendLibrary.isDefault,
        receiveLibraryExplicit: !receiveLibrary.isDefault,
        executorExplicit: send.executor.executor.toBase58() !== PublicKey.default.toBase58(),
        peer: peer.toLowerCase(),
        send: normalizeSolanaUln(send),
        receive: normalizeSolanaUln(receive),
    }
}

export const solanaLayerZeroContextAccounts = (oftStoreAddress: string): SolanaContextAccountRequest[] => {
    const store = new PublicKey(oftStoreAddress)
    const endpointDeriver = new EndpointPDADeriver(SOLANA_ENDPOINT)
    const ulnDeriver = new UlnPDADeriver(new PublicKey(SAN_LAYERZERO_POLICY.solana.sendLibrary))
    const [peer] = new OftPDA(publicKey(SOLANA_OFT_PROGRAM.toBase58())).peer(publicKey(oftStoreAddress), ROBINHOOD_EID)
    return [
        { label: 'OFT peer config', address: new PublicKey(peer.toString()) },
        { label: 'Endpoint OApp registry', address: endpointDeriver.oappRegistry(store)[0] },
        {
            label: 'Endpoint app send-library config',
            address: endpointDeriver.sendLibraryConfig(store, ROBINHOOD_EID)[0],
        },
        {
            label: 'Endpoint default send-library config',
            address: endpointDeriver.defaultSendLibraryConfig(ROBINHOOD_EID)[0],
        },
        {
            label: 'Endpoint app receive-library config',
            address: endpointDeriver.receiveLibraryConfig(store, ROBINHOOD_EID)[0],
        },
        {
            label: 'Endpoint default receive-library config',
            address: endpointDeriver.defaultReceiveLibraryConfig(ROBINHOOD_EID)[0],
        },
        { label: 'ULN message-library PDA', address: new PublicKey(SOLANA_MESSAGE_LIB) },
        { label: 'ULN custom send config', address: ulnDeriver.sendConfig(ROBINHOOD_EID, store)[0] },
        { label: 'ULN custom receive config', address: ulnDeriver.receiveConfig(ROBINHOOD_EID, store)[0] },
    ]
}

const inspectSolanaLayerZeroSnapshot = (
    oftStoreAddress: string,
    snapshot: SolanaCommonContextSnapshot
): ChainObservation => {
    const store = new PublicKey(oftStoreAddress)
    const endpointDeriver = new EndpointPDADeriver(SOLANA_ENDPOINT)
    const ulnDeriver = new UlnPDADeriver(new PublicKey(SAN_LAYERZERO_POLICY.solana.sendLibrary))
    const [peerAddress] = new OftPDA(publicKey(SOLANA_OFT_PROGRAM.toBase58())).peer(
        publicKey(oftStoreAddress),
        ROBINHOOD_EID
    )
    const peerKey = new PublicKey(peerAddress.toString())
    const peer = oft.accounts.deserializePeerConfig(toUmiRpcAccount(peerKey, snapshot.account(peerKey)))

    const sendAddress = endpointDeriver.sendLibraryConfig(store, ROBINHOOD_EID)[0]
    const receiveAddress = endpointDeriver.receiveLibraryConfig(store, ROBINHOOD_EID)[0]
    const sendLibrary = EndpointProgram.accounts.SendLibraryConfig.fromAccountInfo(snapshot.account(sendAddress))[0]
    const receiveLibrary = EndpointProgram.accounts.ReceiveLibraryConfig.fromAccountInfo(
        snapshot.account(receiveAddress)
    )[0]
    if (sendLibrary.messageLib.equals(PublicKey.default) || receiveLibrary.messageLib.equals(PublicKey.default)) {
        throw new Error('Solana send/receive library is inherited from Endpoint defaults')
    }
    if (
        sendLibrary.messageLib.toBase58() !== SOLANA_MESSAGE_LIB ||
        receiveLibrary.messageLib.toBase58() !== SOLANA_MESSAGE_LIB
    ) {
        throw new Error('Solana resolved message-library PDA differs')
    }
    const messageLibraryInfo = snapshot.account(new PublicKey(SOLANA_MESSAGE_LIB))
    const sendAddressUln = ulnDeriver.sendConfig(ROBINHOOD_EID, store)[0]
    const receiveAddressUln = ulnDeriver.receiveConfig(ROBINHOOD_EID, store)[0]
    const send = UlnProgram.accounts.SendConfig.fromAccountInfo(snapshot.account(sendAddressUln))[0]
    const receive = UlnProgram.accounts.ReceiveConfig.fromAccountInfo(snapshot.account(receiveAddressUln))[0]

    return {
        sendLibrary: messageLibraryInfo.owner.toBase58(),
        receiveLibrary: messageLibraryInfo.owner.toBase58(),
        executor: send.executor.executor.toBase58(),
        sendLibraryExplicit: true,
        receiveLibraryExplicit: true,
        executorExplicit: send.executor.executor.toBase58() !== PublicKey.default.toBase58(),
        peer: ethers.utils.hexlify(peer.peerAddress).toLowerCase(),
        send: normalizeSolanaUln(send),
        receive: normalizeSolanaUln(receive),
    }
}

export const collectLayerZeroObservation = async (
    solanaRpcUrl: string,
    robinhoodRpcUrl: string,
    solanaStore: string,
    robinhoodOft: string,
    snapshot?: { solanaMinContextSlot?: number; robinhoodBlockTag?: number },
    solanaSnapshot?: SolanaCommonContextSnapshot
): Promise<BridgeObservation> => {
    const metadata: any = await defaultFetchMetadata(METADATA_URL)
    const robinhood = metadata['robinhood']
    const solana = metadata['solana']
    if (!robinhood || !solana) throw new Error('official LayerZero mainnet metadata is missing SAN chains')
    const robinhoodDeployment = robinhood.deployments.find((item: any) => Number(item.eid) === ROBINHOOD_EID)
    if (!robinhoodDeployment?.endpointV2?.address) throw new Error('Robinhood EndpointV2 metadata missing')
    if (
        ethers.utils.getAddress(robinhoodDeployment.endpointV2.address) !==
        ethers.utils.getAddress(PINNED_ROBINHOOD_ENDPOINT)
    ) {
        throw new Error('LayerZero metadata Robinhood Endpoint differs from the pinned production Endpoint')
    }
    const deprecatedDvns = [robinhood, solana].flatMap((chain: any) =>
        Object.entries(chain.dvns ?? {})
            .filter(([, value]: [string, any]) => value.deprecated === true || value.id === 'lz-dead-dvn')
            .map(([address]) => address)
    )
    return {
        solana: await inspectSolanaLayerZero(solanaRpcUrl, solanaStore, snapshot?.solanaMinContextSlot, solanaSnapshot),
        robinhood: await inspectRobinhoodLayerZero(
            robinhoodRpcUrl,
            robinhoodOft,
            robinhoodDeployment.endpointV2.address,
            snapshot?.robinhoodBlockTag
        ),
        deprecatedDvns,
    }
}

export const checkLayerZeroConfig = async (): Promise<void> => {
    const solanaStore = requiredEnv('SAN_SOLANA_OFT_STORE')
    const robinhoodOft = ethers.utils.getAddress(requiredEnv('SAN_ROBINHOOD_OFT_ADDRESS'))
    const observation = await collectLayerZeroObservation(
        process.env.SOLANA_MAINNET_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
        process.env.ROBINHOOD_RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com',
        solanaStore,
        robinhoodOft
    )
    validateLayerZeroObservation(observation, {
        solana: bytes32FromEvm(robinhoodOft),
        robinhood: bytes32FromSolana(solanaStore),
    })
    console.log('SAN LayerZero deployed configuration matches the pinned policy.')
}

if (require.main === module) {
    checkLayerZeroConfig().catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : String(error))
        process.exitCode = 1
    })
}
