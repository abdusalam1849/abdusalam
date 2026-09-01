"""命令行入口: python main.py "无线蓝牙耳机" [--demo|--platforms jd pdd|...]"""
from price_tracker.cli import main

if __name__ == "__main__":
    raise SystemExit(main())
