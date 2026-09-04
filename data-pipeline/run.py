from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path
import sys

from light_trip_data.pipeline import PipelinePaths, run_pipeline


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="轻途计划公开数据整理工具")
    parser.add_argument("stage", choices=("collect", "validate", "export", "all"))
    parser.add_argument("--as-of", required=True, help="采集和校验日期，格式 YYYY-MM-DD")
    parser.add_argument("--city", help="只处理一个城市，例如 beijing")
    args = parser.parse_args(argv)

    try:
        as_of = date.fromisoformat(args.as_of)
    except ValueError:
        return 2

    root = Path(__file__).resolve().parent
    paths = PipelinePaths(
        source_root=root / "sources",
        output_root=root / "output",
        database_path=root / "curation.sqlite3",
    )
    return run_pipeline(args.stage, as_of=as_of, paths=paths, city_id=args.city)


if __name__ == "__main__":
    sys.exit(main())
