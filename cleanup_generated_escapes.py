from pathlib import Path
files = [
    'server/_core/index.ts',
    'server/routers.ts',
    'server/scheduled.ts',
    'client/src/App.tsx',
    'client/src/pages/Home.tsx',
    'RECOVERY_NOTES.md',
]
root = Path('/home/ubuntu/jimmi-fit-recovery')
for rel in files:
    path = root / rel
    text = path.read_text()
    text = text.replace(r'\`', '`').replace(r'\${', '${')
    path.write_text(text)
print('cleaned generated escaping in', len(files), 'files')
