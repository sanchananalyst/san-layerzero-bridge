import { EndpointId } from '@layerzerolabs/lz-definitions'
import { OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat'

const robinhoodSanOFT: OmniPointHardhat = {
    eid: EndpointId.ROBINHOOD_V2_MAINNET,
    contractName: 'SanOFT',
}

// Phase 1 deliberately defines no LayerZero connections. The Solana OFT Store
// does not exist yet, and DVNs, Executors, libraries, confirmations, and enforced
// options must be resolved from current official metadata and reviewed before a
// bidirectional production pathway is added.
export default {
    contracts: [{ contract: robinhoodSanOFT }],
    connections: [],
}
