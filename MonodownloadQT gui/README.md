# Monodownload QT GUI

Graphical interface for running `monodownload/index.mjs`.

## Requirements

- Python 3.8+
- `bun` or `node` available on PATH
- `PyQt6` for the GUI

## Install dependencies

```bash
python3 -m pip install -r "MonodownloadQT gui/requirements.txt"
```

## Run

```bash
python3 "MonodownloadQT gui/main.py"
```

## Usage

1. Enter a source:
   - CSV/JSON/TXT playlist file
   - Monochrome link `/playlist/{id}`, `/album/{id}`, `/track/{id}`, or `/artist/{id}`
2. Choose an output folder.
3. Optionally set API URL, quality, genre providers, and other options.
4. Click `Start download`.

## Notes

- The GUI launches `monodownload/index.mjs` through `bun` if available, otherwise `node`.
- It polls the downloader stdout/stderr for progress and status updates.
