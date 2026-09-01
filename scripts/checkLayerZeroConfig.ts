import { publicKey } from '@metaplex-foundation/umi'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { Connection, PublicKey } from '@solana/web3.js'
import { ethers } from 'ethers'

import { EndpointProgram, UlnProgram } from '@layerzerolabs/lz-solana-sdk-v2'
import { defaultFetchMetadata } from '@layerzerolabs/metadata-tools'
import { oft } from '@layerzerolabs/oft-v2-solana-sdk'

import {
    BridgeObservation,
    ChainObservation,
    SAN_LAYERZERO_POLICY,
    UlnObservation,
    validateLayerZeroObservation,
} from './layerZeroConfigPolicy'

const SOLANA_EID = 30168
const ROBINHOOD_EID = 30416
const SOLANA_ENDPOINT = new PublicKey('76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6')
const SOLANA_OFT_PROGRAM = new PublicKey('9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD')
const SOLANA_MESSAGE_LIB = '2XgGZG4oP29U3w5h4nTk1V2LFHL23zKDPJjs3psGzLKQ'
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
})

const bytes32FromSolana = (address: string): string =>
    ethers.utils.hexlify(new PublicKey(address).toBytes()).toLowerCase()
const bytes32FromEvm = (address: string): string => ethers.utils.hexZeroPad(address, 32).toLowerCase()

const inspectRobinhood = async (
    rpcUrl: string,
    oftAddress: string,
    endpointAddress: string
): Promise<ChainObservation> => {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
    if ((await provider.getNetwork()).chainId !== 4663) throw new Error('Robinhood RPC chainId is not 4663')
    const endpoint = new ethers.Contract(
        endpointAddress,
        [
            'function getSendLibrary(address,uint32) view returns(address)',
            'function getReceiveLibrary(address,uint32) view returns(address,bool)',
        ],
        provider
    )
    const sendLibrary: string = await endpoint.getSendLibrary(oftAddress, SOLANA_EID)
    const receiveResult = await endpoint.getReceiveLibrary(oftAddress, SOLANA_EID)
    const receiveLibrary: string = receiveResult[0]
    const ulnAbi = [
        'function getUlnConfig(address,uint32) view returns ((uint64 confirmations,uint8 requiredDVNCount,uint8 optionalDVNCount,uint8 optionalDVNThreshold,address[] requiredDVNs,address[] optionalDVNs))',
        'function getAppUlnConfig(address,uint32) view returns ((uint64 confirmations,uint8 requiredDVNCount,uint8 optionalDVNCount,uint8 optionalDVNThreshold,address[] requiredDVNs,address[] optionalDVNs))',
        'function getExecutorConfig(address,uint32) view returns ((uint32 maxMessageSize,address executor))',
    ]
    const normalize = async (library: string): Promise<UlnObservation> => {
        const contract = new ethers.Contract(library, ulnAbi, provider)
        const finalConfig = await contract.getUlnConfig(oftAddress, SOLANA_EID)
        const rawConfig = await contract.getAppUlnConfig(oftAddress, SOLANA_EID)
        return {
            confirmations: BigInt(finalConfig.confirmations.toString()),
            requiredDvns: finalConfig.requiredDVNs,
            optionalDvns: finalConfig.optionalDVNs,
            optionalThreshold: finalConfig.optionalDVNThreshold,
            explicitNoRequired: rawConfig.requiredDVNCount === 255,
        }
    }
    const sendContract = new ethers.Contract(sendLibrary, ulnAbi, provider)
    const executorConfig = await sendContract.getExecutorConfig(oftAddress, SOLANA_EID)
    const oapp = new ethers.Contract(oftAddress, ['function peers(uint32) view returns(bytes32)'], provider)
    return {
        sendLibrary,
        receiveLibrary,
        executor: executorConfig.executor,
        peer: (await oapp.peers(SOLANA_EID)).toLowerCase(),
        send: await normalize(sendLibrary),
        receive: await normalize(receiveLibrary),
    }
}

const inspectSolana = async (rpcUrl: string, oftStoreAddress: string): Promise<ChainObservation> => {
    const connection = new Connection(rpcUrl, 'confirmed')
    const store = new PublicKey(oftStoreAddress)
    const endpoint = new EndpointProgram.Endpoint(SOLANA_ENDPOINT)
    const uln = new UlnProgram.Uln(new PublicKey(SAN_LAYERZERO_POLICY.solana.sendLibrary))
    const sendLibrary = await endpoint.getSendLibrary(connection, store, ROBINHOOD_EID)
    const receiveLibrary = await endpoint.getReceiveLibrary(connection, store, ROBINHOOD_EID)
    const send = await uln.getSendConfigState(connection, store, ROBINHOOD_EID)
    const receive = await uln.getReceiveConfigState(connection, store, ROBINHOOD_EID)
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
        peer: peer.toLowerCase(),
        send: normalizeSolanaUln(send),
        receive: normalizeSolanaUln(receive),
    }
}

export const checkLayerZeroConfig = async (): Promise<void> => {
    const solanaStore = requiredEnv('SAN_SOLANA_OFT_STORE')
    const robinhoodOft = ethers.utils.getAddress(requiredEnv('SAN_ROBINHOOD_OFT_ADDRESS'))
    const metadata: any = await defaultFetchMetadata(METADATA_URL)
    const robinhood = metadata['robinhood']
    const solana = metadata['solana']
    if (!robinhood || !solana) throw new Error('official LayerZero mainnet metadata is missing SAN chains')
    const robinhoodDeployment = robinhood.deployments.find((item: any) => Number(item.eid) === ROBINHOOD_EID)
    if (!robinhoodDeployment?.endpointV2?.address) throw new Error('Robinhood EndpointV2 metadata missing')
    const deprecatedDvns = [robinhood, solana].flatMap((chain: any) =>
        Object.entries(chain.dvns ?? {})
            .filter(([, value]: [string, any]) => value.deprecated === true || value.id === 'lz-dead-dvn')
            .map(([address]) => address)
    )
    const observation: BridgeObservation = {
        solana: await inspectSolana(
            process.env.SOLANA_MAINNET_RPC_URL ?? 'https://api.mainnet-beta.solana.com',
            solanaStore
        ),
        robinhood: await inspectRobinhood(
            process.env.ROBINHOOD_RPC_URL ?? 'https://rpc.mainnet.chain.robinhood.com',
            robinhoodOft,
            robinhoodDeployment.endpointV2.address
        ),
        deprecatedDvns,
    }
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
