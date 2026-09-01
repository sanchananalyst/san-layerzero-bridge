/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    reporters: [['github-actions', { silent: false }], 'default'],
    testEnvironment: 'node',
    testTimeout: 30000,
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    transform: {
        '^.+\\.(t|j)sx?$': '@swc/jest',
    },
    transformIgnorePatterns: [
        '<rootDir>/node_modules/.pnpm/(?!(uuid|rpc-websockets)@)',
        'node_modules/(?!.pnpm|uuid|rpc-websockets)',
    ],
}
