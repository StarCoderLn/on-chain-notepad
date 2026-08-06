import { strict as assert } from 'node:assert'
import { ethers } from 'hardhat'

describe('OnChainNotepad', () => {
  // 测试专用夹具：部署一份全新的合约实例，并返回两个测试账户（owner 为作者，other 为无权限账户）
  async function deployNotepad() {
    const [owner, other] = await ethers.getSigners()
    const factory = await ethers.getContractFactory('OnChainNotepad')
    const notepad = await factory.deploy()
    await notepad.waitForDeployment()
    return { notepad, owner, other }
  }

  // 验证正常流程：创建笔记 -> 更新标题/内容 -> 切换归档状态
  it('creates, updates, and archives the caller’s note', async () => {
    const { notepad, owner } = await deployNotepad()

    await notepad.createNote('第一篇笔记', '写入 Sepolia 前先在本地验证。')
    let notes = await notepad.getNotesByAuthor(owner.address)
    assert.equal(notes.length, 1)
    assert.equal(notes[0].title, '第一篇笔记')
    assert.equal(notes[0].archived, false)

    await notepad.updateNote(1, '更新后的标题', '内容已经更新。')
    await notepad.toggleArchive(1)
    notes = await notepad.getNotesByAuthor(owner.address)
    assert.equal(notes[0].title, '更新后的标题')
    assert.equal(notes[0].content, '内容已经更新。')
    assert.equal(notes[0].archived, true)
  })

  // 验证权限控制：非作者账户调用 updateNote 应被回滚
  it('does not allow another wallet to modify a note', async () => {
    const { notepad, other } = await deployNotepad()
    await notepad.createNote('私有笔记', '仅作者可以更改。')

    await assert.rejects(
      notepad.connect(other).updateNote(1, '篡改', '不应成功。'),
      /Not the note author/,
    )
  })
})
