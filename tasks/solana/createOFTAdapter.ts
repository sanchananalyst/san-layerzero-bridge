import { createSignerFromKeypair, publicKey, transactionBuilder } from '@metaplex-foundation/umi'
import { TOKEN_PROGRAM_ID, getMint } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import { task } from 'hardhat/config'

import { formatTokenAmount } from '@layerzerolabs/devtools'
import { types as devtoolsTypes } from '@layerzerolabs/devtools-evm-hardhat'
import { localDecimalsToMaxWholeTokens } from '@layerzerolabs/devtools-solana'
import { promptToContinue } from '@layerzerolabs/io-devtools'
import { EndpointId } from '@layerzerolabs/lz-definitions'
import { OFT_DECIMALS, oft } from '@layerzerolabs/oft-v2-solana-sdk'

import {
    requireSolanaMainnet,
    validateCanonicalSanMintAccount,
    validateSanAdapterConfig,
} from '../../scripts/sanMintConfig'
import { createSolanaConnectionFactory } from '../common/utils'

import {
    TransactionType,
    addComputeUnitInstructions,
    deriveConnection,
    deriveKeys,
    getExplorerTxLink,
    saveSolanaDeployment,
} from './index'

interface CreateOFTAdapterTaskArgs {
    /**
     * The endpoint ID for the Solana network.
     */
    eid: EndpointId

    /**
     * The token mint public key.
     */
    mint: string

    /**
     * The OFT Program id.
     */
    programId: string

    /**
     * The Token Program public key.
     */
    tokenProgram: string

    computeUnitPriceScaleFactor: number
    broadcast: boolean
}

// Define a Hardhat task for creating OFTAdapter on Solana
task('lz:oft-adapter:solana:create', 'Creates new OFT Adapter (OFT Store PDA)')
    .addParam('mint', 'The Token Mint public key')
    .addParam('programId', 'The OFT program ID')
    .addParam('eid', 'Solana mainnet (30168) or testnet (40168)', undefined, devtoolsTypes.eid)
    .addParam('tokenProgram', 'The Token Program public key', TOKEN_PROGRAM_ID.toBase58(), devtoolsTypes.string, true)
    .addParam('computeUnitPriceScaleFactor', 'The compute unit price scale factor', 4, devtoolsTypes.float, true)
    .addParam(
        'broadcast',
        'Submit the transaction in a separately authorized execution phase',
        false,
        devtoolsTypes.boolean,
        true
    )
    .setAction(
        async ({
            eid,
            mint: mintStr,
            programId: programIdStr,
            tokenProgram: tokenProgramStr,
            computeUnitPriceScaleFactor,
            broadcast,
        }: CreateOFTAdapterTaskArgs) => {
            validateSanAdapterConfig({
                eid,
                mint: mintStr,
                configuredMint: process.env.SAN_SOLANA_MINT,
                tokenProgram: tokenProgramStr,
                programId: programIdStr,
            })

            if (!broadcast) {
                console.log('SAN adapter arguments validated in dry-run mode; no transaction was built or submitted.')
                return
            }
            if (process.env.SAN_MAINNET_EXECUTION_PHASE !== 'PHASE_5B_EXPLICITLY_AUTHORIZED') {
                throw new Error('Mainnet adapter broadcast is disabled without a separately authorized execution phase')
            }

            const inspectionConnection = await createSolanaConnectionFactory()(eid)
            requireSolanaMainnet(await inspectionConnection.getGenesisHash())
            const inspectedMint = await getMint(
                inspectionConnection,
                new PublicKey(mintStr),
                undefined,
                new PublicKey(tokenProgramStr)
            )
            validateCanonicalSanMintAccount({
                decimals: inspectedMint.decimals,
                mintAuthority: inspectedMint.mintAuthority?.toBase58() ?? null,
                freezeAuthority: inspectedMint.freezeAuthority?.toBase58() ?? null,
            })

            const { connection, umi, umiWalletKeyPair, umiWalletSigner } = await deriveConnection(eid)
            const { programId, lockBox, escrowPK, oftStorePda, eddsa } = deriveKeys(programIdStr)

            const tokenProgram = publicKey(tokenProgramStr)
            const mint = publicKey(mintStr)

            const mintPDA = inspectedMint
            const mintDecimals = mintPDA.decimals

            const maxSupplyRaw = localDecimalsToMaxWholeTokens(mintDecimals)
            const { full, compact } = formatTokenAmount(maxSupplyRaw)
            const maxSupplyStatement = `The underlying token has ${mintDecimals} local decimals. Its maximum supply is ${full} (~${compact}).\n`
            const confirmMaxSupply = await promptToContinue(maxSupplyStatement)
            if (!confirmMaxSupply) {
                return
            }

            const mintAuthority = mintPDA.mintAuthority

            let txBuilder = transactionBuilder().add(
                oft.initOft(
                    {
                        payer: createSignerFromKeypair({ eddsa: eddsa }, umiWalletKeyPair),
                        admin: umiWalletKeyPair.publicKey,
                        mint: mint,
                        escrow: createSignerFromKeypair({ eddsa: eddsa }, lockBox),
                    },
                    oft.types.OFTType.Adapter,
                    OFT_DECIMALS,
                    {
                        oft: programId,
                        token: tokenProgram ? publicKey(tokenProgram) : undefined,
                    }
                )
            )
            txBuilder = await addComputeUnitInstructions(
                connection,
                umi,
                eid,
                txBuilder,
                umiWalletSigner,
                computeUnitPriceScaleFactor,
                TransactionType.InitOft
            )
            const { signature } = await txBuilder.sendAndConfirm(umi)
            console.log(`initOftTx: ${getExplorerTxLink(bs58.encode(signature), eid == EndpointId.SOLANA_V2_TESTNET)}`)

            saveSolanaDeployment(
                eid,
                programIdStr,
                mint,
                mintAuthority ? mintAuthority.toBase58() : '',
                escrowPK,
                oftStorePda
            )
        }
    )
