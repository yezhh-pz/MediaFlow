from pathlib import Path

# The path captured from debug_subtitle.txt
# Input audio_path: E:\Work\Code\Mediaflow\temp\Startup Archive - Mark Zuckerberg on the best advice Peter Thiel ever gave him  “Peter ... [2020470641623760896]_CN

path_str = r"E:\Work\Code\Mediaflow\temp\Startup Archive - Mark Zuckerberg on the best advice Peter Thiel ever gave him  “Peter ... [2020470641623760896]_CN"
p = Path(path_str)

print(f"Original: {path_str}")
print(f"Stem:     {p.stem}")
print(f"Suffix:   {p.suffix}")
print(f"with_suffix('.srt'): {p.with_suffix('.srt')}")

# Hypothesis: The '...' contains dots. 
# If p.suffix returns something starting with the first dot of '...', then with_suffix replaces everything after it.
