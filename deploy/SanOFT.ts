import assert from 'assert'

import { type DeployFunction } from 'hardhat-deploy/types'

import { EndpointId } from '@layerzerolabs/lz-definitions'

import { PRODUCTION_ROBINHOOD_ENDPOINT } from '../scripts/productionMainnetPolicy'
import { requireFutureMainnetExecution, validateSanOftDeploymentPlan } from '../scripts/productionToolingPolicy'

const contractName = 'SanOFT'

const deploy: DeployFunction = async (hre) => {
    requireFutureMainnetExecution(process.env.SAN_MAINNET_EXECUTION_PHASE)
    const { getNamedAccounts, deployments } = hre
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()
    const owner = process.env.SAN_ROBINHOOD_OWNER

    assert(deployer, 'Missing named deployer account')
    assert(owner, 'SAN_ROBINHOOD_OWNER must be a reviewed governance address')
    assert(
        hre.network.config.eid === EndpointId.ROBINHOOD_V2_MAINNET && hre.network.config.chainId === 4663,
        'SanOFT deployment is restricted to the configured Robinhood Chain mainnet network'
    )

    // EndpointV2 is resolved from LayerZero's official deployment artifacts for
    // the configured EID. No endpoint address is maintained in this repository.
    const endpointV2Deployment = await hre.deployments.get('EndpointV2')
    validateSanOftDeploymentPlan({
        chainId: hre.network.config.chainId ?? 0,
        eid: hre.network.config.eid ?? 0,
        endpoint: endpointV2Deployment.address,
        owner,
        delegate: owner,
        name: 'San Chan',
        symbol: 'SAN',
        decimals: 6,
        initialSupplyRaw: 0n,
        upgradeable: false,
    })
    assert(
        endpointV2Deployment.address.toLowerCase() === PRODUCTION_ROBINHOOD_ENDPOINT,
        'Resolved EndpointV2 differs from approved Robinhood production Endpoint'
    )

    const { address } = await deploy(contractName, {
        from: deployer,
        args: ['San Chan', 'SAN', endpointV2Deployment.address, owner],
        log: true,
        skipIfAlreadyDeployed: false,
    })

    console.log(`Deployed contract: ${contractName}, network: ${hre.network.name}, address: ${address}`)
}

deploy.tags = [contractName]

export default deploy
