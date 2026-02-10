from pathlib import Path

filenames = [
    "Startup Archive - Mark Zuckerberg on the best advice Peter Thiel ever gave him  “Peter ... [2020470641623760896].srt",
    "Startup Archive - Mark Zuckerberg on the best advice Peter Thiel ever gave him  “Peter ...srt",
    "Test ... .srt",
    "Test ... [id].srt"
]

for fname in filenames:
    p = Path(fname)
    print(f"Original: {fname}")
    print(f"Stem:     {p.stem}")
    print(f"Suffix:   {p.suffix}")
    print(f"Parent:   {p.parent}")
    print("-" * 20)
