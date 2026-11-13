"""Download a balanced subset of the 'Deepfake and Real Images' dataset (OpenForensics faces).

Smart partial download: the Hugging Face parquet mirror stores 100-image row groups sorted by
filename, so we fetch only the row groups we need with parallel HTTP range requests (~250 MB
instead of 1.8 GB). Writes data/raw/Dataset/{Train,Validation,Test}/{Fake,Real}/*.jpg

    python scripts/download_data.py --train-groups 90 --val-groups 25 --test-groups 10
"""
import argparse
import io
import random
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pyarrow.parquet as pq

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import DATA_DIR

BASE = "https://huggingface.co/datasets/Hemg/deepfake-and-real-images/resolve/main/data/train-0000{}-of-00005.parquet"


class HttpFile(io.RawIOBase):
    """Seekable read-only file over HTTP range requests (enough for pyarrow)."""

    def __init__(self, url):
        r = urllib.request.urlopen(urllib.request.Request(url, method="HEAD"))
        self.url, self.size, self.pos = r.geturl(), int(r.headers["Content-Length"]), 0

    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos

    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else (self.pos + off if whence == 1 else self.size + off)
        return self.pos

    def read(self, n=-1):
        n = self.size - self.pos if n < 0 else n
        if n <= 0 or self.pos >= self.size:
            return b""
        end = min(self.pos + n, self.size) - 1
        for attempt in range(5):
            try:
                req = urllib.request.Request(self.url, headers={"Range": f"bytes={self.pos}-{end}"})
                data = urllib.request.urlopen(req, timeout=60).read()
                break
            except Exception:
                if attempt == 4:
                    raise
        self.pos += len(data)
        return data

    def readinto(self, b):
        d = self.read(len(b))
        b[:len(d)] = d
        return len(d)


def group_index():
    """[(shard, group, 'fake'|'real')] for all single-class row groups."""
    idx = []
    for k in range(5):
        md = pq.ParquetFile(HttpFile(BASE.format(k))).metadata
        name_col = [md.schema.column(i).path for i in range(md.num_columns)].index("image.path")
        for g in range(md.num_row_groups):
            st = md.row_group(g).column(name_col).statistics
            a, b = st.min.split("_")[0], st.max.split("_")[0]
            if a == b:
                idx.append((k, g, a))
    return idx


def fetch(job):
    shard, group, cls, split = job
    out = DATA_DIR / "Dataset" / split / cls.capitalize()
    out.mkdir(parents=True, exist_ok=True)
    tbl = pq.ParquetFile(HttpFile(BASE.format(shard))).read_row_group(group, columns=["image"])
    for i, rec in enumerate(tbl.column("image").to_pylist()):
        (out / f"s{shard}g{group:03d}_{i:03d}.jpg").write_bytes(rec["bytes"])
    return len(tbl)


def main(a):
    print("indexing row groups ...")
    idx = group_index()
    rng = random.Random(0)
    jobs = []
    # Test: last shard (held-out tail of the original dataset); Train/Val: shards 0-3, disjoint groups
    for cls in ("fake", "real"):
        test_pool = [g for g in idx if g[2] == cls and g[0] == 4]
        rest = [g for g in idx if g[2] == cls and g[0] != 4]
        rng.shuffle(test_pool), rng.shuffle(rest)
        jobs += [(*g, "Test") for g in test_pool[:a.test_groups]]
        jobs += [(*g, "Validation") for g in rest[:a.val_groups]]
        jobs += [(*g, "Train") for g in rest[a.val_groups:a.val_groups + a.train_groups]]
    print(f"downloading {len(jobs)} row groups (~{len(jobs) * 100} images) with {a.threads} threads ...")
    done = 0
    with ThreadPoolExecutor(a.threads) as ex:
        for n in ex.map(fetch, jobs):
            done += n
            print(f"\r  {done} images", end="", flush=True)
    print("\ndataset ready in", DATA_DIR / "Dataset")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--train-groups", type=int, default=90)   # x100 images per class
    ap.add_argument("--val-groups", type=int, default=25)
    ap.add_argument("--test-groups", type=int, default=10)
    ap.add_argument("--threads", type=int, default=12)
    main(ap.parse_args())
