from pathlib import Path
p = Path('/home/ubuntu/jimmi-fit-recovery/rebuild_jimmi.mjs')
lines = p.read_text().splitlines()
out = []
in_block = False
for line in lines:
    stripped = line.strip()
    starts_block = "String.raw`" in line
    ends_block = in_block and stripped == "`);"
    if starts_block:
        out.append(line)
        in_block = True
        continue
    if ends_block:
        out.append(line)
        in_block = False
        continue
    if in_block:
        line = line.replace('`', r'\`').replace('${', r'\${')
    out.append(line)
p.write_text('\n'.join(out) + '\n')
print('escaped internal template syntax')
