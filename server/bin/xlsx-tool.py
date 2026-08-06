#!/usr/bin/env python3
"""Dumb zip tool for xlsx surgery — no openpyxl needed.

The deli-form fill logic lives (and is unit-tested) in deli-form.js; this only
does the zip read/replace that Node's stdlib can't:

  extract <xlsx> <member>                       -> writes member bytes to stdout
  replace <template> <member> <newfile> <out>   -> copies template to <out> with
                                                   <member> replaced by <newfile>
"""
import sys, zipfile, shutil

def main():
    cmd = sys.argv[1]
    if cmd == "extract":
        xlsx, member = sys.argv[2], sys.argv[3]
        sys.stdout.buffer.write(zipfile.ZipFile(xlsx).read(member))
    elif cmd == "replace":
        template, member, newfile, out = sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
        new = open(newfile, "rb").read()
        zin = zipfile.ZipFile(template)
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = new if item.filename == member else zin.read(item.filename)
                zout.writestr(item, data)
    else:
        sys.exit("usage: xlsx-tool.py extract|replace ...")

if __name__ == "__main__":
    main()
