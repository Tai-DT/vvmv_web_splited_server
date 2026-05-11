#!/usr/bin/env python3
"""
Main Pipeline Runner for VVMV Data Standardization
Chạy toàn bộ quy trình chuẩn hóa dữ liệu
"""

import os
import sys
import subprocess
from pathlib import Path
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('pipeline.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class VVMVPipeline:
    """Main pipeline for VVMV data processing"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent
        self.scripts_dir = self.project_root / 'scripts'
        self.source_dir = self.project_root / 'vvmv-dumps'
        self.output_dir = self.project_root / 'llm-dataset'
        
    def run_script(self, script_name: str, description: str) -> bool:
        """Run a single script and return success status"""
        logger.info(f"Starting: {description}")
        logger.info(f"Running script: {script_name}")
        
        script_path = self.scripts_dir / script_name
        
        if not script_path.exists():
            logger.error(f"Script not found: {script_path}")
            return False
        
        try:
            # Add project root to Python path
            env = os.environ.copy()
            env['PYTHONPATH'] = str(self.project_root)
            
            # Run the script
            result = subprocess.run(
                [sys.executable, str(script_path)],
                cwd=self.project_root,
                env=env,
                capture_output=True,
                text=True,
                timeout=3600  # 1 hour timeout
            )
            
            if result.returncode == 0:
                logger.info(f"✓ {description} completed successfully")
                if result.stdout:
                    logger.info(f"Output: {result.stdout}")
                return True
            else:
                logger.error(f"✗ {description} failed")
                logger.error(f"Error: {result.stderr}")
                return False
                
        except subprocess.TimeoutExpired:
            logger.error(f"✗ {description} timed out after 1 hour")
            return False
        except Exception as e:
            logger.error(f"✗ {description} failed with exception: {e}")
            return False
    
    def check_prerequisites(self) -> bool:
        """Check if prerequisites are met"""
        logger.info("Checking prerequisites...")
        
        # Check source directory
        if not self.source_dir.exists():
            logger.error(f"Source directory not found: {self.source_dir}")
            return False
        
        # Check if source directory has data
        jsonl_files = list(self.source_dir.rglob("*.jsonl"))
        if not jsonl_files:
            logger.error("No JSONL files found in source directory")
            return False
        
        logger.info(f"Found {len(jsonl_files)} JSONL files")
        
        # Check scripts directory
        if not self.scripts_dir.exists():
            logger.error(f"Scripts directory not found: {self.scripts_dir}")
            return False
        
        # Check required scripts
        required_scripts = [
            'data_processor.py',
            'dataset_generator.py', 
            'data_validator.py'
        ]
        
        for script in required_scripts:
            script_path = self.scripts_dir / script
            if not script_path.exists():
                logger.error(f"Required script not found: {script_path}")
                return False
        
        logger.info("All prerequisites checked successfully")
        return True
    
    def create_output_structure(self):
        """Create output directory structure"""
        logger.info("Creating output directory structure...")
        
        directories = [
            'raw',
            'cleaned', 
            'processed/classification',
            'processed/ner',
            'processed/qa',
            'processed/generation',
            'splits/classification',
            'splits/ner', 
            'splits/qa',
            'splits/generation',
            'metadata',
            'logs'
        ]
        
        for directory in directories:
            dir_path = self.output_dir / directory
            dir_path.mkdir(parents=True, exist_ok=True)
        
        logger.info("Output structure created")
    
    def run_full_pipeline(self) -> bool:
        """Run the complete data processing pipeline"""
        logger.info("="*60)
        logger.info("STARTING VVMV DATA STANDARDIZATION PIPELINE")
        logger.info("="*60)
        logger.info(f"Started at: {datetime.now().isoformat()}")
        
        # Step 1: Check prerequisites
        if not self.check_prerequisites():
            logger.error("Prerequisites check failed. Aborting pipeline.")
            return False
        
        # Step 2: Create output structure
        self.create_output_structure()
        
        # Step 3: Data processing and cleaning
        if not self.run_script('data_processor.py', 'Data Processing and Cleaning'):
            logger.error("Data processing failed. Aborting pipeline.")
            return False
        
        # Step 4: Dataset generation
        if not self.run_script('dataset_generator.py', 'LLM Dataset Generation'):
            logger.error("Dataset generation failed. Aborting pipeline.")
            return False
        
        # Step 5: Data validation
        if not self.run_script('data_validator.py', 'Data Validation and Quality Check'):
            logger.error("Data validation failed. Aborting pipeline.")
            return False
        
        logger.info("="*60)
        logger.info("PIPELINE COMPLETED SUCCESSFULLY")
        logger.info("="*60)
        logger.info(f"Completed at: {datetime.now().isoformat()}")
        
        # Print summary
        self.print_pipeline_summary()
        
        return True
    
    def print_pipeline_summary(self):
        """Print pipeline completion summary"""
        print("\n" + "="*60)
        print("PIPELINE SUMMARY")
        print("="*60)
        
        # Check output files
        cleaned_files = list((self.output_dir / 'cleaned').glob('*.jsonl'))
        dataset_files = list((self.output_dir / 'processed').rglob('*.jsonl'))
        metadata_files = list((self.output_dir / 'metadata').glob('*.json'))
        
        print(f"✓ Cleaned datasets: {len(cleaned_files)} files")
        print(f"✓ LLM datasets: {len(dataset_files)} files")
        print(f"✓ Metadata files: {len(metadata_files)} files")
        
        # Check dataset sizes
        for task_type in ['classification', 'ner', 'qa', 'generation']:
            task_dir = self.output_dir / 'processed' / task_type
            if task_dir.exists():
                files = list(task_dir.glob('*.jsonl'))
                if files:
                    print(f"✓ {task_type}: {len(files)} files")
        
        print(f"\nOutput directory: {self.output_dir}")
        print("="*60)
        
        # Next steps
        print("\nNEXT STEPS:")
        print("1. Review validation report: llm-dataset/metadata/validation_report.txt")
        print("2. Check quality scores: llm-dataset/metadata/quality_scores.json")
        print("3. Review dataset splits: llm-dataset/splits/")
        print("4. Start LLM training with processed datasets")
    
    def run_step(self, step_name: str) -> bool:
        """Run a specific step of the pipeline"""
        steps = {
            'process': ('data_processor.py', 'Data Processing and Cleaning'),
            'generate': ('dataset_generator.py', 'LLM Dataset Generation'),
            'validate': ('data_validator.py', 'Data Validation and Quality Check')
        }
        
        if step_name not in steps:
            logger.error(f"Unknown step: {step_name}")
            logger.info(f"Available steps: {list(steps.keys())}")
            return False
        
        script_name, description = steps[step_name]
        
        # Check prerequisites
        if not self.check_prerequisites():
            return False
        
        # Create output structure
        self.create_output_structure()
        
        # Run the specific step
        return self.run_script(script_name, description)

def main():
    """Main execution function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='VVMV Data Standardization Pipeline')
    parser.add_argument('--step', choices=['process', 'generate', 'validate'], 
                       help='Run specific step (default: run full pipeline)')
    parser.add_argument('--source', help='Source directory path')
    parser.add_argument('--output', help='Output directory path')
    
    args = parser.parse_args()
    
    pipeline = VVMVPipeline()
    
    # Override paths if provided
    if args.source:
        pipeline.source_dir = Path(args.source)
    if args.output:
        pipeline.output_dir = Path(args.output)
    
    if args.step:
        success = pipeline.run_step(args.step)
    else:
        success = pipeline.run_full_pipeline()
    
    if not success:
        logger.error("Pipeline failed. Check logs for details.")
        sys.exit(1)
    else:
        logger.info("Pipeline completed successfully!")

if __name__ == "__main__":
    main()