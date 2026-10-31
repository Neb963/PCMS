"""Deterministic XPI: stable order, metadata and compression."""
import pathlib, sys, zipfile
root, target = map(pathlib.Path, sys.argv[1:])
with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as out:
    for file in sorted(root.rglob('*')):
        if not file.is_file(): continue
        info = zipfile.ZipInfo(file.relative_to(root).as_posix(), (2026, 1, 1, 0, 0, 0))
        info.external_attr = 0o100644 << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        out.writestr(info, file.read_bytes(), compresslevel=9)
