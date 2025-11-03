#!/usr/bin/env python3
"""Simple job tracker utility.
Reads data/jobs.json and prints a short summary of counts by status.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JOBS_FILE = ROOT / 'data' / 'jobs.json'


def load_jobs(path: Path):
    if not path.exists():
        return {"jobs": []}
    with path.open('r', encoding='utf-8') as f:
        return json.load(f)


def summarize(jobs_data: dict):
    totals = {}
    for j in jobs_data.get('jobs', []):
        s = j.get('status', 'unknown')
        totals[s] = totals.get(s, 0) + 1
    return totals


if __name__ == '__main__':
    data = load_jobs(JOBS_FILE)
    totals = summarize(data)
    print('Job counts by status:')
    for status, count in totals.items():
        print(f'  {status}: {count}')
    if not totals:
        print('No jobs found.')
