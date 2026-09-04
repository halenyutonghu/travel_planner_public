# 轻途计划公开数据整理工具

这个文件夹是离线数据整理工具，不是网站本身。它会把公开网页整理成 SQLite、报告和候选 JSON，但不会自动覆盖 `src/data`，也不会改变网站页面或路线规则。

## 第一次使用

1. 打开 macOS 的 Terminal。
2. 进入项目文件夹：

```bash
cd "/path/to/New project2"
```

3. 创建 Python 虚拟环境：

```bash
python3 -m venv data-pipeline/.venv
```

4. 启用虚拟环境：

```bash
source data-pipeline/.venv/bin/activate
```

5. 安装依赖：

```bash
python3 -m pip install -r data-pipeline/requirements.txt
```

6. 运行测试：

```bash
PYTHONPATH=data-pipeline python3 -m unittest discover -s data-pipeline/tests -v
```

7. 执行一次完整整理：

```bash
PYTHONPATH=data-pipeline python3 data-pipeline/run.py all --as-of 2026-07-23
```

只检查一个城市时可以加 `--city`：

```bash
PYTHONPATH=data-pipeline python3 data-pipeline/run.py validate --city beijing --as-of 2026-07-23
```

在 Codex 里联网采集公开网页时，可能会弹出网络访问 approval。不同意时，采集阶段会失败，但不会改网站数据。

## 输出在哪里

- SQLite：`data-pipeline/curation.sqlite3`
- 候选 JSON：`data-pipeline/output/candidate/<城市>/`
- 报告：`data-pipeline/output/reports/report.md` 和 `report.json`

## 常见失败

- configuration/usage error：命令写错、日期格式不是 `YYYY-MM-DD`、manifest 或快照文件缺失。
- data gate failure：数量、区域、分类、酒店等级、来源或交通样本没有达到文档要求。
- network failure：公开网页无法访问、被 401/403 拒绝、出现验证码、文件太大，或不是 HTML/PDF。

出现失败时，先看 `data-pipeline/output/reports/report.md`。如果报告说没有生成最终 JSON，表示网站原有数据没有被修改。
