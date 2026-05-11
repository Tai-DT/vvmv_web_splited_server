#!/usr/bin/env python3
"""
Data Validator for VVMV Dataset
Validation và quality check cho dataset đã chuẩn hóa
"""

import json
import pandas as pd
from pathlib import Path
from typing import Dict, List, Any, Tuple
import logging
from datetime import datetime
from collections import defaultdict, Counter
import re

logger = logging.getLogger(__name__)

class VVMVDataValidator:
    """Validate and check quality of processed VVMV data"""
    
    def __init__(self, dataset_dir: str):
        self.dataset_dir = Path(dataset_dir)
        self.validation_results = defaultdict(dict)
        self.quality_metrics = {}
        
    def validate_cleaned_data(self) -> Dict:
        """Validate cleaned dataset"""
        logger.info("Validating cleaned dataset...")
        
        cleaned_path = self.dataset_dir / 'cleaned' / 'vvmv_cleaned.jsonl'
        
        if not cleaned_path.exists():
            logger.error(f"Cleaned dataset not found at {cleaned_path}")
            return {}
        
        records = []
        with open(cleaned_path, 'r', encoding='utf-8') as f:
            for line in f:
                record = json.loads(line.strip())
                records.append(record)
        
        validation_results = {
            'total_records': len(records),
            'field_completeness': self.check_field_completeness(records),
            'data_consistency': self.check_data_consistency(records),
            'duplicate_analysis': self.check_duplicates(records),
            'value_ranges': self.check_value_ranges(records),
            'format_validation': self.check_formats(records)
        }
        
        self.validation_results['cleaned_data'] = validation_results
        
        return validation_results
    
    def check_field_completeness(self, records: List[Dict]) -> Dict:
        """Check completeness of required fields"""
        required_fields = ['declarationId', 'direction', 'taxCode', 'customsCode']
        important_fields = [
            'header', 'vnaccs2', 'cargo', 'operationCode',
            'declarationDate', 'taxCode', 'customsCode'
        ]
        
        completeness = {}
        
        # Check required fields
        for field in required_fields:
            present_count = sum(1 for record in records if field in record and record[field] is not None)
            completeness[field] = {
                'present': present_count,
                'missing': len(records) - present_count,
                'completeness_rate': present_count / len(records) * 100
            }
        
        # Check important fields
        for field in important_fields:
            present_count = sum(1 for record in records if field in record and record[field] is not None)
            completeness[field] = {
                'present': present_count,
                'missing': len(records) - present_count,
                'completeness_rate': present_count / len(records) * 100
            }
        
        return completeness
    
    def check_data_consistency(self, records: List[Dict]) -> Dict:
        """Check data consistency across records"""
        consistency = {}
        
        # Check direction consistency
        direction_counts = Counter(record.get('direction', 'UNKNOWN') for record in records)
        consistency['direction_distribution'] = dict(direction_counts)
        
        # Check customs code consistency
        customs_codes = Counter(record.get('customsCode', 'UNKNOWN') for record in records)
        consistency['customs_code_distribution'] = dict(customs_codes.most_common(10))
        
        # Check operation code consistency
        operation_codes = Counter(record.get('operationCode', 'UNKNOWN') for record in records)
        consistency['operation_code_distribution'] = dict(operation_codes.most_common(10))
        
        # Check tax code format consistency
        tax_code_formats = {}
        for record in records:
            tax_code = str(record.get('taxCode', ''))
            if tax_code:
                if len(tax_code) == 10 and tax_code.isdigit():
                    tax_code_formats['valid_10_digit'] = tax_code_formats.get('valid_10_digit', 0) + 1
                else:
                    tax_code_formats['invalid_format'] = tax_code_formats.get('invalid_format', 0) + 1
        
        consistency['tax_code_formats'] = tax_code_formats
        
        return consistency
    
    def check_duplicates(self, records: List[Dict]) -> Dict:
        """Check for duplicate records"""
        duplicates = {}
        
        # Check duplicate declaration IDs
        declaration_ids = [record.get('declarationId') for record in records]
        id_counts = Counter(declaration_ids)
        duplicate_ids = {id_: count for id_, count in id_counts.items() if count > 1}
        
        duplicates['duplicate_declaration_ids'] = duplicate_ids
        duplicates['total_duplicate_records'] = sum(count - 1 for count in duplicate_ids.values())
        
        # Check for near-duplicates based on key fields
        key_field_combinations = []
        for record in records:
            key = (
                record.get('taxCode'),
                record.get('customsCode'),
                record.get('direction'),
                record.get('operationCode')
            )
            key_field_combinations.append(key)
        
        combination_counts = Counter(key_field_combinations)
        common_combinations = dict(combination_counts.most_common(10))
        
        duplicates['common_key_combinations'] = {
            str(k): v for k, v in common_combinations.items()
        }
        
        return duplicates
    
    def check_value_ranges(self, records: List[Dict]) -> Dict:
        """Check value ranges for numeric fields"""
        ranges = {}
        
        # Check cargo quantities
        cargo_quantities = []
        cargo_values = []
        
        for record in records:
            cargo = record.get('cargo', [])
            for item in cargo:
                quantity = item.get('LUONG')
                value = item.get('TRIGIA_KB')
                
                if quantity is not None and isinstance(quantity, (int, float)):
                    cargo_quantities.append(quantity)
                if value is not None and isinstance(value, (int, float)):
                    cargo_values.append(value)
        
        if cargo_quantities:
            ranges['cargo_quantity'] = {
                'min': min(cargo_quantities),
                'max': max(cargo_quantities),
                'mean': sum(cargo_quantities) / len(cargo_quantities),
                'negative_count': sum(1 for q in cargo_quantities if q < 0),
                'zero_count': sum(1 for q in cargo_quantities if q == 0)
            }
        
        if cargo_values:
            ranges['cargo_value'] = {
                'min': min(cargo_values),
                'max': max(cargo_values),
                'mean': sum(cargo_values) / len(cargo_values),
                'negative_count': sum(1 for v in cargo_values if v < 0),
                'zero_count': sum(1 for v in cargo_values if v == 0)
            }
        
        # Check total declaration values
        total_values = []
        for record in records:
            header = record.get('header', {})
            total_value = header.get('TONGTGKB')
            if total_value is not None and isinstance(total_value, (int, float)):
                total_values.append(total_value)
        
        if total_values:
            ranges['total_declaration_value'] = {
                'min': min(total_values),
                'max': max(total_values),
                'mean': sum(total_values) / len(total_values),
                'negative_count': sum(1 for v in total_values if v < 0),
                'zero_count': sum(1 for v in total_values if v == 0)
            }
        
        return ranges
    
    def check_formats(self, records: List[Dict]) -> Dict:
        """Check format compliance"""
        formats = {}
        
        # Check date formats
        date_fields = ['declarationDate', 'NGAY_DK', 'NGAYDEN', 'NGAY_GP']
        date_format_issues = defaultdict(int)
        
        for record in records:
            header = record.get('header', {})
            
            for field in date_fields:
                date_value = record.get(field) if field != 'NGAY_DK' else header.get(field)
                
                if date_value and date_value != 'null':
                    # Check ISO format
                    if not re.match(r'^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}Z)?$', str(date_value)):
                        date_format_issues[field] += 1
        
        formats['date_format_issues'] = dict(date_format_issues)
        
        # Check HS code formats
        hs_code_issues = 0
        valid_hs_codes = 0
        
        for record in records:
            cargo = record.get('cargo', [])
            for item in cargo:
                hs_code = item.get('MA_HANGKB', '')
                if hs_code:
                    if re.match(r'^\d{8}$', hs_code):
                        valid_hs_codes += 1
                    else:
                        hs_code_issues += 1
        
        formats['hs_code_validation'] = {
            'valid_count': valid_hs_codes,
            'invalid_count': hs_code_issues,
            'validation_rate': valid_hs_codes / (valid_hs_codes + hs_code_issues) * 100 if (valid_hs_codes + hs_code_issues) > 0 else 0
        }
        
        return formats
    
    def validate_datasets(self) -> Dict:
        """Validate all generated datasets"""
        logger.info("Validating generated datasets...")
        
        dataset_validation = {}
        
        task_types = ['classification', 'ner', 'qa', 'generation']
        
        for task_type in task_types:
            # Try different possible filenames
            possible_names = [
                f"{task_type}.jsonl",
                f"customs_{task_type}.jsonl",
                f"declaration_{task_type}.jsonl"
            ]
            
            dataset_path = None
            for name in possible_names:
                path = self.dataset_dir / task_type / name
                if path.exists():
                    dataset_path = path
                    break
            
            if dataset_path and dataset_path.exists():
                validation = self.validate_task_dataset(task_type, dataset_path)
                dataset_validation[task_type] = validation
            else:
                logger.warning(f"Dataset {task_type} not found")
                dataset_validation[task_type] = {'status': 'missing'}
        
        self.validation_results['datasets'] = dataset_validation
        
        return dataset_validation
    
    def validate_task_dataset(self, task_type: str, dataset_path: Path) -> Dict:
        """Validate specific task dataset"""
        records = []
        
        with open(dataset_path, 'r', encoding='utf-8') as f:
            for line in f:
                record = json.loads(line.strip())
                records.append(record)
        
        validation = {
            'total_samples': len(records),
            'required_fields_present': self.check_task_required_fields(task_type, records),
            'data_quality': self.check_task_data_quality(task_type, records),
            'format_compliance': self.check_task_format_compliance(task_type, records)
        }
        
        return validation
    
    def check_task_required_fields(self, task_type: str, records: List[Dict]) -> Dict:
        """Check required fields for specific task"""
        field_requirements = {
            'classification': ['instruction', 'input', 'output'],
            'ner': ['text', 'entities'],
            'qa': ['context', 'question', 'answer'],
            'generation': ['input', 'output']
        }
        
        required_fields = field_requirements.get(task_type, [])
        field_presence = {}
        
        for field in required_fields:
            present_count = sum(1 for record in records if field in record and record[field] is not None)
            field_presence[field] = {
                'present': present_count,
                'missing': len(records) - present_count,
                'completeness_rate': present_count / len(records) * 100
            }
        
        return field_presence
    
    def check_task_data_quality(self, task_type: str, records: List[Dict]) -> Dict:
        """Check data quality for specific task"""
        quality = {}
        
        if task_type == 'ner':
            # Check entity annotations
            total_entities = sum(len(record.get('entities', [])) for record in records)
            records_with_entities = sum(1 for record in records if record.get('entities'))
            
            quality['entity_analysis'] = {
                'total_entities': total_entities,
                'records_with_entities': records_with_entities,
                'avg_entities_per_record': total_entities / len(records) if records else 0
            }
        
        elif task_type == 'qa':
            # Check question-answer quality
            answer_lengths = [len(str(record.get('answer', ''))) for record in records]
            question_lengths = [len(str(record.get('question', ''))) for record in records]
            
            quality['text_analysis'] = {
                'avg_answer_length': sum(answer_lengths) / len(answer_lengths) if answer_lengths else 0,
                'avg_question_length': sum(question_lengths) / len(question_lengths) if question_lengths else 0,
                'empty_answers': sum(1 for record in records if not record.get('answer', '').strip()),
                'empty_questions': sum(1 for record in records if not record.get('question', '').strip())
            }
        
        elif task_type in ['classification', 'generation']:
            # Check text lengths
            input_lengths = [len(str(record.get('input', ''))) for record in records]
            output_lengths = [len(str(record.get('output', ''))) for record in records]
            
            quality['text_analysis'] = {
                'avg_input_length': sum(input_lengths) / len(input_lengths) if input_lengths else 0,
                'avg_output_length': sum(output_lengths) / len(output_lengths) if output_lengths else 0,
                'empty_inputs': sum(1 for record in records if not record.get('input', '').strip()),
                'empty_outputs': sum(1 for record in records if not record.get('output', '').strip())
            }
        
        return quality
    
    def check_task_format_compliance(self, task_type: str, records: List[Dict]) -> Dict:
        """Check format compliance for specific task"""
        compliance = {}
        
        # Check JSON structure
        valid_json_count = 0
        for record in records:
            try:
                json.dumps(record)
                valid_json_count += 1
            except (TypeError, ValueError):
                pass
        
        compliance['json_validity'] = {
            'valid_count': valid_json_count,
            'invalid_count': len(records) - valid_json_count,
            'validity_rate': valid_json_count / len(records) * 100 if records else 0
        }
        
        # Check encoding
        encoding_issues = 0
        for record in records:
            for key, value in record.items():
                if isinstance(value, str):
                    try:
                        value.encode('utf-8')
                    except UnicodeEncodeError:
                        encoding_issues += 1
                        break
        
        compliance['encoding_compliance'] = {
            'issues_found': encoding_issues,
            'compliance_rate': (len(records) - encoding_issues) / len(records) * 100 if records else 0
        }
        
        return compliance
    
    def calculate_quality_scores(self) -> Dict:
        """Calculate overall quality scores"""
        logger.info("Calculating quality scores...")
        
        scores = {}
        
        # Data completeness score
        if 'cleaned_data' in self.validation_results:
            completeness = self.validation_results['cleaned_data'].get('field_completeness', {})
            required_completeness = [
                field_info.get('completeness_rate', 0)
                for field, field_info in completeness.items()
                if field in ['declarationId', 'direction', 'taxCode', 'customsCode']
            ]
            
            scores['completeness_score'] = sum(required_completeness) / len(required_completeness) if required_completeness else 0
        
        # Data consistency score
        if 'cleaned_data' in self.validation_results:
            consistency = self.validation_results['cleaned_data'].get('data_consistency', {})
            tax_code_formats = consistency.get('tax_code_formats', {})
            valid_tax_codes = tax_code_formats.get('valid_10_digit', 0)
            total_tax_codes = sum(tax_code_formats.values())
            
            scores['consistency_score'] = (valid_tax_codes / total_tax_codes * 100) if total_tax_codes > 0 else 0
        
        # Duplicate score (lower is better, so invert)
        if 'cleaned_data' in self.validation_results:
            duplicates = self.validation_results['cleaned_data'].get('duplicate_analysis', {})
            total_records = self.validation_results['cleaned_data'].get('total_records', 1)
            duplicate_count = duplicates.get('total_duplicate_records', 0)
            
            scores['duplicate_score'] = max(0, 100 - (duplicate_count / total_records * 100))
        
        # Dataset quality scores
        if 'datasets' in self.validation_results:
            dataset_scores = {}
            for task_type, validation in self.validation_results['datasets'].items():
                if validation.get('status') != 'missing':
                    field_completeness = validation.get('required_fields_present', {})
                    avg_completeness = sum(
                        field_info.get('completeness_rate', 0)
                        for field_info in field_completeness.values()
                    ) / len(field_completeness) if field_completeness else 0
                    
                    dataset_scores[task_type] = avg_completeness
            
            scores['dataset_quality'] = dataset_scores
        
        # Overall score
        individual_scores = [v for k, v in scores.items() if k != 'dataset_quality']
        if individual_scores:
            scores['overall_quality_score'] = sum(individual_scores) / len(individual_scores)
        else:
            scores['overall_quality_score'] = 0
        
        self.quality_metrics = scores
        
        return scores
    
    def generate_validation_report(self) -> str:
        """Generate comprehensive validation report"""
        report_lines = []
        
        report_lines.append("VVMV DATASET VALIDATION REPORT")
        report_lines.append("=" * 50)
        report_lines.append(f"Generated: {datetime.now().isoformat()}")
        report_lines.append("")
        
        # Summary
        if self.quality_metrics:
            report_lines.append("QUALITY SCORES SUMMARY")
            report_lines.append("-" * 30)
            for metric, score in self.quality_metrics.items():
                report_lines.append(f"{metric}: {score:.2f}%")
            report_lines.append("")
        
        # Cleaned data validation
        if 'cleaned_data' in self.validation_results:
            report_lines.append("CLEANED DATA VALIDATION")
            report_lines.append("-" * 30)
            
            cleaned = self.validation_results['cleaned_data']
            report_lines.append(f"Total records: {cleaned.get('total_records', 0)}")
            
            # Field completeness
            completeness = cleaned.get('field_completeness', {})
            report_lines.append("\nField Completeness:")
            for field, info in completeness.items():
                rate = info.get('completeness_rate', 0)
                status = "✓" if rate >= 95 else "⚠" if rate >= 80 else "✗"
                report_lines.append(f"  {status} {field}: {rate:.1f}%")
            
            # Duplicates
            duplicates = cleaned.get('duplicate_analysis', {})
            duplicate_count = duplicates.get('total_duplicate_records', 0)
            report_lines.append(f"\nDuplicate records: {duplicate_count}")
            
            report_lines.append("")
        
        # Dataset validation
        if 'datasets' in self.validation_results:
            report_lines.append("DATASET VALIDATION")
            report_lines.append("-" * 30)
            
            for task_type, validation in self.validation_results['datasets'].items():
                if validation.get('status') == 'missing':
                    report_lines.append(f"  {task_type}: MISSING")
                else:
                    total_samples = validation.get('total_samples', 0)
                    report_lines.append(f"  {task_type}: {total_samples} samples")
                    
                    # Quality metrics
                    quality = validation.get('data_quality', {})
                    if quality:
                        report_lines.append(f"    Quality metrics available")
        
        report_lines.append("")
        report_lines.append("RECOMMENDATIONS")
        report_lines.append("-" * 30)
        
        # Generate recommendations
        recommendations = self.generate_recommendations()
        for rec in recommendations:
            report_lines.append(f"• {rec}")
        
        return "\n".join(report_lines)
    
    def generate_recommendations(self) -> List[str]:
        """Generate improvement recommendations"""
        recommendations = []
        
        if not self.quality_metrics:
            return ["No quality metrics available for recommendations"]
        
        # Completeness recommendations
        completeness_score = self.quality_metrics.get('completeness_score', 0)
        if completeness_score < 95:
            recommendations.append(f"Improve data completeness (current: {completeness_score:.1f}%)")
        
        # Consistency recommendations
        consistency_score = self.quality_metrics.get('consistency_score', 0)
        if consistency_score < 95:
            recommendations.append(f"Fix data consistency issues (current: {consistency_score:.1f}%)")
        
        # Duplicate recommendations
        duplicate_score = self.quality_metrics.get('duplicate_score', 0)
        if duplicate_score < 90:
            recommendations.append(f"Remove duplicate records (score: {duplicate_score:.1f}%)")
        
        # Dataset quality recommendations
        dataset_quality = self.quality_metrics.get('dataset_quality', {})
        for task_type, score in dataset_quality.items():
            if score < 90:
                recommendations.append(f"Improve {task_type} dataset quality (current: {score:.1f}%)")
        
        if not recommendations:
            recommendations.append("Dataset quality is good - no major improvements needed")
        
        return recommendations
    
    def save_validation_results(self):
        """Save all validation results"""
        logger.info("Saving validation results...")
        
        # Save detailed validation results
        validation_path = self.dataset_dir / 'metadata' / 'validation_results.json'
        with open(validation_path, 'w', encoding='utf-8') as f:
            json.dump(self.validation_results, f, indent=2, ensure_ascii=False)
        
        # Save quality scores
        quality_path = self.dataset_dir / 'metadata' / 'quality_scores.json'
        with open(quality_path, 'w', encoding='utf-8') as f:
            json.dump(self.quality_metrics, f, indent=2, ensure_ascii=False)
        
        # Save validation report
        report = self.generate_validation_report()
        report_path = self.dataset_dir / 'metadata' / 'validation_report.txt'
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report)
        
        logger.info(f"Validation results saved to {validation_path}")
        logger.info(f"Quality scores saved to {quality_path}")
        logger.info(f"Validation report saved to {report_path}")
        
        # Print summary
        print("\n" + "="*50)
        print("VALIDATION COMPLETE")
        print("="*50)
        print(report)
    
    def run_full_validation(self):
        """Run complete validation process"""
        logger.info("Starting full validation process...")
        
        # Validate cleaned data
        self.validate_cleaned_data()
        
        # Validate generated datasets
        self.validate_datasets()
        
        # Calculate quality scores
        self.calculate_quality_scores()
        
        # Save results
        self.save_validation_results()
        
        logger.info("Full validation process completed!")

def main():
    """Main execution function"""
    dataset_dir = "/Volumes/FastVault-Apps/Projects/ai-vvmv/llm-dataset"
    
    validator = VVMVDataValidator(dataset_dir)
    validator.run_full_validation()

if __name__ == "__main__":
    main()