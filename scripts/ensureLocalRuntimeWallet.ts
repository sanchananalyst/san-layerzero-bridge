import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { Keypair } from '@solana/web3.js'

export const LOCAL_RUNTIME_WALLET = resolve('target/deploy/local-runtime-test-wallet.json')

export const ensureLocalRuntimeWallet = (): void => {
    if (existsSync(LOCAL_RUNTIME_WALLET)) {
        return
    }

    const wallet = Keypair.generate()
    mkdirSync(dirname(LOCAL_RUNTIME_WALLET), { recursive: true })
    writeFileSync(LOCAL_RUNTIME_WALLET, JSON.stringify(Array.from(wallet.secretKey)), {
        encoding: 'utf8',
        mode: 0o600,
        flag: 'wx',
    })
}

if (require.main === module) {
    ensureLocalRuntimeWallet()
}
