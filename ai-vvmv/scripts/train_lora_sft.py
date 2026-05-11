#!/usr/bin/env python3
"""Fine-tune an instruct LLM with LoRA/QLoRA on the VVMV dataset.

This script requires optional training dependencies:
  pip install -r requirements-ai.txt

It is intended for a GPU/cloud training machine. The current Mac mini can
prepare data and run inference, but full 7B LoRA training will be slow or
unsupported without the right ML stack.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SPLITS = ROOT / "llm-dataset" / "ai-assets" / "training" / "splits"
DEFAULT_OUTPUT = ROOT / "models" / "vvmv-lora"


def require_training_deps():
    try:
        import torch  # type: ignore
        from datasets import load_dataset  # type: ignore
        from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training  # type: ignore
        from transformers import (  # type: ignore
            AutoModelForCausalLM,
            AutoTokenizer,
            BitsAndBytesConfig,
            DataCollatorForLanguageModeling,
            Trainer,
            TrainingArguments,
        )
    except Exception as exc:  # pragma: no cover - dependency gate
        raise SystemExit(
            "Missing training dependencies. Install optional deps first:\n"
            "  pip install -r requirements-ai.txt\n"
            "For CUDA QLoRA also install torch/bitsandbytes matching your GPU.\n"
            f"Import error: {exc}"
        )
    return {
        "torch": torch,
        "load_dataset": load_dataset,
        "LoraConfig": LoraConfig,
        "get_peft_model": get_peft_model,
        "prepare_model_for_kbit_training": prepare_model_for_kbit_training,
        "AutoModelForCausalLM": AutoModelForCausalLM,
        "AutoTokenizer": AutoTokenizer,
        "BitsAndBytesConfig": BitsAndBytesConfig,
        "DataCollatorForLanguageModeling": DataCollatorForLanguageModeling,
        "Trainer": Trainer,
        "TrainingArguments": TrainingArguments,
    }


def format_messages(example: Dict[str, Any], tokenizer) -> str:
    messages = example.get("messages") or []
    if hasattr(tokenizer, "apply_chat_template") and tokenizer.chat_template:
        return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)
    chunks: List[str] = []
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        chunks.append(f"<|{role}|>\n{content}")
    chunks.append("<|end|>")
    return "\n".join(chunks)


def main() -> None:
    parser = argparse.ArgumentParser(description="LoRA SFT for VVMV import/export assistant")
    parser.add_argument("--model", default="Qwen/Qwen2.5-7B-Instruct")
    parser.add_argument("--splits-dir", type=Path, default=DEFAULT_SPLITS)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--max-seq-length", type=int, default=2048)
    parser.add_argument("--max-train-samples", type=int, default=0)
    parser.add_argument("--max-eval-samples", type=int, default=2000)
    parser.add_argument("--epochs", type=float, default=1.0)
    parser.add_argument("--learning-rate", type=float, default=2e-4)
    parser.add_argument("--per-device-train-batch-size", type=int, default=1)
    parser.add_argument("--per-device-eval-batch-size", type=int, default=1)
    parser.add_argument("--gradient-accumulation-steps", type=int, default=16)
    parser.add_argument("--logging-steps", type=int, default=20)
    parser.add_argument("--save-steps", type=int, default=500)
    parser.add_argument("--eval-steps", type=int, default=500)
    parser.add_argument("--no-qlora", action="store_true", help="Disable 4-bit QLoRA")
    parser.add_argument("--bf16", action="store_true")
    args = parser.parse_args()

    train_file = args.splits_dir / "train.jsonl"
    val_file = args.splits_dir / "validation.jsonl"
    if not train_file.exists() or not val_file.exists():
        raise SystemExit(f"Missing splits in {args.splits_dir}. Run split_training_dataset.py first.")

    deps = require_training_deps()
    torch = deps["torch"]
    load_dataset = deps["load_dataset"]
    AutoTokenizer = deps["AutoTokenizer"]
    AutoModelForCausalLM = deps["AutoModelForCausalLM"]
    BitsAndBytesConfig = deps["BitsAndBytesConfig"]
    DataCollatorForLanguageModeling = deps["DataCollatorForLanguageModeling"]
    Trainer = deps["Trainer"]
    TrainingArguments = deps["TrainingArguments"]
    LoraConfig = deps["LoraConfig"]
    get_peft_model = deps["get_peft_model"]
    prepare_model_for_kbit_training = deps["prepare_model_for_kbit_training"]

    tokenizer = AutoTokenizer.from_pretrained(args.model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    quant_config = None
    if not args.no_qlora:
        quant_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=torch.bfloat16 if args.bf16 else torch.float16,
        )

    model = AutoModelForCausalLM.from_pretrained(
        args.model,
        trust_remote_code=True,
        quantization_config=quant_config,
        device_map="auto",
    )
    if not args.no_qlora:
        model = prepare_model_for_kbit_training(model)

    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    dataset = load_dataset("json", data_files={"train": str(train_file), "validation": str(val_file)})
    if args.max_train_samples:
        dataset["train"] = dataset["train"].select(range(min(args.max_train_samples, len(dataset["train"]))))
    if args.max_eval_samples:
        dataset["validation"] = dataset["validation"].select(range(min(args.max_eval_samples, len(dataset["validation"]))))

    def tokenize_batch(batch):
        texts = [format_messages({"messages": messages}, tokenizer) for messages in batch["messages"]]
        encoded = tokenizer(
            texts,
            truncation=True,
            max_length=args.max_seq_length,
            padding=False,
        )
        encoded["labels"] = [ids.copy() for ids in encoded["input_ids"]]
        return encoded

    tokenized = dataset.map(
        tokenize_batch,
        batched=True,
        remove_columns=dataset["train"].column_names,
        desc="Tokenizing VVMV instruction data",
    )

    training_args = TrainingArguments(
        output_dir=str(args.output_dir),
        num_train_epochs=args.epochs,
        learning_rate=args.learning_rate,
        per_device_train_batch_size=args.per_device_train_batch_size,
        per_device_eval_batch_size=args.per_device_eval_batch_size,
        gradient_accumulation_steps=args.gradient_accumulation_steps,
        logging_steps=args.logging_steps,
        save_steps=args.save_steps,
        eval_steps=args.eval_steps,
        evaluation_strategy="steps",
        save_strategy="steps",
        bf16=args.bf16,
        fp16=not args.bf16,
        report_to="none",
        remove_unused_columns=False,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized["train"],
        eval_dataset=tokenized["validation"],
        data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False),
    )
    trainer.train()
    trainer.save_model(str(args.output_dir))
    tokenizer.save_pretrained(str(args.output_dir))
    (args.output_dir / "training_run.json").write_text(
        json.dumps(vars(args), ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
