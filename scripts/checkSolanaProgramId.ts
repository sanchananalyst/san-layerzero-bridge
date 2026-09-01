import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { PublicKey } from '@solana/web3.js'

export const SAN_OFT_PROGRAM_ID = '9myHzfqsbJfGbYxpCvVCYqLaB4Co1RCo2a8T4QSkTvcD'
export const STARTER_OFT_PROGRAM_ID = '9UovNrJD8pQyBLheeHNayuG1wJSEAoxkmM14vw5gcsTT'

const fail = (message: string): never => {
    throw new Error(`SAN program-ID check failed: ${message}`)
}

export const countBytes = (haystack: Buffer, needle: Uint8Array): number => {
    let count = 0
    let offset = 0
    while ((offset = haystack.indexOf(needle, offset)) !== -1) {
        count += 1
        offset += needle.length
    }
    return count
}

export const checkSolanaProgramId = (): void => {
    const anchorConfig = readFileSync(resolve('Anchor.toml'), 'utf8')
    const programSource = readFileSync(resolve('programs/oft/src/lib.rs'), 'utf8')
    const idl = JSON.parse(readFileSync(resolve('target/idl/oft.json'), 'utf8')) as { address?: string }
    const elf = readFileSync(resolve('target/deploy/oft.so'))
    const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)

    if (!anchorConfig.includes(`oft = "${SAN_OFT_PROGRAM_ID}"`)) fail('Anchor.toml does not pin SAN OFT')
    if (!programSource.includes(`"${SAN_OFT_PROGRAM_ID}"`)) fail('declare_id fallback is not SAN OFT')
    if (idl.address !== SAN_OFT_PROGRAM_ID) fail(`IDL address is ${String(idl.address)}`)
    const sanIdOccurrences = countBytes(elf, new PublicKey(SAN_OFT_PROGRAM_ID).toBytes())
    const starterIdOccurrences = countBytes(elf, new PublicKey(STARTER_OFT_PROGRAM_ID).toBytes())
    if (sanIdOccurrences < 1) fail('ELF does not embed SAN OFT')
    if (programSource.includes(STARTER_OFT_PROGRAM_ID)) fail('source still contains starter OFT ID')
    if (idl.address === STARTER_OFT_PROGRAM_ID) fail('IDL still uses starter OFT ID')
    if (starterIdOccurrences !== 0) fail('ELF still embeds starter OFT ID')

    const trackedSecrets = trackedFiles.filter(
        (path) =>
            existsSync(resolve(path)) &&
            (/(^|\/)(?:.*-)?keypair\.json$/i.test(path) ||
                /(^|\/)(?:junk-id|id)\.json$/i.test(path) ||
                /\.(?:pem|key|mnemonic)$/i.test(path))
    )
    if (trackedSecrets.length > 0) fail(`tracked key material: ${trackedSecrets.join(', ')}`)

    console.log(`SAN OFT program ID: ${SAN_OFT_PROGRAM_ID}`)
    console.log('Anchor.toml: match')
    console.log('programs/oft/src/lib.rs: match')
    console.log('target/idl/oft.json: match')
    console.log(`target/deploy/oft.so SAN ID embedded occurrences: ${sanIdOccurrences}`)
    console.log(`target/deploy/oft.so starter ID embedded occurrences: ${starterIdOccurrences}`)
    console.log('Tracked key material present in working tree: none')
}

if (require.main === module) {
    checkSolanaProgramId()
}
