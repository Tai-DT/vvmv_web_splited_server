#!/usr/bin/env python3
"""
Auto Monitor Pipeline
Theo dõi tự động tiến trình pipeline
"""

import time
import os
from datetime import datetime
from pathlib import Path

def auto_monitor(interval=60):
    """Auto monitor pipeline every X seconds"""
    
    print("="*60)
    print("AUTO MONITORING VVMV PIPELINE")
    print("="*60)
    print(f"Checking every {interval} seconds...")
    print("Press Ctrl+C to stop monitoring")
    print("="*60)
    
    while True:
        try:
            # Clear screen (works on most terminals)
            os.system('clear' if os.name == 'posix' else 'cls')
            
            print("="*60)
            print("VVMV PIPELINE MONITOR")
            print("="*60)
            print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            
            # Check if pipeline processes are running
            pipeline_processes = []
            try:
                result = os.popen("ps aux | grep -E '(data_processor|run_pipeline)' | grep -v grep").read()
                if result.strip():
                    for line in result.strip().split('\n'):
                        parts = line.split()
                        if len(parts) >= 11:
                            pid = parts[1]
                            cpu = parts[2]
                            mem = parts[3]
                            cmd = ' '.join(parts[10:])
                            pipeline_processes.append({
                                'pid': pid,
                                'cpu': cpu,
                                'mem': mem,
                                'cmd': cmd[:50] + '...' if len(cmd) > 50 else cmd
                            })
            except:
                pass
            
            if pipeline_processes:
                print(f"\n✓ Pipeline Processes Running: {len(pipeline_processes)}")
                for proc in pipeline_processes:
                    print(f"  PID {proc['pid']}: CPU {proc['cpu']}% | MEM {proc['mem']}% | {proc['cmd']}")
            else:
                print("\n✗ No pipeline processes found")
            
            # Check output directory
            output_dir = Path("/Volumes/FastVault-Apps/Projects/ai-vvmv/llm-dataset")
            
            print(f"\n📁 Output Directory Status:")
            if output_dir.exists():
                print(f"  ✓ Directory exists: {output_dir}")
                
                # Check subdirectories
                subdirs = ['cleaned', 'processed', 'metadata', 'splits']
                for subdir in subdirs:
                    subdir_path = output_dir / subdir
                    if subdir_path.exists():
                        files = list(subdir_path.rglob('*'))
                        print(f"  ✓ {subdir}/: {len(files)} files")
                        
                        # Show largest files if any
                        if files:
                            file_sizes = [(f.stat().st_size, f.name) for f in files if f.is_file()]
                            if file_sizes:
                                file_sizes.sort(reverse=True)
                                top_file = file_sizes[0]
                                size_mb = top_file[0] / 1024 / 1024
                                print(f"    Largest: {top_file[1]} ({size_mb:.1f} MB)")
                    else:
                        print(f"  ✗ {subdir}/: Not created yet")
            else:
                print(f"  ✗ Directory not found")
            
            # Check log file
            log_file = Path("/Volumes/FastVault-Apps/Projects/ai-vvmv/pipeline.log")
            if log_file.exists():
                with open(log_file, 'r') as f:
                    lines = f.readlines()
                    print(f"\n📋 Log: {len(lines)} entries")
                    
                    # Show last 3 entries
                    if lines:
                        print("  Recent entries:")
                        for line in lines[-3:]:
                            print(f"    {line.strip()}")
            else:
                print(f"\n📋 Log: No log file found")
            
            # Check source data
            source_dir = Path("/Volumes/FastVault-Apps/Projects/ai-vvmv/vvmv-dumps")
            if source_dir.exists():
                jsonl_files = list(source_dir.rglob("*.jsonl"))
                total_size = sum(f.stat().st_size for f in jsonl_files)
                print(f"\n📊 Source Data: {len(jsonl_files)} files, {total_size / 1024 / 1024 / 1024:.2f} GB")
            
            print("\n" + "="*60)
            print(f"Next check in {interval} seconds...")
            print("="*60)
            
            time.sleep(interval)
            
        except KeyboardInterrupt:
            print("\n\nMonitoring stopped by user")
            break
        except Exception as e:
            print(f"\nError: {e}")
            time.sleep(interval)

if __name__ == "__main__":
    auto_monitor(interval=30)  # Check every 30 seconds