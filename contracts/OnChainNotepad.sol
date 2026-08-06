// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title OnChainNotepad - 一个个人的、内容永久保存在链上的记事本合约
contract OnChainNotepad {
    // 单篇笔记的数据结构
    struct Note {
        uint256 id; // 笔记编号，从 1 开始自增
        address author; // 笔记作者（创建者）地址
        string title; // 标题，长度限制 120 字节
        string content; // 正文内容，长度限制 5000 字节
        uint256 updatedAt; // 最后一次更新的区块时间戳
        bool archived; // 是否已归档
    }

    uint256 public noteCount; // 全局笔记计数器，同时也是最新一篇笔记的 id
    mapping(uint256 => Note) private notes; // noteId => 笔记内容
    mapping(address => uint256[]) private authorNoteIds; // 作者地址 => 其拥有的所有 noteId 列表

    // 创建/更新/归档状态变化时分别触发的事件，方便前端监听或索引
    event NoteCreated(uint256 indexed id, address indexed author, string title, uint256 timestamp);
    event NoteUpdated(uint256 indexed id, address indexed author, uint256 timestamp);
    event NoteArchiveToggled(uint256 indexed id, address indexed author, bool archived);

    // 校验调用者必须是该笔记的作者，否则回滚交易
    modifier onlyAuthor(uint256 noteId) {
        require(notes[noteId].author == msg.sender, "Not the note author");
        _;
    }

    /// @notice 创建一篇新笔记，笔记归调用者所有
    function createNote(string calldata title, string calldata content) external returns (uint256 noteId) {
        require(bytes(title).length > 0, "Title is required");
        require(bytes(title).length <= 120, "Title is too long");
        require(bytes(content).length <= 5000, "Content is too long");

        noteId = ++noteCount;
        notes[noteId] = Note(noteId, msg.sender, title, content, block.timestamp, false);
        authorNoteIds[msg.sender].push(noteId);
        emit NoteCreated(noteId, msg.sender, title, block.timestamp);
    }

    /// @notice 更新已有笔记的标题和正文，仅作者本人可调用
    function updateNote(uint256 noteId, string calldata title, string calldata content) external onlyAuthor(noteId) {
        require(bytes(title).length > 0, "Title is required");
        require(bytes(title).length <= 120, "Title is too long");
        require(bytes(content).length <= 5000, "Content is too long");
        Note storage note = notes[noteId];
        note.title = title;
        note.content = content;
        note.updatedAt = block.timestamp;
        emit NoteUpdated(noteId, msg.sender, block.timestamp);
    }

    /// @notice 切换笔记的归档状态（归档 <-> 恢复），仅作者本人可调用
    function toggleArchive(uint256 noteId) external onlyAuthor(noteId) {
        Note storage note = notes[noteId];
        note.archived = !note.archived;
        emit NoteArchiveToggled(noteId, msg.sender, note.archived);
    }

    /// @notice 按作者地址查询其名下的全部笔记
    function getNotesByAuthor(address author) external view returns (Note[] memory result) {
        uint256[] memory ids = authorNoteIds[author];
        result = new Note[](ids.length);
        for (uint256 i; i < ids.length; i++) result[i] = notes[ids[i]];
    }
}
