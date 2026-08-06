import '@nomicfoundation/hardhat-ethers'
import '@nomicfoundation/hardhat-verify'
import '@typechain/hardhat'
import * as dotenv from 'dotenv'

dotenv.config() // 加载 .env 中的环境变量（RPC 地址、私钥、Etherscan API Key 等）

export default {
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 } }, // 开启编译优化，runs 越大越偏向节省运行时 gas
  },
  networks: {
    // Sepolia 测试网配置，RPC 地址和部署私钥均从环境变量读取，避免硬编码敏感信息
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || '',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: { apiKey: process.env.ETHERSCAN_API_KEY }, // 用于合约源码验证
  typechain: {
    outDir: 'typechain-types', // 自动生成合约的 TypeScript 类型定义
    target: 'ethers-v6',
  },
}
