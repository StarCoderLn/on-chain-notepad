import { run } from 'hardhat'

// 合约验证脚本：在 Etherscan 上开源验证已部署的合约代码
const address = process.env.NOTE_CONTRACT_ADDRESS
if (!address) throw new Error('Set NOTE_CONTRACT_ADDRESS before verification.')

// 合约构造函数无参数，因此 constructorArguments 传空数组
run('verify:verify', { address, constructorArguments: [] })
  .then(() => console.log(`Verified: ${address}`))
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
