# Terminal Environment Rules

## Activation Mode: Always On

## Rule

Every terminal command executed by Cascade MUST begin with conda environment activation:

```bash
conda activate stjohn
```

### Why
- Windsurf Cascade may open fresh terminal instances that do not inherit the conda environment
- Running commands in the wrong environment causes subtle bugs (wrong Python version, missing packages)
- The `stjohn` environment contains all required tools for the HIDDEN exhibition project

### Enforcement
1. Before executing ANY terminal command, check if `(stjohn)` appears in the terminal prompt
2. If not present, run `conda activate stjohn` first
3. Never run `pip install` outside the `stjohn` environment
4. Never run `python` commands outside the `stjohn` environment

### Pattern
```bash
# Every terminal block must follow this pattern:
conda activate stjohn
<actual command>
```

### Common Commands
```bash
# Start dev server
conda activate stjohn
cd stjohn-hidden
python -m http.server 8080

# Check Python version
conda activate stjohn
python --version

# Git operations (safe outside env, but keep consistent)
conda activate stjohn
git add -A && git commit -m "task(N): description"
git push origin main
```
