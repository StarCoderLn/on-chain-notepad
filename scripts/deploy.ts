import { ethers } from 'hardhat'

// 部署脚本：将 OnChainNotepad 合约部署到 hardhat.config.ts 中配置的目标网络
async function main() {
  const factory = await ethers.getContractFactory('OnChainNotepad')
  const notepad = await factory.deploy()
  await notepad.waitForDeployment() // 等待部署交易上链确认
  console.log(`OnChainNotepad deployed to: ${await notepad.getAddress()}`)
}

// 部署失败时打印错误并以非零状态码退出
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
