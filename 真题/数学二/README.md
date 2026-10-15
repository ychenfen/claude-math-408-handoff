# 数学二真题 Markdown · 2010—2026

17 套试卷，385 道题。正文是可复制、可编辑的 Markdown + LaTeX，保留 5 张必要题图，适合 GitHub、Obsidian 等支持数学公式的阅读器。

本版由 Codex AI 于 2026-10-15 逐题对照独立题图／PDF，校对题干、选项、上下限、导数阶数、矩阵元素、向量符号、附图与分值。共修订 56 道题（含分值补全），详细变化见[勘误记录](audit/勘误.md)。**仅含题面，不含答案解析；未进行全部题目的独立求解验算，也不是考试机构审定版。**

## 试卷入口

| 年份 | 年份 | 年份 |
|---|---|---|
| [2010](chapters/2010.md) | [2016](chapters/2016.md) | [2022](chapters/2022.md) |
| [2011](chapters/2011.md) | [2017](chapters/2017.md) | [2023](chapters/2023.md) |
| [2012](chapters/2012.md) | [2018](chapters/2018.md) | [2024](chapters/2024.md) |
| [2013](chapters/2013.md) | [2019](chapters/2019.md) | [2025](chapters/2025.md) |
| [2014](chapters/2014.md) | [2020](chapters/2020.md) | [2026](chapters/2026.md) |
| [2015](chapters/2015.md) | [2021](chapters/2021.md) | |

2010—2020 年每套 23 题，2021—2026 年每套 22 题；各套满分 150 分。下载整个目录可保持相对图片链接；只复制单个 Markdown 时，也要保留同层上级的 `assets/`。

## 来源与追溯

- Markdown 原稿：[dongyu-will/zhijian](https://github.com/dongyu-will/zhijian/tree/c28a657ca043e3f94d4156c4dec7ed4724a256b3/content/math-two-exams)，固定提交 `c28a657ca043e3f94d4156c4dec7ed4724a256b3`。上游称由《【横版】10-26年数二真题套卷做题本.pdf》识别生成；该原 PDF 未取得，原稿页码仅作上游定位信息。
- 2010—2025 独立对照：[lx-ruc/kaoyanshuxue](https://github.com/lx-ruc/kaoyanshuxue/tree/196dc9d2d8271978a030a3721a828c8723cd3864)，固定提交 `196dc9d2d8271978a030a3721a828c8723cd3864`，逐题查看 363 张数二题图。题图并非考试机构原始扫描件。
- 2026 对照：[启航教育试卷及解析 PDF](https://19654776.s21i.faiusr.com/61/ABUIABA9GAAg2KiiygYoqNniuwU.pdf)与[掌上考研 PDF](https://static.kaoyan.cn/file/question/2025/12/27/f2d851eb315f540c31acc1b434c494c0.pdf)。逐题采用的参考页码和文件哈希见核对清单；冲突处理见[来源差异说明](audit/来源差异.md)。

[逐题核对清单](audit/questions.json)含 385 条记录：年份、题号、分值、核对状态、参考链接、参考文件 SHA256、上游页码、修正理由和最终题文哈希。[原始快照](sources/upstream/)仅用于追溯，仍含上游错误，做题请使用 `chapters/`。参考 PDF、整套参考题图及其商业解析不随本目录发布。

## 验证与使用边界

运行 `python3 scripts/validate.py` 可检查题号、题数、分值、选项、图片引用和 385 条题文哈希。公式／矩阵解析结果见 [render-check.json](audit/render-check.json)，检查范围与浏览器抽查见[验证说明](audit/验证说明.md)。这些机器检查用于发现排版和交付损坏，不能替代题意校对或证明数学答案正确。

校对保留题义和选项顺序，统一了数学分隔符、图片语法与空白。发现的新问题应注明年份、题号和参考原图；修改后需同步更新逐题哈希。来源之间可能存在共有转录错误，不能以两份资料一致推断绝对无误。

## 归属与许可

Markdown 原稿及随附题图来自 zhijian。保留其 `Copyright (c) 2026 dongyu-will` 与 [MIT 许可全文](sources/UPSTREAM-LICENSE)。本次修订记录由 Codex AI 整理。上游仓库许可不等于替考试题目、第三方题图或参考解析另行授予权利；相关权利仍归各自权利人。
