#!/usr/bin/env python3
"""
Monitor Pipeline Progress
Theo dõi tiến trình xử lý dữ liệu VVMV
"""

import os
import time
import psutil
from pathlib import Path
from datetime import datetime

def monitor_pipeline():
    """Monitor pipeline progress"""
    
    print("="*60)
    print("VVMV PIPELINE MONITOR")
    print("="*60)
    
    # Check if pipeline is running
    pipeline_running = False
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            cmdline = ' '.join(proc.info['cmdline'] or [])
            if 'data_processor.py' in cmdline or 'run_pipeline.py' in cmdline:
                pipeline_running = True
                print(f"✓ Pipeline running - PID: {proc.info['pid']}")
                print(f"  Memory: {proc.memory_info().rss / 1024 / 1024:.1f} MB")
                print(f"  CPU: {proc.cpu_percent():.1f}%")
                break
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    
    if not pipeline_running:
        print("✗ Pipeline not running")
        return
    
    # Check output directory
    output_dir = Path("/Volumes/FastVault-Apps/Projects/ai-vvmv/llm-dataset")
    
    print(f"\nOutput directory: {output_dir}")
    print(f"Created: {datetime.fromtimestamp(output_dir.stat().st_mtime) if output_dir.exists() else 'Not found'}")
    
    # Check for files
    cleaned_dir = output_dir / 'cleaned'
    if cleaned_dir.exists():
        files = list(cleaned_dir.glob('*'))
        print(f"Files in cleaned/: {len(files)}")
        
        for file in files:
            size_mb = file.stat().st_size / 1024 / 1024
            print(f"  {file.name}: {size_mb:.1f} MB")
    
    # Check source progress
    source_dir = Path("/Volumes/FastVault-Apps/Projects/ai-vvmv/vvmv-dumps")
    if source_dir.exists():
        jsonl_files = list(source_dir.rglob("*.jsonl"))
        print(f"\nSource files: {len(jsonl_files)} JSONL files")
        
        # Calculate total size
        total_size = sum(f.stat().st_size for f in jsonl_files)
        print(f"Total size: {total_size / 1024 / 1024 / 1024:.2f} GB")
    
    # Check logs
    log_file = Path("/Volumes/FastVault-Apps/Projects/ai-vvmv/pipeline.log")
    if log_file.exists():
        with open(log_file, 'r') as f:
            lines = f.readlines()
            print(f"\nLog entries: {len(lines)}")
            
            # Show last few entries
            print("Recent log entries:")
            for line in lines[-5:]:
                print(f"  {line.strip()}")
    
    print("\n" + "="*60)
    print(f"Monitor time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)

if __name__ == "__main__":
    monitor_pipeline()