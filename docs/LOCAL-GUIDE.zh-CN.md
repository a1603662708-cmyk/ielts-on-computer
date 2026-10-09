# IELTS Simulator 本地使用指南

## 打开软件

最终桌面版：

`/Users/yanglinxuan/Documents/Codex/2026-10-09/files-pasted-by-the-user-mac/outputs/IELTS Simulator.app`

双击即可启动，不需要 Docker、Node、数据库或常驻后台服务。第一次使用 Speaking 时允许麦克风权限。请使用同一份 App；内置数据由 macOS WebKit 的本地存储管理。

源项目：

`/Users/yanglinxuan/Documents/Codex/2026-10-09/files-pasted-by-the-user-mac/ielts-on-computer`

`outputs/IELTS-Simulator-Source` 是指向源项目的便捷链接。

Web 版：在源项目中运行 `npm run build`，然后 `npm start`，访问 `http://127.0.0.1:4173`。或者双击输出目录中的 `Start IELTS Simulator.command`。开发模式是 `npm run dev -- --hostname 127.0.0.1`。

## 导入 Cambridge 或其他自有题目

1. 进入 **Import**。只导入你合法持有的文件。
2. 新建测试，或从列表选择已经导入的测试以补齐其他科目。
3. 选择 Reading / Listening / Writing / Speaking，上传 PDF、DOCX、TXT、JSON、图片或 MP3/M4A/WAV。题库备份使用 `.ielts.zip`。
4. PDF 和 DOCX 会提取可读文本；核对左侧文本后点击 **Create section draft**。解析器只识别编号问题和 A–H 选项，不会可靠判断所有 IELTS 题型。扫描 PDF 没有 OCR，需你手工录入文字或事先做 OCR。
5. 在右侧 JSON 修改 `book`（例如 Cambridge IELTS 19）、`test`、`title`，核对 passage、parts、题型、题号、word limit 和答案。完整结构可下载原创示例。旧版 questions.json 应先导入，再选择对应科目导入 answers.json。
6. 为音频选择 Part 1–4，点击 **Attach media to JSON**。整套一个文件选择 Part 1。图片关联 Reading/Listening 对应 Part 的第一题组，或 Writing Task 1/2；需要移动图片时修改 JSON。
7. **Validate & preview**，逐项核对，勾选确认后 **Save to local Library**。低置信度或缺答案会明确提示。
8. Library 会出现你填写的书名和 Test。没有导入的科目显示 “Not imported”。不会默认附带 Cambridge 版权内容。

导入的结构化数据保存在 IndexedDB。**Export test + media ZIP** 会导出按 Book/Test/Section 分类的文件夹和全部媒体，方便备份或在 Web/App 之间迁移。单独的 `asset:` JSON 不包含音频/图片文件。

## 考试与练习

**Practice**：可单独选择 Passage/Part，听力可暂停、重听、调速，听读可查看答案；听读写可不限时。Speaking 可以停止、删除并重新录制。

**Mock**：听力不提供暂停、拖动或重播；隐藏答案；统一严格计时。Full Mock 要求完整 40 题 Listening、40 题 Reading 和 Writing。顺序是 Listening → Reading → Writing。Speaking 单独进行。允许提前提交，但提交确认后不可修改该科作答。中途不会显示成绩。

听力默认约 30 分钟音频时间加 2 分钟检查；完整录音更长时以预检后的录音总长加检查时间设置。原创演示录音很短，只用于功能演示，不能代表真实 IELTS 难度或时长。

Reading 左右分别滚动。选中文章或题目文字后可 Highlight / Note。点击高亮可删除，笔记会自动保存。底部题号显示已答下划线、Flag 和当前题边框。Notes 可重新打开已有笔记；New note 可写一般笔记。

Writing 共用 60 分钟，Task 1 建议 20 分钟、Task 2 建议 40 分钟。始终显示 Words，禁用编辑框的拼写检查、自动纠正与自动完成。完成后可导出 TXT / Markdown。

Speaking 是练习模拟器，不是真人考官。每题有真实录音、开始时间和时长。Part 2 自动从 01:00 准备切换到 02:00 作答。录音优先 WebM/Opus，浏览器不支持时回退 MP4。只有真实录制的音频才会出现在列表中。

## 设置与快捷键

Options → Contrast：黑字白底、白字黑底、黄字黑底。

Options → Text Size：Small / Medium / Large。

音量在 Listening 底部调整并保存。退出全屏会提示；不会锁住电脑。Start Fullscreen 可以重新进入。

- Option/Alt + N：下一题。
- Option/Alt + P：上一题。
- Option/Alt + F：Flag 当前题。

快捷键不会拦截文本框、选择框或可编辑区域内的输入。

## 成绩、历史与错题

听读按答案键评分，输出实际 Raw Score（完整题 /40）和 Estimated Band。短练习会标注按比例换算；不同正式试卷的分数转换可能不同，可修改 `config/bands.json`。

Writing 只报告字数、完成情况和用时；Speaking 只报告真实录音与时长。两个 EvaluationProvider 接口已预留，默认没有接模型，也不会伪造 IELTS Band。

History 保留作答、原文、题目、答案、笔记、高亮、作文、录音。Mistakes 按 Book / Test / Question Type 筛选，显示错误次数／尝试次数和按题型汇总的错误率。

## 存储与恢复

大文件、历史、题库和录音保存在 IndexedDB。设置及少量恢复日志保存在 localStorage；恢复日志不含音频二进制。页面显示 Saved locally / Saving；保存失败会明确报错。重开可通过 Library 的 Resume saved exam 恢复未完成考试。

Web 的 `localhost`、`127.0.0.1`、不同端口、不同浏览器和桌面 App 分属不同存储。请固定入口，并使用题库 ZIP、作文／录音导出做备份。清除浏览器网站数据会删除本地记录。ZIP 不迁移考试历史。

## 运行测试与构建

```sh
cd "/Users/yanglinxuan/Documents/Codex/2026-10-09/files-pasted-by-the-user-mac/ielts-on-computer"
npm run check
npm run test:e2e
npm run build:mac
```

`check` 包括 lint、TypeScript strict、Vitest 和生产构建。端到端测试使用隔离的浏览器测试数据和合成麦克风输入，不访问你的考试记录；桌面验收另外使用了本机真实麦克风。

构建 App 的 Rust 工具链位于工作区 `work/toolchains`，没有修改你的 shell 配置。桌面构建产物在 `src-tauri/target/aarch64-apple-darwin/release/bundle/macos/IELTS Simulator.app`。移动源项目后可自行安装 Rust 并设置 `RUSTUP_HOME` / `CARGO_HOME`；`scripts/build-mac.sh` 会使用这些变量。

## 明确未实现与限制

- 未实现 OCR、任意 PDF 的全自动结构化、AI 写作／口语评分；导入是半自动人工校对。
- 未实现 Writing 原生 PDF 导出（TXT/Markdown 已实现）。Web 结果页可用打印／保存 PDF。
- 离线软件不能禁止用户修改操作系统时间或开发者工具。运行时采用单调时间，恢复时检测明显时间回拨；这是模拟器，不是防作弊考试系统。
- 浏览器扩展可能忽略禁用拼写检查的属性；严格练习优先使用桌面版或无扩展浏览器。
- 录音每秒保存，强制结束进程可能丢失最后未产出的约 1 秒音频；App 关闭时不能继续录音。已经保存的录音可保留。
- 这是本机 ad-hoc 签名的 Apple Silicon App，未办理 Apple 公证／面向公众分发签名。
- 没有内置 Cambridge 19 试题；导入后才能以该书名练习。原创样题仅用于验证界面。

交付目录的 `IELTS Simulator.app` 是指向已签名构建产物的启动链接。要移动到“应用程序”或复制到另一台 Apple Silicon Mac，请解压 `IELTS-Simulator-macOS.zip` 后移动其中完整的 App；不要只移动链接。本机的启动链接已经实际打开验证。
