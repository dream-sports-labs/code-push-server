# ENDSLEY/BSDIFF43-macOS Utility

A macOS-compatible implementation of the ENDSLEY/BSDIFF43 binary diff and patch algorithm. While the standard `bsdiff` available through brew supports BSDIFF40 format, this tool specifically implements the enhanced ENDSLEY/BSDIFF43 format.

## Why ENDSLEY/BSDIFF43?

- No seeking operations during patch application
- Efficient streaming with minimal disk I/O
- Better cross-platform compatibility
- Designed for easy library integration
- Generates smaller patch sizes

## Credits

Built using the bsdiff/bspatch library:
- Original bsdiff algorithm by Colin Percival (2003-2005)
- Enhanced ENDSLEY/BSDIFF43 version by Matthew Endsley (2012)
- Source: https://github.com/mendsley/bsdiff

## Prerequisites

- Unix-like environment (macOS, Linux)
- GCC or compatible C compiler
- bzip2 library
  - macOS: Should be pre-installed
  - Ubuntu/Debian: `sudo apt-get install libbz2-dev`
  - CentOS/RHEL: `sudo yum install bzip2-devel`

## Usage

### Creating a Patch
```bash
code-push-standalone create-patch .dota/android/base/index.android.bundle .dota/android/new/index.android.bundle bundle.patch
```

### Applying a Patch
```bash
code-push-standalone apply-patch .dota/android/base/index.android.bundle bundle.patch .dota/android/new/index.android.bundle bundle.patch
```

## Compilation

```bash
cd bsdiff
make clean    # Clean any previous builds
make         # Build the bsdiff43 binary
```

## File Structure

- `bsdiff/` - Contains the binary diff/patch utility
  - `bsdiff43` - The compiled executable
  - `bsdiff.c`, `bsdiff.h` - Source for diff functionality
  - `bspatch.c`, `bspatch.h` - Source for patch functionality
  - `main.c` - Main program entry point
  - `Makefile` - Build configuration
  - `LICENSE` - BSD 2-clause license

## Advanced Usage

For direct library integration:

```c
// For creating patches
int bsdiff(const uint8_t* old, int64_t oldsize, 
           const uint8_t* new, int64_t newsize,
           struct bsdiff_stream* stream);

// For applying patches
int bspatch(const uint8_t* old, int64_t oldsize,
            uint8_t* new, int64_t newsize,
            struct bspatch_stream* stream);
```

## License

Licensed under BSD 2-clause:
```
Copyright 2003-2005 Colin Percival
Copyright 2012 Matthew Endsley
All rights reserved
```

Requirements:
1. Keep the copyright notice and license text in source files
2. Include the same copyright notice and license in binary distributions

See `bsdiff/LICENSE` for complete license text.